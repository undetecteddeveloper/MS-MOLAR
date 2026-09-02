// renderReviewNodes — render nội dung câu hỏi (markdown + LaTeX) của màn SỬA
// ĐỀ ở SERVER, rồi truyền xuống cây client dưới dạng phần tử React
// (TD-027, 2026-08-27).
//
// ⚠ KHÔNG BAO GIỜ import file này từ một component có `"use client"` ⚠
// Cần kiểu / className / khoá tra thì import từ `reviewNodes.types.ts`.
//
// ---------------------------------------------------------------------------
// VÌ SAO MÀN NÀY KHÓ HƠN MÀN LÀM BÀI, VÀ VÌ SAO CÁCH NÀY MỚI ĂN
// ---------------------------------------------------------------------------
// Ở màn LÀM BÀI (TD-023) chuỗi đề là BẤT BIẾN, nên "render sẵn ở server" là
// chuyện hiển nhiên đúng. Ở đây thì KHÔNG: tác giả sửa được chính chuỗi nguồn
// đó, nên một node render sẵn ôi ngay lần sửa đầu tiên. Đó là lý do TD-023
// chỉ trả được một nửa, và nửa này bị tách ra thành TD-027.
//
// Trước bản này đã thử `next/dynamic` (giữ `ssr` mặc định) và ĐÃ ĐO trên
// production: KHÔNG được gì — 354.3 → 356.2 KB br, TBT 404 → 460ms. Lý do:
// `ssr` mặc định vẫn render ở server, nên trình duyệt VẪN phải nạp chunk để
// HYDRATE đúng cây đó. Đưa một chunk ra khỏi danh sách EAGER không phải là đưa
// nó ra khỏi lượt tải.
//
// Cách ở đây khác về BẢN CHẤT chứ không phải về liều lượng: node đi xuống
// client dưới dạng PROP trong RSC payload — đã dẹt thành phần tử host, nên
// client không cần một dòng mã nào của react-markdown/KaTeX để hydrate chúng.
// Đúng cơ chế đã được chứng minh bằng số đo trên chính prod ở màn làm bài
// (351.8 → 225.7 KB br, TBT 512 → 256ms).
//
// Còn nhánh "chuỗi ĐÃ bị sửa" mới cần RichText ở client — và CHỈ nhánh đó. Nó
// nạp động với `ssr: false` trong QuestionEditor; `ssr: false` ở đây KHÔNG
// phải cái bẫy "trang trống rồi mới có chữ" mà TD-023 cảnh báo, vì lượt tải
// đầu tiên không bao giờ đi vào nhánh đó — lúc đó mọi chuỗi còn nguyên si nên
// mọi chỗ đều dùng node của server. Xem ghi chú bất biến ở QuestionEditor.

import { RichText } from "@/components/shared/RichText";
import type {
  AssembledQuestion,
  ChoiceId,
  ExtractedPassage,
  SubItemId,
} from "@/lib/ugc/types";
import {
  answerPresentation,
  CHOICE_CLASS,
  PASSAGE_CLASS,
  reviewNodeKey,
  STEM_CLASS,
  SUB_ITEM_CLASS,
  type RenderedText,
  type ReviewNodes,
  type ReviewQuestionNodes,
} from "./reviewNodes.types";

function rendered(source: string, className: string, inline: boolean): RenderedText {
  return { source, node: <RichText text={source} inline={inline} className={className} /> };
}

/**
 * Render sẵn nội dung của TẤT CẢ câu trong đề, tra được theo `reviewNodeKey`.
 *
 * Render CẢ đề chứ không chỉ câu đang xem, cùng lý do như màn làm bài: server
 * không biết — và không được biết — tác giả sẽ cuộn tới câu nào, vì đó là
 * tương tác client chứ không phải điều hướng.
 *
 * Câu KHÔNG có `essayAnswer` thì `answer` vắng mặt, không phải một node rỗng:
 * "chưa có đáp án" là trạng thái QuestionEditor hiển thị bằng placeholder
 * riêng, khác hẳn "đáp án là chuỗi rỗng".
 */
export function renderReviewNodes(
  questions: AssembledQuestion[],
  passages: ExtractedPassage[] = [],
): ReviewNodes {
  const table: ReviewNodes = {};

  // Một lần cho mỗi ngữ liệu, dùng lại cho mọi câu trỏ vào nó — cùng khoản
  // tiết kiệm như ở màn làm bài.
  const passageById = new Map<string, { rendered: RenderedText; title?: string }>();
  for (const p of passages) {
    passageById.set(p.id, { rendered: rendered(p.text, PASSAGE_CLASS, false), title: p.title });
  }

  for (const q of questions) {
    const choices: Partial<Record<ChoiceId, RenderedText>> = {};
    for (const choice of q.choices ?? []) {
      choices[choice.id] = rendered(choice.text, CHOICE_CLASS, true);
    }

    const subItems: Partial<Record<SubItemId, RenderedText>> = {};
    for (const item of q.subItems ?? []) {
      subItems[item.id] = rendered(item.text, SUB_ITEM_CLASS, true);
    }

    const entry: ReviewQuestionNodes = {
      stem: rendered(q.stem, STEM_CLASS, false),
      choices,
      subItems,
    };

    if (q.essayAnswer) {
      const { className, inline } = answerPresentation(q.type);
      entry.answer = rendered(q.essayAnswer, className, inline);
    }

    const passage = q.passageId ? passageById.get(q.passageId) : undefined;
    if (passage) {
      entry.passage = passage.rendered;
      entry.passageTitle = passage.title;
    }

    table[reviewNodeKey(q.part, q.number)] = entry;
  }

  return table;
}
