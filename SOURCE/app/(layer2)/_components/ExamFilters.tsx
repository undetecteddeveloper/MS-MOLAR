"use client";
import { useT } from "@/lib/i18n/client";
import type { MessageKey } from "@/lib/i18n/translate";

// ExamFilters — bộ lọc Exam Browser (Layer 2). GĐ 3 M3.1 (LÀM LẠI #2).
// Bám sát TEMPLATE/L2/L2_mobile.png + #Yêu cầu engineer:
//  - *Filter nằm BÊN TRÁI exam list (cạnh nó), KHÔNG có tiêu đề trang phía trên.
//  - Đóng: chỉ hiện "tay nắm" mảnh (tam giác đen ▶ + nhãn dọc "BỘ LỌC") cạnh list.
//  - Mở: bảng lọc ĐÈ LÊN exam list (overlay, không đẩy block sang bên) + rgba highlight.
//  - Cả block *Filter là position: STICKY (top-14) → đi theo user khi cuộn trang,
//    không trôi mất như phần tử thường.
//  - Mỗi filter có toggle riêng; mở "bảng chọn" là overlay (absolute) từ `md`
//    trở lên nên KHÔNG làm xê dịch bố cục các filter khác — panel desktop là
//    `overflow-visible`/`max-h-none` nên overlay không có nguy cơ bị cắt.
//    DƯỚI `md` bảng chọn đổi sang IN-FLOW (đẩy các filter dưới nó xuống, xem
//    FilterRow) — panel mobile là bottom sheet `max-h-[70dvh] overflow-y-auto`
//    (một scroll container), và một overlay `absolute` lồng bên trong scroll
//    container qua một ancestor `position:relative` trung gian là đúng tổ hợp
//    nổi tiếng hay bị trình duyệt tính overflow/scroll không nhất quán (an
//    toàn trên Chromium lúc đo đạc không có nghĩa an toàn trên mọi trình
//    duyệt di động thật) — engineer bắt được hậu quả 2026-08-09: dropdown của
//    filter Year (gần cuối danh sách, gần BottomNav `z-40` > panel `z-30`)
//    hiện sát mép panel, phần cuối bị BottomNav đè lên. In-flow loại bỏ hẳn
//    lớp rủi ro này (nội dung trong luồng bình thường luôn được scroll
//    container tính đúng), đổi lại mobile giờ CÓ xê dịch bố cục khi mở — chấp
//    nhận được vì bottom sheet vốn đã là danh sách cuộn dọc, "mở ra đẩy xuống"
//    là hành vi quen thuộc của accordion trong sheet (iOS Settings...).
// State lọc ở URL searchParams (UI-LAYER-MAP Mục 9) → Server Component re-query.
// S#27: Subject/Grade/School/Year/Semester lọc thật từ DB. Rating System
// (D002, frontend DD): Level giờ lọc thật (avg_overall bucket, DB-side);
// Hardest gộp vào MỘT trục ?sort= (newest|oldest|hardest, loại trừ nhau) —
// KHÔNG còn ?hardest=1 độc lập (thay đổi hành vi có chủ đích, đã xác nhận
// tại design [Stop], thay thế thiết kế Hardest-độc-lập cũ ở S#28).

import { useRouter, usePathname, useSearchParams } from "next/navigation";
import { useEffect, useRef, useState, useTransition } from "react";

/** Rating System — khớp ExamSort (queries.ts) + ExamLevel lowercase slug (IP-6). */
type ExamSort = "newest" | "oldest" | "hardest";
type ExamLevel = "easy" | "medium" | "hard";
/** Direction toggle — đảo chiều trục `sort` đang chọn (queries.ts SortDirection). */
type SortDirection = "asc" | "desc";

interface ExamFiltersProps {
  subjects: string[];
  grades: number[];
  schools: string[];
  years: number[];
  semesters: string[];
  selected: {
    subject?: string;
    grade?: number;
    school?: string;
    year?: number;
    semester?: string;
    level?: ExamLevel;
  };
  sort?: ExamSort;
  dir?: SortDirection;
}

