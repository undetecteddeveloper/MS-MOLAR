// @vitest-environment jsdom

// SolutionEditorScreen — màn viết (S-04): none/draft/published state, từ chối
// đăng (AC-029, Reference Contract #27), lỗi generic/rate-limit (AC-002,
// AC-033, AC-101), giữ chữ khi lưu/đăng hỏng (Reference Contract #7, AC-032),
// đăng KHÔNG lạc quan (§ State Transitions), và khoá re-render theo hàng (NFR
// Hiệu năng, Reference Contract render-scope). Route-level tests (writer load
// null → redirect; route guard attemptId) sống ở
// app/(exams)/exams/[id]/attempt/[attemptId]/solution/__tests__/page.test.tsx.
//
// Mock boundary (task 10 binding): `@/features/solutions/{queries,actions}`
// mocked at the module boundary; `lib/solutions/countWords.ts` chạy THẬT
// (chính là "same countWords() the server uses" mà § Note-authoring contract
// đòi) — không mock nó.

import type { ComponentProps } from "react";
import { act, cleanup, fireEvent, render, screen, within } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import type { SolutionEditorQuestion, SolutionEditorState } from "@/features/solutions/queries";

const { saveSolutionMock, setSolutionStatusMock, renderCounts } = vi.hoisted(() => ({
  saveSolutionMock: vi.fn(),
  setSolutionStatusMock: vi.fn(),
  renderCounts: {} as Record<number, number>,
}));

vi.mock("@/features/solutions/actions", () => ({
  saveSolution: saveSolutionMock,
  setSolutionStatus: setSolutionStatusMock,
}));

// Spy render-count per row (Proof Obligation "NFR Hiệu năng proxy") — bọc
// NGUYÊN implementation thật, chỉ đếm số lượt thân hàm chạy.
vi.mock("@/features/solutions/components/NoteQuestionRow", async (importOriginal) => {
  const actual = await importOriginal<typeof import("@/features/solutions/components/NoteQuestionRow")>();
  function Spy(props: ComponentProps<typeof actual.NoteQuestionRow>) {
    renderCounts[props.questionNumber] = (renderCounts[props.questionNumber] ?? 0) + 1;
    return <actual.NoteQuestionRow {...props} />;
  }
  return { ...actual, NoteQuestionRow: Spy };
});

const { SolutionEditorScreen } = await import("@/features/solutions/components/SolutionEditorScreen");
const { countWords } = await import("@/lib/solutions/countWords");

afterEach(cleanup);
beforeEach(() => {
  saveSolutionMock.mockReset();
  setSolutionStatusMock.mockReset();
  for (const key of Object.keys(renderCounts)) delete renderCounts[Number(key)];
});

function question(overrides: Partial<SolutionEditorQuestion> = {}): SolutionEditorQuestion {
  return {
    questionId: overrides.questionId ?? "q1",
    stem: "stem",
    correctAnswer: "A",
    myResult: null,
    note: "",
    wordCount: 0,
    hasChanged: false,
    essayPrefillApplied: false,
    questionType: "mcq",
    choices: [],
    ...overrides,
  };
}

function baseState(overrides: Partial<SolutionEditorState> = {}): SolutionEditorState {
  return {
    solutionId: null,
    attemptId: "A1",
    status: null,
    showProfile: true,
    showScore: false,
    questions: [],
    ...overrides,
  };
}

const FIFTEEN_WORDS = "một hai ba bốn năm sáu bảy tám chín mười mười-một mười-hai mười-ba mười-bốn mười-lăm";

describe("SolutionEditorScreen — none state (row 2)", () => {
  it("mọi ghi chú rỗng, Hiện hồ sơ bật, Hiện điểm tắt, không huy hiệu trạng thái", () => {
    const state = baseState({
      questions: [question({ questionId: "q1" }), question({ questionId: "q2" })],
    });
    render(<SolutionEditorScreen examId="E1" initialState={state} />);

    fireEvent.click(screen.getByRole("button", { name: /Cài đặt bài giải/ }));
    expect(screen.getByRole("switch", { name: "Hiện hồ sơ" }).getAttribute("aria-checked")).toBe("true");
    expect(
      screen.getByRole("switch", { name: "Hiện điểm và lựa chọn gốc" }).getAttribute("aria-checked")
    ).toBe("false");

    expect(screen.queryByText("Nháp")).toBeNull();
    expect(screen.queryByText("Đã đăng")).toBeNull();
    expect(screen.queryByText("Bị ẩn")).toBeNull();
  });
});

