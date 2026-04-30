# Bloomers Project
初心者向けのSaaS開発学習プラットフォーム「Bloomers」。

## Tech Stack
- Frontend: Next.js 14 (App Router), React, TypeScript
- Styling: Tailwind CSS, Shadcn UI
- State Management: Zustand

## Project Structure
- `src/components/dashboard/`: クエスト・ダッシュボード関連のUIコンポーネント
- `src/store/`: Zustandの状態管理ストア
- `src/app/`: Next.jsのルーティング

## Development Commands
- サーバー起動: `npm run dev`

## Code Standards
- 【厳守】ファイルのインポートやパス指定は、Linux環境（大文字・小文字区別あり）に厳格に準拠すること。拡張子は `.tsx` または `.ts` を使用。
- コンポーネントは関数コンポーネントで記述し、デフォルトエクスポートを使用すること。

## Operational Rules
- 破壊的な変更や、インフラに関わるコマンド（GitHubへのプッシュやパッケージの追加等）を実行する際は、必ずユーザーに事前に計画（Plan）を提示し、承認を得てから実行すること。
[プロジェクトの進捗管理はこちら](ROADMAP.md)

# CLAUDE.md — Bloomer プロジェクト憲法

> このファイルはClaude Codeが読む「プロジェクトの設計思想と行動規範」だ。
> 実装の前に必ずこれを読み、思想に沿った判断をしろ。

---

## 🌱 このプロダクトは何か

**Bloomer**（ブルーマー）は、若者・大学生が「作りたい」という熱意を、
技術の壁で冷まさせないための **AI支援型・伴走型開発プラットフォーム** だ。

ユーザーは非エンジニア。コードは読めない。でもアイデアはある。
その人たちが「自分のプロダクト（資産）」を手にするまで、
AIが全力で伴走する。それがBloomersの存在意義だ。

---

## 🎯 コアバリュー（何のために作っているか）

1. **インビジブル・インフラ** — 環境構築の複雑さをユーザーに見せない
2. **JIT（Just-In-Time）学習** — 「今必要な知識」をその場で与える
3. **意思決定のオーナーシップ** — 自動化しすぎず、クリエイティブな選択はユーザーに委ねる
4. **クラウド破産ゼロ** — VercelとSupabaseのコスト上限を常に意識した実装

---

## 🏗️ 技術スタック（変更禁止）

| レイヤー | 技術 | 備考 |
|----------|------|------|
| フロントエンド | Next.js 15（App Router） | Pages Routerは使わない |
| UI | Tailwind CSS + Shadcn UI | カスタムCSSは最小限に |
| バックエンド/DB | Supabase | サーバーレス。自前サーバー構築禁止 |
| 認証 | Supabase Auth | JWT管理はSupabaseに委ねる |
| ホスティング | Vercel | GitHub連携でCI/CD自動化 |
| 状態管理 | Zustand | ReduxやContextは使わない |
| 言語 | TypeScript | any型の使用禁止 |

---

## 📁 ディレクトリ構成（守ること）

```
bloomers-app/
├── src/
│   ├── app/                  # Next.js App Router
│   │   ├── (auth)/           # 認証が必要なページ群
│   │   │   └── dashboard/
│   │   ├── (public)/         # 未ログインでも見えるページ
│   │   │   └── page.tsx      # ランディングページ
│   │   └── layout.tsx
│   ├── components/
│   │   ├── quest/            # クエスト関連
│   │   │   ├── QuestDashboard.tsx
│   │   │   ├── QuestCard.tsx
│   │   │   ├── ProgressTree.tsx
│   │   │   └── MentorWindow.tsx
│   │   └── ui/               # Shadcn UIコンポーネント（触らない）
│   ├── lib/
│   │   ├── supabase/
│   │   │   ├── client.ts     # ブラウザ用クライアント
│   │   │   └── server.ts     # サーバー用クライアント
│   │   └── store/
│   │       └── questStore.ts # Zustandストア
│   └── types/
│       └── index.ts          # 型定義を一元管理
├── CLAUDE.md                 # このファイル
├── ROADMAP.md                # 進捗管理
├── .env.local                # 絶対にGitにコミットするな
└── .gitignore
```

---

## 🗄️ データベース設計（Supabase）

### テーブル定義

```sql
-- ユーザープロフィール
create table profiles (
  id uuid references auth.users primary key,
  username text,
  region text,           -- 例: 山口県下関市
  interest_tags text[],  -- 例: ['食', '物流', 'デザイン']
  created_at timestamptz default now()
);

-- クエスト進捗
create table quest_progress (
  id uuid default gen_random_uuid() primary key,
  user_id uuid references profiles(id) on delete cascade,
  quest_id text not null,        -- 例: 'db', 'auth', 'ui'
  status text default 'locked',  -- locked | unlocked | active | completed
  completed_at timestamptz,
  updated_at timestamptz default now()
);
```

### RLSポリシー（必ず設定すること）

```sql
-- profilesテーブル
alter table profiles enable row level security;
create policy "自分のプロフィールのみ読み書き可"
  on profiles for all using (auth.uid() = id);

-- quest_progressテーブル
alter table quest_progress enable row level security;
create policy "自分の進捗のみ読み書き可"
  on quest_progress for all using (auth.uid() = user_id);
```

---

## 🔐 セキュリティ規則（絶対に守れ）

- `.env.local` は **絶対にGitにコミットしない**（.gitignoreに必ず含める）
- Supabaseのキーはすべて環境変数経由で参照する
- クライアントサイドで `service_role` キーを使うことは **禁止**
- RLSを無効にしたままテーブルを本番に出すことは **禁止**
- ユーザー入力は必ずバリデーション（zodを使え）

---

## 💰 コスト管理規則

- Supabaseは無料枠（500MB DB、50,000 MAU）を超えないよう設計する
- Vercelは `$10/month` のSpend Limitを設定する
- 外部API（AI系）を呼ぶ場合は必ずキャッシュ戦略を持つ
- 画像はVercel Image Optimizationを使い、外部CDNは使わない

---

## 🧠 実装時の行動規範

### やること
- 実装前に必ず「このコードの目的」を1行コメントで書く
- 型は明示的に定義する（inferに頼りすぎない）
- エラーハンドリングは必ず入れる（try/catchを忘れるな）
- コンポーネントは200行を超えたら分割を検討する
- Supabaseへのリクエストはすべて `src/lib/supabase/` 経由にする

### やらないこと
- `any` 型の使用
- `console.log` を本番コードに残す
- RLSを無効にしたまま進める
- 環境変数をハードコードする
- 1つのファイルにロジックとUIを混在させる

---

## 📋 現在の実装状況

```
[完了]
✅ QuestDashboard UI（ダミーデータで動作中）
✅ Vercel 本番公開

[進行中]
🔧 Supabase MCP接続（ROADMAP.md参照）

[未着手]
⬜ Supabase Auth（ログイン機能）
⬜ クエスト進捗のDB保存
⬜ 地域課題リサーチエンジン
⬜ 独自ドメイン設定
```

---

## 🚀 次にやること

ROADMAP.md を参照して、現在のフェーズのタスクを実行しろ。
不明点があればユーザーに確認を取ってから進めること。
