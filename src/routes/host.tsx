import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useCallback, useEffect, useState } from "react";
import {
  Trash2,
  RotateCcw,
  EyeOff,
  Eye,
  ShieldCheck,
  Download,
  ExternalLink,
  Calendar,
  Loader2,
  LogOut,
  Pencil,
} from "lucide-react";
import { event } from "@/lib/event";
import { saveTimerSettings, type TimerSettings } from "@/lib/countdown-settings";
import { getHostSession, signOutHost } from "@/lib/host-session";
import {
  clearRsvpRecords,
  deleteRsvpRecord,
  listRsvps,
  loadHostTimerSettings,
  saveHostTimerSettings,
  updateRsvpRecord,
  MAX_HEADCOUNT,
  type HostRsvp,
} from "@/lib/host-data";

export const Route = createFileRoute("/host")({ component: HostRoute });

/**
 * `/host` entry point — TWO states, decided by asking the SERVER:
 *
 *   1. not authenticated -> sign-in prompt
 *   2. authenticated     -> HostDesk (which then loads private data)
 *
 * There is no client-side "am I an admin?" test to defeat: `getHostSession` asks
 * the server, which resolves the HttpOnly session cookie. Editing React state or
 * localStorage cannot change that answer, and every private read is
 * independently re-checked by `requireHost()` on the server.
 */
function HostRoute() {
  const [authState, setAuthState] = useState<"checking" | "in" | "out">("checking");

  useEffect(() => {
    let cancelled = false;
    void getHostSession()
      .then((session) => {
        if (!cancelled) setAuthState(session.authenticated ? "in" : "out");
      })
      .catch(() => {
        if (!cancelled) setAuthState("out");
      });
    return () => {
      cancelled = true;
    };
  }, []);

  if (authState === "checking") return <HostPending />;
  if (authState === "out") return <SignInScreen />;
  return <HostDesk />;
}

function HostPending() {
  return (
    <main className="host-page grid min-h-svh place-items-center px-5">
      <p className="flex items-center gap-2 text-sm text-ink/60">
        <Loader2 className="h-4 w-4 animate-spin" />
        Checking your host access…
      </p>
    </main>
  );
}

function SignInScreen() {
  return (
    <main className="host-page grid min-h-svh place-items-center px-5 py-12">
      <div className="w-full max-w-md rounded-3xl border-stone-100 bg-white p-7 shadow-sm">
        <p className="eyebrow">Private Management</p>
        <h1 className="mb-2 text-3xl tracking-tight" style={{ fontFamily: "var(--font-display)" }}>
          Host Desk
        </h1>
        <p className="mb-5 text-sm text-ink/70">
          This area is for the host of {event.childFullName}’s celebration. Please sign in
          to manage guest replies and invitation settings.
        </p>
        <p className="mb-5 flex items-start gap-2 rounded-2xl border-emerald-200 bg-emerald-50/80 p-3.5 text-xs text-emerald-900">
          <ShieldCheck className="mt-0.5 h-4 w-4 shrink-0 text-emerald-600" />
          <span>
            Guest replies and host settings are protected by a server-verified admin
            session — they are never sent to an unauthenticated visitor.
          </span>
        </p>
        <Link
          to="/login"
          className="fg-btn fg-btn--solid flex w-full items-center justify-center gap-2"
        >
          <span>Go to Admin Login</span>
        </Link>
        <p className="mt-6 text-center text-sm">
          <Link to="/" className="underline underline-offset-4 hover:no-underline">
            ← Back to the invitation
          </Link>
        </p>
      </div>
    </main>
  );
}

/**
 * The desk itself. Mounted once the server confirmed the session; its first act
 * is to call the host-only server functions. If the session is missing or
 * expired the server answers 401, we send the visitor back to the login prompt,
 * and zero private data is rendered.
 */
