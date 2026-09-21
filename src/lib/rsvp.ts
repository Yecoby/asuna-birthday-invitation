const STORAGE_KEY = "iria-asuna-rsvps";

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

export function deleteRsvp(id: string): void {
  if (typeof window === "undefined") return;
  const current = loadRsvps();
  const next = current.filter((r) => r.id !== id);
  window.localStorage.setItem(STORAGE_KEY, JSON.stringify(next));
}

export function clearRsvps() {
  window.localStorage.removeItem(STORAGE_KEY);
}