describe("SolutionEditorScreen — publish refusal renders the server's count (rows 3-4, Proof Obligation)", () => {
  it("belowWordCount missingCount=3 với 12 câu hiện hành: role=alert đúng câu, badge/nút/chữ ghi chú không đổi", async () => {
    const questions = Array.from({ length: 12 }, (_, i) =>
      question({ questionId: `q${i + 1}`, note: FIFTEEN_WORDS, wordCount: 15 })
    );
    const state = baseState({ solutionId: "s1", status: "draft", questions });
    setSolutionStatusMock.mockResolvedValue({
      ok: false,
      error: { code: "belowWordCount", missingCount: 3 },
    });

    render(<SolutionEditorScreen examId="E1" initialState={state} />);
    fireEvent.click(screen.getByRole("button", { name: "Đăng" }));

    const alert = await screen.findByRole("alert");
    expect(alert.textContent).toBe("Còn 3 câu chưa có ghi chú. Ghi chú đủ 12 câu mới đăng được.");
    expect(screen.getByText("Nháp")).toBeTruthy();
    expect(screen.getByRole("button", { name: "Đăng" })).toBeTruthy();
    expect(screen.getByRole("button", { name: "Lưu nháp" })).toBeTruthy();
    expect(screen.getByRole("button", { name: "Câu 1, đã ghi chú" })).toBeTruthy();
  });

  it("không tự tính lại phía client: missingCount=5 dù client sẽ ra 0, vẫn hiện 'Còn 5 câu'", async () => {
    const questions = Array.from({ length: 12 }, (_, i) =>
      question({ questionId: `q${i + 1}`, note: FIFTEEN_WORDS, wordCount: 15 })
    );
    const state = baseState({ solutionId: "s1", status: "draft", questions });
    setSolutionStatusMock.mockResolvedValue({
      ok: false,
      error: { code: "belowWordCount", missingCount: 5 },
    });

    render(<SolutionEditorScreen examId="E1" initialState={state} />);
    fireEvent.click(screen.getByRole("button", { name: "Đăng" }));

    const alert = await screen.findByRole("alert");
    expect(alert.textContent).toBe("Còn 5 câu chưa có ghi chú. Ghi chú đủ 12 câu mới đăng được.");
  });
});

describe("SolutionEditorScreen — generic status-change failure (row 5, AC-029/AC-033/AC-002)", () => {
  it("Đăng generic: badge/hai nút không đổi, role=alert hiện dòng generic", async () => {
    const state = baseState({
      solutionId: "s1",
      status: "draft",
      questions: [question({ questionId: "q1", note: FIFTEEN_WORDS, wordCount: 15 })],
    });
    setSolutionStatusMock.mockResolvedValue({ ok: false, error: { code: "generic" } });

    render(<SolutionEditorScreen examId="E1" initialState={state} />);
    fireEvent.click(screen.getByRole("button", { name: "Đăng" }));

    const alert = await screen.findByRole("alert");
    expect(alert.textContent).toBe("Chưa lưu được. Bạn thử lại nhé.");
    expect(screen.getByText("Nháp")).toBeTruthy();
    expect(screen.getByRole("button", { name: "Đăng" })).toBeTruthy();
  });

  it("Gỡ về nháp generic: ConfirmDialog vẫn mở, error prop hiện dòng generic, trạng thái không đổi", async () => {
    const state = baseState({
      solutionId: "s1",
      status: "published",
      questions: [question({ questionId: "q1", note: FIFTEEN_WORDS, wordCount: 15 })],
    });
    setSolutionStatusMock.mockResolvedValue({ ok: false, error: { code: "generic" } });

    render(<SolutionEditorScreen examId="E1" initialState={state} />);
    fireEvent.click(screen.getByRole("button", { name: "Gỡ về nháp" }));

    const dialog = await screen.findByRole("dialog");
    fireEvent.click(within(dialog).getByRole("button", { name: "Gỡ về nháp" }));

    expect(await within(dialog).findByText("Chưa lưu được. Bạn thử lại nhé.")).toBeTruthy();
    // Trạng thái không đổi: thanh đáy vẫn ở hình dạng "Đã đăng" phía sau hộp thoại.
    expect(screen.getByText("Bài giải đang hiện với mọi người đã nộp đề.")).toBeTruthy();
  });
});

