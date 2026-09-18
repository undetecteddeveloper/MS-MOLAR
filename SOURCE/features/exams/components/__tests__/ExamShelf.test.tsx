// @vitest-environment jsdom

// ExamShelf — kệ đề cuộn ngang (UI Spec § Component: ExamShelf / ExamShelfTile;
// Design Doc § Data contracts — `ExamShelf` 5-prop contract).
//
// `renderServerTree` (không phải `render(await ExamShelf(props))`): `ExamShelf`
// là async và render `ExamCard` (async, tự render `AuthorByline` async) — gọi
// trực tiếp cho cây rỗng và pass giả, cùng lý do `ExamCard.snapshot.test.tsx`
// đã ghi. Test ĐẦU TIÊN dưới đây là khẳng định DƯƠNG (hình dạng mặc định) để
// một cây rỗng/vỡ của `renderServerTree` bị bắt ngay ở đó, trước khi case
// AC-051 (kệ vắng mặt) chạy ở cuối file.

import { describe, expect, it } from "vitest";
import { renderServerTree } from "@/tests/helpers/renderServerTree";
import { ExamShelf, shelfSubtitle, type ShelfKind } from "@/features/exams/components/ExamShelf";
import type { Exam } from "@/types/exam";
import type { HotRung } from "@/lib/adaptive/examShelves";

function makeExam(overrides: Partial<Exam> & { id: string }): Exam {
  return {
    title: `Đề ${overrides.id}`,
    questionIds: ["q1"],
    durationMinutes: 45,
    subject: "Math",
    grade: 10,
    ...overrides,
  };
}

describe("ExamShelf — hình dạng mặc định theo SHELF map (AC-004)", () => {
  it("kệ Cần luyện: section/h2/icon/subtitle/link Xem tất cả, 1 thẻ trong ul", async () => {
    const exams = [makeExam({ id: "p1", subject: "Chemistry" })];
    const { container } = await renderServerTree(
      <ExamShelf
        shelf="practice"
        subtitle="Hóa học đang là môn điểm trung bình thấp nhất của bạn"
        exams={exams}
        submittedExamIds={new Set()}
        isLoggedIn
      />
    );

    // Khẳng định dương trước — cây rỗng/vỡ phải đỏ ở đây, không lọt xuống dưới.
    const h2 = container.querySelector("h2");
    expect(h2?.textContent).toBe("Các môn cần luyện");
    expect(h2?.id).toBe("shelf-practice");
    expect(container.querySelector("section")?.getAttribute("aria-labelledby")).toBe(
      "shelf-practice"
    );
    expect(container.querySelector("section svg")).not.toBeNull();
    expect(container.querySelector("p")?.textContent).toBe(
      "Hóa học đang là môn điểm trung bình thấp nhất của bạn"
    );

    const headerLink = container.querySelector("section > div > a");
    expect(headerLink?.getAttribute("href")).toBe("/exams?subject=Chemistry");
    expect(headerLink?.textContent).toBe("Xem tất cả");

    const cards = container.querySelectorAll("ul > li");
    expect(cards).toHaveLength(1);
    expect(container.querySelector("h3")?.textContent).toBe(exams[0].title);
  });
});

describe("ExamShelf — Shelf composition table (AC-050/AC-035/AC-004)", () => {
  it("AC-050: link Cần luyện dùng encodeURIComponent(exams[0].subject)", async () => {
    const exams = [makeExam({ id: "p1", subject: "Civic Education" })];
    const { container } = await renderServerTree(
      <ExamShelf
        shelf="practice"
        subtitle="—"
        exams={exams}
        submittedExamIds={new Set()}
        isLoggedIn
      />
    );

    const headerLink = container.querySelector("section > div > a");
    expect(headerLink?.getAttribute("href")).toBe("/exams?subject=Civic%20Education");
  });

  it("AC-035: link Nổi nhất là hằng số /exams?sort=hot, không phụ thuộc exams (như AC-050)", async () => {
    const exams = [makeExam({ id: "h1" })];
    const { container } = await renderServerTree(
      <ExamShelf shelf="hot" subtitle="—" exams={exams} submittedExamIds={new Set()} isLoggedIn />
    );

    const headerLink = container.querySelector("section > div > a");
    expect(headerLink?.getAttribute("href")).toBe("/exams?sort=hot");
  });

  it("AC-004: kệ Khám phá có icon/h2/subtitle nhưng 0 link header ở header row", async () => {
    const exams = [makeExam({ id: "e1" })];
    const { container } = await renderServerTree(
      <ExamShelf
        shelf="explore"
        subtitle="Đề mới đăng, môn và trường bạn chưa thử"
        exams={exams}
        submittedExamIds={new Set()}
        isLoggedIn
      />
    );

    const h2 = container.querySelector("h2");
    expect(h2?.textContent).toBe("Khám phá");
    expect(container.querySelector("p")?.textContent).toBe(
      "Đề mới đăng, môn và trường bạn chưa thử"
    );

    expect(container.querySelector("section > div > a")).toBeNull();
  });
});

