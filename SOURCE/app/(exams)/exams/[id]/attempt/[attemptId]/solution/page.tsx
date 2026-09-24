// SolutionEditorPage — /exams/[id]/attempt/[attemptId]/solution (S-04, UI-D1).
// Server Component: đọc `getMySolutionForWriter(examId)`, tự re-xác thực
// `attemptId` của URL rồi giao xuống `SolutionEditorScreen` (client).
//
// Ba nhánh, KHÔNG có nhánh thứ tư (frontend DD § Data Contracts "Writer load
// contract", binding):
//   - `null` (0 dòng: chưa nộp bài / đề chưa published / tác giả đề bị ban) ⇒
//     redirect("/exams/[id]") TRƯỚC KHI bất kỳ nội dung màn viết nào render —
//     không thông điệp, không gợi ý lý do (AC-002 non-leak, S11). Lỗi truy vấn
//     THẬT (ném ngoại lệ) KHÔNG bị đổi thành redirect — nó rơi thẳng vào
//     error.tsx.
//   - `attemptId` của URL KHÁC `state.attemptId` (lượt làm mà bài giải NÀY
//     đang/sẽ gắn vào) ⇒ redirect — foreign/chưa nộp/sai dạng đều rơi vào
//     nhánh này vì chúng không thể trùng giá trị `state.attemptId` mà server
//     vừa tự suy ra (Boundary Context: server không bao giờ tin URL một mình).
//   - `solutionId === null` (chưa có bài) hay đã có bài — cả hai đều render
//     `SolutionEditorScreen`, phân biệt trong chính state (không phải ở đây).
import { redirect } from "next/navigation";
import { getMySolutionForWriter } from "@/features/solutions/queries";
import { SolutionEditorScreen } from "@/features/solutions/components/SolutionEditorScreen";
import { renderWriterQuestionNodes } from "@/features/solutions/components/writerQuestionNodes";

export default async function SolutionEditorPage({
  params,
}: {
  params: Promise<{ id: string; attemptId: string }>;
}) {
  const { id, attemptId } = await params;
  const state = await getMySolutionForWriter(id);

  if (state === null) {
    redirect(`/exams/${id}`);
  }

  if (state.attemptId !== attemptId) {
    redirect(`/exams/${id}`);
  }

  // UI-D22: đề câu/đáp án đúng/ghi chú-chỉ-đọc dựng ReactNode Ở ĐÂY (Server
  // Component) rồi mới đi xuống `SolutionEditorScreen` (client, task 11) —
  // giữ cây phụ thuộc RichText (122,5 KB gzip) ở lại phía server, đúng M12.
  const questionNodes = renderWriterQuestionNodes(state.questions);

  return <SolutionEditorScreen examId={id} initialState={state} questionNodes={questionNodes} />;
}
