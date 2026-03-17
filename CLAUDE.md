# CLAUDE.md — Scoop AI Platform

> This is the workspace context file for Claude Code operating on the Blue Bell Creameries AI server (bbc-llm).
> Read this file completely before taking any action.

---

## What Is This Project?

Scoop is Blue Bell Creameries' internal AI assistant platform. It serves 1,000+ employees (RSRs, office managers, sales reps, IT staff) with RAG-powered knowledge retrieval, conversational assistance, and workflow automation.

We are building a **custom Next.js frontend** that:
- Authenticates employees against Blue Bell's on-prem Active Directory (LDAP/LDAPS)
- Provides per-user chat sessions with persistent conversation history
- Proxies all AI requests to a self-hosted Dify backend (never exposes API keys to the browser)
- Streams responses in real time via SSE

The architecture document is at: `/fastpool/scoop-frontend/docs/architecture.docx`
(Copy it there after initial setup — Josiah will provide the file.)

---

## Server Environment

| Detail | Value |
|--------|-------|
| Hostname | bbc-llm |
| OS | Ubuntu 24.04.3 LTS (Noble) |
| GPU | Single NVIDIA A6000 (48GB VRAM) |
| User | josiah |
| Internet | Yes — can pull packages, Docker images, etc. |
| Domain | scoop.bluebell.com (TLS cert already configured) |
| Storage | `/fastpool/` — 861GB total, ~504GB free (ZFS, 2x 1TB NVMe) |
| Storage | `/bigpool/` — ZFS mirror, 2x 4TB NVMe. Model weights, HF cache. |

### Key Filesystem Locations

| Path | Contents |
|------|----------|
| `/fastpool/containers/compose/vllm/` | vLLM Docker Compose — serves the LLM |
| `/fastpool/containers/compose/dify/` | Dify full repo clone with Docker deployment in `docker/` subdirectory |
| `/fastpool/containers/compose/dify/docker/` | Dify's `docker-compose.yaml`, `.env`, volumes, etc. |
| `/fastpool/containers/compose/openwebui/` | **DEPRECATED** — old OpenWebUI setup, no longer in use. Do not modify. |
| `/fastpool/containers/compose/openwebui/nginx/` | Contains `scoop.conf` — TLS reverse proxy config for scoop.bluebell.com |
| `/fastpool/containers/compose/openwebui/certs/` | TLS cert + key for scoop.bluebell.com |
| `/bigpool/models/` | Model weights storage (read-only mount into vLLM) |
| `/bigpool/hfcache/` | Hugging Face cache directory |

### This Project Lives At

```
/fastpool/scoop-frontend/
```

This is the Next.js application root. All project work happens here.

---

## Running Services

### vLLM (LLM Inference Server)

- **Compose file:** `/fastpool/containers/compose/vllm/compose.yml`
- **Container name:** `vllm`
- **Port:** 8000 (OpenAI-compatible API)
- **Docker network:** `llmnet` (external)
- **Model:** `Qwen/Qwen3.5-35B-A3B-GPTQ-Int4`
- **Quantization:** gptq_marlin
- **Context length:** 65536
- **GPU memory utilization:** 0.95
- **Thinking mode:** disabled (`enable_thinking: false`)
- **vLLM version:** 0.17.1

### Dify (AI Orchestration Platform)

- **Compose dir:** `/fastpool/containers/compose/dify/docker/`
- **Version:** 1.13.0
- **Exposed port:** 8085 (nginx → internal API on port 5001)
- **HTTPS port:** 8443
- **Docker network:** `docker_default`, `docker_ssrf_proxy_network`
- **Embedding model:** Gemini Embedding 2 (`gemini-embedding-2-preview`) via Gemini API
- **Admin panel:** http://10.100.175.63:8085

### NGINX Reverse Proxy (scoop-proxy)

