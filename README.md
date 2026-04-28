# MiniMax 套餐监控中心

实时仪表盘，监控 MiniMax API 套餐使用情况，支持配额、速率探针、本周用量追踪。

![Dashboard](https://img.shields.io/badge/Node.js-18%2B-green) ![License](https://img.shields.io/badge/License-MIT-blue)

---

## 功能特性

- 📊 **实时配额仪表盘** — 5小时窗口用量环形图 + 各模型明细
- ⏱️ **重置倒计时** — 自动计算距离窗口重置的剩余时间
- 📈 **API 速率探针** — TTFT、P50、P99、Token 速度实测
- 📅 **本周配额追踪** — 有周限的模型显示本周已用/总额
- 🔔 **飞书推送（可选）** — 查询后推送到飞书群

---

## 快速开始

### 前置要求

- Node.js ≥ 18（运行后端服务）
- Python 3（飞书推送可选）

### 安装

```bash
# 克隆或下载本项目后，进入目录
cd minimax-monitor

# 无需 npm install，纯 Node.js 标准库零依赖
```

### 启动

```bash
# 1. 启动后端服务
node mmx-monitor-server.js

# 2. 打开监控页面（macOS 自动唤起浏览器）
open mmx-monitor.html
# Windows: start mmx-monitor.html
# Linux: xdg-open mmx-monitor.html
```

### 查询配额

页面打开后，点击输入框上方的 **查询** 按钮（API Key 会自动读取本地 mmx 配置），或手动粘贴 Key 后查询。

---

## 配置文件

### 环境变量（飞书推送，可选）

```bash
# 复制模板
cp .env.example .env

# 填写以下变量
MINIMAX_API_KEY=sk-cp-your-key-here      # MiniMax API Key（Token Plan 类型）
FEISHU_APP_ID=your-app-id                 # 飞书应用 App ID
FEISHU_APP_SECRET=your-app-secret        # 飞书应用 App Secret
FEISHU_CHAT_ID=your-chat-id               # 飞书群 ID
```

### mmx 本地配置（自动读取）

后端服务会自动读取 `~/.mmx/config.json` 中的 API Key，无需手动配置。

---

## 文件说明

| 文件 | 说明 |
|------|------|
| `mmx-monitor.html` | 监控页面（纯前端，单文件 HTML） |
| `mmx-monitor-server.js` | 本地代理服务（Node.js，端口 9876） |
| `mmx_quota_feishu.py` | 飞书推送脚本（可选） |
| `README.md` | 本文件 |
| `LICENSE` | MIT 开源协议 |

---

## API 接口

后端提供以下 REST 接口：

| 接口 | 说明 |
|------|------|
| `GET /api/token_plan` | 从 MiniMax 官方获取配额（推荐） |
| `GET /api/quota` | 通过 mmx CLI 获取配额 |
| `GET /api/probe` | 实时 API 延迟探针 |
| `GET /health` | 健康检查 |

---

## 飞书推送（可选）

### 方式一：命令行推送

```bash
python3 mmx_quota_feishu.py <api_key>
```

### 方式二：配合定时任务

设置 cron 定时推送，结合 `.env` 中的飞书配置。

---

## 常见问题

**Q: 点查询后显示"连接失败"？**
A: 请确认后端服务已启动（`node mmx-monitor-server.js`）。服务未运行时前端会提示"请先启动后端服务"。

**Q: 端口 9876 被占用？**
A: 停止占用该端口的进程，或修改 `mmx-monitor-server.js` 中的 `PORT` 常量。

**Q: 飞书推送失败？**
A: 确认 `.env` 中 `FEISHU_APP_ID`、`FEISHU_APP_SECRET`、`FEISHU_CHAT_ID` 均已填写，且飞书机器人已加入目标群。

---

## 开源协议

MIT License - 详见 [LICENSE](LICENSE) 文件。
