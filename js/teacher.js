import { PREFIX, SUBJ, SUBJ_ORDER, UNITS, VERSIONS } from "./constants.js";

const escapeHtml = value => String(value == null ? "" : value).replace(/[&<>"']/g, character => ({
  "&": "&amp;",
  "<": "&lt;",
  ">": "&gt;",
  '"': "&quot;",
  "'": "&#39;",
}[character]));

function classCode(id, version) {
  return `${id.replace("-", "").toUpperCase()}-${version}`;
}

function activityByCode(activities, code) {
  return activities.find(activity => activity.code === code);
}

function levelTable(levels, code) {
  const level = levels[code];
  if (!level) return "";

  return `
    <div class="field">
      <span class="label">성취수준 (A~E)</span>
      <div class="tbl-wrap">
        <table class="levels"><tbody>
          ${["A", "B", "C", "D", "E"].map(letter => `
            <tr><td>${letter}</td><td>${escapeHtml(level[letter])}</td></tr>
          `).join("")}
        </tbody></table>
      </div>
    </div>`;
}

function activityDetails(data, code, state) {
  const activity = activityByCode(data.activities, code);
  const level = data.levels[code];
  let html = `
    <div class="panel stack">
      <span class="label">${SUBJ[state.subj]} · [${escapeHtml(code)}]</span>
      <p class="std-quote">${escapeHtml(data.standards[code])}</p>`;

  if (level?.act?.length) {
    html += `
      <div class="field">
        <span class="label">성취수준 문서의 탐구 활동</span>
        <ul class="plain">${level.act.map(item => `<li>${escapeHtml(item)}</li>`).join("")}</ul>
      </div>`;
  }

  if (!activity) {
    html += `
      <p class="note">이 성취기준에는 아직 데이터 탐구 활동이 구성되어 있지 않습니다. 실제 관측 자료로 탐구하기 어려운 개념 중심 성취기준이거나, 실험·조사 중심 활동이 더 알맞은 경우입니다.</p>
      ${levelTable(data.levels, code)}
    </div>`;
    return html;
  }

  html += `</div>
    <div class="panel stack">
      <div>
        <span class="label">데이터 탐구 활동 · ${escapeHtml(activity.time)}</span>
        <h2 class="activity-title">${escapeHtml(activity.title)}</h2>
      </div>
      <dl class="kv">
        <dt>탐구 질문 예</dt>
        <dd><ul class="plain">${activity.questions.map(question => `<li>${escapeHtml(question)}</li>`).join("")}</ul></dd>
        <dt>데이터</dt>
        <dd>
          ${escapeHtml(activity.data.name)} · ${escapeHtml(activity.data.org)}
          ${activity.data.url ? `<br><a href="${escapeHtml(activity.data.url)}" target="_blank" rel="noopener">${escapeHtml(activity.data.url)}</a>` : ""}
          <div class="small muted data-how">${escapeHtml(activity.data.how)}</div>
        </dd>
        <dt>변수와 단위</dt>
        <dd><div class="chips">${activity.vars.map(variable => `
          <span class="chip">${escapeHtml(variable.n)} <span class="mono muted">${escapeHtml(variable.u)}</span></span>
        `).join("")}</div></dd>
        <dt>교과서 연계</dt>
        <dd>${activity.textbook ? escapeHtml(activity.textbook) : '<span class="muted">교과서 연계 정보가 없습니다.</span>'}</dd>
        <dt>권장 그래프</dt>
        <dd>${escapeHtml(activity.chart)}</dd>
        <dt>AI가 자주 하는 실수</dt>
        <dd><ul class="plain">${activity.pitfalls.map(pitfall => `<li>${escapeHtml(pitfall)}</li>`).join("")}</ul></dd>
        <dt>수업 팁</dt>
        <dd>${escapeHtml(activity.tip)}</dd>
      </dl>
    </div>
    <div class="panel stack">
      <div>
        <span class="label">비계 수준 고르기</span>
        <p class="small muted panel-description">학생 수준에 맞는 버전을 고르면 수업 코드가 만들어집니다. 같은 활동을 A → B → C 순서로 반복해 비계를 점차 줄일 수 있습니다.</p>
      </div>
      <div class="ver-grid" role="group" aria-label="비계 버전">
        ${Object.entries(VERSIONS).map(([version, details]) => `
          <button type="button" class="ver" data-ver="${version}" aria-pressed="${version === state.version}">
            <b>${version}</b> <strong>${details.name}</strong>
            <div class="small muted version-description">${details.desc}</div>
          </button>
        `).join("")}
      </div>
      <div class="code-box">
        <span class="label">수업 코드</span>
        <span class="mono code-value">${classCode(activity.id, state.version)}</span>
        <button class="btn sm" type="button" data-copy-code>코드 복사</button>
        <button class="btn sm primary" type="button" data-preview>학생 화면으로 열기</button>
      </div>
      <p class="small muted">학생은 학생 화면에서 이 코드를 입력합니다. 이 페이지 주소 끝에 <span class="mono">#${activity.id.replace("-", "")}${state.version.toLowerCase()}</span>를 붙인 링크를 나눠 주면 코드 입력 없이 바로 열립니다.</p>
    </div>`;

  if (level) {
    html += `
      <div class="panel">
        ${levelTable(data.levels, code)}
        <p class="small muted level-description">버전 C에서는 이 성취수준이 학생 화면의 목표로 함께 표시됩니다.</p>
      </div>`;
  }
  return html;
}

