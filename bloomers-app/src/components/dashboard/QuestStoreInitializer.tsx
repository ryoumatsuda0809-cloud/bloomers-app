'use client'

import { useEffect, useRef } from 'react'
import { useQuestStore } from '@/store/useQuestStore'
import type { Quest } from '@/store/useQuestStore'

interface Props {
  quests: Quest[]
}

export default function QuestStoreInitializer({ quests }: Props) {
  const initialized = useRef(false)

  // First render: synchronous initialization to avoid empty-quests flash
  if (!initialized.current) {
    useQuestStore.setState({ quests })
    initialized.current = true
  }

  // Subsequent renders (after router.refresh()): re-sync with server-confirmed state
  useEffect(() => {
    useQuestStore.setState({ quests })
  }, [quests])

  return null
}
