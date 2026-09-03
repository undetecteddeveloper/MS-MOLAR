// ExtractionErrorPanel — liệt kê lỗi assembly (UI Spec §ExtractionErrorPanel /
// Task 6.4 + D1). Lỗi cấp toàn file (questionNumber null) + lỗi từng câu, mỗi
// mục link tới card câu tương ứng (#p{part}q{n} — v2.1 composite; partNumber
// null = đề 1 phần → part 1). role="alert". Client-safe.

"use client";

import { useT } from "@/lib/i18n/client";
import { formatUgcError } from "@/lib/ugc/errorCopy";
import type { UgcError } from "@/lib/ugc/types";

export function ExtractionErrorPanel({ errors }: { errors: UgcError[] }) {
  const t = useT();
  if (errors.length === 0) return null;
  return (
    <div
      role="alert"
      className="rounded-lg border border-brand bg-brand/8 px-4 py-3 text-sm text-brand"
    >
      <p className="font-medium">
        {errors.length === 1
          ? t("ugcError.oneIssueToFix")
          : t("ugcError.issuesToFix", { count: errors.length })}
      </p>
      <ul className="mt-2 flex flex-col gap-1">
        {errors.map((e, i) => {
          const text = formatUgcError(t, e);
          return (
            <li key={i}>
              {e.field !== undefined ? (
                // v2.2: lỗi META_* link tới khối metadata (không tới card câu).
                <a href="#exam-details" className="underline underline-offset-2 hover:opacity-80">
                  {text}
                </a>
              ) : e.questionNumber != null ? (
                <a
                  href={`#p${e.partNumber ?? 1}q${e.questionNumber}`}
                  className="underline underline-offset-2 hover:opacity-80"
                >
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
