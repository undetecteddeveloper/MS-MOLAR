"use client";

// User Support System v1 — SupportWidget: cổng self-guard duy nhất quyết định
// widget có mount hay không (AC-003, AC-005, D1). Không tự fetch gì — user đã
// được layout cha fetch sẵn (getCurrentUserProfile(), cùng object truyền cho
// SiteHeader), nên KHÔNG có round-trip mới nào ở đây.

import { useState } from "react";
import { usePathname } from "next/navigation";
import type { CurrentUserProfile } from "@/lib/auth/getCurrentUser";
import { SupportWidgetTrigger } from "@/components/support/SupportWidgetTrigger";
import { SupportWidgetDialog } from "@/components/support/SupportWidgetDialog";
import { TRIGGER_ID } from "@/components/support/SupportWidgetTrigger";

// Route đang làm bài (exams) — widget VẮNG MẶT thật sự ở đây (AC-005, D1),
// không phải ẩn bằng CSS. Một hằng số regex DUY NHẤT dùng chung cho cả 5 mount
// point — đổi hình dạng route thì chỉ sửa đúng dòng này.
const ATTEMPT_ROUTE_RE = /^\/exams\/[^/]+\/attempt\/[^/]+$/;

interface SupportWidgetProps {
  user: CurrentUserProfile | null;
}

export function SupportWidget({ user }: SupportWidgetProps) {
  const pathname = usePathname();
  const [open, setOpen] = useState(false);

  // UI-D7 (manual keyboard pass, 2026-08-13 finding): Escape/scrim/Cancel
  // must return focus to the trigger, not drop it to <body> — the dialog's
  // own panel only knows how to focus ITSELF on open, not where to send
  // focus back to on close, so the parent (which owns both siblings) closes
  // this loop.
  function handleClose() {
    setOpen(false);
    document.getElementById(TRIGGER_ID)?.focus();
  }

  // Cả hai điều kiện chạy trên MỌI render (không chỉ lúc mount) — chuyển
  // trang bằng client-side navigation (không reload) vẫn cập nhật đúng.
  if (user === null) return null;
  if (ATTEMPT_ROUTE_RE.test(pathname)) return null;

  return (
    <>
      <SupportWidgetTrigger onOpen={() => setOpen(true)} />
      <SupportWidgetDialog open={open} onClose={handleClose} />
    </>
  );
}
