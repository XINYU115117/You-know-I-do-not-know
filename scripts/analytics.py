"""数据分析：从埋点数据出漏斗 + 每题正确率（作品集用图数据）。

本地（内存模式）：连接后端 /api/_debug/memory 拿数据；
部署（Postgres）：直接跑同目录下的 SQL（见 docs/05-.../第 8 节）。

用法：python scripts/analytics.py [--url http://127.0.0.1:8000]
"""
import json
import sys
import urllib.request

BASE = sys.argv[sys.argv.index("--url") + 1] if "--url" in sys.argv else "http://127.0.0.1:8000"


def fetch_memory():
    with urllib.request.urlopen(f"{BASE}/api/_debug/memory", timeout=10) as r:
        return json.load(r)


def main():
    d = fetch_memory()
    sessions = d.get("sessions", {})
    events = d.get("events", [])
    quiz = d.get("quiz_answers", [])

    print("=" * 46)
    print("  漏斗（单位：session/次体验）")
    print("=" * 46)
    funnel = {
        "提问 question_submitted": sum(1 for e in events if e["event"] == "question_submitted"),
        "生成完成 generation_completed": sum(1 for s in sessions.values() if s.get("generation_completed")),
        "查看回顾 review_viewed": sum(1 for s in sessions.values() if s.get("review_viewed")),
        "开始答题 quiz_started": sum(1 for s in sessions.values() if s.get("quiz_started")),
        "完成答题 quiz_completed": sum(1 for s in sessions.values() if s.get("quiz_completed")),
    }
    first = None
    for k, v in funnel.items():
        rate = "" if first is None else f"（{100.0 * v / first:.0f}%）"
        if first is None:
            first = v
        print(f"  {k}: {v} {rate}")

    print()
    print("=" * 46)
    print("  每题正确率")
    print("=" * 46)
    if not quiz:
        print("  （暂无答题数据）")
    else:
        by_qid: dict[str, list] = {}
        for q in quiz:
            by_qid.setdefault(q["question_id"], []).append(q)
        for qid in sorted(by_qid):
            rows = by_qid[qid]
            n = len(rows)
            c = sum(1 for r in rows if r["is_correct"])
            print(f"  {qid}: {c}/{n} 答对（{100.0 * c / n:.0f}%）")

    print()
    print("=" * 46)
    print("  得分分布")
    print("=" * 46)
    scores = [s.get("quiz_score") for s in sessions.values() if s.get("quiz_completed")]
    if not scores:
        print("  （暂无完成答题的 session）")
    else:
        from collections import Counter

        dist = Counter(scores)
        for sc in sorted(dist):
            print(f"  {sc} 分: {dist[sc]} 次")


if __name__ == "__main__":
    main()
