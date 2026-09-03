// renderQuestionNodes — render nội dung câu hỏi (markdown + LaTeX) ở SERVER
// rồi truyền xuống cây client dưới dạng phần tử React (TD-023, 2026-08-27).
//
// ⚠ KHÔNG BAO GIỜ import file này từ một component có `"use client"` ⚠
//
// Toàn bộ mục đích của nó là giữ `RichText` — và cây phụ thuộc 126 KB br của
// nó (react-markdown + remark-gfm + remark-math + rehype-katex +
// rehype-sanitize + katex) — Ở LẠI PHÍA SERVER. Một import tĩnh từ component
// client kéo nguyên chunk đó về bundle và xoá sạch khoản tiết kiệm, đúng như
// TD-021 đã đo: route /result/detail đứng nguyên 181.8K khi còn MỘT import
// tĩnh sót lại. Cần KIỂU thì import từ `questionNodes.types.ts` (file đó
// không chứa giá trị nào để mà import nhầm).
//
// Vì sao render TRƯỚC toàn bộ N câu, chứ không render câu đang xem:
// `ExamPlayer` là component client giữ state làm bài — server không biết
// người dùng đang ở câu nào và không được biết (đổi câu là tương tác client,
// không phải điều hướng). Nên server phải giao đủ N câu một lần; client chỉ
// việc chọn phần tử thứ `current` ra hiển thị.
//
// Vì sao KHÔNG dùng nạp động (next/dynamic) thay cho cách này: nội dung câu
// hỏi là thứ phải có NGAY khi vào màn làm bài — nạp động chỉ đổi "tải chậm"
// thành "trang trống rồi mới có chữ". Nạp động đúng cho thứ chỉ hiện sau khi
// người dùng CHỦ ĐỘNG bấm (xem ExplainStepAffordance, TD-021).
//
// className ở đây là NGUỒN CHÂN LÝ DUY NHẤT cho kiểu chữ nội dung câu hỏi:
// trước TD-023 chúng nằm trong QuestionRenderer/AnswerChoice cạnh chỗ dùng.
// Gom về một chỗ vì server dựng phần tử còn client đặt nó vào khung — hai nơi
// giữ hai bản className là cách chắc chắn để chúng lệch nhau.

import type { Exam } from "@/types/exam";
import type { ChoiceId, PublicQuestion, SubItemId } from "@/types/question";
import { RichText } from "@/components/shared/RichText";
import {
  mapBlanksToQuestions,
  splitPassageBlanks,
  splitPassageParagraphs,
} from "@/lib/ugc/passageBlanks";
import type { PassageChunkNode, PassageNodes, QuestionNodes } from "@/features/exams/components/questionNodes.types";

/** Thân câu hỏi — font-serif, một nấc lớn hơn phần còn lại của màn hình.
 *  (Lý do chọn serif + cỡ chữ: xem ghi chú trong QuestionRenderer.) */
const CONTENT_CLASS = "text-foreground font-serif text-lg leading-[1.75] text-pretty sm:text-xl";

/** Nhãn lựa chọn A–D — sans 16px, `flex-1` vì nằm cạnh badge chữ cái. */
const CHOICE_CLASS = "flex-1 text-base leading-relaxed text-card-foreground";

/** Nội dung ý a–d của câu true_false — sans 14px, `flex-1` cạnh nhãn "a)". */
const SUB_ITEM_CLASS = "text-card-foreground flex-1 text-sm leading-relaxed";

/** Ngữ liệu dùng chung (A1) — serif như thân câu vì nó CŨNG là văn bản để đọc,
 *  nhưng nhỏ hơn một nấc: câu hỏi vẫn phải là thứ mắt bắt vào trước. */
const PASSAGE_CLASS = "text-foreground font-serif text-base leading-[1.75] text-pretty";

/**
 * Render sẵn nội dung của TẤT CẢ câu hỏi. Thứ tự phần tử trả về khớp 1-1 với
 * `questions` — `ExamPlayer` tra theo chỉ số câu hiện tại, không tra theo id.
 */
