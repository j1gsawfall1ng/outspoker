import React from "react";
import { Composition } from "remotion";
import { Episode } from "./Episode";
import type { RenderProps } from "./types";
import style from "../style.json";

// Props par défaut (le vrai contenu arrive via --props=public/episodes/<affaire>/render.json)
const defaults: RenderProps = {
  meta: { affaire: "AFFAIRE · VILLE ANNÉE", titre: "Titre", width: 1080, height: 1920, fps: 30, duration: 3 },
  palette: style.palette,
  style: { subtitles: style.subtitles, camera: style.camera, audio: style.audio },
  cast: {},
  voiceSrc: null,
  musicSrc: null,
  words: [],
  shots: [{ id: 1, sentence: 0, framing: "large", bg: "rue-nuit", start: 0, end: 3, insert: { type: "title", text: "Lance npm run episode" } }],
  sfx: [],
  reveals: [],
};

export const Root: React.FC = () => (
  <Composition
    id="Episode"
    component={Episode}
    width={1080}
    height={1920}
    fps={30}
    durationInFrames={90}
    defaultProps={defaults}
    calculateMetadata={({ props }) => ({
      durationInFrames: Math.max(1, Math.round(props.meta.duration * props.meta.fps)),
      fps: props.meta.fps,
      width: props.meta.width,
      height: props.meta.height,
    })}
  />
);
