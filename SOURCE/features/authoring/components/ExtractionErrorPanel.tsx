// ExtractionErrorPanel — liệt kê lỗi assembly (UI Spec §ExtractionErrorPanel /
// Task 6.4 + D1). Lỗi cấp toàn file (questionNumber null) + lỗi từng câu, mỗi
// mục link tới card câu tương ứng (#p{part}q{n} — v2.1 composite; partNumber
// null = đề 1 phần → part 1). role="alert". Client-safe.
//
// Theme "Sân trường" (2026-09-09): khối đỏ nhạt chữ đỏ (`--destructive`,
// 5,1:1 trên trắng). Bản trước tô bằng màu brand — brand nay là XANH LÁ, nên
// bảng lỗi từng hiện màu "đúng" trước khi được sửa ở đây.

"use client";

import { t } from "@/lib/copy";
import { formatUgcError } from "@/lib/ugc/errorCopy";
import type { UgcError } from "@/lib/ugc/types";

const LINK_CLASS =
  "inline-block py-0.5 underline underline-offset-4 hover:no-underline focus-visible:ring-destructive/40 focus-visible:ring-3 focus-visible:outline-none rounded-sm";

export function ExtractionErrorPanel({ errors }: { errors: UgcError[] }) {
  if (errors.length === 0) return null;
  return (
    <div role="alert" className="bg-destructive/10 text-destructive rounded-card px-4 py-3 text-sm">
      <p className="font-semibold">
        {errors.length === 1
          ? t("ugcError.oneIssueToFix")
          : t("ugcError.issuesToFix", { count: errors.length })}
      </p>
      <ul className="mt-2 flex flex-col gap-1 leading-relaxed">
        {errors.map((e, i) => {
          const text = formatUgcError(t, e);
          return (
            <li key={i}>
              {e.field !== undefined ? (
                // v2.2: lỗi META_* link tới khối metadata (không tới card câu).
                <a href="#exam-details" className={LINK_CLASS}>
                  {text}
                </a>
              ) : e.questionNumber != null ? (
                <a href={`#p${e.partNumber ?? 1}q${e.questionNumber}`} className={LINK_CLASS}>
                  {text}
                </a>
              ) : (
                <span>{text}</span>
              )}
            </li>
          );
        })}
      </ul>
    </div>
  );
}
