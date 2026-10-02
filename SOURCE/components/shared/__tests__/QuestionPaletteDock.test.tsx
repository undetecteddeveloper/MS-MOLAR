// @vitest-environment jsdom

// QuestionPaletteDock + QuestionPagination — bản dùng chung của màn làm bài,
// màn viết và màn xem bài giải (Frontend DD § Component Props Change Matrix,
// UI Spec C-21 / UI-D9 / UI-D26).
//
// CẬP NHẬT 2026-10-02 (engineer thống nhất mọi bảng câu hỏi về một cấu trúc phẳng:
// bỏ thẻ lồng thẻ ở bản popover, ô nhỏ 5 cột, chia mục theo PHẦN) — hai ảnh chụp
// markup bên dưới được chụp lại có chủ đích; mọi thay đổi trong đó đều thuộc đợt
// đó (khung bọc phẳng, `text-xs`, `grid-cols-5`, khung cuộn) và không gì khác.
//
// Hai nghĩa vụ chứng minh, cùng một file vì cùng một ranh giới props:
// 1. Nơi gọi CŨ — chỉ answeredIndices/flaggedIndices, đúng như ExamPlayer.tsx
//    gọi — render đúng cấu trúc thống nhất, không prop mới nào lọt vào. Ảnh chụp markup dưới đây được chụp
//    từ component TRƯỚC khi chuyển thư mục và thêm prop, nên một prop mới vô
//    tình đổi lớp, nhãn, chấm đánh dấu hay chữ trên nút của trang làm bài là đỏ.
// 2. Nhánh `cells[]` — mỗi trạng thái UI-D26 có đúng cặp ký hiệu + tên trợ năng,
//    không chỉ màu (AC-050); nhánh này bỏ qua hẳn answeredIndices/flaggedIndices.

import { cleanup, fireEvent, render, screen, within } from "@testing-library/react";
import { afterAll, afterEach, beforeAll, describe, expect, it, vi } from "vitest";
import { QuestionPaletteDock } from "@/components/shared/QuestionPaletteDock";
import { QuestionPagination, type QuestionCell } from "@/components/shared/QuestionPagination";

// jsdom không có scrollIntoView; nhánh >10 câu gọi nó để kéo ô đang xem vào khung.
beforeAll(() => {
  Element.prototype.scrollIntoView = vi.fn();
});
afterAll(() => {
  delete (Element.prototype as Partial<Element>).scrollIntoView;
});
afterEach(cleanup);

/** Markup cả `body` (scrim đi qua portal nên nằm ngoài container). Giá trị của
 *  useId phụ thuộc thứ tự render giữa các test nên được thay bằng chỗ giữ. */
function bodyMarkup(): string {
  return document.body.innerHTML
    .replace(/(id|aria-controls)="[^"]*"/g, '$1="ID"')
    .replaceAll("><", ">\n<");
}

function openPalette(): HTMLElement {
  const trigger = screen.getByRole("button", { name: "Bảng câu hỏi" });
  fireEvent.click(trigger);
  return trigger;
}

