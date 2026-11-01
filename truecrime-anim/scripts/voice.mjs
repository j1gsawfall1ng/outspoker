// Voix off + horodatage de chaque mot -> voice.mp3 + alignment.json
//  1. ElevenLabs (ELEVENLABS_API_KEY) : voix FR naturelle + horodatage exact
//  2. voice.mp3 déjà présent (vidIQ, ta propre voix...) : alignement estimé sur la vraie durée
//  3. Rien : mode muet, timings estimés à 170 mots/min (pour prévisualiser)
// Usage : npm run voice -- --affaire <slug> [--force] [--estimate]
import fs from "node:fs";
import path from "node:path";
import { execFileSync } from "node:child_process";
import { args, episode, readJson, writeJson, style, audioDuration, sentenceWords } from "./lib.mjs";

const ep = episode();
const script = readJson(ep.script);
const sentences = script.sentences;
const words = sentenceWords(sentences);
const fullText = sentences.map((s) => s.text.trim()).join(" ");

const KEY = process.env.ELEVENLABS_API_KEY;

// Longueur « parlée » d'un mot : les nombres et les heures se prononcent beaucoup plus long qu'ils ne s'écrivent
const UNITS = [0, 4, 4, 5, 6, 5, 4, 4, 4, 4]; // lettres approx. de un..neuf
function spokenLetters(token) {
  const t = token.replace(/[^\p{L}\p{N}]/gu, "");
  const num = (n) => {
    n = Number(n);
    if (n === 0) return 4;
    if (n < 10) return UNITS[n];
    if (n < 17) return 5;
    if (n < 100) return 10 + (n % 10 ? 4 : 0);
    if (n < 1000) return 4 + num(Math.floor(n / 100)) + (n % 100 ? num(n % 100) : 0);
    return 6 + num(Math.floor(n / 1000)) + (n % 1000 ? num(n % 1000) : 0);
  };
  const h = /^(\d{1,2})h(\d{0,2})$/i.exec(t);
  if (h) return num(h[1]) + 6 + (h[2] ? num(h[2]) : 0);
  if (/^\d+$/.test(t)) return num(t);
  return t.replace(/\d+/g, (d) => "x".repeat(num(d))).length;
}
const weightOf = (w) => 0.09 + 0.055 * spokenLetters(w.text);
const voiceCfg = { ...style.voice, ...(script.voice ?? {}) };

function proportional(total, lead = 0.12, tail = 0.3) {
  const raw = words.map((w, i) => {
    const next = words[i + 1];
    const endSentence = !next || next.sentence !== w.sentence;
    const pause = endSentence ? 0.38 : /[,;:]$/.test(w.text) ? 0.18 : 0.02;
    return { dur: weightOf(w), pause };
  });
  const sum = raw.reduce((a, r) => a + r.dur + r.pause, 0);
  const k = (total - lead - tail) / sum;
  let t = lead;
  return words.map((w, i) => {
    const start = t;
    const end = t + raw[i].dur * k;
    t = end + raw[i].pause * k;
    return { ...w, start: +start.toFixed(3), end: +end.toFixed(3) };
  });
}

async function elevenlabs() {
  let voiceId = process.env.ELEVENLABS_VOICE_ID || voiceCfg.voiceId;
  if (!voiceId) {
    const r = await fetch("https://api.elevenlabs.io/v1/voices", { headers: { "xi-api-key": KEY } });
    const j = await r.json();
    voiceId = j.voices?.[0]?.voice_id;
    console.warn(`Aucune voix choisie : utilisation de « ${j.voices?.[0]?.name} ». Mets ELEVENLABS_VOICE_ID (voix FR) pour fixer la voix de la chaîne.`);
  }
  const res = await fetch(`https://api.elevenlabs.io/v1/text-to-speech/${voiceId}/with-timestamps?output_format=mp3_44100_128`, {
    method: "POST",
    headers: { "xi-api-key": KEY, "Content-Type": "application/json" },
    body: JSON.stringify({
      text: fullText,
      model_id: voiceCfg.model,
      language_code: "fr",
      voice_settings: { stability: voiceCfg.stability, similarity_boost: voiceCfg.similarity, style: voiceCfg.style, use_speaker_boost: true, speed: voiceCfg.speed },
    }),
  });
  if (!res.ok) throw new Error(`ElevenLabs ${res.status} : ${await res.text()}`);
  const j = await res.json();
  fs.writeFileSync(ep.voice, Buffer.from(j.audio_base64, "base64"));
  const al = j.alignment ?? j.normalized_alignment;
  // regroupe les caractères en mots
  const out = [];
  let cur = null;
  al.characters.forEach((ch, i) => {
    if (/\s/.test(ch)) {
      if (cur) out.push(cur);
      cur = null;
      return;
    }
    if (!cur) cur = { text: "", start: al.character_start_times_seconds[i], end: 0 };
    cur.text += ch;
    cur.end = al.character_end_times_seconds[i];
  });
  if (cur) out.push(cur);
  if (out.length !== words.length) {
    console.warn(`Alignement : ${out.length} mots reçus pour ${words.length} attendus -> estimation sur la durée réelle.`);
    return { source: "elevenlabs+estimate", words: proportional(audioDuration(ep.voice)) };
  }
  return { source: "elevenlabs", words: out.map((w, i) => ({ text: words[i].text, sentence: words[i].sentence, start: +w.start.toFixed(3), end: +w.end.toFixed(3) })) };
}

