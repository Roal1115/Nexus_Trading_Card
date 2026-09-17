# Graph Report - Nexus_Trading_Card  (2026-09-14)

## Corpus Check
- Large corpus: 1943 files · ~3,073,816 words. Semantic extraction will be expensive (many Claude tokens). Consider running on a subfolder.

## Summary
- 1902 nodes · 4757 edges · 132 communities (98 shown, 33 thin omitted)
- Extraction: 98% EXTRACTED · 2% INFERRED · 0% AMBIGUOUS · INFERRED: 82 edges (avg confidence: 0.84)
- Token cost: 130,000 input · 34,000 output

## Community Hubs (Navigation)
- Admin Route Tree
- Weekly Calendar Grid
- Card UI Primitive
- Frontend Build Dependencies
- Admin Season/Meta Functions
- National Schedule Editing
- Select/Dropdown UI
- Supabase Auth Middleware
- Project Config (ESLint/package.json)
- Tournament Approval Dialogs
- Supabase Database Types
- Store Schedules Dialog
- Ads/Sponsors Admin Functions
- Command Palette UI
- Route Definitions
- Radix UI Primitives Bundle
- Ad Slot & Rewards Logic
- Loading Skeletons
- Nexus Auth/Admin Backend Functions
- Player Stats Dashboard
- Badge UI Component
- Player Sessions Queries
- Session Deck Disambiguation
- Dev Tooling Dependencies
- Password Reset Flow
- Tournament Admin Page
- National Calendar Admin Page
- Ad Carousel Components
- Dashboard Queries
- Meta Leader Display
- Tournament Appeal Form
- shadcn/ui Config
- Accordion UI & Docs Features
- Nexus Auth Context
- TypeScript Config
- Tournament RSVP & Creation
- Menubar UI
- Calendar Preferences & My Stats Queries
- Table Pagination/Scope Filters
- Auth Helper Functions
- Store League Management
- Tournament Session Detail Page
- Admin Ads Page
- Carousel UI
- Push Notifications Settings
- React Hook Form UI
- Bottom Nav (Panel)
- Color Dots & Performance Tracker
- Leaderboard Queries
- Badge Counts Hooks
- Nameplate Artwork
- Admin History Page
- Organizer History Page
- Organizer League Detail Page
- Profile Drawer
- TCG Manager History Page
- Manager My-History Page
- Competitor Landscape (Logia/OPTCG/Sessions)
- Meta Data Gap & Circuit Identity Moat
- Context Menu UI
- Chart UI Primitive
- MCL Platform Architecture & Migrations
- Store Edit Modal
- App Header & TCG Switcher
- Bottom Nav Component
- Panel Sidebar Navigation
- Admin Activity/Audit Log Page
- Pagination UI
- Admin Players/Stores Pages
- Organizer Appeals Page
- Admin Seasons Page
- geekarena-video HyperFrames Config
- geekarena-video Package Config
- internal-leagues-demo HyperFrames Config
- internal-leagues-demo Package Config
- Organizer Demo & Auth/Cache Notes
- organizer-features-demo HyperFrames Config
- organizer-features-demo Package Config
- Navigation Menu UI
- Breadcrumb UI
- Toggle UI
- Drawer UI
- Calendar Week Logic & Auto-Tournament Gen
- Launch Readiness Criteria & RLS Hardening
- Notification Bell
- Nexus Design System (Retro-Futurism)
- OTP Input UI
- Avatar UI
- Alert UI
- Query Cache Utility
- Community 90
- Community 91
- Community 92
- Community 93
- Community 94
- Community 95
- Community 96
- Community 97
- Community 98
- Community 99
- Community 100
- Community 101
- Community 102
- Community 103
- Community 104
- Community 105
- Community 106
- Community 107
- Community 108
- Community 109
- Community 110
- Community 111
- Community 112
- Community 113
- Community 114
- Community 115
- Community 116
- Community 117
- Community 118
- Community 119
- Community 120
- Community 121
- Community 122
- Community 123
- Community 124
- Community 125
- Community 126
- Community 127
- Community 128
- Community 129
- Community 130

## God Nodes (most connected - your core abstractions)
1. `cn()` - 226 edges
2. `failDb()` - 166 edges
3. `react` - 125 edges
4. `@tanstack/react-start` - 95 edges
5. `lucide-react` - 94 edges
6. `useNexusRole()` - 72 edges
7. `@tanstack/react-router` - 70 edges
8. `FileRoutesByPath` - 62 edges
9. `sonner` - 50 edges
10. `getNexusAdmin()` - 46 edges

## Surprising Connections (you probably didn't know these)
- `Nexus llms.txt (public site index)` --semantically_similar_to--> `Nexus README overview`  [INFERRED] [semantically similar]
  public/llms.txt → README.md
