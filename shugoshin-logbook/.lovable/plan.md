# parse-order クラッシュ防止 + 根本原因分析 計画

```
# Context (背景)
Logi-Compのバックエンド（`parse-order` Edge Function）において、より高度な推論能力と安定性を確保するため、現在のAPI呼び出しモデルを最新の「Gemini 3 Flash」にアップグレードします。
LovableのデフォルトモデルがGemini 3 Flashになったことと歩調を合わせ、開発環境と本番環境のAIエンジンを統一します。

# Objective & Task (目的とタスク)
APIの通信ロジック全体は変更せず、モデルの指定文字列のみをGemini 3 Flashに差し替えるコード修正（Action）を行ってください。

1. **モデルのアップグレード (`supabase/functions/parse-order/index.ts`)**:
   - Edge Function内で Google Gen AI SDK 等を呼び出している箇所のモデル指定文字列を、`gemini-3.0-flash`（または現在のGemini 3 Flashの正しいAPIモデル文字列）に変更してください。
   - 変更するのは「モデル名の文字列」のみです。

# Guidelines (技術指針)
- すでに堅牢に動いているAPIの呼び出し構造（JSONのパース、プロンプトの渡し方）はそのまま維持してください。

# Constraints (制約事項・絶対にやらないこと)
- **【絶対厳守】** モデル名を変更する以外に、`parse-order` の処理ロジックやプロンプトの文章を勝手に書き換えたり、APIの通信ライブラリを変更したりしないでください。
- **【絶対厳守】** 以前実装したフロントエンドの「ErrorBoundary」や「インライン・ライブフィード」等の機能は1ミリも壊さないでください。

# Next Step (Action Modeの強制)
指示を受け取ったら直ちに `parse-order` の文字列変更を実行し、デプロイ（反映）させてください。完了後、報告をお願いします。
```

## 現状分析

### Edge Function側

ログを確認済み。Gemini API が **503 (UNAVAILABLE)** を返しており、`parse-order/index.ts` はこれを正しくキャッチして `{ error: "AI解析に失敗しました" }` (status 500) を返している。Edge Function自体のコードに致命的バグはない。

### フロントエンド側 (`Orders.tsx`)

`handleParse` 関数（L158-178）に `try/catch` が既にある。`supabase.functions.invoke` のエラーを `toast` で表示する設計になっている。

### 真の問題: ErrorBoundary の不在

プロジェクト全体に **React ErrorBoundary が存在しない**。もし `try/catch` の外（例: レンダリング中の `data.payment_date` アクセスなど）で例外が発生すると、React がコンポーネントツリーごとアンマウントし、白画面になる。

## 変更内容

### 1. グローバル ErrorBoundary の追加 (`src/components/ErrorBoundary.tsx` 新規作成)

React の `componentDidCatch` を使ったクラスコンポーネントを作成。エラー発生時に白画面ではなく「エラーが発生しました。再読み込みしてください」という復帰可能なUIを表示する。

```typescript
class ErrorBoundary extends React.Component<Props, State> {
  componentDidCatch(error, errorInfo) {
    console.error("ErrorBoundary caught:", error, errorInfo);
  }
  render() {
    if (this.state.hasError) {
      return (
        <div className="flex flex-col items-center justify-center min-h-screen p-8">
          <p>エラーが発生しました</p>
          <Button onClick={() => window.location.reload()}>再読み込み</Button>
        </div>
      );
    }
    return this.props.children;
  }
}
```

### 2. App.tsx に ErrorBoundary を組み込み

`<BrowserRouter>` の直下（または `<Routes>` を囲む位置）に `<ErrorBoundary>` を配置。

### 3. Orders.tsx の `handleParse` 防御強化

既存の try/catch は機能しているが、以下を追加:

- `res.ok` 相当のチェック: `supabase.functions.invoke` は HTTP エラーでも `error` を返すが、レスポンスが HTML（非JSON）の場合に備え、`data` が `null` / `undefined` の場合のガードを追加
- `data.payment_date` アクセス前の null チェック強化

```typescript
// L170-172 を防御的に書き換え
if (data && !data.error) {
  setParsed(data as ParsedOrder);
  if (data?.payment_date) setDeliveryDate(data.payment_date);
} else {
  toast({ title: "AI解析エラー", description: data?.error || "応答を解析できませんでした", variant: "destructive" });
}
```

## 第2段階: 根本原因（Gemini 503）への対応指示

ログから判明した事実: **Gemini API (`gemini-3.1-flash-lite-preview`) が 503 を返している**（高負荷）。

Edge Functionのコードは正しくハンドリングしているため、コード修正は不要。対処オプション:


| オプション    | 内容                                                              |
| -------- | --------------------------------------------------------------- |
| A. 待機    | プレビューモデルの一時的な負荷。時間をおけば解消する可能性が高い                                |
| B. モデル変更 | `gemini-3.1-flash-lite-preview` → `gemini-2.0-flash` 等の安定版に切り替え |
| C. リトライ  | Edge Function内に1回だけ自動リトライ（1秒待機後）を追加                             |


これらはログ確認後の次フェーズで判断。

## ファイル変更サマリ


| ファイル                               | 変更内容                               |
| ---------------------------------- | ---------------------------------- |
| `src/components/ErrorBoundary.tsx` | 新規作成: グローバルエラーバウンダリ                |
| `src/App.tsx`                      | ErrorBoundary でルートをラップ             |
| `src/pages/Orders.tsx`             | handleParse の null ガード強化（L166-172） |


DBマイグレーション: 不要

## 変更しないもの

- `supabase/functions/parse-order/index.ts`（ログで原因特定済み、コード修正不要）
- AdminDashboard / カンバン / インラインフィード
- 他ファイル一切