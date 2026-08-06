"""手写自回归生成循环：logits → softmax → Top-5 → 采样。

这是整个产品的数据核心：
- 每一步都从模型真实读取 logits；
- Top-5 候选与概率来自 softmax(logits / temperature)；
- 被选中的 token 来自真实采样，绝不伪造。
"""
import os
import time
from typing import Iterator, List, Tuple

import torch
from transformers import AutoModelForCausalLM, AutoTokenizer

MODEL_NAME = "Qwen/Qwen2.5-0.5B-Instruct"

# Intel CPU 上默认线程数可能少于物理核数，显式用满（实测提速 ~35%）
torch.set_num_threads(os.cpu_count() or 12)


class Generator:
    def __init__(self, model_name: str = MODEL_NAME):
        self.tokenizer = AutoTokenizer.from_pretrained(model_name)
        self.model = AutoModelForCausalLM.from_pretrained(model_name)
        self.model.eval()
        # 停止条件：EOS + chat 模板结束符
        self.stop_ids = {
            self.tokenizer.eos_token_id,
            self.tokenizer.convert_tokens_to_ids("<|im_end|>"),
        }

    def build_prompt(self, messages: List[dict]) -> List[int]:
        """用官方 chat 模板把对话历史格式化为 token id 序列。"""
        return self.tokenizer.apply_chat_template(
            messages, tokenize=True, add_generation_prompt=True
        )

    def token_text(self, token_id: int) -> str:
        """token 的可读文本。

        用底层字节级 decode：Qwen2 的 convert_ids_to_tokens 返回的是
        bytes_to_unicode 映射后的乱码，decode 单个 token 才能还原真实文本。
        """
        return self.tokenizer.decode([token_id], skip_special_tokens=False)

    def generate_steps(
        self,
        prompt_ids: List[int],
        max_new_tokens: int = 200,
        temperature: float = 0.8,
        top_p: float = 0.9,
    ) -> Iterator[Tuple[int, List[Tuple[int, float]], int, float]]:
        """逐步生成。每步 yield：
        (step, top5=[(token_id, prob) x5], chosen_id, chosen_prob)

        使用 KV cache（past_key_values）：首步计算全序列，之后每步只计算
        新生成的 1 个 token，前面的注意力结果被复用——否则每步全量重算，
        每步耗时随上下文长度线性增长（实测 289 token 时慢 2.7 倍）。
        """
        seq = list(prompt_ids)
        past_key_values = None
        device = self.model.device
        for step in range(1, max_new_tokens + 1):
            with torch.no_grad():
                if past_key_values is None:
                    input_tensor = torch.tensor([seq], dtype=torch.long, device=device)
                else:
                    input_tensor = torch.tensor([seq[-1:]], dtype=torch.long, device=device)
                out = self.model(
                    input_tensor,
                    past_key_values=past_key_values,
                    use_cache=True,
                )
                logits = out.logits[0, -1, :]  # 最后一位的 logits
                past_key_values = out.past_key_values

            scaled = logits / temperature
            probs = torch.softmax(scaled, dim=-1)

            # 真实 Top-5
            top5_probs, top5_ids = torch.topk(probs, 5)
            top5 = [(int(t), float(p)) for t, p in zip(top5_ids.tolist(), top5_probs.tolist())]

            # nucleus (top_p) 采样
            sorted_p, sorted_i = probs.sort(descending=True)
            cum = sorted_p.cumsum(dim=0)
            keep = cum - sorted_p <= top_p  # 累计概率刚超过 top_p 的最小前缀
            keep[0] = True  # 至少保留一个
            keep_probs = sorted_p.clone()
            keep_probs[~keep] = 0.0
            keep_probs = keep_probs / keep_probs.sum()
            chosen_index = torch.multinomial(keep_probs, 1).item()
            chosen_id = int(sorted_i[chosen_index].item())
            chosen_prob = float(probs[chosen_id].item())

            seq.append(chosen_id)
            yield step, top5, chosen_id, chosen_prob

            if chosen_id in self.stop_ids:
                break

    def decode(self, token_ids: List[int]) -> str:
        return self.tokenizer.decode(token_ids, skip_special_tokens=True)


if __name__ == "__main__":
    # 简易自测：确保模型加载与单步 forward 可用
    t0 = time.time()
    g = Generator()
    print(f"模型加载完成，耗时 {time.time()-t0:.1f}s")
    ids = g.build_prompt([{"role": "user", "content": "你好"}])
    step, top5, chosen_id, chosen_prob = next(g.generate_steps(ids, max_new_tokens=1))
    print(f"top5={top5}")
    print(f"chosen={chosen_id} {g.token_text(chosen_id)!r} p={chosen_prob:.4f}")
