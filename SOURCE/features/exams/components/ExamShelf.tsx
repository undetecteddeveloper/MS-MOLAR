import Link from "next/link";
import { Compass, Flame, Target, type LucideIcon } from "lucide-react";
import { t } from "@/lib/copy";
import type { MessageKey } from "@/lib/copy";
import type { Exam } from "@/types/exam";
import type { AttemptSource } from "@/lib/exams/attemptSource";
import type { HotRung } from "@/lib/adaptive/examShelves";
import type { ExamShelves } from "@/features/exams/queries/shelves";
import { Card } from "@/components/ui/card";
import { ExamCard } from "@/features/exams/components/ExamCard";
import type { RateEligibility } from "@/features/exams/components/rating/RateButton";

// ExamShelf — kệ đề cuộn ngang trên /exams (Kho đề theo kệ, UI Spec §
// Component: ExamShelf; Design Doc § Data contracts). 3 kệ — Cần luyện, Nổi
// nhất, Khám phá — cùng dùng component này; mọi khác biệt giữa chúng là MỘT
// entry trong `SHELF` bên dưới, component đọc `SHELF`, trang gọi không ghi đè
// được (Design Doc: "Everything that differs between the three shelves is an
// entry; the component reads it, the page cannot override it").
//
// `ExamShelves` (backend DD's `Contract: listExamShelves()`) giờ có thật ở
// `features/exams/queries/shelves.ts` (P3-T2) — `ShelfData` KHÔNG còn là bản
// dựng cục bộ của P2-T3 nữa (khi đó `shelves.ts` chưa tồn tại, Glob xác
// nhận). Nó suy trực tiếp từ kiểu thật, đúng cách frontend DD § Data flow
// "Facts → strings" viết: `type ShelfData = NonNullable<ExamShelves["practice"]
// | ExamShelves["hot"] | ExamShelves["explore"]>`.
//
// `ShelfKind` VẪN khai cục bộ, có chủ ý chứ không phải sót lại: backend DD
// không export nó — ba tên kệ là một khái niệm của TRANG (`SHELF_ORDER` ở
// `/exams/page.tsx`, P5-T1) và của component này, không phải một phần hợp
// đồng mà `listExamShelves()` trả về (`ExamShelves` không có field nào tên
// `kind`, chỉ có ba key `practice`/`hot`/`explore` cố định).
export type ShelfKind = "practice" | "hot" | "explore";

type ShelfData = NonNullable<ExamShelves["practice"] | ExamShelves["hot"] | ExamShelves["explore"]>;

interface ShelfSpec {
  icon: LucideIcon;
  titleKey: MessageKey;
  from: AttemptSource;
  ribbonOnFirst: boolean;
  /** Hiện số lượt đã nộp ở góc trên phải thẻ — trừ thẻ mang ruy băng (cùng góc). */
  showAttemptCount: boolean;
  trailingTile: boolean;
}

const SHELF = {
  practice: {
    icon: Target,
    titleKey: "exams.shelfPracticeTitle",
    from: "practice",
    ribbonOnFirst: false,
    showAttemptCount: false,
    trailingTile: false,
  },
  hot: {
    icon: Flame,
    titleKey: "exams.shelfHotTitle",
    from: "hot",
    ribbonOnFirst: true,
    showAttemptCount: true,
    trailingTile: false,
  },
  explore: {
    icon: Compass,
    titleKey: "exams.shelfExploreTitle",
    from: "explore",
    ribbonOnFirst: false,
    showAttemptCount: false,
    trailingTile: true,
  },
} as const satisfies Record<ShelfKind, ShelfSpec>;

// Tên khoá `copy.ts` THẬT ĐÃ LANDED (P1-T2) — không phải bản đổi tên trong ví
// dụ mã của Design Doc (`GradeRecent`/`Grade30d`/`SiteRecent`/`Site30d`), vốn
// không tồn tại trong `copy.ts` và sẽ vỡ `MessageKey`. Ánh xạ rung → chuỗi
// tiếng Việt (thứ mọi AC/UI Spec thực sự ràng buộc) không đổi.
//
// Engineer 2026-09-19: chỉ kệ Nổi nhất còn phụ đề, và bậc "site-all" ("Toàn hệ
// thống, từ trước tới nay" — bậc lấp chỗ trống, không cho người đọc biết thêm gì)
// cũng bỏ: `null` = không vẽ dòng phụ đề.
const HOT_SUBTITLE = {
  "grade-recent": "exams.shelfHotGradeWeek",
  "grade-30d": "exams.shelfHotGradeMonth",
  "grade-all": "exams.shelfHotGradeAll",
  "site-recent": "exams.shelfHotSiteWeek",
  "site-30d": "exams.shelfHotSiteMonth",
  "site-all": null,
} as const satisfies Record<HotRung, MessageKey | null>;

