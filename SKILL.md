---
name: minimax-monitor
description: MiniMax 套餐监控中心。触发词：查配额、监控中心、minimax监控。
---

# MiniMax 套餐监控中心

> **触发词**：查配额 / 打开配额监控 / 启动 MiniMax 监控
> 启动后 **自动用 `open` 命令打开 HTML 页面**（macOS 直接唤起浏览器），无需手动拖入。

## 技能简介

MiniMax API 套餐使用情况实时监控，支持**网页端**和**飞书端**两种查询方式。

## 文件说明

| 文件 | 说明 |
|------|------|
| `mmx-monitor.html` | 监控页面（前端，单文件 HTML，三栏仪表盘） |
| `mmx-monitor-server.js` | 本地代理服务（Node.js，连接 MiniMax API，端口9876） |
| `mmx_quota_feishu.py` | 飞书推送脚本（查询配额后推送到飞书） |

## 使用方式

### 方式一：网页端（实时仪表盘）

1. 启动后端服务（如未运行）：
   ```bash
   node ~/.openclaw/workspace/skills/minimax-monitor/mmx-monitor-server.js
   ```
2. 我会自动执行 `open` 命令打开 `mmx-monitor.html`，浏览器自动加载

### 方式二：飞书端（继鹏问"查配额"时触发）

直接对我说**查配额**，我运行脚本把当前配额以飞书卡片形式推给你。

手动运行：
```bash
python3 ~/.openclaw/workspace/skills/minimax-monitor/mmx_quota_feishu.py <api_key>
```

## 飞书卡片内容

- 5小时总体配额使用率 + 已用/总额/剩余
- 重置倒计时
- 各模型明细（颜色标记：🟢<75% 🟡75-94% 🔴95%+）
- 本周配额（如有）

## 环境变量

| 变量 | 说明 |
|------|------|
| `MINIMAX_API_KEY` | MiniMax API Key（Token Plan 类型） |
| `FEISHU_APP_ID` | 飞书机器人 App ID |
| `FEISHU_APP_SECRET` | 飞书机器人 App Secret |
| `FEISHU_CHAT_ID` | 默认推送群 ID |

## 注意事项

- 后端服务需在页面之前启动，端口 9876
- 页面刷新间隔：配额 60s，速率 60s
- API Key 类型必须是 `sk-cp-` 开头（Token Plan）
