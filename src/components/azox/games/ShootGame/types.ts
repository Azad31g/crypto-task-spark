export type ShootGameOverPayload = {
  finalScore: number;
  durationMs: number;
  enemiesDestroyed: number;
  coinsCollected: number;
};

export type ShootGameOverState = ShootGameOverPayload & { newRecord: boolean };

export const SHOOT_BEST_KEY = "azox:shoot:best:v1";
