"use client";

// Nửa client của StartAttemptButton — chỉ phần cần `useFormStatus`, để bản thân
// nút vẫn do Server Component dựng (nhãn truyền xuống dạng chuỗi).
//
// `useFormStatus` phải nằm trong một component CON của <form>, không phải trong
// chính component render <form> — hook đọc trạng thái của form cha gần nhất.
//
// Theme "Sân trường": dùng primitive Button (viên thuốc 52px — hành động chính
// duy nhất của màn hình), không còn class nút chép tay của theme cũ. Trạng thái
// chờ: khoá nút, đổi nhãn, thêm vòng xoay — ba kênh, không chỉ đổi màu.

import { useFormStatus } from "react-dom";
import { Loader2 } from "lucide-react";
import { startPageNavigationIndicator } from "@/lib/nav/pageNavigation";
import { Button } from "@/components/ui/button";

interface StartAttemptSubmitProps {
  /** Nhãn nút. */
  label: string;
  /** Nhãn cho lúc đang chờ server tạo attempt. */
  pendingLabel: string;
}

export function StartAttemptSubmit({ label, pendingLabel }: StartAttemptSubmitProps) {
  const { pending } = useFormStatus();

  return (
    <Button
      type="submit"
      size="lg"
      disabled={pending}
      aria-busy={pending}
      onClick={() => startPageNavigationIndicator()}
      className="w-full"
    >
      {pending && <Loader2 aria-hidden className="animate-spin motion-reduce:animate-none" />}
      {pending ? pendingLabel : label}
    </Button>
  );
}
