// Bài giải cộng đồng — Server Action của quản trị viên (hàng đợi báo cáo trên
// /admin). Cùng hình dạng với moderateExamAction (features/admin/actions.ts,
// MÔ HÌNH THAM KHẢO — không import chéo, B4): isAdminUserId() kiểm LẠI ở đây
// trước MỌI lời gọi, rồi .rpc() trên session client; is_admin_user() bên trong
// từng RPC mới là chốt chặn thật (AC-085).
//
// Khác moderateExamAction ở đúng chỗ quan trọng (TD-029, ADR-0021): mọi lượt
// ghi đi qua RPC SECURITY DEFINER cấp cho `authenticated`, KHÔNG BAO GIỜ qua
// client khoá quản trị — file này không import module đó, không ghi bảng nào
// trực tiếp.
//
// Dữ liệu admin KHÔNG che (S5): tên thật luôn đến nguyên vẹn, cờ
// isAnonymousToReaders chỉ nói người ĐỌC sẽ thấy gì — không mapper che danh
// tính nào được dùng ở đây.
//
// Lỗi: không bao giờ đọc trường thông điệp của lỗi RPC; log chỉ tên RPC + mã,
// không bao giờ log lý do kiểm duyệt hay thân ghi chú/bình luận.
"use server";

import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";
import { isAdminUserId } from "@/lib/auth/admin";
import { guard } from "@/lib/security/rateLimit";

export interface AdminReportedAuthor {
  displayName: string;
  isAnonymousToReaders: boolean;
}

/** Một bình luận ĐANG HIỆN có >= 1 báo cáo mở. `questionNumber` là `null` khi
 *  câu của nó đã rời đề (AC-047) — giữ nguyên `null`, không thay bằng số nào. */
export interface AdminReportedCommentItem {
  id: string;
  questionNumber: number | null;
  body: string;
  commenter: AdminReportedAuthor;
  reportCount: number;
  reportReasons: string[];
}

/** Mục con "Bình luận đã ẩn" (AC-107). */
export interface AdminHiddenCommentItem {
  id: string;
  questionNumber: number | null;
  body: string;
  commenter: AdminReportedAuthor;
  hiddenReason: string;
  hiddenAt: string;
  reportCount: number;
}

/** Một hàng của hàng đợi R17. Hàng `hidden` có thể đến với 0 báo cáo — nó vẫn
 *  là một hàng (Reference Contract Value #26); mapper không lọc hàng nào. */
export interface AdminReportedSolution {
  id: string;
  examId: string;
  examTitle: string;
  author: AdminReportedAuthor;
  status: "published" | "hidden";
  reportCount: number;
  reportReasons: string[];
  reportedComments: AdminReportedCommentItem[];
  hiddenComments: AdminHiddenCommentItem[];
}

/** `body` là markdown THÔ — /admin in nó dạng văn bản thường (Reference
 *  Contract Value #16). */
export interface AdminSolutionNote {
  questionNumber: number;
  questionId: string;
  body: string;
}

export type AdminModerationAction = "hide" | "restore" | "delete";

/** Trạng thái `useActionState` của hai form action. Nhánh lỗi luôn mang một
 *  copy key CỐ ĐỊNH (task 38 dịch bằng t()), không bao giờ là thông điệp DB;
 *  bị rate-limit thì kèm số giây cho `profile.error.rateLimited`. */
export type AdminModerationState =
  | { ok: true; status: string }
  | { error: "admin.solutions.actionError" }
  | { error: "profile.error.rateLimited"; seconds: number }
  | null;

interface RpcErrorLike {
  code?: string;
}

interface AdminAuthorColumns {
  commenter_display_name: string;
  commenter_is_anonymous_to_readers: boolean;
}

interface ReportedCommentRow extends AdminAuthorColumns {
  id: string;
  question_number: number | null;
  body: string;
  report_count: number;
  report_reasons: string[];
}

interface HiddenCommentRow extends AdminAuthorColumns {
  id: string;
  question_number: number | null;
  body: string;
  hidden_reason: string;
  hidden_at: string;
  report_count: number;
}

