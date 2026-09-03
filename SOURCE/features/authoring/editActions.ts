// S-03 — tác giả sửa field của đề.
//
// Bất biến của file: đề ĐÃ PUBLISHED phải validate TRƯỚC khi ghi (đề công
// khai luôn sạch); đề chưa published ghi tự do rồi tính lại status.
//
// Tách khỏi `actions.ts` (1.190 dòng) ngày 2026-09-03, mục 7 của đợt refactor.
// Hợp đồng import KHÔNG đổi: `features/authoring/actions.ts` re-export lại.
"use server";

import { revalidatePath } from "next/cache";
import { validateAssembledExam } from "@/lib/ugc/assembleExam";
import { assembledFromRows, questionIdentityFromId } from "@/lib/ugc/fromRows";
import { LIMITS } from "@/lib/ugc/limits";
import { validateMetaForPublish } from "@/lib/ugc/normalizeMeta";
import { isSubject } from "@/lib/ugc/subjects";
import type { ExamMeta, SaveExamPatch, UgcActionFailure } from "@/lib/ugc/types";

import { failure, requireUser } from "./internals";

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
      "id, title, subject, grade, duration_minutes, school, school_year, semester, status, question_ids, parts, passages"
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
      passage_id: p.passageId !== undefined ? p.passageId : r.passage_id,
      points: p.points !== undefined ? (p.points ?? undefined) : r.points,
    };
  });

  // A1 — ngữ liệu dùng chung: patch thay NGUYÊN mảng, vắng patch = giữ bản DB.
  // Trần số phần tử ép Ở ĐÂY chứ không chỉ ở màn review: `patch` tới từ client
  // và không có gì buộc nó phải đến từ UI của mình. Nội dung (rỗng / quá dài /
  // khoá mồ côi) đã có validateAssembledExam bắt ngay dưới, nên chỗ này chỉ
  // cần chặn thứ mà validate không nhìn thấy — số lượng.
  const storedPassages =
    (examRow.passages as { id: string; title?: string; text: string }[] | null) ?? null;
  if (patch.passages && patch.passages.length > LIMITS.MAX_PASSAGES) {
    return failure("validation", "Too many shared reading passages.");
  }
  const nextPassages = patch.passages ?? storedPassages;

  // Tiêu đề phần — patch thay NGUYÊN mảng, vắng patch = giữ bản DB. Validate ở
  // đây và KHÔNG ở validateAssembledExam: hàm đó quyết định status
  // 'review'/'failed', tức "file của bạn bóc tách được hay hỏng", và một tiêu
  // đề phần gõ hụt không nói gì về file gốc cả (cùng lối lập luận với gate
  // metadata ADR-0007 và gate biểu điểm B1).
  const storedParts = (examRow.parts as { number: number; title: string }[] | null) ?? null;
  if (patch.parts) {
    if (patch.parts.length > LIMITS.MAX_PARTS) {
      return failure("validation", "Too many parts.");
    }
    const seen = new Set<number>();
    for (const p of patch.parts) {
      if (!Number.isInteger(p.number) || p.number < 1 || p.number > LIMITS.MAX_PARTS) {
        return failure("validation", "A part number is out of range.");
      }
      // Hai entry cùng `number` là thứ validateAssembledExam không nhìn thấy
      // (nó đọc câu hỏi, không đọc mảng này) nhưng lại làm heading ở màn sửa đề
      // đổi nghĩa tuỳ thứ tự mảng — bảng tra `titleByPart` giữ entry cuối.
      if (seen.has(p.number)) {
        return failure("validation", "Two parts share the same number.");
      }
      seen.add(p.number);
      if (typeof p.title !== "string" || p.title.trim().length === 0) {
        return failure("validation", "A part title cannot be empty.");
      }
      if (p.title.length > LIMITS.MAX_PART_TITLE) {
        return failure("validation", "A part title is too long.");
      }
    }
  }
  const nextParts = patch.parts ?? storedParts;

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
      parts: nextParts,
      passages: nextPassages,
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

  // Ghi ngữ liệu — ĐỘC LẬP với `patch.meta`: tác giả sửa bài đọc mà không đụng
  // tới metadata là đường đi thường gặp nhất, và nhét nó vào nhánh `patch.meta`
  // sẽ làm mọi lượt sửa như thế im lặng không lưu gì.
  if (patch.passages) {
    const { error } = await supabase
      .from("exams")
      .update({ passages: patch.passages.length > 0 ? patch.passages : null })
      .eq("id", examId);
    if (error) {
      console.error("[saveExam] update passages:", error.message);
      return failure("server", "Could not save the shared reading passages. Try again.");
    }
  }

  // Ghi tiêu đề phần — ĐỘC LẬP với `patch.meta`, y hệt `passages` ngay trên và
  // vì đúng lý do đó: sửa mỗi cái heading là đường đi thường gặp nhất.
  // `[]` → null: mảng rỗng và null cùng nghĩa "đề không chia phần", và giữ MỘT
  // cách biểu diễn trong DB thì mọi chỗ đọc (`fromRows`, `assembledFromRows`)
  // không phải xử hai trường hợp.
  if (patch.parts) {
    const { error } = await supabase
      .from("exams")
      .update({ parts: patch.parts.length > 0 ? patch.parts : null })
      .eq("id", examId);
    if (error) {
      console.error("[saveExam] update parts:", error.message);
      return failure("server", "Could not save the part headings. Try again.");
    }
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
        ...(p.passageId !== undefined && { passage_id: p.passageId }),
        // `null` = tác giả XOÁ TRẮNG ô điểm ⇒ ghi NULL, tức "chưa biết".
        // Trước bản này chỗ đây ghi 1, và 1 là một con số HỢP LỆ: validate
        // in-memory (dòng ~848) đọc null nên báo POINTS_MISSING và đặt đề về
        // 'failed', nhưng DB đã giữ 1, nên tải lại trang thì ô điểm hiện 1 và
        // lỗi biến mất — tác giả không có cách nào xoá được một con điểm sai.
        ...(p.points !== undefined && { points: p.points ?? null }),
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
