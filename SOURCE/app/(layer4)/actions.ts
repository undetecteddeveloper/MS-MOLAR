// Logic Layer 4 — UGC Exam Upload v2.2: Server Actions (Task 4.1 + M4/M5).
// Design Doc §Data Contracts — extractAndAssemble / saveExam / publishExam /
// deleteExam / reportExam.
//
// Nguyên tắc:
//   - Validate FILE trước mọi lời gọi AI (AC-005/006 — guard chi phí, luôn).
//     Metadata: chế độ Manual validate trước AI như v2.1 (AC-036); chế độ
//     Automatic KHÔNG có metadata lúc submit — gate chuyển sang PUBLISH
//     (ADR-0007, AC-037/038). Nút disable chỉ là UX; publishExam tự từ chối.
//   - Chỉ persist KẾT QUẢ ASSEMBLE (ADR-0004) — raw AI output không bao giờ
//     vào DB; đáp án đến từ FILE ĐÁP ÁN; metadata AI đi qua normalizeMeta
//     (ranh giới thuần duy nhất, typed thắng extracted, không clamp).
//   - extractMeta NON-FATAL (AC-040): fail → sentinel + tác giả điền ở review.
//   - Mọi quyền được RLS cưỡng chế (author-only) — action chỉ là lớp UX.
//   - Đề published phải LUÔN sạch: publishExam validate (câu hỏi + metadata);
//     saveExam trên đề published validate TRƯỚC khi ghi.
//   - KHÔNG BAO GIỜ log token hay raw AI payload.
"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { guard } from "@/lib/security/rateLimit";
import { assembleExamLenient, validateAssembledExam } from "@/lib/ugc/assembleExam";
import { cropImagesLenient } from "@/lib/ugc/cropImages";
import { makeUgcError } from "@/lib/ugc/errorCopy";
import { extractAnswers } from "@/lib/ugc/extractAnswers";
import { extractMeta } from "@/lib/ugc/extractMeta";
import { extractQuestions } from "@/lib/ugc/extractQuestions";
import type { FileRef } from "@/lib/ugc/fileRef";
import { assembledFromRows, questionIdentityFromId } from "@/lib/ugc/fromRows";
import { ANSWER_MODEL, QUESTION_MODEL } from "@/lib/ugc/gemini";
import { LIMITS } from "@/lib/ugc/limits";
import {
  normalizeMeta,
  validateMetaForPublish,
  type TypedMeta,
} from "@/lib/ugc/normalizeMeta";
import { getPdfPageCount } from "@/lib/ugc/pdf";
import { createPipelineLogger } from "@/lib/ugc/pipelineLog";
import { isSubject } from "@/lib/ugc/subjects";
import type {
  EntryMode,
  ExamMeta,
  ExtractedMeta,
  SaveExamPatch,
  UgcActionFailure,
  UgcError,
} from "@/lib/ugc/types";
import { checkUploadFile, isAllowedMime, validateExamMeta } from "@/lib/ugc/validateInput";

const UPLOADS_BUCKET = "exam-uploads";
const IMAGES_BUCKET = "exam-images";

const EXT_BY_MIME: Record<string, string> = {
  "image/png": "png",
  "image/jpeg": "jpg",
  "image/webp": "webp",
  "application/pdf": "pdf",
};

/** Lấy user hiện tại; chưa đăng nhập → về trang chủ mở dialog sign-in (AC-002). */
async function requireUser() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect("/?auth=signin");
  return { supabase, user };
}

function failure(
  kind: UgcActionFailure["error"]["kind"],
  message: string,
  extra?: { errors?: UgcError[]; fieldErrors?: Record<string, string> }
): UgcActionFailure {
  return { error: { kind, message, ...extra } };
}

