import React from "react";
import { AbsoluteFill, Img, interpolate, spring, staticFile, useCurrentFrame, useVideoConfig } from "remotion";
import type { Insert } from "../types";

const FONT = "Montserrat, sans-serif";
type Pal = Record<string, string>;

const card: React.CSSProperties = {
  background: "#111B2E",
  border: "3px solid #2B3D57",
  borderRadius: 36,
  boxShadow: "0 30px 80px rgba(0,0,0,0.6)",
  fontFamily: FONT,
  color: "#F2F2F2",
};

// Entrée en glissé du bas avec rebond (spring), sortie rapide en 0,2 s.
const SlideIn: React.FC<{ duration: number; children: React.ReactNode; top?: string; scale?: number }> = ({ duration, children, top = "30%", scale = 1 }) => {
  const frame = useCurrentFrame();
  const { fps, height } = useVideoConfig();
  const enter = spring({ frame, fps, config: { damping: 13, stiffness: 140 } });
  const exitStart = duration * fps - 0.2 * fps;
  const exit = interpolate(frame, [exitStart, duration * fps], [0, 1], { extrapolateLeft: "clamp", extrapolateRight: "clamp" });
  const y = interpolate(enter, [0, 1], [height * 0.7, 0]) + exit * height * 0.4;
  return (
    <AbsoluteFill style={{ alignItems: "center", top, justifyContent: "flex-start" }}>
      <div style={{ transform: `translateY(${y}px) scale(${scale})`, transformOrigin: "top center", opacity: 1 - exit }}>{children}</div>
    </AbsoluteFill>
  );
};

const Phone: React.FC<{ i: Extract<Insert, { type: "phone" }>; pal: Pal }> = ({ i, pal }) => {
  const frame = useCurrentFrame();
  const ring = Math.sin(frame * 1.4) * (i.app === "appel" ? 4 : 0);
  return (
    <div style={{ ...card, width: 560, height: 980, borderRadius: 70, border: "14px solid #05080F", background: "linear-gradient(180deg,#16233B,#0B1322)", transform: `rotate(${ring}deg)`, padding: 50, boxSizing: "border-box", display: "flex", flexDirection: "column", alignItems: "center" }}>
      <div style={{ width: 160, height: 30, borderRadius: 15, background: "#05080F", marginBottom: 60 }} />
      <div style={{ fontSize: 90, fontWeight: 800 }}>{i.time ?? ""}</div>
      <div style={{ marginTop: 70, width: "100%", ...card, borderRadius: 28, padding: 30, background: i.app === "alerte" ? pal.alerte : "#1E2C45", boxSizing: "border-box" }}>
        <div style={{ fontSize: 26, letterSpacing: 3, opacity: 0.8, textTransform: "uppercase" }}>{i.app === "appel" ? "Appel entrant" : i.app === "alerte" ? "Alerte" : "Notification"}</div>
        <div style={{ fontSize: 44, fontWeight: 800, marginTop: 10 }}>{i.title}</div>
        {i.subtitle && <div style={{ fontSize: 32, marginTop: 10, opacity: 0.85 }}>{i.subtitle}</div>}
      </div>
      {i.app === "appel" && (
        <div style={{ marginTop: "auto", display: "flex", gap: 120 }}>
          <div style={{ width: 120, height: 120, borderRadius: 60, background: pal.alerte }} />
          <div style={{ width: 120, height: 120, borderRadius: 60, background: pal.valide, transform: `scale(${1 + Math.abs(Math.sin(frame / 6)) * 0.08})` }} />
        </div>
      )}
    </div>
  );
};

