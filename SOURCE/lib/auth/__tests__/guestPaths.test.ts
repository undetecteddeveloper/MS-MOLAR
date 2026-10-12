// guestPaths — danh sách trang khách được vào + chuẩn hoá `?next=`.
// Open-redirect là rủi ro chính của tính năng (brief T7), nên phần lớn test là
// đường tấn công, không phải đường vui.

import { describe, expect, it } from "vitest";
import {
  DEFAULT_POST_AUTH_PATH,
  GUEST_READABLE_EXACT_PATHS,
  isGuestReadablePath,
  postAuthPath,
  safeNextPath,
} from "../guestPaths";

describe("isGuestReadablePath", () => {
  it("nhận đúng năm đích của khách", () => {
    expect(GUEST_READABLE_EXACT_PATHS).toEqual(["/exams", "/history", "/me/dashboard", "/upload"]);
    for (const p of ["/exams", "/history", "/me/dashboard", "/upload", "/exams/exam-toan-10"]) {
      expect(isGuestReadablePath(p), p).toBe(true);
    }
  });

  it.each([
    "/",
    "/exams-evil",
    "/exams/",
    "/exams/x/attempt/y",
    "/exams/x/rate",
    "/exams/x/solutions",
    "/exams/x/attempt/y/result",
    "/me",
    "/me/exams",
    "/me/exams/abc",
    "/profile",
    "/admin",
    "/upload/extra",
    "/history/extra",
    "/exams/../admin",
    "/exams/%2e%2e",
    "/api/payments/payos/webhook",
  ])("từ chối %s", (p) => {
    expect(isGuestReadablePath(p)).toBe(false);
  });
});

describe("safeNextPath", () => {
  it.each([
    "/exams",
    "/exams?subject=Math&page=2",
    "/exams?q=%C4%91%E1%BB%81+to%C3%A1n",
    "/exams/exam-toan-10",
    "/exams/exam-toan-10?from=hot",
    "/history?scoreMin=5",
    "/me/dashboard",
    "/upload",
  ])("giữ nguyên %s", (p) => {
    expect(safeNextPath(p)).toBe(p);
  });

  it.each([
    ["null", null],
    ["undefined", undefined],
    ["rỗng", ""],
    ["thiếu dấu / đầu", "exams"],
    ["URL tuyệt đối", "https://evil.example/exams"],
    ["cùng giao thức", "//evil.example"],
    ["backslash", "/\\evil.example"],
    ["mã hoá //", "/%2F%2Fevil.example"],
    ["javascript:", "javascript:alert(1)"],
    ["data:", "data:text/html,<script>alert(1)</script>"],
    ["ngoài danh sách", "/profile"],
    ["trang sau đăng nhập", "/exams/x/attempt/y"],
    ["đi lùi thư mục", "/exams/../admin"],
    ["fragment", "/exams#evil"],
    ["query chứa /", "/exams?next=//evil.example"],
    ["query chứa :", "/exams?u=https:evil"],
    ["query chứa khoảng trắng", "/exams?q=a b"],
    ["query chứa <", "/exams?q=<script>"],
    ["xuống dòng", "/exams\n/evil"],
    ["quá dài", `/exams?q=${"a".repeat(600)}`],
  ] as const)("từ chối: %s", (_name, raw) => {
    expect(safeNextPath(raw)).toBeNull();
  });
});

describe("postAuthPath", () => {
  it("next hợp lệ → dùng nó", () => {
    expect(postAuthPath("/history")).toBe("/history");
  });

  it("next lạ hoặc thiếu → /exams (hành vi cũ)", () => {
    expect(DEFAULT_POST_AUTH_PATH).toBe("/exams");
    expect(postAuthPath(null)).toBe("/exams");
    expect(postAuthPath("//evil.example")).toBe("/exams");
    expect(postAuthPath("/reset-password")).toBe("/exams");
  });
});