function HostDesk() {
  const navigate = useNavigate();
  const [rsvps, setRsvps] = useState<HostRsvp[]>([]);
  const [timerSettings, setTimerState] = useState<TimerSettings>({ enabled: true, customDateISO: null });
  const [customInput, setCustomInput] = useState("");
  const [notice, setNotice] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [signingOut, setSigningOut] = useState(false);
  // The reply currently open in the edit dialog (null = closed).
  const [editing, setEditing] = useState<HostRsvp | null>(null);

  const refresh = useCallback(async () => {
    try {
      const [replies, settings] = await Promise.all([listRsvps(), loadHostTimerSettings()]);
      setRsvps(replies);
      setTimerState(settings);
      if (settings.customDateISO) setCustomInput(settings.customDateISO.slice(0, 16));
    } catch {
      // No valid session (401) — no private data reached this component. Send
      // the visitor back to the login prompt rather than showing a blank desk.
      setRsvps([]);
      void navigate({ to: "/login" });
    } finally {
      setLoading(false);
    }
  }, [navigate]);

  useEffect(() => {
    void refresh();
  }, [refresh]);

  const showFeedback = (msg: string) => {
    setNotice(msg);
    window.setTimeout(() => setNotice(null), 3000);
  };

  if (loading) return <HostPending />;

  const handleSignOut = async () => {
    if (signingOut) return;
    setSigningOut(true);
    try {
      // Server-side: the session row is invalidated and the cookie cleared.
      await signOutHost();
    } catch {
      /* fall through to the redirect — the desk must not stay open */
    }
    window.location.href = "/login";
  };

  // Headcount totals come from the loaded rows, never from a stored total:
  // `adults`/`kids` are summed across ATTENDING replies only, and "Guests coming"
  // is their sum. Declined replies stay in Replies and are excluded here.
  const attending = rsvps.filter((r) => r.attendance === "attending");
  const totals = attending.reduce(
    (sum, r) => ({ adults: sum.adults + r.adults, kids: sum.kids + r.kids }),
    { adults: 0, kids: 0 },
  );
  const guestsComing = totals.adults + totals.kids;

  const handleDeleteRsvp = async (id: string, name: string) => {
    if (!window.confirm(`Delete reply from ${name}?`)) return;
    try {
      await deleteRsvpRecord({ data: { id } });
      showFeedback(`Deleted reply from ${name}.`);
      await refresh();
    } catch {
      showFeedback("Could not delete that reply.");
    }
  };

  const handleToggleTimer = async () => {
    const nextEnabled = !timerSettings.enabled;
    const updated = await saveHostTimerSettings({
      data: { enabled: nextEnabled, customDateISO: timerSettings.customDateISO },
    });
    setTimerState(updated);
    // Guests read the countdown from their own browser; keep that copy in sync
    // for the person doing the editing.
    saveTimerSettings(updated);
    showFeedback(nextEnabled ? "Countdown timer enabled on invitation." : "No-timer mode activated: countdown is hidden.");
  };

  const handleResetTimer = async () => {
    // Read the date from config rather than repeating it, so this dialog can never
    // drift out of sync with the real event (it previously said October 17, 2026
    // while the invitation said November 03, 2026).
    if (
      !window.confirm(
        `Reset the countdown timer to the invitation's event date (${event.dateLabel})?`,
      )
    ) {
      return;
    }
    const reset = await saveHostTimerSettings({
      data: { enabled: true, customDateISO: null },
    });
    setTimerState(reset);
    saveTimerSettings(reset);
    setCustomInput("");
    showFeedback("Countdown timer reset to default event date.");
  };

  const handleSetCustomTimer = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!customInput) return;
    const parsed = new Date(customInput);
    if (isNaN(parsed.getTime())) {
      alert("Please enter a valid date and time.");
      return;
    }
    const saved = await saveHostTimerSettings({
      data: { enabled: true, customDateISO: parsed.toISOString() },
    });
    setTimerState(saved);
    saveTimerSettings(saved);
    showFeedback(`Custom timer date updated to ${parsed.toLocaleString()}.`);
  };

  const handleClearInbox = async () => {
    if (!window.confirm("Clear all RSVPs for this invitation?")) return;
    try {
      await clearRsvpRecords();
      showFeedback("Inbox cleared.");
      await refresh();
    } catch {
      showFeedback("Could not clear the inbox.");
    }
  };

  /**
   * Persist an edited reply, then re-read the inbox so every count on the desk
   * (Attending parties, Adults, Kids, Guests coming) reflects the new values.
   * Throws on failure so the dialog can keep the host's unsaved edits on screen.
   */
  const handleSaveRsvp = async (updated: {
    id: string;
    guestName: string;
    attendance: "attending" | "not-attending";
    adults: number;
    kids: number;
    contact: string;
    message: string;
  }) => {
    await updateRsvpRecord({ data: updated });
    await refresh();
    showFeedback(`Updated reply from ${updated.guestName}.`);
  };

  const currentDisplayDate = timerSettings.customDateISO
    ? new Date(timerSettings.customDateISO).toLocaleString()
    : `${event.dateLabel} · ${event.timeLabel}`;

  return (
    <main className="host-page mx-auto min-h-svh max-w-3xl px-5 py-10">
      <div className="host-desk__header mb-4">
        <div>
          <p className="eyebrow">Private Management</p>
          <h1 className="text-4xl tracking-tight" style={{ fontFamily: "var(--font-display)" }}>
            Host desk
          </h1>
        </div>
        <button
          type="button"
          onClick={() => void handleSignOut()}
          disabled={signingOut}
          className="flex cursor-pointer items-center gap-2 rounded-xl border-stone-200 bg-white px-4 py-2 text-sm font-semibold text-ink shadow-xs transition hover:bg-stone-50 disabled:cursor-wait disabled:opacity-70"
        >
          <LogOut className="h-4 w-4" />
          <span>{signingOut ? "Signing out…" : "Logout"}</span>
        </button>
      </div>
      <p className="mb-6 max-w-xl text-ink/80">
        Manage guest RSVPs and invitation countdown settings. Replies are stored on the server and visible only to authorized hosts.
      </p>

      {/* Authorization notice */}
      <div className="mb-8 flex items-start gap-3 rounded-2xl border border-emerald-200 bg-emerald-50/80 p-4 text-sm text-emerald-900 shadow-sm">
        <ShieldCheck className="mt-0.5 h-5 w-5 shrink-0 text-emerald-600" />
        <div>
          <strong className="block font-semibold">Verified host session</strong>
          <span>
            You are signed in as an authorized host. Every reply here is served by a host-only request — other visitors cannot read it, even by calling the endpoint directly.
          </span>
        </div>
      </div>

      {notice && (
        <div className="mb-6 rounded-xl border border-purple-200 bg-purple-50 px-4 py-2.5 text-sm font-medium text-purple-900 shadow-sm animate-fade-in">
          {notice}
        </div>
      )}

      {/* Stats Summary */}
      <div className="mb-8 grid grid-cols-3 gap-3">
        <Stat label="Replies" value={String(rsvps.length)} />
        <Stat label="Attending parties" value={String(attending.length)} />
        <Stat label="Guests coming" value={String(guestsComing)} detail={`${totals.adults} Adults · ${totals.kids} Kids`} />
      </div>

      {/* Quick Actions */}
      <div className="mb-8 flex flex-wrap gap-3">
        <Link to="/" className="fg-btn fg-btn--glow flex items-center gap-2">
          <span>Open invitation</span>
          <ExternalLink className="h-4 w-4" />
        </Link>
        <button
          type="button"
          className="fg-btn fg-btn--solid flex items-center gap-2"
          onClick={() => {
            const blob = new Blob([JSON.stringify(rsvps, null, 2)], { type: "application/json" });
            const url = URL.createObjectURL(blob);
            const a = document.createElement("a");
            a.href = url;
            a.download = "iria-asuna-rsvps.json";
            a.click();
            URL.revokeObjectURL(url);
          }}
        >
          <Download className="h-4 w-4" />
          <span>Download RSVPs</span>
        </button>
        <button
          type="button"
          className="fg-btn flex items-center gap-2"
          style={{ background: "#fff", border: "1px solid color-mix(in oklab, var(--color-ink) 14%, transparent)" }}
          onClick={() => void handleClearInbox()}
        >
          <Trash2 className="h-4 w-4 text-rose-500" />
          <span>Clear inbox</span>
        </button>
      </div>

      {/* Countdown Timer Controls */}
      <section className="mb-10 rounded-2xl bg-white p-6 shadow-sm border border-stone-100">
        <div className="mb-4 flex flex-wrap items-center justify-between gap-3">
          <div>
            <h2 className="text-2xl font-bold" style={{ fontFamily: "var(--font-display)" }}>
              Countdown Timer Controls
            </h2>
            <p className="text-sm text-ink/70">Control or reset the invitation countdown timer.</p>
          </div>
          <span
            className={`inline-flex items-center gap-1.5 rounded-full px-3 py-1 text-xs font-bold tracking-wide uppercase ${
              timerSettings.enabled ? "bg-emerald-100 text-emerald-800" : "bg-stone-200 text-stone-700"
            }`}
          >
            <span className={`h-2 w-2 rounded-full ${timerSettings.enabled ? "bg-emerald-500" : "bg-stone-400"}`} />
            {timerSettings.enabled ? "Timer Active" : "No Timer Mode"}
          </span>
        </div>

        <div className="mb-4 rounded-xl bg-stone-50 p-3.5 text-sm text-ink/80 flex flex-wrap items-center justify-between gap-2">
          <div>
            <span className="text-xs uppercase font-bold text-ink/50 block">Current Target Date</span>
            <span className="font-semibold text-ink">{currentDisplayDate}</span>
            {timerSettings.customDateISO && (
              <span className="ml-2 inline-block text-xs text-purple-700 font-medium">(Custom date active)</span>
            )}
          </div>
        </div>

        <div className="flex flex-wrap items-center gap-3">
          <button
            type="button"
            onClick={() => void handleToggleTimer()}
            className="flex items-center gap-2 rounded-xl border border-stone-200 bg-white px-4 py-2 text-sm font-semibold text-ink hover:bg-stone-50 transition cursor-pointer shadow-xs"
          >
            {timerSettings.enabled ? (
              <>
                <EyeOff className="h-4 w-4 text-amber-600" />
                <span>Switch to No Timer</span>
              </>
            ) : (
              <>
                <Eye className="h-4 w-4 text-emerald-600" />
                <span>Show Timer</span>
              </>
            )}
          </button>

          <button
            type="button"
            onClick={() => void handleResetTimer()}
            className="flex items-center gap-2 rounded-xl border border-purple-200 bg-purple-50 px-4 py-2 text-sm font-semibold text-purple-800 hover:bg-purple-100 transition cursor-pointer shadow-xs"
            title="Reset timer to original event date"
          >
            <RotateCcw className="h-4 w-4 text-purple-600" />
            <span>Reset Timer to Default</span>
          </button>
        </div>

        <form onSubmit={(e) => void handleSetCustomTimer(e)} className="mt-4 pt-4 border-t border-stone-100 flex flex-wrap items-center gap-2">
          <div className="flex items-center gap-2">
            <Calendar className="h-4 w-4 text-ink/50" />
            <label htmlFor="custom-timer-date" className="text-xs font-semibold text-ink/70">
              Set custom timer date:
            </label>
          </div>
          <input
            id="custom-timer-date"
            type="datetime-local"
            value={customInput}
            onChange={(e) => setCustomInput(e.target.value)}
            className="rounded-lg border border-stone-300 bg-white px-2.5 py-1.5 text-xs text-ink focus:border-purple-500 focus:outline-none"
          />
          <button
            type="submit"
            className="rounded-lg bg-stone-800 px-3 py-1.5 text-xs font-semibold text-white hover:bg-black transition cursor-pointer"
          >
            Apply Date
          </button>
        </form>
      </section>

      {/* Inbox with Individual Delete */}
      <section>
        <div className="mb-4 flex items-center justify-between">
          <h2 className="text-2xl" style={{ fontFamily: "var(--font-display)" }}>
            Inbox ({rsvps.length})
          </h2>
        </div>

        {rsvps.length === 0 ? (
          <p className="rounded-2xl bg-white p-6 text-ink/70 shadow-sm border border-stone-100">
            No replies yet. They will appear here after guests submit the form.
          </p>
        ) : (
          <ul className="grid gap-3">
            {rsvps.map((r) => (
              <li
                key={r.id}
                className="group rounded-2xl bg-white p-4 shadow-sm border border-stone-100 transition hover:shadow-md"
              >
                <div className="flex flex-wrap items-baseline justify-between gap-2">
                  <strong className="text-lg text-ink font-semibold">{r.guestName}</strong>
                  <div className="flex items-center gap-3">
                    <span
                      className={`text-xs font-bold tracking-wide uppercase px-2.5 py-1 rounded-full ${
                        r.attendance === "attending"
                          ? "bg-emerald-100 text-emerald-800"
                          : "bg-purple-100 text-purple-800"
                      }`}
                    >
                      {r.attendance === "attending" ? `Attending · ${r.attendees}` : "Sending wishes"}
                    </span>
                    <button
                      type="button"
                      aria-label={`Edit RSVP from ${r.guestName}`}
                      onClick={() => setEditing(r)}
                      className="flex items-center gap-1 rounded-lg border border-stone-200 bg-white px-2.5 py-1 text-xs font-semibold text-ink hover:bg-stone-50 transition cursor-pointer"
                      title="Edit this reply"
                    >
                      <Pencil className="h-3.5 w-3.5 text-ink/60" />
                      <span>Edit</span>
                    </button>
                    <button
                      type="button"
                      aria-label={`Delete RSVP from ${r.guestName}`}
                      onClick={() => void handleDeleteRsvp(r.id, r.guestName)}
                      className="flex items-center gap-1 rounded-lg border border-rose-200 bg-rose-50 px-2.5 py-1 text-xs font-semibold text-rose-700 hover:bg-rose-100 transition cursor-pointer"
                      title="Delete this reply"
                    >
                      <Trash2 className="h-3.5 w-3.5 text-rose-600" />
                      <span>Delete</span>
                    </button>
                  </div>
                </div>
                {/* Headcount breakdown for an attending party. Declined replies
                    carry no headcount, so they show only the status pill. */}
                {r.attendance === "attending" && (
                  <div className="mt-2 flex flex-wrap items-center gap-x-4 gap-y-1 text-sm">
                    <span className="text-ink/70">
                      Adults: <strong className="tabular-nums text-ink">{r.adults}</strong>
                    </span>
                    <span className="text-ink/70">
                      Kids: <strong className="tabular-nums text-ink">{r.kids}</strong>
                    </span>
                    <span className="text-ink/70">
                      Total: <strong className="tabular-nums text-ink">{r.attendees}</strong>
                    </span>
                  </div>
                )}
                <p className="mt-1 text-sm text-ink/70">Contact: {r.contact || "—"}</p>
                {r.message ? (
                  <p className="mt-2 rounded-xl bg-stone-50 p-2.5 text-sm text-ink/90 italic">
                    "{r.message}"
                  </p>
                ) : null}
                <p className="mt-2 text-xs text-ink/50">{new Date(r.createdAt).toLocaleString()}</p>
              </li>
            ))}
          </ul>
        )}
      </section>

      {editing && (
        <EditRsvpDialog
          record={editing}
          onClose={() => setEditing(null)}
          onSave={handleSaveRsvp}
        />
      )}

      {/* Guide Section */}
      <section className="mt-12 border-t border-stone-200 pt-8">
        <h2 className="mb-3 text-2xl" style={{ fontFamily: "var(--font-display)" }}>
          Managing hosts &amp; content
        </h2>
        <ol className="grid list-decimal gap-2 pl-5 text-ink/85 text-sm">
          <li>The admin login is configured with the <code>ADMIN_USERNAME</code> and <code>ADMIN_PASSWORD</code> environment variables (server-only).</li>
          <li>Guest-facing words, date, and venue are in <code>src/lib/event.ts</code>.</li>
          <li>Photos live in <code>public/invitation/</code> — replace a file with the same name to swap the artwork.</li>
        </ol>
        <p className="mt-4 text-xs text-ink/60">
          Current celebrant: {event.childFullName} · {event.dateLabel} · {event.venueName}
        </p>
      </section>
    </main>
  );
}

