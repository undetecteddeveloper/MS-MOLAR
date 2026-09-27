// "The ladder" [unit] — PRD exam-shelves v1.1, ADR-0021 D2/D4
// AC-013/015/018-025/029/030/048/051, AC-006 (cut-to-10)
// PRD: docs/prd/exam-shelves-prd.md (v1.1)
// Design Doc: docs/design/exam-shelves-backend-design.md § "The ladder"
// ADR: docs/adr/ADR-0021-cross-user-hot-aggregate-and-attempt-source.md
//
// Mock boundary: KHÔNG mock gì cả — mọi hàm trong examShelves.ts THUẦN, mọi
// state (counts/candidates/attempts/dominantGrade/now-derived boundaries)
// được tiêm vào theo đúng ADR-0021 D4 ("the clock is read once, in the query
// layer — never inside lib/adaptive"). Cùng quy ước với rankExams.test.ts.
//
// Mọi kỳ vọng dưới đây được TÍNH TAY độc lập với cách hàm cài đặt, đúng yêu
// cầu Operation Verification Methods của task P1-T4.

import { describe, expect, it } from "vitest";

import {
  HOT_SHELF_MIN_CARDS,
  HOT_WINDOW_RECENT_DAYS,
  HOT_WINDOW_WIDE_DAYS,
  SHELF_MAX_CARDS,
} from "../constants";
import {
  hotCountFieldOf,
  orderIdsByHotCount,
  pickDominantGrade,
  pickExploreShelf,
  pickHotShelf,
  pickWeakestSubject,
  type HotCounts,
  type ShelfAttempt,
  type ShelfCandidate,
} from "../examShelves";
import type { RankAttempt, SubjectWeakness } from "../rankExams";

// --- Test builders -----------------------------------------------------------

/** Đề ứng viên của kệ: mặc định lớp 12, môn "Math", trường null. */
function candidate(
  id: string,
  overrides: Partial<ShelfCandidate> = {}
): ShelfCandidate {
  return {
    id,
    grade: 12,
    subject: "Math",
    createdAt: "2026-01-01T00:00:00.000Z",
    school: null,
    ...overrides,
  };
}

function counts(recent: number, wide: number, total: number): HotCounts {
  return { recent, wide, total };
}

function countsMap(entries: ReadonlyArray<readonly [string, HotCounts]>): Map<string, HotCounts> {
  return new Map(entries);
}

function shelfAttempt(overrides: Partial<ShelfAttempt> = {}): ShelfAttempt {
  return {
    examId: "exam",
    grade: 12,
    subject: "Math",
    submittedAt: "2026-01-01T00:00:00.000Z",
    totalScore: 5,
    school: null,
    ...overrides,
  };
}

function rankAttempt(overrides: Partial<RankAttempt> = {}): RankAttempt {
  return {
    examId: "exam",
    grade: 12,
    subject: "Math",
    submittedAt: "2026-01-01T00:00:00.000Z",
    totalScore: 5,
    ...overrides,
  };
}

function subjectWeakness(weakness: number, scoredAttempts: number): SubjectWeakness {
  return { weakness, scoredAttempts };
}

/** Trả về bản sao đảo ngược — dùng cho các ca kiểm tra tính tất định. */
function shuffled<T>(items: readonly T[]): T[] {
  return [...items].reverse();
}