- `Logia (iOS OPTCG companion)` --semantically_similar_to--> `Sessions feature (/sessions)`  [INFERRED] [semantically similar]
  BUSINESS_ANALYSIS.md → PROJECT_CONTEXT.md
- `OPTCG.GG Match Tracker` --semantically_similar_to--> `Sessions feature (/sessions)`  [INFERRED] [semantically similar]
  BUSINESS_ANALYSIS.md → PROJECT_CONTEXT.md
- `Scene: Geek Tag identidad competitiva` --semantically_similar_to--> `Foso: identidad de circuito (geek tag, temporadas, ranking)`  [INFERRED] [semantically similar]
  geekarena-video/script-jugadores.md → BUSINESS_ANALYSIS.md
- `Scene: Meta matriz de enfrentamientos` --semantically_similar_to--> `Roadmap: Meta de Mexico publico`  [INFERRED] [semantically similar]
  geekarena-video/script-jugadores.md → BUSINESS_ANALYSIS.md

## Import Cycles
- None detected.

## Hyperedges (group relationships)
- **Nexus environment credential hardening (backend migration + audit fix)** — lovable_plan_plan_cambiar_el_entorno_de_preview_a_tu_backend_nexus_2026_08_25_nexus_backend_migration, audit_service_role_key_committed, lovable_plan_plan_cambiar_el_entorno_de_preview_a_tu_backend_nexus_2026_08_25_lovable_secret_manager [INFERRED 0.85]
- **Business weaknesses mapped to prioritized roadmap fixes** — business_analysis_d3_no_native_app_pwa, business_analysis_d8_no_notifications, business_analysis_roadmap_pwa_push, business_analysis_d6_no_public_tournament_page, business_analysis_roadmap_shareable_tournament_page [INFERRED 0.85]
- **Season 1 launch readiness governance (roadmap criteria + architecture gaps + incident process)** — docs_roadmap_alpha_criteria, docs_roadmap_beta_criteria, docs_roadmap_launch_readiness_criteria, docs_architecture_gap_no_alpha_beta_criteria, docs_roadmap_incident_process [INFERRED 0.85]

## Communities (132 total, 33 thin omitted)

### Community 0 - "Admin Route Tree"
Cohesion: 0.02
Nodes (80): AdminActivityRoute, AdminAdsRoute, AdminApprovedRoute, AdminCalendarRoute, AdminHistoryRoute, AdminIndexRoute, AdminPlayersIdRoute, AdminPlayersRoute (+72 more)

### Community 1 - "Weekly Calendar Grid"
Cohesion: 0.05
Nodes (56): @tanstack/react-query, CalendarEntry(), DAY_NAMES, HOURS, useCalendarGrid(), useWeekNav(), WeeklyGrid(), CalendarFilters (+48 more)

### Community 2 - "Card UI Primitive"
Cohesion: 0.06
Nodes (55): @radix-ui/react-dropdown-menu, Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle, DialogOverlay (+47 more)

### Community 3 - "Frontend Build Dependencies"
Cohesion: 0.03
Nodes (60): dependencies, class-variance-authority, @cloudflare/vite-plugin, clsx, cmdk, date-fns, embla-carousel-react, framer-motion (+52 more)

### Community 4 - "Admin Season/Meta Functions"
Cohesion: 0.08
Nodes (51): activateSeason, closeSeason, createSeason, listAuditLog, listSeasons, updateSeason, deactivateStaffMember, deletePlayerAccount (+43 more)

### Community 5 - "National Schedule Editing"
Cohesion: 0.12
Nodes (38): EditableEntry, getWeekDateRange(), recomputeSnapshot(), tfMonth(), TournamentStatus, requireNexusAdmin, requireNexusManager, getManagerAnalyticsOverview (+30 more)

### Community 6 - "Select/Dropdown UI"
Cohesion: 0.06
Nodes (31): @radix-ui/react-select, DropdownMenuContent, DropdownMenuItem, DropdownMenuSeparator, SelectContent, SelectItem, SelectLabel, SelectScrollDownButton (+23 more)

### Community 7 - "Supabase Auth Middleware"
Cohesion: 0.07
Nodes (33): attachSupabaseAuth, createSupabaseFetch(), isNewSupabaseApiKey(), requireSupabaseAuth, createSupabaseClient(), createSupabaseFetch(), isNewSupabaseApiKey(), createSupabaseAdminClient() (+25 more)

### Community 8 - "Project Config (ESLint/package.json)"
Cohesion: 0.05
Nodes (36): name, private, sideEffects, type, @cloudflare/vite-plugin, eslint, eslint-config-prettier, @eslint/js (+28 more)

### Community 9 - "Tournament Approval Dialogs"
Cohesion: 0.11
Nodes (31): @radix-ui/react-alert-dialog, UnapproveTournamentDialog(), AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter(), AlertDialogHeader() (+23 more)

