import * as React from "react";

export type TCG = "One Piece" | "Magic: The Gathering" | "Pokémon";
export type Role = "guest" | "player" | "organizer" | "admin";

export interface Player {
  id: string;
  geekTag: string;
  city: string;
  tcg: TCG;
  monthlyPoints: number;
  semiannualPoints: number;
  wins: number;
  losses: number;
  omw: number;
  tournamentsWon: number;
}

export interface TournamentResult {
  id: string;
  date: string;
  store: string;
  city: string;
  tcg: TCG;
  placement: number;
  pointsEarned: number;
  geekTag: string;
}

export interface PendingSubmission {
  id: string;
  tcg: TCG;
  city: string;
  store: string;
  date: string;
  organizer: string;
  results: { geekTag: string; points: number }[];
}

export interface CurrentUser {
  email: string;
  geekTag: string;
  role: Role;
}

const TCGS: TCG[] = ["One Piece", "Magic: The Gathering", "Pokémon"];
const CITIES = ["New York", "Los Angeles", "Chicago", "Austin", "Seattle", "Miami", "Denver", "Boston"];
const TAGS = [
  "VoidStriker", "CryoMancer", "NeonShogun", "GrimReap3r", "PhantomDeck", "RogueAce",
  "MythicByte", "ArcaneFlux", "SteelToad", "OmegaZero", "Dragonlord", "BlitzKnight",
  "EmberFox", "HexProof", "CipherWave", "VortexKid", "NullRomeo", "ShinyHunter",
  "PrismVolt", "TitanGale", "PixelBaron", "CrimsonOath", "GhostType", "MetaPredator",
  "QuantumSplice", "AshRivals", "OracleVein", "RuneSmith", "VanguardX", "EchoBlade",
  "StaticDrift", "GlacialFury", "NobleKnight", "ShadowMeta", "RapidStrike", "ChaosOrb",
  "AstralKing", "VenomCoil", "ZenithRising", "HyperJotaro",
];

function seedPlayers(): Player[] {
  return TAGS.map((tag, i) => {
    const monthly = Math.round(1200 - i * 23 + (i % 4) * 15);
    const semi = Math.round(4200 - i * 78 + (i % 3) * 42);
    const wins = 60 - i + (i % 5) * 3;
    const losses = 12 + (i % 7) * 2;
    return {
      id: `p${i + 1}`,
      geekTag: tag,
      city: CITIES[i % CITIES.length],
      tcg: TCGS[i % TCGS.length],
      monthlyPoints: Math.max(monthly, 80),
      semiannualPoints: Math.max(semi, 320),
      wins: Math.max(wins, 4),
      losses: Math.max(losses, 3),
      omw: Math.round((58 + (i % 11)) * 10) / 10,
      tournamentsWon: Math.max(12 - Math.floor(i / 4), 0),
    };
  });
}

function seedTournaments(): TournamentResult[] {
  const stores = ["Dragon's Hoard", "Mythic Games", "Card Kingdom", "Arena Prime", "The Top Deck", "Sideboard Café"];
  const out: TournamentResult[] = [];
  TAGS.forEach((tag, idx) => {
    for (let k = 0; k < 6; k++) {
      out.push({
        id: `t-${idx}-${k}`,
        date: new Date(2026, 4 - k, 18 - k * 2).toISOString().slice(0, 10),
        store: stores[(idx + k) % stores.length],
        city: CITIES[(idx + k) % CITIES.length],
        tcg: TCGS[idx % TCGS.length],
        placement: ((idx + k) % 8) + 1,
        pointsEarned: 280 - k * 35 - (idx % 5) * 10,
        geekTag: tag,
      });
    }
  });
  return out;
}

function seedSubmissions(): PendingSubmission[] {
  return [
    {
      id: "s1", tcg: "One Piece", city: "Austin", store: "Dragon's Hoard",
      date: "2026-05-22", organizer: "store_austin",
      results: [
        { geekTag: "VoidStriker", points: 320 },
        { geekTag: "NeonShogun", points: 260 },
        { geekTag: "RogueAce", points: 200 },
        { geekTag: "EmberFox", points: 160 },
      ],
    },
    {
      id: "s2", tcg: "Magic: The Gathering", city: "Seattle", store: "Mythic Games",
      date: "2026-05-20", organizer: "store_seattle",
      results: [
        { geekTag: "ArcaneFlux", points: 340 },
        { geekTag: "HexProof", points: 280 },
        { geekTag: "RuneSmith", points: 220 },
      ],
    },
    {
      id: "s3", tcg: "Pokémon", city: "Miami", store: "Card Kingdom",
      date: "2026-05-19", organizer: "store_miami",
      results: [
        { geekTag: "ShinyHunter", points: 300 },
        { geekTag: "PrismVolt", points: 240 },
        { geekTag: "GhostType", points: 200 },
        { geekTag: "MetaPredator", points: 160 },
        { geekTag: "PixelBaron", points: 120 },
      ],
    },
    {
      id: "s4", tcg: "One Piece", city: "Chicago", store: "Arena Prime",
      date: "2026-05-17", organizer: "store_chicago",
      results: [
        { geekTag: "CrimsonOath", points: 280 },
        { geekTag: "BlitzKnight", points: 220 },
      ],
    },
  ];
}

