import Link from "next/link";
import { getTranslate } from "@/lib/i18n/server";
import type { Exam } from "@/types/exam";
import { AuthorByline } from "@/components/shared/AuthorByline";
import { DifficultyBadge } from "@/components/rating/DifficultyBadge";
import { RateButton, type RateEligibility } from "./rating/RateButton";

interface ExamCardProps {
  exam: Exam;
  /** Rating System (R4) — 1 trong 3 trạng thái nút Rate, tính 1 lần/trang từ
   *  listMySubmittedExamIds() (ExamBrowser), KHÔNG per-card query (NFR Performance). */
  eligibility: RateEligibility;
}

export async function ExamCard({ exam, eligibility }: ExamCardProps) {
  const t = await getTranslate();
  return (
    <li className="group relative h-full transition-[translate] duration-200 ease-out hover:-translate-y-0.5">
      {/* Stretched link (code:F1): Link phủ toàn thẻ (absolute inset-0),
          KHÔNG còn bọc nội dung/RateButton bên trong — tránh lồng
          interactive-trong-interactive (button trong <a> là HTML không hợp
          lệ). group đặt ở <li> (ancestor chung của Link lẫn nội dung hiển thị
          bên dưới) để :hover/:focus-visible của Link (đứng trên theo stacking,
          z-index auto) vẫn kích group-hover/group-focus-within của nội dung —
          :hover bubble lên ancestor không phụ thuộc thứ tự vẽ.

          Hiệu ứng nhấc thẻ khi hover (`-translate-y-0.5`) đặt Ở ĐÂY (trên
          chính <li>), KHÔNG đặt trên <div> nội dung bên dưới dù về mặt hình
          ảnh set trên đâu cũng giống hệt nhau. Lý do: Tailwind v4 dịch
          `translate-y-*` ra thuộc tính CSS `translate` (riêng biệt với
          `transform`, không phải utility "transform" cũ) — một giá trị
          `translate` khác "none" TỰ NÓ tạo stacking context, y hệt
          `transform`. Nếu đặt trên <div> nội dung (sibling của Link), hover
          biến <div> đó thành một stacking context ngang hàng Link (z-0);
          hai bên hoà vì cùng "mức 0" nên trình duyệt xử theo THỨ TỰ DOM — mà
          <div> nội dung đứng SAU Link trong DOM nên nó đè lên trên, nuốt mất
          click lẽ ra dành cho Link. Bug này chỉ lộ ra khi thật sự hover
          (chuột thật luôn hover trước khi click) — devtool giả lập mobile
          không có bước hover đó nên "trông vẫn bình thường", che mất bug
          trên desktop thật. Đặt translate trên <li> thay vì <div> né hẳn vụ
          này: <li> dịch chuyển cả Link lẫn <div> nội dung cùng lúc (visual y
          hệt), còn quan hệ stacking NỘI BỘ giữa Link/<div> bên trong <li>
          không đổi — <div> nội dung không bao giờ tự tạo stacking context
          nữa, Link luôn thắng như thiết kế gốc, RateButton (z-10, trong
          <div>) vẫn "bubble" qua Link bình thường vì <div> không còn chặn
          đường của nó. */}
      <Link
        href={`/exams/${exam.id}`}
        aria-label={exam.title}
        className="absolute inset-0 z-0 rounded-lg focus-visible:ring-2 focus-visible:ring-[color:var(--block-hover)] focus-visible:outline-none"
      />

      {/* hover shadow (S#26): engineer yêu cầu đích danh — exception quy tắc
          "không đổ bóng" DESIGN.md cho riêng ExamCard; tông ấm đen sơn mài
          thay đen lạnh. (Lift `-translate-y-0.5` đã chuyển lên <li>, xem
          comment ở đó — border-color/box-shadow ở lại đây vì không tạo
          stacking context, an toàn.) */}
      <div className="flex h-full flex-col gap-3 rounded-lg border border-[color:var(--block-border)] bg-[var(--block-bg)] p-5 transition-[border-color,box-shadow] duration-200 ease-out group-focus-within:border-[color:var(--block-hover)] group-hover:border-[color:var(--block-hover)] group-hover:shadow-[0_8px_24px_rgba(27,21,18,0.12)]">
        <div className="flex items-baseline justify-between gap-3">
          <span className="eyebrow text-[var(--block-fg-muted)]">{exam.subject}</span>
          <span className="eyebrow text-[var(--block-fg-muted)] tabular-nums">
            {t("exams.gradeValue", { grade: exam.grade })}
          </span>
        </div>

        <h3 className="text-xl leading-snug text-[var(--block-fg)] transition-colors group-hover:text-[var(--block-hover)]">
          {exam.title}
        </h3>

        {/* Byline UGC (Task 5.2) — chỉ hiện với đề có tác giả; đề seed bỏ qua. */}
        <AuthorByline name={exam.authorDisplayName} />

        {/* S#27: School data thật từ DB — null → "None" (S#28 Q2). Level giờ
            hiển thị DifficultyBadge (Rating System, ADR-0008) — bucket+mean
            cộng đồng, "—" khi < RATING_THRESHOLD lượt đánh giá (AC-014/015). */}
        <dl className="grid grid-cols-[auto_1fr] gap-x-3 gap-y-1 text-sm">
          <dt className="text-[var(--block-fg-muted)]">{t("common.school")}</dt>
          <dd className="text-[var(--block-fg-muted)]">{exam.school ?? t("common.none")}</dd>
          <dt className="text-[var(--block-fg-muted)]">{t("exams.level")}</dt>
          <DifficultyBadge communityDifficulty={exam.communityDifficulty} variant="card" />
        </dl>

        {/* RateButton — sibling của Link (code:F1); relative z-10 tự thân
            (RateButton.tsx) để nhận click độc lập, không bị Link stretched đè. */}
        <div className="mt-auto flex justify-end pt-1">
          <RateButton examId={exam.id} eligibility={eligibility} />
        </div>
      </div>
    </li>
  );
}
