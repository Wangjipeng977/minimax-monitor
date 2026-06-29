---
name: minimax-monitor
description: >
  Use when (1) user says "mmx 仪表盘启动" / "mmx monitor" / "MiniMax 配额查询" / "打开 minimax 监控" and wants a real-time dashboard.
  (2) user wants to check how much of their MiniMax Token Plan quota is left (4h / 24h / weekly windows for M3 / M2.7 / video / music / image models).
  (3) user wants to test MiniMax inference latency (TTFT / P50 / burst) by clicking "开始速率测试" - explicitly opt-in, NOT background.
license: MIT
metadata:
  version: "1.6.2"
  category: dev-tools
  author: wangjipeng
  sources:
    - https://github.com/MiniMax-AI/skills
version: 1.6.1
permissions:
  - read:filesystem       # ~/.mmx/config.json
  - write:filesystem      # history.jsonl (24h ring buffer, 本技能目录)
  - read:env               # MINIMAX_API_KEY
  - network:outbound       # api.minimaxi.com / www.minimaxi.com
  - shell:exec             # 'open' 命令启动浏览器
---

# MiniMax 套餐监控 + 速率测试中心

> **触发词**:mmx 仪表盘启动
> 当前版本:v1.6.1
>
> **两个职责**:(1)实时配额查询(默认运行,60s 轮询 token_plan);(2)**按需速率测试**(用户点 "开始速率测试" 按钮才发起 5 次 chat completion,消耗约 180 token)。

## 更新日志

### v1.6.1(2026-06-29,hotfix)

- 🐛 **`/api/load_cred` 响应不再返回 API key**(v1.6.0 注释与实现矛盾的真 bug)。改为只回 `keyLength` + `keyPrefix`。前端 key 输入改用 `getMmxKey()` 直接读本地或用户粘贴。
- 🐛 **`/api/load_cred` 拒绝空 Referer**。强制要求 `Referer` 是本机白名单之一。
- 📝 **SKILL.md permissions 补 `write:filesystem`**(v1.5.0 引入 `history.jsonl` 但未声明写权限)。
- 🧹 **清理 README 自相矛盾**--所有"自动读 `~/.mmx/config.json`"的旧表述统一改成"按需主动加载"。详见 CHANGELOG.md v1.6.1 段。
- 📝 **SKILL.md Security & Data Flow 段加 v1.6.1 重写 + 操作风险提示**。
- 📝 **披露 `history.jsonl` 持久化**(v1.5.0 引入但未告知用户)。

### v1.5.0(2026-06-25)
- 🆕 **`/api/history` 端点**:server 每次 `fetchQuota` 时把 `(timestamp, usedPct, modelSnapshot)` 追加到 `history.jsonl`,保留最近 24h(自动 trim)。`GET /api/history?hours=24` 返回历史采样,供前端画趋势线。
- 🆕 **主面板响应式高度**:`min(560px, vh-150px)`,小屏笔记本(700-800px 高度)不滚动。JS 调 fitMainH() 写 `--main-h` CSS 变量;main-grid `height: var(--main-h, 560px)` + `max-height: calc(100vh - 150px)` 双闸。
- 🆕 **双语 README**:`README.md`(英文)+ `README_zh.md`(中文)互相跳转。
- 🆕 **`.gitignore` 加 `history.jsonl`**:24h 滚动 buffer 不入 git。
- 🔧 **SKILL.md frontmatter version 同步到 1.5.0**。

### v1.4.0(2026-06-25)
- 🔒 **安全加固**(响应 ClawHub security-audit 13 条 finding):
  - **F5 CORS `*` → 本机白名单**:`Access-Control-Allow-Origin` 从 `*` 改成 `127.0.0.1/localhost/file://` allowlist。恶意网页不再能跨域调本机 server 消耗你的 MiniMax 配额。
  - **F3 header API key 默认拒绝**:server 默认忽略 `X-MMX-API-Key` header,只用本机 `~/.mmx/config.json` 的 key。需要使用 header key 时显式开启 `node mmx-monitor-server.js --allow-header-key`。
  - **F11 凭证读 取明确告知**:启动 banner 列出 "读取 ~/.mmx/config.json" + CORS / header key / probe 状态。
  - **F13 localStorage 默认不加载**:API key 默认每次重启重新输入。加勾选 "记住 24 小时" 后才临时写入 localStorage,过期自动清除。
  - **F4 probe 可关闭**:担心真实 inference 探测消耗配额的话,用 `node mmx-monitor-server.js --no-probe`,`/api/probe` 端点返回 403。
  - **F6/F10 README / SKILL.md 加 Security & Data Flow 章节**(见下文)。

