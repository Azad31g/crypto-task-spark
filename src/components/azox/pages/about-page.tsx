import { Link } from "@tanstack/react-router";
import { ArrowLeft, Gamepad2, Brain, ShieldCheck, Wallet, Users, MessageSquare } from "lucide-react";
import { SiSnapchat, SiThreads } from "react-icons/si";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import azoxLogo from "@/assets/azox/azox-logo.png.asset.json";

const FOUNDER_SOCIALS = [
  {
    name: "X",
    url: "https://x.com/Azad_Bashqaly",
    color: "#000000",
    icon: (
      <svg viewBox="0 0 24 24" className="size-5 fill-current">
        <path d="M18.244 2.25h3.308l-7.227 8.26 8.502 11.24H16.17l-5.214-6.817L4.99 21.75H1.68l7.73-8.835L1.254 2.25H8.08l4.713 6.231zm-1.161 17.52h1.833L7.084 4.126H5.117z" />
      </svg>
    ),
  },
  {
    name: "Instagram",
    url: "https://www.instagram.com/azad__x_?igsi=MXgzdnZnMGo2NmZncA==",
    color: "#E1306C",
    icon: (
      <svg viewBox="0 0 24 24" className="size-5 stroke-current" fill="none" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
        <rect x="2" y="2" width="20" height="20" rx="5" ry="5" />
        <path d="M16 11.37A4 4 0 1 1 12.63 8 4 4 0 0 1 16 11.37z" />
        <line x1="17.5" y1="6.5" x2="17.51" y2="6.5" />
      </svg>
    ),
  },
  {
    name: "TikTok",
    url: "https://www.tiktok.com/@azad_x__?_r=1&_t=ZS-993utVnOzjB",
    color: "#69C9D0",
    icon: (
      <svg viewBox="0 0 24 24" className="size-5 fill-current">
        <path d="M19.59 6.69a4.83 4.83 0 0 1-3.77-4.25V2h-3.45v13.67a2.89 2.89 0 0 1-5.2 1.74 2.89 2.89 0 0 1 2.31-4.64 2.93 2.93 0 0 1 .88.13V9.4a6.84 6.84 0 0 0-1-.05A6.33 6.33 0 0 0 5 20.1a6.34 6.34 0 0 0 10.86-4.43v-7a8.16 8.16 0 0 0 5 1.61V6.82a4.83 4.83 0 0 1-2.27-.13z" />
      </svg>
    ),
  },
  {
    name: "Threads",
    url: "https://www.threads.com/@azad__x_",
    color: "#FFFFFF",
    icon: <SiThreads className="size-5 fill-current" />,
  },
  {
    name: "Snapchat",
    url: "https://www.snapchat.com/add/azad_agha2002?share_id=1FUYMfEWuh8&locale=en-US",
    color: "#FFFC00",
    icon: <SiSnapchat className="size-5 fill-current" />,
  },
];

