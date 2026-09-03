// SOURCE/features/exams/components/rating/submitRating.ts  ("use client" caller;
// rateExam là server action). Mapping PartId→cột và mapping error-union→copy
// LÀ ranh giới hợp đồng giữa RatingRubric's onSubmit và chữ ký rateExam
// (SOURCE/features/exams/actions.ts) — không đổi khi redesign UI.

import { rateExam } from "@/features/exams/actions";
import type { PartId, PartScore, RateExamError } from "@/lib/rating";

// Trả về CODE lỗi thay vì message đã dịch sẵn — `rateErrorMessage` (lib/rating)
// bake tiếng Anh và có test đơn vị assert đúng chuỗi đó, nên giữ nguyên làm dữ
// liệu thuần. RatingRubric (client, có `t`) tự map code → câu theo ngôn ngữ
// đang chọn, cùng kiến trúc với formatUgcError.
export async function submitRating(
  examId: string,
  scores: Record<PartId, PartScore>
): Promise<{ ok: true } | { ok: false; error: RateExamError }> {
  const res = await rateExam(examId, {
    partI: scores.mcq,
    partII: scores.true_false,
    partIII: scores.short_answer,
  });
  if (!res.error) return { ok: true };
  return { ok: false, error: res.error };
}
