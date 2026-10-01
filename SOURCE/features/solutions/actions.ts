// Bài giải cộng đồng — Server Action ghi của màn viết (saveSolution,
// setSolutionStatus) và của màn xem (toggleHelpful, setPin). Cùng hình dạng
// với reportExam (features/authoring/lifecycleActions.ts, MÔ HÌNH THAM KHẢO —
// không import chéo, B4): requireUser() → guard() → .rpc() trên session
// client → switch theo error.code.
//
// Error signalling (backend DD § Data Contracts "Error signalling" clause
// (a)/(b), binding): KHÔNG action nào ở đây đọc/so khớp/tách/nội suy trường
// message của lỗi RPC, với bất kỳ mã nào — message chỉ là dữ liệu log server.
// `error.details` chỉ được đọc khi `error.code === "23514"`, và chỉ trên hai
// hàm này — `saveSolution` so khớp CHÍNH XÁC token `below_word_count`;
// `setSolutionStatus` parse số nguyên hữu hạn >= 1. `toggleHelpful`/`setPin`
// không đọc `error.details` cho mã nào — mọi mã (`42501`/`22023`/`23514`/
// khác) đều là `generic` (clause (b) không áp dụng, xem `mapHelpfulPinError`).
// Không có mã `notEligible` hay `hidden` trên hợp đồng nào — bài bị ẩn không
// có nút Lưu/Đăng/Gỡ/Hữu ích/Ghim ở giao diện (AC-083), nên mọi từ chối còn
// lại (mọi `42501`) là `generic`.
"use server";

import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { guard } from "@/lib/security/rateLimit";
import { LIMITS } from "@/lib/ugc/limits";
import type { SolutionStatus } from "./queries";

export interface SaveSolutionNotePatch {
  questionId: string;
  body: string;
}

export interface SaveSolutionPatch {
  attemptId: string | null;
  showProfile: boolean;
  showScore: boolean;
  notes: SaveSolutionNotePatch[];
}

export type SaveSolutionResult =
  | { ok: true; solutionId: string; status: SolutionStatus }
  | {
      ok: false;
      error:
        | { code: "rateLimited"; seconds: number }
        | { code: "belowWordCount" }
        | { code: "generic" };
    };

export type SolutionStatusAction = "publish" | "draft";

export type SetSolutionStatusResult =
  | { ok: true; status: SolutionStatus }
  | {
      ok: false;
      error:
        | { code: "belowWordCount"; missingCount: number }
        | { code: "rateLimited"; seconds: number }
        | { code: "generic" };
    };

/** Hình dạng tối thiểu của lỗi PostgREST mà hai mapper dưới đây cần —
 *  KHÔNG khai `message` (clause (a): không nơi nào trong file này được đọc nó). */
interface RpcErrorLike {
  code?: string;
  details?: string | null;
}

/** Lấy user hiện tại; chưa đăng nhập → về trang chủ mở dialog sign-in.
 *  Bản sao riêng của tính năng (không export) — mô phỏng
 *  features/authoring/internals.ts's requireUser(), không import chéo (B4).
 *  Không cần async-export vì đây là hàm private, không nằm dưới ràng buộc
 *  "mọi export của module 'use server' phải là async" của Next.js. */
async function requireUser() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect("/?auth=signin");
  return { supabase, user };
}

// Backend DD § Logging and Monitoring (binding, task 04): "log unexpected
// (non-42501/23505/23514) RPC errors" — 23505 ở lại tập im lặng dù
// save_community_solution chèn qua "on conflict ... do update" (schema.sql
// §16, khoá trùng chỉ CẬP NHẬT): quy tắc log áp cho MỌI Server Action của cả
// file, không riêng saveSolution/setSolutionStatus, và tránh im lặng khỏi
// đúng dạng quyết định thiết kế cần hỏi kỹ sư trước khi đổi (không tự bỏ).
const SILENT_RPC_ERROR_CODES = new Set(["42501", "23505", "23514"]);

