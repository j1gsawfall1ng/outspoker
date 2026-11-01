// Whisper (whisper.cpp, local) : horodatage exact des mots sur une voix déjà enregistrée.
//  Installation une fois : npm run whisper   (binaire whisper.cpp + modèle, ~1,5 Go pour « medium »)
//  Ensuite voice.mjs l'utilise automatiquement dès qu'un voice.mp3 existe sans clé ElevenLabs.
// Modèle : WHISPER_MODEL dans .env (tiny, base, small, medium, large-v3...), « medium » par défaut.
import fs from "node:fs";
import path from "node:path";
import { execFileSync } from "node:child_process";
import { ROOT, isMain, norm } from "./lib.mjs";

export const WHISPER_DIR = path.join(ROOT, "whisper");
export const WHISPER_VERSION = "1.5.5";
export const WHISPER_MODEL = process.env.WHISPER_MODEL || "medium";

const lib = () => import("@remotion/install-whisper-cpp");

export async function whisperReady() {
  try {
    const { getWhisperExecutablePath } = await import("@remotion/install-whisper-cpp/dist/install-whisper-cpp.js");
    const { getModelPath } = await import("@remotion/install-whisper-cpp/dist/download-whisper-model.js");
    return fs.existsSync(getWhisperExecutablePath(WHISPER_DIR, WHISPER_VERSION)) && fs.existsSync(getModelPath(WHISPER_DIR, WHISPER_MODEL));
  } catch {
    return false;
  }
}

export async function installWhisper() {
  const { installWhisperCpp, downloadWhisperModel } = await lib();
  await installWhisperCpp({ to: WHISPER_DIR, version: WHISPER_VERSION });
  await downloadWhisperModel({ folder: WHISPER_DIR, model: WHISPER_MODEL });
}

// Transcrit l'audio et renvoie les mots reconnus { text, start, end } en secondes
async function transcribeWords(file) {
  const { transcribe, toCaptions } = await lib();
  const wav = path.join(path.dirname(file), ".whisper.wav");
  execFileSync("ffmpeg", ["-y", "-loglevel", "error", "-i", file, "-ar", "16000", "-ac", "1", "-c:a", "pcm_s16le", wav]);
  try {
    const json = await transcribe({
      inputPath: wav,
      whisperPath: WHISPER_DIR,
      whisperCppVersion: WHISPER_VERSION,
      model: WHISPER_MODEL,
      language: "fr",
      tokenLevelTimestamps: true,
      splitOnWord: true,
      printOutput: false,
    });
    return toCaptions({ whisperCppOutput: json })
      .captions.map((c) => ({ text: c.text.trim(), start: c.startMs / 1000, end: c.endMs / 1000 }))
      .filter((c) => norm(c.text));
  } finally {
    fs.rmSync(wav, { force: true });
  }
}