- **Container name:** `scoop-proxy`
- **Image:** `nginx:1.27-alpine`
- **Ports:** 80 (HTTP → 301 redirect to HTTPS), 443 (TLS termination)
- **Config file:** `/fastpool/containers/compose/openwebui/nginx/scoop.conf`
- **TLS cert:** `/fastpool/containers/compose/openwebui/certs/scoop.bluebell.com.crt`
- **TLS key:** `/fastpool/containers/compose/openwebui/certs/scoop.bluebell.com.key`
- **Currently proxies to:** `http://10.100.175.63:8085` (Dify)
- **Will proxy to:** The Next.js app on port 3000 once built

**Note on NGINX migration:** Josiah prefers a dedicated NGINX instance for Scoop (option 1 — move config into the scoop-frontend project with its own container). The current scoop-proxy container lives in the openwebui compose stack.

### DNS (Pending)

- `scoop.bluebell.com` A record points to `10.100.175.63` on internal DNS server
- **Problem:** This server's DNS resolvers are `8.8.8.8` / `1.1.1.1` (public), so it doesn't resolve internally
- **Status:** Waiting on IT for the internal DNS server IP to configure on this machine
- Workaround: `/etc/hosts` entry can be added

---

## Tech Stack for the Frontend

| Layer | Technology |
|-------|-----------|
| Framework | Next.js 14+ (App Router) |
| UI | React 18+, Tailwind CSS, shadcn/ui |
| Auth | next-auth v5 (Auth.js) — LDAP credentials provider (primary); Azure AD can be added later |
| State | React Context + useReducer for chat; SWR for data fetching |
| Markdown | react-markdown with rehype plugins |
| User store | SQLite for MVP (migrate to PostgreSQL later) |
| Deployment | Docker container on this server, behind NGINX reverse proxy |

### Node.js

Node.js is **not yet installed** on this server. Install it before starting:

```bash
curl -fsSL https://deb.nodesource.com/setup_20.x | bash -
apt-get install -y nodejs
node -v && npm -v
```

---

## Architecture Summary

```
Browser → NGINX (TLS, :443) → Next.js (:3000) → Dify API (:8085) → vLLM (:8000)
                                     ↓
                              next-auth (LDAP)
                                     ↓
                              API Routes (auth middleware)
                                     ↓
                              Dify /v1/chat-messages
                                     ↓
                              Gemini Embedding 2 vector store
                                     ↓
                              vLLM (Qwen 3.5 on :8000)
```

### Request Flow

1. Employee hits scoop.bluebell.com
2. NGINX terminates TLS, proxies to Next.js on port 3000
3. next-auth handles login (LDAP bind against on-prem AD)
4. Authenticated requests hit Next.js API routes
5. API routes validate JWT session, map AD username → Dify user ID
6. API routes call Dify's conversation API with the user's message
7. Dify runs RAG retrieval (Gemini Embedding 2 vectors) + LLM inference (via vLLM)
8. Response streams back through SSE → API route → browser

---

## Authentication Details

### On-Prem Active Directory (LDAP) — Primary

- Blue Bell's AD is on-prem. The M365/Azure AD migration is not yet complete, so do NOT assume Azure AD is available.
- Authentication is a **credentials-based login** → LDAPS bind (port 636) against the on-prem domain controller
- On successful bind, query LDAP for user attributes (display name, email, group memberships)
- Create a JWT session with these attributes
- Josiah will provide: LDAP URL, base DN, service account credentials

### Azure AD / Entra ID — Future

- Once Blue Bell's M365 migration completes, Azure AD SSO can be added as an additional provider
- The auth system should be designed so adding an OAuth/OIDC provider later is straightforward (next-auth makes this easy)
- For now, do NOT implement Azure AD — LDAP only

### Role Mapping

AD group memberships map to Scoop roles:

| AD Group | Scoop Role | Access Level |
|----------|-----------|-------------|
| BB-Sales-RSR | RSR | Sales KB, truck loading, invoices, UPC docs |
| BB-Sales-OfficeMgr | Office Manager | RSR content + Sequence Lists, APEX, TCOM |
| BB-Sales-Rep | Sales Rep | Incentives, customer data, pricing |
| BB-IT-Staff | IT Admin | Everything + admin panel |
| (default) | General | General KB, HR policies |

