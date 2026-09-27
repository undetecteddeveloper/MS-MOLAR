// Kho đề — /exams. Server Component.
//
// Bố cục theme "Sân trường": tiêu đề "Kho đề", thanh công cụ lọc (chip) ngay
// dưới, rồi lưới thẻ 1 → 2 → 3 cột. Bộ lọc qua URL searchParams → re-query, để
// mọi trạng thái lọc đều là một URL chia sẻ được.

import {
  listExamsRanked,
  listExamFacets,
  type ExamSort,
  type ExamLevel,
  type SortDirection,
} from "@/features/exams/queries";
import { listExamShelves } from "@/features/exams/queries/shelves";
import { ExamBrowser } from "@/features/exams/components/ExamBrowser";
import { ExamFilters } from "@/features/exams/components/ExamFilters";
import { ExamPagination } from "@/features/exams/components/ExamPagination";
import { ExamShelf, shelfSubtitle } from "@/features/exams/components/ExamShelf";
import { getCurrentUser } from "@/lib/auth/getCurrentUser";
import { hasBrowseParam } from "@/lib/exams/browseParams";
import { t } from "@/lib/copy";
import { PageContainer } from "@/components/layout/PageContainer";
import { PageHeader } from "@/components/layout/PageHeader";
import { SEARCH_MAX_LENGTH } from "@/lib/search/normalize";

// DOM order (AC-003) — the array order IS the render order; a `null` shelf
// drops out via the `data && (...)` narrowing below, never leaving a gap
// (AC-051).
const SHELF_ORDER = ["practice", "hot", "explore"] as const;

type SearchParams = Promise<{
  subject?: string;
  grade?: string;
  school?: string;
  year?: string;
  semester?: string;
  sort?: string;
  level?: string;
  dir?: string;
  page?: string;
  /** Từ khoá tìm theo tên (ADR-0020) — chuỗi thô, Kho đề tự chuẩn hoá. */
  q?: string;
}>;

