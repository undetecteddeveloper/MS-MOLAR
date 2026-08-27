// @vitest-environment jsdom

// ExamPlayer — về danh sách đề qua <Breadcrumbs> (tái dùng component đã có ở
// exams/[id]/page.tsx, không dựng link riêng).
//
// Trước đây không có element nào TRÊN CHÍNH màn làm bài để quay lại /exams —
// chỉ có navbar/BottomNav global. <Breadcrumbs> render <Link> thật (thẻ <a>)
// nên interceptor của useLeaveGuard (hooks/useLeaveGuard.ts) bắt được y hệt
// mọi link nội bộ khác — bấm vào phải hiện modal xác nhận rời trang, không rời
// thẳng và mất bài đang làm dở.
//
// LƯU Ý RIÊNG cho file này: useLeaveGuard gắn một listener CLICK thật lên
// `document` (không phải chỉ trong cây React) — vitest.config.ts của dự án
// KHÔNG bật auto-cleanup của RTL, nên nếu không `unmount()` sau mỗi test thì
// ExamPlayer của test TRƯỚC vẫn còn sống, listener của nó vẫn gắn trên
// document, và sẽ giành lấy click của test SAU (bắt trước, gọi
// preventDefault/stopPropagation, rồi set state lên đúng CÂY CŨ chứ không
// phải container test hiện tại) — dialog "Leave this exam?" không hiện ra ở
// container đang kiểm, dù cơ chế chặn vẫn chạy đúng. Luôn `unmount()` trong
// `afterEach` khi test một component dùng hook này.
//
// @category: core-functionality
// @dependency: none — real ExamPlayer (kéo theo real useLeaveGuard/useExamPlayer/
//   Breadcrumbs), không mock. submitExam KHÔNG được gọi (không bấm Nộp bài).

import { fireEvent, render, within } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";
import type { PublicQuestion } from "@/types/question";
import { ExamPlayer } from "../ExamPlayer";
// TD-023: nội dung câu hỏi render ở SERVER. Dùng đúng hàm render thật để test
// không xanh trong khi cặp server/client ngoài đời đã lệch.
import { renderQuestionNodes } from "../questionNodes";

// submitExam kéo theo lib/supabase/server (server-only) — không gọi trong test
// này (không bấm Nộp bài) nên mock để tránh lỗi import "server-only" dưới jsdom.
vi.mock("@/app/(layer2)/actions", () => ({
  submitExam: vi.fn(),
}));

// useLeaveGuard gọi useRouter() — component test (không phải Next test runner)
// không có App Router thật mounted. Chỉ cần push (dùng khi confirmLeave, không
// gọi trong test này) nên mock tối thiểu.
vi.mock("next/navigation", () => ({
  useRouter: () => ({ push: vi.fn() }),
}));

const QUESTIONS: PublicQuestion[] = [
  {
    id: "q1",
    content: "Câu 1?",
    choices: [
      { id: "A", text: "0" },
      { id: "B", text: "1" },
    ],
    subject: "Math",
    grade: 10,
    topic: "Đại số",
    questionType: "mcq",
  },
];

let currentUnmount: (() => void) | null = null;

function renderPlayer() {
  const result = render(
    <ExamPlayer
      attemptId="attempt-1"
      examTitle="Đề kiểm tra giữa kỳ"
      durationMinutes={30}
      questions={QUESTIONS}
      questionNodes={renderQuestionNodes(QUESTIONS)}
    />
  );
  currentUnmount = result.unmount;
  return result;
}

afterEach(() => {
  currentUnmount?.();
  currentUnmount = null;
});

describe("ExamPlayer — về danh sách đề (Breadcrumbs)", () => {
  it("mốc 'Exams' trỏ /exams, mốc cuối là tên đề hiện tại (không phải link)", () => {
    const { container } = renderPlayer();

    const link = within(container).getByRole("link", { name: "Exams" });
    expect(link.getAttribute("href")).toBe("/exams");
    expect(within(container).getAllByText("Đề kiểm tra giữa kỳ").length).toBeGreaterThan(0);
  });

  it("là thẻ <a> thật (không phải button) — để interceptor useLeaveGuard bắt được", () => {
    const { container } = renderPlayer();

    const link = within(container).getByRole("link", { name: "Exams" });
    expect(link.tagName).toBe("A");
  });

  it("bấm vào KHÔNG rời trang thẳng — useLeaveGuard chặn và hiện modal xác nhận", () => {
    const { container } = renderPlayer();

    const link = within(container).getByRole("link", { name: "Exams" });
    fireEvent.click(link);

    // Modal "Leave this exam?" (LeaveExamDialog) phải xuất hiện — bằng chứng
    // interceptor CAPTURE PHASE của useLeaveGuard đã chặn cú click này lại,
    // thay vì để next/link điều hướng thẳng.
    expect(within(container).getByRole("dialog")).toBeTruthy();
    expect(within(container).getByText("Leave this exam?")).toBeTruthy();
  });
});
