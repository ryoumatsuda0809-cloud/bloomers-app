# Supabase Architecture
- profiles: ユーザープロファイル
- waiting_evidence: 待機料エビデンス（到着/出発/GPS）
# Supabase Architecture

## Core Table: `waiting_evidence`
待機料のエビデンスを保全するためのコテーブル。
- `id` (uuid, PK)
- `driver_id` (uuid, FK -> auth.users)
- `arrival_time` (timestamptz, DEFAULT now()) - 端末時刻ではなくサーバー時刻を強制
- `departure_time` (timestamptz, nullable)
- `latitude` (numeric), `longitude` (numeric) - GPS座標
- `status` (text: 'waiting', 'completed')

## Security (RLS Policies)
証拠の改ざんを完全に防ぐため、以下のRLSを強制する。
- **INSERT**: 認証済みドライバーのみ。自身の`driver_id`のみ作成可能。
- **UPDATE**: `status` が 'waiting' のレコードに対してのみ、`departure_time` の打刻と `status` の 'completed' への変更を許可。
- **DELETE**: 完全禁止（証拠隠滅防止）。
