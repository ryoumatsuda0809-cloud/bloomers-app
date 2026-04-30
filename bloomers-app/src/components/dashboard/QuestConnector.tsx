'use client'

import { ChevronDown } from 'lucide-react'
import type { QuestStatus } from '@/store/useQuestStore'

interface QuestConnectorProps {
  fromStatus: QuestStatus
}

const CONNECTOR_CONFIG: Record<
  QuestStatus,
  { line: string; arrow: string; dashed: boolean }
> = {
  completed: {
    line: 'border-emerald-400',
    arrow: 'text-emerald-400',
    dashed: false,
  },
  active: {
    line: 'border-indigo-400',
    arrow: 'text-indigo-400',
    dashed: true,
  },
  unlocked: {
    line: 'border-violet-300',
    arrow: 'text-violet-300',
    dashed: true,
  },
  locked: {
    line: 'border-zinc-200',
    arrow: 'text-zinc-200',
    dashed: true,
  },
}

export default function QuestConnector({ fromStatus }: QuestConnectorProps) {
  const { line, arrow, dashed } = CONNECTOR_CONFIG[fromStatus]
  const isActive = fromStatus === 'active'

  return (
    <div className="flex flex-col items-center py-1">
      <div
        className={`w-0 h-6 border-l-2 ${line} ${dashed ? 'border-dashed' : ''} ${isActive ? 'animate-pulse' : ''}`}
      />
      <ChevronDown
        className={`size-4 -mt-1 ${arrow} ${isActive ? 'animate-pulse' : ''}`}
        strokeWidth={2.5}
      />
    </div>
  )
}
