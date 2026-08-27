// Xếp hạng cá nhân hoá danh sách đề ở Layer 2 (PRD exam-recommendation v1.2,
// ADR-0015 Decision 1). Đây là thứ tự MẶC ĐỊNH của /exams khi URL không có
// ?sort= — không phải một widget, không có gì hiện ra màn hình (PRD AC-002).
//
// v1 CỐ Ý chỉ dùng 3 tín hiệu, không phải vì thiết kế nghèo mà vì SỐ ĐO prod
// 2026-08-16: 3 đề published đều là Toán (nên "sở thích môn" là hằng số, không
// đổi được thứ tự nào), `user_skill_mastery` 0 dòng (nên "điểm yếu kỹ năng"
// không có đầu vào), 0 đề đạt `rating_count >= 3` (nên độ khó cộng đồng NULL
// với mọi đề — TRƠ, không phải thưa). Ba tín hiệu còn lại là những thứ THỰC SỰ
// phân biệt được các đề hôm nay. Chi tiết + điều kiện bật lại từng tầng: PRD
// mục "Release partition".
//
// ⚠ TIỀN ĐỀ Ở ĐOẠN TRÊN ĐÃ HẾT HẠN — ĐỌC TD-028 TRƯỚC KHI TIN NÓ (2026-08-27) ⚠
// Câu "3 đề published đều là Toán" đúng vào 2026-08-16 và KHÔNG còn đúng nữa.
// Đo lại prod 2026-08-27: 6 đề published, 4 MÔN (Toán 3, Hoá 1, Sinh 1, Lý 1),
// 4 lớp (8/10/11/12). Tức lý do DUY NHẤT để bỏ tín hiệu môn đã biến mất, và
// hàm này nay xếp hạng mà không biết gì về môn — học sinh yếu một môn không
// được đẩy đề môn đó lên, và vì `band` là khoá cứng thì đề họ ĐÃ làm (kể cả
// làm điểm thấp) còn bị đẩy xuống DƯỚI mọi đề chưa làm của môn khác.
// Đây là hành vi ĐÚNG theo PRD AC-019/D5, không phải bug — nhưng nó dựa trên
// một quan sát về kho đề đã cũ 11 ngày. TD-028 ghi đủ số đo và ba hướng sửa.
//
// Hàm THUẦN, cùng quy ước với recommendNextSkill() (route.ts:5-8): mọi state
// được tiêm vào, KHÔNG đọc Date.now(), KHÔNG đọc biến module, KHÔNG I/O, sort
// trên bản sao. Nhờ vậy nó chạy được ở mỗi lần render mà không cần cache.

/** Một đề ứng viên — đã qua bộ lọc DB-side, tức tập này là tập ĐẦY ĐỦ cần xếp. */
export interface RankExamCandidate {
  id: string;
  /** `exams.grade` — `int not null` (schema.sql:76), nên không có nhánh null. */
  grade: number;
  /** `exams.created_at` ISO — `timestamptz not null` (schema.sql:81). */
  createdAt: string;
}

/** Một lượt làm bài ĐÃ NỘP của chính người dùng đang xem (RLS lo phần "của ai"). */
export interface RankAttempt {
  examId: string;
  /** Lớp của đề đã làm (embed `exams!inner(grade)`) — nguồn của tín hiệu lớp. */
  grade: number;
  /** ISO. Dùng để chọn lượt ĐẠI DIỆN khi một đề bị làm nhiều lần. */
  submittedAt: string | null;
  /**
   * Điểm của CHÍNH lượt này (`exam_results.total_score`, thang 10), hoặc null
   * khi không có dòng kết quả — chuyện này xảy ra thật: `record_exam_result()`
   * có thể hỏng SAU khi lượt làm đã commit, nên tập "đã nộp" và tập "có điểm"
   * không chứng minh được là trùng nhau (PRD AC-038).
   */
  totalScore: number | null;
}

export interface RankExamsWeights {
  /** EXAM_RANK_GRADE_MATCH_WEIGHT. */
  gradeMatch: number;
  /** EXAM_RANK_RECENCY_WEIGHT. */
  recency: number;
}

export interface RankExamsInput {
  candidates: readonly RankExamCandidate[];
  /** CHỈ các lượt của một người dùng — trách nhiệm của caller (fetch có RLS). */
  attempts: readonly RankAttempt[];
  weights: RankExamsWeights;
}

/** Băng xếp hạng: 0 = chưa từng làm, 1 = đã nộp (bị đẩy xuống, KHÔNG bị loại). */
const BAND_NEVER_TAKEN = 0;
const BAND_SUBMITTED = 1;

