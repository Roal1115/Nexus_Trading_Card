# Geek Arena

A modern web application for managing competitive trading card game (TCG) tournaments and leaderboards across multiple games including One Piece, Magic: The Gathering, and Pokémon TCG.

## Overview

Geek Arena provides a centralized platform for tracking competitive rankings, tournament results, and player statistics across popular TCGs. Users can view leaderboards, manage tournaments, upload results, and explore player profiles in a rich, interactive interface.

## Tech Stack

### Frontend
- **React 19** - UI framework
- **TanStack Router** - Type-safe routing
- **TanStack Query (React Query)** - Data fetching and caching
- **TanStack Start** - Full-stack React framework
- **Tailwind CSS** - Utility-first CSS framework
- **Radix UI** - Accessible component primitives
- **TypeScript** - Type-safe development
- **Vite** - Fast build tool and dev server

### Backend
- **Cloudflare Workers** - Serverless runtime via Wrangler
- **TanStack Start Server** - Custom SSR layer with error handling

### Tooling
- **ESLint** - Code linting
- **Prettier** - Code formatting
- **Bun** - Fast JavaScript runtime and package manager

## Features

- **Leaderboard System** - View competitive rankings across multiple TCGs
- **Filtering & Search** - Filter by game, city, and time period; search for specific players
- **Admin Dashboard** - Manage tournaments and results
- **User Authentication** - Secure login system
- **Tournament Uploads** - Submit and track tournament results
- **Responsive Design** - Mobile-first UI using Tailwind CSS and Radix UI components
- **Real-time Updates** - React Query integration for efficient data management

## Project Structure

```
src/
├── routes/              # TanStack Router route definitions
│   ├── __root.tsx       # Root layout component
│   ├── index.tsx        # Leaderboard page
│   ├── admin.tsx        # Admin dashboard
│   ├── dashboard.tsx    # User dashboard
│   ├── login.tsx        # Authentication
│   └── upload.tsx       # Tournament upload
├── components/          # Reusable React components
│   ├── layout/          # Layout components (AppHeader)
│   └── ui/              # UI primitives from Radix UI (buttons, dialogs, forms, etc.)
├── hooks/               # Custom React hooks (use-mobile)
├── lib/                 # Utilities and helpers
│   ├── mock-store.tsx   # State management with mock data
│   ├── utils.ts         # Helper utilities
│   ├── error-capture.ts # Error handling
│   └── error-page.ts    # Error page components
├── router.tsx           # Router configuration
├── server.ts            # SSR server configuration
├── start.ts             # Application entry point
└── styles.css           # Global styles
```

## Getting Started

### Prerequisites
- **Node.js** 18+ or **Bun** runtime
- **npm**, **yarn**, **bun**, or **pnpm** package manager

### Installation

1. **Clone the repository**
   ```bash
   git clone <repository-url>
   cd geek-arena
   ```

2. **Install dependencies**
   ```bash
   bun install
   # or
   npm install
   ```

3. **Set up environment variables** (if needed)
   Create a `.env.local` file in the root directory with any required API keys or configuration.

### Development

Start the development server:

```bash
bun run dev
# or
npm run dev
```

The application will be available at `http://localhost:5173` (or the configured Vite port).

### Building

Create a production build:

```bash
bun run build
# or
npm run build
```

Preview the production build locally:

```bash
bun run preview
# or
npm run preview
```

### Deployment

This project is configured to deploy to **Cloudflare Workers**. Deploy using Wrangler:

```bash
bun run build
wrangler deploy
```

## Scripts

- `bun run dev` - Start development server
- `bun run build` - Build for production
- `bun run build:dev` - Build in development mode
- `bun run preview` - Preview production build locally
- `bun run lint` - Run ESLint
- `bun run format` - Format code with Prettier

## Component Library

The project includes a comprehensive set of UI components from Radix UI, including:

- Buttons, badges, and toggles
- Forms, inputs, and select dropdowns
- Dialogs, alerts, and modals
- Cards, tables, and data displays
- Navigation components
- And many more...

All components are pre-configured with Tailwind CSS styling and stored in `src/components/ui/`.

## Key Dependencies

- `@tanstack/react-router@^1.168` - Advanced routing
- `@tanstack/react-query@^5.83` - Server state management
- `@radix-ui/*` - Accessible UI components
- `@tailwindcss/vite@^4.2` - CSS framework
- `@hookform/resolvers@^5.2` - Form validation
- `lucide-react` - Icon library
- `@cloudflare/vite-plugin@^1.25` - Cloudflare integration

## Configuration Files

- `vite.config.ts` - Vite and build configuration
- `tsconfig.json` - TypeScript configuration
- `tailwind.config.js` - Tailwind CSS settings
- `eslint.config.js` - ESLint rules
- `wrangler.jsonc` - Cloudflare Workers configuration
- `components.json` - shadcn/ui component configuration

## Contributing

1. Create a feature branch
2. Make your changes
3. Run linting and formatting:
   ```bash
   bun run lint
   bun run format
   ```
4. Submit a pull request

## Troubleshooting

### Port Already in Use
If port 5173 is in use, Vite will automatically try the next available port.

### Build Errors
- Clear `node_modules` and reinstall: `bun install --force`
- Clear Vite cache: `rm -rf .vite`

### Development Server Issues
Restart the dev server with: `bun run dev`

## License

[Add your license information here]

## Support

For issues, questions, or contributions, please open an issue or contact the development team.