function Stat({ label, value, detail }: { label: string; value: string; detail?: string }) {
  return (
    <div className="rounded-2xl bg-white p-4 text-center shadow-sm border border-stone-100">
      <strong className="block text-3xl tabular-nums" style={{ fontFamily: "var(--font-display)" }}>
        {value}
      </strong>
      <span className="text-xs font-extrabold tracking-widest text-lavender uppercase">{label}</span>
      {detail ? (
        <span className="mt-1 block text-[0.7rem] font-semibold tabular-nums text-ink/60">
          {detail}
        </span>
      ) : null}
    </div>
  );
}

/**
 * The host's full-record editor.
 *
 * Opened from a reply in the inbox. It edits every field the guest supplied plus
 * the attendance status and the Adults/Kids split, and always sends the COMPLETE
 * record on save — so a field the host never touched keeps its loaded value
 * instead of being blanked.
 *
 * "Total guests" is shown read-only and is always `adults + kids`; nobody types
 * it, and the server derives the stored `attendees` the same way.
 *
 * On failure the dialog stays open with the host's edits intact and shows the
 * error, rather than closing as though the save had succeeded.
 */
function EditRsvpDialog({
  record,
  onClose,
  onSave,
}: {
  record: HostRsvp;
  onClose: () => void;
  onSave: (next: {
    id: string;
    guestName: string;
    attendance: "attending" | "not-attending";
    adults: number;
    kids: number;
    contact: string;
    message: string;
  }) => Promise<void>;
}) {
  const [guestName, setGuestName] = useState(record.guestName);
  const [attendance, setAttendance] = useState<"attending" | "not-attending">(record.attendance);
  const [adults, setAdults] = useState(record.adults);
  const [kids, setKids] = useState(record.kids);
  const [contact, setContact] = useState(record.contact);
  const [message, setMessage] = useState(record.message);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const isAttending = attendance === "attending";
  const total = adults + kids;

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (saving) return;
    // Same rules as the guest form: a real name, a valid number, and at least one
    // person on an attending reply. A declined reply stores no headcount.
    const problems: string[] = [];
    if (guestName.trim().length < 2) problems.push("Please keep a guest name on the reply.");
    if (contact.replace(/\D/g, "").length < 7) problems.push("Please enter a valid contact number.");
    if (isAttending && total < 1) problems.push("An attending reply needs at least one adult or kid.");
    if (problems.length) {
      setError(problems[0]);
      return;
    }
    setError(null);
    setSaving(true);
    try {
      await onSave({
        id: record.id,
        guestName: guestName.trim(),
        attendance,
        adults: isAttending ? adults : 0,
        kids: isAttending ? kids : 0,
        contact: contact.trim(),
        message: message.trim(),
      });
      onClose();
    } catch (err) {
      setError(err instanceof Error && err.message ? err.message : "Could not save the reply.");
    } finally {
      setSaving(false);
    }
  };

  return (
    <div
      className="fixed inset-0 z-50 grid place-items-center overflow-y-auto bg-ink/40 px-4 py-8"
      role="dialog"
      aria-modal="true"
      aria-labelledby="editRsvpTitle"
      onClick={(e) => {
        if (e.target === e.currentTarget && !saving) onClose();
      }}
    >
      <form
        onSubmit={(e) => void handleSubmit(e)}
        className="w-full max-w-lg rounded-2xl border-stone-100 bg-white p-6 shadow-lg"
      >
        <h2
          className="text-2xl"
          id="editRsvpTitle"
          style={{ fontFamily: "var(--font-display)" }}
        >
          Edit RSVP
        </h2>
        <p className="mt-1 mb-5 text-sm text-ink/70">
          Reply received {new Date(record.createdAt).toLocaleString()}
        </p>

        <fieldset className="mb-5 grid gap-3" disabled={saving}>
          <legend className="mb-2 text-xs font-extrabold tracking-widest text-lavender uppercase">
            Guest Information
          </legend>
          <div className="field">
            <label htmlFor="editGuestName">Guest Name</label>
            <input
              id="editGuestName"
              type="text"
              value={guestName}
              maxLength={100}
              onChange={(e) => setGuestName(e.target.value)}
            />
          </div>
          <div className="field">
            <label htmlFor="editContact">Contact Number</label>
            <input
              id="editContact"
              type="tel"
              value={contact}
              maxLength={20}
              onChange={(e) => setContact(e.target.value)}
            />
          </div>
        </fieldset>

        <fieldset className="mb-5" disabled={saving}>
          <legend className="mb-2 text-xs font-extrabold tracking-widest text-lavender uppercase">
            Attendance
          </legend>
          <div className="flex flex-wrap gap-2">
            <label
              className={`cursor-pointer rounded-xl border px-3.5 py-2 text-sm font-semibold transition ${
                isAttending
                  ? "border-emerald-300 bg-emerald-50 text-emerald-800"
                  : "border-stone-200 bg-white text-ink hover:bg-stone-50"
              }`}
            >
              <input
                className="mr-2"
                type="radio"
                name="editAttendance"
                value="attending"
                checked={isAttending}
                onChange={() => setAttendance("attending")}
              />
              Attending
            </label>
            <label
              className={`cursor-pointer rounded-xl border px-3.5 py-2 text-sm font-semibold transition ${
                !isAttending
                  ? "border-purple-300 bg-purple-50 text-purple-800"
                  : "border-stone-200 bg-white text-ink hover:bg-stone-50"
              }`}
            >
              <input
                className="mr-2"
                type="radio"
                name="editAttendance"
                value="not-attending"
                checked={!isAttending}
                onChange={() => setAttendance("not-attending")}
              />
              Not attending
            </label>
          </div>
        </fieldset>

        <fieldset className="mb-5" disabled={saving || !isAttending}>
          <legend className="mb-2 text-xs font-extrabold tracking-widest text-lavender uppercase">
            Headcount
          </legend>
          <div className="grid gap-2.5">
            <HeadcountRow label="Adults" value={adults} onChange={setAdults} />
            <HeadcountRow label="Kids" value={kids} onChange={setKids} />
            <p className="rounded-xl bg-stone-50 px-3.5 py-2 text-sm text-ink">
              Total guests:{" "}
              <strong
                className="tabular-nums"
                style={{ fontFamily: "var(--font-display)", fontSize: "1.2rem" }}
              >
                {isAttending ? total : 0}
              </strong>
            </p>
            {!isAttending && (
              <p className="text-xs text-ink/60">
                A reply that is not attending keeps its record but counts as no guests.
              </p>
            )}
          </div>
        </fieldset>

        <div className="field mb-5">
          <label htmlFor="editMessage">Message for Iria</label>
          <textarea
            id="editMessage"
            rows={3}
            maxLength={500}
            value={message}
            onChange={(e) => setMessage(e.target.value)}
          />
        </div>

        {error && (
          <p className="mb-4 rounded-xl border-rose-200 bg-rose-50 px-3.5 py-2.5 text-sm font-medium text-rose-800">
            {error}
          </p>
        )}

        <div className="flex flex-wrap items-center gap-3">
          <button
            type="submit"
            className="fg-btn fg-btn--solid flex items-center gap-2"
            disabled={saving}
          >
            {saving && <Loader2 className="h-4 w-4 animate-spin" />}
            <span>{saving ? "Saving…" : "Save Changes"}</span>
          </button>
          <button
            type="button"
            onClick={onClose}
            disabled={saving}
            className="rounded-xl border-stone-200 bg-white px-4 py-2 text-sm font-semibold text-ink hover:bg-stone-50 transition cursor-pointer shadow-xs disabled:cursor-not-allowed disabled:opacity-60"
          >
            Cancel
          </button>
        </div>
      </form>
    </div>
  );
}

