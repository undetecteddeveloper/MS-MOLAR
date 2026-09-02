// essayLifecycle — vòng đời câu tự luận: lời khai DUY NHẤT của sáu khoá jsonb,
// bốn hằng số, ba kiểu ở biên đọc và bảy hàm suy diễn.
// Backend DD § Hợp đồng khoá jsonb / § Data Contracts / § State Transitions;
// ADR-0018 Decision 2 (tập band khai một lần, trong TypeScript) và Decision 4
// (trần lượt tiêu lúc claim, giá trị khởi tạo do computeScore() phát).
//
// HÀM THUẦN — không I/O, không `process.env`, không `server-only`. Ba lý do,
// theo thứ tự chúng cắn:
//
//   1. CẢ đường ghi lẫn đường đọc import file này (`computeScore()` phát khoá;
//      `getResult()` và `listMyHistory()` suy trạng thái). Một `import
//      "server-only"` ở đây sẽ kéo đường đọc vào một cây chỉ chạy được phía
//      server, và `next build` là chỗ phát hiện ra điều đó — sau khi bốn bề mặt
//      đã lỡ import.
//   2. ĐỒNG HỒ LÀ THAM SỐ, không phải phụ thuộc. `now` được TIÊM vào mọi hàm có
//      liên quan tới hạn chờ. Một `Date.now()` trong file này biến ba ca biên
//      của EG-BE-023 thành ba quả bom hẹn giờ: xanh hôm nay, đỏ vào một buổi
//      chiều không ai đụng gì tới nó.
//   3. TRẠNG THÁI CUỐI ĐƯỢC SUY RA, KHÔNG ĐƯỢC LƯU (bất biến I6, ADR-0018
//      Implementation Guidance #8). Không có writer nền nào cho `pending` quá
//      hạn — không cron, không queue, không sweeper, không "dọn lúc đăng nhập".
//      Giá trị LƯU vẫn là `pending` vĩnh viễn, và đó là đầu ra ĐÚNG trong một
//      bản dump SQL. Không hàm nào ở đây ghi gì, kể cả nắn tại chỗ tham số.

import type { PerQuestionResult } from "@/types/result";

/** Trạng thái đã SUY RA của một câu tự luận. `"failed"` gộp cả ca `pending`
 *  quá hạn (RS-5) — nó là thứ người dùng thấy, không phải thứ DB lưu. */
export type EssayRenderState = "pending" | "graded" | "failed";

/** Hình dạng ĐÃ LƯU của nhóm khoá `essay*` trên một phần tử `per_question`.
 *  Không export: đường đọc không bao giờ được cầm hình dạng thô này — nó chỉ
 *  tồn tại để `ESSAY_KEYS` không thể trỏ vào một khoá không có thật. */
interface StoredEssayEntry {
  essayState: EssayRenderState;
  essayEarned: number | null;
  essayMax: number | null;
  essayLowConfidence: boolean;
  essayAttempts: number;
  /** ISO-8601 do `now()` của DB sinh; chỉ `record_essay_grade()` ghi. */
  essayGradedAt?: string;
}

/** Sáu literal khoá jsonb — CHỖ DUY NHẤT trong repo được phép gõ sáu chuỗi
 *  này. `satisfies` buộc mỗi giá trị phải là một khoá có thật của
 *  `StoredEssayEntry`, nên đổi tên trường không thể để lại một literal cũ nằm
 *  lại đây. Tiền tố `essay` là bắt buộc chứ không phải trang trí: phần tử
 *  `per_question` dùng chung cho MỌI loại câu (`types/result.ts:6-25`), nên một
 *  khoá tên `state` vừa mơ hồ vừa không grep được. */
export const ESSAY_KEYS = {
  state: "essayState",
  earned: "essayEarned",
  max: "essayMax",
  lowConfidence: "essayLowConfidence",
  attempts: "essayAttempts",
  gradedAt: "essayGradedAt",
} as const satisfies Record<string, keyof StoredEssayEntry>;

