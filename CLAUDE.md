# Dépôt

- `truecrime-anim/` : pipeline vidéo TikTok true crime animé (Remotion). Quand l'utilisateur envoie un script ou un sujet d'affaire, suis la skill `video-tiktok` (`.claude/skills/video-tiktok/SKILL.md`). Format des fichiers : `truecrime-anim/docs/storyboard.md`.
- Première utilisation sur une machine : `cd truecrime-anim && npm run setup` (vérifie Node 20+ et ffmpeg, installe, génère la banque audio), puis `npm run whisper` (whisper.cpp + modèle, ~1,5 Go) pour caler les sous-titres mot à mot sur la voix.
