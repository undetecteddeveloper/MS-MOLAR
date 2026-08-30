// EssayScoreLine — điểm tự luận trên MỘT DÒNG CÓ NHÃN RIÊNG, cạnh `ScoreCard`
// (ADR-0018 § Amendment to ADR-0010, UI Spec § Component: EssayScoreLine).
//
// ═══ VÌ SAO MỘT DÒNG RIÊNG CHỨ KHÔNG GỘP VÀO `ScoreCard` ═══
//
// `exam_results` KHÔNG còn bất biến sau khi insert: một band có thể đáp xuống
// vài phút sau khi học sinh đã nhìn trang. Gộp con số đang-đổi ấy vào ô điểm
// lớn nghĩa là con số học sinh tin tưởng nhất sẽ tự nhảy. `ScoreCard` vì thế
// là VÙNG 0-DIFF: nó giữ nguyên `result.totalScore.toFixed(1)` + `/10`, `Đúng`
// = `result.correct`, `Sai` = `result.total - result.correct`, nên phép suy
// `sai = tổng − đúng` vẫn đúng (AC-057). Bất kỳ diff nào trong file đó là hồi quy.
//
// ═══ `null` KHI KHÔNG CÓ KHOÁ VÒNG ĐỜI NÀO ═══
//
// `essaySummary === undefined` (dòng cũ / RS-0 / RS-1 / cờ tắt) ⇒ trả `null`,
// và KHÔNG node nào vào cây. Đó chính là thứ giữ AC-012 đúng TỪNG BYTE cho một
// dòng ghi trước khi tính năng ship: nó không mọc thêm một wrapper rỗng.
//
// ═══ `—`, KHÔNG BAO GIỜ `0 / 0 điểm` ═══
//
// `0 / 0` đọc ra là "bạn được 0 điểm" trên đúng bài viết học sinh vừa làm —
// TÁI TẠO CHÍNH KHUYẾT TẬT MÀ CẢ TÍNH NĂNG NÀY TỒN TẠI ĐỂ CHẤM DỨT (một lượt
// thi toàn tự luận hiện `total_score = 0.00`). `—` nói "chưa có gì để cộng",
// không nói "cộng vào thành không".
//
// ═══ `tabular-nums` LÀ CHỨC NĂNG, KHÔNG PHẢI THẨM MỸ ═══
//
// Mẫu số LỚN LÊN TRONG LÚC HỌC SINH ĐANG NHÌN (W7): mỗi band đáp xuống làm
// `gradedCount` tăng, và poller `router.refresh()`. Chữ số không đều bề ngang
// sẽ làm cả dòng giật mỗi lần cập nhật.
//
// Hình khối mượn khối cảnh báo quá giờ đã có sẵn trên chính trang này — tiền lệ
// tại chỗ cho "một câu chú thích cho con số bên trên". Chỉ token, không shadow,
// không gradient. Component KHÔNG tự mang margin: nhịp dọc thuộc về `gap-5`
// của trang.

import Link from "next/link";
import { EssayLifecycleBadge } from "@/components/essay/EssayLifecycleBadge";
import { getTranslate } from "@/lib/i18n/server";
import type { EssaySummary } from "@/lib/scoring/essayLifecycle";

/** Band hiển thị hai chữ số thập phân, cắt số 0 thừa: `0.75`, `1`, `0.5`. */
function formatPoints(value: number): string {
  return value.toFixed(2).replace(/\.?0+$/, "");
}

export async function EssayScoreLine({
  summary,
  detailHref,
}: {
  summary: EssaySummary | undefined;
  detailHref: string;
}) {
  const t = await getTranslate();

  // KHÔNG khoá vòng đời nào ⇒ KHÔNG node nào. Xem đầu file.
  if (!summary) return null;

  const { earned, max, gradedCount, pendingCount, failedCount } = summary;
  const hasScore = gradedCount > 0;

  const score = hasScore
    ? t("result.essay.points", { earned: formatPoints(earned), max: String(max) })
    : "—";

  // Thứ tự nhánh có ý nghĩa: `pending` THẮNG mọi thứ khác, vì khi còn câu đang
  // chấm thì cả `earned` lẫn mẫu số đều CHƯA ngã ngũ — nói "x câu thất bại"
  // lúc ấy là kết luận sớm trên một lượt chạy chưa xong.
  const note = (() => {
    if (pendingCount > 0) return t("result.essay.stillGrading", { k: String(pendingCount) });
    if (!hasScore) return t("result.essay.noneGraded");
    if (failedCount > 0) return t("result.essay.someFailed", { k: String(failedCount) });
    return t("result.essay.denominator", { n: String(gradedCount) });
  })();

  return (
    <div className="border-border bg-card rounded-lg border border-dashed px-4 py-3 text-sm">
      <div className="flex items-center gap-3">
        <span className="eyebrow">{t("result.essay.label")}</span>
        {pendingCount > 0 && <EssayLifecycleBadge state="pending" />}
      </div>

      <p className="font-serif text-2xl tabular-nums">{score}</p>

      <p className="text-muted-foreground">
        {note}
        {/* "Chi tiết" là lối đi DUY NHẤT tới nút chấm lại, nên hai trạng thái
            mời học sinh sang đó phải có một liên kết thật, không phải một câu
            bảo họ tự tìm. */}
        {(failedCount > 0 || !hasScore) && pendingCount === 0 && (
          <>
            {" "}
            <Link href={detailHref} className="underline underline-offset-2">
              {t("result.attemptDetails")}
            </Link>
          </>
        )}
      </p>
    </div>
  );
}
