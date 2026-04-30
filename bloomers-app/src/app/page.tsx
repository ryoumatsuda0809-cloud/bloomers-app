import { createClient } from '@/lib/supabase/server'
import { mergeQuestsWithProgress } from '@/lib/quest-utils'
import QuestStoreInitializer from '@/components/dashboard/QuestStoreInitializer'
import QuestDashboard from '@/components/dashboard/QuestDashboard'

export default async function Home() {
  const supabase = await createClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()

  let progressMap: Record<string, 'not_started' | 'in_progress' | 'completed'> = {}

  if (user) {
    const { data: rows } = await supabase
      .from('quest_progress')
      .select('quest_id, status')
      .eq('user_id', user.id)

    if (rows) {
      progressMap = Object.fromEntries(rows.map((r) => [r.quest_id, r.status]))
    }
  }

  const initialQuests = mergeQuestsWithProgress(progressMap)

  return (
    <main className="min-h-screen bg-zinc-50">
      <QuestStoreInitializer quests={initialQuests} />
      <QuestDashboard />
    </main>
  )
}