/** Tập band ĐÓNG. ADR-0018 Decision 2: khai một lần, trong TypeScript; hai hàm
 *  SQL cố ý KHÔNG validate giá trị band, vì một `p_earned in (…)` trong thân
 *  hàm là lời khai thứ hai của cùng một quy tắc sản phẩm — đúng chế độ hai
 *  chiếc đồng hồ mà ADR-0010 đã từ chối. */
export const ESSAY_BANDS = [0, 0.25, 0.5, 0.75, 1] as const;

/** Mỗi câu tự luận đóng góp tối đa 1 điểm vào cặp earned/max, và CHỈ khi nó ở
 *  `graded` (W7/AC-059). */
export const ESSAY_MAX_POINTS = 1;

/** U2/AC-064: một lượt gốc + hai lượt chấm lại. Nửa TypeScript của cặp
 *  lời-khai-đôi DUY NHẤT mà thiết kế không xoá được (ADR-0018 chốt chữ ký hai
 *  tham số cho `claim_essay_grading_attempt()`); nửa SQL nằm trong thân hàm đó
 *  và hai bên được giữ khớp bằng cổng ghim của `verify:schema`, không bằng một
 *  bản sao thứ ba. */
export const ESSAY_MAX_ATTEMPTS = 3;

/** 10 phút. NEO VÀO TRẦN THỜI LƯỢNG CỦA NỀN TẢNG, không vào một ước lượng độ
 *  trễ: mặc định fluid compute là 300 s và `vercel.json` không hạ nó, nên 10
 *  phút = 2× trần đó ⇒ khi hạn chờ trôi qua thì KHÔNG invocation nào còn sống
 *  để ghi thêm gì. Lời hứa "không còn writer nào" vì thế đúng theo giới hạn nền
 *  tảng chứ không theo một phỏng đoán. */
export const ESSAY_PENDING_DEADLINE_MS = 600_000;

/** Năm khoá phát ra lúc insert. `essayGradedAt` KHÔNG nằm trong đây: nó là dấu
 *  thời gian của một sự kiện chưa xảy ra, và một `null` ở đó sẽ ngụ ý "đã chấm,
 *  không rõ lúc nào". */
export type EssayEntryKeys = Omit<StoredEssayEntry, typeof ESSAY_KEYS.gradedAt>;

/** Thứ DUY NHẤT băng qua biên server → client cho một câu tự luận (MSA-2). */
export interface EssayView {
  /** Trạng thái ĐÃ SUY RA. `"failed"` bao gồm cả ca pending-quá-hạn (RS-5). */
  state: EssayRenderState;
  /** Band đã ghi; `null` ở mọi trạng thái không phải `"graded"` (W7). */
  earned: number | null;
  /** Mẫu số của band; `null` ở mọi trạng thái không phải `"graded"` (W7). */
  max: number | null;
  lowConfidence: boolean;
  /** Còn chấm lại được không. BOOLEAN — không bao giờ là một con số. Kiểu này
   *  cố ý KHÔNG có trường nào mang số lượt: AC-044/UI-D9 được cưỡng chế bằng
   *  CẤU TRÚC, nên không call site nào rò con số ra client dù có muốn. */
  retryAvailable: boolean;
}

/** Tổng hợp mức-lượt-thi. Sáu trường, mỗi trường có một chuỗi hiển thị của UI
 *  Spec dùng đích danh — không trường nào tồn tại mà không có consumer. */
