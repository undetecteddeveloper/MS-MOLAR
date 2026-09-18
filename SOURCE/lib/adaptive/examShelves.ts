// "Thang" chọn kệ đề ở trang /exams và trang chủ (PRD exam-shelves v1.1,
// ADR-0021 D2/D4). Ba kệ — Cần luyện, Nổi nhất, Khám phá — và kệ phẳng
// `?sort=hot` đều lấy thứ tự từ các hàm THUẦN dưới đây.
//
// THUẦN, cùng quy ước với rankExams.ts (:32-34) và recommendNextSkill()
// (route.ts:5-8): mọi state được tiêm vào, KHÔNG đọc Date.now()/new Date(),
// KHÔNG đọc biến module, KHÔNG I/O, sort trên bản sao. `pickExploreShelf`
// gọi `Date.parse()` trên một chuỗi `createdAt` CÓ SẴN trong input — đó là
// phân tích một giá trị đã cho, không phải đọc đồng hồ hệ thống, nên không vi
// phạm quy ước (ADR-0021 D4: đồng hồ chỉ được đọc MỘT LẦN, ở tầng query, rồi
// truyền các mốc thời gian đã tính (`counts`) và `dominantGrade` vào đây).
//
// KHÔNG tự gọi `buildSubjectWeakness`/`buildGradeShares`/`buildRepresentativeAttempts`
// ở đây: theo đúng "Data Flow" của Design Doc (§ "the body of
// listExamShelves()"), ba hàm đó chạy ở tầng composition (`shelves.ts`), rồi
// truyền THẲNG kết quả (`weakness`, `shares`) vào `pickWeakestSubject`/
// `pickDominantGrade` bên dưới — một định nghĩa "yếu nhất"/"tỉ trọng lớp" DUY
// NHẤT, không có bản sao song song nào tính lại từ attempts thô ở module này
// (ADR-0021 D2 "one personalised ranking, never re-implemented").

import type { RankAttempt, RankExamCandidate, SubjectWeakness } from "./rankExams";

/**
 * Tên bậc trong thang nới rộng của kệ Nổi nhất — luôn ghép SCOPE-WINDOW,
 * không bao giờ chỉ scope suông: "site-30d" là phạm vi toàn hệ thống + cửa sổ
 * 30 ngày, và frontend map cặp này ra chuỗi tiếng Việt. Tên trường "wide"
 * trong `HotCounts` GIỮ NGUYÊN dù bậc mang tên "30d" — nó đúng bằng cột
 * `p_since_wide` mà RPC trả về.
 */
export type HotRung = "grade-recent" | "grade-30d" | "grade-all" | "site-recent" | "site-30d" | "site-all";

/** Ba cửa sổ đếm lượt-đã-nộp cross-user của một đề, do `exam_hot_counts` trả về. */
export interface HotCounts {
  recent: number;
  wide: number;
  total: number;
}

/**
 * Đề ứng viên của MỘT kệ — mở rộng `RankExamCandidate` bằng `school`, vì kệ
 * Khám phá cần biết trường của đề (AC-048) mà `RankExamCandidate` không có.
 * Tập candidates này là tập DUY NHẤT mà cả 3 kệ cùng đọc (Design Doc § Data
 * Flow), nên ba kệ không thể bất đồng về "kho đề có gì".
 */
export interface ShelfCandidate extends RankExamCandidate {
  school: string | null;
}

/**
 * Lượt làm đã nộp của học sinh đang xem, mở rộng `RankAttempt` bằng `school`
 * — cùng lý do `ShelfCandidate` cần nó (AC-048's "trường chưa từng thử").
 */
export interface ShelfAttempt extends RankAttempt {
  school: string | null;
}

/** `a` nộp sau `b`? null (thiếu mốc thời gian) luôn thua một mốc có thật.
 *
 * Bản sao cục bộ của quy ước `isLater()` trong `rankExams.ts` (:245-249):
 * hàm đó không được export (rankExams.ts không nằm trong Target Files của
 * task này), nên `pickDominantGrade` cần đúng ngữ nghĩa "null luôn thua" thì
 * viết lại tại chỗ, không đi sửa file khác ngoài phạm vi.
 */
