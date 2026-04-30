'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { useQuestStore } from '@/store/useQuestStore'
import QuestCard from '@/components/dashboard/QuestCard'
import QuestConnector from '@/components/dashboard/QuestConnector'
import { Card, CardContent } from '@/components/ui/card'
import { Progress } from '@/components/ui/progress'
import { Button } from '@/components/ui/button'
import { updateQuestStatus } from '@/app/actions/quest'
import { createRepository } from '@/app/actions/github'
import { createClient } from '@/lib/supabase/client'

const PROMPT_PREVIEWS: Record<string, string> = {
  q1: 'npx create-next-app@latest && supabase init',
  q2: 'npx shadcn@latest add card button badge',
  q3: 'supabase db push && supabase gen types typescript',
  q4: 'supabase auth providers --enable email google',
  q5: 'vercel --prod && echo "🚀 Launched!"',
}

export default function QuestDashboard() {
  const router = useRouter()
  const quests = useQuestStore((state) => state.quests)
  const activeQuest = useQuestStore((state) =>
    state.quests.find((q) => q.status === 'active') ?? null
  )
  const completeQuest = useQuestStore((state) => state.completeQuest)
  const setQuests = useQuestStore((state) => state.setQuests)

  const resetStore = useQuestStore((state) => state.resetStore)

  const [gitHubSaveStatus, setGitHubSaveStatus] =
    useState<'idle' | 'loading' | 'success' | 'error'>('idle')
  const [gitHubRepoUrl, setGitHubRepoUrl] = useState<string>('')

  const handleGitHubSave = async () => {
    setGitHubSaveStatus('loading')
    const result = await createRepository('Bloomerプロジェクト')
    if (result.success && result.repoUrl) {
      setGitHubSaveStatus('success')
      setGitHubRepoUrl(result.repoUrl)
    } else {
      setGitHubSaveStatus('error')
    }
  }

  const handleSignOut = async () => {
    resetStore()                              // 1. Zustand メモリを先に消す
    const supabase = createClient()
    await supabase.auth.signOut()             // 2. Supabase セッションを破棄
    router.push('/login')                     // 3. ログイン画面へ遷移
  }

  const completedCount = quests.filter((q) => q.status === 'completed').length
  const progressPct =
    quests.length > 0 ? Math.round((completedCount / quests.length) * 100) : 0
  const allCompleted = quests.length > 0 && completedCount === quests.length

  const handleComplete = async (id: string) => {
    const snapshot = useQuestStore.getState().quests
    completeQuest(id) // 楽観的更新（即時UI反映）

    const { error } = await updateQuestStatus(id, 'completed')
    if (error) {
      setQuests(snapshot) // エラー時はロールバック
    }
    // 成功・失敗どちらでも Server Component を再フェッチして Zustand をサーバー状態に同期
    router.refresh()
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-50 via-indigo-50/30 to-purple-50/20">
      <div className="container mx-auto px-4 py-10 max-w-6xl">

        {/* ヘッダー */}
        <div className="mb-10">
          <div className="flex items-center justify-between mb-2">
            <div className="flex items-center gap-3">
              <span className="text-3xl">🌸</span>
              <h1 className="text-3xl font-bold tracking-tight text-zinc-800">
                Bloomers
              </h1>
            </div>
            <Button
              variant="outline"
              size="sm"
              onClick={handleSignOut}
              className="text-xs text-zinc-500 hover:text-red-500 hover:border-red-200"
            >
              ログアウト
            </Button>
          </div>
          <p className="text-zinc-500 text-sm mb-6 ml-1">
            SaaS開発の全スキルをクエスト形式で習得しよう
          </p>

          {/* プログレスバー */}
          <div className="bg-white rounded-xl p-4 shadow-sm ring-1 ring-zinc-100 flex items-center gap-4">
            <div className="flex-1">
              <div className="flex justify-between text-xs text-zinc-500 mb-2">
                <span>全体の進捗</span>
                <span className="font-semibold text-indigo-600">{progressPct}%</span>
              </div>
              <Progress value={progressPct} className="h-2" />
            </div>
            <div className="text-right shrink-0">
              <p className="text-2xl font-bold text-zinc-800">{completedCount}</p>
              <p className="text-xs text-zinc-400">/ {quests.length} 完了</p>
            </div>
          </div>
        </div>

        {/* プログレス・ツリー */}
        <div className="flex flex-col items-center w-full">
          {quests.map((quest, index) => (
            <div key={quest.id} className="w-full max-w-lg">
              <QuestCard
                id={quest.id}
                title={quest.title}
                description={quest.description}
                promptPreview={PROMPT_PREVIEWS[quest.id] ?? 'タスクを実行してください'}
                status={quest.status}
                onComplete={handleComplete}
                onGitHubSave={handleGitHubSave}
                gitHubSaveStatus={gitHubSaveStatus}
                gitHubRepoUrl={gitHubRepoUrl}
              />
              {index < quests.length - 1 && (
                <QuestConnector fromStatus={quest.status} />
              )}
            </div>
          ))}
        </div>

        {/* メンターウィンドウ */}
        {activeQuest && !allCompleted && (
          <Card className="mt-10 border-dashed border-2 border-indigo-200 bg-indigo-50/50 rounded-xl">
            <CardContent className="p-6">
              <div className="flex gap-4">
                <div className="w-10 h-10 rounded-full bg-indigo-100 flex items-center justify-center shrink-0 text-xl shadow-sm">
                  🤖
                </div>
                <div>
                  <h4 className="font-bold text-zinc-800 mb-1 text-sm">
                    Mentor&apos;s Note — 現在のクエスト:{' '}
                    <span className="text-indigo-600">{activeQuest.title}</span>
                  </h4>
                  <p className="text-sm text-zinc-600 leading-relaxed">
                    一つひとつのステップが、<br />
                    あなたのプロダクトの土台になります。<br />
                    焦らず、今のクエストだけに集中してください。
                  </p>
                </div>
              </div>
            </CardContent>
          </Card>
        )}

        {/* 全完了バナー */}
        {allCompleted && (
          <Card className="mt-10 bg-gradient-to-r from-emerald-50 to-teal-50 border-emerald-200 rounded-xl shadow-md">
            <CardContent className="p-10 text-center">
              <p className="text-5xl mb-4">🎉</p>
              <h2 className="text-2xl font-bold text-emerald-800 mb-2">
                全クエスト完了！
              </h2>
              <p className="text-emerald-600 text-sm">
                おめでとうございます。Bloomers のロードマップを完走しました！
              </p>
            </CardContent>
          </Card>
        )}

      </div>
    </div>
  )
}