export interface EssaySummary {
  /** Điểm tự luận ĐÃ ĐƯỢC, TRONG THANG ĐIỂM CỦA ĐỀ (AC-059, sửa lại ở B1).
   *
   *  TRƯỚC B1 đây là tổng BAND (thang 0..1 mỗi câu), và mẫu số là `số câu đã
   *  chấm × 1`. Với đề cân bằng thì hai cách đọc trùng nhau, nên khác biệt
   *  không lộ ra. Với đề CÓ TRỌNG SỐ thì nó lộ ra ngay và nói sai: bài NLVH 5
   *  điểm được band 0.25 hiện ra "0.25 / 1 điểm" trong khi nó thật sự đóng góp
   *  1.25 điểm vào ô điểm lớn — hai con số cạnh nhau trên cùng một trang mà
   *  không đối chiếu được với nhau.
   *
   *  Nay cộng `earnedPoints`/`maxPoints` của chính các phần tử đã chấm, tức
   *  CÙNG hai trường mà `total_score` được tính từ. Dòng tự luận và ô điểm lớn
   *  vì thế không thể lệch nhau. */
  earned: number;
  /** Mẫu số tương ứng — tổng `maxPoints` của các câu `graded`. Xem trên. */
  max: number;
  gradedCount: number;
  /** RS-2 — prop của EssayGradingPoller. */
  pendingCount: number;
  /** RS-4 + RS-5 + RS-6. */
  failedCount: number;
  /** RS-2 + RS-4 + RS-5 — chốt chặn xuất PDF (AC-058). KHÔNG đếm RS-6: hết lượt
   *  là trạng thái CUỐI, nên chặn ở đó là chặn vĩnh viễn (O-8). */
  unresolvedCount: number;
}

const RENDER_STATES: readonly string[] = ["pending", "graded", "failed"];

function isRenderState(value: unknown): value is EssayRenderState {
  return typeof value === "string" && RENDER_STATES.includes(value);
}

/** Đọc một khoá đã lưu dưới dạng `unknown`. Phần tử tới từ jsonb, nên khai kiểu
 *  cho giá trị đọc lên là nói dối đúng ở chỗ EG-BE-025 tồn tại để bắt. */
function storedValue(row: PerQuestionResult, key: string): unknown {
  return Reflect.get(row, key);
}

function readFiniteNumber(value: unknown): number | null {
  return typeof value === "number" && Number.isFinite(value) ? value : null;
}

/** Số lượt đã tiêu. Khoá vắng mặt hoặc không phải số ⇒ 0: hướng an toàn là cho
 *  học sinh chấm lại được, không phải khoá nút vì một phần tử dị dạng. */
function readAttempts(row: PerQuestionResult): number {
  return readFiniteNumber(storedValue(row, ESSAY_KEYS.attempts)) ?? 0;
}

/** Biên LOẠI TRỪ (`>`): đúng bằng hạn chờ thì vẫn là `pending` (EG-BE-023).
 *  `createdAt` không parse được ⇒ `false`, tức coi như `now` — kết luận "thất
 *  bại" từ một dấu thời gian không đọc được là dựng một trạng thái CUỐI trên
 *  dữ liệu rác. */
function isPastDeadline(createdAt: string, now: Date): boolean {
  const createdMs = Date.parse(createdAt);
  if (Number.isNaN(createdMs)) return false;
  return now.getTime() - createdMs > ESSAY_PENDING_DEADLINE_MS;
}

/** Giá trị khởi tạo của năm khoá, lúc `computeScore()` insert. Object MỚI mỗi
 *  lần gọi: hai câu tự luận trong cùng lượt thi không được dùng chung tham
 *  chiếu, nếu không một lượt nắn tại chỗ sẽ đổi luôn phần tử bên cạnh. */
export function newEssayEntry(): EssayEntryKeys {
  return {
    essayState: "pending",
    essayEarned: null,
    essayMax: null,
    essayLowConfidence: false,
    essayAttempts: 0,
  };
}

/** Suy trạng thái hiển thị của MỘT câu từ `(phần tử đã lưu, created_at, now)`.
 *  Thuần và tất định, nên bốn bề mặt gọi nó đều nhận cùng một kết quả (I7).
 *  Không bao giờ ném.
 *
 *  - `null` khi khoá `essayState` VẮNG MẶT (RS-0/RS-1) — im lặng, không log.
 *  - `null` + ĐÚNG MỘT `console.warn` khi khoá có mặt mang giá trị lạ. Cảnh báo
 *    mang duy nhất `questionId` và giá trị lạ; bài làm của học sinh là nội dung
 *    UGC và không bao giờ được vào log server (AC-056). */
