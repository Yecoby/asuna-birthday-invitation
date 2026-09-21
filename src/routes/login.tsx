import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useState } from "react";
import { KeyRound, Lock, ShieldCheck, Sparkles, User } from "lucide-react";
import { signInHost } from "@/lib/host-session";

export const Route = createFileRoute("/login")({ component: Login });

/**
 * Admin sign-in for the Host Desk. Deliberately NOT linked from the public
 * invitation — reached by typing /login, or by /host sending an unauthenticated
 * visitor here.
 *
 * The credentials are POSTed to a server function which verifies them and issues
 * an HttpOnly session cookie. Nothing about "being an admin" is decided in this
 * component: successful verification is the only way the session exists, and
 * every Host Desk request re-checks it on the server.
 */
function Login() {
  const navigate = useNavigate();
  const [username, setUsername] = useState("");
  const [password, setPassword] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function onSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    if (busy) return;
    setBusy(true);
    setError(null);
    try {
      const result = await signInHost({
        data: { username, password },
      });
      if (result.ok) {
        // The session cookie is set; hand off to the desk (server re-verifies).
        await navigate({ to: "/host" });
        return;
      }
      setError(result.message);
      setPassword("");
    } catch {
      setError("Invalid username or password.");
      setPassword("");
    } finally {
      setBusy(false);
    }
  }

  return (
    <main className="host-page grid min-h-svh place-items-center px-5 py-12">
      <div className="w-full max-w-md rounded-3xl border-stone-100 bg-white p-7 shadow-sm">
        <p className="eyebrow">Private Management</p>
        <h1
          className="mb-2 text-3xl tracking-tight"
          style={{ fontFamily: "var(--font-display)" }}
        >
          Admin Login
        </h1>
        <p className="mb-6 text-sm text-ink/70">
          This area is for the host of the celebration. Sign in to manage guest
          replies and invitation settings.
        </p>

        <form onSubmit={onSubmit} className="flex flex-col gap-4" noValidate>
          <div className="flex flex-col gap-1.5">
            <label
              htmlFor="admin-username"
              className="text-xs font-semibold uppercase tracking-wide text-ink/60"
            >
              Username
            </label>
            <div className="flex items-center gap-2 rounded-xl border-stone-300 bg-white px-3 py-2 focus-within:border-purple-400">
              <User className="h-4 w-4 shrink-0 text-ink/40" />
              <input
                id="admin-username"
                name="username"
                type="text"
                autoComplete="username"
                autoCapitalize="none"
                spellCheck={false}
                required
                value={username}
                onChange={(e) => setUsername(e.target.value)}
                className="w-full bg-transparent text-sm text-ink outline-none"
                placeholder="Admin"
              />
            </div>
          </div>

          <div className="flex flex-col gap-1.5">
            <label
              htmlFor="admin-password"
              className="text-xs font-semibold uppercase tracking-wide text-ink/60"
            >
              Password
            </label>
            <div className="flex items-center gap-2 rounded-xl border-stone-300 bg-white px-3 py-2 focus-within:border-purple-400">
              <KeyRound className="h-4 w-4 shrink-0 text-ink/40" />
              <input
                id="admin-password"
                name="password"
                type="password"
                autoComplete="current-password"
                required
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                className="w-full bg-transparent text-sm text-ink outline-none"
                placeholder="••"
              />
            </div>
          </div>

          <button
            type="submit"
            disabled={busy}
            className="fg-btn fg-btn--solid flex w-full items-center justify-center gap-2 disabled:cursor-wait disabled:opacity-70"
          >
            <Lock className="h-4 w-4" />
            <span>{busy ? "Signing in…" : "Login"}</span>
          </button>

          {error && (
            <p
              role="alert"
              className="rounded-xl border-rose-200 bg-rose-50 px-4 py-2.5 text-sm text-rose-800"
            >
              {error}
            </p>
          )}
        </form>

        <div className="mt-6 grid gap-2.5 border-t border-stone-100 pt-5 text-xs text-ink/60">
          <span className="flex items-center gap-2">
            <ShieldCheck className="h-4 w-4 shrink-0 text-emerald-600" />
            Credentials are verified on the server; the session is an HttpOnly cookie.
          </span>
          <span className="flex items-center gap-2">
            <Sparkles className="h-4 w-4 shrink-0 text-purple-500" />
            Guests never need to sign in — the invitation itself is public.
          </span>
        </div>

        <p className="mt-6 text-center text-sm">
          <Link to="/" className="underline underline-offset-4 hover:no-underline">
            ← Back to the invitation
          </Link>
        </p>
      </div>
    </main>
  );
}
