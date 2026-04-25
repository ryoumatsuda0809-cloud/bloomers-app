/**
 * 車格別待機料計算ユーティリティ
 * 2024年問題対応 — 30分超過分のみ課金
 */

const RATE_MAP: Record<string, number> = {
  '2t': 40,
  '4t': 50,
  '10t': 60,
};

const DEFAULT_VEHICLE_CLASS = '4t';

/**
 * 待機料を計算する
 * @param waitMinutes 待機時間（分）
 * @param vehicleClass 車格（'2t' | '4t' | '10t'）
 * @returns 待機料（円）。30分以下は0円。
 */
export function calcWaitCost(waitMinutes: number, vehicleClass: string): number {
  if (waitMinutes <= 30) return 0;
  const rate = RATE_MAP[vehicleClass] ?? RATE_MAP[DEFAULT_VEHICLE_CLASS];
  return (waitMinutes - 30) * rate;
}

/**
 * 車格の表示名を返す
 */
export function vehicleClassLabel(vc: string): string {
  if (vc in RATE_MAP) return `${vc}車`;
  return `${DEFAULT_VEHICLE_CLASS}車（デフォルト）`;
}

/**
 * 単価を返す（円/分）
 */
export function getRate(vehicleClass: string): number {
  return RATE_MAP[vehicleClass] ?? RATE_MAP[DEFAULT_VEHICLE_CLASS];
}