interface QueueRow {
  id: string;
  exam_id: string;
  exam_title: string;
  author_display_name: string;
  author_is_anonymous_to_readers: boolean;
  status: "published" | "hidden";
  report_count: number;
  report_reasons: string[];
  reported_comments: ReportedCommentRow[];
  hidden_comments: HiddenCommentRow[];
}

interface NoteRow {
  question_number: number;
  question_id: string;
  body: string;
}

const ACTION_ERROR = { error: "admin.solutions.actionError" } as const;

const MODERATION_ACTIONS: ReadonlySet<string> = new Set<AdminModerationAction>(["hide", "restore", "delete"]);

/** Từ chối ĐÃ LƯỜNG TRƯỚC của hai RPC kiểm duyệt: `22023` (hành động/lý do/
 *  chuyển trạng thái không hợp lệ — thường là trang /admin đã cũ) và `P0002`
 *  (không còn đối tượng). `42501` KHÔNG nằm ở đây: tới được RPC nghĩa là
 *  isAdminUserId() đã cho qua, nên DB từ chối là dấu hiệu ADMIN_USER_IDS và
 *  admin_users lệch nhau (ADR-0021 "Known unknowns") — đáng một dòng log. */
const SILENT_MODERATION_ERROR_CODES = new Set(["22023", "P0002"]);

function logRpcError(rpcName: string, error: RpcErrorLike) {
  console.error(`[${rpcName}]`, error.code);
}

/** Session client + admin id khi người gọi là admin theo allowlist; `null`
 *  cho cả "chưa đăng nhập" lẫn "không phải admin" — không phân biệt hai
 *  trường hợp, cùng quy ước với moderateExamAction. */
async function requireAdmin() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user || !isAdminUserId(user.id)) return null;
  return { supabase, adminId: user.id };
}

function toAdminAuthor(displayName: string, isAnonymousToReaders: boolean): AdminReportedAuthor {
  return { displayName, isAnonymousToReaders };
}

function toReportedComment(row: ReportedCommentRow): AdminReportedCommentItem {
  return {
    id: row.id,
    questionNumber: row.question_number,
    body: row.body,
    commenter: toAdminAuthor(row.commenter_display_name, row.commenter_is_anonymous_to_readers),
    reportCount: row.report_count,
    reportReasons: row.report_reasons,
  };
}

function toHiddenComment(row: HiddenCommentRow): AdminHiddenCommentItem {
  return {
    id: row.id,
    questionNumber: row.question_number,
    body: row.body,
    commenter: toAdminAuthor(row.commenter_display_name, row.commenter_is_anonymous_to_readers),
    hiddenReason: row.hidden_reason,
    hiddenAt: row.hidden_at,
    reportCount: row.report_count,
  };
}

function toReportedSolution(row: QueueRow): AdminReportedSolution {
  return {
    id: row.id,
    examId: row.exam_id,
    examTitle: row.exam_title,
    author: toAdminAuthor(row.author_display_name, row.author_is_anonymous_to_readers),
    status: row.status,
    reportCount: row.report_count,
    reportReasons: row.report_reasons,
    reportedComments: row.reported_comments.map(toReportedComment),
    hiddenComments: row.hidden_comments.map(toHiddenComment),
  };
}

/**
 * Hàng đợi báo cáo bài giải/bình luận (AC-081, R17). Người không phải admin
 * → ném lỗi, KHÔNG gọi RPC nào (trang /admin vốn đã notFound() với họ; lỗi đi
 * tới error.tsx như mọi lỗi đọc khác của trang).
 */
export async function listCommunityReports(): Promise<AdminReportedSolution[]> {
  const admin = await requireAdmin();
  if (!admin) throw new Error("listCommunityReports: not allowed");

  const { data, error } = await admin.supabase.rpc("admin_list_community_reports");
  if (error) {
    logRpcError("admin_list_community_reports", error);
    throw new Error("listCommunityReports: read failed");
  }

  return ((data ?? []) as QueueRow[]).map(toReportedSolution);
}

/**
 * Toàn bộ ghi chú của một bài giải cho admin — không cần admin đã nộp đề đó
 * (AC-081). Giữ nguyên thứ tự mảng của RPC (đã tăng dần theo số câu); mảng
 * rỗng là trạng thái hợp lệ, không phải lỗi.
 */