/** Chiều mặc định của mỗi trục khi không có `dir` — khớp queries.ts. */
const DEFAULT_ASCENDING: Record<ExamSort, boolean> = {
  newest: false,
  oldest: true,
  hardest: false,
};

// Lọc nhanh — 3 ô checkbox NGOÀI dropdown, xếp dọc, tất cả CÙNG trục ?sort=
// (D002): chọn 1 tự loại trừ 2 cái còn lại (toggle lại chính nó → bỏ sort).
const QUICK: { value: ExamSort; labelKey: MessageKey }[] = [
  { value: "newest", labelKey: "exams.sortNewest" },
  { value: "oldest", labelKey: "exams.sortOldest" },
  { value: "hardest", labelKey: "exams.sortHardest" },
];

const LEVEL_OPTIONS: { value: ExamLevel | ""; labelKey: MessageKey }[] = [
  { value: "", labelKey: "common.all" },
  { value: "easy", labelKey: "exams.levelEasy" },
  { value: "medium", labelKey: "exams.levelMedium" },
  { value: "hard", labelKey: "exams.levelHard" },
];

// rgba khai báo tường minh trong source (theo #Yêu cầu) để làm nổi bật *Filter.
// Tông ngà #EDE1C8 theo theme Mực & Sơn mài (S#17) thay trắng thuần.
const PANEL_BG = "rgba(237, 225, 200, 0.98)"; // sheet ngà nổi trên nền trang
const OPTIONS_BG = "rgba(237, 225, 200, 0.99)"; // bảng chọn của từng filter
const SCRIM_BG = "rgba(27, 21, 18, 0.08)"; // dim exam list khi *Filter mở

