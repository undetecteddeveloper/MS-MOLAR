// @vitest-environment jsdom

// /about — khối "Vì sao tên MS-MOLAR?": đủ năm cụm chữ cái và nghĩa từng chữ,
// khớp cụm viết tắt engineer chốt 2026-10-02.

import { cleanup, render, screen, within } from "@testing-library/react";
import { afterEach, describe, expect, it } from "vitest";
import AboutPage from "@/app/(billing)/about/page";

afterEach(cleanup);

describe("/about — tên MS-MOLAR", () => {
  it("có mục 'Vì sao tên MS-MOLAR?' với đủ MS · M · O·L · A · R và cụm viết tắt đầy đủ", async () => {
    render(await AboutPage());

    const section = screen.getByRole("region", { name: "Vì sao tên MS-MOLAR?" });
    expect(
      within(section).getByText(
        /Multi-Subject, Multi-level Online Learning, Analytics & Repository/
      )
    ).toBeTruthy();

    const items = within(section).getAllByRole("listitem");
    expect(items.map((li) => li.textContent)).toEqual([
      expect.stringMatching(/^MSMulti-Subject/),
      expect.stringMatching(/^MMulti-level/),
      expect.stringMatching(/^O · LOnline Learning/),
      expect.stringMatching(/^AAnalytics/),
      expect.stringMatching(/^RRepository/),
    ]);
    expect(within(section).getAllByText(/dấu chân kĩ thuật số/).length).toBeGreaterThan(0);
  });

  it("vẫn giữ khối liên hệ (chủ sở hữu, email, điện thoại)", async () => {
    render(await AboutPage());

    expect(screen.getByText("Chủ sở hữu website")).toBeTruthy();
    expect(screen.getByRole("link", { name: /@/ }).getAttribute("href")).toMatch(/^mailto:/);
  });
});
