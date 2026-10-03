import { AZOX_IMAGES } from "./azox-images";
import type { RankKey } from "./ranks";

export {
  RANKS,
  rankForPoints,
  nextRank,
  type RankKey,
  type Rank,
} from "./ranks";

export type Game = {
  id: string;
  name: string;
  image: string;
  tag: string;
};

export const GAMES: Game[] = [
  {
    id: "video-ads",
    name: "Azox Word",
    image: AZOX_IMAGES["video-ads"],
    tag: "Daily",
  },
  {
    id: "global-button",
    name: "The Global Button",
    image: AZOX_IMAGES["global-button"],
    tag: "Live",
  },
  {
    id: "question-day",
    name: "AZOX Question Day",
    image: AZOX_IMAGES["question-day"],
    tag: "Daily",
  },
  { id: "box", name: "AZOX Box", image: AZOX_IMAGES.box, tag: "Loot" },
  {
    id: "clicker-frenzy",
    name: "Clicker Frenzy",
    image: AZOX_IMAGES["clicker-frenzy"],
    tag: "Arcade",
  },
  { id: "snake", name: "AZOX Snake", image: AZOX_IMAGES.snake, tag: "Arcade" },
  { id: "shoot", name: "AZOX Shoot", image: AZOX_IMAGES.shoot, tag: "Arcade" },
  {
    id: "tak-bom",
    name: "AZOX Tak Bom",
    image: AZOX_IMAGES["tak-bom"],
    tag: "Arcade",
  },
];

export const CATEGORIES = [
  "Blockchain",
  "AI",
  "AI Agent",
  "Trading",
  "Analysis",
  "Gaming",
  "Economic",
  "Learning",
];

export {
  SOCIAL_TASKS,
  type SocialTask,
  type SocialTaskGroup,
} from "./social-tasks";

export type LeaderboardUser = {
  name: string;
  points: number;
  avatar?: string;
  photo_url?: string | null;
  first_name?: string | null;
  username?: string | null;
};

// Demo leaderboard data per rank.
export const LEADERBOARD: Record<RankKey, LeaderboardUser[]> = {
  Legendary: [
    { name: "cryptoKing", points: 14_200_000 },
    { name: "azox_whale", points: 11_900_000 },
    { name: "solana_max", points: 10_400_000 },
  ],
  Epic: [
    { name: "tap_master", points: 4_300_000 },
    { name: "degen_dana", points: 2_100_000 },
    { name: "nightowl", points: 1_050_000 },
  ],
  Diamond: [
    { name: "gem_hunter", points: 820_000 },
    { name: "frostbyte", points: 640_000 },
    { name: "lumina", points: 520_000 },
  ],
  Platinum: [
    { name: "steel_fox", points: 320_000 },
    { name: "orbit", points: 180_000 },
    { name: "pulse", points: 105_000 },
  ],
  Gold: [
    { name: "goldrush", points: 84_000 },
    { name: "midas", points: 55_000 },
    { name: "sunny", points: 26_000 },
  ],
  Silver: [
    { name: "silverlining", points: 22_000 },
    { name: "mercury", points: 14_000 },
    { name: "breeze", points: 10_100 },
  ],
  Bronze: [
    { name: "newcomer", points: 8_400 },
    { name: "rookie_99", points: 3_200 },
    { name: "starter", points: 450 },
  ],
};

export type TaskLeader = {
  name: string;
  tasks: number;
  avatar?: string;
  photo_url?: string | null;
  first_name?: string | null;
  username?: string | null;
};

export type ReferralLeader = {
  name: string;
  referrals: number;
  avatar?: string;
  photo_url?: string | null;
  first_name?: string | null;
  username?: string | null;
};

// Demo task leaderboard, sorted by total tasks descending.
export const LEADERBOARD_TASKS: TaskLeader[] = [
  { name: "azox_whale", tasks: 1420 },
  { name: "cryptoKing", tasks: 1385 },
  { name: "tap_master", tasks: 1260 },
  { name: "degen_dana", tasks: 1140 },
  { name: "gem_hunter", tasks: 980 },
  { name: "frostbyte", tasks: 870 },
  { name: "lumina", tasks: 760 },
  { name: "steel_fox", tasks: 650 },
  { name: "orbit", tasks: 540 },
  { name: "pulse", tasks: 430 },
];

// Demo referral leaderboard, sorted by total referrals descending.
export const LEADERBOARD_REFERRALS: ReferralLeader[] = [
  { name: "cryptoKing", referrals: 1280 },
  { name: "azox_whale", referrals: 1190 },
  { name: "solana_max", referrals: 980 },
  { name: "tap_master", referrals: 860 },
  { name: "degen_dana", referrals: 740 },
  { name: "gem_hunter", referrals: 630 },
  { name: "frostbyte", referrals: 520 },
  { name: "steel_fox", referrals: 410 },
  { name: "midas", referrals: 320 },
  { name: "goldrush", referrals: 210 },
];

export function formatPoints(n: number): string {
  if (n >= 1_000_000) {
    return (n / 1_000_000).toFixed(3).replace(/\.?0+$/, "") + "M";
  }
  if (n >= 1_000) {
    return (n / 1_000).toFixed(2).replace(/\.?0+$/, "") + "K";
  }
  return n.toString();
}

export const GAME_TASK_RULES = {
  WORD_COMPLETE:      "game-word-complete",
  BOX_OPEN:           "game-box-open",
  QUESTION_COMPLETE:  "game-question-complete",
  GLOBAL_BUTTON_WIN:  "game-global-button-win",
  SHOOT_GLOBAL_BEST:  "game-shoot-best",
  SNAKE_GLOBAL_BEST:  "game-snake-best",
  TAKBOM_GLOBAL_BEST: "game-takbom-best",
} as const;