// =============================================================================
// Test 1 — pickHotShelf: thứ tự các bậc thang, gồm nhánh cold-start 3 bậc (U3)
// =============================================================================
// Primary failure mode: bậc SAI thứ tự (vd site-all được thử trước site-30d),
//   hoặc nhánh dominantGrade === null vẫn thử các bậc "grade-*" thay vì bỏ qua
//   hẳn (AC-023: "in-grade steps skipped, never guessed").
describe("Test 1 — pickHotShelf: thứ tự bậc thang", () => {
  it("có dominantGrade: thử grade-recent, grade-30d, grade-all, site-all theo đúng thứ tự đó", () => {
    // grade-recent (recent) có 0 đề đạt (count=0 mọi đề) -> nới sang grade-30d
    // (wide) cũng 0 -> nới sang grade-all (total) cũng 0 -> nới sang site-all,
    // nơi có đúng 5 đề đạt (đủ HOT_SHELF_MIN_CARDS) NHƯNG khác lớp.
    const candidates = [
      candidate("g12-a", { grade: 12 }),
      candidate("site-1", { grade: 9 }),
      candidate("site-2", { grade: 9 }),
      candidate("site-3", { grade: 9 }),
      candidate("site-4", { grade: 9 }),
      candidate("site-5", { grade: 9 }),
    ];
    const hotCounts = countsMap([
      ["g12-a", counts(0, 0, 0)],
      ["site-1", counts(0, 0, 3)],
      ["site-2", counts(0, 0, 3)],
      ["site-3", counts(0, 0, 3)],
      ["site-4", counts(0, 0, 3)],
      ["site-5", counts(0, 0, 3)],
    ]);

    const result = pickHotShelf({
      counts: hotCounts,
      candidates,
      dominantGrade: 12,
      minCards: HOT_SHELF_MIN_CARDS,
      maxCards: SHELF_MAX_CARDS,
    });

    expect(result).not.toBeNull();
    expect(result?.rung).toBe("site-all");
    expect(result?.examIds).toEqual(["site-1", "site-2", "site-3", "site-4", "site-5"]);
  });

  it("dominantGrade === null: chỉ 3 bậc site-scope (site-recent, site-30d, site-all) — không thử bậc grade-* nào", () => {
    // Chỉ 2 đề đạt ở MỌI bậc (dưới HOT_SHELF_MIN_CARDS=5) -> ladder chạy hết cả
    // 3 bậc site-scope rồi DỪNG ở bậc cuối (site-all) dù chưa đủ 5, vì đó là
    // bậc terminal (AC-023/AC-024).
    const candidates = [candidate("a"), candidate("b")];
    const hotCounts = countsMap([
      ["a", counts(1, 1, 1)],
      ["b", counts(1, 1, 1)],
    ]);

    const result = pickHotShelf({
      counts: hotCounts,
      candidates,
      dominantGrade: null,
      minCards: HOT_SHELF_MIN_CARDS,
      maxCards: SHELF_MAX_CARDS,
    });

    expect(result).not.toBeNull();
    expect(result?.rung).toBe("site-all");
    expect(result?.examIds).toEqual(["a", "b"]);
  });

  it("bậc grade-recent đủ 5 đề: DỪNG ngay, không nới sang grade-30d", () => {
    const candidates = Array.from({ length: 5 }, (_, i) => candidate(`e${i}`, { grade: 12 }));
    const hotCounts = countsMap(candidates.map((c) => [c.id, counts(1, 99, 99)] as const));

    const result = pickHotShelf({
      counts: hotCounts,
      candidates,
      dominantGrade: 12,
      minCards: HOT_SHELF_MIN_CARDS,
      maxCards: SHELF_MAX_CARDS,
    });

    expect(result?.rung).toBe("grade-recent");
  });

  it("bậc grade-all là superset của site-all không được thử ở nhánh có dominantGrade: site-all vẫn LUÔN là bậc cuối", () => {
    // 0 đề nào đạt ở bất kỳ bậc nào (kể cả site-all) -> trả null, không throw.
    const candidates = [candidate("a"), candidate("b")];
    const hotCounts = countsMap([
      ["a", counts(0, 0, 0)],
      ["b", counts(0, 0, 0)],
    ]);

    const result = pickHotShelf({
      counts: hotCounts,
      candidates,
      dominantGrade: 12,
      minCards: HOT_SHELF_MIN_CARDS,
      maxCards: SHELF_MAX_CARDS,
    });

    expect(result).toBeNull();
  });
});