// --- voix externe (vidIQ, enregistrement perso) : voice-raw.mp3 -> voice.mp3 ---
const parseSilences = (file, minDur = 0.18) => {
  // ffmpeg écrit silencedetect sur stderr
  const r = execFileSync("sh", ["-c", `ffmpeg -hide_banner -nostats -i "${file}" -af silencedetect=noise=-35dB:d=${minDur} -f null - 2>&1`], { encoding: "utf8" });
  const gaps = [];
  let start = null;
  for (const line of r.split("\n")) {
    const a = /silence_start: ([\d.]+)/.exec(line);
    const b = /silence_end: ([\d.]+)/.exec(line);
    if (a) start = Number(a[1]);
    if (b && start !== null) {
      gaps.push({ start, end: Number(b[1]) });
      start = null;
    }
  }
  return gaps;
};

// Raccourcit les pauses trop longues (les TTS externes laissent souvent 0,6–1 s entre phrases)
function tightenPauses(src, dst, maxPause) {
  const total = audioDuration(src);
  const gaps = parseSilences(src, maxPause);
  const keep = [];
  let cursor = 0;
  for (const g of gaps) {
    const lead = g.start <= 0.01;
    const trail = g.end >= total - 0.01;
    const cutFrom = lead ? 0 : g.start + maxPause / 2;
    const cutTo = trail ? total : g.end - maxPause / 2;
    if (cutTo - cutFrom < 0.02) continue;
    if (cutFrom > cursor) keep.push([cursor, cutFrom]);
    cursor = cutTo;
  }
  if (cursor < total) keep.push([cursor, total]);
  const filters = keep.map(([a, b], i) => `[0:a]atrim=${a.toFixed(3)}:${b.toFixed(3)},asetpts=PTS-STARTPTS[s${i}]`);
  const graph = `${filters.join(";")};${keep.map((_, i) => `[s${i}]`).join("")}concat=n=${keep.length}:v=0:a=1,apad=pad_dur=0.25[out]`;
  const graphFile = path.join(path.dirname(dst), ".tighten.txt");
  fs.writeFileSync(graphFile, graph);
  execFileSync("ffmpeg", ["-y", "-loglevel", "error", "-i", src, "-filter_complex_script", graphFile, "-map", "[out]", "-codec:a", "libmp3lame", "-q:a", "2", dst]);
  fs.unlinkSync(graphFile);
  return { before: total, after: audioDuration(dst), keep };
}

// Convertit un instant de l'audio brut en instant de l'audio resserré
const mapper = (keep) => (t) => {
  let off = 0;
  for (const [a, b] of keep) {
    if (t <= a) return off;
    if (t <= b) return off + (t - a);
    off += b - a;
  }
  return off;
};