describe("nơi gọi cũ (ExamPlayer.tsx) — markup không đổi sau khi mở rộng", () => {
  const DOCK_LEGACY = {
    current: 3,
    total: 11,
    answeredIndices: [0, 2, 3],
    flaggedIndices: [2, 7],
  };

  it("dock đóng: nút chip hiện đã làm/tổng", () => {
    render(
      <QuestionPaletteDock {...DOCK_LEGACY} onJump={() => {}} className="shrink-0 md:hidden" />
    );
    expect(bodyMarkup()).toMatchInlineSnapshot(`
      "<div>
      <div class="relative shrink-0 md:hidden">
      <button type="button" aria-expanded="false" aria-controls="ID" aria-label="Bảng câu hỏi" class="inline-flex h-10 shrink-0 items-center rounded-full text-sm font-medium whitespace-nowrap transition-[color,background-color,scale] ease-out motion-safe:active:scale-97 focus-visible:ring-3 focus-visible:ring-ring/40 focus-visible:outline-none disabled:pointer-events-none disabled:opacity-40 glow-rim bg-surface text-foreground hover:bg-[color-mix(in_oklch,var(--surface),var(--foreground)_7%)] gap-1.5 px-3 tabular-nums">
      <svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" class="lucide lucide-layout-grid size-4" aria-hidden="true">
      <rect width="7" height="7" x="3" y="3" rx="1">
      </rect>
      <rect width="7" height="7" x="14" y="3" rx="1">
      </rect>
      <rect width="7" height="7" x="14" y="14" rx="1">
      </rect>
      <rect width="7" height="7" x="3" y="14" rx="1">
      </rect>
      </svg>
      <span>3/11</span>
      </button>
      </div>
      </div>"
    `);
  });

  it("dock mở (đề >10 câu): scrim + bảng popover lưới dày có dòng đếm", () => {
    render(
      <QuestionPaletteDock {...DOCK_LEGACY} onJump={() => {}} className="shrink-0 md:hidden" />
    );
    openPalette();
    expect(bodyMarkup()).toMatchInlineSnapshot(`
      "<div>
      <div class="relative shrink-0 md:hidden">
      <button type="button" aria-expanded="true" aria-controls="ID" aria-label="Bảng câu hỏi" class="inline-flex h-10 shrink-0 items-center rounded-full text-sm font-medium whitespace-nowrap transition-[color,background-color,scale] ease-out motion-safe:active:scale-97 focus-visible:ring-3 focus-visible:ring-ring/40 focus-visible:outline-none disabled:pointer-events-none disabled:opacity-40 bg-foreground text-background gap-1.5 px-3 tabular-nums">
      <svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" class="lucide lucide-layout-grid size-4" aria-hidden="true">
      <rect width="7" height="7" x="3" y="3" rx="1">
      </rect>
      <rect width="7" height="7" x="14" y="3" rx="1">
      </rect>
      <rect width="7" height="7" x="14" y="14" rx="1">
      </rect>
      <rect width="7" height="7" x="3" y="14" rx="1">
      </rect>
      </svg>
      <span>3/11</span>
      </button>
      <section id="ID" aria-label="Bảng câu hỏi" style="transform-origin: top right;" class="motion-pop border-border bg-popover absolute right-0 z-20 w-[min(20rem,calc(100vw-2rem))] rounded-xl border p-3 top-full mt-2">
      <div class="flex flex-col gap-3">
      <div class="flex items-baseline justify-between gap-3">
      <span class="text-sm font-semibold">Câu hỏi</span>
      <span class="text-muted-foreground text-xs tabular-nums" aria-live="polite">Đã làm 3/11</span>
      </div>
      <nav>
      <div class="flex flex-col gap-3 max-h-[min(50vh,22rem)] overflow-y-auto pr-1">
      <div>
      <ol class="grid grid-cols-5 gap-2">
      <li>
      <button type="button" data-q="0" aria-label="Câu 1 (đã làm)" class="focus-visible:ring-ring/40 relative flex aspect-square w-full items-center justify-center rounded-full text-xs font-semibold tabular-nums transition-[color,background-color,scale] ease-out focus-visible:ring-3 focus-visible:outline-none motion-safe:active:scale-90 bg-primary text-primary-foreground hover:bg-[color-mix(in_oklch,var(--primary),black_10%)]">1</button>
      </li>
      <li>
      <button type="button" data-q="1" aria-label="Câu 2" class="focus-visible:ring-ring/40 relative flex aspect-square w-full items-center justify-center rounded-full text-xs font-semibold tabular-nums transition-[color,background-color,scale] ease-out focus-visible:ring-3 focus-visible:outline-none motion-safe:active:scale-90 bg-surface text-muted-foreground hover:text-foreground">2</button>
      </li>
      <li>
      <button type="button" data-q="2" aria-label="Câu 3 (đã làm) (Đã đánh dấu)" class="focus-visible:ring-ring/40 relative flex aspect-square w-full items-center justify-center rounded-full text-xs font-semibold tabular-nums transition-[color,background-color,scale] ease-out focus-visible:ring-3 focus-visible:outline-none motion-safe:active:scale-90 bg-primary text-primary-foreground hover:bg-[color-mix(in_oklch,var(--primary),black_10%)]">3<span aria-hidden="true" class="bg-foreground ring-surface absolute top-0 right-0 size-2.5 rounded-full ring-2">
      </span>
      </button>
      </li>
      <li>
      <button type="button" data-q="3" aria-current="true" aria-label="Câu 4 (đã làm)" class="focus-visible:ring-ring/40 relative flex aspect-square w-full items-center justify-center rounded-full text-xs font-semibold tabular-nums transition-[color,background-color,scale] ease-out focus-visible:ring-3 focus-visible:outline-none motion-safe:active:scale-90 glow-sun bg-sun text-[color:var(--sun-on-solid)]">4</button>
      </li>
      <li>
      <button type="button" data-q="4" aria-label="Câu 5" class="focus-visible:ring-ring/40 relative flex aspect-square w-full items-center justify-center rounded-full text-xs font-semibold tabular-nums transition-[color,background-color,scale] ease-out focus-visible:ring-3 focus-visible:outline-none motion-safe:active:scale-90 bg-surface text-muted-foreground hover:text-foreground">5</button>
      </li>
      <li>
      <button type="button" data-q="5" aria-label="Câu 6" class="focus-visible:ring-ring/40 relative flex aspect-square w-full items-center justify-center rounded-full text-xs font-semibold tabular-nums transition-[color,background-color,scale] ease-out focus-visible:ring-3 focus-visible:outline-none motion-safe:active:scale-90 bg-surface text-muted-foreground hover:text-foreground">6</button>
      </li>
      <li>
      <button type="button" data-q="6" aria-label="Câu 7" class="focus-visible:ring-ring/40 relative flex aspect-square w-full items-center justify-center rounded-full text-xs font-semibold tabular-nums transition-[color,background-color,scale] ease-out focus-visible:ring-3 focus-visible:outline-none motion-safe:active:scale-90 bg-surface text-muted-foreground hover:text-foreground">7</button>
      </li>
      <li>
      <button type="button" data-q="7" aria-label="Câu 8 (Đã đánh dấu)" class="focus-visible:ring-ring/40 relative flex aspect-square w-full items-center justify-center rounded-full text-xs font-semibold tabular-nums transition-[color,background-color,scale] ease-out focus-visible:ring-3 focus-visible:outline-none motion-safe:active:scale-90 bg-surface text-muted-foreground hover:text-foreground">8<span aria-hidden="true" class="bg-foreground ring-surface absolute top-0 right-0 size-2.5 rounded-full ring-2">
      </span>
      </button>
      </li>
      <li>
      <button type="button" data-q="8" aria-label="Câu 9" class="focus-visible:ring-ring/40 relative flex aspect-square w-full items-center justify-center rounded-full text-xs font-semibold tabular-nums transition-[color,background-color,scale] ease-out focus-visible:ring-3 focus-visible:outline-none motion-safe:active:scale-90 bg-surface text-muted-foreground hover:text-foreground">9</button>
      </li>
      <li>
      <button type="button" data-q="9" aria-label="Câu 10" class="focus-visible:ring-ring/40 relative flex aspect-square w-full items-center justify-center rounded-full text-xs font-semibold tabular-nums transition-[color,background-color,scale] ease-out focus-visible:ring-3 focus-visible:outline-none motion-safe:active:scale-90 bg-surface text-muted-foreground hover:text-foreground">10</button>
      </li>
      <li>
      <button type="button" data-q="10" aria-label="Câu 11" class="focus-visible:ring-ring/40 relative flex aspect-square w-full items-center justify-center rounded-full text-xs font-semibold tabular-nums transition-[color,background-color,scale] ease-out focus-visible:ring-3 focus-visible:outline-none motion-safe:active:scale-90 bg-surface text-muted-foreground hover:text-foreground">11</button>
      </li>
      </ol>
      </div>
      </div>
      </nav>
      </div>
      </section>
      </div>
      </div>
      <button aria-hidden="true" tabindex="-1" class="fixed inset-0 z-10 cursor-default">
      </button>"
    `);
  });

  it("QuestionPagination cột phải (sidebar, đề ≤10 câu)", () => {
    render(
      <QuestionPagination
        current={1}
        total={5}
        answeredIndices={[0, 1]}
        flaggedIndices={[4]}
        onJump={() => {}}
      />
    );
    expect(bodyMarkup()).toMatchInlineSnapshot(`
      "<div>
      <div data-slot="card" class="flex flex-col rounded-card bg-surface text-foreground glow-card gap-3.5 p-4 sm:p-5">
      <div class="flex items-baseline justify-between gap-3">
      <span class="text-sm font-semibold">Câu hỏi</span>
      </div>
      <nav>
      <div class="flex flex-col gap-3">
      <div>
      <ol class="grid grid-cols-5 gap-2">
      <li>
      <button type="button" data-q="0" aria-label="Câu 1 (đã làm)" class="focus-visible:ring-ring/40 relative flex aspect-square w-full items-center justify-center rounded-full text-xs font-semibold tabular-nums transition-[color,background-color,scale] ease-out focus-visible:ring-3 focus-visible:outline-none motion-safe:active:scale-90 bg-primary text-primary-foreground hover:bg-[color-mix(in_oklch,var(--primary),black_10%)]">1</button>
      </li>
      <li>
      <button type="button" data-q="1" aria-current="true" aria-label="Câu 2 (đã làm)" class="focus-visible:ring-ring/40 relative flex aspect-square w-full items-center justify-center rounded-full text-xs font-semibold tabular-nums transition-[color,background-color,scale] ease-out focus-visible:ring-3 focus-visible:outline-none motion-safe:active:scale-90 glow-sun bg-sun text-[color:var(--sun-on-solid)]">2</button>
      </li>
      <li>
      <button type="button" data-q="2" aria-label="Câu 3" class="focus-visible:ring-ring/40 relative flex aspect-square w-full items-center justify-center rounded-full text-xs font-semibold tabular-nums transition-[color,background-color,scale] ease-out focus-visible:ring-3 focus-visible:outline-none motion-safe:active:scale-90 bg-card text-muted-foreground hover:text-foreground">3</button>
      </li>
      <li>
      <button type="button" data-q="3" aria-label="Câu 4" class="focus-visible:ring-ring/40 relative flex aspect-square w-full items-center justify-center rounded-full text-xs font-semibold tabular-nums transition-[color,background-color,scale] ease-out focus-visible:ring-3 focus-visible:outline-none motion-safe:active:scale-90 bg-card text-muted-foreground hover:text-foreground">4</button>
      </li>
      <li>
      <button type="button" data-q="4" aria-label="Câu 5 (Đã đánh dấu)" class="focus-visible:ring-ring/40 relative flex aspect-square w-full items-center justify-center rounded-full text-xs font-semibold tabular-nums transition-[color,background-color,scale] ease-out focus-visible:ring-3 focus-visible:outline-none motion-safe:active:scale-90 bg-card text-muted-foreground hover:text-foreground">5<span aria-hidden="true" class="bg-foreground ring-surface absolute top-0 right-0 size-2.5 rounded-full ring-2">
      </span>
      </button>
      </li>
      </ol>
      </div>
      </div>
      </nav>
      </div>
      </div>"
    `);
  });
});