/** console.error CHỈ cho mã "bất ngờ" (backend DD § Logging and Monitoring) —
 *  không log 42501/23505/23514, những từ chối đã lường trước; không bao giờ
 *  log message/note/comment/report — chỉ tên RPC + code. Dùng chung cho cả
 *  hai action, một bảng loại trừ duy nhất (Refactor: không lặp lại luật này).
 *  Tham số thứ ba TUỲ CHỌN — mặc định `SILENT_RPC_ERROR_CODES` (giữ nguyên
 *  hành vi hai action trên, nơi `23514` là một nhánh ĐÃ XỬ LÝ qua
 *  `error.details`, clause (b)). `toggleHelpful`/`setPin` không đọc
 *  `error.details` cho mã nào — với chúng, `23514` là backstop CHƯA TỪNG chạm
 *  tới, cùng nhóm với "mã khác" (backend DD § Data Contracts "Error
 *  signalling"), nên chúng truyền một tập im lặng RIÊNG thay vì tái dùng tập
 *  trên sai ngữ nghĩa. */
function logUnexpectedRpcError(
  rpcName: string,
  error: RpcErrorLike,
  silentCodes: ReadonlySet<string> = SILENT_RPC_ERROR_CODES
) {
  if (silentCodes.has(error.code ?? "")) return;
  console.error(`[${rpcName}]`, error.code);
}

/** Error mapping cho saveSolution — `error.details` chỉ đọc khi
 *  `error.code === "23514"`, và chỉ khớp CHÍNH XÁC token `below_word_count`
 *  (Save refusal carrier, backend DD v1.9). Mọi DETAIL khác trên cùng mã —
 *  kể cả "Failing row contains (…)" của CHECK độ dài ghi chú — là `generic`. */
function mapSaveSolutionError(error: RpcErrorLike): Extract<SaveSolutionResult, { ok: false }>["error"] {
  logUnexpectedRpcError("save_community_solution", error);
  if (error.code === "23514" && error.details === "below_word_count") {
    return { code: "belowWordCount" };
  }
  return { code: "generic" };
}

/** Error mapping cho setSolutionStatus — `error.details` chỉ đọc khi
 *  `error.code === "23514"`, parse bằng `Number.parseInt`, chỉ nhận số nguyên
 *  hữu hạn >= 1 làm `missingCount` (Reference Contract Value #12). Mọi DETAIL
 *  không đạt điều kiện đó — "0", "-1", "", không parse được — là `generic`,
 *  không bao giờ là một con số đoán. */
function mapSetSolutionStatusError(
  error: RpcErrorLike
): Extract<SetSolutionStatusResult, { ok: false }>["error"] {
  logUnexpectedRpcError("set_community_solution_status", error);
  if (error.code === "23514") {
    const missingCount = Number.parseInt(error.details ?? "", 10);
    if (Number.isFinite(missingCount) && missingCount >= 1) {
      return { code: "belowWordCount", missingCount };
    }
  }
  return { code: "generic" };
}

/**
 * Lưu nháp/ghi chú của bài giải (AC-016, AC-024, AC-031). Tất-cả-hoặc-không ở
 * tầng RPC; action này không xử lý gì thêm ngoài rate-limit + chuyển đổi lỗi —
 * không bao giờ xoá/đặt lại `patch` (chữ không mất trên nhánh lỗi, AC-032).
 */
export async function saveSolution(examId: string, patch: SaveSolutionPatch): Promise<SaveSolutionResult> {
  const { supabase, user } = await requireUser();

  const rl = await guard("communitySolutionSave", user.id);
  if (!rl.ok) {
    return { ok: false, error: { code: "rateLimited", seconds: rl.retryAfterSeconds } };
  }

  const { data, error } = await supabase.rpc("save_community_solution", {
    p_exam_id: examId,
    p_attempt_id: patch.attemptId,
    p_show_profile: patch.showProfile,
    p_show_score: patch.showScore,
    p_notes: patch.notes.map((note) => ({ question_id: note.questionId, body: note.body })),
  });
  if (error) {
    return { ok: false, error: mapSaveSolutionError(error) };
  }

  const [row] = (data ?? []) as Array<{ solution_id: string; status: SolutionStatus }>;
  return { ok: true, solutionId: row.solution_id, status: row.status };
}

/**
 * Chuyển trạng thái nháp ↔ đăng (R4, AC-029). `action` chỉ nhận đúng hai giá
 * trị — bất kỳ chuỗi nào khác bị từ chối TRƯỚC khi chạm tới `requireUser()`
 * hay RPC (Failure Mode #4).
 */