export function ExamFilters({
  subjects,
  grades,
  schools,
  years,
  semesters,
  selected,
  sort,
  dir,
}: ExamFiltersProps) {
  const t = useT();
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const [isPending, startTransition] = useTransition();
  const [open, setOpen] = useState(false); // master *Filter open/close

  function setParam(key: string, value: string) {
    const params = new URLSearchParams(searchParams.toString());
    if (value) params.set(key, value);
    else params.delete(key);
    startTransition(() => {
      router.push(params.toString() ? `${pathname}?${params}` : pathname, {
        scroll: false,
      });
    });
  }

  // Đổi trục sort (checkbox) → luôn bỏ `dir` cũ, trục mới bắt đầu ở chiều mặc
  // định của chính nó thay vì kế thừa chiều của trục trước.
  function setSort(value: ExamSort) {
    const params = new URLSearchParams(searchParams.toString());
    if (sort === value) params.delete("sort");
    else params.set("sort", value);
    params.delete("dir");
    startTransition(() => {
      router.push(params.toString() ? `${pathname}?${params}` : pathname, {
        scroll: false,
      });
    });
  }

  // Chiều hiệu lực của trục đang chọn — undefined khi chưa chọn trục nào
  // (direction toggle vô nghĩa, bị disable).
  const ascending = sort ? (dir ? dir === "asc" : DEFAULT_ASCENDING[sort]) : undefined;

  function toggleDirection() {
    if (!sort || ascending === undefined) return;
    setParam("dir", ascending ? "desc" : "asc");
  }

  function clearAll() {
    startTransition(() => router.push(pathname, { scroll: false }));
  }

  const hasFilters =
    selected.subject !== undefined ||
    selected.grade !== undefined ||
    selected.school !== undefined ||
    selected.year !== undefined ||
    selected.semester !== undefined ||
    selected.level !== undefined;

  // Lọc nhanh (Newest/Oldest/Hardest) — render dùng CHUNG cho 2 chỗ: bên
  // trong sheet mobile (variant "sheet") và rail desktop/tablet (variant
  // "rail", giữ nguyên style cũ). Tách hàm để không lặp JSX ở hai nơi.
  //
  // ⚠ 2026-08-09 LÀM LẠI #3: bản trước dùng `grid grid-cols-3` cho "sheet" —
  // engineer chụp ảnh báo lại vẫn vỡ (chữ nhảy dòng, gap giữa nhãn/checkbox
  // trong mỗi cột quá lớn vì `justify-between` kéo hai đầu ra hết bề rộng CỘT
  // thay vì bề rộng CHỮ). Chia 3 cột ngang là nguồn gốc bug cả 3 lần sửa gần
  // đây (xem lịch sử comment cũ), nên bỏ hẳn hướng đó: sheet giờ xếp DỌC, mỗi
  // mục CHIẾM TRỌN bề rộng sheet — giống hệt cấu trúc rail desktop đã chứng
  // minh ổn định (rail cũng xếp dọc, chưa từng bị báo lỗi). Đối xứng vì mọi
  // hàng cao/rộng bằng nhau; không thể nhảy dòng vì không còn cột hẹp nào ép
  // chữ vào một khoảng trống cố định.
  function quickSortLabels(variant: "sheet" | "rail") {
    return QUICK.map((q) => {
      const checked = sort === q.value;
      return (
        <label
          key={q.value}
          className={
            variant === "sheet"
              ? "text-foreground flex min-h-11 w-full cursor-pointer items-center justify-between gap-3 text-sm"
              : "text-foreground flex min-w-0 cursor-pointer items-center justify-between gap-1.5 text-sm whitespace-nowrap"
          }
        >
          <span className={variant === "rail" ? "min-w-0 truncate" : undefined}>
            {t(q.labelKey)}
          </span>
          <input
            type="checkbox"
            className="accent-brand size-4 shrink-0 transition-transform duration-150 active:scale-90"
            checked={checked}
            onChange={() => setSort(q.value)}
          />
        </label>
      );
    });
  }

  function directionToggleButton(variant: "sheet" | "rail") {
    return (
      <button
        type="button"
        onClick={toggleDirection}
        disabled={!sort}
        aria-label={t("exams.toggleSortDirection")}
        className={
          variant === "sheet"
            ? "text-muted-foreground hover:text-brand border-border mt-1 flex min-h-11 w-full items-center justify-end gap-1.5 border-t pt-2 text-xs whitespace-nowrap transition-colors disabled:pointer-events-none disabled:opacity-40"
            : "text-muted-foreground hover:text-brand border-border mt-1 flex items-center justify-end gap-1.5 border-t pt-2 text-xs whitespace-nowrap transition-colors disabled:pointer-events-none disabled:opacity-40"
        }
      >
        <span aria-hidden>{ascending ? "↑" : "↓"}</span>
        {ascending ? t("exams.ascending") : t("exams.descending")}
      </button>
    );
  }

  return (
    <>
      {/* Scrim rgba — dim exam list để *Filter nổi bật. Click để đóng. */}
      {open && (
        <button
          aria-hidden
          tabIndex={-1}
          onClick={() => setOpen(false)}
          className="animate-in fade-in fixed inset-0 z-10 cursor-default duration-200"
          style={{ backgroundColor: SCRIM_BG }}
        />
      )}

      {/* Cả block *Filter STICKY dưới navbar (h-15). shrink-0: tay nắm mảnh cạnh list.
          preload order 1 — fade sau navbar (S#21). pt-5 (S#22): edge trên của
          tay nắm ngang hàng với ExamCard (cột card có py-5).

          Dưới 768px cả cụm này đổi hình: `max-md:static` bỏ sticky (một rail
          dọc dính mép trái không có nghĩa gì khi bề ngang chỉ 360px) và tay nắm
          trở thành một hàng NGANG đầy chiều rộng phía trên lưới thẻ. Trước thay
          đổi này, cụm 3 ô lọc nhanh `absolute right-0` render ở left:-46px —
          NGOÀI mép trái màn hình — và nhãn cụt còn "ất"; tức đường chính để tìm
          một đề coi như không dùng được trên điện thoại. */}
      {/* ⚠ `preload-fade` KHÔNG được đặt trên khối bọc này.
          Animation đó kết thúc ở `transform: none` với `fill-mode: both`, và
          trình duyệt giữ lại giá trị đó dưới dạng ma trận đơn vị — một phần tử
          có `transform` (kể cả ma trận đơn vị) trở thành CONTAINING BLOCK cho
          mọi con `position: fixed`. Đặt animation ở đây thì bottom sheet bên
          dưới sẽ neo vào chính khối này thay vì vào viewport: đo được
          `top: 64px` trong khi phần tử thật nằm ở y=125, và sheet không bao giờ
          chạm đáy màn hình. Vì vậy fade chuyển xuống đúng phần tử NHÌN THẤY
          (tay nắm) — nơi nó không nằm trên đường đi của sheet. */}
      <div
        className="sticky top-15 z-20 shrink-0 self-start pt-5 max-md:static max-md:w-full max-md:self-stretch max-md:px-4"
        data-pending={isPending ? "" : undefined}
      >
        <div className="relative max-md:static">
          {/* Tay nắm (master toggle). Desktop: tam giác + nhãn DỌC, cột mảnh.
              Mobile: hàng ngang, nhãn nằm ngang, min-h-11 cho vùng chạm (§4.3). */}
          <button
            type="button"
            aria-label={t("common.filters")}
            aria-expanded={open}
            onClick={() => setOpen((v) => !v)}
            style={{ "--preload-order": 1 } as React.CSSProperties}
            // ⚠ KHÔNG thêm `active:scale-*`/`transition-transform` ở nút này:
            // nó mang class `preload-fade` — animation đó kết thúc bằng
            // `transform: none` với `fill-mode: both`, và CSS Animation giữ
            // quyền kiểm soát thuộc tính `transform` với độ ưu tiên CAO HƠN
            // rule thường (kể cả `:active`) trong suốt vòng đời "both" (vô
            // thời hạn) — một scale khai báo bình thường ở đây sẽ bị animation
            // đè, lặng lẽ không có tác dụng. Phản hồi khi bấm dùng màu nền
            // (hover:bg-accent, không đụng transform) thay vì scale.
            className="preload-fade border-border hover:bg-accent flex flex-col items-center gap-2 rounded-md border-r py-4 pr-2.5 pl-3 transition-colors duration-200 max-md:min-h-11 max-md:w-full max-md:flex-row max-md:justify-center max-md:gap-3 max-md:border max-md:py-2.5 max-md:pr-3 max-md:pl-3"
          >
            <span className="relative">
              <Triangle open={open} />
              {hasFilters && (
                <span
                  aria-hidden
                  className="bg-brand absolute -top-1 -right-1.5 size-1.5 rounded-full"
                />
              )}
            </span>
            {/* writingMode dọc CHỈ từ md trở lên — trên mobile nhãn phải nằm
                ngang, chữ dọc trong một hàng ngang là không đọc được. */}
            <span className="eyebrow max-md:[writing-mode:horizontal-tb] md:[writing-mode:vertical-rl]">
              {t("common.filters")}
            </span>
          </button>

          {/* Bảng lọc OVERLAY — absolute KỀ MÉP PHẢI tay nắm (left-full, S#22 —
              không đè lên filter button nữa), đè lên exam list (không đẩy bố cục). */}
          {open && (
            <div
              // Desktop: overlay absolute kề mép phải tay nắm (S#22).
              // Mobile: BOTTOM SHEET — neo đáy màn hình (Vùng Xanh, §4.2), cao
              // tối đa 70dvh và tự cuộn bên trong. `dvh` chứ không `vh`: thanh
              // địa chỉ Safari/Chrome ẩn-hiện khi cuộn làm `vh` sai lệch và cắt
              // mất phần dưới sheet (§3.2).
              // bottom = chiều cao BottomNav + safe-area: sheet phải nằm TRÊN
              // thanh điều hướng, không đè lên nó (§6.2 "Navigational
              // Clearance").
              // Mobile là mặc định (không tiền tố), desktop nằm sau `md:` —
              // KHÔNG viết `absolute top-0 left-full` làm nền rồi ghi đè bằng
              // `max-md:*`: hai khai báo cùng thuộc tính `top` sẽ tranh nhau
              // theo thứ tự xuất hiện trong stylesheet chứ không theo ý người
              // viết, và bản trước đúng như vậy — `top-0` thắng `max-md:top-auto`
              // nên sheet dính đỉnh thay vì đáy. Tách hẳn hai nhánh thì không
              // còn gì để tranh.
              className="border-border animate-in fade-in slide-in-from-top-2 bottom-[calc(var(--bottom-nav-h)+env(safe-area-inset-bottom,0px))] fixed inset-x-0 z-30 max-h-[70dvh] w-full overflow-y-auto rounded-t-lg border border-x-0 border-b-0 duration-200 ease-out md:absolute md:inset-x-auto md:top-0 md:bottom-auto md:left-full md:z-20 md:max-h-none md:w-[84vw] md:max-w-xs md:overflow-visible md:rounded-none md:border"
              style={{ backgroundColor: PANEL_BG }}
            >
              {/* Header bảng: toggle (nhãn, S#26 bỏ tam giác trong dropdown)
                  bên trái · nút Clear bên phải ngang hàng tiêu đề (S#22 —
                  thay nút "Clear filters" cũ ở cuối panel). */}
              <div className="border-border bg-background/60 flex w-full items-center justify-between gap-3 border-b px-4 py-3">
                <button
                  type="button"
                  aria-expanded
                  onClick={() => setOpen(false)}
                  className="flex items-center gap-3"
                >
                  <span className="eyebrow">Filters{hasFilters ? " · active" : ""}</span>
                </button>
                <button
                  type="button"
                  onClick={clearAll}
                  disabled={!hasFilters}
                  className="text-muted-foreground hover:text-brand text-xs underline-offset-4 transition-colors hover:underline disabled:pointer-events-none disabled:opacity-40"
                >
                  {t("common.clear")}
                </button>
              </div>

              {/* Lọc nhanh GỘP vào panel trên mobile (yêu cầu engineer
                  2026-08-09): trước đây render thành hàng riêng đầy chiều
                  rộng ngay dưới nút *Filter (tách khỏi phần còn lại của bộ
                  lọc) — nhìn tách rời, đọc như vỡ bố cục. Chuyển vào đây để
                  nó là MỘT phần của cùng bảng lọc thay vì mảnh trôi nổi bên
                  ngoài. Xếp DỌC (không phải grid-cols-3, xem comment ở
                  quickSortLabels) — mỗi mục một hàng đầy đủ, đối xứng và
                  không thể nhảy dòng. `md:hidden`: từ tablet trở lên
                  quick-sort vẫn hiện thường trực trong rail cạnh danh sách
                  đề (đủ chỗ), không cần lặp lại trong panel. */}
              <div className="border-border flex flex-col gap-1 border-b px-4 py-3 md:hidden">
                {quickSortLabels("sheet")}
                {directionToggleButton("sheet")}
              </div>

              <FilterRow
                label={t("common.subject")}
                selectedLabel={selected.subject}
                currentValue={selected.subject ?? ""}
                options={[
                  { value: "", label: t("common.all") },
                  ...subjects.map((s) => ({ value: s, label: s })),
                ]}
                onSelect={(v) => setParam("subject", v)}
              />
              <FilterRow
                label={t("common.grade")}
                selectedLabel={
                  selected.grade !== undefined
                    ? t("exams.gradeValue", { grade: selected.grade })
                    : undefined
                }
                currentValue={selected.grade !== undefined ? String(selected.grade) : ""}
                options={[
                  { value: "", label: t("common.all") },
                  ...grades.map((g) => ({
                    value: String(g),
                    label: t("exams.gradeValue", { grade: g }),
                  })),
                ]}
                onSelect={(v) => setParam("grade", v)}
              />
              <FilterRow
                label={t("common.school")}
                selectedLabel={selected.school}
                currentValue={selected.school ?? ""}
                options={[
                  { value: "", label: t("common.all") },
                  ...schools.map((s) => ({ value: s, label: s })),
                ]}
                onSelect={(v) => setParam("school", v)}
              />
              <FilterRow
                label={t("common.year")}
                selectedLabel={selected.year !== undefined ? String(selected.year) : undefined}
                currentValue={selected.year !== undefined ? String(selected.year) : ""}
                options={[
                  { value: "", label: t("common.all") },
                  ...years.map((y) => ({ value: String(y), label: String(y) })),
                ]}
                onSelect={(v) => setParam("year", v)}
              />
              <FilterRow
                label={t("common.semester")}
                selectedLabel={selected.semester}
                currentValue={selected.semester ?? ""}
                options={[
                  { value: "", label: t("common.all") },
                  ...semesters.map((s) => ({ value: s, label: s })),
                ]}
                onSelect={(v) => setParam("semester", v)}
              />
              {/* Level — bucket độ khó cộng đồng (Rating System, D002 sibling
                  change: real FilterRow thay panel "Coming soon"). */}
              <FilterRow
                label={t("exams.level")}
                selectedLabel={
                  selected.level !== undefined
                    ? t(
                        LEVEL_OPTIONS.find((o) => o.value === selected.level)?.labelKey ??
                          "common.all"
                      )
                    : undefined
                }
                currentValue={selected.level ?? ""}
                options={LEVEL_OPTIONS.map((o) => ({ value: o.value, label: t(o.labelKey) }))}
                onSelect={(v) => setParam("level", v)}
                last
              />
            </div>
          )}

          {/* Lọc nhanh — 3 ô CHECKBOX, CÙNG trục ?sort= (D002): chọn 1 tự bỏ
              chọn 2 cái còn lại (dùng chung param, loại trừ nhau). Mép phải
              mỗi ô canh đúng viền phải tay nắm: đặt absolute right-0 trong
              .relative (right-0 = mép phải handle = đường kẻ). w-max nới text
              sang TRÁI, checkbox luôn ghim mép phải nên cả 3 ô thẳng hàng.
              CHỈ hiển thị từ `md` trở lên (`hidden md:flex`) — dưới `md`
              phiên bản "sheet" bên trong panel FILTERS đảm nhiệm thay
              (2026-08-09, xem comment ở khối panel phía trên), nên khối này
              không còn cần tự lo bố cục mobile nữa. */}
          {/* ⚠ `absolute right-0` đặt cụm này NGOÀI rail, trong phần lề trái
              của container — nó chỉ nằm trong màn hình khi container còn ≥46px
              lề, tức từ khoảng 1244px trở lên. Đo được: ở 360px, 768px và cả
              1024px, cụm này render ở left:-46px — nằm ngoài mép trái màn hình,
              nhãn cụt còn "ất". Đây là lỗi CÓ SẴN, không phải do đợt mobile
              sinh ra, nhưng nó thuộc đúng dải mà đợt này chịu trách nhiệm.
              Vì vậy `absolute` chỉ còn hiệu lực từ `xl` (1280px) — nấc đầu tiên
              thật sự có đủ lề. Dưới ngưỡng đó (md–xl) cụm nằm TRONG dòng chảy,
              xếp dọc trong rail (rail rộng thêm ~46px, lưới thẻ dịch phải
              tương ứng). */}
          <div className="mt-3 hidden w-max flex-col gap-2 md:flex xl:absolute xl:top-full xl:right-0">
            {quickSortLabels("rail")}
            {directionToggleButton("rail")}
          </div>
        </div>
      </div>
    </>
  );
}

