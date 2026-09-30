"use client";

// PersonalProgressStrip — dải tiến độ cá nhân trên trang chủ, chỉ hiện khi đã
// đăng nhập (F-041, 2026-09-30). Hai số đều tính lại TRONG `listHotExams()`
// từ chính `attemptRows` kệ Nổi nhất đã đọc — KHÔNG thêm lượt đọc DB nào (xem
// features/exams/queries/shelves.ts § HotExamList), nên khối này không đổi
// ngân sách đọc của trang chủ.
//
// Luôn render khi user đã đăng nhập, kể cả `totalCompleted === 0`: một học
// sinh mới vào cũng cần thấy "0 đề đã hoàn thành" để biết dải này TỒN TẠI và
// sẽ lấp đầy khi luyện — vắng mặt hẳn thì không ai biết trang chủ có theo dõi
// tiến độ.
//
// ĐẾM LÊN TỪ 0 (2026-09-30, F-041 tiếp nối) — "use client" vì số đếm chạy JS:
// IntersectionObserver (một lần) + requestAnimationFrame, cùng tinh thần
// `.motion-settle` (điểm số trang kết quả "lắng" vào đúng cỡ) nhưng đây là một
// dãy số tăng dần chứ không phải scale, nên không dùng lại được class CSS đó.
// KHÔNG có IntersectionObserver (SSR/trình duyệt cũ) → hiện thẳng giá trị
// thật, không kẹt ở 0. KHÔNG thêm `prefers-reduced-motion` — yêu cầu rõ của
// engineer cho riêng khối "trang chủ sống động" này.
import Link from "next/link";
import { useEffect, useRef, useState } from "react";
import { Card } from "@/components/ui/card";
import { t } from "@/lib/copy";
import { subjectLabel } from "@/lib/ugc/subjects";

interface PersonalProgressStripProps {
  totalCompleted: number;
  topSubject: string | null;
}

const COUNT_DURATION_MS = 800;

/** Cùng "cảm giác" với `--ease-out-strong` (app/globals.css) — cubic-bezier
 *  không viết lại được thành một hàm số đơn giản, nên dùng ease-out bậc ba
 *  xấp xỉ (khởi động nhanh, lắng chậm dần). */
function easeOutStrong(progress: number): number {
  return 1 - Math.pow(1 - progress, 3);
}

export function PersonalProgressStrip({ totalCompleted, topSubject }: PersonalProgressStripProps) {
  const countRef = useRef<HTMLParagraphElement>(null);
  const [display, setDisplay] = useState(0);

  useEffect(() => {
    const el = countRef.current;
    if (!el || typeof IntersectionObserver === "undefined") {
      setDisplay(totalCompleted);
      return;
    }

    let frame: number | undefined;
    const observer = new IntersectionObserver(
      ([entry]) => {
        if (!entry.isIntersecting) return;
        observer.disconnect();
        const start = performance.now();
        const tick = (now: number) => {
          const progress = Math.min(1, (now - start) / COUNT_DURATION_MS);
          setDisplay(Math.round(easeOutStrong(progress) * totalCompleted));
          if (progress < 1) frame = requestAnimationFrame(tick);
        };
        frame = requestAnimationFrame(tick);
      },
      { threshold: 0.4 }
    );
    observer.observe(el);
    return () => {
      observer.disconnect();
      if (frame !== undefined) cancelAnimationFrame(frame);
    };
  }, [totalCompleted]);

  return (
    <Card
      as="section"
      aria-labelledby="home-progress"
      className="flex-row flex-wrap items-center justify-between gap-4"
    >
      <div className="flex flex-col gap-1">
        <h2 id="home-progress" className="eyebrow">
          {t("home.progress.title")}
        </h2>
        <p ref={countRef} className="text-foreground text-lg font-semibold tabular-nums">
          {t("home.progress.completedCount", { count: display })}
        </p>
        {topSubject !== null && (
          <p className="text-muted-foreground text-sm">
            {t("home.progress.topSubject", { subject: subjectLabel(topSubject) })}
          </p>
        )}
      </div>
      <Link
        href="/profile"
        className="text-primary focus-visible:ring-ring inline-flex min-h-11 items-center rounded-lg text-sm font-semibold underline-offset-4 hover:underline focus-visible:ring-3 focus-visible:outline-none"
      >
        {t("home.progress.cta")}
      </Link>
    </Card>
  );
}
