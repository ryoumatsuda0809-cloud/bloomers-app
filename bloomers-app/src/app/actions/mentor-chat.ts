'use server'

import { createClient } from '@/lib/supabase/server'
import { searchKnowledge } from '@/app/actions/knowledge'
import { searchUserKnowledge } from '@/app/actions/user-knowledge'

export type MentorMode = 'idea' | 'dev' | 'general'

export type Conversation = {
  id: string
  title: string
  mentorMode: MentorMode
  isPinned: boolean
  createdAt: string
  updatedAt: string
}

export type ConvMessage = {
  id: string
  role: 'user' | 'assistant'
  content: string
  createdAt: string
}

export type Attachment = {
  mimeType: string
  data: string
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
    .order('is_pinned', { ascending: false })
    .order('updated_at', { ascending: false })

  if (error) return []

  return (data ?? []).map((row) => ({
    id: row.id,
    title: row.title,
    mentorMode: row.mentor_mode as MentorMode,
    isPinned: row.is_pinned ?? false,
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
      isPinned: data.is_pinned ?? false,
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
  history: { role: 'user' | 'assistant'; content: string }[],
  attachment?: Attachment
): Promise<{ reply?: string; error?: string }> {
  const apiKey = process.env.GEMINI_API_KEY
  if (!apiKey) return { error: 'API key missing' }

  if (attachment) {
    const allowed = ['image/png', 'image/jpeg', 'application/pdf']
    if (!allowed.includes(attachment.mimeType)) {
      return { error: '対応していないファイル形式です（png/jpg/pdfのみ）。' }
    }
    const approxBytes = (attachment.data.length * 3) / 4
    if (approxBytes > 10 * 1024 * 1024) {
      return { error: 'ファイルサイズが大きすぎます（10MBまで）。' }
    }
  }

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

  let userKnowledgeBlock = ''
  try {
    const userChunks = await searchUserKnowledge(userMessage)
    if (userChunks.length > 0) {
      userKnowledgeBlock = '\n<user_knowledge>\n以下はユーザー自身がアップロードした資料です。回答時に積極的に参照してください。\n' +
        userChunks.map((c) => c.content).join('\n---\n') +
        '\n</user_knowledge>'
    }
  } catch {
    // ユーザー資料RAG失敗はメンター応答に影響させない
  }

  const systemPrompt = buildMentorSystemPrompt(mentorMode) + ragSection + userKnowledgeBlock

  const latestParts: Array<{ text?: string; inline_data?: { mime_type: string; data: string } }> = []
  if (attachment) {
    latestParts.push({ inline_data: { mime_type: attachment.mimeType, data: attachment.data } })
  }
  latestParts.push({ text: userMessage })

  const contents = [
    ...history.map((m) => ({
      role: m.role === 'user' ? 'user' : 'model',
      parts: [{ text: m.content }],
    })),
    { role: 'user', parts: latestParts },
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

export async function renameConversation(
  conversationId: string,
  newTitle: string
): Promise<{ success?: boolean; error?: string }> {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return { error: '認証エラーが発生しました。' }

  const trimmed = newTitle.trim()
  if (!trimmed) return { error: 'タイトルが空です。' }

  const { error } = await supabase
    .from('conversations')
    .update({ title: trimmed.slice(0, 50) })
    .eq('id', conversationId)
    .eq('user_id', user.id)

  if (error) return { error: 'タイトルの変更に失敗しました。' }
  return { success: true }
}

export async function pinConversation(
  conversationId: string,
  isPinned: boolean
): Promise<{ success?: boolean; error?: string }> {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return { error: '認証エラーが発生しました。' }

  const { error } = await supabase
    .from('conversations')
    .update({ is_pinned: isPinned })
    .eq('id', conversationId)
    .eq('user_id', user.id)

  if (error) return { error: 'ピン留めに失敗しました。' }
  return { success: true }
}

export async function deleteConversation(
  conversationId: string
): Promise<{ success?: boolean; error?: string }> {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return { error: '認証エラーが発生しました。' }

  const { error } = await supabase
    .from('conversations')
    .delete()
    .eq('id', conversationId)
    .eq('user_id', user.id)

  if (error) return { error: 'チャットの削除に失敗しました。' }
  return { success: true }
}

export async function updateConversationMode(
  conversationId: string,
  mentorMode: MentorMode
): Promise<{ success?: boolean; error?: string }> {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return { error: '認証エラーが発生しました。' }

  const { error } = await supabase
    .from('conversations')
    .update({ mentor_mode: mentorMode })
    .eq('id', conversationId)
    .eq('user_id', user.id)

  if (error) return { error: 'メンター種類の変更に失敗しました。' }
  return { success: true }
}
