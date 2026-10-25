// Kho đề — /exams. Server Component.
//
// Bố cục theme "Sân trường": tiêu đề "Kho đề", thanh công cụ lọc (chip) ngay
// dưới, rồi lưới thẻ 1 → 2 → 3 cột. Bộ lọc qua URL searchParams → re-query, để
// mọi trạng thái lọc đều là một URL chia sẻ được.

import {
  getSkillLabel,
  listExamsRanked,
  listExamFacets,
  type ExamSort,
  type ExamLevel,
  type SortDirection,
} from "@/features/exams/queries";
import type { ExamViewer } from "@/features/exams/queries/attempts";
import { listExamShelves } from "@/features/exams/queries/shelves";
import { ExamBrowser } from "@/features/exams/components/ExamBrowser";
import { ExamFilters } from "@/features/exams/components/ExamFilters";
import { ExamPagination } from "@/features/exams/components/ExamPagination";
import { ExamShelf, shelfSubtitle } from "@/features/exams/components/ExamShelf";
import { getCurrentUser } from "@/lib/auth/getCurrentUser";
import { hasBrowseParam, parseSkillParam } from "@/lib/exams/browseParams";
import { t } from "@/lib/copy";
import { PageContainer } from "@/components/layout/PageContainer";
import { PageHeader } from "@/components/layout/PageHeader";
import { SEARCH_MAX_LENGTH } from "@/lib/search/normalize";

// Thứ tự DOM (AC-003) — thứ tự trong mảng CHÍNH LÀ thứ tự render; một kệ `null`
// tự rơi ra nhờ phép thu hẹp `data && (...)` bên dưới, không bao giờ để lại khoảng trống
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
  /** Dạng bài (`skill_nodes.id`) — nút "Tìm đề" của thẻ gợi ý ở Thống kê. */
  skill?: string;
}>;

export default async function ExamsPage({ searchParams }: { searchParams: SearchParams }) {
  const sp = await searchParams;
  // Điều kiện rẽ nhánh (AC-001/AC-008/AC-010) — đọc sự có mặt của khoá THÔ trên `sp`,
  // TRƯỚC mọi bước chuẩn hoá bên dưới: biến cục bộ đã chuẩn hoá là `undefined` cho cả
  // "vắng mặt" lẫn "có mặt nhưng rác" (`?sort=garbage`, `?page=abc`), nên chỉ
  // khoá thô mới phân biệt được hai ca (Boundary Context, work plan Connection
  // Map).
  const showShelves = !hasBrowseParam(sp);
  // `ExamFilters` render ở CẢ HAI nhánh (hàng chip cũng hiện ở chế độ kệ,
  // AC-033), nên khối chuẩn hoá này giữ vô điều kiện — chỉ các phép suy ra
  // dành riêng cho `ranked` bên dưới (destructure + `gridKey`) mới chuyển vào
  // nhánh lưới.
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
  // `getCurrentUser()` đứng TRƯỚC mọi lượt đọc từ 2026-10-12 vì khách chưa đăng
  // nhập nay vào được trang này: hai lượt đọc cá nhân (lượt làm, điểm) phải biết
  // ai đang xem, và bộ lọc dạng bài dưới đây chỉ dành cho người đã đăng nhập.
  // Không tốn thêm: hàm đã cache theo request và layout đã gọi nó trước khi trang
  // render.
  const user = await getCurrentUser();
  const viewer: ExamViewer = user ? "member" : "guest";

  // Dị dạng → coi như không lọc dạng bài (khoá thô vẫn đưa trang xuống lưới phẳng).
  // Khách: bỏ qua hẳn — `?skill=` chỉ sinh ra từ thẻ gợi ý ở Thống kê (cần đăng
  // nhập), và dạng bài + nhãn nằm trên `skill_nodes`/`questions` mà khách không
  // đọc được; một URL tự gõ không được biến thành lỗi 500.
  const skill = user ? parseSkillParam(sp.skill) : undefined;

  // ADR-0015: `listExamsRanked` tự sở hữu lượt đọc `exam_attempts` và trả luôn
  // tập id đã nộp, nên băng xếp hạng "đã làm" và nút Chấm điểm dùng CHUNG một
  // giá trị, không thể lệch nhau.
  //
  // 4 ô trong mảng, không phải 3 — `shelves`/`ranked` là hai thành viên nullable
  // độc lập thay vì một ô mang kiểu hợp của chúng, để `strict: true` thu hẹp được
  // `shelves !== null` bên dưới mà không cần ép kiểu (frontend DD §
  // Data flow "Four array slots"). Vẫn đúng 3 lượt ĐỌC chạy ở mỗi nhánh: ô
  // không dùng của cặp luôn trả về `null`, đóng góp 0 lượt gọi mạng;
  // `listExamFacets()`/`getCurrentUser()` chạy vô điều kiện, nên chạy ở
  // CẢ HAI nhánh (hàng chip cũng hiện ở chế độ kệ, AC-033).
  const [shelves, ranked, facets, skillLabel] = await Promise.all([
    showShelves ? listExamShelves(viewer) : null,
    showShelves
      ? null
      : listExamsRanked(
          { subject, grade, school, schoolYear: year, semester, sort, level, dir, q, skill },
          Number.isFinite(page) ? page : 1,
          viewer
        ),
    listExamFacets(),
    // Nhãn cho chip "Dạng bài: …"; chỉ đọc khi có `?skill=` (0 lượt gọi thêm còn lại).
    skill ? getSkillLabel(skill) : null,
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
        skill={skill}
        skillLabel={skillLabel ?? undefined}
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
  const gridKey = [subject, grade, school, year, semester, sort, level, dir, q, skill, currentPage]
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
            skill,
          }}
        />
      </div>
    </PageContainer>
  );
}