export function renderQuestionNodes(
  questions: PublicQuestion[],
  passages: Exam["passages"] = [],
): QuestionNodes[] {
  // A1: render MỘT LẦN cho mỗi ngữ liệu, rồi dùng lại phần tử cho mọi câu trỏ
  // vào nó. Đây chính là khoản tiết kiệm mà A1 tồn tại để lấy: một bài đọc của
  // 7 câu trước đây đi qua react-markdown + KaTeX 7 lượt trên MỖI lượt render
  // trang làm bài.
  //
  // Việc dùng lại ĐÚNG MỘT object cho cả nhóm cũng là thứ giữ chi phí truyền
  // tin ở mức một bản: Flight ghi object đã serialize vào một WeakMap và phát
  // con trỏ ngược cho những lần gặp sau, nên bài đọc qua dây một lần dù bảy câu
  // cùng trỏ vào nó. Sao chép object ra cho từng câu sẽ lặng lẽ xoá khoản đó.
  const passageById = new Map<string, { nodes: PassageNodes; title?: string }>();
  for (const p of passages ?? []) {
    passageById.set(p.id, {
      nodes: renderPassage(p.text, p.id, questions),
      title: p.title,
    });
  }

  return questions.map((question) => {
    const choices: Partial<Record<ChoiceId, React.ReactNode>> = {};
    for (const choice of question.choices) {
      choices[choice.id] = <RichText text={choice.text} inline className={CHOICE_CLASS} />;
    }

    const subItems: Partial<Record<SubItemId, React.ReactNode>> = {};
    for (const item of question.subItems ?? []) {
      subItems[item.id] = <RichText text={item.text} inline className={SUB_ITEM_CLASS} />;
    }

    const passage = question.passageId ? passageById.get(question.passageId) : undefined;

    return {
      content: <RichText text={question.content} className={CONTENT_CLASS} />,
      choices,
      subItems,
      passage: passage?.nodes,
      passageTitle: passage?.title,
    };
  });
}

/**
 * Render một bài đọc thành các đoạn văn có CHỖ TRỐNG tách riêng.
 *
 * Vì sao cắt theo ĐOẠN trước rồi mới theo chỗ trống: `RichText` ở chế độ block
 * bọc mỗi khối trong thẻ riêng, nên cắt thẳng cả bài theo chỗ trống rồi render
 * từng mẩu sẽ biến MỘT câu văn thành ba đoạn văn xếp chồng. Chế độ `inline`
 * không sinh thẻ khối, nhưng bù lại nó cũng không biết đâu là ranh giới đoạn —
 * nên ranh giới đoạn phải được cắt Ở ĐÂY, trước khi giao cho markdown, và mỗi
 * mẩu văn bản đi qua `inline` để chảy liền mạch quanh chỗ trống.
 *
 * `number` in trên đề chỉ dùng để ĐỐI CHIẾU và để hiển thị. Số câu mà học sinh
 * nhìn thấy là VỊ TRÍ trong đề (`index + 1`, đúng nhãn "Câu N" của player), nên
 * ánh xạ phải đi qua vị trí đó chứ không được coi số in là chỉ số.
 */
function renderPassage(
  text: string,
  passageId: string,
  questions: PublicQuestion[]
): PassageNodes {
  // Nhóm câu của bài đọc này, kèm số hiển thị — cùng thứ tự với `questions`.
  const group: { question: PublicQuestion; number: number }[] = [];
  questions.forEach((q, i) => {
    if (q.passageId === passageId) group.push({ question: q, number: i + 1 });
  });

  const paragraphChunks = splitPassageParagraphs(text).map(splitPassageBlanks);

  // Chỗ trống của CẢ bài, theo thứ tự đọc — ánh xạ phải nhìn toàn bài, không
  // nhìn từng đoạn: chỗ trống thứ 5 có thể nằm ở đoạn 2.
  const blankNumbers: (number | null)[] = [];
  for (const chunks of paragraphChunks) {
    for (const chunk of chunks) if (chunk.kind === "blank") blankNumbers.push(chunk.number);
  }
  const assignment = mapBlanksToQuestions(
    blankNumbers,
    group.map((g) => g.number)
  );

  let blankIndex = 0;
  const paragraphs: PassageChunkNode[][] = paragraphChunks.map((chunks) =>
    chunks.map((chunk): PassageChunkNode => {
      if (chunk.kind === "text") {
        return { kind: "text", node: <RichText text={chunk.text} inline /> };
      }
      const target = group[assignment[blankIndex] ?? -1];
      blankIndex += 1;

      // Chỉ câu TRẮC NGHIỆM mới điền được: chỗ trống hiện lên chữ của lựa chọn
      // đã chọn, mà chỉ mcq mới có sẵn bộ chữ ấy ở client. Câu dạng khác trỏ
      // vào bài đọc vẫn giữ nguyên dãy gạch — đúng như trước thay đổi này.
      const options: Partial<Record<ChoiceId, string>> = {};
      if (target && (target.question.questionType ?? "mcq") === "mcq") {
        for (const choice of target.question.choices) options[choice.id] = choice.text;
      }

      return {
        kind: "blank",
        label: chunk.number,
        questionId: Object.keys(options).length > 0 ? (target?.question.id ?? null) : null,
        options,
      };
    })
  );

  return { className: PASSAGE_CLASS, paragraphs };
}
