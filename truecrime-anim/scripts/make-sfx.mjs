// Génère une banque de bruitages + 2 nappes suspense par synthèse (aucune licence requise).
// Remplace n'importe quel fichier par un vrai son (Freesound, pack sous licence) en gardant le même nom :
// le tag reste valide. Usage : npm run assets
import fs from "node:fs";
import path from "node:path";
import { execFileSync } from "node:child_process";
import { PUBLIC, has, writeJson, args } from "./lib.mjs";

const SR = 44100;
const sfxDir = path.join(PUBLIC, "sfx");
const musicDir = path.join(PUBLIC, "music");
fs.mkdirSync(sfxDir, { recursive: true });
fs.mkdirSync(musicDir, { recursive: true });

let seed = 12345;
const rnd = () => ((seed = (seed * 1664525 + 1013904223) >>> 0) / 4294967296) * 2 - 1;
const buf = (sec) => new Float32Array(Math.ceil(sec * SR));
const lowpass = (x, cutoff) => {
  const a = Math.exp((-2 * Math.PI * cutoff) / SR);
  let y = 0;
  for (let i = 0; i < x.length; i++) x[i] = y = (1 - a) * x[i] + a * y;
  return x;
};
const highpass = (x, cutoff) => {
  const lp = lowpass(Float32Array.from(x), cutoff);
  for (let i = 0; i < x.length; i++) x[i] -= lp[i];
  return x;
};
const add = (dst, src, at = 0, gain = 1) => {
  const o = Math.floor(at * SR);
  for (let i = 0; i < src.length && o + i < dst.length; i++) dst[o + i] += src[i] * gain;
  return dst;
};
const tone = (sec, f0, f1 = f0, decay = 0, type = "sine") => {
  const x = buf(sec);
  let ph = 0;
  for (let i = 0; i < x.length; i++) {
    const t = i / SR;
    const f = f0 + (f1 - f0) * (t / sec);
    ph += (2 * Math.PI * f) / SR;
    const s = type === "square" ? Math.sign(Math.sin(ph)) * 0.6 : type === "saw" ? ((ph / Math.PI) % 2) - 1 : Math.sin(ph);
    x[i] = s * (decay ? Math.exp(-t * decay) : 1);
  }
  return x;
};
const noise = (sec, decay = 0) => {
  const x = buf(sec);
  for (let i = 0; i < x.length; i++) x[i] = rnd() * (decay ? Math.exp((-i / SR) * decay) : 1);
  return x;
};
const env = (x, attack = 0.005, release = 0.02) => {
  const a = attack * SR;
  const r = release * SR;
  for (let i = 0; i < x.length; i++) {
    if (i < a) x[i] *= i / a;
    if (i > x.length - r) x[i] *= (x.length - i) / r;
  }
  return x;
};
const normalize = (x, peak = 0.9) => {
  let m = 0;
  for (const v of x) m = Math.max(m, Math.abs(v));
  if (m > 0) for (let i = 0; i < x.length; i++) x[i] = (x[i] / m) * peak;
  return x;
};

const step = () => {
  const x = buf(0.18);
  add(x, env(lowpass(noise(0.18, 40), 900), 0.002, 0.05), 0, 1);
  add(x, tone(0.12, 90, 60, 35), 0, 0.8);
  return x;
};

