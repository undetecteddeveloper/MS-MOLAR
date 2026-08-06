// Từ điển tiếng Anh — NGUỒN CHÂN LÝ cho tập khoá i18n. `vi.ts` phải phủ đúng
// bộ khoá này; kiểu `Dictionary` suy ra từ đây nên thiếu khoá bên vi là lỗi
// biên dịch chứ không phải chuỗi rỗng lúc chạy.
//
// Quy ước đặt tên: `<vùng>.<khoá>`. Vùng `common` dành cho chuỗi lặp ở nhiều
// màn hình (Cancel, Edit…) — đừng nhân bản chúng vào từng vùng.
//
// Chuỗi có tham số dùng cú pháp `{name}`, thay bằng `t("key", { name })`.

export const en = {
  // --- Dùng chung ---------------------------------------------------------
  "common.cancel": "Cancel",
  "common.edit": "Edit",
  "common.delete": "Delete",
  "common.remove": "Remove",
  "common.clear": "Clear",
  "common.filters": "Filters",
  "common.filter": "Filter",
  "common.retry": "Retry",
  "common.tryAgain": "Try again",
  "common.home": "Home",
  "common.next": "Next →",
  "common.back": "Back",
  "common.signOut": "Sign out",
  "common.myExams": "My exams",
  "common.displayName": "Display name",
  "common.displayNameHint": "Max 12 characters, letters and dots only.",
  "common.browseExams": "Browse exams",
  "common.viewDetails": "View details",
  "common.school": "School",
  "common.semester": "Semester",
  "common.year": "Year",
  "common.correct": "Correct",
  "common.wrong": "Wrong",
  "common.questions": "Questions",
  "common.by": "by",
  "common.none": "None",
  "common.skipToContent": "Skip to content",
  "common.save": "Save",
  "common.saving": "Saving…",
  "common.working": "Working…",
  "common.processing": "Processing…",
  "common.sending": "Sending…",
  "common.done": "Done",
  "common.restore": "Restore",

  // --- Điều hướng ---------------------------------------------------------
  "nav.home": "Home",
  "nav.exams": "Exams",
  "nav.analytics": "Analytics",
  "nav.history": "History",
  "nav.upload": "Upload",
  "nav.account": "Account",
  "nav.language": "Language",
  "nav.switchTo": "Switch to {language}",

  // --- Trang chủ ----------------------------------------------------------
  "home.eyebrow": "Online exam practice platform",
  "home.headline":
    "Multi-Subject & Multi-Grade Online Learning Platform with Digital Footprint Analytics and User-Generated Content Synthesis",
  // Đoạn mô tả ở hero có HAI cụm được gạch chân vàng đồng nằm giữa câu, nên
  // phải cắt thành 5 mảnh xen kẽ [đoạn][nhấn][đoạn][nhấn][đoạn] thay vì một
  // chuỗi duy nhất. Cắt theo CẤU TRÚC chứ không theo từ: tiếng Việt đảo trật tự
  // ("Ngân hàng câu hỏi cập nhật liên tục" vs "A continuously updated question
  // bank"), nên mỗi ngôn ngữ tự phân bổ chữ vào 5 ô sao cho đọc xuôi.
  "home.bodyPart1": "A ",
  "home.continuouslyUpdated": "continuously updated",
  "home.bodyPart2": " question bank for secondary and high school, with ",
  "home.instantGrading": "instant grading",
  "home.bodyPart3": " and weakness analysis so you study the right things and improve faster.",
  "home.getStarted": "Get started",

  // --- Xác thực -----------------------------------------------------------
  "auth.email": "Email",
  "auth.password": "Password",
  "auth.forgotPassword": "Forgot password?",
  "auth.resetIntro": "Enter your account email and we'll send you a link to reset your password.",
  "auth.setNewPassword": "Set a new password",
  "auth.signedInAs": "Signed in as",
  "auth.passwordHint": "At least 6 characters.",
  "auth.signIn": "Sign in",
  "auth.signUp": "Sign up",
  "auth.resetPassword": "Reset password",
  "auth.sendResetLink": "Send reset link",
  "auth.showPassword": "Show password",
  "auth.hidePassword": "Hide password",
  "auth.backToSignIn": "← Back to sign in",
  "auth.orSignInWith": "Or sign in with",
  "auth.orSignUpWith": "Or sign up with",

  // --- Danh sách đề -------------------------------------------------------
  "exams.title": "Exams",
  "exams.noMatch": "No matching exams",
  "exams.noMatchHint": "Try removing some filters to see more exams.",
  "exams.level": "Level",
  "exams.start": "Start",
  "exams.duration": "Duration",
  "exams.minutesShort": "min",
  "exams.difficulty": "Difficulty",
  "exams.toggleSortDirection": "Toggle sort direction",
  "exams.ascending": "Ascending",
  "exams.descending": "Descending",

  // --- Làm bài ------------------------------------------------------------
  "player.timeRemaining": "Time remaining",
  "player.lastMinute": "Last minute",
  "player.minutesRemaining": "{count} minutes remaining",
  "player.oneMinuteRemaining": "1 minute remaining",
  "player.secondsRemaining": "{count} seconds remaining",
  "player.submit": "Submit",
  "player.submitting": "Submitting…",
  "player.chooseAnswer": "Choose an answer",
  "player.yourAnswer": "Your answer",
  "player.tfNotScored": "True/False — stored, not auto-scored yet.",
  "player.shortAnswerScored": "Short answer — auto-scored after you submit.",
  "player.essayNotScored": "Essay question — answer on paper. Stored, not auto-scored yet.",
  "player.leaveTitle": "Leave this exam?",
  "player.leaveBody":
    "Your answers haven't been submitted yet. If you leave now, the progress of this attempt will be lost.",
  "player.leave": "Leave",
  "player.flag": "Flag",
  "player.flagged": "Flagged",
  "player.flagHint": "Flag this question for review",
  "player.unflagHint": "Unflag this question",

  // --- Kết quả ------------------------------------------------------------
  "result.title": "Result",
  "result.time": "Time",
  "result.submittedAfterTime": "Submitted after time.",
  "result.return": "Return",
  "result.attemptDetails": "Attempt details",
  "result.notAutoScored": "Not auto-scored",
  "result.correctAnswer": "Correct answer",
  "result.yourChoice": "Your choice",
  "result.editRating": "Edit your rating",
  "result.rateThisExam": "Rate this exam",

  // --- Chấm độ khó --------------------------------------------------------
  "rating.rate": "Rate →",
  "rating.rubric": "Difficulty rubric",
  "rating.overall": "Overall",
  "rating.rateAllParts": "Rate all three parts to submit.",
  "rating.needAttemptTitle": "You need to finish this exam first",
  "rating.needAttemptBody": "Complete an attempt on this exam before you can rate its difficulty.",
  "rating.title": "Difficulty rating",
  "rating.intro":
    "Rate each part from 1 (easiest) to 10 (hardest). Your overall score is the average of the three.",

  // --- Báo cáo đề ---------------------------------------------------------
  "report.title": "Report this exam",
  "report.intro":
    "Tell us what's wrong with this exam (incorrect answers, inappropriate content, etc.).",
  "report.placeholder": "Describe the problem…",
  "report.submit": "Submit report",
  "report.submitting": "Submitting…",

  // --- Lịch sử ------------------------------------------------------------
  "history.title": "History",
  "history.noMatches": "No matches",
  "history.noMatchesHint": "Try adjusting or clearing your filters.",
  "history.noResults": "No results yet",
  "history.noResultsHint": "Finish an exam to see it here.",
  "history.loadError": "Couldn't load your history right now.",
  "history.pdfError": "Couldn't generate the PDF. Try again.",
  "history.downloadedNoShare": "Downloaded — sharing isn't supported in this browser.",
  "history.min": "Min",
  "history.max": "Max",
  "history.generatingPdf": "Generating your PDF, please wait",

  // --- Phân tích ----------------------------------------------------------
  "analytics.title": "Analytics",
  "analytics.subtitle": "Track correct/incorrect answers by subject and practice frequency.",
  "analytics.noData": "No data yet",
  "analytics.noDataHint": "Complete a submitted attempt in this range to see analytics.",
  "analytics.timeRangeFilter": "Time range filter",
  "analytics.barTitle": "Correct vs. Incorrect by Subject",
  "analytics.barHint": "Hover a subject for details",
  "analytics.barAlt": "Correct vs. incorrect answers by subject",
  "analytics.needsReview": "Needs review",
  "analytics.donutTitle": "Most Frequently Practiced Subject",
  "analytics.donutAlt": "Practice session share by subject",

  // --- Tải đề lên (UGC) ---------------------------------------------------
  "upload.title": "Import Exam Document",
  "upload.intro":
    "Upload the exam and answer key to the system. Choose automatic mode to let AI scan the document, or enter details manually for more control.",
  "upload.leaveEmptyHint":
    "Leave these empty — we'll read them from your file. You can edit everything before publishing. Anything you type here wins over the AI.",
  "upload.entryMode": "Entry Mode",
  "upload.automatic": "Automatic",
  "upload.manual": "Manual",
  "upload.instructionsTitle": "Import Instructions",
  "upload.supportedFormats": "Supported formats: PNG, JPEG, WebP, or PDF.",
  "upload.choose": "Choose",
  "upload.automaticHint": "to let AI scan and extract the exam — no manual entry needed.",
  "upload.manualHint": "to fill in the exam details yourself.",
  "upload.answersNeverGuessed": "Answers always come from your answer file — never guessed by AI.",
  "upload.fromYourFile": "from your file",
  "upload.schoolYear": "School Year",
  "upload.minutes": "minutes",
  "upload.myExams": "My exams",
  "upload.myExamsHint": "Check your exams before they go live.",
  "upload.uploadAnExam": "Upload an exam",
  "upload.noneUploaded": "You haven't uploaded any exams yet.",
  "upload.nothingPending": "Nothing pending — nice and tidy.",
  "upload.nonePublished": "No exams published yet.",
  "upload.deleteTitle": "Delete this exam?",
  "upload.rightClickHint": "Right-click to open actions",
  "upload.publishedNotice": "This exam is published. Edits are saved live and stay complete.",
  "upload.examDetails": "Exam details",
  "upload.fixedAfterPublish": "Subject and grade are fixed after publishing.",
  "upload.removeImage": "Remove image",
  "upload.notSet": "not set",
  "upload.storedNotScored": "Stored, not auto-scored yet.",
  "upload.expectedAnswer": "Expected answer — from your answer file",
  "upload.shortAnswerStored": "Short answer — stored, not auto-scored yet.",
  "upload.modelAnswer": "Model answer",
  "upload.essayStored": "Essay — stored, not auto-scored yet.",
  "upload.questionText": "Question text",
  "upload.deleting": "Deleting…",
  "upload.dragDrop": "Drag & drop, or click to upload",
  "upload.fromFile": "From file",
  "upload.selectSubject": "Select a subject",
  "upload.saveChanges": "Save changes",
  "upload.publish": "Publish",
  "upload.publishing": "Publishing…",
  "upload.untitledExam": "Untitled exam",
  "upload.start": "Start",

  // --- Kiểm duyệt ---------------------------------------------------------
  "admin.title": "Reported content",
  "admin.reportedReasons": "Reported reasons",
  "admin.notConfigured": "ADMIN_USER_IDS is not configured — no one can act here.",
  "admin.nothingReported": "Nothing reported.",
  "admin.reasonForRemoval": "Reason for removal (optional)",
  "admin.reasonForRestoring": "Reason for restoring (optional)",

  // --- Trang lỗi ----------------------------------------------------------
  "result.yourAnswerLabel": "Your answer:",
  "result.correctAnswerLabel": "Correct answer:",
  "result.skipped": "— skipped —",
  "report.submitError": "Couldn't submit the report right now. Please try again.",
  "auth.enterNewPasswordFor": "Enter a new password for",
  "history.shareUnsupported": "Downloaded — sharing isn't supported in this browser.",

  "error.somethingBroke": "Something broke",
  "error.couldntLoad": "We couldn't load this page",
  "error.couldntLoadBody":
    "The problem is on our side, not yours. Trying again usually works — if it doesn't, come back in a few minutes.",
  "error.couldntStart": "MS-MOLAR couldn't start",
  "error.couldntStartBody":
    "Reloading usually clears this. If it keeps happening, try again in a few minutes.",
  "error.reload": "Reload",
  "error.notFound": "This page doesn't exist",
  "error.notFoundBody":
    "The link may be broken, or the exam may have been unpublished or deleted by its author.",
  "error.reference": "Reference:",
} as const;

/** Tập khoá hợp lệ — mọi ngôn ngữ khác phải phủ đủ. */
export type MessageKey = keyof typeof en;

export type Dictionary = Record<MessageKey, string>;
