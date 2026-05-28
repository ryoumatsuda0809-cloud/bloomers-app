'use client'

import { useState, useEffect, useRef } from 'react'
import { ArrowUp, LifeBuoy, MessageCircle } from 'lucide-react'
import {
  Sheet,
  SheetContent,
  SheetTitle,
  SheetTrigger,
} from '@/components/ui/sheet'
import {
  getMentorContext,
  generateMentorSystemPrompt,
  generateIdeaMentorSystemPrompt,
  sendMentorMessage,
  generateStuckOptions,
} from '@/app/actions/mentor-panel'

type Message = {
  role: 'user' | 'assistant'
  content: string
  options?: string[]
}

interface MentorPanelProps {
  questId: string
  questTitle: string
  stepTitle?: string
  projectId: string
  mode?: 'idea' | 'quest'
  initialOpen?: boolean
}

const FALLBACK_SYSTEM_PROMPT = `あなたはBloomerのメンターです。
ユーザーが詰まっている時に、技術用語を使わず友達のような口調で助けてください。
1回の返答は3文以内。答えから直接書き始めてください。`

const FALLBACK_IDEA_SYSTEM_PROMPT = `あなたはBloomerのアイデアメンターです。
ユーザーが作りたいアプリのアイデアを一緒に育てます。
技術用語を使わず友達のような口調で話してください。
1回の返答は3文以内。答えから直接書き始めてください。`