### v1.3.0(2026-06-24)
- 🆙 **识别 `current_interval_status === 3` 的"套餐未启用"场景**:官方 API 在视频额度上会返 status=3 但实际调 API 被拒"用量上限"。这跟真正的"无限额"(语音/音乐/图像)同码,元数据无法区分。后端加 `interval_unlimited: true` 字段,前端模型卡片显示"套餐未启用 · 不可调用"(红字 + 灰底 + bar 灰调),不参与顶部 4h 聚合。
- 🆙 **套餐对比 banner**:检测到 video 未启用时,海螺视频卡片变宽(`grid-column: 1 / -1`)内嵌升级面板,列出三档套餐视频权益(Plus ¥49 不支持 / Max ¥119 3 条/日 + "推荐"标 / Ultra ¥469 5 条/日,数据来源官方订阅页 2026-06-24 截图),含"查看官方套餐"跳转链接。设计思路:与在顶部单独挂 banner 比,升级信息与"不可调用"卡片合一,用户视线从"为什么红了"直接跳到"怎么解锁"。
- 🔧 **端口 9876 → 9877**:避让 minimax-embedding-adapter(监听 127.0.0.1:9876 IPv4)。两个服务撞端口会随机抢答。

### v1.2.0(2026-06-23)
- 🆙 **适配官方 Token Plan 新格式**:官方 `/v1/token_plan/remains` 不再返回 `current_interval_usage_count` / `current_interval_total_count`,改为只返 `*_remaining_percent`(剩余百分比)。Server 把 `used` 推导成"已用%"、`total` 恒 100,前端契约保持不变。
- 🆙 **飞书卡片文案同步**:5小时配额 / 模型明细 / 本周配额全部展示"已用 X% / 剩余 Y%",不再打印"0/100"基数。
- 🐛 **大圆环 dasharray bug**:原代码 `stroke-dasharray="(pct/100*515) 515"` 硬编码 515(= 2πr),但实际路径是半圆(πr ≈ 257.6),导致 pct ≥ 50% 时圆环已填满但数字还显示 60% 多。改用 `pathLength="100"` 归一化,dasharray 直接 `pct 100`。
- 🆙 **stat 数字加 % 后缀**:5小时/本周所有 stat 数字(已用、剩余、总、每周已用、每周总额)都加上 `%`,让单位语义清晰。
- 🆙 **无周限账号识别**:根据官方 `current_weekly_status=3` 判定模型本周无配额上限,前端 stat 与模型卡片、飞书卡片均展示"无周限"字样,不再误显"已用 0% / 100%"。
- 🔧 `buildModels` 增加 `clampPct()` 守卫,防止 `remaining_percent` 越界或缺失。

### v1.1.0(2026-05-02)
- 🆕 **标签页自动刷新**:切换回浏览器标签时,自动触发一次配额和速率数据刷新,不再依赖定时轮询

### v1.0.0(2026-04-26)
- 初始版本,支持配额仪表盘 + 速率探针 + 飞书推送

# MiniMax 套餐监控中心

