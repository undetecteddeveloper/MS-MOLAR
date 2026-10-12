// @vitest-environment jsdom

// app/(authoring)/upload/page.tsx — khách chưa đăng nhập (brief 20261012 T3).
// Khách thấy khung + thẻ cần đăng nhập và KHÔNG có form nào để gửi.

import { beforeEach, describe, expect, it, vi } from "vitest";
import { renderServerTree } from "@/tests/helpers/renderServerTree";

vi.mock("server-only", () => ({}));

const { getCurrentUserMock, redirectMock } = vi.hoisted(() => ({
  getCurrentUserMock: vi.fn(),
  redirectMock: vi.fn(() => {
    throw new Error("NEXT_REDIRECT");
  }),
}));

vi.mock("next/navigation", () => ({
  redirect: redirectMock,
  usePathname: () => "/upload",
  useSearchParams: () => new URLSearchParams(),
  useRouter: () => ({ push: vi.fn(), replace: vi.fn(), refresh: vi.fn(), back: vi.fn() }),
}));
vi.mock("@/lib/auth/getCurrentUser", () => ({ getCurrentUser: getCurrentUserMock }));
vi.mock("@/features/authoring/components/UploadForm", () => ({
  UploadForm: () => <form data-testid="upload-form" />,
}));

import UploadPage from "@/app/(authoring)/upload/page";

beforeEach(() => {
  vi.clearAllMocks();
});

describe("UploadPage", () => {
  it("khách: không redirect, không dựng form, hiện thẻ cần đăng nhập với next=/upload", async () => {
    getCurrentUserMock.mockResolvedValue(null);

    const { container } = await renderServerTree(await UploadPage());

    expect(redirectMock).not.toHaveBeenCalled();
    expect(container.querySelector("[data-testid='upload-form']")).toBeNull();
    expect(container.querySelector("form")).toBeNull();
    expect(
      container.querySelector("[data-testid='login-required'] a")?.getAttribute("href")
    ).toBe("/?auth=signin&next=%2Fupload");
  });

  it("người đã đăng nhập: dựng form, không có thẻ cần đăng nhập", async () => {
    getCurrentUserMock.mockResolvedValue({ id: "u1" });

    const { container } = await renderServerTree(await UploadPage());

    expect(container.querySelector("[data-testid='upload-form']")).not.toBeNull();
    expect(container.querySelector("[data-testid='login-required']")).toBeNull();
  });
});
