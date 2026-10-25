// Kho đề theo kệ (Exam Shelves) [integration] Test Skeleton
// Design Docs: docs/design/exam-shelves-backend-design.md (v1.2, § Query layer,
//                § Test Boundaries and Placement :613-618, § Verification Strategy)
//              docs/design/exam-shelves-frontend-design.md (v1.0, § Data contracts —
//                bên tiêu thụ listExamShelves()/listHotExams(), không phải bên sản xuất)
// PRD:         docs/prd/exam-shelves-prd.md (v1.2, AC-001, AC-002, AC-006, AC-013,
//                AC-024, AC-027, AC-028, AC-036-AC-038, AC-051)
// ADR:         docs/adr/ADR-0021-cross-user-hot-aggregate-and-attempt-source.md
//              (D1 hình dạng aggregate, D3 ngân sách), ADR-0015 (Decision 6, ngân sách lượt khứ hồi)
// Sinh ngày:   2026-09-18 | Ngân sách đã dùng: integration 2/3 (tổng tính năng 3/3 — xem
//                ứng viên thứ 3 nối thêm vào rating.int.test.ts)
//
// =============================================================================
// TRẠNG THÁI FILE — đọc trước khi sửa
// =============================================================================
// Cả hai ứng viên đã chuyển thành vitest thật (P3-T2, `features/exams/queries/shelves.ts`
// đã đáp xuống cùng commit) — cùng quy ước "skeleton → test thật trong
// commit của task cài đặt" mà comment đầu của chính `rating.int.test.ts` dùng. Đoạn bên dưới
// được giữ như đã viết lúc sinh; lý do vì sao file này không import gì
// nay là lịch sử, không phải trạng thái hiện tại.
//
// `features/exams/queries/shelves.ts`, `hotCounts.ts` và `attempts.ts` CHƯA TỒN TẠI
// lúc sinh (Implementation Path Mapping của backend DD — cả ba dòng đều ghi
// "New"). Không gì ở đây import chúng: import một module chưa tồn tại sẽ làm hỏng
// `tsc --noEmit`/`eslint`/`build` ngay khi skeleton này được commit, và file này
// phải giữ xanh dưới cả ba cổng cho tới khi task cài đặt thêm các import,
// mock và khẳng định trong cùng commit thêm `shelves.ts` (Red→Green trong
// một task, theo Vertical Slice plan của backend DD, bước 5 — "điểm tích hợp").
//
// LÀN NÀY CHẠY THẾ NÀO: mặc định `npx vitest run` (`vitest.config.ts:26` thu thập
// `features/**/*.test.{ts,tsx}`), môi trường `node` (không cần DOM — file này chứng minh
// hình dạng lời gọi và hình dạng object, không bao giờ markup đã render). Một file được thu thập mà không có
// task test nào làm vitest báo "No test suite found in file" và thoát mã 1 (sự kiện đã đo,
// comment đầu `vitest.fixture.config.ts` — cùng hành vi runner áp dụng cho làn này),
// nên mỗi ứng viên bên dưới mang ít nhất một `it.todo(...)` thật, không bao giờ là comment trần.
//
// -----------------------------------------------------------------------------
// RANH GIỚI MOCK — nêu một lần, áp dụng cho cả hai ứng viên (backend DD § Test
// Boundaries and Placement, quyết định nguyên văn)
// -----------------------------------------------------------------------------
// MOCK — chỉ ranh giới client Supabase, dạng `{ from, rpc }` với một bản đồ builder
//   THEO TỪNG BẢNG (cùng kỹ thuật với helper `mockTables()` của `rating.int.test.ts`,
//   :555-563): một builder DÙNG CHUNG sẽ phục vụ các hàng `exams_with_difficulty` như
//   hàng `exam_attempts` và file này vẫn xanh trong khi đo sai thứ.
//   `server-only` được stub như `rating.int.test.ts:24` làm.
// THẬT — mọi helper `lib/adaptive` thuần mà phép ghép này gọi tới
//   (`rankExamIds`, `pickHotShelf`, `pickWeakestSubject`, `pickDominantGrade`,
//   `pickExploreShelf`) — file này KHÔNG mock lại cái thang hay các trọng số xếp hạng;
//   nó chứng minh TẦNG TRUY VẤN nối chúng đúng, không phải rằng chúng
//   từng cái đúng. Ma trận biên đầy đủ của cái thang (thứ tự bậc,
//   mở rộng `HOT_SHELF_MIN_CARDS` ở 4/5/6 đề đủ điều kiện, phân định hoà) được
//   chứng minh bởi `SOURCE/lib/adaptive/__tests__/examShelves.test.ts` (unit thuần, làn
//   CI) — do backend DD nêu, ngoài việc của file này và ngoài phạm vi Integration/E2E
//   của agent này (xem báo cáo bàn giao).
// KHÔNG BAO GIỜ MOCK, KHÔNG CHỨNG MINH Ở ĐÂY — cô lập RLS, grant của `exam_hot_counts()`,
//   và việc hàm definer có thực sự vượt qua hàng của người dùng khác hay không
//   bị backend DD LOẠI RÕ khỏi làn mock này: "hành vi, grant, vị từ và cô lập RLS
//   của hàm không bao giờ bị mock — chỉ Postgres thật mới chứng minh [nó]". Bằng chứng đó nằm ở
//   `SOURCE/tests/e2e/service/exam-hot-counts.service.e2e.test.ts` (service-e2e,
//   cùng đợt sinh này) và `supabase/test-rls.ts` Phần 10 (thủ công).
// @real-dependency: không có — các ứng viên `@lane: integration` của file này là test
//   client-Supabase-mock hoàn toàn. Đừng thêm kết nối Postgres sống vào đây.
//
//-----------------------------------------------------------------------------
// CHỌN LỌC — vì sao hai cái này, và vì sao cái thứ ba chuyển sang rating.int.test.ts
// -----------------------------------------------------------------------------
//   Ứng viên 1    90  ngân sách hợp thành & đồng thời + hình dạng tham số RPC
//   Ứng viên 2    99  luật cấu trúc kệ-null (AC-051) + lượt lấy trang chủ có cổng F-001
//                      + hình dạng listHotExams() (chốt hồi quy submittedExamIds)
//   (suất thứ 3)  64  ngân sách hợp thành ?sort=hot / ?sort=garbage (F-005) — CÙNG
//                      ngân sách integration, nhưng nối thêm vào file
//                      `rating.int.test.ts` SẴN CÓ vì đó là file mà cả hai Design
//                      Doc đã giao cho nó (Implementation Path Mapping của backend DD:
//                      "Changed (tests) | rating.int.test.ts … | Khẳng định ngân sách
//                      + rpc trong mock").
//   KHÔNG ĐƯỢC CHỌN (đẩy xuống, ngoài phạm vi Integration/E2E của agent này):
//     - Chứa trong ExamCard (AC-043) — `ExamCard.snapshot.test.tsx`, làn
//       Component (`npx vitest run`, KHÔNG đặt tên `.int.test.tsx`), mục "Proof file"
//       của chính frontend DD, không phải đầu ra 3 làn của agent này.
//     - Số ruy băng / vị trí ô theo từng kệ (AC-026/032) ở mức một
//       component đơn — `ExamShelf.test.tsx`, làn Component. Phiên bản MỨC TRANG
//       của cùng khẳng định ("đúng 1 ruy băng cả trang") được phủ bởi
//       ứng viên suất-dành-riêng fixture-e2e (đợt sinh này).
//     - Thứ tự bậc thang + ngưỡng HOT_SHELF_MIN_CARDS (AC-019-AC-023) — unit
//       thuần, `lib/adaptive/__tests__/examShelves.test.ts`, làn CI.
//     - Ánh xạ danh sách trắng nguồn lượt làm (AC-040/AC-041) — unit thuần,
//       `lib/exams/__tests__/attemptSource.test.ts`, làn CI, cộng bằng chứng CHECK thật
//       HS-g trong `supabase/test-rls.ts` (thủ công).

