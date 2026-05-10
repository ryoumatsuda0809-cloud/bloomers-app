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
import { User, Folder, MessageCircle, LogOut, PartyPopper } from 'lucide-react'

type QuestDashboardProps = {
  activeProjectId: string
}

export default function QuestDashboard({ activeProjectId }: QuestDashboardProps) {
  const router = useRouter()
  const quests = useQuestStore((state) => state.quests)
  const completeQuest = useQuestStore((state) => state.completeQuest)
  const setQuests = useQuestStore((state) => state.setQuests)

  const resetStore = useQuestStore((state) => state.resetStore)
  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  const activeQuest = useQuestStore((state) =>
    state.quests.find((q) => q.status === 'active') ?? null
  )

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
    <div className="min-h-screen bg-background">
      <div className="container mx-auto px-4 py-10 max-w-6xl">

        {/* ヘッダー */}
        <div className="mb-10">
          <div className="flex items-center justify-between mb-2">
            <div className="flex items-center gap-3">
              <div className="relative">
                <button
                  onClick={() => setMenuOpen(!menuOpen)}
                  className="p-3 rounded-xl hover:bg-muted transition"
                  aria-label="メニューを開く"
                  aria-expanded={menuOpen}
                >
                  <div className="w-5 h-0.5 bg-foreground/60 mb-1" />
                  <div className="w-5 h-0.5 bg-foreground/60 mb-1" />
                  <div className="w-5 h-0.5 bg-foreground/60" />
                </button>

                {menuOpen && (
                  <div
                    className="fixed inset-0 z-40"
                    onClick={() => setMenuOpen(false)}
                    aria-hidden="true"
                  />
                )}

                {menuOpen && (
                  <div className="absolute left-0 top-10 w-48 bg-card rounded-2xl shadow-lg border border-border py-2 z-50">
                    <a
                      href="/profile"
                      className="flex items-center gap-2 px-4 py-2.5 text-sm text-foreground hover:bg-muted transition"
                      onClick={() => setMenuOpen(false)}
                    >
                      <User className="size-4" /> プロフィール
                    </a>
                    <a
                      href="/projects"
                      className="flex items-center gap-2 px-4 py-2.5 text-sm text-foreground hover:bg-muted transition"
                      onClick={() => setMenuOpen(false)}
                    >
                      <Folder className="size-4" /> マイプロジェクト
                    </a>
                    <a
                      href="/chat"
                      className="flex items-center gap-2 px-4 py-2.5 text-sm text-foreground hover:bg-muted transition"
                      onClick={() => setMenuOpen(false)}
                    >
                      <MessageCircle className="size-4" /> メンターと話す
                    </a>
                    <div className="border-t border-border mt-1 pt-1">
                      <button
                        onClick={() => { setMenuOpen(false); handleSignOut() }}
                        className="flex items-center gap-2 px-4 py-2.5 text-sm text-destructive hover:bg-destructive/10 transition w-full text-left"
                      >
                        <LogOut className="size-4" /> ログアウト
                      </button>
                    </div>
                  </div>
                )}
              </div>
              <span className="text-3xl">🌸</span>
              <h1 className="font-heading text-3xl font-bold tracking-tight text-foreground">
                Bloomers
              </h1>
            </div>
          </div>
          <p className="text-muted-foreground text-sm mb-6 ml-1">
            SaaS開発の全スキルをクエスト形式で習得しよう
          </p>

          {/* プログレスバー */}
          <div className="bg-card rounded-xl p-4 shadow-sm ring-1 ring-border flex items-center gap-4">
            <div className="flex-1">
              <div className="flex justify-between text-xs text-muted-foreground mb-2">
                <span>全体の進捗</span>
                <span className="font-semibold text-primary">{progressPct}%</span>
              </div>
              <Progress value={progressPct} className="h-2" />
            </div>
            <div className="text-right shrink-0">
              <p className="text-2xl font-bold text-foreground">{completedCount}</p>
              <p className="text-xs text-muted-foreground">/ {quests.length} 完了</p>
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

        {/* 全完了バナー */}
        {allCompleted && (
          <Card className="mt-10 bg-accent/30 border-accent rounded-xl shadow-md">
            <CardContent className="p-10 text-center">
              <p className="text-5xl mb-4"><PartyPopper className="size-10 text-primary" /></p>
              <h2 className="text-2xl font-bold text-accent-foreground mb-2">
                全クエスト完了！
              </h2>
              <p className="text-accent-foreground text-sm">
                おめでとうございます。Bloomers のロードマップを完走しました！
              </p>
            </CardContent>
          </Card>
        )}

      </div>
    </div>
  )
}