### Community 10 - "Supabase Database Types"
Cohesion: 0.09
Nodes (32): CompositeTypes, Constants, Database, DatabaseWithoutInternals, DefaultSchema, Enums, Json, Tables (+24 more)

### Community 11 - "Store Schedules Dialog"
Cohesion: 0.13
Nodes (26): sonner, DAYS, Game, Schedule, ScheduleFns, DialogContent, DialogDescription, DialogFooter() (+18 more)

### Community 12 - "Ads/Sponsors Admin Functions"
Cohesion: 0.10
Nodes (31): inputValidator deprecated API (2.1), getNexusAdmin(), createSponsor, deleteSponsor, ensureMetricsRow(), getActiveBanner, getActiveSponsor, getSponsorMetrics (+23 more)

### Community 13 - "Command Palette UI"
Cohesion: 0.09
Nodes (28): cmdk, @radix-ui/react-dialog, Command, CommandEmpty, CommandGroup, CommandInput, CommandItem, CommandList (+20 more)

### Community 14 - "Route Definitions"
Cohesion: 0.06
Nodes (29): Route, Route, Route, Route, Route, Route, Route, Route (+21 more)

### Community 15 - "Radix UI Primitives Bundle"
Cohesion: 0.07
Nodes (21): clsx, @radix-ui/react-hover-card, @radix-ui/react-popover, @radix-ui/react-progress, @radix-ui/react-radio-group, @radix-ui/react-scroll-area, @radix-ui/react-slider, @radix-ui/react-switch (+13 more)

### Community 16 - "Ad Slot & Rewards Logic"
Cohesion: 0.12
Nodes (22): AdHorizontal(), getRewardKinds(), isNameplateReward(), RewardKind, getPlayerAchievements, getPublicProfile, setEquippedNameplate, playerAchievementsQuery() (+14 more)

### Community 17 - "Loading Skeletons"
Cohesion: 0.10
Nodes (16): recharts, @tanstack/react-router, SettingsSectionSkeleton(), shimmer(), SkeletonBlock(), SkeletonLine(), getManagerGames, Detail (+8 more)

### Community 18 - "Nexus Auth/Admin Backend Functions"
Cohesion: 0.11
Nodes (21): nexus-admin.functions.ts 2100+ lineas (2.3), @tanstack/react-start, zod, requireNexusUser, fetchMetaRounds(), fetchRoundsBatched(), filtersSchema, getMetaStats (+13 more)

### Community 19 - "Player Stats Dashboard"
Cohesion: 0.11
Nodes (19): COLOR_DOTS, computePlayerAggregates(), computeTournamentSummary(), DashboardEvent, filterStatsByDate(), HistoryRound, LeaderStat, Matchup (+11 more)

### Community 20 - "Badge UI Component"
Cohesion: 0.16
Nodes (18): class-variance-authority, lucide-react, Badge(), BadgeProps, badgeVariants, FileLink(), TournamentRowSkeleton(), Row (+10 more)

### Community 21 - "Player Sessions Queries"
Cohesion: 0.12
Nodes (19): getStandaloneSessions, getMyTrackedTournaments, sessionsPageQuery(), cleanName(), DeckIdentifier, formatSessionDate(), formatTournamentDate(), Game (+11 more)

### Community 22 - "Session Deck Disambiguation"
Cohesion: 0.10
Nodes (18): getTournamentCandidates, Candidate, cleanName(), DeckIdentifier, DisambiguationPicker(), formatDate(), formatTime(), HeroLeaderPicker() (+10 more)

### Community 23 - "Dev Tooling Dependencies"
Cohesion: 0.08
Nodes (24): devDependencies, eslint, eslint-config-prettier, @eslint/js, eslint-plugin-prettier, eslint-plugin-react-hooks, eslint-plugin-react-refresh, globals (+16 more)

### Community 24 - "Password Reset Flow"
Cohesion: 0.11
Nodes (12): passwordIsValid(), PasswordStrength(), ResetPasswordPage(), Route, translateAuthError(), Gender, Route, SignupPage() (+4 more)

### Community 25 - "Tournament Admin Page"
Cohesion: 0.15
Nodes (17): react, Checkbox, Textarea, Detail, formatDate(), formatDateTime(), MESES, statusBadge() (+9 more)

### Community 26 - "National Calendar Admin Page"
Cohesion: 0.10
Nodes (14): NationalScheduleEditSection(), ZONE_COLORS, AdminCalendarPage(), CalData, CalEntry, DAY_NAMES, HOURS, Route (+6 more)

### Community 27 - "Ad Carousel Components"
Cohesion: 0.11
Nodes (14): @tanstack/react-virtual, AdCarousel(), AdVertical(), PillSelect(), LeaderboardRowSkeleton(), Game, LeaderboardPage(), LeaderboardSearch (+6 more)

