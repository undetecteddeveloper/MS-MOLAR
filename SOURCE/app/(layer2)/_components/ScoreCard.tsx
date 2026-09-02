// ScoreCard — block tổng kết điểm ở màn Result (Layer 2). M1.7 → GĐ 3 M3.1 Task 4.
//
// ═══ G1 (2026-09-01) — VÙNG 0-DIFF ĐÃ ĐƯỢC MỞ, CÓ CHỦ ĐÍCH ═══
//
// ADR-0018 § Amendment đóng băng file này ("bất kỳ diff nào là hồi quy") vì
// ĐÚNG HAI lý do. B1/B2/B3 trả lời cả hai, nên khoá được gỡ — xem Amendment
// 2026-09-01 trong chính ADR đó:
//
//   1. "Gộp tự luận vào điểm hiển thị làm ĐỔI NGHĨA `total` và ngầm phá phép
//      suy `sai = tổng − đúng` trong chính component này."
//      → KHÔNG còn đúng. `correct`/`total` giữ NGUYÊN nghĩa cũ: chúng đếm câu
//        CHẤM TỰ ĐỘNG. Câu tự luận đi vào điểm qua một kênh KHÁC HẲN
//        (`earnedPoints`/`maxPoints`), không đụng tới hai ô đếm. `wrong =
//        result.total - result.correct` ngay dưới đây vẫn đúng từng byte, và
//        `computeScore.test.ts` ghim điều đó.
//
//   2. "Một con số đầu bảng tự đổi một giờ sau khi nộp chính là sự bất ổn mà
//      Amendment này tồn tại để ba bề mặt phải tôn trọng."
//      → Cách chữa cũ là ĐÓNG BĂNG con số; cái giá là ô lớn NÓI SAI SỰ THẬT
//        (10.0/10 trên bài đáng 4.75/10) chứ không phải nói thiếu. G1 chữa
//        bằng cách HOÃN HIỆN: chưa chấm xong thì không có con số nào để mà
//        nhảy. Ô lớn đi thẳng từ "đang chấm…" sang điểm CUỐI.
//
// Đề thuần trắc nghiệm: `pending` luôn `false` ⇒ không đổi một pixel nào.
// Template `resultpage_L2_mobile.png` block lớn: tên đề · số câu đúng · sai · thời gian.
// Visual "tờ giấy trắng": nền card, hairline, điểm lớn nổi bật (UI-LAYER-MAP 4.4) —
// KHÔNG fill màu (màu template chỉ tượng trưng, Q6).

import { getTranslate } from "@/lib/i18n/server";
import type { ScoreResult } from "@/types/result";

export async function ScoreCard({
  examTitle,
  result,
  completionTimeLabel,
  pending = false,
}: {
  examTitle: string;
  result: ScoreResult;
  completionTimeLabel: string;
  /** G1 — lượt thi này CÒN câu tự luận chưa ngã ngũ, nên điểm chưa phải điểm
   *  cuối. Xem khối "G1" ở đầu file.
   *
   *  MẶC ĐỊNH `false`, và tính mặc-định-được ấy gánh việc chứ không cho gọn:
   *  một dòng ghi TRƯỚC tính năng chấm tự luận không có khoá vòng đời nào, nên
   *  caller truyền `false`, nên component render y hệt bản cũ — đó là cách
   *  AC-012 ("dòng cũ giữ nguyên từng byte") tiếp tục đúng sau thay đổi này. */
  pending?: boolean;
}) {
  const t = await getTranslate();
  const wrong = result.total - result.correct;

  return (
    <section className="border-border bg-card rounded-xl border p-6 text-center sm:p-8">
      <span className="eyebrow">{t("result.title")}</span>
      <h1 className="text-card-foreground mt-2 font-serif text-2xl leading-snug">{examTitle}</h1>

      {/* Điểm lớn nổi bật — thang 10, HOẶC "đang chấm…" khi chưa ngã ngũ (G1). */}
      {pending ? (
        <p className="text-muted-foreground mt-5 font-serif text-2xl leading-none">
          {t("result.scorePending")}
        </p>
      ) : (
        <p className="mt-5 flex items-baseline justify-center gap-1">
          <span className="text-brand font-serif text-6xl leading-none tabular-nums">
            {result.totalScore.toFixed(1)}
          </span>
          <span className="text-muted-foreground font-serif text-2xl">/10</span>
        </p>
      )}

      {/* Thống kê: đúng · sai · thời gian. Time cell nhận completionTimeLabel
          đã format sẵn từ caller (Task 12) — component này chỉ hiển thị, không
          tự tính toán ngày giờ (xem lib/history/format.ts). */}
      <dl className="border-border mt-6 grid grid-cols-3 gap-3 border-t pt-5 text-center">
        <div className="flex flex-col gap-1">
          <dt className="eyebrow">{t("common.correct")}</dt>
          <dd className="text-foreground font-serif text-xl tabular-nums">{result.correct}</dd>
        </div>
        <div className="flex flex-col gap-1">
          <dt className="eyebrow">{t("common.wrong")}</dt>
          <dd className="text-foreground font-serif text-xl tabular-nums">{wrong}</dd>
        </div>
        <div className="flex flex-col gap-1">
          <dt className="eyebrow">{t("result.time")}</dt>
          <dd className="text-muted-foreground font-serif text-xl tabular-nums">
            {completionTimeLabel}
          </dd>
        </div>
      </dl>
    </section>
  );
}
