import { AZOX_IMAGES } from "./azox-images";

export type RankKey =
  | "Bronze"
  | "Silver"
  | "Gold"
  | "Platinum"
  | "Diamond"
  | "Epic"
  | "Legendary";

export type Rank = {
  key: RankKey;
  threshold: number;
  pointsPerFinger: number;
  color: string;
};

export const RANKS: Rank[] = [
  { key: "Bronze", threshold: 0, pointsPerFinger: 1, color: "#b87333" },
  { key: "Silver", threshold: 50_000, pointsPerFinger: 2, color: "#c0c7d0" },
  { key: "Gold", threshold: 150_000, pointsPerFinger: 3, color: "#f5c542" },
  { key: "Platinum", threshold: 500_000, pointsPerFinger: 4, color: "#7fd1e0" },
  { key: "Diamond", threshold: 1_500_000, pointsPerFinger: 5, color: "#67e8f9" },
  { key: "Epic", threshold: 5_000_000, pointsPerFinger: 6, color: "#7c3aed" },
  {
    key: "Legendary",
    threshold: 25_000_000,
    pointsPerFinger: 7,
    color: "#f5c542",
  },
];

export function rankForPoints(points: number): Rank {
  let current: Rank = RANKS[0]!;
  for (const r of RANKS) {
    if (points >= r.threshold) current = r;
  }
  return current;
}

export function nextRank(points: number): Rank | null {
  const sorted = [...RANKS].sort((a, b) => a.threshold - b.threshold);
  for (const r of sorted) {
    if (points < r.threshold) return r;
  }
  return null;
}

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

export type SocialTask = {
  id: string;
  platform: string;
  label: string;
  points: number;
  url: string;
  /** Telegram public group/channel username used for membership verification. */
  verifyChat?: string;
  /** Bonus task reward associated with this task. */
  taskReward?: number;
};

export type SocialTaskGroup = {
  platform: string;
  /** Official brand color for the platform. */
  color: string;
  /** Secondary accent color (used by TikTok). */
  accent?: string;
  tasks: SocialTask[];
};

