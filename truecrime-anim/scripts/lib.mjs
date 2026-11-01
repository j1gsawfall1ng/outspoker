// Utilitaires communs aux scripts du pipeline.
import fs from "node:fs";
import path from "node:path";
import { execFileSync, spawnSync } from "node:child_process";
import { fileURLToPath, pathToFileURL } from "node:url";

export const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
export const PUBLIC = path.join(ROOT, "public");

// Charge .env (sans dépendance) sans écraser les variables déjà définies
const envFile = path.join(ROOT, ".env");
if (fs.existsSync(envFile)) {
  for (const line of fs.readFileSync(envFile, "utf8").split(/\r?\n/)) {
    const m = /^\s*([A-Z0-9_]+)\s*=\s*(.*)\s*$/.exec(line);
    if (m && !process.env[m[1]] && m[2]) process.env[m[1]] = m[2].replace(/^["']|["']$/g, "");
  }
}

export const args = (() => {
  const out = { _: [] };
  const a = process.argv.slice(2);
  for (let i = 0; i < a.length; i++) {
    if (a[i].startsWith("--")) {
      const key = a[i].slice(2);
      if (key.includes("=")) {
        const [k, v] = key.split("=");
        out[k] = v;
      } else if (a[i + 1] && !a[i + 1].startsWith("--")) out[key] = a[++i];
      else out[key] = true;
    } else out._.push(a[i]);
  }
  return out;
})();

export const style = JSON.parse(fs.readFileSync(path.join(ROOT, "style.json"), "utf8"));

export const readJson = (p) => JSON.parse(fs.readFileSync(p, "utf8"));
export const writeJson = (p, data) => {
  fs.mkdirSync(path.dirname(p), { recursive: true });
  fs.writeFileSync(p, JSON.stringify(data, null, 2) + "\n");
};

export function episode() {
  const slug = args.affaire ?? args._[0];
  if (!slug) {
    console.error("Usage : --affaire <slug>  (dossier dans public/episodes/)");
    process.exit(1);
  }
  const dir = path.join(PUBLIC, "episodes", slug);
  return {
    slug,
    dir,
    rel: (f) => `episodes/${slug}/${f}`,
    script: path.join(dir, "script.json"),
    shots: path.join(dir, "shots.json"),
    alignment: path.join(dir, "alignment.json"),
    voice: path.join(dir, "voice.mp3"),
    bgDir: path.join(dir, "bg"),
    props: path.join(dir, "render.json"),
    out: path.join(ROOT, "out", slug),
  };
}

// Vrai si l'outil répond (Windows, macOS, Linux)
export const has = (bin) => spawnSync(bin, ["-version"], { stdio: "ignore" }).status === 0;

// Vrai si le fichier courant est lancé directement (fonctionne avec espaces et chemins Windows)
export const isMain = (metaUrl) => !!process.argv[1] && metaUrl === pathToFileURL(path.resolve(process.argv[1])).href;

// Lance la CLI Remotion via node (pas de npx : évite les soucis de .cmd et d'espaces sous Windows)
export const remotion = (cliArgs) => {
  const cli = path.join(ROOT, "node_modules", "@remotion", "cli", "remotion-cli.js");
  execFileSync(process.execPath, [cli, ...cliArgs], { cwd: ROOT, stdio: "inherit" });
};

export const audioDuration = (file) => {
  const out = execFileSync("ffprobe", ["-v", "error", "-show_entries", "format=duration", "-of", "csv=p=0", file]).toString().trim();
  return Number(out);
};

export const slugify = (s) =>
  s
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-|-$/g, "");

export const norm = (w) =>
  w
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .toLowerCase()
    .replace(/[^a-z0-9']/g, "");

// Découpe le texte voix off en mots, en gardant l'indice de phrase
export function sentenceWords(sentences) {
  const words = [];
  sentences.forEach((s, i) => {
    for (const w of s.text.split(/\s+/).filter(Boolean)) words.push({ text: w, sentence: i });
  });
  return words;
}
