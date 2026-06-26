# Bloomers プロジェクト記憶ファイル
最終更新: 2026-06-16

## 次にやること（最優先）
**Fade-in/out の実装**（設計確定済み・調査済み・即実装可能）

詳細:
- skill_level でヒントの「厚さ」を変える
- getMentorContext（mentor-panel.ts）の select に skill_level を追加
- MentorContext 型に skillLevel?: number を追加
- generateMentorSystemPrompt の questRole 末尾（【内部マーカー】の直前）に hintDepthBlock を追加
- 閾値: 低(〜0.4)=Fade-in（手厚く）/ 中(0.4〜0.7)=バランス / 高(0.7〜)=Fade-out（薄く）
- skill_level はクエストを開いた時だけ読む（会話中は固定・依存配列変更なし）
- BASE/FINAL は一切触らない（可変領域=questRole のみ）
- 3段階ヒント・メタ認知・知識切り分け・完成解禁止は全スコアで維持
- quest mode のみ（general/custom/idea には適用しない）
- 既存の recordSkillResult・マーカー記録は一切触らない

## 直近のコミット（新しい順）
- 3a84984: 習熟スコア記録対象をダッシュボード横メンターにも拡張＋診断ログ削除
- ce33464: 習熟スコア（EMA）＋自力解決ログ実装
- 9ba4f5e: CLAUDE.md のインジェクション形式除去＋デザイン方針記述化
- 5841748: /mentor の入力欄モダンUI化（ダッシュボードと統一）
- 8ede989: 横メンターの入力欄モダンUI化（自前ドロップダウン・角丸ハイライト）
- 6c00cc4: メンターの教育的な質の向上
- 130986e: 最後のメンター記憶・復元
- b70ad59: メンター切り替えセレクタUI
- 814af0e: 会話の mentor_type 分離（土台）
- 45a0133: メンター切り替えバグ修正

## DB状態（本番実行済み）
- profiles.skill_level NUMERIC DEFAULT 0.5
- skill_logs（id/user_id/project_id/quest_id/x/gave_bottom_out/created_at）
- project_ideas.last_mentor_type / last_custom_mentor_id
- chat_messages.mentor_type / custom_mentor_id

## マーカー方式（習熟スコア）
- %%%GAVE_ANSWER%%%: 完成解を渡した時
- %%%SOLVED%%%: 自力解決を示した時
- quest/general/custom のプロンプトに指示済み。idea は対象外
- EMA: m ← 0.3x + 0.7m（skill.ts の recordSkillResult）

## 主要ファイルパス
- src/app/actions/mentor-panel.ts ← Fade-in/out の実装先
- src/app/actions/skill.ts ← recordSkillResult（EMA更新・ログ記録）
- src/components/quest/MentorPanel.tsx ← マーカー検出・記録条件
- src/lib/mentor-base.ts ← BASE_SYSTEM_PROMPT・FINAL_PRIORITY（固定・触らない）
- CLAUDE.md ← プロジェクト憲法（デザイン方針含む）

## 温存事項（変更禁止）
- Supabase RPC match_knowledge_chunks（SECURITY DEFINER）
- %%%IDEA%%%/%%%PHASE_DONE%%%/%%%TOP5%%%/%%%SUGGEST%%% マーカー方式
- 🌸（ブランドアバター絵文字）
- activeQuest 変数（将来のメンターチャット機能のため温存）

## 残っている構想（優先度順）
1. Fade-in/out（次・設計確定済み）
2. ブランド色変更（CLAUDE.md に方針記述済み・--primary の適用がまだ）
3. お試しの昇格機能（試作→本採用）
4. 制限・サブスク（フリーミアム・最終ステージ）
5. github.ts のインビジブルGit根本再設計（保留の大物）
6. フェーズ2（SNSコミュニティ）

## 運用ルール
- npm run dev は1回だけ。再起動時は先に pkill -f "next dev"
- .next 破損時は rm -rf .next で解消
- bloomers-brain は別リポジトリ → git add . 禁止
- DBマイグレーションはSupabase本番SQL Editorで手動実行