interface Ctx {
  currentUser: CurrentUser | null;
  players: Player[];
  tournaments: TournamentResult[];
  pendingSubmissions: PendingSubmission[];
  login: (email: string, role?: Role, geekTag?: string) => void;
  signup: (email: string, geekTag: string) => void;
  logout: () => void;
  loginAsDemo: (role: Role) => void;
  submitTournament: (s: Omit<PendingSubmission, "id" | "organizer">) => void;
  approveSubmission: (id: string) => void;
  declineSubmission: (id: string) => void;
}

const StoreContext = React.createContext<Ctx | null>(null);

const STORAGE_KEY = "geek-collector-user";

export function AppStoreProvider({ children }: { children: React.ReactNode }) {
  const [currentUser, setCurrentUser] = React.useState<CurrentUser | null>(() => {
    if (typeof window === "undefined") return null;
    try {
      const raw = window.localStorage.getItem(STORAGE_KEY);
      return raw ? JSON.parse(raw) : null;
    } catch {
      return null;
    }
  });
  const [players, setPlayers] = React.useState<Player[]>(() => seedPlayers());
  const [tournaments, setTournaments] = React.useState<TournamentResult[]>(() => seedTournaments());
  const [pendingSubmissions, setPendingSubmissions] = React.useState<PendingSubmission[]>(() => seedSubmissions());

  React.useEffect(() => {
    if (typeof window === "undefined") return;
    if (currentUser) window.localStorage.setItem(STORAGE_KEY, JSON.stringify(currentUser));
    else window.localStorage.removeItem(STORAGE_KEY);
  }, [currentUser]);

  const value: Ctx = {
    currentUser,
    players,
    tournaments,
    pendingSubmissions,
    login(email, role = "player", geekTag) {
      setCurrentUser({ email, role, geekTag: geekTag ?? email.split("@")[0] });
    },
    signup(email, geekTag) {
      setCurrentUser({ email, geekTag, role: "player" });
      setPlayers((prev) =>
        prev.find((p) => p.geekTag === geekTag)
          ? prev
          : [
              ...prev,
              {
                id: `p${prev.length + 1}`,
                geekTag,
                city: "Unranked",
                tcg: "One Piece",
                monthlyPoints: 0,
                semiannualPoints: 0,
                wins: 0,
                losses: 0,
                omw: 0,
                tournamentsWon: 0,
              },
            ],
      );
    },
    logout() {
      setCurrentUser(null);
    },
    loginAsDemo(role) {
      if (role === "admin") setCurrentUser({ email: "admin@geekcollector.gg", geekTag: "Admin", role: "admin" });
      else if (role === "organizer") setCurrentUser({ email: "store@dragonshoard.com", geekTag: "Dragon's Hoard", role: "organizer" });
      else if (role === "player") setCurrentUser({ email: "void@geek.gg", geekTag: "VoidStriker", role: "player" });
      else setCurrentUser(null);
    },
    submitTournament(s) {
      const id = `s${Date.now()}`;
      setPendingSubmissions((prev) => [
        { ...s, id, organizer: currentUser?.geekTag ?? "guest_organizer" },
        ...prev,
      ]);
    },
    approveSubmission(id) {
      const sub = pendingSubmissions.find((s) => s.id === id);
      if (!sub) return;
      setPendingSubmissions((prev) => prev.filter((s) => s.id !== id));
      setPlayers((prev) =>
        prev.map((p) => {
          const r = sub.results.find((x) => x.geekTag.toLowerCase() === p.geekTag.toLowerCase());
          if (!r) return p;
          return {
            ...p,
            monthlyPoints: p.monthlyPoints + r.points,
            semiannualPoints: p.semiannualPoints + r.points,
            tournamentsWon: p.tournamentsWon + (sub.results[0].geekTag === p.geekTag ? 1 : 0),
          };
        }),
      );
      setTournaments((prev) => [
        ...sub.results.map((r, i) => ({
          id: `${id}-${i}`,
          date: sub.date,
          store: sub.store,
          city: sub.city,
          tcg: sub.tcg,
          placement: i + 1,
          pointsEarned: r.points,
          geekTag: r.geekTag,
        })),
        ...prev,
      ]);
    },
    declineSubmission(id) {
      setPendingSubmissions((prev) => prev.filter((s) => s.id !== id));
    },
  };

  return <StoreContext.Provider value={value}>{children}</StoreContext.Provider>;
}

export function useStore() {
  const ctx = React.useContext(StoreContext);
  if (!ctx) throw new Error("useStore must be used within AppStoreProvider");
  return ctx;
}