'use client'

import { useState, useEffect } from 'react'
import { useRouter } from 'next/navigation'
import { createClient } from '@/lib/supabase/client'
import { updateQuestStepCompletion } from '@/app/actions/setup'
import type { SetupStep } from '@/app/actions/setup'
import { Skeleton } from '@/components/ui/skeleton'
import { ArrowLeft, ArrowRight, ExternalLink, PartyPopper, AlertTriangle } from 'lucide-react'

export default function Quest3Page() {
  const router = useRouter()
  const [steps, setSteps] = useState<SetupStep[]>([])
  const [projectId, setProjectId] = useState<string>('')
  const [isLoading, setIsLoading] = useState(true)
  const [currentStep, setCurrentStep] = useState(0)
  const [hasError, setHasError] = useState(false)

  useEffect(() => {
    const load = async () => {
      const supabase = createClient()
      const { data: { user } } = await supabase.auth.getUser()
      if (!user) { router.push('/login'); return }

      const { data } = await supabase
        .from('project_ideas')
        .select('id, quest3_steps')
        .eq('user_id', user.id)
        .eq('is_active', true)
        .single()

      if (data) {
        setProjectId(data.id)
        setSteps(data.quest3_steps ?? [])
        const firstIncomplete = (data.quest3_steps ?? [])
          .findIndex((s: SetupStep) => !s.completed)
        setCurrentStep(firstIncomplete === -1 ? 0 : firstIncomplete)
      } else {
        setHasError(true)
        setIsLoading(false)
      }
      setIsLoading(false)
    }
    load()
  }, [router])

  const handleComplete = async (stepId: string) => {
    const updated = steps.map((s) =>
      s.id === stepId ? { ...s, completed: true } : s
    )
    setSteps(updated)
    await updateQuestStepCompletion(projectId, 3, stepId, true)

    const nextIndex = updated.findIndex((s) => !s.completed)
    if (nextIndex === -1) {
      // 自動遷移しない。ユーザーが「ダッシュボードに戻る」を押す
    } else {
      setCurrentStep(nextIndex)
    }
  }

  const allCompleted = steps.length > 0 && steps.every((s) => s.completed)
  const completedCount = steps.filter((s) => s.completed).length

  if (hasError) {
    return (
      <div className="min-h-screen flex items-center justify-center px-4">
        <div className="text-center space-y-3">
          <p className="text-2xl"><AlertTriangle className="size-10 text-destructive" /></p>
          <p className="text-foreground font-medium">
            アクティブなプロジェクトが見つかりません
          </p>
          <button
            onClick={() => router.push('/projects')}
            className="text-sm text-primary hover:underline"
          >
            マイプロジェクトに戻る
          </button>
        </div>
      </div>
    )
  }

  if (isLoading) {
    return (
      <div className="min-h-screen bg-background px-4 py-8">
        <div className="max-w-lg mx-auto space-y-6">
          <Skeleton className="h-4 w-32" />
          <Skeleton className="h-8 w-56" />
          <Skeleton className="h-2 w-full rounded-full" />
          <div className="space-y-3">
            <Skeleton className="h-20 w-full rounded-2xl" />
            <Skeleton className="h-20 w-full rounded-2xl" />
            <Skeleton className="h-20 w-full rounded-2xl" />
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
            className="inline-flex items-center gap-1 text-muted-foreground hover:text-foreground transition text-sm py-2"
          >
            <ArrowLeft className="size-4" /> ダッシュボードに戻る
          </button>
        </div>

        <div className="space-y-1">
          <h1 className="font-heading text-2xl font-bold text-foreground">
            データを保存できるようにしよう
          </h1>
          <p className="text-sm text-muted-foreground">
            {completedCount} / {steps.length} ステップ完了
          </p>
        </div>

        <div className="h-2 bg-muted rounded-full overflow-hidden">
          <div
            className="h-full bg-primary transition-all duration-500"
            style={{ width: `${steps.length > 0 ? (completedCount / steps.length) * 100 : 0}%` }}
          />
        </div>

        {allCompleted && (
          <div className="bg-accent/30 border border-accent rounded-2xl p-5 text-center space-y-2">
            <p className="text-2xl"><PartyPopper className="size-10 text-primary" /></p>
            <p className="text-accent-foreground font-bold">クエスト3完了！</p>
            <button
              onClick={() => router.push('/')}
              className="inline-flex items-center gap-1 text-accent-foreground text-sm underline hover:opacity-80 transition"
            >
              ダッシュボードに戻る <ArrowRight className="size-4" />
            </button>
          </div>
        )}

        <div className="space-y-3">
          {steps.map((step, index) => (
            <div
              key={step.id}
              className={`bg-card rounded-2xl border p-5 space-y-3 transition ${
                step.completed
                  ? 'border-accent bg-accent/30'
                  : index === currentStep
                  ? 'border-primary shadow-sm'
                  : 'border-border opacity-50'
              }`}
            >
              <div className="flex items-start gap-3">
                <div className={`w-7 h-7 rounded-full flex items-center justify-center text-sm shrink-0 ${
                  step.completed
                    ? 'bg-accent text-accent-foreground'
                    : index === currentStep
                    ? 'bg-primary text-primary-foreground'
                    : 'bg-muted text-muted-foreground'
                }`}>
                  {step.completed ? '✓' : index + 1}
                </div>
                <div className="flex-1">
                  <p className={`font-semibold text-sm ${
                    step.completed ? 'text-accent-foreground' : 'text-foreground'
                  }`}>
                    {step.title}
                  </p>
                  {index === currentStep && !step.completed && (
                    <p className="text-muted-foreground text-xs mt-1">
                      {step.description}
                    </p>
                  )}
                </div>
              </div>

              {index === currentStep && !step.completed && (
                <div className="space-y-2 pl-10">
                  {step.link && (
                    <a
                      href={step.link}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="inline-flex items-center gap-1 text-xs text-primary hover:underline"
                    >
                      <ExternalLink className="size-3" /> {step.linkLabel ?? 'リンクを開く'}
                    </a>
                  )}
                  <button
                    onClick={() => handleComplete(step.id)}
                    className="w-full h-10 bg-primary text-primary-foreground text-sm font-semibold rounded-xl hover:bg-primary/90 transition"
                  >
                    できた
                  </button>
                </div>
              )}
            </div>
          ))}
        </div>

        <div className="pt-4 border-t border-border">
          <button
            onClick={() => {
              const questTitle = steps[currentStep]?.title ?? 'このステップ'
              const message = encodeURIComponent(
                `「${questTitle}」で詰まっています。助けてください。`
              )
              router.push(`/chat?help=${message}`)
            }}
            className="w-full py-3 text-sm text-muted-foreground hover:text-primary hover:bg-accent/30 rounded-2xl transition flex items-center justify-center gap-2"
          >
            <span>🆘</span>
            <span>詰まったら相談する</span>
          </button>
        </div>

      </div>
    </div>
  )
}