const CHANNELS = [
  {
    name: "X",
    url: "https://x.com/AzoxCoin",
    action: "Follow",
    color: "#000000",
    icon: (
      <svg viewBox="0 0 24 24" className="size-5 fill-current">
        <path d="M18.244 2.25h3.308l-7.227 8.26 8.502 11.24H16.17l-5.214-6.817L4.99 21.75H1.68l7.73-8.835L1.254 2.25H8.08l4.713 6.231zm-1.161 17.52h1.833L7.084 4.126H5.117z" />
      </svg>
    ),
  },
  {
    name: "Instagram",
    url: "https://www.instagram.com/azox_coin?igsh=cm5teW91Mjc5aW15",
    action: "Follow",
    color: "#E1306C",
    icon: (
      <svg viewBox="0 0 24 24" className="size-5 stroke-current" fill="none" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
        <rect x="2" y="2" width="20" height="20" rx="5" ry="5" />
        <path d="M16 11.37A4 4 0 1 1 12.63 8 4 4 0 0 1 16 11.37z" />
        <line x1="17.5" y1="6.5" x2="17.51" y2="6.5" />
      </svg>
    ),
  },
  {
    name: "TikTok",
    url: "https://www.tiktok.com/@azox.coin?_r=1&_t=ZS-993vDpOg16C",
    action: "Follow",
    color: "#69C9D0",
    icon: (
      <svg viewBox="0 0 24 24" className="size-5 fill-current">
        <path d="M19.59 6.69a4.83 4.83 0 0 1-3.77-4.25V2h-3.45v13.67a2.89 2.89 0 0 1-5.2 1.74 2.89 2.89 0 0 1 2.31-4.64 2.93 2.93 0 0 1 .88.13V9.4a6.84 6.84 0 0 0-1-.05A6.33 6.33 0 0 0 5 20.1a6.34 6.34 0 0 0 10.86-4.43v-7a8.16 8.16 0 0 0 5 1.61V6.82a4.83 4.83 0 0 1-2.27-.13z" />
      </svg>
    ),
  },
  {
    name: "YouTube",
    url: "https://youtube.com/@azox_coin?si=zC9jh25QHLrS4FBd",
    action: "Subscribe",
    color: "#FF0000",
    icon: (
      <svg viewBox="0 0 24 24" className="size-5 fill-current">
        <path d="M23.498 6.186a3.016 3.016 0 0 0-2.122-2.136C19.505 3.545 12 3.545 12 3.545s-7.505 0-9.377.505A3.017 3.017 0 0 0 .502 6.186C0 8.07 0 12 0 12s0 3.93.502 5.814a3.016 3.016 0 0 0 2.122 2.136c1.871.505 9.376.505 9.376.505s7.505 0 9.377-.505a3.015 3.015 0 0 0 2.122-2.136C24 15.93 24 12 24 12s0-3.93-.502-5.814zM9.545 15.568V8.432L15.818 12l-6.273 3.568z" />
      </svg>
    ),
  },
  {
    name: "Discord",
    url: "https://discord.gg/5zCgkJJ2P",
    action: "Join",
    color: "#5865F2",
    icon: (
      <svg viewBox="0 0 24 24" className="size-5 fill-current">
        <path d="M20.317 4.37a19.791 19.791 0 0 0-4.885-1.515.074.074 0 0 0-.079.037c-.21.375-.444.864-.608 1.25a18.27 18.27 0 0 0-5.487 0 12.64 12.64 0 0 0-.617-1.25.077.077 0 0 0-.079-.037A19.736 19.736 0 0 0 3.677 4.37a.07.07 0 0 0-.032.027C.533 9.046-.32 13.58.099 18.057a.082.082 0 0 0 .031.057 19.9 19.9 0 0 0 5.993 3.03.078.078 0 0 0 .084-.028 14.09 14.09 0 0 0 1.226-1.963.074.074 0 0 0-.04-.106 13.107 13.107 0 0 1-1.872-.892.077.077 0 0 1-.008-.128 10.2 10.2 0 0 0 .372-.292.074.074 0 0 1 .077-.01c3.928 1.793 8.18 1.793 12.062 0a.074.074 0 0 1 .078.01c.12.098.246.198.373.292a.077.077 0 0 1-.006.127 12.299 12.299 0 0 1-1.873.892.077.077 0 0 0-.041.107c.36.698.772 1.362 1.225 1.963a.078.078 0 0 0 .084.028 19.839 19.839 0 0 0 6.002-3.03.077.077 0 0 0 .032-.054c.5-5.177-.838-9.674-3.549-13.66a.061.061 0 0 0-.031-.03zM8.02 15.33c-1.183 0-2.157-1.085-2.157-2.419 0-1.333.956-2.419 2.157-2.419 1.21 0 2.176 1.096 2.157 2.42 0 1.333-.956 2.418-2.157 2.418zm7.975 0c-1.183 0-2.157-1.085-2.157-2.419 0-1.333.955-2.419 2.157-2.419 1.21 0 2.176 1.096 2.157 2.42 0 1.333-.946 2.418-2.157 2.418z" />
      </svg>
    ),
  },
];

