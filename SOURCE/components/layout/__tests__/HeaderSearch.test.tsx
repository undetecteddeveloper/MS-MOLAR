// @vitest-environment jsdom

// HeaderSearch — hợp đồng combobox của ô tìm đề (ADR-0020). Mock hai biên:
// `next/navigation` (router/pathname/searchParams) và `fetch` (API gợi ý).
// Debounce chạy THẬT (250ms) qua `waitFor` — giả lập đồng hồ ở đây chỉ để đổi
// một con số lấy một chỗ dễ sai hơn.
//
// jsdom không áp CSS Tailwind, nên CẢ ô thường trực (desktop) lẫn nút kính lúp
// (mobile) đều có mặt trong DOM cùng lúc; mọi truy vấn vì thế nêu rõ vai + tên.
// Không có `test.setupFiles` → không có jest-dom, đọc thuộc tính DOM trực tiếp
// (cùng quy ước ActionButton.test.tsx).

import { cleanup, fireEvent, render, screen, waitFor, within } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

const push = vi.fn();
let pathname = "/";
let search = "";

vi.mock("next/navigation", () => ({
  useRouter: () => ({ push }),
  usePathname: () => pathname,
  useSearchParams: () => new URLSearchParams(search),
}));

import { HeaderSearch } from "../HeaderSearch";

const HITS = [
  { id: "exam-toan-10", title: "Đề luyện Toán 10 — Hàm số", subject: "Math", grade: 10 },
  { id: "exam-toan-12", title: "Đề Toán 12 — Nguyên hàm", subject: "Math", grade: 12 },
];

type FetchLike = (input: string, init?: RequestInit) => Promise<{
  ok: boolean;
  status: number;
  json: () => Promise<{ items: typeof HITS }>;
}>;

function mockFetch(items = HITS, ok = true) {
  const fn = vi.fn<FetchLike>(async () => ({
    ok,
    status: ok ? 200 : 500,
    json: async () => ({ items }),
  }));
  vi.stubGlobal("fetch", fn);
  return fn;
}

async function listboxWithOptions(count: number): Promise<HTMLElement> {
  // Bảng mở NGAY khi gõ (trạng thái đang tìm, chỉ có dòng cuối); đợi tới khi đủ
  // số dòng để không bắt nhầm danh sách của lúc chưa có kết quả.
  const listbox = await screen.findByRole("listbox");
  await waitFor(() => expect(within(listbox).getAllByRole("option")).toHaveLength(count));
  return listbox;
}

function desktopInput(): HTMLInputElement {
  // Ô thường trực nằm trong form đầu tiên; thanh phủ mobile chỉ có khi mở.
  return screen.getAllByRole("combobox")[0] as HTMLInputElement;
}

beforeEach(() => {
  push.mockReset();
  pathname = "/";
  search = "";
});

afterEach(() => {
  cleanup();
  vi.unstubAllGlobals();
});