// =============================================================================
// Test 2 — HOT_SHELF_MIN_CARDS: ranh giới đúng ở 4/5/6 đề đạt
// =============================================================================
// Primary failure mode: lệch một (off-by-one) ở đúng ranh giới — lớp lỗi rủi
//   ro cao nhất module này, theo Failure Mode Checklist của kế hoạch.
describe("Test 2 — ranh giới HOT_SHELF_MIN_CARDS tại 4/5/6 đề đạt", () => {
  function buildCandidatesAndCounts(qualifyingCount: number) {
    // Bậc grade-recent (field "recent") có đúng `qualifyingCount` đề đạt
    // (count=1), phần còn lại count=0 (không đạt). Nếu grade-recent không đủ
    // HOT_SHELF_MIN_CARDS thì ladder nới sang grade-30d, nơi TẤT CẢ đạt (10)
    // — nên "có nới hay không" phân biệt được bằng field nào thắng.
    const candidates = Array.from({ length: 10 }, (_, i) => candidate(`e${i}`, { grade: 12 }));
    const hotCounts = countsMap(
      candidates.map((c, i) => [c.id, counts(i < qualifyingCount ? 1 : 0, 1, 1)] as const)
    );
    return { candidates, hotCounts };
  }

  it("đúng 4 đề đạt ở bậc đầu (< HOT_SHELF_MIN_CARDS): NỚI sang bậc kế", () => {
    const { candidates, hotCounts } = buildCandidatesAndCounts(4);
    const result = pickHotShelf({
      counts: hotCounts,
      candidates,
      dominantGrade: 12,
      minCards: HOT_SHELF_MIN_CARDS,
      maxCards: SHELF_MAX_CARDS,
    });

    expect(result?.rung).toBe("grade-30d");
  });

  it("đúng 5 đề đạt ở bậc đầu (=== HOT_SHELF_MIN_CARDS): DỪNG lại, không nới", () => {
    const { candidates, hotCounts } = buildCandidatesAndCounts(5);
    const result = pickHotShelf({
      counts: hotCounts,
      candidates,
      dominantGrade: 12,
      minCards: HOT_SHELF_MIN_CARDS,
      maxCards: SHELF_MAX_CARDS,
    });

    expect(result?.rung).toBe("grade-recent");
    expect(result?.examIds).toHaveLength(5);
  });

  it("đúng 6 đề đạt ở bậc đầu (> HOT_SHELF_MIN_CARDS): DỪNG lại, không nới", () => {
    const { candidates, hotCounts } = buildCandidatesAndCounts(6);
    const result = pickHotShelf({
      counts: hotCounts,
      candidates,
      dominantGrade: 12,
      minCards: HOT_SHELF_MIN_CARDS,
      maxCards: SHELF_MAX_CARDS,
    });

    expect(result?.rung).toBe("grade-recent");
    expect(result?.examIds).toHaveLength(6);
  });
});

// =============================================================================
// Test 3 — AC-018: thứ tự trong một bậc là [count DESC, id ASC]
// =============================================================================
describe("Test 3 — AC-018: count DESC rồi id ASC bên trong một bậc", () => {
  it("count khác nhau: count cao hơn lên trước, bất kể thứ tự mảng đầu vào", () => {
    const candidates = shuffled([
      candidate("low", { grade: 12 }),
      candidate("high", { grade: 12 }),
      candidate("mid", { grade: 12 }),
    ]);
    const hotCounts = countsMap([
      ["low", counts(1, 1, 1)],
      ["high", counts(9, 9, 9)],
      ["mid", counts(5, 5, 5)],
    ]);

    const result = pickHotShelf({
      counts: hotCounts,
      candidates,
      dominantGrade: 12,
      minCards: 1,
      maxCards: SHELF_MAX_CARDS,
    });

    expect(result?.examIds).toEqual(["high", "mid", "low"]);
  });

  it("count bằng nhau: tie-break theo id tăng dần", () => {
    const candidates = [
      candidate("zeta", { grade: 12 }),
      candidate("alpha", { grade: 12 }),
      candidate("mid", { grade: 12 }),
    ];
    const hotCounts = countsMap([
      ["zeta", counts(3, 3, 3)],
      ["alpha", counts(3, 3, 3)],
      ["mid", counts(3, 3, 3)],
    ]);

    const result = pickHotShelf({
      counts: hotCounts,
      candidates,
      dominantGrade: 12,
      minCards: 1,
      maxCards: SHELF_MAX_CARDS,
    });

    expect(result?.examIds).toEqual(["alpha", "mid", "zeta"]);
  });

  it("orderIdsByHotCount (kệ phẳng ?sort=hot, AC-018/AC-034): total_count DESC rồi id ASC, dùng count CROSS-USER chứ không phải đếm riêng của caller", () => {
    const candidates = [
      candidate("b", { grade: 12 }),
      candidate("a", { grade: 12 }),
      candidate("c", { grade: 12 }),
    ];
    // "b" và "a" cùng total nhưng total ở đây đến từ counts map (mô phỏng
    // aggregate cross-user) — không có trường "đếm riêng của caller" nào tồn
    // tại trong input của hàm này để mà đọc nhầm.
    const hotCounts = countsMap([
      ["b", counts(0, 0, 7)],
      ["a", counts(0, 0, 7)],
      ["c", counts(0, 0, 2)],
    ]);

    expect(orderIdsByHotCount(candidates, hotCounts)).toEqual(["a", "b", "c"]);
  });

  it("orderIdsByHotCount: đề không có dòng trong counts map coi như total=0, không throw, không bị loại", () => {
    const candidates = [candidate("has-count"), candidate("no-count")];
    const hotCounts = countsMap([["has-count", counts(0, 0, 5)]]);

    expect(orderIdsByHotCount(candidates, hotCounts)).toEqual(["has-count", "no-count"]);
  });

  it("orderIdsByHotCount: tất định khi đảo thứ tự mảng đầu vào", () => {
    const candidates = [candidate("x"), candidate("y"), candidate("z")];
    const hotCounts = countsMap([
      ["x", counts(0, 0, 4)],
      ["y", counts(0, 0, 4)],
      ["z", counts(0, 0, 1)],
    ]);

    const first = orderIdsByHotCount(candidates, hotCounts);
    expect(orderIdsByHotCount(shuffled(candidates), hotCounts)).toEqual(first);
  });
});

