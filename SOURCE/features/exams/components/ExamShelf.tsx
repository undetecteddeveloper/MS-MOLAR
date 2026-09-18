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
import { subjectLabel } from "@/lib/ugc/subjects";

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
  viewAllHref: ((exams: Exam[]) => string) | null;
  ribbonOnFirst: boolean;
  trailingTile: boolean;
}

const SHELF = {
  practice: {
    icon: Target,
    titleKey: "exams.shelfPracticeTitle",
    from: "practice",
    viewAllHref: (exams: Exam[]) => `/exams?subject=${encodeURIComponent(exams[0].subject)}`,
    ribbonOnFirst: false,
    trailingTile: false,
  },
  hot: {
    icon: Flame,
    titleKey: "exams.shelfHotTitle",
    from: "hot",
    viewAllHref: () => "/exams?sort=hot",
    ribbonOnFirst: true,
    trailingTile: false,
  },
  explore: {
    icon: Compass,
    titleKey: "exams.shelfExploreTitle",
    from: "explore",
    viewAllHref: null,
    ribbonOnFirst: false,
    trailingTile: true,
  },
} as const satisfies Record<ShelfKind, ShelfSpec>;

// Tên khoá `copy.ts` THẬT ĐÃ LANDED (P1-T2) — không phải bản đổi tên trong ví
// dụ mã của Design Doc (`GradeRecent`/`Grade30d`/`SiteRecent`/`Site30d`), vốn
// không tồn tại trong `copy.ts` và sẽ vỡ `MessageKey`. Ánh xạ rung → chuỗi
// tiếng Việt (thứ mọi AC/UI Spec thực sự ràng buộc) không đổi.
const HOT_SUBTITLE = {
  "grade-recent": "exams.shelfHotGradeWeek",
  "grade-30d": "exams.shelfHotGradeMonth",
  "grade-all": "exams.shelfHotGradeAll",
  "site-recent": "exams.shelfHotSiteWeek",
  "site-30d": "exams.shelfHotSiteMonth",
  "site-all": "exams.shelfHotSiteAll",
} as const satisfies Record<HotRung, MessageKey>;

/**
 * Fact → chuỗi tiếng Việt cho phụ đề một kệ. `ExamShelf` không tự gọi hàm
 * này — trang (`/exams`) gọi TRƯỚC, rồi truyền kết quả vào prop `subtitle`
 * (đã nội suy sẵn), nên `ExamShelf` không bao giờ tự suy lại rung hay môn
 * yếu nhất (Design Doc § Data flow "Facts → strings").
 */
export function shelfSubtitle(kind: ShelfKind, data: ShelfData): string {
  if (kind === "practice") {
    return t("exams.shelfPracticeSubtitle", {
      subject: subjectLabel((data as { subject: string }).subject),
    });
  }
  if (kind === "explore") {
    return t("exams.shelfExploreSubtitle");
  }
  const { rung, grade } = data as { rung: HotRung; grade: number | null };
  return t(HOT_SUBTITLE[rung], { grade: grade ?? "" });
}

interface ExamShelfProps {
  shelf: ShelfKind;
  /** Đã nội suy sẵn bởi trang gọi — component không tự tính lại. */
  subtitle: string;
  /** Đã xếp hạng và cắt về ≤10 ở Node trước khi tới đây (AC-002, AC-006). */
  exams: Exam[];
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
  submittedExamIds,
  isLoggedIn,
}: ExamShelfProps) {
  if (exams.length === 0) return null;

  const spec = SHELF[shelf];
  const Icon = spec.icon;
  const headerId = `shelf-${shelf}`;
  const viewAllHref = spec.viewAllHref ? spec.viewAllHref(exams) : null;

  return (
    <section aria-labelledby={headerId} className="flex flex-col gap-3">
      <div className="flex items-start justify-between gap-4">
        <div className="flex items-start gap-2.5">
          <Icon aria-hidden className="mt-0.5 size-[22px] shrink-0" strokeWidth={1.9} />
          <div>
            <h2 id={headerId} className="text-xl leading-tight font-semibold">
              {t(spec.titleKey)}
            </h2>
            <p className="text-muted-foreground mt-0.5 text-[13px]">{subtitle}</p>
          </div>
        </div>
        {viewAllHref ? (
          <Link
            href={viewAllHref}
            className="text-primary focus-visible:ring-ring inline-flex min-h-11 items-center rounded-lg text-sm font-semibold whitespace-nowrap underline-offset-4 hover:underline focus-visible:ring-3 focus-visible:outline-none"
          >
            {t("exams.shelfViewAll")}
          </Link>
        ) : null}
      </div>

      <ul className="-mx-4 flex snap-x snap-mandatory scroll-pl-4 [scrollbar-width:none] gap-3 overflow-x-auto px-4 pt-1 pb-1.5 motion-safe:scroll-smooth sm:-mx-6 sm:scroll-pl-6 sm:px-6 lg:gap-4 [&::-webkit-scrollbar]:hidden [&>li]:shrink-0 [&>li]:snap-start">
        {exams.map((exam, i) => (
          <ExamCard
            key={exam.id}
            exam={exam}
            eligibility={eligibilityFor(exam.id, submittedExamIds, isLoggedIn)}
            ribbon={spec.ribbonOnFirst && i === 0 ? t("exams.hotRibbon") : undefined}
            from={spec.from}
            className="w-80 lg:w-84"
          />
        ))}
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