export function deriveEssayView(
  row: PerQuestionResult,
  createdAt: string,
  now: Date,
): EssayView | null {
  if (!Object.hasOwn(row, ESSAY_KEYS.state)) return null;

  const stored = storedValue(row, ESSAY_KEYS.state);
  if (!isRenderState(stored)) {
    console.warn("[essayLifecycle] gia tri vong doi khong nhan ra, bo qua phan tu", {
      questionId: row.questionId,
      [ESSAY_KEYS.state]: stored,
    });
    return null;
  }

  const state: EssayRenderState =
    stored === "pending" && isPastDeadline(createdAt, now) ? "failed" : stored;
  const graded = state === "graded";

  return {
    state,
    // Đọc giá trị đã ghi, KHÔNG thay bằng `ESSAY_MAX_POINTS` khi nó dị dạng:
    // dựng một `1` ở đây làm một lượt ghi hỏng trông như một lượt ghi lành.
    earned: graded ? readFiniteNumber(storedValue(row, ESSAY_KEYS.earned)) : null,
    max: graded ? readFiniteNumber(storedValue(row, ESSAY_KEYS.max)) : null,
    // `record_essay_grade()` là writer duy nhất của cờ này và nó ghi cùng lúc
    // với band, nên mọi trạng thái không phải `graded` đều là `false`.
    lowConfidence: graded && storedValue(row, ESSAY_KEYS.lowConfidence) === true,
    retryAvailable: state === "failed" && readAttempts(row) < ESSAY_MAX_ATTEMPTS,
  };
}

/** RS-6 — câu tự luận đã dừng hẳn: thất bại và không còn lượt chấm lại. Đây là
 *  lời khai DUY NHẤT của RS-6 trong toàn repo (EG-BE-036), phủ cả hai đường vào
 *  nó (`failed` đã lưu đã tiêu hết lượt, và `pending` quá hạn đã tiêu hết lượt).
 *
 *  Chữ ký nhận `EssayView`, KHÔNG nhận `EssayView | null | undefined`, và đó là
 *  một quyết định chứ không phải một sơ suất: `deriveEssayView()` trả `null`
 *  nghĩa là "dòng này KHÔNG ÁP DỤNG", chứ không phải "không incomplete" — gấp
 *  ca nullish vào đây sẽ trộn hai câu trả lời khác nhau thành một. Hệ quả thực
 *  dụng còn quan trọng hơn: chữ ký hẹp làm việc gọi vị từ này TẠI TRANG trở nên
 *  bất tiện, và đó là CÓ CHỦ Ý — lối tiêu thụ đúng là đọc trường đã published
 *  (`ExamResult.hasIncompleteEssay` / `MyHistoryEntry.hasIncompleteEssay`). */
export function isEssayIncomplete({ state, retryAvailable }: EssayView): boolean {
  return state === "failed" && !retryAvailable;
}

/** Câu chưa ngã ngũ: còn đang chấm, hoặc đã thất bại nhưng còn lượt. Rời hẳn
 *  `isEssayIncomplete()` theo cấu trúc — không view nào thoả cả hai — vì gộp
 *  hai sự thật này lại chính là khuyết tật F-06, và nó ship ra hai tệp PDF khác
 *  nhau cho cùng một lượt thi. */
export function isEssayUnresolved({ state, retryAvailable }: EssayView): boolean {
  return state === "pending" || (state === "failed" && retryAvailable);
}

/** Suy view cho cả mảng, bỏ các phần tử không áp dụng (dòng cũ, câu không chấm
 *  được, giá trị lạ). Một chỗ gấp mảng duy nhất, dùng chung cho ba hàm dưới —
 *  ba phép gấp riêng là ba cơ hội để chúng trôi lệch nhau.
 *
 *  Giữ kèm PHẦN TỬ GỐC bên cạnh view: `summariseEssays()` cần đọc
 *  `earnedPoints`/`maxPoints` trên chính phần tử ấy (AC-059), và tra lại bằng
 *  `questionId` sau khi đã gấp là mời gọi lỗi ghép sai dòng. */