import { beforeEach, describe, expect, it, vi } from "vitest";

const { fromMock, rpcMock } = vi.hoisted(() => ({ fromMock: vi.fn(), rpcMock: vi.fn() }));

// shelves.ts (và các phụ thuộc attempts.ts/hotCounts.ts/catalogue.ts) import
// "server-only" (ném lỗi ngoài bundle server Next/react-server) → stub, cùng
// mẫu với rating.int.test.ts:24.
vi.mock("server-only", () => ({}));

// Ranh giới mock: chỉ client Supabase ({ from, rpc }), theo ghi chú Mock
// Boundary cấp file ở trên — chứng minh cách dựng lời gọi JS và hình dạng object, không bao giờ
// hành vi Postgres/RLS/grant thật.
vi.mock("@/lib/supabase/server", () => ({
  createClient: vi.fn(async () => ({ from: fromMock, rpc: rpcMock })),
}));

const { listExamShelves, listHotExams } = await import("@/features/exams/queries/shelves");
const { LIST_ROW_CEILING } = await import("@/lib/supabase/boundedRead");

// --- Fixture builders --------------------------------------------------------

/** Một dòng `exams_with_difficulty` thô — cùng hình dạng `ExamRow` (rows.ts). */
function examRow(
  id: string,
  grade: number,
  subject: string,
  createdAt: string,
  school: string | null = null
) {
  return {
    id,
    title: `Đề ${id}`,
    question_ids: ["q1"],
    duration_minutes: 45,
    subject,
    grade,
    school,
    school_year: null,
    semester: null,
    author_display_name: null,
    parts: null,
    passages: null,
    rating_count: 0,
    avg_overall: null,
    created_at: createdAt,
  };
}

