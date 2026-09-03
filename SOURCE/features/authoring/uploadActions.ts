// S-01 — tạo một đề từ hai file PDF (đường dài nhất của app).
//
// 8 chặng: metadata → kiểm file → tạo/reset row → upload Storage → AI trích
// câu hỏi + đáp án → assemble → cắt ảnh → ghi DB. Mỗi chặng có nhánh đền bù
// (`compensate`) vì một lượt hỏng ở giữa để lại rác trên Storage.
// 
// Đây là action ĐẮT NHẤT của dự án — xem khối chú thích rate-limit ngay đầu
// hàm để biết vì sao `guard()` phải đứng trước mọi việc khác.
//
// Tách khỏi `actions.ts` (1.190 dòng) ngày 2026-09-03, mục 7 của đợt refactor.
// Hợp đồng import KHÔNG đổi: `features/authoring/actions.ts` re-export lại.
"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { guard } from "@/lib/security/rateLimit";
import { assembleExamLenient, validateAssembledExam } from "@/lib/ugc/assembleExam";
import { cropImagesLenient } from "@/lib/ugc/cropImages";
import { extractAnswers } from "@/lib/ugc/extractAnswers";
import { extractMeta } from "@/lib/ugc/extractMeta";
import { extractQuestions } from "@/lib/ugc/extractQuestions";
import { ANSWER_MODEL, QUESTION_MODEL } from "@/lib/ugc/gemini";
import { normalizeMeta, type TypedMeta } from "@/lib/ugc/normalizeMeta";
import { createPipelineLogger } from "@/lib/ugc/pipelineLog";
import type { EntryMode, ExamMeta, ExtractedMeta, UgcActionFailure } from "@/lib/ugc/types";
import { validateExamMeta } from "@/lib/ugc/validateInput";

// Ánh xạ OK-04 (`consumeQuota()` reason → `telemetry_log.error_code`) sống ở
// `@/lib/billing/quotaTelemetry` — MỘT bản khai duy nhất, dùng chung với cổng
// gia sư trong `features/exams/tutorActions.ts`. Trước đây mỗi file giữ một bản
// sao literal và không có gì ghim chúng vào nhau; xem khối chú thích của module
// ấy để biết vì sao chỗ hợp nhất phải là một module KHÔNG `"use server"`.

import {
  EXT_BY_MIME,
  UPLOADS_BUCKET,
  failure,
  parseTypedMeta,
  requireUser,
  toFileRef,
} from "./internals";

/**
 * S-01 → upload 2 file + AI extract + assemble + persist (Design Doc §Data Flow).
 * FormData: entryMode (automatic|manual — v2.2), title, subject, grade,
 * durationMinutes, school?, schoolYear?, semester?, questionFile, answerFile,
 * examId? (re-run từ đề failed của mình).
 * Thành công (kể cả assembly còn lỗi cần sửa) → redirect /me/exams/[id];
 * thất bại trước đó → trả UgcActionFailure, KHÔNG mất dữ liệu form.
 */
