import { create } from 'zustand'

export type QuestStatus = 'locked' | 'unlocked' | 'active' | 'completed'

export interface Quest {
  id: string
  title: string
  description: string
  order: number
  status: QuestStatus
  dependsOn: string[]
}

interface QuestState {
  quests: Quest[]
  setQuests: (quests: Quest[]) => void
  completeQuest: (id: string) => void
  getActiveQuest: () => Quest | undefined
  resetStore: () => void
}

export const useQuestStore = create<QuestState>()((set, get) => ({
  quests: [],

  setQuests: (quests) => set({ quests }),

  completeQuest: (id: string) => {
    set((state) => {
      const updatedQuests = state.quests.map((q) =>
        q.id === id ? { ...q, status: 'completed' as QuestStatus } : q
      )
      const completedIds = updatedQuests
        .filter((q) => q.status === 'completed')
        .map((q) => q.id)

      let nextActiveAssigned = false
      const finalQuests = [...updatedQuests]
        .sort((a, b) => a.order - b.order)
        .map((q) => {
          if (q.status === 'completed') return q
          const isUnlocked = q.dependsOn.every((depId) => completedIds.includes(depId))
          if (!isUnlocked) return { ...q, status: 'locked' as QuestStatus }
          if (!nextActiveAssigned) {
            nextActiveAssigned = true
            return { ...q, status: 'active' as QuestStatus }
          }
          return { ...q, status: 'unlocked' as QuestStatus }
        })

      return { quests: finalQuests }
    })
  },

  getActiveQuest: () => get().quests.find((q) => q.status === 'active'),

  resetStore: () => set({ quests: [] }),
}))