/**
 * Trả về id các đề theo thứ tự đã xếp hạng cho MỘT người dùng.
 *
 * Trả về id chứ không phải cả dòng đề: hàm này không cần biết hình dạng row của
 * DB, nhờ vậy nó unit-test được bằng fixture trần và không kéo theo kiểu của
 * tầng đọc. Caller tự map id → row của mình.
 *
 * Bất biến: |kết quả| === |candidates|, và mọi id đầu vào đều có mặt đúng một
 * lần. Xếp hạng KHÔNG BAO GIỜ loại một đề nào — bộ lọc mới có quyền đó
 * (PRD AC-021).
 *
 * Khoá sắp xếp, viết thẳng ra đây theo đúng kiểu route.ts:87-89:
 *
 *   [ band ASC, priorScore ASC NULLS LAST, affinity DESC, id ASC ]
 *
 *   1. band       — mọi đề chưa làm đứng trên MỌI đề đã nộp (PRD AC-019). Đây
 *                   là khoá cứng, không phải một số hạng có trọng số: không
 *                   trọng số nào được phép lật nó.
 *   2. priorScore — trong băng đã nộp, điểm cũ TỆ HƠN lên trước (PRD D5: làm
 *                   lại một đề từng làm dở là thứ hữu ích nhất trong băng này).
 *                   Ở băng chưa làm mọi giá trị đều null nên khoá này trơ.
 *                   null xuống cuối băng: không có điểm thì KHÔNG suy ra là làm
 *                   dở — cùng quy ước "NULLS LAST" của route.ts:97-98.
 *   3. affinity   — điểm có trọng số, CAO hơn lên trước (xem affinityOf).
 *   4. id         — khoá thứ tư là thứ bảo đảm tất định TUYỆT ĐỐI: thiếu nó,
 *                   hai đề trùng cả ba khoá trên sẽ phụ thuộc vào tính ổn định
 *                   của Array.prototype.sort (PRD AC-013).
 */
export function rankExamIds(input: RankExamsInput): string[] {
  const { candidates, attempts, weights } = input;

  // --- Băng + điểm cũ ------------------------------------------------------
  // Lượt ĐẠI DIỆN của một đề = lượt nộp GẦN NHẤT (PRD U1, chốt ở v1.2). Không
  // chọn "tốt nhất" (giấu mất một lần tụt) cũng không chọn "tệ nhất" (phạt mãi
  // một đề học sinh đã làm chủ được): chỉ "gần nhất" mới phản ứng với chính cú
  // làm lại mà D5 muốn khuyến khích.
  const representativeByExam = new Map<string, RankAttempt>();
  for (const attempt of attempts) {
    const current = representativeByExam.get(attempt.examId);
    if (!current || isLater(attempt.submittedAt, current.submittedAt)) {
      representativeByExam.set(attempt.examId, attempt);
    }
  }

  // --- Tín hiệu lớp --------------------------------------------------------
  // Tỉ TRỌNG chứ không phải cờ nhị phân: tỉ lệ số lượt đã nộp của học sinh rơi
  // vào lớp của đề đang xét. Với học sinh chỉ học một lớp thì nó tự thoái hoá
  // về đúng cờ nhị phân (1.0 / 0), còn với học sinh vắt ngang hai lớp thì nó
  // giữ lại được thông tin mà cờ nhị phân làm mất.
  //
  // KHÔNG CÓ LƯỢT NÀO ⇒ KHÔNG CÓ TÍN HIỆU, chứ không phải tín hiệu bằng 0 và
  // cũng tuyệt đối không phải một giá trị đoán. Mặc định học sinh mới về lớp 12
  // chính là kiểu sai-mà-tự-tin mà project này đã trả giá một lần (Engine 1
  // R-a). `gradeShareOf` trả null để chỗ dùng nó phải xử lý tường minh
  // (PRD AC-034).
  const gradeShareByGrade = buildGradeShares(attempts);

  const gradeShareOf = (grade: number): number | null =>
    gradeShareByGrade === null ? null : (gradeShareByGrade.get(grade) ?? 0);

  // --- Tín hiệu mới-cũ -----------------------------------------------------
  // Chuẩn hoá min-max TRONG chính tập ứng viên, KHÔNG so với "bây giờ": hàm này
  // không được đọc đồng hồ (PRD AC-014), và "mới" vốn là một khái niệm tương
  // đối trong danh sách đang xem chứ không phải một khoảng cách tuyệt đối.
  const recencyNormOf = buildRecencyNormalizer(candidates);

  // affinity ∈ [0, gradeMatch + recency]. Lớp ĐÈ mới-cũ: hai đề chỉ bị mới-cũ
  // đảo chỗ khi tỉ trọng lớp của chúng chênh nhau DƯỚI
  // (recency / gradeMatch) — với giá trị đang ship là 0.25. Nói cách khác một
  // đề mới tinh SAI lớp không bao giờ vượt được một đề cũ ĐÚNG lớp, nhưng khi
  // học sinh chia đôi thời gian cho hai lớp thì "mới hơn" được quyền quyết định.
  const affinityOf = (candidate: RankExamCandidate): number => {
    const share = gradeShareOf(candidate.grade);
    const gradeTerm = share === null ? 0 : weights.gradeMatch * share;
    return gradeTerm + weights.recency * recencyNormOf(candidate);
  };

  const bandOf = (candidate: RankExamCandidate): number =>
    representativeByExam.has(candidate.id) ? BAND_SUBMITTED : BAND_NEVER_TAKEN;

  const priorScoreOf = (candidate: RankExamCandidate): number | null =>
    representativeByExam.get(candidate.id)?.totalScore ?? null;

  // Tính trước mọi khoá rồi mới sort: comparator được gọi O(n log n) lần, còn
  // affinityOf thì đụng vào Map — và quan trọng hơn, tính trước bảo đảm khoá
  // của một đề là BẤT BIẾN trong suốt lượt sort, tức so sánh luôn nhất quán.
  const keyed = candidates.map((candidate) => ({
    id: candidate.id,
    band: bandOf(candidate),
    priorScore: priorScoreOf(candidate),
    affinity: affinityOf(candidate),
  }));

  // Sort trên BẢN SAO (`candidates.map` ở trên đã tạo mảng mới) — hàm không sửa
  // đầu vào của caller.
  keyed.sort((a, b) => {
    if (a.band !== b.band) return a.band - b.band;

    if (a.priorScore !== b.priorScore) {
      if (a.priorScore === null) return 1; // null xuống cuối băng
      if (b.priorScore === null) return -1;
      return a.priorScore - b.priorScore; // điểm tệ hơn lên trước
    }

    if (a.affinity !== b.affinity) return b.affinity - a.affinity; // cao hơn lên trước

    return a.id < b.id ? -1 : a.id > b.id ? 1 : 0;
  });

  return keyed.map((row) => row.id);
}