export async function setSolutionStatus(
  examId: string,
  action: SolutionStatusAction
): Promise<SetSolutionStatusResult> {
  if (action !== "publish" && action !== "draft") {
    return { ok: false, error: { code: "generic" } };
  }

  const { supabase, user } = await requireUser();

  const rl = await guard("communitySolutionStatus", user.id);
  if (!rl.ok) {
    return { ok: false, error: { code: "rateLimited", seconds: rl.retryAfterSeconds } };
  }

  const { data, error } = await supabase.rpc("set_community_solution_status", {
    p_exam_id: examId,
    p_action: action,
  });
  if (error) {
    return { ok: false, error: mapSetSolutionStatusError(error) };
  }

  const [row] = (data ?? []) as Array<{ status: SolutionStatus }>;
  return { ok: true, status: row.status };
}

export type ToggleHelpfulResult =
  | { ok: true; on: boolean }
  | {
      ok: false;
      error: { code: "rateLimited"; seconds: number } | { code: "generic" };
    };

export type SetPinAction = "pin" | "unpin";

export type SetPinResult =
  | { ok: true; pinnedSolutionId: string | null }
  | {
      ok: false;
      error: { code: "rateLimited"; seconds: number } | { code: "generic" };
    };

/** `toggleHelpful`/`setPin` không có DETAIL nào đọc (khác `saveSolution`/
 *  `setSolutionStatus` — clause (b) không áp dụng ở đây): `42501`/`22023` là
 *  từ chối ĐÃ LƯỜNG TRƯỚC (không log); `23514` (CHECK backstop, không nhánh
 *  nào của hai action này chạm tới) và mọi mã khác đều BẤT NGỜ, log tên RPC +
 *  code (backend DD § Data Contracts "Error signalling"). */
const HELPFUL_PIN_SILENT_ERROR_CODES = new Set(["42501", "22023"]);

function mapHelpfulPinError(rpcName: string, error: RpcErrorLike): { code: "generic" } {
  logUnexpectedRpcError(rpcName, error, HELPFUL_PIN_SILENT_ERROR_CODES);
  return { code: "generic" };
}

/**
 * Bấm "Hữu ích" (AC-064, AC-066). MỘT tham số — không có cờ trạng thái đích:
 * `on` luôn là sự hiện diện của dòng Helpful trong DB SAU lời gọi, không bao
 * giờ là echo của client. `add_community_solution_helpful` tự nuốt lần lặp
 * ("on conflict do nothing") nên không có mã lỗi trùng khoá nào tới được
 * action này, và action không bao giờ đọc/ghi trực tiếp bảng Helpful qua
 * PostgREST — bảng đó đóng hoàn toàn (RLS bật, không policy, không quyền).
 * Một token `guard()` cho mỗi lần gọi, kể cả khi hai RPC được gọi (add rồi
 * remove).
 */
export async function toggleHelpful(solutionId: string): Promise<ToggleHelpfulResult> {
  const { supabase, user } = await requireUser();

  const rl = await guard("communitySolutionHelpful", user.id);
  if (!rl.ok) {
    return { ok: false, error: { code: "rateLimited", seconds: rl.retryAfterSeconds } };
  }

  const { data: addData, error: addError } = await supabase.rpc("add_community_solution_helpful", {
    p_solution_id: solutionId,
  });
  if (addError) {
    return { ok: false, error: mapHelpfulPinError("add_community_solution_helpful", addError) };
  }

  const [addRow] = (addData ?? []) as Array<{ added: boolean }>;
  if (addRow?.added) {
    return { ok: true, on: true };
  }

  const { error: removeError } = await supabase.rpc("remove_community_solution_helpful", {
    p_solution_id: solutionId,
  });
  if (removeError) {
    return { ok: false, error: mapHelpfulPinError("remove_community_solution_helpful", removeError) };
  }

  return { ok: true, on: false };
}

/**
 * Ghim/bỏ ghim bài giải nổi bật của đề (AC-078, Reference Contract Value
 * #22). `action` chỉ nhận đúng `"pin" | "unpin"` — bất kỳ chuỗi nào khác bị
 * từ chối TRƯỚC khi chạm tới `requireUser()` hay RPC (Failure Mode #4, cùng
 * quy ước với `setSolutionStatus`). `solutionId` luôn được CHUYỂN TIẾP
 * nguyên vẹn tới RPC — kể cả `undefined` khi `action === "unpin"` — không
 * bao giờ tách thành hai lời gọi RPC.
 */
