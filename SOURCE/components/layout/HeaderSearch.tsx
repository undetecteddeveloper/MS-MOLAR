"use client";

// HeaderSearch — ô tìm đề theo tên trên SiteHeader (ADR-0020, 2026-09-08).
//
// Hai hình dạng, MỘT trạng thái:
//  - ≥1024px (lg): ô nhập thường trực giữa dãy liên kết và ô tài khoản
//    (w-44, w-56 từ 1280px). Dưới 1024px dãy liên kết đã sát mép (đo 2026-09-06:
//    9px dư ở đúng 768px), nên ở đó KHÔNG có ô thường trực.
//  - <1024px: nút kính lúp 44px; bấm thì một thanh phủ trọn hàng header (logo,
//    liên kết, tài khoản đều nằm dưới) với nút đóng + ô nhập tự lấy tiêu điểm.
// Chỉ render khi ĐÃ đăng nhập (SiteHeader quyết): kho đề nằm sau RLS
// `to authenticated`, khách tìm gì cũng không ra — một ô tìm luôn trả rỗng là
// một lời hứa hỏng.
//
// Gợi ý khi gõ: debounce 250ms, từ 2 ký tự sau chuẩn hoá, gọi
// `GET /api/exams/search`, tối đa 6 dòng + dòng "Xem tất cả kết quả" dẫn tới
// Kho đề đã lọc (`/exams?q=`). Enter không chọn dòng nào → cũng tới Kho đề.
// Mọi lượt fetch cũ bị huỷ (AbortController) khi từ khoá đổi, và kết quả chỉ
// được hiện khi nó thuộc ĐÚNG từ khoá đang gõ (`result.term === term`) —
// không có chuyện gõ nhanh mà danh sách của từ khoá trước nhảy lên sau.
//
// Trạng thái được SUY từ (từ khoá, kết quả cuối) thay vì đặt trong effect:
// `loading` = có từ khoá mà kết quả cuối chưa thuộc về nó; `hits` = kết quả
// cuối nếu đúng từ khoá, rỗng nếu không. Nhờ vậy effect fetch chỉ lên lịch và
// huỷ, không có setState đồng bộ nào trong thân effect
// (react-hooks/set-state-in-effect).
//
// Trợ năng: mẫu combobox ARIA 1.2 — <input role="combobox" aria-expanded
// aria-controls aria-activedescendant>, danh sách role="listbox"/"option",
// mũi tên lên/xuống chọn, Enter mở, Escape đóng; số gợi ý được đọc qua một
// vùng aria-live. Ô nhập đồng bộ với `?q=` khi đang ở /exams (bấm chip xoá
// từ khoá thì ô cũng trống).

import { Search, X } from "lucide-react";
import { usePathname, useRouter, useSearchParams } from "next/navigation";
import { Suspense, useEffect, useId, useRef, useState } from "react";
import { Button } from "@/components/ui/button";
import { t } from "@/lib/copy";
import { SEARCH_MAX_LENGTH, toSearchTerm } from "@/lib/search/normalize";
import { subjectLabel } from "@/lib/ugc/subjects";
import { cn } from "@/lib/utils";

type Hit = { id: string; title: string; subject: string; grade: number };
type SearchResult = { term: string; hits: Hit[]; error: boolean };

const DEBOUNCE_MS = 250;

/** Kho đề lọc theo từ khoá THÔ (đã cắt trần) — Kho đề tự chuẩn hoá lại. */
function examsHref(raw: string): string {
  return `/exams?q=${encodeURIComponent(raw.trim().slice(0, SEARCH_MAX_LENGTH))}`;
}

export function HeaderSearch() {
  // `useSearchParams` cần một ranh giới Suspense khi trang được dựng tĩnh; mọi
  // trang có header hôm nay đều động, ranh giới này là dự phòng cho trang tĩnh
  // sau này — fallback rỗng chỉ tồn tại trong tích tắc dựng tĩnh.
  return (
    <Suspense fallback={null}>
      <HeaderSearchInner />
    </Suspense>
  );
}

