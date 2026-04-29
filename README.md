# Workboard

A personal dashboard built with SvelteKit, SQLite (Drizzle ORM), and Svelte 5 runes. Dark-red themed, server-rendered, deploys as a Node.js process.

## Features

| Page | What it does |
|---|---|
| **Dashboard** (`/`) | Clock, to-do list, multi-column note editor, reminder scratch-pad |
| **Bookmarks** (`/bookmarks`) | Collapsible folder tree, inline CRUD (name · URL · description) |
| **Diff** (`/diff`) | Git diff viewer — file list, syntax-highlighted hunks, per-file stats, untracked file detection, multiple project support |

## Stack

- **Framework** — SvelteKit 2, Svelte 5 (runes mode project-wide)
- **Database** — SQLite via `better-sqlite3` + Drizzle ORM
- **Adapter** — `@sveltejs/adapter-node` (self-hosted Node.js server)
- **Styling** — Scoped component CSS + CSS custom properties for theming (all tokens in `+layout.svelte`)
- **Tests** — Vitest (server unit tests + browser component tests via Playwright)

## Development

```sh
yarn install
cp .env.example .env       # set DATABASE_URL=local.db

yarn db:push               # create/sync tables from schema
yarn dev                   # starts on :7010 in background; logs → logs/dev.log
yarn dev:stop              # kills the process on :7010
```

The dev server runs in the background and frees the terminal. Follow logs with:

```sh
tail -f logs/dev.log
```

## Database

```sh
yarn db:push       # push schema changes (dev / safe for SQLite)
yarn db:generate   # generate a migration file
yarn db:migrate    # run migration files (use in CI / production)
yarn db:studio     # open Drizzle Studio in the browser
```

## Building & previewing

```sh
yarn build         # outputs to ./build/
PORT=7010 node build/index.js   # run the production build locally
```

## Tests

```sh
yarn test          # run all tests (server + browser)
yarn test:unit     # server-side unit tests only (no browser needed)
```

Server-side tests live in `src/**/*.test.ts`. Browser/component tests live in `src/**/*.svelte.test.ts`.

## Deploying (Windows)

Run `deploy.ps1` from PowerShell in the project root:

```powershell
.\deploy.ps1
```

The script:
1. Kills any process listening on port 7200
2. `git pull`
3. `yarn install --frozen-lockfile`
4. `yarn db:push` (applies schema changes to the SQLite file)
5. `yarn build`
6. Starts `node build/index.js` on port 7200 in a hidden background window

Server logs land in `logs/server.log` and `logs/server.error.log`.

## Project structure

```
src/
├── lib/
│   ├── api.ts              # typed fetch helper (post/patch/put/del)
│   ├── constants.ts        # shared client+server constants
│   ├── types.ts            # shared TypeScript types
│   ├── components/
│   │   ├── BookmarkEditForm.svelte
│   │   ├── BookmarkFolder.svelte
│   │   ├── BookmarkItem.svelte
│   │   ├── Clock.svelte
│   │   ├── NavDrawer.svelte
│   │   ├── NoteEditor.svelte
│   │   ├── NotesPanel.svelte
│   │   ├── ReminderModal.svelte
│   │   └── TodoList.svelte
│   └── server/
│       ├── constants.ts    # server-only constants (DB singleton keys, etc.)
│       ├── git.ts          # git diff parser (parseDiff, getUntrackedDiffs)
│       └── db/
│           ├── index.ts    # Drizzle client
│           └── schema.ts   # table definitions
└── routes/
    ├── +layout.svelte      # global CSS tokens (theme vars live here)
    ├── +page.svelte        # Dashboard
    ├── bookmarks/          # Bookmarks page
    ├── diff/               # Git diff viewer
    └── api/                # REST endpoints (todos, notes, bookmarks, diff projects, reminder)
```

## Theming

All color tokens are CSS custom properties defined in `:global(:root)` inside `src/routes/+layout.svelte`. Change them there to retheme the whole app:

```css
--bg, --bg-2              /* page backgrounds */
--surface, --surface-2    /* card / panel surfaces */
--border, --border-2      /* borders */
--accent                  /* primary red (#ef4444) */
--accent-muted, --accent-bg
--text, --text-2          /* near-white primary + secondary text */
--text-muted, --text-dim, --text-ghost, --text-faint
```
