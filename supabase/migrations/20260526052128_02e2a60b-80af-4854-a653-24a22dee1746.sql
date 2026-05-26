
-- Enums
CREATE TYPE public.tournament_status AS ENUM ('DRAFT', 'APPROVED', 'PUBLISHED');
CREATE TYPE public.timeframe_type AS ENUM ('MONTHLY', 'SEMESTRAL');

-- TABLE 1: stores
CREATE TABLE public.stores (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  slug VARCHAR(80) UNIQUE NOT NULL,
  name VARCHAR(150) NOT NULL,
  city VARCHAR(100),
  state VARCHAR(100),
  country CHAR(2) DEFAULT 'MX',
  is_active BOOLEAN DEFAULT TRUE,
  created_at TIMESTAMPTZ DEFAULT NOW()
);
ALTER TABLE public.stores ENABLE ROW LEVEL SECURITY;

-- TABLE 2: games
CREATE TABLE public.games (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  slug VARCHAR(60) UNIQUE NOT NULL,
  name VARCHAR(100) NOT NULL,
  publisher VARCHAR(100),
  logo_url TEXT,
  is_active BOOLEAN DEFAULT TRUE
);
ALTER TABLE public.games ENABLE ROW LEVEL SECURITY;

-- TABLE 3: players
CREATE TABLE public.players (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  geek_tag VARCHAR(30) UNIQUE NOT NULL,
  display_name VARCHAR(80),
  email VARCHAR(255) UNIQUE,
  avatar_url TEXT,
  home_store_id UUID REFERENCES public.stores(id) ON DELETE SET NULL,
  is_active BOOLEAN DEFAULT TRUE,
  created_at TIMESTAMPTZ DEFAULT NOW()
);
ALTER TABLE public.players ENABLE ROW LEVEL SECURITY;

-- TABLE 4: tournaments
CREATE TABLE public.tournaments (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  store_id UUID NOT NULL REFERENCES public.stores(id),
  game_id UUID NOT NULL REFERENCES public.games(id),
  tournament_date DATE NOT NULL,
  qualifying_month SMALLINT NOT NULL CHECK (qualifying_month BETWEEN 1 AND 12),
  qualifying_semester SMALLINT NOT NULL CHECK (qualifying_semester IN (1, 2)),
  qualifying_year SMALLINT NOT NULL,
  status public.tournament_status DEFAULT 'DRAFT',
  csv_url TEXT,
  approved_at TIMESTAMPTZ,
  undo_deadline TIMESTAMPTZ,
  published_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ DEFAULT NOW()
);
ALTER TABLE public.tournaments ENABLE ROW LEVEL SECURITY;

-- TABLE 5: tournament_results
CREATE TABLE public.tournament_results (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tournament_id UUID NOT NULL REFERENCES public.tournaments(id) ON DELETE CASCADE,
  player_id UUID NOT NULL REFERENCES public.players(id),
  rank SMALLINT NOT NULL,
  wins SMALLINT DEFAULT 0,
  losses SMALLINT DEFAULT 0,
  points_earned SMALLINT DEFAULT 0 CHECK (points_earned BETWEEN 0 AND 100),
  UNIQUE (tournament_id, player_id)
);
ALTER TABLE public.tournament_results ENABLE ROW LEVEL SECURITY;

-- TABLE 6: leaderboard_snapshots
CREATE TABLE public.leaderboard_snapshots (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  player_id UUID NOT NULL REFERENCES public.players(id) ON DELETE CASCADE,
  game_id UUID NOT NULL REFERENCES public.games(id) ON DELETE CASCADE,
  store_id UUID REFERENCES public.stores(id),
  timeframe_type public.timeframe_type NOT NULL,
  timeframe_value VARCHAR(10) NOT NULL,
  total_points INTEGER DEFAULT 0,
  tournaments_played SMALLINT DEFAULT 0,
  tournaments_won SMALLINT DEFAULT 0,
  rank_position INTEGER,
  last_updated_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE (player_id, game_id, store_id, timeframe_type, timeframe_value)
);
ALTER TABLE public.leaderboard_snapshots ENABLE ROW LEVEL SECURITY;

-- Indexes
CREATE INDEX idx_tournaments_status ON public.tournaments(status);
CREATE INDEX idx_tournaments_year_month ON public.tournaments(qualifying_year, qualifying_month);
CREATE INDEX idx_tournaments_year_sem ON public.tournaments(qualifying_year, qualifying_semester);
CREATE INDEX idx_lb_query ON public.leaderboard_snapshots(game_id, store_id, timeframe_type, timeframe_value, total_points DESC);
