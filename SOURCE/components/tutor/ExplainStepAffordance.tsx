"use client";

// ExplainStepAffordance — cửa vào của gia sư "Giải thích bước này" (PRD R7, UI
// Spec S-01/D4/D5). Chỉ mount khi hasBeenWrongTwice là true (mặc định đóng,
// AC-024) — chính ResultDetailPage quyết định việc đó, component này không tự
// gác. Máy trạng thái nằm ở useTutorAction (cùng thư mục).
// Gợi ý của Gemini render QUA RichText (D4/ADR-0002) vì nó phái sinh từ nội dung
// câu hỏi do người dùng tải lên (bị ảnh hưởng bởi kẻ tấn công) — ở đây không mở
// thêm một đường render nào không đi qua sanitize.
//
// KHÔNG BAO GIỜ dùng `disabled` gốc (làm nút rơi khỏi thứ tự tab/focus — đúng
// con bug đã phải sửa hai lần trong repo này: RateButton rồi ActionButton);
// aria-disabled + aria-busy + aria-describedby nói thay trạng thái, còn chốt
// chặn nháy đúp thật sự là busyRef đồng bộ trong hook.

import { Lightbulb, Loader2 } from "lucide-react";
import dynamic from "next/dynamic";
import Link from "next/link";
import { useEffect, useRef } from "react";
import { BentoCell } from "@/components/layout/BentoGrid";
import { Button } from "@/components/ui/button";
import { useEntitlement } from "@/lib/billing/entitlement";
import { isQuotaExhausted } from "@/lib/billing/types";
import { useT } from "@/lib/i18n/client";
import { useTutorAction } from "./useTutorAction";

// RichText nạp ĐỘNG, không import tĩnh (TD-021). Lý do nằm ở xác suất: component
// này chỉ mount khi học sinh đã sai câu đó HAI lần, và ngay cả lúc đó bảng gợi ý
// vẫn chỉ render sau khi họ CHỦ ĐỘNG bấm nút. Import tĩnh thì cây markdown+KaTeX
// (122.5 KB gzip — chunk client lớn nhất dự án) nằm trong bundle đầu của trang
// Chi tiết kết quả cho MỌI người xem, kể cả người làm đúng hết và không bao giờ
// thấy cái nút này.
//
// `ssr: false` là ĐÚNG chứ không phải để né lỗi: `hint` chỉ tồn tại sau một lời
// gọi Server Action từ tương tác người dùng, nên ở lượt render server nó luôn
// rỗng — không có gì để render trước, và cũng không có gì bị mất khi bỏ SSR.
const RichText = dynamic(() => import("@/components/shared/RichText").then((m) => m.RichText), {
  ssr: false,
});

/** Cố ý chỉ hai trường: kiểu props này KHÔNG mang nổi đáp án
 *  (correct_answer/sub_answers/essay_answer) lẫn nhãn kỹ năng — phòng thủ theo
 *  cấu trúc cho AC-018/019 và AC-029. */
export interface ExplainStepAffordanceProps {
  questionId: string;
  attemptId: string;
}