// Alignement « forcé léger » : l'audio est découpé en segments de parole (entre les silences),
// puis les mots du script sont répartis sur ces segments par programmation dynamique :
// durée de chaque segment ≈ débit × longueur parlée de ses mots, et les silences longs tombent
// de préférence après une ponctuation. Précision typique : quelques centièmes à 0,2 s par mot.
function alignOnSilences(file, map = (t) => t) {
  const total = audioDuration(file);
  const gaps = parseSilences(file, 0.12);
  const chunks = [];
  let cur = 0;
  for (const g of gaps) {
    if (g.start - cur > 0.06) chunks.push({ start: cur, end: g.start, gapAfter: g.end - g.start });
    cur = g.end;
  }
  if (total - cur > 0.06) chunks.push({ start: cur, end: total, gapAfter: 1 });
  const W = words.map(weightOf);
  const N = words.length;
  const C = chunks.length;
  const punct = words.map((w, i) => (i === N - 1 || words[i + 1].sentence !== w.sentence ? 2 : /[.…!?]$/.test(w.text) ? 1.5 : /[,;:]$/.test(w.text) ? 1 : 0));
  const prefix = [0];
  for (const x of W) prefix.push(prefix.at(-1) + x);
  const speech = chunks.reduce((acc, c) => acc + c.end - c.start, 0);
  let rate = speech / prefix[N];

  const solve = () => {
    // dp[c][w] : coût minimal avec les w premiers mots placés dans les c premiers segments
    const dp = Array.from({ length: C + 1 }, () => new Float64Array(N + 1).fill(Infinity));
    const back = Array.from({ length: C + 1 }, () => new Int32Array(N + 1).fill(-1));
    dp[0][0] = 0;
    const maxWords = 25;
    for (let c = 0; c < C; c++) {
      const ch = chunks[c];
      const dur = ch.end - ch.start;
      for (let w = 0; w < N; w++) {
        if (dp[c][w] === Infinity) continue;
        for (let w2 = w + 1; w2 <= Math.min(N, w + maxWords); w2++) {
          const exp = rate * (prefix[w2] - prefix[w]);
          let cost = ((dur - exp) / (exp + 0.25)) ** 2 * (1 + (w2 - w) * 0.05);
          // un silence long doit suivre une ponctuation ; une ponctuation forte appelle un silence
          const p = punct[w2 - 1];
          cost += p ? -0.25 * p * Math.min(1, ch.gapAfter / 0.6) : 1.2 * Math.min(1, ch.gapAfter / 0.5);
          const v = dp[c][w] + cost;
          if (v < dp[c + 1][w2]) {
            dp[c + 1][w2] = v;
            back[c + 1][w2] = w;
          }
        }
      }
    }
    // reconstitution
    const assign = new Array(C);
    for (let c = C, w = N; c > 0; c--) {
      const w0 = back[c][w];
      assign[c - 1] = [w0, w];
      w = w0;
    }
    return assign;
  };

  let assign = solve();
  // deuxième passe avec un débit réestimé hors segments aberrants
  if (assign.every(Boolean)) {
    const ratios = assign.map(([a, b], c) => (chunks[c].end - chunks[c].start) / (prefix[b] - prefix[a])).sort((x, y) => x - y);
    rate = ratios[Math.floor(ratios.length / 2)];
    const second = solve();
    if (second.every(Boolean)) assign = second;
  }
  if (!assign.every(Boolean)) return proportional(total, 0.1, 0.15);

  const out = [];
  assign.forEach(([a, b], c) => {
    const ch = chunks[c];
    const tot = prefix[b] - prefix[a];
    let t = ch.start;
    for (let i = a; i < b; i++) {
      const d = ((ch.end - ch.start) * W[i]) / tot;
      out.push({ ...words[i], start: +map(t).toFixed(3), end: +map(t + d).toFixed(3) });
      t += d;
    }
  });
  return out;
}

const rawVoice = path.join(ep.dir, "voice-raw.mp3");
if (fs.existsSync(rawVoice) && (args.force || args.estimate || !fs.existsSync(ep.voice) || fs.statSync(rawVoice).mtimeMs > fs.statSync(ep.voice).mtimeMs)) {
  const maxPause = voiceCfg.maxPause ?? 0.3;
  const r = tightenPauses(rawVoice, ep.voice, maxPause);
  fs.writeFileSync(path.join(ep.dir, ".tighten.json"), JSON.stringify(r.keep));
  console.log(`voice-raw.mp3 -> voice.mp3 : pauses limitées à ${maxPause} s (${r.before.toFixed(1)} s -> ${r.after.toFixed(1)} s)`);
}

let result;
if (fs.existsSync(ep.alignment) && !args.force && !args.estimate) {
  console.log("alignment.json déjà présent (utilise --force pour régénérer).");
  process.exit(0);
}
if (args.estimate || !KEY) {
  if (fs.existsSync(ep.voice)) {
    const d = audioDuration(ep.voice);
    console.log(`voice.mp3 trouvé (${d.toFixed(1)} s) : phrases calées sur les silences, mots estimés.`);
    // si l'audio a été resserré, on cale sur l'audio brut (pauses de phrase plus distinctes) puis on convertit
    const keepFile = path.join(ep.dir, ".tighten.json");
    const words2 = fs.existsSync(rawVoice) && fs.existsSync(keepFile) ? alignOnSilences(rawVoice, mapper(JSON.parse(fs.readFileSync(keepFile, "utf8")))) : alignOnSilences(ep.voice);
    result = { source: "estimate-from-audio", words: words2 };
  } else {
    // le débit cible (mots/min) inclut déjà les respirations entre phrases
    const total = (words.length / voiceCfg.wpm) * 60 + 0.4;
    console.log(`Pas de clé ElevenLabs ni de voice.mp3 : mode MUET, durée estimée ${total.toFixed(1)} s.`);
    result = { source: "silent", words: proportional(total) };
  }
} else {
  console.log("ElevenLabs : génération de la voix off…");
  result = await elevenlabs();
}
writeJson(ep.alignment, { ...result, duration: result.words.at(-1).end });
console.log(`alignment.json : ${result.words.length} mots, ${result.words.at(-1).end.toFixed(1)} s (${result.source})`);
