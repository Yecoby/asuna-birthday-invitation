import { readFileSync, writeFileSync } from "node:fs";

const path = "scripts/dev-venue-check.mjs";
const lines = readFileSync(path, "utf8").split("\n");
const idx = lines.findIndex((l) => l.includes("sectionText: sec.innerText.replace"));
if (idx === -1) {
  console.error("target line not found");
  process.exit(1);
}
lines[idx] = '      sectionText: sec.innerText.replace(/\\s+/g, " ").trim(),';
writeFileSync(path, lines.join("\n"), "utf8");
console.log("fixed line", idx + 1);
