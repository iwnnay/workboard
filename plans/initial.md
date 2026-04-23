# Focused Todo Application

## Overview
A distraction-free todo/notes application with a clean, minimal UI. Tracks tasks with subtasks, notes with inline editing, and shows multiple timezones.

## Core Features

### 1. Tasks (TodoList)
- Add/complete tasks via checkbox
- Tasks can have subtasks (expandable)
- Task text is editable via double-click → inline edit mode
- On blur/Enter, task name updates to DB
- PATCH /api/todos/:id supports both completed and title updates

### 2. Notes (NotesAside + NoteModal)
- Notes stored in SQLite via Drizzle ORM
- Multiple notes can be open simultaneously
- Single note: centered on page (max 700px)
- Multiple notes: horizontally split, stretch to fill available space
- Shroud covers left side of screen (click to close all)
- Autosave to frontend every 1 second while typing
- Save to DB on note close or close-all
- New notes get ID after first save
- "Open last group" button at bottom of notes list

### 3. Layout
- 3-column grid: left (empty), center (clocks + todos), right (notes sidebar 280px)
- Notes sidebar has reduced right padding (0.5rem)

### 4. Timezone Clocks
- Central Time and Eastern Time displays

## Key Files

```
src/
├── lib/
│   ├── components/
│   │   ├── TodoList.svelte      # Task list with subtasks
│   │   ├── NoteModal.svelte     # Note editor (embedded + modal modes)
│   │   ├── NotesAside.svelte    # Notes index + multi-note editor group
│   │   ├── Clock.svelte        # Timezone clock
│   │   ├── CalendarAside.svelte
│   │   └── +layout.svelte
│   └── server/db/
│       └── schema.ts           # Drizzle schema (tasks, subtasks, notes)
├── routes/
│   ├── api/todos/
│   │   ├── +server.ts         # GET, POST
│   │   └── [id]/+server.ts     # PATCH (title + completed), DELETE
│   ├── api/notes/
│   │   ├── +server.ts          # GET, POST
│   │   └── [id]/+server.ts    # GET, PUT, DELETE
│   └── +page.svelte            # Main dashboard
└── routes/+layout.svelte      # Grid layout
```

## Database Schema (Drizzle/SQLite)

- `tasks`: id, title, completed, priority, createdAt, updatedAt
- `subtasks`: id, taskId, title, completed
- `notes`: id, title, content, order, createdAt, updatedAt

## API Endpoints

- `GET/POST /api/todos`
- `PATCH/DELETE /api/todos/:id` - accepts {completed} or {title}
- `GET/POST /api/notes`
- `GET/PUT/DELETE /api/notes/:id`
- `POST /api/notes/order` - reorder notes

## Technical Stack

- SvelteKit with Svelte 5 ($state, $derived, $effect)
- TypeScript
- Drizzle ORM + SQLite
- Vanilla CSS (no Tailwind)
- yarn package manager