const BUILDING_ITEMS = [
  { label: "Gaming & community rewards", icon: Gamepad2 },
  { label: "AI-powered trading & analytics", icon: Brain },
  { label: "Trusted decentralized trading", icon: ShieldCheck },
  { label: "Next-generation self-custody wallet", icon: Wallet },
  { label: "Haval — a Web3 social platform", icon: Users },
  { label: "Encrypted communication", icon: MessageSquare },
];

const ROADMAP = [
  "Foundation",
  "Market Launch",
  "AI Platform",
  "DEX",
  "Wallet",
  "Social",
  "Gaming",
];

export function AboutPage() {
  return (
    <div className="flex flex-col gap-6">
      {/* Header */}
      <header className="flex items-center gap-3">
        <Link
          to="/leaderboard"
          className="inline-flex size-10 items-center justify-center rounded-full bg-[#0d0d0d] text-foreground transition-colors hover:bg-[#141414]"
          aria-label="Back to Ranks"
        >
          <ArrowLeft className="size-5" />
        </Link>
        <h1 className="flex-1 text-center text-xl font-bold text-white">About</h1>
        <div className="size-10" />
      </header>

      {/* Founder */}
      <section className="rounded-2xl border border-[#FFD700] bg-[#0d0d0d] p-5">
        <div className="flex flex-col items-center gap-4">
          <img
            src="/azox/azad-bashqali.jpg"
            alt="Azad Bashqali"
            style={{
              width: 96, height: 96,
              borderRadius: "50%",
              objectFit: "cover",
              border: "3px solid #CCFF00",
            }}
            onError={(e) => {
              (e.target as HTMLImageElement).style.display = "none";
            }}
          />
          <div className="text-center">
            <h2 className="text-2xl font-bold text-white">Azad Bashqali</h2>
            <p className="mt-0.5 text-sm font-medium text-[#FF7A18]">
              Founder & Creator of AZOX
            </p>
          </div>
        </div>

        <blockquote className="mt-5 border-l-4 border-[#FF7A18] py-1 pl-4 italic text-[#22c55e]">
          &ldquo;Web3 should be more than tokens — it should be something people can actually use.&rdquo;
        </blockquote>

        <p className="mt-5 text-sm leading-relaxed text-[#888888]">
          Azad Bashqali is the founder and creator of AZOX, an early-stage Web3 ecosystem built on
          Robinhood Chain. With a background in mathematics and a passion for technology, blockchain,
          and digital innovation, he is building AZOX from the ground up — combining community, gaming,
          digital assets, intelligent tools, and decentralized technology into one growing ecosystem. The
          goal is simple: build something useful, grow it step by step, and let the ecosystem speak for
          itself.
        </p>

        <div className="mt-5 flex flex-wrap gap-3 pb-1">
          {FOUNDER_SOCIALS.map((item) => (
            <a
              key={item.name}
              href={item.url}
              target="_blank"
              rel="noopener noreferrer"
              className="flex shrink-0 items-center gap-2 rounded-xl border bg-[#141414] px-4 py-2.5 transition-colors hover:bg-[#1a1a1a]"
              style={{ borderColor: item.color }}
            >
              <span style={{ color: item.color }}>{item.icon}</span>
              <span className="text-sm font-medium text-white">{item.name}</span>
            </a>
          ))}
        </div>
      </section>

      <div className="h-px bg-[#1a1a1a]" />

      {/* About AZOX */}
      <section className="rounded-2xl bg-[#0d0d0d] p-5">
        <div className="flex items-center gap-3">
          <img
            src={azoxLogo.url}
            alt="AZOX logo"
            className="size-12 rounded-full object-cover"
          />
          <div>
            <h2 className="text-xl font-bold text-white">AZOX</h2>
            <p className="text-sm text-[#888888]">Building the next generation of Web3.</p>
          </div>
        </div>

        <p className="mt-4 text-sm leading-relaxed text-[#888888]">
          AZOX is an early-stage Web3 ecosystem built on Robinhood Chain, combining community, digital
          assets, gaming, and intelligent financial tools in one growing ecosystem.
        </p>

        <h3 className="mt-5 text-sm font-bold text-white">Our Vision</h3>
        <p className="mt-2 text-sm leading-relaxed text-[#888888]">
          To make Web3 more accessible, engaging, and useful — bringing powerful technology and a simple
          user experience together.
        </p>

        <h3 className="mt-5 text-sm font-bold text-white">What We&apos;re Building</h3>
        <ul className="mt-3 space-y-3">
          {BUILDING_ITEMS.map((item) => {
            const Icon = item.icon;
            return (
              <li key={item.label} className="flex items-center gap-3 text-sm text-[#888888]">
                <span className="inline-flex size-8 shrink-0 items-center justify-center rounded-lg bg-[#22c55e]/10 text-[#22c55e]">
                  <Icon className="size-4" />
                </span>
                {item.label}
              </li>
            );
          })}
        </ul>

        <h3 className="mt-5 text-sm font-bold text-white">Our Journey</h3>
        <div className="mt-3 flex gap-2 overflow-x-auto pb-2">
          {ROADMAP.map((step, index) => (
            <div key={step} className="flex items-center gap-2">
              <span
                className="whitespace-nowrap rounded-full px-3 py-1.5 text-xs font-semibold"
                style={{
                  backgroundColor: index === 0 ? "#FF7A18" : "#1a1a1a",
                  color: index === 0 ? "#ffffff" : "#888888",
                }}
              >
                {step}
              </span>
              {index < ROADMAP.length - 1 && (
                <span className="text-sm text-[#888888]">&rarr;</span>
              )}
            </div>
          ))}
        </div>
        <p className="mt-2 text-xs text-[#888888]">
          Built step by step. Designed for the long term.
        </p>

        <div className="mt-5 flex gap-3">
          <a
            href="https://app.notion.com/p/AZOX-Whitepaper-Version-1-0-37ad1e2f0a7d818ebaffe44a4840de83?source=copy_link"
            target="_blank"
            rel="noopener noreferrer"
            className="flex flex-1 items-center justify-center rounded-xl border border-white py-3 text-center text-sm font-semibold text-white transition-colors hover:bg-white/5"
          >
            WHITEPAPER
          </a>
          <a
            href="https://azox.io"
            target="_blank"
            rel="noopener noreferrer"
            className="flex flex-1 items-center justify-center rounded-xl border border-white py-3 text-center text-sm font-semibold text-white transition-colors hover:bg-white/5"
          >
            WEBSITE
          </a>
        </div>
      </section>

      <div className="h-px bg-[#1a1a1a]" />

      {/* Official Channels */}
      <section className="rounded-2xl bg-[#0d0d0d] p-5">
        <h2 className="text-lg font-bold text-white">Official AZOX Channels</h2>
        <div className="mt-4 grid grid-cols-2 gap-3">
          {CHANNELS.map((channel) => (
            <a
              key={channel.name}
              href={channel.url}
              target="_blank"
              rel="noopener noreferrer"
              className="flex flex-col gap-2 rounded-xl bg-[#141414] p-3 transition-colors hover:bg-[#1a1a1a]"
            >
              <div className="flex items-center gap-2">
                <span style={{ color: channel.color }}>{channel.icon}</span>
                <span className="text-sm font-medium text-white">{channel.name}</span>
              </div>
              <span className="self-start rounded-full bg-[#22c55e]/10 px-2 py-0.5 text-xs font-medium text-[#22c55e]">
                {channel.action}
              </span>
            </a>
          ))}
        </div>
      </section>

      {/* Footer */}
      <footer className="flex flex-col items-center gap-1 pb-4 text-center">
        <p className="text-sm font-medium text-[#888888]">
          AZOX — Guardex Quant LABs <span aria-hidden="true">👾</span>
        </p>
        <p className="text-xs text-[#888888]">Built on Robinhood Chain</p>
      </footer>
    </div>
  );
}
