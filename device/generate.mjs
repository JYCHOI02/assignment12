#!/usr/bin/env node
// 입력 파일(리추얼 기록 등)만 읽어 숫자 칸과 능력별 문단 후보를 만드는 장치.
// AI를 호출하지 않습니다 — candidates.json의 승인된 문장 틀에 계산된 숫자만 채워 넣으므로,
// 같은 입력 폴더로 돌리면 항상 같은 결과가 나옵니다(5단계 BRA-C09).
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));

function readJSON(p) {
  return JSON.parse(fs.readFileSync(p, "utf8"));
}

function loadRitual(inputDir) {
  const files = fs
    .readdirSync(inputDir)
    .filter((f) => /^ritual-history-.*\.json$/.test(f))
    .sort();
  if (files.length === 0) {
    throw new Error(
      `리추얼 기록 파일(ritual-history-*.json)을 ${inputDir}에서 찾지 못했습니다.`
    );
  }
  const file = files[files.length - 1];
  return { data: readJSON(path.join(inputDir, file)), file };
}

function findFile(inputDir, pattern) {
  const files = fs.readdirSync(inputDir).filter((f) => pattern.test(f));
  return files.length ? files[0] : null;
}

// "출석기록.txt": 탭으로 구분된 날짜/상태/출근/퇴근/비고. 엑셀에서 그대로 복사해 붙인 형식을 가정합니다.
function parseAttendance(text) {
  const rows = text
    .split(/\r?\n/)
    .filter((l) => l.trim())
    .map((l) => l.split("\t"));
  const byStatus = {};
  for (const r of rows) {
    const status = (r[2] || "").trim();
    byStatus[status] = (byStatus[status] || 0) + 1;
  }
  const notes = rows
    .filter((r) => (r[6] || "").trim())
    .map((r) => ({ date: r[0], status: r[2], note: r[6].trim() }));
  const present = byStatus["출석"] || 0;
  const excused = byStatus["공가"] || 0;
  return {
    totalDays: rows.length,
    byStatus,
    present,
    excused,
    absent: rows.length - present - excused,
    notes,
    firstRowDate: rows[rows.length - 1]?.[0],
    lastRowDate: rows[0]?.[0],
  };
}

// "제출현황.txt": 탭으로 구분된 "번호. 제목"과 상태("마스터 승인" 등).
function parseSubmissions(text) {
  const rows = text
    .split(/\r?\n/)
    .filter((l) => l.trim())
    .map((l) => l.split("\t"));
  const byStatus = {};
  for (const r of rows) {
    const status = (r[1] || "").trim();
    byStatus[status] = (byStatus[status] || 0) + 1;
  }
  const approved = byStatus["마스터 승인"] || 0;
  return {
    total: rows.length,
    byStatus,
    approved,
    items: rows.map((r) => ({ title: (r[0] || "").trim(), status: (r[1] || "").trim() })),
  };
}

function tryLoadOptional(inputDir, pattern, label) {
  const file = findFile(inputDir, pattern);
  if (!file) return { found: false, label };
  const full = path.join(inputDir, file);
  if (full.endsWith(".json")) {
    return { found: true, label, file, data: readJSON(full) };
  }
  return { found: true, label, file, data: fs.readFileSync(full, "utf8") };
}

function computeNumbers(ritual) {
  const days = [...ritual.days].sort((a, b) => a.date.localeCompare(b.date));
  const first = new Date(days[0].date);
  const weekSet = new Set();
  for (const d of days) {
    const diffDays = Math.floor((new Date(d.date) - first) / 86400000);
    weekSet.add(Math.floor(diffDays / 7) + 1);
  }
  // close: [] (빈 배열)은 "그날은 저녁 기록을 안 함"이고, close: null은 "이 파일을 내보낼 때
  // 아직 하루가 안 끝나서 저녁 기록이 비어 있었을 뿐"이라는 차이가 있습니다(2026-10-29가 null인데,
  // 이 파일 이름 자체가 ritual-history-2026-10-29.json이라 그날 중간에 내보낸 스냅샷으로 보입니다).
  // 학생이 "그날 저녁 기록도 실제로 작성했다"고 확인해 줘서, null은 작성한 것으로 셉니다.
  const closeFilled = days.filter((d) => d.close === null || (d.close && d.close.length > 0)).length;

  return {
    firstDate: days[0].date,
    lastDate: days[days.length - 1].date,
    totalDays: days.length,
    weeksWithEntry: weekSet.size,
    closeFilled,
  };
}
// [2026-11-01 삭제] "고난 시기(2026-09-22~10-05)" 계산 로직이 여기 있었습니다.
// 그 날짜가 묶여 있던 "보안 관제 실습" 고난 장면 자체가 거짓으로 확인돼 통째로 뺐습니다.
// 실제 고난 시기를 알게 되면 이 자리에 다시 넣으면 됩니다.