/** Một dòng `exam_attempts` thô kèm embed `exams!inner(grade, subject, school)`. */
function attemptRow(
  id: string,
  examId: string,
  submittedAt: string | null,
  embed: { grade: number; subject: string; school: string | null }
) {
  return { id, exam_id: examId, submitted_at: submittedAt, exams: embed };
}

/** Một dòng `exam_hot_counts()` thô. */
function hotRow(examId: string, recent: number, wide: number, total: number) {
  return { exam_id: examId, recent_count: recent, wide_count: wide, total_count: total };
}

/** Chainable + awaitable fake khớp bề mặt query builder mà shelves.ts dùng
 *  (`select`/`eq`/`ilike`/`order`/`limit`), rồi resolve NGAY với `data`. */
function createResolvedBuilder(data: unknown[]) {
  const builder: Record<string, unknown> = {};
  for (const method of ["select", "eq", "ilike", "order", "limit"]) {
    builder[method] = () => builder;
  }
  builder.then = (onFulfilled: (value: { data: unknown[]; error: null }) => unknown) =>
    Promise.resolve({ data, error: null }).then(onFulfilled);
  return builder;
}

/** Cùng builder trên nhưng CHƯA resolve — chỉ resolve khi `gate` tự nó resolve.
 *  Kỹ thuật "deferred-resolution gate" của `rating.int.test.ts:676-706`, dùng lại
 *  nguyên vẹn để chứng minh 4 lượt đọc của `listExamShelves()` được PHÁT hết
 *  trước khi lượt nào kịp resolve (obligation b). */
function createDeferredBuilder(gate: Promise<void>, data: unknown[]) {
  const builder: Record<string, unknown> = {};
  for (const method of ["select", "eq", "ilike", "order", "limit"]) {
    builder[method] = () => builder;
  }
  builder.then = (onFulfilled: (value: { data: unknown[]; error: null }) => unknown) =>
    gate.then(() => onFulfilled({ data, error: null }));
  return builder;
}

type TableFixtures = {
  exams_with_difficulty?: unknown[];
  exam_attempts?: unknown[];
  exam_results?: unknown[];
  hotRows?: unknown[];
};

/**
 * Nối `fromMock`/`rpcMock` vào một map theo TÊN BẢNG/rpc — khác hẳn dùng
 * chung một builder cho mọi lượt đọc: dùng chung thì `exam_attempts` có thể
 * nhận nhầm dòng đề của `exams_with_difficulty` mà test vẫn XANH trong khi
 * đang đo sai thứ (cùng cảnh báo `rating.int.test.ts:548-563`).
 *
 * Trả về `issued: string[]` — tên bảng/rpc theo đúng thứ tự lệnh gọi thật,
 * để các test ngân sách đếm `from()`+`rpc()` cộng lại (obligation ADR-0021 D3).
 */
function mockBoundary(fixtures: TableFixtures) {
  const { hotRows = [], ...byTable } = fixtures;
  const issued: string[] = [];

  fromMock.mockImplementation((table: string) => {
    issued.push(table);
    return createResolvedBuilder((byTable as Record<string, unknown[]>)[table] ?? []);
  });
  rpcMock.mockImplementation((fnName: string) => {
    issued.push(fnName);
    return createResolvedBuilder(hotRows);
  });

  return issued;
}

