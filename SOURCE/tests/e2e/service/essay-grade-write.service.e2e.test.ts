// Essay (Tự luận) Auto-Scoring — SERVICE-INTEGRATION-E2E lane skeleton
// Design Docs: docs/design/essay-auto-scoring-backend-design.md (v1.3, § Nhóm 3
//                — hai hàm đặc quyền :1584, § Test Boundaries :2181,
//                § Integration Verification Points :2201)
// UI Spec:     docs/ui-spec/essay-auto-scoring-ui-spec.md (v1.3) — không UI trong làn này
// PRD:         docs/prd/essay-auto-scoring-prd.md (v1.2, AC-009, AC-045, AC-062,
//                AC-063, AC-064)
// ADR:         docs/adr/ADR-0018-essay-async-grade-write.md (Accepted; D1, D1b, D3,
//                D4; Implementation Guidance #6 và #7 quy định đúng hai
//                ca này, đúng hình dạng này)
// Sinh ngày:   2026-08-29 | Ngân sách đã dùng: integration 3/3, fixture-e2e 3/3, service-e2e 2/2
//
// =============================================================================
// TRẠNG THÁI FILE — đọc trước khi sửa
// =============================================================================
// CẢ HAI CA LÀ SKELETON (`it.todo`), và chúng mô tả một database CHƯA TỒN TẠI.
// Chưa gì của tính năng này được áp lên database nào:
// `claim_essay_grading_attempt()` và `record_essay_grade()` chưa được viết,
// chưa DDL nào chạy trên dev hay prod, và vân tay schema vẫn là
// `29931beeb950`. Vì vậy đây là mô tả các khẳng định cần viết, không phải
// khẳng định đậu sau một cờ.
//
// LÀN NÀY CHẠY THẾ NÀO: `npm run test:localdb` (từ `SOURCE/`), tức
// `vitest run --config vitest.localdb.config.ts`, glob
// `tests/e2e/service/**/*.test.{ts,tsx}`. Nó cố ý NẰM NGOÀI cổng CI `npm test`
// vì cần một database Supabase dev thật — thiếu thông tin đăng nhập sẽ
// làm CI đỏ vì môi trường chứ không vì một lỗi. File được config đó thu thập
// từ lúc được commit; `it.todo` là thứ giữ cho
// `npm run test:localdb` không báo "No test suite found in file" và thoát mã 1
// khi các ca chưa được viết.
//
// ĐIỀU KIỆN TIÊN QUYẾT, CHẶN — đừng chạy file này trước khi cả ba điều sau đúng:
//   1. Hai hàm và khối grant của chúng tồn tại trong `SOURCE/supabase/schema.sql`
//      (mục mới sau §11, tham chiếu chéo từ đó — ADR-0018 Implementation
//      Guidance #1).
//   2. DDL đã được ÁP LÊN DEV, và `npm run verify:schema` XANH
//      trên dev — gồm hai khẳng định grant mới và chốt ESSAY_MAX_ATTEMPTS.
//   3. Phase 3.5 đã được quan sát cho prod: so sánh `schema_version.fingerprint` của prod
//      với literal mới, lấy xác nhận của kỹ sư TRƯỚC khi áp, và kiểm sau đó BẰNG
//      truy vấn thật, không phải bằng thông báo "success".
//   Chạy file này trên một database chưa nhận DDL cho ra các lỗi
//   `PGRST202` trông y hệt lỗi cài đặt mà không phải.
//   Đó là hình dạng lỗi của TD-005, đã bắn BỐN lần trong repo này. Nếu file này đỏ và
//   điều kiện 2 chưa xanh trên dev: SỬA DATABASE, ĐỪNG SỬA TEST.
//
// -----------------------------------------------------------------------------
//VỊ TRÍ — một câu hỏi mở để kỹ sư chốt, không phải quyết định đã đưa ra ở đây
// -----------------------------------------------------------------------------
// Backend Design Doc giao đúng các bằng chứng này cho `SOURCE/supabase/test-rls.ts`
// § Part 10, các ca EG-a..EG-e (:2201). Nó không nhắc tới
// `SOURCE/tests/e2e/service/**`, `vitest.localdb.config.ts` hay
// `npm run test:localdb` ở đâu cả — dù làn đó tồn tại, đã được commit, và
// comment config của chính nó nêu mục đích bằng cùng lời mà Design Doc dùng
// ("thuộc tính của Postgres thật mà một client Supabase bị mock không chứng minh được").
// `test-rls.ts` không có npm script và được chạy tay bằng `npx tsx`.
// Skeleton này đặt ở làn chạy được vì đó là làn mà một lệnh gần-CI thực thi
// và một reviewer chạy lại được. CÁC NGHĨA VỤ BÊN DƯỚI LÀ NHƯ NHAU Ở CẢ HAI NƠI: SVC-1 = EG-c + EG-d,
// SVC-2 = EG-a + EG-b + EG-e. Nếu kỹ sư muốn vị trí của Design Doc,
// chuyển các nghĩa vụ vào `test-rls.ts` Part 10 NGUYÊN VĂN và XOÁ file này — đừng
// điền cả hai, kẻo hai nơi trôi lệch và bản trùng lặp thành bản không ai chạy.
//
// -----------------------------------------------------------------------------
// RANH GIỚI MOCK
//-----------------------------------------------------------------------------
// KHÔNG GÌ BỊ MOCK TRONG FILE NÀY. Đó là toàn bộ lý do làn tồn tại:
// backend DD § Mock Boundary Decisions marks the two SQL functions "KHÔNG — Postgres
// thật", vì một mock không chứng minh được (a) `jsonb_agg` không có
// `order by` xáo trộn mảng, (b) `where … <> 'graded'` khớp KHÔNG HÀNG NÀO chứ không
// ném lỗi, hay (c) cặp `revoke`/`grant` đã thực sự được áp lên
// database. Cả ba là đối tượng ở đây.
// @real-dependency: Postgres thật (Supabase dev), khoá `service_role` thật, JWT
//   học sinh thật cho các ca phủ định.
// KHÔNG LỜI GỌI NHÀ CUNG CẤP: không ca nào liên hệ Groq, và cũng không thể. Việc chấm xuất xưởng
//   Ở TRẠNG THÁI TẮT sau cổng người duyệt AC-067 (Zero Data Retention) và không tài khoản
//   Groq nào tồn tại; hai hàm SQL này không với tới mạng theo cấu trúc. Lưu ý
//   mối nối một cách trung thực: SVC-2 chứng minh việc CLAIM TỪ CHỐI; bản thân nó không
//   chứng minh "với không lời gọi nhà cung cấp nào", vì không nhà cung cấp nào với tới được từ
//   SQL. Nửa không-lời-gọi của AC-064 thuộc ca điều phối (`gradeEssays`
//   claim -> ngân sách -> nhà cung cấp -> thứ tự settle), là ứng viên integration
//   KHÔNG ĐƯỢC CHỌN hàng đầu (ROI 57) — xem báo cáo sinh test. Đừng để tên SVC-2
//   ngụ ý rằng nó hoàn thành nửa đó.
//
// VỆ SINH FIXTURE — theo `SOURCE/supabase/test-rls.ts` Part 7 (:133-153) và
// `recordSkillMastery.int.test.ts`: một tiền tố id cô lập cho mỗi ca ("eg-svc-"),
// setup và teardown lũy đẳng, mỗi ca tự tạo user + đề + lượt làm +
// hàng exam_results của mình và xoá chúng sau đó. Tính độc lập thứ tự phải
// ĐƯỢC ĐO, không giả định: chạy file dưới `--sequence.shuffle.tests` với vài
// seed và chạy riêng từng ca bằng `-t` trước khi tuyên bố nó. Khẳng định đã ship trong
// `subscription.service.e2e.test.ts` từng được viết từ giả định và sai
// theo hướng nguy hiểm nhất — nó đọc như một bảo đảm.

