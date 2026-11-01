// Contrôles automatiques avant rendu (règles du blueprint).
// Usage : npm run check -- --affaire <slug>   (code de sortie 1 si erreur bloquante)
import { episode, readJson, style, norm } from "./lib.mjs";

export function check(props, script) {
  const r = style.rules;
  const errors = [];
  const warns = [];
  const { shots, sfx, meta, words } = props;

  // Durée totale
  if (meta.duration < r.minTotal || meta.duration > r.maxTotal) errors.push(`durée totale ${meta.duration.toFixed(1)} s hors cible ${r.minTotal}–${r.maxTotal} s (vise 190–210 mots)`);

  // Durée des plans
  for (const s of shots) {
    const d = s.end - s.start;
    const animated = s.insert || (s.characters ?? []).some((c) => c.toX !== undefined || c.expressionAt || ["marche", "course"].includes(c.pose));
    const last = s === shots.at(-1);
    if (d > r.maxShot + (last ? 2 : 0)) errors.push(`plan ${s.id} trop long : ${d.toFixed(2)} s (max ${r.maxShot} s) -> ajoute un plan avec "at"`);
    else if (d > 3 && !animated) warns.push(`plan ${s.id} : ${d.toFixed(2)} s sans élément animé (max 3 s conseillé)`);
    if (d < r.minShot) errors.push(`plan ${s.id} trop court : ${d.toFixed(2)} s (min ${r.minShot} s)`);
  }

  // Densité SFX : au moins un toutes les 2 s
  const times = [0, ...sfx.flatMap((x) => (x.hits ?? [0]).map((h) => x.at + h)), meta.duration].sort((a, b) => a - b);
  for (let i = 1; i < times.length; i++) {
    if (times[i] - times[i - 1] > r.maxSfxGap + 0.05) warns.push(`trou de ${(times[i] - times[i - 1]).toFixed(1)} s sans SFX entre ${times[i - 1].toFixed(1)} s et ${times[i].toFixed(1)} s`);
  }
  const density = sfx.filter((x) => x.hits?.length).length / meta.duration;
  if (density < 0.5) warns.push(`densité SFX ${density.toFixed(2)}/s (cible ≈ 0,66/s, 1 toutes les 1,5 s)`);

  // Variation : jamais deux plans larges de suite
  for (let i = 1; i < shots.length; i++) if (shots[i].framing === "large" && shots[i - 1].framing === "large") errors.push(`plans ${shots[i - 1].id} et ${shots[i].id} : deux plans larges consécutifs`);

  // Hook : titre visible dans les 1,5 premières secondes
  if (!shots.some((s) => s.start <= r.hookWithin && s.insert?.type === "title")) errors.push(`pas de titre (insert "title") dans les ${r.hookWithin} premières secondes`);

  // Fin : cliffhanger
  const lastShot = shots.at(-1);
  if (!["question", "partie"].includes(lastShot.insert?.type)) warns.push(`dernier plan sans insert "question" ou "partie" (cliffhanger)`);

  // Aucun plan statique
  for (const s of shots) if (s.camera && s.camera.type === "zoom" && Math.abs((s.camera.to ?? 1.08) - (s.camera.from ?? 1)) < 0.03) warns.push(`plan ${s.id} : zoom quasi nul (plan statique)`);

  // Nombre de plans
  if (shots.length < 26 || shots.length > 38) warns.push(`${shots.length} plans (cible 28–35)`);

  // Débit voix
  const wpm = (words.length / (words.at(-1).end - words[0].start)) * 60;
  if (wpm < 150 || wpm > 190) warns.push(`débit voix ${wpm.toFixed(0)} mots/min (cible 165–175)`);

  // Règles true crime : présomption d'innocence
  const accusing = ["tueur", "tueuse", "meurtrier", "meurtriere", "assassin", "assassine", "coupable", "violeur"];
  const nonCondamnes = (script.cast ?? []).filter((c) => /suspect|mis en cause|accuse/i.test(c.role ?? "") && !c.condamne);
  if (nonCondamnes.length) {
    for (const w of words) if (accusing.includes(norm(w.text))) warns.push(`« ${w.text} » (${w.start.toFixed(1)} s) alors que ${nonCondamnes.map((c) => c.id).join(", ")} n'est pas condamné : préfère « suspect » / « mis en cause »`);
  }
  if (!script.sources?.length) warns.push(`aucune source dans script.json ("sources") : vérifie dates, lieux et faits`);
  for (const c of script.cast ?? []) if (/victime/i.test(c.role ?? "") && c.mineur && c.nom) errors.push(`victime mineure « ${c.id} » : pas de nom`);

  // Décors
  const missingBg = [...new Set(shots.filter((s) => !s.bgSrc).map((s) => s.bg))];
  if (missingBg.length) warns.push(`décors manquants (décor de secours utilisé) : ${missingBg.join(", ")}`);
  if (!props.voiceSrc) warns.push(`pas de voix off : rendu MUET (aperçu)`);

  return { errors, warns };
}

if (import.meta.url === `file://${process.argv[1]}`) {
  const ep = episode();
  const props = readJson(ep.props);
  const script = readJson(ep.script);
  const { errors, warns } = check(props, script);
  warns.forEach((w) => console.log("⚠", w));
  errors.forEach((e) => console.log("✗", e));
  console.log(errors.length ? `\n${errors.length} erreur(s) bloquante(s).` : `\nContrôles OK (${warns.length} avertissement(s)).`);
  process.exit(errors.length ? 1 : 0);
}