function isLater(a: string | null, b: string | null): boolean {
  if (a === null) return false;
  if (b === null) return true;
  return a > b; // ISO 8601 UTC so sánh chuỗi đúng thứ tự thời gian
}

/**
 * Mốc thời gian dùng để sắp xếp "mới-cũ" của `pickExploreShelf` — chuỗi
 * không parse được (dữ liệu hỏng) coi như CŨ NHẤT bằng cách trả
 * `NEGATIVE_INFINITY` thay vì `NaN`: NaN so sánh kiểu gì cũng false, nên nó
 * sẽ làm thứ tự phụ thuộc vị trí ban đầu của mảng — đúng lỗi route.ts:67-74
 * đã ghi lại và rankExams.ts's `buildRecencyNormalizer` đã né bằng cách khác.
 */
function createdAtSortKey(createdAt: string): number {
  const time = Date.parse(createdAt);
  return Number.isFinite(time) ? time : Number.NEGATIVE_INFINITY;
}

function compareIdsAscending(a: string, b: string): number {
  return a < b ? -1 : a > b ? 1 : 0;
}

// =============================================================================
// pickHotShelf — thang nới rộng của kệ Nổi nhất (AC-018-025/051)
// =============================================================================

export interface PickHotShelfInput {
  /** Ba cửa sổ đếm cross-user, khoá theo exam id — do tầng query đọc 1 lần. */
  counts: ReadonlyMap<string, HotCounts>;
  candidates: readonly ShelfCandidate[];
  /** null => học sinh chưa có lượt nộp nào (cold start, AC-023). */
  dominantGrade: number | null;
  minCards: number;
  maxCards: number;
}

export interface HotShelfResult {
  rung: HotRung;
  examIds: string[];
}

interface HotRungStep {
  rung: HotRung;
  /** null = phạm vi toàn hệ thống, không lọc theo lớp. */
  gradeScope: number | null;
  field: keyof HotCounts;
}

function buildHotRungSteps(dominantGrade: number | null): readonly HotRungStep[] {
  if (dominantGrade === null) {
    // AC-023 (U3, chốt 2026-09-18): CHỈ 3 bậc phạm vi toàn hệ thống — các bậc
    // trong-lớp bị BỎ QUA hẳn, không đoán một lớp nào cả.
    return [
      { rung: "site-recent", gradeScope: null, field: "recent" },
      { rung: "site-30d", gradeScope: null, field: "wide" },
      { rung: "site-all", gradeScope: null, field: "total" },
    ];
  }
  return [
    { rung: "grade-recent", gradeScope: dominantGrade, field: "recent" },
    { rung: "grade-30d", gradeScope: dominantGrade, field: "wide" },
    { rung: "grade-all", gradeScope: dominantGrade, field: "total" },
    { rung: "site-all", gradeScope: null, field: "total" },
  ];
}

/**
 * Chọn kệ Nổi nhất bằng cách thử từng bậc của thang, DỪNG ở bậc đầu tiên đạt
 * `minCards` đề trở lên, hoặc ở bậc CUỐI (terminal) dù chưa đạt (AC-022/024).
 *
 * KHÔNG nhận `attempts`/tập id-đã-nộp nào — đây là lý do băng hạ cấp (dùng
 * cho kệ Cần luyện) KHÔNG THỂ bị áp nhầm vào đây (AC-025): input của hàm này
 * không mang thông tin "đã nộp hay chưa" để mà lọc theo.
 *
 * Cắt về `maxCards` xảy ra ở ĐÂY, trong Node, sau khi đã xếp hạng đầy đủ toàn
 * bộ pool của bậc được chọn — không bao giờ là một `.limit()` SQL (AC-006,
 * ADR-0021 D2 "rank-then-cut").
 */
