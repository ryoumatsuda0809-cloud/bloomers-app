'use client'

import { useState, useEffect } from 'react'
import { ArrowLeft, ArrowRight, Sprout, Pin, PinOff } from 'lucide-react'
import { useRouter } from 'next/navigation'
import { getProjectIdeas, setActiveProject, deleteProjectIdea, pinProjectIdea, pauseProject } from '@/app/actions/projects'
import type { ProjectIdea } from '@/app/actions/projects'
import { Skeleton } from '@/components/ui/skeleton'
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from '@/components/ui/alert-dialog'

export default function ProjectsPage() {
  const router = useRouter()
  const [projects, setProjects] = useState<ProjectIdea[]>([])
  const [isLoading, setIsLoading] = useState(true)
  const [showNewIdeaDialog, setShowNewIdeaDialog] = useState(false)

  const activeProject = projects.find((p) => p.isActive)

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
      <div className="min-h-screen bg-background px-4 py-8">
        <div className="max-w-lg mx-auto space-y-6">
          <Skeleton className="h-4 w-32" />
          <Skeleton className="h-8 w-48" />
          <div className="space-y-3">
            <Skeleton className="h-28 w-full rounded-2xl" />
            <Skeleton className="h-28 w-full rounded-2xl" />
            <Skeleton className="h-28 w-full rounded-2xl" />
          </div>
        </div>
      </div>
    )
  }

  return (
    <div className="min-h-screen bg-background px-4 py-8">
      <div className="max-w-lg mx-auto space-y-6">

        <div className="flex items-center gap-3">
          <button
            onClick={() => router.push('/')}
            className="inline-flex items-center gap-1 text-muted-foreground hover:text-foreground transition text-sm"
          >
            <ArrowLeft className="size-4" /> ダッシュボードに戻る
          </button>
        </div>

        <div className="flex items-center justify-between">
          <h1 className="font-heading text-2xl font-bold text-foreground">マイプロジェクト</h1>
          <button
            onClick={() => {
              if (activeProject) {
                setShowNewIdeaDialog(true)
              } else {
                router.push('/onboarding')
              }
            }}
            className="text-xs bg-primary text-primary-foreground px-3 py-1.5 rounded-full hover:bg-primary/90 transition"
          >
            ＋ 新しいアイデア
          </button>
        </div>

        {projects.length === 0 ? (
          <div className="bg-card rounded-2xl border border-border p-8 text-center space-y-3">
            <p className="text-3xl"><Sprout className="size-10 text-muted-foreground" /></p>
            <p className="text-foreground font-medium">まだプロジェクトがありません</p>
            <p className="text-muted-foreground text-sm">
              メンターと話してアイデアを見つけよう
            </p>
            <button
              onClick={() => router.push('/onboarding')}
              className="mt-2 text-sm text-primary hover:underline inline-flex items-center gap-1"
            >
              アイデアを見つける <ArrowRight className="size-4" />
            </button>
          </div>
        ) : (
          <div className="space-y-3">
            {projects.map((project) => (
              <div
                key={project.id}
                className={`bg-card rounded-2xl border transition ${
                  project.isActive
                    ? 'border-primary shadow-sm'
                    : 'border-border'
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
                  onKeyDown={(e) => {
                    if (e.key === 'Enter' || e.key === ' ') {
                      e.preventDefault()
                      if (project.isActive) {
                        router.push('/')
                      } else {
                        handleSetActive(project.id)
                      }
                    }
                  }}
                  role="button"
                  tabIndex={0}
                  className="p-5 space-y-2 cursor-pointer hover:bg-muted rounded-t-2xl transition focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary"
                >
                  <div className="flex items-start justify-between gap-2">
                    <div className="flex-1">
                      <div className="flex items-center gap-2 flex-wrap">
                        <p className="text-base font-bold text-foreground">
                          {project.title}
                        </p>
                        {project.isActive && (
                          <span className="text-xs bg-primary text-primary-foreground px-2 py-0.5 rounded-full">
                            アクティブ
                          </span>
                        )}
                        {project.isPinned && (
                          <span className="text-xs bg-yellow-100 text-yellow-600 px-2 py-0.5 rounded-full">
                            ピン済み
                          </span>
                        )}
                        {project.status === 'paused' && (
                          <span className="text-xs bg-muted text-muted-foreground px-2 py-0.5 rounded-full">
                            途中
                          </span>
                        )}
                        {project.status === 'completed' && (
                          <span className="text-xs bg-accent/40 text-accent-foreground px-2 py-0.5 rounded-full">
                            完了
                          </span>
                        )}
                      </div>
                      <p className="text-sm text-muted-foreground mt-0.5">
                        {project.description}
                      </p>
                      <p className="text-xs text-muted-foreground mt-1">
                        {new Date(project.createdAt).toLocaleDateString('ja-JP')}
                      </p>
                    </div>
                    <button
                      onClick={(e) => {
                        e.stopPropagation()
                        handlePin(project.id, project.isPinned)
                      }}
                      aria-label={project.isPinned ? 'ピンを外す' : 'ピンする'}
                      className={`text-lg shrink-0 transition p-2 -mr-2 ${
                        project.isPinned ? 'opacity-100' : 'opacity-30 hover:opacity-60'
                      }`}
                    >
                      {project.isPinned
                        ? <Pin className="size-4 text-primary" />
                        : <PinOff className="size-4 text-muted-foreground" />
                      }
                    </button>
                  </div>
                  <p className={`text-xs font-medium mt-1 flex items-center gap-1 ${
                    project.isActive ? 'text-primary' : 'text-muted-foreground'
                  }`}>
                    {project.isActive
                      ? <>タップしてダッシュボードへ <ArrowRight className="size-3" /></>
                      : 'タップしてアクティブにする'}
                  </p>
                </div>

                {/* アクションエリア */}
                <div className="px-5 pb-4 flex gap-3 border-t border-border pt-3">
                  {!project.isActive && (
                    <button
                      onClick={() => handleSetActive(project.id)}
                      className="text-xs text-primary font-medium hover:underline"
                    >
                      これをアクティブにする
                    </button>
                  )}
                  <button
                    onClick={() => handleDelete(project.id)}
                    className="text-xs text-destructive border border-destructive/30 px-2.5 py-1 rounded-lg hover:bg-destructive/10 transition ml-auto"
                  >
                    削除
                  </button>
                </div>
              </div>
            ))}
          </div>
        )}

      </div>

      <AlertDialog open={showNewIdeaDialog} onOpenChange={setShowNewIdeaDialog}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>
              現在進行中のプロジェクトはどうしますか？
            </AlertDialogTitle>
            <AlertDialogDescription>
              「{activeProject?.title}」が進行中です。
              新しいアイデアを始める前に、現在の進捗を保存するか選んでください。
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter className="flex-col sm:flex-col gap-2">
            <AlertDialogAction
              onClick={async () => {
                if (activeProject) {
                  await pauseProject(activeProject.id)
                }
                router.refresh()
                router.push('/onboarding')
              }}
              className="w-full bg-primary text-primary-foreground hover:bg-primary/90"
            >
              途中として保存して新しく始める
            </AlertDialogAction>
            <AlertDialogAction
              onClick={async () => {
                if (activeProject) {
                  await deleteProjectIdea(activeProject.id)
                }
                router.refresh()
                router.push('/onboarding')
              }}
              className="w-full bg-destructive/10 text-destructive hover:bg-destructive/20"
            >
              削除して新しく始める
            </AlertDialogAction>
            <AlertDialogCancel className="w-full">
              キャンセル
            </AlertDialogCancel>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  )
}
