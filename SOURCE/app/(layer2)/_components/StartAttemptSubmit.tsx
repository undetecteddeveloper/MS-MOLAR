"use client";

// Nửa client của StartAttemptButton — chỉ phần cần `useFormStatus`, để bản thân
// nút vẫn do Server Component dựng (nhãn đã dịch truyền xuống dạng chuỗi, không
// kéo từ điển i18n sang bundle).
//
// `useFormStatus` phải nằm trong một component CON của <form>, không phải trong
// chính component render <form> — hook đọc trạng thái của form cha gần nhất.

import { useFormStatus } from "react-dom";
import { startPageNavigationIndicator } from "@/lib/nav/pageNavigation";

interface StartAttemptSubmitProps {
  /** Nhãn ĐÃ DỊCH. */
  label: string;
  /** Nhãn ĐÃ DỊCH cho lúc đang chờ server tạo attempt. */
  pendingLabel: string;
}

export function StartAttemptSubmit({ label, pendingLabel }: StartAttemptSubmitProps) {
  const { pending } = useFormStatus();

  return (
    <button
      type="submit"
      disabled={pending}
      aria-busy={pending}
      onClick={() => startPageNavigationIndicator()}
      className="bg-brand text-brand-foreground inline-flex w-full items-center justify-center gap-2 rounded-full px-6 py-3 font-medium transition-colors duration-200 hover:bg-[#8F2523] disabled:opacity-70 sm:w-auto sm:px-12"
    >
      {pending && (
        <svg aria-hidden viewBox="0 0 24 24" className="h-4 w-4 motion-safe:animate-spin">
          <circle
            cx="12"
            cy="12"
            r="9"
            fill="none"
            stroke="currentColor"
            strokeWidth="3"
            strokeOpacity="0.3"
          />
          <path
            d="M21 12a9 9 0 0 0-9-9"
            fill="none"
            stroke="currentColor"
            strokeWidth="3"
            strokeLinecap="round"
          />
        </svg>
      )}
      {pending ? pendingLabel : label}
    </button>
  );
}