/** File (FormData) → FileRef sau khi check loại/kích thước/số trang. */
async function toFileRef(
  file: File,
  label: string,
  log?: ReturnType<typeof createPipelineLogger>
): Promise<{ ref: FileRef } | UgcActionFailure> {
  const sizeMb = (file.size / (1024 * 1024)).toFixed(2);
  log?.info(`${label}: ${file.type || "unknown"} · ${sizeMb}MB`);
  const check = checkUploadFile({ type: file.type, size: file.size });
  if (!check.ok) {
    return failure("file", `${label}: ${check.message}`, {
      errors: check.errors,
    });
  }
  if (!isAllowedMime(file.type)) {
    return failure("file", `${label}: unsupported file type.`);
  }
  const bytes = new Uint8Array(await file.arrayBuffer());
  if (file.type === "application/pdf") {
    try {
      const pages = await getPdfPageCount(bytes);
      log?.info(`${label}: PDF đọc được, ${pages} trang (giới hạn ${LIMITS.MAX_PDF_PAGES})`);
      if (pages > LIMITS.MAX_PDF_PAGES) {
        return failure("file", `${label}: too many pages (max ${LIMITS.MAX_PDF_PAGES}).`, {
          errors: [makeUgcError("TOO_MANY_PAGES", null)],
        });
      }
    } catch (err) {
      // Log server-side để chẩn đoán (KHÔNG lộ chi tiết cho user — message an
      // toàn giữ nguyên). Lỗi mupdf trong Next runtime khác lỗi PDF hỏng thật.
      console.error(`[ugc] getPdfPageCount failed for ${label}:`, err);
      return failure("file", `${label}: the PDF could not be read.`);
    }
  }
  return { ref: { bytes, mediaType: file.type } };
}

/**
 * Chế độ Automatic (v2.2): parse LỎNG giá trị tác giả đã gõ — chỉ nhận giá trị
 * HỢP LỆ vào TypedMeta (giá trị gõ thắng AI trong normalizeMeta); giá trị gõ
 * không hợp lệ bị coi như vắng mặt (AI điền hoặc sentinel → tác giả sửa ở
 * review — nhất quán nguyên tắc không-clamp: không chế biến input hỏng thành
 * giá trị "hợp lý sai").
 */
function parseTypedMeta(formData: FormData): TypedMeta {
  const s = (k: string) => ((formData.get(k) as string | null) ?? "").trim();
  const int = (k: string) => {
    const v = s(k);
    return /^\d+$/.test(v) ? Number.parseInt(v, 10) : undefined;
  };
  const typed: TypedMeta = {};

  const title = s("title");
  if (title !== "") typed.title = title.slice(0, LIMITS.MAX_TITLE);

  const subject = s("subject");
  if (subject !== "" && isSubject(subject)) typed.subject = subject;

  const grade = int("grade");
  if (grade !== undefined && grade >= LIMITS.MIN_GRADE && grade <= LIMITS.MAX_GRADE)
    typed.grade = grade;

  const duration = int("durationMinutes");
  if (duration !== undefined && duration >= LIMITS.MIN_DURATION && duration <= LIMITS.MAX_DURATION)
    typed.durationMinutes = duration;

  const school = s("school");
  if (school !== "") typed.school = school.slice(0, LIMITS.MAX_SCHOOL);

  const year = int("schoolYear");
  if (year !== undefined && year >= LIMITS.MIN_YEAR && year <= LIMITS.MAX_YEAR)
    typed.schoolYear = year;

  const semester = s("semester");
  if (semester === "HK1" || semester === "HK2") typed.semester = semester;

  return typed;
}

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
  const log = createPipelineLogger();
  const isRerun = !!(formData.get("examId") as string | null)?.trim();
  // Thiếu entryMode (client cũ) → manual: giữ nguyên hành vi v2.1.
  const entryMode: EntryMode =
    (formData.get("entryMode") as string | null) === "automatic" ? "automatic" : "manual";
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
    const since = new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString();
    const { count } = await supabase
      .from("exams")
      .select("id", { count: "exact", head: true })
      .eq("author_id", user.id)
      .gte("created_at", since);
    if ((count ?? 0) >= LIMITS.MAX_UPLOADS_PER_DAY) {
      log.fail(3, "guard tần suất", `đã đạt ${LIMITS.MAX_UPLOADS_PER_DAY} lượt/ngày`, stageT);
      return failure(
        "validation",
        `Upload limit reached (${LIMITS.MAX_UPLOADS_PER_DAY} per day). Try again tomorrow.`
      );
    }

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
    const up = await supabase.storage
      .from(UPLOADS_BUCKET)
      .upload(path, ref.bytes, { contentType: ref.mediaType, upsert: true });
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
  const metaCall = entryMode === "automatic";
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
  const { parts, questions: extractedQuestions } = qResult.value;
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
    parts
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

