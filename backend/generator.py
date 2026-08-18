"""千问 API 生成器：流式 chat completion + logprobs → Top-5 真实概率。

数据核心不变（产品的红线）：
- logprobs + top_logprobs=5 从千问 API 拿到每个生成 token 的真实候选与 log 概率；
- logprob 经 exp() 转成概率（模型 softmax 输出分布中的真实概率）；
- 被选中的 token 是 API 返回的实际生成 token（云端真实采样，绝不伪造）；
- 本地仅加载 Qwen2.5 tokenizer（几 MB，不加载模型）用于：展示输入拆分 + 计算上下文 token 数。

环境变量：
  DASHSCOPE_API_KEY  千问 API Key（必填）
  QWEN_MODEL         默认 qwen-turbo（可选）
  QWEN_API_BASE      默认 https://dashscope.aliyuncs.com/compatible-mode/v1（可选）
"""
import json
import os
import re
import urllib.error
import urllib.request
from typing import Iterator, List, Tuple

from transformers import AutoTokenizer

# 过滤无法渲染的字节垃圾：控制字符、代理区（emoji 拆半）、零宽、U+FFFD 替换符
# 千问流式偶发返回这类 token（如 ' �'），展示层必须清洗，保证界面干净（不改概率，仍是真实数据）
_TOKEN_CLEAN = re.compile(
    r"[\u0000-\u0008\u000B\u000C\u000E-\u001F\u007F-\u009F\uD800-\uDFFF\u200B-\u200D\uFEFF\uFFFD]"
)


def _clean_token(t: str) -> str:
    return _TOKEN_CLEAN.sub("", t)

MODEL_NAME = "Qwen/Qwen2.5-0.5B-Instruct"  # 仅 tokenizer：输入拆分 + token 计数
QWEN_API_BASE = os.getenv("QWEN_API_BASE", "https://dashscope.aliyuncs.com/compatible-mode/v1")
QWEN_MODEL = os.getenv("QWEN_MODEL", "qwen-turbo")
QWEN_API_KEY = os.getenv("DASHSCOPE_API_KEY", "")


class Generator:
    def __init__(self, api_key: str = ""):
        self.api_key = api_key or QWEN_API_KEY
        if not self.api_key:
            raise ValueError("缺少 DASHSCOPE_API_KEY 环境变量（千问 API Key）")
        self.api_base = QWEN_API_BASE
        self.model = QWEN_MODEL
        self.tokenizer = AutoTokenizer.from_pretrained(MODEL_NAME)
        self.stop_ids: set = set()  # API 模式用 finish_reason 判断结束

    def build_prompt(self, messages: List[dict]) -> List[int]:
        """用官方 chat 模板计算 token 数（上下文长度展示用；生成由 API 内部处理模板）。"""
        return self.tokenizer.apply_chat_template(
            messages, tokenize=True, add_generation_prompt=True
        )

    def token_text(self, token) -> str:
        """token 可读文本：字符串（API 返回）原样返回；int（本地 tokenizer 产物）用 decode 还原。"""
        if isinstance(token, str):
            return token
        return self.tokenizer.decode([token], skip_special_tokens=False)

    def decode(self, tokens) -> str:
        """API 模式下 tokens 是字符串列表，直接拼接；兼容旧 int 列表。"""
        if tokens and isinstance(tokens[0], str):
            return "".join(tokens)
        return self.tokenizer.decode(tokens, skip_special_tokens=True)

    def _stream_chat(self, messages, max_new_tokens, temperature, top_p):
        body = {
            "model": self.model,
            "messages": messages,
            "stream": True,
            "logprobs": True,
            "top_logprobs": 5,
            "temperature": temperature,
            "max_tokens": max_new_tokens,
        }
        if top_p:
            body["top_p"] = top_p
        req = urllib.request.Request(
            f"{self.api_base}/chat/completions",
            data=json.dumps(body).encode(),
            headers={"Authorization": f"Bearer {self.api_key}", "Content-Type": "application/json"},
            method="POST",
        )
        with urllib.request.urlopen(req, timeout=120) as r:
            for line in r:
                line = line.decode().strip()
                if not line.startswith("data:"):
                    continue
                d = line[5:].strip()
                if d == "[DONE]":
                    break
                yield json.loads(d)

    def generate_steps(
        self,
        messages: List[dict],
        max_new_tokens: int = 200,
        temperature: float = 0.8,
        top_p: float = 0.9,
    ) -> Iterator[Tuple[int, List[Tuple[str, float]], str, float, bool]]:
        """逐步生成。每步 yield：
        (step, top5=[(token_str, prob) x5], chosen_str, chosen_prob, eos)

        eos=True 表示 API 返回 stop（本轮生成自然结束）。
        """
        step = 0
        try:
            for chunk in self._stream_chat(messages, max_new_tokens, temperature, top_p):
                choices = chunk.get("choices")
                if not choices:
                    continue
                choice = choices[0]
                finish = choice.get("finish_reason")
                lp = choice.get("logprobs")
                if not (lp and lp.get("content")):
                    continue
                # 关键：qwen 的 logprobs 流式一个 chunk 可能含多个 token，
                # logprobs.content 数组与 delta.content 逐 token 对应，必须全部遍历
                for tok in lp["content"]:
                    chosen = _clean_token(tok.get("token", ""))
                    top = tok.get("top_logprobs", []) or []
                    top5 = [
                        (_clean_token(t.get("token", "")), 2.718281828459045 ** t.get("logprob", -999.0))
                        for t in top[:5]
                    ]
                    step += 1
                    yield (
                        step,
                        top5,
                        chosen,
                        2.718281828459045 ** tok.get("logprob", -999.0),
                        finish == "stop",
                    )
        except urllib.error.HTTPError as e:
            detail = ""
            try:
                detail = e.read().decode()
            except Exception:
                pass
            raise RuntimeError(f"千问 API 错误 {e.code}: {detail}") from e
        except Exception as e:  # noqa: BLE001
            raise RuntimeError(f"千问 API 请求失败: {e}") from e


if __name__ == "__main__":
    # 简易自测：验证 Key + 单步 logprobs
    g = Generator()
    step, top5, chosen, p, eos = next(g.generate_steps(
        [{"role": "user", "content": "你好"}], max_new_tokens=1
    ))
    print(f"top5={top5}")
    print(f"chosen={chosen!r} p={p:.4f}")
