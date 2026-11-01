// Décors IA : un fichier par lieu unique, style verrouillé (prompt de base + image de référence).
// Ordre de résolution pour chaque slug :
//   1. public/episodes/<affaire>/bg/<slug>.(png|jpg|jpeg|webp)  (déposé à la main depuis l'app Gemini)
//   2. public/bg-cache/<slug>.png                              (réutilisé entre épisodes)
//   3. génération via l'API Gemini (GEMINI_API_KEY)
//   4. sinon : décor de secours procédural + prompts.md pour générer à la main dans Gemini
// Usage : npm run bg -- --affaire <slug> [--verify] [--force] [--only slug1,slug2]
import fs from "node:fs";
import path from "node:path";
import { execFileSync } from "node:child_process";
import { args, episode, readJson, style, ROOT, PUBLIC, has } from "./lib.mjs";

const ep = episode();
const shots = readJson(ep.shots);
const KEY = process.env.GEMINI_API_KEY || process.env.GOOGLE_API_KEY;
const MODEL = process.env.GEMINI_IMAGE_MODEL || style.backgrounds.model;
const VISION_MODEL = process.env.GEMINI_VISION_MODEL || "gemini-2.5-flash";
const cacheDir = path.join(PUBLIC, "bg-cache");
fs.mkdirSync(ep.bgDir, { recursive: true });
fs.mkdirSync(cacheDir, { recursive: true });

const decors = shots.decors ?? {};
const used = new Set();
for (const s of shots.shots) {
  used.add(s.bg);
  if (s.insert?.type === "polaroid" && s.insert.bg) used.add(s.insert.bg);
}
const only = args.only ? new Set(String(args.only).split(",")) : null;

const promptFor = (slug) => {
  const desc = decors[slug] ?? slug.replace(/-/g, " ");
  return `${style.backgrounds.basePrompt}. Scene: ${desc}. Leave the lower third fairly empty (characters will be added later). Absolutely no people, no silhouettes, no readable text, no logos.`;
};

const refPath = path.join(ROOT, style.backgrounds.reference);
const reference = fs.existsSync(refPath) ? fs.readFileSync(refPath).toString("base64") : null;

const findLocal = (slug) => {
  for (const ext of ["png", "jpg", "jpeg", "webp"]) {
    const p = path.join(ep.bgDir, `${slug}.${ext}`);
    if (fs.existsSync(p)) return p;
  }
  return null;
};

// recadre / redimensionne en 1080x1920 (9:16)
const normalizeImage = (src, dst) => {
  if (!has("ffmpeg")) {
    fs.copyFileSync(src, dst);
    return;
  }
  const tmp = dst + ".tmp.png";
  execFileSync("ffmpeg", ["-y", "-loglevel", "error", "-i", src, "-vf", "scale=1080:1920:force_original_aspect_ratio=increase,crop=1080:1920", "-frames:v", "1", tmp]);
  fs.renameSync(tmp, dst);
};

async function gemini(model, parts, imageOut) {
  const body = { contents: [{ role: "user", parts }] };
  if (imageOut) body.generationConfig = { responseModalities: ["IMAGE"], imageConfig: { aspectRatio: "9:16" } };
  const res = await fetch(`https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent`, {
    method: "POST",
    headers: { "x-goog-api-key": KEY, "Content-Type": "application/json" },
    body: JSON.stringify(body),
  });
  if (!res.ok) throw new Error(`Gemini ${res.status} : ${(await res.text()).slice(0, 400)}`);
  return res.json();
}

async function generate(slug) {
  const parts = [];
  if (reference) {
    parts.push({ text: "Use the attached image strictly as a STYLE reference (palette, flat shapes, lighting). Do not copy its content." });
    parts.push({ inlineData: { mimeType: "image/png", data: reference } });
  }
  parts.push({ text: promptFor(slug) });
  const j = await gemini(MODEL, parts, true);
  const img = j.candidates?.[0]?.content?.parts?.find((p) => p.inlineData)?.inlineData;
  if (!img) throw new Error(`Pas d'image renvoyée pour ${slug} : ${JSON.stringify(j).slice(0, 300)}`);
  const raw = path.join(ep.bgDir, `${slug}.raw.png`);
  fs.writeFileSync(raw, Buffer.from(img.data, "base64"));
  return raw;
}

async function verify(file) {
  const data = fs.readFileSync(file).toString("base64");
  const j = await gemini(VISION_MODEL, [
    { inlineData: { mimeType: "image/png", data } },
    { text: 'Answer ONLY with JSON {"dark": bool, "text": bool, "people": bool}. dark = mostly dark navy night palette; text = any letters/words visible; people = any person or silhouette.' },
  ]);
  const txt = j.candidates?.[0]?.content?.parts?.map((p) => p.text ?? "").join("") ?? "";
  const m = /\{[\s\S]*\}/.exec(txt);
  const r = m ? JSON.parse(m[0]) : { dark: true, text: false, people: false };
  return { ok: r.dark && !r.text && !r.people, r };
}

const missing = [];
for (const slug of used) {
  if (only && !only.has(slug)) continue;
  const final = path.join(ep.bgDir, `${slug}.png`);
  const cached = path.join(cacheDir, `${slug}.png`);
  const local = findLocal(slug);

  if (local && !args.force) {
    if (local !== final || !fs.existsSync(cached)) {
      normalizeImage(local, final);
      if (local !== final) fs.unlinkSync(local);
      fs.copyFileSync(final, cached);
      console.log(`✓ ${slug} (fourni à la main, normalisé + mis en cache)`);
    } else console.log(`✓ ${slug}`);
    continue;
  }
  if (fs.existsSync(cached) && !args.force) {
    fs.copyFileSync(cached, final);
    console.log(`✓ ${slug} (cache)`);
    continue;
  }
  if (!KEY) {
    missing.push(slug);
    continue;
  }
  let done = false;
  for (let attempt = 1; attempt <= 3 && !done; attempt++) {
    try {
      console.log(`… ${slug} : génération Gemini (essai ${attempt})`);
      const raw = await generate(slug);
      normalizeImage(raw, final);
      fs.unlinkSync(raw);
      if (args.verify && attempt < 3) {
        const v = await verify(final);
        if (!v.ok) {
          console.warn(`  contrôle refusé ${JSON.stringify(v.r)} -> régénération`);
          continue;
        }
      }
      fs.copyFileSync(final, cached);
      console.log(`✓ ${slug}`);
      done = true;
    } catch (e) {
      console.warn(`  ${e.message}`);
      if (attempt === 3) missing.push(slug);
    }
  }
}

const promptsFile = path.join(ep.dir, "prompts.md");
if (missing.length) {
  const md = [
    `# Décors à générer — ${ep.slug}`,
    "",
    "Dans l'app Gemini : joins `style/reference.png` (si tu en as une) puis colle chaque prompt.",
    `Enregistre chaque image sous le nom indiqué dans \`public/episodes/${ep.slug}/bg/\` (png/jpg/webp, n'importe quelle taille : recadrage 9:16 automatique),`,
    "ou envoie-les simplement à Claude dans la conversation avec le nom du décor.",
    "",
    ...missing.flatMap((slug) => [`## ${slug}.png`, "", "```", promptFor(slug), "```", ""]),
  ].join("\n");
  fs.writeFileSync(promptsFile, md);
  console.log(`\n${missing.length} décor(s) manquant(s) -> décor de secours au rendu. Prompts prêts : ${path.relative(ROOT, promptsFile)}`);
} else if (fs.existsSync(promptsFile)) fs.unlinkSync(promptsFile);
