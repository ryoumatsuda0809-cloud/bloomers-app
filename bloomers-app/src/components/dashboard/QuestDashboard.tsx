'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { useQuestStore } from '@/store/useQuestStore'
import QuestCard from '@/components/dashboard/QuestCard'
import QuestConnector from '@/components/dashboard/QuestConnector'
import { Card, CardContent } from '@/components/ui/card'
import { Progress } from '@/components/ui/progress'
import { updateQuestStatus } from '@/app/actions/quest'
import { createRepository } from '@/app/actions/github'
import { createClient } from '@/lib/supabase/client'

type QuestDashboardProps = {
  activeProjectId: string
}

export default function QuestDashboard({ activeProjectId }: QuestDashboardProps) {
  const router = useRouter()
  const quests = useQuestStore((state) => state.quests)
  const activeQuest = useQuestStore((state) =>
    state.quests.find((q) => q.status === 'active') ?? null
  )
  const completeQuest = useQuestStore((state) => state.completeQuest)
  const setQuests = useQuestStore((state) => state.setQuests)

  const resetStore = useQuestStore((state) => state.resetStore)

  const [menuOpen, setMenuOpen] = useState(false)
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

    const { error } = await updateQuestStatus(id, 'completed', activeProjectId)
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
              <div className="relative">
                <button
                  onClick={() => setMenuOpen(!menuOpen)}
                  className="p-2 rounded-xl hover:bg-zinc-100 transition"
                  aria-label="メニュー"
                >
                  <div className="w-5 h-0.5 bg-zinc-600 mb-1" />
                  <div className="w-5 h-0.5 bg-zinc-600 mb-1" />
                  <div className="w-5 h-0.5 bg-zinc-600" />
                </button>

                {menuOpen && (
                  <div className="absolute left-0 top-10 w-48 bg-white rounded-2xl shadow-lg border border-zinc-100 py-2 z-50">
                    <a
                      href="/profile"
                      className="flex items-center gap-2 px-4 py-2.5 text-sm text-zinc-700 hover:bg-zinc-50 transition"
                      onClick={() => setMenuOpen(false)}
                    >
                      👤 プロフィール
                    </a>
                    <a
                      href="/projects"
                      className="flex items-center gap-2 px-4 py-2.5 text-sm text-zinc-700 hover:bg-zinc-50 transition"
                      onClick={() => setMenuOpen(false)}
                    >
                      📁 マイプロジェクト
                    </a>
                    <a
                      href="/chat"
                      className="flex items-center gap-2 px-4 py-2.5 text-sm text-zinc-700 hover:bg-zinc-50 transition"
                      onClick={() => setMenuOpen(false)}
                    >
                      💬 メンターと話す
                    </a>
                    <div className="border-t border-zinc-100 mt-1 pt-1">
                      <button
                        onClick={() => { setMenuOpen(false); handleSignOut() }}
                        className="flex items-center gap-2 px-4 py-2.5 text-sm text-red-500 hover:bg-red-50 transition w-full text-left"
                      >
                        🚪 ログアウト
                      </button>
                    </div>
                  </div>
                )}
              </div>
              <span className="text-3xl">🌸</span>
              <h1 className="text-3xl font-bold tracking-tight text-zinc-800">
                Bloomers
              </h1>
            </div>
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
