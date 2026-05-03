'use server'

import { createClient } from '@/lib/supabase/server'
import { generateSetupSteps, generateQuestSteps } from '@/app/actions/setup'

export type PersonalityData = {
  timeUsage: string
  mbti: string
  localPain: string
}

export type IdeaCard = {
  title: string
  description: string
  questTitles: string[]
  questDescriptions: string[]
}

export async function generateIdeasWithAI(
  personality: PersonalityData
): Promise<IdeaCard[]> {
  const apiKey = process.env.GEMINI_API_KEY
  if (!apiKey) return getFallbackIdeas()

  const seed = Date.now()

  try {
    const response = await fetch(
      `https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-flash:generateContent?key=${apiKey}`,
      {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          contents: [{
            parts: [{
              text: `あなたはスタートアップのメンターです。
以下のユーザー情報を元に、そのユーザーだけに最適な
Webアプリのアイデアを3つ提案してください。

【ユーザー情報】
- 一番時間を使っていること: ${personality.timeUsage}
- MBTI: ${personality.mbti}
- 地元・日常の不便: ${personality.localPain}
- シード値（毎回違うアイデアのため）: ${seed}

【ルール】
- 同じMBTI of ユーザーでも必ず違うアイデアを返すこと
- アイデアはユーザーの趣味・性格・地域に深く根ざすこと
- 技術用語は使わず、初心者でもワクワクする言葉で書くこと
- 必ず以下のJSON形式のみで返すこと（前置き・説明不要）

[
  {
    "title": "アイデアのタイトル（20文字以内）",
    "description": "どんなサービスか（40文字以内）",
    "questTitles": [
      "q1のタイトル",
      "q2のタイトル",
      "q3のタイトル",
      "q4のタイトル",
      "q5のタイトル"
    ],
    "questDescriptions": [
      "q1の説明",
      "q2の説明",
      "q3の説明",
      "q4の説明",
      "q5の説明"
    ]
  },
  { ... },
  { ... }
]`
            }]
          }]
        }),
      }
    )

    if (!response.ok) return getFallbackIdeas()

    const data = await response.json()
    const text = data.candidates?.[0]?.content?.parts?.[0]?.text ?? ''
    const clean = text.replace(/```json|```/g, '').trim()
    const parsed = JSON.parse(clean)
    return parsed

  } catch {
    return getFallbackIdeas()
  }
}

function getFallbackIdeas(): IdeaCard[] {
  return [
    {
      title: '予約・管理アプリ',
      description: '時間や場所の予約をスマートに管理するサービス',
      questTitles: [
        '予約アプリの開発環境を作る',
        '予約画面のUIを作る',
        '予約データをDBに保存する',
        '予約アプリにログインを追加する',
        '予約アプリを世界に公開する',
      ],
      questDescriptions: [
        '予約アプリの土台となる環境を整える',
        'ユーザーが予約できる画面を作る',
        '予約情報をデータベースに保存する',
        'ユーザーがログインできるようにする',
        'Vercelで予約アプリを公開する',
      ],
    },
    {
      title: '情報共有アプリ',
      description: '地域の情報をみんなで共有できるサービス',
      questTitles: [
        '情報共有アプリの開発環境を作る',
        '投稿画面のUIを作る',
        '投稿データをDBに保存する',
        '情報共有アプリにログインを追加する',
        '情報共有アプリを世界に公開する',
      ],
      questDescriptions: [
        '情報共有アプリの土台となる環境を整える',
        'ユーザーが情報を投稿できる画面を作る',
        '投稿情報をデータベースに保存する',
        'ユーザーがログインできるようにする',
        'Vercelで情報共有アプリを公開する',
      ],
    },
    {
      title: 'コミュニティアプリ',
      description: '共通の興味を持つ人が集まれるサービス',
      questTitles: [
        'コミュニティアプリの開発環境を作る',
        '掲示板画面のUIを作る',
        '投稿データをDBに保存する',
        'コミュニティアプリにログインを追加する',
        'コミュニティアプリを世界に公開する',
      ],
      questDescriptions: [
        'コミュニティアプリの土台となる環境を整える',
        'ユーザーが投稿できる掲示板画面を作る',
        '投稿情報をデータベースに保存する',
        'ユーザーがログインできるようにする',
        'Vercelでコミュニティアプリを公開する',
      ],
    },
  ]
}

export async function saveOnboardingData(
  personality: PersonalityData,
  selectedIdea: IdeaCard,
  allIdeas: IdeaCard[]
): Promise<{ success?: boolean; error?: string }> {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return { error: '認証エラーが発生しました。' }

  const { error } = await supabase
    .from('profiles')
    .update({
      personality_data: personality,
      selected_idea: selectedIdea,
      generated_ideas: allIdeas,
      onboarding_completed: true,
      onboarding_answers: {
        answer1: personality.timeUsage,
        answer2: personality.localPain,
      },
    })
    .eq('id', user.id)

  if (error) return { error: 'データの保存に失敗しました。' }

  // project_ideasにも保存
  await supabase
    .from('project_ideas')
    .insert({
      user_id: user.id,
      title: selectedIdea.title,
      description: selectedIdea.description,
      personality_data: personality,
      idea_card: selectedIdea,
      is_active: true,
    })

  // 他のプロジェクトをis_active: falseに
  await supabase
    .from('project_ideas')
    .update({ is_active: false })
    .eq('user_id', user.id)
    .neq('title', selectedIdea.title)

  // 生成したプロジェクトのIDを取得
  const { data: newProject } = await supabase
    .from('project_ideas')
    .select('id')
    .eq('user_id', user.id)
    .eq('title', selectedIdea.title)
    .order('created_at', { ascending: false })
    .limit(1)
    .single()

  if (newProject) {
    const steps = await generateSetupSteps(
      selectedIdea.title,
      selectedIdea.description
    )
    await supabase
      .from('project_ideas')
      .update({ setup_steps: steps })
      .eq('id', newProject.id)
  }

  // q2〜q5のステップも生成して保存
  const [q2Steps, q3Steps, q4Steps, q5Steps] = await Promise.all([
    generateQuestSteps(2, selectedIdea.title, selectedIdea.description),
    generateQuestSteps(3, selectedIdea.title, selectedIdea.description),
    generateQuestSteps(4, selectedIdea.title, selectedIdea.description),
    generateQuestSteps(5, selectedIdea.title, selectedIdea.description),
  ])

  if (newProject) {
    await supabase
      .from('project_ideas')
      .update({
        quest2_steps: q2Steps,
        quest3_steps: q3Steps,
        quest4_steps: q4Steps,
        quest5_steps: q5Steps,
      })
      .eq('id', newProject.id)
  }

  return { success: true }
}

export async function getOnboardingStatus(): Promise<boolean> {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return false

  const { data } = await supabase
    .from('profiles')
    .select('onboarding_completed')
    .eq('id', user.id)
    .single()

  return data?.onboarding_completed ?? false
}

export async function getSelectedIdea(): Promise<IdeaCard | null> {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return null

  const { data } = await supabase
    .from('profiles')
    .select('selected_idea')
    .eq('id', user.id)
    .single()

  return data?.selected_idea ?? null
}

export async function resetOnboarding(): Promise<{ success?: boolean; error?: string }> {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return { error: '認証エラーが発生しました。' }

  const { error } = await supabase
    .from('profiles')
    .update({
      onboarding_completed: false,
      personality_data: null,
      selected_idea: null,
      generated_ideas: null,
    })
    .eq('id', user.id)

  if (error) return { error: 'リセットに失敗しました。' }
  return { success: true }
}
