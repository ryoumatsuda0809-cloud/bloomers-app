'use client'

import { useState, useEffect } from 'react'
import { ArrowLeft } from 'lucide-react'
import { Skeleton } from '@/components/ui/skeleton'
import AppShell from '@/components/layout/AppShell'

const MBTI_TYPES = [
  'INTJ', 'INTP', 'ENTJ', 'ENTP',
  'INFJ', 'INFP', 'ENFJ', 'ENFP',
  'ISTJ', 'ISFJ', 'ESTJ', 'ESFJ',
  'ISTP', 'ISFP', 'ESTP', 'ESFP',
]
import { useRouter } from 'next/navigation'
import { Button } from '@/components/ui/button'
import {
  getSelectedIdea,
  resetOnboarding,
} from '@/app/actions/onboarding'
import { createClient } from '@/lib/supabase/client'
import type { PersonalityData, IdeaCard } from '@/app/actions/onboarding'
import {
  getProjectIdeas,
  setActiveProject,
  deleteProjectIdea,
} from '@/app/actions/projects'
import type { ProjectIdea } from '@/app/actions/projects'

export default function ProfilePage() {
  const router = useRouter()
  const [personality, setPersonality] = useState<PersonalityData | null>(null)
  const [selectedIdea, setSelectedIdea] = useState<IdeaCard | null>(null)
  const [isLoading, setIsLoading] = useState(true)
  const [projects, setProjects] = useState<ProjectIdea[]>([])
  const [isSaving, setIsSaving] = useState(false)
  const [saved, setSaved] = useState(false)

  useEffect(() => {
    const load = async () => {
      const supabase = createClient()
      const { data: { user } } = await supabase.auth.getUser()
      if (!user) { router.push('/login'); return }

      const { data } = await supabase
        .from('profiles')
        .select('personality_data, selected_idea')
        .eq('id', user.id)
        .single()

      if (data?.personality_data) setPersonality(data.personality_data)
      if (data?.selected_idea) setSelectedIdea(data.selected_idea)
      const ideas = await getProjectIdeas()
      setProjects(ideas)
      setIsLoading(false)
    }
    load()
  }, [router])

  const handleSave = async () => {
    if (!personality) return
    setIsSaving(true)
    const supabase = createClient()
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) return

    await supabase
      .from('profiles')
      .update({ personality_data: personality })
      .eq('id', user.id)

    setSaved(true)
    setIsSaving(false)
    setTimeout(() => setSaved(false), 2000)
  }

  const handleSetActive = async (projectId: string) => {
    await setActiveProject(projectId)
    setProjects(projects.map((p) => ({
      ...p,
      isActive: p.id === projectId,
    })))
    router.refresh()
  }

  const handleDelete = async (projectId: string) => {
    if (!confirm('このプロジェクト案を削除しますか？')) return
    await deleteProjectIdea(projectId)
    setProjects(projects.filter((p) => p.id !== projectId))
  }

  const handleReset = async () => {
    if (!confirm('もう一度最初から答えますか？現在のプロジェクトはリセットされます。')) return
    await resetOnboarding()
    router.push('/onboarding')
  }

  if (isLoading) {
    return (
      <AppShell showRoadmap={false}>
        <div className="px-4 py-8">
          <div className="max-w-lg mx-auto space-y-6">
            <Skeleton className="h-4 w-32" />
            <Skeleton className="h-8 w-48" />
            <div className="space-y-3">
              <Skeleton className="h-24 w-full rounded-2xl" />
              <Skeleton className="h-48 w-full rounded-2xl" />
              <Skeleton className="h-64 w-full rounded-2xl" />
            </div>
          </div>
        </div>
      </AppShell>
    )
  }

  return (
    <AppShell showRoadmap={false}>
      <div className="px-4 py-8">
      <div className="max-w-lg mx-auto space-y-6">

        <div className="flex items-center gap-3">
          <button
            onClick={() => router.push('/')}
            className="inline-flex items-center gap-1 text-muted-foreground hover:text-foreground transition"
          >
            <ArrowLeft className="size-4" /> ダッシュボードに戻る
          </button>
        </div>

        <h1 className="font-heading text-2xl font-bold text-foreground">プロフィール</h1>

        {/* 現在のプロジェクト */}
        {selectedIdea && (
          <div className="bg-card rounded-2xl border border-border p-5 space-y-2">
            <p className="text-xs text-muted-foreground font-medium">現在のプロジェクト</p>
            <p className="text-lg font-bold text-foreground">{selectedIdea.title}</p>
            <p className="text-sm text-muted-foreground">{selectedIdea.description}</p>
          </div>
        )}

        {/* 保存済みプロジェクト案 */}
        {projects.length > 0 && (
          <div className="bg-card rounded-2xl border border-border p-5 space-y-3">
            <p className="text-sm font-semibold text-foreground">
              保存済みのプロジェクト案
            </p>
            <div className="space-y-2">
              {projects.map((project) => (
                <div
                  key={project.id}
                  className={`rounded-xl border p-4 space-y-2 transition ${
                    project.isActive
                      ? 'border-primary bg-accent/40'
                      : 'border-border bg-muted'
                  }`}
                >
                  <div className="flex items-start justify-between gap-2">
                    <div>
                      <p className="text-sm font-semibold text-foreground">
                        {project.title}
                      </p>
                      <p className="text-xs text-muted-foreground mt-0.5">
                        {project.description}
                      </p>
                    </div>
                    {project.isActive && (
                      <span className="text-xs bg-primary text-primary-foreground px-2 py-0.5 rounded-full shrink-0">
                        アクティブ
                      </span>
                    )}
                  </div>
                  <div className="flex gap-2">
                    {!project.isActive && (
                      <button
                        onClick={() => handleSetActive(project.id)}
                        className="text-xs text-primary hover:underline"
                      >
                        これをアクティブにする
                      </button>
                    )}
                    <button
                      onClick={() => handleDelete(project.id)}
                      className="text-xs text-destructive hover:underline ml-auto"
                    >
                      削除
                    </button>
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* 回答の編集 */}
        {personality && (
          <div className="bg-card rounded-2xl border border-border p-5 space-y-4">
            <p className="text-sm font-semibold text-foreground">あなたの回答</p>

            <div className="space-y-1">
              <label htmlFor="profile-time-usage" className="text-xs text-muted-foreground">一番時間を使っていること</label>
              <input
                id="profile-time-usage"
                value={personality.timeUsage}
                onChange={(e) => setPersonality({ ...personality, timeUsage: e.target.value })}
                className="w-full border border-border rounded-xl px-3 py-2 text-sm text-foreground focus:outline-none focus:border-primary"
              />
            </div>

            <div className="space-y-1">
              <label className="text-xs text-muted-foreground">MBTI</label>
              <div className="grid grid-cols-4 gap-2">
                {MBTI_TYPES.map((type) => (
                  <button
                    key={type}
                    type="button"
                    onClick={() => setPersonality({ ...personality, mbti: type })}
                    className={`h-10 rounded-xl text-xs font-medium transition border ${
                      personality.mbti === type
                        ? 'bg-primary border-primary text-primary-foreground'
                        : 'bg-muted border-border text-muted-foreground hover:bg-muted'
                    }`}
                  >
                    {type}
                  </button>
                ))}
              </div>
              {personality.mbti && (
                <p className="text-xs text-primary mt-1">
                  選択中: {personality.mbti}
                </p>
              )}
            </div>

            <div className="space-y-1">
              <label htmlFor="profile-local-pain" className="text-xs text-muted-foreground">地元・日常の不便</label>
              <textarea
                id="profile-local-pain"
                value={personality.localPain}
                onChange={(e) => setPersonality({ ...personality, localPain: e.target.value })}
                className="w-full border border-border rounded-xl px-3 py-2 text-sm text-foreground focus:outline-none focus:border-primary resize-none h-20"
              />
            </div>

            <Button
              onClick={handleSave}
              disabled={isSaving}
              className={`w-full rounded-xl transition-colors ${
                saved
                  ? 'bg-accent text-accent-foreground hover:bg-accent/90'
                  : 'bg-primary text-primary-foreground hover:bg-primary/90'
              }`}
            >
              {saved ? '保存しました' : isSaving ? '保存中...' : '変更を保存する'}
            </Button>
          </div>
        )}

        {/* アイデアを探し直す */}
        <div className="bg-card rounded-2xl border border-border p-5 space-y-3">
          <p className="text-sm font-semibold text-foreground">
            別のアイデアを探す
          </p>
          <p className="text-xs text-muted-foreground">
            メンターと話しながら、新しいアイデアを見つけられます。
          </p>
          <button
            onClick={() => router.push('/chat?mode=discover')}
            className="w-full h-10 bg-card border border-border text-foreground text-sm font-semibold rounded-xl hover:bg-muted transition"
          >
            メンターとアイデアを探す
          </button>
        </div>

        {/* 再質問 */}
        <div className="bg-card rounded-2xl border border-border p-5 space-y-3">
          <p className="text-sm font-semibold text-foreground">最初からやり直す</p>
          <p className="text-xs text-muted-foreground">
            質問に答え直して、新しいプロジェクトを選択できます。
          </p>
          <Button
            onClick={handleReset}
            variant="outline"
            className="w-full border-destructive/30 text-destructive hover:bg-destructive/10 rounded-xl"
          >
            もう一度最初から答える
          </Button>
        </div>

      </div>
      </div>
    </AppShell>
  )
}
