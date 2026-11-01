import React from "react";
import { AbsoluteFill, Easing, interpolate, useCurrentFrame, useVideoConfig } from "remotion";
import { Background, SceneProp } from "./components/Background";
import { InsertView } from "./components/Inserts";
import { Stickman } from "./characters/Stickman";
import type { RenderProps, Shot } from "./types";

const ease = Easing.inOut(Easing.cubic);

const shakeAt = (frame: number, px: number) => [
  (Math.sin(frame * 1.7) + Math.sin(frame * 3.1)) * px * 0.5,
  (Math.cos(frame * 2.3) + Math.sin(frame * 1.3)) * px * 0.5,
];

export const ShotView: React.FC<{ shot: Shot; props: RenderProps; fadeOut: boolean }> = ({ shot, props, fadeOut }) => {
  const frame = useCurrentFrame();
  const { fps, width, height } = useVideoConfig();
  const t = frame / fps;
  const dur = Math.max(0.05, shot.end - shot.start);
  const p = Math.min(1, t / dur);
  const cam = props.style.camera;
  const pal = props.palette;
  const c = shot.camera ?? { type: "zoom" as const };

  // --- caméra : aucun plan statique ---
  let scale = 1;
  let fgX = 0;
  let bgX = 0;
  if (c.type === "zoom") {
    scale = interpolate(ease(p), [0, 1], [c.from ?? cam.zoomFrom, c.to ?? cam.zoomTo]);
  } else if (c.type === "pan") {
    const sign = c.dir === "gauche" ? 1 : -1;
    const range = width * cam.panRatio;
    fgX = sign * interpolate(ease(p), [0, 1], [-range / 2, range / 2]);
    bgX = fgX * 0.3; // parallaxe : fond à 30 % de la vitesse du premier plan
    scale = 1.06;
  } else if (c.type === "punch") {
    const k = Math.min(1, t / cam.punchDuration);
    scale = interpolate(Easing.out(Easing.exp)(k), [0, 1], [c.from ?? 1, c.to ?? cam.punchTo]) + p * 0.03;
  } else {
    scale = 1.04;
  }
  let [sx, sy] = [0, 0];
  if (shot.shake || c.type === "static-shake" || (shot.reveal && t < 0.5)) [sx, sy] = shakeAt(frame, shot.reveal && t < 0.5 ? cam.shakePx * 3 : cam.shakePx);

  // --- transitions ---
  let whipX = 0;
  let blur = 0;
  if (shot.transition === "whip" && t < 0.15) {
    const k = t / 0.15;
    whipX = (1 - k) * width * 0.35;
    blur = (1 - k) * 28;
  }
  const fadeIn = shot.transition === "noir" ? interpolate(t, [0, 0.5], [1, 0], { extrapolateRight: "clamp" }) : 0;
  const fadeOutK = fadeOut ? interpolate(t, [dur - 0.25, dur], [0, 1], { extrapolateLeft: "clamp", extrapolateRight: "clamp" }) : 0;

  const isCctv = shot.insert?.type === "cctv";
  const focusInsert = shot.insert && shot.framing === "insert" && !["title", "question", "partie", "cctv"].includes(shot.insert.type);
  const flicker = shot.lumiere === "eteinte" ? (t < 0.25 ? 1 : t < 0.35 ? 0 : t < 0.42 ? 1 : 0) : 1;

  return (
    <AbsoluteFill style={{ overflow: "hidden", backgroundColor: "#000" }}>
      <AbsoluteFill
        style={{
          transform: `translate(${sx + whipX}px, ${sy}px) scale(${scale})`,
          filter: [blur ? `blur(${blur}px)` : "", isCctv ? "grayscale(0.75) contrast(1.25) brightness(0.85) sepia(0.2) hue-rotate(60deg)" : "", focusInsert ? "blur(6px) brightness(0.55)" : ""].join(" ").trim() || undefined,
        }}
      >
        <AbsoluteFill style={{ transform: `translateX(${bgX}px) scale(1.05)` }}>
          <Background slug={shot.bg} src={shot.bgSrc} palette={pal} />
        </AbsoluteFill>
        <AbsoluteFill style={{ transform: `translateX(${fgX}px)` }}>
          {(shot.props ?? []).map((sp, k) => (
            <SceneProp key={k} type={sp.type} x={sp.x} etat={sp.etat ?? (shot.lumiere === "eteinte" ? "eteinte" : undefined)} palette={pal} flicker={flicker} />
          ))}
          {(shot.characters ?? []).map((ch, k) => {
            const member = props.cast[ch.id] ?? { id: ch.id, tenue: "#3B4A63" };
            const h = 560 * (ch.scale ?? 1);
            const w = (h * 200) / 420;
            const x = interpolate(ease(p), [0, 1], [ch.x, ch.toX ?? ch.x]);
            const dir = ch.dir ?? (ch.toX !== undefined && ch.toX < ch.x ? "gauche" : "droite");
            const expr = ch.expressionFrom !== undefined && t < ch.expressionFrom ? "neutre" : ch.expression;
            return (
              <div key={k} style={{ position: "absolute", left: x * width - w / 2, top: (ch.y ?? 0.78) * height - h * (410 / 420), width: w, height: h, transform: dir === "gauche" ? "scaleX(-1)" : undefined, filter: member.silhouette ? `drop-shadow(0 0 3px ${pal.hud}) drop-shadow(0 0 14px rgba(159,179,200,0.55))` : "drop-shadow(0 18px 18px rgba(0,0,0,0.45))" }}>
                <Stickman member={member} pose={ch.pose} time={t} expression={expr} palette={pal} regardCamera={ch.regardCamera} />
              </div>
            );
          })}
        </AbsoluteFill>
        {shot.lumiere === "eteinte" && <AbsoluteFill style={{ background: "#000", opacity: flicker ? 0 : 0.72 }} />}
        {shot.lumiere === "sirene" && (
          <AbsoluteFill style={{ background: Math.floor(t * 4) % 2 ? pal.alerte : "#2F6FEB", opacity: 0.16 + 0.08 * Math.sin(t * 25), mixBlendMode: "screen" }} />
        )}
        {shot.lumiere === "flash" && <AbsoluteFill style={{ background: "#fff", opacity: interpolate(t, [0, 0.25], [0.85, 0], { extrapolateRight: "clamp" }) }} />}
        <AbsoluteFill style={{ background: "radial-gradient(ellipse at center, transparent 55%, rgba(0,0,0,0.55) 100%)" }} />
      </AbsoluteFill>
      {shot.insert && <InsertView insert={shot.insert} pal={pal} duration={dur} />}
      {fadeIn > 0 && <AbsoluteFill style={{ background: "#000", opacity: fadeIn }} />}
      {fadeOutK > 0 && <AbsoluteFill style={{ background: "#000", opacity: fadeOutK }} />}
    </AbsoluteFill>
  );
};
