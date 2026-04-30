# ROADMAP — Bloomers 開発ロードマップ

> 完了済みの詳細は `COMPLETED.md` を参照。このファイルは「何が残っているか・今どこにいるか」を管理する。

---

## ✅ 完成済み

### UI / ダッシュボード
- ✅ クエストカード UI（locked / unlocked / active / completed の4状態、連打防止）
- ✅ QuestConnector（プログレスツリー、active 状態のパルスアニメーション）
- ✅ 全体進捗バー（完了数 / 総数 %）
- ✅ メンターウィンドウ（静的テキスト版）
- ✅ 全完了バナー

### 状態管理
- ✅ Zustand 状態管理（依存チェーン自動解決ロジック、`completeQuest` / `getActiveQuest` / `resetStore`）
- ✅ 楽観的更新 + ロールバック（Supabase 書き込み失敗時にスナップショット復元）
- ✅ Server Component ↔ Zustand データブリッジ（`QuestStoreInitializer`）

### Supabase 連携
- ✅ Supabase クライアント（サーバー用 / ブラウザ用、Cookie ベース SSR 対応）
- ✅ クエスト進捗の DB 保存（Server Action: `updateQuestStatus`、upsert + 認証チェック）
- ✅ `started_at` 潜在バグ修正（DB スキーマに存在しないフィールドを `upsert` から削除）

### 認証（Auth）
- ✅ Supabase 認証（`signUp` / `signIn` Server Actions、英語エラーの日本語変換）
- ✅ ログイン UI（メール/パスワード、zod バリデーション、ログイン/新規登録モード切り替え）
- ✅ ミドルウェアリダイレクト（未認証 → `/login`、認証済みが `/login` アクセス → `/`、`getUser()` による JWT 検証）
- ✅ 匿名ログイン競合の除去（`AuthProvider` 削除、正式認証フローとの競合を解消）
- ✅ ログアウト機能（`resetStore()` → `signOut()` → `/login` の順序保証、別ユーザーへのデータ漏洩を防止）

---

## 🔧 進行中

- ⚠️ **ブラウザ動作確認** — `npm run dev` で以下を手動検証すること:
  - 未ログイン状態で `/` にアクセス → `/login` にリダイレクトされるか
  - ログイン成功後 `/` に遷移するか
  - ログアウト後 `/login` に戻り、別ユーザーログイン時に前ユーザーのデータが表示されないか

---

## ⬜ 未着手（バックログ）

### 認証の完成（優先度：高）
- ⬜ **サインアップ後のプロフィール作成** — `signUp()` 成功後に `profiles` テーブルへ INSERT する処理が未実装。新規ユーザーのプロフィールレコードが存在しない状態になっている。
- ⬜ **Google OAuth の有効化** — ログイン UI にボタンは存在するが `disabled`（「準備中」）。Supabase の OAuth プロバイダー設定と `signInWithOAuth()` の実装が必要。

### 体験先行型教育（JIT Learning）
- ⬜ **動的 AI メンターウィンドウ** — 現在は静的テキスト。クエストの内容に応じた Claude API による JIT 解説を実装する（コアバリュー「JIT 学習」の本丸）。
- ⬜ **インビジブル・Git** — Git の複雑さをユーザーに見せずに環境構築を完了させるフロー。
- ⬜ **審査用 AI システム** — ユーザーの成果物を AI が評価・フィードバックするシステム。

### 拡張機能
- ⬜ **地域課題リサーチエンジン** — ユーザーの地域・興味タグに基づく課題サジェスト機能。
- ⬜ **独自ドメイン設定** — Vercel カスタムドメインの設定。
