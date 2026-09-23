/**
 * Dev/QA runner: boot the dev server, run a QA script against it, then shut down.
 * Same-process so the server isn't torn down mid-run.
 * Usage: node scripts/with-dev-server.mjs <script.mjs>
 */
import { spawn } from "node:child_process";

const target = process.argv[2];
if (!target) {
  console.error("usage: node scripts/with-dev-server.mjs <script.mjs>");
  process.exit(1);
}

const dev = spawn("npm run dev", { stdio: ["ignore", "pipe", "pipe"], shell: true });
dev.stdout.on("data", (d) => process.stdout.write(`[dev] ${d}`));
dev.stderr.on("data", (d) => process.stdout.write(`[dev:err] ${d}`));

async function waitForServer(timeoutMs = 90000) {
  const deadline = Date.now() + timeoutMs;
  while (Date.now() < deadline) {
    try {
      const r = await fetch("http://127.0.0.1:8080/");
      if (r.ok) return true;
    } catch {
      /* not up yet */
    }
    await new Promise((r) => setTimeout(r, 500));
  }
  return false;
}

if (!(await waitForServer())) {
  console.error("dev server never came up");
  dev.kill();
  process.exit(1);
}
console.log("[dev] ready");

const child = spawn(process.execPath, [target, "http://127.0.0.1:8080/"], {
  stdio: "inherit",
  shell: false,
});

const code = await new Promise((resolve) => child.on("exit", resolve));
dev.kill();
process.exit(code ?? 0);
