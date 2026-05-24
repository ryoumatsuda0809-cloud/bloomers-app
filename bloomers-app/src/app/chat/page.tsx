'use client'

import { useState, useEffect, useRef } from 'react'
import { useRouter, useSearchParams } from 'next/navigation'
import {
  getChatHistory,
  sendMessage,
  clearChatHistory,
} from '@/app/actions/chat'
import { skipOnboarding } from '@/app/actions/onboarding'
import type { ChatMessage, QuestContext } from '@/app/actions/chat'
import { Skeleton } from '@/components/ui/skeleton'
import { ArrowLeft, ArrowRight, ArrowUp } from 'lucide-react'

export default function ChatPage() {
  const router = useRouter()
  const [messages, setMessages] = useState<ChatMessage[]>([])
  const [input, setInput] = useState('')
  const [isLoading, setIsLoading] = useState(false)
  const [isHistoryLoading, setIsHistoryLoading] = useState(true)
  const [isIdeaConfirmed, setIsIdeaConfirmed] = useState(false)
  const [isDiscoverMode, setIsDiscoverMode] = useState(false)
  const [genreLabel, setGenreLabel] = useState<string>('')
  const [questContext, setQuestContext] = useState<QuestContext | null>(null)
  const bottomRef = useRef<HTMLDivElement>(null)
  const searchParams = useSearchParams()

  useEffect(() => {
    getChatHistory().then((history) => {
      if (history.length === 0) {
        const genreLabel = searchParams.get('genreLabel')
        const welcomeContent = genreLabel
          ? `こんにちは！🌸 「${genreLabel}」に興味があるんですね。\n\nそこで感じた「これ不便だな」「こんなのあったらいいな」って、どんな小さなことでも聞かせてください。`
          : 'こんにちは！🌸 作りたいものを一緒に見つけよう。\n\nまず聞かせて、最近「これ不便だな」って思ったことある？どんな小さなことでもいいよ。'
        setMessages([{
          id: 'welcome',
          role: 'assistant',
          content: welcomeContent,
          createdAt: new Date().toISOString(),
        }])
      } else {
        setMessages(history)
      }
      setIsHistoryLoading(false)
    })
  }, []) // eslint-disable-line react-hooks/exhaustive-deps

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: 'smooth' })
  }, [messages])

  useEffect(() => {
    const questId = searchParams.get('questId')
    const questTitle = searchParams.get('questTitle')
    const stepTitle = searchParams.get('stepTitle')
    const mentorMessage = searchParams.get('mentorMessage')

    if (questId && questTitle && stepTitle && mentorMessage) {
      setQuestContext({ questId, questTitle, stepTitle, mentorMessage })
    }
  }, [searchParams])

  useEffect(() => {
    if (searchParams.get('mode') === 'discover') {
      setIsDiscoverMode(true)
      const label = searchParams.get('genreLabel') ?? ''
      setGenreLabel(label)
    }
  }, [searchParams])

  useEffect(() => {
    const helpMessage = searchParams.get('help')
    if (!helpMessage || isHistoryLoading) return

    // デコードしてinputにセット
    setInput(decodeURIComponent(helpMessage))
  }, [searchParams, isHistoryLoading])

  useEffect(() => {
    const helpMessage = searchParams.get('help')
    if (!helpMessage || isHistoryLoading) return

    const decoded = decodeURIComponent(helpMessage)

    // 少し待ってから自動送信
    const timer = setTimeout(async () => {
      if (!decoded.trim() || isLoading) return
      setIsLoading(true)

      const tempUserMsg: ChatMessage = {
        id: `temp-${Date.now()}`,
        role: 'user',
        content: decoded,
        createdAt: new Date().toISOString(),
      }
      setMessages((prev) => [...prev, tempUserMsg])

      const history = messages
        .filter((m) => m.id !== 'welcome')
        .map((m) => ({ role: m.role, content: m.content }))

      const { reply, ideaGenerated } = await sendMessage(decoded, history, questContext ?? undefined, isDiscoverMode ? (genreLabel || true) : undefined)

      const assistantMsg: ChatMessage = {
        id: `assistant-${Date.now()}`,
        role: 'assistant',
        content: reply,
        createdAt: new Date().toISOString(),
      }
      setMessages((prev) => [...prev, assistantMsg])

      if (ideaGenerated) {
        setIsIdeaConfirmed(true)
        const confirmMsg: ChatMessage = {
          id: `confirm-${Date.now()}`,
          role: 'assistant',
          content: 'アイデアが決まりました！\nダッシュボードでクエストを始めましょう。',
          createdAt: new Date().toISOString(),
        }
        setMessages((prev) => [...prev, confirmMsg])
        setTimeout(() => router.push('/'), 3000)
      }

      setIsLoading(false)
    }, 1000)

    return () => clearTimeout(timer)
  }, [isHistoryLoading]) // eslint-disable-line react-hooks/exhaustive-deps

  const handleSend = async () => {
    if (!input.trim() || isLoading) return

    const userMessage = input.trim()
    setInput('')
    setIsLoading(true)

    // ユーザーメッセージを即時表示
    const tempUserMsg: ChatMessage = {
      id: `temp-${Date.now()}`,
      role: 'user',
      content: userMessage,
      createdAt: new Date().toISOString(),
    }
    setMessages((prev) => [...prev, tempUserMsg])

    // 履歴を構築（welcomeメッセージは除く）
    const history = messages
      .filter((m) => m.id !== 'welcome')
      .map((m) => ({ role: m.role, content: m.content }))

    const { reply, ideaGenerated } = await sendMessage(userMessage, history, questContext ?? undefined, isDiscoverMode ? (genreLabel || true) : undefined)

    const assistantMsg: ChatMessage = {
      id: `assistant-${Date.now()}`,
      role: 'assistant',
      content: reply,
      createdAt: new Date().toISOString(),
    }
    setMessages((prev) => [...prev, assistantMsg])

    if (ideaGenerated) {
      setIsIdeaConfirmed(true)
      const confirmMsg: ChatMessage = {
        id: `confirm-${Date.now()}`,
        role: 'assistant',
        content: 'アイデアが決まりました！\nダッシュボードでクエストを始めましょう。',
        createdAt: new Date().toISOString(),
      }
      setMessages((prev) => [...prev, confirmMsg])
      setTimeout(() => router.push('/'), 3000)
    }

    setIsLoading(false)
  }

  const handleClear = async () => {
    if (!confirm('会話履歴をリセットしますか？')) return
    await clearChatHistory()
    setMessages([{
      id: 'welcome-new',
      role: 'assistant',
      content: 'こんにちは！🌸 作りたいものを一緒に見つけよう。\n\nまず聞かせて、最近「これ不便だな」って思ったことある？',
      createdAt: new Date().toISOString(),
    }])
  }

  return (
    <div className="min-h-screen bg-background flex flex-col">

      {/* ヘッダー */}
      <div className="bg-card border-b border-border px-4 py-3 flex items-center justify-between sticky top-0 z-10">
        <div className="flex items-center gap-3">
          <button
            onClick={() => router.push('/')}
            className="p-3 -ml-3 text-muted-foreground hover:text-foreground transition"
            aria-label="ダッシュボードに戻る"
          >
            <ArrowLeft className="size-4" />
          </button>
          <div className="flex items-center gap-2">
            <span className="text-xl">🌸</span>
            <div>
              <p className="text-sm font-semibold text-foreground">Bloomerメンター</p>
              <p className="text-xs text-muted-foreground">あなたのアイデアを一緒に見つけよう</p>
            </div>
          </div>
        </div>
        <div className="flex items-center gap-2">
          {isDiscoverMode && !isIdeaConfirmed && (
            <button
              onClick={async () => {
                await skipOnboarding()
                router.push('/')
              }}
              className="text-xs text-muted-foreground hover:text-foreground transition px-2 py-1 rounded-lg hover:bg-muted"
            >
              スキップ
            </button>
          )}
          <button
            onClick={handleClear}
            className="text-xs text-muted-foreground hover:text-foreground transition"
          >
            リセット
          </button>
        </div>
      </div>

      {/* メッセージ一覧 */}
      <div className="flex-1 overflow-y-auto">
        {isHistoryLoading ? (
          <div className="space-y-4 max-w-2xl mx-auto w-full px-4 py-6">
            <div className="flex justify-start gap-2">
              <Skeleton className="w-7 h-7 rounded-full shrink-0" />
              <Skeleton className="h-16 w-64 rounded-2xl" />
            </div>
            <div className="flex justify-end">
              <Skeleton className="h-10 w-48 rounded-2xl" />
            </div>
            <div className="flex justify-start gap-2">
              <Skeleton className="w-7 h-7 rounded-full shrink-0" />
              <Skeleton className="h-20 w-72 rounded-2xl" />
            </div>
          </div>
        ) : (
        <div className="px-4 py-6 pb-4 space-y-4 max-w-2xl mx-auto w-full">
        {questContext && (
          <div className="bg-muted/60 border border-border rounded-xl px-4 py-3 text-xs text-muted-foreground">
            <p className="font-medium text-foreground text-sm mb-0.5">
              {questContext.questTitle} — {questContext.stepTitle}
            </p>
            <p>{questContext.mentorMessage}</p>
          </div>
        )}
        {messages.map((message) => (
          <div
            key={message.id}
            className={`flex ${message.role === 'user' ? 'justify-end' : 'justify-start'}`}
          >
            {message.role === 'assistant' && (
              <div className="w-7 h-7 rounded-full bg-accent/40 flex items-center justify-center text-sm mr-2 shrink-0 mt-1">
                🌸
              </div>
            )}
            <div
              className={`max-w-[80%] rounded-2xl px-4 py-3 text-sm whitespace-pre-wrap ${
                message.role === 'user'
                  ? 'bg-primary text-primary-foreground rounded-br-sm'
                  : 'bg-card border border-border text-foreground rounded-bl-sm'
              }`}
            >
              {message.content}
            </div>
          </div>
        ))}

        {isLoading && (
          <div className="flex justify-start">
            <div className="w-7 h-7 rounded-full bg-accent/40 flex items-center justify-center text-sm mr-2 shrink-0">
              🌸
            </div>
            <div className="bg-card border border-border rounded-2xl rounded-bl-sm px-4 py-3">
              <div className="flex gap-1">
                <div className="w-2 h-2 bg-muted-foreground/50 rounded-full animate-bounce" style={{ animationDelay: '0ms' }} />
                <div className="w-2 h-2 bg-muted-foreground/50 rounded-full animate-bounce" style={{ animationDelay: '150ms' }} />
                <div className="w-2 h-2 bg-muted-foreground/50 rounded-full animate-bounce" style={{ animationDelay: '300ms' }} />
              </div>
            </div>
          </div>
        )}

        <div ref={bottomRef} />
        </div>
        )}
      </div>

      {/* 入力欄 */}
      {!isIdeaConfirmed && (
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
              className="flex-1 border border-border rounded-2xl px-4 py-2.5 text-sm text-foreground resize-none focus:outline-none focus:border-primary max-h-32"
            />
            <button
              onClick={handleSend}
              disabled={!input.trim() || isLoading}
              className="w-10 h-10 bg-primary hover:bg-primary/90 disabled:bg-muted text-primary-foreground rounded-2xl flex items-center justify-center transition shrink-0 self-end"
              aria-label="メッセージを送信"
            >
              <ArrowUp className="size-4" />
            </button>
          </div>
          <p className="text-xs text-muted-foreground text-center mt-2">
            Enterで送信・Shift+Enterで改行
          </p>
        </div>
      )}

      {isIdeaConfirmed && (
        <div className="bg-card border-t border-border px-4 py-4 sticky bottom-0">
          <div className="max-w-2xl mx-auto">
            <button
              onClick={() => router.push('/')}
              className="w-full h-11 bg-primary text-primary-foreground text-sm font-semibold rounded-2xl hover:bg-primary/90 transition flex items-center justify-center gap-2"
            >
              ダッシュボードへ進む
              <ArrowRight className="size-4" />
            </button>
            <p className="text-xs text-muted-foreground text-center mt-2">
              3秒後に自動で移動します
            </p>
          </div>
        </div>
      )}

    </div>
  )
}
