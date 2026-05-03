'use server'

import { createClient } from '@/lib/supabase/server'
import { saveProjectIdea } from '@/app/actions/projects'
import type { PersonalityData } from '@/app/actions/onboarding'

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

  const systemPrompt = `あなたはBloomerというサービスの優しいメンターです。
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
9. 初心者が不安にならないよう、常に「大丈夫だよ」という雰囲気を保つ`

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
    const response = await fetch(
      `https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-flash:generateContent?key=${apiKey}`,
      {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          system_instruction: { parts: [{ text: systemPrompt }] },
          contents,
        }),
      }
    )

    if (!response.ok) {
      const errorBody = await response.text()
      console.error('Gemini APIエラー:', response.status, errorBody)
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