// =============================================================================
// Test 4 — AC-025: kệ Nổi nhất không bao giờ áp dụng băng hạ cấp
// =============================================================================
// Primary failure mode: băng hạ cấp (dùng trong rankExamIds cho Cần luyện) bị
//   lỡ tay áp lên kệ Nổi nhất, làm ẩn mất một đề học sinh đã nộp dù đề đó vẫn
//   đạt ngưỡng đếm.
describe("Test 4 — AC-025: 0 băng hạ cấp trong pickHotShelf", () => {
  it("một đề 'đã nộp' (mô phỏng bằng việc nó chỉ đạt đúng ngưỡng) vẫn xuất hiện khi count đạt — không có input nào cho phép loại nó vì lý do đã nộp", () => {
    // pickHotShelf không nhận attempts/submittedExamIds — nên không có ngả
    // nào để một đề "đã nộp" bị lọc khỏi kết quả nếu count của nó đạt.
    const candidates = [candidate("already-submitted", { grade: 12 })];
    const hotCounts = countsMap([["already-submitted", counts(1, 1, 1)]]);

    const result = pickHotShelf({
      counts: hotCounts,
      candidates,
      dominantGrade: 12,
      minCards: 1,
      maxCards: SHELF_MAX_CARDS,
    });

    expect(result?.examIds).toContain("already-submitted");
  });
});

// =============================================================================
// Test 5 — AC-015: tie-break "môn yếu nhất" — weakness DESC, scoredAttempts
// DESC, subject ASC
// =============================================================================
describe("Test 5 — pickWeakestSubject: tie-break AC-015", () => {
  it("weakness khác nhau: môn yếu HƠN (số cao hơn) thắng", () => {
    const weakness = new Map<string, SubjectWeakness>([
      ["Math", subjectWeakness(0.2, 5)],
      ["Biology", subjectWeakness(0.8, 5)],
    ]);
    expect(pickWeakestSubject(weakness)).toBe("Biology");
  });

  it("weakness bằng nhau: môn có NHIỀU lượt đại diện có điểm hơn thắng", () => {
    const weakness = new Map<string, SubjectWeakness>([
      ["Math", subjectWeakness(0.5, 2)],
      ["Biology", subjectWeakness(0.5, 9)],
    ]);
    expect(pickWeakestSubject(weakness)).toBe("Biology");
  });

  it("weakness và scoredAttempts đều bằng nhau: tie-break theo tên môn A→Z", () => {
    const weakness = new Map<string, SubjectWeakness>([
      ["Physics", subjectWeakness(0.5, 3)],
      ["Chemistry", subjectWeakness(0.5, 3)],
    ]);
    expect(pickWeakestSubject(weakness)).toBe("Chemistry");
  });

  it("weakness === null: trả null (AC-013 cold start)", () => {
    expect(pickWeakestSubject(null)).toBeNull();
  });

  it("weakness rỗng (Map trống, không phải null): trả null", () => {
    expect(pickWeakestSubject(new Map())).toBeNull();
  });

  it("tất định khi đảo thứ tự các entry", () => {
    const entries: Array<readonly [string, SubjectWeakness]> = [
      ["Physics", subjectWeakness(0.5, 3)],
      ["Chemistry", subjectWeakness(0.5, 3)],
      ["Math", subjectWeakness(0.9, 1)],
    ];
    const first = pickWeakestSubject(new Map(entries));
    expect(pickWeakestSubject(new Map(shuffled(entries)))).toBe(first);
  });
});

