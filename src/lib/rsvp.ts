const STORAGE_KEY = "iria-asuna-rsvps";

export type Attendance = "attending" | "not-attending";

export type RsvpRecord = {
  id: string;
  guestName: string;
  attendance: Attendance;
  /** Split headcount; `attendees` is always `adults + kids`. */
  adults: number;
  kids: number;
  attendees: number;
  contact: string;
  message: string;
  createdAt: string;
};

/*
 * NOTE — there is deliberately no "this device already replied" guard here.
 *
 * One existed previously (a `hasReplied()` flag in localStorage that hid the form
 * on any later visit). It was removed: this is a public birthday invitation, so
 * a family sharing one phone or a single tablet at the party must be able to send
 * more than one reply. Every submission is an independent insert and no reply is
 * ever overwritten — see `submitRsvp` in host-data.ts.
 */

export function loadRsvps(): RsvpRecord[] {
  if (typeof window === "undefined") return [];
  try {
    const raw = window.localStorage.getItem(STORAGE_KEY);
    if (!raw) return [];
    const parsed = JSON.parse(raw) as unknown;
    if (!Array.isArray(parsed)) return [];
    // Entries written before the Adults/Kids split only carry `attendees`; fall
    // back to `adults = attendees, kids = 0` (same rule as the DB migration and as
    // `readHeadcount` in host-data.ts) so a stale local copy is never read as a
    // zero-guest reply.
    return parsed.map((entry) => {
      const record = entry as Partial<RsvpRecord>;
      const attendees = Number(record.attendees) || 0;
      const hasSplit = record.adults != null || record.kids != null;
      const adults = Number.isFinite(Number(record.adults))
        ? Math.max(0, Math.trunc(Number(record.adults)))
        : 0;
      const kids = Number.isFinite(Number(record.kids))
        ? Math.max(0, Math.trunc(Number(record.kids)))
        : 0;
      if (!hasSplit || (adults === 0 && kids === 0 && attendees > 0)) {
        return { ...(record as RsvpRecord), adults: Math.max(0, attendees), kids: 0, attendees };
      }
      return { ...(record as RsvpRecord), adults, kids, attendees: adults + kids };
    });
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