function HeaderSearchInner() {
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const urlQuery = pathname === "/exams" ? (searchParams.get("q") ?? "") : "";

  const [value, setValue] = useState(urlQuery);
  // Đồng bộ ô với URL khi `?q=` đổi từ nơi khác (chip xoá, Xoá lọc, Back) —
  // "điều chỉnh state khi prop đổi" ngay trong render, không phải effect.
  const [prevUrlQuery, setPrevUrlQuery] = useState(urlQuery);
  if (urlQuery !== prevUrlQuery) {
    setPrevUrlQuery(urlQuery);
    setValue(urlQuery);
  }

  const [mobileOpen, setMobileOpen] = useState(false);
  const [listOpen, setListOpen] = useState(false);
  const [result, setResult] = useState<SearchResult | null>(null);
  const [active, setActive] = useState<{ term: string; index: number }>({ term: "", index: -1 });

  const rootRef = useRef<HTMLDivElement>(null);
  const mobileInputRef = useRef<HTMLInputElement>(null);
  const baseId = useId();

  const term = toSearchTerm(value);
  const hits = term !== null && result?.term === term ? result.hits : [];
  const loading = term !== null && result?.term !== term;
  const failed = term !== null && result?.term === term && result.error;
  const activeIndex = term !== null && active.term === term ? active.index : -1;
  // Dòng cuối luôn là "Xem tất cả kết quả" — lối ra không phụ thuộc RPC. Trong
  // lúc ĐANG TÌM danh sách trống hẳn (chỉ một câu "Đang tìm…"): đo 2026-09-08,
  // để sẵn dòng "Xem tất cả" rồi chèn gợi ý lên trên nó là một dịch chuyển bị
  // tính vào CLS (0,012 ở 360px) vì kết quả về sau cửa sổ 500ms; danh sách hiện
  // trọn một lần thì không có gì đang hiện phải dời chỗ. Enter vẫn mở Kho đề
  // trong lúc đang tìm — `submit()` không cần tới dòng đó.
  const optionCount = term !== null && !loading ? hits.length + 1 : 0;
  const panelVisible = listOpen && term !== null;

  useEffect(() => {
    if (term === null) return;
    const controller = new AbortController();
    const timer = setTimeout(() => {
      fetch(`/api/exams/search?q=${encodeURIComponent(term)}`, {
        signal: controller.signal,
        credentials: "same-origin",
      })
        .then(async (res) => {
          if (!res.ok) throw new Error(String(res.status));
          return (await res.json()) as { items: Hit[] };
        })
        .then((body) => {
          if (!controller.signal.aborted) setResult({ term, hits: body.items, error: false });
        })
        .catch(() => {
          if (!controller.signal.aborted) setResult({ term, hits: [], error: true });
        });
    }, DEBOUNCE_MS);
    return () => {
      clearTimeout(timer);
      controller.abort();
    };
  }, [term]);

  // Bấm ra ngoài → đóng danh sách (thanh phủ trên điện thoại vẫn mở tới khi
  // bấm đóng hoặc Escape — người dùng có thể chỉ đang với tay lên bàn phím).
  useEffect(() => {
    if (!listOpen) return;
    function onPointerDown(event: PointerEvent) {
      if (rootRef.current && !rootRef.current.contains(event.target as Node)) {
        setListOpen(false);
      }
    }
    document.addEventListener("pointerdown", onPointerDown);
    return () => document.removeEventListener("pointerdown", onPointerDown);
  }, [listOpen]);

  useEffect(() => {
    if (mobileOpen) mobileInputRef.current?.focus();
  }, [mobileOpen]);

  function go(href: string) {
    setListOpen(false);
    setMobileOpen(false);
    router.push(href);
  }

  function choose(index: number) {
    if (term === null) return;
    const hit = hits[index];
    go(hit ? `/exams/${hit.id}` : examsHref(value));
  }

  function submit() {
    if (activeIndex >= 0) {
      choose(activeIndex);
      return;
    }
    if (term !== null) go(examsHref(value));
  }

  function onKeyDown(event: React.KeyboardEvent<HTMLInputElement>) {
    if (event.key === "ArrowDown" || event.key === "ArrowUp") {
      if (term === null) return;
      event.preventDefault();
      setListOpen(true);
      const step = event.key === "ArrowDown" ? 1 : -1;
      const next = (activeIndex + step + optionCount) % optionCount;
      setActive({ term, index: next });
      return;
    }
    if (event.key === "Escape") {
      // Đóng thứ đang NHÌN THẤY: danh sách gợi ý trước, còn khi không có danh
      // sách nào hiện thì Escape đóng thanh phủ trên điện thoại.
      if (panelVisible) {
        event.preventDefault();
        setListOpen(false);
      } else if (mobileOpen) {
        event.preventDefault();
        setMobileOpen(false);
      }
    }
  }

  function onChange(event: React.ChangeEvent<HTMLInputElement>) {
    setValue(event.target.value);
    setListOpen(true);
  }

  const fieldProps = {
    value,
    onChange,
    onKeyDown,
    onFocus: () => setListOpen(true),
    "aria-expanded": panelVisible,
    "aria-activedescendant": activeIndex >= 0 ? `${baseId}-opt-${activeIndex}` : undefined,
  };

  const panel = panelVisible ? (
    <SuggestionPanel
      baseId={baseId}
      query={value.trim()}
      hits={hits}
      loading={loading}
      failed={failed}
      activeIndex={activeIndex}
      onChoose={choose}
    />
  ) : null;

  return (
    <div ref={rootRef} className="flex items-center">
      {/* Vùng đọc cho trình đọc màn hình — số gợi ý đổi theo từ khoá. `aria-live`
          thuần trên một <div>, KHÔNG `role="status"` và KHÔNG <p>: header có mặt
          trên mọi trang, và trang kết quả có ca kiểm khẳng định "không có
          `p[aria-live=polite]` nào" để chứng minh không mount bộ chấm tự luận
          (essay-auto-scoring fixture, FE2E-1) — vùng đọc của ô tìm không được
          phép làm mờ khẳng định đó. */}
      <div aria-live="polite" aria-atomic="true" className="sr-only">
        {term !== null && !loading && !failed
          ? t("search.resultsAnnouncement", { count: hits.length })
          : ""}
      </div>

      {/* ≥1024px: ô thường trực. */}
      <form
        role="search"
        onSubmit={(event) => {
          event.preventDefault();
          submit();
        }}
        className="relative hidden lg:block"
      >
        <SearchField
          {...fieldProps}
          listboxId={`${baseId}-list`}
          className="w-44 xl:w-56"
          onClear={() => setValue("")}
        />
        {/* Chỉ MỘT bảng gợi ý trong DOM: khi thanh phủ điện thoại đang mở thì
            bảng thuộc về nó — hai bảng cùng lúc là hai bộ id trùng nhau và
            `aria-controls` trỏ vào một trong hai mà không ai biết cái nào. */}
        {panel && !mobileOpen && (
          <div className="absolute top-full right-0 z-20 mt-2 w-80">{panel}</div>
        )}
      </form>

      {/* <1024px: nút kính lúp, bấm thì thanh phủ trọn hàng header. */}
      <Button
        type="button"
        variant="ghost"
        size="icon"
        aria-label={t("search.open")}
        aria-expanded={mobileOpen}
        onClick={() => {
          setMobileOpen(true);
          setListOpen(true);
        }}
        className="lg:hidden"
      >
        <Search aria-hidden />
      </Button>

      {mobileOpen && (
        <div className="bg-[var(--nav-bg)] absolute inset-0 z-20 flex items-center gap-2 px-4 sm:px-6 lg:hidden">
          <Button
            type="button"
            variant="ghost"
            size="icon"
            aria-label={t("search.close")}
            onClick={() => setMobileOpen(false)}
          >
            <X aria-hidden />
          </Button>
          <form
            role="search"
            onSubmit={(event) => {
              event.preventDefault();
              submit();
            }}
            className="min-w-0 flex-1"
          >
            <SearchField
              {...fieldProps}
              ref={mobileInputRef}
              listboxId={`${baseId}-list`}
              className="w-full"
              onClear={() => {
                setValue("");
                mobileInputRef.current?.focus();
              }}
            />
          </form>
          {panel && <div className="absolute inset-x-0 top-full z-20 mt-2 px-4 sm:px-6">{panel}</div>}
        </div>
      )}
    </div>
  );
}

