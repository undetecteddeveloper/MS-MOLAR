// @vitest-environment jsdom

// AuthorIdentity (C-07) — UI Spec § Component: AuthorIdentity; frontend DD §
// Main Components. Ca chính: switch trên `identity.kind` không có nhánh nào
// đọc được tên/ảnh của một danh tính ẩn danh (AC-039, AC-105).

import { cleanup, render, screen } from "@testing-library/react";
import { afterEach, beforeAll, describe, expect, it } from "vitest";
import { AuthorIdentity } from "@/features/solutions/components/AuthorIdentity";

const STORAGE_ORIGIN = "https://test-project.supabase.co";
const AVATAR_URL = `${STORAGE_ORIGIN}/storage/v1/object/sign/avatars/u1/a.png?token=x`;

beforeAll(() => {
  process.env.NEXT_PUBLIC_SUPABASE_URL = STORAGE_ORIGIN;
});

afterEach(cleanup);

describe("AuthorIdentity — named", () => {
  it("hiện Avatar (name + avatarUrl) và tên hiển thị", () => {
    const { container } = render(
      <AuthorIdentity identity={{ kind: "named", displayName: "Nguyễn Văn A", avatarUrl: AVATAR_URL }} size={32} />
    );

    expect(screen.getByText("Nguyễn Văn A")).toBeTruthy();
    const img = container.querySelector("img");
    expect(img).not.toBeNull();
    expect(img?.getAttribute("src")).toBe(AVATAR_URL);
  });

  it("không có avatarUrl: vẫn hiện tên, không có <img>", () => {
    const { container } = render(<AuthorIdentity identity={{ kind: "named", displayName: "Trần Thị B" }} size={32} />);

    expect(screen.getByText("Trần Thị B")).toBeTruthy();
    expect(container.querySelector("img")).toBeNull();
  });
});

describe("AuthorIdentity — anonymous (AC-039, AC-105)", () => {
  it("hiện 'Ẩn danh', không <img>, không tên nào của người khác", () => {
    const { container } = render(<AuthorIdentity identity={{ kind: "anonymous" }} size={32} />);

    expect(screen.getByText("Ẩn danh")).toBeTruthy();
    expect(container.querySelector("img")).toBeNull();
    expect(screen.queryByText(/Nguyễn|Trần/)).toBeNull();
  });

  it("size=28 (hàng bình luận) vẫn hiện 'Ẩn danh'", () => {
    render(<AuthorIdentity identity={{ kind: "anonymous" }} size={28} />);
    expect(screen.getByText("Ẩn danh")).toBeTruthy();
  });
});