function deriveEssayViews(
  rows: PerQuestionResult[],
  createdAt: string,
  now: Date,
): Array<{ row: PerQuestionResult; view: EssayView }> {
  const out: Array<{ row: PerQuestionResult; view: EssayView }> = [];
  for (const row of rows) {
    const view = deriveEssayView(row, createdAt, now);
    if (view !== null) out.push({ row, view });
  }
  return out;
}

/** Tổng hợp mức-lượt-thi, hoặc `undefined` khi không phần tử nào mang khoá vòng
 *  đời (dòng cũ / tính năng tắt) — đó là thứ giữ AC-012 đúng: `getResult()` của
 *  một dòng cũ không mọc thêm trường nào có giá trị.
 *
 *  Chỉ câu `graded` đóng góp vào CẢ HAI vế earned và max; `pending`, `failed` và
 *  câu không chấm được đóng góp 0 vào cả hai (EG-BE-027). Một `failed` cộng 0
 *  vào earned nhưng 1 vào max chính là con số 0 im lặng mà AC-015 cấm. */
export function summariseEssays(
  rows: PerQuestionResult[],
  createdAt: string,
  now: Date,
): EssaySummary | undefined {
  const pairs = deriveEssayViews(rows, createdAt, now);
  if (pairs.length === 0) return undefined;

  const graded = pairs.filter(({ view }) => view.state === "graded");

  // AC-059 — hai vế điểm trong THANG CỦA ĐỀ, cộng từ chính hai trường mà
  // `total_score` được tính từ.
  //
  // Nhánh lui về thang BAND khi phần tử không mang `maxPoints`: đó là dòng ghi
  // TRƯỚC B1, và nó phải đọc ra y hệt hôm qua (AC-012). Với đề cân bằng hai
  // nhánh cho cùng con số, nên chuyển đổi không nhìn thấy được ở đề trắc nghiệm.
  let earned = 0;
  let max = 0;
  for (const { row, view } of graded) {
    if (typeof row.maxPoints === "number" && Number.isFinite(row.maxPoints)) {
      max += row.maxPoints;
      earned +=
        typeof row.earnedPoints === "number" && Number.isFinite(row.earnedPoints)
          ? row.earnedPoints
          : 0;
    } else {
      max += ESSAY_MAX_POINTS;
      earned += view.earned ?? 0;
    }
  }

  return {
    earned,
    max,
    gradedCount: graded.length,
    pendingCount: pairs.filter(({ view }) => view.state === "pending").length,
    failedCount: pairs.filter(({ view }) => view.state === "failed").length,
    unresolvedCount: pairs.filter(({ view }) => isEssayUnresolved(view)).length,
  };
}

/** Còn câu tự luận chưa ngã ngũ trong lượt thi này không — chốt chặn xuất PDF
 *  (AC-058). LUÔN tính được: `false` khi không dòng nào mang khoá vòng đời, nên
 *  consumer không có ca nào phải xử lý ngoài `true`/`false`.
 *
 *  Ghim với `summariseEssays()`: `hasUnresolvedEssay(...) ===
 *  (summariseEssays(...)?.unresolvedCount ?? 0) > 0` (EG-BE-034). */
export function hasUnresolvedEssay(
  rows: PerQuestionResult[],
  createdAt: string,
  now: Date,
): boolean {
  return deriveEssayViews(rows, createdAt, now).some(({ view }) => isEssayUnresolved(view));
}

/** Có câu tự luận nào đã dừng hẳn ở RS-6 không — điều kiện in chú thích
 *  `result.essay.pdfIncomplete` (O-8). Hai lối xuất PDF đọc CÙNG hàm này qua
 *  `AttemptPdfData`, nên chúng không thể sinh ra hai tệp khác nhau cho cùng một
 *  lượt thi. */
export function hasIncompleteEssay(
  rows: PerQuestionResult[],
  createdAt: string,
  now: Date,
): boolean {
  return deriveEssayViews(rows, createdAt, now).some(({ view }) => isEssayIncomplete(view));
}