type SearchFieldProps = {
  value: string;
  onChange: (event: React.ChangeEvent<HTMLInputElement>) => void;
  onKeyDown: (event: React.KeyboardEvent<HTMLInputElement>) => void;
  onFocus: () => void;
  onClear: () => void;
  listboxId: string;
  className?: string;
  ref?: React.Ref<HTMLInputElement>;
  "aria-expanded": boolean;
  "aria-activedescendant"?: string;
};

/** Ô nhập viên thuốc nền surface với kính lúp bên trái và nút xoá bên phải —
 *  cùng chiều cao 40px với chip và mục điều hướng trên header. */
function SearchField({
  listboxId,
  className,
  onClear,
  ref,
  value,
  "aria-expanded": expanded,
  ...input
}: SearchFieldProps) {
  return (
    <div className={cn("relative", className)}>
      <Search
        aria-hidden
        className="text-muted-foreground pointer-events-none absolute top-1/2 left-3 size-4 -translate-y-1/2"
      />
      <input
        ref={ref}
        type="text"
        inputMode="search"
        enterKeyHint="search"
        role="combobox"
        aria-label={t("search.label")}
        aria-autocomplete="list"
        aria-expanded={expanded}
        aria-controls={listboxId}
        autoComplete="off"
        autoCorrect="off"
        spellCheck={false}
        maxLength={SEARCH_MAX_LENGTH}
        placeholder={t("search.placeholder")}
        value={value}
        className="bg-surface text-foreground placeholder:text-muted-foreground/80 focus-visible:ring-ring/40 h-10 w-full rounded-full pr-9 pl-9 text-sm outline-none focus-visible:ring-3"
        {...input}
      />
      {value !== "" && (
        <button
          type="button"
          aria-label={t("search.clear")}
          onClick={onClear}
          className="text-muted-foreground hover:text-foreground focus-visible:ring-ring/40 absolute top-1/2 right-1.5 inline-flex size-7 -translate-y-1/2 items-center justify-center rounded-full focus-visible:ring-3 focus-visible:outline-none"
        >
          <X aria-hidden className="size-4" />
        </button>
      )}
    </div>
  );
}

