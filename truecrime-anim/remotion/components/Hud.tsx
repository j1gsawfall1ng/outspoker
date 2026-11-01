import React from "react";
import { interpolate, useCurrentFrame, useVideoConfig } from "remotion";
import type { Shot } from "../types";

const FONT = "Montserrat, sans-serif";

const toMinutes = (h?: string) => {
  if (!h) return null;
  const m = /^(\d{1,2}):(\d{2})/.exec(h);
  return m ? Number(m[1]) * 60 + Number(m[2]) : null;
};
const fmt = (mins: number) => {
  const m = ((Math.round(mins) % 1440) + 1440) % 1440;
  return `${String(Math.floor(m / 60)).padStart(2, "0")}:${String(m % 60).padStart(2, "0")}`;
};

// HUD « journal de survie » : JOUR n (point rouge clignotant), heure en grand, nom de l'affaire.
// L'heure défile façon compteur à chaque saut temporel (0,45 s).
export const Hud: React.FC<{ shots: Shot[]; affaire: string; palette: Record<string, string> }> = ({ shots, affaire, palette }) => {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();
  const t = frame / fps;

  // état HUD courant + précédent (propagé de plan en plan)
  let jour: number | string | undefined;
  let heure: string | undefined;
  let prevHeure: string | undefined;
  let changeAt = -10;
  for (const s of shots) {
    if (s.start > t) break;
    if (s.hud?.jour !== undefined) jour = s.hud.jour;
    if (s.hud?.heure && s.hud.heure !== heure) {
      prevHeure = heure;
      heure = s.hud.heure;
      changeAt = s.start;
    }
  }
  if (jour === undefined && !heure) return null;

  const cur = toMinutes(heure);
  const prev = toMinutes(prevHeure);
  let shown = heure ?? "";
  const k = (t - changeAt) / 0.45;
  if (cur !== null && prev !== null && k >= 0 && k < 1) {
    let delta = cur - prev;
    if (delta < 0) delta += 1440;
    shown = fmt(prev + delta * interpolate(k, [0, 1], [0, 1], { easing: (x) => 1 - Math.pow(1 - x, 3) }));
  }
  const blink = Math.floor(t * 2) % 2 === 0;
  const flash = k >= 0 && k < 1 ? 1 - k : 0;

  return (
    <div style={{ position: "absolute", left: 64, top: 150, fontFamily: FONT, color: palette.hud, textShadow: "0 2px 12px rgba(0,0,0,0.6)" }}>
      {jour !== undefined && (
        <div style={{ display: "flex", alignItems: "center", gap: 14, fontSize: 38, fontWeight: 800, letterSpacing: 4 }}>
          <span style={{ width: 18, height: 18, borderRadius: 9, background: palette.alerte, opacity: blink ? 1 : 0.25, boxShadow: `0 0 14px ${palette.alerte}` }} />
          {typeof jour === "number" ? `JOUR ${jour}` : String(jour).toUpperCase()}
        </div>
      )}
      {heure && (
        <div style={{ fontSize: 112, fontWeight: 800, color: "#FFFFFF", lineHeight: 1.05, fontVariantNumeric: "tabular-nums", transform: `scale(${1 + flash * 0.06})`, transformOrigin: "left center" }}>
          {shown}
        </div>
      )}
      <div style={{ fontSize: 28, fontWeight: 600, letterSpacing: 5, marginTop: 6, fontVariant: "small-caps", textTransform: "uppercase" }}>{affaire}</div>
    </div>
  );
};