### Community 28 - "Dashboard Queries"
Cohesion: 0.15
Nodes (15): myDashboardQuery(), tournamentDetailQuery(), getMyDashboard, getTournamentDetail, toggleProfilePrivacy, copyTextFallback(), dataUrlToBlob(), generateShareCardDataUrl() (+7 more)

### Community 29 - "Meta Leader Display"
Cohesion: 0.18
Nodes (17): setBadge(), shortLeaderName(), metaFilterOptionsQuery(), MetaFilters, metaQuery(), getMetaFilterOptions, getMetaMatchups, COLOR_MAP (+9 more)

### Community 30 - "Tournament Appeal Form"
Cohesion: 0.14
Nodes (13): framer-motion, AppealForm(), DeckIdentifier, RoundsAccordionReadOnly(), RoundWithLeaders, confirmRoundResult, EXCLUDED_EVENT_LEADER_IDS, getDeckIdentifiers (+5 more)

### Community 31 - "shadcn/ui Config"
Cohesion: 0.11
Nodes (18): aliases, components, hooks, lib, ui, utils, iconLibrary, registries (+10 more)

### Community 32 - "Accordion UI & Docs Features"
Cohesion: 0.12
Nodes (17): @radix-ui/react-accordion, AccordionContent, AccordionItem, AccordionTrigger, FAQ, Feature, FeatureCard(), FeaturesDocsPage() (+9 more)

### Community 33 - "Nexus Auth Context"
Cohesion: 0.13
Nodes (15): @supabase/supabase-js, AppRole, AuthContext, AuthContextValue, homeRouteForRole(), NexusAuthProvider(), PlayerRow, readStoredSession() (+7 more)

### Community 34 - "TypeScript Config"
Cohesion: 0.11
Nodes (18): compilerOptions, allowImportingTsExtensions, jsx, lib, module, moduleResolution, noEmit, noFallthroughCasesInSwitch (+10 more)

### Community 35 - "Tournament RSVP & Creation"
Cohesion: 0.15
Nodes (16): Feature: RSVP torneo (Voy a ir), D9: Sin RSVP/pre-registro, Roadmap: RSVP Voy a ir, computeQualifying(), createTournament, deleteDraftTournament, getMyTournaments, normalizeId() (+8 more)

### Community 36 - "Menubar UI"
Cohesion: 0.11
Nodes (12): @radix-ui/react-menubar, Menubar, MenubarCheckboxItem, MenubarContent, MenubarItem, MenubarLabel, MenubarRadioItem, MenubarSeparator (+4 more)

### Community 37 - "Calendar Preferences & My Stats Queries"
Cohesion: 0.15
Nodes (14): CalendarPreferencesPrompt(), TCG, FETCHERS, myStatsGamesQuery(), myStatsSourceQuery(), StatsData, EquippedNameplate, getMyCasualStats (+6 more)

### Community 38 - "Table Pagination/Scope Filters"
Cohesion: 0.18
Nodes (12): ScopeFilters(), TablePager(), usePagination(), AnalyticsResult, CATEGORY_COLORS, CATEGORY_LABELS, OrganizerAnalytics(), PageViewResult (+4 more)

### Community 39 - "Auth Helper Functions"
Cohesion: 0.25
Nodes (14): escapeLike(), getAuthClient(), identifierSchema, loginWithIdentifier, maskEmail(), resendConfirmation, resolveEmail(), sendPasswordReset (+6 more)

### Community 40 - "Store League Management"
Cohesion: 0.31
Nodes (16): archiveStoreLeague, assertLeagueManager(), assertLeaguesEnabled(), assertOwnsStore(), createLeagueSchedule, createStoreLeague, deleteLeagueSchedule, deleteLeagueScheduleOverride (+8 more)

### Community 41 - "Tournament Session Detail Page"
Cohesion: 0.15
Nodes (12): getTournamentSessionDetail, cleanName(), DeckIdentifier, formatDate(), LeaderSelect(), RoundData, RoundState, Route (+4 more)

### Community 42 - "Admin Ads Page"
Cohesion: 0.12
Nodes (7): IMAGE_SPECS, ImageType, Metrics, Route, Sponsor, SponsorFormExtra, SponsorMetric

### Community 43 - "Carousel UI"
Cohesion: 0.17
Nodes (14): embla-carousel-react, Carousel, CarouselApi, CarouselContent, CarouselContext, CarouselContextProps, CarouselItem, CarouselNext (+6 more)

### Community 44 - "Push Notifications Settings"
Cohesion: 0.20
Nodes (10): PushNotificationsToggle(), urlBase64ToUint8Array(), addMyTcgId, getMyProfile, updateMyEmail, updateMyPassword, updateMyProfile, Game (+2 more)