// Aligne les mots du script sur la transcription, lettre à lettre (distance d'édition) :
// les fautes de reconnaissance ou les nombres écrits autrement (« 14 » / « quatorze ») ne cassent
// pas le calage, les mots non reconnus sont répartis entre leurs voisins selon leur longueur parlée.
export async function alignWithWhisper(file, words, weightOf) {
  const heard = await transcribeWords(file);
  if (!heard.length) throw new Error("Whisper n'a reconnu aucun mot.");

  const S = [];
  words.forEach((w, wi) => {
    for (const c of norm(w.text).replace(/'/g, "")) S.push({ c, wi });
  });
  const H = [];
  for (const h of heard) {
    const cs = norm(h.text).replace(/'/g, "");
    [...cs].forEach((c, k) => {
      const d = (h.end - h.start) / cs.length;
      H.push({ c, t0: h.start + k * d, t1: h.start + (k + 1) * d });
    });
  }

  // Needleman-Wunsch : 0 = correspondance, 1 = substitution, 2 = lettre script sautée, 3 = lettre entendue sautée
  const n = S.length;
  const m = H.length;
  const back = new Uint8Array((n + 1) * (m + 1));
  let prev = new Int32Array(m + 1).map((_, j) => j);
  for (let j = 1; j <= m; j++) back[j] = 3;
  for (let i = 1; i <= n; i++) {
    const cur = new Int32Array(m + 1);
    cur[0] = i;
    back[i * (m + 1)] = 2;
    for (let j = 1; j <= m; j++) {
      const same = S[i - 1].c === H[j - 1].c;
      let best = prev[j - 1] + (same ? 0 : 1);
      let op = same ? 0 : 1;
      if (prev[j] + 1 < best) (best = prev[j] + 1), (op = 2);
      if (cur[j - 1] + 1 < best) (best = cur[j - 1] + 1), (op = 3);
      cur[j] = best;
      back[i * (m + 1) + j] = op;
    }
    prev = cur;
  }

  const hits = words.map(() => ({ n: 0, t0: Infinity, t1: -Infinity }));
  for (let i = n, j = m; i > 0 || j > 0; ) {
    const op = back[i * (m + 1) + j];
    if (op === 0) {
      const h = hits[S[i - 1].wi];
      h.n++;
      h.t0 = Math.min(h.t0, H[j - 1].t0);
      h.t1 = Math.max(h.t1, H[j - 1].t1);
    }
    if (op <= 1) i--, j--;
    else if (op === 2) i--;
    else j--;
  }

  // un mot est « ancré » si au moins la moitié de ses lettres ont été retrouvées
  const out = words.map((w, i) => {
    const len = norm(w.text).replace(/'/g, "").length || 1;
    const h = hits[i];
    return h.n >= Math.max(1, len / 2) ? { ...w, start: h.t0, end: h.t1 } : { ...w, start: null, end: null };
  });
  const anchored = out.filter((w) => w.start !== null).length;
  if (anchored < words.length * 0.6) throw new Error(`Whisper : seulement ${anchored}/${words.length} mots retrouvés, transcription trop éloignée du script.`);

  // ordre strictement croissant, puis interpolation des trous
  let last = 0;
  for (const w of out) {
    if (w.start === null) continue;
    if (w.start < last) w.start = null, w.end = null;
    else last = w.end;
  }
  const total = heard.at(-1).end;
  for (let i = 0; i < out.length; ) {
    if (out[i].start !== null) {
      i++;
      continue;
    }
    let j = i;
    while (j < out.length && out[j].start === null) j++;
    const from = i > 0 ? out[i - 1].end : Math.max(0, (out[j]?.start ?? total) - 0.4 * (j - i));
    const to = j < out.length ? out[j].start : Math.max(from + 0.3 * (j - i), total);
    const W = out.slice(i, j).map(weightOf);
    const sum = W.reduce((a, b) => a + b, 0);
    let t = from;
    for (let k = i; k < j; k++) {
      const d = ((to - from) * W[k - i]) / sum;
      out[k].start = t;
      out[k].end = t + d;
      t += d;
    }
    i = j;
  }
  // ponctuation isolée (« : », « ? ») collée au mot précédent, sans durée propre
  out.forEach((w, i) => {
    if (!norm(w.text).replace(/'/g, "")) w.start = w.end = i > 0 ? out[i - 1].end : w.start;
  });
  // un mot dure au moins 30 ms si la place le permet, et se termine au plus tard quand le suivant commence
  out.forEach((w, i) => {
    const next = out[i + 1]?.start ?? Infinity;
    w.end = Math.min(Math.max(w.end, Math.min(w.start + 0.03, next)), next);
  });
  return { anchored, words: out.map((w) => ({ ...w, start: +w.start.toFixed(3), end: +w.end.toFixed(3) })) };
}

if (isMain(import.meta.url)) {
  console.log(`Installation de whisper.cpp ${WHISPER_VERSION} + modèle « ${WHISPER_MODEL} » dans ${WHISPER_DIR}…`);
  await installWhisper();
  console.log(`\n✓ Whisper prêt. La prochaine voix (npm run voice -- --affaire <slug> --force) sera calée mot à mot.`);
}
