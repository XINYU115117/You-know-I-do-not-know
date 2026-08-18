"""FastAPI SSE 服务：聊天输入 → 会话 → 真实生成 → 事件流推送。

事件流（技术方案 v1 第 7-8 节）：
  meta → step ×N → done   （正常）
  error（任意时刻）        （异常）
"""
import asyncio
import json
import os
import queue
import threading
import time
import uuid
from collections import defaultdict

from fastapi import FastAPI, Request
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import JSONResponse, StreamingResponse

import db
from generator import Generator
from schemas import (
    CandidateToken,
    DoneData,
    ErrorData,
    EventIn,
    GenerationStep,
    MetaData,
    TokenData,
)

MAX_INPUT_CHARS = 100
MAX_NEW_TOKENS = 500  # logprobs 模式下预算比名义值小，500 保证长答案完整生成
TEMPERATURE = 0.8
TOP_P = 0.9
MAX_TURNS = 3  # 上下文瘦身：只保留最近 3 轮对话（每轮 = 1 user + 1 assistant）

# 内容安全：system prompt 约束（降低不当输出概率）
SYSTEM_PROMPT = (
    "你是面向普通用户的 AI 科普助手，回答要简短、友好、通俗易懂。"
    "你只提供一般性知识，不生成暴力、色情、违法或有害内容，"
    "不提供医疗、法律、投资等专业建议。"
)

# 内容安全：输出关键词黑名单（轻量兜底，命中即遮蔽）
SENSITIVE_WORDS = [
    "色情", "淫秽", "赌博", "毒品", "自杀", "杀人", "爆炸物", "诈骗", "枪支制造",
]


def filter_sensitive(text: str) -> str:
    """将命中敏感词的文本遮蔽为 *，兜底防御（非专业审核）。"""
    for w in SENSITIVE_WORDS:
        text = text.replace(w, "*" * len(w))
    return text

app = FastAPI(title="LLM 机制体验 - 后端")

# CORS：本地开发前端 3000 → 后端 8000 是跨域，必须放行；
# 部署时同源反代不受影响，且用 CORS_ORIGINS 收紧到正式域名
_CORS_ORIGINS = os.getenv(
    "CORS_ORIGINS",
    "http://127.0.0.1:3000,http://localhost:3000,http://localhost",
)
app.add_middleware(
    CORSMiddleware,
    allow_origins=[o.strip() for o in _CORS_ORIGINS.split(",") if o.strip()],
    allow_methods=["*"],
    allow_headers=["*"],
)

# 限流（防刷，部署时开启）：同 IP 每分钟最多 RATE_LIMIT_PER_MIN 次 /api/stream。
# 本地开发默认不限流（设为 0）；部署时 docker-compose 注入 RATE_LIMIT_PER_MIN=10
RATE_LIMIT_PER_MIN = int(os.getenv("RATE_LIMIT_PER_MIN", "0"))
_rate: dict = defaultdict(list)


@app.middleware("http")
async def rate_limit(request: Request, call_next):
    if RATE_LIMIT_PER_MIN > 0 and request.url.path.startswith("/api/stream"):
        client = request.client.host if request.client else "unknown"
        now = time.time()
        _rate[client] = [t for t in _rate[client] if now - t < 60]
        if len(_rate[client]) >= RATE_LIMIT_PER_MIN:
            return JSONResponse(status_code=429, content={"error": "rate limited"})
        _rate[client].append(now)
    return await call_next(request)

# 启动即加载模型（首次较慢，之后常驻内存）
gen = Generator()

# 会话: conversation_id -> {"messages": [...], "turns": [...]}（内存态多轮上下文，重启丢失）
conversations: dict = {}


def sse(event: str, data: dict) -> str:
    return f"event: {event}\ndata: {json.dumps(data, ensure_ascii=False)}\n\n"