/**
 * Tác giả sửa field (S-03 — đề review/failed/draft, hoặc đề đã published).
 * Đề published: validate TRƯỚC khi ghi — đề công khai phải luôn sạch.
 * Đề chưa published: ghi tự do rồi tính lại status (sạch → review, lỗi → failed).
 */
export async function saveExam(
  examId: string,
  patch: SaveExamPatch
): Promise<{ error?: UgcActionFailure["error"] }> {
  const { supabase, user } = await requireUser();

  const { data: examRow } = await supabase
    .from("exams")
    .select(
      "id, title, subject, grade, duration_minutes, school, school_year, semester, status, question_ids, parts"
    )
    .eq("id", examId)
    .eq("author_id", user.id)
    .maybeSingle();
  if (!examRow) {
    return failure("server", "Exam not found or you are not its author.");
  }
  // Đề bị gỡ: RLS exams_update_author/questions_*_author sẽ chặn mọi lệnh ghi
  // bên dưới, nhưng chặn kiểu "update khớp 0 dòng" là im lặng — tác giả sẽ thấy
  // Save thành công mà nội dung không đổi. Dừng sớm với lý do rõ ràng.
  if (examRow.status === "removed") {
    return failure("validation", "This exam was removed by a moderator and can no longer be edited.");
  }

  // --- Validate metadata patch (v2.2, ADR-0007) --------------------------
  // Đề CHƯA publish: sentinel (""/0) được phép — "còn thiếu" là trạng thái
  // hợp lệ của draft, gate chặn ở publish. Giá trị CÓ THẬT thì phải hợp lệ
  // (author-typed → feedback ngay). subject/grade sửa được khi chưa publish
  // (cascade topic/subject/grade xuống questions); sau publish: cố định.
  const isPublishedExam = examRow.status === "published";
  const metaFieldErrors: Record<string, string> = {};
  const nextMeta: ExamMeta = {
    title: examRow.title as string,
    subject: examRow.subject as string,
    grade: examRow.grade as number,
    durationMinutes: examRow.duration_minutes as number,
    school: (examRow.school as string | null) ?? undefined,
    schoolYear: (examRow.school_year as number | null) ?? undefined,
    semester: ((examRow.semester as string | null) ?? undefined) as "HK1" | "HK2" | undefined,
  };
  if (patch.meta) {
    const m = patch.meta;
    if (m.title !== undefined) {
      const t = m.title.trim();
      if (t.length > LIMITS.MAX_TITLE) {
        metaFieldErrors.title = `Title must be at most ${LIMITS.MAX_TITLE} characters.`;
      } else {
        nextMeta.title = t; // rỗng cho phép trên draft; gate publish chặn
      }
    }
    if (m.subject !== undefined && m.subject !== nextMeta.subject) {
      if (isPublishedExam) {
        metaFieldErrors.subject = "Subject is fixed after publishing.";
      } else if (m.subject !== "" && !isSubject(m.subject)) {
        metaFieldErrors.subject = "Pick a subject from the list.";
      } else {
        nextMeta.subject = m.subject;
      }
    }
    if (m.grade !== undefined && m.grade !== nextMeta.grade) {
      if (isPublishedExam) {
        metaFieldErrors.grade = "Grade is fixed after publishing.";
      } else if (
        m.grade !== 0 &&
        (!Number.isInteger(m.grade) || m.grade < LIMITS.MIN_GRADE || m.grade > LIMITS.MAX_GRADE)
      ) {
        metaFieldErrors.grade = `Grade must be between ${LIMITS.MIN_GRADE} and ${LIMITS.MAX_GRADE}.`;
      } else {
        nextMeta.grade = m.grade;
      }
    }
    if (m.durationMinutes !== undefined) {
      if (
        m.durationMinutes !== 0 &&
        (!Number.isInteger(m.durationMinutes) ||
          m.durationMinutes < LIMITS.MIN_DURATION ||
          m.durationMinutes > LIMITS.MAX_DURATION)
      ) {
        metaFieldErrors.durationMinutes = `Duration must be between ${LIMITS.MIN_DURATION} and ${LIMITS.MAX_DURATION} minutes.`;
      } else {
        nextMeta.durationMinutes = m.durationMinutes;
      }
    }
    if (m.school !== undefined) {
      const s = (m.school ?? "").trim();
      if (s.length > LIMITS.MAX_SCHOOL) {
        metaFieldErrors.school = `School must be at most ${LIMITS.MAX_SCHOOL} characters.`;
      } else {
        nextMeta.school = s === "" ? undefined : s;
      }
    }
    if (m.schoolYear !== undefined) {
      if (
        m.schoolYear !== null &&
        (!Number.isInteger(m.schoolYear) ||
          m.schoolYear < LIMITS.MIN_YEAR ||
          m.schoolYear > LIMITS.MAX_YEAR)
      ) {
        metaFieldErrors.schoolYear = `Year must be between ${LIMITS.MIN_YEAR} and ${LIMITS.MAX_YEAR}.`;
      } else {
        nextMeta.schoolYear = m.schoolYear ?? undefined;
      }
    }
    if (m.semester !== undefined) {
      if (m.semester !== null && m.semester !== "HK1" && m.semester !== "HK2") {
        metaFieldErrors.semester = "Semester must be HK1 or HK2.";
      } else {
        nextMeta.semester = m.semester ?? undefined;
      }
    }
    if (Object.keys(metaFieldErrors).length > 0) {
      return failure("validation", "Please fix the highlighted fields.", {
        fieldErrors: metaFieldErrors,
      });
    }
    // Đề published không được ghi về trạng thái thiếu metadata (gate giữ chặt
    // bất kể client): sentinel/thiếu → từ chối với lỗi META_* rõ ràng.
    if (isPublishedExam) {
      const metaErrors = validateMetaForPublish(nextMeta);
      if (metaErrors.length > 0) {
        return failure("validation", "A published exam must keep complete details.", {
          errors: metaErrors,
        });
      }
    }
  }

  const questionIds = (examRow.question_ids as string[]) ?? [];
  // exam_answer_key() thay cho select thẳng `questions`: 3 cột đáp án đã bị
  // REVOKE khỏi role `authenticated` (Security review 2026-08-03 #1, schema.sql
  // §10). Nhánh "tác giả" của hàm tái kiểm tra author_id ở tầng DB.
  const { data: qData } = await supabase.rpc("exam_answer_key", { p_exam_id: examId });
  const qRows = (qData ?? []) as Array<Record<string, unknown>>;

  // Khớp patch theo DANH TÍNH (part, number) chứ không theo chuỗi id thô —
  // row v2.0 cũ (`-q{n}`) vẫn nhận được patch id dạng v2.1 (`-p1q{n}`).
  const patchByIdentity = new Map(
    (patch.questions ?? []).map((p) => {
      const idt = questionIdentityFromId(p.id, -1);
      return [`${idt.part}:${idt.number}`, p];
    })
  );
  const identityOfRow = (rowId: string, index: number) => {
    const idt = questionIdentityFromId(rowId, index + 1);
    return `${idt.part}:${idt.number}`;
  };

  // Áp patch câu hỏi vào bản in-memory để validate trước/sau.
  // v2.1: subItems của true_false nằm cùng cột `choices`; subAnswers riêng.
  const patched = (qRows ?? []).map((r, i) => {
    const p = patchByIdentity.get(identityOfRow(r.id as string, i));
    if (!p) return { ...r };
    return {
      ...r,
      content: p.stem !== undefined ? p.stem : r.content,
      choices:
        p.subItems !== undefined ? p.subItems : p.choices !== undefined ? p.choices : r.choices,
      correct_answer: p.correctAnswer !== undefined ? p.correctAnswer : r.correct_answer,
      sub_answers: p.subAnswers !== undefined ? p.subAnswers : r.sub_answers,
      essay_answer: p.essayAnswer !== undefined ? p.essayAnswer : r.essay_answer,
      image_url: p.imageUrl !== undefined ? p.imageUrl : r.image_url,
    };
  });

  const assembled = assembledFromRows(
    {
      title: nextMeta.title,
      subject: nextMeta.subject,
      grade: nextMeta.grade,
      duration_minutes: nextMeta.durationMinutes,
      school: nextMeta.school ?? null,
      school_year: nextMeta.schoolYear ?? null,
      semester: nextMeta.semester ?? null,
      question_ids: questionIds,
      parts: (examRow.parts as { number: number; title: string }[] | null) ?? null,
    },
    patched
  );
  const validationErrors = validateAssembledExam(assembled);

  // Đề published phải luôn sạch → chặn ghi nếu patch làm bẩn (AC-018 + R8).
  if (examRow.status === "published" && validationErrors.length > 0) {
    return failure("validation", "A published exam must stay complete. Fix these before saving:", {
      errors: validationErrors,
    });
  }

  // Ghi metadata (giá trị đã validate trong nextMeta).
  if (patch.meta) {
    const { error } = await supabase
      .from("exams")
      .update({
        title: nextMeta.title,
        subject: nextMeta.subject,
        grade: nextMeta.grade,
        duration_minutes: nextMeta.durationMinutes,
        school: nextMeta.school ?? null,
        school_year: nextMeta.schoolYear ?? null,
        semester: nextMeta.semester ?? null,
      })
      .eq("id", examId);
    if (error) {
      console.error("[saveExam] update exam:", error.message);
      return failure("server", "Could not save. Try again.");
    }
    // v2.2: đổi subject/grade (chỉ xảy ra khi chưa publish) cascade xuống
    // questions — topic := subject (ADR-0004 mặc định; đề ở review chưa từng
    // có topic tự biên tập nên ghi đè toàn bộ là an toàn).
    const subjectChanged = nextMeta.subject !== (examRow.subject as string);
    const gradeChanged = nextMeta.grade !== (examRow.grade as number);
    if ((subjectChanged || gradeChanged) && questionIds.length > 0) {
      const { error: cascadeErr } = await supabase
        .from("questions")
        .update({
          ...(subjectChanged && { subject: nextMeta.subject, topic: nextMeta.subject }),
          ...(gradeChanged && { grade: nextMeta.grade }),
        })
        .in("id", questionIds);
      if (cascadeErr) {
        console.error("[saveExam] cascade subject/grade:", cascadeErr.message);
        return failure("server", "Could not save. Try again.");
      }
    }
  }

  // Ghi từng câu được patch (RLS confines về đề của mình). Id đích resolve
  // theo danh tính — patch id v2.1 vá được row v2.0 (không cho vá câu ngoài đề).
  const rowIdByIdentity = new Map(
    questionIds.map((id, i) => [identityOfRow(id, i), id] as const)
  );
  for (const p of patch.questions ?? []) {
    const idt = questionIdentityFromId(p.id, -1);
    const targetId = rowIdByIdentity.get(`${idt.part}:${idt.number}`);
    if (!targetId) continue; // không cho vá câu ngoài đề
    const { error } = await supabase
      .from("questions")
      .update({
        ...(p.stem !== undefined && { content: p.stem }),
        // true_false: các ý a–d cũng lưu ở cột choices (ADR-0005).
        ...(p.choices !== undefined && { choices: p.choices }),
        ...(p.subItems !== undefined && { choices: p.subItems }),
        ...(p.correctAnswer !== undefined && {
          correct_answer: p.correctAnswer,
        }),
        ...(p.subAnswers !== undefined && { sub_answers: p.subAnswers }),
        ...(p.essayAnswer !== undefined && { essay_answer: p.essayAnswer }),
        ...(p.imageUrl !== undefined && { image_url: p.imageUrl }),
      })
      .eq("id", targetId);
    if (error) {
      console.error("[saveExam] update question:", error.message);
      return failure("server", "Could not save a question. Try again.");
    }
  }

  // Đề chưa published: tính lại status theo kết quả validate.
  if (examRow.status !== "published") {
    const next = validationErrors.length > 0 ? "failed" : "review";
    if (next !== examRow.status) {
      await supabase.from("exams").update({ status: next }).eq("id", examId);
    }
  }

  revalidatePath(`/me/exams/${examId}`);
  revalidatePath("/me/exams");
  return {};
}

