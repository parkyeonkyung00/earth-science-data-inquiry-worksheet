import { SUBJ } from "./constants.js";
import { CONFIG } from "./config.js";
import { renderTeacher } from "./teacher.js";
import { parseCode, renderStudent } from "./student.js";

const app = document.getElementById("app");
const modeTeacher = document.getElementById("modeT");
const modeStudent = document.getElementById("modeS");
const surveyLink = document.getElementById("surveyLink");
let worksheetData = null;
let flushStudentAnswers = null;

function reportStorageError(error) {
  console.error("워크시트 브라우저 저장 오류", error);
  if (!document.getElementById("storageWarning")) {
    const warning = document.createElement("p");
    warning.id = "storageWarning";
    warning.className = "error wrap";
    warning.setAttribute("role", "alert");
    warning.textContent = "브라우저 저장소를 읽거나 저장하지 못했습니다. 자동 저장을 신뢰하지 말고 ‘정리’에서 기록을 복사·저장하세요.";
    app.before(warning);
  }
}

const state = {
  mode: "teacher",
  subj: "es",
  sel: null,
  teacherActivity: null,
  version: "A",
  act: null,
  step: 0,
  ans: {},
};

function readStorage(key) {
  try {
    const value = localStorage.getItem(key);
    return value ? JSON.parse(value) : null;
  } catch (error) {
    reportStorageError(error);
    return null;
  }
}

function writeStorage(key, value) {
  try {
    localStorage.setItem(key, JSON.stringify(value));
  } catch (error) {
    reportStorageError(error);
  }
}

function saveLastView() {
  writeStorage("evc:last", {
    mode: state.mode,
    subj: state.subj,
    sel: state.sel,
    teacherActivity: state.teacherActivity,
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
    <p class="foot">성취기준 출처: 교육부 고시 제2022-33호 [별책 9] 과학과 교육과정(62개 원문 대조). 성취수준: 2022 개정 교육과정에 따른 고등학교 과학과 선택과목 성취수준(현장 보급본). 활동은 교과서와 연계하거나 새로 구성했으며 교과서 본문은 옮기지 않았습니다. 공개 관측값과 실험·문헌·교사 제공 모형 자료를 구별해 사용하세요. A·B·C 구조는 KACE 투고본 표 3을 따르며, 교육적 효과가 검증되었다는 뜻은 아닙니다. 입력 내용은 이 브라우저에만 저장됩니다.</p>
    <p class="foot-meta">
      <span>버전: ${escapeHtml(CONFIG.appVersion)}</span>
      <span>연구자: ${escapeHtml(CONFIG.researcher)}</span>
      ${contact ? `<a href="mailto:${escapeHtml(contact)}">문의: ${escapeHtml(contact)}</a>` : ""}
    </p>`;
}

function setMode(mode, previewStep) {
  if (flushStudentAnswers) flushStudentAnswers();
  flushStudentAnswers = null;
  state.mode = mode;
  state.previewStep = Number.isInteger(previewStep) ? previewStep : null;
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
      registerFlush: flush => { flushStudentAnswers = flush; },
    });
  }
}

async function loadData() {
  const files = [
    ["activities", "../data/activities.json"],
    ["extraActivities", "../data/activities-extra.json"],
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

  const data = Object.fromEntries(entries);
  data.activities.push(...data.extraActivities);
  const ids = new Set();
  for (const activity of data.activities) {
    if (ids.has(activity.id) || !data.standards[activity.code] || !activity.questions?.length
      || !activity.vars?.length || !activity.checks?.length || !activity.tasks?.length) {
      throw new Error(`활동 데이터의 ID·성취기준·필수 필드를 확인하세요: ${activity.id}`);
    }
    ids.add(activity.id);
  }
  return data;
}

function restoreState(data) {
  const last = readStorage("evc:last");
  if (last) {
    state.mode = last.mode === "student" ? "student" : "teacher";
    state.subj = SUBJ[last.subj] ? last.subj : "es";
    state.sel = typeof last.sel === "string" ? last.sel : null;
    state.teacherActivity = data.activities.some(a => a.id === last.teacherActivity) ? last.teacherActivity : null;
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

window.addEventListener("pagehide", () => {
  if (flushStudentAnswers) flushStudentAnswers();
  saveLastView();
});

export { readStorage, saveLastView, state, writeStorage };