const SFX = {
  bip: () => env(tone(0.13, 1800), 0.003, 0.03),
  "bip-hud": () => env(tone(0.06, 2400), 0.002, 0.03),
  "bip-cctv": () => add(add(buf(0.3), env(tone(0.06, 1000), 0.002, 0.01)), env(tone(0.06, 1000), 0.002, 0.01), 0.14),
  boom: () => {
    const x = tone(2.2, 55, 28, 1.6);
    add(x, lowpass(noise(2.2, 3), 180), 0, 1.2);
    return env(x, 0.004, 0.3);
  },
  impact: () => add(env(tone(0.6, 110, 50, 9), 0.002, 0.1), highpass(noise(0.05, 60), 2000), 0, 0.6),
  whoosh: () => {
    const x = noise(0.45);
    for (let i = 0; i < x.length; i++) x[i] *= Math.sin((Math.PI * i) / x.length) ** 2;
    return lowpass(highpass(x, 300), 3500);
  },
  "souffle-tension": () => {
    const x = noise(1.6);
    for (let i = 0; i < x.length; i++) x[i] *= (i / x.length) ** 2;
    return add(lowpass(x, 2500), tone(1.6, 200, 900), 0, 0.15);
  },
  pas: () => {
    const x = buf(1.9);
    for (let k = 0; k < 4; k++) add(x, step(), k * 0.45, k % 2 ? 0.8 : 1);
    return x;
  },
  "pas-course": () => {
    const x = buf(1.6);
    for (let k = 0; k < 6; k++) add(x, step(), k * 0.25, 1);
    return x;
  },
  porte: () => add(add(buf(0.7), env(tone(0.05, 3200, 3000, 80), 0.001, 0.01)), env(tone(0.5, 90, 60, 8), 0.002, 0.1), 0.12, 0.9),
  "porte-claque": () => add(env(tone(0.8, 70, 40, 6), 0.001, 0.2), lowpass(noise(0.4, 15), 1200), 0, 1),
  verrou: () => {
    const x = buf(0.45);
    add(x, env(tone(0.08, 3600, 3400, 70)), 0, 1);
    add(x, env(tone(0.08, 2900, 2700, 70)), 0.18, 1);
    add(x, highpass(noise(0.03, 100), 3000), 0.18, 0.5);
    return x;
  },
  sonnerie: () => {
    const x = buf(2.6);
    for (const at of [0, 1.3]) {
      const r = add(tone(0.9, 440), tone(0.9, 480));
      for (let i = 0; i < r.length; i++) r[i] *= Math.sin(i / SR * 2 * Math.PI * 20) > 0 ? 1 : 0.2;
      add(x, env(r, 0.01, 0.05), at, 0.5);
    }
    return x;
  },
  vibreur: () => {
    const x = buf(1.2);
    for (const at of [0, 0.6]) {
      const v = tone(0.4, 160, 160, 0, "square");
      add(x, env(lowpass(v, 400), 0.01, 0.05), at, 1);
    }
    return x;
  },
  notif: () => add(env(tone(0.25, 880, 880, 10)), env(tone(0.35, 1320, 1320, 9)), 0.1, 1),
  papier: () => {
    const x = highpass(noise(0.7), 1800);
    for (let i = 0; i < x.length; i++) x[i] *= Math.abs(Math.sin(i / 900)) * (0.4 + 0.6 * Math.abs(rnd()));
    return env(x, 0.01, 0.1);
  },
  clavier: () => {
    const x = buf(1.3);
    for (let k = 0; k < 11; k++) add(x, highpass(noise(0.025, 150), 2500), k * 0.11 + Math.abs(rnd()) * 0.03, 0.8);
    return x;
  },
  "tic-tac": () => {
    const x = buf(2.1);
    for (let k = 0; k < 4; k++) add(x, env(tone(0.03, k % 2 ? 2600 : 2000, 1800, 120), 0.001, 0.01), k * 0.5, 1);
    return x;
  },
  coeur: () => {
    const x = buf(2);
    for (const at of [0, 0.25, 1, 1.25]) add(x, env(tone(0.25, 60, 40, 14), 0.005, 0.05), at, at % 1 ? 0.7 : 1);
    return x;
  },
  sirene: () => {
    const x = buf(3);
    let ph = 0;
    for (let i = 0; i < x.length; i++) {
      const t = i / SR;
      ph += (2 * Math.PI * (850 + 300 * Math.sin(2 * Math.PI * 0.8 * t))) / SR;
      x[i] = Math.sin(ph) * 0.6 + Math.sin(ph * 2) * 0.15;
    }
    return env(lowpass(x, 3000), 0.3, 0.6);
  },
  voiture: () => {
    const x = add(tone(2, 38, 46, 0, "saw"), lowpass(noise(2), 300), 0, 0.6);
    return env(lowpass(x, 500), 0.3, 0.6);
  },
  glitch: () => {
    const x = buf(0.35);
    for (let k = 0; k < 6; k++) add(x, tone(0.04, 200 + Math.abs(rnd()) * 3000, 100, 0, "square"), k * 0.055, 0.6);
    return x;
  },
  clic: () => env(highpass(noise(0.02, 200), 2000), 0.001, 0.005),
  "appareil-photo": () => add(add(buf(0.4), highpass(noise(0.03, 120), 2500)), lowpass(noise(0.12, 30), 3000), 0.08, 0.7),
  vent: () => {
    const x = lowpass(noise(8), 500);
    for (let i = 0; i < x.length; i++) x[i] *= 0.6 + 0.4 * Math.sin((2 * Math.PI * i) / SR / 3);
    return env(x, 0.8, 0.8);
  },
};