> **触发词**:mmx 仪表盘启动
> 启动后 **自动用 `open` 命令打开 `http://127.0.0.1:9877/`**(v1.6.0+ 同源访问,避免 file:// 协议 Safari fetch 报错)。

## Security & Data Flow(v1.4.0,v1.6.1 重写)

本技能默认会:

1. **读取本地凭证(按需)**:从 `~/.mmx/config.json` 读取 `api_key`(MiniMax Token Plan key)。**仅在用户主动点击 "加载本地凭证" 按钮时才会读**(`POST /api/load_cred`),server 启动时**不**读。读到的 key 存 server 进程内存,不写盘、不上传,server 重启后清空。
2. **定时调用 MiniMax API**:每 60s 调 `https://www.minimaxi.com/v1/token_plan/remains` 拿配额数据。
3. **写入本地采样数据**:每次 `fetchQuota` 后向 `<skill-dir>/history.jsonl` 追加一行 `(timestamp, usedPct, modelSnapshot)`,保留最近 24h 滚动 buffer,供前端画趋势线。不存凭证、不存个人信息。
4. **速率测试需用户主动触发**:v1.6.0 起,仪表盘速率面板**不再自动**调用 chat completion。点 "开始速率测试" 按钮才会发起 5 次真实 chat 请求(约 180 token 上限),UI 会有红字提示 + 二次确认。

**不会做**:

- 不会把 API key 上传到任何远程(仅本地使用)。
- 不会在 `load_cred` 响应里返回 key(v1.6.1 修复,详见下方 changelog)。
- 不会允许跨源网页调用本机 server(CORS allowlist 限定 `127.0.0.1/localhost/file://`)。
- 不会接受空 Referer 调 `load_cred`(v1.6.1 修复,强制本机页面发起的请求才放行)。
- 不会在后台悄悄消耗你的 chat 配额(v1.6.0 起 probe 改按需触发;不点不动)。

**操作风险提示**(v1.6.1 补充):

- **本地凭证访问**:点击 "加载本地凭证" 按钮会读取 `~/.mmx/config.json` 的 `api_key`,并把 key 存入本机 server 进程内存。任何能访问本机 9877 端口的进程理论上都能在 server 重启后主动加载这个 key(虽然现在 `load_cred` 响应不带 key 了,但 401 检查会先放行)。建议:仅在本机使用本技能,不要把 9877 端口对外暴露。
- **持续出站轮询**:每 60s 一次的 `token_plan/remains` 调用会持续消耗 MiniMax 配额查询额度(Token Plan 套餐内免费)。如果不需要实时面板,可手动 `Ctrl+C` 停 server。
- **本地历史文件**:`history.jsonl` 包含时间序列的用量百分比,**不包含**凭证或个人身份信息;不慎泄漏也只是用量趋势。

**想使用 header 透传 key**(高级用户,需要自负责):`node mmx-monitor-server.js --allow-header-key`

## 技能简介

MiniMax 套餐监控 + 速率测试 中心,两个职责:

1. **套餐监控**(默认运行):每 60s 调官方 token_plan 接口拉配额数据,画圆环 + 模型卡片 + 24h 趋势。
2. **速率测试**(按需):点 "开始速率测试" 按钮 → confirm → 发起 5 次 chat completion 请求,返回 TTFT / P50 / burst / token-s。

**两个职责都需本地凭证**(手动输入 或 点 "加载本地凭证" 从 `~/.mmx/config.json` 读取)。

## 触发词收敛(v1.5.1)

> ClawHub 安全审计 F1/F2:触发词 "查配额" / "打开 minimax 监控" / "minimax 监控" / "minimax 仪表盘" 太泛,普通聊天容易误触本地服务(启动 server + 读 `~/.mmx/config.json` + 发起网络请求)。
>
> **v1.5.1 收敛为单一触发词**:`mmx 仪表盘启动`
>
> 选 `mmx` 前缀是因为:(1)日常聊天几乎不会自然出现 "mmx" 这三个字符,误触率比 "minimax" 还低;(2)作为本技能唯一入口,简短紧凑。

## 文件说明

| 文件 | 说明 |
|------|------|
| `mmx-monitor.html` | 监控页面(前端,单文件 HTML,三栏仪表盘) |
| `mmx-monitor-server.js` | 本地代理服务(Node.js,连接 MiniMax API,端口 9877) |

## 使用方式

### 网页端(实时仪表盘)

1. 启动后端服务(如未运行):
   ```bash
   node ~/.openclaw/workspace/skills/minimax-monitor/mmx-monitor-server.js
   ```
2. 浏览器访问 `http://127.0.0.1:9877/`(同源 fetch,无 CORS 问题;也避免 Safari file:// fetch 报错)

## 环境变量

| 变量 | 说明 |
|------|------|
| `MINIMAX_API_KEY` | MiniMax API Key(Token Plan 类型,优先级低于 `~/.mmx/config.json`,仅当 config.json 缺失时使用) |

## 注意事项

- 后端服务需在页面之前启动，端口 9877（v1.3.0 起避开 9876 的 minimax-embedding-adapter）
- 页面刷新间隔：配额 60s，速率 60s
- API Key 类型必须是 `sk-cp-` 开头（Token Plan）

---

## Modes

### `dashboard` (default)
Real-time token-plan quota monitor. Server polls `https://www.minimaxi.com/v1/token_plan/remains` every 60s after credentials are loaded. Renders ring chart, per-model cards, and 24h trend line. **This is what runs by default when the user says "mmx 仪表盘启动".**

### `probe` (opt-in)
On-demand inference latency test. Triggered **only** by the dashboard button "开始速率测试" — never by timer. Runs 5 chat completions against `api.minimaxi.com/v1/text/chatcompletion_v2` (model `MiniMax-M2.7`, max_tokens=30-60, mix of streaming/non-streaming). Returns TTFT, P50, burst, token/s metrics. **Costs ~180 tokens per click; UI shows red warning + confirm() dialog before firing.**

### `history` (read-only)
Reads `history.jsonl` (24h ring buffer at `<skill-dir>/history.jsonl`) and returns time-series usage samples via `GET /api/history?hours=24`. No writes. Used by the dashboard's trend line widget.

---

## Do not

- ❌ **Do not** auto-read `~/.mmx/config.json` on server startup. The credential is loaded **only** when the user explicitly clicks "加载本地凭证" (v1.6.0+).
- ❌ **Do not** return the API key in any HTTP response body. `POST /api/load_cred` returns `keyLength` + `keyPrefix` only (v1.6.1+).
- ❌ **Do not** accept empty `Referer` on `/api/load_cred`. Curl / CLI calls must include `-H 'Referer: http://127.0.0.1:9877/'` (v1.6.1+).
- ❌ **Do not** run the inference probe in the background or on a timer. Probe is button-only, confirm-required, ~180 token cost per click (v1.6.0+).
- ❌ **Do not** allow cross-origin web pages to reach the local server. CORS allowlist is `127.0.0.1 / localhost / file://` only (v1.4.0+).
- ❌ **Do not** claim "auto-read" in any documentation. The only consistent narrative is "on-demand, user-initiated, in-memory only".

---

## Good vs. Bad Examples

| Scenario | ❌ Bad (v1.5.x and earlier) | ✅ Good (v1.6.1+) |
|----------|---------------------------|------------------|
| Server startup | Reads `~/.mmx/config.json` silently; loads key into memory at boot | Reads nothing; `credLoadedKey = ''`; waits for user click |
| User opens dashboard | Key is already in server, all panels work | All panels show 401; user clicks "加载本地凭证" → confirm → key loads |
| `POST /api/load_cred` response | `{"ok":true, "key":"sk-cp-…real-key-here…"}` | `{"ok":true, "keyLength":125, "keyPrefix":"sk-cp-"}` |
| curl `load_cred` with no headers | `{"ok":true, "key":"…"}` (key leaked) | `403 {"ok":false, "error":"requires Referer from local origin"}` |
| Probe behavior | Background timer fires every 5 min, silently consumes quota | Button only; red warning + confirm() before firing; no background calls |
| README "Configuration" section header | `### mmx Local Config (auto-read, recommended)` | `### mmx Local Config (loaded on demand, v1.6.0+)` |
| Frontend localStorage | Key persisted 24h via "Remember" toggle | No localStorage; user re-pastes key per session |

---

## Quality Bar

A **good** v1.6.1+ deploy of this skill satisfies:

- ✅ Server starts and listens on port 9877 without reading any local credentials (verify with `pgrep -fl mmx-monitor` then `lsof -p <pid> -P -n` shows no `~/.mmx/config.json` open).
- ✅ Empty-Refefer `POST /api/load_cred` returns 403, not 200.
- ✅ Valid-Refefer `POST /api/load_cred` returns 200 with `key` field absent (only `keyLength` + `keyPrefix`).
- ✅ `GET /api/token_plan` returns 401 with `{"error":"API key 未加载…"}` before any user action, and 200 with valid quota data after credential load.
- ✅ `<skill-dir>/history.jsonl` is created on first `token_plan` poll and is mentioned in `SKILL.md` Security section + this file.
- ✅ `SKILL.md` frontmatter `permissions:` lists `write:filesystem` (not just `read:filesystem`).
- ✅ No "auto-read" wording remains in `README.md` / `README_zh.md` / `SKILL.md` after v1.6.1 changes.
- ✅ ClawHub security audit finding count for this skill drops from 13 → ≤ 3 after v1.6.1 publish.

A **bad** deploy:

- ❌ `key` field still in `load_cred` response (regression to v1.6.0 bug).
- ❌ `permissions:` missing `write:filesystem` (regression to v1.5.x).
- ❌ README still says "auto-read" anywhere (audit trigger).
- ❌ Empty-Refefer `load_cred` returns 200 (regression).