// =============================================================================
// Test 6 — pickDominantGrade: tie-break "lớp áp đảo"
// =============================================================================
describe("Test 6 — pickDominantGrade: tie-break", () => {
  it("shares === null: trả null (AC-023 cold start)", () => {
    expect(pickDominantGrade(null, [])).toBeNull();
  });

  it("một lớp có tỉ trọng cao nhất rõ ràng: trả lớp đó, không cần xét attempts", () => {
    const shares = new Map([[12, 0.75], [9, 0.25]]);
    expect(pickDominantGrade(shares, [])).toBe(12);
  });

  it("hai lớp tỉ trọng bằng nhau: lớp của lượt nộp GẦN NHẤT thắng", () => {
    const shares = new Map([[12, 0.5], [9, 0.5]]);
    const attempts = [
      rankAttempt({ grade: 9, submittedAt: "2026-01-01T00:00:00.000Z" }),
      rankAttempt({ grade: 12, submittedAt: "2026-06-01T00:00:00.000Z" }),
    ];
    expect(pickDominantGrade(shares, attempts)).toBe(12);
  });

  it("hai lớp tỉ trọng bằng nhau, lượt gần nhất KHÁC lớp so với ca trên: đảo kết quả — không phải trùng hợp id/thứ tự mảng", () => {
    const shares = new Map([[12, 0.5], [9, 0.5]]);
    const attempts = [
      rankAttempt({ grade: 12, submittedAt: "2026-01-01T00:00:00.000Z" }),
      rankAttempt({ grade: 9, submittedAt: "2026-06-01T00:00:00.000Z" }),
    ];
    expect(pickDominantGrade(shares, attempts)).toBe(9);
  });

  it("hai lớp tỉ trọng bằng nhau, mọi submittedAt liên quan đều null: KHÔNG suy ra 'gần nhất' bừa — rơi về lớp SỐ CAO HƠN", () => {
    const shares = new Map([[12, 0.5], [9, 0.5]]);
    const attempts = [
      rankAttempt({ grade: 9, submittedAt: null }),
      rankAttempt({ grade: 12, submittedAt: null }),
    ];
    expect(pickDominantGrade(shares, attempts)).toBe(12);
  });

  it("ba lớp tỉ trọng bằng nhau, chỉ MỘT lượt trong nhóm tied có submittedAt thật: lượt đó quyết định dù các lượt khác null", () => {
    const shares = new Map([[12, 1 / 3], [9, 1 / 3], [10, 1 / 3]]);
    const attempts = [
      rankAttempt({ grade: 12, submittedAt: null }),
      rankAttempt({ grade: 9, submittedAt: "2026-03-01T00:00:00.000Z" }),
      rankAttempt({ grade: 10, submittedAt: null }),
    ];
    expect(pickDominantGrade(shares, attempts)).toBe(9);
  });

  it("tất định khi đảo thứ tự mảng attempts", () => {
    const shares = new Map([[12, 0.5], [9, 0.5]]);
    const attempts = [
      rankAttempt({ grade: 9, submittedAt: "2026-01-01T00:00:00.000Z" }),
      rankAttempt({ grade: 12, submittedAt: "2026-06-01T00:00:00.000Z" }),
    ];
    const first = pickDominantGrade(shares, attempts);
    expect(pickDominantGrade(shares, shuffled(attempts))).toBe(first);
  });
});

