// Installation en une commande : npm run setup
// Vérifie Node et ffmpeg, installe les dépendances, génère la banque SFX / musiques.
import fs from "node:fs";
import path from "node:path";
import { execFileSync, spawnSync } from "node:child_process";
import { fileURLToPath } from "node:url";

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const ok = (m) => console.log(`✓ ${m}`);
const ko = (m) => console.log(`✗ ${m}`);
let fail = false;

const major = Number(process.versions.node.split(".")[0]);
if (major >= 20) ok(`Node ${process.versions.node}`);
else {
  ko(`Node ${process.versions.node} : il faut Node 20 ou plus (https://nodejs.org)`);
  fail = true;
}

const has = (bin) => spawnSync(bin, ["-version"], { stdio: "ignore" }).status === 0;
if (has("ffmpeg") && has("ffprobe")) ok("ffmpeg / ffprobe");
else {
  const how =
    process.platform === "win32"
      ? "winget install --id Gyan.FFmpeg -e   (puis ferme et rouvre le terminal / l'app)"
      : process.platform === "darwin"
        ? "brew install ffmpeg"
        : "sudo apt install ffmpeg";
  ko(`ffmpeg introuvable. Installe-le : ${how}`);
  fail = true;
}
if (fail) process.exit(1);

const npm = process.platform === "win32" ? "npm.cmd" : "npm";
if (!fs.existsSync(path.join(ROOT, "node_modules", "remotion"))) {
  console.log("Installation des dépendances (npm install)…");
  execFileSync(npm, ["install", "--no-audit", "--no-fund"], { cwd: ROOT, stdio: "inherit", shell: process.platform === "win32" });
}
ok("dépendances");

execFileSync(process.execPath, [path.join(ROOT, "scripts", "make-sfx.mjs")], { cwd: ROOT, stdio: "inherit" });
ok("banque SFX + musiques");

console.log("\nPrêt. Test : npm run episode -- --affaire demo-fictive --draft");
