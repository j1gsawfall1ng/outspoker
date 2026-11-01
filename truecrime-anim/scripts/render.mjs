// Rendu MP4 1080x1920 30 i/s + normalisation -14 LUFS + miniature + légende.
// Usage : npm run render -- --affaire <slug> [--draft]   (--draft = demi-résolution, rapide)
import fs from "node:fs";
import path from "node:path";
import { execFileSync } from "node:child_process";
import { args, episode, readJson, ROOT, has, style, isMain, remotion } from "./lib.mjs";

export function render(ep, { draft = false } = {}) {
  fs.mkdirSync(ep.out, { recursive: true });
  const props = readJson(ep.props);
  const script = readJson(ep.script);

  const browserArgs = [];
  // Remotion télécharge son propre navigateur si besoin ; on réutilise celui de la machine s'il existe
  const pw = fs.existsSync("/opt/pw-browsers") ? fs.readdirSync("/opt/pw-browsers").filter((d) => d.startsWith("chromium_headless_shell-")) : [];
  const candidates = [process.env.REMOTION_BROWSER, ...pw.map((d) => `/opt/pw-browsers/${d}/chrome-headless-shell-linux64/chrome-headless-shell`)].filter(Boolean);
  const browser = candidates.find((p) => fs.existsSync(p));
  if (browser) browserArgs.push(`--browser-executable=${browser}`);

  const name = draft ? `${ep.slug}-draft` : ep.slug;
  const raw = path.join(ep.out, `${name}.raw.mp4`);
  const final = path.join(ep.out, `${name}.mp4`);
  const common = ["remotion/index.ts", "Episode", `--props=${ep.props}`, ...browserArgs];
  console.log(`Rendu ${draft ? "BROUILLON" : "final"} (${props.meta.duration.toFixed(1)} s)…`);
  remotion(["render", ...common, raw, "--codec=h264", "--crf=18", `--concurrency=${process.env.RENDER_CONCURRENCY ?? "50%"}`, ...(draft ? ["--scale=0.5"] : [])]);

  if (has("ffmpeg")) {
    console.log(`Normalisation audio ${style.audio.targetLufs} LUFS…`);
    execFileSync("ffmpeg", ["-y", "-loglevel", "error", "-i", raw, "-c:v", "copy", "-af", `loudnorm=I=${style.audio.targetLufs}:TP=-1.5:LRA=11`, "-c:a", "aac", "-b:a", "192k", "-movflags", "+faststart", final]);
    fs.unlinkSync(raw);
  } else fs.renameSync(raw, final);

  if (!draft) {
    // miniature = frame du hook
    const hook = props.shots.find((s) => s.insert?.type === "title") ?? props.shots[0];
    const frame = Math.round((hook.start + Math.min(0.9, (hook.end - hook.start) * 0.6)) * props.meta.fps);
    remotion(["still", ...common, path.join(ep.out, "miniature.png"), `--frame=${frame}`]);
    const caption = [script.caption ?? script.titre, "", (script.hashtags ?? ["#truecrime", "#faitdivers", "#enquete", "#histoirevraie", "#pourtoi"]).join(" "), "", "⚠ Contenu généré par IA : active l'étiquette IA de TikTok."].join("\n");
    fs.writeFileSync(path.join(ep.out, "legende.txt"), caption + "\n");
  }
  console.log(`\n✓ ${path.relative(ROOT, final)}`);
  return final;
}

if (isMain(import.meta.url)) render(episode(), { draft: !!args.draft });
