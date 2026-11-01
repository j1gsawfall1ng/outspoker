// Crée le dossier d'un nouvel épisode avec des gabarits script.json / shots.json.
// Usage : npm run new -- --affaire <slug>
import fs from "node:fs";
import { episode, writeJson } from "./lib.mjs";

const ep = episode();
if (fs.existsSync(ep.script)) {
  console.error(`${ep.dir} existe déjà.`);
  process.exit(1);
}
fs.mkdirSync(ep.bgDir, { recursive: true });
writeJson(ep.script, {
  affaire: "AFFAIRE NOM · VILLE ANNÉE",
  titre: "Titre du hook",
  caption: "Légende TikTok",
  hashtags: ["#truecrime", "#faitdivers", "#enquete", "#histoirevraie", "#pourtoi"],
  music: "drone-1",
  sources: [],
  cast: [
    { id: "enqueteur", nom: "L'enquêteur", role: "enquêteur", tenue: "#2F4A7A", accessoires: ["casquette"] },
    { id: "victime", role: "victime", tenue: "#7A8BA6", accessoires: ["cheveux-longs"] },
    { id: "suspect", role: "suspect", tenue: "#3A3F4B", accessoires: ["capuche"], condamne: false },
  ],
  sentences: [{ text: "Première phrase de la voix off." }],
});
writeJson(ep.shots, {
  decors: { "rue-nuit": "empty residential street at night, single street lamp, parked cars" },
  tail: 1.6,
  shots: [
    { id: 1, sentence: 0, framing: "large", bg: "rue-nuit", camera: { type: "zoom", from: 1, to: 1.08 }, insert: { type: "title", text: "Titre" }, sfx: [{ tag: "impact", at: 0 }], hud: { jour: 1, heure: "23:47" } },
  ],
});
console.log(`Épisode créé : ${ep.dir}`);
