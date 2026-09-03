// (history) route group — History read (backend Design Doc history-backend-design.md
// v1.2, § Query Implementation Shape). Server-only, mirrors features/exams/queries.ts's
// snake_case DB → camelCase mapping and throw-on-infrastructure-error convention.
import "server-only";
import { createClient } from "@/lib/supabase/server";
import { readBounded } from "@/lib/supabase/boundedRead";
import {
  deriveEssayView,
  hasIncompleteEssay,
  hasUnresolvedEssay,
} from "@/lib/scoring/essayLifecycle";
import type { PerQuestionResult } from "@/types/result";

export type MyHistoryEntry = {
  attemptId: string;
  examId: string;
  examTitle: string;
  subject: string;
  totalScore: number;
  startedAt: string;
  submittedAt: string;
  correct: number;
  total: number;
  /** Còn câu tự luận CHƯA NGÃ NGŨ (đang chấm, hoặc thất bại nhưng còn lượt) —
   *  chốt chặn xuất PDF (AC-058).
   *
   *  BẮT BUỘC và LUÔN tính được (`false` khi không dòng nào mang khoá vòng
   *  đời), nên không consumer nào có ca `undefined` phải xử lý. */
  hasUnresolvedEssay: boolean;
  /** Có câu tự luận nào đã dừng hẳn ở RS-6 (thất bại VÀ hết lượt) không —
   *  điều kiện in chú thích PDF (O-8).
   *
   *  HAI trường chứ không phải một, và D-13 lật lại hợp đồng v1.0 vì đúng lý
   *  do này: RS-6 KHÔNG suy được từ một boolean "còn chưa ngã ngũ" — hai vị từ
   *  loại trừ nhau theo cấu trúc (`unresolved` đòi CÒN lượt, `incomplete` đòi
   *  HẾT lượt). Gộp lại thì hai lối xuất PDF sinh ra hai tệp khác nhau cho cùng
   *  một lượt thi — đúng khuyết tật O-8 tồn tại để chặn, và là khuyết tật F-06
   *  mà lịch sử review của chính tính năng này đã bắt được một lần. */
  hasIncompleteEssay: boolean;
};

/** Shape PostgREST trả về cho embed lồng exam_results → exam_attempts → exams.
 *  Cả hai FK đều many-to-one nên mỗi embed là OBJECT, không phải mảng (giống
 *  EmbeddedRow của features/analytics/queries.ts). */
type EmbeddedRow = {
  attempt_id: string;
  total_score: number;
  correct: number;
  total: number;
  /** Nguyên liệu của hai boolean tự luận. KHÔNG băng qua biên component
   *  (UI-D11): nó dừng lại ở hàm này, chỉ hai boolean đi tiếp. */
  per_question: PerQuestionResult[] | null;
  /** Mốc bắt đầu của hạn chờ chấm. `getResult()` cũng select cột này (Task
   *  B2.1) — một cột thêm vào MỘT đường đọc mà không thêm vào đường kia chính
   *  là cơ chế của chế độ hỏng mà INT-2 tồn tại để bắt. */
  created_at: string;
  exam_attempts: {
    exam_id: string;
    started_at: string;
    submitted_at: string;
    exams: { title: string; subject: string };
  };
};