export default function MentorPanel({
  questId,
  questTitle,
  stepTitle,
  projectId,
  mode = 'quest',
  initialOpen = false,
}: MentorPanelProps) {
  const [messages, setMessages] = useState<Message[]>([])
  const [input, setInput] = useState('')
  const [isLoading, setIsLoading] = useState(false)
  const [systemPrompt, setSystemPrompt] = useState('')
  const [isGeneratingOptions, setIsGeneratingOptions] = useState(false)
  const bottomRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    const cacheKey = `bloomer_mentor_${questId}_${projectId}_${mode}`

    const init = async () => {
      const cached = localStorage.getItem(cacheKey)
      if (cached) { setSystemPrompt(cached); return }

      if (mode === 'idea') {
        const { prompt, error } = await generateIdeaMentorSystemPrompt(questTitle)
        if (prompt && !error) {
          localStorage.setItem(cacheKey, prompt)
          setSystemPrompt(prompt)
        } else {
          setSystemPrompt(FALLBACK_IDEA_SYSTEM_PROMPT)
        }
      } else {
        const context = await getMentorContext(projectId, questTitle, stepTitle ?? '')
        const { prompt, error } = await generateMentorSystemPrompt(questTitle, context)
        if (prompt && !error) {
          localStorage.setItem(cacheKey, prompt)
          setSystemPrompt(prompt)
        } else {
          setSystemPrompt(FALLBACK_SYSTEM_PROMPT)
        }
      }
    }

    init()
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [questId, projectId, mode])

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: 'smooth' })
  }, [messages])

  const handleStuck = async () => {
    if (isLoading || isGeneratingOptions) return
    setIsGeneratingOptions(true)

    setMessages((prev) => [
      ...prev,
      { role: 'assistant', content: 'ここで詰まってますか？どのあたりが難しいか教えてください。' },
    ])

    const { options } = await generateStuckOptions(stepTitle ?? '', questTitle)
    if (options) {
      setMessages((prev) => {
        const updated = [...prev]
        updated[updated.length - 1] = { ...updated[updated.length - 1], options }
        return updated
      })
    }
    setIsGeneratingOptions(false)
  }

  const handleSend = async (messageText?: string) => {
    const text = (messageText ?? input).trim()
    if (!text || isLoading) return

    setInput('')
    setIsLoading(true)
    setMessages((prev) => [...prev, { role: 'user', content: text }])

    const prompt = systemPrompt || FALLBACK_SYSTEM_PROMPT
    const history = messages.map((m) => ({ role: m.role, content: m.content }))

    const { reply, error } = await sendMentorMessage(text, history, prompt)

    setMessages((prev) => [
      ...prev,
      {
        role: 'assistant',
        content: error || !reply
          ? 'メンターに接続できませんでした。もう一度試してみてください。'
          : reply,
      },
    ])
    setIsLoading(false)
  }

  const ChatMessages = () => (
    <div className="flex-1 overflow-y-auto p-3 space-y-3 min-h-0">
      {messages.length === 0 && (
        <div className="text-center py-8">
          <p className="text-xs text-muted-foreground leading-relaxed">
            詰まったことがあれば<br />何でも聞いてください
          </p>
        </div>
      )}

      {messages.map((m, i) => (
        <div key={i} className={`flex ${m.role === 'user' ? 'justify-end' : 'justify-start'}`}>
          {m.role === 'assistant' && (
            <span className="text-sm mr-1.5 mt-0.5 shrink-0">🌸</span>
          )}
          <div className="space-y-2 max-w-[85%]">
            <div className={`rounded-2xl px-3 py-2 text-xs leading-relaxed whitespace-pre-wrap ${
              m.role === 'user'
                ? 'bg-primary text-primary-foreground rounded-br-sm'
                : 'bg-muted text-foreground rounded-bl-sm'
            }`}>
              {m.content}
            </div>

            {m.options && (
              <div className="space-y-1.5">
                {m.options.map((opt, j) => (
                  <button
                    key={j}
                    onClick={() => handleSend(opt)}
                    disabled={isLoading}
                    className="w-full text-left text-xs px-3 py-2 rounded-xl border border-border bg-card hover:border-primary hover:bg-accent/20 transition text-foreground"
                  >
                    {opt}
                  </button>
                ))}
              </div>
            )}
          </div>
        </div>
      ))}

      {(isLoading || isGeneratingOptions) && (
        <div className="flex justify-start">
          <span className="text-sm mr-1.5 shrink-0">🌸</span>
          <div className="bg-muted rounded-2xl rounded-bl-sm px-3 py-2">
            <div className="flex gap-1">
              {[0, 150, 300].map((delay) => (
                <div
                  key={delay}
                  className="w-1.5 h-1.5 bg-muted-foreground/50 rounded-full animate-bounce"
                  style={{ animationDelay: `${delay}ms` }}
                />
              ))}
            </div>
          </div>
        </div>
      )}

      <div ref={bottomRef} />
    </div>
  )

  const InputArea = () => (
    <div className="border-t border-border p-3 shrink-0">
      <div className="flex gap-2">
        <button
          onClick={handleStuck}
          disabled={isLoading || isGeneratingOptions}
          title="詰まったら押す"
          className="w-8 h-8 flex items-center justify-center shrink-0 rounded-xl border border-border text-muted-foreground hover:bg-accent/20 hover:text-primary transition disabled:opacity-50"
        >
          <LifeBuoy className="size-4" />
        </button>

        <textarea
          value={input}
          onChange={(e) => setInput(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === 'Enter' && !e.shiftKey) {
              e.preventDefault()
              handleSend()
            }
          }}
          placeholder="何でも聞いてください..."
          rows={1}
          disabled={isLoading}
          className="flex-1 border border-border rounded-xl px-3 py-2 text-xs text-foreground resize-none focus:outline-none focus:border-primary max-h-24 disabled:opacity-50 bg-background"
        />

        <button
          onClick={() => handleSend()}
          disabled={!input.trim() || isLoading}
          className="w-8 h-8 bg-primary hover:bg-primary/90 disabled:bg-muted text-primary-foreground rounded-xl flex items-center justify-center transition shrink-0 self-end"
          aria-label="送信"
        >
          <ArrowUp className="size-3" />
        </button>
      </div>
    </div>
  )

  return (
    <>
      {/* デスクトップ（xl以上）：右カラム常駐 */}
      <aside className="hidden xl:flex flex-col w-80 shrink-0 border-l border-border bg-card sticky top-0 h-screen">
        <div className="px-4 py-3 border-b border-border shrink-0">
          <div className="flex items-center gap-2">
            <span className="text-base">🌸</span>
            <div className="min-w-0">
              <p className="text-xs font-semibold text-foreground">メンター</p>
              <p className="text-xs text-muted-foreground truncate">{questTitle}</p>
            </div>
          </div>
        </div>
        <ChatMessages />
        <InputArea />
      </aside>

      {/* モバイル・タブレット（xl未満）：Shadcn Sheet */}
      <div className="xl:hidden fixed bottom-4 right-4 z-50">
        <Sheet defaultOpen={initialOpen}>
          <SheetTrigger asChild>
            <button
              className="bg-primary text-primary-foreground p-3.5 rounded-full shadow-lg hover:bg-primary/90 transition"
              aria-label="メンターに相談する"
            >
              <MessageCircle className="size-5" />
            </button>
          </SheetTrigger>
          <SheetContent side="bottom" className="h-[80vh] p-0 flex flex-col rounded-t-2xl">
            <SheetTitle className="sr-only">メンターチャット</SheetTitle>
            <div className="px-4 py-3 border-b border-border shrink-0">
              <div className="flex items-center gap-2">
                <span className="text-base">🌸</span>
                <div>
                  <p className="text-xs font-semibold text-foreground">メンター</p>
                  <p className="text-xs text-muted-foreground">{questTitle}</p>
                </div>
              </div>
            </div>
            <div className="flex flex-col flex-1 min-h-0">
              <ChatMessages />
              <InputArea />
            </div>
          </SheetContent>
        </Sheet>
      </div>
    </>
  )
}
