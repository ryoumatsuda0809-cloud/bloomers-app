'use client'

import { useState, useEffect } from 'react'
import { useRouter } from 'next/navigation'
import { getProjectIdeas, setActiveProject, deleteProjectIdea, pinProjectIdea } from '@/app/actions/projects'
import type { ProjectIdea } from '@/app/actions/projects'

export default function ProjectsPage() {
  const router = useRouter()
  const [projects, setProjects] = useState<ProjectIdea[]>([])
  const [isLoading, setIsLoading] = useState(true)

  useEffect(() => {
    getProjectIdeas().then((data) => {
      setProjects(data)
      setIsLoading(false)
    })
  }, [])

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

  const handlePin = async (projectId: string, currentPinned: boolean) => {
    await pinProjectIdea(projectId, !currentPinned)
    setProjects(projects.map((p) =>
      p.id === projectId ? { ...p, isPinned: !currentPinned } : p
    ))
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
            className="text-zinc-400 hover:text-zinc-600 transition text-sm"
          >
            ← ダッシュボードに戻る
          </button>
        </div>

        <div className="flex items-center justify-between">
          <h1 className="text-2xl font-bold text-zinc-800">マイプロジェクト</h1>
          <button
            onClick={() => router.push('/chat')}
            className="text-xs bg-indigo-600 text-white px-3 py-1.5 rounded-full hover:bg-indigo-700 transition"
          >
            ＋ 新しいアイデア
          </button>
        </div>

        {projects.length === 0 ? (
          <div className="bg-white rounded-2xl border border-zinc-200 p-8 text-center space-y-3">
            <p className="text-3xl">🌱</p>
            <p className="text-zinc-600 font-medium">まだプロジェクトがありません</p>
            <p className="text-zinc-400 text-sm">
              メンターと話してアイデアを見つけよう
            </p>
            <button
              onClick={() => router.push('/chat')}
              className="mt-2 text-sm text-indigo-600 hover:underline"
            >
              メンターと話す →
            </button>
          </div>
        ) : (
          <div className="space-y-3">
            {projects.map((project) => (
              <div
                key={project.id}
                className={`bg-white rounded-2xl border transition ${
                  project.isActive
                    ? 'border-indigo-300 shadow-sm'
                    : 'border-zinc-200'
                }`}
              >
                {/* タップ可能なメインエリア */}
                <div
                  onClick={() => {
                    if (project.isActive) {
                      router.push('/')
                    } else {
                      handleSetActive(project.id)
                    }
                  }}
                  className="p-5 space-y-2 cursor-pointer hover:bg-zinc-50 rounded-t-2xl transition"
                >
                  <div className="flex items-start justify-between gap-2">
                    <div className="flex-1">
                      <div className="flex items-center gap-2 flex-wrap">
                        <p className="text-base font-bold text-zinc-800">
                          {project.title}
                        </p>
                        {project.isActive && (
                          <span className="text-xs bg-indigo-600 text-white px-2 py-0.5 rounded-full">
                            アクティブ
                          </span>
                        )}
                        {project.isPinned && (
                          <span className="text-xs bg-yellow-100 text-yellow-600 px-2 py-0.5 rounded-full">
                            ピン済み
                          </span>
                        )}
                      </div>
                      <p className="text-sm text-zinc-500 mt-0.5">
                        {project.description}
                      </p>
                      <p className="text-xs text-zinc-400 mt-1">
                        {new Date(project.createdAt).toLocaleDateString('ja-JP')}
                      </p>
                    </div>
                    <button
                      onClick={(e) => {
                        e.stopPropagation()
                        handlePin(project.id, project.isPinned)
                      }}
                      className={`text-lg shrink-0 transition ${
                        project.isPinned ? 'opacity-100' : 'opacity-30 hover:opacity-60'
                      }`}
                    >
                      📌
                    </button>
                  </div>
                  <p className={`text-xs font-medium mt-1 ${
                    project.isActive ? 'text-indigo-500' : 'text-zinc-400'
                  }`}>
                    {project.isActive
                      ? 'タップしてダッシュボードへ →'
                      : 'タップしてアクティブにする'}
                  </p>
                </div>

                {/* アクションエリア */}
                <div className="px-5 pb-4 flex gap-3 border-t border-zinc-100 pt-3">
                  {!project.isActive && (
                    <button
                      onClick={() => handleSetActive(project.id)}
                      className="text-xs text-indigo-600 font-medium hover:underline"
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
        )}

      </div>
    </div>
  )
}