@app.get("/api/stream")
async def stream(text: str, conversation_id: str = "", anonymous_user_id: str = ""):
    text = (text or "").strip()

    if not text:
        return StreamingResponse(
            iter([sse("error", ErrorData(code="EMPTY", message="输入为空，请输入问题").model_dump())]),
            media_type="text/event-stream",
        )
    if len(text) > MAX_INPUT_CHARS:
        return StreamingResponse(
            iter([sse("error", ErrorData(
                code="INPUT_TOO_LONG",
                message=f"输入不能超过 {MAX_INPUT_CHARS} 个中文字符（当前 {len(text)} 字）",
            ).model_dump())]),
            media_type="text/event-stream",
        )

    if not conversation_id:
        conversation_id = uuid.uuid4().hex[:12]
    if conversation_id not in conversations:
        conversations[conversation_id] = {"messages": [], "turns": []}
    sess = conversations[conversation_id]

    # 上下文瘦身：超过 MAX_TURNS 轮的旧对话从上下文移除（仍保留在新会话之外，仅不再参与计算）
    while len(sess["turns"]) >= MAX_TURNS:
        del sess["messages"][:2]
        del sess["turns"][0]
    history_rounds = len(sess["turns"])
    sess["messages"].append({"role": "user", "content": text})

    # 注入 system prompt 约束 + 历史 + 当前输入
    messages_with_system = [{"role": "system", "content": SYSTEM_PROMPT}] + sess["messages"]
    prompt_ids = gen.build_prompt(messages_with_system)
    # 本轮输入单独 prompt（同样带 system）：完整上下文 - 当前输入 = 历史部分
    alone_ids = gen.build_prompt([
        {"role": "system", "content": SYSTEM_PROMPT},
        {"role": "user", "content": text},
    ])
    history_token_count = len(prompt_ids) - len(alone_ids)
    # 当前输入的 token（不带 chat 模板，展示"我的问题被拆成什么"）
    input_token_ids = gen.tokenizer.encode(text)
    input_tokens = [
        TokenData(token_id=t, token_text=gen.token_text(t), position=i).model_dump()
        for i, t in enumerate(input_token_ids)
    ]
    # 埋点：一次提问 = 一个 session_id，落库
    session_id = "ses_" + uuid.uuid4().hex[:16]
    db.create_session(session_id, anonymous_user_id, conversation_id, text)
    db.insert_event(anonymous_user_id, session_id, "question_submitted",
                    {"conversation_id": conversation_id})
    db.insert_event(anonymous_user_id, session_id, "generation_started", {})

    meta = MetaData(
        session_id=session_id,
        anonymous_user_id=anonymous_user_id,
        conversation_id=conversation_id,
        model="Qwen2.5-0.5B-Instruct",
        input_text=text,
        history_rounds=history_rounds,
        input_tokens=input_tokens,
        context_token_count=len(prompt_ids),
        history_token_count=history_token_count,
    ).model_dump()

    q: "queue.Queue" = queue.Queue()

    def worker():
        try:
            q.put(("meta", meta))
            start = time.time()
            generated_ids = []
            text_so_far = ""
            step_count = 0
            stop_reason = "max_tokens"
            for step, top5, chosen_id, chosen_prob, eos in gen.generate_steps(
                messages_with_system, MAX_NEW_TOKENS, TEMPERATURE, TOP_P
            ):
                step_count = step
                generated_ids.append(chosen_id)
                chosen_text = gen.token_text(chosen_id)
                text_so_far += chosen_text
                candidates = [
                    CandidateToken(
                        token_id=t,
                        token_text=gen.token_text(t),
                        probability=round(p, 4),
                        rank=r,
                    ).model_dump()
                    for r, (t, p) in enumerate(top5, 1)
                ]
                chosen_rank = next((r for r, (t, _) in enumerate(top5, 1) if t == chosen_id), None)
                selected = CandidateToken(
                    token_id=chosen_id,
                    token_text=chosen_text,
                    probability=round(chosen_prob, 4),
                    rank=chosen_rank,
                ).model_dump()
                q.put(("step", GenerationStep(
                    step=step,
                    context_token_count=len(prompt_ids),
                    generated_text_so_far=text_so_far,
                    candidates=candidates,
                    selected_token=selected,
                ).model_dump()))
                if eos:
                    stop_reason = "eos"
                    break

            final_answer = filter_sensitive(gen.decode(generated_ids))
            sess["messages"].append({"role": "assistant", "content": final_answer})
            sess["turns"].append({"user": text, "assistant": final_answer})
            duration_ms = int((time.time() - start) * 1000)
            db.upsert_session(session_id, generation_completed=True,
                              total_steps=step_count, duration_ms=duration_ms)
            db.insert_event(anonymous_user_id, session_id, "generation_completed",
                            {"total_steps": step_count, "duration_ms": duration_ms,
                             "stop_reason": stop_reason})
            q.put(("done", DoneData(
                final_answer=final_answer,
                total_steps=step_count,
                duration_ms=duration_ms,
                stop_reason=stop_reason,
            ).model_dump()))
        except Exception as e:  # noqa: BLE001
            db.insert_event(anonymous_user_id, session_id, "generation_error",
                            {"error_code": "INTERNAL", "message": str(e)})
            q.put(("error", ErrorData(code="INTERNAL", message=str(e)).model_dump()))
        finally:
            q.put((None, None))

    threading.Thread(target=worker, daemon=True).start()

    async def event_stream():
        while True:
            name, data = await asyncio.to_thread(q.get)
            if name is None:
                break
            yield sse(name, data)

    return StreamingResponse(
        event_stream(),
        media_type="text/event-stream",
        headers={"Cache-Control": "no-cache", "X-Accel-Buffering": "no"},
    )


@app.post("/api/event")
async def record_event(e: EventIn):
    db.insert_event(e.anonymous_user_id, e.session_id or None, e.event, e.data)
    if e.event == "review_viewed":
        db.upsert_session(e.session_id, review_viewed=True)
    elif e.event == "quiz_started":
        db.upsert_session(e.session_id, quiz_started=True)
    elif e.event == "quiz_question_answered":
        d = e.data
        db.insert_quiz_answer(
            e.session_id,
            d.get("question_id", ""),
            d.get("quiz_version", ""),
            d.get("option_order", []),
            d.get("selected_answer", -1),
            d.get("correct_answer", -1),
            d.get("is_correct", False),
        )
    elif e.event == "quiz_completed":
        db.upsert_session(e.session_id, quiz_completed=True, quiz_score=e.data.get("score"))
    return {"ok": True}


@app.get("/api/health")
async def health():
    return {"status": "ok"}


@app.get("/api/_debug/memory")
async def debug_memory():
    """开发调试：查看内存态埋点数据（仅本地/非生产环境使用）。"""
    return db.memory_snapshot()


if __name__ == "__main__":
    import uvicorn

    uvicorn.run(app, host="127.0.0.1", port=8000)
