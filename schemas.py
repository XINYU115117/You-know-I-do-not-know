"""数据协议（技术方案 v1 第 8 节）。字段名锁定，前后端共用。"""
from typing import List, Optional
from pydantic import BaseModel


class TokenData(BaseModel):
    token_id: int
    token_text: str
    position: int


class CandidateToken(BaseModel):
    token_id: int
    token_text: str
    probability: float
    rank: Optional[int]  # 1-5 为 Top-5 名次；None 表示该 token 不在 Top-5 内


class GenerationStep(BaseModel):
    step: int
    context_token_count: int
    generated_text_so_far: str
    candidates: List[CandidateToken]
    selected_token: CandidateToken  # rank 为 None 表示选中项不在 Top-5 内


class MetaData(BaseModel):
    conversation_id: str
    model: str
    input_text: str
    history_rounds: int
    input_tokens: List[TokenData]  # 仅当前输入的 token（不含历史/系统/模板标记）
    context_token_count: int       # 完整上下文（系统+历史+当前输入）token 数
    history_token_count: int       # 历史 + 系统部分占用的 token 数（用于前端分段展示）


class DoneData(BaseModel):
    final_answer: str
    total_steps: int
    duration_ms: int
    stop_reason: str


class ErrorData(BaseModel):
    code: str
    message: str