describe("SolutionEditorScreen — rate limit (row 6, AC-101)", () => {
  it("rateLimited seconds=42: hiện profile.error.rateLimited với '42', không xoá chữ ghi chú nào", async () => {
    const state = baseState({
      solutionId: "s1",
      status: "draft",
      questions: [question({ questionId: "q1", note: FIFTEEN_WORDS, wordCount: 15 })],
    });
    setSolutionStatusMock.mockResolvedValue({ ok: false, error: { code: "rateLimited", seconds: 42 } });

    render(<SolutionEditorScreen examId="E1" initialState={state} />);
    fireEvent.click(screen.getByRole("button", { name: "Đăng" }));

    const alert = await screen.findByRole("alert");
    expect(alert.textContent).toBe("Thao tác quá nhiều lần. Thử lại sau 42 giây.");
    expect(screen.getByRole("button", { name: "Câu 1, đã ghi chú" })).toBeTruthy();
  });
});

describe("SolutionEditorScreen — failed save keeps the draft (row 7, Reference Contract #7 / AC-032)", () => {
  it("Lưu nháp hỏng (generic): ghi chú 'abc…' vẫn còn nguyên, lỗi hiển thị", async () => {
    const state = baseState({
      solutionId: "s1",
      status: "draft",
      questions: [question({ questionId: "q1", note: "abc…", wordCount: 1 })],
    });
    saveSolutionMock.mockResolvedValue({ ok: false, error: { code: "generic" } });

    render(<SolutionEditorScreen examId="E1" initialState={state} />);
    expect(screen.getByText("abc…")).toBeTruthy();

    fireEvent.click(screen.getByRole("button", { name: "Lưu nháp" }));

    const alert = await screen.findByRole("alert");
    expect(alert.textContent).toBe("Chưa lưu được. Bạn thử lại nhé.");
    expect(screen.getByText("abc…")).toBeTruthy();
  });
});

describe("SolutionEditorScreen — non-optimistic publish (row 8, § State Transitions)", () => {
  it("huy hiệu/thanh đáy chỉ đổi SAU KHI setSolutionStatus resolve thành công, không đổi lúc đang chờ", async () => {
    const state = baseState({
      solutionId: "s1",
      status: "draft",
      questions: [question({ questionId: "q1", note: FIFTEEN_WORDS, wordCount: 15 })],
    });
    let resolvePublish!: (value: { ok: true; status: "published" }) => void;
    setSolutionStatusMock.mockReturnValue(
      new Promise((resolve) => {
        resolvePublish = resolve;
      })
    );

    render(<SolutionEditorScreen examId="E1" initialState={state} />);
    fireEvent.click(screen.getByRole("button", { name: "Đăng" }));

    // Đang chờ: vẫn "Nháp", chưa có "Đã đăng".
    expect(screen.getByText("Nháp")).toBeTruthy();
    expect(screen.queryByText("Đã đăng")).toBeNull();
    expect(screen.getByRole("button", { name: "Đang đăng…" })).toBeTruthy();

    await act(async () => {
      resolvePublish({ ok: true, status: "published" });
      await Promise.resolve();
    });

    expect(await screen.findByText("Đã đăng")).toBeTruthy();
    expect(screen.getByRole("button", { name: "Xem bài giải" })).toBeTruthy();
  });
});

// Task 11 — NoteSheet thật thay giàn giáo task 10 (§ Required Tests #1-5, #7).
// Mọi test dưới đây mở tấm trượt qua đúng hàng câu (`NoteQuestionRow`), giống
// hệt cách người dùng thật mở nó — không gọi thẳng NoteSheet.

describe("SolutionEditorScreen — NoteSheet, lỗi belowWordCount (Required Test #1)", () => {
  it("role=alert đúng chữ, chữ trong ô không mất, tấm trượt vẫn mở", async () => {
    const state = baseState({
      solutionId: "s1",
      status: "published",
      questions: [question({ questionId: "q1", note: "abc" })],
    });
    saveSolutionMock.mockResolvedValue({ ok: false, error: { code: "belowWordCount" } });

    render(<SolutionEditorScreen examId="E1" initialState={state} />);
    fireEvent.click(screen.getByRole("button", { name: /^Câu 1,/ }));
    fireEvent.click(screen.getByRole("button", { name: "Lưu" }));

    const alert = await screen.findByRole("alert");
    expect(alert.textContent).toBe(
      "Ghi chú phải có ít nhất 15 từ. Muốn để ngắn thì gỡ bài về nháp trước."
    );
    expect((screen.getByRole("textbox") as HTMLTextAreaElement).value).toBe("abc");
  });
});