### Community 45 - "React Hook Form UI"
Cohesion: 0.19
Nodes (12): @radix-ui/react-label, react-hook-form, FormControl, FormDescription, FormFieldContext, FormFieldContextValue, FormItem, FormItemContext (+4 more)

### Community 46 - "Bottom Nav (Panel)"
Cohesion: 0.16
Nodes (8): BottomNav(), ADMIN_ITEMS, MANAGER_ITEMS, NavItem, ORGANIZER_ITEMS, PanelBottomNav(), ErrorComponent(), isChunkLoadError()

### Community 47 - "Color Dots & Performance Tracker"
Cohesion: 0.19
Nodes (10): COLOR_HEX, ColorDots(), cleanDisplayName(), DeckIdentifier, LeaderSelect(), OpponentLeaderSelect(), PerformanceTrackerModal(), RoundRow (+2 more)

### Community 48 - "Leaderboard Queries"
Cohesion: 0.24
Nodes (12): LeaderboardFilters, leaderboardOptionsQuery(), leaderboardQuery(), getCached(), getLeaderboard, getLeaderboardOptions, getSeasonForMonth(), leaderboardCache (+4 more)

### Community 49 - "Badge Counts Hooks"
Cohesion: 0.28
Nodes (9): PanelSidebar(), useActivityLastSeen(), useBadgeCounts(), getAdminBadgeCounts, getManagerBadgeCounts, getOrganizerBadgeCounts, AdminLayout(), OrganizerLayout() (+1 more)

### Community 50 - "Nameplate Artwork"
Cohesion: 0.22
Nodes (8): DEFAULT_NAMEPLATE_ART, NAMEPLATE_TIER_ART, NameplateArt, NameplateArtwork(), NameplateAchievement, NameplateBanner(), DEFAULT_NAMEPLATE_BANNER, NAMEPLATE_BANNER_STYLES

### Community 51 - "Admin History Page"
Cohesion: 0.17
Nodes (11): getAdminFilterOptions, AdminHistoryPage(), Filters, fmtDate(), HistorySearch, INITIAL, ROLE_LABEL, Route (+3 more)

### Community 52 - "Organizer History Page"
Cohesion: 0.17
Nodes (11): getOrganizerFilterOptions, Filters, fmtDate(), HistorySearch, INITIAL, OrganizerHistoryPage(), ROLE_LABEL, Route (+3 more)

### Community 53 - "Organizer League Detail Page"
Cohesion: 0.18
Nodes (6): isWithinLeagueRange(), OrganizerLeagueDetailPage(), findNationalConflict(), handleAddSchedule(), submitSchedule(), toggleWeekday()

### Community 54 - "Profile Drawer"
Cohesion: 0.23
Nodes (8): ProfileDrawerProps, SheetContent, SheetContentProps, SheetDescription, SheetFooter(), SheetOverlay, SheetTitle, sheetVariants

### Community 55 - "TCG Manager History Page"
Cohesion: 0.18
Nodes (10): Filters, fmtDate(), HistorySearch, INITIAL, ManagerHistoryPage(), ROLE_LABEL, Route, Row (+2 more)

### Community 56 - "Manager My-History Page"
Cohesion: 0.18
Nodes (10): ACTION_INFO, Entry, Filters, fmtDateTime(), HistoryPage(), HistorySearch, INITIAL, Route (+2 more)

### Community 57 - "Competitor Landscape (Logia/OPTCG/Sessions)"
Cohesion: 0.18
Nodes (7): Logia (iOS OPTCG companion), OPTCG.GG Match Tracker, getDeckIdentifiers, Sessions feature (/sessions), sync-deck-identifiers edge function orphaned, ENDPOINTS, EXCLUDED_SET_PREFIXES

### Community 58 - "Meta Data Gap & Circuit Identity Moat"
Cohesion: 0.20
Nodes (11): D7: Sin datos de meta agregados publicos, Foso: identidad de circuito (geek tag, temporadas, ranking), Foso: dato granular local (win rates por tienda/temporada), Roadmap: Meta de Mexico publico, geekarena-video HyperFrames project, geekarena-video HyperFrames project (CLAUDE.md), geekarena-video/index.html composition, Scene: Geek Tag identidad competitiva (+3 more)

### Community 59 - "Context Menu UI"
Cohesion: 0.18
Nodes (10): @radix-ui/react-context-menu, ContextMenuCheckboxItem, ContextMenuContent, ContextMenuItem, ContextMenuLabel, ContextMenuRadioItem, ContextMenuSeparator, ContextMenuShortcut() (+2 more)

### Community 60 - "Chart UI Primitive"
Cohesion: 0.25
Nodes (9): ChartConfig, ChartContainer, ChartContext, ChartContextProps, ChartLegendContent, ChartTooltipContent, getPayloadConfigFromPayload(), THEMES (+1 more)

