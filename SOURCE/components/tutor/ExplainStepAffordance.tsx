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
import { BentoCell } from "@/components/layout/BentoGrid";
import { RichText } from "@/components/shared/RichText";
import { Button } from "@/components/ui/button";
import { useT } from "@/lib/i18n/client";
import { useTutorAction } from "./useTutorAction";

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
  // questionId đã là key của chính danh sách câu hỏi nên tự nó duy nhất trong
  // một trang — không cần thêm prop idPrefix (Minimal Surface Element 3).
  const reasonId = `tutor-${questionId}-reason`;

  // D5: gợi ý hiện ra là trạng thái CUỐI của lượt render này — nút bị THAY THẾ
  // hẳn (không phải ẩn đi hay khoá lại), nên không còn nút nào để gọi gia sư
  // lần nữa cho câu này.
  if (phase === "hint-shown" && hint !== null) {
    return (
      <BentoCell span="full">
        <span className="eyebrow">{t("tutor.hintEyebrow")}</span>
        <RichText text={hint} className="text-foreground mt-2 text-base leading-relaxed" />
      </BentoCell>
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
