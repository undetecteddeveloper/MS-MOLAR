// Helper dùng chung của các Server Action trong features/authoring/.
//
// KHÔNG mang directive "use server", và đó là điều kiện để file này tồn tại:
// trong một module Server Action, mọi export phải là async function. Hằng số
// (`EXT_BY_MIME`) và hàm đồng bộ (`failure`) không thoả, nên chúng phải sống
// ở một module thường mà ba file action cùng import.
//
// Tách khỏi `actions.ts` (1.190 dòng) ngày 2026-09-03, mục 7 của đợt refactor.
import "server-only";

import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { LIMITS } from "@/lib/ugc/limits";
import type { FileRef } from "@/lib/ugc/fileRef";
import { isSubject } from "@/lib/ugc/subjects";
import { makeUgcError } from "@/lib/ugc/errorCopy";
import type { TypedMeta } from "@/lib/ugc/normalizeMeta";
import type { UgcActionFailure, UgcError } from "@/lib/ugc/types";
import { checkUploadFile, isAllowedMime } from "@/lib/ugc/validateInput";
import { getPdfPageCount } from "@/lib/ugc/pdf";
import { createPipelineLogger } from "@/lib/ugc/pipelineLog";

export const UPLOADS_BUCKET = "exam-uploads";
export const IMAGES_BUCKET = "exam-images";

export const EXT_BY_MIME: Record<string, string> = {
  "image/png": "png",
  "image/jpeg": "jpg",
  "image/webp": "webp",
  "application/pdf": "pdf",
};

/** Lấy user hiện tại; chưa đăng nhập → về trang chủ mở dialog sign-in (AC-002). */
export async function requireUser() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect("/?auth=signin");
  return { supabase, user };
}

export function failure(
  kind: UgcActionFailure["error"]["kind"],
  message: string,
  extra?: { errors?: UgcError[]; fieldErrors?: Record<string, string> }
): UgcActionFailure {
  return { error: { kind, message, ...extra } };
}

/** File (FormData) → FileRef sau khi check loại/kích thước/số trang. */
export async function toFileRef(
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
export function parseTypedMeta(formData: FormData): TypedMeta {
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