**Note:** These AD groups may not exist yet. Josiah will confirm which groups exist and whether new ones need to be created.

---

## Dify API Integration

### Key Endpoints to Use

The Next.js API proxy calls Dify's Conversation API:

- `POST /v1/chat-messages` — send message, get streaming response
- `GET /v1/conversations` — list conversations for a user
- `GET /v1/messages` — get message history for a conversation
- `DELETE /v1/conversations/{id}` — delete a conversation

All calls require:
- `Authorization: Bearer {DIFY_API_KEY}` header
- `user` parameter (format: `bb-{sAMAccountName}`)

### API Base URL

From the Next.js container, the Dify API is reachable at: `http://10.100.175.63:8085/v1`

### Streaming

Dify supports SSE streaming via `response_mode: "streaming"`. The Next.js API route must forward the SSE stream to the browser without buffering. Use a ReadableStream in the Route Handler.

---

## Knowledge Base

### Current Status

The first knowledge base document is ready for ingestion: John Gibbs' UPC transition operational guide. It covers the complete UPC transition, product categories (Legacy/Featured Flavor/Standard Flavor), RSR and office manager procedures, APEX navigation, handheld setup, troubleshooting FAQ, and contact directory.

### Embedding Model

Using **Gemini Embedding 2** (`gemini-embedding-2-preview`) via the Gemini API. This is configured in Dify's knowledge base settings, not in the Next.js app. The frontend does not interact with embeddings directly.

---

## Environment Variables

The Next.js app needs these in `.env.local` (NEVER commit this file):

```env
# LDAP (Active Directory)
LDAP_URL=                    # e.g., ldaps://dc.bluebell.local:636
LDAP_BASE_DN=                # Josiah will provide
LDAP_BIND_DN=                # Service account DN
LDAP_BIND_PASSWORD=          # Service account password

# Dify
DIFY_API_URL=http://10.100.175.63:8085/v1
DIFY_API_KEY=                # Get from Dify admin panel → App → API Keys

# Database
DATABASE_URL=file:./scoop.db  # SQLite for MVP

# NextAuth
NEXTAUTH_SECRET=             # Generate: openssl rand -base64 32
NEXTAUTH_URL=https://scoop.bluebell.com
```

---

## Project Structure (Target)

```
/fastpool/scoop-frontend/
├── CLAUDE.md                    # This file
├── .env.local                   # Secrets (never commit)
├── .gitignore
├── package.json
├── next.config.js
├── tailwind.config.js
├── tsconfig.json
├── prisma/                      # If using Prisma for SQLite/Postgres
│   └── schema.prisma
├── src/
│   ├── app/
│   │   ├── layout.tsx           # Root layout with auth provider
│   │   ├── page.tsx             # Main chat interface (protected)
│   │   ├── login/
│   │   │   └── page.tsx         # Login page (LDAP credentials)
│   │   ├── chat/
│   │   │   └── [id]/
│   │   │       └── page.tsx     # Individual conversation view
│   │   ├── admin/
│   │   │   ├── page.tsx         # Admin dashboard (IT only)
│   │   │   └── kb/
│   │   │       └── page.tsx     # KB management (IT only)
│   │   └── api/
│   │       ├── auth/
│   │       │   └── [...nextauth]/
│   │       │       └── route.ts # next-auth route handler
│   │       ├── chat/
│   │       │   ├── message/
│   │       │   │   └── route.ts # POST — send message to Dify (SSE stream)
│   │       │   ├── conversations/
│   │       │   │   └── route.ts # GET — list conversations; POST — new conversation
│   │       │   └── feedback/
│   │       │       └── route.ts # POST — thumbs up/down
│   │       └── user/
│   │           └── profile/
│   │               └── route.ts # GET — user profile + role
│   ├── components/
│   │   ├── chat/
│   │   │   ├── ChatInput.tsx
│   │   │   ├── ChatMessage.tsx
│   │   │   ├── ChatThread.tsx
│   │   │   └── ConversationSidebar.tsx
│   │   ├── auth/
│   │   │   └── LoginForm.tsx
│   │   ├── layout/
│   │   │   ├── Header.tsx
│   │   │   └── Sidebar.tsx
│   │   └── ui/                  # shadcn/ui components
│   ├── lib/
│   │   ├── auth.ts              # next-auth config (LDAP provider)
│   │   ├── dify.ts              # Dify API client (server-side only)
│   │   ├── db.ts                # Database client (Prisma or raw SQLite)
│   │   └── utils.ts
│   ├── hooks/
│   │   └── useChat.ts           # SSE streaming hook
│   └── types/
│       └── index.ts
├── docker/
│   ├── Dockerfile
│   ├── compose.yml              # Next.js + NGINX containers
│   └── nginx/
│       └── scoop.conf           # TLS proxy config (migrated from openwebui)
└── docs/
    └── architecture.docx
```

