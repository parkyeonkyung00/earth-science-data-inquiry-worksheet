import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";
import { COMMON_CHECKS, PREFIX, SCAFFOLDS, SECTIONS, questionChoices } from "../js/constants.js";
import { parseCode, verificationStatus } from "../js/student.js";
import { CONFIG } from "../js/config.js";

const readJson = async name => JSON.parse(await readFile(new URL(`../data/${name}.json`, import.meta.url), "utf8"));
const [original, extra, standards] = await Promise.all(["activities", "activities-extra", "standards"].map(readJson));
const activities = [...original, ...extra];

test("기존 21개와 추가 42개 활동이 전체 62개 성취기준을 포함한다", () => {
  assert.equal(original.length, 21);
  assert.equal(extra.length, 42);
  assert.equal(Object.keys(standards).length, 62);
  assert.equal(new Set(activities.map(a => a.id)).size, 63);
  assert.deepEqual(new Set(activities.map(a => a.code)), new Set(Object.keys(standards)));
  for (const activity of activities) {
    assert.ok(standards[activity.code], activity.id);
    assert.ok(activity.code.startsWith(PREFIX[activity.subj]), activity.id);
    for (const field of ["title", "chart", "predict", "tip", "time", "textbook"]) {
      if (field === "tip" && extra.includes(activity)) continue;
      assert.ok(typeof activity[field] === "string" && activity[field].trim(), `${activity.id}: ${field}`);
    }
    for (const field of ["questions", "vars", "tasks", "checks", "pitfalls"]) {
      assert.ok(activity[field].length >= 2, `${activity.id}: ${field}`);
    }
    assert.ok(activity.data.name && activity.data.org && activity.data.how, activity.id);
    if (activity.data.url) assert.equal(new URL(activity.data.url).protocol, "https:");
  }
});

test("모든 활동의 A 질문은 정확히 4개이며 기존 바로가기 코드가 세 버전에서 유효하다", () => {
  for (const activity of activities) {
    assert.equal(questionChoices(activity).length, 4, activity.id);
    for (const version of ["A", "B", "C"]) {
      const code = `${activity.id.replace("-", "")}-${version}`;
      assert.deepEqual(parseCode(code, activities), { id: activity.id, version });
      assert.deepEqual(parseCode(`#${code.toLowerCase()}`, activities), { id: activity.id, version });
    }
  }
  for (const invalid of ["es9999a", "es0105d", "", "ES0105", "<script>"]) assert.equal(parseCode(invalid, activities), null);
});

test("논문 구조는 8개 단계와 별도 정리 단계, 공통 검증 5개다", () => {
  assert.equal(SCAFFOLDS.length, 8);
  assert.equal(SECTIONS.length, 9);
  assert.equal(SECTIONS[3].n, "§2.5");
  assert.equal(SECTIONS[8].key, "sum");
  assert.equal(COMMON_CHECKS.length, 5);
  for (const row of SCAFFOLDS) for (const v of ["A", "B", "C"]) assert.ok(row[v]);
});

test("빙하 코어와 기별 지층·화석은 정확한 성취기준에 각각 연결한다", () => {
  assert.equal(activities.find(a => a.id === "es-0202").code, "12지구01-06");
  assert.equal(activities.find(a => a.id === "es-0206").code, "12지구02-02");
  assert.ok(standards["12지구02-02"].includes("화석"));
});

const checks = [{ id: "c0" }, { id: "a0" }];
const complete = { ai_result: "관측값으로 그래프 확인", prediction_match: "match",
  trend: "증가", p_shape: "오른쪽 위로 증가", why: "배운 개념에 따른 근거",
  chk_c0: "ok", chkn_c0: "원자료 첫 행 비교", chk_a0: "ok", chkn_a0: "계산식 대조" };

test("검증 기록·예측 비교·모든 판정과 근거가 없으면 통과할 수 없다", () => {
  for (const version of ["A", "B"]) {
    assert.equal(verificationStatus(version, complete, checks), "pass");
    for (const key of Object.keys(complete)) {
      if (version === "B" && key === "why") continue;
      const missing = { ...complete };
      delete missing[key];
      assert.equal(verificationStatus(version, missing, checks), "incomplete", `${version}: ${key}`);
    }
    assert.equal(verificationStatus("invalid", complete, checks), "incomplete");
    assert.equal(verificationStatus(version, { ...complete, chk_c0: "invalid" }, checks), "incomplete");
    assert.equal(verificationStatus(version, { ...complete, prediction_match: "invalid" }, checks), "incomplete");
    assert.equal(verificationStatus(version, { ...complete, chkn_c0: "   " }, checks), "incomplete");
  }
});

test("문제·모름 또는 예측 불일치면 수정 경로로 보낸다", () => {
  for (const version of ["A", "B"]) {
    for (const judgment of ["bad", "unk"]) assert.equal(verificationStatus(version, { ...complete, chk_c0: judgment }, checks), "revise");
    assert.equal(verificationStatus(version, { ...complete, prediction_match: "differ" }, checks), "revise");
  }
});

test("C는 스스로 만든 세 기준과 각 판정·근거가 필요하다", () => {
  const ownChecks = [0, 1, 2].map(i => ({ id: `cc${i}` }));
  const answers = { ai_result: "결과", prediction_match: "match", prediction_free: "값이 증가할 것으로 예상한다" };
  assert.equal(verificationStatus("C", answers, []), "incomplete");
  for (let i = 0; i < 3; i++) {
    answers[`cc_${i}`] = `나의 기준 ${i}`;
    answers[`chk_cc${i}`] = "ok";
    answers[`chkn_cc${i}`] = "독립 확인 근거";
  }
  assert.equal(verificationStatus("C", answers, ownChecks), "pass");
  assert.equal(verificationStatus("C", { ...answers, cc_1: "" }, ownChecks), "incomplete");
  assert.equal(verificationStatus("C", { ...answers, prediction_free: "" }, ownChecks), "incomplete");
  assert.equal(verificationStatus("C", { ...answers, chk_cc1: "unk" }, ownChecks), "revise");
});

test("교사 설문은 지정된 외부 폼으로 연결한다", () => {
  const url = new URL(CONFIG.surveyUrl);
  assert.equal(url.hostname, "docs.google.com");
  assert.ok(url.pathname.endsWith("/viewform"));
});
