// Exam Browser — /exams (Layer 2). Server Component.
// GĐ 3 M3.1 (LÀM LẠI #2): bố cục bám sát TEMPLATE/L2/L2_mobile.png.
//  - SiteHeader (navbar kiểu homepage, từ (layer2)/layout.tsx) sticky trên cùng.
//    KHÔNG có tiêu đề trang (template không có — engineer yêu cầu bỏ).
//  - *Filter nằm BÊN TRÁI, ngay cạnh exam list; khi mở thì ĐÈ LÊN list (overlay).
//    Cả block *Filter là position: sticky → đi theo user khi cuộn.
//  - Exam list chiếm phần còn lại (flex-1) — S#19: container nới max-w-6xl
//    (khớp bề ngang navbar) để lưới hiển thị tới 3 card/hàng.
// Visual language "tờ giấy trắng / focused". Bộ lọc qua URL searchParams → re-query.

import {
  listExams,
  listExamFacets,
  listMySubmittedExamIds,
  type ExamSort,
  type ExamLevel,
  type SortDirection,
} from "@/app/(layer2)/queries";
import { ExamBrowser } from "@/app/(layer2)/_components/ExamBrowser";
import { ExamFilters } from "@/app/(layer2)/_components/ExamFilters";
import { getCurrentUser } from "@/lib/auth/getCurrentUser";

type SearchParams = Promise<{
  subject?: string;
  grade?: string;
  school?: string;
  year?: string;
  semester?: string;
  sort?: string;
  level?: string;
  dir?: string;
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

  const [exams, facets, submittedExamIds, user] = await Promise.all([
    listExams({ subject, grade, school, schoolYear: year, semester, sort, level, dir }),
    listExamFacets(),
    listMySubmittedExamIds(),
    getCurrentUser(),
  ]);

  return (
    // Theme root "Mực & Sơn mài" (S#17) — scope .theme-ebp đã xóa, block/nav
    // lấy từ biến mặc định ở :root (globals.css).
    <div className="bg-background">
      <main className="mx-auto w-full max-w-6xl">
        {/* Trang này CỐ Ý không có tiêu đề nhìn thấy được — bố cục là bộ lọc +
            lưới thẻ, thêm chữ "Exams" to sẽ thừa. Nhưng đây là trang duy nhất
            của site không có <h1> nào, nên người dùng trình đọc màn hình mất mốc
            định vị và mất luôn khả năng nhảy theo tiêu đề (WCAG 1.3.1 / 2.4.6).
            sr-only giữ nguyên thiết kế mà vẫn trả lại mốc đó. */}
        <h1 className="sr-only">Exams</h1>
        {/* MỘT block căn giữa: *Filter (trái, sticky, overlay) + lưới ExamCard
            tối đa 3 cột (phải, flex-1). mx-auto của <main> giữ block căn giữa. */}
        <div className="relative flex items-start">
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
          </div>
        </div>
      </main>
    </div>
  );
}