const Sms: React.FC<{ i: Extract<Insert, { type: "sms" }>; pal: Pal }> = ({ i, pal }) => {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();
  return (
    <div style={{ ...card, width: 820, padding: 40, boxSizing: "border-box" }}>
      <div style={{ fontSize: 34, fontWeight: 800, borderBottom: "2px solid #2B3D57", paddingBottom: 20, display: "flex", justifyContent: "space-between" }}>
        <span>{i.from}</span>
        <span style={{ color: pal.hud, fontWeight: 600 }}>{i.time ?? ""}</span>
      </div>
      {i.messages.map((m, k) => {
        const show = spring({ frame: frame - Math.round((0.25 + k * 0.7) * fps), fps, config: { damping: 12 } });
        return (
          <div key={k} style={{ display: "flex", justifyContent: m.me ? "flex-end" : "flex-start", marginTop: 24, opacity: show, transform: `scale(${0.8 + 0.2 * show})` }}>
            <div style={{ maxWidth: "78%", padding: "22px 30px", borderRadius: 30, fontSize: 38, background: m.me ? "#2F6FEB" : "#24344F" }}>{m.text}</div>
          </div>
        );
      })}
    </div>
  );
};

const MapInsert: React.FC<{ i: Extract<Insert, { type: "map" }>; pal: Pal; duration: number }> = ({ i, pal, duration }) => {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();
  const p = interpolate(frame, [0.3 * fps, Math.max(0.4, duration - 0.4) * fps], [0, 1], { extrapolateLeft: "clamp", extrapolateRight: "clamp" });
  const path = "M150 760 C 260 600, 220 470, 380 420 S 600 300, 650 160";
  return (
    <div style={{ ...card, width: 820, height: 920, overflow: "hidden", position: "relative" }}>
      <svg viewBox="0 0 820 920" width="100%" height="100%">
        <rect width={820} height={920} fill="#0D1628" />
        {Array.from({ length: 12 }, (_, k) => (
          <line key={`h${k}`} x1={0} y1={k * 80} x2={820} y2={k * 80 + 40} stroke="#18263F" strokeWidth={14} />
        ))}
        {Array.from({ length: 9 }, (_, k) => (
          <line key={`v${k}`} x1={k * 100} y1={0} x2={k * 100 - 60} y2={920} stroke="#18263F" strokeWidth={10} />
        ))}
        <path d={path} fill="none" stroke="#2B3D57" strokeWidth={14} strokeDasharray="4 22" strokeLinecap="round" />
        <path d={path} fill="none" stroke={pal.indice} strokeWidth={12} strokeLinecap="round" pathLength={1} strokeDasharray={`${p} 1`} />
        <circle cx={150} cy={760} r={22} fill={pal.valide} />
        <circle cx={650} cy={160} r={26} fill={pal.alerte} opacity={p > 0.98 ? 1 : 0.35} />
        <text x={150} y={830} textAnchor="middle" fill="#F2F2F2" fontSize={34} fontWeight={800} fontFamily={FONT}>{i.from}</text>
        <text x={650} y={120} textAnchor="middle" fill="#F2F2F2" fontSize={34} fontWeight={800} fontFamily={FONT}>{i.to}</text>
      </svg>
      {i.distance && (
        <div style={{ position: "absolute", right: 30, bottom: 30, fontSize: 40, fontWeight: 800, color: pal.indice, background: "#05080Fcc", padding: "12px 24px", borderRadius: 18 }}>{i.distance}</div>
      )}
    </div>
  );
};