// =============================================================================
// Test 7 — AC-048: thứ tự Khám phá — [chưa-thử-môn DESC, chưa-thử-trường DESC,
// createdAt DESC, id ASC]
// =============================================================================
describe("Test 7 — pickExploreShelf: thứ tự AC-048", () => {
  it("môn chưa từng thử đứng trước môn đã thử, bất kể ngày đăng", () => {
    const candidates = [
      candidate("tried-subject-newer", { subject: "Math", createdAt: "2026-06-01T00:00:00.000Z" }),
      candidate("new-subject-older", { subject: "Biology", createdAt: "2020-01-01T00:00:00.000Z" }),
    ];
    const attempts = [shelfAttempt({ subject: "Math", school: null })];

    const result = pickExploreShelf({
      candidates,
      attempts,
      excludeIds: new Set(),
      maxCards: SHELF_MAX_CARDS,
    });

    expect(result).toEqual(["new-subject-older", "tried-subject-newer"]);
  });

  it("cùng đã-thử-hay-chưa ở môn: trường chưa từng thử đứng trước, bất kể ngày đăng", () => {
    const candidates = [
      candidate("tried-school-newer", { school: "A", createdAt: "2026-06-01T00:00:00.000Z" }),
      candidate("new-school-older", { school: "B", createdAt: "2020-01-01T00:00:00.000Z" }),
    ];
    const attempts = [shelfAttempt({ subject: "Math", school: "A" })];

    const result = pickExploreShelf({
      candidates,
      attempts,
      excludeIds: new Set(),
      maxCards: SHELF_MAX_CARDS,
    });

    expect(result).toEqual(["new-school-older", "tried-school-newer"]);
  });

  it("trường null KHÔNG được coi là 'chưa thử' — một trường thiếu không phải một trường mới", () => {
    const candidates = [
      candidate("null-school", { school: null, createdAt: "2020-01-01T00:00:00.000Z" }),
      candidate("real-new-school", { school: "B", createdAt: "2019-01-01T00:00:00.000Z" }),
    ];
    const attempts = [shelfAttempt({ subject: "Math", school: "A" })];

    const result = pickExploreShelf({
      candidates,
      attempts,
      excludeIds: new Set(),
      maxCards: SHELF_MAX_CARDS,
    });

    // "real-new-school" (trường B, chưa thử) đứng trước "null-school" dù cũ
    // hơn — trường null xếp NGANG với "đã thử", không phải NGANG "chưa thử".
    expect(result).toEqual(["real-new-school", "null-school"]);
  });

  it("cùng cấp môn và trường: mới hơn (created_at) lên trước", () => {
    const candidates = [
      candidate("older", { subject: "Biology", createdAt: "2026-01-01T00:00:00.000Z" }),
      candidate("newer", { subject: "Biology", createdAt: "2026-06-01T00:00:00.000Z" }),
    ];

    const result = pickExploreShelf({
      candidates,
      attempts: [],
      excludeIds: new Set(),
      maxCards: SHELF_MAX_CARDS,
    });

    expect(result).toEqual(["newer", "older"]);
  });

  it("mốc thời gian không parse được coi là CŨ NHẤT — không throw, không mất đề", () => {
    const candidates = [
      candidate("bad-date", { subject: "Biology", createdAt: "not-a-date" }),
      candidate("good-date", { subject: "Biology", createdAt: "2020-01-01T00:00:00.000Z" }),
    ];

    const result = pickExploreShelf({
      candidates,
      attempts: [],
      excludeIds: new Set(),
      maxCards: SHELF_MAX_CARDS,
    });

    expect(result).toEqual(["good-date", "bad-date"]);
  });

  it("trùng mọi khoá: tie-break theo id tăng dần", () => {
    const candidates = [
      candidate("zeta", { subject: "Biology", createdAt: "2026-01-01T00:00:00.000Z" }),
      candidate("alpha", { subject: "Biology", createdAt: "2026-01-01T00:00:00.000Z" }),
    ];

    const result = pickExploreShelf({
      candidates,
      attempts: [],
      excludeIds: new Set(),
      maxCards: SHELF_MAX_CARDS,
    });

    expect(result).toEqual(["alpha", "zeta"]);
  });

  it("tất định khi đảo thứ tự mảng candidates đầu vào", () => {
    const candidates = [
      candidate("a", { subject: "Biology", createdAt: "2026-01-01T00:00:00.000Z" }),
      candidate("b", { subject: "Math", createdAt: "2026-02-01T00:00:00.000Z" }),
      candidate("c", { subject: "Chemistry", createdAt: "2026-03-01T00:00:00.000Z" }),
    ];
    const attempts = [shelfAttempt({ subject: "Math", school: null })];

    const first = pickExploreShelf({ candidates, attempts, excludeIds: new Set(), maxCards: SHELF_MAX_CARDS });
    const reordered = pickExploreShelf({
      candidates: shuffled(candidates),
      attempts,
      excludeIds: new Set(),
      maxCards: SHELF_MAX_CARDS,
    });

    expect(reordered).toEqual(first);
  });
});