export const SOCIAL_TASKS: SocialTaskGroup[] = [
  {
    platform: "Telegram",
    color: "#229ED9",
    tasks: [
      {
        id: "tg-1",
        platform: "Telegram",
        label: "Join AZOX Community",
        points: 500,
        url: "https://t.me/AZOX_Coin",
        verifyChat: "AZOX_Coin",
      },
      {
        id: "tg-2",
        platform: "Telegram",
        label: "Join AZOX Coin",
        points: 500,
        url: "https://t.me/AZOX_Community",
        verifyChat: "AZOX_Community",
      },
    ],
  },
  {
    platform: "X (Twitter)",
    color: "#000000",
    accent: "#FFFFFF",
    tasks: [
      {
        id: "x-1",
        platform: "X (Twitter)",
        label: "Follow AZOX Coin",
        points: 150,
        url: "https://x.com/AzoxCoin",
      },
      {
        id: "x-2",
        platform: "X (Twitter)",
        label: "Follow Robinhood Crypto",
        points: 150,
        url: "https://x.com/RobinhoodCrypto",
      },
      {
        id: "x-3",
        platform: "X (Twitter)",
        label: "Follow Robinhood",
        points: 150,
        url: "https://x.com/RobinhoodApp",
      },
      {
        id: "x-4",
        platform: "X (Twitter)",
        label: "Follow USDG",
        points: 150,
        url: "https://x.com/global_dollar",
      },
      {
        id: "x-5",
        platform: "X (Twitter)",
        label: "Follow OKX",
        points: 150,
        url: "https://x.com/okx",
      },
      {
        id: "x-6",
        platform: "X (Twitter)",
        label: "Follow MetaMask",
        points: 150,
        url: "https://x.com/MetaMask",
      },
      {
        id: "x-7",
        platform: "X (Twitter)",
        label: "Follow Trust Wallet",
        points: 150,
        url: "https://x.com/TrustWallet",
      },
      {
        id: "x-8",
        platform: "X (Twitter)",
        label: "Follow Phantom",
        points: 150,
        url: "https://x.com/phantom",
      },
    ],
  },
  {
    platform: "Instagram",
    color: "#E1306C",
    tasks: [
      {
        id: "ig-1",
        platform: "Instagram",
        label: "Follow Azad Bashqali",
        points: 100,
        url: "https://www.instagram.com/azad__x_?igsi=MXgzdnZnMGo2NmZncA==",
      },
      {
        id: "ig-2",
        platform: "Instagram",
        label: "Follow AZOX Coin",
        points: 100,
        url: "https://www.instagram.com/azox_coin?igsh=cm5teW91Mjc5aW15",
      },
      {
        id: "ig-3",
        platform: "Instagram",
        label: "Follow Robinhood",
        points: 100,
        url: "https://www.instagram.com/robinhoodapp?igsh=cWh0ZjF4MXcwanUy",
      },
      {
        id: "ig-4",
        platform: "Instagram",
        label: "Follow OKX",
        points: 100,
        url: "https://www.instagram.com/okx_official?igsh=MXVvZmRlZHAxcjgweg==",
      },
      {
        id: "ig-5",
        platform: "Instagram",
        label: "Follow MetaMask",
        points: 100,
        url: "https://www.instagram.com/metamask.io?igsh=MXRub210Z2dpMTZqdw==",
      },
      {
        id: "ig-6",
        platform: "Instagram",
        label: "Follow Trust Wallet",
        points: 100,
        url: "https://www.instagram.com/trustwallet?igsh=MW15bnQ3dnZ4cXp1cw==",
      },
      {
        id: "ig-7",
        platform: "Instagram",
        label: "Follow Phantom",
        points: 100,
        url: "https://www.instagram.com/phantom?igsh=OWVlbThnc3ZscTIz",
      },
    ],
  },
  {
    platform: "TikTok",
    color: "#010101",
    accent: "#69C9D0",
    tasks: [
      {
        id: "tt-1",
        platform: "TikTok",
        label: "Follow Azad Bashqali",
        points: 100,
        url: "https://www.tiktok.com/@azad_x__?_r=1&_t=ZS-98qeAKjkxBU",
      },
      {
        id: "tt-2",
        platform: "TikTok",
        label: "Follow AZOX Coin",
        points: 100,
        url: "https://www.tiktok.com/@azox.coin?_r=1&_t=ZS-98qeCvz67Ma",
      },
      {
        id: "tt-3",
        platform: "TikTok",
        label: "Follow Phantom",
        points: 100,
        url: "https://www.tiktok.com/@phantom?_r=1&_t=ZS-98qeIA1Kje0",
      },
    ],
  },
  {
    platform: "Threads",
    color: "#000000",
    accent: "#FFFFFF",
    tasks: [
      {
        id: "th-1",
        platform: "Threads",
        label: "Follow Azad Bashqali",
        points: 100,
        url: "https://www.threads.com/@azad__x_",
      },
    ],
  },
  {
    platform: "YouTube",
    color: "#FF0000",
    tasks: [
      {
        id: "yt-1",
        platform: "YouTube",
        label: "Subscribe AZOX Coin",
        points: 150,
        url: "https://youtube.com/@azox_coin?si=LUD9OYjsvBHT_WNU",
      },
      {
        id: "yt-2",
        platform: "YouTube",
        label: "Subscribe Phantom",
        points: 150,
        url: "https://youtube.com/@phantom-app?si=SZZFbQBE9ZQsUOa2",
      },
      {
        id: "yt-3",
        platform: "YouTube",
        label: "Subscribe MetaMask",
        points: 150,
        url: "https://youtube.com/@metamask?si=3NzhdW5pfFfN5sLl",
      },
      {
        id: "yt-4",
        platform: "YouTube",
        label: "Subscribe Trust Wallet",
        points: 150,
        url: "https://youtube.com/@trustwallet?si=NGjaW50khjR9Gypy",
      },
      {
        id: "yt-5",
        platform: "YouTube",
        label: "Subscribe OKX",
        points: 150,
        url: "https://youtube.com/@theokxglobal?si=RCE3Fr3SoVyQVBNj",
      },
    ],
  },
  {
    platform: "Discord",
    color: "#5865F2",
    tasks: [
      {
        id: "dc-1",
        platform: "Discord",
        label: "Join AZOX Server",
        points: 100,
        url: "https://discord.gg/5zCgkJJ2P",
      },
    ],
  },
];

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