export function ExplainStepAffordance({ questionId, attemptId }: ExplainStepAffordanceProps) {
  const t = useT();
  const { phase, hint, run } = useTutorAction(attemptId, questionId);
  const { tutor } = useEntitlement();
  // questionId đã là key của chính danh sách câu hỏi nên tự nó duy nhất trong
  // một trang — không cần thêm prop idPrefix (Minimal Surface Element 3).
  const reasonId = `tutor-${questionId}-reason`;

  // Bắt lại focus khi bảng gợi ý THAY THẾ nút (Phase 5 Task 19, đo trên trình
  // duyệt thật): D5 buộc nút biến mất hẳn, mà nút đó chính là phần tử đang giữ
  // focus của người dùng bàn phím vừa bấm Enter/Space. Trình duyệt trả focus về
  // <body>, nên Tab kế tiếp nhảy ngược lên đầu tài liệu và người dùng bàn phím
  // không bao giờ tới được nội dung họ vừa yêu cầu. tabIndex={-1} cho bảng nhận
  // được focus theo lệnh mà KHÔNG chen vào thứ tự Tab.
  //
  // Ref chứ KHÔNG phải document.getElementById(): id chỉ duy nhất trong một
  // trang thật, còn trong jsdom nhiều lần render cùng questionId sống chung một
  // document, và getElementById sẽ trả về panel của lần render TRƯỚC.
  //
  // Ref nằm trên một <div> bọc ngoài chứ không trên chính <BentoCell>: BentoCell
  // là component đa hình (`as` = div|li|section), nên khai một prop `ref` ở đó
  // buộc TS giao props của cả ba thẻ và không kiểu ref nào thoả được. Đổi API
  // một component dùng chung để lấy một lời gọi .focus() cục bộ là cái giá sai;
  // <div> bọc ngoài không đổi bố cục vì <li> cha đã là flex-col (item vẫn dàn
  // hết chiều ngang).
  const hintRef = useRef<HTMLDivElement>(null);
  const showHint = phase === "hint-shown" && hint !== null;
  useEffect(() => {
    if (showHint) hintRef.current?.focus();
  }, [showHint]);

  // D5: gợi ý hiện ra là trạng thái CUỐI của lượt render này — nút bị THAY THẾ
  // hẳn (không phải ẩn đi hay khoá lại), nên không còn nút nào để gọi gia sư
  // lần nữa cho câu này.
  if (showHint) {
    return (
      <div ref={hintRef} tabIndex={-1} className="focus-visible:outline-ring rounded-[var(--radius-card)] focus-visible:outline-2 focus-visible:outline-offset-2">
        <BentoCell span="full">
          <span className="eyebrow">{t("tutor.hintEyebrow")}</span>
          <RichText text={hint} className="text-foreground mt-2 text-base leading-relaxed" />
        </BentoCell>
      </div>
    );
  }

  // Hết hạn mức kỳ → KHÔNG render nút, và cũng không gọi Server Action lần nào
  // (AC-014/AC-015: "0 request nào được gửi tới Gemini" trong ca bị chặn).
  //
  // Trạng thái này được suy ra TRƯỚC khi bấm, từ quyền lợi — chứ không phải từ
  // một mã lỗi trả về SAU khi bấm. Đó là chủ đích (UI Spec UI-D3): việc gộp bốn
  // mã lỗi ở dưới là một quyết định CHỐNG LỘ THÔNG TIN có ghi lý do, và tách nó
  // ra sẽ mở lại đúng thứ nó tồn tại để che (not_eligible). Nói trước thì thông
  // điệp sau-thất-bại không cần mang nghĩa "hết lượt" nữa, nên AC-041 đạt được
  // mà không phải đụng vào bề mặt lộ thông tin.
  //
  // Đặt SAU nhánh showHint: một gợi ý đã giao rồi thì không được rút lại. Nhánh
  // này chỉ có nghĩa khi còn một cái nút để bấm.
  //
  // `isQuotaExhausted` trả false khi hạn mức là `unknown` (fail-OPEN, UI-D2) —
  // tức trong suốt pha UI, khi chưa có bộ đếm nào tồn tại, nhánh này KHÔNG BAO
  // GIỜ chạy trên production. Cố ý: quy `unknown` về 0 sẽ tắt gia sư cho toàn
  // bộ người dùng.
  if (isQuotaExhausted(tutor)) {
    return (
      // Không dùng role="alert": đây là trạng thái lúc MOUNT, không phải thứ
      // xuất hiện giữa chừng (không có đường nào đi từ nút sang đây — nút không
      // tồn tại khi đã hết lượt). role="alert" ở đây sẽ ngắt lời trình đọc màn
      // hình ngay khi tải trang mà chẳng báo được thay đổi nào.
      <div className="border-border rounded-lg border border-dashed px-4 py-3">
        <p className="text-foreground text-sm leading-relaxed">
          {t("billing.quota.tutorExhausted")}
        </p>
        <Link
          href="/pricing"
          className="text-brand mt-2 inline-flex min-h-11 items-center text-sm underline-offset-4 hover:underline"
        >
          {t("billing.quota.upgradeLink")}
        </Link>
      </div>
    );
  }

  return (
    <div>
      <Button
        type="button"
        variant="outline"
        className="min-h-11"
        onClick={run}
        // Chuỗi "true"/"false" chứ không phải boolean — theo đúng quy ước của
        // ActionButton.
        aria-disabled={phase === "busy" ? "true" : "false"}
        aria-busy={phase === "busy"}
        aria-describedby={reasonId}
      >
        {phase === "busy" ? (
          <Loader2 className="size-4 animate-spin" aria-hidden />
        ) : (
          <Lightbulb className="size-4" aria-hidden />
        )}
        {phase === "error" ? t("common.retry") : t("tutor.explainThisStep")}
      </Button>
      {/* MỘT câu chung cho cả bốn mã lỗi của explainStep(): phân biệt theo mã sẽ
          để lộ rằng phía server có vòng tái kiểm tra điều kiện (not_eligible).
          Nằm trong luồng (không position:absolute) — ở đây có chỗ dọc trong <li>,
          khác ràng buộc bố cục của ActionButton. */}
      {phase === "error" && (
        <p role="alert" className="text-destructive mt-2 text-sm">
          {t("tutor.error")}
        </p>
      )}
      {/* Không đặt aria-live: chính việc chuỗi này BIẾN ĐỔI ("" → tutor.busy →
          "") là cơ chế thông báo, giống hệt span lý do đã chạy thật của
          ActionButton. */}
      <span id={reasonId} className="sr-only">
        {phase === "busy" ? t("tutor.busy") : ""}
      </span>
    </div>
  );
}
