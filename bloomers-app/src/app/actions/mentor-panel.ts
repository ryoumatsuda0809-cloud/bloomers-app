'use server'

import { createClient } from '@/lib/supabase/server'

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
  const apiKey = process.env.GEMINI_API_KEY
  if (!apiKey) return { error: 'API key missing' }

  const systemReminder = `
<system-reminder>
現在の状況：
- クエスト：${context.questTitle}
- ステップ：${context.stepTitle}
- ユーザーが作ってるもの：
  誰のために：${context.who}
  何を解決する：${context.what}
  どうやって：${context.how}

この文脈を踏まえた上で「あなたのアプリでは、このステップはこういう意味がある」
という形でユーザーをサポートしてください。
ChatGPTでは絶対に出てこない、ユーザー固有の文脈に沿ったサポートをしてください。
</system-reminder>`.trim()

  try {
    const response = await fetch(
      `https://generativelanguage.googleapis.com/v1beta/models/gemini-3.1-flash-lite:generateContent?key=${apiKey}`,
      {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          contents: [{
            parts: [{
              text: `以下の情報を元に「${questTitle}」クエスト専用のメンター・システムプロンプトを生成してください。
このクエストで初心者が詰まりやすいポイントを3〜5個特定し、
各ポイントに対する解決策を熟知した専門家として振る舞う指示を含めてください。
出力はシステムプロンプトの文章のみ（前置き不要）：

${systemReminder}

追記すべき内容：
- 「${questTitle}」で初心者が詰まりやすい具体的ポイント
- 詰まった時は選択肢を1つずつ提示して原因を絞り込む
- 技術用語を使わず友達のような口調（「だね」「だよ」）
- 1回の返答は3文以内
- 絶対に同じ質問を繰り返さない`
            }]
          }],
        }),
      }
    )

    if (!response.ok) return { error: `Gemini error: ${response.status}` }
    const data = await response.json()
    const prompt = data.candidates?.[0]?.content?.parts?.[0]?.text ?? ''
    return { prompt }
  } catch (err) {
    return { error: err instanceof Error ? err.message : 'generation failed' }
  }
}

export async function sendMentorMessage(
  userMessage: string,
  history: { role: 'user' | 'assistant'; content: string }[],
  systemPrompt: string
): Promise<{ reply?: string; error?: string }> {
  const apiKey = process.env.GEMINI_API_KEY
  if (!apiKey) return { error: 'API key missing' }

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
