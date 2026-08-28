# AZOX Gateway

I have a Next.js AZOX gaming mini app on GitHub at:
github.com/Azad31g/azox-web-app-build

I need you to recreate the EXACT same design and 
functionality in this Lovable project (TanStack Start).

Here is what the app looks like and does:

DESIGN:
- Dark background (#000000 or very dark)
- Green primary color for buttons and accents
- AZOX logo in top-left
- 5 bottom navigation tabs: Home, Games, Tasks, Ranks, Profile

HOME PAGE:
- Top bar: AZOX logo + Rank badge (Bronze) + Points counter + Avatar
- Two cards below top bar:
  1. THE GLOBAL BUTTON card with countdown timer (03:39:15)
  2. AZOX Video Ad's card with Watch button (orange/green)
- Large circular AZOX logo button in center (tap to earn points)
- Text: "Tap with multiple fingers to earn 1 pt per finger at Bronze rank"
- "Multi-touch rewards" section below

GAMING PAGE:
- Title: "AZOX Gaming" + subtitle
- Grid of game cards with images (2 columns):
  Video Ads (Earn badge), Global Button (Live badge),
  Question Day (Daily badge), AZOX Box (Loot badge),
  Clicker Frenzy (Arcade), Snake (Arcade),
  Chess (Strategy), Dama Kurdish (Strategy),
  Tak Bom (Arcade), XO AZOX (Classic)
- Each card has game logo image + name + badge
- "Global Leaderboard" button at bottom
- "By Guardex Quant LABs" footer

RANKS PAGE:
- Title: "Global Ranking - 7 ranks sorted by total points"
- Featured card: Azad Bashqali (Founder - AZOX Token) - Legendary rank
- Horizontal scrollable rank tabs: Legendary, Epic, Diamond, Platinum, Gold, Silver, Bronze
- Each rank shows top players with points

TASKS PAGE:
- Title: "Tasks - Complete tasks to earn AZOX points"
- Daily Gift card: "+50 points for logging in today" with green "Claim +50" button
- Telegram section: Join AZOX Community (+100), Join AZOX Coin (+100)
- X (Twitter) section: Follow Azad_Bashqaly (+150), Follow AZOX Coin (+150), Follow Solana (+100)
- Each task has an "Open" button with external link icon

PROFILE PAGE:
- Large avatar circle with initials
- Username (@azox_player), Bronze rank badge, Joined date
- 4 stat cards: Total points, Rank, Total referrals, Global Button wins
- "Your referral link" section with copy button
- Link: https://t.me/AZOX_bot?start=username

COLORS (from app/globals.css in GitHub):
- Background: #000000 (pure black)
- Card background: #0c0f08 (very dark green-black)  
- Primary: green (#22c55e or similar)
- Accent: orange (#FF7A18)
- Text: white/light gray
- Rank colors: Bronze=#CD7F32, Silver=#C0C0C0, Gold=#FFD700, 
  Platinum=#E5E4E2, Diamond=#B9F2FF, Epic=#A855F7, Legendary=#FF7A18

TECHNICAL:
- Points stored in localStorage (no database yet)
- Telegram WebApp SDK integrated
- 7 rank system based on points:
  Bronze: 0+, Silver: 10,000+, Gold: 25,000+,
  Platinum: 100,000+, Diamond: 500,000+, 
  Epic: 1,000,000+, Legendary: 10,000,000+
- Points per tap depends on rank (Bronze=1, Silver=2... Legendary=7)
- Multi-touch support (each finger = points per rank)

Please rebuild this complete app in TanStack Start 
keeping the EXACT same dark design, colors, and 
functionality. Use the game logos from public/azox/ folder.
Do not use Supabase — use localStorage only for now.

src/

├── routes/

│   ├── __root.tsx      ← TopBar + BottomNav + dark theme

│   ├── index.tsx       ← HomePage

│   ├── gaming.tsx      ← GamingPage

│   ├── leaderboard.tsx ← RanksPage (7 ranks)

│   ├── tasks.tsx       ← TasksPage

│   ├── profile.tsx     ← ProfilePage

│   └── games.$game.tsx ← Individual games

│

├── styles.css          ← Dark theme CSS (from v0 globals.css)

│

components/

├── azox/

│   ├── top-bar.tsx           ← AZOX logo + rank + points + avatar

│   ├── bottom-nav.tsx        ← 5 tabs navigation

│   ├── click-button.tsx      ← Main circular AZOX button

│   ├── app-provider.tsx      ← Context: points, user, rank

│   ├── footer.tsx

│   ├── pages/

│   │   ├── home-page.tsx     ← Global Button timer + Video Ads + TAP button

│   │   ├── gaming-page.tsx   ← Game grid with images

│   │   ├── leaderboard-page.tsx ← 7 rank tabs + players

│   │   ├── task-page.tsx     ← Daily gift + social tasks

│   │   └── profile-page.tsx  ← Stats + referral link

│   └── games/

│       ├── GlobalButton/     ← Timer countdown game

│       ├── VideoAds/         ← Watch ad + earn

│       ├── ClickerFrenzy/    ← Tap fast game

│       ├── AzoxBox/          ← Daily mystery box

│       ├── QuestionDay/      ← Daily trivia

│       ├── SnakeGame/        ← Classic snake

│       ├── ShootGame/        ← iframe to Lovable shoot game

│       └── TakBom/           ← Bomb defuse game

│

hooks/

├── useUser.ts          ← Telegram user + localStorage

├── usePoints.ts        ← Points + rank + level

├── useLeaderboard.ts   ← 7 rank leaderboard

└── useTasks.ts         ← Daily tasks + claims

│

lib/

├── azox-data.ts        ← Games list + tasks + rank definitions

├── points.ts           ← localStorage helpers + level calculation

├── telegram.ts         ← Telegram WebApp SDK

└── utils.ts

│

public/azox/            ← All game logos (already in GitHub)

This project was built with [Lovable](https://lovable.dev).

**Live app**: https://azox-tap-earn.lovable.app

## Build with Lovable

Continue developing this project in the [Lovable editor](https://lovable.dev/projects/fa1feb84-f37d-421f-8529-c88456850cee).

- **Ship faster**: describe what you want to build and Lovable handles the code.
- **Stay in sync**: every change made in Lovable is committed straight to this repository.
- **Full ownership**: this code is yours. Push to `main` on GitHub and your changes sync back into Lovable, ready for your next prompt.

## Development

Prefer working locally? You need Node.js and npm — [install with nvm](https://github.com/nvm-sh/nvm#installing-and-updating).

```sh
git clone <this-repository-url>
cd <repository-name>
npm i
npm run dev
```
