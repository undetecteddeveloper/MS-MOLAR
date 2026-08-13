// @vitest-environment jsdom

// SupportWidget — self-guard cổng duy nhất (AC-001, AC-003, AC-005, AC-007).
// Cả 4 tổ hợp {user, pathname} phải render/không-render đúng, và "không
// render" nghĩa là KHÔNG CÓ DOM node (queryByRole trả null), không phải ẩn
// bằng CSS.
//
// Không bọc I18nProvider → useT() rơi về DEFAULT_LOCALE ("en") — chuỗi mong
// đợi trong test này vì thế là bản tiếng Anh, không phải tiếng Việt.

import { cleanup, render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";
import { SupportWidget } from "@/components/support/SupportWidget";

const mockUsePathname = vi.fn(() => "/exams");
vi.mock("next/navigation", () => ({
  usePathname: () => mockUsePathname(),
}));
// SupportWidget renders SupportWidgetDialog, which imports submitSupportTicket
// (lib/support/actions.ts) — a "use server" module that transitively imports
// "server-only" (lib/i18n/server.ts, lib/supabase/service-role.ts). This test
// only exercises SupportWidget's own render guard, not submission logic, so
// the action is mocked away rather than pulled in unmocked.
vi.mock("@/lib/support/actions", () => ({ submitSupportTicket: vi.fn() }));

const FIXTURE_USER = { id: "u1", email: "a@example.com", displayName: "AnhPhat" };
const ATTEMPT_PATHNAME = "/exams/abc/attempt/xyz";
const NORMAL_PATHNAME = "/exams";

afterEach(() => {
  cleanup();
  mockUsePathname.mockReturnValue(NORMAL_PATHNAME);
});

function triggerQuery() {
  return screen.queryByRole("button", { name: "Send feedback" });
}

describe("SupportWidget", () => {
  it("user present, normal route: renders the trigger", () => {
    mockUsePathname.mockReturnValue(NORMAL_PATHNAME);
    render(<SupportWidget user={FIXTURE_USER} />);
    expect(triggerQuery()).not.toBeNull();
  });

  it("user present, attempt route: renders nothing — no DOM node (AC-005, D1)", () => {
    mockUsePathname.mockReturnValue(ATTEMPT_PATHNAME);
    const { container } = render(<SupportWidget user={FIXTURE_USER} />);
    expect(triggerQuery()).toBeNull();
    expect(container.innerHTML).toBe("");
  });

  it("user null, normal route: renders nothing — no DOM node (AC-003)", () => {
    mockUsePathname.mockReturnValue(NORMAL_PATHNAME);
    const { container } = render(<SupportWidget user={null} />);
    expect(triggerQuery()).toBeNull();
    expect(container.innerHTML).toBe("");
  });

  it("user null, attempt route: renders nothing — both guards independently hold", () => {
    mockUsePathname.mockReturnValue(ATTEMPT_PATHNAME);
    const { container } = render(<SupportWidget user={null} />);
    expect(triggerQuery()).toBeNull();
    expect(container.innerHTML).toBe("");
  });

  it("matches nested attempt-route id shapes with dashes/uuids", () => {
    mockUsePathname.mockReturnValue("/exams/ugc-abc123/attempt/9f2c4d1e-aaaa-bbbb-cccc-000000000000");
    const { container } = render(<SupportWidget user={FIXTURE_USER} />);
    expect(container.innerHTML).toBe("");
  });

  it("does not match a route that merely starts similarly (e.g. the exam detail page)", () => {
    mockUsePathname.mockReturnValue("/exams/abc");
    render(<SupportWidget user={FIXTURE_USER} />);
    expect(triggerQuery()).not.toBeNull();
  });
});
