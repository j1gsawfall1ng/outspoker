# Référence storyboard : `script.json` + `shots.json`

Ces deux fichiers vivent dans `public/episodes/<affaire>/`. Claude les écrit à partir de ton script ;
tout le reste (voix, décors, calage, rendu) est automatique.

## script.json

```jsonc
{
  "affaire": "AFFAIRE DUPONT · NANTES 2011",   // ligne 3 du HUD
  "titre": "…",                               // titre interne
  "caption": "Légende TikTok",                // -> out/<affaire>/legende.txt
  "hashtags": ["#truecrime", "…"],
  "music": "drone-1",                         // drone-1 | drone-2 | drone-3 (public/music/)
  "sources": ["url ou référence"],            // obligatoire moralement : faits vérifiés
  "voice": { "voiceId": "…", "speed": 1.0 },  // optionnel, sinon style.json / ELEVENLABS_VOICE_ID
  "cast": [
    { "id": "victime", "nom": "…", "role": "victime", "tenue": "#B5523F", "accessoires": ["cheveux-longs"], "mineur": false },
    { "id": "suspect", "role": "suspect", "tenue": "#070B14", "accessoires": ["capuche"], "silhouette": true, "condamne": false }
  ],
  "sentences": [
    { "text": "Phrase de voix off.", "indices": ["23h47"], "alertes": ["disparaît"] }
  ]
}
```

