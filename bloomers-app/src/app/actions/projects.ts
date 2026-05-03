'use server'

import { createClient } from '@/lib/supabase/server'
import type { PersonalityData, IdeaCard } from '@/app/actions/onboarding'

export type ProjectIdea = {
  id: string
  title: string
  description: string
  personalityData: PersonalityData
  ideaCard: IdeaCard
  isActive: boolean
  isPinned: boolean
  createdAt: string
}

export async function saveProjectIdea(
  personality: PersonalityData,
  ideaCard: IdeaCard
): Promise<{ success?: boolean; error?: string }> {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return { error: '認証エラーが発生しました。' }

  const { error } = await supabase
    .from('project_ideas')
    .insert({
      user_id: user.id,
      title: ideaCard.title,
      description: ideaCard.description,
      personality_data: personality,
      idea_card: ideaCard,
      is_active: false,
    })

  if (error) return { error: 'プロジェクトの保存に失敗しました。' }
  return { success: true }
}

export async function getProjectIdeas(): Promise<ProjectIdea[]> {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return []

  const { data } = await supabase
    .from('project_ideas')
    .select('*')
    .eq('user_id', user.id)
    .order('is_pinned', { ascending: false })
    .order('created_at', { ascending: false })

  return (data ?? []).map((row) => ({
    id: row.id,
    title: row.title,
    description: row.description,
    personalityData: row.personality_data,
    ideaCard: row.idea_card,
    isActive: row.is_active,
    isPinned: row.is_pinned ?? false,
    createdAt: row.created_at,
  }))
}

export async function setActiveProject(
  projectId: string
): Promise<{ success?: boolean; error?: string }> {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return { error: '認証エラーが発生しました。' }

  // 全部のis_activeをfalseに
  await supabase
    .from('project_ideas')
    .update({ is_active: false })
    .eq('user_id', user.id)

  // 選択したものだけtrueに
  const { error } = await supabase
    .from('project_ideas')
    .update({ is_active: true })
    .eq('id', projectId)
    .eq('user_id', user.id)

  if (error) return { error: 'プロジェクトの切り替えに失敗しました。' }

  // profilesのselected_ideaも更新
  const { data } = await supabase
    .from('project_ideas')
    .select('idea_card')
    .eq('id', projectId)
    .single()

  if (data?.idea_card) {
    await supabase
      .from('profiles')
      .update({ selected_idea: data.idea_card })
      .eq('id', user.id)
  }

  return { success: true }
}

export async function pinProjectIdea(
  projectId: string,
  isPinned: boolean
): Promise<{ success?: boolean; error?: string }> {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return { error: '認証エラーが発生しました。' }

  const { error } = await supabase
    .from('project_ideas')
    .update({ is_pinned: isPinned })
    .eq('id', projectId)
    .eq('user_id', user.id)

  if (error) return { error: 'ピン留めに失敗しました。' }
  return { success: true }
}

export async function deleteProjectIdea(
  projectId: string
): Promise<{ success?: boolean; error?: string }> {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return { error: '認証エラーが発生しました。' }

  const { error } = await supabase
    .from('project_ideas')
    .delete()
    .eq('id', projectId)
    .eq('user_id', user.id)

  if (error) return { error: '削除に失敗しました。' }
  return { success: true }
}