function copyCode(button, code) {
  const originalText = button.textContent;
  const copied = () => {
    button.textContent = "복사됨";
    window.setTimeout(() => { button.textContent = originalText; }, 1600);
  };
  const fallback = () => {
    const input = document.createElement("textarea");
    input.value = code;
    input.setAttribute("readonly", "");
    input.className = "copy-input";
    document.body.appendChild(input);
    input.select();
    const succeeded = document.execCommand("copy");
    input.remove();
    if (succeeded) copied();
    else button.textContent = "직접 선택해 복사하세요";
  };

  if (!navigator.clipboard?.writeText) {
    fallback();
    return;
  }
  navigator.clipboard.writeText(code).then(copied, fallback);
}

export function renderTeacher(app, data, state, actions) {
  const subject = state.subj;
  const standards = Object.keys(data.standards).filter(code => code.startsWith(PREFIX[subject]));
  if (!state.sel || !state.sel.startsWith(PREFIX[subject])) {
    const firstActivity = data.activities.find(activity => activity.subj === subject);
    state.sel = firstActivity ? firstActivity.code : standards[0];
  }

  const activityCount = data.activities.filter(activity => activity.subj === subject).length;
  let navigation = `
    <div class="tabs" role="group" aria-label="과목">
      ${SUBJ_ORDER.map(key => `
        <button class="tab" type="button" data-subj="${key}" aria-pressed="${key === subject}">${SUBJ[key]}</button>
      `).join("")}
    </div>
    <p class="small muted">성취기준 ${standards.length}개 중 데이터 탐구 활동 ${activityCount}개</p>`;

  UNITS[subject].forEach(([unit, name]) => {
    const unitStandards = standards.filter(code => code.slice(PREFIX[subject].length, PREFIX[subject].length + 2) === unit);
    navigation += `
      <div class="unit">
        <h3>(${Number(unit)}) ${escapeHtml(name)}</h3>
        ${unitStandards.map(code => {
          const activity = activityByCode(data.activities, code);
          return `
            <button type="button" class="std ${activity ? "" : "none"}" data-code="${escapeHtml(code)}" aria-current="${code === state.sel}">
              <span class="code">[${escapeHtml(code)}]</span>
              <span class="act">${activity ? escapeHtml(activity.title) : "데이터 탐구 활동 없음"}</span>
            </button>`;
        }).join("")}
      </div>`;
  });

  const introDismissed = actions.readStorage("evc:teacher-intro-dismissed");
  app.innerHTML = `
    ${introDismissed ? "" : `
      <aside class="intro-note" id="teacherIntro" aria-label="연구용 프로그램 안내">
        <div>
          <strong>연구용 프로그램 안내</strong>
          <p>이 프로그램은 연구를 위한 검토용입니다. 입력 내용은 이 브라우저에만 저장되며 연구자에게 전송되지 않습니다.</p>
          <p>검토 순서: 교사 화면 → 활동 선택 → 버전 비교 → 학생 화면으로 열기</p>
        </div>
        <button class="btn sm" type="button" id="dismissIntro" aria-label="안내 닫기">닫기</button>
      </aside>`}
    <div class="teacher">
      <nav aria-label="성취기준 목록">${navigation}</nav>
      <section id="tdetail" class="teacher-detail">${activityDetails(data, state.sel, state)}</section>
    </div>
    ${actions.footer()}`;

  const renderAgain = () => renderTeacher(app, data, state, actions);
  app.querySelector("#dismissIntro")?.addEventListener("click", () => {
    actions.writeStorage("evc:teacher-intro-dismissed", true);
    document.getElementById("teacherIntro")?.remove();
  });
  app.querySelectorAll("[data-subj]").forEach(button => {
    button.addEventListener("click", () => {
      state.subj = button.dataset.subj;
      state.sel = null;
      actions.saveLastView();
      renderAgain();
    });
  });
  app.querySelectorAll("[data-code]").forEach(button => {
    button.addEventListener("click", () => {
      state.sel = button.dataset.code;
      actions.saveLastView();
      renderAgain();
      if (window.innerWidth < 820) {
        document.getElementById("tdetail").scrollIntoView({ behavior: "smooth" });
      }
    });
  });
  function bindDetailActions() {
    const detail = document.getElementById("tdetail");
    const activity = activityByCode(data.activities, state.sel);
    detail.querySelector("[data-copy-code]")?.addEventListener("click", event => {
      copyCode(event.currentTarget, classCode(activity.id, state.version));
    });
    detail.querySelector("[data-preview]")?.addEventListener("click", () => {
      state.act = activity.id;
      state.step = 0;
      actions.saveLastView();
      actions.setMode("student");
    });
    detail.querySelectorAll("[data-ver]").forEach(button => {
      button.addEventListener("click", () => {
        state.version = button.dataset.ver;
        actions.saveLastView();
        detail.innerHTML = activityDetails(data, state.sel, state);
        bindDetailActions();
      });
    });
  }

  bindDetailActions();
}