function fillTemplate(text, numbers, attendance, submissions) {
  let out = text
    .replaceAll("{{weeksWithEntry}}", numbers.weeksWithEntry)
    .replaceAll("{{totalDays}}", numbers.totalDays)
    .replaceAll("{{closeFilled}}", numbers.closeFilled)
    .replaceAll("{{firstDate}}", numbers.firstDate)
    .replaceAll("{{lastDate}}", numbers.lastDate);
  if (attendance) {
    out = out
      .replaceAll("{{attendancePresent}}", attendance.present)
      .replaceAll("{{attendanceExcused}}", attendance.excused)
      .replaceAll("{{attendanceAbsent}}", attendance.absent)
      .replaceAll("{{attendanceTotal}}", attendance.totalDays)
      .replaceAll("{{attendanceFirstDate}}", attendance.firstRowDate)
      .replaceAll("{{attendanceLastDate}}", attendance.lastRowDate);
  }
  if (submissions) {
    out = out
      .replaceAll("{{submissionsApproved}}", submissions.approved)
      .replaceAll("{{submissionsTotal}}", submissions.total);
  }
  return out;
}

function main() {
  const inputDir = path.resolve(process.argv[2] || path.join(__dirname, ".."));
  const outDir = path.resolve(process.argv[3] || path.join(__dirname, "last-result"));
  fs.mkdirSync(outDir, { recursive: true });

  const { data: ritual, file: ritualFile } = loadRitual(inputDir);
  const numbers = computeNumbers(ritual);

  // 카드3 지침의 다른 두 출처는 선택 입력입니다 — 없으면 "자료 없음"으로만 기록합니다.
  const attendanceFile = tryLoadOptional(inputDir, /출석|attendance/i, "내 출석 기록");
  const submissions = tryLoadOptional(inputDir, /제출현황|submissions/i, "내 제출 현황");

  const attendance = attendanceFile.found ? parseAttendance(attendanceFile.data) : null;
  const submissionStats = submissions.found ? parseSubmissions(submissions.data) : null;

  const candidates = readJSON(path.join(__dirname, "candidates.json"));
  const approvedPath = path.join(__dirname, "approved.json");
  const approved = new Set(fs.existsSync(approvedPath) ? readJSON(approvedPath) : []);

  const abilityCandidates = candidates.map((c) => ({
    id: c.id,
    ability: c.ability,
    date: fillTemplate(c.date, numbers, attendance, submissionStats),
    source: c.source,
    text: fillTemplate(c.template, numbers, attendance, submissionStats),
    approved: approved.has(c.id),
  }));

  const result = {
    note: "DETERMINISTIC: 실행 시각이나 무작위 값을 쓰지 않습니다. 입력 폴더의 파일 내용만으로 계산합니다.",
    sourceFiles: {
      ritual: ritualFile,
      attendance: attendanceFile.found ? attendanceFile.file : "자료 없음",
      submissions: submissions.found ? submissions.file : "자료 없음",
    },
    numbers,
    attendance,
    submissions: submissionStats,
    abilityCandidates,
  };

  fs.writeFileSync(
    path.join(outDir, "result.json"),
    JSON.stringify(result, null, 2),
    "utf8"
  );

  const md = [
    "# 생성 결과",
    "",
    "## 입력 파일",
    `- 리추얼 기록: ${ritualFile}`,
    `- 내 출석 기록: ${attendanceFile.found ? attendanceFile.file : "자료 없음"}`,
    `- 내 제출 현황: ${submissions.found ? submissions.file : "자료 없음"}`,
    "",
    "## 숫자",
    `- 13주 가운데 ${numbers.weeksWithEntry}주 동안 리추얼 기록을 남김 (${numbers.firstDate}~${numbers.lastDate})`,
    `- 총 ${numbers.totalDays}일 기록, 그중 ${numbers.closeFilled}일은 저녁 마무리까지 작성`,
    ...(attendance
      ? [
          `- 출석 기록 ${attendance.totalDays}일 중 ${attendance.present}일 출석, ${attendance.excused}일 공가, ${attendance.absent}일 결석 (${attendance.firstRowDate}~${attendance.lastRowDate})`,
          ...attendance.notes.map((n) => `  - 비고: ${n.date} ${n.status} — ${n.note}`),
        ]
      : ["- 내 출석 기록: 자료 없음"]),
    ...(submissionStats
      ? [`- 제출 현황 ${submissionStats.total}건 중 ${submissionStats.approved}건 마스터 승인`]
      : ["- 내 제출 현황: 자료 없음"]),
    "",
    "## 능력별 문단 후보",
    ...abilityCandidates.map(
      (c) =>
        `- [${c.approved ? "승인됨" : "미승인(후보)"}] (${c.ability}, ${c.date}, 출처: ${c.source}) ${c.text}`
    ),
  ].join("\n");

  fs.writeFileSync(path.join(outDir, "result.md"), md, "utf8");
  console.log(md);
}

main();
