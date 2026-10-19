import {
  COMMON_CHECKS,
  CONSTRAINTS,
  P_CARDS,
  Q_TYPES,
  SECTIONS,
  STARTERS,
  SUBJ,
  SUBJ_ORDER,
  TRENDS,
  VERSIONS,
} from "./constants.js";

const escapeHtml = value => String(value == null ? "" : value).replace(/[&<>"']/g, character => ({
  "&": "&amp;",
  "<": "&lt;",
  ">": "&gt;",
  '"': "&quot;",
  "'": "&#39;",
}[character]));

export function parseCode(input, activities) {
  const normalized = String(input || "").trim().toLowerCase().replace(/^#/, "").replace(/[\s_]/g, "");
  const match = normalized.match(/^(is1|is2|ess|es)-?(\d{4})-?([abc])$/);
  if (!match) return null;
  const id = `${match[1]}-${match[2]}`;
  return activities.some(activity => activity.id === id)
    ? { id, version: match[3].toUpperCase() }
    : null;
}

function classCode(id, version) {
  return `${id.replace("-", "").toUpperCase()}-${version}`;
}

function answerKey(state) {
  return `evc:${state.act}:${state.version}`;
}

function answer(state, key) {
  return state.ans[key] == null ? "" : state.ans[key];
}

function isChecked(state, key) {
  return Boolean(state.ans[key]);
}

function copyText(text, button) {
  const originalText = button.textContent;
  const copied = () => {
    button.textContent = "복사됨";
    window.setTimeout(() => { button.textContent = originalText; }, 1600);
  };
  const fallback = () => {
    const input = document.createElement("textarea");
    input.value = text;
    input.setAttribute("readonly", "");
    input.className = "copy-input";
    document.body.appendChild(input);
    input.select();
    let succeeded = false;
    try {
      succeeded = document.execCommand("copy");
    } catch {
      succeeded = false;
    } finally {
      input.remove();
    }
    if (succeeded) copied();
    else button.textContent = "직접 선택해 복사하세요";
  };

  if (!navigator.clipboard?.writeText) {
    fallback();
    return;
  }
  navigator.clipboard.writeText(text).then(copied, fallback);
}

export function renderStudent(app, data, state, actions) {
  let currentAnswerKey = null;
  let saveTimer = null;

  function loadCurrentAnswer() {
    if (!state.act) return;
    const key = answerKey(state);
    if (currentAnswerKey === key) return;
    currentAnswerKey = key;
    state.ans = actions.readStorage(key) || {};
    state.step = Number.isInteger(state.ans._step) ? state.ans._step : 0;
  }

  function save() {
    window.clearTimeout(saveTimer);
    const key = state.act ? answerKey(state) : null;
    const answers = state.ans;
    saveTimer = window.setTimeout(() => {
      if (key) actions.writeStorage(key, answers);
      actions.saveLastView();
    }, 250);
  }

  function flushSave() {
    window.clearTimeout(saveTimer);
    if (state.act) actions.writeStorage(answerKey(state), state.ans);
    actions.saveLastView();
  }

  function setAnswer(key, value) {
    state.ans[key] = value;
    save();
    refreshRail();
    liveHooks.forEach(hook => hook(key));
  }

  function openActivity(id, version) {
    flushSave();
    state.act = id;
    state.version = version;
    currentAnswerKey = null;
    loadCurrentAnswer();
    save();
  }

  function renderStart() {
    app.innerHTML = `
      <div class="start stack">
        <div class="panel stack">
          <h1>수업 코드를 입력하세요</h1>
          <p class="lead">선생님이 알려 준 코드(예: <span class="mono">ES0105-A</span>)를 입력하면 워크시트가 열립니다. 쓴 내용은 이 브라우저에 자동으로 저장됩니다.</p>
          <form class="join" id="joinForm">
            <input id="joinIn" aria-label="수업 코드" type="text" autocomplete="off" placeholder="ES0105-A" value="">
            <button class="btn primary" type="submit">시작하기</button>
          </form>
          <p class="err" id="joinErr" role="alert" hidden></p>
        </div>
        <div class="panel">
          <h2>또는 활동을 직접 고르기</h2>
          <p class="small muted panel-description">직접 고르면 강한 비계(A) 버전으로 시작합니다.</p>
          ${SUBJ_ORDER.map(subject => `
            <div class="subject-picks">
              <span class="label">${SUBJ[subject]}</span>
              <div class="pick">
                ${data.activities.filter(activity => activity.subj === subject).map(activity => `
                  <button type="button" data-open="${activity.id}">
                    <span class="code">[${escapeHtml(activity.code)}]</span><br>${escapeHtml(activity.title)}
                  </button>
                `).join("")}
              </div>
            </div>
          `).join("")}
        </div>
      </div>
      ${footer()}`;

    document.getElementById("joinForm").addEventListener("submit", event => {
      event.preventDefault();
      const parsed = parseCode(document.getElementById("joinIn").value, data.activities);
      if (!parsed) {
        const error = document.getElementById("joinErr");
        error.textContent = "코드를 찾을 수 없습니다. 영문 과목 기호, 숫자 네 자리, 버전(A·B·C)을 확인하세요. 예: ES0105-A";
        error.hidden = false;
        return;
      }
      openActivity(parsed.id, parsed.version);
      renderWork();
    });

    app.querySelectorAll("[data-open]").forEach(button => {
      button.addEventListener("click", () => {
        openActivity(button.dataset.open, "A");
        renderWork();
      });
    });
  }

  function renderWork() {
    loadCurrentAnswer();
    state.step = Math.max(0, Math.min(SECTIONS.length - 1, Number(state.step) || 0));
    const activity = data.activities.find(item => item.id === state.act);
    if (!activity) {
      state.act = null;
      renderStart();
      return;
    }

    const rail = `
      <aside class="rail">
        <ol>
          ${SECTIONS.map((section, index) => `
            <li>
              <button type="button" data-step="${index}" ${index === state.step ? 'aria-current="step"' : ""}>
                <span class="n">${section.n}</span>
                <span class="t">${section.t}</span>
                <span class="dot ${isDone(section.key) ? "done" : ""}"></span>
              </button>
            </li>
          `).join("")}
        </ol>
        <div class="meta">
          <span class="vbadge"><b>${state.version}</b>${VERSIONS[state.version].name}</span>
          <span>수업 코드 <span class="mono">${classCode(activity.id, state.version)}</span></span>
          <button class="btn sm ghost" type="button" id="leave">다른 활동 고르기</button>
        </div>
      </aside>`;
    const header = `
      <div class="sheet-head stack">
        <span class="code">[${escapeHtml(activity.code)}] · ${SUBJ[activity.subj]}</span>
        <h1>${escapeHtml(activity.title)}</h1>
        <p class="small muted">${escapeHtml(data.standards[activity.code])}</p>
      </div>`;

    app.innerHTML = `
      <div class="work">
        ${rail}
        <div class="sheet">
          ${header}
          <div id="sec"></div>
          <div class="navrow">
            <button class="btn" type="button" id="prev">이전 단계</button>
            <button class="btn primary" type="button" id="next">다음 단계</button>
          </div>
        </div>
      </div>
      ${footer()}`;

    app.querySelectorAll("[data-step]").forEach(button => {
      button.addEventListener("click", () => go(Number(button.dataset.step)));
    });
    document.getElementById("prev").addEventListener("click", () => go(state.step - 1));
    document.getElementById("next").addEventListener("click", () => go(state.step + 1));
    document.getElementById("leave").addEventListener("click", () => {
      flushSave();
      state.act = null;
      currentAnswerKey = null;
      save();
      renderStart();
    });
    document.getElementById("prev").disabled = state.step === 0;
    document.getElementById("next").hidden = state.step === SECTIONS.length - 1;
    renderSection();
  }

  function go(index) {
    if (index < 0 || index >= SECTIONS.length) return;
    state.step = index;
    state.ans._step = index;
    save();
    renderWork();
    window.scrollTo({ top: 0, behavior: "smooth" });
  }

  function refreshRail() {
    app.querySelectorAll(".rail [data-step]").forEach((button, index) => {
      const dot = button.querySelector(".dot");
      if (dot) dot.classList.toggle("done", isDone(SECTIONS[index].key));
    });
  }

  function isDone(key) {
    const has = field => String(answer(state, field)).trim() !== "";
    switch (key) {
      case "s0": return has("pre_trust") && has("decl1");
      case "s1": return has("question");
      case "s2": return has("period") && has("place");
      case "s25": return has("trend") && has("why");
      case "s3": return has("prompt_final") || has("prompt_free");
      case "s4": return checkList().some(item => has(`chk_${item.id}`));
      case "s5": return has("r0_problem") && has("r0_prompt");
      case "s6": return has("post_trust") && has("conclusion");
      default: return false;
    }
  }

  function sectionWrap(sectionIndex, lead, body) {
    const section = SECTIONS[sectionIndex];
    return `
      <section class="sec" aria-labelledby="secTitle">
        <div class="stack section-intro">
          <div class="sec-title"><span class="n">${section.n}</span><h2 id="secTitle">${section.t}</h2></div>
          ${lead ? `<p class="lead">${lead}</p>` : ""}
        </div>
        ${body}
      </section>`;
  }

  function textareaField(key, label, hint, placeholder, rows) {
    return `
      <div class="field">
        <label for="f_${key}">${label}</label>
        ${hint ? `<span class="hint">${hint}</span>` : ""}
        <textarea id="f_${key}" data-k="${key}" rows="${rows || 3}" placeholder="${escapeHtml(placeholder || "")}"></textarea>
      </div>`;
  }

  function inputField(key, label, placeholder, hint) {
    return `
      <div class="field">
        <label for="f_${key}">${label}</label>
        ${hint ? `<span class="hint">${hint}</span>` : ""}
        <input type="text" id="f_${key}" data-k="${key}" placeholder="${escapeHtml(placeholder || "")}">
      </div>`;
  }

  function scaleField(key, label, low, high) {
    return `
      <div class="field">
        <span class="flabel">${label}</span>
        <div class="scale" role="group" aria-label="${escapeHtml(label)}">
          ${[1, 2, 3, 4, 5].map(value => `<button type="button" data-pick="${key}|${value}">${value}</button>`).join("")}
        </div>
        <div class="scale-legend"><span>1 ${low}</span><span>5 ${high}</span></div>
      </div>`;
  }

  function bindFields(root) {
    root.querySelectorAll("[data-k]").forEach(element => {
      const key = element.dataset.k;
      if (element.type === "checkbox") {
        element.checked = Boolean(state.ans[key]);
        element.addEventListener("change", () => setAnswer(key, element.checked));
      } else {
        element.value = answer(state, key);
        element.addEventListener("input", () => setAnswer(key, element.value));
      }
    });
    root.querySelectorAll("[data-pick]").forEach(button => {
      const [key, value] = button.dataset.pick.split("|");
      button.setAttribute("aria-pressed", String(answer(state, key)) === value);
      button.addEventListener("click", () => {
        state.ans[key] = String(answer(state, key)) === value ? "" : value;
        root.querySelectorAll(`[data-pick^="${key}|"]`).forEach(option => {
          option.setAttribute("aria-pressed", String(answer(state, key)) === option.dataset.pick.split("|")[1]);
        });
        setAnswer(key, state.ans[key]);
      });
    });
  }

  let liveHooks = [];

  function checkList() {
    const activity = data.activities.find(item => item.id === state.act);
    const checks = COMMON_CHECKS.map((item, index) => ({ id: `c${index}`, t: item.t, h: item.h, kind: "공통" }));
    activity.checks.forEach((item, index) => {
      if (state.version !== "C") checks.push({ id: `a${index}`, t: item.t, h: item.h, kind: "이 활동" });
    });
    if (state.version === "C") {
      [0, 1, 2].forEach(index => {
        const text = String(answer(state, `cc_${index}`)).trim();
        if (text) checks.push({ id: `cc${index}`, t: text, h: "", kind: "나의 기준" });
      });
    }
    return checks;
  }

  function verificationRow(item) {
    const selected = answer(state, `chk_${item.id}`);
    return `
      <div class="vrow ${selected}" data-row="${item.id}">
        <div class="vrow-top">
          <p><span class="label">${item.kind}</span><br>${escapeHtml(item.t)}</p>
          <div class="tri" role="group" aria-label="판정">
            ${[["ok", "맞음"], ["bad", "문제 있음"], ["unk", "모르겠음"]].map(([value, label]) => `
              <button type="button" data-v="${value}" data-chk="${item.id}" aria-pressed="${selected === value}">${label}</button>
            `).join("")}
          </div>
        </div>
        ${state.version === "A" && item.h ? `<p class="vhint">${escapeHtml(item.h)}</p>` : ""}
        <input type="text" data-k="chkn_${item.id}" placeholder="근거나 메모" aria-label="메모">
      </div>`;
  }

  function assemblePrompt() {
    const activity = data.activities.find(item => item.id === state.act);
    const variables = activity.vars
      .filter((variable, index) => answer(state, `var_${index}`))
      .map(variable => `- ${variable.n} (단위: ${variable.u})`);
    const tasks = activity.tasks.filter((task, index) => answer(state, `task_${index}`));
    if (answer(state, "task_own")) tasks.push(answer(state, "task_own"));
    const constraints = CONSTRAINTS.filter(item => answer(state, `con_${item.k}`)).map(item => item.t);
    const lines = [
      "너는 고등학생의 지구과학 데이터 탐구를 돕는 파이썬 데이터 분석 조수야. 결론은 내가 내릴 거니까, 너는 분석과 그래프를 정확하게 만들어 줘.",
      "",
      "[탐구 질문]",
      answer(state, "question") || "(§1에서 탐구 질문을 쓰세요)",
      "",
      "[데이터]",
      `- 출처: ${answer(state, "source") || `${activity.data.org} ${activity.data.name}`}`,
      `- 기간: ${answer(state, "period") || "(§2에서 기간을 쓰세요)"}`,
      `- 지역·대상: ${answer(state, "place") || "(§2에서 지역을 쓰세요)"}`,
    ];
    if (variables.length) {
      lines.push("- 사용할 변수:");
      variables.forEach(variable => lines.push(`  ${variable}`));
    }
    if (answer(state, "data_note")) lines.push(`- 참고: ${answer(state, "data_note")}`);
    lines.push("- 첨부한 파일을 사용해. 파일에 없는 값은 지어내지 마.", "");
    lines.push("[할 일]");
    (tasks.length ? tasks : ["(위에서 작업을 고르세요)"]).forEach((task, index) => lines.push(`${index + 1}. ${task}`));
    lines.push(`그래프: ${answer(state, "chart") || activity.chart}`);
    if (constraints.length) {
      lines.push("", "[조건]");
      constraints.forEach(constraint => lines.push(`- ${constraint}`));
    }
    return lines.join("\n");
  }

  function promptText() {
    return state.version === "A"
      ? (answer(state, "prompt_final") || assemblePrompt())
      : answer(state, "prompt_free");
  }

  function downloadSummary() {
    const date = new Date();
    const dateText = [
      date.getFullYear(),
      String(date.getMonth() + 1).padStart(2, "0"),
      String(date.getDate()).padStart(2, "0"),
    ].join("-");
    const filename = `워크시트_${classCode(state.act, state.version)}_${dateText}.txt`;
    const blob = new Blob([`\uFEFF${summaryText()}`], { type: "text/plain;charset=utf-8" });
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.href = url;
    link.download = filename;
    document.body.append(link);
    link.click();
    link.remove();
    window.setTimeout(() => URL.revokeObjectURL(url), 1000);
  }

  function summaryText() {
    const activity = data.activities.find(item => item.id === state.act);
    const lines = [];
    const addLine = (label, value) => {
      if (String(value || "").trim()) lines.push(`${label}: ${value}`);
    };
    lines.push(`[지구과학 바이브 코딩 워크시트] ${activity.title}`);
    lines.push(`성취기준 [${activity.code}] ${data.standards[activity.code]}`);
    lines.push(`수업 코드 ${classCode(activity.id, state.version)} (${VERSIONS[state.version].name})`);
    addLine("이름", answer(state, "name"));
    addLine("AI 도구", answer(state, "tool"));
    lines.push("", "§0 탐구 준비");
    addLine("역할 선언", [
      isChecked(state, "decl1") && "탐구자 선언",
      isChecked(state, "decl2") && "결과는 가설",
      isChecked(state, "decl3") && "정직한 기록",
    ].filter(Boolean).join(", "));
    addLine("나만의 약속", answer(state, "decl_own"));
    addLine("사전 AI 신뢰도(1~5)", answer(state, "pre_trust"));
    lines.push("", "§1 탐구 문제");
    addLine("탐구 질문", answer(state, "question"));
    addLine("질문 유형", (Q_TYPES.find(item => item.k === answer(state, "qtype")) || {}).b);
    addLine("고른 이유", answer(state, "q_why"));
    lines.push("", "§2 데이터 맥락");
    addLine("출처", answer(state, "source") || `${activity.data.org} ${activity.data.name}`);
    addLine("기간", answer(state, "period"));
    addLine("지역·대상", answer(state, "place"));
    if (state.version === "A") {
      const variables = activity.vars
        .filter((variable, index) => answer(state, `var_${index}`))
        .map(variable => `${variable.n}(${variable.u})`);
      addLine("변수", variables.join(", "));
    } else if (state.version === "B") {
      activity.vars.forEach((variable, index) => {
        const unit = answer(state, `vu_${index}`);
        const range = answer(state, `vr_${index}`);
        if (unit || range) lines.push(`${variable.n}: 단위 ${unit} / 범위 ${range}`);
      });
    } else {
      addLine("변수", answer(state, "vars_free"));
    }
    addLine("자료 메모", answer(state, "data_note"));
    lines.push("", "§2.5 나의 예측");
    addLine("경향", answer(state, "trend"));
    addLine("범위", (answer(state, "p_min") || answer(state, "p_max"))
      ? `${answer(state, "p_min")} ~ ${answer(state, "p_max")} ${answer(state, "p_unit")}`
      : "");
    addLine("그래프 모양", answer(state, "p_shape"));
    addLine("이유", answer(state, "why"));
    lines.push("", "§3 프롬프트", promptText() || "(없음)");
    if (state.version === "C") addLine("자기 평가(1~5)", answer(state, "p_self"));
    lines.push("", "§4 결과 검증");
    addLine("AI 결과", answer(state, "ai_result"));
    const labels = { ok: "맞음", bad: "문제 있음", unk: "모르겠음" };
    checkList().forEach(item => {
      const checked = answer(state, `chk_${item.id}`);
      const note = answer(state, `chkn_${item.id}`);
      if (checked || note) lines.push(`- [${labels[checked] || "미확인"}] ${item.t}${note ? ` / ${note}` : ""}`);
    });
    lines.push("", "§5 수정·반복");
    const roundCount = Math.max(1, Number(answer(state, "rounds_n")) || 1);
    for (let index = 0; index < roundCount; index++) {
      const problem = answer(state, `r${index}_problem`);
      const prompt = answer(state, `r${index}_prompt`);
      const change = answer(state, `r${index}_change`);
      if (problem || prompt || change) {
        lines.push(`${index + 1}회차`);
        addLine("  문제", problem);
        addLine("  수정 프롬프트", prompt);
        addLine("  변화", change);
      }
    }
    lines.push("", "§6 성찰");
    addLine("사후 AI 신뢰도(1~5)", answer(state, "post_trust"));
    addLine("결론", answer(state, "conclusion"));
    addLine("AI가 한 일과 내가 판단한 일", answer(state, "who"));
    addLine("찾은 오류", answer(state, "errors"));
    addLine("동의하지 않는 부분", answer(state, "disagree"));
    addLine("다음에 바꿀 점", answer(state, "next"));
    addLine("성취수준 자기 점검", answer(state, "self_level"));
    return lines.join("\n");
  }

  function renderSection() {
    liveHooks = [];
    const container = document.getElementById("sec");
    const sectionKey = SECTIONS[state.step].key;
    const activity = data.activities.find(item => item.id === state.act);
    let html = "";

    if (sectionKey === "s0") {
      html = sectionWrap(0, "AI는 탐구를 돕는 도구이고, 결론을 내리는 사람은 나입니다. 시작하기 전에 역할을 분명히 해 두세요.", `
        <div class="row">
          ${inputField("name", "이름(학번)", "예: 2학년 3반 12번 김지구")}
          <div class="field">
            <label for="f_tool">사용할 AI 도구</label>
            <select id="f_tool" data-k="tool">
              <option value="">고르세요</option><option>ChatGPT</option><option>Claude</option><option>Gemini</option><option>Copilot</option><option>기타</option>
            </select>
          </div>
        </div>
        <div class="field">
          <span class="flabel">역할 선언</span>
          <label class="check"><input type="checkbox" data-k="decl1"> 나는 탐구 질문과 결론을 스스로 정하는 탐구자이다.</label>
          <label class="check"><input type="checkbox" data-k="decl2"> AI가 만든 그래프와 계산은 내가 검증하기 전까지 '가설'로 본다.</label>
          <label class="check"><input type="checkbox" data-k="decl3"> 내가 사용한 데이터의 출처와 AI 사용 과정을 정직하게 기록한다.</label>
        </div>
        ${state.version === "C" ? textareaField("decl_own", "나만의 약속 한 가지", "이번 탐구에서 특히 조심할 점을 스스로 정하세요.", "예: AI가 단위를 바꾸면 반드시 원자료와 비교한다.") : ""}
        ${scaleField("pre_trust", "AI가 만든 그래프나 계산 결과를 그대로 믿어도 된다고 생각하나요?", "전혀 아니다", "매우 그렇다")}
        ${state.version === "C" && data.levels[activity.code] ? `
          <div class="field">
            <span class="flabel">이번 탐구의 목표 (성취수준)</span>
            <div class="note">${escapeHtml(data.levels[activity.code].A)}</div>
            <span class="hint">성취수준 A 수준을 목표로 합니다. 마지막 §6에서 스스로 점검합니다.</span>
          </div>` : ""}`);
    } else if (sectionKey === "s1") {
      let body = "";
      if (state.version === "A") {
        body = `
          <div class="field">
            <span class="flabel">빈칸을 채워 탐구 질문을 만드세요</span>
            <div class="fill">
              <input type="text" data-k="q_place" placeholder="지역·대상" aria-label="지역 또는 대상"><span>의</span>
              <input type="text" data-k="q_period" placeholder="기간" aria-label="기간"><span>자료에서</span>
              <input type="text" data-k="q_var" placeholder="변수" aria-label="변수"><span>은(는)</span>
              <input type="text" data-k="q_how" placeholder="어떻게 변할까 / 무엇과 관계있을까" aria-label="알고 싶은 것"><span>?</span>
            </div>
          </div>
          <div class="field"><span class="flabel">예시 질문 (눌러서 가져오기)</span><div class="starters">
            ${activity.questions.map((question, index) => `<button type="button" data-ex="${index}">${escapeHtml(question)}</button>`).join("")}
          </div></div>
          ${textareaField("question", "나의 탐구 질문", "빈칸을 채우면 자동으로 만들어집니다. 자연스럽게 다듬어도 됩니다.", "", 2)}`;
      } else if (state.version === "B") {
        body = `
          <div class="field"><span class="flabel">질문 유형을 하나 고르세요</span><div class="cards">
            ${Q_TYPES.map(item => `<button type="button" class="card" data-pick="qtype|${item.k}"><b>${item.b}</b><span>${item.s}</span></button>`).join("")}
          </div></div>
          ${textareaField("question", "나의 탐구 질문", "고른 유형의 문장 틀을 참고해 직접 쓰세요.", "", 2)}
          <details class="details"><summary>예시 질문 보기</summary><ul class="plain small">
            ${activity.questions.map(question => `<li>${escapeHtml(question)}</li>`).join("")}
          </ul></details>`;
      } else {
        body = `
          ${textareaField("question", "나의 탐구 질문", "", "", 2)}
          <div class="note"><b>좋은 탐구 질문의 기준</b><ul class="plain">
            <li>내가 구할 수 있는 데이터로 답할 수 있다.</li>
            <li>변수, 기간, 지역(대상)이 드러난다.</li>
            <li>답을 찾으면 성취기준의 지구과학 개념을 설명하는 데 도움이 된다.</li>
          </ul></div>`;
      }
      body += textareaField("q_why", "이 질문을 고른 이유", "어떤 지구과학 개념과 연결되나요?", "", 2);
      html = sectionWrap(1, "데이터로 답할 수 있는 질문을 정합니다.", body);
    } else if (sectionKey === "s2") {
      const dataset = activity.data;
      let variables;
      if (state.version === "A") {
        variables = `
          <div class="tbl-wrap"><table class="vars">
            <thead><tr><th>사용</th><th>변수</th><th>단위</th><th>일반적 범위</th></tr></thead>
            <tbody>${activity.vars.map((variable, index) => `
              <tr><td><input type="checkbox" data-k="var_${index}" aria-label="${escapeHtml(variable.n)} 사용"></td>
                <td>${escapeHtml(variable.n)}</td><td class="u">${escapeHtml(variable.u)}</td><td class="u">${escapeHtml(variable.r)}</td></tr>
            `).join("")}</tbody>
          </table></div>`;
      } else if (state.version === "B") {
        variables = `
          <div class="tbl-wrap"><table class="vars">
            <thead><tr><th>변수</th><th>단위 (직접 확인)</th><th>예상 범위 (직접 조사)</th></tr></thead>
            <tbody>${activity.vars.map((variable, index) => `
              <tr><td>${escapeHtml(variable.n)}</td>
                <td><input type="text" data-k="vu_${index}" aria-label="${escapeHtml(variable.n)} 단위"></td>
                <td><input type="text" data-k="vr_${index}" aria-label="${escapeHtml(variable.n)} 범위"></td></tr>
            `).join("")}</tbody>
          </table></div>
          <span class="hint">단위와 범위는 원자료의 설명(메타데이터)이나 교과서에서 확인하세요.</span>`;
      } else {
        variables = textareaField("vars_free", "사용할 변수, 단위, 물리적으로 가능한 범위", "변수마다 한 줄씩 쓰세요.", "예: 수온 / °C / -2 ~ 30", 4);
      }
      html = sectionWrap(2, "AI는 내가 알려 준 만큼만 자료를 이해합니다. 자료의 출처, 범위, 단위를 정확히 적으세요.", `
        <div class="datacard">
          <span class="label">이 활동의 데이터</span><b>${escapeHtml(dataset.name)}</b>
          <span class="small">${escapeHtml(dataset.org)}${dataset.url ? ` · <a href="${escapeHtml(dataset.url)}" target="_blank" rel="noopener">${escapeHtml(dataset.url)}</a>` : ""}</span>
          <span class="small muted">${escapeHtml(dataset.how)}</span>
        </div>
        <div class="row">
          ${inputField("source", "출처", `${dataset.org} ${dataset.name}`)}
          ${inputField("period", "기간", "예: 2015년 1월 ~ 2024년 12월")}
          ${inputField("place", "지역·관측소·대상", "예: 서울(108), 동해 105선")}
        </div>
        <div class="field"><span class="flabel">변수와 단위</span>${variables}</div>
        ${textareaField("data_note", "자료를 열어 보고 알게 된 점", "결측(빈칸, -999 등), 특이한 값, 열 이름 등을 적으세요.", "예: 2019년 3월 자료가 비어 있다.", 3)}`);
    } else if (sectionKey === "s25") {
      html = sectionWrap(3, "AI 결과를 보기 전에 나의 예측을 적어 둡니다. 예측은 AI 결과를 비판적으로 볼 기준점이 됩니다.", `
        <div class="note">${escapeHtml(activity.predict)}</div>
        <div class="field"><span class="flabel">예상하는 경향</span><div class="starters" role="group" aria-label="예상 경향">
          ${TRENDS.map(trend => `<button type="button" data-pick="trend|${trend}">${trend}</button>`).join("")}
        </div></div>
        <div class="row">
          ${inputField("p_min", "예상 최솟값", "")}
          ${inputField("p_max", "예상 최댓값", "")}
          ${inputField("p_unit", "단위", "")}
        </div>
        ${textareaField("p_shape", "그래프 모양 설명", "그래프를 그린다면 어떤 모양일지 말로 설명하세요.", "예: 오른쪽 위로 올라가다가 1992년 무렵 잠시 내려간다.", 2)}
        ${textareaField("why", "그렇게 예상한 이유", "배운 지구과학 개념을 근거로 쓰세요.", "", 3)}`);
    } else if (sectionKey === "s3") {
      let body;
      if (state.version === "A") {
        body = `
          <div class="field">
            <span class="flabel">AI에게 시킬 작업 (여러 개 선택)</span>
            ${activity.tasks.map((task, index) => `<label class="check"><input type="checkbox" data-k="task_${index}"> ${escapeHtml(task)}</label>`).join("")}
            ${inputField("task_own", "직접 추가할 작업", "")}
          </div>
          ${inputField("chart", "원하는 그래프", activity.chart)}
          <div class="field"><span class="flabel">조건과 검증 요청</span>
            ${CONSTRAINTS.map(item => `<label class="check"><input type="checkbox" data-k="con_${item.k}"> ${escapeHtml(item.t)}</label>`).join("")}
          </div>
          <div class="field">
            <span class="flabel">완성된 프롬프트</span>
            <span class="hint">§1, §2에 쓴 내용과 위에서 고른 항목으로 자동 조립됩니다. 복사한 뒤 AI 도구에 데이터 파일과 함께 붙여 넣으세요.</span>
            <div class="prompt-out" id="pOut"></div>
          </div>
          <div class="copyrow">
            <button class="btn primary" type="button" id="pCopy">프롬프트 복사</button>
            <button class="btn" type="button" id="pEdit">이 프롬프트로 직접 고치기</button>
          </div>
          ${textareaField("prompt_final", "AI에 실제로 보낸 프롬프트", "직접 고친 경우 여기에 최종본이 남습니다.", "", 6)}`;
      } else if (state.version === "B") {
        body = `
          <div class="field">
            <span class="flabel">프롬프트 요소 카드</span>
            <span class="hint">좋은 프롬프트에 들어갈 요소입니다. 내 프롬프트에 넣은 요소를 체크하세요.</span>
            <div class="cards">${P_CARDS.map(item => `
              <label class="card card-label"><input type="checkbox" data-k="pc_${item.k}">
                <span><b>${item.b}</b><span>${item.s}</span></span>
              </label>
            `).join("")}</div>
          </div>
          ${textareaField("prompt_free", "나의 프롬프트", "§1의 질문과 §2의 데이터 맥락을 바탕으로 직접 쓰세요.", "", 9)}
          <div class="copyrow"><button class="btn primary" type="button" id="pCopy">프롬프트 복사</button><span class="small muted" id="pMiss"></span></div>`;
      } else {
        body = `
          ${textareaField("prompt_free", "나의 프롬프트", "", "", 10)}
          <div class="note"><b>프롬프트 평가 기준</b><ul class="plain">
            <li>AI가 내 자료가 무엇인지(출처, 기간, 변수, 단위) 알 수 있다.</li>
            <li>무엇을 계산하고 어떤 그래프를 그릴지 구체적이다.</li>
            <li>AI가 결측 처리나 가정을 숨기지 못하도록 설명을 요구한다.</li>
            <li>결과를 내가 검증할 수 있는 형태(요약 표, 값 범위)로 받는다.</li>
          </ul></div>
          ${scaleField("p_self", "내 프롬프트는 위 기준을 얼마나 만족하나요?", "거의 못 함", "모두 만족")}
          <div class="copyrow"><button class="btn primary" type="button" id="pCopy">프롬프트 복사</button></div>`;
      }
      html = sectionWrap(4, "AI에게 보낼 프롬프트를 만듭니다. 데이터 파일(CSV 등)은 AI 도구에 함께 첨부하세요.", body);
    } else if (sectionKey === "s4") {
      const checks = checkList();
      let body = `
        <div class="predict-recap">
          <b>나의 예측</b> · ${escapeHtml(answer(state, "trend") || "(아직 없음)")}
          ${answer(state, "p_min") || answer(state, "p_max") ? ` · 범위 ${escapeHtml(answer(state, "p_min"))} ~ ${escapeHtml(answer(state, "p_max"))} ${escapeHtml(answer(state, "p_unit"))}` : ""}
          <br><span class="small muted">${escapeHtml(answer(state, "p_shape"))}</span>
        </div>
        ${textareaField("ai_result", "AI가 만든 결과 기록", "그래프의 모양, 핵심 수치, AI의 설명을 옮겨 적으세요. 그래프 이미지는 따로 저장해 두세요.", "", 4)}`;
      if (state.version === "C") {
        body += `
          <div class="field">
            <span class="flabel">나만의 검증 기준 세우기</span>
            <span class="hint">이 자료에서 '틀린 결과'를 알아챌 수 있는 기준을 세 가지 이상 스스로 정하세요.</span>
            ${[0, 1, 2].map(index => `<input type="text" data-k="cc_${index}" placeholder="검증 기준 ${index + 1}" aria-label="검증 기준 ${index + 1}">`).join("")}
          </div>`;
      }
      body += `<div class="field"><span class="flabel">검증 체크</span><div class="tally" id="tally"></div></div>
        <div class="stack" id="vlist">${checks.map(verificationRow).join("")}</div>`;
      if (state.version === "C") {
        body += `<details class="details"><summary>내 기준을 세운 뒤, 참고 기준과 비교하기</summary><ul class="plain small">
          ${activity.checks.map(item => `<li>${escapeHtml(item.t)}</li>`).join("")}
        </ul></details>`;
      }
      html = sectionWrap(5, "AI 결과를 하나씩 확인합니다. 하나라도 '문제 있음'이면 §5에서 고쳐 다시 요청합니다.", body);
    } else if (sectionKey === "s5") {
      const roundCount = Math.max(1, Number(answer(state, "rounds_n")) || 1);
      const problems = checkList().filter(item => answer(state, `chk_${item.id}`) === "bad");
      let body = problems.length
        ? `<div class="note"><b>§4에서 '문제 있음'으로 표시한 항목</b><ul class="plain">
            ${problems.map(item => `<li>${escapeHtml(item.t)}${answer(state, `chkn_${item.id}`) ? ` — <span class="muted">${escapeHtml(answer(state, `chkn_${item.id}`))}</span>` : ""}</li>`).join("")}
          </ul></div>`
        : '<p class="note">§4에서 \'문제 있음\'으로 표시한 항목이 없습니다. 그래도 더 알고 싶은 점이나 개선할 점이 있으면 기록하세요.</p>';
      for (let index = 0; index < roundCount; index++) {
        body += `
          <div class="round">
            <h3><span class="mono">${index + 1}회차</span> 수정</h3>
            ${textareaField(`r${index}_problem`, "발견한 문제", "무엇이, 왜 잘못되었나요?", "", 2)}
            ${state.version !== "C" ? `
              <div class="field"><span class="flabel">수정 프롬프트 문장 틀 (눌러서 넣기)</span><div class="starters">
                ${STARTERS.map((starter, starterIndex) => `<button type="button" data-starter="${index}|${starterIndex}">${escapeHtml(starter)}</button>`).join("")}
              </div></div>` : ""}
            ${textareaField(`r${index}_prompt`, "수정해서 보낸 프롬프트", "", "", 3)}
            ${textareaField(`r${index}_change`, "결과가 어떻게 바뀌었나요?", "문제가 해결되었는지, 새 문제가 생겼는지 쓰세요.", "", 2)}
          </div>`;
      }
      body += '<div><button class="btn" type="button" id="addRound">수정 회차 추가</button></div>';
      html = sectionWrap(6, "검증에서 찾은 문제를 근거로 프롬프트를 고쳐 다시 요청합니다. 몇 번을 반복했는지도 탐구의 기록입니다.", body);
    } else if (sectionKey === "s6") {
      const level = data.levels[activity.code];
      let body = `
        ${scaleField("post_trust", "탐구를 마친 지금, AI 결과를 그대로 믿어도 된다고 생각하나요?", "전혀 아니다", "매우 그렇다")}
        <p class="small muted" id="trustCmp"></p>
        ${textareaField("conclusion", "탐구 질문에 대한 나의 결론", "§1의 질문에 답하고, 근거가 된 수치를 함께 쓰세요.", "", 4)}
        ${textareaField("who", "AI가 한 일과 내가 판단한 일", "AI는 무엇을 했고, 무엇을 결정한 것은 나였나요?", "", 3)}
        ${textareaField("errors", "AI 결과에서 찾은 오류와 찾아낸 방법", "어떤 단서로 오류를 알아챘나요? 오류가 없었다면 어떻게 확인했나요?", "", 3)}
        ${textareaField("disagree", "AI 설명 중 동의하지 않거나 더 확인이 필요한 부분", "", "", 2)}
        ${textareaField("next", "다음에 AI로 데이터를 탐구할 때 바꿀 점", "", "", 2)}`;
      if (level) {
        body += `
          <div class="field">
            <span class="flabel">성취수준 자기 점검</span>
            <span class="hint">이번 탐구로 도달했다고 생각하는 수준을 고르세요.</span>
            <div class="stack level-options">
              ${["A", "B", "C", "D", "E"].map(letter => `
                <button type="button" class="card" data-pick="self_level|${letter}">
                  <b class="mono">${letter}</b><span>${escapeHtml(level[letter])}</span>
                </button>`).join("")}
            </div>
          </div>`;
      }
      html = sectionWrap(7, "탐구 과정을 되돌아봅니다. 특히 AI를 얼마나, 어떻게 믿었는지 점검하세요.", body);
    } else if (sectionKey === "sum") {
      html = sectionWrap(8, "모든 단계의 기록을 한 번에 모았습니다. 복사해서 한글, 구글 클래스룸, 학습지 제출란에 붙여 넣으세요.", `
        <div class="copyrow">
          <button class="btn primary" type="button" id="sumCopy">전체 기록 복사</button>
          <button class="btn" type="button" id="sumDownload">텍스트 파일로 저장</button>
          <button class="btn" type="button" id="sumPrint">인쇄하기</button>
          <span class="small muted">이 기록은 이 브라우저에만 저장되어 있습니다. 제출 전 꼭 복사해 두세요.</span>
        </div>
        <div class="summary-out" id="sumOut"></div>
        <details class="details">
          <summary>이 활동의 기록 지우기</summary>
          <p class="small muted">이 브라우저에 저장된 이 활동(버전 ${state.version})의 기록을 모두 지웁니다. 되돌릴 수 없습니다.</p>
          <button class="btn sm" type="button" id="wipe">기록 지우기</button>
        </details>`);
    }

    container.innerHTML = html;
    bindFields(container);
    wireSection(sectionKey);
  }

  function wireSection(sectionKey) {
    const container = document.getElementById("sec");
    if (sectionKey === "s1" && state.version === "A") {
      const buildQuestion = () => {
        const parts = ["q_place", "q_period", "q_var", "q_how"].map(key => answer(state, key));
        if (parts.some(Boolean)) {
          const question = `${parts[0] || "○○"}의 ${parts[1] || "○○"} 자료에서 ${parts[2] || "○○"}은(는) ${parts[3] || "어떻게 변할까"}?`;
          state.ans.question = question;
          document.getElementById("f_question").value = question;
        }
      };
      liveHooks.push(key => {
        if (/^q_(place|period|var|how)$/.test(key)) {
          buildQuestion();
          save();
          refreshRail();
        }
      });
      container.querySelectorAll("[data-ex]").forEach(button => {
        button.addEventListener("click", () => {
          state.ans.question = data.activities.find(item => item.id === state.act).questions[Number(button.dataset.ex)];
          document.getElementById("f_question").value = state.ans.question;
          setAnswer("question", state.ans.question);
        });
      });
    }

    if (sectionKey === "s25") {
      container.querySelectorAll('[data-pick^="trend|"]').forEach(button => {
        button.setAttribute("aria-pressed", answer(state, "trend") === button.dataset.pick.split("|")[1]);
      });
    }

    if (sectionKey === "s3") {
      const output = document.getElementById("pOut");
      if (output) {
        const update = () => { output.textContent = assemblePrompt(); };
        update();
        liveHooks.push(update);
        document.getElementById("pEdit").addEventListener("click", () => {
          state.ans.prompt_final = assemblePrompt();
          const field = document.getElementById("f_prompt_final");
          field.value = state.ans.prompt_final;
          field.focus();
          setAnswer("prompt_final", state.ans.prompt_final);
        });
      }
      const missing = document.getElementById("pMiss");
      if (missing) {
        const update = () => {
          const names = P_CARDS.filter(item => !answer(state, `pc_${item.k}`)).map(item => item.b);
          missing.textContent = names.length ? `아직 체크하지 않은 요소: ${names.join(", ")}` : "여섯 요소를 모두 넣었습니다.";
        };
        update();
        liveHooks.push(update);
      }
      const copyButton = document.getElementById("pCopy");
      copyButton.addEventListener("click", () => {
        const text = promptText();
        if (!text.trim()) {
          copyButton.textContent = "프롬프트가 비어 있습니다";
          window.setTimeout(() => { copyButton.textContent = "프롬프트 복사"; }, 1600);
          return;
        }
        if (state.version === "A" && !answer(state, "prompt_final")) {
          state.ans.prompt_final = text;
          const field = document.getElementById("f_prompt_final");
          if (field) field.value = text;
          setAnswer("prompt_final", text);
        }
        copyText(text, copyButton);
      });
    }

    if (sectionKey === "s4") {
      const updateTally = () => {
        const counts = { ok: 0, bad: 0, unk: 0 };
        const checks = checkList();
        checks.forEach(item => {
          const value = answer(state, `chk_${item.id}`);
          if (Object.hasOwn(counts, value)) counts[value]++;
        });
        const remaining = checks.length - counts.ok - counts.bad - counts.unk;
        const tally = document.getElementById("tally");
        if (!tally) return;
        tally.innerHTML = `
          <span class="pill ok">맞음 ${counts.ok}</span>
          <span class="pill bad">문제 있음 ${counts.bad}</span>
          <span class="pill unk">모르겠음 ${counts.unk}</span>
          <span class="small muted">남은 항목 ${remaining}</span>`;
      };
      updateTally();

      const bindChecks = () => {
        container.querySelectorAll("[data-chk]").forEach(button => {
          button.addEventListener("click", () => {
            const key = `chk_${button.dataset.chk}`;
            state.ans[key] = answer(state, key) === button.dataset.v ? "" : button.dataset.v;
            const row = container.querySelector(`[data-row="${button.dataset.chk}"]`);
            row.className = `vrow ${answer(state, key)}`;
            row.querySelectorAll("[data-chk]").forEach(option => {
              option.setAttribute("aria-pressed", answer(state, key) === option.dataset.v);
            });
            updateTally();
            setAnswer(key, state.ans[key]);
          });
        });
      };
      bindChecks();
      if (state.version === "C") {
        let criteriaTimer;
        liveHooks.push(key => {
          if (!/^cc_/.test(key)) return;
          window.clearTimeout(criteriaTimer);
          criteriaTimer = window.setTimeout(() => {
            const list = document.getElementById("vlist");
            list.innerHTML = checkList().map(verificationRow).join("");
            bindFields(list);
            bindChecks();
            updateTally();
          }, 500);
        });
      }
    }

    if (sectionKey === "s5") {
      document.getElementById("addRound").addEventListener("click", () => {
        state.ans.rounds_n = Math.max(1, Number(answer(state, "rounds_n")) || 1) + 1;
        save();
        renderSection();
      });
      container.querySelectorAll("[data-starter]").forEach(button => {
        button.addEventListener("click", () => {
          const [round, starter] = button.dataset.starter.split("|");
          const key = `r${round}_prompt`;
          state.ans[key] = `${answer(state, key) ? `${answer(state, key)}\n` : ""}${STARTERS[Number(starter)]}`;
          const field = document.getElementById(`f_${key}`);
          field.value = state.ans[key];
          field.focus();
          setAnswer(key, state.ans[key]);
        });
      });
    }

    if (sectionKey === "s6") {
      const updateTrustComparison = () => {
        const before = Number(answer(state, "pre_trust"));
        const after = Number(answer(state, "post_trust"));
        const comparison = document.getElementById("trustCmp");
        if (!comparison) return;
        comparison.textContent = before && after
          ? `§0에서 ${before}점 → 지금 ${after}점${after < before
            ? " (신뢰가 낮아졌습니다. 그 이유를 아래에 써 보세요.)"
            : after > before
              ? " (신뢰가 높아졌습니다. 무엇을 확인했기 때문인가요?)"
              : " (변화 없음)"}`
          : before ? `§0에서는 ${before}점이었습니다.` : "";
      };
      updateTrustComparison();
      liveHooks.push(updateTrustComparison);
    }

    if (sectionKey === "sum") {
      document.getElementById("sumOut").textContent = summaryText();
      document.getElementById("sumCopy").addEventListener("click", event => copyText(summaryText(), event.currentTarget));
      document.getElementById("sumDownload").addEventListener("click", downloadSummary);
      document.getElementById("sumPrint").addEventListener("click", () => window.print());
      document.getElementById("wipe").addEventListener("click", event => {
        const button = event.currentTarget;
        if (button.dataset.armed) {
          window.clearTimeout(saveTimer);
          state.ans = {};
          actions.writeStorage(answerKey(state), {});
          state.step = 0;
          state.ans._step = 0;
          save();
          renderWork();
        } else {
          button.dataset.armed = "1";
          button.textContent = "한 번 더 누르면 지워집니다";
          button.classList.add("primary");
        }
      });
    }
  }

  function footer() {
    return actions.footer();
  }

  if (state.act) {
    loadCurrentAnswer();
    renderWork();
  } else {
    renderStart();
  }
}
