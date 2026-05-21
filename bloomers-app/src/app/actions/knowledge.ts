'use server'

import { createClient } from '@/lib/supabase/server'

export type KnowledgeChunk = {
  id: string
  trigger: string
  fact: string
  insight: string
  quest_seed: string
  similarity: number
}

export async function searchKnowledge(query: string): Promise<KnowledgeChunk[]> {
  const apiKey = process.env.GEMINI_API_KEY
  if (!apiKey) return []

  try {
    // 1. クエリをベクトル化
    const embedResponse = await fetch(
      `https://generativelanguage.googleapis.com/v1beta/models/gemini-embedding-2:embedContent?key=${apiKey}`,
      {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          model: 'models/gemini-embedding-2',
          content: { parts: [{ text: query }] },
          outputDimensionality: 768,
        }),
      }
    )

    const embedText = await embedResponse.text()
    console.log('[Knowledge] Embedding APIステータス:', embedResponse.status)
    if (!embedResponse.ok) {
      console.error('Gemini Embedding APIエラー:', embedResponse.status, embedText)
      return []
    }

    const embedData = JSON.parse(embedText)
    const embedding = embedData.embedding?.values as number[] | undefined
    console.log('[Knowledge] embedding取得:', embedding ? `${embedding.length}次元` : 'null')
    if (!embedding) return []

    // 2. Supabase に直接SQLで問い合わせ
    const supabase = await createClient()
    const vectorString = `[${embedding.join(',')}]`

    const { data, error } = await supabase.rpc('match_knowledge_chunks', {
      query_embedding: vectorString,
      match_count: 3,
      match_threshold: 0.0,
    })

    console.log('[Knowledge] RPCエラー:', error)
    console.log('[Knowledge] RPCデータ件数:', Array.isArray(data) ? data.length : data)

    if (error) {
      console.error('match_knowledge_chunks RPCエラー:', error)
      return []
    }

    const results = (data ?? []) as KnowledgeChunk[]
    console.log('[Knowledge] 検索結果:', results.length, '件', results.map((r: KnowledgeChunk) => r.trigger))
    return results

  } catch (err) {
    console.error('searchKnowledgeエラー:', err)
    return []
  }
}
