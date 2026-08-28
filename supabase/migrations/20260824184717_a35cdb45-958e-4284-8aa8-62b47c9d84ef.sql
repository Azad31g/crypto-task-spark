DROP TABLE IF EXISTS public.tasks CASCADE;

CREATE TABLE public.tasks (
  id          UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  platform    TEXT NOT NULL CHECK (platform IN ('telegram','instagram','tiktok','x','youtube','discord')),
  title       TEXT NOT NULL,
  url         TEXT NOT NULL,
  points      INTEGER NOT NULL DEFAULT 100,
  status      TEXT NOT NULL DEFAULT 'active' CHECK (status IN ('active','disabled')),
  sort_order  INTEGER NOT NULL DEFAULT 1,
  created_at  TIMESTAMPTZ DEFAULT NOW()
);

GRANT SELECT ON public.tasks TO anon;
GRANT SELECT ON public.tasks TO authenticated;
GRANT ALL ON public.tasks TO service_role;

ALTER TABLE public.tasks ENABLE ROW LEVEL SECURITY;

CREATE POLICY "anon_read_active"
ON public.tasks FOR SELECT
TO anon
USING (status = 'active');

INSERT INTO public.tasks (platform, title, url, points, sort_order) VALUES
('telegram',  'Join AZOX Community',   'https://t.me/AZOX_Coin',      500, 1),
('telegram',  'Join AZOX Coin',        'https://t.me/AZOX_Community', 500, 2),
('instagram', 'Follow Azad Bashqali',  'https://www.instagram.com/azad__x_?igsi=MXgzdnZnMGo2NmZncA==', 100, 1),
('instagram', 'Follow AZOX Coin',      'https://www.instagram.com/azox_coin?igsh=cm5teW91Mjc5aW15', 100, 2),
('tiktok',    'Follow Azad Bashqali',  'https://www.tiktok.com/@azad_x__', 100, 1),
('tiktok',    'Follow AZOX Coin',      'https://www.tiktok.com/@azox.coin', 100, 2),
('x',         'Follow AZOX Coin',      'https://x.com/AzoxCoin', 150, 1),
('x',         'Follow Robinhood',      'https://x.com/RobinhoodApp', 150, 2),
('youtube',   'Subscribe AZOX Coin',   'https://youtube.com/@azox_coin', 150, 1),
('discord',   'Join AZOX Server',      'https://discord.gg/5zCgkJJ2P', 100, 1);