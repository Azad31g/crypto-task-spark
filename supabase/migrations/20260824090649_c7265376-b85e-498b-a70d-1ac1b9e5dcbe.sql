CREATE TABLE public.tasks (
  id text PRIMARY KEY,
  platform text NOT NULL,
  title text NOT NULL,
  url text NOT NULL,
  points integer NOT NULL DEFAULT 0,
  status text NOT NULL DEFAULT 'active',
  sort_order integer NOT NULL DEFAULT 0,
  created_at timestamptz NOT NULL DEFAULT now()
);

GRANT SELECT ON public.tasks TO anon;
GRANT SELECT ON public.tasks TO authenticated;
GRANT ALL ON public.tasks TO service_role;

ALTER TABLE public.tasks ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Active tasks are publicly readable"
ON public.tasks FOR SELECT
TO anon, authenticated
USING (status = 'active');

INSERT INTO public.tasks (id, platform, title, url, points, status, sort_order) VALUES
('tg-1','telegram','Join AZOX Community','https://t.me/AZOX_Coin',500,'active',1),
('tg-2','telegram','Join AZOX Coin','https://t.me/AZOX_Community',500,'active',2),
('ig-1','instagram','Follow Azad Bashqali','https://www.instagram.com/azad__x_?igsi=MXgzdnZnMGo2NmZncA==',100,'active',1),
('ig-2','instagram','Follow AZOX Coin','https://www.instagram.com/azox_coin?igsh=cm5teW91Mjc5aW15',100,'active',2),
('ig-3','instagram','Follow Robinhood','https://www.instagram.com/robinhoodapp?igsh=cWh0ZjF4MXcwanUy',100,'active',3),
('ig-4','instagram','Follow OKX','https://www.instagram.com/okx_official?igsh=MXVvZmRlZHAxcjgweg==',100,'active',4),
('ig-5','instagram','Follow MetaMask','https://www.instagram.com/metamask.io?igsh=MXRub210Z2dpMTZqdw==',100,'active',5),
('ig-6','instagram','Follow Trust Wallet','https://www.instagram.com/trustwallet?igsh=MW15bnQ3dnZ4cXp1cw==',100,'active',6),
('ig-7','instagram','Follow Phantom','https://www.instagram.com/phantom?igsh=OWVlbThnc3ZscTIz',100,'active',7),
('tt-1','tiktok','Follow Azad Bashqali','https://www.tiktok.com/@azad_x__?_r=1&_t=ZS-98qeAKjkxBU',100,'active',1),
('tt-2','tiktok','Follow AZOX Coin','https://www.tiktok.com/@azox.coin?_r=1&_t=ZS-98qeCvz67Ma',100,'active',2),
('tt-3','tiktok','Follow Phantom','https://www.tiktok.com/@phantom?_r=1&_t=ZS-98qeIA1Kje0',100,'active',3),
('x-1','x','Follow AZOX Coin','https://x.com/AzoxCoin',150,'active',1),
('x-2','x','Follow Robinhood Crypto','https://x.com/RobinhoodCrypto',150,'active',2),
('x-3','x','Follow Robinhood','https://x.com/RobinhoodApp',150,'active',3),
('x-4','x','Follow USDG','https://x.com/global_dollar',150,'active',4),
('x-5','x','Follow OKX','https://x.com/okx',150,'active',5),
('x-6','x','Follow MetaMask','https://x.com/MetaMask',150,'active',6),
('x-7','x','Follow Trust Wallet','https://x.com/TrustWallet',150,'active',7),
('x-8','x','Follow Phantom','https://x.com/phantom',150,'active',8),
('yt-1','youtube','Subscribe AZOX Coin','https://youtube.com/@azox_coin?si=LUD9OYjsvBHT_WNU',150,'active',1),
('yt-2','youtube','Subscribe Phantom','https://youtube.com/@phantom-app?si=SZZFbQBE9ZQsUOa2',150,'active',2),
('yt-3','youtube','Subscribe MetaMask','https://youtube.com/@metamask?si=3NzhdW5pfFfN5sLl',150,'active',3),
('yt-4','youtube','Subscribe Trust Wallet','https://youtube.com/@trustwallet?si=NGjaW50khjR9Gypy',150,'active',4),
('yt-5','youtube','Subscribe OKX','https://youtube.com/@theokxglobal?si=RCE3Fr3SoVyQVBNj',150,'active',5),
('dc-1','discord','Join AZOX Server','https://discord.gg/5zCgkJJ2P',100,'active',1);