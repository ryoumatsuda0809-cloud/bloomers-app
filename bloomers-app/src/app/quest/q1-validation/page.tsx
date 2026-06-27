'use client'

import { useState, useEffect, useRef, Suspense } from 'react'
import { useRouter, useSearchParams } from 'next/navigation'
import { ArrowLeft, ArrowUp } from 'lucide-react'
import { createClient } from '@/lib/supabase/client'
import { getMentorHistory } from '@/app/actions/chat'
import {
  processValidationTurn,
  generateValidatedBrief,
  finalizeValidation,
  type ValidationState,
  type ValidationTurn,
} from '@/app/actions/quest1-validation'
import { updateQuestStatus } from '@/app/actions/quest'
import type { IdeaCard, ValidatedBrief } from '@/app/actions/onboarding'
import {
  AlertDialog,
  AlertDialogContent,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogAction,
  AlertDialogCancel,
} from '@/components/ui/alert-dialog'

const INITIAL_MESSAGE = `まだアイデアが固まっていなくて大丈夫です。一緒につくっていきましょう！

4つの問いに答えるだけで、「誰のために」「何を」「どうやって」が見えてきます。

まず：このアプリ、一番最初に使ってほしいのは「どこの誰」ですか？名前か顔が浮かぶ実在の1人で。`

function ReviewView({ brief, ideaCard, onBack }: {
  brief: ValidatedBrief
  ideaCard: IdeaCard
  onBack: () => void
}) {
  return (
    <div className="min-h-screen bg-background">
      <header className="bg-card border-b border-border px-4 py-3 sticky top-0 z-10">
        <div className="max-w-2xl mx-auto flex items-center justify-between">
          <div className="flex items-center gap-2">
            <span className="text-xl">🌸</span>
            <div>
              <p className="text-sm font-semibold text-foreground">アイデア検証ブリーフ</p>
              <p className="text-xs text-muted-foreground">{ideaCard.title}</p>
            </div>
          </div>
          <button
            onClick={onBack}
            className="text-xs text-muted-foreground hover:text-foreground transition px-2 py-1 rounded-lg hover:bg-muted flex items-center gap-1"
          >
            <ArrowLeft className="size-3" /> 戻る
          </button>
        </div>
      </header>

      <div className="max-w-2xl mx-auto px-4 py-6 space-y-4">
        <div className="bg-card border border-border rounded-2xl p-5 space-y-1">
          <p className="text-xs text-muted-foreground font-medium">ペルソナ（誰のために）</p>
          <p className="text-sm text-foreground font-semibold">{brief.persona}</p>
        </div>
        <div className="bg-card border border-border rounded-2xl p-5 space-y-1">
          <p className="text-xs text-muted-foreground font-medium">既存代替・差別化（なぜ作る）</p>
          <p className="text-sm text-foreground">{brief.alternatives}</p>
        </div>
        <div className="bg-card border border-border rounded-2xl p-5 space-y-1">
          <p className="text-xs text-muted-foreground font-medium">切実さ（なぜ今）</p>
          <p className="text-sm text-foreground">{brief.urgency}</p>
        </div>
        <div className="bg-card border border-border rounded-2xl p-5 space-y-1">
          <p className="text-xs text-muted-foreground font-medium">削れない核</p>
          <p className="text-sm text-foreground font-semibold">{brief.essentialCore}</p>
        </div>
        <div className="bg-card border border-primary/30 rounded-2xl p-5 space-y-2">
          <p className="text-xs text-primary font-medium">蒸留ブリーフ（メンターが参照）</p>
          <p className="text-xs text-muted-foreground">誰：{brief.who}</p>
          <p className="text-xs text-muted-foreground">何：{brief.what}</p>
          <p className="text-xs text-muted-foreground">どう：{brief.how}</p>
        </div>
      </div>
    </div>
  )
}

function TrialSkipView({ onSkip }: { onSkip: () => void }) {
  return (
    <div className="min-h-screen bg-background flex items-center justify-center px-4">
      <div className="max-w-md w-full bg-card border border-border rounded-2xl p-8 text-center space-y-4">
        <span className="text-4xl">🌸</span>
        <h2 className="text-lg font-bold text-foreground">体験版ではスキップできます</h2>
        <p className="text-sm text-muted-foreground">
          サンプルアイデアでは検証をスキップします。自分のアイデアで始めると、ここで本格的な検証インタビューが入ります。
        </p>
        <button
          onClick={onSkip}
          className="w-full h-10 bg-primary text-primary-foreground text-sm font-semibold rounded-xl hover:bg-primary/90 transition"
        >
          クエスト1を完了して次へ
        </button>
      </div>
    </div>
  )
}

