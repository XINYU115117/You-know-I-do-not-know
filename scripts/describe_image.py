"""本地视觉理解：用 SmolVLM-500M 描述图片内容。

用法: python describe_image.py <图片路径> [问题]

让我（文本模型）能"看到"图片：通过 SmolVLM 生成图片的文字描述，
回答关于图片内容/布局/颜色的问题。首次运行需下载约 1GB 模型。
"""
import sys

import torch
from PIL import Image
from transformers import AutoModelForImageTextToText, AutoProcessor

MODEL = "HuggingFaceTB/SmolVLM-500M-Instruct"

DEFAULT_QUESTION = (
    "请详细描述这张图片：整体布局、有哪些界面元素（按钮/输入框/卡片/标签）、"
    "它们的颜色、位置关系，以及图上所有可见的文字内容。"
)


def main():
    if len(sys.argv) < 2:
        print("用法: python describe_image.py <图片路径> [问题]", file=sys.stderr)
        sys.exit(1)

    path = sys.argv[1]
    question = sys.argv[2] if len(sys.argv) > 2 else DEFAULT_QUESTION

    print(f"加载模型 {MODEL} ...", file=sys.stderr)
    processor = AutoProcessor.from_pretrained(MODEL)
    model = AutoModelForImageTextToText.from_pretrained(MODEL, torch_dtype=torch.float32)
    model.eval()

    image = Image.open(path).convert("RGB")
    messages = [{"role": "user", "content": [{"type": "image"}, {"type": "text", "text": question}]}]
    prompt = processor.apply_chat_template(messages, add_generation_prompt=True)
    inputs = processor(text=prompt, images=[image], return_tensors="pt")

    print("生成描述 ...", file=sys.stderr)
    with torch.no_grad():
        output = model.generate(**inputs, max_new_tokens=512, do_sample=False)

    input_len = inputs["input_ids"].shape[1]
    answer = processor.decode(output[0][input_len:], skip_special_tokens=True)
    print(answer)


if __name__ == "__main__":
    main()