const OPTION_CLASS =
  "flex min-h-11 w-full cursor-pointer flex-col justify-center gap-0.5 rounded-lg px-3 py-1.5 text-left text-sm transition-colors hover:bg-surface";

function SuggestionPanel({
  baseId,
  query,
  hits,
  loading,
  failed,
  activeIndex,
  onChoose,
}: {
  baseId: string;
  query: string;
  hits: Hit[];
  loading: boolean;
  failed: boolean;
  activeIndex: number;
  onChoose: (index: number) => void;
}) {
  return (
    <div className="border-border bg-popover rounded-xl border p-1.5">
      {loading && <p className="text-muted-foreground px-3 py-2.5 text-sm">{t("search.loading")}</p>}
      {failed && (
        <p role="alert" className="text-destructive px-3 py-2.5 text-sm">
          {t("search.error")}
        </p>
      )}
      {!loading && !failed && hits.length === 0 && (
        <p className="text-muted-foreground px-3 py-2.5 text-sm">
          {t("search.noResults", { query })}
        </p>
      )}
      {/* Danh sách luôn có mặt (aria-controls trỏ vào nó) nhưng TRỐNG khi đang
          tìm — xem `optionCount` ở trên. */}
      <ul role="listbox" id={`${baseId}-list`} aria-label={t("search.label")}>
        {!loading &&
          hits.map((hit, index) => (
          <li
            key={hit.id}
            id={`${baseId}-opt-${index}`}
            role="option"
            aria-selected={index === activeIndex}
            onClick={() => onChoose(index)}
            className={cn(OPTION_CLASS, index === activeIndex && "bg-surface")}
          >
            <span className="line-clamp-1 font-medium">{hit.title}</span>
            <span className="text-muted-foreground text-xs">
              {t("search.hitMeta", { subject: subjectLabel(hit.subject), grade: hit.grade })}
            </span>
          </li>
          ))}
        {!loading && (
          <li
            id={`${baseId}-opt-${hits.length}`}
            role="option"
            aria-selected={activeIndex === hits.length}
            onClick={() => onChoose(hits.length)}
            className={cn(
              OPTION_CLASS,
              "text-primary flex-row items-center gap-2 font-semibold",
              activeIndex === hits.length && "bg-surface"
            )}
          >
            <Search aria-hidden className="size-4 shrink-0" />
            <span className="line-clamp-1">{t("search.viewAll", { query })}</span>
          </li>
        )}
      </ul>
    </div>
  );
}
