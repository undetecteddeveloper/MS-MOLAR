"use client";

// AnalyticsDashboard — đảo client của /me/dashboard: giữ khoảng thời gian
// (tuần / tháng / toàn thời gian). Dữ liệu của cả ba khoảng đã tính sẵn ở
// server (docs/design/analytics-layer3-data-logic-design.md § Client Rewire
// Detail), nên đổi chip là đổi tại chỗ, không gọi mạng.
//
// Theme "Sân trường" (2026-09-06):
//  - Khoảng thời gian là HÀNG CHIP (cùng primitive Chip với Kho đề) thay cho
//    <select> có ô giữ chỗ "Lọc". Bản trước hiện chữ "Lọc" trong khi dữ liệu
//    đã là của tuần ("hidden feature #1") — điều khiển nói khác với thứ đang
//    hiện. Chip "Tuần" tô đậm ngay từ đầu, nên trạng thái `filterTouched` không
//    còn lý do tồn tại.
//  - BA THẺ xếp dọc, cùng theo chip: "Đúng và sai theo môn" (thanh ngang) →
//    "Thời gian luyện theo môn" (vòng tròn) → "Cần sửa chỗ nào" (chủ đề). Bản
//    trước gom cột và tròn vào một thẻ có dải Cột/Tròn; engineer bỏ (2026-09-06):
//    một dải chuyển đổi chỉ hợp khi hai hình là hai cách trình bày CÙNG một
//    dữ liệu, còn ở đây cột nói đúng/sai, tròn nói thời gian — hai câu hỏi
//    khác nhau thì là hai thẻ, không giấu nhau sau một nút. Hai thẻ theo môn
//    đứng trước, thẻ theo chủ đề đi sau vì nó đi sâu thêm một mức.
//  - Khoảng không có dữ liệu (data-logic decision #5): MỘT thẻ viền nét đứt căn
//    giữa thay cho cả ba thẻ — không gọi biểu đồ với mảng rỗng (vòng tròn chia
//    cho tổng 0). Chip vẫn bấm được để đổi sang khoảng có dữ liệu mà không tải
//    lại trang.

import { useState } from "react";
import { Card } from "@/components/ui/card";
import { Chip } from "@/components/ui/chip";
import { t, type MessageKey } from "@/lib/copy";
import { SubjectBarChart } from "@/features/analytics/components/SubjectBarChart";
import { SubjectTimeDonut } from "@/features/analytics/components/SubjectTimeDonut";
import { WeakTopicsCard } from "@/features/analytics/components/WeakTopicsCard";
import type { TopicWeakness } from "@/lib/analytics/weakTopics";
import {
  DEFAULT_RANGE,
  RANGE_ORDER,
  type SubjectStats,
  type TimeRange,
} from "@/lib/analytics/constants";

const RANGE_LABEL_KEY: Record<TimeRange, MessageKey> = {
  week: "analytics.rangeWeek",
  month: "analytics.rangeMonth",
  all: "analytics.rangeAll",
};

export function AnalyticsDashboard({
  dataByRange,
  weakTopicsByRange,
}: {
  dataByRange: Record<TimeRange, SubjectStats[]>;
  weakTopicsByRange: Record<TimeRange, TopicWeakness[]>;
}) {
  const [range, setRange] = useState<TimeRange>(DEFAULT_RANGE);

  const data = dataByRange[range];
  const weakTopics = weakTopicsByRange[range];

  return (
    <div className="flex flex-col gap-4">
      {/* Chip khoảng thời gian — lọc CẢ BA thẻ bên dưới. */}
      <div role="group" aria-label={t("analytics.timeRangeFilter")} className="flex flex-wrap gap-2">
        {RANGE_ORDER.map((r) => (
          <Chip key={r} active={range === r} onClick={() => setRange(r)}>
            {t(RANGE_LABEL_KEY[r])}
          </Chip>
        ))}
      </div>

      {data.length === 0 ? (
        <Card variant="outline" className="items-center gap-1 border-dashed py-8 text-center">
          <h2 className="text-lg font-semibold">{t("analytics.noData")}</h2>
          <p className="text-muted-foreground max-w-prose text-sm leading-relaxed">
            {t("analytics.noDataHint")}
          </p>
        </Card>
      ) : (
        <>
          <Card as="section" aria-labelledby="stats-bar-title" className="gap-4">
            <h2 id="stats-bar-title" className="text-lg font-semibold">
              {t("analytics.barTitle")}
            </h2>
            <SubjectBarChart data={data} />
          </Card>

          <Card as="section" aria-labelledby="stats-time-title" className="gap-4">
            <div className="flex flex-col gap-1">
              <h2 id="stats-time-title" className="text-lg font-semibold">
                {t("analytics.donutTitle")}
              </h2>
              <p className="text-muted-foreground text-sm leading-relaxed">
                {t("analytics.donutSubtitle")}
              </p>
            </div>
            <SubjectTimeDonut data={data} />
          </Card>

          <WeakTopicsCard topics={weakTopics} />
        </>
      )}
    </div>
  );
}
