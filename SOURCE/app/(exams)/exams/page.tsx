// Exam Browser — /exams (Layer 2). Server Component.
// GĐ 3 M3.1 (LÀM LẠI #2): bố cục bám sát TEMPLATE/L2/L2_mobile.png.
//  - SiteHeader (navbar kiểu homepage, từ (exams)/layout.tsx) sticky trên cùng.
//    KHÔNG có tiêu đề trang (template không có — engineer yêu cầu bỏ).
//  - *Filter nằm BÊN TRÁI, ngay cạnh exam list; khi mở thì ĐÈ LÊN list (overlay).
//    Cả block *Filter là position: sticky → đi theo user khi cuộn.
//  - Exam list chiếm phần còn lại (flex-1) — S#19: container nới max-w-6xl
//    (khớp bề ngang navbar) để lưới hiển thị tới 3 card/hàng.
// Visual language "tờ giấy trắng / focused". Bộ lọc qua URL searchParams → re-query.

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
import { getTranslate } from "@/lib/i18n/server";
import { PageContainer } from "@/components/layout/PageContainer";

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
}>;

export default async function ExamsPage({ searchParams }: { searchParams: SearchParams }) {
  const sp = await searchParams;
  const subject = sp.subject || undefined;
  const grade = sp.grade ? Number(sp.grade) : undefined;
  const school = sp.school || undefined;
  const year = sp.year ? Number(sp.year) : undefined;
  const semester = sp.semester || undefined;
  // D002 (Rating System frontend DD): MỘT trục ?sort= — newest/oldest/hardest
  // loại trừ nhau, forward thẳng vào listExams (thay ?hardest=1 độc lập cũ,
  // vốn là no-op). Giá trị lạ → undefined (Field Propagation Map: "unknown
  // value → no sort", không crash, không lọc/sort ngoài ý muốn).
  const sort: ExamSort | undefined =
    sp.sort === "newest" || sp.sort === "oldest" || sp.sort === "hardest" ? sp.sort : undefined;
  // Level — lowercase slug (IP-6), giá trị lạ → undefined ("no Level filter applied").
  const level: ExamLevel | undefined =
    sp.level === "easy" || sp.level === "medium" || sp.level === "hard" ? sp.level : undefined;
  // Direction toggle (ExamFilters) — đảo chiều trục `sort` đang chọn; giá trị
  // lạ → undefined (dùng chiều mặc định của trục, giữ hành vi cũ).
  const dir: SortDirection | undefined = sp.dir === "asc" || sp.dir === "desc" ? sp.dir : undefined;
  // Phân trang (TD-026). Giá trị lạ/âm/không phải số → trang 1, cùng quy ước
  // "unknown value → mặc định" với các tham số trên; `listExamsRanked` còn kẹp
  // lần nữa vào [1, pageCount] nên `?page=999` cho ra trang cuối, không phải
  // một lưới trắng.
  const page = Number.parseInt(sp.page ?? "", 10);

  const t = await getTranslate();
  // ADR-0015 Decision 1b: `listExamsRanked` thay CẢ `listExams` lẫn
  // `listMySubmittedExamIds` ở trang này. Nó tự sở hữu lượt đọc `exam_attempts`
  // và trả về luôn tập id đã nộp, nên băng xếp hạng "đã làm" và huy hiệu "đã
  // làm" trên thẻ đề dùng CHUNG một giá trị, không thể lệch nhau — và không có
  // lượt đọc `exam_attempts` nào bị lặp lại mỗi lần bấm bộ lọc.
  // `listMySubmittedExamIds()` KHÔNG bị sửa: nó còn một chỗ dùng khác
  // (exams/[id]/rate/page.tsx).
  const [ranked, facets, user] = await Promise.all([
    listExamsRanked(
      { subject, grade, school, schoolYear: year, semester, sort, level, dir },
      Number.isFinite(page) ? page : 1
    ),
    listExamFacets(),
    getCurrentUser(),
  ]);
  const { exams, submittedExamIds, page: currentPage, pageCount, total } = ranked;

  return (
    // Theme root "Mực & Sơn mài" (S#17) — scope .theme-ebp đã xóa, block/nav
    // lấy từ biến mặc định ở :root (globals.css).
    <div className="bg-background">
      {/* padding="none": trang này tự quản lý khoảng đệm bên trong — cột
          *Filter phải dính mép trái để sticky/overlay đúng chỗ, còn lưới card
          có padding riêng. Đây chính là lối thoát tường minh mà PageContainer
          chừa sẵn, thay vì phải bỏ container để lách. */}
      <PageContainer as="main" size="full" padding="none">
        {/* Trang này CỐ Ý không có tiêu đề nhìn thấy được — bố cục là bộ lọc +
            lưới thẻ, thêm chữ "Exams" to sẽ thừa. Nhưng đây là trang duy nhất
            của site không có <h1> nào, nên người dùng trình đọc màn hình mất mốc
            định vị và mất luôn khả năng nhảy theo tiêu đề (WCAG 1.3.1 / 2.4.6).
            sr-only giữ nguyên thiết kế mà vẫn trả lại mốc đó. */}
        <h1 className="sr-only">{t("exams.title")}</h1>
        {/* MỘT block căn giữa: *Filter (trái, sticky, overlay) + lưới ExamCard
            tối đa 3 cột (phải, flex-1). mx-auto của <main> giữ block căn giữa. */}
        {/* `max-md:flex-col`: dưới 768px bộ lọc là một hàng NGANG phía trên lưới
            thẻ, không phải một rail dọc bên cạnh — ở 360px không còn bề ngang
            nào để chia cho hai cột.
            `max-md:items-stretch` (2026-08-09, lỗi thật phát hiện qua ảnh chụp
            prod của engineer): `items-start` chỉ đúng Ý khi trục chính là NGANG
            (desktop `flex-row` — không kéo cột *Filter/lưới đề cao bằng nhau).
            `max-md:flex-col` đổi trục chính sang DỌC, và cùng lúc đó
            `align-items` chuyển sang điều khiển chiều NGANG — `flex-start` khiến
            khối bọc <ExamBrowser> (dưới) co theo bề rộng NỘI DUNG thay vì giãn
            hết màn hình, hở khoảng trắng bên phải với đề tiêu đề/tên trường
            ngắn (che khuất với đề dài vì nội dung tự nhiên đã đủ rộng). Khối
            *Filter đã tự vá đúng lỗi này cho chính nó (`max-md:w-full
            max-md:self-stretch`, ExamFilters.tsx) — vá ở đây thay vì lặp lại
            per-child để không sót đứa con nào trong tương lai. */}
        <div className="relative flex items-start max-md:flex-col max-md:items-stretch">
          <ExamFilters
            subjects={facets.subjects}
            grades={facets.grades}
            schools={facets.schools}
            years={facets.years}
            semesters={facets.semesters}
            selected={{ subject, grade, school, year, semester, level }}
            sort={sort}
            dir={dir}
          />

          {/* preload order 2 — lưới card fade sau navbar (0) + filter (1) (S#21). */}
          <div
            className="preload-fade min-w-0 flex-1 px-4 py-5"
            style={{ "--preload-order": 2 } as React.CSSProperties}
          >
            <ExamBrowser
              exams={exams}
              submittedExamIds={submittedExamIds}
              isLoggedIn={user !== null}
            />
            {/* `sp` TRỪ `page`: mỗi link phân trang phải mang theo đúng bộ lọc
                đang bật, nếu không bấm sang trang 2 sẽ âm thầm reset bộ lọc. */}
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
              }}
            />
          </div>
        </div>
      </PageContainer>
    </div>
  );
}
