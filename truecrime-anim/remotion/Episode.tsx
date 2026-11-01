import React from "react";
import { AbsoluteFill, Audio, Sequence, staticFile, useVideoConfig } from "remotion";
import "@fontsource/montserrat/600.css";
import "@fontsource/montserrat/700.css";
import "@fontsource/montserrat/800.css";
import { Hud } from "./components/Hud";
import { Subtitles } from "./components/Subtitles";
import { ShotView } from "./Shot";
import type { RenderProps } from "./types";

export const Episode: React.FC<RenderProps> = (props) => {
  const { fps, durationInFrames } = useVideoConfig();
  const a = props.style.audio;

  // Musique : coupée 0,4 s avant chaque révélation, puis remonte en 1 s
  const musicVolume = (f: number) => {
    const t = f / fps;
    const total = durationInFrames / fps;
    let v = a.musicVolume * Math.min(1, t / 0.6) * Math.min(1, Math.max(0, (total - t) / 1.2));
    for (const r of props.reveals) {
      if (t >= r - a.revealSilence && t < r + 0.15) v = 0;
      else if (t >= r + 0.15 && t < r + 1.2) v *= (t - r - 0.15) / 1.05;
    }
    return v;
  };

  return (
    <AbsoluteFill style={{ backgroundColor: "#000" }}>
      {props.shots.map((s, i) => {
        const from = Math.round(s.start * fps);
        const to = Math.round(s.end * fps);
        if (to <= from) return null;
        return (
          <Sequence key={s.id} from={from} durationInFrames={to - from} layout="none">
            <ShotView shot={s} props={props} fadeOut={props.shots[i + 1]?.transition === "noir"} />
          </Sequence>
        );
      })}
      <Hud shots={props.shots} affaire={props.meta.affaire} palette={props.palette} />
      <Subtitles props={props} />
      {props.voiceSrc && <Audio src={staticFile(props.voiceSrc)} volume={a.voiceVolume} />}
      {props.musicSrc && <Audio src={staticFile(props.musicSrc)} volume={musicVolume} loop />}
      {props.sfx.map((s, i) => (
        <Sequence key={`sfx${i}`} from={Math.max(0, Math.round(s.at * fps))} layout="none">
          <Audio src={staticFile(s.src)} volume={s.volume} />
        </Sequence>
      ))}
    </AbsoluteFill>
  );
};
