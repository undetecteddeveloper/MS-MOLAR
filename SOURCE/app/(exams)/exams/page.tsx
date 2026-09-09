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
import { ExamBrowser } from "@/features/exams/components/ExamBrowser";
import { ExamFilters } from "@/features/exams/components/ExamFilters";
import { ExamPagination } from "@/features/exams/components/ExamPagination";
import { getCurrentUser } from "@/lib/auth/getCurrentUser";
import { t } from "@/lib/copy";
import { PageContainer } from "@/components/layout/PageContainer";
import { PageHeader } from "@/components/layout/PageHeader";
import { SEARCH_MAX_LENGTH } from "@/lib/search/normalize";

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
  const subject = sp.subject || undefined;
  const grade = sp.grade ? Number(sp.grade) : undefined;
  const school = sp.school || undefined;
  const year = sp.year ? Number(sp.year) : undefined;
  const semester = sp.semester || undefined;
  // MỘT trục ?sort= — newest/oldest/hardest loại trừ nhau. Giá trị lạ →
  // undefined (không sort ngoài ý muốn, không crash).
  const sort: ExamSort | undefined =
    sp.sort === "newest" || sp.sort === "oldest" || sp.sort === "hardest" ? sp.sort : undefined;
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
  const [ranked, facets, user] = await Promise.all([
    listExamsRanked(
      { subject, grade, school, schoolYear: year, semester, sort, level, dir, q },
      Number.isFinite(page) ? page : 1
    ),
    listExamFacets(),
    getCurrentUser(),
  ]);
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
    <PageContainer as="main" size="full" padding="none" className="flex flex-col gap-5 px-4 py-6 sm:px-6 sm:py-8">
      <PageHeader title={t("exams.title")} />

      <ExamFilters
        subjects={facets.subjects}
        grades={facets.grades}
        schools={facets.schools}
        years={facets.years}
        semesters={facets.semesters}
        selected={{ subject, grade, school, year, semester, level }}
        sort={sort}
        dir={dir}
        query={q}
      />

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