/** `a` nộp sau `b`? null (thiếu mốc thời gian) luôn thua một mốc có thật. */
function isLater(a: string | null, b: string | null): boolean {
  if (a === null) return false;
  if (b === null) return true;
  return a > b; // ISO 8601 UTC so sánh chuỗi đúng thứ tự thời gian
}

/**
 * Tỉ trọng lượt-đã-nộp theo lớp, hoặc **null khi học sinh chưa có lượt nào** —
 * "chưa biết" và "biết là 0" là hai chuyện khác nhau và mã phải phân biệt được.
 */
function buildGradeShares(attempts: readonly RankAttempt[]): Map<number, number> | null {
  if (attempts.length === 0) return null;

  const counts = new Map<number, number>();
  for (const attempt of attempts) {
    counts.set(attempt.grade, (counts.get(attempt.grade) ?? 0) + 1);
  }

  const shares = new Map<number, number>();
  for (const [grade, count] of counts) {
    shares.set(grade, count / attempts.length);
  }
  return shares;
}

/**
 * Chuẩn hoá `createdAt` về [0, 1] trong tập ứng viên: 1 = mới nhất, 0 = cũ nhất.
 *
 * Mẫu số 0 (mọi đề cùng mốc thời gian, hoặc chỉ có một đề) trả 0 chứ KHÔNG trả
 * NaN — đúng lý do route.ts:67-74 đã ghi: NaN so sánh kiểu gì cũng false, nên
 * nó sẽ làm thứ tự phụ thuộc vị trí ban đầu của mảng và phá đúng tính tất định
 * mà PRD AC-012 yêu cầu.
 */
function buildRecencyNormalizer(
  candidates: readonly RankExamCandidate[]
): (candidate: RankExamCandidate) => number {
  const times = candidates.map((candidate) => Date.parse(candidate.createdAt));
  const valid = times.filter((time) => Number.isFinite(time));
  if (valid.length === 0) return () => 0;

  const min = Math.min(...valid);
  const max = Math.max(...valid);
  const span = max - min;
  if (span <= 0) return () => 0;

  return (candidate: RankExamCandidate): number => {
    const time = Date.parse(candidate.createdAt);
    // Mốc thời gian không parse được coi như cũ nhất — không ném lỗi, không đẩy
    // đề ra khỏi danh sách (PRD AC-021: đếm vào = đếm ra).
    if (!Number.isFinite(time)) return 0;
    return (time - min) / span;
  };
}
