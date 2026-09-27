// @vitest-environment jsdom

// ReputationBlock — ba huy hiệu MỞ/KHOÁ suy trực tiếp từ `publishedCount`
// (AC-087/088), không heading, và trạng thái rỗng (AC-090). `pinnedCount`
// luôn được truyền (đối xứng với `getMyReputation()`) nhưng không bao giờ
// xuất hiện trên màn hình (UI Spec `C-34` không có dòng ghim).

import { cleanup, render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it } from "vitest";
import { ReputationBlock } from "@/features/solutions/components/ReputationBlock";

afterEach(cleanup);

describe("ReputationBlock — ba huy hiệu, mở/khoá theo publishedCount", () => {
  it("publishedCount=0 → cả ba huy hiệu khoá, còn đủ 1/5/20 bài", () => {
    render(
      <ReputationBlock totalScore={0} publishedCount={0} helpfulCount={0} pinnedCount={0} />
    );

    expect(screen.getByText("còn 1 bài")).toBeDefined();
    expect(screen.getByText("còn 5 bài")).toBeDefined();
    expect(screen.getByText("còn 20 bài")).toBeDefined();
    expect(screen.queryByText("1 bài giải")).toBeNull();
  });

  it("publishedCount=5 → 'Mở đường'/'Dẫn lối' mở, 'Trụ cột' còn khoá (còn 15 bài)", () => {
    render(
      <ReputationBlock totalScore={40} publishedCount={5} helpfulCount={12} pinnedCount={0} />
    );

    expect(screen.getByText("1 bài giải")).toBeDefined();
    expect(screen.getByText("5 bài giải")).toBeDefined();
    expect(screen.getByText("còn 15 bài")).toBeDefined();
  });

  it("publishedCount=20 → cả ba huy hiệu mở", () => {
    render(
      <ReputationBlock totalScore={200} publishedCount={20} helpfulCount={30} pinnedCount={2} />
    );

    expect(screen.getByText("1 bài giải")).toBeDefined();
    expect(screen.getByText("5 bài giải")).toBeDefined();
    expect(screen.getByText("20 bài giải")).toBeDefined();
  });

  it("tier-relock: gỡ bài khiến publishedCount giảm từ 5 xuống 4 → 'Dẫn lối' khoá lại", () => {
    const { rerender } = render(
      <ReputationBlock totalScore={40} publishedCount={5} helpfulCount={12} pinnedCount={0} />
    );
    expect(screen.getByText("5 bài giải")).toBeDefined();

    rerender(
      <ReputationBlock totalScore={32} publishedCount={4} helpfulCount={10} pinnedCount={0} />
    );

    expect(screen.queryByText("5 bài giải")).toBeNull();
    expect(screen.getByText("còn 1 bài")).toBeDefined();
  });

  it("không có heading nào (test của ProfileCard cấm heading)", () => {
    render(
      <ReputationBlock totalScore={32} publishedCount={2} helpfulCount={6} pinnedCount={0} />
    );
    expect(screen.queryByRole("heading")).toBeNull();
  });
});

describe("ReputationBlock — trạng thái rỗng (AC-090)", () => {
  it("publishedCount=0 hiện 'Chưa có bài giải nào đã đăng' và tổng '0'", () => {
    render(<ReputationBlock totalScore={0} publishedCount={0} helpfulCount={0} pinnedCount={0} />);

    expect(screen.getByText("Chưa có bài giải nào đã đăng")).toBeDefined();
    expect(screen.getByText("0")).toBeDefined();
    // Dòng "k bài giải đã đăng" của trạng thái mặc định không được lẫn vào đây.
    expect(screen.queryByText(/bài giải đã đăng/)).toBeNull();
  });
});
