'use client'

import { useState, useEffect, useRef } from 'react'
import { getProjectIdeas, saveQuestNote } from '@/app/actions/projects'
import type { ProjectIdea } from '@/app/actions/projects'
import { addUserKnowledge, listUserKnowledge, deleteUserKnowledge } from '@/app/actions/user-knowledge'
import type { UserKnowledgeItem } from '@/app/actions/user-knowledge'
import AppShell from '@/components/layout/AppShell'
import { QUEST_CONFIG } from '@/lib/quest-utils'
import { Skeleton } from '@/components/ui/skeleton'
import { ChevronRight, NotebookPen, Paperclip, Trash2, Plus } from 'lucide-react'

const QUEST_ORDER = ['q1', 'q2', 'q3', 'q4', 'q5'] as const

function getOrderedNotes(notes: Record<string, string>): { questId: string; title: string; note: string }[] {
  return QUEST_ORDER
    .filter((qid) => notes?.[qid]?.trim())
    .map((qid) => ({
      questId: qid,
      title: QUEST_CONFIG[qid]?.title ?? qid,
      note: notes[qid],
    }))
}

const noteKey = (projectId: string, questId: string) => `${projectId}:${questId}`

export default function NotesPage() {
  const [projects, setProjects] = useState<ProjectIdea[]>([])
  const [isLoading, setIsLoading] = useState(true)
  const [expandedIds, setExpandedIds] = useState<Set<string>>(new Set())
  const [noteValues, setNoteValues] = useState<Record<string, string>>({})
  const [saveStatus, setSaveStatus] = useState<Record<string, 'idle' | 'saving' | 'saved'>>({})
  const timersRef = useRef<Record<string, ReturnType<typeof setTimeout>>>({})

  const [knowledgeItems, setKnowledgeItems] = useState<UserKnowledgeItem[]>([])
  const [uploadStatus, setUploadStatus] = useState<'idle' | 'uploading' | 'done' | 'error'>('idle')
  const [uploadMessage, setUploadMessage] = useState('')
  const fileInputRef = useRef<HTMLInputElement>(null)

  useEffect(() => {
    getProjectIdeas()
      .then((data) => {
        setProjects(data)
        const initial: Record<string, string> = {}
        data.forEach((p) => {
          Object.entries(p.questNotes ?? {}).forEach(([qid, text]) => {
            initial[noteKey(p.id, qid)] = text
          })
        })
        setNoteValues(initial)
      })
      .catch(() => setProjects([]))
      .finally(() => setIsLoading(false))

    listUserKnowledge().then(setKnowledgeItems).catch(() => {})
  }, [])

  const toggleExpand = (id: string) => {
    setExpandedIds((prev) => {
      const next = new Set(prev)
      if (next.has(id)) next.delete(id)
      else next.add(id)
      return next
    })
  }

  const handleNoteChange = (projectId: string, questId: string, value: string) => {
    const key = noteKey(projectId, questId)
    setNoteValues((prev) => ({ ...prev, [key]: value }))
    setSaveStatus((prev) => ({ ...prev, [key]: 'saving' }))

    if (timersRef.current[key]) clearTimeout(timersRef.current[key])
    timersRef.current[key] = setTimeout(async () => {
      const { error } = await saveQuestNote(projectId, questId, value)
      setSaveStatus((prev) => ({ ...prev, [key]: error ? 'idle' : 'saved' }))
      if (!error) {
        setTimeout(() => {
          setSaveStatus((prev) => ({ ...prev, [key]: 'idle' }))
        }, 2000)
      }
    }, 800)
  }

  const handleFileSelect = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]
    if (!file) return

    if (file.size > 10 * 1024 * 1024) {
      setUploadStatus('error')
      setUploadMessage('ファイルサイズが10MBを超えています。')
      return
    }

    const allowed = ['image/png', 'image/jpeg', 'application/pdf', 'text/plain', 'text/markdown']
    let mimeType = file.type
    if (file.name.endsWith('.md')) mimeType = 'text/markdown'
    if (file.name.endsWith('.txt')) mimeType = 'text/plain'
    if (!allowed.includes(mimeType)) {
      setUploadStatus('error')
      setUploadMessage('対応形式は png / jpg / pdf / txt / md です。')
      return
    }

    setUploadStatus('uploading')
    setUploadMessage('資料を読み込んでいます...')

    try {
      const base64 = await new Promise<string>((resolve, reject) => {
        const reader = new FileReader()
        reader.onload = () => {
          const result = reader.result as string
          resolve(result.split(',')[1] ?? '')
        }
        reader.onerror = () => reject(new Error('読み込み失敗'))
        reader.readAsDataURL(file)
      })

      const result = await addUserKnowledge(mimeType, base64, file.name)
      if (result.error) {
        setUploadStatus('error')
        setUploadMessage(result.error)
      } else {
        setUploadStatus('done')
        setUploadMessage(`資料を追加しました（${result.chunkCount}件のチャンク）`)
        const items = await listUserKnowledge()
        setKnowledgeItems(items)
        setTimeout(() => { setUploadStatus('idle'); setUploadMessage('') }, 3000)
      }
    } catch {
      setUploadStatus('error')
      setUploadMessage('資料の追加に失敗しました。')
    } finally {
      if (fileInputRef.current) fileInputRef.current.value = ''
    }
  }

  const handleDeleteKnowledge = async (source: string) => {
    const result = await deleteUserKnowledge(source)
    if (!result.error) {
      setKnowledgeItems((prev) => prev.filter((k) => k.source !== source))
    }
  }

  const activeProjects = projects.filter((p) => p.status === 'active')
  const pastProjects = projects.filter((p) => p.status === 'paused' || p.status === 'completed')
  const hasAnyNote = projects.some((p) => getOrderedNotes(p.questNotes).length > 0)

  if (isLoading) {
    return (
      <AppShell showRoadmap={false}>
        <div className="px-4 py-8">
          <div className="max-w-2xl mx-auto space-y-4">
            <Skeleton className="h-8 w-32" />
            <Skeleton className="h-40 w-full rounded-2xl" />
          </div>
        </div>
      </AppShell>
    )
  }

  return (
    <AppShell showRoadmap={false}>
      <div className="px-4 py-8">
        <div className="max-w-2xl mx-auto space-y-6">

          <div className="flex items-center gap-2">
            <NotebookPen className="size-6 text-foreground" />
            <h1 className="text-2xl font-bold text-foreground">メモ</h1>
          </div>

          {/* 資料管理セクション */}
          <div className="bg-card rounded-2xl border border-border p-5 space-y-3">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <Paperclip className="size-4 text-foreground" />
                <h2 className="text-sm font-semibold text-foreground">メンターに参照させる資料</h2>
              </div>
              <button
                onClick={() => fileInputRef.current?.click()}
                disabled={uploadStatus === 'uploading'}
                className="flex items-center gap-1 text-xs px-3 py-1.5 rounded-lg bg-primary text-primary-foreground hover:opacity-90 transition disabled:opacity-50"
              >
                <Plus className="size-3.5" />
                資料を追加
              </button>
              <input
                ref={fileInputRef}
                type="file"
                accept="image/png,image/jpeg,application/pdf,text/plain,text/markdown,.md,.txt"
                onChange={handleFileSelect}
                className="hidden"
              />
            </div>

            {uploadMessage && (
              <p className={`text-xs ${uploadStatus === 'error' ? 'text-destructive' : 'text-muted-foreground'}`}>
                {uploadMessage}
              </p>
            )}

            {knowledgeItems.length === 0 ? (
              <p className="text-xs text-muted-foreground">
                まだ資料がありません。PDF・画像・テキストを追加すると、メンターが回答時に参照します。
              </p>
            ) : (
              <div className="space-y-1.5">
                {knowledgeItems.map((item) => (
                  <div key={item.source} className="flex items-center justify-between bg-background rounded-lg px-3 py-2 border border-border">
                    <div className="min-w-0">
                      <p className="text-xs font-medium text-foreground truncate">{item.source}</p>
                      <p className="text-[11px] text-muted-foreground">
                        {new Date(item.createdAt).toLocaleDateString('ja-JP')}・{item.chunkCount}件
                      </p>
                    </div>
                    <button
                      onClick={() => handleDeleteKnowledge(item.source)}
                      className="shrink-0 ml-2 w-7 h-7 flex items-center justify-center rounded-md text-muted-foreground hover:bg-destructive/10 hover:text-destructive transition"
                      aria-label="削除"
                    >
                      <Trash2 className="size-3.5" />
                    </button>
                  </div>
                ))}
              </div>
            )}
          </div>

          {/* 空状態 */}
          {!hasAnyNote && (
            <div className="bg-card rounded-2xl border border-border p-8 text-center">
              <p className="text-sm text-muted-foreground leading-relaxed">
                まだメモがありません。<br />
                クエストを進めながら、気づいたことを書き残していきましょう。
              </p>
            </div>
          )}

          {/* 進行中（メイン大表示） */}
          {activeProjects.map((project) => {
            const notes = getOrderedNotes(project.questNotes)
            if (notes.length === 0) return null
            return (
              <div key={project.id} className="bg-card rounded-2xl border border-border p-5 space-y-4">
                <div className="flex items-center gap-2">
                  <span className="text-xs bg-primary/15 text-primary px-2 py-0.5 rounded-full font-medium">進行中</span>
                  <h2 className="text-lg font-bold text-foreground">{project.title}</h2>
                </div>
                <div className="space-y-3">
                  {notes.map((n) => {
                    const key = noteKey(project.id, n.questId)
                    const status = saveStatus[key] ?? 'idle'
                    return (
                      <div key={n.questId} className="border-l-2 border-primary/30 pl-3">
                        <div className="flex items-center justify-between mb-1">
                          <p className="text-sm font-medium text-foreground">{n.title}</p>
                          <span className="text-xs text-muted-foreground">
                            {status === 'saving' && '保存中...'}
                            {status === 'saved' && '保存しました'}
                          </span>
                        </div>
                        <textarea
                          value={noteValues[key] ?? n.note}
                          onChange={(e) => handleNoteChange(project.id, n.questId, e.target.value)}
                          rows={3}
                          className="w-full border border-border rounded-lg px-3 py-2 text-sm text-foreground resize-y focus:outline-none focus:border-primary bg-background"
                        />
                      </div>
                    )
                  })}
                </div>
              </div>
            )
          })}

          {/* 過去のプロジェクト（折りたたみ） */}
          {pastProjects.some((p) => getOrderedNotes(p.questNotes).length > 0) && (
            <div className="space-y-2">
              <p className="text-xs font-semibold text-muted-foreground px-1">過去のプロジェクト</p>
              {pastProjects.map((project) => {
                const notes = getOrderedNotes(project.questNotes)
                if (notes.length === 0) return null
                const expanded = expandedIds.has(project.id)
                return (
                  <div key={project.id} className="bg-card rounded-xl border border-border overflow-hidden">
                    <button
                      onClick={() => toggleExpand(project.id)}
                      className="w-full flex items-center gap-2 px-4 py-3 text-left hover:bg-muted transition"
                    >
                      <ChevronRight className={`size-4 text-muted-foreground transition-transform ${expanded ? 'rotate-90' : ''}`} />
                      <span className="text-sm font-medium text-foreground flex-1">{project.title}</span>
                      <span className="text-xs text-muted-foreground">
                        {project.status === 'completed' ? '完了' : '途中'}
                      </span>
                    </button>
                    {expanded && (
                      <div className="px-4 pb-4 pt-1 space-y-3 border-t border-border">
                        {notes.map((n) => {
                          const key = noteKey(project.id, n.questId)
                          const status = saveStatus[key] ?? 'idle'
                          return (
                            <div key={n.questId} className="border-l-2 border-border pl-3">
                              <div className="flex items-center justify-between mb-1">
                                <p className="text-sm font-medium text-foreground">{n.title}</p>
                                <span className="text-xs text-muted-foreground">
                                  {status === 'saving' && '保存中...'}
                                  {status === 'saved' && '保存しました'}
                                </span>
                              </div>
                              <textarea
                                value={noteValues[key] ?? n.note}
                                onChange={(e) => handleNoteChange(project.id, n.questId, e.target.value)}
                                rows={3}
                                className="w-full border border-border rounded-lg px-3 py-2 text-sm text-foreground resize-y focus:outline-none focus:border-primary bg-background"
                              />
                            </div>
                          )
                        })}
                      </div>
                    )}
                  </div>
                )
              })}
            </div>
          )}

        </div>
      </div>
    </AppShell>
  )
}
