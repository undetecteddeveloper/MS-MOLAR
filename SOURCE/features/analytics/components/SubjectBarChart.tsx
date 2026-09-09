// SubjectBarChart — "Đúng và sai theo môn" (theme "Sân trường", 2026-09-06).
//
// Mỗi môn một HÀNG: tên môn (kèm nhãn "Cần ôn lại" khi đúng dưới 75%), hai con
// số "N đúng · M sai" bên phải, và một thanh ngang gồm hai đoạn xanh/đỏ. Dài
// thanh = tổng số câu đã làm so với môn làm nhiều nhất; phần xanh so với phần
// đỏ = độ chính xác. Hai con số in ngay cạnh thanh nên không cần tooltip, không
// cần trục, không cần chú giải riêng: chữ "đúng"/"sai" đứng cạnh từng con số là
// chú giải rồi, và màu chỉ là kênh phụ (§4.3).
//
// Vì sao bỏ biểu đồ cột dọc SVG của bản trước: viewBox 920 đơn vị ép vào 320px
// thì nhãn co còn ~4px, nên bản trước cho khối biểu đồ cuộn ngang với bề rộng
// tối thiểu 560px — và với MỘT môn (ca đông nhất: tài khoản mới chỉ luyện Toán)
// cột duy nhất nằm giữa viewBox, tức NGOÀI khung nhìn 320px: thẻ trông trống,
// phải cuộn ngang mới thấy cột. Đo 2026-09-06 trên dev ở 360px trước khi dựng
// lại. Thanh ngang co giãn theo bề ngang thẻ ở mọi cỡ, không cuộn ngang (§4.5),
// và số hàng đi theo số môn (1–7) chứ không theo bề ngang màn hình.
//
// Màu: xanh `--success`, đỏ `--destructive` (token) thay hai hex của theme cũ.

import { Badge } from "@/components/ui/badge";
import { t } from "@/lib/copy";
import { NEEDS_REVIEW_THRESHOLD, type SubjectStats } from "@/lib/analytics/constants";
import { SUBJECT_LABELS } from "@/lib/ugc/subjects";

export function SubjectBarChart({ data }: { data: SubjectStats[] }) {
  const maxTotal = Math.max(1, ...data.map((d) => d.correct + d.wrong));
  const correctWord = t("common.correct").toLowerCase();
  const wrongWord = t("common.wrong").toLowerCase();

  return (
    <ul className="flex flex-col gap-4">
      {data.map((stat, index) => {
        const total = stat.correct + stat.wrong;
        // total = 0 chỉ xảy ra với đề không có câu chấm tự động (thuần tự luận):
        // không có gì để gắn cờ, và không vẽ thanh.
        const accuracy = total > 0 ? stat.correct / total : 1;
        const needsReview = accuracy < NEEDS_REVIEW_THRESHOLD;

        return (
          <li key={stat.subject} className="flex flex-col gap-1.5">
            <div className="flex flex-wrap items-center justify-between gap-x-3 gap-y-1">
              <span className="flex min-w-0 flex-wrap items-center gap-2">
                <span className="text-foreground font-semibold">{SUBJECT_LABELS[stat.subject]}</span>
                {needsReview && <Badge variant="wrong">{t("analytics.needsReview")}</Badge>}
              </span>
              <span className="flex items-center gap-3 text-sm tabular-nums">
                <span>
                  <span className="text-success font-semibold">{stat.correct}</span>{" "}
                  <span className="text-muted-foreground">{correctWord}</span>
                </span>
                <span>
                  <span className="text-destructive font-semibold">{stat.wrong}</span>{" "}
                  <span className="text-muted-foreground">{wrongWord}</span>
                </span>
              </span>
            </div>

            {/* Thanh là hình minh hoạ cho hai con số bên trên — ẩn khỏi cây trợ
                năng. Hai đoạn là hai viên thuốc riêng cách nhau 2px (nền thẻ lộ
                ra làm khe) thay vì một thanh cắt đôi; đoạn nào bằng 0 thì không
                vẽ, đoạn còn lại chiếm trọn. min-w giữ đoạn rất nhỏ (1 câu đúng
                trên 46) vẫn thấy được. */}
            <div
              aria-hidden
              className="motion-grow-x flex h-3 gap-0.5"
              style={
                {
                  width: `${(total / maxTotal) * 100}%`,
                  "--motion-i": index,
                } as React.CSSProperties
              }
            >
              {stat.correct > 0 && (
                <span
                  className="bg-success h-full min-w-1.5 rounded-full"
                  style={{ width: `${(stat.correct / total) * 100}%` }}
                />
              )}
              {stat.wrong > 0 && (
                <span className="bg-destructive h-full min-w-1.5 flex-1 rounded-full" />
              )}
            </div>
          </li>
        );
      })}
    </ul>
  );
}
