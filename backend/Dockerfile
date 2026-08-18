# 后端部署镜像（千问 API 模式：无 torch、无本地模型，仅 tokenizer 几 MB）
FROM python:3.11-slim

WORKDIR /app

COPY requirements.txt .
RUN pip install --no-cache-dir -r requirements.txt

COPY . .

# 预下载 Qwen2.5 tokenizer（输入拆分展示用，约 2-5MB），运行时零下载
RUN python -c "from transformers import AutoTokenizer; AutoTokenizer.from_pretrained('Qwen/Qwen2.5-0.5B-Instruct')"

EXPOSE 8000
# DASHSCOPE_API_KEY 通过环境变量注入（docker-compose 里配置，勿写进镜像）
CMD ["uvicorn", "app:app", "--host", "0.0.0.0", "--port", "8000"]
