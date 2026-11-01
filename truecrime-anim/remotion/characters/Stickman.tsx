import React from "react";
import type { Accessory, CastMember, Expression, Pose } from "../types";

// Marionnette vectorielle : repère local 200 x 420, pieds en (100, 410).
// Angles en degrés depuis la verticale vers le bas ; positif = vers l'avant (droite).

type Limb = { up: number; low: number };
type PoseDef = {
  armF: Limb; // bras avant
  armB: Limb; // bras arrière
  legF: Limb;
  legB: Limb;
  lean: number; // inclinaison du buste
  drop: number; // abaissement du bassin (assis)
  chaise?: boolean;
  phone?: boolean;
};

const P = (armF: Limb, armB: Limb, legF: Limb, legB: Limb, lean = 0, drop = 0, extra: Partial<PoseDef> = {}): PoseDef => ({
  armF, armB, legF, legB, lean, drop, ...extra,
});

const STATIC: Record<Exclude<Pose, "marche" | "course">, PoseDef> = {
  debout: P({ up: 8, low: 14 }, { up: -8, low: -2 }, { up: 4, low: 2 }, { up: -4, low: -4 }),
  assis: P({ up: 20, low: 75 }, { up: 10, low: 70 }, { up: 88, low: 2 }, { up: 80, low: -4 }, -4, 72, { chaise: true }),
  telephone: P({ up: 12, low: 172 }, { up: -6, low: 4 }, { up: 4, low: 2 }, { up: -4, low: -4 }, 0, 0, { phone: true }),
  pointe: P({ up: 86, low: 92 }, { up: -10, low: -4 }, { up: 10, low: 6 }, { up: -8, low: -8 }, 4),
  "bras-croises": P({ up: 6, low: -88 }, { up: -4, low: 92 }, { up: 6, low: 4 }, { up: -6, low: -6 }),
  recule: P({ up: 58, low: 150 }, { up: 42, low: 140 }, { up: 22, low: 18 }, { up: -16, low: -10 }, -12),
};

const WALK: PoseDef[] = [
  P({ up: -24, low: -10 }, { up: 24, low: 40 }, { up: 26, low: 20 }, { up: -22, low: -40 }),
  P({ up: -6, low: 4 }, { up: 6, low: 18 }, { up: 6, low: -18 }, { up: -2, low: -6 }),
  P({ up: 24, low: 40 }, { up: -24, low: -10 }, { up: -22, low: -40 }, { up: 26, low: 20 }),
  P({ up: 6, low: 18 }, { up: -6, low: 4 }, { up: -2, low: -6 }, { up: 6, low: -18 }),
];

const RUN: PoseDef[] = [
  P({ up: -40, low: 50 }, { up: 50, low: 130 }, { up: 50, low: 10 }, { up: -40, low: -100 }, 14),
  P({ up: -10, low: 80 }, { up: 20, low: 110 }, { up: 15, low: -40 }, { up: -10, low: -40 }, 14),
  P({ up: 50, low: 130 }, { up: -40, low: 50 }, { up: -40, low: -100 }, { up: 50, low: 10 }, 14),
  P({ up: 20, low: 110 }, { up: -10, low: 80 }, { up: -10, low: -40 }, { up: 15, low: -40 }, 14),
];

const rad = (d: number) => (d * Math.PI) / 180;
const pt = (x: number, y: number, a: number, len: number): [number, number] => [x + Math.sin(rad(a)) * len, y + Math.cos(rad(a)) * len];

const mix = (a: PoseDef, b: PoseDef, t: number): PoseDef => {
  const l = (p: number, q: number) => p + (q - p) * t;
  const lm = (p: Limb, q: Limb) => ({ up: l(p.up, q.up), low: l(p.low, q.low) });
  return {
    ...a,
    armF: lm(a.armF, b.armF),
    armB: lm(a.armB, b.armB),
    legF: lm(a.legF, b.legF),
    legB: lm(a.legB, b.legB),
    lean: l(a.lean, b.lean),
    drop: l(a.drop, b.drop),
  };
};

export function resolvePose(pose: Pose, timeSec: number): PoseDef {
  if (pose === "marche" || pose === "course") {
    const cycle = pose === "marche" ? WALK : RUN;
    const rate = pose === "marche" ? 8 : 12; // poses par seconde
    const f = timeSec * rate;
    const i = Math.floor(f) % 4;
    return mix(cycle[i], cycle[(i + 1) % 4], f - Math.floor(f));
  }
  return STATIC[pose] ?? STATIC.debout;
}

const hash = (s: string) => {
  let h = 2166136261;
  for (let i = 0; i < s.length; i++) h = Math.imul(h ^ s.charCodeAt(i), 16777619);
  return (h >>> 0) / 4294967295;
};