- **accessoires** : `casquette` (police), `lunettes`, `capuche`, `cheveux-longs`, `cheveux-courts`, `cravate`.
- **silhouette: true** : personnage noir avec halo (inconnu, victime dans les moments graves).
- **condamne** : `false` => le contrôle signale « tueur / assassin / meurtrier / coupable » dans le texte.
- **indices** (jaune #FFC93C) / **alertes** (rouge #E5383B) : mots surlignés dans les sous-titres.
- Le texte est lu tel quel par la voix : écris les nombres comme on doit les entendre si besoin, évite les guillemets « » isolés.

## shots.json

```jsonc
{
  "decors": { "parking-nuit": "small empty parking lot behind shops at night, one parked car" }, // description EN pour Gemini
  "tail": 1.6,          // secondes de tenue après le dernier mot (cliffhanger)
  "shots": [ { …plan… } ]
}
```

### Un plan

| champ | valeurs | rôle |
|---|---|---|
| `id` | entier | unique |
| `sentence` | index dans `sentences` | le plan commence au début de cette phrase… |
| `at` | mot de la phrase (`"mot"` ou `"mot#2"` pour la 2e occurrence) | …ou sur ce mot (coupe sur la voix) |
| `framing` | `large` \| `moyen` \| `insert` | jamais deux `large` d'affilée |
| `bg` | slug de décor (clé de `decors`) | décor IA |
| `characters` | `[{ id, pose, x, toX?, y?, scale?, dir?, expression?, expressionAt?, regardCamera? }]` | stickmen |
| `insert` | voir ci-dessous | composant par-dessus |
| `camera` | `{type:"zoom",from,to}` \| `{type:"pan",dir}` \| `{type:"punch",from,to}` \| `{type:"static-shake"}` | défaut zoom 1,00→1,08 |
| `transition` | `cut` (défaut) \| `whip` (saut de lieu) \| `noir` (ellipse grave) | |
| `shake` | bool | micro-tremblement (tension) |
| `reveal` | bool | 0,4 s de silence musical avant + boom auto + tremblement |
| `lumiere` | `eteinte` \| `sirene` \| `flash` | effets lumière |
| `props` | `[{type:"lampe"\|"porte"\|"voiture"\|"chaise", x, etat?}]` | `porte` : `fermee`/`entrouverte`/`ouverte` ; `lampe` : `eteinte` ; `voiture` : `allumee` |
| `sfx` | `[{tag, at, gain?}]` | `at` = secondes depuis le début du plan |
| `highlight` / `danger` | `["mot", "deux mots"]` | surlignage jaune / rouge limité à ce plan |
| `hud` | `{ jour?, heure? }` | se propage aux plans suivants ; changement d'heure = compteur + bip auto |
| `autoSfx` | `false` | coupe les SFX automatiques des inserts |

- **poses** : `debout`, `marche`, `course`, `assis`, `telephone`, `pointe`, `bras-croises`, `recule`.
- **expressions** : `neutre`, `peur`, `sourire`, `colere`, `choc` (avec `expressionAt` : change sur ce mot).
- **x / toX** : 0 = bord gauche, 1 = bord droit. `toX` => déplacement pendant le plan (direction auto).
- **y** : position des pieds (défaut 0.78). **scale** : 1 ≈ 560 px de haut (1.3–1.5 pour un plan moyen serré).

### Inserts

| type | champs |
|---|---|
| `title` | `text`, `sub?` — **obligatoire dans le 1er plan (hook)** |
| `question` | `text` — cliffhanger final |
| `partie` | `text?` (défaut « PARTIE 2 ») |
| `phone` | `app: appel\|alerte\|notif`, `title`, `subtitle?`, `time?` |
| `sms` | `from`, `messages: [{text, me?}]`, `time?` |
| `map` | `from`, `to`, `distance?` — trajet animé |
| `evidence` | `title`, `items: [..]` — dossier de preuves |
| `checklist` | `title`, `items: [{text, state: ok\|ko\|?}]` — se coche / se barre |
| `counter` | `label`, `from`, `to`, `unit?` |
| `polaroid` | `caption`, `bg?` (slug de décor à afficher dans la photo) |
| `press` | `journal`, `headline`, `date?` — coupure de presse |
| `cctv` | `cam`, `timestamp` (`HH:MM:SS`) — surcouche caméra de surveillance plein écran |

### SFX disponibles (`public/sfx/index.json`)

`bip`, `bip-hud`, `bip-cctv`, `boom`, `impact`, `whoosh`, `souffle-tension`, `pas`, `pas-course`, `porte`,
`porte-claque`, `verrou`, `sonnerie`, `vibreur`, `notif`, `papier`, `clavier`, `tic-tac`, `coeur`, `sirene`,
`voiture`, `glitch`, `clic`, `appareil-photo`, `vent` (+ alias : `pas-asphalte`, `telephone`, `sms`, `serrure`, `riser`…).

Automatiques (inutile de les écrire) : `bip-hud` à chaque changement d'heure, `boom` sur `reveal`,
`whoosh` sur `transition: "whip"` et à l'entrée d'un insert sans SFX, `clic` par ligne de checklist,
`notif` par SMS, `papier` par preuve.

## Règles (vérifiées par `npm run check`)

- Durée totale 61–80 s (≈ 190–210 mots, débit 165–175 mots/min) ; 28–35 plans.
- Plan : 1,2 à 4 s (≤ 3 s s'il ne s'anime pas) ; jamais statique.
- ≥ 1 SFX toutes les 2 s (cible 1 toutes les 1,5 s).
- Pas deux plans `large` consécutifs ; alterner large / moyen / insert.
- Titre (`insert.type = "title"`) dans les 1,5 premières secondes ; cliffhanger (`question`/`partie`) à la fin.
- True crime : violence toujours suggérée, aucune personne réelle reconnaissable, « suspect / mis en cause »
  tant que non condamné, aucun nom de mineur, faits sourcés.

## Squelette temporel cible

| Temps | Bloc | Visuel |
|---|---|---|
| 0–3 s | Hook | lieu calme + rupture + `title` |
| 3–12 s | Le personnage | routine, HUD jour/heure |
| 12–25 s | Déclencheur | `phone` / `sms` / `cctv`, `counter` |
| 25–50 s | Enquête | `map`, `evidence`, `checklist`, fausses pistes |
| 50–62 s | Basculement | `reveal: true`, détail zoomé (`punch`) |
| 62–72 s | Cliffhanger | `question` puis `partie` |
