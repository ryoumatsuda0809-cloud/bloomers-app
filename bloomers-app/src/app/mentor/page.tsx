'use client'

import { useState, useEffect, useRef } from 'react'
import { ArrowUp, Plus, MessageCircle } from 'lucide-react'
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
import {
  getConversations,
  createConversation,
  getConversationMessages,
  sendMentorChatMessage,
  generateConversationTitle,
  type Conversation,
  type MentorMode,
} from '@/app/actions/mentor-chat'

type UIMessage = { role: 'user' | 'assistant'; content: string }

const MODE_LABELS: Record<MentorMode, { icon: string; label: string }> = {
  idea: { icon: '🌱', label: 'アイデア出し' },
  dev: { icon: '🔧', label: '問題解決' },
  general: { icon: '💬', label: 'なんでも相談' },
}

export default function MentorPage() {
  const [conversations, setConversations] = useState<Conversation[]>([])
  const [activeConvId, setActiveConvId] = useState<string | null>(null)
  const [activeMode, setActiveMode] = useState<MentorMode>('general')
  const [messages, setMessages] = useState<UIMessage[]>([])
  const [input, setInput] = useState('')
  const [isLoading, setIsLoading] = useState(false)
  const [showModeDialog, setShowModeDialog] = useState(false)
  const [isFirstMessage, setIsFirstMessage] = useState(false)
  const bottomRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    getConversations().then(setConversations).catch(() => {})
  }, [])

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: 'smooth' })
  }, [messages])

  const handleSelectConv = async (conv: Conversation) => {
    setActiveConvId(conv.id)
    setActiveMode(conv.mentorMode)
    setIsFirstMessage(false)
    try {
      const msgs = await getConversationMessages(conv.id)
      setMessages(msgs.map((m) => ({ role: m.role, content: m.content })))
    } catch {
      setMessages([])
    }
  }

  const handleCreateConv = async (mode: MentorMode) => {
    setShowModeDialog(false)
    const { conversation, error } = await createConversation(mode)
    if (error || !conversation) return
    setConversations((prev) => [conversation, ...prev])
    setActiveConvId(conversation.id)
    setActiveMode(mode)
    setMessages([])
    setIsFirstMessage(true)
  }

  const handleSend = async () => {
    const text = input.trim()
    if (!text || isLoading || !activeConvId) return

    setInput('')
    setIsLoading(true)
    setMessages((prev) => [...prev, { role: 'user', content: text }])

    const history = messages.map((m) => ({ role: m.role, content: m.content }))
    const { reply, error } = await sendMentorChatMessage(activeConvId, text, activeMode, history)

    setMessages((prev) => [
      ...prev,
      {
        role: 'assistant',
        content: error || !reply ? 'メンターに接続できませんでした。' : reply,
      },
    ])
    setIsLoading(false)

    if (isFirstMessage) {
      setIsFirstMessage(false)
      const { title } = await generateConversationTitle(activeConvId, text)
      if (title) {
        setConversations((prev) =>
          prev.map((c) => (c.id === activeConvId ? { ...c, title } : c))
        )
      }
    }
  }

  return (
    <div className="min-h-screen bg-background flex">
      {/* 左：チャット一覧 */}
      <aside className="w-64 shrink-0 border-r border-border bg-card flex flex-col h-screen">
        <div className="p-3 border-b border-border">
          <button
            onClick={() => setShowModeDialog(true)}
            className="w-full flex items-center justify-center gap-2 bg-primary text-primary-foreground rounded-xl py-2.5 text-sm font-medium hover:bg-primary/90 transition"
          >
            <Plus className="size-4" />
            新規チャット
          </button>
        </div>
        <div className="flex-1 overflow-y-auto p-2 space-y-1">
          {conversations.length === 0 && (
            <p className="text-xs text-muted-foreground text-center py-8 px-2">
              まだチャットがありません。
              <br />
              「新規チャット」から始めましょう。
            </p>
          )}
          {conversations.map((conv) => (
            <button
              key={conv.id}
              onClick={() => handleSelectConv(conv)}
              className={`w-full text-left px-3 py-2.5 rounded-lg transition ${
                activeConvId === conv.id ? 'bg-accent/30' : 'hover:bg-muted'
              }`}
            >
              <div className="flex items-center gap-1.5">
                <span className="text-xs shrink-0">{MODE_LABELS[conv.mentorMode].icon}</span>
                <span className="text-sm text-foreground truncate">{conv.title}</span>
              </div>
              <p className="text-xs text-muted-foreground mt-0.5 ml-5">
                {MODE_LABELS[conv.mentorMode].label}
              </p>
            </button>
          ))}
        </div>
      </aside>

      {/* 右：会話エリア */}
      <main className="flex-1 flex flex-col h-screen min-w-0">
        {activeConvId ? (
          <>
            <div className="px-4 py-3 border-b border-border shrink-0">
              <div className="flex items-center gap-2">
                <span>{MODE_LABELS[activeMode].icon}</span>
                <p className="text-sm font-semibold text-foreground">
                  {MODE_LABELS[activeMode].label}メンター
                </p>
              </div>
            </div>

            <div className="flex-1 overflow-y-auto p-4 space-y-3 min-h-0">
              {messages.length === 0 && (
                <div className="text-center py-12">
                  <p className="text-sm text-muted-foreground">何でも聞いてください 🌸</p>
                </div>
              )}
              {messages.map((m, i) => (
                <div
                  key={i}
                  className={`flex ${m.role === 'user' ? 'justify-end' : 'justify-start'}`}
                >
                  {m.role === 'assistant' && (
                    <span className="text-sm mr-1.5 mt-0.5 shrink-0">🌸</span>
                  )}
                  <div
                    className={`rounded-2xl px-4 py-2.5 text-sm leading-relaxed whitespace-pre-wrap max-w-[75%] ${
                      m.role === 'user'
                        ? 'bg-primary text-primary-foreground rounded-br-sm'
                        : 'bg-muted text-foreground rounded-bl-sm'
                    }`}
                  >
                    {m.content}
                  </div>
                </div>
              ))}
              {isLoading && (
                <div className="flex justify-start">
                  <span className="text-sm mr-1.5 shrink-0">🌸</span>
                  <div className="bg-muted rounded-2xl rounded-bl-sm px-4 py-3">
                    <div className="flex gap-1">
                      {[0, 150, 300].map((d) => (
                        <div
                          key={d}
                          className="w-1.5 h-1.5 bg-muted-foreground/50 rounded-full animate-bounce"
                          style={{ animationDelay: `${d}ms` }}
                        />
                      ))}
                    </div>
                  </div>
                </div>
              )}
              <div ref={bottomRef} />
            </div>

            <div className="border-t border-border p-3 shrink-0">
              <div className="flex gap-2 max-w-2xl mx-auto">
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
                  disabled={isLoading}
                  className="flex-1 border border-border rounded-xl px-3 py-2.5 text-sm text-foreground resize-none focus:outline-none focus:border-primary max-h-32 disabled:opacity-50 bg-background"
                />
                <button
                  onClick={handleSend}
                  disabled={!input.trim() || isLoading}
                  className="w-10 h-10 bg-primary hover:bg-primary/90 disabled:bg-muted text-primary-foreground rounded-xl flex items-center justify-center transition shrink-0 self-end"
                  aria-label="送信"
                >
                  <ArrowUp className="size-4" />
                </button>
              </div>
            </div>
          </>
        ) : (
          <div className="flex-1 flex flex-col items-center justify-center text-center px-4">
            <MessageCircle className="size-12 text-muted-foreground/40 mb-3" />
            <p className="text-sm text-muted-foreground">
              チャットを選ぶか、新規チャットを始めましょう
            </p>
          </div>
        )}
      </main>

      {/* メンター種類選択ダイアログ */}
      <AlertDialog open={showModeDialog} onOpenChange={setShowModeDialog}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>どのメンターと話しますか？</AlertDialogTitle>
            <AlertDialogDescription>
              相談したい内容に合わせて選んでください。
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter className="flex-col gap-2 sm:flex-col">
            {(['idea', 'dev', 'general'] as MentorMode[]).map((mode) => (
              <AlertDialogAction
                key={mode}
                onClick={() => handleCreateConv(mode)}
                className="w-full h-auto py-3.5 px-4 bg-card border border-border hover:border-primary hover:bg-accent/20 text-foreground rounded-xl text-left flex items-center gap-3"
              >
                <span className="text-lg">{MODE_LABELS[mode].icon}</span>
                <span className="font-medium text-sm">{MODE_LABELS[mode].label}</span>
              </AlertDialogAction>
            ))}
            <AlertDialogCancel className="w-full">キャンセル</AlertDialogCancel>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  )
}
