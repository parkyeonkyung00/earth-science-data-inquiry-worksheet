import { SUBJ } from "./constants.js";
import { CONFIG } from "./config.js";
import { renderTeacher } from "./teacher.js";
import { parseCode, renderStudent } from "./student.js";

const app = document.getElementById("app");
const modeTeacher = document.getElementById("modeT");
const modeStudent = document.getElementById("modeS");
const surveyLink = document.getElementById("surveyLink");
let worksheetData = null;

const state = {
  mode: "teacher",
  subj: "es",
  sel: null,
  version: "A",
  act: null,
  step: 0,
  ans: {},
};

function readStorage(key) {
  try {
    const value = localStorage.getItem(key);
    return value ? JSON.parse(value) : null;
  } catch {
    return null;
  }
}

function writeStorage(key, value) {
  try {
    localStorage.setItem(key, JSON.stringify(value));
  } catch {
    // The worksheet remains usable when browser storage is unavailable.
  }
}

function saveLastView() {
  writeStorage("evc:last", {
    mode: state.mode,
    subj: state.subj,
    sel: state.sel,
    version: state.version,
    act: state.act,
    step: state.step,
  });
}

function escapeHtml(value) {
  return String(value).replace(/[&<>"']/g, character => ({
    "&": "&amp;",
    "<": "&lt;",
    ">": "&gt;",
    '"': "&quot;",
    "'": "&#39;",
  })[character]);
}

function footerMarkup() {
  const contact = CONFIG.contact.trim();
  return `
    <p class="foot">성취기준 출처: 교육부 고시 제2022-33호 과학과 교육과정. 성취수준과 탐구 활동: 2022 개정 교육과정에 따른 고등학교 과학과 선택과목 성취수준(현장 보급본). 통합과학 활동은 비상교육, 지구과학·지구시스템과학 활동은 미래엔 교과서의 탐구 흐름에 맞추었고, 교과서 본문은 옮기지 않았습니다. 데이터 탐구 활동과 검증 항목은 이 워크시트를 위해 새로 구성한 것입니다. 입력한 내용은 이 브라우저에만 저장됩니다.</p>
    <p class="foot-meta">
      <span>버전: ${escapeHtml(CONFIG.appVersion)}</span>
      <span>연구자: ${escapeHtml(CONFIG.researcher)}</span>
      ${contact ? `<a href="mailto:${escapeHtml(contact)}">문의: ${escapeHtml(contact)}</a>` : ""}
    </p>`;
}

function setMode(mode) {
  state.mode = mode;
  modeTeacher.setAttribute("aria-pressed", String(mode === "teacher"));
  modeStudent.setAttribute("aria-pressed", String(mode === "student"));
  saveLastView();
  render();
}

function render() {
  if (!worksheetData) return;
  surveyLink.hidden = state.mode !== "teacher" || !CONFIG.surveyUrl.trim();
  if (!surveyLink.hidden) surveyLink.href = CONFIG.surveyUrl;
  if (state.mode === "teacher") {
    document.getElementById("topSub").textContent = "교사 화면 · 성취기준에서 활동과 비계 수준 고르기";
    renderTeacher(app, worksheetData, state, {
      footer: footerMarkup,
      readStorage,
      setMode,
      saveLastView,
      writeStorage,
    });
  } else {
    document.getElementById("topSub").textContent = "학생 화면 · 수업 코드로 시작하기";
    renderStudent(app, worksheetData, state, {
      footer: footerMarkup,
      setMode,
      readStorage,
      writeStorage,
      saveLastView,
    });
  }
}

async function loadData() {
  const files = [
    ["activities", "../data/activities.json"],
    ["standards", "../data/standards.json"],
    ["levels", "../data/levels.json"],
  ];

  const entries = await Promise.all(files.map(async ([name, path]) => {
    const response = await fetch(new URL(path, import.meta.url));
    if (!response.ok) {
      throw new Error(`Failed to load ${name}: HTTP ${response.status}`);
    }
    return [name, await response.json()];
  }));

  return Object.fromEntries(entries);
}

function restoreState(data) {
  const last = readStorage("evc:last");
  if (last) {
    state.mode = last.mode === "student" ? "student" : "teacher";
    state.subj = SUBJ[last.subj] ? last.subj : "es";
    state.sel = typeof last.sel === "string" ? last.sel : null;
    state.version = ["A", "B", "C"].includes(last.version) ? last.version : "A";
    state.step = Number.isInteger(last.step) && last.step >= 0 && last.step < 9 ? last.step : 0;
    state.act = data.activities.some(activity => activity.id === last.act) ? last.act : null;
  }
  modeTeacher.setAttribute("aria-pressed", String(state.mode === "teacher"));
  modeStudent.setAttribute("aria-pressed", String(state.mode === "student"));
}

modeTeacher.addEventListener("click", () => setMode("teacher"));
modeStudent.addEventListener("click", () => setMode("student"));

try {
  worksheetData = await loadData();
  restoreState(worksheetData);
  const sharedActivity = parseCode(location.hash, worksheetData.activities);
  if (sharedActivity) {
    state.mode = "student";
    state.act = sharedActivity.id;
    state.version = sharedActivity.version;
    state.ans = readStorage(`evc:${state.act}:${state.version}`) || {};
    state.step = Number.isInteger(state.ans._step) ? state.ans._step : 0;
    saveLastView();
  }
  modeTeacher.setAttribute("aria-pressed", String(state.mode === "teacher"));
  modeStudent.setAttribute("aria-pressed", String(state.mode === "student"));
  render();
} catch (error) {
  console.error("워크시트 자료를 불러오지 못했습니다.", error);
  app.innerHTML = '<p class="error" role="alert">자료를 불러오지 못했습니다. 페이지를 새로고침해 주세요.</p>';
}

window.addEventListener("pagehide", saveLastView);

export { readStorage, saveLastView, state, writeStorage };