export async function listMyHistory(): Promise<MyHistoryEntry[]> {
  const supabase = await createClient();

  // MỘT round-trip cho cả 3 tầng dữ liệu (trước đây 3 query nối đuôi ≈ 3×RTT —
  // đo được ~463ms, sau khi gộp còn ~161ms). Dùng đúng pattern embedded join mà
  // features/analytics/queries.ts's getAnalyticsByRange() đã dựng sẵn cho cùng chuỗi quan
  // hệ này. Ba ràng buộc nghiệp vụ cũ được giữ nguyên, chỉ chuyển từ JS sang DB:
  //  - Bắt đầu TỪ exam_results ⇒ chỉ attempt đã chấm mới vào danh sách; không tin
  //    exam_attempts.status một mình (Assumed Behavior #1 / AC-001).
  //  - `exam_attempts!inner` + .eq(status,'submitted') ⇒ loại attempt dở dang.
  //  - `exams!inner` + .eq(...exams.status,'published') ⇒ giữ nguyên quy ước
  //    visibility của getExam() (features/exams/queries.ts): RLS exams_select_visible
  //    lọc, VÀ thêm filter published tường minh chồng lên — không dựa RLS một
  //    mình. Nhờ `!inner`, đề không published (kể cả đề CỦA CHÍNH người đọc bị
  //    hạ khỏi 'published') làm cả dòng bị loại, đúng ngữ nghĩa "omitted, not
  //    defaulted" của Exams-Visibility Edge Case — nay do DB cưỡng chế thay vì
  //    do map/filter ở JS.
  // Biên tường minh (P3). Đáng chú ý riêng ở hàm này: comment dưới đây dựa vào
  // "tập lịch sử của một user vốn nhỏ/bounded qua RLS" để biện minh cho việc sắp
  // xếp ở JS. RLS bó tập về MỘT người, nó KHÔNG bó số lượt người đó làm — nên
  // "bounded" ở đó là bounded theo hành vi, không phải theo cấu trúc. `readBounded`
  // biến giả định đó thành một thứ đo được: vượt trần thì có tiếng, chứ không âm
  // thầm mất những lượt CŨ NHẤT (sắp ở JS nên phần bị PostgREST cắt là phần chưa
  // sắp — mất dòng nào là do thứ tự PK, không ai đoán trước được).
  const rows = (await readBounded(
    "listMyHistory",
    supabase
      .from("exam_results")
      .select(
        "attempt_id, total_score, correct, total, per_question, created_at, exam_attempts!inner(exam_id, started_at, submitted_at, exams!inner(title, subject))"
      )
      .eq("exam_attempts.status", "submitted")
      .eq("exam_attempts.exams.status", "published")
  )) as EmbeddedRow[];

  // Sắp xếp ở JS, KHÔNG phải .order() DB-side: với embed to-one, supabase-js's
  // `.order(col, { referencedTable })` chỉ sắp xếp BÊN TRONG resource lồng (dành
  // cho to-many) nên là no-op ở đây — đã đo thực tế: dùng nó trả về đúng số dòng
  // nhưng SAI thứ tự (thứ tự PK), tức âm thầm vỡ AC-003. Sắp ở JS an toàn vì tập
  // lịch sử của một user vốn nhỏ/bounded qua RLS — cùng căn cứ với quyết định lọc
  // client-side-của-server-fetch ở lib/history/filterEntries.ts. So sánh chuỗi là
  // đúng thứ tự thời gian vì PostgREST trả timestamptz dạng ISO-8601 cùng offset.
  // MỘT `now` cho cả trang lịch sử, đọc ĐÚNG MỘT LẦN — không phải một
  // `new Date()` cho mỗi dòng. Hạn chờ dùng biên loại trừ, nên hai lần đọc đồng
  // hồ cách nhau một chút vẫn có thể nằm hai bên hạn chờ và cho hai dòng liền
  // nhau hai câu trả lời không nhất quán về cùng một sự thật.
  const now = new Date();

  return rows
    .map((r): MyHistoryEntry => {
      // Suy diễn ĐÚNG MỘT LẦN cho mỗi phần tử, rồi chỉ đưa những phần tử suy ra
      // được view vào hai vị từ. Cùng lối với `getResult()` (Task B2.1), và vì
      // cùng một lý do: hai vị từ dưới mỗi cái TỰ gấp lại mảng một lượt, nên
      // gọi thẳng cả hai trên mảng thô sẽ chạy `deriveEssayView()` hai lần trên
      // cùng phần tử — và với một `essayState` không nhận ra, EG-BE-025 hứa
      // ĐÚNG MỘT `console.warn` còn trang lịch sử nhả ra hai, cho mỗi dòng.
      // Đầu ra không đổi: `essayLifecycle` vốn đã bỏ qua mọi phần tử suy ra
      // `null`, nên lọc trước hay lọc trong đều cho cùng tập view.
      const stored = r.per_question ?? [];
      const createdAt = r.created_at;
      const derivable = stored.filter((el) => deriveEssayView(el, createdAt, now) !== null);

      return {
        attemptId: r.attempt_id,
        examId: r.exam_attempts.exam_id,
        examTitle: r.exam_attempts.exams.title,
        subject: r.exam_attempts.exams.subject,
        totalScore: r.total_score,
        startedAt: r.exam_attempts.started_at,
        submittedAt: r.exam_attempts.submitted_at,
        correct: r.correct,
        total: r.total,
        // Suy qua vị từ DÙNG CHUNG, không bao giờ suy lại tại chỗ (EG-BE-036):
        // `state === "failed" && !retryAvailable` được khai đúng một chỗ trong
        // repo. Hai lối xuất PDF đọc cùng hàm đó nên chúng không thể sinh ra
        // hai tệp khác nhau cho cùng một lượt thi.
        hasUnresolvedEssay: hasUnresolvedEssay(derivable, createdAt, now),
        hasIncompleteEssay: hasIncompleteEssay(derivable, createdAt, now),
      };
    })
    .sort((a, b) => (a.submittedAt < b.submittedAt ? 1 : a.submittedAt > b.submittedAt ? -1 : 0));
}