/** One `− 0 +` headcount row in the edit dialog. Never goes below 0 or above the cap. */
function HeadcountRow({
  label,
  value,
  onChange,
}: {
  label: string;
  value: number;
  onChange: (next: number) => void;
}) {
  const set = (next: number) => onChange(Math.min(Math.max(Math.trunc(next), 0), MAX_HEADCOUNT));
  return (
    <div className="flex items-center justify-between gap-3 rounded-xl border-stone-200 bg-white px-3 py-1.5">
      <span className="text-sm font-semibold text-ink">{label}</span>
      <div className="flex items-center gap-1.5">
        <button
          type="button"
          aria-label={`Remove one ${label.toLowerCase()}`}
          disabled={value <= 0}
          onClick={() => set(value - 1)}
          className="grid h-9 w-9 place-items-center rounded-lg border-stone-200 bg-stone-50 text-lg font-bold text-ink hover:bg-stone-100 transition cursor-pointer disabled:cursor-not-allowed disabled:opacity-45"
        >
          −
        </button>
        <output
          className="min-w-9 text-center tabular-nums"
          style={{ fontFamily: "var(--font-display)", fontSize: "1.4rem" }}
          aria-live="polite"
        >
          {value}
        </output>
        <button
          type="button"
          aria-label={`Add one ${label.toLowerCase()}`}
          disabled={value >= MAX_HEADCOUNT}
          onClick={() => set(value + 1)}
          className="grid h-9 w-9 place-items-center rounded-lg border-stone-200 bg-stone-50 text-lg font-bold text-ink hover:bg-stone-100 transition cursor-pointer disabled:cursor-not-allowed disabled:opacity-45"
        >
          +
        </button>
      </div>
    </div>
  );
}
