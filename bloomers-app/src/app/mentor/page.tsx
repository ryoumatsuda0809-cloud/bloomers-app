'use client'

import { useState, useEffect, useRef } from 'react'
import { useRouter } from 'next/navigation'
import { ArrowUp, Plus, MessageCircle, ArrowLeft, MoreHorizontal, Pencil, Pin, Trash2 } from 'lucide-react'
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
  renameConversation,
  pinConversation,
  deleteConversation,
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
  const router = useRouter()
  const [conversations, setConversations] = useState<Conversation[]>([])
  const [activeConvId, setActiveConvId] = useState<string | null>(null)
  const [activeMode, setActiveMode] = useState<MentorMode>('general')
  const [messages, setMessages] = useState<UIMessage[]>([])
  const [input, setInput] = useState('')
  const [isLoading, setIsLoading] = useState(false)
  const [showModeDialog, setShowModeDialog] = useState(false)
  const [isFirstMessage, setIsFirstMessage] = useState(false)
  const [menuOpenId, setMenuOpenId] = useState<string | null>(null)
  const [editingId, setEditingId] = useState<string | null>(null)
  const [editingTitle, setEditingTitle] = useState('')
  const [deleteTarget, setDeleteTarget] = useState<Conversation | null>(null)
  const bottomRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    getConversations().then(setConversations).catch(() => {})
  }, [])

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: 'smooth' })
  }, [messages])

  // ⋯メニュー外クリックで閉じる
  useEffect(() => {
    if (!menuOpenId) return
    const close = () => setMenuOpenId(null)
    window.addEventListener('click', close)
    return () => window.removeEventListener('click', close)
  }, [menuOpenId])

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

  const openMenu = (e: React.MouseEvent, convId: string) => {
    e.preventDefault()
    e.stopPropagation()
    setMenuOpenId((prev) => (prev === convId ? null : convId))
  }

  const startRename = (conv: Conversation) => {
    setMenuOpenId(null)
    setEditingId(conv.id)
    setEditingTitle(conv.title)
  }

  const commitRename = async (convId: string) => {
    const newTitle = editingTitle.trim()
    setEditingId(null)
    if (!newTitle) return
    setConversations((prev) =>
      prev.map((c) => (c.id === convId ? { ...c, title: newTitle } : c))
    )
    const { error } = await renameConversation(convId, newTitle)
    if (error) {
      getConversations().then(setConversations).catch(() => {})
    }
  }

  const handlePin = async (conv: Conversation) => {
    setMenuOpenId(null)
    const next = !conv.isPinned
    setConversations((prev) => {
      const updated = prev.map((c) => (c.id === conv.id ? { ...c, isPinned: next } : c))
      return [...updated].sort((a, b) => {
        if (a.isPinned !== b.isPinned) return a.isPinned ? -1 : 1
        return new Date(b.updatedAt).getTime() - new Date(a.updatedAt).getTime()
      })
    })
    const { error } = await pinConversation(conv.id, next)
    if (error) {
      getConversations().then(setConversations).catch(() => {})
    }
  }

  const handleDelete = async () => {
    if (!deleteTarget) return
    const target = deleteTarget
    setDeleteTarget(null)
    const { error } = await deleteConversation(target.id)
    if (error) return
    setConversations((prev) => prev.filter((c) => c.id !== target.id))
    if (activeConvId === target.id) {
      setActiveConvId(null)
      setMessages([])
    }
  }

  return (
    <div className="min-h-screen bg-background flex">
      {/* 左：チャット一覧 */}
      <aside className="w-64 shrink-0 border-r border-border bg-card flex flex-col h-screen">
        <div className="p-3 border-b border-border space-y-2">
          <button
            onClick={() => router.push('/')}
            className="w-full flex items-center gap-2 text-sm text-muted-foreground hover:text-foreground transition px-1 py-1"
          >
            <ArrowLeft className="size-4" />
            ダッシュボード
          </button>
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
            <div
              key={conv.id}
              role="button"
              tabIndex={0}
              onClick={() => { if (editingId !== conv.id) handleSelectConv(conv) }}
              onKeyDown={(e) => { if (e.key === 'Enter' && editingId !== conv.id) handleSelectConv(conv) }}
              onContextMenu={(e) => openMenu(e, conv.id)}
              className={`group relative w-full rounded-lg transition cursor-pointer ${
                activeConvId === conv.id ? 'bg-accent/30' : 'hover:bg-muted'
              }`}
            >
              <div className="px-3 py-2.5 pr-8">
                <div className="flex items-center gap-1.5">
                  {conv.isPinned && <Pin className="size-3 text-primary shrink-0 fill-primary" />}
                  <span className="text-xs shrink-0">{MODE_LABELS[conv.mentorMode].icon}</span>

                  {editingId === conv.id ? (
                    <input
                      autoFocus
                      value={editingTitle}
                      onChange={(e) => setEditingTitle(e.target.value)}
                      onClick={(e) => e.stopPropagation()}
                      onBlur={() => commitRename(conv.id)}
                      onKeyDown={(e) => {
                        if (e.key === 'Enter') { e.preventDefault(); commitRename(conv.id) }
                        if (e.key === 'Escape') setEditingId(null)
                      }}
                      className="flex-1 min-w-0 bg-background border border-primary rounded px-1.5 py-0.5 text-sm text-foreground focus:outline-none"
                    />
                  ) : (
                    <span className="text-sm text-foreground truncate">{conv.title}</span>
                  )}
                </div>
                {editingId !== conv.id && (
                  <p className="text-xs text-muted-foreground mt-0.5 ml-5">
                    {MODE_LABELS[conv.mentorMode].label}
                  </p>
                )}
              </div>

              {/* ⋯ボタン（ホバーで表示） */}
              {editingId !== conv.id && (
                <button
                  onClick={(e) => openMenu(e, conv.id)}
                  className="absolute top-2 right-1.5 w-6 h-6 flex items-center justify-center rounded-md text-muted-foreground opacity-0 group-hover:opacity-100 hover:bg-muted-foreground/10 transition"
                  aria-label="メニュー"
                >
                  <MoreHorizontal className="size-4" />
                </button>
              )}

              {/* ポップオーバーメニュー */}
              {menuOpenId === conv.id && (
                <div
                  className="absolute top-9 right-1.5 z-50 w-40 bg-card border border-border rounded-xl shadow-lg py-1"
                  onClick={(e) => e.stopPropagation()}
                >
                  <button
                    onClick={() => startRename(conv)}
                    className="w-full flex items-center gap-2 px-3 py-2 text-sm text-foreground hover:bg-muted transition text-left"
                  >
                    <Pencil className="size-3.5" />
                    名前を変更
                  </button>
                  <button
                    onClick={() => handlePin(conv)}
                    className="w-full flex items-center gap-2 px-3 py-2 text-sm text-foreground hover:bg-muted transition text-left"
                  >
                    <Pin className="size-3.5" />
                    {conv.isPinned ? 'ピン留めを外す' : 'ピン留め'}
                  </button>
                  <button
                    onClick={() => { setMenuOpenId(null); setDeleteTarget(conv) }}
                    className="w-full flex items-center gap-2 px-3 py-2 text-sm text-destructive hover:bg-destructive/10 transition text-left"
                  >
                    <Trash2 className="size-3.5" />
                    削除
                  </button>
                </div>
              )}
            </div>
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

      {/* 削除確認ダイアログ */}
      <AlertDialog
        open={deleteTarget !== null}
        onOpenChange={(open) => { if (!open) setDeleteTarget(null) }}
      >
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>このチャットを削除しますか？</AlertDialogTitle>
            <AlertDialogDescription>
              「{deleteTarget?.title}」と、その会話履歴がすべて削除されます。この操作は取り消せません。
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter className="flex-col gap-2 sm:flex-col">
            <AlertDialogAction
              onClick={handleDelete}
              className="w-full bg-destructive/10 text-destructive hover:bg-destructive/20"
            >
              削除する
            </AlertDialogAction>
            <AlertDialogCancel className="w-full">キャンセル</AlertDialogCancel>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  )
}