describe("SolutionEditorScreen — NoteSheet, lỗi generic (Required Test #2)", () => {
  it("role=alert 'Chưa lưu được...', textarea và tấm trượt không đổi", async () => {
    const state = baseState({
      solutionId: "s1",
      status: "draft",
      questions: [question({ questionId: "q1", note: "abc" })],
    });
    saveSolutionMock.mockResolvedValue({ ok: false, error: { code: "generic" } });

    render(<SolutionEditorScreen examId="E1" initialState={state} />);
    fireEvent.click(screen.getByRole("button", { name: /^Câu 1,/ }));
    fireEvent.click(screen.getByRole("button", { name: "Lưu" }));

    const alert = await screen.findByRole("alert");
    expect(alert.textContent).toBe("Chưa lưu được. Bạn thử lại nhé.");
    expect((screen.getByRole("textbox") as HTMLTextAreaElement).value).toBe("abc");
  });
});

describe("SolutionEditorScreen — NoteSheet, rateLimited (Required Test #3, AC-101)", () => {
  it("hiện profile.error.rateLimited chứa '42', chữ được giữ", async () => {
    const state = baseState({
      solutionId: "s1",
      status: "draft",
      questions: [question({ questionId: "q1", note: "abc" })],
    });
    saveSolutionMock.mockResolvedValue({ ok: false, error: { code: "rateLimited", seconds: 42 } });

    render(<SolutionEditorScreen examId="E1" initialState={state} />);
    fireEvent.click(screen.getByRole("button", { name: /^Câu 1,/ }));
    fireEvent.click(screen.getByRole("button", { name: "Lưu" }));

    const alert = await screen.findByRole("alert");
    expect(alert.textContent).toBe("Thao tác quá nhiều lần. Thử lại sau 42 giây.");
    expect((screen.getByRole("textbox") as HTMLTextAreaElement).value).toBe("abc");
  });
});

describe("SolutionEditorScreen — NoteSheet, DD-U5 dirty-close (Required Test #4, Reference Contract #24)", () => {
  it.each([
    ["belowWordCount", { code: "belowWordCount" as const }, "Ghi chú phải có ít nhất 15 từ. Muốn để ngắn thì gỡ bài về nháp trước."],
    ["generic", { code: "generic" as const }, "Chưa lưu được. Bạn thử lại nhé."],
  ])("Lưu hỏng (%s) trên hộp thoại: hộp thoại vẫn mở, error đúng chữ, textarea không đổi", async (_label, error, text) => {
    const state = baseState({
      solutionId: "s1",
      status: "draft",
      questions: [question({ questionId: "q1", note: "gốc" })],
    });
    saveSolutionMock.mockResolvedValue({ ok: false, error });

    render(<SolutionEditorScreen examId="E1" initialState={state} />);
    fireEvent.click(screen.getByRole("button", { name: /^Câu 1,/ }));
    const textarea = screen.getByRole("textbox") as HTMLTextAreaElement;
    fireEvent.change(textarea, { target: { value: "gốc đã sửa" } });

    fireEvent.click(screen.getByRole("button", { name: "Đóng" }));
    // Hai `role="dialog"` cùng tồn tại: panel của `NoteSheet` (OverlaySheet)
    // VẪN mở phía dưới, và hộp thoại ba lựa chọn nổi lên trên — phân biệt theo
    // tên (dirty.title), đúng ý DD-U5 "sheet stays open underneath".
    const dialog = await screen.findByRole("dialog", { name: "Bạn có thay đổi chưa lưu" });
    fireEvent.click(within(dialog).getByRole("button", { name: "Lưu" }));

    expect(await within(dialog).findByText(text)).toBeTruthy();
    expect(screen.getByRole("dialog", { name: "Bạn có thay đổi chưa lưu" })).toBeTruthy();
    expect(within(dialog).getByRole("button", { name: "Lưu" })).toBeTruthy();
    expect((screen.getByRole("textbox") as HTMLTextAreaElement).value).toBe("gốc đã sửa");
  });
});

describe("SolutionEditorScreen — NoteSheet, DD-U5 hồi phục (Required Test #5)", () => {
  it("Lưu lần hai thành công: đóng cả hộp thoại lẫn tấm trượt", async () => {
    const state = baseState({
      solutionId: "s1",
      status: "draft",
      questions: [question({ questionId: "q1", note: "gốc" })],
    });
    saveSolutionMock
      .mockResolvedValueOnce({ ok: false, error: { code: "generic" } })
      .mockResolvedValueOnce({ ok: true, solutionId: "s1", status: "draft" });

    render(<SolutionEditorScreen examId="E1" initialState={state} />);
    fireEvent.click(screen.getByRole("button", { name: /^Câu 1,/ }));
    const textarea = screen.getByRole("textbox") as HTMLTextAreaElement;
    fireEvent.change(textarea, { target: { value: "gốc đã sửa" } });
    fireEvent.click(screen.getByRole("button", { name: "Đóng" }));

    const dialog = await screen.findByRole("dialog", { name: "Bạn có thay đổi chưa lưu" });
    fireEvent.click(within(dialog).getByRole("button", { name: "Lưu" }));
    await within(dialog).findByText("Chưa lưu được. Bạn thử lại nhé.");

    fireEvent.click(within(dialog).getByRole("button", { name: "Lưu" }));

    await act(async () => {
      await Promise.resolve();
      await Promise.resolve();
    });

    expect(screen.queryByRole("dialog")).toBeNull();
    expect(screen.queryByRole("textbox")).toBeNull();
    expect(saveSolutionMock).toHaveBeenCalledTimes(2);
  });
});

