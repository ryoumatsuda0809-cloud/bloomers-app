import { create } from 'zustand';
import { persist } from 'zustand/middleware';

export type QuestStatus = "locked" | "unlocked" | "active" | "completed";

export interface Quest {
  id: string;
  title: string;
  description: string;
  order: number;
  status: QuestStatus;
  dependsOn: string[];
}

interface QuestState {
  quests: Quest[];
  completeQuest: (id: string) => void;
  getActiveQuest: () => Quest | undefined;
}

// ダッシュボードの進捗ツリーに合わせたダミーデータ
const INITIAL_QUESTS: Quest[] = [
  { id: 'q1', title: '開発環境の構築', description: 'Next.jsとSupabaseの接続', order: 1, status: 'completed', dependsOn: [] },
  { id: 'q2', title: 'UIコンポーネント作成', description: '最初のボタンを作る', order: 2, status: 'active', dependsOn: ['q1'] },
  { id: 'q3', title: 'データベース連携', description: 'データを保存する', order: 3, status: 'locked', dependsOn: ['q2'] },
  { id: 'q4', title: '認証機能の実装', description: 'ログイン画面を作る', order: 4, status: 'locked', dependsOn: ['q3'] },
  { id: 'q5', title: '本番公開', description: 'Vercelへデプロイ', order: 5, status: 'locked', dependsOn: ['q4'] },
];

export const useQuestStore = create<QuestState>()(
  persist(
    (set, get) => ({
      quests: INITIAL_QUESTS,
      completeQuest: (id: string) => {
        set((state: QuestState) => {
          // 1. 対象のクエストを完了状態にする
          const updatedQuests = state.quests.map((q: Quest) => 
            q.id === id ? { ...q, status: 'completed' as QuestStatus } : q
          );

          // 2. 完了済みクエストのIDリストを取得
          const completedIds = updatedQuests.filter((q: Quest) => q.status === 'completed').map((q: Quest) => q.id);

          // 3. 依存関係を再評価し、「次の一手」を1つだけ選出する
          let nextActiveAssigned = false;
          
          // order順にソートしてから評価することで、順序を保証する
          const sortedQuests = [...updatedQuests].sort((a, b) => a.order - b.order);
          const finalQuests = sortedQuests.map((q: Quest) => {
            if (q.status === 'completed') return q;
            
            // 依存するクエストがすべて完了しているか判定
            const isUnlocked = q.dependsOn.every((depId: string) => completedIds.includes(depId));
            
            if (isUnlocked) {
              // まだ次のアクティブなタスクが決定していなければ、これをactiveにする
              if (!nextActiveAssigned) {
                nextActiveAssigned = true;
                return { ...q, status: 'active' as QuestStatus };
              }
              // 既にactiveが存在すれば、解放済み（unlocked）として待機させる
              return { ...q, status: 'unlocked' as QuestStatus };
            }
            return { ...q, status: 'locked' as QuestStatus };
          });

          return { quests: finalQuests };
        });
      },
      getActiveQuest: () => {
        return get().quests.find((q: Quest) => q.status === 'active');
      }
    }),
    {
      name: 'bloomers-quest-storage', // localStorageのキー名
    }
  )
);
