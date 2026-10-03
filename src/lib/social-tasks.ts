// Pure data: social tasks. Safe to import from server code.
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