export async function setPin(
  examId: string,
  action: SetPinAction,
  solutionId?: string
): Promise<SetPinResult> {
  if (action !== "pin" && action !== "unpin") {
    return { ok: false, error: { code: "generic" } };
  }

  const { supabase, user } = await requireUser();

  const rl = await guard("communitySolutionPin", user.id);
  if (!rl.ok) {
    return { ok: false, error: { code: "rateLimited", seconds: rl.retryAfterSeconds } };
  }

  const { data, error } = await supabase.rpc("set_community_solution_pin", {
    p_exam_id: examId,
    p_action: action,
    p_solution_id: solutionId,
  });
  if (error) {
    return { ok: false, error: mapHelpfulPinError("set_community_solution_pin", error) };
  }

  const [row] = (data ?? []) as Array<{ pinned_solution_id: string | null }>;
  return { ok: true, pinnedSolutionId: row?.pinned_solution_id ?? null };
}

// ----------------------------------------------------------------------------
// Phase 3 — bình luận (task 26). Bảng bình luận cộng đồng có RLS bật, KHÔNG
// policy, KHÔNG grant (U1): đường ghi DUY NHẤT là hai RPC SECURITY DEFINER
// dưới đây — không action nào ở đây đọc/ghi trực tiếp bảng đó qua PostgREST.
// `error.details` không được đọc cho mã nào trên hai action này (khác
// saveSolution/setSolutionStatus phía trên) — mọi từ chối khác empty/tooLong/
// rateLimited đều là `generic` (backend DD § Data Contracts "Error signalling").

const COMMENT_BODY_MAX_LENGTH = 2000;

/** Tập mã im lặng RIÊNG của hai action bình luận: chỉ `42501` (từ chối đã
 *  lường trước) — khác `SILENT_RPC_ERROR_CODES` phía trên (tập đó mang thêm
 *  một mã trùng khoá, không áp dụng ở đây) và không có `23514` (Required Test
 *  #5: `23514` PHẢI log tên RPC + code, vì hai action này không có nhánh đọc
 *  `error.details` nào xử lý nó — nó là backstop CHƯA TỪNG chạm tới, cùng
 *  nhóm với "mã khác"). */
const COMMENT_SILENT_ERROR_CODES = new Set(["42501"]);

function mapCommentError(rpcName: string, error: RpcErrorLike): { code: "generic" } {
  logUnexpectedRpcError(rpcName, error, COMMENT_SILENT_ERROR_CODES);
  return { code: "generic" };
}

export interface PostedComment {
  id: string;
  createdAt: string;
  solutionId: string;
  questionId: string;
  body: string;
  isAnonymous: boolean;
  /** Gốc của mạch và câu được trả lời — lấy từ RPC (server suy ra gốc khi trả
   *  lời một câu trả lời), không bao giờ tự suy ở client. `null` = bình luận gốc. */
  parentId: string | null;
  replyToId: string | null;
}

export type PostCommentResult =
  | { ok: true; comment: PostedComment }
  | {
      ok: false;
      error:
        | { code: "empty" }
        | { code: "tooLong" }
        | { code: "rateLimited"; seconds: number }
        | { code: "generic" };
    };

export type DeleteCommentResult =
  | { ok: true }
  | {
      ok: false;
      error: { code: "rateLimited"; seconds: number } | { code: "generic" };
    };

export type MarkCommentsReadResult =
  | { ok: true }
  | { ok: false; error: { code: "rateLimited"; seconds: number } | { code: "generic" } };

/**
 * Đăng bình luận vào một câu của bài giải người khác (AC-069, AC-091).
 * Validation (rỗng/quá dài) chạy TRƯỚC bất kỳ RPC nào — không caller nào chạm
 * DB với một thân rỗng hay vượt 2000 ký tự. `body`/`isAnonymous` KHÔNG bao giờ
 * bị sửa trên nhánh lỗi (Failure Mode #3).
 */
