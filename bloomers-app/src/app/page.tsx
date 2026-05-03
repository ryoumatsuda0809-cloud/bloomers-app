import { redirect } from 'next/navigation'
import { createClient } from '@/lib/supabase/server'
import { mergeQuestsWithProgress } from '@/lib/quest-utils'
import { getOnboardingStatus, getSelectedIdea } from '@/app/actions/onboarding'
import QuestStoreInitializer from '@/components/dashboard/QuestStoreInitializer'
import QuestDashboard from '@/components/dashboard/QuestDashboard'

export default async function Home() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()

  if (!user) {
    redirect('/login')
  }

  const onboardingCompleted = await getOnboardingStatus()
  if (!onboardingCompleted) {
    redirect('/onboarding')
  }

  const { data: activeProject } = await supabase
    .from('project_ideas')
    .select('id')
    .eq('user_id', user.id)
    .eq('is_active', true)
    .single()

  const activeProjectId = activeProject?.id ?? ''

  const { data: rows } = await supabase
    .from('quest_progress')
    .select('quest_id, status')
    .eq('user_id', user.id)
    .eq('project_id', activeProjectId)

  const progressMap: Record<string, 'not_started' | 'in_progress' | 'completed'> =
    rows ? Object.fromEntries(rows.map((r) => [r.quest_id, r.status])) : {}

  const selectedIdea = await getSelectedIdea()
  const initialQuests = mergeQuestsWithProgress(progressMap, selectedIdea ?? undefined)

  return (
    <main className="min-h-screen bg-zinc-50">
      <QuestStoreInitializer quests={initialQuests} />
      <QuestDashboard activeProjectId={activeProjectId} />
    </main>
  )
}
