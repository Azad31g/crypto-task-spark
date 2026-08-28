export type ObjectKind = "star" | "bomb";

export type FallingObj = {
  id: number;
  kind: ObjectKind;
  /** horizontal position in % of board width */
  x: number;
  /** fall duration in seconds */
  duration: number;
  /** base size in px */
  size: number;
  spawnedAt: number;
};

export type TakBomState = "start" | "playing" | "paused" | "over";

export const GAME_SECONDS = 75;
export const TAKBOM_BEST_KEY = "azox:takbom:best:v1";
export const STAR_POINTS = 1;

export const TAKBOM_COLORS = {
  base: "#4a9e1a",
  bright: "#6bc934",
  glow: "#4db820",
  dark: "#2E8B10",
  background: "#000000",
  grid: "#0A3A0A",
} as const;
