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
  // Nhãn cho <nav> của thanh điều hướng đáy (mobile). Trang có HAI landmark
  // `navigation` cùng lúc (header + thanh đáy) nên mỗi cái phải có tên riêng,
  // nếu không người dùng trình đọc màn hình chỉ nghe "navigation, navigation".
  "nav.primary": "Primary",
  "nav.secondary": "Account and language",

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

  // --- Băng chuyền trang chủ (HomeCarousel) -------------------------------
  // Ba mục cùng một chuỗi. Mục "Giới thiệu" dùng lại nguyên văn các khoá
  // `home.eyebrow`/`home.headline`/`home.bodyPart*` ở trên — nó CHÍNH LÀ nhóm
  // nội dung hero cũ, không viết lại.
  "home.carouselLabel": "Platform highlights",
  // `aria-roledescription` — thay chữ "group" mà trình đọc màn hình đọc mặc
  // định bằng tên đúng của thành phần. DỊCH được, và phải dịch: nó được đọc to
  // bằng ngôn ngữ của trang.
  "home.carouselRole": "carousel",
  "home.slideRole": "slide",
  "home.slidePosition": "{current} of {total}",
  // Nhãn cụm nút điều khiển (WCAG 2.2.2 cho tạm dừng/phát).
  "home.carouselPause": "Pause automatic slideshow",
  "home.carouselPlay": "Resume automatic slideshow",
  "home.carouselPrev": "Previous highlight",
  "home.carouselNext": "Next highlight",
  // `tabAi`/`tabAdaptive` giữ tên khoá cũ dù dãy tab đã bỏ: chúng nay là dòng
  // eyebrow của mục 2 và 3. Đổi tên khoá chỉ để đẹp sẽ chạm vào cả hai từ điển
  // mà không đổi được gì người dùng thấy.
  "home.tabAi": "AI-powered",
  "home.tabAdaptive": "Adaptive learning",
  // Tên hiển thị của website. Khớp `applicationName`/`title` trong
  // app/layout.tsx — đổi tên thương hiệu thì sửa ĐÚNG khoá này (và metadata),
  // đừng rải chuỗi vào từng component.
  "home.siteName": "MS-MOLAR",
  // Mỗi mục đúng MỘT dòng mô tả ngắn — giữ ngắn là có chủ đích, đây là thẻ
  // giới thiệu chứ không phải trang tính năng.
  "home.aiDescription":
    "AI extracts every question from the PDFs you upload, and grades your answers the moment you submit.",
  "home.adaptiveDescription":
    "Each attempt reshapes what you practise next, so revision time lands where your score actually moves.",

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
  "player.previous": "Previous",
  "player.answeredStatus": "answered",

  // --- Kết quả ------------------------------------------------------------
  "result.title": "Result",
  "result.time": "Time",
  "result.submittedAfterTime": "Submitted after time.",
  "result.overtimeBody":
    "This attempt went {time} over the allotted time, so the score is not a valid timed result.",
  "result.storedAnswerLabel": "Stored answer:",
  "result.skippedLabel": "Skipped",
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
  // Trung tính về thiết bị: chuột thì rê, cảm ứng thì chạm — một chuỗi đúng cho
  // cả hai, thay vì "Hover…" vốn là hướng dẫn không làm theo được bằng ngón tay.
  "analytics.barHint": "Select a subject for details",
  "analytics.barAlt": "Correct vs. incorrect answers by subject",
  "analytics.needsReview": "Needs review",
  "analytics.donutTitle": "Most Frequently Practiced Subject",
  "analytics.donutAlt": "Practice session share by subject",
  "analytics.tabBar": "Bar",
  "analytics.tabDonut": "Donut",
  "analytics.rangeWeek": "Week",
  "analytics.rangeMonth": "Month",
  "analytics.rangeAll": "All time",
  "analytics.donutSubtitle": "% share of practice sessions by subject, this {range}",

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

  // --- Dùng chung (bổ sung) -----------------------------------------------
  "common.all": "All",
  "common.subject": "Subject",
  "common.grade": "Grade",
  "common.share": "Share",
  "common.active": "active",

  // --- Bộ lọc & độ khó ----------------------------------------------------
  "exams.sortNewest": "Newest",
  "exams.sortOldest": "Oldest",
  "exams.sortHardest": "Hardest",
  "exams.levelEasy": "Easy",
  "exams.levelMedium": "Medium",
  "exams.levelHard": "Hard",
  "exams.gradeValue": "Grade {grade}",
  "rating.finishExamFirst": "Finish this exam first",
  "rating.logInToRate": "Log in to rate",
  "rating.partOf": "Part {part} of {total}",
  "rating.rateFromTo": "{name} — rate from 1 (easiest) to 10 (hardest)",
  "rating.prev": "Prev",
  "rating.submitRating": "Submit rating",
  "rating.submitted": "Rating submitted",
  "rating.unrated": "UNRATED",
  "rating.rated": "RATED",
  "rating.partiallyRated": "{rated}/{total} RATED",
  "rating.mcqEyebrow": "PART I · MULTIPLE CHOICE",
  "rating.mcqName": "Multiple Choice",
  "rating.mcqDescription":
    "Four options per question, one correct answer. Tests basic recall and understanding.",
  "rating.tfEyebrow": "PART II · TRUE / FALSE",
  "rating.tfName": "True / False",
  "rating.tfDescription":
    "Four sub-statements per question, mark each true or false. One wrong sub-statement forfeits the whole question — no guessing by elimination.",
  "rating.saEyebrow": "PART III · SHORT ANSWER",
  "rating.saName": "Short Answer",
  "rating.saDescription":
    "No options to pick from — solve and enter a single numeric answer. No room for guesswork.",
  "rating.errIneligible": "You need to finish this exam before you can rate it.",
  "rating.errInvalid": "Please rate all three parts from 1 to 10.",
  "rating.errRateLimited": "You're rating too quickly. Please wait a moment and try again.",
  "rating.errServer": "Couldn't save your rating right now. Please try again.",

  // --- Lịch sử (bổ sung) --------------------------------------------------
  "history.sharing": "Sharing…",
  "history.moreActionsFor": "More actions for {title}",
  "history.pdfFooterPrefix": "Generated by MS-MOLAR · summary only, not a full transcript",
  "history.exam": "Exam",
  "history.score": "Score",
  "history.submitted": "Submitted",
  "history.minimumScore": "Minimum score",
  "history.maximumScore": "Maximum score",
  "history.submittedFrom": "Submitted from date",
  "history.submittedTo": "Submitted to date",

  // --- Trạng thái đề UGC --------------------------------------------------
  "status.processing": "Processing",
  "status.needsReview": "Needs review",
  "status.draft": "Draft",
  "status.published": "Published",
  "status.needsFixing": "Needs fixing",

  // --- Kiểm duyệt (bổ sung) -----------------------------------------------
  "admin.intro":
    "Signed in as {email}. Removing an exam pulls it from the catalog immediately and stops new attempts; the author cannot undo it.",
  "admin.awaitingReview": "Awaiting review",
  "admin.removed": "Removed",
  "admin.oneReport": "1 report",
  "admin.reportCount": "{count} reports",
  "admin.statusLabel": "status:",
  "admin.errMissingExamId": "Missing exam id.",
  "admin.errUnknownAction": "Unknown moderation action.",
  "admin.errNotAllowed": "Not allowed.",
  "admin.errCouldNotApply": "Could not apply the change. Try again.",
  "admin.examRemoved": "Exam removed from the catalog.",
  "admin.examRestored": "Exam restored as a draft.",

  // --- Tải đề lên (bổ sung) -----------------------------------------------
  "upload.fieldTitle": "Title",
  "upload.fieldSubject": "Subject",
  "upload.fieldGrade": "Grade",
  "upload.examDuration": "Exam Duration",
  "upload.examPaper": "Exam Paper",
  "upload.answerKey": "Answer Key",
  "upload.fileHint": "PNG, JPEG, WebP, or PDF · up to {mb} MB · PDF up to {pages} pages",
  "upload.maxFileSize": "Maximum file size: {mb}MB each · PDF up to {pages} pages.",
  "upload.filledAutomatically": "— filled in automatically",
  "upload.automaticNote":
    "AI will scan your uploaded files and extract the exam automatically — you can still edit any field.",
  "upload.manualNote":
    "Fill in every exam detail yourself; AI will still extract the questions and answers.",
  "upload.extractingWithMeta":
    "Reading your exam details, questions and answers… this can take a moment.",
  "upload.extractingFiles": "Reading your files and assembling the exam… this can take a moment.",
  "upload.reviewBeforePublish": "You'll review everything before it's published.",
  "upload.errTitleRequired": "Please enter the exam title.",
  "upload.errSubjectRequired": "Please select the subject.",
  "upload.errGradeRange": "Please enter a grade between {min} and {max}.",
  "upload.errDurationRequired": "Please enter the exam duration.",
  "upload.errQuestionFileRequired": "Please attach the exam paper.",
  "upload.errAnswerFileRequired": "Please attach the answer key.",
  // Nhãn định danh câu — dùng CHUNG cho card câu hỏi và cho copy lỗi UGC
  // (lib/ugc/errorCopy.ts), để hai chỗ không bao giờ gọi cùng một câu bằng
  // hai cái tên khác nhau.
  "upload.questionLabel": "Question {number}",
  "upload.partQuestionLabel": "Part {part} Question {number}",
  "upload.partLabel": "Part {part}",
  "upload.oneQuestion": "1 question",
  "upload.questionCount": "{count} questions",
  "upload.typeMcq": "Multiple choice",
  "upload.typeEssay": "Essay",
  "upload.typeTrueFalse": "True/False (Đúng/Sai)",
  "upload.typeShortAnswer": "Short answer",
  "upload.emptyPlaceholder": "— empty —",
  "upload.markChoiceCorrect": "Mark choice {choice} correct",
  "upload.choicePlaceholder": "Choice {choice}",
  "upload.correctAnswer": "Correct answer",
  "upload.fromYourAnswerFile": "— from your answer file",
  "upload.statementPlaceholder": "Statement {item})",
  "upload.answerForItem": "Answer for {item})",
  "upload.tfPerStatement": "Đ/S per statement — from your answer file.",
  "upload.shortAnswerExample": "e.g. 1260 / 1,04",
  "upload.fixIssuesFirst": "Fix all issues before publishing.",
  "upload.deleteBody":
    "“{title}” and its questions and files will be permanently removed. This can't be undone.",
  "upload.publishedBanner": "Your exam is published and now visible in the catalog.",
  "upload.tabPending": "Pending",
  "upload.tabPublished": "Published",
  "upload.actionReviewFix": "Review & fix",
  "upload.actionContinueReview": "Continue review",
  "upload.actionContinue": "Continue",
  "upload.gradeShort": "Grade {grade}",
  "upload.publishedAt": "Published {date}",

  // --- Lỗi trích xuất đề (UgcError) ---------------------------------------
  // `{q}` là nhãn câu đã dựng sẵn ("Question 3" / "Part 2 Question 3") —
  // formatUgcError ghép vào, đừng thay bằng số trần.
  "ugcError.oneIssueToFix": "1 issue to fix before you can publish:",
  "ugcError.issuesToFix": "{count} issues to fix before you can publish:",
  "ugcError.noQuestionsFound":
    "No questions were recognized in the question file. Re-upload a clearer file.",
  "ugcError.tooManyQuestions": "Too many questions — an exam can have at most {max}.",
  "ugcError.wrongChoiceCount":
    "{q} — {count} choices were read; an MCQ needs exactly 4 (A–D). Edit below or re-upload.",
  "ugcError.emptyStem": "{q} — the question text is empty; add it below.",
  "ugcError.emptyChoice": "{q} — choice {choice} is empty.",
  "ugcError.answerCountMismatch":
    "The answer file has {answers} answers but the question file has {questions} questions ({unmatched} unmatched).",
  "ugcError.answerMissing":
    "{q} — no answer found in your answer file. Add it to the file or set it below.",
  "ugcError.imageCropFailed":
    "{q} — the image couldn't be cropped. Re-upload the file or remove the image.",
  "ugcError.extractionFailed": "Couldn't read your files right now. Please try again.",
  "ugcError.fileTooLarge": "That file is too large (max {mb} MB).",
  "ugcError.tooManyPages": "That file has too many pages (max {max}).",
  "ugcError.stemTooLong": "{q} — the question text is too long (max {max} characters).",
  "ugcError.choiceTooLong": "{q} — choice {choice} is too long (max {max} characters).",
  "ugcError.essayAnswerTooLong": "{q} — the model answer is too long (max {max} characters).",
  "ugcError.wrongSubItemCount":
    "{q} — {count} sub-items were read; a true/false question needs {min}–{max} items (a–d). Edit below or re-upload.",
  "ugcError.shortAnswerTooLong": "{q} — the expected answer is too long (max {max} characters).",
  "ugcError.metaIncomplete": "Exam details — {field} is missing. Add it above before publishing.",
  "ugcError.metaInvalid": "Exam details — {field} is out of range. Correct it above.",
  "ugcError.metaInvalidRange": "Exam details — {field} is out of range ({range}). Correct it above.",
  "ugcError.metaExtractionFailed":
    "Exam details — we couldn't read the exam details from your file. Fill them in above.",
  "ugcError.durationRange": "{min}–{max} minutes",
  "ugcError.fieldTitle": "the title",
  "ugcError.fieldSubject": "the subject",
  "ugcError.fieldGrade": "the grade",
  "ugcError.fieldDuration": "the duration",
  "ugcError.fieldSchool": "the school",
  "ugcError.fieldSchoolYear": "the school year",
  "ugcError.fieldSemester": "the semester",
  "ugcError.fieldRequired": "a required field",
  "ugcError.fieldGeneric": "a field",

  // User Support System v1 — sendSupportNotification subject only (NOT the
  // support.* widget block, that's a separate later addition). Deliberately
  // NOT prefixed "support." to avoid colliding with that block's key set.
  "mail.ticketIntent.bug": "bug report",
  "mail.ticketIntent.suggestion": "suggestion",
  "mail.ticketIntent.question": "question",

  // User Support System v1 — support.* widget block (student-facing only;
  // support.admin.* is a separate later addition, task-14's responsibility).
  // common.cancel/common.retry/common.working are REUSED, not duplicated here.
  "support.trigger.label": "Send feedback",
  "support.dialog.title": "Send feedback",
  "support.intent.groupLabel": "Feedback type",
  "support.intent.bug": "Bug report",
  "support.intent.suggestion": "Suggestion",
  "support.intent.question": "Question",
  "support.validation.intentRequired": "Please pick a feedback type.",
  "support.message.label": "Message",
  "support.message.placeholder": "Describe what you'd like to share…",
  "support.message.count": "{count}/{max}",
  "support.validation.messageRequired": "Please enter a message.",
  "support.screenshot.label": "Attach a screenshot (optional)",
  "support.screenshot.chooseFile": "Choose file",
  "support.screenshot.remove": "Remove image",
  "support.screenshot.uploading": "Uploading image…",
  "support.screenshot.tooLarge": "That image is over {maxMb}MB. Try a smaller one.",
  "support.screenshot.invalidType": "Only PNG, JPEG, or WebP images are accepted.",
  "support.screenshot.rejected": "That image isn't valid — try another one or send without it.",
  "support.submit": "Send",
  "support.submitting": "Sending…",
  "support.error.rateLimited": "You're sending a bit fast — try again in a few minutes.",
  "support.error.network": "Couldn't send — might be a network issue. Please try again.",
  "support.error.generic": "Couldn't send right now. Please try again.",
  "support.ack.title": "Sent!",
  "support.ack.message": "Thanks for the feedback. We'll take a look soon.",
  "support.ack.reference": "Reference: {ref}",
  "support.ack.close": "Close",

  // Admin inbox (/admin/tickets) — task-13/14.
  "support.admin.title": "Support inbox",
  "support.admin.empty": "No feedback yet.",
  "support.admin.notifyFailed": "Notification email failed",
  "support.admin.screenshotAlt": "Screenshot attached by the student",
  "support.admin.notesEmpty": "No internal notes yet.",
  "support.admin.notePlaceholder": "Internal note (admins only)…",
  "support.admin.noteSubmit": "Save note",
  "support.admin.noteError": "Couldn't save the note. Please try again.",
  "support.admin.statusError": "Couldn't update status. Please try again.",
  "support.admin.status.new": "New",
  "support.admin.status.inProgress": "In progress",
  "support.admin.status.resolved": "Resolved",
} as const;

/** Tập khoá hợp lệ — mọi ngôn ngữ khác phải phủ đủ. */
export type MessageKey = keyof typeof en;

export type Dictionary = Record<MessageKey, string>;