const Evidence: React.FC<{ i: Extract<Insert, { type: "evidence" }>; pal: Pal }> = ({ i, pal }) => {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();
  return (
    <div style={{ width: 840, position: "relative", fontFamily: FONT }}>
      <div style={{ width: 300, height: 70, background: "#B8893E", borderRadius: "20px 20px 0 0" }} />
      <div style={{ background: "#D9A54E", borderRadius: "0 24px 24px 24px", padding: 44, boxShadow: "0 30px 80px rgba(0,0,0,0.6)" }}>
        <div style={{ fontSize: 44, fontWeight: 800, color: "#2A1B05", letterSpacing: 3, textTransform: "uppercase" }}>{i.title}</div>
        <div style={{ position: "absolute", right: 40, top: 110, border: `5px solid ${pal.alerte}`, color: pal.alerte, fontWeight: 800, fontSize: 34, padding: "6px 18px", transform: "rotate(-10deg)", opacity: 0.85 }}>CONFIDENTIEL</div>
        {i.items.map((it, k) => {
          const s = spring({ frame: frame - Math.round((0.3 + k * 0.45) * fps), fps, config: { damping: 12 } });
          return (
            <div key={k} style={{ marginTop: 24, background: "#F4EBD9", color: "#1B1206", fontSize: 36, fontWeight: 700, padding: "18px 26px", borderRadius: 10, transform: `translateX(${(1 - s) * 60}px) rotate(${(k % 2 ? 1 : -1) * 1.2}deg)`, opacity: s }}>
              <span style={{ color: pal.alerte, marginRight: 14 }}>#{k + 1}</span>
              {it}
            </div>
          );
        })}
      </div>
    </div>
  );
};

const Checklist: React.FC<{ i: Extract<Insert, { type: "checklist" }>; pal: Pal }> = ({ i, pal }) => {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();
  return (
    <div style={{ ...card, width: 820, padding: 46, boxSizing: "border-box" }}>
      <div style={{ fontSize: 40, fontWeight: 800, letterSpacing: 3, color: pal.hud, textTransform: "uppercase" }}>{i.title}</div>
      {i.items.map((it, k) => {
        const s = interpolate(frame, [(0.35 + k * 0.5) * fps, (0.55 + k * 0.5) * fps], [0, 1], { extrapolateLeft: "clamp", extrapolateRight: "clamp" });
        const col = it.state === "ok" ? pal.valide : it.state === "ko" ? pal.alerte : pal.indice;
        return (
          <div key={k} style={{ display: "flex", alignItems: "center", gap: 26, marginTop: 30, fontSize: 40, fontWeight: 700 }}>
            <div style={{ width: 62, height: 62, borderRadius: 14, border: `5px solid ${s > 0 ? col : "#3B4A63"}`, display: "flex", alignItems: "center", justifyContent: "center", color: col, fontSize: 46, fontWeight: 800 }}>
              <span style={{ transform: `scale(${s})` }}>{it.state === "ok" ? "✓" : it.state === "ko" ? "✕" : "?"}</span>
            </div>
            <span style={{ position: "relative", opacity: it.state === "ko" && s > 0 ? 0.6 : 1 }}>
              {it.text}
              {it.state === "ko" && <span style={{ position: "absolute", left: 0, top: "52%", height: 5, width: `${s * 100}%`, background: pal.alerte }} />}
            </span>
          </div>
        );
      })}
    </div>
  );
};

const Counter: React.FC<{ i: Extract<Insert, { type: "counter" }>; pal: Pal; duration: number }> = ({ i, pal, duration }) => {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();
  const v = interpolate(frame, [0.2 * fps, Math.max(0.5, duration - 0.5) * fps], [i.from, i.to], { extrapolateLeft: "clamp", extrapolateRight: "clamp", easing: (x) => 1 - Math.pow(1 - x, 2) });
  return (
    <div style={{ ...card, padding: "50px 80px", textAlign: "center" }}>
      <div style={{ fontSize: 210, fontWeight: 800, color: pal.alerte, fontVariantNumeric: "tabular-nums", lineHeight: 1 }}>
        {Math.round(v)}
        {i.unit && <span style={{ fontSize: 80, color: "#F2F2F2", marginLeft: 16 }}>{i.unit}</span>}
      </div>
      <div style={{ fontSize: 40, fontWeight: 700, marginTop: 20, letterSpacing: 4, color: pal.hud, textTransform: "uppercase" }}>{i.label}</div>
    </div>
  );
};

