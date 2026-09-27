// parseProfileTab — luật whitelist duy nhất cho `?tab=` (task 44, Boundary
// Context "Consumer parse rule": so khớp CHÍNH XÁC "comments"; mọi giá trị
// khác — kể cả vắng mặt — rơi về "account", không bao giờ một trang trắng).

import { describe, expect, it } from "vitest";
import { parseProfileTab } from "@/features/solutions/lib/profileTab";

describe("parseProfileTab", () => {
  it("'comments' → tab bình luận", () => {
    expect(parseProfileTab("comments")).toBe("comments");
  });

  it("giá trị lạ → tab tài khoản, không bao giờ trắng trang", () => {
    expect(parseProfileTab("xyz")).toBe("account");
  });

  it("vắng tham số → tab tài khoản (mặc định)", () => {
    expect(parseProfileTab(undefined)).toBe("account");
  });
});
