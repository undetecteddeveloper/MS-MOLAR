// Phần DÙNG CHUNG giữa server và client của nội dung câu hỏi đã render sẵn ở
// màn SỬA ĐỀ (TD-027, 2026-08-27): kiểu, khoá tra, và className.
//
// ⚠ FILE NÀY KHÔNG ĐƯỢC PHÉP IMPORT `RichText`, TRỰC TIẾP HAY GIÁN TIẾP ⚠
//
// Đó là TOÀN BỘ bất biến của file — không phải "chỉ được chứa kiểu". Nó tách
// khỏi `reviewNodes.tsx` vì các component CLIENT (ReviewScreen /
// AssembledQuestionList / QuestionEditor) cần những thứ ở đây, và nếu chúng
// import từ chính file có `RichText` thì 126 KB br quay lại bundle client —
// im lặng, không cổng nào bắt được. Đây đúng là cách TD-021 đã đo được một
// lần: route /result/detail đứng nguyên 181.8K khi còn MỘT import tĩnh sót
// lại. Với `import type` thì trình biên dịch xoá hẳn dòng import, nhưng
// className và `reviewNodeKey` là GIÁ TRỊ THẬT — chúng ở đây chứ không ở
// `reviewNodes.tsx` chính vì thế.

import type { ReactNode } from "react";
import type { AssembledQuestion, ChoiceId, SubItemId } from "@/lib/ugc/types";

// --- className: NGUỒN CHÂN LÝ DUY NHẤT --------------------------------------
//
// Chúng vốn nằm rải trong QuestionEditor cạnh chỗ dùng. Nay có tới HAI nơi
// dựng cùng một phần tử: server (`reviewNodes.tsx`, cho chuỗi chưa bị sửa) và
// client (`QuestionEditor`, cho chuỗi tác giả vừa sửa). Hai bản chép className
// là cách chắc chắn để chúng lệch — sửa một chỗ thì chữ ở chế độ "vừa sửa
// xong" khác chữ ở chế độ "chưa đụng tới", và không test nào bắt được vì cả
// hai đều render ra chữ đúng.

/** Thân câu. `mt-3` là khoảng cách với dòng tiêu đề câu — khớp textarea ở chế độ sửa. */
export const STEM_CLASS = "mt-3 text-foreground";

/** Nhãn lựa chọn A–D — `flex-1` vì nằm cạnh badge chữ cái A/B/C/D. */
export const CHOICE_CLASS = "flex-1 text-sm text-foreground";

/** Nội dung ý a–d của true_false — `flex-1` cạnh nhãn "a)". */
export const SUB_ITEM_CLASS = "flex-1 text-sm text-foreground";

/** short_answer: giá trị mong đợi — một dòng, nên `inline` + `block` để vẫn có khung. */
export const SHORT_ANSWER_CLASS =
  "mt-1 block rounded-[4px] border border-border bg-card px-3 py-1.5 text-sm text-foreground";

/** Ngữ liệu dùng chung (A1) ở màn review — chỉ ĐỌC, nên không cần khung input.
 *  Cao tối đa rồi cuộn, cùng lý do với màn làm bài: một bài đọc 400 từ để nở
 *  tự do sẽ đẩy chính câu hỏi mà tác giả đang soát ra khỏi màn hình. */
export const PASSAGE_CLASS = "text-foreground text-sm leading-relaxed";

/** essay: đáp án mẫu — nhiều dòng, khối thật. */
export const ESSAY_ANSWER_CLASS =
  "mt-1 rounded-[4px] border border-border bg-card p-3 text-sm text-foreground";

/** `essayAnswer` dùng chung MỘT cột DB nhưng hai kiểu trình bày. */
export function answerPresentation(type: AssembledQuestion["type"]): {
  className: string;
  inline: boolean;
} {
  return type === "short_answer"
    ? { className: SHORT_ANSWER_CLASS, inline: true }
    : { className: ESSAY_ANSWER_CLASS, inline: false };
}

// --- Kiểu -------------------------------------------------------------------

/**
 * Một chuỗi nguồn ĐÃ render kèm CHÍNH chuỗi đã dựng ra nó.
 *
 * `source` không phải dữ liệu thừa: ở màn sửa đề, chuỗi trong state có thể bị
 * tác giả đổi bất cứ lúc nào, nên node render sẵn CHỈ còn đúng chừng nào chuỗi
 * chưa đổi. Giữ `source` cạnh `node` biến phép kiểm "node này còn dùng được
 * không" thành một so sánh CỤC BỘ ngay tại chỗ hiển thị — không cần cờ dirty
 * nào phải xuyên qua ba tầng component, và không có trạng thái thứ hai để mà
 * lệch pha. Đây là khác biệt bản chất với màn LÀM BÀI
 * (`(layer2)/_components/questionNodes.types.ts`), nơi chuỗi bất biến nên node
 * không bao giờ ôi.
 */
export interface RenderedText {
  /** Chuỗi nguồn đã dùng để dựng `node`. So BẰNG với chuỗi hiện tại. */
  source: string;
  /** Phần tử React do server dựng — client không cần biết markdown là gì. */
  node: ReactNode;
}

/** Nội dung một câu hỏi ở màn sửa đề, đã render tại thời điểm tải trang. */
export interface ReviewQuestionNodes {
  /** Thân câu (`stem`) — luôn có. */
  stem: RenderedText;
  /** Nhãn lựa chọn A–D (mcq). Khoá vắng = câu không có lựa chọn đó. */
  choices: Partial<Record<ChoiceId, RenderedText>>;
  /** Nội dung ý a–d (true_false). Khoá vắng = câu không có ý đó. */
  subItems: Partial<Record<SubItemId, RenderedText>>;
  /** `essayAnswer` — đáp án mẫu (essay) hoặc giá trị mong đợi (short_answer). */
  answer?: RenderedText;
  /** NGỮ LIỆU DÙNG CHUNG (A1) đã render. Vắng = câu tự chứa. */
  passage?: RenderedText;
  /** Tiêu đề in trên đề của ngữ liệu. */
  passageTitle?: string;
}

/**
 * Bảng tra theo `reviewNodeKey(part, number)`.
 *
 * Tra theo (part, number) chứ không theo chỉ số mảng: danh tính một câu ở
 * layer 4 là cặp đó (v2.1/ADR-0005 — "Câu 1" của hai phần là hai câu khác
 * nhau), và `AssembledQuestionList` còn LỌC lại mảng theo part trước khi
 * render, nên chỉ số ở chỗ hiển thị không còn là chỉ số của mảng gốc.
 */
export type ReviewNodes = Record<string, ReviewQuestionNodes>;

/** Khoá composite của một câu — dùng CHUNG cho cả bên dựng lẫn bên tra. */
export function reviewNodeKey(part: number, number: number): string {
  return `${part}:${number}`;
}