function Q1ValidationContent() {
  const router = useRouter()
  const searchParams = useSearchParams()
  const isReviewMode = searchParams.get('review') === '1'

  const [projectId, setProjectId] = useState('')
  const [ideaCard, setIdeaCard] = useState<IdeaCard | null>(null)
  const [isTrial, setIsTrial] = useState(false)
  const [isPageLoading, setIsPageLoading] = useState(true)

  const [state, setState] = useState<ValidationState>({
    phase: 'persona',
    answers: {},
    history: [],
    isPhaseDone: false,
  })
  const [messages, setMessages] = useState<ValidationTurn[]>([])
  const [input, setInput] = useState('')
  const [isLoading, setIsLoading] = useState(false)
  const [isBriefing, setIsBriefing] = useState(false)
  const [turnCountInPhase, setTurnCountInPhase] = useState(0)
  const [showFinalizeDialog, setShowFinalizeDialog] = useState(false)
  const bottomRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: 'smooth' })
  }, [messages])

  // summary フェーズへ進んだらブリーフ生成を自動開始
  useEffect(() => {
    if (state.phase === 'summary' && !state.finalBrief && !isBriefing) {
      handleGenerateBrief()
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [state.phase])

  useEffect(() => {
    const load = async () => {
      const supabase = createClient()
      const { data: { user } } = await supabase.auth.getUser()
      if (!user) { router.push('/login'); return }

      const { data: project } = await supabase
        .from('project_ideas')
        .select('id, idea_card, is_trial')
        .eq('user_id', user.id)
        .eq('is_active', true)
        .order('created_at', { ascending: false })
        .limit(1)
        .maybeSingle()

      if (!project) {
        router.replace('/onboarding')
        return
      }

      const card = project.idea_card as IdeaCard
      const trial = (project as Record<string, unknown>).is_trial === true

      setProjectId(project.id)
      setIdeaCard(card)
      setIsTrial(trial)

      // 過去の会話を復元
      if (!isReviewMode && !trial) {
        const progress = card?.validationProgress
        if (progress) {
          // DB から会話履歴を復元
          const history = await getMentorHistory(project.id, 'q1')
          const turns: ValidationTurn[] = history.map((h) => ({
            role: h.role as 'user' | 'assistant',
            content: h.content,
          }))
          setState({ phase: progress.phase, answers: progress.answers, history: turns, isPhaseDone: false })
          setMessages(turns.length > 0 ? turns : [{ role: 'assistant', content: INITIAL_MESSAGE }])
        } else if (card?.validatedBrief) {
          // 既に完了している → review mode へ
          router.replace('/quest/q1-validation?review=1')
          return
        } else {
          setMessages([{ role: 'assistant', content: INITIAL_MESSAGE }])
        }
      }

      setIsPageLoading(false)
    }
    load()
  }, [router, isReviewMode])

  const handleGenerateBrief = async () => {
    setIsBriefing(true)
    const { brief, error } = await generateValidatedBrief(state.answers, ideaCard!)
    if (error || !brief) {
      setMessages((prev) => [
        ...prev,
        { role: 'assistant', content: 'まとめの生成に失敗しました。もう一度試してください。' },
      ])
      setIsBriefing(false)
      return
    }

    setState((prev) => ({ ...prev, finalBrief: brief, phase: 'revise' }))

    const summaryMessage = `ここまでの内容をまとめます。

ペルソナ：${brief.persona}
既存代替：${brief.alternatives}
切実さ：${brief.urgency}
核となる機能：${brief.essentialCore}

この内容で確定しますか？修正したければ「ペルソナ」「市場」「切実さ」「核」のどれかを教えてください。`

    setMessages((prev) => [...prev, { role: 'assistant', content: summaryMessage }])
    setIsBriefing(false)
  }

  const handleTrialSkip = async () => {
    if (!projectId) return
    await updateQuestStatus('q1', 'completed', projectId)
    router.push('/quest/q2')
  }

  const handleFinalize = async (): Promise<boolean> => {
    if (!state.finalBrief || !projectId) return false
    const { success, error } = await finalizeValidation(state.finalBrief, projectId)
    if (error || !success) {
      setMessages((prev) => [
        ...prev,
        { role: 'assistant', content: '保存に失敗しました。もう一度試してください。' },
      ])
      return false
    }
    return true
  }

  const handleSend = async () => {
    if (!input.trim() || isLoading || isBriefing || !ideaCard || !projectId) return
    const userMessage = input.trim()
    setInput('')
    setMessages((prev) => [...prev, { role: 'user', content: userMessage }])
    setIsLoading(true)

    if (state.phase === 'revise') {
      const lower = userMessage.toLowerCase()
      const revisePhases = ['ペルソナ', '市場', '切実さ', '核'] as const
      const phaseMap: Record<string, 'persona' | 'market' | 'urgency' | 'core'> = {
        'ペルソナ': 'persona', '市場': 'market', '切実さ': 'urgency', '核': 'core',
      }
      const matched = revisePhases.find((k) => lower.includes(k))
      if (matched) {
        const targetPhase = phaseMap[matched]
        setMessages((prev) => [
          ...prev,
          { role: 'assistant', content: `なるほど。では、${matched}について改めて教えてください。` },
        ])
        setState((prev) => ({ ...prev, phase: targetPhase, isPhaseDone: false }))
        setIsLoading(false)
        return
      }

      const confirmKeywords = ['大丈夫', 'ok', 'はい', '進めて', 'これで', 'いい', '確定']
      if (confirmKeywords.some((k) => lower.includes(k))) {
        setShowFinalizeDialog(true)
        setIsLoading(false)
        return
      }

      setMessages((prev) => [
        ...prev,
        { role: 'assistant', content: '「ペルソナ」「市場」「切実さ」「核」のどれかを修正しますか？このままで良ければ「大丈夫」と教えてください。' },
      ])
      setIsLoading(false)
      return
    }

    const { reply, nextState, error } = await processValidationTurn(
      userMessage, state, projectId, ideaCard
    )

    if (error) {
      setMessages((prev) => [
        ...prev,
        { role: 'assistant', content: 'メンターに接続できませんでした。もう一度試してみてください。' },
      ])
      setIsLoading(false)
      return
    }

    setMessages((prev) => [...prev, { role: 'assistant', content: reply }])
    setState(nextState)

    if (nextState.phase === state.phase) {
      setTurnCountInPhase((prev) => prev + 1)
    } else {
      setTurnCountInPhase(0)
    }

    setIsLoading(false)
  }

  const isDone = state.phase === 'done'

  if (isPageLoading) {
    return (
      <div className="min-h-screen bg-background px-4 py-8">
        <div className="max-w-2xl mx-auto space-y-4">
          <div className="h-4 w-32 bg-muted rounded animate-pulse" />
          <div className="h-8 w-56 bg-muted rounded animate-pulse" />
        </div>
      </div>
    )
  }

  if (isTrial) {
    return <TrialSkipView onSkip={handleTrialSkip} />
  }

  if (isReviewMode && ideaCard?.validatedBrief) {
    return (
      <ReviewView
        brief={ideaCard.validatedBrief}
        ideaCard={ideaCard}
        onBack={() => router.push('/')}
      />
    )
  }

  if (isReviewMode && !ideaCard?.validatedBrief) {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center px-4">
        <div className="text-center space-y-3">
          <p className="text-foreground font-medium">まだ検証は完了していません</p>
          <button
            onClick={() => router.replace('/quest/q1-validation')}
            className="text-sm text-primary hover:underline"
          >
            検証インタビューを始める
          </button>
        </div>
      </div>
    )
  }

  return (
    <>
    <div className="min-h-screen bg-background flex flex-col">

      <header className="bg-card border-b border-border px-4 py-3 sticky top-0 z-10">
        <div className="max-w-2xl mx-auto flex items-center justify-between">
          <div className="flex items-center gap-2">
            <span className="text-xl">🌸</span>
            <div>
              <p className="text-sm font-semibold text-foreground">アイデアをつくろう！</p>
              <p className="text-xs text-muted-foreground">一緒に考えていきましょう</p>
            </div>
          </div>
          <button
            onClick={() => router.push('/')}
            className="text-xs text-muted-foreground hover:text-foreground transition px-2 py-1 rounded-lg hover:bg-muted flex items-center gap-1"
          >
            <ArrowLeft className="size-3" /> ダッシュボードへ
          </button>
        </div>
      </header>

      <div className="flex-1 overflow-y-auto">
        <div className="max-w-2xl mx-auto px-4 py-6 space-y-4">
          {messages.map((m, i) => (
            <div key={i} className={`flex ${m.role === 'user' ? 'justify-end' : 'justify-start'}`}>
              {m.role === 'assistant' && (
                <div className="w-7 h-7 rounded-full bg-accent/40 flex items-center justify-center text-sm mr-2 shrink-0 mt-1">
                  🌸
                </div>
              )}
              <div
                className={`max-w-[80%] rounded-2xl px-4 py-3 text-sm whitespace-pre-wrap leading-relaxed ${
                  m.role === 'user'
                    ? 'bg-primary text-primary-foreground rounded-br-sm'
                    : 'bg-card border border-border text-foreground rounded-bl-sm'
                }`}
              >
                {m.content}
              </div>
            </div>
          ))}

          {(isLoading || isBriefing) && (
            <div className="flex justify-start">
              <div className="w-7 h-7 rounded-full bg-accent/40 flex items-center justify-center text-sm mr-2 shrink-0">
                🌸
              </div>
              <div className="bg-card border border-border rounded-2xl rounded-bl-sm px-4 py-3">
                <div className="flex gap-1 items-center">
                  <div className="w-2 h-2 bg-muted-foreground/50 rounded-full animate-bounce" style={{ animationDelay: '0ms' }} />
                  <div className="w-2 h-2 bg-muted-foreground/50 rounded-full animate-bounce" style={{ animationDelay: '150ms' }} />
                  <div className="w-2 h-2 bg-muted-foreground/50 rounded-full animate-bounce" style={{ animationDelay: '300ms' }} />
                </div>
              </div>
            </div>
          )}

          {turnCountInPhase >= 2 &&
            !isLoading &&
            !isBriefing &&
            state.phase !== 'revise' &&
            state.phase !== 'summary' && (
            <div className="flex justify-center py-2">
              <button
                onClick={() => {
                  const order = ['persona', 'market', 'urgency', 'core', 'summary'] as const
                  const currentIdx = order.indexOf(state.phase as typeof order[number])
                  if (currentIdx >= 0 && currentIdx < order.length - 1) {
                    const lastUserMsg = [...messages].reverse().find(m => m.role === 'user')?.content ?? ''
                    const updatedAnswers = { ...state.answers }
                    const phaseKey = state.phase as keyof typeof updatedAnswers
                    updatedAnswers[phaseKey] = lastUserMsg
                    setState(prev => ({
                      ...prev,
                      phase: order[currentIdx + 1],
                      answers: updatedAnswers,
                      isPhaseDone: true,
                    }))
                    setTurnCountInPhase(0)
                  }
                }}
                className="text-xs text-primary hover:underline px-4 py-2 rounded-lg hover:bg-accent/20 transition"
              >
                次のフェーズへ進む →
              </button>
            </div>
          )}

          <div ref={bottomRef} />
        </div>
      </div>

      {state.phase === 'revise' && !isLoading && !isBriefing && (
        <div className="max-w-2xl mx-auto w-full px-4 pb-2 flex gap-2">
          <button
            onClick={() => setShowFinalizeDialog(true)}
            className="flex-1 h-10 bg-primary text-primary-foreground text-sm font-semibold rounded-xl hover:bg-primary/90 transition"
          >
            このまま確定して次へ
          </button>
        </div>
      )}

      <div className="bg-card border-t border-border px-4 py-3 sticky bottom-0">
        <div className="max-w-2xl mx-auto flex gap-2">
          <textarea
            value={input}
            onChange={(e) => setInput(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === 'Enter' && !e.shiftKey) {
                e.preventDefault()
                handleSend()
              }
            }}
            placeholder="メッセージを入力..."
            rows={1}
            disabled={isLoading || isBriefing || isDone}
            className="flex-1 border border-border rounded-2xl px-4 py-2.5 text-sm text-foreground bg-background resize-none focus:outline-none focus:border-primary max-h-32 disabled:opacity-50 transition-colors"
          />
          <button
            onClick={handleSend}
            disabled={!input.trim() || isLoading || isBriefing || isDone}
            className="w-10 h-10 bg-primary hover:bg-primary/90 disabled:bg-muted text-primary-foreground rounded-2xl flex items-center justify-center transition-colors shrink-0 self-end"
            aria-label="送信"
          >
            <ArrowUp className="size-4" />
          </button>
        </div>
        <p className="text-xs text-muted-foreground text-center mt-2">
          Enterで送信・Shift+Enterで改行
        </p>
      </div>
    </div>

    <AlertDialog open={showFinalizeDialog} onOpenChange={setShowFinalizeDialog}>
      <AlertDialogContent>
        <AlertDialogHeader>
          <AlertDialogTitle>検証ブリーフを確定しますか？</AlertDialogTitle>
          <AlertDialogDescription>
            確定するとクエスト1が完了し、次のクエストが解放されます。
          </AlertDialogDescription>
        </AlertDialogHeader>
        <AlertDialogFooter className="flex-col gap-2">
          <AlertDialogAction
            onClick={async () => {
              setShowFinalizeDialog(false)
              const success = await handleFinalize()
              if (success) router.push('/quest/q2')
            }}
            className="w-full bg-primary text-primary-foreground hover:bg-primary/90"
          >
            確定して次へ
          </AlertDialogAction>
          <AlertDialogCancel className="w-full">キャンセル</AlertDialogCancel>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
    </>
  )
}

export default function Q1ValidationPage() {
  return (
    <Suspense fallback={
      <div className="min-h-screen bg-background px-4 py-8">
        <div className="max-w-2xl mx-auto space-y-4">
          <div className="h-4 w-32 bg-muted rounded animate-pulse" />
        </div>
      </div>
    }>
      <Q1ValidationContent />
    </Suspense>
  )
}
