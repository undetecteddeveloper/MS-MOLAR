// rankWeakTopicsByRange [unit] — pure reducer, no I/O, no mocks needed.
// `now` is fixed and injected (never read from the system clock) so range
// boundaries are deterministic across runs — same convention as
// aggregateAttempts.test.ts.

import { describe, expect, it } from "vitest";
import {
  MAX_WEAK_TOPICS,
  MIN_TOPIC_QUESTIONS,
  rankWeakTopicsByRange,
  type TopicAttemptRow,
} from "../weakTopics";

const NOW = new Date("2026-07-31T00:00:00.000Z");
const THRESHOLD = 0.75;

function daysAgo(n: number): string {
  return new Date(NOW.getTime() - n * 24 * 60 * 60 * 1000).toISOString();
}

function row(overrides: Partial<TopicAttemptRow>): TopicAttemptRow {
  return {
    subject: "Math",
    submittedAt: daysAgo(1),
    topicBreakdown: [{ topic: "Quadratics", correct: 1, total: 10 }],
    ...overrides,
  };
}

describe("rankWeakTopicsByRange", () => {
  it("accumulates one (subject, topic) pair across multiple attempts", () => {
    const rows = [
      row({ topicBreakdown: [{ topic: "Quadratics", correct: 1, total: 5 }] }),
      row({ topicBreakdown: [{ topic: "Quadratics", correct: 2, total: 5 }] }),
    ];
    const result = rankWeakTopicsByRange(rows, NOW, THRESHOLD);
    expect(result.week).toEqual([
      { subject: "Math", topic: "Quadratics", correct: 3, total: 10, accuracy: 0.3 },
    ]);
  });

  it("keeps the same topic name separate per subject — they are different weaknesses", () => {
    const rows = [
      row({ subject: "Math", topicBreakdown: [{ topic: "Graphs", correct: 1, total: 8 }] }),
      row({ subject: "Physics", topicBreakdown: [{ topic: "Graphs", correct: 2, total: 8 }] }),
    ];
    const result = rankWeakTopicsByRange(rows, NOW, THRESHOLD);
    expect(result.week.map((w) => `${w.subject}/${w.topic}`)).toEqual([
      "Math/Graphs",
      "Physics/Graphs",
    ]);
  });

  it(`drops a topic with fewer than MIN_TOPIC_QUESTIONS (${MIN_TOPIC_QUESTIONS}) answered — one wrong answer is not evidence`, () => {
    const rows = [
      row({ topicBreakdown: [{ topic: "Barely seen", correct: 0, total: MIN_TOPIC_QUESTIONS - 1 }] }),
    ];
    expect(rankWeakTopicsByRange(rows, NOW, THRESHOLD).week).toEqual([]);
  });

  it("includes a topic exactly at MIN_TOPIC_QUESTIONS (boundary is inclusive)", () => {
    const rows = [
      row({ topicBreakdown: [{ topic: "Just enough", correct: 0, total: MIN_TOPIC_QUESTIONS }] }),
    ];
    expect(rankWeakTopicsByRange(rows, NOW, THRESHOLD).week).toHaveLength(1);
  });

  it("excludes a topic at or above the threshold — only below-threshold is a weakness", () => {
    const rows = [
      row({ topicBreakdown: [{ topic: "At threshold", correct: 3, total: 4 }] }), // exactly 0.75
      row({ topicBreakdown: [{ topic: "Above", correct: 9, total: 10 }] }),
      row({ topicBreakdown: [{ topic: "Below", correct: 1, total: 4 }] }),
    ];
    const result = rankWeakTopicsByRange(rows, NOW, THRESHOLD);
    expect(result.week.map((w) => w.topic)).toEqual(["Below"]);
  });

  it("sorts by accuracy ascending, breaking ties by larger sample first", () => {
    const rows = [
      row({ topicBreakdown: [{ topic: "Half small", correct: 2, total: 4 }] }), // 0.5, n=4
      row({ topicBreakdown: [{ topic: "Half big", correct: 10, total: 20 }] }), // 0.5, n=20
      row({ topicBreakdown: [{ topic: "Worst", correct: 0, total: 8 }] }), // 0.0
    ];
    const result = rankWeakTopicsByRange(rows, NOW, THRESHOLD);
    expect(result.week.map((w) => w.topic)).toEqual(["Worst", "Half big", "Half small"]);
  });

  it(`returns at most MAX_WEAK_TOPICS (${MAX_WEAK_TOPICS}) — a long "fix this" list is not a priority`, () => {
    const rows = ["a", "b", "c", "d", "e"].map((topic) =>
      row({ topicBreakdown: [{ topic, correct: 0, total: 8 }] })
    );
    expect(rankWeakTopicsByRange(rows, NOW, THRESHOLD).week).toHaveLength(MAX_WEAK_TOPICS);
  });

  it("excludes a non-union subject (Geography) from every range, matching the chart's rule", () => {
    const rows = [row({ subject: "Geography" })];
    const result = rankWeakTopicsByRange(rows, NOW, THRESHOLD);
    expect([result.week, result.month, result.all]).toEqual([[], [], []]);
  });

  it("scopes by range: an old attempt lands in 'all' only, not in week/month", () => {
    const rows = [row({ submittedAt: daysAgo(60) })];
    const result = rankWeakTopicsByRange(rows, NOW, THRESHOLD);
    expect(result.week).toEqual([]);
    expect(result.month).toEqual([]);
    expect(result.all).toHaveLength(1);
  });

  it("counts a null/unparseable submittedAt in 'all' only, and never throws", () => {
    const rows = [row({ submittedAt: null }), row({ submittedAt: "not-a-date" })];
    const result = rankWeakTopicsByRange(rows, NOW, THRESHOLD);
    expect(result.week).toEqual([]);
    expect(result.all[0]).toMatchObject({ topic: "Quadratics", total: 20 });
  });

  it("survives a null/empty topic_breakdown and blank topic names without throwing", () => {
    const rows = [
      row({ topicBreakdown: [] }),
      // Dòng cũ trước khi cột jsonb có mặt đọc lên null — queries.ts đã ?? []
      // nhưng reducer vẫn phải tự đứng được.
      row({ topicBreakdown: undefined as unknown as TopicAttemptRow["topicBreakdown"] }),
      row({ topicBreakdown: [{ topic: "   ", correct: 0, total: 9 }] }),
      row({ topicBreakdown: [{ topic: "Real", correct: 0, total: 9 }] }),
    ];
    const result = rankWeakTopicsByRange(rows, NOW, THRESHOLD);
    expect(result.week.map((w) => w.topic)).toEqual(["Real"]);
  });

  it("ignores a zero-total bucket instead of producing a NaN accuracy", () => {
    const rows = [row({ topicBreakdown: [{ topic: "Ungraded", correct: 0, total: 0 }] })];
    expect(rankWeakTopicsByRange(rows, NOW, THRESHOLD).all).toEqual([]);
  });

  it("returns all three ranges even when there is no data at all", () => {
    expect(rankWeakTopicsByRange([], NOW, THRESHOLD)).toEqual({ week: [], month: [], all: [] });
  });
});
