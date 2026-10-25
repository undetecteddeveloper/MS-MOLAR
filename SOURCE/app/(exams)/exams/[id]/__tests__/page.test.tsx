// @vitest-environment jsdom

// app/(exams)/exams/[id]/page.tsx — ?from= chain wiring, chặng URL → page →
// StartAttemptButton (P6-T1).
// Design Doc: docs/design/exam-shelves-frontend-design.md § Field Propagation Map
//   (`from` URL → `[id]/page.tsx` giữ nguyên, thô, 0 bước kiểm phía client;
//   `source` `[id]/page.tsx` → `StartAttemptButton` giữ nguyên, prop `source?: string`)
// Design Doc: docs/design/exam-shelves-backend-design.md § The attempt-source
//   write path — full chain
//
// RANH GIỚI MOCK: `getExam`, `hasReported`, `getCurrentUser` — tầng dữ liệu, theo mẫu
// `app/(exams)/exams/__tests__/page.test.tsx`. `StartAttemptButton` CŨNG
// được mock (stub ghi lại tham số): Boundary Context của chính task này nêu hai
// ranh giới TÁCH BIỆT — URL → trang (thuộc file này) và StartAttemptButton → startAttempt
// (thuộc StartAttemptButton.test.tsx) — nên file này chỉ cô lập
// chặng đầu, chứng minh giá trị `from` thô tới prop `source` không bị sửa.
//
// `renderServerTree`, không dùng `render(await ExamDetailPage(...))`: `AuthorByline`
// (render qua `<AuthorByline>` của trang) là con Server Component bất đồng bộ,
// cùng mối nguy cây rỗng mà `ExamShelf.test.tsx` và test trang exams đã ghi lại.

import { beforeEach, describe, expect, it, vi } from "vitest";
import { renderServerTree } from "@/tests/helpers/renderServerTree";
import type { Exam } from "@/types/exam";

vi.mock("server-only", () => ({}));

const { getExamMock, hasReportedMock, getCurrentUserMock, startAttemptButtonMock } =
  vi.hoisted(() => ({
    getExamMock: vi.fn(),
    hasReportedMock: vi.fn(),
    getCurrentUserMock: vi.fn(),
    startAttemptButtonMock: vi.fn<(props: { examId: string; source?: string }) => null>(
      () => null
    ),
  }));

vi.mock("@/features/exams/queries", () => ({ getExam: getExamMock }));
vi.mock("@/features/authoring/queries", () => ({ hasReported: hasReportedMock }));
vi.mock("@/lib/auth/getCurrentUser", () => ({ getCurrentUser: getCurrentUserMock }));
vi.mock("@/features/exams/components/StartAttemptButton", () => ({
  StartAttemptButton: startAttemptButtonMock,
}));

import ExamDetailPage from "@/app/(exams)/exams/[id]/page";

const EXAM: Exam = {
  id: "exam-1",
  title: "Đề kiểm tra Hóa học",
  questionIds: ["q1", "q2"],
  durationMinutes: 45,
  subject: "Chemistry",
  grade: 10,
};

beforeEach(() => {
  vi.clearAllMocks();
  getExamMock.mockResolvedValue(EXAM);
  hasReportedMock.mockResolvedValue(false);
  // Người đã đăng nhập: chuỗi `from` → `source` của P6-T1 là của người LÀM BÀI.
  // Từ 2026-10-12 khách chỉ thấy liên kết đăng nhập thay cho nút — xem khối
  // "khách" ở cuối file.
  getCurrentUserMock.mockResolvedValue({ id: "user-1" });
});

