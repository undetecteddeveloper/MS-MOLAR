// Exam Player — /exams/[id]/attempt/[attemptId] (Layer 2).
// Server Component (GĐ 2 M2.6): fetch đề + câu hỏi (KHÔNG kèm correctAnswer) từ DB,
// truyền xuống <ExamPlayer> (client) giữ state làm bài. Nộp bài qua submitExam().

import { notFound } from "next/navigation";
import { getExamForPlayer } from "@/app/(layer2)/queries";
import { ExamPlayer } from "@/app/(layer2)/_components/ExamPlayer";
import { renderQuestionNodes } from "@/app/(layer2)/_components/questionNodes";

export default async function ExamPlayerPage({
  params,
}: {
  params: Promise<{ id: string; attemptId: string }>;
}) {
  const { id, attemptId } = await params;
  const data = await getExamForPlayer(id);

  if (!data || data.questions.length === 0) {
    notFound();
  }

  return (
    <ExamPlayer
      attemptId={attemptId}
      examTitle={data.exam.title}
      durationMinutes={data.exam.durationMinutes}
      questions={data.questions}
      // TD-023: markdown + LaTeX render Ở ĐÂY (server), không ở ExamPlayer —
      // giữ 126 KB br của RichText khỏi bundle màn làm bài.
      questionNodes={renderQuestionNodes(data.questions)}
      parts={data.exam.parts}
    />
  );
}
