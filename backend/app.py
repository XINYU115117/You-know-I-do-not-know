"""FastAPI SSE 服务：聊天输入 → 会话 → 真实生成 → 事件流推送。

事件流（技术方案 v1 第 7-8 节）：
  meta → step ×N → done   （正常）
  error（任意时刻）        （异常）
"""
import asyncio
import json
import queue
import threading
import time
import uuid
from pathlib import Path

from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import StreamingResponse
from fastapi.staticfiles import StaticFiles

from generator import Generator
from schemas import CandidateToken, DoneData, ErrorData, GenerationStep, MetaData, TokenData

MAX_INPUT_CHARS = 100
MAX_NEW_TOKENS = 200
TEMPERATURE = 0.8
TOP_P = 0.9
MAX_TURNS = 3  # 上下文瘦身：只保留最近 3 轮对话（每轮 = 1 user + 1 assistant）

app = FastAPI(title="LLM 机制体验 - 后端")
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_methods=["*"],
    allow_headers=["*"],
)

# 启动即加载模型（首次较慢，之后常驻内存）
gen = Generator()

# 会话: conversation_id -> {"messages": [...], "turns": [...]}
sessions: dict = {}


def sse(event: str, data: dict) -> str:
    return f"event: {event}\ndata: {json.dumps(data, ensure_ascii=False)}\n\n"


@app.get("/api/stream")
async def stream(text: str, conversation_id: str = ""):
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
    if conversation_id not in sessions:
        sessions[conversation_id] = {"messages": [], "turns": []}
    sess = sessions[conversation_id]

    # 上下文瘦身：超过 MAX_TURNS 轮的旧对话从上下文移除（仍保留在新会话之外，仅不再参与计算）
    while len(sess["turns"]) >= MAX_TURNS:
        del sess["messages"][:2]
        del sess["turns"][0]
    history_rounds = len(sess["turns"])
    sess["messages"].append({"role": "user", "content": text})

    prompt_ids = gen.build_prompt(sess["messages"])
    # 本轮输入单独 prompt：完整上下文 - 当前输入 = 历史 + 系统部分
    alone_ids = gen.build_prompt([{"role": "user", "content": text}])
    history_token_count = len(prompt_ids) - len(alone_ids)
    # 当前输入的 token（不带 chat 模板，展示"我的问题被拆成什么"）
    input_token_ids = gen.tokenizer.encode(text)
    input_tokens = [
        TokenData(token_id=t, token_text=gen.token_text(t), position=i).model_dump()
        for i, t in enumerate(input_token_ids)
    ]
    meta = MetaData(
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
            for step, top5, chosen_id, chosen_prob in gen.generate_steps(
                prompt_ids, MAX_NEW_TOKENS, TEMPERATURE, TOP_P
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
                if chosen_id in gen.stop_ids:
                    stop_reason = "eos"
                    break

            final_answer = gen.decode(generated_ids)
            sess["messages"].append({"role": "assistant", "content": final_answer})
            sess["turns"].append({"user": text, "assistant": final_answer})
            q.put(("done", DoneData(
                final_answer=final_answer,
                total_steps=step_count,
                duration_ms=int((time.time() - start) * 1000),
                stop_reason=stop_reason,
            ).model_dump()))
        except Exception as e:  # noqa: BLE001
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


# 静态托管前端：访问 http://127.0.0.1:8000 即打开页面
app.mount(
    "/",
    StaticFiles(directory=str(Path(__file__).resolve().parent.parent / "frontend"), html=True),
    name="frontend",
)


if __name__ == "__main__":
    import uvicorn

    uvicorn.run(app, host="127.0.0.1", port=8000)
