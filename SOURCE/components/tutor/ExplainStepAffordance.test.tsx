// @vitest-environment jsdom

// ExplainStepAffordance [integration] — the "Giải thích bước này" tutor
// affordance và, thông qua nó, máy trạng thái 4 pha của useTutorAction (Implementation
// Path Mapping của frontend Design Doc không nêu file test riêng cho hook; hook được
// kiểm qua component mà nó điều khiển, theo tiền lệ của ActionButton.test.tsx là test
// usePdfAction qua ActionButton thay vì tách riêng).
// Design Doc: docs/design/engine1-adaptive-ai-frontend-design.md (v1.0) §
//   State Machine Detail — useTutorAction, § Accessibility Implementation
// UI Spec: docs/ui-spec/engine1-adaptive-ai-ui-spec.md (v1.0) — ma trận trạng thái x hiển thị
//   của ExplainStepAffordance, S-01
// PRD: docs/prd/engine1-adaptive-ai-prd.md (v1.0, AC-018-020 nửa UI, AC-021,
//   AC-025, AC-026, AC-029)
//
//Ranh giới mock (Test Boundaries của frontend DD — Mock Boundary Decisions):
//   `explainStep` (import vào useTutorAction) — Có, mock — ranh giới I/O
//   (khứ hồi mạng/Gemini), theo cách ActionButton.test.tsx mock
//   generateAttemptPdfFile/downloadPdfFile/canShareFile. RichText — Không, render
//   thật (đã được RichText.xss.test.tsx riêng phủ, dùng lại không sửa
//   ở đây). BentoCell, Button — Không, render thật (primitive hiển thị thuần).
//   useT() — Không, thật (không có provider thì lùi về DEFAULT_LOCALE = "en",
//   theo quy ước của ActionButton.test.tsx — không cần bọc I18nProvider).
//   vitest.config.ts của repo này không nối file setup @testing-library/jest-dom,
//   nên matcher jest-dom (toHaveAttribute v.v.) không dùng được — file này
//   đọc thẳng thuộc tính/attribute DOM thô, cùng quy ước với
//   ActionButton.test.tsx.
//   render() không tự cleanup giữa các test ở đây (không có `test.globals`, nên
//   auto-cleanup dựa trên afterEach của @testing-library/react không bao giờ đăng ký) —
//   mọi truy vấn bên dưới được giới hạn trong `container` do chính render() đó trả về qua
//   `within`, không bao giờ dùng `screen` toàn cục (tiền lệ ActionButton.test.tsx).
//
//Sinh ngày: 2026-08-08 | Ngân sách đã dùng: integration 1/3 (ngân sách phụ của frontend —
//   xem comment đầu backend tutorActions.int.test.ts để biết lý do chia ngân sách phụ
//   mà file này đi cặp)

import { readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { act, fireEvent, render, waitFor, within } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { ExplainStepAffordance } from "./ExplainStepAffordance";
import type { TutorHintResult } from "@/features/exams/tutorActions";

vi.mock("@/features/exams/tutorActions", () => ({
  hintDuringAttempt: vi.fn(),
}));

import { hintDuringAttempt } from "@/features/exams/tutorActions";

const mockExplainStep = vi.mocked(hintDuringAttempt);

// Cố ý KHÔNG đối xứng/trông có thể hoán đổi — một nơi gọi bị hoán đổi phải
// làm khẳng định của Test 2 hỏng chỉ dựa vào giá trị, không chỉ dựa vào số tham số.
const ATTEMPT_ID = "attempt-fixture-111";
const QUESTION_ID = "question-fixture-222";

const IDLE_LABEL = "Gợi ý cho câu này"; // tutor.explainThisStep (en)
const RETRY_LABEL = "Thử lại"; // common.retry (en), dùng lại theo tiền lệ LABEL_KEY của ActionButton
const ERROR_COPY = "Chưa lấy được gợi ý. Bạn thử lại nhé."; // tutor.error (en) — MỘT câu chữ chung cho cả 4 mã backend
const HIDE_HINT_LABEL = "Ẩn gợi ý"; // tutor.hideHint — tên của nút thu gọn khi bảng đang mở
const SHOW_HINT_LABEL = "Hiện gợi ý"; // tutor.showHint — tên của nút khi bảng đang thu gọn

/** Phần tử mà nút Ẩn/Hiện `aria-controls`, tìm TRONG `container`.
 *  Tìm theo thuộc tính `[id="…"]`, KHÔNG theo `#id`: file này không dọn DOM giữa
 *  các ca (xem khối đầu file), nên cùng một id sống nhiều lần trong document, và
 *  bộ chọn `#id` của jsdom đi tắt qua getElementById — lấy bản của lần render
 *  TRƯỚC (ngoài container) rồi trả null. Đo 2026-09-15: ca này xanh khi chạy
 *  riêng, đỏ khi chạy sau các ca khác. Cùng cái bẫy chú thích `hintRef` trong
 *  component đã mô tả. Đi qua `aria-controls` còn chứng minh luôn nó trỏ trúng. */
function controlledBody(container: HTMLElement, toggle: HTMLElement): HTMLElement {
  const id = toggle.getAttribute("aria-controls");
  expect(id).toBeTruthy();
  const body = container.querySelector<HTMLElement>(`[id="${id}"]`);
  expect(body).not.toBeNull();
  return body!;
}

beforeEach(() => {
  vi.clearAllMocks();
});

describe("ExplainStepAffordance", () => {
  // ===========================================================================
  // Test 1 — AC-025: chốt chặn kích hoạt kép đồng bộ bằng busyRef — lần kích hoạt
  // thứ hai khi đang bận là no-op đã được kiểm chứng (tối đa 1 lần gọi explainStep())
  // ===========================================================================
  // AC-025: "...Lần kích hoạt thứ hai khi đang bận phải là no-op (kiểm qua
  //   busyRef một cách đồng bộ, trước mọi cập nhật state của React)."
  // ROI: 56 (BV:8 x Freq:6 + Legal:0 + Defect:8)
  // Hành vi: render ExplainStepAffordance với explainStep() mock không bao giờ
  //   resolve (một Promise đang chờ, giữ mở) -> bắn hai lần kích hoạt nhanh
  //   (click, hoặc click lần hai) lên nút khi phase==="busy" -> khẳng định
  //   explainStep() mock được gọi TỐI ĐA MỘT LẦN.
  // @category: core-functionality
  // @lane: integration
  // @dependency: SOURCE/components/tutor/ExplainStepAffordance.tsx +
  //   SOURCE/components/tutor/useTutorAction.ts + mock
  //   SOURCE/features/exams/tutorActions.ts (explainStep)
  // @complexity: medium
  // @real-dependency: không có — ranh giới mock được phê duyệt (Mock Boundary
  //   Decisions của frontend DD: explainStep là ranh giới I/O; luồng điều khiển
  //   phase/busyRef của chính useTutorAction chạy thật, trong cùng tiến trình).
  // Kiểu hỏng chính: chốt busyRef được cài như một phép kiểm state của React
  //   (`phase === "busy"`) thay vì kiểm ref đồng bộ, nên một cú click thứ hai
  //   bắn trong cùng tick (trước khi cập nhật state của React được flush) KHÔNG bị chặn
  //   — gọi explainStep() lần hai, thêm một lượt khứ hồi Gemini, thêm một lần tiêu
  //   hạn mức cho cùng một cử chỉ bấm.
  // Nghĩa vụ chứng minh: với generateHint (explainStep mock) giữ chờ bằng một
  //   Promise không resolve, bắn hai sự kiện kích hoạt lên nút liên tiếp ngay lập tức
  //   -> khẳng định mockExplainStep.mock.calls.length === 1 (không bao giờ 2),
  //   dùng khẳng định số lần gọi theo nghĩa đen, không chỉ "UI vẫn trông như đang bận."
  it("AC-025: busyRef synchronous double-activation guard — a second activation while busy is a no-op (at most 1 explainStep() call)", async () => {
    // Giữ mở: phase ở "busy" suốt cửa sổ khẳng định.
    let resolveExplain!: (result: TutorHintResult) => void;
    mockExplainStep.mockImplementation(
      () =>
        new Promise<TutorHintResult>((resolve) => {
          resolveExplain = resolve;
        })
    );

    const { container } = render(
      <ExplainStepAffordance questionId={QUESTION_ID} attemptId={ATTEMPT_ID} />
    );
    const button = within(container).getByRole("button", { name: IDLE_LABEL });

    // CẢ HAI lần kích hoạt nằm trong MỘT thân act() — đây là toàn bộ ý nghĩa của
    // test. fireEvent bọc mỗi lời gọi trong act() riêng, flush cập nhật state của
    // React ở giữa, nên chốt `phase === "busy"` sẽ đã đọc được
    // phase mới và (sai) trông như đúng. Hai cú click gốc trong
    // một thân act() để `phase` ở giá trị trước-render cho handler thứ hai,
    // nên CHỈ phép kiểm ref đồng bộ mới chặn được — đúng cử chỉ cùng-tick
    // mà AC-025 nói tới.
    act(() => {
      button.click(); // idle -> busy (busyRef đặt đồng bộ, trước mọi cập nhật state)
      button.click(); // lần kích hoạt thứ hai quá nhanh trong cùng tick — phải là no-op
    });

    // Khẳng định số lần gọi theo nghĩa đen, không phải "UI vẫn trông như đang bận": một chốt
    // state của React (`phase === "busy"`) để lọt cú click cùng-tick thứ hai này.
    expect(mockExplainStep.mock.calls.length).toBe(1);
    expect(button.getAttribute("aria-disabled")).toBe("true");
    expect(button.getAttribute("aria-busy")).toBe("true");

    resolveExplain({ hint: "gợi ý sau khi mở khoá" });
    // Chờ NÚT GỌI GIA SƯ biến mất, không chờ "hết sạch nút": từ 2026-09-15 bảng
    // gợi ý có một nút Ẩn/Hiện — nó không gọi gia sư, nên không phải thứ D5 cấm.
    await waitFor(() =>
      expect(within(container).queryByRole("button", { name: IDLE_LABEL })).toBeNull()
    );
    expect(mockExplainStep.mock.calls.length).toBe(1); // vẫn là 1 sau khi cửa sổ bận đóng
  });

  // ===========================================================================
  // Test 2 — chứng minh thứ tự tham số: explainStep được gọi với (attemptId,
  // questionId), không bao giờ theo thứ tự khai báo bị hoán đổi của ExplainStepAffordanceProps
  // ===========================================================================
  // Không có số AC riêng — Rủi ro được nêu đầu tiên của chính frontend DD: "explainStep(
  //   attemptId, questionId) so với thứ tự khai báo (questionId,
  //   attemptId) của ExplainStepAffordanceProps — hoán đổi tham số thầm lặng vì cả hai đều
  //   là string," được giảm thiểu tường minh bằng "một unit test dùng literal-fixture trong
  //   ExplainStepAffordance.test.tsx khẳng định toHaveBeenCalledWith(
  //   '<attemptId-fixture>', '<questionId-fixture>') với hai giá trị
  //   fixture phân biệt được, để hoán đổi làm khẳng định hỏng."
  // ROI: 56 (BV:8 x Freq:6 + Legal:0 + Defect:8)
  // Hành vi: render ExplainStepAffordance với hai prop string literal PHÂN BIỆT ĐƯỢC
  //   (ví dụ attemptId="attempt-fixture-111", questionId="question-fixture-222"
  //   — cố ý KHÔNG đối xứng/trông có thể hoán đổi) -> kích hoạt nút
  //   -> khẳng định explainStep mock được gọi với tham số đúng thứ tự
  //   (attemptId, questionId), không phải (questionId, attemptId).
  // @category: core-functionality
  // @lane: integration
  // @dependency: giống Test 1
  // @complexity: low
  // @real-dependency: không có
  // Kiểu hỏng chính: nơi gọi trong useTutorAction.ts hoán đổi hai tham số string
  //   (cả hai đều là string thường, nên TypeScript biên dịch cả hai thứ tự mà
  //   không lỗi) — mọi lần gọi gia sư thầm lặng nhắm sai cặp
  //   lượt làm/câu hỏi, một hồi quy hệ thống kiểu không phát hiện được mà test này
  //   là chốt chặn DUY NHẤT.
  // Nghĩa vụ chứng minh: `expect(mockExplainStep).toHaveBeenCalledWith(
  //   "attempt-fixture-111", "question-fixture-222")` — dùng hai giá trị fixture
  //   sẽ làm khẳng định này hỏng nếu bị hoán đổi (không phải, ví dụ, hai chuỗi giống nhau
  //   hay dễ nhầm).
  it("argument-order proof: explainStep called with (attemptId, questionId), never the swapped declaration order", async () => {
    mockExplainStep.mockResolvedValue({ hint: "gợi ý bất kỳ" });

    const { container } = render(
      <ExplainStepAffordance questionId={QUESTION_ID} attemptId={ATTEMPT_ID} />
    );
    fireEvent.click(within(container).getByRole("button", { name: IDLE_LABEL }));

    await waitFor(() => expect(mockExplainStep).toHaveBeenCalledTimes(1));

    // Chốt chặn DUY NHẤT trước một lần hoán đổi thầm lặng — cả hai tham số đều là string thường,
    // nên thứ tự nào cũng biên dịch. Hai fixture phân biệt được khiến hoán đổi làm test hỏng.
    expect(mockExplainStep).toHaveBeenCalledWith(ATTEMPT_ID, QUESTION_ID, "");
    expect(mockExplainStep.mock.calls[0]).toEqual([ATTEMPT_ID, QUESTION_ID, ""]);
  });

  // ===========================================================================
  // Test 3 — AC-018/019/020 nửa UI + D5: trạng thái đã hiện gợi ý render gợi ý qua
  // RichText và bỏ control gọi lại cho câu này trong lần render này
  // ===========================================================================
  // AC (D5, nửa UI): "...không được tồn tại control nào để gọi lại gia sư trong trạng thái
  //   này, cho câu này, trong lần render này."
  // ROI: 50 (BV:7 x Freq:6 + Legal:0 + Defect:7)
  // Hành vi: explainStep mock resolve { hint: "<fixture hint text>" } -> sau khi
  //   state ổn định, container đã render chứa chữ của gợi ý (render
  //   qua RichText, render thật) và KHÔNG còn chứa nút/control
  //   "giải thích bước này" cho lần render này.
  // @category: core-functionality
  // @lane: integration
  // @dependency: giống Test 1, RichText (thật, không mock)
  // @complexity: medium
  // @real-dependency: không có — chính RichText được chạy thật theo Mock
  //   Boundary Decisions ("đã được test của pipeline đã gia cố riêng phủ...
  //   dùng lại không sửa ở đây, không test lại" — test này chỉ chứng minh
  //   ExplainStepAffordance đưa gợi ý VÀO RichText, không chứng minh độ đúng sanitize
  //   của chính RichText).
  // Kiểu hỏng chính: gợi ý được render qua đường plain-text/
  //   dangerouslySetInnerHTML cạnh tranh thay vì RichText (mở lại lỗ hổng sanitize
  //   phía đầu ra mà ADR-0002/D4 sinh ra để đóng), hoặc nút vẫn mount
  //   cạnh panel gợi ý, cho phép một lần gọi gia sư thứ hai, thừa, cho
  //   cùng một câu đã được trả lời.
  // Nghĩa vụ chứng minh: sau khi explainStep mock resolve với một chuỗi gợi ý fixture,
  //   khẳng định nội dung chữ của container có chuỗi gợi ý fixture,
  //   và khẳng định không còn control "giải thích bước này" tương đương `role="button"`
  //   truy vấn được trong cùng container.
  it("AC-018/019/020 UI half + D5: hint-shown state renders the hint via RichText and removes the re-invoke control", async () => {
    // Nhấn mạnh Markdown là yếu tố phân biệt: RichText biến nó thành <strong>,
    // còn mọi đường plain-text cạnh tranh sẽ để lại dấu sao nguyên văn.
    const HINT = "Xem lại **định luật bảo toàn** rồi thử lại nhé.";
    mockExplainStep.mockResolvedValue({ hint: HINT });

    const { container } = render(
      <ExplainStepAffordance questionId={QUESTION_ID} attemptId={ATTEMPT_ID} />
    );
    fireEvent.click(within(container).getByRole("button", { name: IDLE_LABEL }));

    await waitFor(() =>
      expect(within(container).queryByRole("button", { name: IDLE_LABEL })).toBeNull()
    );

    // RichText nạp ĐỘNG từ TD-021 (chunk markdown+KaTeX 122.5 KB gzip không được
    // nằm trong bundle đầu của trang này). Nút biến mất NGAY khi hint về, nhưng
    // nội dung hint chỉ render sau khi chunk resolve — hai mốc khác nhau, nên
    // phải đợi riêng. Chờ đúng <strong> chứ không chờ chuỗi: nó vừa là bằng chứng
    // chunk đã về, vừa là chính thứ nghĩa vụ chứng minh của case này cần (đường
    // render đi qua markdown, không phải plain-text).
    // TIMEOUT DÀI CÓ CHỦ Ý, không phải nới lỏng khẳng định: mốc chờ vẫn là
    // <strong> XUẤT HIỆN, y như cũ. Cái đổi là NGÂN SÁCH thời gian. Mặc định
    // 1000ms của waitFor đủ khi chạy riêng file này, nhưng chunk markdown+KaTeX
    // ở trên là một import ĐỘNG 122.5 KB, và khi cả 120 file test chạy song
    // song thì lượt resolve ấy thường xuyên vượt 1s — ca này vì thế đỏ khoảng
    // một nửa số lần chạy toàn bộ suite, xanh 100% khi chạy một mình. Một ca
    // đỏ ngẫu nhiên là ca không ai còn đọc, nên nó được sửa chứ không bị bỏ
    // qua. Một lượt render THẬT SỰ hỏng vẫn đỏ ở đây, chỉ là chậm hơn.
    await waitFor(() => expect(container.querySelector("strong")).not.toBeNull(), {
      timeout: 15_000,
    });

    expect(container.textContent).toContain("Xem lại");
    expect(container.textContent).toContain("định luật bảo toàn");
    expect(container.textContent).toContain("rồi thử lại nhé.");
    expect(container.querySelector("strong")?.textContent).toBe("định luật bảo toàn");
    expect(container.textContent).not.toContain("**"); // không phải đường render thô/plain-text

    // D5: không tồn tại control nào để gọi lại GIA SƯ trong trạng thái này, cho câu
    // này, trong lần render này. Từ 2026-09-15 còn đúng MỘT nút —
    // nút bật/tắt của panel gợi ý. Nó không bao giờ gọi gia sư (đã chứng minh
    // ở ca toggle bên dưới), nên được ghim theo NÓ LÀ GÌ — trạng thái mở rộng
    // và tên "Ẩn gợi ý" — thay vì chỉ đếm, để một control gọi lại
    // lẻn vào làm "nút duy nhất" vẫn hỏng ở đây.
    expect(within(container).queryByRole("button", { name: IDLE_LABEL })).toBeNull();
    expect(within(container).queryByRole("button", { name: RETRY_LABEL })).toBeNull();
    const buttons = container.querySelectorAll("button");
    expect(buttons.length).toBe(1);
    expect(buttons[0].getAttribute("aria-label")).toBe(HIDE_HINT_LABEL);
    expect(buttons[0].getAttribute("aria-expanded")).toBe("true");
    expect(container.textContent).toContain("Gợi ý"); // tutor.hintEyebrow

    // Hồi quy Phase 5 Task 19 (đo bằng bàn phím trên trình duyệt thật, không
    // phải suy diễn): D5 xoá hẳn cái nút vừa GIỮ FOCUS của người dùng bàn phím,
    // và trình duyệt đáp lại bằng cách trả focus về <body> — Tab kế tiếp nhảy
    // ngược lên đầu tài liệu, người dùng bàn phím không bao giờ tới được gợi ý
    // họ vừa xin. Bảng gợi ý phải tự nhận lấy focus, và phải bằng tabIndex={-1}
    // (nhận theo lệnh) chứ không phải 0 — nó là nội dung tĩnh, không được chen
    // thêm một chặng vào thứ tự Tab của trang.
    const panel = container.querySelector<HTMLElement>('[tabindex="-1"]');
    expect(panel).not.toBeNull();
    expect(document.activeElement).toBe(panel);
    expect(panel!.textContent).toContain("định luật bảo toàn");
  });

  // ===========================================================================
  // Nút Ẩn/Hiện của bảng gợi ý (engineer 2026-09-15: "để đỡ phải vuốt lên
  // xuống" — bảng gợi ý đứng giữa đề bài và khu vực trả lời).
  // ===========================================================================
  // Kiểu hỏng chính: (1) nút bật/tắt bị nối vào lời gọi gia sư — mỗi lần
  //   thu gọn/mở rộng thầm lặng tiêu một lượt khứ hồi Gemini có giới hạn hạn mức; (2) phần
  //   thân bị unmount thay vì ẩn, nên `aria-controls` trỏ vào hư không
  //   khi đang thu gọn; (3) cha không được báo, nên gợi ý đã thu gọn bật
  //   mở lại khi quay về câu đó.
  it("2026-09-15: Ẩn/Hiện thu gọn bảng gợi ý, báo trạng thái lên cha, và KHÔNG gọi gia sư", () => {
    const onCollapsedChange = vi.fn();
    const { container } = render(
      <ExplainStepAffordance
        questionId={QUESTION_ID}
        attemptId={ATTEMPT_ID}
        hint="Gợi ý đã nhận từ trước"
        onHintCollapsedChange={onCollapsedChange}
      />
    );
    const hide = within(container).getByRole("button", { name: HIDE_HINT_LABEL });
    const body = controlledBody(container, hide);
    expect(body.hidden).toBe(false);
    fireEvent.click(hide);

    expect(body.hidden).toBe(true);
    expect(onCollapsedChange).toHaveBeenLastCalledWith(true);
    const show = within(container).getByRole("button", { name: SHOW_HINT_LABEL });
    expect(show.getAttribute("aria-expanded")).toBe("false");
    // Vẫn trong cây khi thu gọn: aria-controls của nút (đã đổi nhãn) vẫn trỏ
    // trúng CÙNG phần tử, không phải một phần tử đã bị gỡ.
    expect(controlledBody(container, show)).toBe(body);

    fireEvent.click(show);
    expect(body.hidden).toBe(false);
    expect(onCollapsedChange).toHaveBeenLastCalledWith(false);

    // Thu gọn chỉ là thu gọn — không bao giờ là một lượt gọi gia sư.
    expect(mockExplainStep).not.toHaveBeenCalled();
  });

  it("2026-09-15: trạng thái thu gọn cha truyền xuống thắng trạng thái nội bộ — quay lại câu đã thu gọn thì vẫn gọn", () => {
    const { container } = render(
      <ExplainStepAffordance
        questionId={QUESTION_ID}
        attemptId={ATTEMPT_ID}
        hint="Gợi ý đã nhận từ trước"
        hintCollapsed
      />
    );
    const toggle = within(container).getByRole("button", { name: SHOW_HINT_LABEL });
    const body = controlledBody(container, toggle);
    expect(body.hidden).toBe(true);
    const show = within(container).getByRole("button", { name: SHOW_HINT_LABEL });
    expect(show.getAttribute("aria-expanded")).toBe("false");
  });

  // ===========================================================================
  // Test 4 — AC-021: đường lỗi đổi nhãn thành thử lại, mount một đoạn lỗi role="alert",
  // và phần còn lại của trang (DOM của chính component này) vẫn tương tác được
  // ===========================================================================
  // AC-021: "...nút phải đổi nhãn thành common.retry, và một đoạn role='alert'
  //   đọc tutor.error phải mount bên dưới nó; phần còn lại của trang kết quả
  //   phải vẫn tương tác đầy đủ."
  // ROI: 50 (BV:7 x Freq:6 + Legal:0 + Defect:7)
  // Hành vi: explainStep mock resolve { error: "gemini_unavailable" } (và,
  //   ở ca thứ hai, explainStep mock REJECT/ném lỗi) -> nhãn truy cập được của nút
  //   đổi thành chữ thử lại, và một phần tử `role="alert"`
  //   mang câu chữ chung tutor.error được mount; nút vẫn enabled/
  //   focus được (không bao giờ `disabled` gốc) để có thể kích hoạt thử lại.
  // @category: edge-case
  // @lane: integration
  // @dependency: giống Test 1
  // @complexity: medium
  // @real-dependency: không có
  // Kiểu hỏng chính: nút bị đặt `disabled` gốc khi lỗi
  //   (loại nó khỏi thứ tự tab — đúng lỗi đã sửa hai lần trong codebase này,
  //   RateButton rồi ActionButton, theo Applicable Standards của chính frontend DD), chặn
  //   vĩnh viễn việc thử lại bằng bàn phím; hoặc đoạn lỗi thiếu `role="alert"`, nên công nghệ
  //   hỗ trợ không bao giờ thông báo lỗi.
  // Nghĩa vụ chứng minh: với CẢ ca kết quả-lỗi-có-kiểu lẫn ca
  //   Promise-bị-reject, khẳng định có phần tử role="alert" và
  //   nội dung chữ của nó khớp câu chữ chung tutor.error, và khẳng định
  //   phần tử nút không có thuộc tính/property `disabled` gốc (vẫn
  //   focus được) ở cả hai ca lỗi.
  it("AC-021: failure path re-labels to retry, mounts a role=alert error paragraph, stays interactive", async () => {
    // Hook cố ý console.error ở cả hai nhánh lỗi (frontend DD §
    // Logging and Monitoring) — tắt tiếng để log dự kiến không bị đọc như
    // nhiễu của test.
    const errorSpy = vi.spyOn(console, "error").mockImplementation(() => {});

    try {
      // Ca A — kết quả lỗi có kiểu (một trong 4 mã backend đóng).
      mockExplainStep.mockResolvedValue({ error: "gemini_unavailable" });
      const typed = render(
        <ExplainStepAffordance questionId={QUESTION_ID} attemptId={ATTEMPT_ID} />
      );
      fireEvent.click(within(typed.container).getByRole("button", { name: IDLE_LABEL }));

      const typedAlert = await within(typed.container).findByRole("alert");
      expect(typedAlert.textContent).toBe(ERROR_COPY); // MỘT câu chữ chung — không bao giờ tiết lộ mã nào
      const typedButton = within(typed.container).getByRole("button", { name: RETRY_LABEL });
      // Không bao giờ `disabled` gốc — đúng lỗi đã sửa hai lần ở đây
      // (RateButton, rồi ActionButton); nút bị disabled rời khỏi thứ tự tab.
      expect(typedButton.hasAttribute("disabled")).toBe(false);
      expect((typedButton as HTMLButtonElement).disabled).toBe(false);
      expect(typedButton.getAttribute("aria-disabled")).toBe("false");
      expect(typedButton.getAttribute("aria-busy")).toBe("false");
      typedButton.focus();
      expect(document.activeElement).toBe(typedButton); // vẫn focus được => bấm thử lại bằng bàn phím được

      // Ca B — lời gọi bị reject hẳn (rớt mạng / Server Action ném lỗi).
      mockExplainStep.mockRejectedValue(new Error("network blip"));
      const rejected = render(
        <ExplainStepAffordance questionId={QUESTION_ID} attemptId={ATTEMPT_ID} />
      );
      fireEvent.click(within(rejected.container).getByRole("button", { name: IDLE_LABEL }));

      const rejectedAlert = await within(rejected.container).findByRole("alert");
      expect(rejectedAlert.textContent).toBe(ERROR_COPY); // câu chữ giống hệt — cả hai nhánh gộp về một thông báo
      const rejectedButton = within(rejected.container).getByRole("button", { name: RETRY_LABEL });
      expect(rejectedButton.hasAttribute("disabled")).toBe(false);
      expect((rejectedButton as HTMLButtonElement).disabled).toBe(false);
      expect(rejectedButton.getAttribute("aria-disabled")).toBe("false");
      rejectedButton.focus();
      expect(document.activeElement).toBe(rejectedButton);

      // busyRef không được để kẹt ở true sau một lần lỗi — thử lại vào lại trạng thái busy.
      mockExplainStep.mockResolvedValue({ hint: "gợi ý sau khi thử lại" });
      fireEvent.click(rejectedButton);
      await waitFor(() => expect(mockExplainStep).toHaveBeenCalledTimes(3));
    } finally {
      errorSpy.mockRestore();
    }
  });

  // ===========================================================================
  // Test 5 — AC-023/024/029: điều kiện mount chỉ do hasBeenWrongTwice quyết định,
  // không bao giờ do có hay không skill_node_id (câu chưa gắn thẻ render y hệt)
  // ===========================================================================
  // AC-024: "Khi r.hasBeenWrongTwice là false hoặc undefined, ResultDetailPage
  //   không được mount ExplainStepAffordance cho câu đó."
  // AC-029 (nửa UI): "...ExplainStepAffordance phải render và hoạt động
  //   y hệt — nó chỉ bị quyết định bởi hasBeenWrongTwice, không bao giờ bởi việc có
  //   thẻ kỹ năng hay không."
  // ROI: 45 (BV:6 x Freq:6 + Legal:0 + Defect:7)
  // Hành vi: đây là bằng chứng về điều kiện mount, về mặt khái niệm được chạy ở mức nơi gọi
  //   ResultDetailPage, nhưng ở đây kiểm được dưới dạng: chính ExplainStepAffordance
  //   không mang logic chặn nội bộ nào theo skill_node_id/hasBeenWrongTwice
  //   (các trường đó hoàn toàn không thuộc ExplainStepAffordanceProps — việc
  //   chặn xảy ra ở NƠI GỌI, ResultDetailPage, theo ghi chú của chính IP-1 rằng
  //   ResultDetailPage "không có RTL... theo tiền lệ ExamCard/
  //   ExamBrowser là Server Component không được test"). Thay vào đó, test này chứng minh
  //   hành vi của chính COMPONENT độc lập với mọi prop có hình dạng thẻ kỹ năng
  //   — tức là render ExplainStepAffordance chỉ với {questionId, attemptId}
  //   (bề mặt Props nhỏ nhất thật của nó) vẫn chạy đầy đủ, không cần và không
  //   tham chiếu prop bổ sung nào cho thẻ kỹ năng.
  // @category: edge-case
  // @lane: integration
  // @dependency: giống Test 1
  // @complexity: low
  // @real-dependency: không có
  // Kiểu hỏng chính: người bảo trì về sau mở rộng ExplainStepAffordanceProps để
  //   nhận một trường có hình dạng thẻ kỹ năng và điều kiện hoá việc render/hành vi theo nó,
  //   thầm lặng phá hợp đồng "cần nội dung câu hỏi, không cần thẻ kỹ năng" của AC-029
  //   với câu chưa gắn thẻ.
  // Nghĩa vụ chứng minh: render ExplainStepAffordance chỉ với props đã tài liệu hoá
  //   {questionId, attemptId} (không prop bổ sung) và khẳng định nút ở trạng thái idle
  //   render ra và kích hoạt được, chứng minh component không cần prop nào khác để
  //   hoạt động — chính QUYẾT ĐỊNH mount/không mount (AC-023/024) là
  //   trách nhiệm của ResultDetailPage và nằm ngoài phạm vi RTL theo IP-1,
  //   được kiểm bằng lượt Playwright thủ công (Integration
  //   Verification Points của frontend DD).
  it("AC-023/024/029: mount condition gated solely by hasBeenWrongTwice, never by skill_node_id presence", async () => {
    mockExplainStep.mockResolvedValue({ hint: "gợi ý cho câu chưa gắn nhãn kỹ năng" });

    // Chỉ các prop tối thiểu đã tài liệu hoá — không truyền prop có hình dạng thẻ kỹ năng.
    const { container } = render(
      <ExplainStepAffordance questionId={QUESTION_ID} attemptId={ATTEMPT_ID} />
    );

    const button = within(container).getByRole("button", { name: IDLE_LABEL });
    expect(button.getAttribute("aria-disabled")).toBe("false");
    expect(button.hasAttribute("disabled")).toBe(false);

    fireEvent.click(button); // kích hoạt đầy đủ chỉ với {questionId, attemptId}
    await waitFor(() => expect(mockExplainStep).toHaveBeenCalledTimes(1));
    expect(mockExplainStep).toHaveBeenCalledWith(ATTEMPT_ID, QUESTION_ID, "");

    // Nửa cấu trúc của AC-029: cả component lẫn hook của nó đều không được đọc bất kỳ
    // giá trị hình dạng thẻ kỹ năng nào. Chính QUYẾT ĐỊNH mount/không mount
    // (AC-023/024) là trách nhiệm của ResultDetailPage, nằm ngoài phạm vi RTL
    // theo IP-1 — được kiểm bằng lượt Playwright thủ công (Phase 5 Task 18).
    // Phân giải theo thư mục của CHÍNH file này, không theo process.cwd(): hai
    // đích là anh em đặt cạnh nó dù theo cách nào, nên phép quét vẫn đúng khi
    // chạy từ gốc repo thay vì SOURCE/.
    const here = dirname(fileURLToPath(import.meta.url));
    const componentSource = readFileSync(join(here, "ExplainStepAffordance.tsx"), "utf-8");
    const hookSource = readFileSync(join(here, "useTutorAction.ts"), "utf-8");
    const readsSkillTag = (source: string) => /skill[_A-Za-z]*(Id|_id|Tag|Node)/i.test(source);
    expect(readsSkillTag(componentSource)).toBe(false);
    expect(readsSkillTag(hookSource)).toBe(false);
  });
});
