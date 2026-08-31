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
// ⚠ TIỀN ĐỀ Ở ĐOẠN TRÊN ĐÃ HẾT HẠN, VÀ ĐÃ ĐƯỢC XỬ LÝ (TD-028, trả 2026-08-31) ⚠
// Câu "3 đề published đều là Toán" đúng vào 2026-08-16 và hết đúng từ lâu: đo
// lại prod 2026-08-27 ra 6 đề published, 4 MÔN (Toán 3, Hoá 1, Sinh 1, Lý 1),
// 4 lớp (8/10/11/12). Lý do DUY NHẤT để bỏ tín hiệu môn — rằng nó là hằng số —
// đã biến mất, nên tín hiệu môn quay lại dưới dạng số hạng thứ BA của affinity:
// ĐIỂM YẾU THEO MÔN, `1 − điểm_trung_bình_môn / 10`, xem
// EXAM_RANK_SUBJECT_WEAKNESS_WEIGHT để biết vì sao trọng số là 0.5.
//
// Hai điều TD-028 nêu mà bản này CỐ Ý không làm, ghi ra để lần sau không ai đọc
// nhầm là sót:
//   · `band` KHÔNG đổi. Đề đã nộp vẫn nằm dưới MỌI đề chưa làm, kể cả khi điểm
//     rất thấp. Đó là PRD AC-019/D5 phát biểu thành khoá cứng — đổi nó là đổi
//     một tiêu chí nghiệm thu, không phải chỉnh một trọng số. Hệ quả cần nói
//     thẳng: "đề môn yếu lên đầu trang" ở đây nghĩa là lên đầu băng CHƯA LÀM,
//     tức đúng phần trên cùng của trang 1 mà người dùng nhìn thấy.
//   · Tầng "độ khó cộng đồng" vẫn tắt. Nó bị cắt vì 0 đề đạt `rating_count >= 3`
//     (2026-08-16), và điều kiện bật lại là một số đo trên prod, không phải một
//     dòng mã ở đây.
//
// Hàm THUẦN, cùng quy ước với recommendNextSkill() (route.ts:5-8): mọi state
// được tiêm vào, KHÔNG đọc Date.now(), KHÔNG đọc biến module, KHÔNG I/O, sort
// trên bản sao. Nhờ vậy nó chạy được ở mỗi lần render mà không cần cache.

/** Một đề ứng viên — đã qua bộ lọc DB-side, tức tập này là tập ĐẦY ĐỦ cần xếp. */
export interface RankExamCandidate {
  id: string;
  /** `exams.grade` — `int not null` (schema.sql:76), nên không có nhánh null. */
  grade: number;
  /**
   * `exams.subject` — `text not null` (schema.sql:83), nên không có nhánh null.
   *
   * So sánh NGUYÊN VĂN, không chuẩn hoá ở đây: giá trị canonical được cưỡng chế
   * ở đường GHI (`validateExamMeta`/`normalizeMeta` → `normalizeSubject`) và
   * được canh bởi `verify:schema` mục 8, tức TD-016 đã đóng cả hai đầu. Nếu một
   * chuỗi ngoài `SUBJECTS` vẫn lọt vào, nó chỉ tự thành một nhóm riêng — thứ tự
   * hơi lệch, KHÔNG có đề nào bị mất và không có gì ném lỗi. Nhập một
   * `normalizeSubject()` vào đây thì đổi lại là phá tính THUẦN mà đầu file vừa
   * hứa (hàm sẽ đọc một bảng module).
   */
  subject: string;
  /** `exams.created_at` ISO — `timestamptz not null` (schema.sql:81). */
  createdAt: string;
}

/** Một lượt làm bài ĐÃ NỘP của chính người dùng đang xem (RLS lo phần "của ai"). */
export interface RankAttempt {
  examId: string;
  /** Lớp của đề đã làm (embed `exams!inner(grade)`) — nguồn của tín hiệu lớp. */
  grade: number;
  /**
   * Môn của đề đã làm (cùng embed) — nguồn của tín hiệu điểm yếu theo môn.
   *
   * `null` khi embed không giao được môn. KHÔNG suy ra môn từ bất cứ đâu và
   * cũng không loại lượt này khỏi tín hiệu LỚP: một trường thiếu chỉ được phép
   * làm câm đúng tín hiệu của nó (cùng quy ước `totalScore` ngay dưới).
   */
  subject: string | null;
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
  /** EXAM_RANK_SUBJECT_WEAKNESS_WEIGHT. */
  subjectWeakness: number;
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
 * Thang điểm của `exam_results.total_score` (`numeric(4,2)`, thang 10).
 *
 * Ở ĐÂY chứ không ở `constants.ts` có chủ ý: `constants.ts` giữ những con số
 * CHỈNH ĐƯỢC — trọng số, ngưỡng — còn đây là một SỰ THẬT của schema. Đặt nhầm
 * chỗ thì lần sau ai đó sẽ chỉnh nó như chỉnh một trọng số, và làm thế là nói
 * dối về thang điểm chứ không phải điều chỉnh thuật toán.
 */
const SCORE_MAX = 10;

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
 *   3. affinity   — điểm có trọng số, CAO hơn lên trước (xem affinityOf). Ba
 *                   số hạng: khớp LỚP, ĐIỂM YẾU THEO MÔN, và MỚI-CŨ.
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