### Community 61 - "MCL Platform Architecture & Migrations"
Cohesion: 0.20
Nodes (10): MCL Platform architecture (2026-09-07), 20260902100000_player_achievements.sql, 20260902090000_store_page_views.sql, nexus-*.functions.ts como anti-corruption layer, Feature-Sliced por rol con capa de datos compartida, Nexus TCG Frontend HLD, Riesgo: bus factor de 1 persona (Rodrigo Ramos), MCL Season 1 Product Roadmap v1 (+2 more)

### Community 62 - "Store Edit Modal"
Cohesion: 0.24
Nodes (7): StoreSchedulesDialog(), FIELDS, StoreEditModal(), StoreLike, StoreCardSkeleton(), Game, Store

### Community 63 - "App Header & TCG Switcher"
Cohesion: 0.33
Nodes (6): AppHeader(), TcgSwitcher(), TCGContext, TCGContextValue, TCGProvider(), useTCG()

### Community 64 - "Bottom Nav Component"
Cohesion: 0.20
Nodes (5): DRAWER_ONLY_ROUTES, GUEST_ITEMS, NavItem, PILL_TRANSITION, PLAYER_ITEMS

### Community 65 - "Panel Sidebar Navigation"
Cohesion: 0.31
Nodes (6): SidebarItem, SidebarSection, playerNavSections(), PlayerSidebar(), ProfileDrawer(), NotificationBadge()

### Community 66 - "Admin Activity/Audit Log Page"
Cohesion: 0.20
Nodes (9): BlockSelect(), AuditLogRow, ACTION_LABELS, ActionInfo, ActivityPage(), Filters, INITIAL, ROLE_LABELS (+1 more)

### Community 67 - "Pagination UI"
Cohesion: 0.20
Nodes (9): ButtonProps, Pagination(), PaginationContent, PaginationEllipsis(), PaginationItem, PaginationLink(), PaginationLinkProps, PaginationNext() (+1 more)

### Community 68 - "Admin Players/Stores Pages"
Cohesion: 0.20
Nodes (10): useNexusRole(), ApprovedTournaments(), PendingTournaments(), AdminPlayersPage(), PlayerDetailPage(), AdminStoresPage(), TournamentsPanel(), AdminUploadPage() (+2 more)

### Community 69 - "Organizer Appeals Page"
Cohesion: 0.20
Nodes (5): getStoreAppeals, AppealRow, LeaderRef, Route, VersionInfo

### Community 70 - "Admin Seasons Page"
Cohesion: 0.31
Nodes (10): AdminSeasonsPage(), handleActivate(), handleClose(), handleCreate(), handleUpdate(), refresh(), resetForm(), slugify() (+2 more)

### Community 71 - "geekarena-video HyperFrames Config"
Cohesion: 0.22
Nodes (8): media, autoProxy, paths, assets, blocks, components, registry, $schema

### Community 72 - "geekarena-video Package Config"
Cohesion: 0.22
Nodes (8): name, private, scripts, check, dev, publish, render, type

### Community 73 - "internal-leagues-demo HyperFrames Config"
Cohesion: 0.22
Nodes (8): media, autoProxy, paths, assets, blocks, components, registry, $schema

### Community 74 - "internal-leagues-demo Package Config"
Cohesion: 0.22
Nodes (8): name, private, scripts, check, dev, publish, render, type

### Community 75 - "Organizer Demo & Auth/Cache Notes"
Cohesion: 0.28
Nodes (9): lovable sync check note, organizer-features-demo HyperFrames project (AGENTS.md), organizer-features-demo HyperFrames project (CLAUDE.md), organizer-features-demo/index.html — Panel del Organizador Demo, NexusAuthProvider (nexus-auth.context.tsx), query-cache.ts (TTL Map cache), PROJECT_CONTEXT.md snapshot 2026-07-03, Nexus llms.txt (public site index) (+1 more)

### Community 76 - "organizer-features-demo HyperFrames Config"
Cohesion: 0.22
Nodes (8): media, autoProxy, paths, assets, blocks, components, registry, $schema

### Community 77 - "organizer-features-demo Package Config"
Cohesion: 0.22
Nodes (8): name, private, scripts, check, dev, publish, render, type

### Community 78 - "Navigation Menu UI"
Cohesion: 0.25
Nodes (8): @radix-ui/react-navigation-menu, NavigationMenu, NavigationMenuContent, NavigationMenuIndicator, NavigationMenuList, NavigationMenuTrigger, navigationMenuTriggerStyle, NavigationMenuViewport

### Community 79 - "Breadcrumb UI"
Cohesion: 0.22
Nodes (8): @radix-ui/react-slot, Breadcrumb, BreadcrumbEllipsis(), BreadcrumbItem, BreadcrumbLink, BreadcrumbList, BreadcrumbPage, BreadcrumbSeparator()

