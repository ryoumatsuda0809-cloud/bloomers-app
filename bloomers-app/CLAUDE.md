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