export function pickHotShelf(input: PickHotShelfInput): HotShelfResult | null {
  const { counts, candidates, dominantGrade, minCards, maxCards } = input;
  const steps = buildHotRungSteps(dominantGrade);

  for (let i = 0; i < steps.length; i += 1) {
    const { rung, gradeScope, field } = steps[i];

    const pool = candidates
      .filter((c) => gradeScope === null || c.grade === gradeScope)
      .map((c) => ({ id: c.id, count: counts.get(c.id)?.[field] ?? 0 }))
      .filter((x) => x.count > 0) // "đạt" = >= 1 lượt đã nộp trong cửa sổ
      .sort((a, b) => (a.count !== b.count ? b.count - a.count : compareIdsAscending(a.id, b.id))); // AC-018

    const isTerminalStep = i === steps.length - 1;
    if (pool.length >= minCards || isTerminalStep) {
      if (pool.length === 0) return null; // AC-024/AC-051
      return { rung, examIds: pool.slice(0, maxCards).map((x) => x.id) };
    }
  }

  // Không tới đây: `steps` luôn có >= 3 phần tử, và bậc cuối luôn thoả
  // `isTerminalStep`, nên vòng lặp luôn return ở trên. Giữ lại cho TypeScript
  // (hàm phải có giá trị trả về trên mọi nhánh tĩnh).
  return null;
}

// =============================================================================
// pickWeakestSubject — chọn môn cho kệ Cần luyện (AC-013/015)
// =============================================================================

/**
 * Chọn môn YẾU nhất từ map đã tính sẵn bởi `rankExams.ts`'s `buildSubjectWeakness`
 * (export widened ở P1-T3) — hàm này CHỈ chọn, không tính lại độ yếu (AC-016:
 * "1 implementation, 0 parallel copies").
 *
 * `null`/map rỗng => không có môn nào có tín hiệu điểm, kệ Cần luyện vắng mặt
 * (AC-013, cùng ranh giới "chưa biết ≠ biết là 0" mà `buildSubjectWeakness`
 * đã đặt).
 *
 * Tie-break AC-015: weakness cao hơn thắng; bằng nhau thì nhiều lượt đại diện
 * CÓ ĐIỂM hơn thắng (trung bình trên ít lượt hơn dễ lệch, nên đáng tin hơn);
 * bằng cả hai thì tên môn A→Z thắng — tất định tuyệt đối.
 */
export function pickWeakestSubject(weakness: ReadonlyMap<string, SubjectWeakness> | null): string | null {
  if (weakness === null || weakness.size === 0) return null;

  const [top] = [...weakness.entries()].sort(([subjectA, a], [subjectB, b]) => {
    if (a.weakness !== b.weakness) return b.weakness - a.weakness;
    if (a.scoredAttempts !== b.scoredAttempts) return b.scoredAttempts - a.scoredAttempts;
    return compareIdsAscending(subjectA, subjectB);
  });
  return top[0];
}

// =============================================================================
// pickDominantGrade — lớp áp đảo, quyết định phạm vi trong-lớp của thang
// =============================================================================

/**
 * Chọn lớp ÁP ĐẢO từ tỉ trọng lượt-đã-nộp theo lớp (`buildGradeShares`) —
 * `null` khi học sinh chưa có lượt nào (AC-023 cold start, ladder chạy 3 bậc
 * phạm vi toàn hệ thống thay vì đoán một lớp).
 *
 * Tie-break: nhiều lớp cùng tỉ trọng cao nhất thì lớp của lượt nộp GẦN NHẤT
 * (trong số các lớp đang hoà) thắng; nếu KHÔNG lượt nào trong nhóm hoà có
 * `submittedAt` thật (toàn null — "null luôn thua" nên không lượt nào đủ tư
 * cách làm "gần nhất") thì rơi về lớp có SỐ CAO HƠN.
 */
export function pickDominantGrade(
  shares: ReadonlyMap<number, number> | null,
  attempts: readonly RankAttempt[]
): number | null {
  if (shares === null) return null;

  const maxShare = Math.max(...shares.values());
  const tied = [...shares.keys()].filter((grade) => shares.get(grade) === maxShare);
  if (tied.length === 1) return tied[0];

  const tiedSet = new Set(tied);
  let latestGrade: number | null = null;
  let latestSubmittedAt: string | null = null;
  for (const attempt of attempts) {
    if (!tiedSet.has(attempt.grade)) continue;
    if (attempt.submittedAt === null) continue; // null luôn thua, không đủ tư cách "gần nhất"
    if (latestGrade === null || isLater(attempt.submittedAt, latestSubmittedAt)) {
      latestGrade = attempt.grade;
      latestSubmittedAt = attempt.submittedAt;
    }
  }
  return latestGrade ?? Math.max(...tied);
}