export async function getSolutionNotesForAdmin(solutionId: string): Promise<AdminSolutionNote[]> {
  const admin = await requireAdmin();
  if (!admin) throw new Error("getSolutionNotesForAdmin: not allowed");

  const { data, error } = await admin.supabase.rpc("admin_get_community_solution_notes", {
    p_solution_id: solutionId,
  });
  if (error) {
    logRpcError("admin_get_community_solution_notes", error);
    throw new Error("getSolutionNotesForAdmin: read failed");
  }

  return ((data ?? []) as NoteRow[]).map((row) => ({
    questionNumber: row.question_number,
    questionId: row.question_id,
    body: row.body,
  }));
}

interface ModerationTarget {
  rpcName: "admin_moderate_community_solution" | "admin_moderate_community_comment";
  formIdField: "solutionId" | "commentId";
  rpcIdParam: "p_solution_id" | "p_comment_id";
  rateLimitKey: "communityAdminModerateSolution" | "communityAdminModerateComment";
}

type ModerationForm = { targetId: string; action: AdminModerationAction; reason: string };

/** Đọc và kiểm LẠI form ở server — không tin phần kiểm tra của client
 *  (Failure Mode #4): `action` phải thuộc {hide, restore, delete}; `hide`/
 *  `delete` bắt buộc lý do không rỗng sau trim (AC-082, AC-106), `restore`
 *  thì tuỳ chọn. */
function readModerationForm(formData: FormData, idField: ModerationTarget["formIdField"]): ModerationForm | null {
  const targetId = String(formData.get(idField) ?? "");
  const action = String(formData.get("action") ?? "");
  const reason = String(formData.get("reason") ?? "").trim();

  if (!targetId || !MODERATION_ACTIONS.has(action)) return null;
  if ((action === "hide" || action === "delete") && reason.length === 0) return null;
  return { targetId, action: action as AdminModerationAction, reason };
}

/** Thân chung của hai form action (Refactor: một pre-check admin, một luật
 *  lý do, một bảng mã lỗi). Thứ tự: admin → form → rate-limit → RPC. */
async function moderate(target: ModerationTarget, formData: FormData): Promise<AdminModerationState> {
  const admin = await requireAdmin();
  if (!admin) return ACTION_ERROR;

  const form = readModerationForm(formData, target.formIdField);
  if (!form) return ACTION_ERROR;

  const rl = await guard(target.rateLimitKey, admin.adminId);
  if (!rl.ok) return { error: "profile.error.rateLimited", seconds: rl.retryAfterSeconds };

  const { data, error } = await admin.supabase.rpc(target.rpcName, {
    [target.rpcIdParam]: form.targetId,
    p_action: form.action,
    p_reason: form.reason,
  });
  if (error) {
    if (!SILENT_MODERATION_ERROR_CODES.has(error.code ?? "")) logRpcError(target.rpcName, error);
    return ACTION_ERROR;
  }

  revalidatePath("/admin");
  revalidatePath("/exams/[id]/solutions", "page");
  revalidatePath("/exams/[id]/solutions/[solutionId]", "page");

  const [row] = (data ?? []) as Array<{ status: string }>;
  return { ok: true, status: row?.status ?? "" };
}

/** Ẩn / khôi phục / xoá hẳn một bài giải (AC-082, AC-106). Form gửi
 *  `solutionId`, `action`, `reason`. */
export async function moderateSolutionAction(
  _prevState: AdminModerationState,
  formData: FormData
): Promise<AdminModerationState> {
  return moderate(
    {
      rpcName: "admin_moderate_community_solution",
      formIdField: "solutionId",
      rpcIdParam: "p_solution_id",
      rateLimitKey: "communityAdminModerateSolution",
    },
    formData
  );
}

/** Ẩn / khôi phục / xoá hẳn một bình luận (AC-107, AC-108). Form gửi
 *  `commentId`, `action`, `reason`. */
export async function moderateCommentAction(
  _prevState: AdminModerationState,
  formData: FormData
): Promise<AdminModerationState> {
  return moderate(
    {
      rpcName: "admin_moderate_community_comment",
      formIdField: "commentId",
      rpcIdParam: "p_comment_id",
      rateLimitKey: "communityAdminModerateComment",
    },
    formData
  );
}