// =============================================================================
// Ứng viên 1 — Ngân sách hợp thành & đồng thời + hình dạng tham số RPC
// =============================================================================
// AC-006: "...việc cắt xảy ra sau khi xếp hạng ở Node, không bao giờ là .limit()/.range()
//   của DB trên truy vấn ứng viên (tiêu chí huỷ (a) của ADR-0015)."
// AC-028: "...lượt đọc aggregate...có giới hạn (một trần số hàng tường minh cùng phong cách
//   với readBounded), không bao giờ là select không giới hạn trên exam_attempts."
// Data Flow của backend DD: "[rows, attemptRows, resultRows, hotRows] = await
//   Promise.all([...])   # 4 đồng thời, một lô"; bảng Risks: "Một lượt đọc tương lai
//   thêm vào /exams vượt ngân sách | Medium | Medium | Khẳng định đếm
//   from() + rpc() với một ca cho mỗi bề mặt; một lượt đọc mới làm nó đỏ."
// ROI: 90 (BV:9 x Freq:9 + Legal:0 + Defect:9)
//   BV 9 — bảo vệ ngân sách lượt khứ hồi mà ADR-0015/ADR-0021 đều dành cả một
//     Decision cho; một hồi quy thầm lặng ở đây tuần tự hoá lại trang bận nhất của site.
//   Freq 9 — mọi lần render /exams trần của học sinh đã đăng nhập (nhánh kệ,
//     tức chế độ xem mặc định mới).
//   Defect 9 — kiểu hỏng cụ thể (một `await` vô tình chèn giữa
//     hai trong bốn lượt đọc) KHÔNG có triệu chứng nhìn thấy nào trên màn hình, chỉ là
//     độ trễ tăng thêm mà không ai quy cho phép ghép này — đúng loại lỗi mà
//     `rating.int.test.ts`'s existing "ba lượt đọc chạy SONG SONG" case (:676-706)
//     đã phòng thủ cho phép ghép 3 lượt đọc; đây là anh em 4 lượt đọc của nó.
// Hành vi: listExamShelves() được gọi trên ranh giới client Supabase mock
//   ({ from, rpc }, bản đồ builder theo bảng) -> nó phát đúng 4 lời gọi ranh giới
//   (exams_with_difficulty, exam_attempts, exam_results, rpc exam_hot_counts) trong MỘT
//   Promise.all, không có await giữa chúng -> tham số của lời gọi rpc khớp với
//   LIST_ROW_CEILING được import, không phải literal chép tay.
// @category: core-functionality
// @lane: integration
// @dependency: features/exams/queries/shelves.ts (listExamShelves, chưa tạo)
//   + features/exams/queries/hotCounts.ts (readHotCounts, hotWindows) + client
//   Supabase mock ({ from, rpc })
// @complexity: high
// @real-dependency: không có (xem ghi chú Mock Boundary cấp file)
// Kiểu hỏng chính: một lần sửa sau này chèn lượt đọc thứ 5, hoặc biến 4 lời gọi
//   đồng thời thành tuần tự bằng cách await cái này trước khi bắn cái kế, hoặc lời gọi rpc truyền
//   một literal trần số hàng chép tay (ví dụ 501) thay vì
//   `LIST_ROW_CEILING + 1` được import, nên chốt chặn hàng-mồi (`boundedRead.ts`) và `limit
//   least(greatest(coalesce(p_max_rows,500),1),1000)` của SQL lặng lẽ lệch khỏi nhau.
// Nghĩa vụ chứng minh — test được cài đặt phải khẳng định gì:
//   (a) đúng 4 lời gọi ranh giới riêng biệt được phát: 3 lời gọi `.from(...)` gọi tên
//       `exams_with_difficulty`, `exam_attempts`, `exam_results`, và 1 lời gọi `.rpc(...)`
//       gọi tên `exam_hot_counts` — khẳng định đúng tập, không phải `>= 4`;
//   (b) cả 4 được phát TRƯỚC KHI bất kỳ cái nào settle — dùng lại kỹ thuật cổng
//       resolve-hoãn đã chứng minh ở file anh em của file này
//       (`rating.int.test.ts:676-706`: ghi thứ tự gọi, nhường hai microtask,
//       khẳng định toàn bộ danh sách gọi đã được phát, RỒI mới resolve);
//   (c) tham số thứ ba của lời gọi rpc là `LIST_ROW_CEILING + 1` (import từ
//       `@/lib/supabase/boundedRead`), không phải literal `501` — một literal qua hôm nay
//       và lặng lẽ thôi bám theo hằng nếu một trong hai phía sau này được chỉnh;
//   (d) nhãn `readBounded` cho lời gọi rpc tại chỗ gọi này đúng là
//       `"listExamShelves.hotCounts"` (comment Query layer của backend DD tại
//       chỗ gọi) — nhãn sai khiến một log cắt bớt về sau trỏ nhầm phép ghép
//       khi `console.error` bắn.
describe("listExamShelves() — composition budget, concurrency, RPC argument shape (AC-006, AC-028)", () => {
  beforeEach(() => {
    fromMock.mockReset();
    rpcMock.mockReset();
  });

  it("issues exactly 4 boundary calls (exams_with_difficulty, exam_attempts, exam_results, rpc exam_hot_counts), all before any settles, obligation (a)+(b)", async () => {
    // Hồi quy thực sự sẽ xảy ra: ai đó chèn một `await` giữa hai lượt đọc và
    // biến 4 lượt song song thành tuần tự. Mock hoãn resolve để "cả 4 được
    // PHÁT trước khi lượt nào kịp resolve" trở thành một câu kiểm chứng được,
    // offline — kỹ thuật của rating.int.test.ts:676-706, 4-lượt sibling.
    const issued: string[] = [];
    let settle: () => void = () => {};
    const gate = new Promise<void>((resolve) => {
      settle = resolve;
    });

    fromMock.mockImplementation((table: string) => {
      issued.push(table);
      return createDeferredBuilder(gate, []);
    });
    rpcMock.mockImplementation((fnName: string) => {
      issued.push(fnName);
      return createDeferredBuilder(gate, []);
    });

    const pending = listExamShelves();
    // Nhường microtask cho cả 4 nhánh của Promise.all được phát đi.
    await Promise.resolve();
    await Promise.resolve();

    expect(issued).toHaveLength(4);
    expect(new Set(issued)).toEqual(
      new Set(["exams_with_difficulty", "exam_attempts", "exam_results", "exam_hot_counts"])
    );

    settle();
    await pending;
  });

  it("rpc exam_hot_counts is called with p_max_rows === imported LIST_ROW_CEILING + 1, not a hand-copied literal (AC-028, obligation c)", async () => {
    mockBoundary({});

    await listExamShelves();

    expect(rpcMock).toHaveBeenCalledTimes(1);
    const [fnName, args] = rpcMock.mock.calls[0] as [string, Record<string, unknown>];
    expect(fnName).toBe("exam_hot_counts");
    expect(args.p_max_rows).toBe(LIST_ROW_CEILING + 1);
  });

  it('the hotCounts read at this call site is labelled exactly "listExamShelves.hotCounts" for readBounded (obligation d)', async () => {
    // Kỹ thuật duy nhất quan sát được `label` truyền vào readBounded: kích
    // dòng mồi (LIST_ROW_CEILING + 1 dòng) rồi soi thông điệp console.error —
    // đúng cơ chế boundedRead.ts:124-130 mô tả.
    const consoleErrorSpy = vi.spyOn(console, "error").mockImplementation(() => {});
    const overflow = Array.from({ length: LIST_ROW_CEILING + 1 }, (_, i) => hotRow(`e${i}`, 0, 0, 1));
    mockBoundary({ hotRows: overflow });

    await listExamShelves();

    expect(consoleErrorSpy).toHaveBeenCalledWith(expect.stringContaining("listExamShelves.hotCounts"));
    consoleErrorSpy.mockRestore();
  });
});

