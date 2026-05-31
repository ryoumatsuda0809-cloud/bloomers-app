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
# Bloomer 実装手順書（Claude Code用）

> **必ず1フェーズ完了を確認してから次へ進むこと。**

---

## 現在の状態（Audit結果より）

### 完成済み ✅
- クエストカードUI（4状態）
- プログレスツリー・全体進捗バー
- Zustand状態管理・楽観的更新
- Supabaseクライアント（サーバー/ブラウザ）
- ログインUI・Auth Server Actions
- クエスト進捗のDB保存・読み込み
- メンターウィンドウ（静的版）
- 全完了バナー

### 動作未確認（コードは書いたが、ブラウザで確認していない）⚠️
- /login フリーズ問題の修正
- middleware.ts のリダイレクト制御
- サインイン後のセッション伝播

### 未着手 🔒
- ログアウト機能
- サインアップ後のプロフィール作成
- メンターウィンドウ（動的AI版）
- インビジブル・Git
- その他バックログ

---

## 実装フェーズ（優先順位順）

---

## Phase 1：動作確認と既存バグの修正【最優先】

> 新機能を追加する前に、現在のコードが正しく動くことを確認する。
> ここを飛ばすと、後で原因不明のバグが積み重なる。

### Task 1-1：ブラウザ動作確認（コード変更なし）

以下の手順を実行し、結果を報告してください。

```
1. npm run dev でローカルサーバーを起動
2. ブラウザで http://localhost:3000 にアクセス
3. 未ログイン状態で /login にリダイレクトされるか確認
4. メール/パスワードでサインアップ
5. サインアップ後に / （ダッシュボード）にリダイレクトされるか確認
6. ブラウザを閉じて再度 http://localhost:3000 にアクセス
7. セッションが維持されているか（ログインしたままか）確認
```

**期待する結果：**
- 未ログイン → /login にリダイレクト ✅
- ログイン成功 → / にリダイレクト ✅
- セッション維持 → 再アクセス時もダッシュボードが表示 ✅

**もし失敗した場合：**
エラーメッセージをそのまま報告してください。修正します。

---

### Task 1-2：ログアウト機能の実装

**目的：** 認証フローを完成させる。ログアウトがないと、テストもデバッグもできない。

**実装内容：**

`src/app/actions/auth.ts` に以下を追加してください。

```typescript
export async function signOut() {
  const supabase = await createClient()
  await supabase.auth.signOut()
  redirect('/login')
}
```

ダッシュボード画面（`src/components/dashboard/QuestDashboard.tsx`）の右上に、
Shadcn UIの `Button` コンポーネントを使ったログアウトボタンを追加してください。

```
デザイン指定：
- 右上に配置
- variant="ghost"
- テキスト：「ログアウト」
- クリックでsignOut()を呼び出す
```

---

### Task 1-3：started_at カラムの潜在バグ修正

**目的：** 将来のバグを今のうちに潰す。

`src/app/actions/quest.ts:29` の upsert処理から `started_at` フィールドを
削除するか、DBスキーマに `started_at` カラムを追加するか、どちらかを選択してください。

**推奨：** `started_at` フィールドをupsertから削除する（シンプルな方）

---

### Task 1-4：ROADMAP.md の更新

**目的：** ドキュメントと実態を一致させる。

`docs/ROADMAP.md` を現在のAuditレポートの内容に合わせて更新してください。
完成済み・進行中・未着手の3セクションに整理してください。

---

## Phase 2：サインアップ後のプロフィール作成

> Phase 1が完全に動作確認できてから着手すること。

**目的：** ユーザーがサインアップした瞬間に、profiles テーブルにレコードを作る。
これがないと、将来のユーザー固有データ（プロジェクト名等）が保存できない。

### Task 2-1：profilesテーブルの確認

Supabaseのダッシュボードで `profiles` テーブルが存在するか確認してください。

存在しない場合は以下のSQLを実行してください。

```sql
CREATE TABLE profiles (
  id UUID REFERENCES auth.users(id) PRIMARY KEY,
  project_name TEXT,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- RLS有効化
ALTER TABLE profiles ENABLE ROW LEVEL SECURITY;

-- 自分のプロフィールのみ読み書き可能
CREATE POLICY "自分のプロフィールのみ操作可能" ON profiles
  FOR ALL USING (auth.uid() = id);
```

### Task 2-2：signUp後にprofilesへINSERT

`src/app/actions/auth.ts` の `signUp()` 関数内、
サインアップ成功後に以下を追加してください。

```typescript
// サインアップ成功後
if (data.user) {
  await supabase.from('profiles').insert({
    id: data.user.id,
    project_name: null, // Quest 2の踏み絵で設定する
  })
}
```

---

## Phase 3：メンターウィンドウの動的AI版

> Phase 2が完了してから着手すること。
> これがBloomerの「JIT学習」というコアバリューの実装。

**目的：** 現在の静的テキストを、クエストごとに変わるAI生成の解説に切り替える。

### Task 3-1：Anthropic APIの接続

`.env.local` に以下を追加してください。

```
ANTHROPIC_API_KEY=your_api_key_here
```

### Task 3-2：メンターメッセージ生成のServer Action

`src/app/actions/mentor.ts` を新規作成してください。

```typescript
'use server'

export async function getMentorMessage(questTitle: string): Promise<string> {
  const response = await fetch('https://api.anthropic.com/v1/messages', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'x-api-key': process.env.ANTHROPIC_API_KEY!,
      'anthropic-version': '2023-06-01',
    },
    body: JSON.stringify({
      model: 'claude-haiku-4-5-20251001', // 軽量モデルでコスト最適化
      max_tokens: 150,
      messages: [{
        role: 'user',
        content: `
あなたはBloomerというサービスのメンターです。
大学生の初心者ユーザーが「${questTitle}」というステップに取り組んでいます。
「なぜこのステップが必要なのか」を、技術用語を使わず、
日常的な比喩を使って3文以内で優しく説明してください。
`,
      }],
    }),
  })

  const data = await response.json()
  return data.content[0].text
}
```

### Task 3-3：QuestDashboard.tsxのメンターウィンドウを動的化

現在の静的テキストを、`getMentorMessage()` の結果に差し替えてください。
ローディング中は「メンターが考えています...」と表示してください。

---

## Phase 4：インビジブル・Git（最後に着手）

> Phase 1〜3が全て完了してから着手すること。
> これは最も複雑な機能。基盤が固まってから実装する。

**目的：** ユーザーがGitコマンドを一切打たずに、
ボタン1つでコードがGitHubにプッシュされVercelで公開される仕組みを作る。

詳細はPhase 1〜3完了後に別途設計します。

---

## 実装の鉄則

```
1. 必ずPhase順に進める。飛ばさない。
2. 各Taskが終わったら必ずブラウザで動作確認する。
3. エラーが出たら新しい機能を追加せず、まずそのエラーを直す。
4. 既存の auth.ts / middleware.ts は、
   Phase 1の動作確認が終わるまで変更しない。
```