describe("HeaderSearch", () => {
  it("gõ từ 2 ký tự → gọi API sau debounce với từ khoá ĐÃ chuẩn hoá và liệt kê gợi ý + dòng xem tất cả", async () => {
    const fetchMock = mockFetch();
    render(<HeaderSearch />);

    const input = desktopInput();
    expect(input.getAttribute("aria-expanded")).toBe("false");
    fireEvent.change(input, { target: { value: "Toán" } });

    await waitFor(() => expect(fetchMock).toHaveBeenCalledTimes(1));
    expect(String(fetchMock.mock.calls[0][0])).toBe("/api/exams/search?q=toan");

    const listbox = await screen.findByRole("listbox");
    const options = within(listbox).getAllByRole("option");
    expect(options).toHaveLength(HITS.length + 1);
    expect(options[0].textContent).toContain("Đề luyện Toán 10 — Hàm số");
    expect(options[0].textContent).toContain("Toán, lớp 10");
    expect(options[2].textContent).toContain("Xem tất cả kết quả cho “Toán”");
    expect(input.getAttribute("aria-expanded")).toBe("true");
    expect(input.getAttribute("aria-controls")).toBe(listbox.id);
  });

  it("dưới 2 ký tự sau chuẩn hoá → không gọi API, không mở danh sách", async () => {
    const fetchMock = mockFetch();
    render(<HeaderSearch />);

    fireEvent.change(desktopInput(), { target: { value: "t" } });
    await new Promise((resolve) => setTimeout(resolve, 350));

    expect(fetchMock).not.toHaveBeenCalled();
    expect(screen.queryByRole("listbox")).toBeNull();
  });

  it("mũi tên xuống + Enter mở đúng đề đang chọn; aria-activedescendant trỏ vào dòng đó", async () => {
    mockFetch();
    render(<HeaderSearch />);
    const input = desktopInput();
    fireEvent.change(input, { target: { value: "toan" } });
    const listbox = await listboxWithOptions(HITS.length + 1);

    fireEvent.keyDown(input, { key: "ArrowDown" });
    fireEvent.keyDown(input, { key: "ArrowDown" });
    const second = within(listbox).getAllByRole("option")[1];
    expect(second.getAttribute("aria-selected")).toBe("true");
    expect(input.getAttribute("aria-activedescendant")).toBe(second.id);

    fireEvent.submit(input.closest("form") as HTMLFormElement);
    expect(push).toHaveBeenCalledWith("/exams/exam-toan-12");
  });

  it("Enter khi chưa chọn dòng nào → mở Kho đề lọc theo từ khoá THÔ (URL-encoded)", async () => {
    mockFetch();
    render(<HeaderSearch />);
    const input = desktopInput();
    fireEvent.change(input, { target: { value: "  toán 10 " } });
    await screen.findByRole("listbox");

    fireEvent.submit(input.closest("form") as HTMLFormElement);
    expect(push).toHaveBeenCalledWith("/exams?q=to%C3%A1n%2010");
  });

  it("bấm dòng gợi ý → mở đề; bấm dòng cuối → Kho đề", async () => {
    mockFetch();
    render(<HeaderSearch />);
    fireEvent.change(desktopInput(), { target: { value: "toan" } });
    const listbox = await listboxWithOptions(HITS.length + 1);
    const options = within(listbox).getAllByRole("option");

    fireEvent.click(options[0]);
    expect(push).toHaveBeenLastCalledWith("/exams/exam-toan-10");

    // Giá trị KHÁC lần trước: React chỉ bắn onChange khi value đổi thật.
    fireEvent.change(desktopInput(), { target: { value: "toan 10" } });
    const again = await listboxWithOptions(HITS.length + 1);
    fireEvent.click(within(again).getAllByRole("option")[2]);
    expect(push).toHaveBeenLastCalledWith("/exams?q=toan%2010");
  });

  it("Escape đóng danh sách nhưng giữ từ khoá", async () => {
    mockFetch();
    render(<HeaderSearch />);
    const input = desktopInput();
    fireEvent.change(input, { target: { value: "toan" } });
    await screen.findByRole("listbox");

    fireEvent.keyDown(input, { key: "Escape" });
    expect(screen.queryByRole("listbox")).toBeNull();
    expect(input.value).toBe("toan");
    expect(input.getAttribute("aria-expanded")).toBe("false");
  });

  it("API hỏng → dòng báo lỗi (role=alert) nhưng dòng xem tất cả vẫn còn để Enter đi tiếp", async () => {
    mockFetch([], false);
    render(<HeaderSearch />);
    fireEvent.change(desktopInput(), { target: { value: "toan" } });

    const alert = await screen.findByRole("alert");
    expect(alert.textContent).toContain("Chưa tìm được lúc này");
    const listbox = screen.getByRole("listbox");
    expect(within(listbox).getAllByRole("option")).toHaveLength(1);
  });

  it("không có kết quả → câu báo nhắc lại từ khoá", async () => {
    mockFetch([]);
    render(<HeaderSearch />);
    fireEvent.change(desktopInput(), { target: { value: "xyz" } });

    expect((await screen.findByText(/Không tìm thấy đề nào cho “xyz”/)).textContent).toBeTruthy();
  });

  it("ở /exams, ô lấy sẵn ?q= và đổi theo URL khi chip xoá từ khoá", () => {
    pathname = "/exams";
    search = "q=h%C3%B3a+h%E1%BB%8Dc";
    mockFetch();
    const { rerender } = render(<HeaderSearch />);
    expect(desktopInput().value).toBe("hóa học");

    search = "";
    rerender(<HeaderSearch />);
    expect(desktopInput().value).toBe("");
  });

  it("điện thoại: nút kính lúp mở thanh phủ có ô nhập tự lấy tiêu điểm; Escape (danh sách đóng) đóng thanh", async () => {
    mockFetch();
    render(<HeaderSearch />);

    fireEvent.click(screen.getByRole("button", { name: "Mở ô tìm đề" }));
    const inputs = screen.getAllByRole("combobox");
    expect(inputs).toHaveLength(2);
    const mobileInput = inputs[1] as HTMLInputElement;
    await waitFor(() => expect(document.activeElement).toBe(mobileInput));
    expect(screen.getByRole("button", { name: "Đóng ô tìm đề" })).toBeTruthy();

    fireEvent.keyDown(mobileInput, { key: "Escape" });
    expect(screen.getAllByRole("combobox")).toHaveLength(1);
  });
});