---

## Development Workflow

### First-Time Setup

```bash
# 1. Install Node.js (if not already done)
curl -fsSL https://deb.nodesource.com/setup_20.x | bash -
apt-get install -y nodejs

# 2. Navigate to project directory
cd /fastpool/scoop-frontend

# 3. Initialize Next.js project
npx create-next-app@latest . --typescript --tailwind --app --src-dir --eslint

# 4. Install dependencies
npm install next-auth@beta @auth/core
npm install swr react-markdown rehype-raw rehype-sanitize
npm install better-sqlite3          # For MVP user store
npm install ldapjs                  # For LDAP auth
npm install -D @types/better-sqlite3 @types/ldapjs

# 5. Set up shadcn/ui
npx shadcn-ui@latest init

# 6. Create .env.local with placeholder values (see Environment Variables section)

# 7. Generate NEXTAUTH_SECRET
openssl rand -base64 32
```

### Running in Development

```bash
cd /fastpool/scoop-frontend
npm run dev -- -p 3000
```

Access at: http://localhost:3000 (or via scoop.bluebell.com once DNS + NGINX are pointed here)

### Docker Deployment (Production)

Build and run via the compose file in `docker/compose.yml`. The Dockerfile should:
1. Multi-stage build (deps → build → production)
2. Run `next build` for optimized production bundle
3. Expose port 3000
4. Use `node server.js` (Next.js standalone output)

Set `output: 'standalone'` in `next.config.js` for Docker builds.

---

## Conventions & Rules

- **TypeScript everywhere** — no plain JS files
- **App Router only** — no Pages Router
- **Server Components by default** — only use `'use client'` when you need interactivity
- **All Dify communication is server-side** — API keys never reach the browser
- **Stream responses** — never buffer full responses before sending to client
- **Minimal dependencies** — don't add packages without a clear reason
- **Environment variables** — all secrets in `.env.local`, all public config in `next.config.js`
- **Error handling** — every API route has try/catch with meaningful error responses
- **No hardcoded URLs** — use environment variables for all service endpoints
- **Git** — commit after each meaningful change with clear messages; never commit `.env.local`

---

## Docker Networking

The Next.js app needs to reach:
- **Dify API** on `docker_default` network (or via host IP `10.100.175.63:8085`)
- **vLLM** on `llmnet` network (or via host IP `10.100.175.63:8000`) — though typically Dify handles LLM calls, not the frontend

For simplicity, the Next.js container can use `network_mode: host` or connect to both networks. Using the host IP (`10.100.175.63`) for Dify API calls is the simplest approach.

---

## Version Control

This project uses **Git**. Initialize a repo in `/fastpool/scoop-frontend/` and commit regularly.

- Commit after each meaningful change or feature
- Write clear commit messages describing what changed and why
- `.env.local` must be in `.gitignore` — never commit secrets
- If a remote origin is set up later, Josiah will provide the URL

---

## Guardrails

- Don't modify system-level config (networking, firewall, SSH, cron) without asking Josiah
- Don't delete data in `/bigpool/` — that's model storage
- When modifying Dify or vLLM compose files, make sure you understand what's running before restarting services
- Everything else on this server is fair game — use your judgment

---

## Contact

- **Josiah Mershon** — IT/AI Specialist, project owner
- **John Gibbs** — Database & Systems (knowledge base content, APEX questions)