// =============================================================================
// Test 8 — AC-029/AC-030: Khám phá loại trừ id đã xuất hiện ở 2 kệ kia
// =============================================================================
describe("Test 8 — pickExploreShelf: dedup qua excludeIds", () => {
  it("0 id trong kết quả trùng với excludeIds, dù candidate đó xếp hạng đầu bảng", () => {
    const candidates = [
      candidate("already-shown", { subject: "Biology", createdAt: "2026-06-01T00:00:00.000Z" }),
      candidate("fresh", { subject: "Biology", createdAt: "2020-01-01T00:00:00.000Z" }),
    ];

    const result = pickExploreShelf({
      candidates,
      attempts: [],
      excludeIds: new Set(["already-shown"]),
      maxCards: SHELF_MAX_CARDS,
    });

    expect(result).not.toContain("already-shown");
    expect(result).toEqual(["fresh"]);
  });

  it("excludeIds rỗng: không loại đề nào", () => {
    const candidates = [candidate("a"), candidate("b")];
    const result = pickExploreShelf({
      candidates,
      attempts: [],
      excludeIds: new Set(),
      maxCards: SHELF_MAX_CARDS,
    });
    expect(result).toHaveLength(2);
  });
});

// =============================================================================
// Test 9 — Cắt ở SHELF_MAX_CARDS (AC-002/AC-006), thực hiện ở Node sau khi xếp
// =============================================================================
describe("Test 9 — cắt về đúng SHELF_MAX_CARDS sau khi xếp hạng đầy đủ", () => {
  it("pickHotShelf: 15 đề đạt cùng bậc chỉ trả về 10 (SHELF_MAX_CARDS), đúng 10 đề count cao nhất", () => {
    const candidates = Array.from({ length: 15 }, (_, i) => candidate(`e${i}`, { grade: 12 }));
    // count giảm dần theo id: e0 count cao nhất (14), e14 thấp nhất (0) —
    // "0" nghĩa là KHÔNG đạt (loại khỏi pool), nên chỉ 14 đề đạt (e0..e13).
    const hotCounts = countsMap(candidates.map((c, i) => [c.id, counts(14 - i, 14 - i, 14 - i)] as const));

    const result = pickHotShelf({
      counts: hotCounts,
      candidates,
      dominantGrade: 12,
      minCards: HOT_SHELF_MIN_CARDS,
      maxCards: SHELF_MAX_CARDS,
    });

    expect(result?.examIds).toHaveLength(SHELF_MAX_CARDS);
    expect(result?.examIds).toEqual(["e0", "e1", "e2", "e3", "e4", "e5", "e6", "e7", "e8", "e9"]);
  });

  it("pickExploreShelf: 15 ứng viên chưa-thử-môn chỉ trả về 10 (SHELF_MAX_CARDS), mới nhất trước", () => {
    const candidates = Array.from({ length: 15 }, (_, i) =>
      candidate(`e${i}`, {
        subject: "Biology",
        createdAt: new Date(Date.UTC(2026, 0, i + 1)).toISOString(),
      })
    );

    const result = pickExploreShelf({
      candidates,
      attempts: [],
      excludeIds: new Set(),
      maxCards: SHELF_MAX_CARDS,
    });

    expect(result).toHaveLength(SHELF_MAX_CARDS);
    expect(result).toEqual(["e14", "e13", "e12", "e11", "e10", "e9", "e8", "e7", "e6", "e5"]);
  });
});

