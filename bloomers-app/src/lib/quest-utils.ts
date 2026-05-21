import type { Quest, QuestStatus } from '@/store/useQuestStore'
import type { IdeaCard } from '@/app/actions/onboarding'

export const QUEST_CONFIG = {
  q1: { columnName: 'setup_steps',  questNumber: null, title: '開発環境を整えよう' },
  q2: { columnName: 'quest2_steps', questNumber: 2,    title: '最初の画面を作ろう' },
  q3: { columnName: 'quest3_steps', questNumber: 3,    title: 'データを保存できるようにしよう' },
  q4: { columnName: 'quest4_steps', questNumber: 4,    title: 'ログインできるようにしよう' },
  q5: { columnName: 'quest5_steps', questNumber: 5,    title: '世界に公開しよう' },
} as const

export const STATIC_QUEST_DEFINITIONS = [
  { id: 'q1', title: '開発環境の構築',       description: 'Next.jsとSupabaseの接続', order: 1, dependsOn: [] },
  { id: 'q2', title: 'UIコンポーネント作成', description: '最初のボタンを作る',       order: 2, dependsOn: ['q1'] },
  { id: 'q3', title: 'データベース連携',     description: 'データを保存する',         order: 3, dependsOn: ['q2'] },
  { id: 'q4', title: '認証機能の実装',       description: 'ログイン画面を作る',       order: 4, dependsOn: ['q3'] },
  { id: 'q5', title: '本番公開',             description: 'Vercelへデプロイ',         order: 5, dependsOn: ['q4'] },
]

type DbQuestStatus = 'not_started' | 'in_progress' | 'completed'

/**
 * DBのquest_progressレコードとstatic定義を結合し、UIステータス付きのQuestを返す。
 * progressMapが空（新規ユーザー）の場合はorder最小の1件をactiveにし残りをlockedにする。
 * selectedIdeaが渡された場合、各クエストのtitle/descriptionをアイデア固有の内容で上書きする。
 */
export function mergeQuestsWithProgress(
  progressMap: Record<string, DbQuestStatus>,
  selectedIdea?: IdeaCard
): Quest[] {
  const definitions = selectedIdea
    ? STATIC_QUEST_DEFINITIONS.map((def, index) => ({
        ...def,
        title: selectedIdea?.questTitles?.[index] ?? def.title,
        description: selectedIdea?.questDescriptions?.[index] ?? def.description,
      }))
    : STATIC_QUEST_DEFINITIONS

  const completedIds = new Set(
    definitions
      .filter((q) => (progressMap[q.id] ?? 'not_started') === 'completed')
      .map((q) => q.id)
  )

  let nextActiveAssigned = false

  return [...definitions]
    .sort((a, b) => a.order - b.order)
    .map((def) => {
      const dbStatus = progressMap[def.id] ?? 'not_started'

      if (dbStatus === 'completed') {
        return { ...def, status: 'completed' as QuestStatus }
      }
      if (dbStatus === 'in_progress') {
        return { ...def, status: 'active' as QuestStatus }
      }

      const isUnlocked = def.dependsOn.every((depId) => completedIds.has(depId))
      if (!isUnlocked) return { ...def, status: 'locked' as QuestStatus }

      if (!nextActiveAssigned) {
        nextActiveAssigned = true
        return { ...def, status: 'active' as QuestStatus }
      }
      return { ...def, status: 'unlocked' as QuestStatus }
    })
}
