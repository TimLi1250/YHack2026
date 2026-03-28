# Frontend Setup

This project includes a React frontend in [`frontend`](./frontend) built with Vite, TypeScript, and Tailwind CSS.

## Prerequisites

- Node.js 18 or newer
- npm

## Install Dependencies

From the repo root:

```bash
cd frontend
npm install
```

This installs the runtime dependencies:

- `react`
- `react-dom`

And the development dependencies used by the app:

- `vite`
- `typescript`
- `@vitejs/plugin-react`
- `@types/react`
- `@types/react-dom`
- `tailwindcss`
- `@tailwindcss/postcss`
- `postcss`
- `autoprefixer`

## Run The Frontend

Start the local development server:

```bash
cd frontend
npm run dev
```

Vite will print a local URL, typically:

```bash
http://localhost:5173
```

## Build For Production

Create a production build:

```bash
cd frontend
npm run build
```

The output is written to [`frontend/dist`](./frontend/dist).

## Preview The Production Build

```bash
cd frontend
npm run preview
```

## Notes

- The main app entry is [`frontend/src/main.tsx`](./frontend/src/main.tsx).
- The homepage component is [`frontend/src/homepage.tsx`](./frontend/src/homepage.tsx).
- If `node_modules` is missing, run `npm install` again inside `frontend`.
