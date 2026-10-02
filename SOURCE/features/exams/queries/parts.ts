// Số PHẦN của từng câu — chỉ để bảng câu hỏi ở màn bài giải chia mục theo phần.
//
// Một truy vấn nhẹ (hai cột, không đáp án, không ký ảnh) thay vì kéo cả
// `getExamForPlayer`. Cùng ranh giới bảo mật với player.ts: KHÔNG select đáp án.
import "server-only";

import { createClient } from "@/lib/supabase/server";

/** `question id → số phần` (câu không khai phần = phần 1). Rỗng khi không có id. */
export async function getQuestionPartNumbers(questionIds: string[]): Promise<Map<string, number>> {
  if (questionIds.length === 0) return new Map();
  const supabase = await createClient();
  const { data, error } = await supabase
    .from("questions")
    .select("id, part_number")
    .in("id", questionIds);
  if (error) throw error;
  return new Map(
    (data as Array<{ id: string; part_number: number | null }>).map((r) => [
      r.id,
      r.part_number ?? 1,
    ])
  );
}
