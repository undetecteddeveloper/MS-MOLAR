// @vitest-environment jsdom

// `ExamCard` — containment proof (AC-043, UI Spec § Component: ExamCard
// (shelf-aware props); Design Doc § ExamCard extension and the containment
// proof (AC-043)).
//
// Snapshot được COMMIT TRƯỚC KHI `ExamCard` có bất kỳ prop nào trong 3 prop
// mới (`ribbon`/`from`/`className`, P2-T2). Đây là baseline "0 prop mới" mà
// P2-T2 phải chứng minh giữ nguyên byte-for-byte. Khẳng định dương (`h3`)
// đứng TRƯỚC khẳng định snapshot — một cây rỗng/vỡ (renderServerTree hazard)
// phải đỏ ở khẳng định dương trước, không được lặng lẽ đóng băng thành
// snapshot "đúng".
//
// `renderServerTree` (không phải `render(await ExamCard(props))`) vì
// `ExamCard` là async và render con async `AuthorByline` — dạng gọi trực
// tiếp cho cây rỗng và pass giả (xem renderServerTree.tsx).

import { describe, expect, it } from "vitest";
import { renderServerTree } from "@/tests/helpers/renderServerTree";
import { ExamCard } from "@/features/exams/components/ExamCard";
import type { Exam } from "@/types/exam";

const EXAM: Exam = {
  id: "exam-1",
  title: "Đề kiểm tra chương 1",
  questionIds: ["q1", "q2", "q3"],
  durationMinutes: 45,
  subject: "Math",
  grade: 10,
  school: "THPT Chu Văn An",
};

describe("ExamCard — containment baseline (AC-043)", () => {
  it("thẻ trần (0 prop mới) render giữ nguyên", async () => {
    const { container } = await renderServerTree(
      <ExamCard exam={EXAM} eligibility="eligible" />
    );

    // Khẳng định dương trước: bắt cây rỗng/vỡ trước khi nó lọt tới snapshot.
    expect(container.querySelector("h3")?.textContent).toBe(EXAM.title);

    expect(container.innerHTML).toMatchSnapshot();
  });
});
