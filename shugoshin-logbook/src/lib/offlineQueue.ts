import { supabase } from "@/integrations/supabase/client";

const QUEUE_KEY = "COMPLIANCE_LOG_QUEUE";

export interface QueuedLog {
  order_id: string;
  event_type: string;
  latitude: number | null;
  longitude: number | null;
  location_check: boolean;
  user_id: string;
  driver_id: string;
  recorded_at: string;
  waiting_minutes: number;
  location_name: string;
  client_organization_id: string | null;
  is_manual: boolean;
  system_note: string | null;
}

export function getQueue(): QueuedLog[] {
  try {
    const raw = localStorage.getItem(QUEUE_KEY);
    return raw ? JSON.parse(raw) : [];
  } catch {
    return [];
  }
}

export function enqueue(log: QueuedLog): void {
  const queue = getQueue();
  queue.push(log);
  localStorage.setItem(QUEUE_KEY, JSON.stringify(queue));
}

function setQueue(queue: QueuedLog[]): void {
  localStorage.setItem(QUEUE_KEY, JSON.stringify(queue));
}

/**
 * Flush queued logs to Supabase one-by-one.
 * Successfully inserted items are removed; failures remain for retry.
 * Returns the number of successfully flushed items.
 */
export async function flushQueue(): Promise<number> {
  const queue = getQueue();
  if (queue.length === 0) return 0;

  let flushed = 0;
  const remaining: QueuedLog[] = [];

  for (const log of queue) {
    const { error } = await supabase.from("compliance_logs").insert({
      order_id: log.order_id,
      event_type: log.event_type as any,
      latitude: log.latitude,
      longitude: log.longitude,
      location_check: log.location_check,
      user_id: log.user_id,
      driver_id: log.driver_id,
      recorded_at: log.recorded_at,
      waiting_minutes: log.waiting_minutes,
      location_name: log.location_name,
      client_organization_id: log.client_organization_id,
      is_manual: log.is_manual,
      system_note: log.system_note,
    });

    if (error) {
      remaining.push(log);
    } else {
      flushed++;
    }
  }

  setQueue(remaining);
  return flushed;
}