### Community 80 - "Toggle UI"
Cohesion: 0.31
Nodes (7): @radix-ui/react-toggle, @radix-ui/react-toggle-group, ToggleGroup, ToggleGroupContext, ToggleGroupItem, Toggle, toggleVariants

### Community 81 - "Drawer UI"
Cohesion: 0.22
Nodes (7): vaul, DrawerContent, DrawerDescription, DrawerFooter(), DrawerHeader(), DrawerOverlay, DrawerTitle

### Community 82 - "Calendar Week Logic & Auto-Tournament Gen"
Cohesion: 0.29
Nodes (6): Logica de semana duplicada (2.6), Feature: Auto-generacion de torneos desde store_schedules, toISOString().split timezone bug (2.7), useWeekNav, getManagerCalendar, getPublicCalendar

### Community 83 - "Launch Readiness Criteria & RLS Hardening"
Cohesion: 0.25
Nodes (8): Gap: sin criterios Alpha/Beta/Launch/rollback, 20260714072000_rls_hardening.sql, Criterios Alpha, Criterios Beta, Proceso de soporte e incidencias, Criterios Launch Readiness, Condiciones de rollback, Schema drift: migracion vs schema real

### Community 84 - "Notification Bell"
Cohesion: 0.32
Nodes (6): date-fns, react-dom, db, NotificationBell(), NotificationRow, randomId()

### Community 85 - "Nexus Design System (Retro-Futurism)"
Cohesion: 0.29
Nodes (7): Nexus color palette (neon purple + rose), Nexus Design System Master (Gaming, retro-futurism), Retro-Futurism style guideline, Typography: Russo One + Chakra Petch, Paleta de colores por rol (organizer verde, manager azul, admin morado, jugador dorado), RoleBadge/RoleTag component (data-role scoped), Typography: Fraunces + IBM Plex Sans/Mono

### Community 86 - "OTP Input UI"
Cohesion: 0.33
Nodes (5): input-otp, InputOTP, InputOTPGroup, InputOTPSeparator, InputOTPSlot

### Community 87 - "Avatar UI"
Cohesion: 0.40
Nodes (4): @radix-ui/react-avatar, Avatar, AvatarFallback, AvatarImage

### Community 88 - "Alert UI"
Cohesion: 0.50
Nodes (4): Alert, AlertDescription, AlertTitle, alertVariants

### Community 90 - "Community 90"
Cohesion: 0.40
Nodes (4): getRouter(), Register, routeTree, startInstance

### Community 91 - "Community 91"
Cohesion: 0.50
Nodes (4): Feature: Notificaciones/recordatorios, D3: Sin app movil nativa / PWA instalable, D8: Sin notificaciones, Roadmap: PWA instalable + push notifications

### Community 92 - "Community 92"
Cohesion: 0.50
Nodes (4): Service role key committed to git (1.1), Lovable secret manager, Plan: Cambiar entorno de preview a backend Nexus, NEXUS_SERVICE_ROLE_KEY

### Community 93 - "Community 93"
Cohesion: 0.67
Nodes (4): 20260829000000_store_leagues.sql, internal-leagues-demo HyperFrames project (AGENTS.md), internal-leagues-demo HyperFrames project (CLAUDE.md), internal-leagues-demo/index.html — Ligas Internas Demo

### Community 94 - "Community 94"
Cohesion: 0.67
Nodes (3): react-day-picker, Calendar(), CalendarDayButton()

### Community 97 - "Community 97"
Cohesion: 0.67
Nodes (3): Colores de TCG duplicados (2.5), GAME_COLORS (weekly-grid.tsx), ZONE_COLORS (admin.calendar.tsx)

### Community 98 - "Community 98"
Cohesion: 0.67
Nodes (3): Feature: Pagina publica de torneo /tournaments/$id, D6: Sin torneo publico compartible, Roadmap: pagina publica de torneo compartible

### Community 99 - "Community 99"
Cohesion: 0.67
Nodes (3): Sponsor metrics inflatable without auth (1.3), registerAdView, registerSponsorView

### Community 100 - "Community 100"
Cohesion: 0.67
Nodes (3): TCG Arena, Nexus product overview (circuito nacional TCG MX), Tesis de valor Nexus

## Ambiguous Edges - Review These
- `Nexus README overview` → `lovable sync check note`  [AMBIGUOUS]
  lovable-sync-check.md · relation: conceptually_related_to

## Knowledge Gaps
- **606 isolated node(s):** `$schema`, `style`, `rsc`, `tsx`, `css` (+601 more)
  These have ≤1 connection - possible missing edges or undocumented components. (Counts symbols only; 784 node(s) total have ≤1 connection when file, concept and rationale nodes are included.)
- **33 thin communities (<3 nodes) omitted from report** — run `graphify query` to explore isolated nodes.

## Suggested Questions
_Questions this graph is uniquely positioned to answer:_

