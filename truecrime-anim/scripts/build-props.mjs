// Assemble script.json + shots.json + alignment.json -> render.json (props Remotion).
// Cale chaque plan sur la voix : un plan commence au début de sa phrase, ou sur le mot `at`.
// Ajoute les SFX automatiques (bip HUD, boom des révélations, whoosh des transitions).
// Usage : npm run build-props -- --affaire <slug>
import fs from "node:fs";
import path from "node:path";
import { episode, readJson, writeJson, style, PUBLIC, norm } from "./lib.mjs";

export function buildProps(ep) {
  const script = readJson(ep.script);
  const storyboard = readJson(ep.shots);
  const alignment = readJson(ep.alignment);
  const words = alignment.words.map((w) => ({ ...w }));
  const sfxIndex = readJson(path.join(PUBLIC, "sfx", "index.json"));
  const warnings = [];

  const sentenceStart = (i) => words.find((w) => w.sentence === i)?.start;
  const sentenceWordsOf = (i) => words.filter((w) => w.sentence === i);

  // --- calage des plans sur la voix ---
  const shots = storyboard.shots.map((s, idx) => {
    let start = sentenceStart(s.sentence);
    if (start === undefined) {
      warnings.push(`plan ${s.id} : phrase ${s.sentence} introuvable`);
      start = 0;
    }
    if (s.at) {
      const [needle, nth = 1] = String(s.at).split("#");
      const hits = sentenceWordsOf(s.sentence).filter((w) => norm(w.text) === norm(needle));
      const hit = hits[Number(nth) - 1];
      if (hit) start = hit.start;
      else warnings.push(`plan ${s.id} : mot « ${s.at} » absent de la phrase ${s.sentence}`);
    }
    if (idx === 0) start = 0;
    return { ...s, start: Math.max(0, +(start - 0.04).toFixed(3)) };
  });
  shots.sort((a, b) => a.start - b.start);
  const lastWord = words.at(-1).end;
  const tail = storyboard.tail ?? 1.6; // tenue du cliffhanger après le dernier mot
  shots.forEach((s, i) => {
    s.end = i < shots.length - 1 ? shots[i + 1].start : +(lastWord + tail).toFixed(3);
  });
  const duration = shots.at(-1).end;

  // --- surlignage des mots (indices en jaune, danger en rouge) ---
  for (const s of shots) {
    const inShot = words.filter((w) => w.start >= s.start - 0.01 && w.start < s.end);
    for (const [list, color] of [
      [s.highlight, "indice"],
      [s.danger, "alerte"],
    ]) {
      for (const h of list ?? []) {
        const parts = String(h).split(/\s+/).map(norm);
        for (let k = 0; k + parts.length <= inShot.length; k++) {
          if (parts.every((p, j) => norm(inShot[k + j].text) === p)) for (let j = 0; j < parts.length; j++) inShot[k + j].color = color;
        }
      }
    }
  }
  for (const [i, sent] of script.sentences.entries()) {
    for (const [list, color] of [
      [sent.indices, "indice"],
      [sent.alertes, "alerte"],
    ])
      for (const h of list ?? []) for (const w of words) if (w.sentence === i && norm(w.text) === norm(h)) w.color = color;
  }

  // --- expression qui change sur un mot-clé ---
  for (const s of shots)
    for (const c of s.characters ?? []) {
      if (!c.expressionAt) continue;
      const w = words.find((w) => w.start >= s.start - 0.01 && w.start < s.end && norm(w.text) === norm(c.expressionAt));
      if (w) c.expressionFrom = +(w.start - s.start).toFixed(3);
    }

  // --- décors ---
  const bgSrc = (slug) => (fs.existsSync(path.join(ep.bgDir, `${slug}.png`)) ? ep.rel(`bg/${slug}.png`) : fs.existsSync(path.join(PUBLIC, "bg-cache", `${slug}.png`)) ? `bg-cache/${slug}.png` : null);
  for (const s of shots) {
    s.bgSrc = bgSrc(s.bg);
    if (s.insert?.type === "polaroid" && s.insert.bg) s.insert.bgSrc = bgSrc(s.insert.bg);
  }

  // --- SFX ---
  const resolveTag = (tag) => {
    if (sfxIndex[tag]) return sfxIndex[tag];
    return Object.values(sfxIndex).find((v) => v.aliases?.includes(tag));
  };
  const sfx = [];
  const pushSfx = (tag, at, gain = 1) => {
    const e = resolveTag(tag);
    if (!e) return warnings.push(`SFX inconnu : « ${tag} » (voir public/sfx/index.json)`);
    sfx.push({ src: `sfx/${e.file}`, at: +at.toFixed(3), volume: +(style.audio.sfxVolume * (e.volume ?? 1) * gain).toFixed(3), tag, hits: e.ambience ? [] : (e.hits ?? [0]) });
  };
  let heure;
  const reveals = [];
  for (const s of shots) {
    for (const x of s.sfx ?? []) pushSfx(x.tag, s.start + (x.at ?? 0), x.gain ?? 1);
    // SFX automatiques sur les éléments qui apparaissent (désactivable avec "autoSfx": false)
    if (s.autoSfx !== false && s.insert) {
      const ins = s.insert;
      if (ins.type === "checklist") ins.items.forEach((_, k) => pushSfx("clic", s.start + 0.38 + k * 0.5, 0.9));
      if (ins.type === "sms") ins.messages.forEach((_, k) => pushSfx("notif", s.start + 0.25 + k * 0.7, 0.8));
      if (ins.type === "evidence") ins.items.forEach((_, k) => pushSfx("papier", s.start + 0.3 + k * 0.45, 0.6));
    }
    if (s.hud?.heure && s.hud.heure !== heure) {
      if (heure !== undefined) pushSfx("bip-hud", s.start);
      heure = s.hud.heure;
    }
    if (s.reveal) {
      reveals.push(s.start);
      if (!(s.sfx ?? []).some((x) => ["boom", "impact-grave"].includes(x.tag))) pushSfx("boom", s.start);
    }
    if (s.transition === "whip" && !(s.sfx ?? []).some((x) => x.tag === "whoosh")) pushSfx("whoosh", Math.max(0, s.start - 0.05), 0.8);
    if (s.insert && ["phone", "sms", "map", "evidence", "checklist", "counter", "polaroid", "press"].includes(s.insert.type) && !(s.sfx ?? []).length) pushSfx("whoosh", s.start, 0.5);
  }
  sfx.sort((a, b) => a.at - b.at);

  const musicName = script.music ?? "drone-1";
  const musicFile = fs.existsSync(path.join(PUBLIC, "music")) ? fs.readdirSync(path.join(PUBLIC, "music")).find((f) => f.startsWith(musicName + ".")) : null;

  const cast = Object.fromEntries((script.cast ?? []).map((c) => [c.id, c]));
  for (const s of shots) for (const c of s.characters ?? []) if (!cast[c.id]) warnings.push(`plan ${s.id} : personnage « ${c.id} » absent du casting`);

  const props = {
    meta: { affaire: script.affaire, titre: script.titre, width: style.video.width, height: style.video.height, fps: style.video.fps, duration },
    palette: style.palette,
    style: { subtitles: style.subtitles, camera: style.camera, audio: style.audio },
    cast,
    voiceSrc: fs.existsSync(ep.voice) && alignment.source !== "silent" ? ep.rel("voice.mp3") : null,
    musicSrc: musicFile ? `music/${musicFile}` : null,
    words,
    shots,
    sfx,
    reveals,
  };
  return { props, warnings, script };
}

if (import.meta.url === `file://${process.argv[1]}`) {
  const ep = episode();
  const { props, warnings } = buildProps(ep);
  writeJson(ep.props, props);
  warnings.forEach((w) => console.warn("⚠", w));
  console.log(`render.json : ${props.shots.length} plans, ${props.meta.duration.toFixed(1)} s, ${props.sfx.length} SFX, voix ${props.voiceSrc ? "oui" : "NON (muet)"}`);
}