interface Option {
  value: string;
  label: string;
}

function FilterRow({
  label,
  selectedLabel,
  currentValue,
  options,
  onSelect,
  last = false,
}: {
  label: string;
  selectedLabel?: string;
  currentValue?: string;
  options: Option[];
  onSelect: (value: string) => void;
  last?: boolean;
}) {
  const [rowOpen, setRowOpen] = useState(false);
  const rowRef = useRef<HTMLDivElement>(null);

  // Cuộn cả row vào vùng nhìn thấy của bottom sheet khi mở — dưới `md` bảng
  // chọn giờ in-flow (xem comment đầu file) nên nếu row nằm gần đáy panel,
  // nội dung mới lộ ra có thể vẫn khuất dưới mép cuộn hiện tại; không cuộn hộ
  // thì đúng cái cảm giác "mở ra mà không thấy gì" engineer vừa báo. Chỉ chạy
  // dưới `md` — desktop là overlay `absolute` trên panel `overflow-visible`,
  // cuộn hộ ở đó chỉ gây giật trang vô cớ.
  useEffect(() => {
    if (!rowOpen) return;
    // jsdom (RTL/vitest) không cài `matchMedia` — guard `typeof` để test
    // component chạy được, không phải vì lo trình duyệt thật thiếu API này.
    const isDesktop =
      typeof window !== "undefined" &&
      typeof window.matchMedia === "function" &&
      window.matchMedia("(min-width: 768px)").matches;
    if (!isDesktop) {
      rowRef.current?.scrollIntoView({ block: "nearest", behavior: "smooth" });
    }
  }, [rowOpen]);

  return (
    <div ref={rowRef} className={`relative ${last ? "" : "border-border border-b"}`}>
      {/* S#26: bỏ tam giác trong dropdown (RowTriangle) — row chỉ còn nhãn. */}
      <button
        type="button"
        aria-expanded={rowOpen}
        onClick={() => setRowOpen((v) => !v)}
        className="hover:bg-accent/50 flex w-full items-center justify-between gap-3 px-4 py-3 text-left transition-colors duration-150"
      >
        <span className="flex flex-col gap-0.5">
          <span className="eyebrow">{label}</span>
          {selectedLabel && (
            <span className="text-foreground font-serif text-base">{selectedLabel}</span>
          )}
        </span>
      </button>

      {/* Bảng chọn của filter — desktop (`md:`) là OVERLAY absolute (đè row
          dưới, không xê dịch); mobile IN-FLOW (đẩy row dưới xuống) — lý do đầy
          đủ ở comment đầu file (2026-08-09, bug dropdown Year bị BottomNav đè). */}
      {rowOpen && (
        <div
          className="border-border animate-in fade-in slide-in-from-top-1 z-30 border-x border-b duration-150 ease-out md:absolute md:inset-x-0 md:top-full"
          style={{ backgroundColor: OPTIONS_BG }}
        >
          <ul className="py-1">
            {options.map((opt) => {
              const active = opt.value === currentValue;
              return (
                <li key={opt.value || "all"}>
                  <button
                    type="button"
                    onClick={() => {
                      onSelect(opt.value);
                      setRowOpen(false);
                    }}
                    aria-pressed={active}
                    className={`flex w-full items-center gap-2 px-4 py-2 text-left font-serif text-base transition-colors ${
                      active ? "text-brand" : "text-muted-foreground hover:text-foreground"
                    }`}
                  >
                    <span
                      aria-hidden
                      className={`h-px w-3 shrink-0 transition-colors ${
                        active ? "bg-brand" : "bg-transparent"
                      }`}
                    />
                    {opt.label}
                  </button>
                </li>
              );
            })}
          </ul>
        </div>
      )}
    </div>
  );
}

// Tam giác đen MASTER: ▶ (đóng) → ▼ (mở). Màu mực (gần đen) — màu thật của design.
function Triangle({ open }: { open: boolean }) {
  return (
    <svg
      aria-hidden
      viewBox="0 0 12 12"
      className={`fill-foreground size-3.5 shrink-0 transition-transform ${
        open ? "rotate-90" : ""
      }`}
    >
      <path d="M2 1 L10 6 L2 11 Z" />
    </svg>
  );
}
