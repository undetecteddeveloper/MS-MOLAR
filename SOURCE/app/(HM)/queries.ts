// (HM) route group — History read (backend Design Doc history-backend-design.md
// v1.2, § Query Implementation Shape). Server-only, mirrors (layer2)/queries.ts's
// snake_case DB → camelCase mapping and throw-on-infrastructure-error convention.
import "server-only";
import { createClient } from "@/lib/supabase/server";

export type MyHistoryEntry = {
  attemptId: string;
  examId: string;
  examTitle: string;
  subject: string;
  totalScore: number;
  startedAt: string;
  submittedAt: string;
};

/** Shape PostgREST trả về cho embed lồng exam_results → exam_attempts → exams.
 *  Cả hai FK đều many-to-one nên mỗi embed là OBJECT, không phải mảng (giống
 *  EmbeddedRow của (layer3)/queries.ts). */
type EmbeddedRow = {
  attempt_id: string;
  total_score: number;
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
  // (layer3)/queries.ts's getAnalyticsByRange() đã dựng sẵn cho cùng chuỗi quan
  // hệ này. Ba ràng buộc nghiệp vụ cũ được giữ nguyên, chỉ chuyển từ JS sang DB:
  //  - Bắt đầu TỪ exam_results ⇒ chỉ attempt đã chấm mới vào danh sách; không tin
  //    exam_attempts.status một mình (Assumed Behavior #1 / AC-001).
  //  - `exam_attempts!inner` + .eq(status,'submitted') ⇒ loại attempt dở dang.
  //  - `exams!inner` + .eq(...exams.status,'published') ⇒ giữ nguyên quy ước
  //    visibility của getExam() ((layer2)/queries.ts): RLS exams_select_visible
  //    lọc, VÀ thêm filter published tường minh chồng lên — không dựa RLS một
  //    mình. Nhờ `!inner`, đề không published (kể cả đề CỦA CHÍNH người đọc bị
  //    hạ khỏi 'published') làm cả dòng bị loại, đúng ngữ nghĩa "omitted, not
  //    defaulted" của Exams-Visibility Edge Case — nay do DB cưỡng chế thay vì
  //    do map/filter ở JS.
  const { data, error } = await supabase
    .from("exam_results")
    .select(
      "attempt_id, total_score, exam_attempts!inner(exam_id, started_at, submitted_at, exams!inner(title, subject))"
    )
    .eq("exam_attempts.status", "submitted")
    .eq("exam_attempts.exams.status", "published");
  if (error) throw error;

  // Sắp xếp ở JS, KHÔNG phải .order() DB-side: với embed to-one, supabase-js's
  // `.order(col, { referencedTable })` chỉ sắp xếp BÊN TRONG resource lồng (dành
  // cho to-many) nên là no-op ở đây — đã đo thực tế: dùng nó trả về đúng số dòng
  // nhưng SAI thứ tự (thứ tự PK), tức âm thầm vỡ AC-003. Sắp ở JS an toàn vì tập
  // lịch sử của một user vốn nhỏ/bounded qua RLS — cùng căn cứ với quyết định lọc
  // client-side-của-server-fetch ở lib/history/filterEntries.ts. So sánh chuỗi là
  // đúng thứ tự thời gian vì PostgREST trả timestamptz dạng ISO-8601 cùng offset.
  return (data as unknown as EmbeddedRow[])
    .map(
      (r): MyHistoryEntry => ({
        attemptId: r.attempt_id,
        examId: r.exam_attempts.exam_id,
        examTitle: r.exam_attempts.exams.title,
        subject: r.exam_attempts.exams.subject,
        totalScore: r.total_score,
        startedAt: r.exam_attempts.started_at,
        submittedAt: r.exam_attempts.submitted_at,
      })
    )
    .sort((a, b) => (a.submittedAt < b.submittedAt ? 1 : a.submittedAt > b.submittedAt ? -1 : 0));
}
