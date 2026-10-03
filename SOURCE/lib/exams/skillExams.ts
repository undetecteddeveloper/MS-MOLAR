// Đề chứa một dạng bài — nối `questions.skill_node_id` với `exams.question_ids`.
//
// Hai tính năng dùng chung một phép nối để thẻ gợi ý ở Thống kê và lưới Kho đề
// không thể bất đồng về "đề nào chứa dạng này": `features/analytics` (đếm đề chưa
// làm cho từng dạng yếu) và `features/exams` (lọc `?skill=`). Vì vậy nó nằm ở
// lib/ chứ không thuộc tính năng nào (luật B4: tính năng không import nhau).
//
// Không có RPC/view: `questions` KHÔNG có cột `exam_id` — đề giữ mảng
// `question_ids` — nên phép nối làm trong Node bằng hai lượt đọc nối tiếp
// (câu của dạng → đề chứa các câu ấy). Thêm RPC là một migration prod chỉ để
// gộp hai round-trip, trong khi kho hiện chỉ vài chục đề.
//
// Client Supabase do chỗ gọi đưa vào (đã gắn phiên người dùng): RLS
// `questions_select_visible` / `skill_nodes_select_authenticated` chỉ cho vai
// `authenticated`, nên khách chưa đăng nhập đọc ra rỗng — link `?skill=` mở ở
// phiên khách cho lưới rỗng thường (brief 20261003, AC-07).
import type { createClient } from "@/lib/supabase/server";
import { readBounded } from "@/lib/supabase/boundedRead";

type Supabase = Awaited<ReturnType<typeof createClient>>;

export interface SkillExam {
  id: string;
  /** `exams.subject` thô — khoá canonical ("Math"…) với đề UGC. */
  subject: string;
}

/**
 * Số id câu hỏi tối đa trong MỘT lệnh `.overlaps("question_ids", …)`. Bộ lọc đi
 * qua query string của GET nên danh sách id dài là URL dài mà proxy/CDN cắt
 * không báo — cùng con số và lý do với `QUESTION_ID_CHUNK` của
 * features/analytics/queries.ts (100 id × ~45 ký tự ≈ 5 KB, dưới trần 8 KB).
 */
const QUESTION_ID_CHUNK = 100;

type QuestionRow = { id: string; skill_node_id: string | null };
type ExamRow = { id: string; subject: string; question_ids: string[] | null };

/**
 * Với mỗi dạng bài trong `skillIds`, các đề PUBLISHED chứa ít nhất một câu
 * thuộc dạng đó. Mọi id đầu vào đều có khoá trong map (mảng rỗng = chưa có đề
 * nào) nên chỗ gọi không phải phân biệt "vắng khoá" với "không đề".
 *
 * Không ném khi dữ liệu thiếu; NÉM lỗi hạ tầng của PostgREST (quy ước chung của
 * các file queries).
 */
export async function readExamsBySkill(
  supabase: Supabase,
  skillIds: readonly string[],
): Promise<Map<string, SkillExam[]>> {
  const result = new Map<string, SkillExam[]>(skillIds.map((id) => [id, []]));
  if (skillIds.length === 0) return result;

  const questionRows = (await readBounded(
    "readExamsBySkill.questions",
    supabase.from("questions").select("id, skill_node_id").in("skill_node_id", [...skillIds]),
  )) as QuestionRow[];

  const skillOfQuestion = new Map<string, string>();
  for (const row of questionRows) {
    if (row.skill_node_id !== null) skillOfQuestion.set(row.id, row.skill_node_id);
  }
  const questionIds = [...skillOfQuestion.keys()];
  if (questionIds.length === 0) return result;

  const chunks: string[][] = [];
  for (let i = 0; i < questionIds.length; i += QUESTION_ID_CHUNK) {
    chunks.push(questionIds.slice(i, i + QUESTION_ID_CHUNK));
  }

  // `status = 'published'` tường minh: RLS còn cho tác giả đọc đề chưa xuất bản
  // của chính họ, mà đề ấy không được vào danh mục (R-7, cùng guard `fetchExamRows`).
  const examChunks = (await Promise.all(
    chunks.map(
      (chunk, index) =>
        readBounded(
          `readExamsBySkill.exams#${index}`,
          supabase
            .from("exams")
            .select("id, subject, question_ids")
            .eq("status", "published")
            .overlaps("question_ids", chunk),
        ) as Promise<ExamRow[]>,
    ),
  )) as ExamRow[][];

  // Một đề có thể rơi vào nhiều lô: gộp theo id trước khi phân về từng dạng.
  const examById = new Map<string, ExamRow>();
  for (const rows of examChunks) {
    for (const exam of rows) examById.set(exam.id, exam);
  }

  for (const exam of examById.values()) {
    const skillsInExam = new Set<string>();
    for (const questionId of exam.question_ids ?? []) {
      const skillId = skillOfQuestion.get(questionId);
      if (skillId !== undefined) skillsInExam.add(skillId);
    }
    for (const skillId of skillsInExam) {
      result.get(skillId)?.push({ id: exam.id, subject: exam.subject });
    }
  }
  return result;
}