const Polaroid: React.FC<{ i: Extract<Insert, { type: "polaroid" }>; pal: Pal }> = ({ i, pal }) => (
  <div style={{ background: "#F4F1EA", padding: "36px 36px 120px", transform: "rotate(-4deg)", boxShadow: "0 30px 80px rgba(0,0,0,0.6)", position: "relative" }}>
    <div style={{ width: 640, height: 640, background: pal.secondaire, overflow: "hidden", position: "relative" }}>
      {i.bgSrc ? (
        <Img src={staticFile(i.bgSrc)} style={{ width: "100%", height: "100%", objectFit: "cover", filter: "sepia(0.25) contrast(1.05)" }} />
      ) : (
        <svg viewBox="0 0 640 640" width="100%" height="100%">
          <circle cx={320} cy={250} r={110} fill="#2B3D57" />
          <rect x={170} y={380} width={300} height={300} rx={120} fill="#2B3D57" />
        </svg>
      )}
    </div>
    <div style={{ position: "absolute", bottom: 34, left: 0, right: 0, textAlign: "center", fontFamily: "'Comic Sans MS', cursive", fontSize: 44, color: "#1B1B1B" }}>{i.caption}</div>
    <div style={{ position: "absolute", top: -26, left: "42%", width: 140, height: 50, background: "#E8DFAAcc", transform: "rotate(3deg)" }} />
  </div>
);

const Press: React.FC<{ i: Extract<Insert, { type: "press" }> }> = ({ i }) => (
  <div style={{ width: 860, background: "#EDE6D6", color: "#141414", padding: 50, boxShadow: "0 30px 80px rgba(0,0,0,0.6)", transform: "rotate(2deg)", fontFamily: "Georgia, serif" }}>
    <div style={{ fontSize: 58, fontWeight: 900, textAlign: "center", borderBottom: "4px double #141414", paddingBottom: 14, letterSpacing: 2 }}>{i.journal}</div>
    {i.date && <div style={{ fontSize: 26, textAlign: "center", marginTop: 10, fontStyle: "italic" }}>{i.date}</div>}
    <div style={{ fontSize: 66, fontWeight: 900, lineHeight: 1.08, marginTop: 30 }}>{i.headline}</div>
    {Array.from({ length: 5 }, (_, k) => (
      <div key={k} style={{ height: 14, background: "#B9B1A0", marginTop: 20, width: `${92 - (k % 3) * 9}%` }} />
    ))}
  </div>
);

// CCTV : surcouche plein écran (scanlines, REC, horodatage qui défile)
export const Cctv: React.FC<{ i: Extract<Insert, { type: "cctv" }>; pal: Pal }> = ({ i, pal }) => {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();
  const m = /^(\d{2}):(\d{2}):(\d{2})/.exec(i.timestamp);
  let ts = i.timestamp;
  if (m) {
    const total = Number(m[1]) * 3600 + Number(m[2]) * 60 + Number(m[3]) + Math.floor(frame / fps);
    ts = [Math.floor(total / 3600) % 24, Math.floor(total / 60) % 60, total % 60].map((n) => String(n).padStart(2, "0")).join(":");
  }
  return (
    <AbsoluteFill style={{ fontFamily: "'DejaVu Sans Mono', monospace", color: "#E8F0E8" }}>
      <AbsoluteFill style={{ background: "repeating-linear-gradient(0deg, rgba(0,0,0,0.22) 0px, rgba(0,0,0,0.22) 2px, transparent 2px, transparent 6px)" }} />
      <AbsoluteFill style={{ boxShadow: "inset 0 0 240px rgba(0,0,0,0.85)" }} />
      <div style={{ position: "absolute", top: 520, right: 60, fontSize: 44, display: "flex", alignItems: "center", gap: 14 }}>
        <span style={{ width: 26, height: 26, borderRadius: 13, background: pal.alerte, opacity: Math.floor(frame / 15) % 2 ? 1 : 0.2 }} />
        REC
      </div>
      <div style={{ position: "absolute", top: 580, right: 60, fontSize: 40 }}>{i.cam}</div>
      <div style={{ position: "absolute", bottom: 480, left: 60, fontSize: 48, background: "rgba(0,0,0,0.5)", padding: "6px 16px" }}>{ts}</div>
      {[
        [40, 500],
        [1040, 500],
        [40, 1500],
        [1040, 1500],
      ].map(([x, y], k) => (
        <div key={k} style={{ position: "absolute", left: x - (x > 500 ? 60 : 0), top: y - (y > 1000 ? 60 : 0), width: 60, height: 60, borderColor: "#E8F0E8", borderStyle: "solid", borderWidth: `${y < 1000 ? 5 : 0}px ${x > 500 ? 5 : 0}px ${y > 1000 ? 5 : 0}px ${x < 500 ? 5 : 0}px` }} />
      ))}
    </AbsoluteFill>
  );
};

