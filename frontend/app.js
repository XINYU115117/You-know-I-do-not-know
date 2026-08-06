/* 模型实验室 · 前端逻辑
   状态机: IDLE → SUBMITTING → TOKENIZING(meta) → GENERATING(step×N) → ANSWER_READY(done)
   事件协议见 docs/03-技术方案-v1.md 第 8 节
*/
(function () {
  "use strict";

  const MAX_INPUT = 100;
  const els = {
    form: document.getElementById("form"),
    input: document.getElementById("input"),
    send: document.getElementById("send"),
    chat: document.getElementById("chat"),
    status: document.getElementById("status-badge"),
  };

  let cid = localStorage.getItem("llm_cid");
  if (!cid) {
    cid = Date.now().toString(36) + Math.random().toString(36).slice(2, 8);
    localStorage.setItem("llm_cid", cid);
  }

  let busy = false;
  let turns = 0; // 已完成轮次数（用于历史折叠）

  function setStatus(text, cls) {
    els.status.textContent = text;
    els.status.className = "status status-" + cls;
  }

  function esc(s) {
    return String(s).replace(/[&<>"']/g, (c) => ({
      "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;",
    }[c]));
  }

  function el(tag, cls, text) {
    const n = document.createElement(tag);
    if (cls) n.className = cls;
    if (text !== undefined) n.textContent = text;
    return n;
  }

  /* 解释条（机制解释）：带标签徽章，样式与真实数据区分 */
  function explain(tag, html, cls) {
    const box = el("div", cls || "explain");
    box.appendChild(el("span", "tag", tag));
    const body = document.createElement("div");
    body.innerHTML = html;
    box.appendChild(body);
    return box;
  }

  /* 教学时刻：模型选了非第一名 / 低概率 / 不在 Top-5 时的提示 */
  function surpriseNote(d) {
    const sel = d.selected_token;
    const top1 = d.candidates[0];
    const pct = (sel.probability * 100).toFixed(1);
    if (sel.rank === null) {
      return explain("注意",
        "模型选中的「" + esc(sel.token_text) + "」<strong>甚至不在最可能的 5 个里</strong>（概率 " + pct + "%）。这就是\"抽签\"的随机性。", "surprise");
    }
    if (sel.rank !== 1) {
      return explain("注意",
        "模型没有选概率最高的「" + esc(top1.token_text) + "」，而是选了「" + esc(sel.token_text) + "」（概率 " + pct + "%）。大模型是<strong>按概率\"抽签\"</strong>，不是永远选最可能的。", "surprise");
    }
    if (sel.probability < 0.5) {
      return explain("注意",
        "即使是概率最高的选项也只有 " + pct + "%——模型每一步的把握其实都不大。", "surprise");
    }
    return null;
  }

  function scrollBottom() {
    els.chat.scrollTop = els.chat.scrollHeight;
  }

  /* ---------- 轮次 DOM ---------- */
  function newTurn(userText) {
    const turn = el("div", "turn");
    turn.appendChild(el("div", "msg user", userText));

    // 历史折叠：之前所有轮次的过程面板压缩为"历史上下文"模块
    const oldTurns = els.chat.querySelectorAll(".turn");
    for (let i = 0; i < oldTurns.length; i++) {
      const panel = oldTurns[i].querySelector(".panel");
      if (panel && !panel.dataset.folded) {
        panel.dataset.folded = "1";
        const fold = el("div", "history-fold",
          "▤ 历史上下文 · 前 " + (i + 1) + " 轮（已作为 Token 进入后续生成）");
        panel.replaceWith(fold);
      }
    }

    const panel = el("div", "panel");
    const head = el("div", "panel-head");
    head.appendChild(el("span", "title", "模型生成过程"));
    const tag = el("span", null, "TOKENIZING");
    head.appendChild(tag);
    panel.appendChild(head);

    // 预告：这一轮你会看到什么（叙事层，机制解释）
    panel.appendChild(explain("预告",
      "下面你会看到：模型把一句话拆成 Token，然后一个字一个字地\"抽\"出回答。" +
      "蓝色高亮 = 模型这一步实际选中的 Token。"));

    const tokSection = el("div", "tokens-section");
    tokSection.appendChild(el("div", "tokens-label", "① 输入如何被拆成 Token（真实 tokenizer 输出）"));
    tokSection.appendChild(explain("机制解释",
      "模型不读整句，它把文本拆成 <span class=\"term\" data-tip=\"模型眼中的词块，不是单个字。比如'为什么'是 1 个 Token。\">Token</span>（词块）。" +
      "开头那些英文和 <span class=\"term\" data-tip=\"像是 <|im_start|>、<|im_end|> 这类符号，是模型用来标记\"对话哪里开始/结束\"的专用记号\">特殊符号</span>是模型的系统设定，不是你的问题。"));
    const tokFlow = el("div", "token-flow");
    tokSection.appendChild(tokFlow);
    panel.appendChild(tokSection);

    const steps = el("div", "steps");
    steps.appendChild(el("div", "steps-label", "② 逐字生成 · 每一步的真实候选与概率"));
    steps.appendChild(explain("机制解释",
      "每生成一个字，模型会给所有可能的\"下一个词\"打分，分数变成 <span class=\"term\" data-tip=\"0-100%，模型认为\"下一个词是它\"的把握程度\">概率</span>。" +
      "下面 5 个是它觉得最可能的 <span class=\"term\" data-tip=\"模型认为可能是\"下一个词\"的选项\">候选</span>（Top-5），蓝条长度 = 概率。模型按概率\"抽签\"选中一个。"));
    panel.appendChild(steps);

    const seqSection = el("div", "sequence");
    seqSection.appendChild(el("div", "seq-label", "③ 回答逐字增长"));
    seqSection.appendChild(explain("机制解释",
      "每次抽中的 Token 会拼到这里，回答就是这样一字一字\"长\"出来的。"));
    const seqFlow = el("div", "seq-flow");
    seqSection.appendChild(seqFlow);
    panel.appendChild(seqSection);

    const doneMeta = el("div", "done-meta");
    panel.appendChild(doneMeta);

    turn.appendChild(panel);
    els.chat.appendChild(turn);
    return { panel, tokFlow, steps, seqFlow, doneMeta, tag };
  }

  function renderMeta(turn, d) {
    turn.tag.textContent = "TOKENIZING → " + d.context_token_count + " tokens";
    // 历史上下文折叠块（多轮时）：历史确实参与计算，这里折叠展示
    if (d.history_rounds > 0) {
      const fold = el("div", "history-fold");
      fold.textContent = "▤ 历史上下文 · 前 " + d.history_rounds + " 轮（"
        + d.history_token_count + " token）已作为输入参与这次计算，此处折叠展示";
      turn.tokFlow.parentNode.insertBefore(fold, turn.tokFlow);
    }
    // 当前输入 token（仅你这次问的话）
    d.input_tokens.forEach((t) => {
      const chip = el("div", "token-chip");
      chip.appendChild(el("span", null, t.token_text));
      chip.appendChild(el("span", "tid", String(t.token_id)));
      chip.title = "id=" + t.token_id + " 位置=" + t.position;
      turn.tokFlow.appendChild(chip);
    });
    setStatus("生成中 · 步骤 0", "generating");
  }

  function renderStep(turn, d) {
    turn.tag.textContent = "GENERATING · 步骤 " + d.step;
    setStatus("生成中 · 步骤 " + d.step, "generating");

    const row = el("div", "step-row");
    row.appendChild(el("div", "step-no", "#" + d.step));

    const cands = el("div", "cands");
    const sel = d.selected_token;
    const selInTop5 = sel.rank !== null;

    d.candidates.forEach((c) => {
      const card = el("div", "cand");
      const rb = el("span", "rank-badge", String(c.rank));
      const txt = el("span", "txt", c.token_text);
      const bar = el("div", "bar");
      const fill = el("div", "bar-fill");
      fill.style.width = (c.probability * 100).toFixed(1) + "%";
      bar.appendChild(fill);
      const pct = el("div", "pct", (c.probability * 100).toFixed(1) + "%");
      card.append(rb, txt, bar, pct);
      if (selInTop5 && c.rank === sel.rank) {
        card.classList.add("selected");
        card.title = "模型这一步选中了它";
      }
      cands.appendChild(card);
    });

    if (!selInTop5) {
      // 真实情况：采样选中的 token 不在 Top-5 内
      const outside = el("div", "cand outside");
      outside.appendChild(el("span", "txt", sel.token_text));
      outside.appendChild(el("div", "pct", "选中 (p=" + (sel.probability * 100).toFixed(1) + "%)"));
      outside.title = "实际选中项不在 Top-5 内（采样偶然性，真实数据）";
      cands.appendChild(outside);
    }

    row.appendChild(cands);

    // 教学时刻：在步骤前插入醒目提示（每个 turn 最多 3 次，避免刷屏）
    const sur = surpriseNote(d);
    if (sur) {
      const n = parseInt(turn.dataset.surprises || "0", 10);
      if (n < 3) {
        turn.steps.insertBefore(sur, row);
        turn.dataset.surprises = String(n + 1);
      }
    }

    turn.steps.appendChild(row);

    // 序列增量
    const prev = turn.dataset.seqLen ? parseInt(turn.dataset.seqLen, 10) : 0;
    const inc = d.generated_text_so_far.slice(prev);
    if (inc) {
      turn.seqFlow.appendChild(el("span", "seq-chip", inc));
      turn.dataset.seqLen = String(d.generated_text_so_far.length);
    }
    scrollBottom();
  }

  function renderDone(turn, d) {
    turn.tag.textContent = "完成 · " + d.total_steps + " 步";
    turn.doneMeta.textContent =
      "总步数 " + d.total_steps + " · 耗时 " + (d.duration_ms / 1000).toFixed(1) + "s · 停止原因 " +
      (d.stop_reason === "eos" ? "结束符" : "达到最大长度");
    // 完成解释条 + 最终答案
    turn.panel.insertBefore(explain("机制解释",
      "生成结束。上面那些 Token 拼成了下面这个完整回答。"), turn.doneMeta);
    turn.panel.appendChild(el("div", "msg assistant", d.final_answer));
    turns++;
    setStatus("就绪", "idle");
    busy = false;
    els.input.disabled = false;
    els.send.disabled = false;
    els.input.focus();
    scrollBottom();
  }

  function renderError(msg) {
    const box = el("div", "error-box", "⚠ " + msg);
    els.chat.appendChild(box);
    setStatus("出错", "error");
    busy = false;
    els.input.disabled = false;
    els.send.disabled = false;
    scrollBottom();
  }

  /* ---------- 提交与 SSE ---------- */
  els.form.addEventListener("submit", (e) => {
    e.preventDefault();
    const text = els.input.value.trim();
    if (!text || busy) return;
    const len = [...text].length;
    if (len > MAX_INPUT) {
      renderError("输入不能超过 " + MAX_INPUT + " 个中文字符（当前 " + len + " 字）");
      return;
    }

    busy = true;
    els.input.disabled = true;
    els.send.disabled = true;
    setStatus("提交中", "generating");
    els.input.value = "";

    const turn = newTurn(text);
    const url = "/api/stream?text=" + encodeURIComponent(text) + "&conversation_id=" + encodeURIComponent(cid);
    const es = new EventSource(url);

    es.addEventListener("meta", (ev) => renderMeta(turn, JSON.parse(ev.data)));
    es.addEventListener("step", (ev) => renderStep(turn, JSON.parse(ev.data)));
    es.addEventListener("done", (ev) => {
      es.close();
      renderDone(turn, JSON.parse(ev.data));
    });
    es.addEventListener("error", (ev) => {
      // EventSource 的 error 事件会同时触发在连接错误上，需区分
      if (ev.data) {
        es.close();
        renderError(JSON.parse(ev.data).message);
      }
    });
    es.onerror = () => {
      // 连接失败（后端未启动 / 断线）
      if (busy) {
        es.close();
        renderError("连接中断：后端服务不可用或已断开，请刷新后重试");
      }
    };
  });
})();