export async function extractAndAssemble(formData: FormData): Promise<UgcActionFailure> {
  const { supabase, user } = await requireUser();

  // Rate limit TRƯỚC mọi việc khác (TD-019) — đây là action đắt nhất của dự án:
  // 2 file × 15MB, một lượt đọc PDF bằng mupdf/WASM, rồi 2–3 request Gemini tiêu
  // vào hạn ngạch 20 lượt/NGÀY dùng chung cho CẢ project. Trước bản vá này nó là
  // đường DUY NHẤT chạm Gemini mà không có guard nào, nên trần 3 lượt/ngày của
  // gia sư (explainStep) chỉ là trần trên giấy: vét hạn ngạch ở đây thì gia sư
  // của mọi người cùng chết.
  //
  // Đặt TRƯỚC requireUser thì không được — cần user.id làm khoá. Đặt sau bước
  // validate file thì mất nửa tác dụng: chính việc đọc/parse file mới là phần
  // tốn CPU, và một vòng lặp gửi rác vẫn bắt server làm hết việc đó rồi mới bị
  // từ chối. Ngay sau requireUser là điểm SỚM NHẤT còn có khoá để đếm.
  const rl = await guard("uploadExam", user.id);
  if (!rl.ok) {
    return failure(
      "server",
      `You have uploaded too many exams today. Try again in ${Math.ceil(rl.retryAfterSeconds / 3600)} hour(s).`
    );
  }

  const log = createPipelineLogger();
  const isRerun = !!(formData.get("examId") as string | null)?.trim();
  // Thiếu entryMode (client cũ) → manual: giữ nguyên hành vi v2.1.
  const entryMode: EntryMode =
    (formData.get("entryMode") as string | null) === "automatic" ? "automatic" : "manual";
  // Chế độ Automatic phát THÊM một call metadata ở stage 5 (ADR-0007), tức
  // 3 request thay vì 2. Suy ĐÚNG MỘT LẦN, ở đây — điểm sớm nhất suy được, vì
  // `entryMode` vừa mới có — rồi CẢ HAI chỗ tiêu thụ đọc lại chính const này:
  // cổng hạn mức ngay dưới (đặt chỗ ngân sách) và stage 5 (quyết định có phát
  // call thứ ba hay không). Hai lần suy độc lập sẽ cho phép cổng đặt chỗ 2 mà
  // pipeline phát 3, và không có gì đỏ ở đâu cả (backend DD I004).
  const metaCall = entryMode === "automatic";
  console.log(
    `[ugc-pipeline] ▶ START extractAndAssemble user=${user.id.slice(0, 8)} mode=${entryMode} ${
      isRerun ? "(re-run)" : "(mới)"
    }`
  );

  // --- 1. Metadata. Manual: reject trước mọi lời gọi AI (AC-036, v2.1).
  //        Automatic: KHÔNG chặn (AC-037) — giá trị gõ (nếu có) parse lỏng,
  //        phần còn lại AI điền ở stage 5; gate chuyển sang publish (ADR-0007).
  let stageT = log.now();
  const questionFileName = (formData.get("questionFile") as File | null)?.name ?? "exam";
  let meta: ExamMeta;
  let typed: TypedMeta = {};
  if (entryMode === "manual") {
    log.stage(1, "Kiểm tra metadata (tên đề, môn, khối, thời lượng)");
    const validated = validateExamMeta({
      title: formData.get("title") as string | null,
      subject: formData.get("subject") as string | null,
      grade: formData.get("grade") as string | null,
      durationMinutes: formData.get("durationMinutes") as string | null,
      school: formData.get("school") as string | null,
      schoolYear: formData.get("schoolYear") as string | null,
      semester: formData.get("semester") as string | null,
    });
    if (!validated.meta) {
      log.fail(1, "metadata", "field không hợp lệ", stageT);
      return failure("validation", "Please fix the highlighted fields.", {
        fieldErrors: validated.fieldErrors as Record<string, string>,
      });
    }
    meta = validated.meta;
    log.ok(1, "metadata", `"${meta.title}" · ${meta.subject} · khối ${meta.grade}`, stageT);
  } else {
    log.stage(1, "Metadata: chế độ Automatic — AI sẽ đọc từ trang 1 file đề");
    typed = parseTypedMeta(formData);
    // Meta TẠM (sentinel cho field thiếu) để insert row processing; giá trị
    // cuối cùng chốt sau extractMeta (stage 5 → 8).
    meta = normalizeMeta(null, typed, questionFileName);
    log.ok(1, "metadata", `tác giả gõ trước ${Object.keys(typed).length} field`, stageT);
  }

  // --- 2. Hai file bắt buộc (AC-005) + loại/kích thước/số trang (AC-006). --
  stageT = log.now();
  log.stage(2, "Kiểm tra 2 file (bắt buộc, loại, kích thước, số trang PDF)");
  const questionFile = formData.get("questionFile");
  const answerFile = formData.get("answerFile");
  if (
    !(questionFile instanceof File) ||
    questionFile.size === 0 ||
    !(answerFile instanceof File) ||
    answerFile.size === 0
  ) {
    log.fail(2, "file", "thiếu file câu hỏi hoặc file đáp án", stageT);
    return failure("file", "Both the question file and the answer file are required.");
  }
  const qRefOr = await toFileRef(questionFile, "Question file", log);
  if ("error" in qRefOr) {
    log.fail(2, "file câu hỏi", qRefOr.error.message, stageT);
    return qRefOr;
  }
  const aRefOr = await toFileRef(answerFile, "Answer file", log);
  if ("error" in aRefOr) {
    log.fail(2, "file đáp án", aRefOr.error.message, stageT);
    return aRefOr;
  }
  log.ok(2, "file", "cả 2 file hợp lệ", stageT);
  const qRef = qRefOr.ref;
  const aRef = aRefOr.ref;

  // --- 2b. Hạn mức kỳ + ngân sách ngày (I3 — AC-017/018/019/024/053). -----
  // TẮT (2026-09-03): Subscription feature đang tạm hoãn, chưa áp lên website
  // — chưa ai mua được Premium (GEMINI_PAID_TIER_ENABLED tắt) nên khoá mọi
  // user Free vào 3 lượt/kỳ 30 ngày ở đây chỉ chặn người dùng thật mà không
  // có lối thoát nào để mở khoá. Gỡ hẳn lời gọi `consumeQuota("upload", …)`
  // thay vì nới hạn mức: hạn mức vẫn còn nguyên trong lib/billing/quota.ts,
  // sẵn sàng gọi lại nguyên trạng khi Subscription ra mắt thật.
  //
  // Rate limit chống vòng lặp tự động (`guard("uploadExam", …)` ở đầu hàm)
  // vẫn còn nguyên — đây chỉ tắt cổng THU TIỀN, không tắt cổng CHỐNG LẠM DỤNG.

  // --- 3. Re-run cho đề của mình, hoặc guard tần suất khi tạo mới. ---------
  stageT = log.now();
  log.stage(3, isRerun ? "Reset đề cũ để xử lý lại (re-run)" : "Tạo bản ghi đề mới (status=processing)");
  const rerunExamId = (formData.get("examId") as string | null)?.trim() || null;
  let examId: string;
  if (rerunExamId) {
    const { data: own } = await supabase
      .from("exams")
      .select("id, title, subject, grade, duration_minutes, school, school_year, semester, question_ids")
      .eq("id", rerunExamId)
      .eq("author_id", user.id)
      .maybeSingle();
    if (!own) {
      log.fail(3, "re-run", "không tìm thấy đề hoặc không phải tác giả", stageT);
      return failure("server", "Exam not found or you are not its author.");
    }
    examId = own.id as string;
    // Re-run giữ subject/grade đã có (đổi subject lệch topic toàn đề) — trừ
    // khi row còn sentinel (tạo ở Automatic mà AI chưa đọc được, v2.2): khi
    // đó để giá trị form/AI điền tiếp.
    if ((own.subject as string) !== "") meta.subject = own.subject as string;
    if ((own.grade as number) !== 0) meta.grade = own.grade as number;
    if (entryMode === "automatic") {
      // Metadata đã có trên row coi như "typed" cho lần chạy này — extractMeta
      // fail thì giá trị cũ không bị sentinel đè mất (AC-040 không mất dữ liệu).
      typed = {
        ...typed,
        ...(typed.title === undefined && { title: own.title as string }),
        ...(typed.subject === undefined &&
          (own.subject as string) !== "" && { subject: own.subject as string }),
        ...(typed.grade === undefined && (own.grade as number) !== 0 && { grade: own.grade as number }),
        ...(typed.durationMinutes === undefined &&
          (own.duration_minutes as number) !== 0 && {
            durationMinutes: own.duration_minutes as number,
          }),
        ...(typed.school === undefined &&
          own.school != null && { school: own.school as string }),
        ...(typed.schoolYear === undefined &&
          own.school_year != null && { schoolYear: own.school_year as number }),
        ...(typed.semester === undefined &&
          own.semester != null && { semester: own.semester as "HK1" | "HK2" }),
      };
      meta = normalizeMeta(null, typed, questionFileName);
    }
    // Re-derive toàn phần (I004): xoá câu hỏi cũ, reset danh sách.
    const oldIds = (own.question_ids as string[]) ?? [];
    if (oldIds.length > 0) {
      await supabase.from("questions").delete().in("id", oldIds);
    }
    const { error: resetErr } = await supabase
      .from("exams")
      .update({
        title: meta.title,
        duration_minutes: meta.durationMinutes,
        school: meta.school ?? null,
        school_year: meta.schoolYear ?? null,
        semester: meta.semester ?? null,
        status: "processing",
        question_ids: [],
      })
      .eq("id", examId);
    if (resetErr) {
      console.error("[extractAndAssemble] reset exam:", resetErr.message);
      log.fail(3, "reset đề", resetErr.message, stageT);
      return failure("server", "Could not restart processing. Try again.");
    }
    log.ok(3, "reset đề", `examId=${examId}`, stageT);
  } else {
    // Guard tần suất theo SỐ DÒNG (30 dòng `exams` tạo trong 24h) từng đứng ở
    // đây và đã bị XOÁ, không phải để lại chạy song song: nó đếm sai đơn vị
    // (dòng tạo ra, chứ không phải thao tác thực hiện) và chỉ có mặt ở nhánh
    // này, nên nhánh xử-lý-lại không bao giờ đi qua nó. Cổng thay thế từng là
    // `consumeQuota("upload", …)` ở mục 2b (nay đã TẮT — xem comment ở đó,
    // 2026-09-03); guard chống vòng lặp tự động duy nhất còn lại trên đường
    // này là `guard("uploadExam", …)` ở đầu hàm.

    // Snapshot tên tác giả (ADR-0003) từ profile của chính mình.
    const { data: profile } = await supabase
      .from("user_profiles")
      .select("display_name")
      .eq("id", user.id)
      .single();

    // Row exams phải tồn tại TRƯỚC khi upload (Storage policy resolve exam id
    // từ path — Design Doc §8).
    examId = `ugc-${crypto.randomUUID()}`;
    const { error: insErr } = await supabase.from("exams").insert({
      id: examId,
      title: meta.title,
      question_ids: [],
      duration_minutes: meta.durationMinutes,
      subject: meta.subject,
      grade: meta.grade,
      school: meta.school ?? null,
      school_year: meta.schoolYear ?? null,
      semester: meta.semester ?? null,
      status: "processing",
      author_id: user.id,
      author_display_name: profile?.display_name ?? null,
    });
    if (insErr) {
      console.error("[extractAndAssemble] insert exam:", insErr.message);
      log.fail(3, "tạo đề", insErr.message, stageT);
      return failure("server", "Could not start processing. Try again.");
    }
    log.ok(3, "tạo đề", `examId=${examId}`, stageT);
  }

  /** Dọn bù (compensating delete) khi fail giữa chừng ở đề TẠO MỚI. */
  async function compensate() {
    if (rerunExamId) {
      // Đề re-run giữ lại ở trạng thái failed cho tác giả thử lại.
      await supabase.from("exams").update({ status: "failed" }).eq("id", examId);
      return;
    }
    await supabase.storage
      .from(UPLOADS_BUCKET)
      .remove([
        `${examId}/questions.${EXT_BY_MIME[qRef.mediaType]}`,
        `${examId}/answers.${EXT_BY_MIME[aRef.mediaType]}`,
      ]);
    await supabase.from("exams").delete().eq("id", examId);
  }

  // --- 4. Upload 2 file gốc vào bucket riêng tư (author-only). -------------
  stageT = log.now();
  log.stage(4, "Tải 2 file gốc lên Storage (bucket exam-uploads, riêng tư)");
  const questionPath = `${examId}/questions.${EXT_BY_MIME[qRef.mediaType]}`;
  const answerPath = `${examId}/answers.${EXT_BY_MIME[aRef.mediaType]}`;
  for (const [path, ref] of [
    [questionPath, qRef],
    [answerPath, aRef],
  ] as const) {
    // BỌC Blob — CÙNG một lỗi hỏng dữ liệu đã đo được ở `cropImages.ts`
    // (commit 3263419): body không phải Blob thì storage-js gán thẳng nó vào
    // fetch, và ở đó byte nhị phân bị ép qua chuỗi. PNG cắt ra (một Buffer) về
    // prod với mọi byte >= 0x80 thành U+FFFD; `ref.bytes` ở đây là Uint8Array
    // thuần nên nếu bị ép thì kiểu hỏng còn KHÁC nữa (`String(u8)` cho ra
    // "137,80,78,..."), nhưng cả hai đều là file không mở được.
    //
    // Đây KHÔNG phải vá phòng xa: hai file gốc trong `exam-uploads` là nguồn
    // DUY NHẤT để cắt lại hình khi cần sửa dữ liệu. Nếu chúng cũng hỏng thì
    // mọi đề đã upload không còn đường phục hồi nào ngoài việc người dùng nộp
    // lại file từ máy họ.
    const up = await supabase.storage
      .from(UPLOADS_BUCKET)
      .upload(path, new Blob([new Uint8Array(ref.bytes)], { type: ref.mediaType }), {
        contentType: ref.mediaType,
        upsert: true,
      });
    if (up.error) {
      console.error("[extractAndAssemble] upload:", up.error.message);
      log.fail(4, "upload", up.error.message, stageT);
      await compensate();
      return failure("server", "File upload failed. Try again.");
    }
  }
  log.ok(4, "upload", "2 file gốc đã lưu", stageT);

  // --- 5. AI extraction (server-only, song song — v2.2 thêm call metadata
  //        NON-FATAL ở chế độ Automatic; không thêm độ trễ wall-clock). -------
  stageT = log.now();
  // `metaCall` suy một lần ở đầu hàm và cổng hạn mức ở mục 2b đã đặt chỗ ngân
  // sách theo CHÍNH giá trị này — suy lại ở đây là mở đường cho hai con số.
  log.stage(
    5,
    `Trích xuất bằng AI (${metaCall ? 3 : 2} call song song)`,
    `đề: ${QUESTION_MODEL} · đáp án: ${ANSWER_MODEL}${metaCall ? ` · metadata: ${ANSWER_MODEL} (trang 1)` : ""}`
  );
  const [qResult, aResult, mResult] = await Promise.all([
    (async () => {
      const t = log.now();
      const r = await extractQuestions(qRef);
      if (r.ok)
        log.ok(
          5,
          "extractQuestions (đề)",
          `${r.value.questions.length} câu hỏi / ${Math.max(r.value.parts.length, 1)} phần`,
          t
        );
      else log.fail(5, "extractQuestions (đề)", r.errors[0]?.code ?? "?", t);
      return r;
    })(),
    (async () => {
      const t = log.now();
      const r = await extractAnswers(aRef);
      if (r.ok) log.ok(5, "extractAnswers (đáp án)", `${r.value.length} đáp án`, t);
      else log.fail(5, "extractAnswers (đáp án)", r.errors[0]?.code ?? "?", t);
      return r;
    })(),
    (async () => {
      if (!metaCall) return null;
      const t = log.now();
      const r = await extractMeta(qRef);
      if (r.ok) {
        const found = Object.values(r.value).filter((v) => v !== null).length;
        log.ok(5, "extractMeta (thông tin đề)", `đọc được ${found}/7 field`, t);
      } else {
        // NON-FATAL (AC-040): sentinel + tác giả điền ở review.
        log.fail(5, "extractMeta (thông tin đề)", `${r.errors[0]?.code ?? "?"} — đi tiếp, tác giả điền ở review`, t);
      }
      return r;
    })(),
  ]);
  if (!qResult.ok || !aResult.ok) {
    log.fail(5, "AI extraction", "call đề/đáp án thất bại → rollback", stageT);
    await compensate();
    const errors = [...(qResult.ok ? [] : qResult.errors), ...(aResult.ok ? [] : aResult.errors)];
    return failure("extraction", errors[0]?.message ?? "Extraction failed.", {
      errors,
    });
  }
  // Chốt metadata cuối cùng (Automatic): AI đề xuất → normalizeMeta quyết
  // định (typed thắng, không clamp, không fabricate) — ghi DB ở stage 8.
  if (entryMode === "automatic") {
    const extracted: ExtractedMeta | null = mResult?.ok ? mResult.value : null;
    meta = normalizeMeta(extracted, typed, questionFileName);
  }
  const { parts, passages, questions: extractedQuestions } = qResult.value;
  // Nhãn lỗi "Phần P Câu N" chỉ với đề nhiều phần (ADR-0005).
  const multiPart = parts.length > 0 || extractedQuestions.some((q) => q.part !== 1);

  // --- 6. Crop hình theo bounding box + upload (code thuần, không AI). -----
  stageT = log.now();
  const withImages = extractedQuestions.filter((q) => q.imageBox).length;
  log.stage(6, "Cắt hình câu hỏi theo bounding box", `${withImages} câu có hình`);
  const { images, errors: cropErrors } = await cropImagesLenient(
    qRef,
    extractedQuestions,
    examId,
    supabase,
    log,
    multiPart
  );
  if (cropErrors.length > 0) {
    log.fail(6, "crop hình", `${cropErrors.length} hình lỗi, ${images.size} thành công`, stageT);
  } else {
    log.ok(6, "crop hình", `${images.size} hình đã cắt & lưu`, stageT);
  }

  // --- 7. Assemble (authoritative) + validate — khoá composite (part, number). --
  stageT = log.now();
  log.stage(7, "Ghép đề (ghép đáp án theo phần + số câu) + kiểm tra hợp lệ");
  const { exam, joinErrors } = assembleExamLenient(
    extractedQuestions,
    aResult.value,
    images,
    meta,
    parts,
    passages
  );
  const assemblyErrors = [...joinErrors, ...validateAssembledExam(exam), ...cropErrors];
  if (assemblyErrors.length > 0) {
    log.fail(
      7,
      "ghép/kiểm tra",
      `${exam.questions.length} câu, ${assemblyErrors.length} lỗi (đề vào trạng thái 'failed' để sửa)`,
      stageT
    );
  } else {
    log.ok(7, "ghép/kiểm tra", `${exam.questions.length} câu, sạch lỗi`, stageT);
  }

  // --- 8. Persist KẾT QUẢ ASSEMBLE (kể cả nháp lỗi — tác giả sửa ở S-03). --
  stageT = log.now();
  log.stage(8, "Lưu câu hỏi + đề vào cơ sở dữ liệu");
  // v2.1 (ADR-0005): id mang danh tính composite `p{part}q{n}` — "Câu 1" các
  // phần khác nhau không đè nhau (row v2.0 dạng `-q{n}` vẫn parse được).
  const questionIds = exam.questions.map((q) => `${examId}-p${q.part}q${q.number}`);
  // question_ids phải cập nhật TRƯỚC khi insert questions (policy
  // questions_insert_author check id ∈ question_ids của đề mình).
  const { error: idsErr } = await supabase
    .from("exams")
    .update({
      question_ids: questionIds,
      question_file_path: questionPath,
      answer_file_path: answerPath,
      parts: exam.parts.length > 0 ? exam.parts : null,
      // A1: null khi đề không có ngữ liệu chung — cùng quy ước với `parts`.
      passages: exam.passages.length > 0 ? exam.passages : null,
      // v2.2 (Automatic): chốt metadata sau normalizeMeta — row insert ở stage
      // 3 mới chỉ mang giá trị tạm/sentinel. Manual: ghi lại chính giá trị cũ
      // (no-op về nội dung).
      title: meta.title,
      subject: meta.subject,
      grade: meta.grade,
      duration_minutes: meta.durationMinutes,
      school: meta.school ?? null,
      school_year: meta.schoolYear ?? null,
      semester: meta.semester ?? null,
    })
    .eq("id", examId);
  if (idsErr) {
    console.error("[extractAndAssemble] update ids:", idsErr.message);
    log.fail(8, "cập nhật danh sách câu hỏi", idsErr.message, stageT);
    await compensate();
    return failure("server", "Could not save the exam. Try again.");
  }

  const rows = exam.questions.map((q) => ({
    id: `${examId}-p${q.part}q${q.number}`,
    content: q.stem,
    // Cột `choices` jsonb: lựa chọn A–D (mcq) hoặc các ý a–d (true_false).
    choices: q.choices ?? q.subItems ?? [],
    correct_answer: q.correctAnswer ?? null,
    subject: meta.subject,
    grade: meta.grade,
    topic: q.topic,
    question_type: q.type,
    part_number: q.part,
    sub_answers: q.subAnswers ?? null,
    image_url: q.imageUrl ?? null,
    essay_answer: q.essayAnswer ?? null,
    passage_id: q.passageId ?? null,
    // B1 — đề không in điểm ⇒ ghi NULL, nghĩa là "không biết". Ghi thẳng 1 ở
    // đây cũng ra cùng con số, nhưng nó biến "không biết" thành "biết là 1"
    // trong dữ liệu, và màn review sẽ không còn gì để nhắc tác giả nhập.
    //
    // KHOÁ PHẢI CÓ Ở MỌI ROW, kể cả khi không biết — đây là chỗ đề Ngữ văn
    // 10 (2026-09-02) làm hỏng cả lượt upload. PostgREST gom một mảng row
    // thành MỘT câu INSERT với danh sách cột chung; row nào thiếu khoá thì cột
    // ấy nhận NULL chứ KHÔNG rơi về default của DB. Trước bản này khoá được
    // spread có điều kiện, nên:
    //   · đề mà MỌI câu đều không in điểm → cột vắng mặt → default 1 áp;
    //   · đề mà MỌI câu đều in điểm → chạy đúng;
    //   · đề TRỘN hai loại (Ngữ văn: Đọc hiểu không in, Viết in 2,0 + 4,0) →
    //     câu không in điểm nhận NULL vào cột `not null` → 23502, và TOÀN BỘ
    //     lượt upload bị huỷ với "Could not save the questions."
    // Gửi khoá ở mọi row khiến ba ca trên hợp thành một, và `points` nay
    // nullable (§8e) để NULL mang đúng nghĩa "chưa biết".
    points: q.points ?? null,
  }));
  const { error: qInsErr } = await supabase.from("questions").insert(rows);
  if (qInsErr) {
    console.error("[extractAndAssemble] insert questions:", qInsErr.message);
    log.fail(8, "lưu câu hỏi", qInsErr.message, stageT);
    await compensate();
    return failure("server", "Could not save the questions. Try again.");
  }

  const finalStatus = assemblyErrors.length > 0 ? "failed" : "review";
  const { error: stErr } = await supabase
    .from("exams")
    .update({ status: finalStatus })
    .eq("id", examId);
  if (stErr) {
    console.error("[extractAndAssemble] set status:", stErr.message);
    log.fail(8, "đặt trạng thái", stErr.message, stageT);
    return failure("server", "Could not finish processing. Try again.");
  }
  log.ok(8, "lưu DB", `${rows.length} câu, trạng thái cuối = '${finalStatus}'`, stageT);
  log.done(
    `đề ${examId} → /me/exams/${examId}` +
      (finalStatus === "failed" ? "  ⚠ có lỗi cần sửa ở màn Review" : "  ✓ sẵn sàng Review & Publish")
  );

  revalidatePath("/me/exams");
  // ?src=auto: đánh dấu phiên đến từ Automatic — S-03 hiện marker "from your
  // file" trên field AI điền (session-derived, O-7/TBD-07; reload mất marker
  // là chủ đích).
  redirect(`/me/exams/${examId}${entryMode === "automatic" ? "?src=auto" : ""}`);
}
