// saveErrorText — ánh xạ 3 mã lỗi của `saveSolution` sang chữ hiển thị (UI
// Action - API Contract Mapping, frontend DD v1.6, binding). Dùng chung bởi
// `SolutionEditorScreen` (thanh đáy "Lưu nháp") và `NoteSheet` (dòng lỗi
// trong tấm trượt LẪN trong hộp thoại đóng-khi-còn-thay-đổi, DD-U5) — một hàm
// duy nhất để hai bề mặt không bao giờ hiện hai chữ khác nhau cho cùng một mã.
// Tách khỏi SolutionEditorScreen.tsx để tránh import vòng: NoteSheet cần hàm
// này, và SolutionEditorScreen cần import NoteSheet.
import { t } from "@/lib/copy";
import type { SaveSolutionResult } from "@/features/solutions/actions";

export function saveErrorText(error: Extract<SaveSolutionResult, { ok: false }>["error"]): string {
  switch (error.code) {
    case "belowWordCount":
      return t("solutions.note.tooShortPublished");
    case "rateLimited":
      return t("profile.error.rateLimited", { seconds: error.seconds });
    case "generic":
      return t("solutions.note.saveError");
  }
}