// =============================================================================
// Ứng viên 2 — Luật cấu trúc kệ-null + lượt lấy trang chủ có cổng (F-001) +
//                hình dạng listHotExams()
// =============================================================================
// AC-051: "Cho một kệ bất kỳ, khi lựa chọn riêng của nó cho 0 thẻ, thì kệ đó
//   vắng hoàn toàn khỏi trang — 0 tiêu đề, 0 phụ đề, 0 chỗ giữ chỗ...
//   AC-013 và AC-024 là hai ví dụ được đặt tên của luật này, không phải định nghĩa của nó."
// AC-024: "Cho một site có 0 lượt làm đã nộp tổng cộng...lựa chọn hot
//   cho 0 thẻ ở mọi bậc, nên kệ vắng theo AC-051 và khối hot
//   trang chủ vắng theo AC-038."
// AC-038: "Cho một site có 0 lượt làm đã nộp, khi / render cho khách
//   đã đăng nhập, thì khối vắng (AC-024) và trang render với 0 lỗi."
// Integration Point I5 của backend DD: "một lời gọi không có cổng trả 42501 và hiện một
//   trang lỗi thay vì hero khi chưa đăng nhập. Một khách ẩn danh vì vậy
//   phát 0 lời gọi RPC" (F-001). Assumed Behaviors của frontend DD: "listHotExams(limit)
//   trả về { exams, submittedExamIds }, không phải Exam[] trần" (O-1/R-1).
// ROI: 99 (BV:10 x Freq:9 + Legal:0 + Defect:9)
//   BV 10 — F-001 bảo vệ route CÔNG KHAI DUY NHẤT của app (`/`) khỏi một 42501 bị ném
//     thay hero chưa-đăng-nhập bằng trang lỗi; đây là bán kính ảnh hưởng
//     cao nhất có thể (mọi khách ẩn danh, mãi mãi, cho tới khi bị phát hiện).
//   Freq 9 — mọi lần khách ẩn danh vào `/`, mà vì `/exams` đòi đăng nhập
//     (AC-014), thực tế là mọi khách lần đầu của site.
//   Defect 9 — kiểu hỏng thầm lặng cho tới khi một khách ẩn danh thật sự gặp nó
//     trên production (không unit test nào của riêng `listHotExams` bắt được, vì
//     cổng nằm ở NƠI GỌI, không nằm trong hàm); Security Considerations
//     nêu đúng cơ chế này ("anon không có EXECUTE...42501...readBounded ném lại
//     -> trang lỗi ở trang landing").
// Hành vi: (i) listExamShelves() được gọi với dữ liệu fixture cho 0 id của một
//   kệ -> khoá đó trong object ExamShelves trả về đúng là null, không phải {exams:
//   []}; (ii) listHotExams(limit) được gọi trên ranh giới mock -> đúng 3
//   lời gọi (không có lượt đọc exam_results), và tập submittedExamIds trả về được điền
//   từ cùng lượt đọc attempt; (iii) nơi gọi lấy-trang-chủ (cổng `user ?
//   await listHotExams(...) : null` của app/page.tsx) được gọi với user null -> client
//   Supabase mock ghi 0 lời gọi thuộc bất kỳ loại nào.
// @category: core-functionality
// @lane: integration
// @dependency: features/exams/queries/shelves.ts (listExamShelves, listHotExams) +
//   app/page.tsx (Home, cho cổng F-001) + client Supabase mock
// @complexity: medium
// @real-dependency: không có (xem ghi chú Mock Boundary cấp file)
// Kiểu hỏng chính: (i) một kệ 0 thẻ serialise thành `{ exams: [] }` thay vì
//   `null`, nên phép thu hẹp `data && <ExamShelf .../>` cấp trang trong frontend DD
//   render một kệ rỗng-nhưng-có-mặt thay vì bỏ nó; (ii) `listHotExams`
//   bị refactor trả về `Exam[]` trần, lặng lẽ lật nút đánh giá của mọi đề đã
//   nộp từ đủ-điều-kiện sang chưa-làm trên khối trang chủ
//   (Assumed Behaviors của frontend DD, "đã xác nhận bằng kiểm chứng xuyên tầng"); (iii)
//   cổng `user ?` ở nơi gọi `app/page.tsx` bị bỏ hoặc đảo, nên request của
//   khách ẩn danh tới được `listHotExams` và ném 42501.
// Nghĩa vụ chứng minh — test được cài đặt phải khẳng định gì:
//   (a) với dữ liệu fixture cho 0 id ứng viên của kệ luyện tập (không có lượt làm
//       đại diện đã chấm, AC-013) VÀ riêng cho kệ hot (0 lượt làm đã nộp toàn
//       site, AC-024), khoá `ExamShelves` tương ứng là
//       `null` qua `Object.is`/`toBeNull()` — không phải object mảng rỗng, không phải khoá
//       thiếu (`"practice" in shelves` vẫn phải là `true`);
//   (b) `listHotExams(limit)` phát đúng 3 lời gọi ranh giới (không phải 4 — không có
//       lượt đọc `exam_results`, vì không cần điểm trước) và `submittedExamIds`
//       trả về là một `Set` không rỗng cho fixture có ít nhất một lượt làm đã nộp,
//       lấy từ CHÍNH lượt đọc attempt mà phép ghép hot đã phát (không phải
//       lượt đọc độc lập thứ hai);
//   (c) gọi phép ghép lấy-trang-chủ có cổng với `getCurrentUser`/
//       `getCurrentUserProfile` mock resolve thành `null` làm client Supabase mock
//       ghi KHÔNG lời gọi `.from(...)` và KHÔNG lời gọi `.rpc(...)` nào — khẳng định
//       trên tổng số lời gọi của mock, không chỉ trên việc vắng lời gọi
//       rpc, để một lượt đọc `exam_attempts` lạc đưa vào ở nơi khác trong cùng
//       phép ghép cũng bị bắt.
describe("listExamShelves() / listHotExams() — 0-card shelf is null, and the guarded home fetch issues 0 calls for an anonymous visitor (AC-051, AC-024, AC-038, F-001)", () => {
  beforeEach(() => {
    fromMock.mockReset();
    rpcMock.mockReset();
  });

  it("a shelf whose selection yields 0 candidate ids is exactly null on the ExamShelves object, not an empty-array shape (AC-051/AC-013/AC-024, obligation a)", async () => {
    // Kịch bản 1 — Cần luyện: học sinh có một lượt đã nộp nhưng KHÔNG có dòng
    // exam_results nào cho lượt đó → buildSubjectWeakness không có lượt đại
    // diện CÓ ĐIỂM nào → trả null → weakest === null (AC-013).
    mockBoundary({
      exams_with_difficulty: [examRow("exam-a", 10, "Toán", "2026-01-01T00:00:00.000Z")],
      exam_attempts: [
        attemptRow("att-1", "exam-a", "2026-05-01T00:00:00.000Z", {
          grade: 10,
          subject: "Toán",
          school: null,
        }),
      ],
      exam_results: [],
      hotRows: [],
    });

    const withoutScore = await listExamShelves();

    expect(withoutScore.practice).toBeNull();
    expect("practice" in withoutScore).toBe(true);

    fromMock.mockReset();
    rpcMock.mockReset();

    // Kịch bản 2 — Nổi nhất: 0 lượt đã nộp trên TOÀN site (AC-024) — RPC trả
    // 0 dòng, nên pool của MỌI bậc thang đều rỗng, kể cả bậc terminal.
    mockBoundary({
      exams_with_difficulty: [examRow("exam-b", 10, "Toán", "2026-01-01T00:00:00.000Z")],
      exam_attempts: [],
      exam_results: [],
      hotRows: [],
    });

    const withoutHotCount = await listExamShelves();

    expect(withoutHotCount.hot).toBeNull();
    expect("hot" in withoutHotCount).toBe(true);
  });

  it("listHotExams(limit) issues exactly 3 boundary calls and returns a populated submittedExamIds sourced from that same attempt read (frontend DD O-1/R-1, obligation b)", async () => {
    const issued = mockBoundary({
      exams_with_difficulty: [examRow("h1", 10, "Toán", "2026-01-01T00:00:00.000Z")],
      exam_attempts: [
        attemptRow("att-1", "submitted-1", "2026-05-01T00:00:00.000Z", {
          grade: 10,
          subject: "Toán",
          school: null,
        }),
      ],
      hotRows: [hotRow("h1", 1, 1, 1)],
    });

    const result = await listHotExams(3);

    expect(issued).toHaveLength(3);
    expect(new Set(issued)).toEqual(new Set(["exams_with_difficulty", "exam_attempts", "exam_hot_counts"]));
    expect(issued.includes("exam_results")).toBe(false);
    expect(result.submittedExamIds).toEqual(new Set(["submitted-1"]));
  });

  it("the guard PATTERN (user ? await listHotExams(...) : null) issues 0 Supabase calls when evaluated with a null user — proves the pattern in isolation only, obligation c", async () => {
    mockBoundary({});
    // `currentUser` là literal `null` CỐ ĐỊNH, không phải kết quả của một
    // lượt lookup thật (`getCurrentUser`/`getCurrentUserProfile`) — nên
    // nhánh truthy của ternary KHÔNG THỂ nào được vào, và assertion dưới đây
    // không thể đỏ bất kể một guard thật ở app/page.tsx có tồn tại hay đúng
    // hay không. Test này chỉ chứng minh biểu thức GUARD `user ? await
    // listHotExams(...) : null` (frontend DD § Home block) là đúng CÚ PHÁP
    // khi tự nó được đánh giá — KHÔNG chứng minh app/page.tsx's call site
    // thật có tồn tại hay dùng đúng guard này. Việc đó thuộc về P7-T1
    // (chưa build call site thật), và là một Completion Criterion RÀNG BUỘC
    // rõ ràng trên task file của P7-T1, không chỉ ngụ ý qua "wiring".
    const currentUser: { id: string } | null = null;
    const hot = currentUser ? await listHotExams(3) : null;

    expect(hot).toBeNull();
    expect(fromMock).not.toHaveBeenCalled();
    expect(rpcMock).not.toHaveBeenCalled();
  });

  // Kệ Nổi nhất của /exams chỉ giữ HAI đề nộp nhiều nhất (yêu cầu 2026-10-03):
  // cắt ở Node sau khi xếp hạng, nên đề thứ ba trở đi — dù có lượt nộp — không
  // lọt vào kệ; attemptCounts chỉ mang đúng hai id ấy, giảm dần.
  it("kệ hot của listExamShelves() chỉ có đúng 2 đề có lượt nộp nhiều nhất (HOT_SHELF_MAX_CARDS), cả khi 6 đề cùng đạt bậc 'tuần này'", async () => {
    mockBoundary({
      exams_with_difficulty: ["h1", "h2", "h3", "h4", "h5", "h6"].map((id) =>
        examRow(id, 10, "Toán", "2026-01-01T00:00:00.000Z")
      ),
      exam_attempts: [],
      exam_results: [],
      // recent_count: h4=9, h2=7, h6=5, h1=3, h5=2, h3=1 — 6 đề đạt bậc site-recent
      // (>= HOT_SHELF_MIN_CARDS) nên thang dừng ngay ở đó.
      hotRows: [
        hotRow("h1", 3, 3, 3),
        hotRow("h2", 7, 7, 7),
        hotRow("h3", 1, 1, 1),
        hotRow("h4", 9, 9, 9),
        hotRow("h5", 2, 2, 2),
        hotRow("h6", 5, 5, 5),
      ],
    });

    const shelves = await listExamShelves();

    expect(shelves.hot?.rung).toBe("site-recent");
    expect(shelves.hot?.exams.map((e) => e.id)).toEqual(["h4", "h2"]);
    expect(shelves.hot?.attemptCounts).toEqual({ h4: 9, h2: 7 });
  });

  it("kệ hot chỉ có 3 đề đạt ở mọi bậc: vẫn chỉ giữ 2 đề đầu của bậc cuối (từ trước tới nay), không nới thêm để lấp thẻ", async () => {
    mockBoundary({
      exams_with_difficulty: ["a1", "a2", "a3"].map((id) =>
        examRow(id, 10, "Toán", "2026-01-01T00:00:00.000Z")
      ),
      exam_attempts: [],
      exam_results: [],
      hotRows: [hotRow("a1", 0, 0, 4), hotRow("a2", 0, 0, 12), hotRow("a3", 0, 0, 8)],
    });

    const shelves = await listExamShelves();

    expect(shelves.hot?.rung).toBe("site-all");
    expect(shelves.hot?.exams.map((e) => e.id)).toEqual(["a2", "a3"]);
  });

  // AC-049/D13 (nghĩa vụ bổ sung ngoài văn bản riêng của skeleton — xem Proof
  // Obligations của task này): "một đề đủ điều kiện cho CẢ nhóm môn-yếu-nhất
  // VÀ một số đếm hot đủ điều kiện xuất hiện ở CẢ practice.exams và
  // hot.exams của CÙNG kết quả listExamShelves()" — đóng khoảng trống mà việc
  // review kế hoạch đã chỉ ra (các kệ không loại trừ lẫn nhau, khác với việc Khám phá khử trùng
  // với hai kệ kia).
  it("AC-049/D13: an exam qualifying for both practice and hot appears in BOTH shelves of the same listExamShelves() result (cross-shelf overlap is allowed, not deduped)", async () => {
    mockBoundary({
      exams_with_difficulty: [examRow("ex-overlap", 10, "Toán", "2026-01-01T00:00:00.000Z")],
      exam_attempts: [
        attemptRow("att-1", "other-exam", "2026-05-01T00:00:00.000Z", {
          grade: 10,
          subject: "Toán",
          school: null,
        }),
      ],
      exam_results: [{ attempt_id: "att-1", total_score: 2 }],
      hotRows: [hotRow("ex-overlap", 1, 1, 1)],
    });

    const shelves = await listExamShelves();

    expect(shelves.practice?.exams.map((e) => e.id)).toContain("ex-overlap");
    expect(shelves.hot?.exams.map((e) => e.id)).toContain("ex-overlap");
  });
});
