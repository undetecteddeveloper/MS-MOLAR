// StartAttemptButton — nút "Bắt đầu" trên màn Exam Detail (Layer 2).
// GĐ 2 (M2.6): startAttempt() Server Action tạo attempt trong DB rồi redirect.
// (Trước đây GĐ 1 sinh attemptId client-side bằng crypto.randomUUID.)
// GĐ 3 M3.2: style brand, full-width trên mobile, auto trên desktop.
// S#17: button-primary theo DESIGN.md — nền đỏ son, chữ ngà, bo 4px, hover đậm
// hơn (#8F2523); bỏ glow shadow (quy tắc "không đổ bóng").

import { startAttempt } from "@/app/(layer2)/actions";
import { getTranslate } from "@/lib/i18n/server";

export async function StartAttemptButton({ examId }: { examId: string }) {
  const t = await getTranslate();
  const start = startAttempt.bind(null, examId);

  return (
    <form action={start}>
      <button
        type="submit"
        className="bg-brand text-brand-foreground w-full rounded-[4px] px-6 py-3 font-medium transition-colors duration-200 hover:bg-[#8F2523] sm:w-auto sm:px-12"
      >
        {t("exams.start")}
      </button>
    </form>
  );
}
