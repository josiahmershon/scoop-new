# Scoop Architecture

> Last updated: 2026-03-27

## Overview

Scoop is Blue Bell Creameries' internal AI assistant. It runs entirely on-premise — no data leaves the building.

```
┌─────────────┐     ┌──────────────────┐     ┌─────────────────┐
│   Browser    │────▶│   Next.js :3000   │────▶│  vLLM :8000     │
│  (employee)  │◀────│   (App Router)    │◀────│  Qwen 3.5 MoE   │
└─────────────┘     └────────┬─────────┘     └─────────────────┘
                             │                        │
                    ┌────────┴─────────┐     ┌───────┴──────────┐
                    │   SQLite (DB)    │     │  Tool Calls       │
                    │  conversations   │     │  ┌─────────────┐  │
                    │  messages        │     │  │ Dify :8085   │  │
                    │  per-user        │     │  │ KB Search    │  │
                    └──────────────────┘     │  │ IT Tickets   │  │
                                            │  └─────────────┘  │
                    ┌──────────────────┐     └──────────────────┘
                    │  Active Directory│
                    │  LDAPS :636      │
                    │  BBC-08-DC       │
                    │  BBC-09-DC       │
                    └──────────────────┘
```

## Request Flow

1. Employee opens `http://10.100.175.63:3000` (eventually `scoop.bluebell.com`)
2. next-auth checks session — redirects to `/login` if unauthenticated
3. User enters Blue Bell network credentials
4. Next.js binds to AD via LDAPS, verifies password, pulls user attributes
5. JWT session created with user ID, name, email, role, AD groups
6. User sends a message in the chat UI
7. API route reads session, loads conversation history from SQLite
8. Message + history sent to vLLM (Qwen 3.5) with tool definitions
9. If vLLM returns tool calls → execute tools → feed results back → loop
10. Final text response streamed to browser via SSE
11. Response saved to SQLite, conversation title generated in background

## Components

### Next.js Frontend (`/fastpool/scoop-frontend/`)

| Layer | Detail |
|-------|--------|
| Framework | Next.js 14, App Router, TypeScript |
| Styling | Tailwind CSS 3 |
| Auth | next-auth v5 (Auth.js) with LDAP credentials provider |
| State | React hooks (`useChat` for SSE streaming) |
| Database | SQLite via better-sqlite3 (WAL mode) |
| Markdown | react-markdown for assistant responses |

### vLLM (LLM Inference)

| Detail | Value |
|--------|-------|
| Container | `vllm` (Docker, `vllm/vllm-openai:latest`) |
| Model | `Qwen/Qwen3.5-35B-A3B-GPTQ-Int4` |
| Version | 0.17.1 |
| Port | 8000 (OpenAI-compatible API) |
| GPU | NVIDIA A6000, 48GB VRAM |
| GPU utilization | 0.95 |
| Context length | 65,536 tokens |
| Quantization | GPTQ Marlin |
| Tool calling | `--enable-auto-tool-choice --tool-call-parser qwen3_coder` |
| Thinking | Disabled (`enable_thinking: false`), output stripped in `agent.ts` |

### Dify (Workflow Engine)

| Detail | Value |
|--------|-------|
| Version | 1.13.0 |
| Port | 8085 (via nginx) |
| Role | Hosts workflows that the agent calls as tools |
| Network | `docker_default` |

Active workflows:
- **Knowledge Base Search** — takes a `query` string, retrieves from indexed docs using BGE embeddings, returns matched chunks
- **IT Ticket Creation** — (planned) takes issue/system/urgency, calls SysAid API

### Active Directory

| Detail | Value |
|--------|-------|
| Primary DC | BBC-08-DC.bluebell.com (10.100.1.1) |
| Failover DC | BBC-09-DC.bluebell.com (10.100.1.3) |
| Protocol | LDAPS (port 636) |
| Base DN | DC=bluebell,DC=com |
| Service account | BLUEBELL\scoopai |
| CA cert | `/fastpool/scoop-frontend/certs/bluebell-ca.pem` |

## Authentication

### Flow

1. User submits username + password on `/login`
2. next-auth credentials provider triggers LDAP auth
3. Service account binds to AD → searches for user by `sAMAccountName`
4. If found, binds as the user to verify password
5. On success, pulls `displayName`, `mail`, `memberOf`
6. JWT created with user ID (`bb-{sAMAccountName}`), role, groups

### Role Mapping

| AD Group Pattern | Scoop Role | Access Level |
|-----------------|-----------|-------------|
| `*it-staff*` or `*it staff*` | `it_admin` | Everything + admin |
| `*officemgr*` or `*office manager*` | `office_manager` | RSR content + Sequence Lists, APEX, TCOM |
| `*sales-rep*` or `*sales rep*` | `sales_rep` | Incentives, customer data, pricing |
| `*rsr*` | `rsr` | Sales KB, truck loading, invoices, UPC docs |
| (default) | `general` | General KB, HR policies |

> Note: Role-based access control is not yet enforced — roles are stored in the session for future use.

## Agent Architecture

The agent loop lives in `src/lib/agent.ts`:

```
User message
    ↓
Add system prompt + conversation history
    ↓
Call vLLM (non-streaming, with tools)
    ↓
┌─ Has tool calls? ──────────────────┐
│  YES                                NO
│  ↓                                  ↓
│  Execute tools in parallel     Return text response
│  ↓                              (as SSE stream)
│  Add tool results to messages
│  ↓
│  Loop (max 5 rounds)
└─────────────────────────────────────┘
```

### Tools

Defined in `src/lib/tools.ts`. Each tool maps to a Dify workflow or direct API call.

| Tool | Status | Description |
|------|--------|-------------|
| `search_knowledge_base` | Active | Searches Blue Bell internal docs via Dify KB workflow |
| `create_it_ticket` | Defined, not wired | Will create SysAid tickets via Dify workflow |

### System Prompt

The agent's personality and behavior is defined in the system prompt in `agent.ts`. Key instructions:
- Search KB before answering Blue Bell-specific questions
- Gather details before creating tickets
- Be conversational, concise, warm, and professional
- Never expose internal reasoning/thinking

## Database

SQLite file at `/fastpool/scoop-frontend/scoop.db` (WAL mode, foreign keys enabled).

### Schema

```sql
conversations (
  id          TEXT PRIMARY KEY,
  user_id     TEXT NOT NULL,        -- bb-{sAMAccountName}
  title       TEXT DEFAULT 'New chat',
  created_at  TEXT DEFAULT datetime('now'),
  updated_at  TEXT DEFAULT datetime('now')
)

messages (
  id              TEXT PRIMARY KEY,
  conversation_id TEXT NOT NULL REFERENCES conversations(id),
  role            TEXT NOT NULL,    -- user, assistant, tool
  content         TEXT NOT NULL,
  tool_calls      TEXT,             -- JSON string of tool calls
  tool_call_id    TEXT,             -- for tool result messages
  created_at      TEXT DEFAULT datetime('now')
)
```

Indexes: `idx_messages_conversation`, `idx_conversations_user`

## Key Files

```
src/
├── app/
│   ├── api/
│   │   ├── auth/[...nextauth]/route.ts  — next-auth handler
│   │   └── chat/
│   │       ├── message/route.ts         — main chat endpoint (SSE)
│   │       ├── conversations/route.ts   — list/load/delete conversations
│   │       └── feedback/route.ts        — message feedback (placeholder)
│   ├── login/page.tsx                   — login page
│   └── page.tsx                         — main chat UI (protected)
├── components/
│   ├── auth/SessionProvider.tsx          — next-auth session wrapper
│   └── chat/
│       ├── ChatInput.tsx                — message input with auto-resize
│       ├── ChatMessage.tsx              — message bubble with markdown
│       ├── ChatThread.tsx               — message list + welcome screen
│       └── ConversationSidebar.tsx      — conversation list (polls every 5s)
├── hooks/
│   └── useChat.ts                       — SSE streaming + state management
└── lib/
    ├── agent.ts                         — agent loop, system prompt, thinking strip
    ├── auth.ts                          — next-auth config, LDAP auth, role mapping
    ├── db.ts                            — SQLite operations
    ├── tools.ts                         — tool definitions + executors
    ├── utils.ts                         — cn() helper
    └── vllm.ts                          — vLLM API client
```

## Environment Variables

All in `.env.local` (never committed):

| Variable | Purpose |
|----------|---------|
| `VLLM_API_URL` | vLLM OpenAI-compatible endpoint |
| `VLLM_MODEL` | Model ID for vLLM |
| `DIFY_API_URL` | Dify API base URL |
| `DIFY_KB_WORKFLOW_KEY` | API key for KB search workflow |
| `DIFY_TICKET_WORKFLOW_KEY` | API key for ticket creation workflow (not yet set) |
| `LDAP_HOST_PRIMARY` | Primary AD domain controller |
| `LDAP_HOST_FAILOVER` | Failover AD domain controller |
| `LDAP_PORT` | LDAPS port (636) |
| `LDAP_BASE_DN` | AD base DN for user searches |
| `LDAP_BIND_DN` | Service account DN |
| `LDAP_BIND_PASSWORD` | Service account password |
| `LDAP_CA_CERT_PATH` | Path to CA cert PEM file |
| `AUTH_SECRET` | next-auth JWT signing secret |
| `NEXTAUTH_URL` | App URL for next-auth |
| `AUTH_TRUST_HOST` | Trust proxy headers |

## Infrastructure

| Resource | Location |
|----------|----------|
| Server | bbc-llm (10.100.175.63) |
| OS | Ubuntu 24.04.3 LTS |
| GPU | NVIDIA A6000 (48GB) |
| Project | `/fastpool/scoop-frontend/` |
| Models | `/bigpool/models/` (read-only mount) |
| HF Cache | `/bigpool/hfcache/` |
| GitHub | https://github.com/josiahmershon/scoop-new.git |

## Known Issues

- **DNS resets on reboot** — internal DNS (10.100.1.1/10.100.1.3) configured via `resolvectl` but doesn't persist. Netplan update needs physical access.
- **Sidebar title delay** — smart titles generated async, sidebar polls every 5s to pick them up.
- **No true streaming** — agent response comes as a single chunk, not token-by-token. Would need streaming tool-call detection to fix.
- **Gemini Embedding 2** — returned empty results in Dify. Fell back to BGE embeddings. Needs investigation.
- **ldapjs deprecated** — works fine but the library is no longer maintained. May need to switch to `ldapts` eventually.
