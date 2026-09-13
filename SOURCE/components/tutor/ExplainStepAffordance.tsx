"use client";

// ExplainStepAffordance — cửa vào của gia sư "Gợi ý cho câu này" (PRD R7, UI
// Spec S-01/D4/D5). Từ 2026-09-13 nó đứng trong THẺ CÂU HỎI của màn làm bài
// (ExamPlayer → QuestionRenderer `hintSlot`), mở cho MỌI câu kể cả tự luận —
// engineer: "người ta cần gợi ý lúc đang bí, không phải lúc đã làm xong". Bản
// trước mount ở trang Chi tiết kết quả, chỉ khi hasBeenWrongTwice. Máy trạng
// thái nằm ở useTutorAction (cùng thư mục).
// Gợi ý của Gemini render QUA RichText (D4/ADR-0002) vì nó phái sinh từ nội dung
// câu hỏi do người dùng tải lên (bị ảnh hưởng bởi kẻ tấn công) — ở đây không mở
// thêm một đường render nào không đi qua sanitize.
//
// `hint`/`onHint`: ExamPlayer giữ gợi ý đã nhận THEO CÂU. Component này được
// mount lại (`key={question.id}`) mỗi lần đổi câu nên state trong hook về idle
// — không có `hint` prop thì quay lại câu vừa hỏi sẽ thấy nút chứ không thấy
// lời gia sư, và bấm lần nữa là tốn thêm một lượt. `draftAnswer` là bài làm
// hiện tại của câu, gửi kèm để gia sư trả lời đúng chỗ em ấy đang kẹt.
//
// KHÔNG BAO GIỜ dùng `disabled` gốc (làm nút rơi khỏi thứ tự tab/focus — đúng
// con bug đã phải sửa hai lần trong repo này: RateButton rồi ActionButton);
// aria-disabled + aria-busy + aria-describedby nói thay trạng thái, còn chốt
// chặn nháy đúp thật sự là busyRef đồng bộ trong hook.

import { Lightbulb, Loader2 } from "lucide-react";
import dynamic from "next/dynamic";
import { useEffect, useRef } from "react";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { useEntitlement } from "@/lib/billing/entitlement";
import { isQuotaExhausted } from "@/lib/billing/types";
import { t } from "@/lib/copy";
import { useTutorAction } from "./useTutorAction";

// RichText nạp ĐỘNG, không import tĩnh (TD-021/TD-023). Lý do nằm ở xác suất:
// bảng gợi ý chỉ render sau khi học sinh CHỦ ĐỘNG bấm nút. Import tĩnh thì cây
// markdown+KaTeX (122.5 KB gzip — chunk client lớn nhất dự án) nằm trong bundle
// đầu của MÀN LÀM BÀI cho mọi người, kể cả người không bao giờ bấm — đúng thứ
// TD-023 đã đẩy ra khỏi màn này bằng cách render nội dung câu hỏi ở server.
//
// `ssr: false` là ĐÚNG chứ không phải để né lỗi: `hint` chỉ tồn tại sau một lời
// gọi Server Action từ tương tác người dùng, nên ở lượt render server nó luôn
// rỗng — không có gì để render trước, và cũng không có gì bị mất khi bỏ SSR.
const RichText = dynamic(() => import("@/components/shared/RichText").then((m) => m.RichText), {
  ssr: false,
});

/** Kiểu props này KHÔNG mang nổi đáp án (correct_answer/sub_answers/
 *  essay_answer) lẫn nhãn kỹ năng — phòng thủ theo cấu trúc cho AC-018/019 và
 *  AC-029. Ba trường thêm 2026-09-13 đều là DỮ LIỆU CỦA HỌC SINH hoặc lời gia
 *  sư đã nhận, không phải một chỗ để đáp án chui vào. */
export interface ExplainStepAffordanceProps {
  questionId: string;
  attemptId: string;
  /** Bài làm hiện tại của câu (chưa nộp). Đọc lúc bấm. Mặc định rỗng. */
  draftAnswer?: string;
  /** Gợi ý đã nhận cho câu này ở một lượt mount trước — có thì hiện ngay. */
  hint?: string | null;
  /** Báo lên cha khi nhận được gợi ý, để cha giữ theo câu. */
  onHint?: (hint: string) => void;
}

export function ExplainStepAffordance({
  questionId,
  attemptId,
  draftAnswer = "",
  hint: storedHint = null,
  onHint,
}: ExplainStepAffordanceProps) {
  const { phase, hint: freshHint, run } = useTutorAction(attemptId, questionId, onHint);
  const { tutor } = useEntitlement();
  // Bản đã nhận ở lượt trước (cha giữ) hoặc bản vừa về trong lượt này.
  const hint = storedHint ?? freshHint;
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
  // Ref nằm trên một <div> bọc ngoài chứ không trên chính <Card>: Card là
  // component đa hình (`as` = div|li|section|article) và cố ý không nhận `ref`
  // — khai một prop `ref` ở đó buộc TS giao props của cả bốn thẻ và không kiểu
  // ref nào thoả được. Đổi API một component dùng chung để lấy một lời gọi
  // .focus() cục bộ là cái giá sai; <div> bọc ngoài không đổi bố cục vì <li>
  // cha đã là flex-col (item vẫn dàn hết chiều ngang).
  const hintRef = useRef<HTMLDivElement>(null);
  // Gợi ý cha giữ từ trước hiện ngay lúc mount (không cần phase); gợi ý vừa về
  // thì đợi phase — hai đường cùng một bảng.
  const showHint = hint !== null && (storedHint !== null || phase === "hint-shown");
  // Chỉ bắt focus khi bảng THAY THẾ nút trong lượt này — lúc quay lại một câu
  // đã có gợi ý, người dùng vừa bấm số câu trên bảng câu hỏi, không nên bị
  // giật focus.
  const focusOnReveal = phase === "hint-shown";
  useEffect(() => {
    if (showHint && focusOnReveal) hintRef.current?.focus();
  }, [showHint, focusOnReveal]);

  // D5: gợi ý hiện ra là trạng thái CUỐI của lượt render này — nút bị THAY THẾ
  // hẳn (không phải ẩn đi hay khoá lại), nên không còn nút nào để gọi gia sư
  // lần nữa cho câu này.
  if (showHint) {
    return (
      // Theme "Sân trường" (2026-09-06): thẻ surface bo 18px thay BentoCell kẻ
      // viền. Nó đứng ngay dưới dãy lựa chọn (cũng tô surface, nhưng bo 14px và
      // cách nhau 8px) — bo góc lớn hơn, đệm rộng hơn và khoảng cách 16px phía
      // trên là thứ tách nó khỏi dãy ấy; icon bóng đèn cạnh nhãn nói đây là lời
      // gia sư, không phải một đáp án thứ năm.
      <div
        ref={hintRef}
        tabIndex={-1}
        className="focus-visible:outline-ring rounded-card focus-visible:outline-2 focus-visible:outline-offset-2"
      >
        <Card>
          <span className="eyebrow flex items-center gap-1.5">
            <Lightbulb aria-hidden className="size-3.5" />
            {t("tutor.hintEyebrow")}
          </span>
          <RichText text={hint} className="text-foreground text-base leading-relaxed" />
        </Card>
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
      <Card variant="outline" padding="compact" className="border-dashed">
        <p className="text-sm leading-relaxed">{t("billing.quota.tutorExhausted")}</p>
      </Card>
    );
  }

  return (
    <div>
      <Button
        type="button"
        variant="secondary"
        size="sm"
        onClick={() => run(draftAnswer)}
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
