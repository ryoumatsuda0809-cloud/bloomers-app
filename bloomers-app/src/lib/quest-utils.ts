import type { Quest, QuestStatus } from '@/store/useQuestStore'

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
 */
export function mergeQuestsWithProgress(
  progressMap: Record<string, DbQuestStatus>
): Quest[] {
  const completedIds = new Set(
    STATIC_QUEST_DEFINITIONS
      .filter((q) => (progressMap[q.id] ?? 'not_started') === 'completed')
      .map((q) => q.id)
  )

  let nextActiveAssigned = false

  return [...STATIC_QUEST_DEFINITIONS]
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
