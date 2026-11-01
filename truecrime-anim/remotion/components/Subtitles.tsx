import React, { useMemo } from "react";
import { interpolate, spring, useCurrentFrame, useVideoConfig } from "remotion";
import type { RenderProps, Word } from "../types";

type Chunk = { words: Word[]; start: number; end: number };

const buildChunks = (words: Word[], maxWords: number): Chunk[] => {
  const chunks: Chunk[] = [];
  let cur: Word[] = [];
  const flush = () => {
    if (cur.length) chunks.push({ words: cur, start: cur[0].start, end: cur[cur.length - 1].end });
    cur = [];
  };
  words.forEach((w, i) => {
    const next = words[i + 1];
    cur.push(w);
    const punct = /[.,;:!?…]$/.test(w.text);
    const sentenceEnd = !next || next.sentence !== w.sentence;
    if (cur.length >= maxWords || sentenceEnd || (punct && cur.length >= 2)) flush();
  });
  flush();
  // chaque bloc reste affiché jusqu'au suivant (max +0,35 s)
  return chunks.map((c, i) => ({ ...c, end: Math.min(chunks[i + 1]?.start ?? c.end + 0.35, c.end + 0.35) }));
};

// Sous-titres karaoké : 2 à 4 mots, majuscules, mot actif agrandi avec pop,
// indices en jaune, danger en rouge, contour noir + ombre douce.
export const Subtitles: React.FC<{ props: RenderProps }> = ({ props }) => {
  const frame = useCurrentFrame();
  const { fps, width, height } = useVideoConfig();
  const t = frame / fps;
  const st = props.style.subtitles;
  const chunks = useMemo(() => buildChunks(props.words, st.maxWords), [props.words, st.maxWords]);
  const chunk = chunks.find((c) => t >= c.start && t < c.end);
  if (!chunk) return null;

  // quand une carte (téléphone, carte, preuves…) est à l'écran, les sous-titres descendent sous la carte
  const CARDS = ["phone", "sms", "map", "evidence", "checklist", "counter", "polaroid", "press"];
  const shot = props.shots.find((s) => t >= s.start && t < s.end);
  const yRatio = shot?.insert && CARDS.includes(shot.insert.type) ? st.yRatioInsert ?? 0.74 : st.yRatio;
  const enter = spring({ frame: frame - Math.round(chunk.start * fps), fps, config: { damping: 14, stiffness: 220 } });

  return (
    <div
      style={{
        position: "absolute",
        left: width * 0.15,
        width: width * 0.7,
        top: height * yRatio,
        transform: `translateY(-50%) scale(${interpolate(enter, [0, 1], [0.85, 1])})`,
        display: "flex",
        flexWrap: "wrap",
        justifyContent: "center",
        gap: "0 0.42em",
        fontFamily: "Montserrat, sans-serif",
        fontWeight: 800,
        fontSize: st.size,
        lineHeight: 1.15,
        textTransform: "uppercase",
        textAlign: "center",
      }}
    >
      {chunk.words.map((w, i) => {
        const active = t >= w.start && t < (chunk.words[i + 1]?.start ?? chunk.end);
        const pop = active ? spring({ frame: frame - Math.round(w.start * fps), fps, config: { damping: 10, stiffness: 300 } }) : 0;
        const color = w.color === "alerte" ? props.palette.alerte : w.color === "indice" ? props.palette.indice : "#FFFFFF";
        return (
          <span
            key={i}
            style={{
              display: "inline-block",
              color,
              WebkitTextStroke: `${st.stroke}px #000`,
              paintOrder: "stroke fill",
              textShadow: "0 6px 18px rgba(0,0,0,0.65)",
              transform: `scale(${active ? interpolate(pop, [0, 1], [1, st.activeScale]) : 1})`,
              opacity: t >= w.start - 0.02 ? 1 : 0.55,
            }}
          >
            {w.text.replace(/[,;:]$/, "")}
          </span>
        );
      })}
    </div>
  );
};
