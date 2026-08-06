# 交互式 AI 模型机制体验网站

让不懂 AI 的用户**亲眼看到**语言模型如何把问题变成逐 Token 答案的网页体验（机制教育产品，非聊天工具）。

## 文档入口

| 文档 | 内容 |
|---|---|
| `docs/01-产品原始定义-v1.0.md` | 产品事实来源（Codex 交接文档原文，843 行） |
| `docs/02-PRD-v1.md` | 产品需求：红线、已确认决策、MVP 范围、可执行验收标准 |
| `docs/03-技术方案-v1.md` | 技术实施：模型选型、数据协议、目录结构、里程碑、风险、垂直切片 |

## 已确认决策（2026-08-04）

- 模型：**Qwen2.5-0.5B-Instruct，本机 CPU**
- 视觉：**数据实验室风**（深色面板 + Token 卡片 + 概率条）
- 历史：早期轮次折叠为"历史上下文"模块
- 架构：Python FastAPI（后端手写生成循环 + SSE）→ 纯 HTML/CSS/JS（前端零构建）

## 启动方式

```bash
# 后端（首次启动会自动下载约 1GB 模型，加载约 30 秒）
cd backend && python3 -m venv .venv
.venv/bin/pip install -r requirements.txt
.venv/bin/python -m uvicorn app:app --host 127.0.0.1 --port 8000

# 前端：无需启动，直接浏览器打开 http://127.0.0.1:8000
```

## 开发里程碑

M0 垂直切片 → M1 基础界面 → M2 多轮 → M3 可视化 → M4 打磨（详见技术方案第 10 节）

## 迁移说明

本项目因 Reasonix 沙箱限制建于 workspace 内。如需放回桌面：整个 `llm-lab` 文件夹用 Finder 直接拷贝即可，无绝对路径依赖。