/** Publish (AC-016/017 + v2.2 AC-038): đề của mình + status review/draft +
 * validate SẠCH cả câu hỏi LẪN metadata (ADR-0007 — gate metadata nằm Ở ĐÂY,
 * không phải ở upload; server tự từ chối bất kể nút client có disable hay không). */
export async function publishExam(examId: string): Promise<{ error?: UgcActionFailure["error"] }> {
  const { supabase, user } = await requireUser();

  const { data: examRow } = await supabase
    .from("exams")
    .select(
      "id, title, subject, grade, duration_minutes, school, school_year, semester, status, question_ids, parts"
    )
    .eq("id", examId)
    .eq("author_id", user.id)
    .maybeSingle();
  if (!examRow) {
    return failure("server", "Exam not found or you are not its author.");
  }
  if (examRow.status !== "review" && examRow.status !== "draft") {
    return failure(
      "validation",
      examRow.status === "published"
        ? "This exam is already published."
        : examRow.status === "removed"
          ? // Takedown (Security review #7): RLS cũng chặn ở tầng DB
            // (exams_update_author loại trừ 'removed'), đây chỉ là câu thông báo
            // rõ ràng thay cho một lỗi ghi im lặng.
            "This exam was removed by a moderator and cannot be published."
          : "Fix the extraction issues before publishing."
    );
  }

  const questionIds = (examRow.question_ids as string[]) ?? [];
  // Xem ghi chú ở saveExam: đáp án chỉ ra khỏi DB qua exam_answer_key()
  // (schema.sql §10a), nhánh "tác giả".
  const { data: qData } = await supabase.rpc("exam_answer_key", { p_exam_id: examId });
  const qRows = (qData ?? []) as Array<Record<string, unknown>>;

  const assembled = assembledFromRows(
    {
      title: examRow.title as string,
      subject: examRow.subject as string,
      grade: examRow.grade as number,
      duration_minutes: examRow.duration_minutes as number,
      school: examRow.school as string | null,
      school_year: examRow.school_year as number | null,
      semester: examRow.semester as string | null,
      question_ids: questionIds,
      parts: (examRow.parts as { number: number; title: string }[] | null) ?? null,
    },
    qRows ?? []
  );
  // v2.2 (AC-038): metadata sentinel/ngoài khoảng chặn publish — sort TRƯỚC
  // lỗi từng câu (gate toàn đề).
  const errors = [...validateMetaForPublish(assembled.meta), ...validateAssembledExam(assembled)];
  if (errors.length > 0) {
    return failure("validation", "Fix these issues before publishing:", {
      errors,
    });
  }

  const { error } = await supabase
    .from("exams")
    .update({ status: "published", reviewed_at: new Date().toISOString() })
    .eq("id", examId);
  if (error) {
    console.error("[publishExam]", error.message);
    return failure("server", "Could not publish. Try again.");
  }

  revalidatePath(`/me/exams/${examId}`);
  revalidatePath("/me/exams");
  revalidatePath("/exams");
  return {};
}