describe("nhánh cells[] — UI-D26 (màn viết)", () => {
  const WRITE_CELLS: QuestionCell[] = [
    { index: 0, state: "noted", label: "Câu 1, đã ghi chú" },
    { index: 1, state: "missing", label: "Câu 2, chưa ghi chú" },
    { index: 2, state: "short", label: "Câu 3, chưa đủ 15 từ" },
    { index: 3, state: "changed", label: "Câu 4, câu hỏi đã thay đổi" },
  ];

  function renderWriteDock(onJump: (index: number) => void = () => {}) {
    render(
      <QuestionPaletteDock
        current={0}
        total={WRITE_CELLS.length}
        cells={WRITE_CELLS}
        triggerLabel="Bảng câu hỏi"
        panelTitle="Bảng câu hỏi"
        panelMeta="4 câu"
        onJump={onJump}
      />
    );
  }

  it.each([
    ["Câu 1, đã ghi chú", "1", "lucide-check", "bg-primary"],
    ["Câu 2, chưa ghi chú", "2", "lucide-minus", "bg-surface"],
    ["Câu 3, chưa đủ 15 từ", "3", "lucide-minus", "bg-surface"],
    ["Câu 4, câu hỏi đã thay đổi", "4", "lucide-refresh-cw", "bg-sun-soft"],
  ])(
    "ô có tên trợ năng %j hiện số %s kèm đúng một ký hiệu %s (nền %s)",
    (name, number, icon, bg) => {
      renderWriteDock();
      openPalette();

      const cell = screen.getByRole("button", { name });
      const symbols = cell.querySelectorAll("svg");
      expect(symbols).toHaveLength(1);
      expect(symbols[0].classList.contains(icon)).toBe(true);
      expect(symbols[0].getAttribute("aria-hidden")).toBe("true");
      expect(cell.textContent).toBe(number);
      expect(cell.classList.contains(bg)).toBe(true);
    }
  );

  it("cells có mặt thì answeredIndices/flaggedIndices bị bỏ qua hoàn toàn", () => {
    render(
      <QuestionPaletteDock
        current={0}
        total={WRITE_CELLS.length}
        answeredIndices={[0, 1, 2, 3]}
        flaggedIndices={[1]}
        cells={WRITE_CELLS}
        triggerLabel="Bảng câu hỏi"
        onJump={() => {}}
      />
    );
    openPalette();

    const grid = within(screen.getByRole("region", { name: "Bảng câu hỏi" })).getByRole("list");
    const names = within(grid)
      .getAllByRole("button")
      .map((b) => b.getAttribute("aria-label"));
    expect(names).toEqual(WRITE_CELLS.map((c) => c.label));
    // Không ô nào "đang xem" dù current=0: màn viết không có trạng thái đó.
    expect(document.querySelector("[aria-current]")).toBeNull();
    // Chấm đánh dấu của nhánh cũ là span tuyệt đối không có chữ.
    expect(grid.querySelector("span.absolute")).toBeNull();
  });

  it("nút mở: chữ hiển thị trùng tên trợ năng, cao 44px; bảng có tiêu đề + số câu", () => {
    renderWriteDock();
    const trigger = openPalette();

    expect(trigger.textContent).toBe("Bảng câu hỏi");
    expect(trigger.classList.contains("h-11")).toBe(true);
    expect(trigger.classList.contains("h-10")).toBe(false);

    const panel = screen.getByRole("region", { name: "Bảng câu hỏi" });
    expect(within(panel).getByText("Bảng câu hỏi")).toBeTruthy();
    expect(within(panel).getByText("4 câu")).toBeTruthy();
    expect(within(panel).queryByText("Câu hỏi")).toBeNull();
  });

  it("chọn một ô: gọi onJump với index của ô, bảng đóng, tiêu điểm về nút", () => {
    const onJump = vi.fn();
    renderWriteDock(onJump);
    const trigger = openPalette();

    fireEvent.click(screen.getByRole("button", { name: "Câu 3, chưa đủ 15 từ" }));

    expect(onJump).toHaveBeenCalledWith(2);
    expect(screen.queryByRole("region", { name: "Bảng câu hỏi" })).toBeNull();
    expect(document.activeElement).toBe(trigger);
  });

  it("Escape đóng bảng và trả tiêu điểm về nút", () => {
    renderWriteDock();
    const trigger = openPalette();

    fireEvent.keyDown(window, { key: "Escape" });

    expect(screen.queryByRole("region", { name: "Bảng câu hỏi" })).toBeNull();
    expect(document.activeElement).toBe(trigger);
  });
});

