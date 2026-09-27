// @vitest-environment jsdom

// app/(exams)/exams/page.tsx — showShelves branch predicate wiring (P5-T1,
// the plan's own highest-blast-radius integration point).
//
// MOCK BOUNDARY (mirrors frontend DD § Test Plan's declaration, the same one
// `exam-shelves.fixture.e2e.test.ts` states): data layer only — `listExamShelves`,
// `listExamsRanked`, `listExamFacets`, `getCurrentUser` are mocked; every rendered
// component (`ExamShelf`, `ExamBrowser`, `ExamCard`, `ExamFilters`) is real.
// `hasBrowseParam`/`BROWSE_PARAM_KEYS` are imported for real too — the branch
// predicate under test is the SAME code the page calls, not a hand-copied
// re-implementation of the ten-key list.
//
// SCOPE — what this file does NOT try to prove. The exhaustive, table-driven
// fixture-e2e proof of every AC-008 param plus the cold-start (AC-051) journey
// belongs to P5-T2 (`tests/e2e/fixture/exam-shelves.fixture.e2e.test.ts`,
// pre-committed skeleton — ribbon count, chip count, tile placement, card-count
// parity are its job). This file's own job (task file Boundary Context / Proof
// Obligations): prove `showShelves` is wired from the RAW `sp` for bare /exams
// and for each of the 10 `BROWSE_PARAM_KEYS` individually, prove
// `listExamFacets()`/`getCurrentUser()` run on BOTH branches, and prove
// `SHELF_ORDER`'s DOM order incl. the AC-051 null-shelf omission.
//
// `renderServerTree`, not `render(await ExamsPage(...))`: `ExamsPage` is async and
// renders `ExamShelf`/`ExamBrowser`/`ExamCard` (all async; `ExamCard`'s own child
// `AuthorByline` is async too) — same empty-tree hazard documented in
// `ExamShelf.test.tsx` and the fixture skeleton's own header comment.

import { beforeEach, describe, expect, it, vi } from "vitest";
import { renderServerTree } from "@/tests/helpers/renderServerTree";
import { BROWSE_PARAM_KEYS } from "@/lib/exams/browseParams";
import type { Exam } from "@/types/exam";

vi.mock("server-only", () => ({}));

// `ExamFilters` (client component, renders on BOTH branches) reads these three
// hooks at mount — same boundary `ExamFilters.test.tsx`/`layout.test.tsx` mock.
vi.mock("next/navigation", () => ({
  usePathname: () => "/exams",
  useSearchParams: () => new URLSearchParams(),
  useRouter: () => ({ push: vi.fn(), replace: vi.fn(), refresh: vi.fn(), back: vi.fn() }),
}));

const { listExamShelvesMock, listExamsRankedMock, listExamFacetsMock, getCurrentUserMock } =
  vi.hoisted(() => ({
    listExamShelvesMock: vi.fn(),
    listExamsRankedMock: vi.fn(),
    listExamFacetsMock: vi.fn(),
    getCurrentUserMock: vi.fn(),
  }));

vi.mock("@/features/exams/queries/shelves", () => ({
  listExamShelves: listExamShelvesMock,
}));
vi.mock("@/features/exams/queries", () => ({
  listExamsRanked: listExamsRankedMock,
  listExamFacets: listExamFacetsMock,
}));
vi.mock("@/lib/auth/getCurrentUser", () => ({
  getCurrentUser: getCurrentUserMock,
}));

import ExamsPage from "@/app/(exams)/exams/page";

type BrowseParamsObject = Partial<Record<(typeof BROWSE_PARAM_KEYS)[number], string>>;

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

const FACETS = { subjects: [], grades: [], schools: [], years: [], semesters: [] };

const SHELVES_FIXTURE = {
  practice: { subject: "Chemistry", exams: [makeExam({ id: "p1" })] },
  hot: { rung: "grade-recent" as const, grade: 10, exams: [makeExam({ id: "h1" })] },
  explore: { exams: [makeExam({ id: "e1" })] },
  submittedExamIds: new Set<string>(),
};

