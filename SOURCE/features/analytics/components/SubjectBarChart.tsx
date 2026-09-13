// SubjectBarChart — "Kết quả theo môn" (theme "Sân trường", 2026-09-06; đổi
// tên 2026-09-13).
//
// Mỗi môn một HÀNG. Hai cách đọc, chọn theo MÔN (lib/analytics/constants
// `isEssaySubject`):
//
//  · Môn chấm tự động (Toán, Lý, Hoá, Sinh, Sử): tên môn (kèm nhãn "Cần ôn
//    lại" khi đúng dưới 75%), hai con số "N đúng · M sai" bên phải, và một
//    thanh ngang gồm hai đoạn xanh/đỏ. Dài thanh = tổng số câu đã làm so với
//    môn làm nhiều nhất; phần xanh so với phần đỏ = độ chính xác. Hai con số in
//    ngay cạnh thanh nên không cần tooltip, không cần trục, không cần chú giải
//    riêng: chữ "đúng"/"sai" đứng cạnh từng con số là chú giải rồi, và màu chỉ
//    là kênh phụ (§4.3).
//
//  · Ngữ văn, Tiếng Anh (engineer 2026-09-13): câu tự luận chỉ "đúng" khi trọn
//    điểm, nên đếm đúng/sai không diễn tả được hai môn này — trước đó một lượt
//    Ngữ văn nộp trống hiện "0 đúng · 0 sai" vì câu tự luận bị loại khỏi cả hai
//    ô đếm. Nay hàng hiện ĐIỂM TRUNG BÌNH trên 10 của các lượt đã chấm xong, một
//    thanh xanh trên rãnh trắng (không phải hai đoạn — không có "sai" để tô
//    đỏ), và một dòng chú thích: số câu tự luận bỏ trống (tính 0 điểm — chính
//    là thứ kéo trung bình xuống) và số câu trắc nghiệm đúng nếu đề có. Lượt
//    còn đang chấm không kéo trung bình về 0: chưa có lượt nào chấm xong thì
//    in "—" kèm huy hiệu "Đang chấm". Không in số lượt (engineer chốt
//    2026-09-13: thừa — số lượt đã có ở thẻ Thời gian luyện).
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
import {
  NEEDS_REVIEW_THRESHOLD,
  isEssaySubject,
  type SubjectStats,
} from "@/lib/analytics/constants";
import { SUBJECT_LABELS } from "@/lib/ugc/subjects";

export function SubjectBarChart({ data }: { data: SubjectStats[] }) {
  // Thang chiều dài thanh chỉ tính trên môn đếm câu — hàng điểm luôn dùng trọn
  // bề ngang (thang 10 là tuyệt đối, không so với môn khác).
  const maxTotal = Math.max(
    1,
    ...data.filter((d) => !isEssaySubject(d.subject)).map((d) => d.correct + d.wrong)
  );

  return (
    <ul className="flex flex-col gap-4">
      {data.map((stat, index) =>
        isEssaySubject(stat.subject) ? (
          <ScoreRow key={stat.subject} stat={stat} index={index} />
        ) : (
          <CountRow key={stat.subject} stat={stat} index={index} maxTotal={maxTotal} />
        )
      )}
    </ul>
  );
}

/** Hàng ĐÚNG/SAI — môn chấm tự động. */
function CountRow({ stat, index, maxTotal }: { stat: SubjectStats; index: number; maxTotal: number }) {
  const total = stat.correct + stat.wrong;
  // total = 0 chỉ xảy ra với đề không có câu chấm tự động: không có gì để gắn
  // cờ, và không vẽ thanh.
  const accuracy = total > 0 ? stat.correct / total : 1;
  const needsReview = accuracy < NEEDS_REVIEW_THRESHOLD;
  const correctWord = t("common.correct").toLowerCase();
  const wrongWord = t("common.wrong").toLowerCase();

  return (
    <li className="flex flex-col gap-1.5">
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
}

/** Hàng ĐIỂM TRUNG BÌNH — Ngữ văn, Tiếng Anh. */
function ScoreRow({ stat, index }: { stat: SubjectStats; index: number }) {
  const avg = stat.avgScore;
  // Cùng ngưỡng 75% với môn đếm câu: 7,5/10 là mốc "Cần ôn lại" — một mốc cho
  // cả hai cách đọc, không phải hai bảng ngưỡng.
  const needsReview = avg !== null && avg / 10 < NEEDS_REVIEW_THRESHOLD;
  const mcqTotal = stat.correct + stat.wrong;
  const notes = [
    avg === null ? t("analytics.gradingNote") : t("analytics.avgNote"),
    stat.blankEssays > 0 ? t("analytics.blankEssays", { count: stat.blankEssays }) : null,
    mcqTotal > 0 ? t("analytics.mcqCorrect", { correct: stat.correct, total: mcqTotal }) : null,
  ].filter((s): s is string => s !== null);

  return (
    <li className="flex flex-col gap-1.5">
      <div className="flex flex-wrap items-center justify-between gap-x-3 gap-y-1">
        <span className="flex min-w-0 flex-wrap items-center gap-2">
          <span className="text-foreground font-semibold">{SUBJECT_LABELS[stat.subject]}</span>
          {/* Huy hiệu nói vì sao hàng này đọc khác hàng trên. */}
          <Badge variant="plain">{t("analytics.essayBadge")}</Badge>
          {avg === null && <Badge variant="plain">{t("analytics.gradingBadge")}</Badge>}
          {needsReview && <Badge variant="wrong">{t("analytics.needsReview")}</Badge>}
        </span>
        <span className="text-sm tabular-nums">
          <span className="text-foreground text-base font-bold">
            {avg === null ? "—" : avg.toFixed(1)}
          </span>{" "}
          <span className="text-muted-foreground">{t("analytics.outOfTen")}</span>
        </span>
      </div>

      {/* Rãnh trắng trọn bề ngang = thang 10; phần xanh = điểm trung bình.
          Không có đoạn đỏ: với tự luận không có "số câu sai" để tô. */}
      <div aria-hidden className="bg-card h-3 w-full overflow-hidden rounded-full">
        <span
          className="motion-grow-x bg-success block h-full rounded-full"
          style={
            {
              width: `${avg === null ? 0 : Math.min(100, Math.max(0, avg * 10))}%`,
              "--motion-i": index,
            } as React.CSSProperties
          }
        />
      </div>

      <p className="text-muted-foreground text-xs leading-relaxed">{notes.join(" · ")}</p>
    </li>
  );
}
