"use client";

// FormulaPreview — vùng xem trước bản render của ghi chú; bộ render chỉ nạp
// khi bấm lần đầu (UI Spec § Component: FormulaPreview; AC-102, AC-103, S15,
// M12, UI-D23).
//
// `dynamic(() => import("@/components/shared/RichText")…, { ssr: false })` +
// `warmRichText()` khi bấm lần đầu — mẫu THAM KHẢO
// `SOURCE/features/authoring/components/QuestionEditor.tsx:78-85` (KHÔNG
// import chéo, B4: authoring và solutions là hai tính năng khác nhau). KHÔNG
// BAO GIỜ static `import { RichText }` ở đây hay bất kỳ file "use client" nào
// khác của `features/solutions` (M12) — cùng một `import()` cho cả
// `dynamic()` lẫn `warmRichText()` để bundler gộp về MỘT chunk và promise
// module được nhớ (không tải hai lần).
//
// Trạng thái nạp/lỗi tự quản lý bằng MỘT `import()` tường minh (`open()`
// dưới đây) thay vì dựa vào Suspense fallback của `next/dynamic`: cần biết
// CHÍNH XÁC lúc nào chunk tải xong để đổi nhãn nút + `aria-busy`
// (UI-D23) — thứ `dynamic()`'s `loading` option không báo lại được. Đến lúc
// `<LazyRichText>` thực sự render, module đã nằm trong cache của trình duyệt
// (cùng `import()` ở trên), nên Suspense nội bộ của `next/dynamic` gần như
// không có gì để "chờ" — không tải hai lần, không nhấp nháy placeholder kép.
import dynamic from "next/dynamic";
import { Component, useState, type ReactNode } from "react";
import { Button } from "@/components/ui/button";
import { t } from "@/lib/copy";

const LazyRichText = dynamic(() => import("@/components/shared/RichText").then((m) => m.RichText), {
  ssr: false,
});

/** Hâm nóng chunk RichText NGAY khi bấm lần đầu — xem bất biến ở đầu file. */
function warmRichText() {
  void import("@/components/shared/RichText");
}

/** Lưới an toàn thứ hai cho lượt render `<LazyRichText>`: `open()` đã bắt lỗi
 *  nạp qua `import()` của chính nó trước khi đổi sang "shown", nên trong điều
 *  kiện thường boundary này không có gì để bắt — nó chỉ đứng đó phòng một lượt
 *  render throw sau khi state đã "shown" (Error Boundary là NGOẠI LỆ DUY NHẤT
 *  được phép ở dạng class component, typescript-rules). */
class PreviewErrorBoundary extends Component<
  { onError: () => void; children: ReactNode },
  { hasError: boolean }
> {
  state = { hasError: false };
  static getDerivedStateFromError() {
    return { hasError: true };
  }
  componentDidCatch() {
    this.props.onError();
  }
  render() {
    return this.state.hasError ? null : this.props.children;
  }
}

export interface FormulaPreviewProps {
  /** Chuỗi ghi chú hiện tại — cùng chuỗi ô nhập đang giữ (S15: cùng chuỗi vào
   *  → cùng kết quả với màn xem, vì đi qua ĐÚNG một `RichText`). */
  text: string;
}

type PreviewState = "hidden" | "loading" | "shown" | "error";

const PREVIEW_REGION_ID = "formula-preview-region";

export function FormulaPreview({ text }: FormulaPreviewProps) {
  const [state, setState] = useState<PreviewState>("hidden");

  async function open() {
    if (text.trim() === "") {
      // Rỗng: không có gì để xem trước, không cần nạp chunk gì cả.
      setState("shown");
      return;
    }
    warmRichText();
    setState("loading");
    try {
      await import("@/components/shared/RichText");
      setState("shown");
    } catch {
      setState("error");
    }
  }

  function toggle() {
    if (state === "shown" || state === "loading") {
      setState("hidden");
      return;
    }
    void open();
  }

  return (
    <div>
      <Button
        type="button"
        variant="secondary"
        aria-expanded={state === "shown" || state === "loading"}
        aria-controls={PREVIEW_REGION_ID}
        aria-busy={state === "loading" || undefined}
        onClick={toggle}
      >
        {state === "loading" ? t("solutions.note.previewLoading") : t("solutions.note.preview")}
      </Button>

      {state === "loading" && (
        <div
          id={PREVIEW_REGION_ID}
          aria-live="polite"
          className="bg-surface mt-2 min-h-20 animate-pulse rounded-lg"
        >
          <span className="sr-only">{t("solutions.note.previewLoading")}</span>
        </div>
      )}

      {state === "shown" && (
        <div id={PREVIEW_REGION_ID} className="mt-2">
          {text.trim() === "" ? (
            <p className="text-muted-foreground text-sm">{t("solutions.note.previewEmpty")}</p>
          ) : (
            <PreviewErrorBoundary onError={() => setState("error")}>
              <LazyRichText text={text} className="text-foreground text-base leading-relaxed" />
            </PreviewErrorBoundary>
          )}
        </div>
      )}

      {state === "error" && (
        <div className="mt-2 flex flex-col items-start gap-2">
          <p role="alert" className="text-destructive text-sm">
            {t("solutions.note.previewError")}
          </p>
          <Button type="button" variant="secondary" size="sm" onClick={() => void open()}>
            {t("common.retry")}
          </Button>
        </div>
      )}
    </div>
  );
}
