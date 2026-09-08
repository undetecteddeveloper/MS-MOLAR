// (history)/history — page-level auth guard, mirrors (authoring)/upload/page.tsx.
// Guard runs strictly BEFORE any data fetch (AC-016: zero attempt rows fetched
// for a guest — backend Design Doc history-backend-design.md v1.2, § Auth
// Guard and Layout).
//
// Bố cục theo theme "Sân trường" (2026-09-07, design plan §3 "Lịch sử"):
// PageHeader ("Lịch sử" hiện rõ + một câu nói trang này có gì — bản trước giấu
// tiêu đề sr-only và mở trang bằng một tay nắm "BỘ LỌC" viết đứng) → hàng chip
// (Bộ lọc, chip môn) → danh sách thẻ theo trang → ExamPagination. Bề rộng
// `default` (48rem): một cột hàng, không phải lưới thẻ như Kho đề.
//
// Luồng dữ liệu KHÔNG đổi: MỘT lượt `listMyHistory()`, lọc trong bộ nhớ qua
// `filterHistoryEntries()` theo URL (cùng quy ước ExamFilters), rồi cắt trang
// bằng `paginateHistory()` — cũng trong bộ nhớ, không round-trip thêm.
//
// Bộ lọc "Đề thi" (`?examId=`) bỏ 2026-09-08 theo yêu cầu engineer: nó lặp lại
// đúng danh sách đang hiện. `filterHistoryEntries` vẫn hiểu `examId` (hàm thuần,
// có test) nhưng trang này không đọc tham số đó nữa.

import { redirect } from "next/navigation";
import { getCurrentUserProfile } from "@/lib/auth/getCurrentUser";
import { t } from "@/lib/copy";
import { listMyHistory } from "@/features/history/queries";
import { filterHistoryEntries, type HistoryEntryFilters } from "@/lib/history/filterEntries";
import { paginateHistory } from "@/lib/history/paginate";
import { subjectLabel } from "@/lib/ugc/subjects";
import { HistoryFilters } from "@/features/history/components/HistoryFilters";
import { HistoryList } from "@/features/history/components/HistoryList";
import { ExamPagination } from "@/features/exams/components/ExamPagination";
import { PageContainer } from "@/components/layout/PageContainer";
import { PageHeader } from "@/components/layout/PageHeader";

type SearchParams = Promise<{
  subject?: string;
  scoreMin?: string;
  scoreMax?: string;
  dateFrom?: string;
  dateTo?: string;
  page?: string;
}>;

const ISO_DATE = /^\d{4}-\d{2}-\d{2}$/;

// Unknown/out-of-range value -> undefined ("no filter applied"), matching
// ExamsPage's own field-propagation convention for `sort`/`level`.
function parseScore(raw: string | undefined): number | undefined {
  if (!raw) return undefined;
  const n = Number(raw);
  return Number.isFinite(n) && n >= 0 && n <= 10 ? n : undefined;
}

function parseDate(raw: string | undefined): string | undefined {
  return raw && ISO_DATE.test(raw) ? raw : undefined;
}

export default async function HistoryPage({ searchParams }: { searchParams: SearchParams }) {
  const user = await getCurrentUserProfile();
  if (!user) redirect("/?auth=signin");

  const sp = await searchParams;
  const entries = await listMyHistory();

  // Chip môn xếp theo NHÃN tiếng Việt ("Hóa học, Toán, Vật lý"), không theo khoá
  // DB ("Chemistry, Math, Physics") — thứ tự trên màn hình phải là thứ tự của
  // chữ người dùng đọc.
  const subjects = [...new Set(entries.map((e) => e.subject))].sort((a, b) =>
    subjectLabel(a).localeCompare(subjectLabel(b), "vi")
  );

  const selected: HistoryEntryFilters = {
    subject: sp.subject && subjects.includes(sp.subject) ? sp.subject : undefined,
    scoreMin: parseScore(sp.scoreMin),
    scoreMax: parseScore(sp.scoreMax),
    dateFrom: parseDate(sp.dateFrom),
    dateTo: parseDate(sp.dateTo),
  };

  const filteredEntries = filterHistoryEntries(entries, selected);
  // Giá trị lạ/âm → trang 1; `paginateHistory` kẹp lần nữa vào [1, pageCount]
  // nên `?page=999` ra trang cuối, không phải một danh sách trắng.
  const requestedPage = Number.parseInt(sp.page ?? "", 10);
  const {
    entries: pageEntries,
    page,
    pageCount,
    total,
  } = paginateHistory(filteredEntries, Number.isFinite(requestedPage) ? requestedPage : 1);

  // `key` cho danh sách theo (bộ lọc, trang): sau mỗi lần lọc, danh sách là
  // một CÂY MỚI chứ không phải các hàng cũ trượt lên vị trí mới. Đo 2026-09-07:
  // không có key, bấm chip môn làm 18 hàng Toán còn lại dịch lên chỗ hàng Hoá/Lý
  // vừa bị bỏ, và vì server trả về sau cửa sổ 500ms "ngay-sau-thao-tác" (round-trip
  // ở dev ~1s) nên trình duyệt TÍNH vào CLS: 0,57 ở 360px, 0,43 ở 768, 0,33 ở
  // 1280 — trong khi sang trang (mọi hàng đều mới) đo 0. Với key, cả hai đường
  // đi cùng cho 0; điều người dùng thấy không đổi (họ vừa xin một danh sách khác).
  const listKey = [
    selected.subject,
    selected.scoreMin,
    selected.scoreMax,
    selected.dateFrom,
    selected.dateTo,
    page,
  ]
    .map((v) => v ?? "")
    .join("|");

  return (
    <PageContainer
      as="main"
      size="default"
      padding="none"
      className="flex flex-col gap-5 px-4 py-6 sm:px-6 sm:py-8"
    >
      <PageHeader title={t("history.title")} description={t("history.subtitle")} />

      {/* Chưa có lượt nào thì không có gì để lọc: một chip "Bộ lọc" mở ra bảng
          trống chỉ là một lời hứa rỗng đứng trên trạng thái rỗng. */}
      {entries.length > 0 && <HistoryFilters subjects={subjects} selected={selected} />}

      <div>
        <HistoryList
          key={listKey}
          entries={pageEntries}
          isFiltered={entries.length > 0 && filteredEntries.length !== entries.length}
          examineeName={user.displayName}
        />
        {/* `sp` TRỪ `page`: mỗi link phân trang mang theo đúng bộ lọc đang bật. */}
        <ExamPagination
          page={page}
          pageCount={pageCount}
          total={total}
          basePath="/history"
          ariaLabel={t("history.pagination")}
          totalLabel={t("history.totalCount", { total })}
          params={{
            subject: sp.subject,
            scoreMin: sp.scoreMin,
            scoreMax: sp.scoreMax,
            dateFrom: sp.dateFrom,
            dateTo: sp.dateTo,
          }}
        />
      </div>
    </PageContainer>
  );
}
