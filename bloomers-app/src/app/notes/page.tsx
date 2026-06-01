'use client'

import { useState, useEffect, useRef } from 'react'
import { getProjectIdeas, saveQuestNote } from '@/app/actions/projects'
import type { ProjectIdea } from '@/app/actions/projects'
import AppShell from '@/components/layout/AppShell'
import { QUEST_CONFIG } from '@/lib/quest-utils'
import { Skeleton } from '@/components/ui/skeleton'
import { ChevronRight, NotebookPen } from 'lucide-react'

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
