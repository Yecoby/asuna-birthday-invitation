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
  /**
   * Headcount split. `attendees` below is always `adults + kids` — kept so the
   * pre-split rows (and any older reader) still resolve to a correct total.
   */
  adults: number;
  kids: number;
  attendees: number;
  contact: string;
  message: string;
  createdAt: string;
};

/** Upper bound for one headcount, matching the server-side clamp. */
export const MAX_HEADCOUNT = 20;

/**
 * Read the headcount split off a row, tolerating pre-feature rows that only
 * have `attendees`.
 *
 * Legacy rows loaded the split as `adults = attendees, kids = 0` (see
 * migrations/0003_rsvp_headcount.sql); this repeats that fallback so a row that
 * somehow still has no split is never shown as "0 guests" and never crashes.
 */
function readHeadcount(row: { adults?: number | string | null; kids?: number | string | null; attendees?: number | string | null }): {
  adults: number;
  kids: number;
} {
  const attendees = Number(row.attendees) || 0;
  // `null`/`undefined` mean "no split recorded" — a legacy row, which must fall
  // back rather than read as empty.
  const hasSplit = row.adults != null || row.kids != null;
  const adultsRaw = Number(row.adults);
  const kidsRaw = Number(row.kids);
  const adults = Number.isFinite(adultsRaw) ? Math.max(0, Math.trunc(adultsRaw)) : 0;
  const kids = Number.isFinite(kidsRaw) ? Math.max(0, Math.trunc(kidsRaw)) : 0;
  // The split columns are `not null default 0`, so a row that escaped the
  // migration's backfill would otherwise read as a zero-guest reply. A row that
  // still carries `attendees` but has no split is a legacy record: treat its
  // attendees as adults, exactly as migrations/0003 would have.
  if (!hasSplit || (adults === 0 && kids === 0 && attendees > 0)) {
    return { adults: Math.max(0, attendees), kids: 0 };
  }
  return { adults, kids };
}

/**
 * Normalize one guest-supplied headcount: integer, never negative, capped.
 * A declined reply carries no headcount at all.
 */
function toHeadcount(value: unknown, attendance: "attending" | "not-attending"): number {
  if (attendance !== "attending") return 0;
  const raw = Number(value);
  if (!Number.isFinite(raw)) return 0;
  return Math.min(Math.max(Math.trunc(raw), 0), MAX_HEADCOUNT);
}

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
  adults: number | string | null;
  kids: number | string | null;
  attendees: number | string;
  contact: string;
  message: string;
  submitted_at: string | Date;
};

function toHostRsvp(row: Row): HostRsvp {
  const { adults, kids } = readHeadcount(row);
  return {
    id: row.id,
    guestName: row.guest_name,
    attendance: row.attendance === "attending" ? "attending" : "not-attending",
    adults,
    kids,
    // Derived, never trusted as an independent value.
    attendees: adults + kids,
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
  adults: number;
  kids: number;
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
    const adults = toHeadcount(raw.adults, attendance);
    const kids = toHeadcount(raw.kids, attendance);
    // An attending party must bring at least one person (0 adults + 0 kids is
    // rejected here as well as in the form, so a crafted request cannot store
    // an empty attending reply).
    if (attendance === "attending" && adults + kids < 1) {
      throw new Error("Please tell us how many adults and kids are coming.");
    }
    return {
      guestName,
      attendance,
      adults,
      kids,
      contact: cleanField(raw.contact, 160),
      message: cleanField(raw.message, 1000),
    };
  })
  .handler(async ({ data }): Promise<{ ok: true }> => {
    const sql = await getSql();
    await sql`
      insert into rsvps (id, guest_name, attendance, adults, kids, attendees, contact, message)
      values (
        ${crypto.randomUUID()},
        ${data.guestName},
        ${data.attendance},
        ${data.adults},
        ${data.kids},
        ${data.adults + data.kids},
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
      select id, guest_name, attendance, adults, kids, attendees, contact, message, submitted_at
      from rsvps
      order by submitted_at desc
    `;
    return rows.map(toHostRsvp);
  },
);

// ── Host-only: edit a reply in place ─────────────────────────

export type UpdateRsvpInput = {
  id: string;
  guestName: string;
  attendance: "attending" | "not-attending";
  adults: number;
  kids: number;
  contact: string;
  message: string;
};

/**
 * Full-record edit. The host form always sends EVERY editable field, so this
 * writes them all in one statement: a field the host did not touch still carries
 * its loaded value and therefore cannot be blanked by accident (no partial-merge
 * guesswork, no undefined-written column).
 *
 * `attendees` is maintained as `adults + kids` so pre-split readers stay correct.
 * Changing attendance never deletes the row — it stays in the inbox and still
 * counts as a Reply; it simply stops contributing to the attending headcount.
 */
export const updateRsvpRecord = createServerFn({ method: "POST" })
  .validator((input: unknown): UpdateRsvpInput => {
    const raw = (input ?? {}) as Record<string, unknown>;
    const id = typeof raw.id === "string" ? raw.id.trim() : "";
    if (!id) throw new Error("Missing reply id.");
    const guestName = cleanField(raw.guestName, 120);
    if (!guestName) throw new Error("Please keep a guest name on the reply.");
    const attendance =
      raw.attendance === "not-attending" ? "not-attending" : "attending";
    const adults = toHeadcount(raw.adults, attendance);
    const kids = toHeadcount(raw.kids, attendance);
    if (attendance === "attending" && adults + kids < 1) {
      throw new Error("An attending reply needs at least one adult or kid.");
    }
    return {
      id,
      guestName,
      attendance,
      adults,
      kids,
      contact: cleanField(raw.contact, 160),
      message: cleanField(raw.message, 1000),
    };
  })
  .handler(async ({ data }): Promise<{ ok: true }> => {
    await requireHost();
    const sql = await getSql();
    await sql`
      update rsvps set
        guest_name = ${data.guestName},
        attendance = ${data.attendance},
        adults = ${data.adults},
        kids = ${data.kids},
        attendees = ${data.adults + data.kids},
        contact = ${data.contact},
        message = ${data.message}
      where id = ${data.id}
    `;
    return { ok: true };
  });

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
