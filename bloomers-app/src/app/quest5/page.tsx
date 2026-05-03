'use client'

import { useState, useEffect } from 'react'
import { useRouter } from 'next/navigation'
import { createClient } from '@/lib/supabase/client'
import { updateQuestStepCompletion } from '@/app/actions/setup'
import type { SetupStep } from '@/app/actions/setup'

export default function Quest5Page() {
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
        .select('id, quest5_steps')
        .eq('user_id', user.id)
        .eq('is_active', true)
        .single()

      if (data) {
        setProjectId(data.id)
        setSteps(data.quest5_steps ?? [])
        const firstIncomplete = (data.quest5_steps ?? [])
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
    await updateQuestStepCompletion(projectId, 5, stepId, true)

    const nextIndex = updated.findIndex((s) => !s.completed)
    if (nextIndex === -1) {
      // 自動遷移しない。ユーザーが「ダッシュボードに戻る」を押す
    } else {
      setCurrentStep(nextIndex)
    }
  }

  const allCompleted = steps.every((s) => s.completed)
  const completedCount = steps.filter((s) => s.completed).length

  if (hasError) {
    return (
      <div className="min-h-screen flex items-center justify-center px-4">
        <div className="text-center space-y-3">
          <p className="text-2xl">⚠️</p>
          <p className="text-zinc-700 font-medium">
            アクティブなプロジェクトが見つかりません
          </p>
          <button
            onClick={() => router.push('/projects')}
            className="text-sm text-indigo-600 hover:underline"
          >
            マイプロジェクトに戻る
          </button>
        </div>
      </div>
    )
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

        <div className="space-y-1">
          <h1 className="text-2xl font-bold text-zinc-800">
            世界に公開しよう
          </h1>
          <p className="text-sm text-zinc-500">
            {completedCount} / {steps.length} ステップ完了
          </p>
        </div>

        <div className="h-2 bg-zinc-200 rounded-full overflow-hidden">
          <div
            className="h-full bg-gradient-to-r from-indigo-500 to-purple-500 transition-all duration-500"
            style={{ width: `${steps.length > 0 ? (completedCount / steps.length) * 100 : 0}%` }}
          />
        </div>

        {allCompleted && (
          <div className="bg-green-50 border border-green-200 rounded-2xl p-5 text-center space-y-2">
            <p className="text-2xl">🎉</p>
            <p className="text-green-700 font-bold">クエスト5完了！</p>
            <button
              onClick={() => router.push('/')}
              className="text-green-600 text-sm underline hover:text-green-700 transition"
            >
              ダッシュボードに戻る →
            </button>
          </div>
        )}

        <div className="space-y-3">
          {steps.map((step, index) => (
            <div
              key={step.id}
              className={`bg-white rounded-2xl border p-5 space-y-3 transition ${
                step.completed
                  ? 'border-green-200 bg-green-50'
                  : index === currentStep
                  ? 'border-indigo-300 shadow-sm'
                  : 'border-zinc-200 opacity-50'
              }`}
            >
              <div className="flex items-start gap-3">
                <div className={`w-7 h-7 rounded-full flex items-center justify-center text-sm shrink-0 ${
                  step.completed
                    ? 'bg-green-500 text-white'
                    : index === currentStep
                    ? 'bg-indigo-600 text-white'
                    : 'bg-zinc-200 text-zinc-500'
                }`}>
                  {step.completed ? '✓' : index + 1}
                </div>
                <div className="flex-1">
                  <p className={`font-semibold text-sm ${
                    step.completed ? 'text-green-700' : 'text-zinc-800'
                  }`}>
                    {step.title}
                  </p>
                  {index === currentStep && !step.completed && (
                    <p className="text-zinc-500 text-xs mt-1">
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
                      className="inline-flex items-center gap-1 text-xs text-indigo-600 hover:underline"
                    >
                      🔗 {step.linkLabel ?? 'リンクを開く'}
                    </a>
                  )}
                  <button
                    onClick={() => handleComplete(step.id)}
                    className="w-full h-10 bg-gradient-to-r from-indigo-600 to-purple-600 text-white text-sm font-semibold rounded-xl hover:opacity-90 transition"
                  >
                    できた ✅
                  </button>
                </div>
              )}
            </div>
          ))}
        </div>

      </div>
    </div>
  )
}
