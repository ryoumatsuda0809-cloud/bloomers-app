# Logi-Comp Project Rules
## Technical Stack
- Frontend: React (Vite), TypeScript, Tailwind CSS, Shadcn UI
- Backend: Supabase (Auth, DB, Functions, Storage)
- Environment: Ubuntu Linux (Case-sensitive file paths)
## Coding Guidelines
- **Linux Case-Sensitivity**: Imports must exactly match filename casing.
- **Supabase RLS-First**: All database changes must include RLS policies.
- **Legal Compliance**: Data impacting "Waiting Fees" (待機料) must be immutable once signed.

## 🏗 Core Architecture & Compliance Rules (DO NOT MODIFY)

### Rule 1: Evidence Recording — RPC Chain Mandatory
打刻エビデンスの記録は、フロントエンドから `evidence` テーブルへ直接 `insert()` することを**禁止**する。
必ず `get_nearest_facility` → `issue_ticket` のRPCチェーンを経由すること。
これにより改ざん耐性（サーバーサイドでの検証・タイムスタンプ付与）を保証する。

### Rule 2: Clock-In UI — Physical Lock (Fail-Safe)
打刻UIは以下の条件下で必ずボタンを物理ロック（`disabled`）すること：
- GPS取得不可時
- 500mジオフェンス圏外時

上記いずれの場合も、ドライバー向けの日本語エラーを `Alert Destructive` コンポーネントで表示するフェイルセーフを削除・回避してはならない。

### Rule 3: Auth State — `onAuthStateChange` Before `getSession`
`useAuth.tsx` における認証ステート管理は、無限ループを防ぐため、**`getSession` の呼び出しより先に `onAuthStateChange` リスナーをセットアップする**現在の設計を厳守すること。
この順序を逆転させたり、`getSession` のみに依存する実装へ変更することを禁止する。
