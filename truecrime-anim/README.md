# truecrime-anim — vidéos TikTok true crime animées (stickman 2D + HUD)

Mise en œuvre du blueprint : marionnettes SVG animées en code, décors IA à style verrouillé,
HUD « journal de survie », sous-titres karaoké, SFX à chaque action, montage 100 % piloté par JSON (Remotion).

## Utilisation au quotidien

Envoie ton script à Claude (dans ce dépôt). La skill `video-tiktok` s'occupe de tout :
`script.json` + `shots.json` → voix → décors → contrôles → rendu → MP4 + miniature + légende.

À la main :

```bash
npm run setup                           # une fois : vérifie Node/ffmpeg, installe, génère la banque SFX / musiques
npm run new -- --affaire mon-affaire    # gabarit d'épisode
npm run episode -- --affaire mon-affaire --draft   # tout le pipeline, rendu brouillon
npm run render  -- --affaire mon-affaire           # rendu final
npm run studio                          # prévisualisation interactive Remotion
```

## Installation sur ton PC (Windows / Mac)

1. Node.js 20+ : https://nodejs.org (version LTS).
2. ffmpeg : Windows `winget install --id Gyan.FFmpeg -e` · Mac `brew install ffmpeg`. Ferme et rouvre ensuite le terminal / l'app.
3. Dans `truecrime-anim/` : `npm run setup`.
4. Test : `npm run episode -- --affaire demo-fictive --draft` → `out/demo-fictive/demo-fictive-draft.mp4`.

Au premier rendu, Remotion télécharge son navigateur (une seule fois).

## Clés (facultatives, dans `.env` ou les secrets de l'environnement)

| Variable | Rôle | Sans elle |
|---|---|---|
| `GEMINI_API_KEY` | décors générés automatiquement (Google AI Studio) | `prompts.md` à coller dans l'app Gemini, images déposées dans `bg/` |
| `ELEVENLABS_API_KEY`, `ELEVENLABS_VOICE_ID` | optionnel : horodatage exact des mots | **par défaut : voix ElevenLabs via ton compte vidIQ lié** (Claude la génère, alignement estimé) |
| `GEMINI_IMAGE_MODEL` | autre modèle image | `gemini-2.5-flash-image` |

> L'abonnement Gemini Pro (app) n'inclut pas l'API : la clé API se crée sur https://aistudio.google.com/apikey
> (la génération d'images via API peut demander d'activer la facturation). Sans clé, le mode manuel
> avec l'app Gemini fonctionne très bien : tu génères, tu envoies les images à Claude.

Ajoute `style/reference.png` (un décor que tu aimes) : il sera joint à chaque génération comme référence de style.

## Arborescence

```
style.json              charte : palette, polices, caméra, audio, prompt de base, règles
remotion/               composition (Episode, Shot), characters/Stickman.tsx, components/ (HUD, sous-titres, inserts, décors)
scripts/                voice, backgrounds, build-props (calage), check (contrôles), render, episode (tout-en-un)
public/sfx/             bruitages tagués (index.json) — synthétisés ; remplace-les par de vrais sons en gardant le nom
public/music/           nappes suspense drone-1..3
public/bg-cache/        décors réutilisés entre épisodes
public/episodes/<slug>/ script.json, shots.json, alignment.json, voice.mp3, bg/
out/<slug>/             MP4, miniature.png, legende.txt (non versionné)
docs/storyboard.md      référence complète du format
```

Remotion est gratuit pour un indépendant ; vérifie la licence si tu montes une structure.