- **What is the exact relationship between `Nexus README overview` and `lovable sync check note`?**
  _Edge tagged AMBIGUOUS (relation: conceptually_related_to) - confidence is low._
- **Why does `react` connect `Tournament Admin Page` to `Weekly Calendar Grid`, `Card UI Primitive`, `National Schedule Editing`, `Select/Dropdown UI`, `Project Config (ESLint/package.json)`, `Tournament Approval Dialogs`, `Store Schedules Dialog`, `Command Palette UI`, `Radix UI Primitives Bundle`, `Ad Slot & Rewards Logic`, `Loading Skeletons`, `Player Stats Dashboard`, `Badge UI Component`, `Player Sessions Queries`, `Session Deck Disambiguation`, `Password Reset Flow`, `National Calendar Admin Page`, `Ad Carousel Components`, `Dashboard Queries`, `Meta Leader Display`, `Tournament Appeal Form`, `Accordion UI & Docs Features`, `Nexus Auth Context`, `Menubar UI`, `Calendar Preferences & My Stats Queries`, `Table Pagination/Scope Filters`, `Auth Helper Functions`, `Tournament Session Detail Page`, `Admin Ads Page`, `Carousel UI`, `Push Notifications Settings`, `React Hook Form UI`, `Bottom Nav (Panel)`, `Color Dots & Performance Tracker`, `Badge Counts Hooks`, `Nameplate Artwork`, `Admin History Page`, `Organizer History Page`, `Profile Drawer`, `TCG Manager History Page`, `Manager My-History Page`, `Context Menu UI`, `Chart UI Primitive`, `Store Edit Modal`, `App Header & TCG Switcher`, `Bottom Nav Component`, `Panel Sidebar Navigation`, `Admin Activity/Audit Log Page`, `Pagination UI`, `Organizer Appeals Page`, `Navigation Menu UI`, `Breadcrumb UI`, `Toggle UI`, `Drawer UI`, `Notification Bell`, `OTP Input UI`, `Avatar UI`, `Alert UI`, `Community 94`?**
  _High betweenness centrality (0.146) - this node is a cross-community bridge._
- **Why does `@tanstack/react-start` connect `Nexus Auth/Admin Backend Functions` to `Weekly Calendar Grid`, `Admin Season/Meta Functions`, `National Schedule Editing`, `Select/Dropdown UI`, `Supabase Auth Middleware`, `Project Config (ESLint/package.json)`, `Tournament Approval Dialogs`, `Supabase Database Types`, `Store Schedules Dialog`, `Ads/Sponsors Admin Functions`, `Command Palette UI`, `Ad Slot & Rewards Logic`, `Loading Skeletons`, `Badge UI Component`, `Player Sessions Queries`, `Session Deck Disambiguation`, `Password Reset Flow`, `Tournament Admin Page`, `National Calendar Admin Page`, `Ad Carousel Components`, `Dashboard Queries`, `Tournament Appeal Form`, `Tournament RSVP & Creation`, `Calendar Preferences & My Stats Queries`, `Table Pagination/Scope Filters`, `Auth Helper Functions`, `Store League Management`, `Tournament Session Detail Page`, `Admin Ads Page`, `Push Notifications Settings`, `Color Dots & Performance Tracker`, `Leaderboard Queries`, `Badge Counts Hooks`, `Admin History Page`, `Organizer History Page`, `TCG Manager History Page`, `Manager My-History Page`, `Store Edit Modal`, `Admin Activity/Audit Log Page`, `Organizer Appeals Page`?**
  _High betweenness centrality (0.106) - this node is a cross-community bridge._
- **Why does `cn()` connect `Card UI Primitive` to `Select/Dropdown UI`, `Tournament Approval Dialogs`, `Store Schedules Dialog`, `Command Palette UI`, `Radix UI Primitives Bundle`, `Badge UI Component`, `Tournament Admin Page`, `Accordion UI & Docs Features`, `Menubar UI`, `Carousel UI`, `React Hook Form UI`, `Organizer League Detail Page`, `Profile Drawer`, `Context Menu UI`, `Chart UI Primitive`, `Pagination UI`, `Navigation Menu UI`, `Breadcrumb UI`, `Toggle UI`, `Drawer UI`, `OTP Input UI`, `Avatar UI`, `Alert UI`, `Community 94`?**
  _High betweenness centrality (0.085) - this node is a cross-community bridge._
- **What connects `$schema`, `style`, `rsc` to the rest of the system?**
  _606 weakly-connected nodes found - possible documentation gaps or missing edges._
- **Should `Admin Route Tree` be split into smaller, more focused modules?**
  _Cohesion score 0.024691358024691357 - nodes in this community are weakly interconnected._
- **Should `Weekly Calendar Grid` be split into smaller, more focused modules?**
  _Cohesion score 0.05257312106627175 - nodes in this community are weakly interconnected._