// =============================================================================
// pickExploreShelf — kệ Khám phá (AC-029/030/048)
// =============================================================================

export interface PickExploreShelfInput {
  candidates: readonly ShelfCandidate[];
  attempts: readonly ShelfAttempt[];
  /** Id đã hiện ở 2 kệ kia — loại khỏi Khám phá, không đợi lọc bằng tay ở nơi khác (AC-029). */
  excludeIds: ReadonlySet<string>;
  maxCards: number;
}

/**
 * Xếp pool "chưa hiện ở 2 kệ kia" theo đúng khoá 4 phần của AC-048:
 *   [ môn chưa-từng-thử DESC, trường chưa-từng-thử DESC, created_at DESC, id ASC ]
 * rồi cắt về `maxCards` ở Node (AC-006).
 *
 * `school === null` xếp NGANG "đã thử" — một trường thiếu không phải một
 * trường mới (comment tại chỗ trong Design Doc). Mốc `created_at` không parse
 * được xếp NGANG "cũ nhất" — không ném lỗi, không mất đề khỏi kệ (AC-021's
 * quy ước "đếm vào = đếm ra" áp dụng cho cả module này).
 */
export function pickExploreShelf(input: PickExploreShelfInput): string[] {
  const { candidates, attempts, excludeIds, maxCards } = input;

  const attemptedSubjects = new Set<string>();
  const attemptedSchools = new Set<string>();
  for (const attempt of attempts) {
    if (attempt.subject !== null) attemptedSubjects.add(attempt.subject);
    if (attempt.school !== null) attemptedSchools.add(attempt.school);
  }

  const keyed = candidates
    .filter((c) => !excludeIds.has(c.id))
    .map((c) => ({
      id: c.id,
      // 0 = chưa từng thử (lên trước), 1 = đã thử.
      unattemptedSubjectRank: attemptedSubjects.has(c.subject) ? 1 : 0,
      unattemptedSchoolRank: c.school !== null && !attemptedSchools.has(c.school) ? 0 : 1,
      createdAtKey: createdAtSortKey(c.createdAt),
    }));

  keyed.sort((a, b) => {
    if (a.unattemptedSubjectRank !== b.unattemptedSubjectRank) {
      return a.unattemptedSubjectRank - b.unattemptedSubjectRank;
    }
    if (a.unattemptedSchoolRank !== b.unattemptedSchoolRank) {
      return a.unattemptedSchoolRank - b.unattemptedSchoolRank;
    }
    if (a.createdAtKey !== b.createdAtKey) return b.createdAtKey - a.createdAtKey; // mới hơn lên trước
    return compareIdsAscending(a.id, b.id);
  });

  return keyed.slice(0, maxCards).map((x) => x.id);
}

// =============================================================================
// orderIdsByHotCount — kệ phẳng ?sort=hot (AC-018/AC-034), không có thang
// =============================================================================

/**
 * Thứ tự "Nổi nhất" dạng PHẲNG cho `?sort=hot`: `total_count DESC, id ASC`
 * trên TOÀN BỘ candidate set, không thang, không lọc theo lớp (AC-018/034).
 * `counts` phải là aggregate cross-user do tầng query đọc — hàm này chỉ đọc
 * field `total` của map được truyền vào, không có cách nào tự tính lại một
 * con số "đếm riêng của caller" vì không nhận attempts nào cả.
 */
export function orderIdsByHotCount(
  candidates: readonly ShelfCandidate[],
  counts: ReadonlyMap<string, HotCounts>
): string[] {
  const keyed = candidates.map((c) => ({ id: c.id, total: counts.get(c.id)?.total ?? 0 }));
  keyed.sort((a, b) => (a.total !== b.total ? b.total - a.total : compareIdsAscending(a.id, b.id)));
  return keyed.map((x) => x.id);
}
