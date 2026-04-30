'use server'

import { revalidatePath } from 'next/cache'
import { createClient } from '@/lib/supabase/server'

export async function updateQuestStatus(
  questId: string,
  status: 'not_started' | 'in_progress' | 'completed'
): Promise<{ error: string | null }> {
  const supabase = await createClient()

  const {
    data: { user },
    error: userError,
  } = await supabase.auth.getUser()

  if (userError || !user) {
    return { error: '認証セッションが見つかりません。ページを再読み込みしてください。' }
  }

  const now = new Date().toISOString()

  const { error } = await supabase.from('quest_progress').upsert(
    {
      user_id: user.id,
      quest_id: questId,
      status,
      ...(status === 'completed' ? { completed_at: now } : {}),
    },
    { onConflict: 'user_id,quest_id' }
  )

  if (error) return { error: error.message }

  revalidatePath('/', 'layout')
  return { error: null }
}
