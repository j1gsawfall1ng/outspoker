import React from "react";
import { AbsoluteFill, Img, staticFile } from "remotion";

const hash = (s: string) => {
  let h = 2166136261;
  for (let i = 0; i < s.length; i++) h = Math.imul(h ^ s.charCodeAt(i), 16777619);
  return h >>> 0;
};

// Décor : image générée (Gemini) si disponible, sinon décor de secours procédural
// (ciel nuit + bâtiments + sol) pour que le rendu marche toujours.
export const Background: React.FC<{ slug: string; src?: string | null; palette: Record<string, string> }> = ({ slug, src, palette }) => {
  if (src) {
    return (
      <AbsoluteFill>
        <Img src={staticFile(src)} style={{ width: "100%", height: "100%", objectFit: "cover" }} />
      </AbsoluteFill>
    );
  }
  const h = hash(slug);
  const interior = /-int\b|-int-|chambre|salon|cuisine|bureau|interieur|commissariat|salle|couloir|appartement|maison-int|tribunal|cellule/.test(slug);
  const buildings = Array.from({ length: 7 }, (_, i) => {
    const r = ((h >> (i * 3)) & 7) / 7;
    return { x: i * 160 - 40, w: 130 + r * 60, hgt: 380 + r * 520 };
  });
  return (
    <AbsoluteFill style={{ background: `linear-gradient(180deg, #070C16 0%, ${palette.nuit} 55%, ${palette.secondaire} 100%)` }}>
      <svg viewBox="0 0 1080 1920" width="100%" height="100%">
        {interior ? (
          <g>
            <rect x={0} y={0} width={1080} height={1440} fill={palette.nuit} />
            <rect x={140} y={300} width={300} height={420} rx={8} fill="#13203A" stroke="#22324D" strokeWidth={10} />
            <line x1={290} y1={300} x2={290} y2={720} stroke="#22324D" strokeWidth={8} />
            <rect x={680} y={520} width={240} height={920} fill="#162238" stroke="#22324D" strokeWidth={8} />
            <circle cx={890} cy={1000} r={12} fill={palette.indice} opacity={0.7} />
            <rect x={0} y={1440} width={1080} height={480} fill={palette.secondaire} />
            <ellipse cx={540} cy={180} rx={260} ry={60} fill={palette.indice} opacity={0.06} />
          </g>
        ) : (
          <g>
            <circle cx={820} cy={330} r={70} fill="#E8E2C8" opacity={0.85} />
            <circle cx={820} cy={330} r={160} fill="#E8E2C8" opacity={0.05} />
            {buildings.map((b, i) => (
              <g key={i}>
                <rect x={b.x} y={1440 - b.hgt} width={b.w} height={b.hgt} fill={i % 2 ? "#111C2E" : "#15223A"} />
                {Array.from({ length: 6 }, (_, k) =>
                  ((h >> (k + i)) & 3) === 0 ? (
                    <rect key={k} x={b.x + 24 + (k % 2) * 50} y={1440 - b.hgt + 60 + Math.floor(k / 2) * 110} width={28} height={40} fill={palette.indice} opacity={0.55} />
                  ) : null,
                )}
              </g>
            ))}
            <rect x={0} y={1440} width={1080} height={480} fill={palette.secondaire} />
            <rect x={0} y={1440} width={1080} height={8} fill="#2B3D57" />
          </g>
        )}
        <text x={540} y={1880} textAnchor="middle" fill="#2B3D57" fontSize={26} fontFamily="Montserrat">
          décor manquant : {slug}
        </text>
      </svg>
    </AbsoluteFill>
  );
};

// Accessoires de scène dessinés en code (lampadaire, porte, voiture, chaise)
export const SceneProp: React.FC<{ type: string; x: number; etat?: string; palette: Record<string, string>; flicker: number }> = ({ type, x, etat, palette, flicker }) => {
  const left = `${x * 100}%`;
  if (type === "lampe") {
    const on = etat !== "eteinte" && flicker > 0.15;
    return (
      <div style={{ position: "absolute", left, bottom: "22%", width: 260, height: 1100, transform: "translateX(-50%)" }}>
        <svg viewBox="0 0 260 1100" width="100%" height="100%">
          {on && <polygon points="130,90 -60,1100 320,1100" fill={palette.indice} opacity={0.09} />}
          <rect x={122} y={80} width={14} height={1020} fill="#1A2740" />
          <rect x={90} y={70} width={80} height={22} rx={8} fill="#22324D" />
          <ellipse cx={130} cy={96} rx={30} ry={10} fill={on ? palette.indice : "#2B3D57"} />
        </svg>
      </div>
    );
  }
  if (type === "porte") {
    const open = etat === "ouverte" ? 0.55 : etat === "entrouverte" ? 0.18 : 0;
    return (
      <div style={{ position: "absolute", left, bottom: "22%", width: 300, height: 620, transform: "translateX(-50%)" }}>
        <svg viewBox="0 0 300 620" width="100%" height="100%">
          <rect x={0} y={0} width={300} height={620} fill="#0A111D" stroke="#22324D" strokeWidth={12} />
          {open > 0 && <rect x={6} y={6} width={288 * open} height={608} fill={palette.indice} opacity={0.18} />}
          <rect x={6 + 288 * open} y={6} width={288 * (1 - open)} height={608} fill="#1C2A3F" />
          <circle cx={6 + 288 * open + 30} cy={330} r={10} fill={palette.indice} opacity={0.8} />
        </svg>
      </div>
    );
  }
  if (type === "voiture") {
    return (
      <div style={{ position: "absolute", left, bottom: "20%", width: 620, height: 260, transform: "translateX(-50%)" }}>
        <svg viewBox="0 0 620 260" width="100%" height="100%">
          <path d="M40 170 L90 90 Q110 60 160 60 L420 60 Q470 60 500 100 L570 150 Q600 160 600 190 L600 210 L20 210 L20 190 Q20 170 40 170 Z" fill="#1F2E47" />
          <path d="M120 100 L160 72 L290 72 L290 140 L100 140 Z" fill="#0A111D" />
          <path d="M310 72 L420 72 Q450 72 480 110 L490 140 L310 140 Z" fill="#0A111D" />
          <circle cx={140} cy={212} r={40} fill="#05080F" />
          <circle cx={480} cy={212} r={40} fill="#05080F" />
          <rect x={570} y={160} width={30} height={16} rx={6} fill={etat === "allumee" ? palette.indice : "#2B3D57"} />
        </svg>
      </div>
    );
  }
  if (type === "chaise") {
    return (
      <div style={{ position: "absolute", left, bottom: "22%", width: 160, height: 300, transform: "translateX(-50%)" }}>
        <svg viewBox="0 0 160 300" width="100%" height="100%" fill={palette.secondaire} stroke="#2B3D57" strokeWidth={4}>
          <rect x={10} y={150} width={140} height={16} rx={4} />
          <rect x={14} y={166} width={10} height={134} />
          <rect x={136} y={166} width={10} height={134} />
          <rect x={10} y={10} width={14} height={156} rx={4} />
        </svg>
      </div>
    );
  }
  return null;
};
