// (layer3) route group — Analytics read (docs/design/analytics-layer3-data-logic-design.md
// § getAnalyticsByRange). Server-only, mirrors (layer2)/queries.ts's/(HM)/queries.ts's
// snake_case DB → camelCase mapping + throw-on-infrastructure-error convention.
// RLS scopes the read to auth.uid() — no explicit user_id predicate needed
// (results_select_own/attempts_select_own, supabase/schema.sql).
import "server-only";
import { createClient } from "@/lib/supabase/server";
import { readBounded } from "@/lib/supabase/boundedRead";
import { aggregateAttemptsByRange, type AttemptRow } from "@/lib/analytics/aggregateAttempts";
import { MASTERY_CLEARED_THRESHOLD } from "@/lib/adaptive/constants";
import { recommendNextSkill } from "@/lib/adaptive/route";
import { buildTelemetryPayload } from "@/lib/tutor/telemetry";
import type { SubjectStats, TimeRange } from "@/lib/fake-data/analytics";
import type { SkillRecommendation } from "@/types/adaptive";

// PostgREST embedded shape: exam_results -> exam_attempts (!inner, to-one) ->
// exams (!inner, to-one). Both FKs are many-to-one, so each embed is an
// object, not an array.
type EmbeddedRow = {
  correct: number;
  total: number;
  exam_attempts: {
    submitted_at: string | null;
    status: string;
    exams: { subject: string };
  };
};

export async function getAnalyticsByRange(): Promise<Record<TimeRange, SubjectStats[]>> {
  const supabase = await createClient();

  // Biên tường minh (P3). Chạm trần ở đây hỏng theo kiểu riêng, tệ hơn một danh
  // sách thiếu dòng: đầu ra của hàm này là SỐ LIỆU TỔNG HỢP, nên dữ liệu thiếu
  // không hiện ra thành chỗ trống mà thành một con số SAI nhìn hoàn toàn hợp lý.
  const embedded = (await readBounded(
    "getAnalyticsByRange",
    supabase
      .from("exam_results")
      .select("correct, total, exam_attempts!inner(submitted_at, status, exams!inner(subject))")
      .eq("exam_attempts.status", "submitted")
  )) as EmbeddedRow[];

  const rows: AttemptRow[] = embedded.map((row) => ({
    correct: row.correct,
    total: row.total,
    submittedAt: row.exam_attempts.submitted_at,
    subject: row.exam_attempts.exams.subject,
  }));

  return aggregateAttemptsByRange(rows, new Date());
}

// --- Engine 1: gợi ý kỹ năng nên luyện tiếp (PRD R3) ------------------------

type SkillNodeRow = { id: string; label_vi: string };
type SkillEdgeRow = { skill_node_id: string; prerequisite_node_id: string };
type MasteryRow = {
  skill_node_id: string;
  correct_count: number;
  total_count: number;
  last_wrong_at: string | null;
};

/**
 * Ghi nhận MỘT lượt định tuyến vào `telemetry_log` — best-effort tuyệt đối.
 *
 * Cùng khuôn với `recordTutorTelemetry()` của explainStep(): một lệnh ghi quan
 * sát KHÔNG được phép trở thành điểm hỏng thứ hai của một lệnh đọc mà học sinh
 * đang chờ (cùng lập luận với cách submitExam() xử lý recordExamResult() hỏng).
 * Nuốt cả `error` trả về lẫn exception ném ra — hai đường hỏng khác nhau, phải
 * chặn cả hai.
 *
 * `user_id` lấy từ `auth.getUser()` chứ không suy ra từ dòng mastery: ca cold
 * start không có dòng mastery nào, mà đó lại đúng là ca cần đếm nhất.
 */
async function recordRouteTelemetry(
  supabase: Awaited<ReturnType<typeof createClient>>,
  userId: string | null,
  skillNodeId: string | null,
): Promise<void> {
  try {
    const { error } = await supabase.from("telemetry_log").insert(
      buildTelemetryPayload({
        eventType: "adaptive_route",
        userId,
        skillNodeId,
        success: true,
      }),
    );
    if (error) console.warn("[getSkillRecommendation] telemetry_log:", error.code, error.message);
  } catch (err) {
    console.warn("[getSkillRecommendation] telemetry_log ném lỗi:", (err as Error)?.name);
  }
}

