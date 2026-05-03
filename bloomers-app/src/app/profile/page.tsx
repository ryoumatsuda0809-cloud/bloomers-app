'use client'

import { useState, useEffect } from 'react'

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
      <div className="min-h-screen flex items-center justify-center">
        <div className="w-8 h-8 rounded-full border-4 border-purple-500 border-t-transparent animate-spin" />
      </div>
    )
  }

  return (
    <div className="min-h-screen bg-zinc-50 px-4 py-8">
      <div className="max-w-lg mx-auto space-y-6">

        <div className="flex items-center gap-3">
          <button
            onClick={() => router.push('/')}
            className="text-zinc-400 hover:text-zinc-600 transition"
          >
            ← ダッシュボードに戻る
          </button>
        </div>

        <h1 className="text-2xl font-bold text-zinc-800">プロフィール</h1>

        {/* 現在のプロジェクト */}
        {selectedIdea && (
          <div className="bg-white rounded-2xl border border-zinc-200 p-5 space-y-2">
            <p className="text-xs text-zinc-400 font-medium">現在のプロジェクト</p>
            <p className="text-lg font-bold text-zinc-800">{selectedIdea.title}</p>
            <p className="text-sm text-zinc-500">{selectedIdea.description}</p>
          </div>
        )}

        {/* 保存済みプロジェクト案 */}
        {projects.length > 0 && (
          <div className="bg-white rounded-2xl border border-zinc-200 p-5 space-y-3">
            <p className="text-sm font-semibold text-zinc-700">
              保存済みのプロジェクト案
            </p>
            <div className="space-y-2">
              {projects.map((project) => (
                <div
                  key={project.id}
                  className={`rounded-xl border p-4 space-y-2 transition ${
                    project.isActive
                      ? 'border-indigo-300 bg-indigo-50'
                      : 'border-zinc-200 bg-zinc-50'
                  }`}
                >
                  <div className="flex items-start justify-between gap-2">
                    <div>
                      <p className="text-sm font-semibold text-zinc-800">
                        {project.title}
                      </p>
                      <p className="text-xs text-zinc-500 mt-0.5">
                        {project.description}
                      </p>
                    </div>
                    {project.isActive && (
                      <span className="text-xs bg-indigo-600 text-white px-2 py-0.5 rounded-full shrink-0">
                        アクティブ
                      </span>
                    )}
                  </div>
                  <div className="flex gap-2">
                    {!project.isActive && (
                      <button
                        onClick={() => handleSetActive(project.id)}
                        className="text-xs text-indigo-600 hover:underline"
                      >
                        これをアクティブにする
                      </button>
                    )}
                    <button
                      onClick={() => handleDelete(project.id)}
                      className="text-xs text-red-400 hover:underline ml-auto"
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
          <div className="bg-white rounded-2xl border border-zinc-200 p-5 space-y-4">
            <p className="text-sm font-semibold text-zinc-700">あなたの回答</p>

            <div className="space-y-1">
              <label className="text-xs text-zinc-400">一番時間を使っていること</label>
              <input
                value={personality.timeUsage}
                onChange={(e) => setPersonality({ ...personality, timeUsage: e.target.value })}
                className="w-full border border-zinc-200 rounded-xl px-3 py-2 text-sm text-zinc-700 focus:outline-none focus:border-purple-400"
              />
            </div>

            <div className="space-y-1">
              <label className="text-xs text-zinc-400">MBTI</label>
              <div className="grid grid-cols-4 gap-2">
                {MBTI_TYPES.map((type) => (
                  <button
                    key={type}
                    onClick={() => setPersonality({ ...personality, mbti: type })}
                    className={`h-9 rounded-xl text-xs font-medium transition border ${
                      personality.mbti === type
                        ? 'bg-indigo-600 border-indigo-500 text-white'
                        : 'bg-zinc-50 border-zinc-200 text-zinc-600 hover:bg-zinc-100'
                    }`}
                  >
                    {type}
                  </button>
                ))}
              </div>
              {personality.mbti && (
                <p className="text-xs text-indigo-500 mt-1">
                  選択中: {personality.mbti}
                </p>
              )}
            </div>

            <div className="space-y-1">
              <label className="text-xs text-zinc-400">地元・日常の不便</label>
              <textarea
                value={personality.localPain}
                onChange={(e) => setPersonality({ ...personality, localPain: e.target.value })}
                className="w-full border border-zinc-200 rounded-xl px-3 py-2 text-sm text-zinc-700 focus:outline-none focus:border-purple-400 resize-none h-20"
              />
            </div>

            <Button
              onClick={handleSave}
              disabled={isSaving}
              className="w-full bg-indigo-600 hover:bg-indigo-700 text-white rounded-xl"
            >
              {saved ? '✅ 保存しました' : isSaving ? '保存中...' : '変更を保存する'}
            </Button>
          </div>
        )}

        {/* 再質問 */}
        <div className="bg-white rounded-2xl border border-zinc-200 p-5 space-y-3">
          <p className="text-sm font-semibold text-zinc-700">最初からやり直す</p>
          <p className="text-xs text-zinc-400">
            質問に答え直して、新しいプロジェクトを選択できます。
          </p>
          <Button
            onClick={handleReset}
            variant="outline"
            className="w-full border-red-200 text-red-500 hover:bg-red-50 rounded-xl"
          >
            もう一度最初から答える
          </Button>
        </div>

      </div>
    </div>
  )
}
