'use server'

import { createClient } from '@/lib/supabase/server'
import { searchKnowledge } from '@/app/actions/knowledge'
import { searchUserKnowledge } from '@/app/actions/user-knowledge'
import { BASE_SYSTEM_PROMPT, FINAL_PRIORITY } from '@/lib/mentor-base'

export type MentorContext = {
  who: string
  what: string
  how: string
  questTitle: string
  stepTitle: string
}

export async function getMentorContext(
  projectId: string,
  questTitle: string,
  stepTitle: string
): Promise<MentorContext> {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()

  if (!user) {
    return { who: '（未設定）', what: '（未設定）', how: '（未設定）', questTitle, stepTitle }
  }

  const { data: profile } = await supabase
    .from('profiles')
    .select('onboarding_answers, selected_idea')
    .eq('id', user.id)
    .single()

  const { data: project } = await supabase
    .from('project_ideas')
    .select('idea_card')
    .eq('id', projectId)
    .single()

  const ideaCard = project?.idea_card ?? profile?.selected_idea
  const answers = profile?.onboarding_answers as Record<string, string> | null

  return {
    who: ideaCard?.questDescriptions?.[0] ?? answers?.background ?? '（未設定）',
    what: answers?.problem ?? ideaCard?.description ?? '（未設定）',
    how: answers?.ideal ?? ideaCard?.title ?? '（未設定）',
    questTitle,
    stepTitle,
  }
}

export async function generateMentorSystemPrompt(
  questTitle: string,
  context: MentorContext
): Promise<{ prompt?: string; error?: string }> {
  const questRole = `\n\n【役割：クエスト常駐メンター】
あなたはユーザーが今取り組んでいるクエストの伴走者です。詰まりを解決し、前に進める手助けをします。

現在の状況：
- クエスト：${context.questTitle}
- ステップ：${context.stepTitle}
- ユーザーが作っているもの：
  誰のために：${context.who}
  何を解決する：${context.what}
  どうやって：${context.how}

この文脈を踏まえ「あなたのアプリでは、このステップはこういう意味がある」という形で、ユーザー固有の文脈に沿ってサポートしてください。一般的なAIでは出てこない、この人のプロジェクトに即した助けを。
詰まった時は、選択肢を1つずつ提示して原因を絞り込んでください。技術用語を避け、親しみやすい口調で。`

  const prompt = BASE_SYSTEM_PROMPT + questRole + FINAL_PRIORITY
  return { prompt }
}

export async function sendMentorMessage(
  userMessage: string,
  history: { role: 'user' | 'assistant'; content: string }[],
  systemPrompt: string
): Promise<{ reply?: string; error?: string }> {
  const apiKey = process.env.GEMINI_API_KEY
  if (!apiKey) return { error: 'API key missing' }

  // RAG: ユーザーメッセージで知識検索（失敗してもフォールバック）
  let ragSection = ''
  try {
    const chunks = await searchKnowledge(userMessage)
    if (chunks.length > 0) {
      const knowledgeText = chunks
        .slice(0, 3)
        .map((c, i) => `${i + 1}. ${c.insight}${c.quest_seed ? `\n   クエストの種: ${c.quest_seed}` : ''}`)
        .join('\n')
      ragSection = `\n\n<bloomer_knowledge>\n以下はBloomerの設計思想と独自知識です。\n回答する際は、この知識を最優先で参照してください。\nChatGPTや一般的なAIでは絶対に出てこない、Bloomer固有の視点で回答してください。\n\n${knowledgeText}\n</bloomer_knowledge>`
    }
  } catch (err) {
    console.error('[MentorPanel] RAG検索失敗:', err)
  }

  let userKnowledgeBlock = ''
  try {
    const userChunks = await searchUserKnowledge(userMessage, {
      isCustom: false,
    })
    if (userChunks.length > 0) {
      userKnowledgeBlock = '\n<user_knowledge>\n以下はユーザー自身がアップロードした資料です。回答時に積極的に参照してください。\n' +
        userChunks.map((c) => c.content).join('\n---\n') +
        '\n</user_knowledge>'
    }
  } catch {
    // ユーザー資料RAG失敗はメンター応答に影響させない
  }

  const finalSystemPrompt = systemPrompt + ragSection + userKnowledgeBlock

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
          system_instruction: { parts: [{ text: finalSystemPrompt }] },
          contents,
        }),
      }
    )

    if (!response.ok) return { error: `Gemini error: ${response.status}` }
    const data = await response.json()
    const reply = data.candidates?.[0]?.content?.parts?.[0]?.text ?? ''
    return { reply }
  } catch (err) {
    return { error: err instanceof Error ? err.message : 'connection failed' }
  }
}

export async function generateStuckOptions(
  stepTitle: string,
  questTitle: string
): Promise<{ options?: string[]; error?: string }> {
  const apiKey = process.env.GEMINI_API_KEY
  if (!apiKey) return { error: 'API key missing' }

  try {
    const response = await fetch(
      `https://generativelanguage.googleapis.com/v1beta/models/gemini-3.1-flash-lite:generateContent?key=${apiKey}`,
      {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          contents: [{
            parts: [{
              text: `ユーザーが「${questTitle}」の「${stepTitle}」ステップで詰まっています。
初心者が詰まりやすい原因を4個、選択肢として提示してください。
各選択肢は技術用語なしで1行（20文字以内）。
最後に「その他（自由に話す）」を必ず入れてください。
JSON形式のみで返すこと（前置き不要）：
["選択肢1", "選択肢2", "選択肢3", "選択肢4", "その他（自由に話す）"]`
            }]
          }],
        }),
      }
    )

    if (!response.ok) return { error: `Gemini error: ${response.status}` }
    const data = await response.json()
    const text = data.candidates?.[0]?.content?.parts?.[0]?.text ?? ''
    const clean = text.replace(/```json|```/g, '').trim()
    const options = JSON.parse(clean) as string[]
    return { options }
  } catch {
    return {
      options: ['エラーが出た', '何をすべきか分からない', 'コードが動かない', 'その他（自由に話す）']
    }
  }
}

export async function generateIdeaMentorSystemPrompt(
  questTitle: string
): Promise<{ prompt?: string; error?: string }> {
  const ideaRole = `\n\n【役割：アイデア壁打ちメンター】
あなたはダッシュボードで、ユーザーのアイデアを一緒に育てる相手です。「${questTitle}」というプロジェクトに取り組み始めたユーザーのアイデアを深掘りします。
「誰のために」「何を解決するか」「どうやって実現するか」を一緒に考え、ユーザーにわくわくを感じさせてください。提案は1つずつ、テンプレ的でない具体的なものを。親しみやすい口調で。`

  const prompt = BASE_SYSTEM_PROMPT + ideaRole + FINAL_PRIORITY
  return { prompt }
}