export default async function ExamsPage({ searchParams }: { searchParams: SearchParams }) {
  const sp = await searchParams;
  // Branch predicate (AC-001/AC-008/AC-010) — reads RAW key presence on `sp`,
  // BEFORE any normalisation below: a normalised local is `undefined` for both
  // "absent" and "present but garbage" (`?sort=garbage`, `?page=abc`), so only
  // the raw key can tell the two apart (Boundary Context, work plan Connection
  // Map).
  const showShelves = !hasBrowseParam(sp);
  // `ExamFilters` renders on BOTH branches (chip row visible on the shelves
  // view too, AC-033), so this normalisation block stays unconditional — only
  // the `ranked`-only derivations below (destructure + `gridKey`) move into
  // the grid branch.
  const subject = sp.subject || undefined;
  const grade = sp.grade ? Number(sp.grade) : undefined;
  const school = sp.school || undefined;
  const year = sp.year ? Number(sp.year) : undefined;
  const semester = sp.semester || undefined;
  // MỘT trục ?sort= — newest/oldest/hardest/hot loại trừ nhau. Giá trị lạ →
  // undefined (không sort ngoài ý muốn, không crash).
  const sort: ExamSort | undefined =
    sp.sort === "newest" || sp.sort === "oldest" || sp.sort === "hardest" || sp.sort === "hot"
      ? sp.sort
      : undefined;
  const level: ExamLevel | undefined =
    sp.level === "easy" || sp.level === "medium" || sp.level === "hard" ? sp.level : undefined;
  const dir: SortDirection | undefined = sp.dir === "asc" || sp.dir === "desc" ? sp.dir : undefined;
  // Phân trang (TD-026): giá trị lạ/âm → trang 1; `listExamsRanked` kẹp lần
  // nữa vào [1, pageCount] nên `?page=999` ra trang cuối, không phải lưới trắng.
  const page = Number.parseInt(sp.page ?? "", 10);
  // Cắt về trần TRƯỚC khi đưa đi bất cứ đâu — chip hiển thị, bộ lọc, link phân
  // trang đều nhận cùng một chuỗi; chuẩn hoá thật nằm trong fetchExamRows.
  const q = sp.q?.trim() ? sp.q.trim().slice(0, SEARCH_MAX_LENGTH) : undefined;

  // ADR-0015: `listExamsRanked` tự sở hữu lượt đọc `exam_attempts` và trả luôn
  // tập id đã nộp, nên băng xếp hạng "đã làm" và nút Chấm điểm dùng CHUNG một
  // giá trị, không thể lệch nhau.
  //
  // 4 array slots, not 3 — `shelves`/`ranked` are two independent nullable
  // members rather than one slot typed as their union, so `strict: true` can
  // narrow `shelves !== null` below without a type assertion (frontend DD §
  // Data flow "Four array slots"). Exactly 3 READS still fire per branch: the
  // unused slot of the pair always resolves to `null`, contributing 0 network
  // calls; `listExamFacets()`/`getCurrentUser()` are unconditional, so they run
  // on BOTH branches (the chip row renders on the shelves view too, AC-033).
  const [shelves, ranked, facets, user] = await Promise.all([
    showShelves ? listExamShelves() : null,
    showShelves
      ? null
      : listExamsRanked(
          { subject, grade, school, schoolYear: year, semester, sort, level, dir, q },
          Number.isFinite(page) ? page : 1
        ),
    listExamFacets(),
    getCurrentUser(),
  ]);

  const filterBar = (
    <>
      <PageHeader title={t("exams.title")} />
      <ExamFilters
        subjects={facets.subjects}
        grades={facets.grades}
        schools={facets.schools}
        years={facets.years}
        semesters={facets.semesters}
        selected={{ subject, grade, school, year, semester, level }}
        sort={sort}
        query={q}
      />
    </>
  );

  if (shelves !== null) {
    return (
      <PageContainer
        as="main"
        size="full"
        padding="none"
        className="flex flex-col gap-5 px-4 py-6 sm:px-6 sm:py-8"
      >
        {filterBar}
        {/* Kệ trực tiếp là con của PageContainer (không bọc thêm div) — khoảng
            cách giữa các kệ ăn theo `gap-5` sẵn có của trang (UI Spec: "inter-shelf
            spacing is the page's existing gap-5"), không phải một khoảng riêng. */}
        {SHELF_ORDER.map((kind) => {
          const data = shelves[kind];
          return (
            data && (
              <ExamShelf
                key={kind}
                shelf={kind}
                subtitle={shelfSubtitle(kind, data)}
                exams={data.exams}
                attemptCounts={"attemptCounts" in data ? data.attemptCounts : undefined}
                submittedExamIds={shelves.submittedExamIds}
                isLoggedIn={user !== null}
              />
            )
          );
        })}
      </PageContainer>
    );
  }
  if (ranked === null) throw new Error("unreachable: grid branch without a ranked read");

  // Hai dòng dưới CHỈ nhánh lưới cần — chuyển vào đây từ chỗ vô điều kiện cũ.
  const { exams, submittedExamIds, page: currentPage, pageCount, total } = ranked;

  // key cho lưới đề theo (bộ lọc, sắp xếp, từ khoá, trang): sau mỗi lần đổi, lưới
  // là một CÂY MỚI chứ không phải các thẻ cũ trượt sang ô mới. Đo 2026-09-08 khi
  // Enter từ ô tìm: thẻ còn lại dịch chỗ sau round-trip (> 500ms) nên trình
  // duyệt TÍNH vào CLS — 0,49 ở 360px, 0,29 ở 768, 0,19 ở 1024, 0,13 ở 1280.
  // Cùng bệnh và cùng cách sửa với danh sách Lịch sử (history/page.tsx).
  const gridKey = [subject, grade, school, year, semester, sort, level, dir, q, currentPage]
    .map((v) => v ?? "")
    .join("|");

  return (
    <PageContainer
      as="main"
      size="full"
      padding="none"
      className="flex flex-col gap-5 px-4 py-6 sm:px-6 sm:py-8"
    >
      {filterBar}

      <div>
        <ExamBrowser
          key={gridKey}
          exams={exams}
          submittedExamIds={submittedExamIds}
          isLoggedIn={user !== null}
          query={q}
        />
        {/* `sp` TRỪ `page`: mỗi link phân trang mang theo đúng bộ lọc đang bật. */}
        <ExamPagination
          page={currentPage}
          pageCount={pageCount}
          total={total}
          params={{
            subject: sp.subject,
            grade: sp.grade,
            school: sp.school,
            year: sp.year,
            semester: sp.semester,
            sort: sp.sort,
            level: sp.level,
            dir: sp.dir,
            q,
          }}
        />
      </div>
    </PageContainer>
  );
}