describe("ExamShelf — đúng 1 ruy băng ở hạng 1 kệ Nổi nhất, 0 ở nơi khác (AC-026)", () => {
  it("kệ Nổi nhất 3 đề: ruy băng chỉ ở li đầu tiên", async () => {
    const exams = [makeExam({ id: "h1" }), makeExam({ id: "h2" }), makeExam({ id: "h3" })];
    const { container } = await renderServerTree(
      <ExamShelf shelf="hot" subtitle="—" exams={exams} submittedExamIds={new Set()} isLoggedIn />
    );

    const ribbons = container.querySelectorAll('[data-slot="ribbon"]');
    expect(ribbons).toHaveLength(1);

    const cards = container.querySelectorAll("ul > li");
    expect(cards).toHaveLength(3);
    expect(cards[0].querySelector('[data-slot="ribbon"]')).not.toBeNull();
    expect(cards[1].querySelector('[data-slot="ribbon"]')).toBeNull();
    expect(cards[2].querySelector('[data-slot="ribbon"]')).toBeNull();
  });

  it("kệ Cần luyện không bao giờ có ruy băng, kể cả ở hạng 1", async () => {
    const exams = [makeExam({ id: "p1" }), makeExam({ id: "p2" })];
    const { container } = await renderServerTree(
      <ExamShelf
        shelf="practice"
        subtitle="—"
        exams={exams}
        submittedExamIds={new Set()}
        isLoggedIn
      />
    );

    expect(container.querySelectorAll('[data-slot="ribbon"]')).toHaveLength(0);
  });
});

describe("ExamShelf — ExamShelfTile chỉ ở cuối hàng Khám phá (AC-032)", () => {
  it("kệ Khám phá: ô cuối cùng là ExamShelfTile, dẫn tới /exams?page=1", async () => {
    const exams = [makeExam({ id: "e1" }), makeExam({ id: "e2" })];
    const { container } = await renderServerTree(
      <ExamShelf
        shelf="explore"
        subtitle="—"
        exams={exams}
        submittedExamIds={new Set()}
        isLoggedIn
      />
    );

    const cards = container.querySelectorAll("ul > li");
    expect(cards).toHaveLength(3); // 2 thẻ đề + 1 tile

    const lastLi = cards[cards.length - 1];
    expect(lastLi.querySelector(".card-link")).toBeNull(); // không phải ExamCard
    const tileLink = lastLi.querySelector("a");
    expect(tileLink?.getAttribute("href")).toBe("/exams?page=1");
    expect(tileLink?.textContent).toContain("Xem toàn bộ kho đề");
    expect(lastLi.className).toContain("border-dashed");

    // 2 ô đầu vẫn là ExamCard thật.
    expect(cards[0].querySelector(".card-link")).not.toBeNull();
    expect(cards[1].querySelector(".card-link")).not.toBeNull();
  });

  it("kệ Cần luyện và Nổi nhất không có tile cuối hàng", async () => {
    const exams = [makeExam({ id: "x1" }), makeExam({ id: "x2" })];

    const { container: practiceContainer } = await renderServerTree(
      <ExamShelf
        shelf="practice"
        subtitle="—"
        exams={exams}
        submittedExamIds={new Set()}
        isLoggedIn
      />
    );
    expect(practiceContainer.querySelectorAll("ul > li")).toHaveLength(2);

    const { container: hotContainer } = await renderServerTree(
      <ExamShelf shelf="hot" subtitle="—" exams={exams} submittedExamIds={new Set()} isLoggedIn />
    );
    expect(hotContainer.querySelectorAll("ul > li")).toHaveLength(2);
  });
});

describe("ExamShelf — mọi href thẻ mang đúng ?from= của kệ (AC-039)", () => {
  const CASES: { shelf: ShelfKind; from: string }[] = [
    { shelf: "practice", from: "practice" },
    { shelf: "hot", from: "hot" },
    { shelf: "explore", from: "explore" },
  ];

  it.each(CASES)("kệ $shelf: mọi thẻ có href ?from=$from", async ({ shelf, from }) => {
    const exams = [makeExam({ id: `${shelf}-1` }), makeExam({ id: `${shelf}-2` })];
    const { container } = await renderServerTree(
      <ExamShelf shelf={shelf} subtitle="—" exams={exams} submittedExamIds={new Set()} isLoggedIn />
    );

    const cardLinks = container.querySelectorAll("ul > li .card-link");
    expect(cardLinks).toHaveLength(2);
    cardLinks.forEach((link, i) => {
      expect(link.getAttribute("href")).toBe(`/exams/${exams[i].id}?from=${from}`);
    });
  });
});

