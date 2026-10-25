// exam_hot_counts() — Kho đề theo kệ [service-integration-e2e] Test Skeleton
// Design Doc: docs/design/exam-shelves-backend-design.md (v1.2, § The SQL objects
//               :210-296, § Test Boundaries and Placement :609-633 "test-rls.ts
//               Phần 10 — thứ chứng minh aggregate không rò danh tính nào", dòng cho
//               đúng file này ở :620)
// ADR:        docs/adr/ADR-0021-cross-user-hot-aggregate-and-attempt-source.md
//               (D1 hình dạng aggregate + lập luận bảo mật, D6 điều DDL để yên)
// PRD:        docs/prd/exam-shelves-prd.md (v1.2, AC-018, AC-025, AC-027, AC-028)
// Sinh ngày:  2026-09-18 | Ngân sách đã dùng: service-integration-e2e 1/2 (1 giữ chỗ
//               suất 2 cố ý để trống — backend DD không nêu file service-e2e thứ hai
//               nào cho tính năng này, và không ứng viên nào khác ở đây cần Postgres
//               sống để chứng minh được)
//
//=============================================================================
// TRẠNG THÁI FILE — đọc trước khi sửa
// =============================================================================
// ĐÃ CÀI ĐẶT (P8-T4). Cả 6 nghĩa vụ chứng minh bên dưới là các ca `it` thật;
// `describe` được bọc trong `describe.skipIf(!HAS_LIVE_DB)`, import
// `HAS_LIVE_DB` từ `./examHotCountsFixtures` (P8-T3) — đúng hình dạng mà
// `exam-search.service.e2e.test.ts:31` đã dùng. `public.exam_hot_counts()`
// phải tồn tại trên database đích (Migration Procedure của backend DD,
// schema.sql §20c) trước khi chạy file này; `HAS_LIVE_DB` chỉ canh
// việc thiếu thông tin đăng nhập, không bao giờ canh việc migration đã đáp xuống — một lượt chạy đỏ
// trên database chưa nhận DDL trông như lỗi code mà không phải
// (comment đầu của `vitest.localdb.config.ts` nêu điều kiện tiên quyết cổng schema
// bằng chữ in hoa).
//
//LÀN NÀY CHẠY THẾ NÀO: `npm run test:localdb` (từ `SOURCE/`), tức
// `vitest run --config vitest.localdb.config.ts`, glob TOÀN BỘ thư mục
// `tests/e2e/service/**/*.test.{ts,tsx}` KHÔNG có danh sách loại — mọi file ở đây
// được thu thập vô điều kiện. Làn này chạy THỦ CÔNG / tự chọn — cố ý
// KHÔNG thuộc `npm test` hay cổng CI mặc định (chính
// header: "CHẠY TAY tại máy dev — cố ý tách khỏi npm test").
//
// MODULE FIXTURE: `SOURCE/tests/e2e/service/examHotCountsFixtures.ts` (P8-T3) —
// export lại `HAS_LIVE_DB`/`adminClient`/`anonClient` từ
// `essayGradeWriteFixtures.ts`, thêm `serviceClient()` riêng, tiền tố cô lập
// `HC_PREFIX`, và `setUp`/`tearDown`. `setUp` gieo hai user thật (A =
// luôn là người gọi RPC, không bao giờ bị cấm; B = người nộp và tác giả bị
// cấm/bỏ cấm) và bốn đề (`published`, `unpublished`, `bannedAuthor`,
// `hourBoundary`) với các hàng `exam_attempts` có hình dạng cho các nghĩa vụ (a)-(f) bên dưới
// — xem comment đầu của chính file đó để biết từng id đề chứng minh gì và vì sao A
// không bao giờ được dùng lại cho vai tác giả bị cấm.
//
// -----------------------------------------------------------------------------
// RANH GIỚI MOCK — ngược lại với mọi làn khác trong đợt sinh này
// -----------------------------------------------------------------------------
// KHÔNG GÌ BỊ MOCK. Test Boundaries của backend DD nêu đây là luật cứng, không phải
// sở thích: "hành vi, grant, vị từ và cô lập RLS của hàm
// không bao giờ bị mock — chỉ Postgres thật mới chứng minh được rằng một hàm definer đếm hàng của
// người dùng khác, rằng anon bị từ chối, hay rằng một grant đã đáp xuống." Mọi khẳng định
// bên dưới chạy trên instance Postgres dev thật (ref `hynwleaxtbtjzkvpjsug`),
// qua các `SupabaseClient` thật mang JWT thật của hai user đã gieo thật.
// @real-dependency: Postgres (dev), `exam_attempts`, `exams`, `exam_hot_counts()`
//   và các grant/revoke của nó — không cái nào bị mock; đó là toàn bộ ý nghĩa
//   của việc làn này tồn tại tách khỏi `shelves.int.test.ts`.
//
// -----------------------------------------------------------------------------
// VÌ SAO ĐÂY LÀ SUẤT GIỮ CHỖ, KHÔNG PHẢI một lựa chọn cơ hội ROI>50
// -----------------------------------------------------------------------------
// Theo luật suất-giữ-chỗ: một suất service-integration-e2e được giữ khi tính đúng của
// hành trình phụ thuộc hành vi xuyên dịch vụ/xuyên ranh giới thật mà
// fixture-e2e (backend bị mock) không kiểm chứng được. Một hàm `security definer`
// vượt qua ranh giới RLS `exam_attempts` của người dùng khác CHÍNH LÀ lớp khẳng định đó
// — một client `{ from, rpc }` bị mock có thể khẳng định "code gọi rpc() với
// các tham số này" nhưng không bao giờ chứng minh được đối tượng nó gọi (a) thực sự
// bỏ qua RLS, (b) thực sự loại `anon`, hay (c) thực sự loại một đề
// chưa đăng/tác giả bị cấm khi Postgres thật đánh giá các vị từ của nó.
// ROI: 110 (BV:10 x Freq:10 + Legal:0 + Defect:10)
//   BV 10 — một lần rò ở đây là sự cố quyền riêng tư thật (danh tính hay hoạt động của học sinh
//     khác vượt qua một ranh giới mà PRD/ADR đều nêu phải chỉ là aggregate),
//     không phải hồi quy UX.
//   Freq 10 — MỘT RPC này nằm dưới mọi lần render kệ hot, mọi lưới phẳng ?sort=hot,
//     và mọi lần render khối trang chủ, cho mọi người dùng đã đăng nhập — tần suất gọi
//     cao nhất trong mọi bề mặt mới mà tính năng này thêm.
//   Defect 10 — tối đa: không làn nào khác ngoài làn này và bộ `test-rls.ts` thủ công
//     phát hiện được một lỗi bỏ-qua-RLS hay grant; một test bị mock không thể
//     hỏng kiểu này kể cả khi hàm thật hỏng.
// Hành vi: hai user học sinh thật, khác nhau, đã gieo (A, B) tồn tại trên dev, mỗi người
//   có các hàng `exam_attempts` riêng -> client authenticated của A gọi
//   `exam_hot_counts(...)` -> hàng trả về cho một đề CHỈ B nộp
//   có `total_count >= 1`, chứng minh aggregate vượt người dùng qua JWT thật ->
//   tập khoá của hàng trả về đúng là bốn cột đã khai báo, chứng minh không cột
//   danh tính/timestamp/điểm nào rò -> các hàng cho một lượt in_progress, một
//   đề chưa đăng và một đề của tác giả bị cấm đều vắng -> các biên cửa sổ
//   được căn theo GIỜ phía server, không theo tham số thô của người gọi ->
//   `p_max_rows` kẹp theo các hằng `LIST_ROW_CEILING`/`POSTGREST_MAX_ROWS` đã import,
//   không phải literal chép tay -> anon nhận 42501; service_role nhận một
//   mảng.
// @category: core-functionality
// @lane: service-integration-e2e
// @dependency: toàn hệ thống (Postgres dev thật, Supabase Auth thật, RLS thật,
//   `public.exam_hot_counts()`) + `examHotCountsFixtures.ts`
// @complexity: high
// @real-dependency: Postgres (dev, ref hynwleaxtbtjzkvpjsug), exam_attempts, exams,
//   exam_hot_counts() — xem Mock Boundary ở trên; không gì trong file này được mock
// Kiểu hỏng chính: hàm được triển khai không có `security definer` (hoặc
//   grant cho `authenticated` thiếu/sai cấu hình), nên lời gọi `exam_hot_counts` của A
//   trả 0 hàng / lỗi quyền thay vì đếm lượt nộp thật của B — đúng kiểu hỏng mà
//   Verification Strategy của chính backend DD gọi là "giả định duy nhất mà cả tính năng dựa vào...
//   kiểm được bằng một truy vấn", nay được tự động hoá thay vì chỉ
//   kiểm một lần bằng tay trên dev. Kiểu hỏng thứ hai, tinh vi hơn: hàng trả về mang thêm một cột (ví dụ
//   một `submitted_at` hay `user_id` mà chữ ký `returns table` bị mở rộng
//   gồm nhầm) — HS-c được viết chính vì "chỉ khẳng định giá trị
//   sẽ qua trong khi một cột đã rò."
// Nghĩa vụ chứng minh — test được cài đặt phải khẳng định gì:
//   (a) HS-b (bằng chứng xuyên người dùng): chỉ user B có lượt đã nộp trên một
//       đề cho trước, lời gọi `.rpc("exam_hot_counts", {...})` authenticated của user A
//       trả một hàng cho id đề đó với `total_count >= 1` — một client bị mock
//       không bao giờ hỏng kiểu này kể cả khi grant thật hỏng, đó là
//       toàn bộ biện minh cho việc làn này tồn tại;
//   (b) HS-c (bằng chứng rò): với ít nhất một hàng trả về,
//       `Object.keys(row).sort()` đúng là
//       `["exam_id", "recent_count", "total_count", "wide_count"]` — không `user_id`,
//       `submitted_at`, `id` hay `total_score` — khẳng định TẬP KHOÁ, không chỉ rằng
//       các giá trị kỳ vọng có mặt, theo cảnh báo tường minh của chính backend DD;
//   (c) một lượt `in_progress` (không phải `submitted`) đóng góp 0 vào mọi số đếm của
//       đề; một đề có `exams.status <> 'published'` vắng hoàn toàn khỏi
//       tập kết quả, dù nó có lượt đã nộp đủ điều kiện; một đề mà tác giả bị cấm
//       (`auth.admin.updateUserById(..., {
//       ban_duration })`) vắng, rồi có mặt lại khi lệnh cấm được gỡ
//       (phản chiếu HS-d/HS-f của `test-rls.ts`, tự động hoá ở đây cho độ phủ gần-CI);
//   (d) BIÊN CỬA SỔ CĂN THEO GIỜ: gieo một lượt 1 giây trước
//       `date_trunc('hour', p_since_recent)` và một lượt 1 giây sau nó —
//       khẳng định lượt đầu BỊ LOẠI khỏi `recent_count` và lượt sau
//       ĐƯỢC TÍNH, chứng minh biên được căn phía server theo giờ của
//       tham số do người gọi cấp, không theo chính tham số thô (cơ chế
//       ngăn một người giữ JWT chia đôi trục thời gian để xác định vị trí lượt nộp
//       của học sinh khác tới từng giây);
//   (e) kẹp `p_max_rows` được khẳng định theo các hằng `LIST_ROW_CEILING` /
//       `POSTGREST_MAX_ROWS` ĐÃ IMPORT từ `@/lib/supabase/boundedRead`, không
//       theo literal chép tay (501/1000) — một thay đổi ở bất kỳ phía nào của đẳng thức đó
//       phải làm nghĩa vụ này đỏ, theo chỉ dẫn của chính backend DD
//       ("ca kẹp của service e2e khẳng định theo các hằng đã import...để một thay đổi ở
//       bất kỳ phía nào làm ca đó đỏ thay vì trôi lệch");
//   (f) BIÊN GRANT: lời gọi `exam_hot_counts` của một client ẩn danh resolve
//       ra một mảng không lỗi từ schema.sql §29 (2026-10-12: khách duyệt được /exams;
//       trước đó là `error.code === "42501"`); lời gọi của một client
//       `service_role` resolve ra một mảng không lỗi (phản chiếu
//       HS-e).

