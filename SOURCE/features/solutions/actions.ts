// Bài giải cộng đồng — hai Server Action ghi của màn viết: lưu nháp/ghi chú
// (saveSolution) và chuyển trạng thái nháp/đăng (setSolutionStatus). Cùng
// hình dạng với reportExam (features/authoring/lifecycleActions.ts, MÔ HÌNH
// THAM KHẢO — không import chéo, B4): requireUser() → guard() → .rpc() trên
// session client → switch theo error.code.
//
// Error signalling (backend DD § Data Contracts "Error signalling" clause
// (a)/(b), binding): KHÔNG action nào ở đây đọc/so khớp/tách/nội suy trường
// message của lỗi RPC, với bất kỳ mã nào — message chỉ là dữ liệu log server.
// `error.details` chỉ được đọc khi `error.code === "23514"`, và chỉ trên hai
// hàm này — `saveSolution` so khớp CHÍNH XÁC token `below_word_count`;
// `setSolutionStatus` parse số nguyên hữu hạn >= 1. Không có mã `notEligible`
// hay `hidden` trên hợp đồng nào — bài bị ẩn không có nút Lưu/Đăng/Gỡ ở giao
// diện (AC-083), nên mọi từ chối còn lại (mọi `42501`) là `generic`.
"use server";

import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { guard } from "@/lib/security/rateLimit";
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

const SILENT_RPC_ERROR_CODES = new Set(["42501", "23505", "23514"]);

/** console.error CHỈ cho mã "bất ngờ" (backend DD § Logging and Monitoring) —
 *  không log 42501/23505/23514, những từ chối đã lường trước; không bao giờ
 *  log message/note/comment/report — chỉ tên RPC + code. Dùng chung cho cả
 *  hai action, một bảng loại trừ duy nhất (Refactor: không lặp lại luật này). */
function logUnexpectedRpcError(rpcName: string, error: RpcErrorLike) {
  if (SILENT_RPC_ERROR_CODES.has(error.code ?? "")) return;
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
