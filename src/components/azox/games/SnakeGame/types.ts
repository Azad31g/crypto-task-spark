export type Direction = "up" | "down" | "left" | "right";

export type Position = { x: number; y: number };

export type GameState = "start" | "playing" | "paused" | "over";

export type ItemKind = "coin" | "diamond" | "heart" | "lightning" | "rock";

export type Item = { id: number; kind: ItemKind; pos: Position };

export const GRID = 20;
export const SNAKE_BEST_KEY = "azox:snake:best:v1";

export type CellType = "empty" | "snake" | "food" | "obstacle";
