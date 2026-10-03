// Bộ lọc `?skill=` của Kho đề: đề chứa một dạng bài + nhãn của dạng đó.
//
// Phép nối "dạng bài → đề chứa nó" dùng chung với thẻ gợi ý ở Thống kê nên nằm ở
// `lib/exams/skillExams.ts`; file này chỉ là phần RIÊNG của Kho đề.
import "server-only";

import { createClient } from "@/lib/supabase/server";
import { readExamsBySkill } from "@/lib/exams/skillExams";

type Supabase = Awaited<ReturnType<typeof createClient>>;

/** Id các đề published chứa dạng `skillId` — đầu vào của bộ lọc `?skill=`. */
export async function listExamIdsBySkill(supabase: Supabase, skillId: string): Promise<string[]> {
  const bySkill = await readExamsBySkill(supabase, [skillId]);
  return (bySkill.get(skillId) ?? []).map((exam) => exam.id);
}

/** Nhãn tiếng Việt của dạng bài, hoặc `null` khi id không tồn tại / không đọc được. */
export async function getSkillLabel(skillId: string): Promise<string | null> {
  const supabase = await createClient();
  const { data, error } = await supabase
    .from("skill_nodes")
    .select("label_vi")
    .eq("id", skillId)
    .maybeSingle();
  if (error) throw error;
  return (data as { label_vi: string } | null)?.label_vi ?? null;
}