// Clignement : toutes les 3 à 5 s, 0,12 s, déterministe par personnage
const isBlinking = (seed: string, t: number) => {
  let cursor = 0.8 + hash(seed) * 2;
  let k = 0;
  while (cursor < t + 0.2 && k < 500) {
    if (t >= cursor && t < cursor + 0.12) return true;
    cursor += 3 + hash(seed + k) * 2;
    k++;
  }
  return false;
};

export const Stickman: React.FC<{
  member: CastMember;
  pose: Pose;
  time: number; // secondes depuis le début du plan
  expression?: Expression;
  palette: Record<string, string>;
  regardCamera?: boolean;
}> = ({ member, pose, time, expression = "neutre", palette, regardCamera }) => {
  const def = resolvePose(pose, time);
  const skin = member.silhouette ? "#070B14" : palette.personnage;
  const outfit = member.silhouette ? "#070B14" : member.tenue;
  const line = member.silhouette ? "#070B14" : palette.personnage;
  const acc = new Set<Accessory>(member.accessoires ?? []);

  const moving = pose === "marche" || pose === "course";
  const bob = moving ? Math.abs(Math.sin(time * Math.PI * (pose === "marche" ? 4 : 6))) * -6 : 0;
  const breath = -(1 - Math.cos((2 * Math.PI * time) / 2)) * 2.2; // ~1 % de la hauteur

  const hipY = 262 + def.drop + bob;
  const hipX = 100;
  const torsoLen = 108;
  const thigh = 74;
  const shin = 72;
  const upper = 54;
  const fore = 50;

  const kF = pt(hipX + 6, hipY, def.legF.up, thigh);
  const footF = pt(kF[0], kF[1], def.legF.low, shin);
  const kB = pt(hipX - 6, hipY, def.legB.up, thigh);
  const footB = pt(kB[0], kB[1], def.legB.low, shin);

  // Buste (incliné autour du bassin)
  const neck = pt(hipX, hipY, 180 + def.lean, torsoLen);
  const shoulderF: [number, number] = [neck[0] + 8, neck[1] + 12];
  const shoulderB: [number, number] = [neck[0] - 8, neck[1] + 12];
  const eF = pt(shoulderF[0], shoulderF[1], def.armF.up, upper);
  const hF = pt(eF[0], eF[1], def.armF.low, fore);
  const eB = pt(shoulderB[0], shoulderB[1], def.armB.up, upper);
  const hB = pt(eB[0], eB[1], def.armB.low, fore);

  const headR = 38;
  const head = pt(hipX, hipY, 180 + def.lean, torsoLen + headR + 6);
  const blink = isBlinking(member.id, time);
  const eyeOffset = regardCamera ? 0 : 12;
  const eyeR = expression === "peur" || expression === "choc" ? 6.5 : 5;
  const eyeY = head[1] - 3;
  const eyes: [number, number][] = [
    [head[0] + eyeOffset - 9, eyeY],
    [head[0] + eyeOffset + 9, eyeY],
  ];

  const limb = (a: [number, number], b: [number, number], c: [number, number], w = 10, color = line) => (
    <polyline points={`${a[0]},${a[1]} ${b[0]},${b[1]} ${c[0]},${c[1]}`} fill="none" stroke={color} strokeWidth={w} strokeLinecap="round" strokeLinejoin="round" />
  );

  const torsoAngle = def.lean;
  const mouthX = head[0] + eyeOffset;
  const mouthY = head[1] + 16;

  return (
    <svg viewBox="0 0 200 420" width="100%" height="100%" style={{ overflow: "visible" }}>
      {def.chaise && (
        <g fill={palette.secondaire} stroke="#2B3D57" strokeWidth={3}>
          <rect x={60} y={hipY + 10} width={92} height={12} rx={4} />
          <rect x={64} y={hipY + 22} width={8} height={410 - hipY - 22} />
          <rect x={140} y={hipY + 22} width={8} height={410 - hipY - 22} />
          <rect x={56} y={hipY - 90} width={10} height={112} rx={4} />
        </g>
      )}
      <g transform={`translate(0 ${breath * 0.3})`}>
        {/* jambe arrière + bras arrière (légèrement assombris) */}
        {limb([hipX - 6, hipY], kB, footB, 11, member.silhouette ? line : "#C9CED6")}
        <g transform={`translate(0 ${breath})`}>{limb(shoulderB, eB, hB, 9, member.silhouette ? line : "#C9CED6")}</g>
        {limb([hipX + 6, hipY], kF, footF, 11)}
      </g>
      <g transform={`translate(0 ${breath})`}>
        {/* corps : rectangle arrondi couleur vêtement */}
        <g transform={`rotate(${torsoAngle} ${hipX} ${hipY})`}>
          <rect x={hipX - 30} y={hipY - torsoLen - 4} width={60} height={torsoLen + 22} rx={26} fill={outfit} />
          {acc.has("cravate") && <path d={`M${hipX + 4} ${hipY - torsoLen + 4} l6 10 l-6 46 l-6 -46 z`} fill={palette.alerte} />}
          {acc.has("capuche") && (
            <path d={`M${hipX - 26} ${hipY - torsoLen + 6} q26 26 52 0`} fill="none" stroke="rgba(0,0,0,0.35)" strokeWidth={5} />
          )}
        </g>
        {/* tête */}
        {acc.has("capuche") && <circle cx={head[0] - 2} cy={head[1] + 2} r={headR + 9} fill={outfit} />}
        {acc.has("cheveux-longs") && (
          <path d={`M${head[0] - headR - 4} ${head[1]} q0 -${headR + 12} ${headR + 4} -${headR + 8} q${headR + 6} 4 ${headR + 2} ${headR + 8} l-6 ${headR + 18} l-${headR * 2 - 10} 0 z`} fill="#3A2A22" />
        )}
        <circle cx={head[0]} cy={head[1]} r={headR} fill={skin} />
        {acc.has("cheveux-courts") && (
          <path d={`M${head[0] - headR} ${head[1] - 4} a${headR} ${headR} 0 0 1 ${headR * 2} 0 q-10 -14 -${headR} -12 q-${headR - 10} -2 -${headR} 12 z`} fill="#2A2320" />
        )}
        {acc.has("cheveux-longs") && (
          <path d={`M${head[0] - headR} ${head[1] - 2} a${headR} ${headR} 0 0 1 ${headR * 2} 0 q-14 -18 -${headR} -16 q-${headR - 14} 0 -${headR} 16 z`} fill="#3A2A22" />
        )}
        {acc.has("casquette") && (
          <g>
            <path d={`M${head[0] - headR + 2} ${head[1] - 10} a${headR - 2} ${headR - 2} 0 0 1 ${headR * 2 - 4} 0 z`} fill="#22324D" />
            <rect x={head[0] + 8} y={head[1] - 14} width={headR + 6} height={8} rx={4} fill="#1A2740" />
            <circle cx={head[0] + 2} cy={head[1] - 26} r={5} fill={palette.indice} />
          </g>
        )}
        {!member.silhouette && (
          <g>
            {eyes.map(([x, y], i) =>
              blink ? (
                <rect key={i} x={x - 5} y={y - 1.5} width={10} height={3} rx={1.5} fill="#0E1726" />
              ) : (
                <circle key={i} cx={x} cy={y} r={eyeR} fill="#0E1726" />
              ),
            )}
            {acc.has("lunettes") &&
              eyes.map(([x, y], i) => <circle key={`l${i}`} cx={x} cy={y} r={9.5} fill="none" stroke="#0E1726" strokeWidth={2.5} />)}
            {acc.has("lunettes") && <line x1={eyes[0][0] + 9} y1={eyeY} x2={eyes[1][0] - 9} y2={eyeY} stroke="#0E1726" strokeWidth={2.5} />}
            {expression === "colere" && (
              <g stroke="#0E1726" strokeWidth={3.5} strokeLinecap="round">
                <line x1={eyes[0][0] - 7} y1={eyeY - 14} x2={eyes[0][0] + 6} y2={eyeY - 9} />
                <line x1={eyes[1][0] - 6} y1={eyeY - 9} x2={eyes[1][0] + 7} y2={eyeY - 14} />
              </g>
            )}
            {expression === "peur" && <ellipse cx={mouthX} cy={mouthY} rx={4} ry={5} fill="#0E1726" />}
            {expression === "choc" && <ellipse cx={mouthX} cy={mouthY + 2} rx={7} ry={9} fill="#0E1726" />}
            {expression === "sourire" && (
              <path d={`M${mouthX - 9} ${mouthY - 2} q9 8 18 0`} fill="none" stroke="#0E1726" strokeWidth={3} strokeLinecap="round" />
            )}
            {expression === "colere" && <line x1={mouthX - 7} y1={mouthY + 2} x2={mouthX + 7} y2={mouthY + 2} stroke="#0E1726" strokeWidth={3} strokeLinecap="round" />}
          </g>
        )}
        {/* bras avant + main */}
        {limb(shoulderF, eF, hF, 9)}
        <circle cx={hF[0]} cy={hF[1]} r={7} fill={skin} />
        <circle cx={hB[0]} cy={hB[1]} r={6} fill={member.silhouette ? skin : "#C9CED6"} />
        {def.phone && <rect x={hF[0] - 6} y={hF[1] - 34} width={13} height={30} rx={3} fill="#111827" stroke="#3B4A63" strokeWidth={2} />}
      </g>
    </svg>
  );
};
