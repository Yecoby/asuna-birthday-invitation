/**
 * Host Desk data access — PRIVATE organiser data, server functions only.
 *
 * Every read/mutation below is gated by `requireHost()` (see `./hosts.server`):
 * a valid, server-verified admin session (established by `signInHost` in
 * `./host-session`). The check runs inside the handler BEFORE any query, so an
 * unauthenticated caller receives a thrown 401 and no rows — the desk is never
 * rendered and hidden.
 *
 * `submitRsvp` is the ONE public entry point (guests have no account). It is
 * write-only by construction: it inserts a row and returns nothing about any
 * other reply, so it cannot be used to read the inbox.
 */
import { createServerFn } from "@tanstack/react-start";
import { getSql } from "@/lib/db";
import { requireHost } from "@/lib/hosts.server";

/** A guest reply as the Host Desk sees it. */
export type HostRsvp = {
  id: string;
  guestName: string;
  attendance: "attending" | "not-attending";
  attendees: number;
  contact: string;
  message: string;
  createdAt: string;
};

/** Host-managed countdown settings (mirrors the guest-side view). */
export type HostTimerSettings = {
  enabled: boolean;
  customDateISO: string | null;
};

const TIMER_SETTINGS_KEY = "timer";

type Row = {
  id: string;
  guest_name: string;
  attendance: string;
  attendees: number | string;
  contact: string;
  message: string;
  submitted_at: string | Date;
};

function toHostRsvp(row: Row): HostRsvp {
  return {
    id: row.id,
    guestName: row.guest_name,
    attendance: row.attendance === "attending" ? "attending" : "not-attending",
    attendees: Number(row.attendees) || 0,
    contact: row.contact,
    message: row.message,
    createdAt:
      row.submitted_at instanceof Date
        ? row.submitted_at.toISOString()
        : new Date(row.submitted_at).toISOString(),
  };
}

/** Trim + hard-cap a guest-supplied string so one reply can't bloat the inbox. */
function cleanField(value: unknown, maxLength: number): string {
  if (typeof value !== "string") return "";
  return value.trim().slice(0, maxLength);
}

// ── Public: guest RSVP submission (no account required, write-only) ──────────

export type SubmitRsvpInput = {
  guestName: string;
  attendance: "attending" | "not-attending";
  attendees: number;
  contact: string;
  message: string;
};

/**
 * Record a guest reply. Reached from the public invitation by any visitor —
 * no session, no auth. It only ever INSERTS; it never returns inbox data.
 */
export const submitRsvp = createServerFn({ method: "POST" })
  .validator((input: unknown): SubmitRsvpInput => {
    const raw = (input ?? {}) as Record<string, unknown>;
    const guestName = cleanField(raw.guestName, 120);
    if (!guestName) throw new Error("Please tell us your name.");
    const attendance =
      raw.attendance === "not-attending" ? "not-attending" : "attending";
    const attendeesRaw = Number(raw.attendees);
    const attendees =
      attendance === "attending" && Number.isFinite(attendeesRaw)
        ? Math.min(Math.max(Math.trunc(attendeesRaw), 1), 20)
        : 0;
    return {
      guestName,
      attendance,
      attendees,
      contact: cleanField(raw.contact, 160),
      message: cleanField(raw.message, 1000),
    };
  })
  .handler(async ({ data }): Promise<{ ok: true }> => {
    const sql = await getSql();
    await sql`
      insert into rsvps (id, guest_name, attendance, attendees, contact, message)
      values (
        ${crypto.randomUUID()},
        ${data.guestName},
        ${data.attendance},
        ${data.attendees},
        ${data.contact},
        ${data.message}
      )
    `;
    return { ok: true };
  });

// ── Host-only: the private inbox ────────────────────────────

/** Every guest reply. Authorized hosts only. */
export const listRsvps = createServerFn({ method: "GET" }).handler(
  async (): Promise<HostRsvp[]> => {
    await requireHost();
    const sql = await getSql();
    const rows = await sql<Row>`
      select id, guest_name, attendance, attendees, contact, message, submitted_at
      from rsvps
      order by submitted_at desc
    `;
    return rows.map(toHostRsvp);
  },
);

/** Delete one reply. Id is passed through as a bound parameter, never inlined. */
export const deleteRsvpRecord = createServerFn({ method: "POST" })
  .validator((input: unknown): { id: string } => {
    const id = (input as { id?: unknown } | null)?.id;
    if (typeof id !== "string" || !id.trim()) throw new Error("Missing reply id.");
    return { id: id.trim() };
  })
  .handler(async ({ data }): Promise<{ ok: true }> => {
    await requireHost();
    const sql = await getSql();
    await sql`delete from rsvps where id = ${data.id}`;
    return { ok: true };
  });

/** Empty the inbox. Authorized hosts only. */
export const clearRsvpRecords = createServerFn({ method: "POST" }).handler(
  async (): Promise<{ ok: true }> => {
    await requireHost();
    const sql = await getSql();
    await sql`delete from rsvps`;
    return { ok: true };
  },
);

// ── Host-only: invitation countdown settings ────────────────────────────────

/** Current countdown settings. Authorized hosts only. */
export const loadHostTimerSettings = createServerFn({ method: "GET" }).handler(
  async (): Promise<HostTimerSettings> => {
    await requireHost();
    const sql = await getSql();
    const rows = await sql<{ value: string }>`
      select value from host_settings where key = ${TIMER_SETTINGS_KEY}
    `;
    const raw = rows[0]?.value;
    if (!raw) return { enabled: true, customDateISO: null };
    try {
      const parsed = JSON.parse(raw) as Partial<HostTimerSettings>;
      return {
        enabled: parsed.enabled !== false,
        customDateISO:
          typeof parsed.customDateISO === "string" ? parsed.customDateISO : null,
      };
    } catch {
      return { enabled: true, customDateISO: null };
    }
  },
);

/** Save countdown settings. Authorized hosts only. */
export const saveHostTimerSettings = createServerFn({ method: "POST" })
  .validator((input: unknown): HostTimerSettings => {
    const raw = (input ?? {}) as Partial<HostTimerSettings>;
    const customDateISO =
      typeof raw.customDateISO === "string" && raw.customDateISO
        ? new Date(raw.customDateISO).toISOString()
        : null;
    return { enabled: raw.enabled !== false, customDateISO };
  })
  .handler(async ({ data }): Promise<HostTimerSettings> => {
    await requireHost();
    const sql = await getSql();
    await sql`
      insert into host_settings (key, value, updated_at)
      values (${TIMER_SETTINGS_KEY}, ${JSON.stringify(data)}, now())
      on conflict (key) do update set value = excluded.value, updated_at = now()
    `;
    return data;
  });
