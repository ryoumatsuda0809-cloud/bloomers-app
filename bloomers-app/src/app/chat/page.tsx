'use client'

import { useState, useEffect, useRef } from 'react'
import { useRouter } from 'next/navigation'
import {
  getChatHistory,
  sendMessage,
  clearChatHistory,
} from '@/app/actions/chat'
import type { ChatMessage } from '@/app/actions/chat'

export default function ChatPage() {
  const router = useRouter()
  const [messages, setMessages] = useState<ChatMessage[]>([])
  const [input, setInput] = useState('')
  const [isLoading, setIsLoading] = useState(false)
  const [newIdeaSaved, setNewIdeaSaved] = useState(false)
  const bottomRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    getChatHistory().then((history) => {
      if (history.length === 0) {
        // 初回メッセージ
        setMessages([{
          id: 'welcome',
          role: 'assistant',
          content: 'こんにちは！🌸 作りたいものを一緒に見つけよう。\n\nまず聞かせて、最近「これ不便だな」って思ったことある？どんな小さなことでもいいよ。',
          createdAt: new Date().toISOString(),
        }])
      } else {
        setMessages(history)
      }
    })
  }, [])

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: 'smooth' })
  }, [messages])

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

    const { reply, ideaGenerated } = await sendMessage(userMessage, history)

    const assistantMsg: ChatMessage = {
      id: `assistant-${Date.now()}`,
      role: 'assistant',
      content: reply,
      createdAt: new Date().toISOString(),
    }
    setMessages((prev) => [...prev, assistantMsg])

    if (ideaGenerated) {
      setNewIdeaSaved(true)
      setTimeout(() => setNewIdeaSaved(false), 5000)
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
    <div className="min-h-screen bg-zinc-50 flex flex-col">

      {/* ヘッダー */}
      <div className="bg-white border-b border-zinc-200 px-4 py-3 flex items-center justify-between sticky top-0 z-10">
        <div className="flex items-center gap-3">
          <button
            onClick={() => router.push('/')}
            className="text-zinc-400 hover:text-zinc-600 transition text-sm"
          >
            ←
          </button>
          <div className="flex items-center gap-2">
            <span className="text-xl">🌸</span>
            <div>
              <p className="text-sm font-semibold text-zinc-800">Bloomerメンター</p>
              <p className="text-xs text-zinc-400">あなたのアイデアを一緒に見つけよう</p>
            </div>
          </div>
        </div>
        <button
          onClick={handleClear}
          className="text-xs text-zinc-400 hover:text-zinc-600 transition"
        >
          リセット
        </button>
      </div>

      {/* 新しいアイデア保存通知 */}
      {newIdeaSaved && (
        <div className="bg-indigo-600 text-white text-sm py-2 px-4 flex items-center justify-center gap-3">
          <span>✨ 新しいプロジェクト案を保存しました！</span>
          <a
            href="/projects"
            className="underline font-medium shrink-0"
          >
            確認する →
          </a>
        </div>
      )}

      {/* メッセージ一覧 */}
      <div className="flex-1 overflow-y-auto px-4 py-6 space-y-4 max-w-2xl mx-auto w-full">
        {messages.map((message) => (
          <div
            key={message.id}
            className={`flex ${message.role === 'user' ? 'justify-end' : 'justify-start'}`}
          >
            {message.role === 'assistant' && (
              <div className="w-7 h-7 rounded-full bg-indigo-100 flex items-center justify-center text-sm mr-2 shrink-0 mt-1">
                🌸
              </div>
            )}
            <div
              className={`max-w-[80%] rounded-2xl px-4 py-3 text-sm whitespace-pre-wrap ${
                message.role === 'user'
                  ? 'bg-indigo-600 text-white rounded-br-sm'
                  : 'bg-white border border-zinc-200 text-zinc-700 rounded-bl-sm'
              }`}
            >
              {message.content}
            </div>
          </div>
        ))}

        {isLoading && (
          <div className="flex justify-start">
            <div className="w-7 h-7 rounded-full bg-indigo-100 flex items-center justify-center text-sm mr-2 shrink-0">
              🌸
            </div>
            <div className="bg-white border border-zinc-200 rounded-2xl rounded-bl-sm px-4 py-3">
              <div className="flex gap-1">
                <div className="w-2 h-2 bg-zinc-300 rounded-full animate-bounce" style={{ animationDelay: '0ms' }} />
                <div className="w-2 h-2 bg-zinc-300 rounded-full animate-bounce" style={{ animationDelay: '150ms' }} />
                <div className="w-2 h-2 bg-zinc-300 rounded-full animate-bounce" style={{ animationDelay: '300ms' }} />
              </div>
            </div>
          </div>
        )}

        <div ref={bottomRef} />
      </div>

      {/* 入力欄 */}
      <div className="bg-white border-t border-zinc-200 px-4 py-3 sticky bottom-0">
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
            className="flex-1 border border-zinc-200 rounded-2xl px-4 py-2.5 text-sm text-zinc-700 resize-none focus:outline-none focus:border-indigo-400 max-h-32"
          />
          <button
            onClick={handleSend}
            disabled={!input.trim() || isLoading}
            className="w-10 h-10 bg-indigo-600 hover:bg-indigo-700 disabled:bg-zinc-200 text-white rounded-2xl flex items-center justify-center transition shrink-0 self-end"
          >
            ↑
          </button>
        </div>
        <p className="text-xs text-zinc-400 text-center mt-2">
          Enterで送信・Shift+Enterで改行
        </p>
      </div>

    </div>
  )
}
