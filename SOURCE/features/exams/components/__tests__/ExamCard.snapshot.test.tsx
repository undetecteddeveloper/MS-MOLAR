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
    const { container } = await renderServerTree(<ExamCard exam={EXAM} eligibility="eligible" />);

    // Khẳng định dương trước: bắt cây rỗng/vỡ trước khi nó lọt tới snapshot.
    expect(container.querySelector("h3")?.textContent).toBe(EXAM.title);

    expect(container.innerHTML).toMatchSnapshot();
  });
});

describe("ExamCard — from prop appends ?from= to the stretched-link href (AC-039)", () => {
  it('from="hot" renders the stretched link href as /exams/{id}?from=hot', async () => {
    const { container } = await renderServerTree(
      <ExamCard exam={EXAM} eligibility="eligible" from="hot" />
    );

    const stretchedLink = container.querySelector(".card-link");
    expect(stretchedLink?.getAttribute("href")).toBe(`/exams/${EXAM.id}?from=hot`);
  });
});

describe("ExamCard — ribbon prop renders ExamRibbon as the last child, never a stray falsy node (AC-026, AC-044)", () => {
  it('ribbon="Hot nhất" renders exactly 1 ribbon slot, aria-hidden count = bare + 1, stretched link untouched', async () => {
    const { container: bare } = await renderServerTree(
      <ExamCard exam={EXAM} eligibility="eligible" />
    );
    const { container: ribboned } = await renderServerTree(
      <ExamCard exam={EXAM} eligibility="eligible" ribbon="Hot nhất" />
    );

    const ribbonSlots = ribboned.querySelectorAll('[data-slot="ribbon"]');
    expect(ribbonSlots).toHaveLength(1);

    const bareAriaHiddenCount = bare.querySelectorAll("[aria-hidden]").length;
    const ribbonedAriaHiddenCount = ribboned.querySelectorAll("[aria-hidden]").length;
    expect(ribbonedAriaHiddenCount).toBe(bareAriaHiddenCount + 1);

    const card = ribboned.querySelector('[data-slot="card"]');
    expect(card?.firstElementChild?.classList.contains("card-link")).toBe(true);
  });
});