const RANKED_FIXTURE = {
  exams: [makeExam({ id: "r1" }), makeExam({ id: "r2" })],
  page: 1,
  pageCount: 1,
  total: 2,
  submittedExamIds: new Set<string>(),
};

function shelfSections(container: HTMLElement): string[] {
  return Array.from(container.querySelectorAll("section[aria-labelledby^='shelf-']")).map(
    (s) => s.getAttribute("aria-labelledby") ?? ""
  );
}

beforeEach(() => {
  vi.clearAllMocks();
  listExamShelvesMock.mockResolvedValue(SHELVES_FIXTURE);
  listExamsRankedMock.mockResolvedValue(RANKED_FIXTURE);
  listExamFacetsMock.mockResolvedValue(FACETS);
  getCurrentUserMock.mockResolvedValue(null);
});

describe("ExamsPage — showShelves = !hasBrowseParam(sp), read from the RAW searchParams (AC-001, AC-008)", () => {
  it("bare /exams (0 searchParams): calls listExamShelves only, renders 3 shelf sections in DOM order practice→hot→explore, 0 grid/pagination markers", async () => {
    const { container } = await renderServerTree(<ExamsPage searchParams={Promise.resolve({})} />);

    expect(listExamShelvesMock).toHaveBeenCalledTimes(1);
    expect(listExamsRankedMock).not.toHaveBeenCalled();

    expect(shelfSections(container)).toEqual(["shelf-practice", "shelf-hot", "shelf-explore"]);
    expect(container.querySelector("ul.grid")).toBeNull();
    expect(container.querySelector("nav")).toBeNull();
  });

  it.each(BROWSE_PARAM_KEYS)(
    "browse param '%s' present: calls listExamsRanked only, renders 0 shelf sections, the flat grid instead",
    async (key) => {
      const searchParams: BrowseParamsObject = { [key]: "x" };
      const { container } = await renderServerTree(
        <ExamsPage searchParams={Promise.resolve(searchParams)} />
      );

      expect(listExamsRankedMock).toHaveBeenCalledTimes(1);
      expect(listExamShelvesMock).not.toHaveBeenCalled();

      expect(shelfSections(container)).toEqual([]);
      expect(container.querySelector("ul.grid")).not.toBeNull();
    }
  );

  it("a garbage value that normalises to undefined (?sort=garbage) still renders the flat grid — the raw-key-presence regression guard (R-3)", async () => {
    const { container } = await renderServerTree(
      <ExamsPage searchParams={Promise.resolve({ sort: "garbage" })} />
    );

    expect(listExamsRankedMock).toHaveBeenCalledTimes(1);
    expect(listExamShelvesMock).not.toHaveBeenCalled();
    expect(shelfSections(container)).toEqual([]);
  });
});

describe("ExamsPage — listExamFacets()/getCurrentUser() run on BOTH branches (AC-033, AC-051 proof obligation)", () => {
  it("cumulative call count increments by 1 per render on the shelves branch, then again on the grid branch", async () => {
    await renderServerTree(<ExamsPage searchParams={Promise.resolve({})} />);
    expect(listExamFacetsMock).toHaveBeenCalledTimes(1);
    expect(getCurrentUserMock).toHaveBeenCalledTimes(1);

    await renderServerTree(<ExamsPage searchParams={Promise.resolve({ sort: "newest" })} />);
    expect(listExamFacetsMock).toHaveBeenCalledTimes(2);
    expect(getCurrentUserMock).toHaveBeenCalledTimes(2);
  });
});

describe("ExamsPage — SHELF_ORDER DOM order and the AC-051 null-shelf omission (Reference Contracts AC-003, AC-051)", () => {
  it("practice shelf null: DOM order is hot→explore only, 0 trace of shelf-practice anywhere", async () => {
    listExamShelvesMock.mockResolvedValue({ ...SHELVES_FIXTURE, practice: null });

    const { container } = await renderServerTree(<ExamsPage searchParams={Promise.resolve({})} />);

    expect(shelfSections(container)).toEqual(["shelf-hot", "shelf-explore"]);
    expect(container.innerHTML).not.toContain("shelf-practice");
  });
});
