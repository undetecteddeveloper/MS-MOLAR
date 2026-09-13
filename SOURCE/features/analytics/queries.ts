// (analytics) route group — Analytics read (docs/design/analytics-layer3-data-logic-design.md
// § getAnalyticsByRange). Server-only, mirrors features/exams/queries.ts's/(history)/queries.ts's
// snake_case DB → camelCase mapping + throw-on-infrastructure-error convention.
// RLS scopes the read to auth.uid() — no explicit user_id predicate needed
// (results_select_own/attempts_select_own, supabase/schema.sql).
import "server-only";
import { createClient } from "@/lib/supabase/server";
import { readBounded } from "@/lib/supabase/boundedRead";
import { aggregateAttemptsByRange, type AttemptRow } from "@/lib/analytics/aggregateAttempts";
import { rankWeakTopicsByRange, type TopicWeakness } from "@/lib/analytics/weakTopics";
import { deriveEssayView } from "@/lib/scoring/essayLifecycle";
import type { PerQuestionResult } from "@/types/result";
import { MASTERY_CLEARED_THRESHOLD } from "@/lib/adaptive/constants";
import { recommendNextSkill } from "@/lib/adaptive/route";
import { buildTelemetryPayload } from "@/lib/tutor/telemetry";
import { NEEDS_REVIEW_THRESHOLD, type SubjectStats, type TimeRange } from "@/lib/analytics/constants";
import type { SkillRecommendation } from "@/types/adaptive";

// PostgREST embedded shape: exam_results -> exam_attempts (!inner, to-one) ->
// exams (!inner, to-one). Both FKs are many-to-one, so each embed is an
// object, not an array.
type EmbeddedRow = {
  correct: number;
  total: number;
  /** `numeric` — driver có thể trả CHUỖI ("6.50"); chuẩn hoá ngay tại biên. */
  total_score: number | string;
  per_question: PerQuestionResult[] | null;
  /** Mốc suy vòng đời tự luận (pending quá hạn → failed). */
  created_at: string;
  topic_breakdown: { topic: string; correct: number; total: number }[] | null;
  exam_attempts: {
    started_at: string;
    submitted_at: string | null;
    status: string;
    exams: { subject: string; duration_minutes: number | null };
  };
};

export interface AnalyticsPageData {
  statsByRange: Record<TimeRange, SubjectStats[]>;
  weakTopicsByRange: Record<TimeRange, TopicWeakness[]>;
}

export async function getAnalyticsByRange(): Promise<AnalyticsPageData> {
  const supabase = await createClient();

  // Biên tường minh (P3). Chạm trần ở đây hỏng theo kiểu riêng, tệ hơn một danh
  // sách thiếu dòng: đầu ra của hàm này là SỐ LIỆU TỔNG HỢP, nên dữ liệu thiếu
  // không hiện ra thành chỗ trống mà thành một con số SAI nhìn hoàn toàn hợp lý.
  //
  // `topic_breakdown` đi kèm trong CHÍNH lệnh đọc này chứ không phải một lệnh
  // thứ hai: hai bộ số liệu rút ra từ cùng một tập dòng, tách ra đọc lại là
  // thêm một round-trip cho dữ liệu đã nằm sẵn trong tay.
  // `total_score` + `per_question` + `created_at` đi kèm (2026-09-13) cho hàng
  // Ngữ văn/Tiếng Anh: điểm trung bình thay đúng/sai — cùng lệnh đọc.
  const embedded = (await readBounded(
    "getAnalyticsByRange",
    supabase
      .from("exam_results")
      .select(
        "correct, total, total_score, per_question, created_at, topic_breakdown, exam_attempts!inner(started_at, submitted_at, status, exams!inner(subject, duration_minutes))"
      )
      .eq("exam_attempts.status", "submitted")
  )) as EmbeddedRow[];

  // Cùng mốc `now` cho cả hai reducer VÀ cho phép suy vòng đời tự luận — hai
  // lượt `new Date()` riêng có thể rơi vào hai phía của một biên range và làm
  // biểu đồ mâu thuẫn với danh sách ngay bên cạnh nó.
  const now = new Date();

  const rows: AttemptRow[] = embedded.map((row) => {
    // Vòng đời từng câu tự luận suy ĐÚNG MỘT LẦN mỗi dòng (cùng cách getResult()
    // làm): `null` = không phải câu tự luận có chấm. Lượt còn câu `pending` thì
    // `total_score` là con số TẠM → totalScore null, không vào trung bình.
    const perQuestion = row.per_question ?? [];
    const essays = perQuestion
      .map((r) => ({ row: r, view: deriveEssayView(r, row.created_at, now) }))
      .filter((e) => e.view !== null);
    const pending = essays.some((e) => e.view!.state === "pending");
    const blankEssays = essays.filter((e) => (e.row.selected ?? "").trim() === "").length;
    return {
      correct: row.correct,
      total: row.total,
      totalScore: pending ? null : Number(row.total_score),
      blankEssays,
      // `started_at` + `duration_minutes` đi kèm để reducer cộng thời gian làm bài
      // theo môn, trần theo thời lượng đề (vòng tròn "Thời gian luyện theo môn",
      // 2026-09-06) — cùng lệnh đọc, không thêm round-trip.
      startedAt: row.exam_attempts.started_at,
      submittedAt: row.exam_attempts.submitted_at,
      durationMinutes: row.exam_attempts.exams.duration_minutes,
      subject: row.exam_attempts.exams.subject,
    };
  });

  const topicRows = embedded.map((row) => ({
    subject: row.exam_attempts.exams.subject,
    submittedAt: row.exam_attempts.submitted_at,
    topicBreakdown: row.topic_breakdown ?? [],
  }));

  // Dùng LẠI ngưỡng "NEEDS REVIEW" của biểu đồ: nếu một môn bị gắn cờ theo mốc
  // 75% mà danh sách chủ đề lại lọc theo mốc khác, người đọc sẽ thấy một môn
  // "cần ôn" không có chủ đề nào bên dưới nó, và không có gì giải thích vì sao.
  return {
    statsByRange: aggregateAttemptsByRange(rows, now),
    weakTopicsByRange: rankWeakTopicsByRange(topicRows, now, NEEDS_REVIEW_THRESHOLD),
  };
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
