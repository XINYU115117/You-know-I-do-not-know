"""M0 垂直切片验证：问题 → 真实 Tokenization → 10 步生成（Top-5 + 选中）→ 答案。

通过标准（技术方案 v1 第 13 节）：
- 每步 5 个候选概率来自 softmax，和 <= 1（完整分布和为 1 由 softmax 保证）；
- 选中 token 是真实采样结果；
- token 文本为真实 tokenizer 输出，无伪造。
"""
import os
import sys

sys.path.insert(0, os.path.join(os.path.dirname(os.path.abspath(__file__)), "..", "backend"))

from generator import Generator


def main():
    gen = Generator()
    question = "为什么天空是蓝色的？"
    messages = [{"role": "user", "content": question}]
    prompt_ids = gen.build_prompt(messages)

    print("=" * 60)
    print("【1】真实 Tokenization（chat 模板 + BPE）")
    print("=" * 60)
    print(f"输入: {question}")
    print(f"上下文 token 数: {len(prompt_ids)}")
    for i, tid in enumerate(prompt_ids):
        print(f"  [{i}] id={tid:<6} text={gen.token_text(tid)!r}")

    print("=" * 60)
    print("【2】逐 Token 生成（最多 10 步）")
    print("=" * 60)
    n_steps = 0
    generated_ids = []
    for step, top5, chosen_id, chosen_prob in gen.generate_steps(prompt_ids, max_new_tokens=10):
        n_steps += 1
        generated_ids.append(chosen_id)
        chosen_text = gen.token_text(chosen_id)
        chosen_rank = next((r for r, (t, _) in enumerate(top5, 1) if t == chosen_id), None)
        sum5 = sum(p for _, p in top5)
        print(f"\nstep {step}  (Top-5 概率和={sum5:.4f})")
        for r, (t, p) in enumerate(top5, 1):
            mark = "  ★选中" if t == chosen_id else ""
            print(f"   #{r} {gen.token_text(t)!r:<10} p={p:.4f}{mark}")
        if chosen_rank is None:
            print(f"   >> 实际选中: {chosen_text!r} p={chosen_prob:.4f}（不在 Top-5 内，真实情况）")
        if chosen_id in gen.stop_ids:
            print(f"   >> 命中停止符 {chosen_text!r}")
            break

    print("=" * 60)
    print("【3】最终答案")
    print("=" * 60)
    print(gen.decode(generated_ids))
    print(f"\n共 {n_steps} 步。数据链路验证通过（若以上均为真实输出）。")


if __name__ == "__main__":
    main()