// volumes relatifs par tag (0..1), alias acceptés dans shots.json, et « hits » (instants
// d'impact dans le fichier, utilisés par le contrôle de densité SFX). ambience = ne compte pas.
const META = {
  bip: { volume: 0.5 },
  "bip-hud": { volume: 0.35 },
  "bip-cctv": { volume: 0.45 },
  boom: { volume: 1, aliases: ["impact-grave"] },
  impact: { volume: 0.8 },
  whoosh: { volume: 0.6, aliases: ["swoosh"] },
  "souffle-tension": { volume: 0.5, aliases: ["riser"] },
  pas: { volume: 0.7, aliases: ["pas-asphalte", "marche"], hits: [0, 0.45, 0.9, 1.35] },
  "pas-course": { volume: 0.7, aliases: ["course"], hits: [0, 0.25, 0.5, 0.75, 1, 1.25] },
  porte: { volume: 0.7, aliases: ["porte-ouvre"] },
  "porte-claque": { volume: 0.8 },
  verrou: { volume: 0.7, aliases: ["serrure", "cle"] },
  sonnerie: { volume: 0.5, aliases: ["telephone", "appel"], hits: [0, 1.3] },
  vibreur: { volume: 0.7, hits: [0, 0.6] },
  notif: { volume: 0.5, aliases: ["sms"] },
  papier: { volume: 0.6, aliases: ["dossier"] },
  clavier: { volume: 0.6, hits: [0, 0.4, 0.8, 1.1] },
  "tic-tac": { volume: 0.6, aliases: ["horloge"], hits: [0, 0.5, 1, 1.5] },
  coeur: { volume: 0.8, aliases: ["battement"], hits: [0, 0.25, 1, 1.25] },
  sirene: { volume: 0.35, aliases: ["police"] },
  voiture: { volume: 0.6, aliases: ["moteur"] },
  glitch: { volume: 0.4 },
  clic: { volume: 0.6 },
  "appareil-photo": { volume: 0.6, aliases: ["photo"] },
  vent: { volume: 0.3, aliases: ["ambiance-vent"], ambience: true },
};

function writeWav(file, data) {
  const n = data.length;
  const b = Buffer.alloc(44 + n * 2);
  b.write("RIFF", 0);
  b.writeUInt32LE(36 + n * 2, 4);
  b.write("WAVEfmt ", 8);
  b.writeUInt32LE(16, 16);
  b.writeUInt16LE(1, 20);
  b.writeUInt16LE(1, 22);
  b.writeUInt32LE(SR, 24);
  b.writeUInt32LE(SR * 2, 28);
  b.writeUInt16LE(2, 32);
  b.writeUInt16LE(16, 34);
  b.write("data", 36);
  b.writeUInt32LE(n * 2, 40);
  for (let i = 0; i < n; i++) b.writeInt16LE(Math.max(-1, Math.min(1, data[i])) * 32767, 44 + i * 2);
  fs.writeFileSync(file, b);
}

const ffmpeg = has("ffmpeg");
function save(dir, name, data) {
  const wav = path.join(dir, `${name}.wav`);
  writeWav(wav, data);
  if (!ffmpeg) return `${name}.wav`;
  execFileSync("ffmpeg", ["-y", "-loglevel", "error", "-i", wav, "-codec:a", "libmp3lame", "-q:a", "3", path.join(dir, `${name}.mp3`)]);
  fs.unlinkSync(wav);
  return `${name}.mp3`;
}

const indexPath = path.join(sfxDir, "index.json");
const index = fs.existsSync(indexPath) ? JSON.parse(fs.readFileSync(indexPath, "utf8")) : {};
for (const [tag, fn] of Object.entries(SFX)) {
  const existing = index[tag]?.file && fs.existsSync(path.join(sfxDir, index[tag].file));
  if (existing && !args.force) {
    index[tag] = { ...META[tag], ...index[tag] };
    continue;
  }
  const file = save(sfxDir, tag, normalize(fn()));
  index[tag] = { file, ...META[tag] };
  console.log(`sfx  ${tag}`);
}
writeJson(indexPath, index);

// --- Nappes musicales « drone / suspense » ---
function drone(sec, notes, pulseEvery, shimmer) {
  const x = buf(sec);
  notes.forEach((f, k) => {
    const a = tone(sec, f);
    const b = tone(sec, f * 1.004);
    for (let i = 0; i < x.length; i++) {
      const t = i / SR;
      const lfo = 0.6 + 0.4 * Math.sin(2 * Math.PI * (0.05 + k * 0.03) * t + k);
      x[i] += (a[i] + b[i]) * 0.5 * lfo * (1 / (k + 1));
    }
  });
  const n = lowpass(noise(sec), 400);
  add(x, n, 0, 0.25);
  if (pulseEvery) for (let t = 1; t < sec - 1; t += pulseEvery) add(x, env(tone(0.5, 55, 38, 7), 0.01, 0.1), t, 0.9);
  if (shimmer) {
    const s = tone(sec, shimmer);
    for (let i = 0; i < x.length; i++) x[i] += s[i] * 0.05 * (0.5 + 0.5 * Math.sin((2 * Math.PI * i) / SR / 7));
  }
  return env(normalize(lowpass(x, 1800), 0.8), 1, 1);
}
const musics = {
  "drone-1": () => drone(64, [55, 82.41, 110], 2, 0),
  "drone-2": () => drone(64, [73.42, 110, 146.83], 0, 1174.66),
  "drone-3": () => drone(64, [49, 58.27, 98], 1.5, 0),
};
for (const [name, fn] of Object.entries(musics)) {
  if (!args.force && fs.readdirSync(musicDir).some((f) => f.startsWith(name + "."))) continue;
  save(musicDir, name, fn());
  console.log(`music ${name}`);
}
console.log("Banque audio prête :", sfxDir);
