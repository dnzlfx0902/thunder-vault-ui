# Thunder — local UI for a Markdown vault

A private, self-hosted workspace for a plain-Markdown knowledge vault. Notes stay as
`.md` files on your disk; the app only reads, and every write requires an explicit
approval.

Built with **Next.js 16 (App Router)**, **React 19**, **TypeScript** in strict mode and
**Tailwind CSS 4**. No database: the vault *is* the source of truth.

## What it does

- **Three-pane workspace** — folder tree, Markdown editor/preview and a context-aware chat
  panel, all rendered from the vault on disk.
- **Inbox mode** — every message in the main chat is treated as an idea to be captured: the
  assistant proposes a new note in the right folder (`00 Inbox`, `10 Projects`, `20 Areas`,
  `30 Resources`, `50 Decisions`) with frontmatter already filled in.
- **Edit mode** — inside a note, the assistant may only *add*: `==highlights==` and
  `> [!note]` blocks. Deleting existing text is rejected by design.
- **Proposal-only writes** — the model never touches the filesystem. It returns a fenced
  `thunder-changes` JSON array, the UI shows the diff, and you approve or discard. Approved
  writes are backed up under `.thunder-backups/` inside the vault.
- **Ingestion** — import a URL, a file or a folder into the vault; PDFs are parsed in the
  browser with `pdfjs-dist` and attached to the note as source material.
- **Chats with scope** — five recent main-chat tabs plus per-note conversations, each
  persisted atomically (write to temp, then rename).
- **Wikilinks and search** — `[[Note|alias]]` resolution and a knowledge index over the vault.

## Security model

| Concern | Handling |
|---|---|
| Access | Password login, HMAC-SHA256 signed cookie with a 24 h expiry, `timingSafeEqual` comparison |
| Prompt injection via shell | Prompts reach the backend **only through stdin** — a message like `danger; rm -rf /` is data, never an argument |
| Path traversal | Every path is resolved and checked against `VAULT_ROOT` before any read or write |
| Writes | Proposal → diff → explicit confirmation → backup → write |
| Rate limits | Per-route request budgets and a 64 KB body cap on API routes |
| Rendering | `react-markdown` + `rehype-sanitize`; no raw HTML from notes |

## Run it locally

```bash
cp .env.example .env.local
npm install --ignore-scripts
npm run dev
```

`.env.local` needs:

```ini
VAULT_ROOT=/absolute/path/to/your/vault
APP_PASSWORD=choose-a-password
HERMES_COMMAND=hermes      # optional: any CLI that answers on stdin/stdout
APP_DATA_DIR=./.data       # where chats and import state live
```

Open <http://localhost:3000>.

## Quality gates

```bash
npm run lint        # ESLint 9 (flat config)
npm run typecheck   # tsc --noEmit
npm test            # Vitest: auth, chats, ingestion, knowledge, proposals, rate limit, vault
npm run test:e2e    # Playwright, with mocked model and PDF backends
```

## Layout

```text
src/app/            routes + API handlers (vault, note, proposals, chat, import, pdf…)
src/components/     workspace shell, PDF viewer, icons
src/lib/            vault I/O, auth, chats, ingestion, knowledge index, proposals, rate limit
e2e/                Playwright suite and mock backends
test-vault/         sample vault used by the tests
```

## License

MIT — see [LICENSE](LICENSE).