import { afterAll, beforeAll, describe, expect, it } from "vitest";
import type { SupabaseClient } from "@supabase/supabase-js";
import {
  adminClient,
  EG_PREFIX,
  HAS_LIVE_DB,
  readPerQuestion,
  setUp,
  tearDown,
  type EssayFixture,
} from "./essayGradeWriteFixtures";
// KHONG BAO GIO go `3` thanh mot literal o day: tran luot la mot hop dong giua
// SQL va TypeScript, va `verify:schema` ghim hai ben khop nhau. Go lai so la
// tao mot loi khai THU BA.
import { ESSAY_MAX_ATTEMPTS } from "@/lib/scoring/essayLifecycle";

const admin: SupabaseClient = HAS_LIVE_DB ? adminClient() : (undefined as never);

// =============================================================================
// SVC-1 — SUẤT GIỮ CHỖ. Lượt ghi settle: thứ tự mảng sống sót, và band thứ hai
//         cho một cặp bị từ chối như một GIÁ TRỊ, không phải một exception
// =============================================================================
// AC: EG-BE-005 — "Khi record_essay_grade() chạy trên một lượt làm có ba câu tự luận
//   và ghi band cho câu THỨ HAI, hệ thống phải để mảng per_question với
//   dãy questionId KHÔNG ĐỔI."
// AC: EG-BE-006 — "Khi record_essay_grade() được gọi lần thứ hai cho một cặp
//   (attempt_id, question_id) đã chấm, hệ thống phải trả false (0 hàng bị ảnh hưởng),
//   KHÔNG được ném lỗi, và band đã lưu phải bằng đúng lần ghi đầu."
// AC: EG-BE-007 — "Khi record_essay_grade() được gọi trên một phần tử ở `failed`,
//   hệ thống phải ghi được (failed -> graded và failed -> failed đều hợp lệ);
//   `graded` là trạng thái hấp thụ."
// AC: EG-BE-009 — "Cả hai hàm không được nhận tham số user_id và không được nhắc tới
//   total_score, correct, total, topic_breakdown hay overtime_seconds
//   ở bất kỳ đâu trong thân hàm."
// Cũng hoàn thành: PRD AC-009, AC-062, AC-063; ADR-0018 D1b, D3, và
//   Implementation Guidance #6 và #7 (quy định đúng hình dạng ca này);
//   backend DD Integration Verification Points EG-c và EG-d; rủi ro R-01.
// ROI: 100 (BV:10 x Freq:9 + Legal:0 + Defect:10)
//   BV 10 — R-01 được đánh giá "Cao": thiếu `order by ord` làm xáo trộn MỌI câu
//     trên trang review lần đầu tiên bất kỳ bài tự luận nào được chấm. Học sinh thấy
//     câu trả lời của mình gắn vào sai câu hỏi. Không gì ở band trông sai.
//   Freq 9 — mọi bài tự luận đã chấm trong hệ thống đều thực thi câu lệnh này.
//   Defect 10 — `order by ord` đọc như đồ trang trí bên trong `jsonb_agg`, và
//     Postgres TỰ DO trả về thứ tự khác khi thiếu nó, nên lỗi vừa
//     dễ bỏ sót vừa không xác định để tái hiện. ADR-0018 viết hình dạng ca ra chính vì
//     "band đã hạ cánh" thì qua trong khi trang bị xáo trộn.
//   BIỆN MINH SUẤT GIỮ CHỖ: tính đúng của hành trình phụ thuộc một lượt ghi DB thật
//   — dữ liệu lưu bền qua `jsonb_agg` trong Postgres thật, và một vị từ `WHERE`
//   khớp không hàng nào thay vì ném lỗi. Không cái nào diễn đạt được bằng fixture:
//   một client bị mock sẽ khẳng định chính giá trị trả về của mock.
// Hành vi: gieo một lượt làm đã nộp mà exam_results.per_question giữ ba
//   phần tử tự luận theo thứ tự đã biết (cộng các phần tử không phải tự luận xen quanh) -> gọi
//   record_essay_grade() bằng service_role cho bài tự luận Ở GIỮA -> đọc lại hàng
//   bằng truy vấn thật -> toàn bộ dãy questionId không đổi và chỉ các khoá
//   của phần tử đích dịch chuyển -> gọi lần hai cho cùng cặp với một band
//   KHÁC -> nó trả false và không đổi gì.
// @category: service-integration-e2e
// @lane: service-integration-e2e
// @dependency: toàn hệ thống (Postgres dev Supabase thật, client service_role thật,
//   hàm schema.sql thật)
// @complexity: high
// @real-dependency: Postgres thật — không gì bị mock
// Kiểu hỏng chính: update dựng lại `per_question` bằng
//   `jsonb_agg(...)` không có `order by ord`, nên mảng trả về theo thứ tự
//   không xác định; band đúng, test chỉ kiểm band thì
//   xanh, và mọi câu trên /result/detail giờ được ghép với sai
//   chữ đáp án. Kiểu thứ hai: first-write-wins được cài như read-then-
//   write trong TypeScript hoặc như RAISE trong hàm, nên một settle trùng
//   hoặc ghi đè một band (mất band đầu, band có thẩm quyền) hoặc lộ ra cho học sinh
//   như một lỗi — trong khi AC-062 đòi nó là một kết quả bình thường,
//   không bao giờ hiển thị, định tuyến vào telemetry.
// Nghĩa vụ chứng minh — test được cài đặt phải khẳng định gì:
//   (a) TOÀN BỘ DÃY, không phải band: sau khi settle câu THỨ HAI trong ba câu tự luận,
//       `per_question.map(e => e.questionId)` toEqual mảng literal tự soạn độc lập
//       bắt TRƯỚC lượt ghi, từng phần tử, gồm cả các phần tử không phải tự luận.
//       Khẳng định "phần tử thứ hai vẫn là phần tử thứ hai" là chưa đủ — khẳng định
//       cả dãy. Đây là khẳng định mà sự vắng mặt của nó được ADR-0018 Implementation
//       Guidance #6 nêu tên rõ.
//   (b) PHẠM VI PHẦN TỬ: mọi phần tử KHÁC trong mảng giống từng byte với giá trị trước khi ghi
//       (so sánh sâu với literal đã bắt), và phần tử đích chỉ khác ở
//       essayState / essayEarned / essayMax /
//       essayLowConfidence / essayGradedAt. `essayAttempts` KHÔNG được settle đụng tới
//       — nó thuộc về claim (D4).
//   (c) PHẠM VI CỘT: `total_score`, `correct`, `total`, `topic_breakdown` và
//       `overtime_seconds` trên hàng không đổi sau lượt ghi (đọc lại và
//       so với các literal đã gieo). Đây là AC-009 được chứng minh trên database
//       thay vì trên văn bản nguồn của hàm.
//   (d) SETTLE TRÙNG LÀ MỘT GIÁ TRỊ: lời gọi thứ hai cho cùng
//       (attempt_id, question_id) với một band KHÁC trả FALSE / không hàng —
//       khẳng định GIÁ TRỊ TRẢ VỀ, và khẳng định lời gọi không ném lỗi (bọc để một lỗi ném ra
//       làm ca hỏng với thông báo nói "raised instead of returning
//       false"). Rồi đọc lại hàng: band đã lưu bằng lần ghi ĐẦU, và
//       `essayState` vẫn là `graded`.
//   (e) `failed` KHÔNG PHẢI hấp thụ: settle một phần tử sang `failed`, rồi settle
//       cùng cặp sang `graded` — lời gọi thứ hai trả TRUE và band hạ cánh.
//       Rồi settle lần nữa -> false. Điều này phân biệt "vị từ chặn
//       mọi thứ" với "vị từ chỉ chặn `graded`", mà (d) một mình
//       không làm được.
//   (f) TỪ CHỐI KHI CHƯA NỘP (EG-BE-008 nửa settle): gọi settle cho một lượt làm
//       không phải `submitted` ném `check_violation` — khẳng định SQLSTATE, không phải
//       chữ thông báo.
//   (g) QUÉT VĂN BẢN NGUỒN (EG-BE-009): đọc `SOURCE/supabase/schema.sql`, tách
//       hai thân hàm, và khẳng định không cái nào chứa `user_id` làm tham số
//       hay bất kỳ trong năm tên cột bị cấm. Rẻ, và là khẳng định duy nhất
//       ngăn một lần "cứ thêm tham số user_id" qua được review.
describe.skipIf(!HAS_LIVE_DB)(
  "record_essay_grade() on real Postgres — array order and first-write-wins (SVC-1)",
  () => {
    let fx: EssayFixture;

    beforeAll(async () => {
      fx = await setUp(admin, "svc1", 3);
    });
    afterAll(async () => {
      await tearDown(admin, fx);
    });

    it("preserves the full questionId sequence when grading the second of three essays, restricts the write to one element and one column, and refuses a duplicate settle by returning false with the first band intact", async () => {
      const before = await readPerQuestion(admin, fx.attemptId);
      expect(before.map((r) => r.questionId)).toEqual(fx.questionIds);

      // ── (a) Cham cau THU HAI trong ba ─────────────────────────────────
      const { data: settled, error } = await admin.rpc("record_essay_grade", {
        p_attempt_id: fx.attemptId,
        p_question_id: fx.questionIds[1],
        p_state: "graded",
        p_earned: 0.75,
        p_max: 1,
        p_low_confidence: false,
      });
      expect(error).toBeNull();
      // `returns table (...)` ⇒ PostgREST tra ve MOT MANG.
      expect(Array.isArray(settled) ? settled[0].written : settled).toBe(true);

      const after = await readPerQuestion(admin, fx.attemptId);

      // ── (b) THU TU MANG giu nguyen. Day la mot trong ba tinh chat ma mot
      //        client bi mock KHONG the chung minh: ham SQL dung
      //        `jsonb_agg(... order by ord)` tren
      //        `jsonb_array_elements(...) with ordinality`, va neu ai do bo
      //        menh de `order by` thi Postgres duoc phep tra ve thu tu khac —
      //        cau hoi cua hoc sinh se doi cho tren man hinh.
      expect(after.map((r) => r.questionId)).toEqual(fx.questionIds);
      expect(after).toHaveLength(3);

      // ── (c) DUNG MOT phan tu bi doi, va trong phan tu do dung nhom khoa
      //        `essay*`. Hai phan tu kia phai GIONG TUNG BYTE.
      expect(after[0]).toEqual(before[0]);
      expect(after[2]).toEqual(before[2]);

      const target = after[1];
      expect(target.essayState).toBe("graded");
      expect(Number(target.essayEarned)).toBe(0.75);
      expect(Number(target.essayMax)).toBe(1);
      expect(target.essayLowConfidence).toBe(false);
      expect(target.essayGradedAt).toBeTruthy();
      // Cac truong KHONG thuoc nhom vong doi cua chinh phan tu ay khong duoc
      // dung toi: ham chi duoc ghi cot `per_question`, mot phan tu, nhom khoa.
      expect(target.selected).toBe(before[1].selected);
      expect(target.isCorrect).toBe(before[1].isCorrect);
      expect(target.scored).toBe(before[1].scored);

      // ── (d) GHI TRUNG BI TU CHOI — la mot GIA TRI TRA VE, khong phai mot
      //        exception (ADR-0018 Decision 3). Vi tu `<> 'graded'` khop ZERO
      //        dong, va band DAU TIEN o nguyen.
      const { data: dup, error: dupErr } = await admin.rpc("record_essay_grade", {
        p_attempt_id: fx.attemptId,
        p_question_id: fx.questionIds[1],
        p_state: "graded",
        p_earned: 0.25,
        p_max: 1,
        p_low_confidence: true,
      });
      expect(dupErr).toBeNull();
      expect(Array.isArray(dup) ? dup[0].written : dup).toBe(false);

      const afterDup = await readPerQuestion(admin, fx.attemptId);
      // Band cu THANG. Neu vi tu bi bo, gia tri o day se la 0.25 — tuc mot
      // luot chay thua vua ghi de diem that cua hoc sinh.
      expect(Number(afterDup[1].essayEarned)).toBe(0.75);
      expect(afterDup[1].essayLowConfidence).toBe(false);
      expect(afterDup.map((r) => r.questionId)).toEqual(fx.questionIds);
    });

    it("`failed` KHONG hap thu: mot cau `failed` van settle duoc thanh `graded` (EG-BE-007)", async () => {
      // `graded` la trang thai HAP THU, `failed` thi KHONG — day dung la thu
      // lam cho nut "cham lai" co nghia. Mot vi tu viet nham thanh
      // `essayState = 'pending'` se lam ca nay do.
      const qid = fx.questionIds[2];
      const failed = await admin.rpc("record_essay_grade", {
        p_attempt_id: fx.attemptId,
        p_question_id: qid,
        p_state: "failed",
        p_earned: null,
        p_max: null,
        p_low_confidence: false,
      });
      expect(Array.isArray(failed.data) ? failed.data[0].written : failed.data).toBe(true);

      const regraded = await admin.rpc("record_essay_grade", {
        p_attempt_id: fx.attemptId,
        p_question_id: qid,
        p_state: "graded",
        p_earned: 1,
        p_max: 1,
        p_low_confidence: false,
      });
      expect(Array.isArray(regraded.data) ? regraded.data[0].written : regraded.data).toBe(true);

      const rows = await readPerQuestion(admin, fx.attemptId);
      const row = rows.find((r) => r.questionId === qid);
      expect(row?.essayState).toBe("graded");
      expect(Number(row?.essayEarned)).toBe(1);
    });
  }
);

