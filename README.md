# MiniMax Package Monitor

[中文版](./README_zh.md)

Real-time dashboard for monitoring MiniMax API package usage — quota tracking, rate probing, weekly usage monitoring, and 24h history.

> **Current Version: v1.5.0** | [Changelog](#changelog) | [Security](#security--data-flow)

![Dashboard](demo.png)

![License](https://img.shields.io/badge/License-MIT-blue)

---

## What's New in v1.5.0

- 🆕 **24h usage history endpoint** (`GET /api/history`) — see how your quota usage trends over the day, persisted in a local ring buffer
- 🆕 **Responsive layout** — main panel auto-shrinks on small viewports (`calc(min(560px, 100vh - 150px))`)
- 🆕 **Bilingual README** — `README.md` (English, this file) + `README_zh.md` (中文)
- 🔒 Hardened CORS, header key policy, and localStorage handling landed in v1.4.0 — see [Security & Data Flow](#security--data-flow)

## Changelog

### v1.5.0 (2026-06-25)
- 🆕 **`/api/history` endpoint** — Server appends a `(timestamp, usedPct, modelSnapshot)` row to `history.jsonl` on every quota fetch, retains last 24h, exposes via `GET /api/history?hours=24`. Frontend can plot trend lines without making its own requests.
- 🆕 **Responsive main panel height** — `min(560px, 100vh - 150px)`. Smaller laptop screens no longer force vertical scroll.
- 🆕 **Bilingual docs** — this file + `README_zh.md` with cross-links.

### v1.4.0 (2026-06-25)
- 🔒 **CORS strict allowlist** — `Access-Control-Allow-Origin: *` replaced by `127.0.0.1 / localhost / file://` allowlist. Malicious web pages can no longer reach the local server.
- 🔒 **Header API key denied by default** — Server ignores `X-MMX-API-Key` request header unless `--allow-header-key` flag is set. Prevents local server from being abused as a credentialed proxy.
- 🔒 **localStorage key not auto-loaded** — API key is no longer automatically reused from `localStorage`. Opt-in "Remember 24h" toggle expires automatically.
- 🔒 **`--no-probe` flag** — Disable `/api/probe` endpoint (returns 403) to avoid real inference calls and token costs.
- 📄 **Security & Data Flow docs** — Listed in SKILL.md / README below.

### v1.3.0 (2026-06-24)
- 🆙 **"Plan not enabled" detection for Video** — Distinguish `current_interval_status=3` for video (plan disabled, calls rejected) from real "unlimited" (voice/music/image).
- 🆙 **Plan comparison banner** — Hailuo Video card embeds a 3-tier upgrade panel (Plus ¥49 / Max ¥119 / Ultra ¥469) when status indicates plan not enabled.
- 🆙 **"No weekly limit" recognition** — `current_weekly_status=3` models show "无周限" instead of misleading "0% / 100%".
- 🐛 **Gauge dasharray fix** — Original code hardcoded `515` (= 2πr) for a half-circle path (πr ≈ 257.6). Switched to `pathLength="100"` for normalized dasharray.
- 🐛 **SSE stream parse fix** — Burst probe switched to `data.trimStart().startsWith('data:')` (was failing on multi-line SSE).
- 🔧 **Port 9876 → 9877** — Avoid collision with `minimax-embedding-adapter`.

### v1.2.0 (2026-06-23)
- 🆙 **Adapt to new official Token Plan format** — `/v1/token_plan/remains` no longer returns `*_usage_count` / `*_total_count`, only `*_remaining_percent`. Server derives `used` from `(100 - remaining)`, frontend contract unchanged.
- 🆙 **Feishu card text sync** — All quota numbers now show "used X% / remain Y%" instead of "0/100" base.

### v1.1.0 (2026-05-02)
- 🆕 **Auto-refresh on tab switch** — Switching back to the browser tab triggers a quota + rate refresh automatically.

### v1.0.0 (2026-04-26)
- Initial release with quota dashboard + rate probe + Feishu notification.

---

## Features

- 📊 **Real-time Quota Dashboard** — 5-hour window usage ring chart + per-model details
- ⏱️ **Reset Countdown** — Auto-calculates remaining time until window reset
- 📈 **API Rate Probe** — TTFT, P50, latency, token speed measurements
- 📅 **Weekly Quota Tracking** — For models with weekly limits
- 📜 **24h Usage History** (v1.5.0) — Trend lines from local `history.jsonl` ring buffer

---

## Quick Start

### Prerequisites

- Node.js ≥ 18 (runs backend service)

### Install

```bash
# Clone or download, then cd into the project
cd minimax-monitor

# No npm install needed — pure Node.js standard library, zero deps
```

### Run

```bash
# 1. Start backend service
node mmx-monitor-server.js

# 2. Open monitoring page (macOS auto-opens browser)
open mmx-monitor.html
# Windows: start mmx-monitor.html
# Linux: xdg-open mmx-monitor.html
```

### Query Quota

After the page loads, click the **Query** button above the input box (API Key auto-reads from `~/.mmx/config.json`), or paste the Key manually and query.

---

## Security & Data Flow (v1.4.0+)

**This service, by default, will**:

1. **Credential loaded on demand** (v1.6.0) — Does **not** auto-read `~/.mmx/config.json` on startup. Dashboard "加载本地凭证" button + confirm triggers `POST /api/load_cred` which reads the file into server process memory (not browser, not disk). Server restart clears it. Endpoints requiring key return 401 until loaded.
2. **Poll MiniMax API every 60s** — Calls `https://www.minimaxi.com/v1/token_plan/remains` for quota data.
3. **Probe inference performance ON DEMAND ONLY** (v1.6.0) — Dashboard button triggers 5 real chat completion requests (×~180 token). Auto timer removed.

**This service will NOT**:

- Auto-read `~/.mmx/config.json` on startup (v1.6.0).
- Persist your API key in browser localStorage (v1.6.0).
- Upload your API key to any remote.
- Allow cross-origin web pages to reach the local server (CORS allowlist limits to `127.0.0.1 / localhost / file://`).

### Startup options

```bash
# Default config (recommended)
node mmx-monitor-server.js

# Allow header API key passthrough (advanced, your responsibility)
node mmx-monitor-server.js --allow-header-key
```

### Browser-side API Key (v1.6.0+)

**No more localStorage 24h persistence.** Each session requires:

- Manually type Key into the input field; or
- Click "加载本地凭证" button (loads from `~/.mmx/config.json` to server process memory)

Both are lost when server restarts.

---

## Configuration

### mmx Local Config (auto-read, recommended)

Backend auto-reads API Key from `~/.mmx/config.json` — no manual config needed.

### Environment Variable (fallback)

If `~/.mmx/config.json` is not present, set this in `.env`:

```bash
# Copy template
cp .env.example .env

MINIMAX_API_KEY=sk-cp-…here           # MiniMax API Key (Token Plan type)
```

---

## File Overview

| File | Description |
|------|-------------|
| `mmx-monitor.html` | Monitoring page (pure frontend, single HTML file) |
| `mmx-monitor-server.js` | Local proxy service (Node.js, port 9877) |
| `history.jsonl` | 24h usage history (v1.5.0+, auto-generated) |
| `CHANGELOG.md` | Full changelog with cross-version links |
| `demo.png` | Screenshot |
| `README.md` | This file (English) |
| `README_zh.md` | Chinese version (中文版) |
| `LICENSE` | MIT License |

---

## API Endpoints

Backend provides the following REST endpoints:

| Endpoint | Description |
|----------|-------------|
| `POST /api/load_cred` | Load API key from `~/.mmx/config.json` (v1.6.0: user clicks button, confirm dialog) |
| `GET /api/token_plan` | Fetch quota from MiniMax official (requires loaded key) |
| `GET /api/probe` | On-demand API latency probe (v1.6.0+: user clicks button, confirm dialog, requires loaded key) |
| `GET /api/history?hours=24` | 24h usage history from local ring buffer (v1.5.0) |
| `GET /health` | Health check |

> `/api/quota` was removed in v1.3.0 (replaced by `/api/token_plan`).

---

## FAQ

**Q: Shows "Connection Failed" after clicking Query?**
A: Make sure the backend service is running (`node mmx-monitor-server.js`). Frontend prompts "Please start the backend service first" when service is down.

**Q: Port 9877 already in use?**
A: Stop the process using that port, or modify the `PORT` constant in `mmx-monitor-server.js`.

---

## License

MIT License — see [LICENSE](LICENSE).