/**
 * Fact → chuỗi tiếng Việt cho phụ đề một kệ, hoặc `null` khi kệ không có phụ
 * đề. `ExamShelf` không tự gọi hàm này — trang (`/exams`) gọi TRƯỚC, rồi truyền
 * kết quả vào prop `subtitle` (đã nội suy sẵn), nên `ExamShelf` không bao giờ tự
 * suy lại rung (Design Doc § Data flow "Facts → strings").
 */
export function shelfSubtitle(kind: ShelfKind, data: ShelfData): string | null {
  if (kind !== "hot") return null;
  const { rung, grade } = data as { rung: HotRung; grade: number | null };
  const key = HOT_SUBTITLE[rung];
  return key === null ? null : t(key, { grade: grade ?? "" });
}

interface ExamShelfProps {
  shelf: ShelfKind;
  /** Đã nội suy sẵn bởi trang gọi — component không tự tính lại. `null` = không vẽ. */
  subtitle: string | null;
  /** Đã xếp hạng và cắt về ≤10 ở Node trước khi tới đây (AC-002, AC-006). */
  exams: Exam[];
  /** Số lượt đã nộp theo id đề — chỉ kệ Nổi nhất đọc (`spec.showAttemptCount`). */
  attemptCounts?: Record<string, number>;
  /** MỘT tập cho cả trang — eligibility tính một lần, không per-card query. */
  submittedExamIds: Set<string>;
  isLoggedIn: boolean;
}

// Bản sao cục bộ của `ExamBrowser.tsx`'s `eligibilityFor` (UI Spec § Component:
// ExamShelf — "ExamShelf duplicates the two-line predicate... no export, no
// hoist to a shared module", vì `ExamBrowser.tsx` phải giữ NGUYÊN byte).
function eligibilityFor(
  examId: string,
  submittedExamIds: Set<string>,
  isLoggedIn: boolean
): RateEligibility {
  if (!isLoggedIn) return "logged-out";
  return submittedExamIds.has(examId) ? "eligible" : "not-attempted";
}

export async function ExamShelf({
  shelf,
  subtitle,
  exams,
  attemptCounts,
  submittedExamIds,
  isLoggedIn,
}: ExamShelfProps) {
  if (exams.length === 0) return null;

  const spec = SHELF[shelf];
  const Icon = spec.icon;
  const headerId = `shelf-${shelf}`;

  return (
    <section aria-labelledby={headerId} className="flex flex-col gap-3">
      <div className="flex items-start gap-2.5">
        <Icon aria-hidden className="mt-0.5 size-[22px] shrink-0" strokeWidth={1.9} />
        <div>
          <h2 id={headerId} className="text-xl leading-tight font-semibold">
            {t(spec.titleKey)}
          </h2>
          {subtitle ? <p className="text-muted-foreground mt-0.5 text-[13px]">{subtitle}</p> : null}
        </div>
      </div>

      <ul className="-mx-4 flex snap-x snap-mandatory scroll-pl-4 [scrollbar-width:none] gap-3 overflow-x-auto px-4 pt-1 pb-1.5 motion-safe:scroll-smooth sm:-mx-6 sm:scroll-pl-6 sm:px-6 lg:gap-4 [&::-webkit-scrollbar]:hidden [&>li]:shrink-0 [&>li]:snap-start">
        {exams.map((exam, i) => {
          const hasRibbon = spec.ribbonOnFirst && i === 0;
          return (
            <ExamCard
              key={exam.id}
              exam={exam}
              eligibility={eligibilityFor(exam.id, submittedExamIds, isLoggedIn)}
              ribbon={hasRibbon ? t("exams.hotRibbon") : undefined}
              attemptCount={spec.showAttemptCount && !hasRibbon ? attemptCounts?.[exam.id] : undefined}
              from={spec.from}
              compact
              className="h-auto w-80 lg:w-84"
            />
          );
        })}
        {spec.trailingTile ? <ExamShelfTile /> : null}
      </ul>
    </section>
  );
}

// ExamShelfTile — ô "Xem toàn bộ kho đề", cục bộ module, chỉ dùng ở cuối hàng
// Khám phá (AC-032). Cùng recipe `variant="outline"` + `border-dashed` với
// trạng thái rỗng của `ExamBrowser`.
function ExamShelfTile() {
  return (
    <Card as="li" variant="outline" padding="none" className="w-[150px] border-dashed lg:w-[200px]">
      <Link
        href="/exams?page=1"
        className="rounded-card focus-visible:ring-ring/40 text-muted-foreground flex h-full w-full flex-col items-center justify-center gap-2.5 p-4 text-center text-sm font-semibold focus-visible:ring-3 focus-visible:outline-none"
      >
        {t("exams.shelfViewAllStore")}
        <Compass aria-hidden className="size-[22px]" strokeWidth={1.9} />
      </Link>
    </Card>
  );
}
