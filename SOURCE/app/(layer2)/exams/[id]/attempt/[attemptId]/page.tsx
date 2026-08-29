// Exam Player — /exams/[id]/attempt/[attemptId] (Layer 2).
// Server Component (GĐ 2 M2.6): fetch đề + câu hỏi (KHÔNG kèm correctAnswer) từ DB,
// truyền xuống <ExamPlayer> (client) giữ state làm bài. Nộp bài qua submitExam().

import { notFound } from "next/navigation";
import { getExamForPlayer } from "@/app/(layer2)/queries";
import { ExamPlayer } from "@/app/(layer2)/_components/ExamPlayer";
import { renderQuestionNodes } from "@/app/(layer2)/_components/questionNodes";

// Route segment cua `submitExam()`. 300s la tran cung cua Vercel voi fluid
// compute — cung ly do va cung con so nhu `app/(layer4)/upload/page.tsx:18`.
//
// Vi sao khai o DAY chu khong trong actions.ts: `maxDuration` la route-segment
// config, va no KHONG khai duoc trong mot file `"use server"`. Pass cham tu
// luan chay trong `after()`, tuc van trong cung invocation cua request nop bai
// — nen tran nay la tran that cua ca pass. `ESSAY_PASS_BUDGET_MS` (4 phut) coi
// y nam DUOI no de orchestrator tu dung truoc khi nen tang cat.
export const maxDuration = 300;

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
