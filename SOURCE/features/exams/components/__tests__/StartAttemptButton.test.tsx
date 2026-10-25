// @vitest-environment jsdom

// StartAttemptButton — nguồn `source` thật của `?from=` bind vào đối số thứ hai
// của `startAttempt` (P6-T1: nối chuỗi `?from=`).
// Design Doc: docs/design/exam-shelves-frontend-design.md § Field Propagation Map
//   (`rawSource` | `StartAttemptButton` → `startAttempt` | preserved | server-action
//   closure argument | `const start = startAttempt.bind(null, examId, source);`)
// Design Doc: docs/design/exam-shelves-backend-design.md § The attempt-source
//   write path (`startAttempt` là nơi DUY NHẤT ghi cột `source`, luôn qua
//   `toAttemptSource` — component này KHÔNG tự thêm luật chuẩn hoá nào).
//
// `render(await StartAttemptButton(props))` — precedent
// `SkillRecommendationCard.test.tsx` cho async Server Component KHÔNG có con
// async (`StartAttemptSubmit` là client component đồng bộ, chỉ đọc
// `useFormStatus`), nên không rơi vào bẫy cây rỗng mà `renderServerTree` tồn tại
// để né. `fireEvent.submit` trên form kích hoạt cơ chế form-action phía client
// của React 19 (chặn submit, gọi thẳng hàm) — cùng cơ chế
// `DisplayNameEditor.test.tsx`'s `fireEvent.submit` đã dựa vào, chỉ khác
// `StartAttemptButton` truyền thẳng một hàm đã `bind` làm `action`, không qua
// `useActionState`.

import { cleanup, fireEvent, render, waitFor } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

const { startAttemptMock } = vi.hoisted(() => ({ startAttemptMock: vi.fn() }));
vi.mock("@/features/exams/actions", () => ({ startAttempt: startAttemptMock }));

import { StartAttemptButton } from "@/features/exams/components/StartAttemptButton";

beforeEach(() => {
  startAttemptMock.mockReset();
  startAttemptMock.mockResolvedValue(undefined);
});

afterEach(cleanup);

