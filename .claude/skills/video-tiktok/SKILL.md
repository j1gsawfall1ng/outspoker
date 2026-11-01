---
name: video-tiktok
description: Transforme un script (ou un résumé d'affaire) en vidéo TikTok true crime animée — stickman 2D, HUD « journal de survie », sous-titres karaoké, SFX — via le pipeline Remotion de truecrime-anim/. À utiliser dès que l'utilisateur envoie un script, un sujet d'affaire, ou demande une nouvelle vidéo / un épisode / une partie 2.
---

# Vidéo TikTok true crime à partir d'un script

Projet : `truecrime-anim/` (Remotion). Référence complète du format : `truecrime-anim/docs/storyboard.md` — lis-la avant d'écrire le storyboard.
Travaille depuis `truecrime-anim/` ; installe les dépendances si `node_modules/` est absent (`npm install`) et la banque audio si `public/sfx/index.json` manque (`npm run assets`).

## Étapes

1. **Slug** : choisis un slug court (`affaire-dupont-nantes`), puis `npm run new -- --affaire <slug>`.
2. **Script → `script.json`**
   - Découpe le texte en phrases (une entrée `sentences` par phrase). Garde la formulation de l'utilisateur ; ne réécris que si nécessaire et dis-le.
   - Cible 190–210 mots (≈ 65–75 s). Si le script est hors cible, propose une version ajustée et signale l'écart.
   - Vérifie les règles true crime : « suspect / mis en cause » si non condamné (`condamne: false`), pas de nom de mineur, violence suggérée. Ajoute les sources fournies dans `sources` ; si aucune, demande-les ou signale-le.
   - Casting : un personnage par rôle, couleur de tenue distincte + accessoire signature. Inconnu/suspect sans visage = `silhouette: true`.
   - Mets `indices` (jaune) et `alertes` (rouge) sur les mots-clés (heures, lieux, objets, danger).
3. **Storyboard → `shots.json`** (28–35 plans) en suivant le squelette temporel et les règles de rythme de `docs/storyboard.md` :
   - plan 1 = `title` + HUD (`jour`, `heure`) ; dernier = `question` ou `partie` ;
   - 1 à 3 plans par phrase, coupes avec `at` sur un mot-clé ; une phrase de ≥ 9 mots mérite 2 plans ;
   - alterner large / moyen / insert, jamais deux `large` de suite ;
   - 1 SFX par action visible ; `reveal: true` sur le basculement ;
   - 5 à 8 décors réutilisés, décrits en anglais dans `decors` (lieu seulement, pas de personnage ni de texte).
4. **Vérification sans rendu** : `npm run episode -- --affaire <slug> --skip-render`. Corrige `shots.json` jusqu'à 0 erreur (les avertissements de densité SFX méritent aussi une correction).
5. **Décors** :
   - avec `GEMINI_API_KEY` : générés automatiquement à l'étape 4 (ajoute `--verify` pour le contrôle vision) ;
   - sinon : envoie à l'utilisateur le contenu de `public/episodes/<slug>/prompts.md` (prompts prêts à coller dans l'app Gemini) et demande-lui de t'envoyer les images. Enregistre chacune sous `public/episodes/<slug>/bg/<slug-du-decor>.png` (n'importe quel format/taille) puis relance `npm run bg -- --affaire <slug>` (recadrage 9:16 + cache automatiques).
   - Les décors déjà générés sont réutilisés depuis `public/bg-cache/` : réutilise les mêmes slugs entre épisodes quand le lieu s'y prête.
6. **Voix** (par défaut via le compte vidIQ lié de l'utilisateur, pas de clé API) :
   - `vidiq_voiceover_generate` avec `voiceId` = `voice.vidiqVoiceId` de `style.json` (ou `script.json` > `voice.vidiqVoiceId` si présent) et `script` = toutes les phrases jointes par une espace, dans l'ordre exact de `sentences`. Annonce le coût en crédits vidIQ (14 / 1000 caractères, ≈ 20 par vidéo) avant le premier appel de la session.
   - `vidiq_job_poll` jusqu'à `completed`, puis télécharge le MP3 hébergé : `curl -sSL "<url>" -o public/episodes/<slug>/voice-raw.mp3` (attention : **voice-raw**, pas voice).
   - `npm run voice -- --affaire <slug> --estimate` : resserre les pauses trop longues (vidIQ laisse ~0,7 s entre phrases ; limite `voice.maxPause` = 0,3 s) -> `voice.mp3`, puis cale chaque mot avec Whisper (local, installé par `npm run whisper` ; `source: "whisper"` dans `alignment.json`). Sans Whisper, aligne les mots sur les segments de parole détectés (`estimate-from-audio`) : propose alors `npm run whisper` à l'utilisateur.
   - Pour choisir/changer la voix : `vidiq_voiceover_list_voices` (les voix perso/clonées de l'utilisateur ont `isCustom: true`, à privilégier), puis mets l'id dans `style.json`.
   - Après tout changement de texte : régénère la voix puis relance `--estimate`.
   - Si vidIQ n'est pas disponible : `ELEVENLABS_API_KEY` (automatique) ou un `voice.mp3` fourni par l'utilisateur ; sinon rendu muet (aperçu) — préviens-le.
7. **Rendu** : brouillon `npm run episode -- --affaire <slug> --draft` (demi-résolution) pour valider, puis final `npm run render -- --affaire <slug>`.
   Sorties : `out/<slug>/<slug>.mp4` (1080×1920, 30 i/s, −14 LUFS), `miniature.png`, `legende.txt`.
   Envoie le MP4 et la miniature à l'utilisateur (SendUserFile) ; jette un œil à 3–4 images clés (`npx remotion still … --frame=N --scale=0.4`) avant d'annoncer que c'est bon.
8. **Sauvegarde** : commit `public/episodes/<slug>/` (script, shots, alignment, voice, bg) et les nouveaux décors de `public/bg-cache/`, puis push sur la branche de travail. `out/` n'est pas versionné.

## Rappels

- Ne montre jamais l'acte violent : porte qui se ferme, lumière qui s'éteint (`lumiere: "eteinte"`), `transition: "noir"`.
- Ne change pas `style.json` (charte) sans demande explicite : c'est ce qui rend les vidéos cohérentes.
- Pour une « partie 2 » : réutilise le même casting (mêmes ids/tenues), le même `affaire`, les mêmes slugs de décors.