/** Xoá đề của mình (mọi status): questions + Storage objects + row exams. */
export async function deleteExam(examId: string): Promise<{ error?: UgcActionFailure["error"] }> {
  const { supabase, user } = await requireUser();

  const { data: examRow } = await supabase
    .from("exams")
    .select("id, question_ids")
    .eq("id", examId)
    .eq("author_id", user.id)
    .maybeSingle();
  if (!examRow) {
    return failure("server", "Exam not found or you are not its author.");
  }

  // ⚠ THỨ TỰ QUAN TRỌNG — DB TRƯỚC, Storage SAU.
  //
  // Trước 2026-08-04 thứ tự ngược lại và đã gây hỏng dữ liệu thật trên
  // production: xoá file xong mới đụng DB, DB fail (khoá ngoại attempt_answers
  // → questions thiếu `on delete cascade`, xem schema.sql §L2) → đề vẫn
  // `published` nhưng ảnh đã bay sạch. Học sinh mở đề thấy câu "như hình vẽ
  // bên" mà không còn hình nào.
  //
  // Không có transaction bao được cả hai (Storage nằm ngoài Postgres), nên
  // chọn chiều fail ÍT HẠI HƠN: DB fail trước → chưa xoá gì, đề còn nguyên
  // vẹn; Storage fail sau → còn file mồ côi, tốn dung lượng nhưng không ai
  // nhìn thấy và dọn lại được bất cứ lúc nào.

  // Questions xoá TRƯỚC exams (policy delete của questions cần row exams còn).
  const questionIds = (examRow.question_ids as string[]) ?? [];
  if (questionIds.length > 0) {
    const { error } = await supabase.from("questions").delete().in("id", questionIds);
    if (error) {
      console.error("[deleteExam] questions:", error.code, error.message);
      return failure("server", "Could not delete the questions. Try again.");
    }
  }

  const { error } = await supabase.from("exams").delete().eq("id", examId);
  if (error) {
    console.error("[deleteExam] exam:", error.code, error.message);
    return failure("server", "Could not delete the exam. Try again.");
  }

  // Từ đây DB đã sạch — đề không còn tồn tại với bất kỳ ai. File rác không
  // ảnh hưởng người dùng, nên lỗi ở bước này chỉ log, KHÔNG báo fail (báo fail
  // sẽ khiến người dùng bấm Delete lại trên một đề đã biến mất).
  for (const bucket of [IMAGES_BUCKET, UPLOADS_BUCKET]) {
    const { data: objects } = await supabase.storage.from(bucket).list(examId);
    const paths = (objects ?? []).map((o) => `${examId}/${o.name}`);
    if (paths.length > 0) {
      const { error: rmError } = await supabase.storage.from(bucket).remove(paths);
      if (rmError) {
        console.error(`[deleteExam] storage ${bucket} (đã mồ côi):`, rmError.message);
      }
    }
  }

  revalidatePath("/me/exams");
  revalidatePath("/exams");
  return {};
}