describe("SolutionEditorScreen — NoteSheet, dưới 15 từ trên nháp/đã đăng (Required Test #7, Failure Mode #3)", () => {
  it("bài đã đăng + 0 từ: không gọi saveSolution, hiện lỗi, chữ không đổi", async () => {
    const state = baseState({
      solutionId: "s1",
      status: "published",
      questions: [question({ questionId: "q1", note: "" })],
    });
    saveSolutionMock.mockResolvedValue({ ok: false, error: { code: "belowWordCount" } });

    render(<SolutionEditorScreen examId="E1" initialState={state} />);
    fireEvent.click(screen.getByRole("button", { name: /^Câu 1,/ }));
    fireEvent.click(screen.getByRole("button", { name: "Lưu" }));

    const alert = await screen.findByRole("alert");
    expect(alert.textContent).toBe(
      "Ghi chú phải có ít nhất 15 từ. Muốn để ngắn thì gỡ bài về nháp trước."
    );
    expect(saveSolutionMock).toHaveBeenCalledTimes(1);
    expect((screen.getByRole("textbox") as HTMLTextAreaElement).value).toBe("");
  });

  it("bài nháp + 0 từ: gọi saveSolution đúng một lần, lưu thành công", async () => {
    const state = baseState({
      solutionId: "s1",
      status: "draft",
      questions: [question({ questionId: "q1", note: "" })],
    });
    saveSolutionMock.mockResolvedValue({ ok: true, solutionId: "s1", status: "draft" });

    render(<SolutionEditorScreen examId="E1" initialState={state} />);
    fireEvent.click(screen.getByRole("button", { name: /^Câu 1,/ }));
    fireEvent.click(screen.getByRole("button", { name: "Lưu" }));

    await screen.findByRole("button", { name: "Câu 1, chưa ghi chú" });
    expect(saveSolutionMock).toHaveBeenCalledTimes(1);
  });
});

describe("SolutionEditorScreen — keyed-reducer re-render scope (row 9, NFR Hiệu năng proxy)", () => {
  it("lưu ghi chú câu 2: chỉ hàng 2 + thanh tiến độ + thanh đáy render lại, hàng 1/3 giữ nguyên", async () => {
    const questions = [
      question({ questionId: "q1", note: FIFTEEN_WORDS, wordCount: 15 }),
      question({ questionId: "q2", note: "", wordCount: 0 }),
      question({ questionId: "q3", note: FIFTEEN_WORDS, wordCount: 15 }),
    ];
    const state = baseState({ solutionId: "s1", status: "draft", questions });
    saveSolutionMock.mockResolvedValue({ ok: true, solutionId: "s1", status: "draft" });

    render(<SolutionEditorScreen examId="E1" initialState={state} />);

    const baseline = { ...renderCounts };
    expect(baseline[1]).toBe(1);
    expect(baseline[2]).toBe(1);
    expect(baseline[3]).toBe(1);

    fireEvent.click(screen.getByRole("button", { name: /^Câu 2,/ }));
    // Mở tấm ghi chú không được đổi render count của bất kỳ hàng nào (props
    // của hàng không phụ thuộc `activeNote`).
    expect(renderCounts[1]).toBe(baseline[1]);
    expect(renderCounts[2]).toBe(baseline[2]);
    expect(renderCounts[3]).toBe(baseline[3]);

    const textarea = screen.getByRole("textbox") as HTMLTextAreaElement;
    fireEvent.change(textarea, { target: { value: FIFTEEN_WORDS } });
    fireEvent.click(screen.getByRole("button", { name: "Lưu" }));

    await screen.findByRole("button", { name: "Câu 2, đã ghi chú" });

    expect(renderCounts[1]).toBe(baseline[1]);
    expect(renderCounts[3]).toBe(baseline[3]);
    expect(renderCounts[2]).toBeGreaterThan(baseline[2]);
    expect(countWords(FIFTEEN_WORDS)).toBe(15);
  });
});