// Titre du hook / question finale / partie 2 : texte énorme au centre
const BigText: React.FC<{ text: string; sub?: string; color: string; pal: Pal }> = ({ text, sub, color, pal }) => {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();
  const s = spring({ frame, fps, config: { damping: 9, stiffness: 180 } });
  return (
    <AbsoluteFill style={{ alignItems: "center", justifyContent: "center", top: "-8%" }}>
      <div style={{ fontFamily: FONT, fontWeight: 800, textAlign: "center", padding: "0 90px", transform: `scale(${interpolate(s, [0, 1], [1.6, 1])})`, opacity: Math.min(1, s * 1.4) }}>
        <div style={{ fontSize: 118, lineHeight: 1.02, color, textTransform: "uppercase", WebkitTextStroke: "8px #000", paintOrder: "stroke fill", textShadow: "0 10px 30px rgba(0,0,0,0.8)" }}>{text}</div>
        {sub && <div style={{ fontSize: 46, marginTop: 26, color: pal.hud, letterSpacing: 6, textTransform: "uppercase", textShadow: "0 4px 14px #000" }}>{sub}</div>}
      </div>
    </AbsoluteFill>
  );
};

export const InsertView: React.FC<{ insert: Insert; pal: Pal; duration: number }> = ({ insert, pal, duration }) => {
  switch (insert.type) {
    case "title":
      return <BigText text={insert.text} sub={insert.sub} color="#FFFFFF" pal={pal} />;
    case "question":
      return <BigText text={insert.text} color={pal.indice} pal={pal} />;
    case "partie":
      return <BigText text={insert.text ?? "PARTIE 2"} sub="abonne-toi pour la suite" color={pal.alerte} pal={pal} />;
    case "cctv":
      return <Cctv i={insert} pal={pal} />;
    case "phone":
      return <SlideIn duration={duration} top="16%" scale={0.82}><Phone i={insert} pal={pal} /></SlideIn>;
    case "sms":
      return <SlideIn duration={duration} top="22%"><Sms i={insert} pal={pal} /></SlideIn>;
    case "map":
      return <SlideIn duration={duration} top="17%" scale={0.85}><MapInsert i={insert} pal={pal} duration={duration} /></SlideIn>;
    case "evidence":
      return <SlideIn duration={duration} top="18%"><Evidence i={insert} pal={pal} /></SlideIn>;
    case "checklist":
      return <SlideIn duration={duration} top="22%"><Checklist i={insert} pal={pal} /></SlideIn>;
    case "counter":
      return <SlideIn duration={duration} top="28%"><Counter i={insert} pal={pal} duration={duration} /></SlideIn>;
    case "polaroid":
      return <SlideIn duration={duration} top="20%" scale={0.9}><Polaroid i={insert} pal={pal} /></SlideIn>;
    case "press":
      return <SlideIn duration={duration} top="20%"><Press i={insert} /></SlideIn>;
    default:
      return null;
  }
};
