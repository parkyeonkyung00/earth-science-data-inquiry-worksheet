import { PREFIX, SCAFFOLDS, SUBJ, SUBJ_ORDER, UNITS, VERSIONS } from "./constants.js";
import { CONFIG } from "./config.js";

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

function activityByCode(activities, code, id) {
  return activities.find(activity => activity.code === code && activity.id === id)
    || activities.find(activity => activity.code === code);
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
  const activity = activityByCode(data.activities, code, state.teacherActivity);
  const level = data.levels[code];
  let html = `
    <div class="panel stack">
      <span class="label">${SUBJ[state.subj]} · [${escapeHtml(code)}]</span>
      <p class="std-quote">${escapeHtml(data.standards[code])}</p>
      <p class="small muted">교육부 고시 제2022-33호 [별책 9] 과학과 교육과정 · <a href="https://www.moe.go.kr/boardCnts/viewRenew.do?boardID=141&amp;boardSeq=93458&amp;m=0404" target="_blank" rel="noopener noreferrer">교육부 원문 확인</a></p>
      ${code === "12지구01-03" ? '<p class="note">고시 원문의 “위상 영상” 표기를 보존했습니다. 이 활동에서는 관련 탐구 활동과 성취수준에 따라 위성 영상을 사용합니다.</p>' : ""}`;

  if (level?.act?.length) {
    html += `
      <div class="field">
        <span class="label">성취수준 문서의 탐구 활동</span>
        <ul class="plain">${level.act.map(item => `<li>${escapeHtml(item)}</li>`).join("")}</ul>
      </div>`;
  }

  if (!activity) {
    html += `
      <p class="note">이 성취기준은 현재 지구과학 중심 활동 범위 밖입니다. 데이터 탐구가 불가능하다는 뜻은 아닙니다. 성취기준과 성취수준을 참고해 다른 과학 영역의 활동으로 구성할 수 있습니다.</p>
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
        <dt>교육과정 연계 범위</dt>
        <dd>${escapeHtml(activity.alignment || "아래 작업을 통해 성취기준의 자료 분석·해석 요소를 탐구합니다. 데이터 분석만으로 성취기준 전체를 달성했다고 판정하지 않고, 관련 개념 설명과 근거에 기반한 결론을 함께 확인합니다.")}</dd>
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
        <dt>분석·검증 시 주의점</dt>
        <dd><ul class="plain">${activity.pitfalls.map(pitfall => `<li>${escapeHtml(pitfall)}</li>`).join("")}</ul></dd>
        ${activity.tip ? `<dt>수업 팁</dt><dd>${escapeHtml(activity.tip)}</dd>` : ""}
      </dl>
    </div>
    <div class="panel stack">
      <div>
        <span class="label">비계 수준 고르기</span>
        <p class="small muted panel-description">세 버전은 같은 성취기준과 활동을 사용하고 지원의 양만 다릅니다. 비계 버전 A·B·C는 성취수준 A~E와 다른 구분입니다.</p>
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
        <p class="small muted level-description">성취수준은 교육과정 평가 참고 자료이며 비계 버전과 대응하지 않습니다. 세 버전 모두 같은 성취기준을 목표로 합니다.</p>
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
    <p class="small muted">성취기준 ${standards.length}개 · 데이터 탐구 활동 ${activityCount}개</p>`;

  UNITS[subject].forEach(([unit, name]) => {
    const unitStandards = standards.filter(code => code.slice(PREFIX[subject].length, PREFIX[subject].length + 2) === unit);
    navigation += `
      <div class="unit">
        <h3>(${Number(unit)}) ${escapeHtml(name)}</h3>
        ${unitStandards.map(code => {
          const activities = data.activities.filter(activity => activity.code === code);
          const activity = activities[0];
          return `
            <button type="button" class="std ${activity ? "" : "none"}" data-code="${escapeHtml(code)}" aria-current="${code === state.sel}">
              <span class="code">[${escapeHtml(code)}]</span>
              <span class="act">${activity ? `${escapeHtml(activity.title)}${activities.length > 1 ? ` 외 ${activities.length - 1}개` : ""}` : "지구과학 중심 활동 범위 밖"}</span>
            </button>`;
        }).join("")}
      </div>`;
  });

  const introDismissed = actions.readStorage("evc:teacher-intro-dismissed");
  const selectedActivity = activityByCode(data.activities, state.sel, state.teacherActivity);
  const review = actions.readStorage("evc:teacher-review:v2") || {};
  app.innerHTML = `
    ${introDismissed ? "" : `
      <aside class="intro-note" id="teacherIntro" aria-label="연구용 프로그램 안내">
        <div>
          <strong>연구용 프로그램 안내</strong>
          <p>이 프로그램은 연구를 위한 검토용입니다. 입력 내용은 이 브라우저에만 저장되며 연구자에게 전송되지 않습니다.</p>
          <p>검토 순서: 성취기준·활동 확인 → 아래 표에서 같은 단계의 A·B·C 비교 → 검증 분기·수정 반복 확인 → 외부 설문 응답</p>
        </div>
        <button class="btn sm" type="button" id="dismissIntro" aria-label="안내 닫기">닫기</button>
      </aside>`}
    <section class="panel stack review-panel" aria-labelledby="reviewTitle">
      <h1 id="reviewTitle">교사 검토 안내 · 논문의 8개 단계로 비교하기</h1>
      <p>활동은 논문의 대표 사례로 제한하지 않습니다. 통합과학1·2, 지구과학, 지구시스템과학의 전체 성취기준 ${Object.keys(data.standards).length}개에 데이터 탐구 ${data.activities.length}개를 연결했습니다. 지구과학 외 통합과학 영역도 포함하며, 공개 관측·실험·문헌 표·교사 제공 모형 자료를 구분합니다. A·B·C는 KACE 투고본 표 3의 비계 구조를 따릅니다.</p>
      <p class="small">설문 평정 대상은 §0·§1·§2·§2.5·§3·§4·§5·§6의 <b>8개 단계</b>입니다. ‘정리’는 내보내기 기능이며 아홉 번째 평정 항목이 아닙니다. 관련성 4점(1 전혀 타당하지 않음 ~ 4 매우 타당함)과 내용 타당도·실무 적합도·명확성·실용성 의견을 외부 설문에서 작성합니다.</p>
      <p class="small muted">아래 체크는 개인 검토 메모이며 설문 응답이 아닙니다. 연구자에게 전송되지 않습니다. 학생 화면에서는 상단 ‘교사’를 눌러 돌아올 수 있습니다.</p>
      <div class="tbl-wrap"><table class="review-table">
        <caption>현재 활동: ${selectedActivity ? escapeHtml(selectedActivity.title) : "아래에서 활동 선택"} · 비계 버전별 단계 비교</caption>
        <thead><tr><th>단계 / 설계원리</th>${Object.entries(VERSIONS).map(([v, d]) => `<th>${v} · ${d.name}</th>`).join("")}<th>검토 메모</th></tr></thead>
        <tbody>${SCAFFOLDS.map((row, index) => `<tr>
          <th>${row.section}<br><span class="small muted">${row.principle}</span></th>
          ${["A", "B", "C"].map(v => `<td>${row[v]}<br><button class="btn sm" type="button" data-review-open="${index}|${v}" ${selectedActivity ? "" : "disabled"}>${v} 단계 열기</button></td>`).join("")}
          <td><label class="check"><input type="checkbox" data-reviewed="${index}" ${review[index] ? "checked" : ""}>확인</label></td>
        </tr>`).join("")}</tbody>
      </table></div>
      <p class="note">검증 흐름: §4에서 결과와 예측을 비교하고 모든 검증 판정을 기록해야 합니다. 문제·모름·예측 불일치가 있으면 §5 → §3 → §4로 재검증합니다. 예측과 다르다는 이유만으로 AI 결과가 틀렸다고 단정하지 않습니다. 모두 확인되고 예측과 일치하면 §6으로 이동합니다.</p>
      <p class="small muted">외부 설문의 동의 안내와 문항을 확인한 후 자발적으로 참여하세요. 웹앱의 기록은 설문으로 자동 전달되지 않습니다. AI 오류 실험 결과는 이 검토 화면에 제시하지 않습니다.</p>
      ${CONFIG.surveyUrl ? `<a class="btn primary" href="${escapeHtml(CONFIG.surveyUrl)}" target="_blank" rel="noopener noreferrer">검토 후 설문 참여하기 ↗</a>` : '<p class="note">설문 링크가 아직 설정되지 않았습니다.</p>'}
    </section>
    <div class="teacher">
      <nav aria-label="성취기준 목록">${navigation}</nav>
      <section id="tdetail" class="teacher-detail">
        ${selectedActivity ? `<div class="panel field"><label for="activitySelect">이 성취기준의 데이터 탐구 활동</label><select id="activitySelect">${data.activities.filter(a => a.code === state.sel).map(a => `<option value="${a.id}" ${a.id === selectedActivity.id ? "selected" : ""}>${escapeHtml(a.title)}</option>`).join("")}</select></div>` : ""}
        ${activityDetails(data, state.sel, state)}
      </section>
    </div>
    ${actions.footer()}`;

  const renderAgain = () => renderTeacher(app, data, state, actions);
  app.querySelectorAll("[data-reviewed]").forEach(input => input.addEventListener("change", () => {
    review[input.dataset.reviewed] = input.checked;
    actions.writeStorage("evc:teacher-review:v2", review);
  }));
  app.querySelectorAll("[data-review-open]").forEach(button => button.addEventListener("click", () => {
    const [step, version] = button.dataset.reviewOpen.split("|");
    state.act = selectedActivity.id;
    state.version = version;
    actions.setMode("student", Number(step));
  }));
  app.querySelector("#activitySelect")?.addEventListener("change", event => {
    state.teacherActivity = event.target.value;
    actions.saveLastView();
    renderAgain();
  });
  app.querySelector("#dismissIntro")?.addEventListener("click", () => {
    actions.writeStorage("evc:teacher-intro-dismissed", true);
    document.getElementById("teacherIntro")?.remove();
  });
  app.querySelectorAll("[data-subj]").forEach(button => {
    button.addEventListener("click", () => {
      state.subj = button.dataset.subj;
      state.sel = null;
      state.teacherActivity = null;
      actions.saveLastView();
      renderAgain();
    });
  });
  app.querySelectorAll("[data-code]").forEach(button => {
    button.addEventListener("click", () => {
      state.sel = button.dataset.code;
      state.teacherActivity = null;
      actions.saveLastView();
      renderAgain();
      if (window.innerWidth < 820) {
        document.getElementById("tdetail").scrollIntoView({ behavior: "smooth" });
      }
    });
  });
  function bindDetailActions() {
    const detail = document.getElementById("tdetail");
    const activity = activityByCode(data.activities, state.sel, state.teacherActivity);
    detail.querySelector("[data-copy-code]")?.addEventListener("click", event => {
      copyCode(event.currentTarget, classCode(activity.id, state.version));
    });
    detail.querySelector("[data-preview]")?.addEventListener("click", () => {
      state.act = activity.id;
      state.step = 0;
      actions.saveLastView();
      actions.setMode("student", 0);
    });
    detail.querySelectorAll("[data-ver]").forEach(button => {
      button.addEventListener("click", () => {
        state.version = button.dataset.ver;
        actions.saveLastView();
        renderAgain();
      });
    });
  }

  bindDetailActions();
}
