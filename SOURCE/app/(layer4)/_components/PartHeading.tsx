"use client";

// PartHeading — tiêu đề MỘT nhóm câu ở màn sửa đề, sửa được tại chỗ (2026-09-03).
//
// Vì sao nó tồn tại: `exams.parts` trước đây chỉ được ghi ĐÚNG MỘT LẦN lúc
// extract. AI đọc "I. PHẦN ĐỌC HIỂU" thành "Phần 1" thì đề mang cái sai đó tới
// lúc publish, và học sinh thấy nó ở màn làm bài (ExamPlayer.tsx:100 đọc cùng
// mảng). Heading là thứ neo cấu trúc đề gốc trong toàn hệ thống, nên nó phải
// sửa được như mọi nội dung khác của đề.
//
// Chế độ mặc định là XEM — không phải một ô input luôn hiện. Trên một đề đúng
// (đa số), heading không cần sửa, và ba ô input viền sáng nằm giữa danh sách
// câu sẽ đọc như ba thứ đang chờ tác giả điền.

import { useEffect, useRef, useState } from "react";
import { useT } from "@/lib/i18n/client";
import { LIMITS } from "@/lib/ugc/limits";

interface PartHeadingProps {
  /** Số phần — dùng cho id neo và nhãn mặc định. */
  partNumber: number;
  /** Tiêu đề in trên đề gốc. `undefined` = đề không khai phần này. */
  title?: string;
  /** Chuỗi rỗng ⇒ gỡ khai báo, quay về nhãn mặc định. */
  onChange: (title: string) => void;
  disabled?: boolean;
}

export function PartHeading({ partNumber, title, onChange, disabled }: PartHeadingProps) {
  const t = useT();
  const [editing, setEditing] = useState(false);
  const [draft, setDraft] = useState(title ?? "");
  const inputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (editing) inputRef.current?.focus();
  }, [editing]);

  const fallback = t("upload.partLabel", { part: partNumber });

  function commit() {
    setEditing(false);
    const next = draft.trim();
    if (next !== (title ?? "")) onChange(next);
  }

  if (editing) {
    return (
      <div className="mb-3 flex items-center gap-2">
        <input
          ref={inputRef}
          value={draft}
          onChange={(e) => setDraft(e.target.value)}
          onBlur={commit}
          onKeyDown={(e) => {
            if (e.key === "Enter") {
              e.preventDefault();
              commit();
            }
            // Escape = bỏ thay đổi. Không dùng `commit()`: tác giả gõ nhầm rồi
            // bấm Escape đang nói "quên chuyện này đi", ghi lại draft là làm
            // ngược ý họ.
            if (e.key === "Escape") {
              setDraft(title ?? "");
              setEditing(false);
            }
          }}
          maxLength={LIMITS.MAX_PART_TITLE}
          placeholder={fallback}
          aria-label={t("upload.partTitleLabel", { part: partNumber })}
          className="border-border bg-card text-foreground focus:border-brand w-full max-w-md rounded-[4px] border px-2 py-1 text-sm outline-none"
        />
      </div>
    );
  }

  return (
    <div className="mb-3 flex items-center gap-2">
      <h2 id={`part-${partNumber}`} className="eyebrow">
        {title ?? fallback}
      </h2>
      {!disabled && (
        <button
          type="button"
          onClick={() => {
            setDraft(title ?? "");
            setEditing(true);
          }}
          className="text-muted-foreground hover:text-brand text-xs underline-offset-4 hover:underline"
        >
          {t("common.edit")}
        </button>
      )}
    </div>
  );
}