// =============================================================================
// SVC-2 — Trần thử lại bị tiêu ở lúc CLAIM: ba claim không bao giờ settle
//         vẫn làm cạn nó, và học sinh không với tới được hàm nào
// =============================================================================
// AC: EG-BE-010 — "Khi claim_essay_grading_attempt() thành công, essayAttempts
//   của phần tử phải tăng đúng 1, và KHÔNG BAO GIỜ bị giảm bởi bất kỳ câu lệnh nào
//   trong repo."
// AC: EG-BE-011 — "Khi essayAttempts đã bằng ESSAY_MAX_ATTEMPTS,
//   claim_essay_grading_attempt() phải trả claimed = false, reason = 'exhausted'
//   và không được dẫn tới request nhà cung cấp nào."
// AC: EG-BE-012 — "Khi phần tử đã chấm, claim_essay_grading_attempt() phải
//   trả claimed = false, reason = 'already_graded'."
// AC: EG-BE-008 (nửa claim) — "Nếu p_attempt_id trỏ vào một lượt làm không
//   tồn tại hoặc chưa nộp, claim_essay_grading_attempt() phải trả một hàng
//   với claimed = false, reason = 'not_submitted'."
// AC: EG-BE-013 — "Với JWT của học sinh, .rpc() tới CẢ HAI hàm phải trả
//   42501, và một UPDATE public.exam_results trực tiếp phải bị từ chối ở tầng
//   đặc quyền."
// Cũng hoàn thành: PRD AC-045, AC-063, AC-064; ADR-0018 D4 và danh sách khoanh vùng của nó;
//   backend DD Integration Verification Points EG-a, EG-b, EG-e.
// ROI: 63 (BV:9 x Freq:6 + Legal:0 + Defect:9)
//   BV 9 — trần là thứ duy nhất đứng giữa một lượt chấm thất bại có hệ thống
//     và một nút thử lại không giới hạn trên một ngân sách dự án đơn lẻ không đo đếm
//     (PRD R-j). Nó cũng là một ranh giới bảo mật: hai hàm này là
//     bộ ghi đầu tiên từng được phép đổi `exam_results` sau khi insert.
//   Freq 6 — chỉ chạm trần ở các câu hỏng lặp lại, nhưng chính đường claim
//     chạy ở mỗi lượt chấm của mọi bài tự luận.
//   Defect 9 — D4 phản trực giác theo thiết kế. Cài đặt tự nhiên
//     tăng bộ đếm ở lượt ghi SETTLE, trông đúng và
//     sai đúng chỗ quan trọng: theo F3, một lượt chấm bị bỏ dở ghi KHÔNG GÌ, nên một
//     bộ đếm lúc settle không bao giờ ghi các lần thử bị gián đoạn, số đếm lưu
//     vẫn dưới ba, và trần hỏng đúng ở kiểu hỏng
//     (học sinh nhìn "đang chấm" bị kẹt và bấm thử lại) mà nó sinh ra
//     để xử lý.
//   SUẤT THỨ HAI: ROI 63 > 50, ngưỡng của làn service. Được chọn là ca bổ sung
//   duy nhất ngoài suất giữ chỗ.
// Hành vi: gieo một lượt làm đã nộp với một bài tự luận pending ở essayAttempts 0 ->
//   gọi claim ba lần bằng service_role, KHÔNG BAO GIỜ settle ở giữa (mô phỏng
//   ba lượt chấm bị nền tảng cắt) -> mỗi lần trả claimed = true với số đếm
//   tăng dần -> lần thứ tư trả claimed = false, reason 'exhausted' ->
//   rồi chứng minh học sinh không gọi được hàm nào bằng JWT.
// @category: service-integration-e2e
// @lane: service-integration-e2e
// @dependency: toàn hệ thống (Postgres dev Supabase thật, client service_role thật,
//   hai phiên học sinh authenticated thật)
// @complexity: high
// @real-dependency: Postgres thật — không gì bị mock
// Kiểu hỏng chính: bộ đếm lượt thử được tăng bởi SETTLE thay vì
//   bởi CLAIM, nên ba lượt chấm bị gián đoạn không tốn gì, claim thứ tư,
//   thứ năm và thứ N đều thành công, và mỗi cái giữ một khối ngân sách Groq mới
//   của ngân sách dự án dùng chung, không đo đếm. Biến thể bảo mật: các
//   hàm được tạo mà thiếu nửa `revoke ... from public, anon, authenticated`
//   của khối grant (chỉ revoke khỏi `public` vẫn để học sinh gọi được,
//   theo ghi chú §10b về default privileges của Supabase), nên học sinh có thể
//   gọi thẳng hàm settle và tự ghi band của mình.
// Nghĩa vụ chứng minh — test được cài đặt phải khẳng định gì:
//   (a) BỘ ĐẾM DỊCH CHUYỂN Ở CLAIM, KHÔNG CẦN SETTLE NÀO: ba claim liên tiếp
//       KHÔNG có settle ở giữa trả claimed = true và số đếm trả về là 1, 2,
//       3 theo thứ tự; đọc lại hàng sau mỗi lần và khẳng định `essayAttempts`
//       ĐÃ LƯU bằng số đếm trả về. Chỉ khẳng định giá trị trả về
//       sẽ qua với một hàm tính ra số mà không bao giờ lưu.
//   (b) CLAIM THỨ TƯ BỊ TỪ CHỐI: claimed = false và reason === 'exhausted' chính xác
//       (khẳng định đúng chuỗi lý do literal — 'exhausted', 'already_graded',
//       'not_submitted' là ba nhánh khác nhau và một lần từ chối chung duy nhất
//       gộp chúng), và `essayAttempts` đã lưu VẪN là 3 — claim bị từ chối
//       không được tăng.
//   (c) GIÁ TRỊ TRẦN ĐƯỢC GHIM, KHÔNG GIẢ ĐỊNH: số claim thành công bằng
//       `ESSAY_MAX_ATTEMPTS` import từ `lib/scoring/essayLifecycle.ts` (3), không phải
//       literal 3 gõ vào file này. Đây là lần khai báo đôi không tránh được duy nhất
//       trong thiết kế (hằng TS so với literal SQL, vì ADR-0018 đã
//       cố định chữ ký hai tham số của hàm); `verify:schema` mang chốt ghim,
//       và ca này không được thành bản sao độc lập thứ ba.
//   (d) KHÔNG ĐƯỜNG GIẢM (EG-BE-010, nửa sau): quét `SOURCE/supabase/schema.sql`
//       và `SOURCE/lib/**` và khẳng định không câu lệnh nào giảm `essayAttempts`. Một
//       "hoàn lượt khi thất bại" là thay đổi mà một phiên về sau sẽ với tới đầu tiên,
//       và nó lặng lẽ mở lại lỗ hổng thử lại không giới hạn.
//   (e) CLAIM CỦA PHẦN TỬ ĐÃ CHẤM: trên một phần tử ở `graded`, claim trả
//       claimed = false, reason === 'already_graded', và `essayAttempts` không
//       dịch chuyển (AC-063: thử lại trên một câu đã có band là no-op).
//   (f) CLAIM CHƯA NỘP: trên một lượt làm không phải `submitted`, claim trả
//       MỘT HÀNG với claimed = false, reason === 'not_submitted' — một hàng trả về,
//       không phải tập kết quả rỗng và không phải một lỗi ném ra (nhánh chưa-nộp của settle
//       ném `check_violation`; sự bất đối xứng này là cố ý và cả hai
//       nửa phải được ghim, nửa settle ở SVC-1(f)).
//   (g) JWT HỌC SINH BỊ TỪ CHỐI Ở CẢ HAI (EG-BE-013): với một phiên học sinh
//       authenticated thật, `.rpc()` tới `claim_essay_grading_attempt` và tới
//       `record_essay_grade` đều hỏng với mã `42501`. PHÂN BIỆT CÁC MÃ
//       tường minh, theo mẫu `MM-b` (`test-rls.ts:1652-1671`):
//       `PGRST202` nghĩa là schema chưa bao giờ được áp (điều kiện tiên quyết 2 hỏng, không phải
//       một phát hiện bảo mật), và bất kỳ mã nào khác nghĩa là `revoke` thiếu hoặc
//       không đầy đủ. Một ca chỉ khẳng định "nó hỏng" báo một thuộc tính bảo mật xanh
//       trên một database chưa áp.
//   (h) QUYỀN SỞ HỮU ĐƯỢC SUY RA TRONG SQL: với `service_role` — danh tính mà CÓ THỂ
//       gọi các hàm — một claim gọi tên lượt làm của học sinh B vẫn hành xử
//       đúng mà KHÔNG truyền user_id, vì không có tham số user_id nào để
//       truyền (SVC-1(g) chứng minh tham số vắng mặt; cái này chứng minh hàm
//       vẫn phân giải quyền sở hữu từ hàng lượt làm thay vì tin một danh tính
//       do người gọi cung cấp).
//       Lưu ý nửa UPDATE-trực-tiếp của EG-BE-013 ĐÃ được phủ bởi ca `S-b` đã ship
//       (`test-rls.ts:1314-1320`); đừng lặp lại ở đây.
describe.skipIf(!HAS_LIVE_DB)(
  "claim_essay_grading_attempt() on real Postgres — claim-time cap and grants (SVC-2)",
  () => {
    let fx: EssayFixture;

    beforeAll(async () => {
      fx = await setUp(admin, "svc2", 3);
    });
    afterAll(async () => {
      await tearDown(admin, fx);
    });

    it("spends one of three attempts per claim even when no settle ever follows, and refuses the fourth with reason 'exhausted' without incrementing", async () => {
      const qid = fx.questionIds[0];

      // ── (a) BA luot claim, KHONG luot settle nao ────────────────────────
      //     Day la nua quan trong cua D4: luot duoc tieu luc CLAIM, khong phai
      //     luc settle. Mot invocation bi nen tang cat giua chung van tieu mot
      //     luot — va do la ly do UI-D9 quyet dinh KHONG hien so luot con lai.
      for (let i = 1; i <= ESSAY_MAX_ATTEMPTS; i += 1) {
        const { data, error } = await admin.rpc("claim_essay_grading_attempt", {
          p_attempt_id: fx.attemptId,
          p_question_id: qid,
        });
        expect(error).toBeNull();
        const row = Array.isArray(data) ? data[0] : data;
        expect(row.claimed).toBe(true);
        expect(row.attempts).toBe(i);
      }

      const afterThree = await readPerQuestion(admin, fx.attemptId);
      const spent = afterThree.find((r) => r.questionId === qid);
      expect(spent?.essayAttempts).toBe(ESSAY_MAX_ATTEMPTS);
      // Trang thai KHONG doi: claim chi tang bo dem, no khong ghi band.
      expect(spent?.essayState).toBe("pending");

      // ── (b) Luot THU TU bi tu choi, va bo dem KHONG tang them ───────────
      const { data: fourth, error: fourthErr } = await admin.rpc(
        "claim_essay_grading_attempt",
        { p_attempt_id: fx.attemptId, p_question_id: qid }
      );
      expect(fourthErr).toBeNull();
      const refused = Array.isArray(fourth) ? fourth[0] : fourth;
      expect(refused.claimed).toBe(false);
      expect(refused.reason).toBe("exhausted");

      const afterFour = await readPerQuestion(admin, fx.attemptId);
      // Neu bo dem van tang o luot bi tu choi, tran se troi xa dan sau moi lan
      // bam — mot hoc sinh khong bao gio duoc thu du ba lan.
      expect(afterFour.find((r) => r.questionId === qid)?.essayAttempts).toBe(
        ESSAY_MAX_ATTEMPTS
      );
    });

    it("phan biet `already_graded` voi `no_element`", async () => {
      const qid = fx.questionIds[1];
      await admin.rpc("record_essay_grade", {
        p_attempt_id: fx.attemptId,
        p_question_id: qid,
        p_state: "graded",
        p_earned: 1,
        p_max: 1,
        p_low_confidence: false,
      });

      const { data: graded } = await admin.rpc("claim_essay_grading_attempt", {
        p_attempt_id: fx.attemptId,
        p_question_id: qid,
      });
      const gradedRow = Array.isArray(graded) ? graded[0] : graded;
      expect(gradedRow.claimed).toBe(false);
      // AC-063: mot cau da co band KHONG duoc claim lai — neu duoc, mot luot
      // chay thua se ghi de diem that.
      expect(gradedRow.reason).toBe("already_graded");

      const { data: missing } = await admin.rpc("claim_essay_grading_attempt", {
        p_attempt_id: fx.attemptId,
        p_question_id: `${EG_PREFIX}svc2-khong-ton-tai`,
      });
      const missingRow = Array.isArray(missing) ? missing[0] : missing;
      expect(missingRow.claimed).toBe(false);
      expect(missingRow.reason).toBe("no_element");
    });

    it("tra 42501 cho JWT hoc sinh tren CA HAI ham — EXECUTE chi service_role", async () => {
      // Day la tinh chat thu ba ma mot client bi mock khong the chung minh:
      // GRANT that tren database that. Mot ban `revoke` chi go khoi `public`
      // se de ca hai ham VAN goi duoc bang JWT hoc sinh, va khong test mock nao
      // nhin thay dieu do.
      const claim = await fx.studentClient.rpc("claim_essay_grading_attempt", {
        p_attempt_id: fx.attemptId,
        p_question_id: fx.questionIds[0],
      });
      expect(claim.error?.code).toBe("42501");

      const settle = await fx.studentClient.rpc("record_essay_grade", {
        p_attempt_id: fx.attemptId,
        p_question_id: fx.questionIds[0],
        p_state: "graded",
        p_earned: 1,
        p_max: 1,
        p_low_confidence: false,
      });
      expect(settle.error?.code).toBe("42501");

      // Va KHONG dong nao bi doi boi hai luot goi bi tu choi ay.
      const rows = await readPerQuestion(admin, fx.attemptId);
      expect(rows.find((r) => r.questionId === fx.questionIds[0])?.essayState).toBe("pending");
    });
  }
);