// =============================================================================
// Test 10 — hằng số đúng giá trị PRD/ADR đã chốt
// =============================================================================
describe("Test 10 — hằng số ship đúng giá trị đã chốt (D12/D6/AC-019/AC-020)", () => {
  it("HOT_SHELF_MIN_CARDS = 5", () => {
    expect(HOT_SHELF_MIN_CARDS).toBe(5);
  });
  it("SHELF_MAX_CARDS = 10", () => {
    expect(SHELF_MAX_CARDS).toBe(10);
  });
  it("HOT_WINDOW_RECENT_DAYS = 7", () => {
    expect(HOT_WINDOW_RECENT_DAYS).toBe(7);
  });
  it("HOT_WINDOW_WIDE_DAYS = 30", () => {
    expect(HOT_WINDOW_WIDE_DAYS).toBe(30);
  });
});

// =============================================================================
// Test — hotCountFieldOf: con số hiện trên thẻ là ĐÚNG con số đã xếp hạng thẻ đó
// =============================================================================
// Primary failure mode: thẻ hiện `total` (hoặc cửa sổ khác) trong khi thứ hạng do
//   `recent`/`wide` quyết định — người đọc thấy "12, 40, 7" xếp kiểu lộn xộn, và
//   phụ đề "tuần này" đứng cạnh một con số của "từ trước tới nay".
describe("Test — hotCountFieldOf: cột đếm của mỗi bậc", () => {
  const ids = ["a", "b", "c", "d", "e"];
  // Mỗi kịch bản cho các cột KHÔNG thuộc bậc đích những giá trị nhiễu (đảo thứ tự
  // hoặc lớn hơn) — dùng nhầm cột thì dãy số đọc ra sẽ khác `expected`.
  const CASES: {
    rung: "site-recent" | "site-30d" | "site-all";
    rows: [number, number, number][];
    expected: number[];
  }[] = [
    {
      rung: "site-recent",
      rows: [[9, 1, 50], [7, 40, 5], [7, 30, 6], [3, 20, 7], [1, 10, 8]],
      expected: [9, 7, 7, 3, 1],
    },
    {
      rung: "site-30d",
      rows: [[0, 8, 1], [0, 6, 90], [0, 6, 80], [0, 2, 70], [0, 2, 60]],
      expected: [8, 6, 6, 2, 2],
    },
    {
      rung: "site-all",
      rows: [[0, 0, 5], [0, 0, 4], [0, 0, 3], [0, 0, 2], [0, 0, 1]],
      expected: [5, 4, 3, 2, 1],
    },
  ];

  it.each(CASES)(
    "bậc $rung: đọc count qua hotCountFieldOf cho đúng $expected, giảm dần theo thứ tự thẻ",
    ({ rung, rows, expected }) => {
      const hotCounts = countsMap(ids.map((id, i) => [id, counts(...rows[i])] as const));
      const result = pickHotShelf({
        counts: hotCounts,
        candidates: ids.map((id) => candidate(id)),
        dominantGrade: null,
        minCards: HOT_SHELF_MIN_CARDS,
        maxCards: SHELF_MAX_CARDS,
      });

      expect(result?.rung).toBe(rung);
      const field = hotCountFieldOf(rung);
      const shown = (result?.examIds ?? []).map((id) => hotCounts.get(id)?.[field]);
      expect(shown).toEqual(expected);
    }
  );

  it("bảng bậc → cột: *-recent → recent, *-30d → wide, *-all → total", () => {
    expect(hotCountFieldOf("grade-recent")).toBe("recent");
    expect(hotCountFieldOf("site-recent")).toBe("recent");
    expect(hotCountFieldOf("grade-30d")).toBe("wide");
    expect(hotCountFieldOf("site-30d")).toBe("wide");
    expect(hotCountFieldOf("grade-all")).toBe("total");
    expect(hotCountFieldOf("site-all")).toBe("total");
  });
});