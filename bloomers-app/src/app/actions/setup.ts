'use server'

import { createClient } from '@/lib/supabase/server'

export type SetupStep = {
  id: string
  title: string
  description: string
  link?: string | null
  linkLabel?: string | null
  completed: boolean
}

export async function generateSetupSteps(
  ideaTitle: string,
  ideaDescription: string
): Promise<SetupStep[]> {
  const apiKey = process.env.GEMINI_API_KEY
  if (!apiKey) return getDefaultSetupSteps()

  try {
    const response = await fetch(
      `https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-flash:generateContent?key=${apiKey}`,
      {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          contents: [{
            parts: [{
              text: `あなたはWebアプリ開発の専門家です。
以下のアプリを作るために必要な「開発環境の構築ステップ」を提案してください。

【アプリ情報】
- タイトル: ${ideaTitle}
- 概要: ${ideaDescription}

【ルール】
- 初心者向けに4〜6ステップで構成すること
- 技術用語は使わず、わかりやすい言葉で書くこと
- そのアプリに特有のAPIやツールがあれば含めること
  例：地図アプリ→Google Maps API、音楽アプリ→Spotify API
- 必ず以下のJSON形式のみで返すこと（前置き・説明不要）

[
  {
    "id": "step-1",
    "title": "ステップのタイトル（15文字以内）",
    "description": "何をするか・なぜ必要かを2文で説明",
    "link": "公式サイトのURL（あれば）",
    "linkLabel": "リンクのラベル（例：公式サイトを開く）",
    "completed": false
  }
]`
            }]
          }]
        }),
      }
    )

    if (!response.ok) return getDefaultSetupSteps()

    const data = await response.json()
    const text = data.candidates?.[0]?.content?.parts?.[0]?.text ?? ''
    const clean = text.replace(/```json|```/g, '').trim()
    const parsed = JSON.parse(clean)
    return parsed

  } catch {
    return getDefaultSetupSteps()
  }
}

function getDefaultSetupSteps(): SetupStep[] {
  return [
    {
      id: 'step-1',
      title: 'Node.jsをインストール',
      description: 'アプリを動かすための土台です。公式サイトからLTS版をダウンロードしてください。',
      link: 'https://nodejs.org',
      linkLabel: '公式サイトを開く',
      completed: false,
    },
    {
      id: 'step-2',
      title: 'VS Codeをインストール',
      description: 'コードを書くためのエディタです。世界中の開発者が使っている定番ツールです。',
      link: 'https://code.visualstudio.com',
      linkLabel: '公式サイトを開く',
      completed: false,
    },
    {
      id: 'step-3',
      title: 'GitHubアカウントを作る',
      description: 'あなたのコードを保存する場所です。無料で使えます。',
      link: 'https://github.com',
      linkLabel: 'GitHubを開く',
      completed: false,
    },
    {
      id: 'step-4',
      title: 'Supabaseアカウントを作る',
      description: 'アプリのデータを保存するデータベースです。無料枠で十分使えます。',
      link: 'https://supabase.com',
      linkLabel: 'Supabaseを開く',
      completed: false,
    },
  ]
}

export async function generateQuestSteps(
  questNumber: 2 | 3 | 4 | 5,
  ideaTitle: string,
  ideaDescription: string
): Promise<SetupStep[]> {
  const apiKey = process.env.GEMINI_API_KEY
  if (!apiKey) return getDefaultQuestSteps(questNumber)

  const questThemes = {
    2: '最初の画面を作る（UI構築）。AIが提案した3つのデザイン案から選ぶだけで画面が完成し、仮公開URLで友達に見せられるようにする。',
    3: 'データを保存できるようにする（データベース連携）。ユーザーの情報やアプリのデータを永続的に保存できるようにする。',
    4: 'ログインできるようにする（認証機能）。ユーザーが自分だけのアカウントでアプリにアクセスできるようにする。',
    5: '世界に公開する（本番デプロイ）。完成したアプリをインターネットに公開して、誰でもアクセスできるようにする。',
  }

  try {
    const response = await fetch(
      `https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-flash:generateContent?key=${apiKey}`,
      {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          contents: [{
            parts: [{
              text: `あなたはWebアプリ開発の専門家です。
以下のアプリを作るための「クエスト${questNumber}」のステップを提案してください。

【アプリ情報】
- タイトル: ${ideaTitle}
- 概要: ${ideaDescription}

【クエスト${questNumber}のテーマ】
${questThemes[questNumber]}

【ルール】
- 初心者向けに3〜5ステップで構成すること
- 技術用語は使わず、わかりやすい言葉で書くこと
- そのアプリに特有の内容を含めること
- 必ず以下のJSON形式のみで返すこと（前置き・説明不要）

[
  {
    "id": "step-1",
    "title": "ステップのタイトル（15文字以内）",
    "description": "何をするか・なぜ必要かを2文で説明",
    "link": "参考URLがあれば。なければnull",
    "linkLabel": "リンクのラベル。なければnull",
    "completed": false
  }
]`
            }]
          }]
        }),
      }
    )

    if (!response.ok) return getDefaultQuestSteps(questNumber)

    const data = await response.json()
    const text = data.candidates?.[0]?.content?.parts?.[0]?.text ?? ''
    const clean = text.replace(/```json|```/g, '').trim()
    const parsed = JSON.parse(clean)
    return parsed

  } catch {
    return getDefaultQuestSteps(questNumber)
  }
}

