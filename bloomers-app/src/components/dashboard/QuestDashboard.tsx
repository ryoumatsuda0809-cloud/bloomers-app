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
import {
  User, Folder, MessageCircle, LogOut, PartyPopper,
  CheckCircle2, Circle, Lock, Sparkles,
} from 'lucide-react'
import MentorPanel from '@/components/quest/MentorPanel'

type QuestDashboardProps = {
  activeProjectId: string
  mentorOpen?: boolean
}

export default function QuestDashboard({ activeProjectId, mentorOpen }: QuestDashboardProps) {
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
    resetStore()
    const supabase = createClient()
    await supabase.auth.signOut()
    router.push('/login')
  }

  const completedCount = quests.filter((q) => q.status === 'completed').length
  const progressPct = quests.length > 0 ? Math.round((completedCount / quests.length) * 100) : 0
  const allCompleted = quests.length > 0 && completedCount === quests.length

  const handleComplete = async (id: string) => {
    const snapshot = useQuestStore.getState().quests
    completeQuest(id)
    const { error } = await updateQuestStatus(id, 'completed', activeProjectId)
    if (error) setQuests(snapshot)
    router.refresh()
  }

  const QuestStatusIcon = ({ status }: { status: string }) => {
    if (status === 'completed') return <CheckCircle2 className="size-3.5 text-primary shrink-0" />
    if (status === 'active') return <Sparkles className="size-3.5 text-primary shrink-0" />
    if (status === 'unlocked') return <Circle className="size-3.5 text-primary/50 shrink-0" />
    return <Lock className="size-3.5 text-muted-foreground/50 shrink-0" />
  }

  return (
    <div className="min-h-screen bg-background flex">

      {/* サイドバー（lg以上で表示） */}
      <aside className="hidden lg:flex flex-col w-64 xl:w-72 shrink-0 border-r border-border bg-sidebar min-h-screen sticky top-0 h-screen">
        <div className="px-6 py-6 border-b border-border">
          <div className="flex items-center gap-2.5">
            <span className="text-2xl">🌸</span>
            <span className="font-heading text-xl font-bold text-foreground tracking-tight">Bloomers</span>
          </div>
          <p className="text-xs text-muted-foreground mt-1.5 leading-relaxed">クエスト形式でSaaS開発を習得</p>
        </div>

        <div className="px-6 py-5 border-b border-border">
          <div className="flex justify-between items-center mb-2">
            <span className="text-xs font-medium text-muted-foreground">全体の進捗</span>
            <span className="text-xs font-bold text-primary">{progressPct}%</span>
          </div>
          <Progress value={progressPct} className="h-1.5 mb-2" />
          <p className="text-xs text-muted-foreground">
            <span className="font-semibold text-foreground">{completedCount}</span> / {quests.length} クエスト完了
          </p>
        </div>

        <nav className="flex-1 px-4 py-4 overflow-y-auto">
          <p className="text-xs font-medium text-muted-foreground px-2 mb-3 uppercase tracking-wider">ロードマップ</p>
          <div className="space-y-1">
            {quests.map((quest, index) => (
              <div key={quest.id}>
                <div className={`flex items-center gap-2.5 px-2 py-2.5 rounded-lg transition-colors ${
                  quest.status === 'active' ? 'bg-accent/40 text-foreground' :
                  quest.status === 'completed' ? 'text-foreground/70 hover:bg-muted' : 'text-muted-foreground/60'
                }`}>
                  <QuestStatusIcon status={quest.status} />
                  <span className={`text-xs leading-snug flex-1 min-w-0 ${quest.status === 'active' ? 'font-semibold' : 'font-normal'}`}>
                    {quest.title}
                  </span>
                  {quest.status === 'active' && <span className="w-1.5 h-1.5 rounded-full bg-primary animate-pulse shrink-0" />}
                </div>
                {index < quests.length - 1 && <div className="ml-4 pl-3 border-l border-border/50 h-2" />}
              </div>
            ))}
          </div>
        </nav>

        <div className="px-4 py-4 border-t border-border space-y-1">
          <a href="/chat" className="flex items-center gap-2.5 px-2 py-2.5 rounded-lg text-muted-foreground hover:text-foreground hover:bg-muted transition-colors text-xs">
            <MessageCircle className="size-4 shrink-0" /> メンターと話す
          </a>
          <a href="/projects" className="flex items-center gap-2.5 px-2 py-2.5 rounded-lg text-muted-foreground hover:text-foreground hover:bg-muted transition-colors text-xs">
            <Folder className="size-4 shrink-0" /> マイプロジェクト
          </a>
          <a href="/profile" className="flex items-center gap-2.5 px-2 py-2.5 rounded-lg text-muted-foreground hover:text-foreground hover:bg-muted transition-colors text-xs">
            <User className="size-4 shrink-0" /> プロフィール
          </a>
          <button onClick={handleSignOut} className="flex items-center gap-2.5 px-2 py-2.5 rounded-lg text-destructive/70 hover:text-destructive hover:bg-destructive/10 transition-colors text-xs w-full text-left">
            <LogOut className="size-4 shrink-0" /> ログアウト
          </button>
        </div>
      </aside>

      {/* メインコンテンツ */}
      <div className="flex-1 min-w-0 overflow-x-hidden">

        {/* モバイルヘッダー */}
        <header className="lg:hidden bg-card border-b border-border px-4 py-3 sticky top-0 z-10">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <span className="text-xl">🌸</span>
              <span className="font-heading text-lg font-bold text-foreground">Bloomers</span>
            </div>
            <div className="relative">
              <button onClick={() => setMenuOpen(!menuOpen)} className="p-2 rounded-lg hover:bg-muted transition" aria-label="メニューを開く" aria-expanded={menuOpen}>
                <div className="w-4 h-0.5 bg-foreground/60 mb-1" />
                <div className="w-4 h-0.5 bg-foreground/60 mb-1" />
                <div className="w-4 h-0.5 bg-foreground/60" />
              </button>
              {menuOpen && <div className="fixed inset-0 z-40" onClick={() => setMenuOpen(false)} aria-hidden="true" />}
              {menuOpen && (
                <div className="absolute right-0 top-10 w-48 bg-card rounded-2xl shadow-lg border border-border py-2 z-50">
                  <a href="/profile" className="flex items-center gap-2 px-4 py-2.5 text-sm text-foreground hover:bg-muted transition" onClick={() => setMenuOpen(false)}><User className="size-4" /> プロフィール</a>
                  <a href="/projects" className="flex items-center gap-2 px-4 py-2.5 text-sm text-foreground hover:bg-muted transition" onClick={() => setMenuOpen(false)}><Folder className="size-4" /> マイプロジェクト</a>
                  <a href="/chat" className="flex items-center gap-2 px-4 py-2.5 text-sm text-foreground hover:bg-muted transition" onClick={() => setMenuOpen(false)}><MessageCircle className="size-4" /> メンターと話す</a>
                  <div className="border-t border-border mt-1 pt-1">
                    <button onClick={() => { setMenuOpen(false); handleSignOut() }} className="flex items-center gap-2 px-4 py-2.5 text-sm text-destructive hover:bg-destructive/10 transition w-full text-left"><LogOut className="size-4" /> ログアウト</button>
                  </div>
                </div>
              )}
            </div>
          </div>
        </header>

        <main className="px-6 py-8 lg:px-10 xl:px-16 max-w-4xl">
          <div className="mb-8">
            <h1 className="font-heading text-2xl lg:text-3xl font-bold text-foreground mb-1">クエストダッシュボード</h1>
            <p className="text-muted-foreground text-sm">ステップをひとつずつクリアして、あなたのプロダクトを育てよう。</p>
          </div>

          <div className="lg:hidden bg-card rounded-xl p-4 shadow-sm ring-1 ring-border mb-8 flex items-center gap-4">
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

          <div className="flex flex-col items-stretch">
            {quests.map((quest, index) => (
              <div key={quest.id}>
                <QuestCard
                  id={quest.id}
                  title={quest.title}
                  description={quest.description}
                  status={quest.status}
                  onComplete={handleComplete}
                  onGitHubSave={handleGitHubSave}
                  gitHubSaveStatus={gitHubSaveStatus}
                  gitHubRepoUrl={gitHubRepoUrl}
                  href={quest.status === 'active' ? `/quest/${quest.id}` : undefined}
                />
                {index < quests.length - 1 && <QuestConnector fromStatus={quest.status} />}
              </div>
            ))}
          </div>

          {allCompleted && (
            <Card className="mt-10 bg-accent/20 border-accent/50 rounded-xl shadow-md">
              <CardContent className="p-10 text-center">
                <PartyPopper className="size-10 text-primary mx-auto mb-4" />
                <h2 className="text-2xl font-bold text-foreground mb-2">全クエスト完了！</h2>
                <p className="text-muted-foreground text-sm">おめでとうございます。Bloomers のロードマップを完走しました！</p>
              </CardContent>
            </Card>
          )}
        </main>
      </div>

      {/* 右カラム：アイデアメンター（ダッシュボード専用） */}
      {activeProjectId && (
        <MentorPanel
          questId="dashboard"
          questTitle="アイデアを育てよう"
          projectId={activeProjectId}
          mode="idea"
          initialOpen={mentorOpen}
        />
      )}
    </div>
  )
}
