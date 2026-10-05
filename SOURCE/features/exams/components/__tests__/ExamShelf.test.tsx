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
  it("kệ Cần luyện: section/h2/icon, 0 phụ đề, 1 thẻ trong ul, 0 link Xem tất cả", async () => {
    const exams = [makeExam({ id: "p1", subject: "Chemistry" })];
    const { container } = await renderServerTree(
      <ExamShelf
        shelf="practice"
        subtitle={null}
        exams={exams}
        submittedExamIds={new Set()}
        isLoggedIn
      />
    );

    // Khẳng định dương trước — cây rỗng/vỡ phải đỏ ở đây, không lọt xuống dưới.
    const h2 = container.querySelector("h2");
    expect(h2?.textContent).toBe("Cần luyện");
    expect(h2?.id).toBe("shelf-practice");
    expect(container.querySelector("section")?.getAttribute("aria-labelledby")).toBe(
      "shelf-practice"
    );
    expect(container.querySelector("section svg")).not.toBeNull();
    expect(container.querySelector("section > div p")).toBeNull(); // header row: 0 phụ đề

    expect(container.querySelector("section > div > a")).toBeNull();

    const cards = container.querySelectorAll("ul > li");
    expect(cards).toHaveLength(1);
    expect(container.querySelector("h3")?.textContent).toBe(exams[0].title);
  });
});