function getDefaultQuestSteps(questNumber: 2 | 3 | 4 | 5): SetupStep[] {
  const defaults: Record<2 | 3 | 4 | 5, SetupStep[]> = {
    2: [
      {
        id: 'step-1',
        title: 'デザインを決める',
        description: 'アプリの見た目を決めます。色やレイアウトを選んでください。',
        link: 'https://v0.dev',
        linkLabel: 'AIデザイナーを開く',
        completed: false,
      },
      {
        id: 'step-2',
        title: '最初の画面を作る',
        description: 'トップページを作成します。ユーザーが最初に見る画面です。',
        link: null,
        linkLabel: null,
        completed: false,
      },
      {
        id: 'step-3',
        title: '仮公開する',
        description: '友達に見せるためのプレビューURLを発行します。',
        link: 'https://vercel.com',
        linkLabel: 'Vercelを開く',
        completed: false,
      },
    ],
    3: [
      {
        id: 'step-1',
        title: 'データベースを設計する',
        description: '何のデータを保存するか決めます。アプリの心臓部になります。',
        link: 'https://supabase.com',
        linkLabel: 'Supabaseを開く',
        completed: false,
      },
      {
        id: 'step-2',
        title: 'テーブルを作る',
        description: 'データを整理して保存するための箱を作ります。',
        link: null,
        linkLabel: null,
        completed: false,
      },
      {
        id: 'step-3',
        title: 'データを読み書きする',
        description: 'アプリからデータを保存・取得できるようにします。',
        link: null,
        linkLabel: null,
        completed: false,
      },
    ],
    4: [
      {
        id: 'step-1',
        title: '認証を設定する',
        description: 'ユーザーがアカウントを作れるようにします。',
        link: 'https://supabase.com/docs/guides/auth',
        linkLabel: '認証ガイドを見る',
        completed: false,
      },
      {
        id: 'step-2',
        title: 'ログイン画面を作る',
        description: 'メールアドレスとパスワードでログインできる画面を作ります。',
        link: null,
        linkLabel: null,
        completed: false,
      },
      {
        id: 'step-3',
        title: 'ログアウトを実装する',
        description: 'ユーザーが安全にログアウトできるようにします。',
        link: null,
        linkLabel: null,
        completed: false,
      },
    ],
    5: [
      {
        id: 'step-1',
        title: 'コードを保存する',
        description: 'GitHubにコードをアップロードして永久保存します。',
        link: 'https://github.com',
        linkLabel: 'GitHubを開く',
        completed: false,
      },
      {
        id: 'step-2',
        title: '本番環境を設定する',
        description: '世界に公開するための設定をします。',
        link: 'https://vercel.com',
        linkLabel: 'Vercelを開く',
        completed: false,
      },
      {
        id: 'step-3',
        title: '世界に公開する',
        description: 'URLを発行してインターネットに公開します。',
        link: null,
        linkLabel: null,
        completed: false,
      },
    ],
  }
  return defaults[questNumber]
}

export async function updateQuestStepCompletion(
  projectId: string,
  questNumber: 2 | 3 | 4 | 5,
  stepId: string,
  completed: boolean
): Promise<void> {
  const supabase = await createClient()
  const columnName = `quest${questNumber}_steps`

  const { data } = await supabase
    .from('project_ideas')
    .select(columnName)
    .eq('id', projectId)
    .single()

  const steps = ((data as unknown as Record<string, unknown>)?.[columnName] ?? []) as SetupStep[]
  const updated = steps.map((s) =>
    s.id === stepId ? { ...s, completed } : s
  )

  await supabase
    .from('project_ideas')
    .update({ [columnName]: updated })
    .eq('id', projectId)
}

export async function updateStepCompletion(
  projectId: string,
  stepId: string,
  completed: boolean
): Promise<void> {
  const supabase = await createClient()
  const { data } = await supabase
    .from('project_ideas')
    .select('setup_steps')
    .eq('id', projectId)
    .single()

  const steps = (data?.setup_steps ?? []) as SetupStep[]
  const updated = steps.map((s) =>
    s.id === stepId ? { ...s, completed } : s
  )

  await supabase
    .from('project_ideas')
    .update({ setup_steps: updated })
    .eq('id', projectId)
}