/** Report đề published (AC-025/026). 1 report / user / đề — trùng → "duplicate". */
export async function reportExam(
  examId: string,
  reason: string
): Promise<{ error?: "duplicate" | "empty" | "rate_limited" | "server" }> {
  const { supabase, user } = await requireUser();

  // Rate limit (Security review Low). unique(exam_id, reporter_id) chỉ chặn
  // report TRÙNG trên CÙNG một đề — không chặn được việc quét qua nhiều đề.
  const rl = guard("reportExam", user.id);
  if (!rl.ok) return { error: "rate_limited" };

  const trimmed = reason.trim().slice(0, LIMITS.MAX_REPORT_REASON);
  if (trimmed.length === 0) return { error: "empty" };

  const { data: profile } = await supabase
    .from("user_profiles")
    .select("display_name")
    .eq("id", user.id)
    .single();

  const { error } = await supabase.from("exam_reports").insert({
    exam_id: examId,
    reporter_display_name: profile?.display_name ?? null,
    reason: trimmed,
  });
  if (error) {
    if (error.code === "23505") return { error: "duplicate" };
    // RLS chặn (đề chưa published) hoặc lỗi hạ tầng — không lộ chi tiết.
    console.error("[reportExam]", error.code, error.message);
    return { error: "server" };
  }
  return {};
}
