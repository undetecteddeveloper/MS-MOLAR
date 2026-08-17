// @vitest-environment jsdom

// RouteLoadingOverlay — phần KHÔNG kiểm được bằng pageNavigation.test.ts:
// vòng đời bật/tắt. Ba tính chất, và cả ba đều là "làm sao nó TẮT được":
// một lớp phủ toàn màn hình bật nhầm chỉ khó chịu, tắt không được là khoá cứng
// người dùng ra khỏi sản phẩm.
//
// Trạng thái hiện/ẩn đọc qua `data-pending` chứ không qua style tính toán:
// hiệu ứng nằm ở globals.css (jsdom không nạp Tailwind), nên thuộc tính này
// đúng là hợp đồng giữa component và CSS — cũng chính là thứ selector
// `.route-loading[data-pending="true"]` bám vào.

import { act, cleanup, fireEvent, render, screen } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { RouteLoadingOverlay } from "./RouteLoadingOverlay";

// usePathname + useSearchParams là tín hiệu "URL mới đã commit". Điều khiển tay
// để mô phỏng đúng thứ tự thật: bấm (URL cũ) → chờ → URL đổi.
let pathname = "/exams";
let search = "";
vi.mock("next/navigation", () => ({
  usePathname: () => pathname,
  useSearchParams: () => new URLSearchParams(search),
}));

// next/image trong jsdom: chỉ cần một <img> để cây render được.
vi.mock("next/image", () => ({
  default: ({ src, alt, className }: { src: string; alt: string; className?: string }) => (
    // eslint-disable-next-line @next/next/no-img-element
    <img src={src} alt={alt} className={className} />
  ),
}));

function overlay() {
  const el = document.querySelector(".route-loading");
  if (!el) throw new Error("không thấy lớp phủ");
  return el;
}

function isPending() {
  return overlay().getAttribute("data-pending") === "true";
}

/** Một thẻ <a> thật trong document — handler bám ở tầng document nên phải bấm
 *  vào một node thật sự nằm trong cây, không phải một element rời. */
function anchor(href: string, attrs: Record<string, string> = {}) {
  const a = document.createElement("a");
  a.setAttribute("href", href);
  for (const [k, v] of Object.entries(attrs)) a.setAttribute(k, v);
  document.body.appendChild(a);
  return a;
}

/** Đặt "URL đang đứng" cho CẢ hai nguồn mà component đọc: `window.location`
 *  (handler click) và hook của Next (lượt render). Lệch hai cái là mô phỏng ra
 *  một trạng thái không tồn tại trong trình duyệt thật. */
function setLocation(url: string) {
  window.history.replaceState({}, "", url);
  pathname = window.location.pathname;
  search = window.location.search;
}

beforeEach(() => {
  setLocation("/exams");
  vi.useFakeTimers();
});

afterEach(() => {
  cleanup();
  document.body.innerHTML = "";
  vi.useRealTimers();
});

describe("RouteLoadingOverlay", () => {
  it("mặc định ẩn, và LUÔN có mặt trong DOM (ảnh logo phải tải sẵn)", () => {
    render(<RouteLoadingOverlay />);
    expect(isPending()).toBe(false);
    expect(document.querySelector("img")?.getAttribute("src")).toBe("/images/brand_logo.png");
  });

  it("bấm liên kết sang path khác → bật; route mới commit → tự tắt", () => {
    const { rerender } = render(<RouteLoadingOverlay />);

    fireEvent.click(anchor("/history"));
    expect(isPending()).toBe(true);
    // Vùng aria-live phải có chữ để trình đọc màn hình phát ra được.
    expect(screen.getByRole("status").textContent).toBe("Loading");

    // Không tự tắt trong lúc còn đứng ở path cũ.
    act(() => vi.advanceTimersByTime(3_000));
    expect(isPending()).toBe(true);

    setLocation("/history");
    rerender(<RouteLoadingOverlay />);
    expect(isPending()).toBe(false);
    expect(screen.getByRole("status").textContent).toBe("");
  });

  it("redirect VỀ CHÍNH path cũ (guard đăng nhập) vẫn tắt được lớp phủ", () => {
    // Khách chưa đăng nhập bấm "Exams" → middleware đá về `/?auth=signin`:
    // xuất phát ở `/` và cũng kết thúc ở `/`. So pathname trơn thì lớp phủ
    // không có cách nào biết mình đã tới nơi — đây là lý do khoá vị trí phải
    // gồm cả query. Đo được trên trình duyệt thật, không phải ca giả định.
    setLocation("/");
    const { rerender } = render(<RouteLoadingOverlay />);

    fireEvent.click(anchor("/exams"));
    expect(isPending()).toBe(true);

    setLocation("/?auth=signin");
    rerender(<RouteLoadingOverlay />);
    expect(isPending()).toBe(false);
  });

  it("bấm vào chữ BÊN TRONG liên kết vẫn tính (leo cây qua closest)", () => {
    render(<RouteLoadingOverlay />);
    const a = anchor("/history");
    const span = document.createElement("span");
    a.appendChild(span);

    fireEvent.click(span);
    expect(isPending()).toBe(true);
  });

  it("liên kết KHÔNG rời trang (`?auth=` cùng path) không bật gì", () => {
    window.history.replaceState({}, "", "/");
    pathname = "/";
    render(<RouteLoadingOverlay />);

    fireEvent.click(anchor("/?auth=signin"));
    expect(isPending()).toBe(false);
  });

  it("popstate (nút Back) tắt lớp phủ dù route chưa hề đổi", () => {
    render(<RouteLoadingOverlay />);
    fireEvent.click(anchor("/history"));
    expect(isPending()).toBe(true);

    act(() => {
      window.dispatchEvent(new PopStateEvent("popstate"));
    });
    expect(isPending()).toBe(false);
  });

  it("hẹn giờ chặn trên tắt lớp phủ khi KHÔNG có tín hiệu kết thúc nào", () => {
    // Đường thoát cuối: người dùng bấm Stop, hoặc mạng chết giữa chừng — không
    // có route nào commit và cũng không sự kiện nào bắn.
    render(<RouteLoadingOverlay />);
    fireEvent.click(anchor("/history"));

    act(() => vi.advanceTimersByTime(12_000));
    expect(isPending()).toBe(false);
  });
});
