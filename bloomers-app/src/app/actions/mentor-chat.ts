'use server'

import { createClient } from '@/lib/supabase/server'
import { searchKnowledge } from '@/app/actions/knowledge'

export type MentorMode = 'idea' | 'dev' | 'general'

export type Conversation = {
  id: string
  title: string
  mentorMode: MentorMode
  createdAt: string
  updatedAt: string
}

export type ConvMessage = {
  id: string
  role: 'user' | 'assistant'
  content: string
  createdAt: string
}

function buildMentorSystemPrompt(mode: MentorMode): string {
  const base = `あなたはBloomerのメンターです。
技術用語を使わず友達のような口調で話してください。
1回の返答は3文以内。答えから直接書き始めてください。
同じ質問を繰り返さないでください。`

  if (mode === 'idea') {
    return `${base}

【役割：アイデア出しメンター】
ユーザーが作りたいものを一緒に見つけ、育てます。
「誰のために」「何を解決するか」「どうやって実現するか」を引き出してください。
ユーザーに「わくわく」を感じさせてください。`
  }
  if (mode === 'dev') {
    return `${base}

【役割：問題解決メンター】
ユーザーが開発で詰まっている問題を解決します。
詰まっている箇所を選択肢で1つずつ絞り込んでください。
初心者が安心できるよう、専門用語は噛み砕いて説明してください。`
  }
  return `${base}

【役割：なんでも相談メンター】
ユーザーのどんな相談にも親身に答えます。
開発・アイデア・モチベーション、何でも受け止めてください。`
}

export async function getConversations(): Promise<Conversation[]> {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return []

  const { data, error } = await supabase
    .from('conversations')
    .select('*')
    .eq('user_id', user.id)
    .order('updated_at', { ascending: false })

  if (error) return []

  return (data ?? []).map((row) => ({
    id: row.id,
    title: row.title,
    mentorMode: row.mentor_mode as MentorMode,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  }))
}

export async function createConversation(
  mentorMode: MentorMode
): Promise<{ conversation?: Conversation; error?: string }> {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return { error: '認証エラーが発生しました。' }

  const { data, error } = await supabase
    .from('conversations')
    .insert({ user_id: user.id, mentor_mode: mentorMode, title: '新規チャット' })
    .select()
    .single()

  if (error || !data) return { error: 'チャットの作成に失敗しました。' }

  return {
    conversation: {
      id: data.id,
      title: data.title,
      mentorMode: data.mentor_mode as MentorMode,
      createdAt: data.created_at,
      updatedAt: data.updated_at,
    },
  }
}

export async function getConversationMessages(
  conversationId: string
): Promise<ConvMessage[]> {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return []

  const { data, error } = await supabase
    .from('chat_messages')
    .select('*')
    .eq('user_id', user.id)
    .eq('conversation_id', conversationId)
    .order('created_at', { ascending: true })

  if (error) return []

  return (data ?? []).map((row) => ({
    id: row.id,
    role: row.role,
    content: row.content,
    createdAt: row.created_at,
  }))
}

export async function sendMentorChatMessage(
  conversationId: string,
  userMessage: string,
  mentorMode: MentorMode,
  history: { role: 'user' | 'assistant'; content: string }[]
): Promise<{ reply?: string; error?: string }> {
  const apiKey = process.env.GEMINI_API_KEY
  if (!apiKey) return { error: 'API key missing' }

  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return { error: '認証エラーが発生しました。' }

  await supabase.from('chat_messages').insert({
    user_id: user.id,
    conversation_id: conversationId,
    role: 'user',
    content: userMessage,
    project_id: null,
    quest_id: null,
  })

  let ragSection = ''
  try {
    const chunks = await searchKnowledge(userMessage)
    if (chunks.length > 0) {
      const knowledgeText = chunks
        .slice(0, 3)
        .map((c, i) => `${i + 1}. ${c.insight}${c.quest_seed ? `\n   クエストの種: ${c.quest_seed}` : ''}`)
        .join('\n')
      ragSection = `

<bloomer_knowledge>
以下はBloomerの設計思想と独自知識です。回答時に最優先で参照してください。
${knowledgeText}
</bloomer_knowledge>`
    }
  } catch {
    // RAG失敗は無視
  }

  const systemPrompt = buildMentorSystemPrompt(mentorMode) + ragSection

  const contents = [
    ...history.map((m) => ({
      role: m.role === 'user' ? 'user' : 'model',
      parts: [{ text: m.content }],
    })),
    { role: 'user', parts: [{ text: userMessage }] },
  ]

  try {
    const response = await fetch(
      `https://generativelanguage.googleapis.com/v1beta/models/gemini-3.1-flash-lite:generateContent?key=${apiKey}`,
      {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          system_instruction: { parts: [{ text: systemPrompt }] },
          contents,
        }),
      }
    )

    if (!response.ok) return { error: `Gemini error: ${response.status}` }
    const data = await response.json()
    const reply: string = data.candidates?.[0]?.content?.parts?.[0]?.text ?? ''

    if (reply) {
      await supabase.from('chat_messages').insert({
        user_id: user.id,
        conversation_id: conversationId,
        role: 'assistant',
        content: reply,
        project_id: null,
        quest_id: null,
      })
      await supabase
        .from('conversations')
        .update({ updated_at: new Date().toISOString() })
        .eq('id', conversationId)
        .eq('user_id', user.id)
    }

    return { reply }
  } catch (err) {
    return { error: err instanceof Error ? err.message : 'connection failed' }
  }
}

export async function generateConversationTitle(
  conversationId: string,
  firstMessage: string
): Promise<{ title?: string; error?: string }> {
  const apiKey = process.env.GEMINI_API_KEY
  const fallbackTitle = firstMessage.slice(0, 15)

  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return { error: 'no user' }

  let title = fallbackTitle

  if (apiKey) {
    try {
      const response = await fetch(
        `https://generativelanguage.googleapis.com/v1beta/models/gemini-3.1-flash-lite:generateContent?key=${apiKey}`,
        {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            contents: [{
              parts: [{
                text: `次のメッセージを15文字以内の短いタイトルに要約してください。タイトルのみ出力（記号・引用符なし）：\n\n${firstMessage}`,
              }],
            }],
          }),
        }
      )
      if (response.ok) {
        const data = await response.json()
        const generated: string | undefined = data.candidates?.[0]?.content?.parts?.[0]?.text?.trim()
        if (generated) title = generated.slice(0, 20)
      }
    } catch {
      // 失敗時は fallbackTitle のまま
    }
  }

  await supabase
    .from('conversations')
    .update({ title })
    .eq('id', conversationId)
    .eq('user_id', user.id)

  return { title }
}
