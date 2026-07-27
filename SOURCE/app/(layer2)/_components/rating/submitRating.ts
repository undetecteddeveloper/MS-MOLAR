// SOURCE/app/(layer2)/_components/rating/submitRating.ts  ("use client" caller;
// rateExam là server action). Mapping PartId→cột và mapping error-union→copy
// LÀ ranh giới hợp đồng giữa RatingRubric's onSubmit và chữ ký rateExam
// (SOURCE/app/(layer2)/actions.ts) — không đổi khi redesign UI.

import { rateExam } from "@/app/(layer2)/actions";
import { rateErrorMessage, type PartId, type PartScore } from "@/lib/rating";

export async function submitRating(
  examId: string,
  scores: Record<PartId, PartScore>
): Promise<{ ok: true } | { ok: false; message: string }> {
  const res = await rateExam(examId, {
    partI: scores.mcq,
    partII: scores.true_false,
    partIII: scores.short_answer,
  });
  if (!res.error) return { ok: true };
  return { ok: false, message: rateErrorMessage(res.error) };
}
