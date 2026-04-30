# COMPLETED — 実装完了ログ

> 過去の実装内容・設計決定の記録。重複実装を防ぐために毎回参照すること。

---

## Phase 1: クエストダッシュボード UI

### ✅ QuestCard コンポーネント（4状態）
- **日付**: Phase 1
- **ファイル**: `src/components/dashboard/QuestCard.tsx`
- **内容**: `locked` / `unlocked` / `active` / `completed` の4状態に応じた視覚スタイル（グラデーションバー・バッジ・アイコン・ボタン）を実装。`useState(isSubmitting)` による連打防止を内包。

### ✅ QuestConnector コンポーネント
- **ファイル**: `src/components/dashboard/QuestConnector.tsx`
- **内容**: クエスト間を繋ぐ矢印コネクター。`active` 状態でパルスアニメーション。

### ✅ QuestDashboard — 全体レイアウト・進捗バー
- **ファイル**: `src/components/dashboard/QuestDashboard.tsx`
- **内容**: ヘッダー・全体進捗バー（完了数 / 総数 %）・クエストツリー・メンターウィンドウ（静的）・全完了バナーを統合。

### ✅ Zustand ストア（依存チェーン解決ロジック付き）
- **ファイル**: `src/store/useQuestStore.ts`
- **内容**: `Quest[]` を管理。`completeQuest()` 実行時に `dependsOn` を評価し、次クエストを自動アンロック。`getActiveQuest()` で現在アクティブなクエストを取得。

---

## Phase 2: Supabase 連携

### ✅ Supabase クライアント（サーバー / ブラウザ）
- **ファイル**: `src/lib/supabase/server.ts`, `src/lib/supabase/client.ts`
- **内容**: Cookie ベースの SSR 対応セッション管理。`@supabase/ssr` を使用。

### ✅ クエスト進捗の DB 保存（Server Action）
- **ファイル**: `src/app/actions/quest.ts`
- **内容**: `updateQuestStatus()` が `quest_progress` テーブルへ upsert。`user_id` / `quest_id` の複合ユニーク制約に対応。認証チェック・エラーハンドリング込み。

### ✅ 楽観的更新 + ロールバック
- **ファイル**: `src/components/dashboard/QuestDashboard.tsx`
- **内容**: `completeQuest(id)`（Zustand・即時反映）→ `updateQuestStatus()`（Supabase）→ 失敗時スナップショット復元 → `router.refresh()` でサーバー状態と再同期。

### ✅ Server Component でのDB読み込み + Zustand 初期化
- **ファイル**: `src/app/page.tsx`, `src/lib/quest-utils.ts`, `src/components/dashboard/QuestStoreInitializer.tsx`
- **内容**: `page.tsx`（Server Component）が Supabase から `quest_progress` を取得し、Static定義とマージした `Quest[]` を `QuestStoreInitializer` 経由でZustandに注入。`router.refresh()` 後の再同期にも対応。

---

## Phase 3: 認証（Auth）

### ✅ ログイン UI
- **ファイル**: `src/app/login/page.tsx`
- **内容**: メール/パスワードフォーム（`react-hook-form` + `zod` バリデーション）。ログイン/新規登録モード切り替え。サーバーエラーの日本語表示。Google OAuth ボタン（`disabled`、準備中）。

### ✅ Auth Server Actions（signUp / signIn）
- **ファイル**: `src/app/actions/auth.ts`
- **内容**: `signUp()` / `signIn()` を実装。Supabase 英語エラーを日本語に変換するマッピング関数を内包。

### ✅ middleware.ts — セッション管理 + ルート保護
- **日付**: 2026-04-28
- **ファイル**: `src/middleware.ts`
- **内容**:
  - `getUser()`（サーバー側 JWT 検証）でセッション状態を確認
  - 未認証ユーザーが `/` にアクセス → `/login` へリダイレクト
  - 認証済みユーザーが `/login` にアクセス → `/` へリダイレクト
  - リダイレクト時に `supabaseResponse` の Cookie をコピーしセッション整合性を維持
  - **設計根拠**: `getSession()` はCookie読み取りのみ（サーバー検証なし）のため、保護ルートには `getUser()` を使用。

### ✅ AuthProvider（匿名ログイン）の除去
- **日付**: 2026-04-28
- **ファイル**: `src/components/providers/AuthProvider.tsx`（削除済）、`src/app/layout.tsx`（修正済）
- **内容**: プロトタイプ時代の `signInAnonymously()` が正式認証フローと競合し `/login` をフリーズさせていた問題を解消。`AuthProvider` ファイルを完全削除し `layout.tsx` から参照を除去。

### ✅ ログアウト機能（Zustand クリーンアップ付き）
- **日付**: 2026-04-28
- **ファイル**: `src/components/dashboard/QuestDashboard.tsx`, `src/store/useQuestStore.ts`
- **内容**:
  - `resetStore()` アクションを Zustand ストアに追加（`quests: []` を初期値に戻す）
  - `handleSignOut` の実行順序: `resetStore()` → `supabase.auth.signOut()` → `router.push('/login')`
  - **設計根拠**: セッション破棄前に Zustand をクリアしないと、別ユーザーログイン時に直前ユーザーのクエスト進捗が一瞬表示されるリスクがあるため。
  - ヘッダー右端に「ログアウト」ボタンを配置。

---

## バックログ（未着手・今後の実装候補）

> 詳細は `ROADMAP.md` を参照。

- Google OAuth（ボタンは UI に存在するが `disabled`）
- サインアップ後の `profiles` テーブルへのレコード作成
- インビジブル・Git
- JIT 学習 / 動的 AI メンターウィンドウ
- 審査用 AI システム
- 地域課題リサーチエンジン
- 独自ドメイン設定
