# PayPoint Pro (Schore)

Workforce & payroll front-end for Schore Limited. Built with **Vite**, **TanStack Start / Router / Query**, **React 19**, **Tailwind CSS**, and **Axios**.

## Requirements

- Node.js 20+ (recommended)
- npm 10+

## Setup

```bash
git clone <repo-url>
cd paypoint-pro
npm install
```

## Environment

Copy the example env file and adjust values as needed:

```bash
cp .env.example .env
```

| Variable            | Description                                                                                   |
| ------------------- | --------------------------------------------------------------------------------------------- |
| `VITE_API_BASE_URL` | Backend API root (must end with `/`). Public — exposed to the browser via the `VITE_` prefix. |

Example (`.env`):

```env
VITE_API_BASE_URL=https://schore.yehtohoga.com/api/
```

Restart the dev server after changing env values.

## Scripts

| Command             | Description                             |
| ------------------- | --------------------------------------- |
| `npm run dev`       | Start the Vite development server       |
| `npm run build`     | Production build (client + SSR + Nitro) |
| `npm run build:dev` | Build in development mode               |
| `npm run preview`   | Preview the production build locally    |
| `npm run lint`      | Run ESLint                              |
| `npm run format`    | Format with Prettier                    |

## Development

```bash
npm run dev
```

Open the URL shown in the terminal (typically `http://localhost:8080` or similar).

## Production build

```bash
npm run build
npm run preview
```

Build output is written under `.output/`. Deploy with Nitro (Cloudflare module is the default preset in this project), for example:

```bash
npx nitro deploy --prebuilt
```

## Project structure (high level)

```
src/
  components/     Shared UI (forms, shell, auth layout)
  contexts/       Auth & API providers
  lib/api/        Axios client + feature services
  routes/         File-based TanStack routes
```

## Auth routes

| Path               | Purpose                                   |
| ------------------ | ----------------------------------------- |
| `/signin`          | Sign in                                   |
| `/forgot-password` | Request password reset email              |
| `/reset-password`  | Set a new password via email token        |
| `/profile`         | Profile + change password (authenticated) |

## Notes

- All API calls go through `src/lib/api/axios.ts` (`api` / `http`). Do not call Axios directly from feature code.
- Toasts are bottom-right (`sonner`). API errors for network / 5xx / 403 are toasted once in the Axios interceptor — use `notifyApiError` in catch blocks so messages are not duplicated.
- `.env` is gitignored; commit `.env.example` only.

