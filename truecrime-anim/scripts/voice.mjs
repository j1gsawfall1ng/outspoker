// Voix off + horodatage de chaque mot -> voice.mp3 + alignment.json
//  1. ElevenLabs (ELEVENLABS_API_KEY) : voix FR naturelle + horodatage exact
//  2. voice.mp3 déjà présent (vidIQ, ta propre voix...) : alignement estimé sur la vraie durée
//  3. Rien : mode muet, timings estimés à 170 mots/min (pour prévisualiser)
// Usage : npm run voice -- --affaire <slug> [--force] [--estimate]
import fs from "node:fs";
import { args, episode, readJson, writeJson, style, audioDuration, sentenceWords } from "./lib.mjs";

const ep = episode();
const script = readJson(ep.script);
const sentences = script.sentences;
const words = sentenceWords(sentences);
const fullText = sentences.map((s) => s.text.trim()).join(" ");

const KEY = process.env.ELEVENLABS_API_KEY;
const voiceCfg = { ...style.voice, ...(script.voice ?? {}) };

function proportional(total, lead = 0.12, tail = 0.3) {
  const raw = words.map((w, i) => {
    const letters = w.text.replace(/[^\p{L}\p{N}]/gu, "").length;
    const next = words[i + 1];
    const endSentence = !next || next.sentence !== w.sentence;
    const pause = endSentence ? 0.38 : /[,;:]$/.test(w.text) ? 0.18 : 0.02;
    return { dur: 0.09 + 0.055 * letters, pause };
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

let result;
if (fs.existsSync(ep.alignment) && !args.force && !args.estimate) {
  console.log("alignment.json déjà présent (utilise --force pour régénérer).");
  process.exit(0);
}
if (args.estimate || !KEY) {
  if (fs.existsSync(ep.voice)) {
    const d = audioDuration(ep.voice);
    console.log(`voice.mp3 trouvé (${d.toFixed(1)} s) : alignement estimé sur la durée réelle.`);
    result = { source: "estimate-from-audio", words: proportional(d, 0.1, 0.15) };
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