export async function postComment(
  solutionId: string,
  questionId: string,
  body: string,
  isAnonymous: boolean,
  replyToId?: string
): Promise<PostCommentResult> {
  if (body.trim().length === 0) {
    return { ok: false, error: { code: "empty" } };
  }
  if (body.length > COMMENT_BODY_MAX_LENGTH) {
    return { ok: false, error: { code: "tooLong" } };
  }

  const { supabase, user } = await requireUser();

  const rl = await guard("communitySolutionComment", user.id);
  if (!rl.ok) {
    return { ok: false, error: { code: "rateLimited", seconds: rl.retryAfterSeconds } };
  }

  const { data, error } = await supabase.rpc("post_community_comment", {
    p_solution_id: solutionId,
    p_question_id: questionId,
    p_body: body,
    p_is_anonymous: isAnonymous,
    ...(replyToId !== undefined ? { p_reply_to_id: replyToId } : {}),
  });
  if (error) {
    return { ok: false, error: mapCommentError("post_community_comment", error) };
  }

  const [row] = (data ?? []) as Array<{
    comment_id: string;
    comment_created_at: string;
    comment_parent_id: string | null;
    comment_reply_to_id: string | null;
  }>;
  return {
    ok: true,
    comment: {
      id: row.comment_id,
      createdAt: row.comment_created_at,
      solutionId,
      questionId,
      body,
      isAnonymous,
      parentId: row.comment_parent_id ?? null,
      replyToId: row.comment_reply_to_id ?? null,
    },
  };
}

/**
 * Xoá bình luận của chính người gọi (AC-070). Không có nhánh "xoá 0 dòng"
 * riêng — RPC tự raise `42501` cho mọi trường hợp không đủ điều kiện (bình
 * luận của người khác, của chính tác giả bài giải cố xoá bình luận người
 * khác, hay bình luận của chính mình đã bị ẩn — S19), nên action chỉ có hai
 * nhánh: thành công (không lỗi) hoặc `generic`.
 */
export async function deleteComment(commentId: string): Promise<DeleteCommentResult> {
  const { supabase, user } = await requireUser();

  const rl = await guard("communitySolutionCommentDelete", user.id);
  if (!rl.ok) {
    return { ok: false, error: { code: "rateLimited", seconds: rl.retryAfterSeconds } };
  }

  const { error } = await supabase.rpc("delete_community_comment", { p_comment_id: commentId });
  if (error) {
    return { ok: false, error: mapCommentError("delete_community_comment", error) };
  }

  return { ok: true };
}

/**
 * Đánh dấu "đã đọc" toàn bộ bình luận tới thời điểm gọi — GHI DUY NHẤT của
 * task này KHÔNG qua RPC: một update thường trên chính hàng
 * `user_profiles` của người gọi, dưới `profiles_update_own` không đổi (cùng
 * tiền lệ `updateProfile`, `SOURCE/features/auth/actions.ts:176-210`).
 * Không đọc/ghi bảng cộng đồng nào.
 *
 * An toàn khi không-có-gì-để-đọc (Failure Mode #2): một lượt cập nhật 0 dòng
 * (không có bình luận nào tồn tại) vẫn là PostgREST update thành công (không
 * `error`), nên đây luôn là cùng MỘT hình dạng thành công.
 *
 * Quy tắc cho phía tiêu thụ (task 45): gọi hàm này khi tab mở, KHÔNG BAO GIỜ
 * gọi lúc component vừa mount trước khi dữ liệu khiến người dùng ghé qua đã
 * tải xong — gọi sớm sẽ đánh dấu đã đọc những bình luận người dùng chưa từng
 * thấy.
 */
export async function markCommentsRead(): Promise<MarkCommentsReadResult> {
  const { supabase, user } = await requireUser();

  const rl = await guard("communityCommentsMarkRead", user.id);
  if (!rl.ok) {
    return { ok: false, error: { code: "rateLimited", seconds: rl.retryAfterSeconds } };
  }

  const { error } = await supabase
    .from("user_profiles")
    .update({ community_comments_last_read_at: new Date().toISOString() })
    .eq("id", user.id);
  // Không đọc trường message của lỗi (cùng quy ước với hai action trên) — 0
  // dòng đổi (không có gì để đánh dấu) không sinh `error` (Failure Mode #2),
  // nên nhánh dưới đây chỉ chạm tới khi update thật sự hỏng (hạ tầng).
  if (error) {
    console.error("[markCommentsRead]", error.code);
    return { ok: false, error: { code: "generic" } };
  }

  return { ok: true };
}

// ----------------------------------------------------------------------------
// Phase 4 — báo cáo bài giải / bình luận (task 33). U1 (backend DD v1.2):
// community_content_reports có RLS bật, KHÔNG policy, KHÔNG grant — đường ghi
// DUY NHẤT là hai RPC SECURITY DEFINER dưới đây. Không có nhánh bắt lỗi trùng
// khoá nào ở đây: một báo cáo lặp là một THÀNH CÔNG mà chính RPC tự báo qua
// `already_reported = true` (chỉ số đó tự nuốt lần lặp qua
// "on conflict ... do nothing"), không phải một lỗi trùng khoá tới action.

