const STORAGE_KEY = "iria-asuna-rsvps";
const REPLIED_KEY = "iria-asuna-rsvp-replied";
const REPLIED_NAME_KEY = "iria-asuna-rsvp-replied-name";

export type Attendance = "attending" | "not-attending";

export type RsvpRecord = {
  id: string;
  guestName: string;
  attendance: Attendance;
  attendees: number;
  contact: string;
  message: string;
  createdAt: string;
};

/**
 * Has this browser already sent a reply?
 *
 * The duplicate guard is deliberately LOCAL to the device, not IP-based:
 * whole families and venues share one public IP, so an IP rule would silently
 * block the second guest in a house from replying. This app has no guest
 * accounts and should not grow any, so the browser is the one stable
 * identifier already available — the same choice the offline fallback below
 * already makes.
 *
 * It is a courtesy guard, not a security boundary: a guest can clear storage or
 * use another device. That is acceptable for a birthday RSVP, and the Host Desk
 * can still delete any stray duplicate.
 */
export function hasReplied(): boolean {
  if (typeof window === "undefined") return false;
  try {
    return window.localStorage.getItem(REPLIED_KEY) === "1";
  } catch {
    return false;
  }
}

/** Remember that this device has replied, so the form is not offered again. */
export function markReplied(name: string): void {
  if (typeof window === "undefined") return;
  try {
    window.localStorage.setItem(REPLIED_KEY, "1");
    // Store the name alongside for a friendlier "thanks again" message.
    window.localStorage.setItem(REPLIED_NAME_KEY, name.slice(0, 80));
  } catch {
    /* private mode / storage disabled — the guard simply does not apply */
  }
}

/** The name captured with the reply, when available. */
export function repliedName(): string {
  if (typeof window === "undefined") return "";
  try {
    return window.localStorage.getItem(REPLIED_NAME_KEY) ?? "";
  } catch {
    return "";
  }
}

export function loadRsvps(): RsvpRecord[] {
  if (typeof window === "undefined") return [];
  try {
    const raw = window.localStorage.getItem(STORAGE_KEY);
    if (!raw) return [];
    const parsed = JSON.parse(raw) as RsvpRecord[];
    return Array.isArray(parsed) ? parsed : [];
  } catch {
    return [];
  }
}

export function saveRsvp(input: Omit<RsvpRecord, "id" | "createdAt">): RsvpRecord {
  const record: RsvpRecord = {
    ...input,
    id: crypto.randomUUID(),
    createdAt: new Date().toISOString(),
  };
  const next = [record, ...loadRsvps()];
  window.localStorage.setItem(STORAGE_KEY, JSON.stringify(next));
  return record;
}
