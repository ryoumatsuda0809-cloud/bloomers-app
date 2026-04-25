# 守護神 — 実装要約ドキュメント

> **対象読者**: 本プロジェクトに新たに参加する開発者、またはコア機能を変更する前に設計意図を確認したい担当者  
> **最終更新**: 2026-04-19  
> **ステータス**: 本番デプロイ済み（Vercel + Supabase）

---

## 目次

1. [セキュアな認証ステート管理（useAuth）](#1-セキュアな認証ステート管理useauth)
2. [取適法準拠エビデンスUI と GPS ジオフェンス物理ロック](#2-取適法準拠エビデンスui-と-gps-ジオフェンス物理ロック)
3. [改ざん防止データ送信アーキテクチャ（Supabase RPC）](#3-改ざん防止データ送信アーキテクチャsupabase-rpc)
4. [Vitest 結合テスト網羅状況](#4-vitest-結合テスト網羅状況)

---

## 1. セキュアな認証ステート管理（useAuth）

### なぜ実装したか

初期実装では `getSession()` を先に呼び出し、その後 `onAuthStateChange` をセットアップする順序になっていた。この順序だと、セッション取得の非同期完了タイミングとリスナー登録の競合により、ログイン直後に `loading` フラグが `true` → `false` → `true` と不規則に変化し、**無限リダイレクトループ**（ログインページとダッシュボード間を往復し続ける）が発生した。

### どう実装したか

`src/hooks/useAuth.tsx` において、**`onAuthStateChange` リスナーを唯一の信頼できるステート更新源** とし、`getSession()` の独立呼び出しを排除した。

```
useEffect(() => {
  // ① リスナーを先に登録: Auth イベントが唯一のステート更新源となる
  const { data: { subscription } } = supabase.auth.onAuthStateChange(
    (_event, session) => {
      setSession(session);
      setUser(session?.user ?? null);
      setLoading(false);   // ← リスナー内でのみ loading を解除
    }
  );
  return () => subscription.unsubscribe();
  // ② getSession() の独立呼び出しはない
}, []);
```

**重要な設計不変条件**:

- `onAuthStateChange` は登録直後に現在のセッション状態を即時発火する。これにより初回マウント時も `getSession()` なしで正しい状態が得られる。
- この順序を変更すると競合状態が再発する。`CLAUDE.md` の Rule 3 で変更を禁止している。

---

## 2. 取適法準拠エビデンスUI と GPS ジオフェンス物理ロック

### なぜ実装したか

2024年改正物流法（通称「取適法」）では、荷主施設でのドライバー待機時間を客観的証拠として記録・保全することが義務付けられている。GPS位置情報を伴わない打刻は法的証拠として無効となるため、**GPSが取得できない状態での打刻操作を物理的に不可能にする**フェイルセーフが必要だった。

### どう実装したか

#### フック層: `src/hooks/useEvidence.ts`

`navigator.geolocation.watchPosition()` で GPS を継続監視し、以下の2つの状態を管理する。

| 状態 | 説明 |
|------|------|
| `position: GpsPosition \| null` | GPS座標。未取得時は `null` |
| `gpsError: string \| null` | エラー種別ごとの日本語メッセージ |

GPS エラーはエラーコードで分岐し、ドライバーが対処できる具体的な日本語メッセージに変換する（許可拒否 / 位置取得不可 / タイムアウト）。

#### UIコンポーネント層: `src/components/evidence/EvidenceCollector.tsx`

```typescript
const isGpsReady = position !== null && !gpsError;
const isButtonLocked = !isGpsReady || isSubmitting;  // 物理ロック条件
```

| 条件 | UIの状態 |
|------|----------|
| GPS取得中（`position === null`） | ボタン `disabled`、レーダーアニメーション表示 |
| GPS エラー（`gpsError !== null`） | ボタン `disabled`、`<Alert variant="destructive">` で日本語エラー表示 |
| 送信中（`isSubmitting === true`） | ボタン `disabled`、ローダー表示 |
| GPS取得済み・エラーなし | ボタン enabled「到着打刻」 |

**フェイルセーフの二重構造**:

1. **フロント層**: `disabled` による物理ロック（クリック不可）
2. **バックエンド層**: `issue_ticket` RPC の PostGIS ジオフェンス判定（500m圏外は `RAISE EXCEPTION`）

フロント側の無効化を意図的に回避されても、バックエンドが必ず弾く設計になっている。

---

## 3. 改ざん防止データ送信アーキテクチャ（Supabase RPC）

### なぜ実装したか

打刻データ（到着時刻・GPS座標・整理券番号）は待機料の算定根拠となる法的証拠であり、**クライアントから直接 `insert()` するとタイムスタンプや座標の偽装が可能**になる。フロントエンドは信頼できない実行環境であるため、証拠の生成・検証をすべてサーバーサイドに委ねる必要があった。

### どう実装したか

#### データフロー

```
[フロントエンド]
  緯度・経度のみ送信
        │
        ▼
[RPC: get_nearest_facility]
  PostGIS で 500m 圏内の施設を検索
  圏外の場合は空配列を返す（フロントがエラー表示）
        │
        ▼
[RPC: issue_ticket]
  wait_logs を INSERT
  arrival_time = CURRENT_TIMESTAMP（DB サーバー時刻）
  整理券番号を自動採番
  500m 圏外の場合は RAISE EXCEPTION（P0001）
        │
        ▼
[フロントエンド]
  log_id / ticket_number / arrival_time を受け取り表示
```

フロントエンドが送信するのは `user_lat`, `user_lng`, `p_facility_id` のみ。**時刻の付与・ジオフェンス判定・整理券採番はすべてDBが行う**。

#### DBレベルの改ざん防止（`supabase/migrations/`）

| 仕組み | 対象テーブル | 効果 |
|--------|-------------|------|
| `trg_force_wait_log_arrival` | `wait_logs` | `arrival_time` / `created_at` をDBサーバー時刻で強制上書き |
| `trg_force_recorded_at` | `compliance_logs` | `recorded_at` をDBサーバー時刻で強制上書き |
| `trg_force_waiting_evidence_timestamps` | `waiting_evidence` | `recorded_at` / `created_at` をDBサーバー時刻で強制上書き |
| `trg_guard_waiting_evidence_update` | `waiting_evidence` | `is_signed = true` の行への変更を全ロールで禁止 |
| `trg_block_waiting_evidence_delete` | `waiting_evidence` | DELETE を全ロールで禁止（service_role 含む） |
| `trg_block_waiting_evidence_truncate` | `waiting_evidence` | TRUNCATE を全ロールで禁止 |

RLS ポリシーに加えて `SECURITY DEFINER` トリガーによる二重防御を採用しているため、service_role を使った管理操作でも署名済みエビデンスの改ざんは不可能。

---

## 4. Vitest 結合テスト網羅状況

### テストファイル構成

| ファイル | テスト対象 | テスト数 |
|--------|-----------|---------|
| `src/hooks/useEvidence.test.ts` | バックエンド通信ロジック（RPC呼び出し） | 3 |
| `src/components/evidence/EvidenceCollector.test.tsx` | GPS状態によるUI物理ロック | 3 |

### `useEvidence.test.ts` — バックエンド通信結合テスト

```
describe: useEvidence — バックエンド送信の結合テスト
```

| テストケース | 検証内容 |
|------------|---------|
| 正常系: GPS→RPC正常 | `get_nearest_facility` に正しい緯度経度が渡されること / `issue_ticket` に施設IDが渡されること / `lastResult` が正しくマッピングされること |
| 異常系: ネットワークエラー | `get_nearest_facility` 失敗時に `submitError` に日本語メッセージが伝播し、後続の `issue_ticket` が呼ばれないこと |
| 異常系: 500m圏外/ジオフェンス | `issue_ticket` が `RAISE EXCEPTION` を返した場合に圏外エラーメッセージが正しく表示されること |

### `EvidenceCollector.test.tsx` — UIフェイルセーフ結合テスト

```
describe: EvidenceCollector — GPS状態によるUIフェイルセーフ検証
```

| テストケース | 検証内容 |
|------------|---------|
| 正常系: GPS取得済み | 「到着打刻」ボタンが `enabled` になること |
| 異常系: 許可拒否 (PERMISSION_DENIED) | `<Alert variant="destructive">` が表示され、ボタンが `disabled` であること |
| 異常系: 位置取得失敗 (POSITION_UNAVAILABLE) | `<Alert>` が表示され、ボタンが `disabled` であること |

### モック戦略

- `supabase` クライアントを `vi.mock` で完全モック化し、実ネットワーク接続なしでRPCのレスポンスを制御。
- `navigator.geolocation` は jsdom に存在しないため、テストごとに `Object.defineProperty` で差し込む。
- `useAuth` をモックして認証状態を固定し、Auth フローとテスト対象ロジックを分離。

---

## アーキテクチャ図（概要）

```
┌─────────────────────────────────────┐
│  React フロントエンド（Vite）         │
│                                     │
│  useAuth.tsx                        │
│  └─ onAuthStateChange（先行登録）   │
│                                     │
│  EvidenceCollector.tsx              │
│  └─ isButtonLocked（物理ロック）    │
│       ├─ GPS未取得 → disabled       │
│       └─ GPSエラー → disabled +     │
│             Alert Destructive       │
│                                     │
│  useEvidence.ts                     │
│  └─ submitEvidence()               │
│       ├─ RPC: get_nearest_facility  │
│       └─ RPC: issue_ticket         │
└───────────────┬─────────────────────┘
                │ HTTPS / Supabase SDK
┌───────────────▼─────────────────────┐
│  Supabase（PostgreSQL + PostGIS）   │
│                                     │
│  get_nearest_facility RPC           │
│  └─ 500m 圏内施設を PostGIS で検索 │
│                                     │
│  issue_ticket RPC                   │
│  ├─ wait_logs INSERT                │
│  ├─ arrival_time = CURRENT_TIMESTAMP│
│  └─ 500m 圏外 → RAISE EXCEPTION    │
│                                     │
│  DBトリガー（改ざん防止）           │
│  ├─ タイムスタンプ強制上書き        │
│  ├─ 署名済み行の変更禁止            │
│  └─ DELETE / TRUNCATE 禁止         │
└─────────────────────────────────────┘
```

---

> **次のステップ**: 待機料自動計算ロジック（`wait_logs` の `work_end_time` 確定時のトリガー）および荷主向けダッシュボード表示の実装へ。
