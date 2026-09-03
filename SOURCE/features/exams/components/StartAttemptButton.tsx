// StartAttemptButton — nút "Bắt đầu" trên màn Exam Detail (Layer 2).
// GĐ 2 (M2.6): startAttempt() Server Action tạo attempt trong DB rồi redirect.
// (Trước đây GĐ 1 sinh attemptId client-side bằng crypto.randomUUID.)
// GĐ 3 M3.2: style brand, full-width trên mobile, auto trên desktop.
// S#17: button-primary theo globals.css — nền đỏ son, chữ ngà, bo 4px, hover đậm
// hơn (#8F2523); bỏ glow shadow (quy tắc "không đổ bóng").
//
// Chỉ báo chờ (2026-08-28): RouteLoadingOverlay bắt điều hướng bằng cách nghe
// click trên thẻ <a>. Nút này KHÔNG phải thẻ <a> — nó submit một form gọi
// Server Action, và action đó còn phải tạo attempt trong DB trước khi redirect.
// Nghĩa là đúng nút chậm nhất trong luồng lại là nút duy nhất không có phản hồi
// nào: người dùng bấm, màn hình đứng im, nên họ bấm tiếp. Nút tự báo qua
// `startPageNavigationIndicator()` (kênh có sẵn cho điều hướng không đi qua cú
// bấm liên kết) và tự khoá + đổi nhãn trong lúc chờ.

import { startAttempt } from "@/features/exams/actions";
import { getTranslate } from "@/lib/i18n/server";
import { StartAttemptSubmit } from "@/features/exams/components/StartAttemptSubmit";

export async function StartAttemptButton({ examId }: { examId: string }) {
  const t = await getTranslate();
  const start = startAttempt.bind(null, examId);

  return (
    <form action={start}>
      <StartAttemptSubmit label={t("exams.start")} pendingLabel={t("common.loading")} />
    </form>
  );
}