export type ReportResult =
  | { ok: true; alreadyReported: boolean }
  | {
      ok: false;
      error: { code: "empty" } | { code: "rateLimited"; seconds: number } | { code: "generic" };
    };

/** Tập mã im lặng của hai action báo cáo: chỉ `42501` (từ chối đã lường
 *  trước) — cùng quy ước với `COMMENT_SILENT_ERROR_CODES`. Không có `23514`
 *  trong tập này: đó là CHECK backstop trên `reason` mà validation của chính
 *  hai action này (rỗng → chặn TRƯỚC RPC; cắt còn `MAX_REPORT_REASON`) khiến
 *  không nhánh nào chạm tới được — cùng nhóm với "mã khác", nên nó BẤT NGỜ và
 *  phải log tên RPC + code. */
const REPORT_SILENT_ERROR_CODES = new Set(["42501"]);

function mapReportError(rpcName: string, error: RpcErrorLike): { code: "generic" } {
  logUnexpectedRpcError(rpcName, error, REPORT_SILENT_ERROR_CODES);
  return { code: "generic" };
}

/** Validation lý do báo cáo dùng chung cho `reportSolution`/`reportComment`
 *  (Refactor: một luật, không lặp lại) — mô hình từ `reportExam`
 *  (`features/authoring/lifecycleActions.ts`, không import chéo, B4): trim
 *  trước, rỗng thì chặn TRƯỚC mọi RPC; hợp lệ thì cắt còn đúng
 *  `LIMITS.MAX_REPORT_REASON` ký tự, và giá trị ĐÃ CẮT là thứ gửi đi làm
 *  `p_reason`. */
function validateReportReason(reason: string): { ok: true; reason: string } | { ok: false } {
  const trimmed = reason.trim();
  if (trimmed.length === 0) {
    return { ok: false };
  }
  return { ok: true, reason: trimmed.slice(0, LIMITS.MAX_REPORT_REASON) };
}

/**
 * Báo cáo bài giải người khác (AC-073, AC-074, AC-075). Một báo cáo không
 * đổi gì tới hiển thị/thứ hạng của bài (AC-075) — lời gọi `.rpc` duy nhất mỗi
 * lần gọi, không trigger, không ghi tiếp `community_solutions`. Lần báo cáo
 * lặp trên cùng cặp (bài, người báo cáo) là THÀNH CÔNG (`alreadyReported:
 * true`), copy nguyên từ `already_reported` của RPC — không bao giờ suy ra từ
 * mã lỗi.
 */
export async function reportSolution(solutionId: string, reason: string): Promise<ReportResult> {
  const { supabase, user } = await requireUser();

  const rl = await guard("communitySolutionReport", user.id);
  if (!rl.ok) {
    return { ok: false, error: { code: "rateLimited", seconds: rl.retryAfterSeconds } };
  }

  const validated = validateReportReason(reason);
  if (!validated.ok) {
    return { ok: false, error: { code: "empty" } };
  }

  const { data, error } = await supabase.rpc("report_community_solution", {
    p_solution_id: solutionId,
    p_reason: validated.reason,
  });
  if (error) {
    return { ok: false, error: mapReportError("report_community_solution", error) };
  }

  const [row] = (data ?? []) as Array<{ already_reported: boolean }>;
  return { ok: true, alreadyReported: row.already_reported };
}

/**
 * Báo cáo bình luận không phải của mình (AC-076, AC-074). Cùng hình dạng với
 * `reportSolution` — cùng validation, cùng cách đọc `already_reported`, khác
 * duy nhất RPC đích và tham số `p_comment_id`.
 */
export async function reportComment(commentId: string, reason: string): Promise<ReportResult> {
  const { supabase, user } = await requireUser();

  const rl = await guard("communityCommentReport", user.id);
  if (!rl.ok) {
    return { ok: false, error: { code: "rateLimited", seconds: rl.retryAfterSeconds } };
  }

  const validated = validateReportReason(reason);
  if (!validated.ok) {
    return { ok: false, error: { code: "empty" } };
  }

  const { data, error } = await supabase.rpc("report_community_comment", {
    p_comment_id: commentId,
    p_reason: validated.reason,
  });
  if (error) {
    return { ok: false, error: mapReportError("report_community_comment", error) };
  }

  const [row] = (data ?? []) as Array<{ already_reported: boolean }>;
  return { ok: true, alreadyReported: row.already_reported };
}
