"use client";

// ExamRow — một hàng đề trong "My exams" (UI Spec §ExamRow / Task 6.3).
// Action theo status (D9): processing→không; failed→Review & fix + Delete;
// review→Continue review + Delete; draft→Continue + Delete; published→Edit +
// Delete (tiêu đề link tới đề live).
//
// Layout theo template SCREENSHOT/design_reference/ReviewPage_Layer4: thẻ bo
// góc, badge trái viết tắt môn học, nút action chính kiểu brand-filled. Hàng
// CHƯA published: right-click mở context menu (Edit/Delete) tại điểm click,
// hover hiện tooltip theo con trỏ (HIDDEN_FEATURES.md) — nút action chính nằm
// NGOÀI vùng trigger nên hover/right-click nút không kích hoạt tooltip/menu
// của hàng. Hàng published: read-only, không context menu (đã publish).
// Toàn bộ copy hệ thống giữ tiếng Anh (khớp ngôn ngữ hiện có của app) — bản
// mock tiếng Việt trong design_reference chỉ là copy minh hoạ, không phải yêu
// cầu ngôn ngữ.

import { useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import type { MyExamListItem } from "@/app/(layer4)/queries";
import { StatusBadge } from "./StatusBadge";
import { DeleteDialog } from "./DeleteDialog";
import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip";
import {
  ContextMenu,
  ContextMenuContent,
  ContextMenuItem,
  ContextMenuTrigger,
} from "@/components/ui/context-menu";

const REVIEW_HREF = (id: string) => `/me/exams/${id}`;

/** Nhãn hành động chính theo status (null = không có action chính). */
function primaryAction(item: MyExamListItem): { label: string; href: string } | null {
  switch (item.status) {
    case "failed":
      return { label: "Review & fix", href: REVIEW_HREF(item.id) };
    case "review":
      return { label: "Continue review", href: REVIEW_HREF(item.id) };
    case "draft":
      return { label: "Continue", href: REVIEW_HREF(item.id) };
    case "published":
      return { label: "Edit", href: REVIEW_HREF(item.id) };
    default:
      return null; // processing
  }
}

/** Badge trái kiểu "file type" — viết tắt 3 ký tự từ môn học (sentinel "" → "EXM"). */
function subjectBadgeLabel(subject: string): string {
  const trimmed = subject.trim();
  return trimmed === "" ? "EXM" : trimmed.slice(0, 3).toUpperCase();
}

function formatDateTime(iso: string): string {
  const d = new Date(iso);
  const pad = (n: number) => String(n).padStart(2, "0");
  return `${pad(d.getDate())}/${pad(d.getMonth() + 1)}/${d.getFullYear()} ${pad(d.getHours())}:${pad(d.getMinutes())}`;
}

export function ExamRow({ item }: { item: MyExamListItem }) {
  const primary = primaryAction(item);
  const isPublished = item.status === "published";
  // Published: tiêu đề trỏ tới đề live; còn lại trỏ màn review (nếu có action).
  const titleHref = isPublished ? `/exams/${item.id}` : (primary?.href ?? null);
  const [deleteOpen, setDeleteOpen] = useState(false);
  const router = useRouter();

  const content = (
    <div className="flex min-w-0 flex-1 items-center gap-4">
      <span
        aria-hidden
        className="flex h-11 w-11 shrink-0 items-center justify-center rounded-[4px] border border-border font-sans text-[0.65rem] font-medium tracking-wide text-muted-foreground"
      >
        {subjectBadgeLabel(item.subject)}
      </span>
      <div className="min-w-0">
        <div className="flex flex-wrap items-center gap-3">
          {titleHref ? (
            <Link
              href={titleHref}
              className="truncate text-lg text-foreground transition-colors hover:text-brand"
            >
              {item.title}
            </Link>
          ) : (
            <span className="truncate text-lg text-foreground">{item.title}</span>
          )}
          <StatusBadge status={item.status} />
        </div>
        {/* v2.2: subject/grade có thể còn sentinel (""/0 — Automatic, AI chưa
            đọc được) → hiện "—" thay vì "Grade 0". */}
        <p className="mt-1 text-sm text-muted-foreground">
          {item.subject !== "" ? item.subject : "—"} · Grade{" "}
          {item.grade !== 0 ? item.grade : "—"} · {item.questionCount} question
          {item.questionCount === 1 ? "" : "s"} · {formatDateTime(item.createdAt)}
        </p>
        {isPublished && item.reviewedAt && (
          <p className="mt-0.5 text-sm text-brand">
            Published {formatDateTime(item.reviewedAt)}
          </p>
        )}
      </div>
    </div>
  );

  return (
    <li className="flex flex-col gap-3 rounded-lg border border-border p-5 transition-colors duration-200 sm:flex-row sm:items-center sm:justify-between">
      {isPublished ? (
        content
      ) : (
        <Tooltip trackCursorAxis="both">
          <ContextMenu>
            <ContextMenuTrigger
              render={<TooltipTrigger render={<div />} />}
              className="flex min-w-0 flex-1 cursor-default items-center"
            >
              {content}
            </ContextMenuTrigger>
            <TooltipContent>Right-click to open actions</TooltipContent>
            <ContextMenuContent>
              {primary && (
                <ContextMenuItem onClick={() => router.push(primary.href)}>
                  Edit
                </ContextMenuItem>
              )}
              <ContextMenuItem
                variant="destructive"
                onClick={() => setDeleteOpen(true)}
              >
                Delete
              </ContextMenuItem>
            </ContextMenuContent>
          </ContextMenu>
        </Tooltip>
      )}

      <div className="flex shrink-0 items-center gap-4">
        {primary && (
          <Link
            href={primary.href}
            className="rounded-[4px] bg-brand px-4 py-2 text-xs font-medium uppercase tracking-[0.14em] text-brand-foreground transition-opacity duration-200 hover:opacity-90"
          >
            {primary.label}
          </Link>
        )}
        {isPublished && <DeleteDialog examId={item.id} examTitle={item.title} />}
      </div>

      {!isPublished && (
        <DeleteDialog
          examId={item.id}
          examTitle={item.title}
          open={deleteOpen}
          onOpenChange={setDeleteOpen}
        />
      )}
    </li>
  );
}
