// Types partagés entre les scripts (render.json) et la composition Remotion.

export type Pose =
  | "debout"
  | "marche"
  | "course"
  | "assis"
  | "telephone"
  | "pointe"
  | "bras-croises"
  | "recule";

export type Expression = "neutre" | "peur" | "sourire" | "colere" | "choc";

export type Accessory =
  | "aucun"
  | "casquette"
  | "lunettes"
  | "capuche"
  | "cheveux-longs"
  | "cheveux-courts"
  | "cravate";

export type CastMember = {
  id: string;
  nom?: string;
  role?: string;
  tenue: string; // couleur du corps (vêtement)
  accessoires?: Accessory[];
  silhouette?: boolean; // victime : jamais montrée en détail
  condamne?: boolean; // pour le contrôle présomption d'innocence
};

export type ShotCharacter = {
  id: string;
  pose: Pose;
  x: number; // 0..1 largeur
  toX?: number; // déplacement pendant le plan
  y?: number; // 0..1 position des pieds (défaut 0.78)
  scale?: number; // 1 = ~560 px de haut
  dir?: "droite" | "gauche";
  expression?: Expression;
  expressionAt?: string; // mot déclencheur du changement d'expression
  expressionFrom?: number; // calculé par build-props (s depuis le début du plan)
  regardCamera?: boolean;
};

export type Insert =
  | { type: "title"; text: string; sub?: string }
  | { type: "question"; text: string }
  | { type: "partie"; text?: string }
  | { type: "phone"; app?: "appel" | "alerte" | "notif"; title: string; subtitle?: string; time?: string }
  | { type: "sms"; from: string; messages: { text: string; me?: boolean }[]; time?: string }
  | { type: "map"; from: string; to: string; distance?: string }
  | { type: "evidence"; title: string; items: string[] }
  | { type: "checklist"; title: string; items: { text: string; state: "ok" | "ko" | "?" }[] }
  | { type: "counter"; label: string; from: number; to: number; unit?: string }
  | { type: "polaroid"; caption: string; bg?: string; bgSrc?: string | null }
  | { type: "press"; journal: string; headline: string; date?: string }
  | { type: "cctv"; cam: string; timestamp: string };

export type Camera = {
  type: "zoom" | "pan" | "punch" | "static-shake";
  from?: number;
  to?: number;
  dir?: "gauche" | "droite";
};

export type Shot = {
  id: number;
  sentence: number;
  at?: string;
  framing: "large" | "moyen" | "insert";
  bg: string;
  bgSrc?: string | null;
  characters?: ShotCharacter[];
  insert?: Insert;
  camera?: Camera;
  transition?: "cut" | "whip" | "noir";
  shake?: boolean;
  reveal?: boolean;
  props?: { type: "lampe" | "porte" | "voiture" | "chaise"; x: number; etat?: string }[];
  lumiere?: "normale" | "eteinte" | "sirene" | "flash";
  sfx?: { tag: string; at: number }[];
  highlight?: string[];
  danger?: string[];
  hud?: { jour?: number | string; heure?: string };
  start: number;
  end: number;
};

export type Word = { text: string; start: number; end: number; sentence: number; color?: "indice" | "alerte" };

export type RenderProps = {
  meta: {
    affaire: string;
    titre: string;
    width: number;
    height: number;
    fps: number;
    duration: number;
  };
  palette: Record<string, string>;
  style: {
    subtitles: { size: number; yRatio: number; yRatioInsert?: number; maxWords: number; activeScale: number; stroke: number };
    camera: { zoomFrom: number; zoomTo: number; panRatio: number; punchTo: number; punchDuration: number; shakePx: number };
    audio: { voiceVolume: number; musicVolume: number; sfxVolume: number; revealSilence: number };
  };
  cast: Record<string, CastMember>;
  voiceSrc: string | null;
  musicSrc: string | null;
  words: Word[];
  shots: Shot[];
  sfx: { src: string; at: number; volume: number }[];
  reveals: number[];
};