describe("nhánh cells[] — ô đang mở gần nhất (màn xem)", () => {
  it("chỉ ô mang state current có aria-current + viên vàng; ô khác nền surface", () => {
    render(
      <QuestionPaletteDock
        current={1}
        total={3}
        cells={[
          { index: 0, state: "idle", label: "Câu 1" },
          { index: 1, state: "current", label: "Câu 2" },
          { index: 2, state: "idle", label: "Câu 3" },
        ]}
        triggerLabel="Bảng câu hỏi"
        onJump={() => {}}
      />
    );
    openPalette();

    const marked = document.querySelectorAll('[aria-current="true"]');
    expect(marked).toHaveLength(1);
    expect(marked[0].getAttribute("aria-label")).toBe("Câu 2");
    expect(marked[0].classList.contains("bg-sun")).toBe(true);
    expect(marked[0].classList.contains("glow-sun")).toBe(true);
    for (const name of ["Câu 1", "Câu 3"]) {
      const cell = screen.getByRole("button", { name });
      expect(cell.classList.contains("bg-surface")).toBe(true);
      expect(cell.querySelector("svg")).toBeNull();
    }
  });

  it("không truyền triggerLabel: nút đếm các ô answered trên tổng", () => {
    render(
      <QuestionPaletteDock
        current={0}
        total={3}
        cells={[
          { index: 0, state: "answered", label: "Câu 1" },
          { index: 1, state: "current", label: "Câu 2" },
          { index: 2, state: "answered", label: "Câu 3" },
        ]}
        onJump={() => {}}
      />
    );

    expect(screen.getByRole("button", { name: "Bảng câu hỏi" }).textContent).toBe("2/3");
  });
});

