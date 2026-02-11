# Single Deployment Runbook

This project should use one shared env source for all server-side code.

## Environment Source

- Use deployment env vars in your platform, or root `.env` for local development.
- Do not depend on `src/ui/.env.local`.

Minimum required vars:

```dotenv
DATABASE_URL=postgresql://...
OPENAI_API_KEY=...
# or ANTHROPIC_API_KEY=...
```

Optional provider overrides:

```dotenv
OPENAI_MODEL=gpt-4o-mini
OPENAI_BASE_URL=https://api.openai.com/v1
ANTHROPIC_MODEL=claude-haiku-4-5
ANTHROPIC_BASE_URL=
```

## Runtime Behavior

- UI server routes (`src/ui/app/api/*`) now auto-select provider:
  - Anthropic if `ANTHROPIC_API_KEY` is set
  - otherwise OpenAI if `OPENAI_API_KEY` is set
  - otherwise fail fast with a clear error

## Notes

- Keep secrets server-side only. Do not expose secrets as `NEXT_PUBLIC_*`.
- `DATABASE_URL` is required by Prisma and backend services.

