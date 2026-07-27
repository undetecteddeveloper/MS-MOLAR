// lib/fake-data/analytics — hằng số/helper thuần cho Analytics (Layer 3),
// dùng bởi BarChartCard.tsx/DonutChartCard.tsx (docs/design/analytics-layer3-design.md
// component plan #6). Union 7 môn (khác SUBJECTS 10 môn của lib/ugc/subjects.ts —
// Geography/Informatics/Civic Education nằm ngoài phạm vi Analytics theo
// docs/design/analytics-layer3-data-logic-design.md).
//
// File này CHỈ chứa phần types/constants/helpers hai chart card cần để build —
// dữ liệu giả lập theo range (ANALYTICS_BY_RANGE/getSubjectStats) cùng
// AnalyticsDashboard/me/dashboard/page.tsx tiêu thụ chúng CHƯA được tạo trong
// cây source này (khác mô tả trong design doc) — không thêm ở đây để tránh
// export không ai gọi; xem docs/design/analytics-layer3-design.md nếu cần dựng
// tiếp trang dashboard.

export const SUBJECT_ORDER = [
  "Math",
  "Physics",
  "Chemistry",
  "Biology",
  "Literature",
  "English",
  "History",
] as const;

export type Subject = (typeof SUBJECT_ORDER)[number];

export interface SubjectStats {
  subject: Subject;
  correct: number;
  wrong: number;
  /** Số lượt làm bài (không phải số câu) — mẫu số của % share trong donut. */
  sessions: number;
}

/** Màu cố định theo môn — ổn định qua mọi tab/filter, không gán theo rank
 *  (hidden feature #5). Math tái dùng --chart-1 (đỏ son); Literature tái dùng
 *  --chart-2 (vàng đồng). */
export const SUBJECT_COLORS: Record<Subject, string> = {
  Math: "#A62C2B",
  Physics: "#4C6B8A",
  Chemistry: "#7A5C3A",
  Biology: "#6E3A52",
  Literature: "#B8863B",
  English: "#3E7A54",
  History: "#5E7A78",
};

/** Ngưỡng "NEEDS REVIEW" — accuracy = correct/(correct+wrong) dưới mốc này
 *  (hidden feature #3). */
export const NEEDS_REVIEW_THRESHOLD = 0.75;

/** Làm tròn lên bội số của 5 cho trục Y (hidden feature #4) — khớp ví dụ
 *  BarChartCard.tsx: niceMax 90 → gridline 0/23/45/68/90; 25 → 0/6/13/19/25. */
export function niceCeil(rawMax: number): number {
  return Math.max(5, Math.ceil(rawMax / 5) * 5);
}

/** SubjectStats[] → % share theo sessions, sort do caller tự làm (DonutChartCard
 *  tự sort giảm dần). Tổng sessions=0 (mảng rỗng/toàn 0) → mọi share 0%, tránh
 *  chia cho 0. */
export function computeShares(
  data: SubjectStats[],
): Array<{ subject: Subject; pct: number }> {
  const totalSessions = data.reduce((sum, d) => sum + d.sessions, 0);
  if (totalSessions === 0) {
    return data.map((d) => ({ subject: d.subject, pct: 0 }));
  }
  return data.map((d) => ({
    subject: d.subject,
    pct: Math.round((d.sessions / totalSessions) * 100),
  }));
}