// =============================================================================
// P6-T1 — URL → trang → StartAttemptButton (chặng prop `from` → `source`)
// =============================================================================
// AC-039: "Cho một thẻ nằm trong kệ, khi link của nó render, thì href
//   mang ?from=practice, ?from=hot hoặc ?from=explore tuỳ kệ nó nằm trên;
//   cho một thẻ trong lưới phẳng hoặc trong khối trang chủ, thì
//   href mang 0 tham số ?from." (file này chứng minh phía TIÊU THỤ —
//   trang đọc lại querystring đó — phía sản xuất là ExamCard.snapshot.test.tsx của P2-T2)
// AC-040: "Cho một lượt làm bắt đầu từ trang đề được mở với ?from=, khi
//   startAttempt chèn hàng exam_attempts, thì hàng đó lưu đúng
//   một trong practice, hot, explore, none." (file này chứng minh chặng đầu trong
//   hai chặng mà giá trị thô phải đi qua không bị sửa — chặng thứ hai là việc của
//   StartAttemptButton.test.tsx)
// AC-041: "Cho một giá trị ?from= thiếu, rỗng, lạ hoặc giả mạo, khi
//   hàng lượt làm được ghi, thì nó lưu none — 0 lỗi, 0 lượt bắt đầu bị từ chối."
//   (các ca vắng ?from= và hoàn toàn rác bên dưới chứng minh chặng này
//   tự nó lọc 0 lần, nên danh sách trắng của AC-041 vẫn chỉ có một điểm)
// ROI: 72 (BV:8 x Freq:8 + Legal:0 + Defect:8)
//   BV 8 — chỗ nối còn thiếu duy nhất trong chuỗi quy kết mà mọi phase trước
//     (danh sách trắng của P1-T5, bên sản xuất của P2-T2, thẻ kệ của P5-T1) được
//     dựng để cấp dữ liệu; thiếu nó thì mọi lượt bắt đầu đều lặng lẽ ghi 'none'.
//   Freq 8 — mọi lượt làm bắt đầu từ một thẻ kệ, tức mọi lượt chuyển đổi
//     qua kệ mà tính năng này sinh ra để đo.
//   Defect 8 — kiểu hỏng là thầm lặng: prop `source` bị rơi hoặc hardcode
//     vẫn render nút "Làm bài" chạy được mà không có triệu chứng nhìn thấy, chỉ có
//     giá trị exam_attempts.source sai được phát hiện về sau, nếu có.
// Hành vi: ExamDetailPage({ params, searchParams }) được gọi trên một tầng
//   dữ liệu mock (getExam/hasReported/getCurrentUser) và một
//   StartAttemptButton mock (stub ghi lại tham số) -> render qua renderServerTree ->
//   StartAttemptButton được gọi với { examId, source } trong đó `source` là
//   ĐÚNG `searchParams.from`, không bị đụng tới, với giá trị kệ hợp lệ, với
//   ?from= vắng mặt, và với giá trị lạ/giả mạo.
// @category: core-functionality
// @lane: integration
// @dependency: app/(exams)/exams/[id]/page.tsx (ExamDetailPage) + mock
//   getExam/hasReported/getCurrentUser + mock StartAttemptButton
// @complexity: low
// @real-dependency: không có — StartAttemptButton được mock có chủ đích, theo cách chia
//   hai ranh giới trong Boundary Context của task này: hành vi bind-vào-startAttempt của nó
//   được chứng minh riêng bởi StartAttemptButton.test.tsx, nên file này chỉ cô lập
//   chặng URL -> trang thay vì chứng minh lại cả chặng thứ hai.
// Kiểu hỏng chính: trang tự thêm danh sách trắng/thu hẹp kiểu cho `from`
//   trước khi truyền xuống (ví dụ ép sang union AttemptSource, hoặc
//   đặt giá trị lạ về thứ gì khác ngoài truyền nguyên), tạo ra điểm
//   chuẩn hoá thứ hai có thể lặng lẽ bất đồng với luật của toAttemptSource; hoặc
//   prop bị rơi/hardcode, cùng kiểu hỏng với chỗ giữ chỗ trước P6-T1 mà task này thay thế.
// Nghĩa vụ chứng minh:
//   (a) ?from=hot -> StartAttemptButton nhận { examId: exam.id, source: "hot" };
//   (b) 0 ?from= -> StartAttemptButton nhận source: undefined, không phải một
//       mặc định như "none" — việc ánh xạ đó là của startAttempt, không phải của trang;
//   (c) ?from=totally-bogus -> StartAttemptButton nhận source:
//       "totally-bogus" nguyên văn, chứng minh chặng này lọc 0 lần.
describe("ExamDetailPage — searchParams.from thread thành source prop cho StartAttemptButton (P6-T1, Field Propagation Map)", () => {
  it("obligation (a): ?from=hot: StartAttemptButton nhận { examId: 'exam-1', source: 'hot' }", async () => {
    await renderServerTree(
      await ExamDetailPage({
        params: Promise.resolve({ id: "exam-1" }),
        searchParams: Promise.resolve({ from: "hot" }),
      })
    );

    expect(startAttemptButtonMock).toHaveBeenCalledTimes(1);
    expect(startAttemptButtonMock.mock.calls[0][0]).toMatchObject({
      examId: "exam-1",
      source: "hot",
    });
  });

  it("obligation (b): 0 ?from=: StartAttemptButton nhận source undefined — không tự thêm mặc định nào khác", async () => {
    await renderServerTree(
      await ExamDetailPage({
        params: Promise.resolve({ id: "exam-1" }),
        searchParams: Promise.resolve({}),
      })
    );

    expect(startAttemptButtonMock.mock.calls[0][0]).toMatchObject({
      examId: "exam-1",
      source: undefined,
    });
  });

  it("obligation (c): ?from=totally-bogus: truyền NGUYÊN VĂN, không lọc/whitelist ở tầng page — chuẩn hoá là việc của toAttemptSource ở startAttempt (Boundary Context roundtrip check)", async () => {
    await renderServerTree(
      await ExamDetailPage({
        params: Promise.resolve({ id: "exam-1" }),
        searchParams: Promise.resolve({ from: "totally-bogus" }),
      })
    );

    expect(startAttemptButtonMock.mock.calls[0][0]).toMatchObject({
      examId: "exam-1",
      source: "totally-bogus",
    });
  });
});

