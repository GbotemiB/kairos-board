# Kairos

> _Kairos (καιρός): the right, opportune moment._ Never miss the right moment to apply.

An open-source, community-maintained board of internships, fellowships, and academic programs for master's students. Paste a link, and AI extracts the deadline, eligibility, and details for you.

**Status:** early development. See [PROJECT_PLAN.md](./PROJECT_PLAN.md) for the architecture and roadmap.

## Quick start

Requires Node 22 (`nvm use`).

```bash
npm install
cp .env.example .env.local
npm run dev
```

## Scripts

| Command                | Description          |
| ---------------------- | -------------------- |
| `npm run dev`          | Start the dev server |
| `npm run build`        | Production build     |
| `npm run lint`         | ESLint               |
| `npm run typecheck`    | TypeScript check     |
| `npm run format`       | Format with Prettier |
| `npm run format:check` | Check formatting     |

## License

[MIT](./LICENSE)