describe("cấu trúc thống nhất (2026-10-02): mục theo PHẦN, ô tuỳ số, câu lỗi, mở lên trên", () => {
  const GROUPS = [
    { title: "PHẦN I. Trắc nghiệm", indices: [0, 1, 2] },
    { title: "PHẦN II. Đúng sai", indices: [3, 4] },
  ];

  it("có ≥ 2 mục → mỗi mục một nhãn nhỏ phía trên và một lưới 5 cột; ô vẫn đánh số theo thứ tự câu", () => {
    render(
      <QuestionPaletteDock
        current={0}
        total={5}
        groups={GROUPS}
        panelMeta="5 câu"
        onJump={() => {}}
      />
    );
    openPalette();

    const panel = screen.getByRole("region", { name: "Bảng câu hỏi" });
    expect(within(panel).getByText("PHẦN I. Trắc nghiệm")).toBeTruthy();
    expect(within(panel).getByText("PHẦN II. Đúng sai")).toBeTruthy();
    expect(within(panel).getAllByRole("list")).toHaveLength(2);
    expect(
      within(panel)
        .getAllByRole("button")
        .map((b) => b.textContent)
    ).toEqual(["1", "2", "3", "4", "5"]);
    expect(within(panel).getByText("5 câu")).toBeTruthy();
  });

  it("chỉ một mục (hoặc không truyền groups) → lưới phẳng, không nhãn mục", () => {
    render(
      <QuestionPaletteDock
        current={0}
        total={3}
        groups={[{ title: "PHẦN I", indices: [0, 1, 2] }]}
        onJump={() => {}}
      />
    );
    openPalette();

    const panel = screen.getByRole("region", { name: "Bảng câu hỏi" });
    expect(within(panel).queryByText("PHẦN I")).toBeNull();
    expect(within(panel).getAllByRole("list")).toHaveLength(1);
  });

  it("bấm ô trong mục thứ hai nhảy tới ĐÚNG index toàn cục", () => {
    const onJump = vi.fn();
    render(<QuestionPaletteDock current={0} total={5} groups={GROUPS} onJump={onJump} />);
    openPalette();

    fireEvent.click(
      within(screen.getByRole("region", { name: "Bảng câu hỏi" })).getByRole("button", {
        name: "Câu 5",
      })
    );

    expect(onJump).toHaveBeenCalledWith(4);
  });

  it("placement='top' mở bảng LÊN trên nút (bottom-full), mặc định thả xuống dưới (top-full)", () => {
    const { unmount } = render(<QuestionPaletteDock current={0} total={3} onJump={() => {}} />);
    openPalette();
    expect(screen.getByRole("region", { name: "Bảng câu hỏi" }).className).toContain("top-full");
    unmount();

    render(<QuestionPaletteDock current={0} total={3} placement="top" onJump={() => {}} />);
    openPalette();
    const panel = screen.getByRole("region", { name: "Bảng câu hỏi" });
    expect(panel.className).toContain("bottom-full");
    expect(panel.className).not.toContain("top-full");
  });

  it("QuestionPagination popover: ô số tuỳ (cell.number), câu lỗi đỏ + ký hiệu, dòng phụ đỏ; không còn thẻ lồng thẻ", () => {
    const cells: QuestionCell[] = [
      { index: 0, state: "idle", label: "Câu 1", number: 1 },
      { index: 1, state: "error", label: "Câu 1 (Cần sửa)", number: 1 },
    ];
    const { container } = render(
      <QuestionPagination
        variant="popover"
        current={-1}
        total={2}
        cells={cells}
        groups={[
          { title: "PHẦN I", indices: [0] },
          { title: "PHẦN II", indices: [1] },
        ]}
        panelMeta="1 câu cần sửa"
        panelMetaDanger
        onJump={() => {}}
      />
    );

    const bad = screen.getByRole("button", { name: "Câu 1 (Cần sửa)" });
    expect(bad.className).toContain("bg-destructive");
    expect(bad.querySelector("svg")).not.toBeNull();
    expect(screen.getByText("1 câu cần sửa").className).toContain("text-destructive");
    expect(container.querySelector("[data-slot=card]")).toBeNull();
  });
});