// =============================================================================
// Khách chưa đăng nhập xem được trang đề (brief 20261012 D1)
// =============================================================================
describe("ExamDetailPage — khách chưa đăng nhập", () => {
  async function renderAsGuest(searchParams: { from?: string } = {}) {
    getCurrentUserMock.mockResolvedValue(null);
    return renderServerTree(
      await ExamDetailPage({
        params: Promise.resolve({ id: "exam-1" }),
        searchParams: Promise.resolve(searchParams),
      })
    );
  }

  it("thấy thông tin đề, nhưng KHÔNG có nút Làm bài (không Server Action)", async () => {
    const { container } = await renderAsGuest();

    expect(container.textContent).toContain("Đề kiểm tra Hóa học");
    expect(startAttemptButtonMock).not.toHaveBeenCalled();
    expect(container.querySelector("form")).toBeNull();
  });

  it("có liên kết 'Đăng nhập để làm bài' mang next về đúng trang đề", async () => {
    const { container } = await renderAsGuest();

    const link = Array.from(container.querySelectorAll("a")).find((a) =>
      a.textContent?.includes("Đăng nhập để làm bài")
    );
    expect(link?.getAttribute("href")).toBe("/?auth=signin&next=%2Fexams%2Fexam-1");
  });

  it("?from=hot được giữ trong next; giá trị lạ bị bỏ (không đưa vào URL đăng nhập)", async () => {
    const hot = await renderAsGuest({ from: "hot" });
    expect(
      Array.from(hot.container.querySelectorAll("a")).find((a) =>
        a.textContent?.includes("Đăng nhập để làm bài")
      )?.getAttribute("href")
    ).toBe("/?auth=signin&next=%2Fexams%2Fexam-1%3Ffrom%3Dhot");

    const bogus = await renderAsGuest({ from: "x;drop table" });
    expect(
      Array.from(bogus.container.querySelectorAll("a")).find((a) =>
        a.textContent?.includes("Đăng nhập để làm bài")
      )?.getAttribute("href")
    ).toBe("/?auth=signin&next=%2Fexams%2Fexam-1");
  });

  it("không có kênh báo cáo đề cho khách", async () => {
    const { container } = await renderAsGuest();
    expect(hasReportedMock).not.toHaveBeenCalled();
    expect(container.textContent).not.toMatch(/báo cáo/i);
  });
});
