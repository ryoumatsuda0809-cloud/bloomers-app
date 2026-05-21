'use server'

import { createClient } from '@/lib/supabase/server'
import { saveProjectIdea } from '@/app/actions/projects'
import type { PersonalityData } from '@/app/actions/onboarding'
import { searchKnowledge } from '@/app/actions/knowledge'

export type ChatMessage = {
  id: string
  role: 'user' | 'assistant'
  content: string
  createdAt: string
}

export async function getChatHistory(): Promise<ChatMessage[]> {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return []

  const { data: activeProject } = await supabase
    .from('project_ideas')
    .select('id')
    .eq('user_id', user.id)
    .eq('is_active', true)
    .single()

  const projectId = activeProject?.id ?? null

  const { data } = await supabase
    .from('chat_messages')
    .select('*')
    .eq('user_id', user.id)
    .eq('project_id', projectId)
    .order('created_at', { ascending: true })

  return (data ?? []).map((row) => ({
    id: row.id,
    role: row.role,
    content: row.content,
    createdAt: row.created_at,
  }))
}

export async function sendMessage(
  userMessage: string,
  history: { role: string; content: string }[]
): Promise<{ reply: string; ideaGenerated?: boolean; error?: string }> {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return { reply: '', error: '認証エラーが発生しました。' }

  const apiKey = process.env.GEMINI_API_KEY
  if (!apiKey) return { reply: 'メンターに接続できませんでした。', error: 'API key missing' }

  const { data: activeProject } = await supabase
    .from('project_ideas')
    .select('id')
    .eq('user_id', user.id)
    .eq('is_active', true)
    .single()

  const projectId = activeProject?.id ?? null

  // ユーザーのプロフィールを取得
  const { data: profile } = await supabase
    .from('profiles')
    .select('personality_data, selected_idea')
    .eq('id', user.id)
    .single()

  const personality = profile?.personality_data as PersonalityData | null

  // ユーザーメッセージをDBに保存
  await supabase.from('chat_messages').insert({
    user_id: user.id,
    role: 'user',
    content: userMessage,
    project_id: projectId,
  })

  const knowledgeChunks = await searchKnowledge(userMessage)

  const knowledgeContext = knowledgeChunks.length > 0
    ? `
【Bloomerの知識ベース】
以下はRyoumaさんの調査に基づく独自の知識です。回答の根拠として優先的に使用してください：
${knowledgeChunks.map((c, i) => `
${i + 1}. ${c.trigger}
   事実: ${c.fact}
   洞察: ${c.insight}
   ${c.quest_seed ? `クエストの種: ${c.quest_seed}` : ''}
`).join('')}
`
    : ''

  const systemPrompt = `${knowledgeContext}
あなたはBloomerというサービスの優しいメンターです。
初心者の若者・大学生が「作りたいもの」を見つけるお手伝いをします。

【ユーザー情報】
${personality ? `
- 一番時間を使っていること: ${personality.timeUsage}
- MBTI: ${personality.mbti}
- 地元・日常の不便: ${personality.localPain}
` : '（プロフィール未設定）'}

【会話のルール】
1. 友達のような口調で話す（「だね」「だよ」「かな？」）
2. 技術用語は絶対に使わない
3. 1回の返答で聞くことは1つだけ
4. 「誰が」「いつ」「なぜ」「どこで」を自然に深掘りする
5. 3〜5往復したら「こんなの作れそうだけど、どう思う？」と提案する
6. 提案する時は必ず以下のJSON形式を返答の末尾に追加する：
   %%%IDEA%%%
   {
     "title": "アイデアのタイトル（20文字以内）",
     "description": "どんなサービスか（40文字以内）",
     "questTitles": ["q1", "q2", "q3", "q4", "q5"],
     "questDescriptions": ["説明1", "説明2", "説明3", "説明4", "説明5"]
   }
   %%%END%%%
7. ユーザーが「いいね」「それで」など肯定したら保存する
8. 「違う」「別のが良い」なら別角度で再提案する
9. 初心者が不安にならないよう、常に「大丈夫だよ」という雰囲気を保つ
10. 【重要】Bloomerの知識ベースに関連情報がある場合は、その深層知識（Insight）を
    会話に自然に織り交ぜること。ただし「データによると」などの無機質な言い回しは避け、
    友達が教えてくれるような自然なトーンで伝えること
11. 【返答の長さ制限】1回の返答は必ず3文以内または短い1段落で完結させること。情報を網羅しようとせず、最も重要な1つの事実や洞察のみに絞ること
12. 【フォーマット制限】箇条書き・番号付きリストは絶対に使わないこと。どうしても列挙が必要な場合は自然な文章に組み込むこと
13. 【フィラー排除】「わかりました」「〜について説明します」「結論として」などの前置きフレーズは一切使わず、答えから直接書き始めること

【返答の良い例・悪い例】
Q: 大学生が開発で挫折する理由は？
悪い例: 挫折の理由には様々なものがあります。1.環境構築の難しさ 2.エラーへの対処 3.モチベーション維持...（長い箇条書き）
良い例: 一番の理由は「次に何をすればいいか分からなくなること」だよ。選択肢が多いほど人は動けなくなる。だからBloomerは「今日やること1つだけ」を提示するんだ。`

  const contents = [
    ...history.map((m) => ({
      role: m.role === 'user' ? 'user' : 'model',
      parts: [{ text: m.content }],
    })),
    {
      role: 'user',
      parts: [{ text: userMessage }],
    },
  ]

  try {
    const requestBody = JSON.stringify({
      system_instruction: { parts: [{ text: systemPrompt }] },
      contents,
    })

    let response: Response | null = null
    for (let attempt = 0; attempt < 3; attempt++) {
      if (attempt > 0) await new Promise((r) => setTimeout(r, 1000))
      response = await fetch(
        `https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-flash:generateContent?key=${apiKey}`,
        {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: requestBody,
        }
      )
      if (response.ok || response.status !== 503) break
    }

    if (!response || !response.ok) {
      const errorBody = await response?.text()
      console.error('Gemini APIエラー:', response?.status, errorBody)
      return { reply: 'メンターが少し忙しいみたい。もう一度試してみて！' }
    }

    const data = await response.json()
    const fullReply = data.candidates?.[0]?.content?.parts?.[0]?.text ?? ''

    // アイデアが含まれているか確認
    const ideaMatch = fullReply.match(/%%%IDEA%%%([\s\S]*?)%%%END%%%/)
    let ideaGenerated = false
    let cleanReply = fullReply

    if (ideaMatch) {
      try {
        const ideaJson = JSON.parse(ideaMatch[1].trim())
        cleanReply = fullReply.replace(/%%%IDEA%%%([\s\S]*?)%%%END%%%/, '').trim()

        // アイデアをDBに保存
        if (personality) {
          await saveProjectIdea(personality, ideaJson)
          ideaGenerated = true
        }
      } catch {
        // JSON parse失敗は無視
      }
    }

    // AIの返答をDBに保存
    await supabase.from('chat_messages').insert({
      user_id: user.id,
      role: 'assistant',
      content: cleanReply,
      project_id: projectId,
    })

    return { reply: cleanReply, ideaGenerated }

  } catch {
    return { reply: 'メンターに接続できませんでした。もう一度試してみて！' }
  }
}

export async function clearChatHistory(): Promise<void> {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return

  const { data: activeProject } = await supabase
    .from('project_ideas')
    .select('id')
    .eq('user_id', user.id)
    .eq('is_active', true)
    .single()

  if (!activeProject) return

  await supabase
    .from('chat_messages')
    .delete()
    .eq('user_id', user.id)
    .eq('project_id', activeProject.id)
}