describe("ExamShelf — hàng không tabIndex/role, thẻ focusable đúng thứ tự DOM (AC-047)", () => {
  it("ul không có tabIndex/role; href các thẻ theo đúng thứ tự exams truyền vào", async () => {
    const exams = [makeExam({ id: "a1" }), makeExam({ id: "a2" }), makeExam({ id: "a3" })];
    const { container } = await renderServerTree(
      <ExamShelf
        shelf="explore"
        subtitle="—"
        exams={exams}
        submittedExamIds={new Set()}
        isLoggedIn
      />
    );

    const row = container.querySelector("ul");
    expect(row?.getAttribute("tabindex")).toBeNull();
    expect(row?.getAttribute("role")).toBeNull();

    const cardLinks = container.querySelectorAll("ul > li .card-link");
    expect(Array.from(cardLinks).map((l) => l.getAttribute("href"))).toEqual([
      `/exams/${exams[0].id}?from=explore`,
      `/exams/${exams[1].id}?from=explore`,
      `/exams/${exams[2].id}?from=explore`,
    ]);
  });
});

describe("ExamShelf — submittedExamIds là DỮ LIỆU nhận vào, không tự tính lại (shared-state)", () => {
  it("eligibility mỗi thẻ đọc đúng từ submittedExamIds truyền vào, không suy ra nguồn khác", async () => {
    const exams = [makeExam({ id: "s1" }), makeExam({ id: "s2" })];
    const { container } = await renderServerTree(
      <ExamShelf
        shelf="hot"
        subtitle="—"
        exams={exams}
        submittedExamIds={new Set(["s1"])}
        isLoggedIn
      />
    );

    const cards = container.querySelectorAll("ul > li");
    // s1 nằm trong submittedExamIds => "eligible" => link Chấm điểm.
    expect(cards[0].querySelector('a[href="/exams/s1/rate"]')).not.toBeNull();
    // s2 KHÔNG nằm trong submittedExamIds => "not-attempted" => không có link rate.
    expect(cards[1].querySelector('a[href="/exams/s2/rate"]')).toBeNull();
    expect(cards[1].querySelector('[aria-disabled="true"]')).not.toBeNull();
  });

  it("isLoggedIn=false => mọi thẻ logged-out bất kể submittedExamIds", async () => {
    const exams = [makeExam({ id: "s3" })];
    const { container } = await renderServerTree(
      <ExamShelf
        shelf="hot"
        subtitle="—"
        exams={exams}
        submittedExamIds={new Set(["s3"])}
        isLoggedIn={false}
      />
    );

    expect(container.querySelector('a[href="/exams/s3/rate"]')).toBeNull();
    expect(container.querySelector('[aria-disabled="true"]')).not.toBeNull();
  });
});

describe("ExamShelf — exams: [] trả về null (AC-051)", () => {
  it.each<ShelfKind>(["practice", "hot", "explore"])(
    "kệ %s rỗng: 0 header, 0 subtitle, 0 placeholder",
    async (shelf) => {
      const { container } = await renderServerTree(
        <ExamShelf shelf={shelf} subtitle="—" exams={[]} submittedExamIds={new Set()} isLoggedIn />
      );

      expect(container.innerHTML).toBe("");
    }
  );
});

describe("shelfSubtitle — Facts → strings (AC-012, AC-019–AC-023)", () => {
  it("practice: nội suy subjectLabel(subject), không phải mã thô hay dạng tắt", () => {
    expect(shelfSubtitle("practice", { subject: "Chemistry", exams: [] })).toBe(
      "Hóa học đang là môn điểm trung bình thấp nhất của bạn"
    );
  });

  it("explore: chuỗi cố định, không nội suy", () => {
    expect(shelfSubtitle("explore", { exams: [] })).toBe("Đề mới đăng, môn và trường bạn chưa thử");
  });

  const HOT_CASES: { rung: HotRung; grade: number | null; expected: string }[] = [
    { rung: "grade-recent", grade: 10, expected: "Khối 10, tuần này" },
    { rung: "grade-30d", grade: 10, expected: "Khối 10, 30 ngày qua" },
    { rung: "grade-all", grade: 10, expected: "Khối 10, từ trước tới nay" },
    { rung: "site-recent", grade: null, expected: "Toàn hệ thống, tuần này" },
    { rung: "site-30d", grade: null, expected: "Toàn hệ thống, 30 ngày qua" },
    { rung: "site-all", grade: null, expected: "Toàn hệ thống, từ trước tới nay" },
  ];

  it.each(HOT_CASES)(
    "hot rung $rung -> đúng $expected, 0 fallback chuỗi chung chung",
    ({ rung, grade, expected }) => {
      expect(shelfSubtitle("hot", { rung, grade, exams: [] })).toBe(expected);
    }
  );
});