// =============================================================================
// P6-T1 — StartAttemptButton → startAttempt (chặng `source` → tham số đã bind)
// =============================================================================
// AC-040: "Cho một lượt làm bắt đầu từ trang đề được mở với ?from=, khi
//   startAttempt chèn hàng exam_attempts, thì hàng đó lưu đúng
//   một trong practice, hot, explore, none." (file này chứng minh chặng thứ hai trong
//   hai chặng mà giá trị thô phải đi qua không bị sửa — chặng đầu là việc của
//   app/(exams)/exams/[id]/__tests__/page.test.tsx)
// AC-041: "Cho một giá trị ?from= thiếu, rỗng, lạ hoặc giả mạo, khi
//   hàng lượt làm được ghi, thì nó lưu none — 0 lỗi, 0 lượt bắt đầu bị từ chối."
//   (các ca `source` vắng mặt và `totally-bogus` bên dưới chứng minh chặng
//   này tự nó lọc 0 lần, nên toAttemptSource vẫn là điểm
//   chuẩn hoá duy nhất mà AC-041 mô tả)
// ROI: 73 (BV:8 x Freq:8 + Legal:0 + Defect:9)
//   BV 8 — chỗ nối còn thiếu duy nhất trong chuỗi quy kết mà mọi phase trước
//     (danh sách trắng của P1-T5, bên sản xuất của P2-T2, thẻ kệ của P5-T1) được
//     dựng để cấp dữ liệu; thiếu nó thì mọi lượt bắt đầu đều lặng lẽ ghi 'none'.
//   Freq 8 — mọi lượt làm bắt đầu từ nút này, tức mọi lượt gửi
//     "Làm bài" trên trang chi tiết đề.
//   Defect 9 — kiểu hỏng là chặng CUỐI trước khi ghi DB và hoàn toàn thầm lặng
//     (đây là `<form action={boundFn}>` server action duy nhất của repo này, nên
//     chưa có độ phủ tự động nào cho đúng mẫu bind này): tham số `source` bị hardcode/bỏ
//     tạo ra một nút "Làm bài" chạy được, có redirect, không có triệu chứng nhìn thấy, chỉ có
//     giá trị exam_attempts.source sai được phát hiện về sau, nếu có.
// Hành vi: StartAttemptButton({ examId, source }) được render (không có con async,
//   nên áp dụng `render(await StartAttemptButton(props))`, không phải renderServerTree)
//   trên `startAttempt` mock -> form được gửi (chặn form-action phía client của
//   React 19) -> `startAttempt` mock được gọi với
//   (examId, source, FormData) trong đó `source` là ĐÚNG giá trị prop,
//   không bị đụng tới, với giá trị kệ hợp lệ, với prop `source` vắng mặt, và với
//   giá trị lạ/giả mạo.
// @category: core-functionality
// @lane: integration
// @dependency: features/exams/components/StartAttemptButton.tsx + mock
//   features/exams/actions.ts (startAttempt)
// @complexity: low
// @real-dependency: không có — `startAttempt` là ranh giới mock được phê duyệt ở đây
//   (cùng lập luận với ranh giới client Supabase của rating.int.test.ts): việc chuẩn hoá
//   toAttemptSource của chính nó được chứng minh bởi
//   lib/exams/__tests__/attemptSource.test.ts, một unit test thuần ngoài việc
//   của file này.
// Kiểu hỏng chính: `source` bị hardcode `undefined` (chỗ giữ chỗ trước P6-T1
//   mà task này thay thế), hoặc component tự thêm danh sách trắng/kiểm hợp lệ ad-hoc
//   cho `source` trước khi bind, tạo ra điểm chuẩn hoá thứ hai
//   có thể lặng lẽ bất đồng với luật của `toAttemptSource` bên trong `startAttempt`.
// Nghĩa vụ chứng minh:
//   (a) source='hot' -> startAttempt được gọi với ('exam-1', 'hot', FormData);
//   (b) source vắng -> startAttempt được gọi với ('exam-2', undefined,
//       FormData) — không phải mặc định như 'none', việc ánh xạ đó là việc
//       của chính startAttempt qua toAttemptSource;
//   (c) source='totally-bogus' -> startAttempt nhận 'totally-bogus'
//       nguyên văn, chứng minh chặng này lọc 0 lần.
describe("StartAttemptButton — source prop bind vào startAttempt(examId, source) (P6-T1)", () => {
  it("obligation (a): source='hot': submit form gọi startAttempt('exam-1', 'hot', FormData)", async () => {
    const { container } = render(await StartAttemptButton({ examId: "exam-1", source: "hot" }));

    fireEvent.submit(container.querySelector("form")!);

    await waitFor(() => expect(startAttemptMock).toHaveBeenCalledTimes(1));
    const [examId, source, formData] = startAttemptMock.mock.calls[0];
    expect(examId).toBe("exam-1");
    expect(source).toBe("hot");
    expect(formData).toBeInstanceOf(FormData);
  });

  it("obligation (b): source vắng mặt: submit form gọi startAttempt('exam-2', undefined, FormData) — 0 luật whitelist thêm ở đây (đó là việc của toAttemptSource)", async () => {
    const { container } = render(await StartAttemptButton({ examId: "exam-2" }));

    fireEvent.submit(container.querySelector("form")!);

    await waitFor(() => expect(startAttemptMock).toHaveBeenCalledTimes(1));
    const [examId, source] = startAttemptMock.mock.calls[0];
    expect(examId).toBe("exam-2");
    expect(source).toBeUndefined();
  });

  it("obligation (c): source='totally-bogus': đi qua NGUYÊN VĂN, không tự lọc — chuẩn hoá chỉ xảy ra ở startAttempt/toAttemptSource (Boundary Context)", async () => {
    const { container } = render(
      await StartAttemptButton({ examId: "exam-3", source: "totally-bogus" })
    );

    fireEvent.submit(container.querySelector("form")!);

    await waitFor(() => expect(startAttemptMock).toHaveBeenCalledTimes(1));
    const [, source] = startAttemptMock.mock.calls[0];
    expect(source).toBe("totally-bogus");
  });
});
