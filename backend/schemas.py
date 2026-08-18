"""数据协议（技术方案 v1 第 8 节）。字段名锁定，前后端共用。"""
from typing import List, Optional, Union
from pydantic import BaseModel


class TokenData(BaseModel):
    token_id: int
    token_text: str
    position: int


class CandidateToken(BaseModel):
    token_id: Union[int, str]  # API 模式为 token 字符串；本地模式为 int
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
    session_id: str              # 每次提问生成一个，埋点/统计主键
    anonymous_user_id: str       # 浏览器匿名 ID，原样回传
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


class EventIn(BaseModel):
    """前端统一事件上报（page_view / review_viewed / quiz_* / restart_clicked）。"""
    event: str
    anonymous_user_id: str
    session_id: str = ""          # page_view 等可空
    data: dict = {}