// Engineer 2026-09-19 bỏ link "Xem tất cả" ở Cần luyện + Nổi nhất (thay AC-035/AC-050
// và vế "Xem tất cả" của AC-004). Lối vào lưới đầy đủ còn lại: ô cuối Khám phá và chip
// "Nổi nhất".
describe("ExamShelf — tiêu đề kệ không có link nào (thay AC-035/AC-050)", () => {
  it.each<ShelfKind>(["practice", "hot", "explore"])(
    "kệ %s: header row chỉ có icon + h2 + subtitle, 0 thẻ <a>",
    async (shelf) => {
      const exams = [makeExam({ id: `${shelf}-1` })];
      const { container } = await renderServerTree(
        <ExamShelf
          shelf={shelf}
          subtitle="—"
          exams={exams}
          submittedExamIds={new Set()}
          isLoggedIn
        />
      );

      expect(container.querySelector("h2")).not.toBeNull();
      expect(container.querySelector("section > div")?.querySelector("a")).toBeNull();
    }
  );

  it("phụ đề: có chuỗi thì vẽ một <p> ở header row, null thì header row không có <p> nào", async () => {
    const exams = [makeExam({ id: "e1" })];
    const withSubtitle = await renderServerTree(
      <ExamShelf
        shelf="hot"
        subtitle="Khối 10, tuần này"
        exams={exams}
        submittedExamIds={new Set()}
        isLoggedIn
      />
    );
    expect(withSubtitle.container.querySelector("section > div p")?.textContent).toBe(
      "Khối 10, tuần này"
    );

    const without = await renderServerTree(
      <ExamShelf
        shelf="explore"
        subtitle={null}
        exams={exams}
        submittedExamIds={new Set()}
        isLoggedIn
      />
    );
    expect(without.container.querySelector("h2")?.textContent).toBe("Khám phá");
    expect(without.container.querySelector("section > div p")).toBeNull();
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

// Engineer 2026-09-19: thẻ trên kệ gọn hơn và cao bằng nhau. Cao bằng nhau do hai
// thứ cùng nhau: tên đề luôn đúng một dòng, dòng tác giả·trường đặt trước chỗ (min 1
// dòng) và `h-auto` thay `h-full` — `h-full` (height:100%) chặn flexbox tự kéo giãn, từng làm
// thẻ 198px cạnh thẻ 229px trong cùng một hàng.
describe("ExamShelf — thẻ gọn: bỏ thời lượng + số câu, cắt dài bằng '…', cao bằng nhau", () => {
  const LONG = makeExam({
    id: "long",
    title: "Đề luyện Hóa Học 10 — Nguyên tử & Bảng tuần hoàn và rất nhiều chữ nữa cho dài",
    school: "TRƯỜNG THPT SỐ 1 NGÔ GIA TỰ KHU VỰC PHÍA NAM",
    authorDisplayName: "kháhay",
    durationMinutes: 90,
    questionIds: Array.from({ length: 22 }, (_, i) => `q${i}`),
  });
  const SHORT = makeExam({ id: "short", title: "Đề ngắn" });

  it("thẻ kệ không chứa thời lượng lẫn số câu, kể cả khi đề có 90 phút / 22 câu", async () => {
    const { container } = await renderServerTree(
      <ExamShelf
        shelf="hot"
        subtitle="—"
        exams={[LONG]}
        submittedExamIds={new Set()}
        isLoggedIn
      />
    );

    const text = container.querySelector("ul > li")?.textContent ?? "";
    expect(text).toContain(LONG.title);
    expect(text).not.toMatch(/90\s*phút/);
    expect(text).not.toMatch(/22\s*câu/);
  });

  it("tên đề MỘT dòng cắt '…'; tác giả · trường gộp MỘT dòng cắt '…' — cả hai giữ đủ chữ trong DOM", async () => {
    const { container } = await renderServerTree(
      <ExamShelf
        shelf="hot"
        subtitle="—"
        exams={[LONG]}
        submittedExamIds={new Set()}
        isLoggedIn
      />
    );

    const title = container.querySelector("ul > li h3");
    expect(title?.className).toContain("truncate");
    expect(title?.className).not.toContain("line-clamp");
    expect(title?.textContent).toBe(LONG.title);

    const meta = title?.nextElementSibling;
    expect(meta?.tagName).toBe("P");
    expect(meta?.className).toContain("truncate");
    expect(meta?.textContent).toBe(`bởi kháhay · ${LONG.school}`);
  });

  it("đề không tác giả, không trường: dòng meta VẪN có mặt (giữ chỗ) nên thẻ không thấp hơn thẻ khác", async () => {
    const { container } = await renderServerTree(
      <ExamShelf
        shelf="hot"
        subtitle="—"
        exams={[SHORT, LONG]}
        submittedExamIds={new Set()}
        isLoggedIn
      />
    );

    const cards = Array.from(container.querySelectorAll("ul > li"));
    const shape = (li: Element) =>
      Array.from(li.querySelectorAll("h3, h3 + p")).map((el) => el.tagName + "." + el.className);
    expect(shape(cards[0])).toHaveLength(2);
    expect(shape(cards[0])).toEqual(shape(cards[1]));
    expect(cards[0].querySelector("h3 + p")?.textContent).toBe("");
  });

  it("thẻ kệ dùng h-auto, không h-full — để flex kéo mọi thẻ trong hàng bằng chiều cao thẻ cao nhất", async () => {
    const { container } = await renderServerTree(
      <ExamShelf
        shelf="explore"
        subtitle="—"
        exams={[SHORT, LONG]}
        submittedExamIds={new Set()}
        isLoggedIn
      />
    );

    const cards = Array.from(container.querySelectorAll("ul > li .card-link")).map(
      (a) => a.parentElement as HTMLElement
    );
    expect(cards).toHaveLength(2);
    for (const li of cards) {
      expect(li.className).toContain("h-auto");
      expect(li.className).not.toContain("h-full");
    }
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

// Engineer 2026-09-19: Cần luyện và Khám phá không còn phụ đề; Nổi nhất chỉ mất phụ
// đề ở bậc "site-all" — năm bậc còn lại giữ nguyên chuỗi.
describe("shelfSubtitle — Facts → strings (AC-019–AC-022)", () => {
  it("practice: không có phụ đề (kể cả khi đã biết môn yếu nhất)", () => {
    expect(shelfSubtitle("practice", { subject: "Chemistry", exams: [] })).toBeNull();
  });

  it("explore: không có phụ đề", () => {
    expect(shelfSubtitle("explore", { exams: [] })).toBeNull();
  });

  const HOT_CASES: { rung: HotRung; grade: number | null; expected: string | null }[] = [
    { rung: "grade-recent", grade: 10, expected: "Khối 10, tuần này" },
    { rung: "grade-30d", grade: 10, expected: "Khối 10, 30 ngày qua" },
    { rung: "grade-all", grade: 10, expected: "Khối 10, từ trước tới nay" },
    { rung: "site-recent", grade: null, expected: "Toàn hệ thống, tuần này" },
    { rung: "site-30d", grade: null, expected: "Toàn hệ thống, 30 ngày qua" },
    { rung: "site-all", grade: null, expected: null },
  ];

  it.each(HOT_CASES)(
    "hot rung $rung -> $expected, 0 fallback chuỗi chung chung",
    ({ rung, grade, expected }) => {
      expect(shelfSubtitle("hot", { rung, grade, exams: [], attemptCounts: {} })).toBe(expected);
    }
  );
});

// Engineer 2026-09-19: số lượt ĐÃ NỘP ở góc trên phải thẻ kệ Nổi nhất, trừ thẻ hạng 1
// (góc đó là của ruy băng). Số do tầng query giao vào `attemptCounts`, component không
// tự tính.
describe("ExamShelf — số lượt làm ở góc trên phải thẻ Nổi nhất, trừ thẻ mang ruy băng", () => {
  const exams = [makeExam({ id: "h1" }), makeExam({ id: "h2" }), makeExam({ id: "h3" })];
  const attemptCounts = { h1: 40, h2: 12, h3: 1 };
  const countOf = (li: Element) => li.querySelector("span.ml-auto")?.textContent ?? null;

  it("thẻ hạng 1 (ruy băng) không có số; thẻ còn lại có '{n} lượt làm' đúng số của đề đó", async () => {
    const { container } = await renderServerTree(
      <ExamShelf
        shelf="hot"
        subtitle={null}
        exams={exams}
        attemptCounts={attemptCounts}
        submittedExamIds={new Set()}
        isLoggedIn
      />
    );

    const cards = Array.from(container.querySelectorAll("ul > li"));
    expect(cards[0].querySelector('[data-slot="ribbon"]')).not.toBeNull();
    expect(countOf(cards[0])).toBeNull();
    expect(countOf(cards[1])).toBe("12 lượt làm");
    expect(countOf(cards[2])).toBe("1 lượt làm");
  });

  it("số nằm ở hàng nhãn môn/lớp (đầu thẻ), không phải trong liên kết phủ thẻ", async () => {
    const { container } = await renderServerTree(
      <ExamShelf
        shelf="hot"
        subtitle={null}
        exams={exams}
        attemptCounts={attemptCounts}
        submittedExamIds={new Set()}
        isLoggedIn
      />
    );

    const count = container.querySelectorAll("ul > li")[1].querySelector("span.ml-auto");
    expect(count?.parentElement?.firstElementChild?.textContent).toBe("Toán");
    expect(count?.closest("a")).toBeNull();
  });

  it.each<ShelfKind>(["practice", "explore"])(
    "kệ %s không bao giờ hiện số, kể cả khi bị truyền attemptCounts",
    async (shelf) => {
      const { container } = await renderServerTree(
        <ExamShelf
          shelf={shelf}
          subtitle={null}
          exams={exams}
          attemptCounts={attemptCounts}
          submittedExamIds={new Set()}
          isLoggedIn
        />
      );

      expect(container.textContent).not.toContain("lượt làm");
    }
  );

  it("thiếu attemptCounts (hoặc thiếu id) thì không vẽ số — không vẽ '0 lượt làm' bịa", async () => {
    const { container } = await renderServerTree(
      <ExamShelf
        shelf="hot"
        subtitle={null}
        exams={exams}
        submittedExamIds={new Set()}
        isLoggedIn
      />
    );

    expect(container.textContent).not.toContain("lượt làm");
  });
});