import type { SupabaseClient } from "@supabase/supabase-js";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { LIST_ROW_CEILING, POSTGREST_MAX_ROWS } from "@/lib/supabase/boundedRead";
import {
  anonClient,
  HAS_LIVE_DB,
  HC_PREFIX,
  serviceClient,
  setUp,
  tearDown,
  type HotCountsFixture,
} from "./examHotCountsFixtures";

const SLOT = "hc1";

describe.skipIf(!HAS_LIVE_DB)(
  "exam_hot_counts() — real Postgres dev: cross-user count, leak-proof column set, exclusion predicates, hour-snapped windows, row-cap clamp, grant boundary (AC-018, AC-025, AC-027, AC-028)",
  () => {
    const admin = serviceClient();
    let fx: HotCountsFixture | undefined;

    beforeAll(async () => {
      fx = await setUp(admin, SLOT);
    }, 60_000);

    afterAll(async () => {
      await tearDown(admin, fx, SLOT);
    }, 60_000);

    /** Hình dạng một hàng `exam_hot_counts()` trả — khai LOCAL, không import từ
     *  `hotCounts.ts` (không export ở đó): obligation (b) cần đọc tập khoá THẬT
     *  của hàng trả về, nên file này không được áp một hình dạng lên nó trước. */
    type HotCountsRow = {
      exam_id: string;
      recent_count: number | string | null;
      wide_count: number | string | null;
      total_count: number | string | null;
    };

    /** Điểm gọi RPC DÙNG CHUNG cho cả sáu obligation — cùng lý do `hotCounts.ts`
     *  giữ một điểm gọi duy nhất: đối số mặc định (`hourBoundaryArgs` của fixture,
     *  `p_max_rows: 500`) không tự nó chứng minh gì, `overrides` mới là nơi từng
     *  ca nói ra đúng đối số đang kiểm. */
    async function callHotCounts(
      client: SupabaseClient,
      overrides: Partial<{ p_since_recent: string; p_since_wide: string; p_max_rows: number }> = {}
    ): Promise<{ data: HotCountsRow[] | null; error: { code?: string; message: string } | null }> {
      const { data, error } = await client.rpc("exam_hot_counts", {
        p_since_recent: fx!.hourBoundaryArgs.sinceRecent,
        p_since_wide: fx!.hourBoundaryArgs.sinceWide,
        p_max_rows: 500,
        ...overrides,
      });
      return { data: data as HotCountsRow[] | null, error };
    }

    it("user A's authenticated call counts an exam only user B submitted (HS-b, obligation a)", async () => {
      const { data, error } = await callHotCounts(fx!.userA.client);
      expect(error).toBeNull();
      const row = data!.find((r) => r.exam_id === fx!.examIds.published);
      expect(row).toBeDefined();
      expect(Number(row!.total_count)).toBeGreaterThanOrEqual(1);
    });

    it(
      "a returned row's key set is exactly {exam_id, recent_count, wide_count, total_count} — no user_id/submitted_at/id/total_score (HS-c, obligation b)",
      async () => {
        const { data, error } = await callHotCounts(fx!.userA.client);
        expect(error).toBeNull();
        const row = data!.find((r) => r.exam_id === fx!.examIds.published);
        expect(row).toBeDefined();
        expect(Object.keys(row!).sort()).toEqual(["exam_id", "recent_count", "total_count", "wide_count"]);
      }
    );

    it(
      "in_progress attempts, unpublished exams and banned-author exams are excluded; a banned author's exam reappears once the ban is lifted (HS-d/HS-f, obligation c)",
      async () => {
        const before = await callHotCounts(fx!.userA.client);
        expect(before.error).toBeNull();

        // published: chỉ attempt SUBMITTED của B được cộng — attempt in_progress
        // của A trên CHÍNH đề này không được cộng vào total_count.
        const publishedRow = before.data!.find((r) => r.exam_id === fx!.examIds.published);
        expect(publishedRow).toBeDefined();
        expect(Number(publishedRow!.total_count)).toBe(1);

        // unpublished (status='draft'): vắng mặt dù B đã nộp một attempt hợp lệ.
        expect(before.data!.some((r) => r.exam_id === fx!.examIds.unpublished)).toBe(false);

        // bannedAuthor: có mặt TRƯỚC khi ban.
        expect(before.data!.some((r) => r.exam_id === fx!.examIds.bannedAuthor)).toBe(true);

        const { error: banErr } = await admin.auth.admin.updateUserById(fx!.userB.userId, {
          ban_duration: "24h",
        });
        expect(banErr).toBeNull();

        const during = await callHotCounts(fx!.userA.client);
        expect(during.error).toBeNull();
        expect(during.data!.some((r) => r.exam_id === fx!.examIds.bannedAuthor)).toBe(false);

        const { error: unbanErr } = await admin.auth.admin.updateUserById(fx!.userB.userId, {
          ban_duration: "none",
        });
        expect(unbanErr).toBeNull();

        const after = await callHotCounts(fx!.userA.client);
        expect(after.error).toBeNull();
        expect(after.data!.some((r) => r.exam_id === fx!.examIds.bannedAuthor)).toBe(true);
      },
      30_000
    );

    it(
      "window boundaries snap to the HOUR server-side: an attempt 1s before date_trunc('hour', p_since_recent) is excluded, 1s after is included (obligation d)",
      async () => {
        const { data, error } = await callHotCounts(fx!.userA.client);
        expect(error).toBeNull();
        const row = data!.find((r) => r.exam_id === fx!.examIds.hourBoundary);
        expect(row).toBeDefined();
        // recent_count chỉ đếm attempt gieo 1s SAU mốc chẵn giờ đã date_trunc — cái
        // gieo 1s TRƯỚC mốc đó bị loại. Nếu server dùng thẳng đối số thô (lệch 37
        // phút so với mốc chẵn) thay vì date_trunc('hour', ...), CẢ HAI attempt đều
        // rơi trước ngưỡng thô đó và recent_count sẽ đọc 0, không phải 1.
        expect(Number(row!.recent_count)).toBe(1);
        expect(Number(row!.total_count)).toBe(2);
      }
    );

    it(
      "p_max_rows clamps against the imported LIST_ROW_CEILING/POSTGREST_MAX_ROWS constants, not hand-copied literals (obligation e)",
      async () => {
        // Gieo NHIỀU HƠN LIST_ROW_CEILING đề ứng viên thật (published, có attempt
        // submitted) để trần thật sự phải cắt bớt — không thì phép thử này rỗng.
        const clampCount = LIST_ROW_CEILING + 20;
        const clampExamIds = Array.from({ length: clampCount }, (_, i) => `${HC_PREFIX}${SLOT}-clamp-${i}`);
        const clampExams = clampExamIds.map((id) => ({
          id,
          title: `${HC_PREFIX}${SLOT} clamp exam`,
          question_ids: [] as string[],
          duration_minutes: 30,
          subject: "Toán",
          grade: 10,
          status: "published",
        }));
        const { error: examErr } = await admin.from("exams").insert(clampExams);
        expect(examErr).toBeNull();

        const clampAttempts = clampExamIds.map((examId) => ({
          user_id: fx!.userB.userId,
          exam_id: examId,
          status: "submitted",
          submitted_at: new Date().toISOString(),
        }));
        const { error: attemptErr } = await admin.from("exam_attempts").insert(clampAttempts);
        expect(attemptErr).toBeNull();
        // `${HC_PREFIX}${SLOT}-clamp-*` khớp đúng tiền tố `tearDownBySlot` đã dọn
        // (`${HC_PREFIX}${slot}-%`) — không cần dọn riêng ở đây.

        // "Trước": một lượt đọc KHÔNG bị cắt (p_max_rows dưới POSTGREST_MAX_ROWS,
        // nhưng vượt xa số ứng viên vừa gieo) chứng minh tập ứng viên thật trên dev
        // đã VƯỢT LIST_ROW_CEILING — tiền đề khiến phép cắt dưới đây có ý nghĩa để
        // quan sát, không rỗng.
        const unclamped = await callHotCounts(fx!.userA.client, { p_max_rows: 999 });
        expect(unclamped.error).toBeNull();
        expect(unclamped.data!.length).toBeGreaterThan(LIST_ROW_CEILING);

        // "Sau": đúng hình dạng lời gọi thật (`hotCounts.ts`'s
        // `p_max_rows: LIST_ROW_CEILING + 1`) bị cắt ở
        // min(LIST_ROW_CEILING + 1, POSTGREST_MAX_ROWS) — TÍNH từ hai hằng số NHẬP,
        // không chép tay, nên một lần chỉnh lại của một trong hai hằng kéo theo kỳ
        // vọng này thay vì để nó trôi lệch.
        const clamped = await callHotCounts(fx!.userA.client, { p_max_rows: LIST_ROW_CEILING + 1 });
        expect(clamped.error).toBeNull();
        expect(clamped.data!.length).toBe(Math.min(LIST_ROW_CEILING + 1, POSTGREST_MAX_ROWS));
      },
      30_000
    );

    it("anon and service_role both get an array (HS-e, obligation f; §29 2026-10-12)", async () => {
      // §29: khách vào /exams và kệ "Nổi nhất" cần hàm này, nên EXECUTE đã mở
      // cho anon. Hàm chỉ trả số lượt nộp theo id đề published — không danh tính.
      // (Trước 2026-10-12 vế này khẳng định 42501.)
      const anonResult = await callHotCounts(anonClient());
      expect(anonResult.error).toBeNull();
      expect(Array.isArray(anonResult.data)).toBe(true);

      const serviceResult = await callHotCounts(serviceClient());
      expect(serviceResult.error).toBeNull();
      expect(Array.isArray(serviceResult.data)).toBe(true);
    });
  }
);
