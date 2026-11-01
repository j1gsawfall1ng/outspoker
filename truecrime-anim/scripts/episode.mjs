// Une commande pour tout : voix -> décors -> calage -> contrôles -> rendu.
// Usage : npm run episode -- --affaire <slug> [--draft] [--force] [--skip-render] [--verify]
import fs from "node:fs";
import { execFileSync } from "node:child_process";
import { args, episode, writeJson, ROOT } from "./lib.mjs";
import { buildProps } from "./build-props.mjs";
import { check } from "./check.mjs";
import { render } from "./render.mjs";

const ep = episode();
if (!fs.existsSync(ep.script) || !fs.existsSync(ep.shots)) {
  console.error(`script.json / shots.json manquants dans ${ep.dir}. Crée l'épisode avec : npm run new -- --affaire ${ep.slug}`);
  process.exit(1);
}
const run = (script, extra = []) => execFileSync(process.execPath, [`scripts/${script}`, "--affaire", ep.slug, ...extra], { cwd: ROOT, stdio: "inherit" });

console.log("\n① Voix off");
run("voice.mjs", args["force-voice"] ? ["--force"] : []);
console.log("\n② Décors");
run("backgrounds.mjs", args.verify ? ["--verify"] : []);
console.log("\n③ Calage plans / voix");
const { props, warnings, script } = buildProps(ep);
writeJson(ep.props, props);
warnings.forEach((w) => console.warn("⚠", w));
console.log("\n④ Contrôles qualité");
const { errors, warns } = check(props, script);
warns.forEach((w) => console.log("⚠", w));
errors.forEach((e) => console.log("✗", e));
if (errors.length && !args.force) {
  console.log(`\n${errors.length} erreur(s) bloquante(s) : corrige shots.json/script.json, ou relance avec --force.`);
  process.exit(1);
}
if (args["skip-render"]) process.exit(0);
console.log("\n⑤ Rendu");
render(ep, { draft: !!args.draft });
