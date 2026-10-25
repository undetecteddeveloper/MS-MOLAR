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
// phải container test hiện tại) — dialog "Rời khỏi đề này?" không hiện ra ở
// container đang kiểm, dù cơ chế chặn vẫn chạy đúng. Luôn `unmount()` trong
// `afterEach` khi test một component dùng hook này.
//
// @category: core-functionality
// @dependency: none — real ExamPlayer (kéo theo real useLeaveGuard/useExamPlayer/
//   Breadcrumbs), không mock. submitExam KHÔNG được gọi (không bấm Nộp bài).

import { fireEvent, render, waitFor, within } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";
import type { PublicQuestion } from "@/types/question";
import { ExamPlayer } from "@/features/exams/components/ExamPlayer";
import { hintDuringAttempt } from "@/features/exams/tutorActions";
import { EntitlementProvider } from "@/lib/billing/entitlement";
import { FREE_FALLBACK, type Entitlement } from "@/lib/billing/types";
// TD-023: nội dung câu hỏi render ở SERVER. Dùng đúng hàm render thật để test
// không xanh trong khi cặp server/client ngoài đời đã lệch.
import { renderQuestionNodes } from "@/features/exams/components/questionNodes";

// submitExam kéo theo lib/supabase/server (server-only) — không gọi trong test
// này (không bấm Nộp bài) nên mock để tránh lỗi import "server-only" dưới jsdom.
vi.mock("@/features/exams/actions", () => ({
  submitExam: vi.fn(),
}));

// Nút gợi ý (ExplainStepAffordance, 2026-09-13) kéo theo tutorActions — cũng
// server-only; không bấm trong test này nên mock tối thiểu như submitExam.
vi.mock("@/features/exams/tutorActions", () => ({
  hintDuringAttempt: vi.fn(),
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
  it("mốc 'Kho đề' trỏ /exams, mốc cuối là tên đề hiện tại (không phải link)", () => {
    const { container } = renderPlayer();

    const link = within(container).getByRole("link", { name: "Kho đề" });
    expect(link.getAttribute("href")).toBe("/exams");
    expect(within(container).getAllByText("Đề kiểm tra giữa kỳ").length).toBeGreaterThan(0);
  });

  it("là thẻ <a> thật (không phải button) — để interceptor useLeaveGuard bắt được", () => {
    const { container } = renderPlayer();

    const link = within(container).getByRole("link", { name: "Kho đề" });
    expect(link.tagName).toBe("A");
  });

  it("bấm vào KHÔNG rời trang thẳng — useLeaveGuard chặn và hiện modal xác nhận", () => {
    const { container } = renderPlayer();

    const link = within(container).getByRole("link", { name: "Kho đề" });
    fireEvent.click(link);

    // Modal "Rời khỏi đề này?" (LeaveExamDialog) phải xuất hiện — bằng chứng
    // interceptor CAPTURE PHASE của useLeaveGuard đã chặn cú click này lại,
    // thay vì để next/link điều hướng thẳng.
    expect(within(container).getByRole("dialog")).toBeTruthy();
    expect(within(container).getByText("Rời khỏi đề này?")).toBeTruthy();
  });
});

// Dòng báo "Còn N/M lượt gợi ý" (AC-042, người dùng chọn 2026-10-25). Số lấy từ
// kết quả server trả kèm gợi ý, KHÔNG từ entitlement lúc tải trang — entitlement
// ở dưới cố ý mang 0/5 để một implementation đọc nhầm nguồn ra "Còn 5/5" và đỏ.
describe("ExamPlayer — dòng báo số lượt gợi ý còn lại", () => {
  const TWO_QUESTIONS: PublicQuestion[] = [
    QUESTIONS[0],
    { ...QUESTIONS[0], id: "q2", content: "Câu 2?" },
  ];
  const RESETS_AT = "2026-11-24T02:00:00.000Z"; // 09:00 giờ VN ⇒ ngày 24/11/2026
  const ENTITLEMENT: Entitlement = {
    ...FREE_FALLBACK,
    tutor: { state: "known", used: 0, limit: 5, resetsAt: RESETS_AT },
  };

  function renderWithEntitlement() {
    const result = render(
      <EntitlementProvider value={ENTITLEMENT}>
        <ExamPlayer
          attemptId="attempt-1"
          examTitle="Đề kiểm tra giữa kỳ"
          durationMinutes={30}
          questions={TWO_QUESTIONS}
          questionNodes={renderQuestionNodes(TWO_QUESTIONS)}
        />
      </EntitlementProvider>
    );
    currentUnmount = result.unmount;
    return result;
  }

  /** Vùng aria-live của dòng báo — thứ trình đọc màn hình đọc. */
  function announced(container: HTMLElement) {
    return within(container)
      .getAllByRole("status")
      .map((el) => el.textContent)
      .join("|");
  }

  it("chưa dùng gợi ý thì không báo gì", () => {
    const { container } = renderWithEntitlement();
    expect(announced(container)).not.toContain("lượt gợi ý");
  });

  it("dùng một lượt → 'Còn 1/5 lượt gợi ý' theo số server trả, không kèm ngày", async () => {
    vi.mocked(hintDuringAttempt).mockResolvedValue({
      hint: "gợi ý",
      quota: { used: 4, limit: 5, resetsAt: RESETS_AT },
    });
    const { container } = renderWithEntitlement();

    fireEvent.click(within(container).getByRole("button", { name: "Gợi ý cho câu này" }));

    await waitFor(() => expect(announced(container)).toContain("Còn 1/5 lượt gợi ý"));
    expect(announced(container)).not.toContain("24/11/2026");
  });

  it("dùng lượt cuối → báo hết lượt kèm ngày có lại, câu kế tiếp hiện 'hết lượt' ngay", async () => {
    vi.mocked(hintDuringAttempt).mockResolvedValue({
      hint: "gợi ý",
      quota: { used: 5, limit: 5, resetsAt: RESETS_AT },
    });
    const { container } = renderWithEntitlement();

    fireEvent.click(within(container).getByRole("button", { name: "Gợi ý cho câu này" }));
    await waitFor(() =>
      expect(announced(container)).toContain("Hết lượt gợi ý · có lại ngày 24/11/2026")
    );

    // Sang câu 2: entitlement của layout vẫn ghi 0/5, nhưng màn đã biết hết lượt.
    fireEvent.click(within(container).getAllByRole("button", { name: "Câu sau" })[0]);
    expect(within(container).queryByRole("button", { name: "Gợi ý cho câu này" })).toBeNull();
    expect(within(container).getByText("Bạn đã dùng hết lượt gia sư của kỳ này.")).toBeTruthy();
  });
});