/**
 * Kỹ năng người dùng hiện tại nên luyện tiếp, hoặc `null` khi chưa có dữ liệu.
 *
 * RLS lo phần phạm vi: `mastery_select_own` giới hạn `user_skill_mastery` về
 * đúng auth.uid(), nên KHÔNG cần (và không nên) thêm predicate user_id thủ công
 * — đúng quy ước của `getAnalyticsByRange()` phía trên.
 *
 * `skill_nodes`/`skill_prerequisites` là dữ liệu tham chiếu, mọi authenticated
 * user đọc được (§9b). Ba lệnh đọc chạy song song vì độc lập nhau.
 */
export async function getSkillRecommendation(): Promise<SkillRecommendation> {
  const supabase = await createClient();

  // Biên tường minh (P3). `skill_nodes`/`skill_prerequisites` là dữ liệu THAM
  // CHIẾU (taxonomy — 20 node/15 cạnh lúc đo 2026-08-17), nên chúng lớn theo tốc
  // độ người ta mở rộng taxonomy chứ không theo lưu lượng. Vẫn đặt biên, vì cắt
  // cụt một DAG thì tệ hơn cắt cụt một danh sách: mất một CẠNH tiên quyết làm
  // `recommendNextSkill` gợi ý một kỹ năng mà học sinh chưa đủ nền để học, và
  // không có gì trong đầu ra nói rằng nó đã tính trên đồ thị thiếu.
  //
  // `readBounded` NÉM lỗi hạ tầng nên ba nhánh `if (...Res.error) throw` cũ
  // không còn cần thiết — Promise.all lan exception ra ngoài y như cũ; thứ đổi
  // là error nào tới trước thì ném cái đó, thay vì luôn ưu tiên nodes → edges →
  // mastery. Không call site nào phân biệt được ba error đó nên thứ tự không phải
  // hành vi ai dựa vào.
  const [{ data: userData }, nodes, edges, mastery] = await Promise.all([
    supabase.auth.getUser(),
    readBounded(
      "getSkillRecommendation.nodes",
      supabase.from("skill_nodes").select("id, label_vi")
    ) as Promise<SkillNodeRow[]>,
    readBounded(
      "getSkillRecommendation.edges",
      supabase.from("skill_prerequisites").select("skill_node_id, prerequisite_node_id")
    ) as Promise<SkillEdgeRow[]>,
    readBounded(
      "getSkillRecommendation.mastery",
      supabase
        .from("user_skill_mastery")
        .select("skill_node_id, correct_count, total_count, last_wrong_at")
    ) as Promise<MasteryRow[]>,
  ]);

  const recommendation = recommendNextSkill({
    nodes: nodes.map((n) => ({
      id: n.id,
      labelVi: n.label_vi,
    })),
    edges: edges.map((e) => ({
      skillNodeId: e.skill_node_id,
      prerequisiteNodeId: e.prerequisite_node_id,
    })),
    mastery: mastery.map((m) => ({
      skillNodeId: m.skill_node_id,
      correctCount: m.correct_count,
      totalCount: m.total_count,
      lastWrongAt: m.last_wrong_at,
    })),
    threshold: MASTERY_CLEARED_THRESHOLD,
  });

  // Ghi telemetry cho MỌI lượt gọi, kể cả lượt không gợi ý được gì: R4 đếm số
  // lượt định tuyến, bỏ ca cold start là mất hẳn nhóm số liệu đông nhất.
  await recordRouteTelemetry(
    supabase,
    userData?.user?.id ?? null,
    recommendation?.nodeId ?? null,
  );

  if (recommendation === null) return null;

  // Bỏ HẲN nodeId: id trong DAG là chuyện nội bộ backend (Field Propagation
  // Map). Trả nguyên object của recommendNextSkill() sẽ rò nó ra hợp đồng UI.
  return { skillLabel: recommendation.labelVi, reasonCode: recommendation.reasonCode };
}
