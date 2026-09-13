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
//
// 2026-09-13 (engineer, test điện thoại thật): lúc `pending`, ô lớn hiện một
// VÒNG XOAY thay cho câu "Đang chấm phần tự luận…" (câu ấy còn lại cho trình
// đọc màn hình), và dòng "Tự luận" riêng dưới thẻ (EssayScoreLine) bỏ hẳn —
// thẻ này là chỗ DUY NHẤT nói về trạng thái chấm. Vòng xoay giữ đúng chiều cao
// 64px của con số để lúc điểm cuối đáp xuống, ba ô Đúng/Sai/Thời gian không
// nhảy. `pending` vẫn đọc từ `unresolvedCount` của EssayGradingPoller — lượt
// refresh cuối của poller là lượt gỡ vòng xoay.
//
// Theme "Sân trường" (2026-09-06): thẻ tô nền surface, căn giữa (một trong hai
// ngoại lệ của quy tắc căn trái — design plan §3). Điểm 64px màu xanh hành
// động, "trên 10" đứng cạnh. Ba ô Đúng / Sai / Thời gian là ô trắng trên nền
// surface; Đúng và Sai có chấm màu ĐI KÈM chữ (trạng thái bằng hình lẫn màu,
// §4.3). KHÔNG có ô "Bỏ trống": `wrong = total − correct` là phép suy đã ghim
// ở trên, tách bỏ trống ra khỏi "Sai" là đổi nghĩa con số.

import { Loader2 } from "lucide-react";
import { Card } from "@/components/ui/card";
import { t } from "@/lib/copy";
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
  const wrong = result.total - result.correct;

  return (
    <Card as="section" className="items-center gap-2 text-center">
      <span className="eyebrow">{t("result.title")}</span>
      <h1 className="text-foreground text-xl leading-snug font-semibold">{examTitle}</h1>

      {/* Điểm lớn nổi bật — thang 10, HOẶC vòng xoay khi chưa ngã ngũ (G1).
          `h-16` = 64px, đúng chiều cao dòng điểm bên dưới; role="status" để
          câu sr-only được đọc lên khi thẻ hiện. */}
      {pending ? (
        <p role="status" className="mt-3 flex h-16 items-center justify-center">
          <Loader2 aria-hidden className="text-primary size-10 animate-spin" />
          <span className="sr-only">{t("result.scorePending")}</span>
        </p>
      ) : (
        <p className="mt-3 flex items-baseline justify-center gap-2">
          <span className="motion-settle text-primary text-[4rem] leading-none font-bold tabular-nums">
            {result.totalScore.toFixed(1)}
          </span>
          <span className="text-muted-foreground text-lg font-medium">{t("result.outOfTen")}</span>
        </p>
      )}

      {/* Thống kê: đúng · sai · thời gian. Time cell nhận completionTimeLabel
          đã format sẵn từ caller (Task 12) — component này chỉ hiển thị, không
          tự tính toán ngày giờ (xem lib/history/format.ts). */}
      <dl className="mt-4 grid w-full grid-cols-3 gap-2">
        <Stat label={t("common.correct")} value={result.correct} dot="bg-success" />
        <Stat label={t("common.wrong")} value={wrong} dot="bg-destructive" />
        <Stat label={t("result.time")} value={completionTimeLabel} />
      </dl>
    </Card>
  );
}

/** Một ô thống kê: nhãn nhỏ (kèm chấm màu nếu có) trên, số dưới. */
function Stat({ label, value, dot }: { label: string; value: string | number; dot?: string }) {
  return (
    <div className="bg-card flex flex-col items-center gap-1 rounded-lg px-2 py-3">
      <dt className="text-muted-foreground flex items-center gap-1.5 text-xs font-semibold">
        {dot && <span aria-hidden className={`size-2 shrink-0 rounded-full ${dot}`} />}
        {label}
      </dt>
      {/* 18px ở mobile, 20px từ sm, không gãy dòng: "17m 54s" ở 20px rộng hơn ô
          ~88px của lưới ba cột tại 360px và từng gãy thành hai dòng. */}
      <dd className="text-foreground text-lg font-bold whitespace-nowrap tabular-nums sm:text-xl">
        {value}
      </dd>
    </div>
  );
}