  // --- Tín hiệu điểm yếu theo môn (TD-028) ---------------------------------
  // Điểm trung bình của học sinh Ở TỪNG MÔN, đảo lại thành "độ yếu" ∈ [0, 1].
  //
  // TÍNH TRÊN LƯỢT ĐẠI DIỆN, không phải trên mọi lượt: một đề làm lại năm lần
  // sẽ đè bẹp trung bình môn nếu đếm cả năm, và "đại diện = lượt nộp gần nhất"
  // là định nghĩa hàm này ĐÃ chốt ngay phía trên cho `priorScore`. Dùng lại nó
  // ở đây giữ cho hai tín hiệu không thể nói hai điều khác nhau về cùng một
  // lượt làm bài.
  //
  // CHỈ LƯỢT CÓ ĐIỂM mới được tính. Một lượt đã nộp mà không có dòng kết quả là
  // chuyện xảy ra thật (xem `totalScore`), và đọc nó thành 0 điểm là biến một
  // sự cố ghi dữ liệu thành một lời khẳng định "em này yếu môn đó".
  const subjectWeaknessBySubject = buildSubjectWeakness(representativeByExam.values());

  const subjectWeaknessOf = (subject: string): number | null =>
    subjectWeaknessBySubject === null ? null : (subjectWeaknessBySubject.get(subject) ?? 0);

  // --- Tín hiệu mới-cũ -----------------------------------------------------
  // Chuẩn hoá min-max TRONG chính tập ứng viên, KHÔNG so với "bây giờ": hàm này
  // không được đọc đồng hồ (PRD AC-014), và "mới" vốn là một khái niệm tương
  // đối trong danh sách đang xem chứ không phải một khoảng cách tuyệt đối.
  const recencyNormOf = buildRecencyNormalizer(candidates);

  // affinity ∈ [0, gradeMatch + subjectWeakness + recency]. Thứ bậc giữa ba số
  // hạng là một HỆ QUẢ SỐ HỌC của ba trọng số, không phải một quy tắc rời được
  // viết ở đâu đó — và với giá trị đang ship (1 / 0.5 / 0.25) nó ra hai câu
  // kiểm chứng được, cả hai đều có test ghim:
  //
  //   · LỚP đè MÔN. Với học sinh chỉ làm bài ở một lớp, affinity tối đa của một
  //     đề SAI lớp là 0 + 0.5 + 0.25 = 0.75 < 1.0 = affinity tối thiểu của một
  //     đề ĐÚNG lớp. Yếu Sinh không kéo được đề Sinh lớp 8 lên đầu danh sách
  //     của học sinh lớp 12.
  //   · MÔN đè MỚI-CŨ, nhưng chỉ khi điểm yếu là thật. Số hạng môn tối đa 0.5
  //     vượt số hạng mới-cũ tối đa 0.25; một môn chỉ hơi yếu (số hạng < 0.25)
  //     thì nhường cho "mới hơn".
  const affinityOf = (candidate: RankExamCandidate): number => {
    const share = gradeShareOf(candidate.grade);
    const gradeTerm = share === null ? 0 : weights.gradeMatch * share;
    const weakness = subjectWeaknessOf(candidate.subject);
    const subjectTerm = weakness === null ? 0 : weights.subjectWeakness * weakness;
    return gradeTerm + subjectTerm + weights.recency * recencyNormOf(candidate);
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
 * Độ YẾU theo môn ∈ [0, 1] (1 = yếu nhất), hoặc **null khi học sinh chưa có
 * lượt ĐẠI DIỆN nào CÓ ĐIỂM** — cùng ranh giới "chưa biết ≠ biết là 0" mà
 * `buildGradeShares` đã đặt, và cùng lý do: mặc định một học sinh mới thành
 * "yếu mọi môn" là kiểu sai-mà-tự-tin đắt nhất mà project này từng trả giá.
 *
 * Bên trong một môn ĐÃ CÓ điểm, phép tính là trung bình cộng các lượt đại diện
 * có điểm, đảo lại quanh thang điểm. Trung bình cộng chứ không phải min hay
 * lượt gần nhất: min biến MỘT lần thi hỏng thành một lời tuyên bố vĩnh viễn về
 * cả môn, còn "gần nhất" thì một môn học sinh làm từ lâu sẽ nói theo một buổi
 * duy nhất. Trung bình là thứ duy nhất trong ba cái mà mỗi lượt mới đều dịch
 * chuyển được, theo đúng chiều và theo đúng cỡ.
 *
 * Điểm ngoài thang (dữ liệu hỏng, hoặc thang điểm đổi mà chỗ này chưa đổi
 * theo) bị KẸP về [0, 1] chứ không được phép sinh ra một số hạng âm — một số
 * hạng âm sẽ đẩy đề xuống dưới cả những đề không có tín hiệu gì, tức là biến
 * một dòng dữ liệu lạ thành một thay đổi thứ tự không ai giải thích được.
 */
function buildSubjectWeakness(
  representatives: Iterable<RankAttempt>
): Map<string, number> | null {
  const sums = new Map<string, { total: number; count: number }>();
  for (const attempt of representatives) {
    if (attempt.subject === null || attempt.totalScore === null) continue;
    if (!Number.isFinite(attempt.totalScore)) continue;
    const bucket = sums.get(attempt.subject) ?? { total: 0, count: 0 };
    bucket.total += attempt.totalScore;
    bucket.count += 1;
    sums.set(attempt.subject, bucket);
  }
  if (sums.size === 0) return null;

  const weakness = new Map<string, number>();
  for (const [subject, { total, count }] of sums) {
    const mean = total / count;
    weakness.set(subject, clamp01(1 - mean / SCORE_MAX));
  }
  return weakness;
}

function clamp01(value: number): number {
  if (value < 0) return 0;
  if (value > 1) return 1;
  return value;
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
