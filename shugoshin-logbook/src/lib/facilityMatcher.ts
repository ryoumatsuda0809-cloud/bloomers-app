import { haversineDistance } from "@/lib/haversine";
import type { Facility } from "@/lib/facilities";

export interface MatchResult {
  facility: Facility;
  distance: number;
}

/**
 * GPS座標から最も近い拠点を判定する。
 * maxDistance(メートル)以内で最も近い拠点を返す。圏外なら null。
 */
export function findNearestFacility(
  lat: number,
  lon: number,
  facilities: Facility[]
): MatchResult | null {
  let best: MatchResult | null = null;

  for (const f of facilities) {
    const d = haversineDistance(lat, lon, f.lat, f.lng);
    if (d <= f.radius && (best === null || d < best.distance)) {
      best = { facility: f, distance: d };
    }
  }

  return best;
}
