// Toàn bộ câu chữ hiển thị của MS-MOLAR — MỘT file, chỉ tiếng Việt.
//
// Trước 2026-09-04 repo có lớp i18n hai ngôn ngữ (cookie locale, provider,
// nút đổi ngôn ngữ, hai từ điển en/vi). Engineer quyết định bỏ hẳn tiếng Anh
// trong đợt refactor UI; giữ lại đúng phần có ích: bảng khoá → chuỗi để sửa
// lời một chỗ, và hàm `t()` thay tham số `{name}`.
//
// Quy ước đặt tên khoá: `<vùng>.<khoá>`. Vùng `common` cho chuỗi lặp ở nhiều
// màn hình. Chuỗi có tham số dùng `{name}`, gọi `t("key", { name })`.
// Giọng văn: xưng "bạn", thuật ngữ theo cách nói trong trường phổ thông.

export const copy = {
  // --- Dùng chung ---------------------------------------------------------
  "common.cancel": "Huỷ",
  "common.edit": "Sửa",
  "common.delete": "Xoá",
  "common.remove": "Bỏ",
  "common.clear": "Xoá lọc",
  "common.filters": "Bộ lọc",
  "common.retry": "Thử lại",
  "common.tryAgain": "Làm lại",
  "common.home": "Trang chủ",
  "common.next": "Tiếp →",
  "common.back": "Quay lại",
  "common.signOut": "Đăng xuất",
  "common.myExams": "Đề của tôi",
  "common.profile": "Hồ sơ",
  "common.displayName": "Tên hiển thị",
  "common.displayNameHint": "Tối đa 12 ký tự, chỉ chữ cái và dấu chấm.",
  "common.browseExams": "Xem danh sách đề",
  "common.viewDetails": "Xem chi tiết",
  "common.school": "Trường",
  "common.semester": "Học kỳ",
  "common.year": "Năm học",
  "common.correct": "Đúng",
  "common.wrong": "Sai",
  "common.questions": "Câu hỏi",
  // Nút mở bảng nhảy tới câu (màn làm bài trên điện thoại, màn sửa đề).
  "common.questionPalette": "Bảng câu hỏi",
  "common.by": "bởi",
  "common.none": "Không",
  "common.skipToContent": "Tới nội dung chính",
  "common.save": "Lưu",
  "common.saving": "Đang lưu…",
  "common.working": "Đang xử lý…",
  "common.processing": "Đang xử lý…",
  "common.sending": "Đang gửi…",
  "common.done": "Xong",
  "common.restore": "Khôi phục",
  "common.loading": "Đang tải",
  // Bài giải cộng đồng (task 10, giàn giáo ghi chú tối giản) — nguyên văn UI
  // Spec § "Chuỗi tiếng Việt cần thêm" → "Chung (solutions.*)".
  "common.close": "Đóng",

  // --- Điều hướng ---------------------------------------------------------
  "nav.home": "Trang chủ",
  "nav.exams": "Kho đề",
  "nav.analytics": "Thống kê",
  "nav.history": "Lịch sử",
  "nav.upload": "Nhập đề",
  "nav.account": "Tài khoản",
  "nav.language": "Ngôn ngữ",
  "nav.switchTo": "Chuyển sang {language}",
  "nav.primary": "Chính",
  "nav.secondary": "Tài khoản và ngôn ngữ",

  // --- Trang chủ ----------------------------------------------------------
  "home.headline":
    "Nền tảng học trực tuyến đa môn, đa khối lớp — phân tích dấu chân số và tổng hợp nội dung do người dùng đóng góp",
  "home.bodyPart1": "Ngân hàng câu hỏi ",
  "home.continuouslyUpdated": "cập nhật liên tục",
  "home.bodyPart2": " cho THCS và THPT, kèm ",
  "home.instantGrading": "chấm điểm tức thì",
  "home.bodyPart3": " và phân tích điểm yếu, để bạn học đúng trọng tâm và tiến bộ nhanh hơn.",
  "home.getStarted": "Bắt đầu",
  "home.aboutPrompt": "Bạn muốn tìm thông tin của chúng tôi? Nhấn vào đây",
  // Trang chủ theme "Sân trường" (2026-09-04) — hero căn trái, một câu tiêu đề,
  // một đoạn dẫn, một hành động chính.
  "home.title": "Luyện đề thật, chấm ngay, biết mình yếu chỗ nào.",
  "home.lead":
    "Kho đề THCS và THPT cập nhật liên tục. Làm bài có đồng hồ, chấm điểm tức thì, thống kê theo từng môn.",
  "home.cta": "Bắt đầu luyện đề",
  "home.browse": "Xem kho đề",
  "home.newExams": "Đề mới đăng",
  "home.hotExams": "Đề nổi nhất",
  // Khối công nghệ cạnh hero cho khách (TechStack). Mỗi dòng là VAI TRÒ thật
  // của công nghệ đó trong repo, không phải khẩu hiệu — Gemini đọc đề (ADR-0006)
  // và gợi ý gia sư (Engine 1), Groq chấm tự luận (ADR-0018).
  "home.tech.title": "Nền tảng công nghệ",
  "home.tech.nextjs": "Giao diện và máy chủ",
  "home.tech.supabase": "Dữ liệu, đăng nhập, lưu trữ",
  "home.tech.gemini": "Đọc đề từ ảnh và PDF, gợi ý gia sư",
  "home.tech.groq": "Chấm bài tự luận",
  "home.tech.claude": "Công cụ đã xây dựng website này",
  // Ba điều khách chưa đăng nhập cần biết (kho đề chỉ đọc được sau đăng nhập).
  "home.point1": "Đề thật từ các trường và các kỳ thi, do cộng đồng đóng góp.",
  "home.point2": "Nộp bài là có điểm ngay, kèm đáp án từng câu.",
  "home.point3": "Thống kê theo môn để bạn biết mình còn yếu chỗ nào.",
  "home.viewAllExams": "Xem tất cả đề",
  "home.about": "Về MS-MOLAR",
  // Dải tiến độ cá nhân + kệ lời giải cộng đồng, chỉ hiện khi đã đăng nhập
  // (F-041, 2026-09-30) — bớt đơn điệu cho trang chủ.
  "home.progress.title": "Tiến độ của bạn",
  "home.progress.completedCount": "{count} đề đã hoàn thành",
  "home.progress.topSubject": "Luyện nhiều nhất: {subject}",
  "home.progress.cta": "Xem hồ sơ",
  "home.solutions.title": "Lời giải cộng đồng mới nhất",

  // --- Băng chuyền trang chủ (HomeCarousel) -------------------------------
  "home.carouselLabel": "Điểm nổi bật của nền tảng",
  "home.carouselRole": "băng chuyền",
  "home.slideRole": "mục",
  "home.slidePosition": "{current} trên {total}",
  "home.carouselPause": "Tạm dừng tự động chuyển mục",
  "home.carouselPlay": "Tiếp tục tự động chuyển mục",
  "home.aiHeadline": "Có tích hợp AI",
  "home.poweredBy": "Vận hành bởi",
  "home.performanceHeadline": "Hiệu năng vượt trội",
  "home.aiDescription":
    "AI bóc tách từng câu hỏi từ file đề bạn tải lên, và chấm bài ngay khi bạn nộp.",
  "home.performanceDescription":
    "Mỗi trang bắt đầu phản hồi trong khoảng 60 mili-giây và dựng xong không xê dịch một dòng nào — bạn đọc được ngay khi trang tới, không phải đợi vòng xoay.",

  // --- Xác thực -----------------------------------------------------------
  "auth.email": "Email",
  "auth.password": "Mật khẩu",
  "auth.forgotPassword": "Quên mật khẩu?",
  "auth.resetIntro": "Nhập email tài khoản của bạn, chúng tôi sẽ gửi liên kết đặt lại mật khẩu.",
  "auth.setNewPassword": "Đặt mật khẩu mới",
  "auth.signedInAs": "Đang đăng nhập bằng",
  // {min} — xem chú thích ở en.ts: số cứng cũ ("6") mâu thuẫn với luật server.
  "auth.passwordHint": "Ít nhất {min} ký tự.",
  "auth.signIn": "Đăng nhập",
  "auth.signUp": "Đăng ký",
  "auth.resetPassword": "Đặt lại mật khẩu",
  "auth.sendResetLink": "Gửi liên kết đặt lại",
  "auth.showPassword": "Hiện mật khẩu",
  "auth.hidePassword": "Ẩn mật khẩu",
  "auth.backToSignIn": "Quay lại đăng nhập",
  "auth.orSignInWith": "Hoặc đăng nhập bằng",
  "auth.orSignUpWith": "Hoặc đăng ký bằng",

  // --- Danh sách đề -------------------------------------------------------
  // Kệ đề (ExamShelf) — 3 kệ trên trang danh sách đề (docs/ui-spec/exam-shelves-ui-spec.md § Copy Keys).
  "exams.shelfPracticeTitle": "Cần luyện",
  "exams.shelfHotTitle": "Nổi nhất",
  "exams.attemptCount": "{count} lượt làm",
  "exams.shelfHotGradeWeek": "Khối {grade}, tuần này",
  "exams.shelfHotGradeMonth": "Khối {grade}, 30 ngày qua",
  "exams.shelfHotGradeAll": "Khối {grade}, từ trước tới nay",
  "exams.shelfHotSiteWeek": "Toàn hệ thống, tuần này",
  "exams.shelfHotSiteMonth": "Toàn hệ thống, 30 ngày qua",
  "exams.shelfExploreTitle": "Khám phá",
  "exams.shelfViewAllStore": "Xem toàn bộ kho đề",
  "exams.hotRibbon": "Hot nhất",
  "exams.title": "Kho đề",
  "exams.noMatch": "Không có đề nào khớp",
  "exams.noMatchHint": "Thử bỏ bớt bộ lọc để thấy nhiều đề hơn.",
  "exams.level": "Độ khó",
  "exams.start": "Làm bài",
  "exams.open": "Làm đề",
  "exams.questionCount": "{count} câu",
  "exams.filterActive": "Đang lọc",
  "exams.filterSummary": "Bộ lọc ({count})",
  "exams.duration": "Thời lượng",
  "exams.minutesShort": "phút",
  "exams.difficulty": "Độ khó",
  "exams.facts": "Thông tin đề",
  "exams.questionTotal": "Số câu",
  "exams.beforeStartTitle": "Trước khi bắt đầu",
  "exams.beforeStartBody":
    "Bạn có {minutes} phút cho {count} câu. Đồng hồ chạy ngay khi bạn bấm Làm bài, xong sớm thì nộp sớm.",
  // Tìm đề theo tên (ADR-0020).
  "exams.searchChip": "Tìm: “{query}”",
  "exams.searchChipRemove": "Bỏ từ khoá “{query}”",
  "exams.noSearchMatch": "Không tìm thấy đề nào cho “{query}”",
  "exams.noSearchMatchHint": "Thử từ khoá ngắn hơn, hoặc bỏ bớt bộ lọc.",
  // Phân trang (TD-026).
  "exams.pagination": "Các trang danh sách đề",
  "exams.previousPage": "Trước",
  "exams.nextPage": "Sau",
  "exams.pageOf": "Trang {page} / {pageCount}",
  "exams.totalCount": "{total} đề",

  // --- Làm bài ------------------------------------------------------------
  "player.backToExams": "Về danh sách đề",
  "player.timeRemaining": "Thời gian còn lại",
  "player.lastMinute": "Phút cuối",
  "player.minutesRemaining": "Còn {count} phút",
  "player.oneMinuteRemaining": "Còn 1 phút",
  "player.secondsRemaining": "Còn {count} giây",
  "player.submit": "Nộp bài",
  "player.submitting": "Đang nộp…",
  "player.sharedPassage": "Bài đọc dùng chung cho nhóm câu này",
  "player.chooseAnswer": "Chọn một đáp án",
  "player.yourAnswer": "Câu trả lời của bạn",
  "player.answeredCount": "Đã làm {done}/{total}",
  "player.tfNotScored": "Đúng/Sai — đã lưu, chưa chấm tự động.",
  "player.shortAnswerScored": "Trả lời ngắn — chấm tự động sau khi bạn nộp bài.",
  "player.essayNotScored": "Tự luận — bài làm được lưu cùng lượt thi, chưa chấm tự động.",
  "player.essayScored": "Tự luận — chấm tự động sau khi bạn nộp bài.",
  "player.essayPlaceholder": "Trình bày bài làm của bạn ở đây…",
  "player.charsLeft": "Còn {remaining} ký tự",
  "player.leaveTitle": "Rời khỏi đề này?",
  "player.leaveBody":
    "Bài của bạn chưa được nộp. Nếu rời khỏi bây giờ, toàn bộ tiến trình của lượt làm bài này sẽ mất.",
  "player.leave": "Rời khỏi",
  "player.flag": "Đánh dấu",
  "player.flagged": "Đã đánh dấu",
  "player.flagHint": "Đánh dấu câu này để xem lại",
  "player.unflagHint": "Bỏ đánh dấu câu này",
  "player.answeredStatus": "đã làm",
  "player.questionOf": "Câu {number} trên {total}",
  "player.prevQuestion": "Câu trước",
  "player.nextQuestion": "Câu sau",

  // --- Kết quả ------------------------------------------------------------
  "result.title": "Kết quả",
  "result.scorePending": "Đang chấm phần tự luận…",
  "result.time": "Thời gian",
  "result.submittedAfterTime": "Nộp sau giờ.",
  "result.overtimeBody":
    "Lượt làm này trễ {time} so với thời gian cho phép, nên điểm không được tính là kết quả hợp lệ theo thời gian.",
  "result.storedAnswerLabel": "Đáp án đã lưu:",
  "result.skippedLabel": "Bỏ trống",
  "result.outOfTen": "trên 10",
  "result.nextTitle": "Tiếp theo",
  "result.nextBody": "Xem lại từng câu để biết bạn sai ở đâu, rồi làm lại đề khi đã chắc hơn.",
  "result.reviewEach": "Xem từng câu",
  "result.retake": "Làm lại đề",
  "result.backToExams": "Về kho đề",
  "result.backToResult": "Về trang kết quả",
  "result.attemptDetails": "Chi tiết lượt làm bài",
  "result.notAutoScored": "Chưa chấm tự động",
  "result.correctAnswer": "Đáp án đúng",
  "result.yourChoice": "Bạn chọn",
  "result.editRating": "Sửa điểm chấm của bạn",
  "result.rateThisExam": "Đánh giá đề này",

  // --- Chấm tự luận (ADR-0018) — 28 khoá mới ------------------------------
  // Mọi chuỗi ở đây là HẰNG DO ỨNG DỤNG SỞ HỮU. KHÔNG chuỗi nào do model sinh
  // ra, và không có chỗ nào cho một chuỗi như thế: `EssayView` không mang
  // trường văn xuôi nào (AC-044/AC-047).
  //
  // BA CHUỖI CỐ Ý KHÔNG TỒN TẠI, ghi ra để không ai tưởng là sót:
  //   1. Không câu nào nói số lượt chấm lại CÒN LẠI (UI-D9) — con số đó tụt vì
  //      những lý do học sinh không gây ra, nên hiển thị nó là hứa sai.
  //   2. Không câu riêng cho "kẹt pending" (UI-D6) — nó dùng `failedBody`.
  //   3. Không câu nào giải thích VÌ SAO band là band đó — một đầu ra thứ hai
  //      do model viết là một bề mặt tiêm chích thứ hai (R9).
  "result.essay.label": "Tự luận",
  "result.essay.state.pending": "Đang chấm",
  "result.essay.state.graded": "Đã chấm",
  "result.essay.state.failed": "Chấm thất bại",
  "result.essay.band": "{band} / 1 điểm",
  "result.essay.lowConfidence": "Cần xem lại",
  "result.essay.lowConfidenceHelp":
    "Máy chấm không chắc chắn ở câu này. Bạn nên đối chiếu với đáp án mẫu.",
  "result.essay.pendingBody": "Bài làm của bạn đang được chấm. Điểm sẽ hiện ngay tại đây.",
  "result.essay.failedBody": "Lượt chấm tự động cho câu này không hoàn tất.",
  "result.essay.attemptsNote":
    "Mỗi câu chỉ được chấm lại một số lần; một lượt bị gián đoạn giữa chừng vẫn tính là đã dùng.",
  "result.essay.retry": "Chấm lại",
  "result.essay.retryBusy": "Đang chấm lại…",
  "result.essay.retryBusyReason": "Đang gửi yêu cầu chấm lại, vui lòng đợi.",
  "result.essay.retryExhausted": "Câu này đã dùng hết lượt chấm. Hệ thống sẽ không tự chấm lại.",
  "result.essay.retryBudgetOut":
    "Hôm nay hệ thống đã dùng hết lượt chấm tự động. Bạn thử lại vào ngày mai.",
  "result.essay.retryAlreadyGraded": "Câu này đã có điểm rồi.",
  "result.essay.pdfBlocked": "Đang chấm tự luận. Lưu và xuất PDF sẽ mở lại khi chấm xong.",
  "result.essay.pdfIncomplete":
    "Đề này có câu tự luận không được chấm tự động. Điểm trong tệp chưa bao gồm phần tự luận.",
  "result.essay.pollStopped": "Trang đã ngừng tự cập nhật.",
  "result.essay.pollRefresh": "Cập nhật",
  "result.essay.announceProgress": "Đã chấm xong {done} câu tự luận. Còn {pending} câu đang chấm.",
  "result.essay.announceAllDone": "Đã chấm xong toàn bộ câu tự luận.",

  // --- Chấm độ khó --------------------------------------------------------
  "rating.rate": "Đánh giá",
  "rating.overall": "Tổng thể",
  "rating.rateAllParts": "Chấm đủ cả ba phần mới gửi được.",
  "rating.needAttemptTitle": "Bạn cần làm xong đề này trước",
  "rating.needAttemptBody": "Hoàn thành một lượt làm bài trên đề này rồi mới chấm được độ khó.",
  "rating.title": "Chấm độ khó",

  // --- Báo cáo đề ---------------------------------------------------------
  "report.title": "Báo cáo",
  "report.intro":
    "Cho chúng tôi biết đề này có vấn đề gì (đáp án sai, nội dung không phù hợp, v.v.).",
  "report.placeholder": "Mô tả vấn đề…",
  "report.submit": "Gửi báo cáo",
  "report.submitting": "Đang gửi…",
  "report.reported": "Bạn đã báo cáo đề này.",
  "report.errorEmpty": "Bạn hãy mô tả vấn đề trước khi gửi.",
  "report.errorGeneric": "Chưa gửi được báo cáo. Bạn thử lại sau nhé.",
  // ReportDialog (task 36/37) — tiêu đề riêng theo `variant`, thay cho
  // `report.title` chung của ReportExam.
  "report.solutionTitle": "Báo cáo bài giải",
  "report.commentTitle": "Báo cáo bình luận",

  // --- Ô tìm đề trên header (ADR-0020) ------------------------------------
  "search.label": "Tìm đề",
  "search.placeholder": "Tìm đề theo tên",
  "search.open": "Mở ô tìm đề",
  "search.close": "Đóng ô tìm đề",
  "search.clear": "Xoá từ khoá",
  "search.hint": "Gõ ít nhất 2 ký tự để tìm.",
  "search.loading": "Đang tìm…",
  "search.error": "Chưa tìm được lúc này. Nhấn Enter để mở kho đề.",
  "search.noResults": "Không tìm thấy đề nào cho “{query}”.",
  "search.viewAll": "Xem tất cả kết quả cho “{query}”",
  "search.resultsAnnouncement": "{count} gợi ý. Dùng phím mũi tên để chọn, Enter để mở.",
  "search.hitMeta": "{subject}, lớp {grade}",

  // --- Lịch sử ------------------------------------------------------------
  "history.title": "Lịch sử",
  "history.subtitle": "Các lượt làm bài bạn đã nộp, mới nhất xếp trước.",
  "history.pagination": "Các trang lịch sử",
  "history.totalCount": "{total} lượt làm",
  "history.noMatches": "Không có kết quả khớp",
  "history.noMatchesHint": "Thử chỉnh lại hoặc xoá bộ lọc.",
  "history.noResults": "Chưa có kết quả nào",
  "history.noResultsHint": "Làm xong một đề để thấy nó ở đây.",
  "history.loadError": "Chưa tải được lịch sử của bạn lúc này.",
  "history.pdfError": "Không tạo được file PDF. Thử lại nhé.",
  "history.downloadedNoShare": "Đã tải về — trình duyệt này không hỗ trợ chia sẻ.",
  "history.min": "Nhỏ nhất",
  "history.max": "Lớn nhất",
  "history.generatingPdf": "Đang tạo file PDF, bạn chờ một chút",

  // --- Phân tích ----------------------------------------------------------
  "analytics.title": "Thống kê",
  "analytics.subtitle": "Theo dõi kết quả theo môn và tần suất luyện tập.",
  "analytics.noData": "Chưa có dữ liệu",
  "analytics.noDataHint": "Hoàn thành một lượt làm bài đã nộp trong khoảng này để xem thống kê.",
  "analytics.timeRangeFilter": "Lọc theo khoảng thời gian",
  // 2026-09-13: thẻ gộp hai cách đọc — đúng/sai cho môn chấm tự động, điểm
  // trung bình cho Ngữ văn/Tiếng Anh — nên tên thẻ không còn nói "đúng và sai".
  "analytics.barTitle": "Kết quả theo môn",
  "analytics.needsReview": "Cần ôn lại",
  "analytics.essayBadge": "Tự luận",
  "analytics.gradingBadge": "Đang chấm",
  "analytics.outOfTen": "/ 10",
  "analytics.avgNote": "Điểm trung bình các lượt đã chấm",
  "analytics.blankEssays": "{count} câu tự luận bỏ trống tính 0 điểm",
  "analytics.mcqCorrect": "{correct}/{total} câu trắc nghiệm đúng",
  "analytics.gradingNote": "Chưa có điểm — còn lượt đang chấm tự luận",
  "analytics.donutTitle": "Thời gian luyện theo môn",
  "analytics.donutAlt": "Thời gian làm bài theo từng môn",
  "analytics.timeTotal": "tổng",
  "analytics.rangeWeek": "Tuần",
  "analytics.rangeMonth": "Tháng",
  "analytics.rangeAll": "Toàn thời gian",
  "analytics.donutSubtitle":
    "Cộng dồn thời gian làm các lượt đã nộp, mỗi lượt tối đa bằng thời lượng đề.",
  // SkillRecommendationCard (Engine 1) — đặt cùng vị trí tương đối với en.ts.
  "analytics.recommendTitle": "Nên luyện gì tiếp theo",
  "analytics.recommendColdStart":
    "Chưa đủ dữ liệu — bạn luyện một đề Toán để nhận gợi ý đầu tiên nhé.",
  "analytics.recommendWhy": "Vì sao là kỹ năng này?",
  "analytics.recommendAction": "Tìm đề Toán",
  "analytics.recommendReasonPrerequisiteGate":
    "Có một kỹ năng nền bạn chưa nắm vững đứng trước kỹ năng này.",
  "analytics.recommendReasonLowestMastery": "Đây là kỹ năng bạn đang yếu nhất lúc này.",
  "analytics.recommendReasonRecentlyWrong": "Bạn vừa làm sai kỹ năng này gần đây.",

  // WeakTopicsCard — từ 2026-09-16 "chủ đề" là DẠNG BÀI (cây kỹ năng 7 môn),
  // không còn là `topic_breakdown` (cột ấy chỉ chứa tên môn, ADR-0004).
  "analytics.weakTopicsTitle": "Cần sửa chỗ nào",
  "analytics.weakTopicsHint": "Những dạng bài bạn làm đúng ít nhất trong khoảng này.",
  "analytics.weakTopicsEmpty": "Chưa có chỗ nào nổi lên rõ rệt.",
  "analytics.weakTopicsEmptyHint":
    "Bạn làm thêm vài đề nữa nhé — một dạng bài cần ít nhất {min} câu đã làm mới xuất hiện ở đây.",
  "analytics.weakTopicCorrect": "Đúng {correct}/{total}",

  // SkillBreakdownCard — bảng kê đủ mọi dạng bài đã làm, theo môn (2026-09-16).
  "analytics.skillBreakdownTitle": "Kết quả theo dạng bài",
  "analytics.skillBreakdownHint":
    "Tỉ lệ đúng của từng dạng bài bạn đã làm trong khoảng này, theo môn — dạng yếu nhất lên đầu. Câu chưa xếp được vào dạng bài nào gom ở dòng “Chưa phân loại”.",
  "analytics.skillBreakdownEmpty":
    "Các lượt trong khoảng này chỉ có câu tự luận — chưa có dạng bài nào để tính tỉ lệ đúng.",
  "analytics.skillUntagged": "Chưa phân loại",

  // --- Tải đề lên (UGC) ---------------------------------------------------
  "upload.title": "Tải đề lên",
  "upload.intro": "Ba chặng: đề thi, đáp án, thông tin đề. Bạn soát lại mọi thứ trước khi xuất bản.",
  // Ba chặng (2026-09-13, hướng A "Ba chặng" engineer chọn từ prototype).
  "upload.stepLabel": "{title}",
  "upload.stepExam": "Đề thi",
  "upload.stepAnswers": "Đáp án",
  "upload.stepDetails": "Thông tin đề",
  "upload.stepRequired": "bắt buộc",
  "upload.stepDone": "đã có",
  "upload.stepStateDone": "đã xong",
  "upload.stepStateCurrent": "đang làm",
  "upload.answerInExam": "Nằm trong file đề",
  "upload.answerSeparate": "File riêng",
  "upload.answerInExamNote":
    "Hệ thống tìm phần đáp án ở cuối file đề. Không thấy thì bạn thêm đáp án ở bước soát đề — AI không bao giờ tự đoán.",
  "upload.answerSeparateNote": "Đáp án luôn lấy từ file đáp án của bạn — AI không bao giờ tự đoán.",
  "upload.answerSourceHint":
    "Đáp án nằm trong file đề hay ở file riêng — bạn chọn ở chặng 2. AI không bao giờ tự đoán đáp án.",
  "upload.dragDropAnswer": "Kéo thả file đáp án vào đây, hoặc nhấp để chọn",
  "upload.leaveEmptyHint":
    "Cứ để trống — chúng tôi sẽ đọc từ file của bạn. Bạn sửa lại được mọi thứ trước khi xuất bản. Nội dung bạn tự gõ ở đây sẽ được ưu tiên hơn AI.",
  "upload.entryMode": "Chế độ nhập",
  // Chặng 3 (2026-09-13): tên nói rõ việc — "Tự đọc từ file" / "Tự nhập" thay
  // "Tự động" / "Thủ công", vốn không nói tự động CÁI GÌ.
  "upload.automatic": "Tự đọc từ file",
  "upload.manual": "Tự nhập",
  "upload.instructionsTitle": "Hướng dẫn tải lên",
  "upload.supportedFormats": "Định dạng hỗ trợ: PNG, JPEG, WebP hoặc PDF.",
  "upload.choose": "Chọn",
  "upload.automaticHint": "để AI quét và bóc tách đề — không phải nhập tay.",
  "upload.manualHint": "để tự điền thông tin đề.",
  "upload.fromYourFile": "lấy từ file của bạn",
  "upload.schoolYear": "Năm học",
  "upload.minutes": "phút",
  "upload.myExams": "Đề của tôi",
  "upload.myExamsHint": "Kiểm tra lại đề trước khi cho hiển thị công khai.",
  "upload.uploadAnExam": "Tải một đề lên",
  "upload.noneUploaded": "Bạn chưa tải đề nào lên.",
  "upload.nothingPending": "Không còn gì chờ duyệt — gọn gàng.",
  "upload.nonePublished": "Chưa xuất bản đề nào.",
  "upload.deleteTitle": "Xoá đề này?",
  "upload.rightClickHint": "Nhấp chuột phải để mở menu thao tác",
  "upload.publishedNotice":
    "Đề này đã xuất bản. Mọi chỉnh sửa lưu trực tiếp và luôn giữ đề đầy đủ.",
  "upload.sharedPassage": "Bài đọc dùng chung",
  "upload.sharedPassages": "Bài đọc dùng chung",
  "upload.sharedPassagesHint":
    "Mỗi bài đọc chỉ lưu một lần và hiện ở mọi câu dùng nó. Sửa ở đây là sửa cho tất cả các câu đó.",
  "upload.passageLabel": "Ngữ liệu {index}",
  "upload.pointsLabel": "Điểm của câu này",
  "upload.pointsSuffix": "điểm",
  "upload.pointsValue": "{points} điểm",
  // Tiêu đề phần sửa được (2026-09-03).
  "upload.partTitleLabel": "Tiêu đề phần {part} như in trên đề gốc",
  // Panel gán điểm hàng loạt (2026-09-03).
  "upload.pointsPanelTitle": "Biểu điểm",
  "upload.pointsPanelTotal": "{total}/{expected}",
  "upload.pointsPanelPartLabel": "Phần cần gán điểm",
  "upload.pointsPanelUseRange": "Chọn dãy câu",
  "upload.pointsPanelUseWholePart": "Cả phần",
  "upload.pointsPanelFromLabel": "Từ câu",
  "upload.pointsPanelToLabel": "Đến câu",
  "upload.pointsPanelRangeTo": "đến",
  "upload.pointsPanelScopeSummary": "{count} câu (câu {first}–{last})",
  "upload.pointsPanelNoQuestions": "Không có câu nào trong phạm vi này.",
  "upload.pointsPanelTotalLabel": "Tổng điểm cho phạm vi đã chọn",
  "upload.pointsPanelTotalPlaceholder": "vd 3",
  "upload.pointsPanelApply": "Chia điểm",
  "upload.pointsPanelInvalidTotal": "Nhập tổng điểm lớn hơn 0.",
  "upload.pointsPanelEmptyScope": "Chọn phần hoặc dãy câu có ít nhất một câu.",
  "upload.pointsPanelCannotSplit":
    "Tổng điểm quá nhỏ để chia cho {count} câu — mỗi câu phải được hơn 0 điểm.",
  "upload.examDetails": "Thông tin đề",
  "upload.fixedAfterPublish": "Môn và khối lớp không đổi được sau khi xuất bản.",
  "upload.removeImage": "Bỏ ảnh",
  "upload.notSet": "chưa đặt",
  "upload.storedNotScored": "Đã lưu, chưa chấm tự động.",
  "upload.expectedAnswer": "Đáp án mong đợi — lấy từ file đáp án của bạn",
  "upload.shortAnswerStored": "Trả lời ngắn — đã lưu, chưa chấm tự động.",
  "upload.modelAnswer": "Đáp án mẫu",
  "upload.essayStored": "Tự luận — đã lưu, chưa chấm tự động.",
  "upload.essayScored": "Tự luận — chấm tự động sau khi học sinh nộp bài.",
  "upload.questionText": "Nội dung câu hỏi",
  "upload.deleting": "Đang xoá…",
  "upload.dragDrop": "Kéo thả vào đây, hoặc nhấp để chọn file",
  "upload.fromFile": "Lấy từ file",
  "upload.selectSubject": "Chọn môn",
  "upload.saveChanges": "Lưu thay đổi",
  "upload.publish": "Xuất bản",
  "upload.publishing": "Đang xuất bản…",
  "upload.untitledExam": "Đề chưa đặt tên",
  "upload.start": "Bắt đầu",

  // --- Kiểm duyệt ---------------------------------------------------------
  "admin.title": "Nội dung bị báo cáo",
  "admin.reportedReasons": "Lý do báo cáo",
  "admin.notConfigured": "Chưa cấu hình ADMIN_USER_IDS — không ai thao tác được ở đây.",
  "admin.nothingReported": "Không có báo cáo nào.",
  "admin.reasonForRemoval": "Lý do gỡ bỏ (không bắt buộc)",
  "admin.reasonForRestoring": "Lý do khôi phục (không bắt buộc)",

  // --- Trang lỗi ----------------------------------------------------------
  "result.yourAnswerLabel": "Bạn trả lời:",
  "result.correctAnswerLabel": "Đáp án đúng:",
  "result.skipped": "— bỏ trống —",
  "report.submitError": "Chưa gửi được báo cáo lúc này. Bạn thử lại nhé.",
  "auth.resetPasswordIntro": "Hãy nhập mật khẩu mới cho tài khoản này.",
  "auth.recoveryLocked":
    "Bạn chỉ vào được các trang khác sau khi đặt mật khẩu mới.",
  "auth.notYourAccount": "Không phải tài khoản của bạn?",
  "auth.newPassword": "Mật khẩu mới",
  "auth.confirmNewPassword": "Nhập lại mật khẩu mới",

  "error.somethingBroke": "Có gì đó hỏng rồi",
  "error.couldntLoad": "Chúng tôi không tải được trang này",
  "error.couldntLoadBody":
    "Lỗi nằm ở phía chúng tôi, không phải ở bạn. Thử lại thường là được — nếu vẫn không, bạn quay lại sau ít phút nhé.",
  "error.couldntStart": "MS-MOLAR không khởi động được",
  "error.couldntStartBody":
    "Tải lại trang thường là hết. Nếu vẫn lặp lại, bạn thử lại sau ít phút nhé.",
  "error.reload": "Tải lại",
  "error.notFound": "Trang này không tồn tại",
  "error.notFoundBody": "Liên kết có thể đã hỏng, hoặc đề đã bị tác giả gỡ xuống hay xoá đi.",
  "error.reference": "Mã tham chiếu:",

  // --- Ảnh preview khi chia sẻ link (app/opengraph-image.tsx) -------------
  // Tách sẵn thành hai dòng: Satori không tự ngắt dòng theo ý muốn, nên chỗ
  // xuống dòng phải do câu chữ quyết định chứ không do bề rộng ảnh.
  "meta.ogAlt": "MS-MOLAR — luyện đề trực tuyến",
  "meta.ogTaglineLine1": "Luyện đề thật, có đồng hồ bấm giờ.",
  "meta.ogTaglineLine2": "Chấm điểm tức thì, biết ngay mình yếu chỗ nào.",

  // --- Dùng chung (bổ sung) -----------------------------------------------
  "common.all": "Tất cả",
  "common.subject": "Môn học",
  "common.grade": "Lớp",
  "common.share": "Xuất PDF",
  "common.active": "đang bật",

  // --- Bộ lọc & độ khó ----------------------------------------------------
  "exams.sortNewest": "Mới nhất",
  "exams.sortOldest": "Cũ nhất",
  "exams.sortHardest": "Khó nhất",
  "exams.sortHot": "Nổi nhất",
  "exams.levelEasy": "Dễ",
  "exams.levelMedium": "Trung bình",
  "exams.levelHard": "Khó",
  "exams.gradeValue": "Lớp {grade}",
  "rating.finishExamFirst": "Bạn làm xong đề này đã nhé",
  "rating.logInToRate": "Đăng nhập để chấm",
  "rating.partOf": "{part}/{total}",
  "rating.rateFromTo": "{name} — chấm từ 1 sao (dễ nhất) tới 5 sao (khó nhất)",
  "rating.prev": "Trước",
  "rating.submitRating": "Gửi",
  "rating.submitted": "Đã gửi đánh giá",
  "rating.unrated": "CHƯA CHẤM",
  "rating.rated": "ĐÃ CHẤM",
  "rating.partiallyRated": "ĐÃ CHẤM {rated}/{total}",
  "rating.mcqEyebrow": "PHẦN I · TRẮC NGHIỆM",
  "rating.mcqName": "Trắc nghiệm",
  "rating.mcqDescription": "Bốn lựa chọn, một đáp án đúng — kiểm tra ghi nhớ và hiểu cơ bản.",
  "rating.tfEyebrow": "PHẦN II · ĐÚNG / SAI",
  "rating.tfName": "Đúng / Sai",
  "rating.tfDescription": "Đánh dấu đúng/sai từng ý nhỏ. Sai một ý là mất điểm cả câu.",
  "rating.saEyebrow": "PHẦN III · TRẢ LỜI NGẮN",
  "rating.saName": "Trả lời ngắn",
  "rating.saDescription": "Không có lựa chọn — tự giải và nhập một đáp số duy nhất.",
  "rating.errIneligible": "Bạn cần làm xong đề này trước khi chấm độ khó.",
  "rating.errInvalid": "Bạn chấm đủ cả ba phần, mỗi phần từ 1 đến 5 sao nhé.",
  "rating.errRateLimited": "Bạn đang chấm quá nhanh. Đợi một chút rồi thử lại nhé.",
  "rating.errServer": "Chưa lưu được đánh giá lúc này. Bạn thử lại nhé.",

  // --- Lịch sử (bổ sung) --------------------------------------------------
  "history.sharing": "Đang xuất PDF…",
  "history.moreActionsFor": "Thao tác khác cho {title}",
  // Nhãn PDF viết thường (2026-09-13): mẫu PDF theo theme "Sân trường" dùng
  // eyebrow không in hoa — nhãn in hoa khó đọc với dấu tiếng Việt (§5).
  "history.pdfResultTitle": "Kết quả bài thi",
  "history.pdfScoreLabel": "Điểm số",
  "history.pdfExamineeLabel": "Người thi",
  "history.pdfSubmittedLabel": "Thời gian nộp bài",
  "history.pdfCorrectLabel": "Câu đúng",
  "history.pdfWrongLabel": "Câu sai",
  "history.pdfTotalQuestions": "Tổng cộng {total} câu",
  "history.exam": "Đề thi",
  "history.score": "Điểm",
  "history.submitted": "Ngày nộp",
  "history.minimumScore": "Điểm thấp nhất",
  "history.maximumScore": "Điểm cao nhất",
  "history.submittedFrom": "Nộp từ ngày",
  "history.submittedTo": "Nộp đến ngày",

  // --- Trạng thái đề UGC --------------------------------------------------
  "status.processing": "Đang xử lý",
  "status.needsReview": "Cần rà soát",
  "status.draft": "Bản nháp",
  "status.published": "Đã đăng",
  "status.needsFixing": "Cần sửa",
  "status.needsFixingCount": "{count} câu cần sửa",
  "status.removed": "Đã gỡ",

  // --- Kiểm duyệt (bổ sung) -----------------------------------------------
  "admin.intro":
    "Đang đăng nhập bằng {email}. Gỡ một đề sẽ rút nó khỏi kho ngay lập tức và chặn lượt làm bài mới; tác giả không tự hoàn tác được.",
  "admin.awaitingReview": "Chờ xử lý",
  "admin.removed": "Đã gỡ",
  "admin.author": "Tác giả: {name}",
  "admin.removeExam": "Gỡ khỏi kho",
  "admin.oneReport": "1 báo cáo",
  "admin.reportCount": "{count} báo cáo",
  "admin.statusLabel": "trạng thái:",
  "admin.errMissingExamId": "Thiếu mã đề.",
  "admin.errUnknownAction": "Thao tác kiểm duyệt không hợp lệ.",
  "admin.errNotAllowed": "Không được phép.",
  "admin.errCouldNotApply": "Chưa áp dụng được thay đổi. Bạn thử lại nhé.",
  "admin.examRemoved": "Đã gỡ đề khỏi kho.",
  "admin.examRestored": "Đã khôi phục đề về dạng nháp.",

  // --- Kiểm duyệt: Bài giải cộng đồng (UI Spec C-37–C-39) ----------------------
  "admin.solutions.title": "Bài giải bị báo cáo",
  "admin.solutions.hiddenPart": "Đã ẩn",
  "admin.solutions.author": "Người viết",
  "admin.solutions.anonymousNote": "ẩn danh với người đọc",
  "admin.solutions.notes": "Ghi chú của bài giải",
  "admin.solutions.hideAction": "Ẩn bài giải",
  "admin.solutions.deleteAction": "Xoá hẳn",
  "admin.solutions.reasonRequired": "Lý do (bắt buộc)",
  "admin.solutions.reasonOptional": "Lý do khôi phục (không bắt buộc)",
  "admin.solutions.reasonMissing": "Bạn hãy nhập lý do.",
  "admin.solutions.deleteTitle": "Xoá hẳn bài giải?",
  "admin.solutions.deleteBody":
    "Bài giải, mọi ghi chú và mọi bình luận dưới bài (của mọi người) sẽ mất, không khôi phục được.",
  "admin.solutions.actionError": "Thao tác chưa thành công. Bạn thử lại nhé.",
  "admin.comments.hideAction": "Ẩn bình luận",
  "admin.comments.hiddenGroup": "Bình luận đã ẩn",
  "admin.comments.deleteTitle": "Xoá hẳn bình luận?",
  "admin.comments.deleteBody": "Bình luận này sẽ mất, không khôi phục được.",

  // --- Tải đề lên (bổ sung) -----------------------------------------------
  "upload.fieldTitle": "Tiêu đề",
  "upload.fieldSubject": "Môn học",
  "upload.fieldGrade": "Lớp",
  "upload.examDuration": "Thời lượng làm bài",
  "upload.examPaper": "File đề",
  "upload.answerKey": "File đáp án",
  "upload.fileHint": "PNG, JPEG, WebP hoặc PDF, tối đa {mb} MB, PDF tối đa {pages} trang",
  "upload.maxFileSize": "Dung lượng tối đa {mb} MB mỗi file, PDF tối đa {pages} trang.",
  "upload.filledAutomatically": "hệ thống tự điền",
  "upload.automaticNote":
    "AI sẽ quét file bạn tải lên và tự trích xuất đề — bạn vẫn sửa được mọi trường.",
  "upload.manualNote": "Bạn tự nhập toàn bộ thông tin đề; AI vẫn trích xuất câu hỏi và đáp án.",
  "upload.extractingWithMeta": "Đang đọc thông tin đề, câu hỏi và đáp án… việc này mất một lát.",
  "upload.extractingFiles": "Đang đọc file và dựng đề… việc này mất một lát.",
  "upload.reviewBeforePublish": "Bạn sẽ được rà soát lại toàn bộ trước khi đăng.",
  "upload.errTitleRequired": "Bạn nhập tiêu đề đề thi nhé.",
  "upload.errSubjectRequired": "Bạn chọn môn học nhé.",
  "upload.errGradeRange": "Bạn nhập lớp trong khoảng {min} đến {max} nhé.",
  "upload.errDurationRequired": "Bạn nhập thời lượng làm bài nhé.",
  "upload.errQuestionFileRequired": "Bạn đính kèm file đề nhé.",
  "upload.errAnswerFileRequired": "Bạn đính kèm file đáp án nhé.",
  "upload.questionLabel": "Câu {number}",
  "upload.partQuestionLabel": "Phần {part} Câu {number}",
  "upload.partLabel": "Phần {part}",
  "upload.oneQuestion": "1 câu hỏi",
  "upload.questionCount": "{count} câu hỏi",
  "upload.typeMcq": "Trắc nghiệm",
  "upload.typeEssay": "Tự luận",
  "upload.typeTrueFalse": "Đúng/Sai",
  "upload.typeShortAnswer": "Trả lời ngắn",
  "upload.emptyPlaceholder": "— trống —",
  "upload.markChoiceCorrect": "Đánh dấu lựa chọn {choice} là đáp án đúng",
  "upload.choicePlaceholder": "Lựa chọn {choice}",
  "upload.correctAnswer": "Đáp án đúng",
  "upload.fromYourAnswerFile": "— lấy từ file đáp án của bạn",
  "upload.statementPlaceholder": "Ý {item})",
  "upload.answerForItem": "Đáp án cho ý {item})",
  "upload.tfPerStatement": "Đ/S cho từng ý — lấy từ file đáp án của bạn.",
  "upload.shortAnswerExample": "ví dụ: 1260 / 1,04",
  "upload.fixIssuesFirst": "Sửa hết lỗi rồi mới đăng được.",
  "upload.deleteBody":
    "“{title}” cùng toàn bộ câu hỏi và file của nó sẽ bị xoá vĩnh viễn. Việc này không hoàn tác được.",
  "upload.publishedBanner": "Đề của bạn đã đăng và hiện có trong kho đề.",
  "upload.tabPending": "Chờ xử lý",
  "upload.tabPublished": "Đã đăng",
  "upload.actionEdit": "Chỉnh sửa",
  "upload.gradeShort": "Lớp {grade}",
  "upload.publishedAt": "Đã đăng {date}",
  "upload.createdAt": "Tạo {date}",
  "upload.optional": "không bắt buộc",
  "upload.deleteExam": "Xoá đề này",
  "upload.tabsLabel": "Lọc đề theo trạng thái",

  // --- Lỗi trích xuất đề (UgcError) ---------------------------------------
  "ugcError.oneIssueToFix": "Còn 1 lỗi phải sửa trước khi đăng:",
  "ugcError.issuesToFix": "Còn {count} lỗi phải sửa trước khi đăng:",
  "ugcError.noQuestionsFound":
    "Không nhận ra câu hỏi nào trong file đề. Bạn tải lên file rõ nét hơn nhé.",
  "ugcError.tooManyQuestions": "Quá nhiều câu — một đề chỉ được tối đa {max} câu.",
  "ugcError.wrongChoiceCount":
    "{q} — đọc được {count} lựa chọn; câu trắc nghiệm cần {min}–{max} lựa chọn, đánh nhãn từ A liền mạch. Bạn sửa bên dưới hoặc tải lại file.",
  "ugcError.emptyPassage":
    "Ngữ liệu {index} — phần bài đọc chung đang trống; bạn bổ sung bên dưới nhé.",
  "ugcError.passageTooLong": "Ngữ liệu {index} — phần bài đọc chung quá dài (tối đa {max} ký tự).",
  "ugcError.passageMissing":
    "{q} — câu này trỏ tới một bài đọc chung không có trong đề. Bạn tải lại file, hoặc gỡ liên kết bên dưới.",
  "ugcError.emptyStem": "{q} — phần đề bài đang trống; bạn bổ sung bên dưới nhé.",
  "ugcError.emptyChoice": "{q} — lựa chọn {choice} đang trống.",
  "ugcError.answerCountMismatch":
    "File đáp án có {answers} đáp án nhưng file đề có {questions} câu hỏi ({unmatched} câu không khớp).",
  "ugcError.answerMissing":
    "{q} — không tìm thấy đáp án trong file đáp án. Bạn thêm vào file hoặc đặt trực tiếp bên dưới.",
  "ugcError.imageCropFailed": "{q} — không cắt được hình. Bạn tải lại file hoặc gỡ hình đi nhé.",
  "ugcError.extractionFailed": "Chưa đọc được file của bạn lúc này. Bạn thử lại nhé.",
  "ugcError.fileTooLarge": "File này quá nặng (tối đa {mb} MB).",
  "ugcError.tooManyPages": "File này quá nhiều trang (tối đa {max}).",
  "ugcError.stemTooLong": "{q} — đề bài quá dài (tối đa {max} ký tự).",
  "ugcError.stemTooLongForSubject": "{q} — đề bài quá dài (tối đa {max} ký tự cho môn đã chọn).",
  "ugcError.choiceTooLong": "{q} — lựa chọn {choice} quá dài (tối đa {max} ký tự).",
  "ugcError.essayAnswerTooLong": "{q} — đáp án mẫu quá dài (tối đa {max} ký tự).",
  "ugcError.essayAnswerTooLongForSubject":
    "{q} — đáp án mẫu quá dài (tối đa {max} ký tự cho môn đã chọn).",
  "ugcError.wrongSubItemCount":
    "{q} — đọc được {count} ý; câu Đúng/Sai cần {min}–{max} ý (a–d). Bạn sửa bên dưới hoặc tải lại file.",
  "ugcError.shortAnswerTooLong": "{q} — đáp án mong đợi quá dài (tối đa {max} ký tự).",
  "ugcError.metaIncomplete": "Thông tin đề — thiếu {field}. Bạn bổ sung ở trên trước khi đăng nhé.",
  "ugcError.metaInvalid": "Thông tin đề — {field} nằm ngoài khoảng cho phép. Bạn sửa lại ở trên.",
  "ugcError.metaInvalidRange":
    "Thông tin đề — {field} nằm ngoài khoảng cho phép ({range}). Bạn sửa lại ở trên.",
  "ugcError.metaExtractionFailed":
    "Thông tin đề — chúng tôi không đọc được thông tin đề từ file của bạn. Bạn tự điền ở trên nhé.",
  "ugcError.pointsMissing":
    "{q} — chưa có điểm. Bạn nhập điểm cho câu này bên dưới trước khi đăng nhé.",
  "ugcError.pointsTotalMismatch":
    "Biểu điểm — tổng điểm các câu đang là {total}/{expected}. Bạn chỉnh lại cho đủ {expected} điểm nhé.",
  "ugcError.durationRange": "{min}–{max} phút",
  "ugcError.fieldTitle": "tiêu đề",
  "ugcError.fieldSubject": "môn học",
  "ugcError.fieldGrade": "lớp",
  "ugcError.fieldDuration": "thời lượng",
  "ugcError.fieldSchool": "trường",
  "ugcError.fieldSchoolYear": "năm học",
  "ugcError.fieldSemester": "học kỳ",
  "ugcError.fieldRequired": "một trường bắt buộc",
  "ugcError.fieldGeneric": "một trường",

  // User Support System v1 — sendSupportNotification subject only (NOT the
  // support.* widget block, that's a separate later addition). Deliberately
  // NOT prefixed "support." to avoid colliding with that block's key set.
  "mail.ticketIntent.bug": "báo lỗi",
  "mail.ticketIntent.suggestion": "góp ý",
  "mail.ticketIntent.question": "câu hỏi",

  // User Support System v1 — support.* widget block (student-facing only;
  // support.admin.* is a separate later addition, task-14's responsibility).
  // common.cancel/common.retry/common.working are REUSED, not duplicated here.
  "support.trigger.label": "Gửi phản hồi",
  "support.dialog.title": "Gửi phản hồi",
  "support.intent.groupLabel": "Loại phản hồi",
  "support.intent.bug": "Báo lỗi",
  "support.intent.suggestion": "Góp ý",
  "support.intent.question": "Câu hỏi",
  "support.validation.intentRequired": "Vui lòng chọn một loại phản hồi.",
  "support.message.label": "Nội dung",
  "support.message.placeholder": "Mô tả điều bạn muốn gửi…",
  "support.message.count": "{count}/{max}",
  "support.validation.messageRequired": "Vui lòng nhập nội dung.",
  "support.screenshot.label": "Đính kèm ảnh chụp màn hình (tuỳ chọn)",
  "support.screenshot.chooseFile": "Chọn ảnh",
  "support.screenshot.remove": "Xoá ảnh",
  "support.screenshot.uploading": "Đang tải ảnh lên…",
  "support.screenshot.tooLarge": "Ảnh vượt quá {maxMb}MB. Chọn ảnh nhỏ hơn nhé.",
  "support.screenshot.invalidType": "Chỉ nhận ảnh PNG, JPEG hoặc WebP.",
  "support.screenshot.rejected": "Ảnh không hợp lệ — bạn thử ảnh khác hoặc gửi không kèm ảnh.",
  "support.submit": "Gửi",
  "support.submitting": "Đang gửi…",
  "support.error.rateLimited": "Bạn gửi hơi nhanh — thử lại sau ít phút nhé.",
  "support.error.network": "Chưa gửi được — có thể do mạng. Bạn thử lại nhé.",
  "support.error.generic": "Chưa gửi được lúc này. Bạn thử lại nhé.",
  "support.ack.title": "Đã gửi!",
  "support.ack.message": "Cảm ơn bạn đã phản hồi. Chúng tôi sẽ xem sớm.",
  "support.ack.reference": "Mã tham chiếu: {ref}",
  "support.ack.close": "Đóng",

  // Hộp thư admin (/admin/tickets) — task-13/14.
  "support.admin.title": "Hộp thư hỗ trợ",
  "support.admin.empty": "Chưa có phản hồi nào.",
  "support.admin.notifyFailed": "Email báo chưa gửi được",
  "support.admin.screenshotAlt": "Ảnh chụp màn hình học sinh gửi kèm",
  "support.admin.notesEmpty": "Chưa có ghi chú nội bộ.",
  "support.admin.notePlaceholder": "Ghi chú nội bộ (chỉ admin thấy)…",
  "support.admin.noteSubmit": "Lưu ghi chú",
  "support.admin.noteError": "Chưa lưu được ghi chú. Bạn thử lại nhé.",
  "support.admin.statusError": "Chưa đổi được trạng thái. Bạn thử lại nhé.",
  "support.admin.status.new": "Mới",
  "support.admin.status.inProgress": "Đang xử lý",
  "support.admin.status.resolved": "Đã xử lý",
  "support.admin.meta.page": "Trang",
  "support.admin.meta.userAgent": "Trình duyệt",
  "support.admin.meta.screen": "Màn hình",
  "support.admin.intro": "Phản hồi học sinh gửi từ nút hỗ trợ, mới nhất xếp trước.",
  "support.admin.hasScreenshot": "Kèm ảnh",
  "support.admin.statusLabel": "Trạng thái",
  "support.admin.notesTitle": "Ghi chú nội bộ",
  "support.admin.noteLabel": "Thêm ghi chú",

  // --- Gia sư AI (Giải thích bước này) — Engine 1 Adaptive AI ---
  // Đặt cùng vị trí tương đối với en.ts để hai file dễ so nhau; `Dictionary`
  // chỉ ràng buộc ĐỦ KHOÁ chứ không ràng buộc thứ tự.
  // Nút gợi ý trong thẻ câu hỏi của màn làm bài (2026-09-13; trước là "Giải
  // thích bước này" ở trang chi tiết kết quả).
  "tutor.explainThisStep": "Gợi ý cho câu này",
  "tutor.busy": "Đang lấy gợi ý…",
  "tutor.error": "Chưa lấy được gợi ý. Bạn thử lại nhé.",
  "tutor.hintEyebrow": "Gợi ý",
  // Tên của nút thu gọn bảng gợi ý (2026-09-15). Nút chỉ có mũi tên, không chữ
  // hiển thị, nên hai chuỗi này là tên DUY NHẤT trình đọc màn hình đọc được.
  "tutor.hideHint": "Ẩn gợi ý",
  "tutor.showHint": "Hiện gợi ý",

  // --- Gói Premium kỳ trả trước (payOS) — UI Spec S-01..S-04 ----------------
  // Ngữ điệu theo đúng bộ chuỗi sẵn có: xưng "bạn", câu ngắn, em-dash để ngắt
  // hai vế, kết bằng "nhé" khi nhờ người dùng làm gì, không dấu chấm than.
  // Tuyệt đối không nói "tự động gia hạn" — xem chú thích ở en.ts.
  "billing.pricing.eyebrow": "Gói",
  "billing.pricing.title": "Chọn gói của bạn",
  "billing.pricing.description":
    "Làm đề, nộp bài, xem kết quả, lịch sử và phân tích Layer 3 vẫn miễn phí cho mọi tài khoản. Gói chỉ đổi số lượt gia sư AI và số lượt tải đề lên.",
  "billing.plan.free.name": "Miễn phí",
  "billing.plan.free.price": "0 đồng",
  "billing.plan.free.period": "mãi mãi",
  "billing.plan.free.line1": "5 lượt gia sư mỗi 30 ngày",
  "billing.plan.free.line2": "3 lượt tải đề mỗi 30 ngày",
  "billing.plan.free.line3": "Toàn bộ vòng lặp cốt lõi, không giới hạn",
  "billing.plan.free.line4": "Có sẵn phân tích Layer 3",
  "billing.plan.premium.name": "Premium",
  "billing.plan.premium.price": "39.000 VNĐ",
  "billing.plan.premium.period": "cho mỗi kỳ 30 ngày, trả trước",
  "billing.plan.premium.line1": "500 lượt gia sư mỗi 30 ngày",
  "billing.plan.premium.line2": "15 lượt tải đề mỗi 30 ngày",
  "billing.plan.premium.line3": "Một suất được bảo lưu trong ngân sách AI mỗi ngày",
  "billing.plan.premium.line4": "Mua sớm thì số ngày còn lại được cộng dồn",
  "billing.plan.current": "Gói bạn đang dùng",
  "billing.cta.buy": "Mua Premium",
  "billing.cta.unavailableReason":
    "Premium chưa mở bán — chúng tôi không bán một hạn mức chưa giao được. Bạn quay lại sau nhé.",
  "billing.noAutoRenew":
    "Gói này không tự động gia hạn. Hết 30 ngày là dừng, không trừ tiền, không lưu thẻ — muốn dùng tiếp thì bạn tự mua lại.",
  "billing.legal.terms": "Điều khoản dịch vụ",
  "billing.legal.refund": "Chính sách hoàn tiền",
  "billing.legal.linkIntro": "Trước khi mua, bạn đọc giúp:",
  "billing.terms.title": "Điều khoản dịch vụ",
  "billing.terms.eyebrow": "Pháp lý",
  "billing.terms.pending":
    "Nội dung đang được hoàn thiện, chưa sẵn sàng. Chưa có gì được bán ra cho tới khi xong.",
  "billing.refund.title": "Chính sách hoàn tiền",
  "billing.refund.eyebrow": "Pháp lý",
  "billing.refund.pending":
    "Nội dung đang được hoàn thiện, chưa sẵn sàng. Chưa có gì được bán ra cho tới khi xong.",
  "billing.terms.body":
    'Cập nhật lần cuối: 21/08/2026\n\n## 1. Giới thiệu\n\nMS-MOLAR (sau đây gọi là "Dịch vụ", "chúng tôi") là nền tảng luyện thi trực tuyến dành cho học sinh trung học cơ sở (THCS) và trung học phổ thông (THPT) tại Việt Nam, cung cấp ngân hàng đề thi, chấm điểm tự động, Gia sư AI hỗ trợ giải thích, và các công cụ học tập liên quan.\n\nĐiều khoản Sử dụng này ("Điều khoản") áp dụng cho mọi cá nhân sử dụng Dịch vụ ("Người dùng", "bạn"). Bằng việc tạo tài khoản hoặc sử dụng Dịch vụ, bạn đồng ý với các Điều khoản này và với Chính sách Hoàn tiền — Gói Premium được dẫn chiếu tại Mục 6.\n\n## 2. Đối tượng sử dụng\n\nDịch vụ được thiết kế chủ yếu cho học sinh THCS và THPT, phần lớn là người chưa đủ 18 tuổi.\n\n- Nếu bạn dưới 16 tuổi (được xem là "trẻ em" theo Luật Trẻ em 2016), việc sử dụng Dịch vụ và việc chúng tôi xử lý dữ liệu cá nhân của bạn cần có sự đồng ý của cha, mẹ hoặc người giám hộ, theo Điều 20 Nghị định số 13/2023/NĐ-CP về bảo vệ dữ liệu cá nhân. Chúng tôi khuyến khích phụ huynh/người giám hộ tìm hiểu về Dịch vụ trước khi con em sử dụng, đặc biệt trước khi thanh toán gói Premium.\n- Nếu bạn từ 16 đến dưới 18 tuổi, bạn có thể tự mình sử dụng Dịch vụ trong phạm vi phù hợp với năng lực hành vi dân sự theo Bộ luật Dân sự 2015, nhưng các giao dịch ngoài phạm vi sinh hoạt hàng ngày nên có sự biết và đồng ý của cha, mẹ hoặc người giám hộ.\n\n## 3. Tài khoản người dùng\n\n- Bạn cần cung cấp thông tin chính xác khi đăng ký tài khoản (tên, lớp/khối, thông tin liên hệ).\n- Mỗi người dùng chỉ nên sử dụng một tài khoản; không chia sẻ, cho mượn, hoặc bán lại tài khoản cho người khác.\n- Bạn chịu trách nhiệm bảo mật thông tin đăng nhập của mình. Nếu nghi ngờ tài khoản bị truy cập trái phép, hãy liên hệ chúng tôi ngay qua mục Hỗ trợ.\n\n## 4. Nội dung và tính năng của Dịch vụ\n\n- Gói Free và gói Premium có phạm vi tính năng khác nhau, được mô tả chi tiết trong Chính sách Hoàn tiền (Mục 1).\n- Nội dung do Gia sư AI tạo ra (lời giải, giải thích) được tạo tự động và có thể chứa sai sót. Đây là công cụ hỗ trợ học tập, không thay thế vai trò của giáo viên, và không đảm bảo kết quả thi cụ thể nào.\n- Chúng tôi có thể điều chỉnh, bổ sung, hoặc ngừng cung cấp một số tính năng theo thời gian để cải thiện Dịch vụ.\n\n## 5. Quy tắc sử dụng\n\nKhi sử dụng Dịch vụ, bạn đồng ý KHÔNG:\n- Sử dụng Dịch vụ để gian lận trong các kỳ thi chính thức (ví dụ: mang thiết bị truy cập Dịch vụ vào phòng thi trái quy chế thi).\n- Spam, khai thác quá mức, hoặc dùng script/bot để lạm dụng lượt Gia sư AI hoặc lượt upload đề.\n- Sao chép, phân phối lại, hoặc bán nội dung/ngân hàng đề của MS-MOLAR mà không được phép.\n- Cố truy cập trái phép vào hệ thống, can thiệp mã nguồn, hoặc reverse-engineer Dịch vụ.\n- Đăng tải nội dung vi phạm pháp luật, xâm phạm quyền của người khác, hoặc không phù hợp với môi trường học đường.\n\nVi phạm các quy tắc trên có thể dẫn đến tạm khóa hoặc chấm dứt tài khoản mà không hoàn phần Premium chưa dùng, theo Mục 3 của Chính sách Hoàn tiền.\n\n## 6. Thanh toán và gói Premium\n\nViệc mua, gia hạn, và hoàn tiền gói Premium được quy định chi tiết tại Chính sách Hoàn tiền — Gói Premium (xem trang Chính sách Hoàn tiền), là một phần không tách rời của Điều khoản này.\n\n## 7. Sở hữu trí tuệ\n\n- Ngân hàng đề thi, lời giải, giao diện, và các nội dung khác do MS-MOLAR tạo ra thuộc quyền sở hữu của MS-MOLAR (hoặc bên cấp phép cho MS-MOLAR) và được bảo vệ theo pháp luật sở hữu trí tuệ.\n- Khi bạn tải lên đề thi hoặc nội dung khác ("Nội dung Người dùng"), bạn cấp cho MS-MOLAR quyền sử dụng, lưu trữ, và xử lý nội dung đó (ví dụ: để chấm điểm, tạo lời giải AI) trong phạm vi cần thiết để cung cấp Dịch vụ. Bạn cam kết có đủ quyền để tải lên nội dung đó.\n\n## 8. Bảo vệ dữ liệu cá nhân\n\nChúng tôi thu thập và xử lý một số dữ liệu cá nhân (thông tin tài khoản, lịch sử làm bài, dữ liệu thanh toán) để vận hành Dịch vụ, theo Nghị định số 13/2023/NĐ-CP về bảo vệ dữ liệu cá nhân (được củng cố bởi Luật Bảo vệ dữ liệu cá nhân số 91/2025/QH15). Với người dùng là trẻ em, việc xử lý dữ liệu tuân theo Mục 2 của Điều khoản này.\n\nChúng tôi không lưu trữ hoặc xử lý thông tin thẻ/tài khoản ngân hàng của bạn; thanh toán được thực hiện qua đối tác payOS như mô tả trong Chính sách Hoàn tiền.\n\n## 9. Giới hạn trách nhiệm\n\nTrong phạm vi pháp luật cho phép, MS-MOLAR không chịu trách nhiệm đối với:\n- Kết quả học tập hoặc kết quả thi cụ thể của người dùng.\n- Sai sót trong nội dung do Gia sư AI tạo ra, dù chúng tôi nỗ lực kiểm soát chất lượng.\n- Gián đoạn dịch vụ do sự cố kỹ thuật, bảo trì, hoặc nguyên nhân ngoài tầm kiểm soát hợp lý của chúng tôi.\n\n## 10. Chấm dứt và đình chỉ\n\nChúng tôi có quyền tạm khóa hoặc chấm dứt tài khoản vi phạm Điều khoản này. Bạn có thể ngừng sử dụng Dịch vụ và yêu cầu xóa tài khoản bất kỳ lúc nào qua mục Hỗ trợ.\n\n## 11. Thay đổi Điều khoản\n\nChúng tôi có thể cập nhật Điều khoản này theo thời gian. Các thay đổi quan trọng sẽ được thông báo trên trang này hoặc qua kênh liên hệ trong tài khoản của bạn.\n\n## 12. Luật áp dụng\n\nĐiều khoản này được điều chỉnh bởi pháp luật Việt Nam.\n\n## 13. Đơn vị cung cấp dịch vụ và liên hệ\n\nDịch vụ MS-MOLAR hiện được cung cấp bởi Nguyễn Anh Phát, với tư cách cá nhân kinh doanh trực tuyến dưới thương hiệu MS-MOLAR.\n\nMọi thắc mắc về Điều khoản này, vui lòng liên hệ qua mục Hỗ trợ trong tài khoản của bạn.',
  "billing.refund.body":
    "Cập nhật lần cuối: 21/08/2026\n\n## 1. Tổng quan gói Premium\n\nMS-MOLAR cung cấp hai gói:\n\n- Giá — Free: Miễn phí. Premium: 39.000 VNĐ / kỳ 30 ngày.\n- Gia sư AI — Free: 5 lượt/kỳ. Premium: 500 lượt/kỳ.\n- Upload đề — Free: 3 lượt/kỳ. Premium: 15 lượt/kỳ.\n- Làm đề, xem kết quả, lịch sử — Free: Miễn phí. Premium: Miễn phí.\n\nGói Premium là gói trả trước (prepaid) cho một kỳ 30 ngày, thanh toán qua payOS bằng chuyển khoản ngân hàng/VietQR (mô hình A2A — chuyển khoản trực tiếp giữa hai tài khoản ngân hàng).\n\n## 2. QUAN TRỌNG: Gói Premium KHÔNG tự động gia hạn\n\n> Đây là điều bạn cần biết rõ trước khi mua: MS-MOLAR không tự động trừ tiền để gia hạn gói Premium.\n\nLý do: hình thức thanh toán VietQR/chuyển khoản ngân hàng (A2A) không hỗ trợ trừ tiền định kỳ như thẻ tín dụng. Vì vậy:\n\n- Khi hết kỳ 30 ngày, tài khoản của bạn tự động chuyển về gói Free. Không có khoản phí nào bị trừ thêm nếu bạn không chủ động mua lại.\n- Bạn cần tự mua lại thủ công mỗi lần muốn tiếp tục dùng Premium.\n- Sau khi hết kỳ, bạn có 3 ngày ân hạn: vẫn giữ quyền truy cập Premium, nhưng không được cấp thêm hạn mức mới — chỉ được dùng nốt phần hạn mức còn lại từ kỳ trước. Sau 3 ngày, tài khoản tự động chuyển hẳn về Free.\n- Nếu bạn mua thêm khi gói hiện tại vẫn còn hạn, số ngày mới sẽ được cộng dồn vào gói cũ — không mất ngày đã trả, không bị ghi đè.\n\n## 3. Chính sách hoàn tiền\n\nVề nguyên tắc, MS-MOLAR không hoàn tiền cho các giao dịch mua gói Premium, ngoại trừ trường hợp có lỗi hệ thống hoặc lỗi thanh toán thuộc về chúng tôi.\n\nCác trường hợp được xem xét hoàn tiền:\n- Bạn đã bị trừ tiền nhưng tài khoản không được kích hoạt Premium do lỗi kỹ thuật.\n- Bạn bị trừ tiền hai lần cho cùng một giao dịch.\n- Bạn bị trừ sai số tiền so với giá niêm yết (39.000 VNĐ).\n\nCác trường hợp KHÔNG được hoàn tiền:\n- Đổi ý sau khi đã mua và Premium đã được kích hoạt thành công.\n- Không dùng hết hạn mức Premium trong kỳ.\n- Không hài lòng với kết quả học tập hoặc chất lượng gợi ý của AI.\n\nCách yêu cầu hoàn tiền:\n- Gửi yêu cầu qua mục Hỗ trợ trong tài khoản của bạn, kèm mã giao dịch hoặc ảnh chụp màn hình xác nhận thanh toán.\n- Chúng tôi sẽ xem xét và phản hồi trong vòng 7 ngày làm việc.\n- Nếu yêu cầu hợp lệ, tiền sẽ được hoàn qua chuyển khoản ngân hàng về đúng tài khoản đã thực hiện thanh toán, trong vòng 10 ngày làm việc.\n\nLưu ý: việc xử lý hoàn tiền hiện được thực hiện thủ công, nên thời gian xử lý thực tế có thể khác với thời hạn nêu trên trong một số trường hợp.\n\n## 4. Người mua là học sinh chưa đủ 18 tuổi\n\nPhần lớn người dùng MS-MOLAR là học sinh THCS/THPT, trong đó nhiều bạn chưa đủ 18 tuổi. Việc mua gói Premium được thực hiện trên tài khoản cá nhân của học sinh; phụ huynh có thể hỗ trợ quét mã QR thanh toán, nhưng giao dịch được ghi nhận trên tài khoản của học sinh.\n\nChúng tôi khuyến khích phụ huynh/người giám hộ quan tâm và trao đổi với con em về việc sử dụng gói trả phí trước khi thanh toán.\n\n## 5. Bảo mật thanh toán\n\nMS-MOLAR không lưu trữ hoặc xử lý bất kỳ thông tin thẻ/tài khoản ngân hàng nào. Toàn bộ giao dịch được thực hiện qua VietQR/chuyển khoản ngân hàng (A2A) trực tiếp trong ứng dụng ngân hàng của bạn, thông qua đối tác thanh toán payOS.\n\n## 6. Đơn vị cung cấp dịch vụ\n\nGói Premium hiện được cung cấp bởi Nguyễn Anh Phát, với tư cách cá nhân kinh doanh trực tuyến dưới thương hiệu MS-MOLAR, theo quy định tại Nghị định số 52/2013/NĐ-CP và Nghị định số 85/2021/NĐ-CP về thương mại điện tử.\n\n## 7. Thay đổi chính sách\n\nChính sách này có thể được cập nhật theo thời gian. Các thay đổi quan trọng sẽ được thông báo trên trang này hoặc qua kênh liên hệ trong tài khoản của bạn.",
  "billing.quota.tutorExhausted": "Bạn đã dùng hết lượt gia sư của kỳ này.",
  "billing.quota.resetsAt": "Đặt lại vào {date}.",
  "billing.quota.remaining": "Đã dùng {used}/{limit} lượt gia sư trong kỳ này.",
  "billing.quota.upgradeLink": "Xem các gói",

  // --- S-05 /me/orders + C-09 OrderStatusBadge — xem chú thích trong en.ts --
  "billing.amount": "{amount} VNĐ",
  "billing.orders.title": "Đơn hàng của bạn",
  "billing.orders.empty": "Bạn chưa đặt đơn nào.",
  "billing.orders.emptyHint": "Đơn sẽ hiện ở đây ngay khi bạn mua một kỳ Premium.",
  "billing.orders.createdAt": "Tạo lúc",
  "billing.orders.orderCode": "Mã đơn",
  "billing.orders.continuePaying": "Tiếp tục thanh toán",
  "billing.orders.loadError": "Chưa tải được danh sách đơn của bạn. Bạn thử lại nhé.",
  "billing.status.pending": "Chờ thanh toán",
  "billing.status.paid": "Đã thanh toán",
  "billing.status.expired": "Hết hiệu lực",
  "billing.status.cancelled": "Đã huỷ",
  "billing.status.unrecognised": "Không xác định",

  // --- C-10 RecheckOrderControl + C-11 PlanSummary (plan Task 3.7) ---------
  // Xem khối tương ứng ở en.ts cho lý do của từng câu. Bảy câu ở đây cũng phải
  // ĐÔI MỘT KHÁC NHAU, và `stillPending` cũng không được mang từ vựng thất bại.
  "billing.recheck.action": "Kiểm tra lại đơn này",
  "billing.recheck.busy": "Đang hỏi lại nhà cung cấp thanh toán…",
  "billing.recheck.settled": "Đã thanh toán — kỳ Premium của bạn chạy tới {date}.",
  "billing.recheck.stillPending":
    "Vẫn đang chờ khoản chuyển. Bạn chuyển đúng số tiền kèm nội dung chuyển khoản ghi trên màn hình thanh toán, rồi kiểm tra lại.",
  "billing.recheck.notPending": "Đơn này đã đóng rồi, nên kiểm tra lại cũng không đổi được gì.",
  "billing.recheck.unknownOrder":
    "Chúng tôi không tìm thấy đơn này. Bạn bấm nút “Gửi phản hồi” và gửi kèm mã đơn để chúng tôi tra giúp.",
  "billing.recheck.amountMismatch":
    "Số tiền nhận được không khớp với đơn này. Bạn bấm nút “Gửi phản hồi” và gửi kèm mã đơn — trường hợp này cần một người xử lý.",
  "billing.recheck.providerUnavailable":
    "Chúng tôi chưa liên lạc được với nhà cung cấp thanh toán. Đơn của bạn không có gì thay đổi; bạn thử lại sau ít phút.",
  "billing.recheck.rateLimited":
    "Bạn vừa kiểm tra liên tiếp nhiều lần. Chờ một chút rồi kiểm tra lại nhé.",
  "billing.confirm.action": "Tôi đã chuyển khoản — kiểm tra ngay",

  // --- S-06 /pricing/checkout — xem chú thích trong en.ts -------------------
  "billing.checkout.title": "Hoàn tất thanh toán",
  "billing.checkout.validUntil": "Lệnh thanh toán này có hiệu lực đến {time}.",
  "billing.checkout.qrLabel": "Mã quét mang sẵn thông tin chuyển khoản",
  "billing.checkout.noActiveOrder": "Hiện không có lệnh thanh toán nào đang chờ.",
  "billing.checkout.account": "Số tài khoản",
  "billing.checkout.accountName": "Chủ tài khoản",
  "billing.checkout.amountLabel": "Số tiền",
  "billing.checkout.memo": "Nội dung chuyển khoản",
  "billing.checkout.memoWarning":
    "Bạn chép đúng nguyên văn nội dung chuyển khoản. Thiếu nó thì khoản tiền chuyển tới không tự khớp được với đơn này.",
  "billing.checkout.fieldMissing":
    "Đơn này thiếu một vài thông tin chuyển khoản. Bạn bấm nút “Gửi phản hồi” và gửi kèm mã đơn trước khi chuyển bất kỳ khoản tiền nào.",
  "billing.confirm.legalPending.reason":
    "Điều khoản dịch vụ và Chính sách hoàn tiền chưa được công bố, nên chưa xác nhận thanh toán ở đây được. Chưa có khoản nào bị trừ.",

  "billing.quota.unavailable":
    "Chưa đọc được bộ đếm lượt dùng của bạn lúc này. Việc đó không hạn chế quyền truy cập: mọi thứ vẫn chạy bình thường.",
  "billing.orders.planLabel": "Gói hiện tại",
  "billing.orders.planPremiumUntil": "Premium · đến {date}",
  "billing.orders.planPremiumGrace": "Premium · đang ân hạn, hết hạn {date}",
  "billing.orders.resetLabel": "Kỳ đặt lại vào",
  "billing.orders.tutorLabel": "Lượt gia sư",
  "billing.orders.tutorRemaining": "Còn {count}/{limit} lượt gia sư",
  "billing.orders.uploadLabel": "Lượt tải đề",
  "billing.orders.uploadRemaining": "Còn {count}/{limit} lượt tải đề",

  // /profile — xem chú thích tương ứng trong en.ts.
  "profile.error.sessionExpired": "Phiên đăng nhập đã hết hạn. Hãy đăng nhập lại.",
  "profile.error.rateLimited": "Thao tác quá nhiều lần. Thử lại sau {seconds} giây.",
  "profile.error.generic": "Có lỗi xảy ra. Hãy thử lại.",
  "profile.avatar.invalidType": "Chỉ nhận ảnh JPG, PNG và WebP.",
  "profile.avatar.tooLarge": "Ảnh này nặng hơn {maxMb}MB. Hãy chọn ảnh nhẹ hơn.",
  "profile.avatar.uploadFailed": "Chưa lưu được ảnh. Hãy thử lại.",
  "profile.password.errorCurrentRequired": "Hãy nhập mật khẩu hiện tại.",
  "profile.password.errorCurrentWrong": "Mật khẩu hiện tại không đúng.",
  "profile.password.errorMismatch": "Hai ô mật khẩu mới không khớp nhau.",
  "profile.password.errorSameAsCurrent": "Mật khẩu mới phải khác mật khẩu hiện tại.",

  // --- /profile — giao diện; xem chú thích tương ứng trong en.ts -----------
  // `profile.tab.info`/`profile.tab.usage`/`profile.eyebrow` XOÁ (task 44,
  // UI Spec § "Đổi giá trị / xoá") — khoá chết từ trước khi có `ProfileTabs`,
  // không nơi nào gọi.
  "profile.title": "Hồ sơ của bạn",
  // Giá trị mới (task 44) — bản cũ "Tài khoản này gồm những gì, và những phần
  // bạn đổi được." không còn đúng: trang nay có thêm uy tín và bình luận.
  "profile.description": "Tài khoản, uy tín và bình luận về bài giải của bạn.",
  "profile.email.label": "Email đăng ký",
  "profile.email.readOnly": "Không thể thay đổi",
  "profile.name.change": "Đổi tên",
  "profile.name.saved": "Đã cập nhật tên hiển thị.",
  "profile.name.errorEmpty": "Hãy nhập tên hiển thị.",
  "profile.name.errorTooLong": "Tên hiển thị tối đa {max} ký tự.",
  "profile.name.errorCharset": "Tên hiển thị chỉ được gồm chữ cái và dấu chấm.",
  "profile.password.label": "Mật khẩu",
  "profile.password.masked": "Mật khẩu của bạn không hiển thị ở đây.",
  "profile.password.noReveal": "Đã băm — chúng tôi cũng không xem lại được.",
  "profile.password.change": "Đổi mật khẩu",
  "profile.password.current": "Mật khẩu hiện tại",
  "profile.password.new": "Mật khẩu mới",
  "profile.password.confirm": "Nhập lại mật khẩu mới",
  "profile.password.hint": "Tối thiểu {min} ký tự.",
  "profile.password.submit": "Cập nhật mật khẩu",
  "profile.password.changed": "Đã đổi mật khẩu. Các thiết bị khác sẽ phải đăng nhập lại.",
  "profile.password.errorTooShort": "Hãy dùng ít nhất {min} ký tự.",
  "profile.password.errorTooLong":
    "Mật khẩu quá dài (tối đa {maxBytes} byte — chữ có dấu tính hơn một byte).",
  "profile.password.errorOnlySpaces": "Mật khẩu không thể chỉ gồm dấu cách.",
  "profile.password.errorTooCommon": "Mật khẩu này quá phổ biến. Hãy chọn mật khẩu khác.",
  "profile.avatar.label": "Ảnh đại diện",
  "profile.avatar.change": "Đổi ảnh",
  "profile.avatar.hint": "JPG, PNG hoặc WebP, tối đa {maxMb}MB.",
  "profile.avatar.selected": "Đã chọn: {name}",
  "profile.avatar.uploading": "Đang tải ảnh lên…",
  "profile.avatar.saved": "Đã cập nhật ảnh đại diện.",
  "profile.error.network": "Mất kết nối trước khi xong. Hãy thử lại.",

  // --- Hồ sơ (S-06) — ProfileTabs + ReputationBlock (task 44) --------------
  // Nguyên văn UI Spec § "Chuỗi tiếng Việt cần thêm" → "Hồ sơ (S-06, profile.*)".
  "profile.tabs.label": "Mục hồ sơ",
  "profile.tabs.account": "Tài khoản",
  "profile.tabs.comments": "Bình luận",
  // Dùng khi số bình luận mới k > 0 (chip "Bình luận") — khoá đặt sẵn ở task 44
  // ("profile.tabs.*"), nối vào `ProfileTabs` ở task 45 (đếm chưa đọc,
  // `getMyUnreadCommentCount()`).
  "profile.tabs.commentsA11y": "Bình luận, {count} bình luận mới",
  "profile.reputation.label": "Điểm uy tín",
  "profile.reputation.published": "{count} bài giải đã đăng",
  "profile.reputation.helpful": "{count} lượt hữu ích",
  "profile.reputation.none": "Chưa có bài giải nào đã đăng",
  "profile.reputation.tier1": "Mở đường",
  "profile.reputation.tier2": "Dẫn lối",
  "profile.reputation.tier3": "Trụ cột",
  "profile.reputation.tierGoal": "{count} bài giải",
  "profile.reputation.tierLocked": "còn {count} bài",

  // --- Hồ sơ (S-06) — ProfileCommentsTab + CommentNotificationCard (task 45) ---
  // Nguyên văn UI Spec § Component ProfileCommentsTab/CommentNotificationCard.
  "profile.comments.asked": "{name} hỏi ở câu {questionNumber}",
  "profile.comments.commented": "{name} bình luận ở câu {questionNumber}",
  "profile.comments.reply": "Trả lời",
  "profile.comments.repliedToYou": "{name} trả lời bạn ở câu {questionNumber}",
  "profile.comments.replyQuote": "Bạn: {body}",
  "profile.comments.viewReply": "Xem trả lời",
  "profile.comments.examHidden": "Đề không còn hiện",
  "profile.comments.empty": "Chưa có bình luận nào về bài giải của bạn.",
  "profile.comments.emptyHowTo": "Vào một đề bạn đã nộp rồi bấm Viết bài giải ở trang kết quả.",
  "profile.comments.more": "Xem thêm",
  "profile.comments.loadError": "Chưa tải được bình luận. Bạn thử lại nhé.",

  // /about — xem chú thích tương ứng trong en.ts.
  "about.eyebrow": "Giới thiệu",
  "about.title": "Về chúng tôi",
  "about.intro":
    "MS-MOLAR là nền tảng luyện đề thi dành cho học sinh THCS và THPT. Bạn có thể liên hệ trực tiếp với chúng tôi theo thông tin dưới đây.",
  "about.owner": "Chủ sở hữu website",
  "about.email": "Email liên hệ",
  "about.phone": "Số điện thoại liên hệ",
  "about.placeholderNotice":
    "Thông tin liên hệ ở trên là dữ liệu tạm, sẽ được thay bằng thông tin thật trước khi ra mắt.",

  // --- Bài giải cộng đồng ---------------------------------------------------
  // Nguyên văn UI Spec § "Chuỗi tiếng Việt cần thêm"; nhóm S-01…O-02 mang tiền
  // tố `solutions.` (Frontend DD v1.2 § Vietnamese Copy Keys, quy tắc namespace).
  // Chung (S-01…S-07): eyebrow của cả tính năng.
  "solutions.eyebrow": "Bài giải cộng đồng",
  // Danh tính ẩn danh (C-07 AuthorIdentity, task 17) — chữ đứng cạnh C-08
  // AnonymousAvatar ở MỌI bề mặt dùng AuthorIdentity (thẻ danh sách, thẻ đầu
  // màn xem, hàng bình luận).
  "solutions.identity.anonymous": "Ẩn danh",
  // Huy hiệu điểm "đang chấm" (C-06 SolutionCard, task 17) — nguyên văn UI Spec
  // § "Chuỗi tiếng Việt cần thêm" → "Chung"; `result.outOfTen` (dùng lại,
  // không đổi giá trị) lo hình dạng còn lại của huy hiệu (AC-041, UI-D3/D47).
  "solutions.scorePending": "{score} trên 10 · đang chấm",
  // Thẻ cửa vào (S-01, C-01 SolutionEntryCard, task 08) — nguyên văn UI Spec
  // § "Chuỗi tiếng Việt cần thêm" → "Thẻ cửa vào (S-01)". `entry.hidden` là
  // NHÃN NÚT (bài của tôi đang bị ẩn) — khác `entry.deleted`, câu của
  // `ModerationReasonBanner` biến thể "status" khi bài vừa bị xoá hẳn (AC-110).
  "solutions.entry.count": "{count} bài giải cho đề này",
  "solutions.entry.empty": "Chưa có bài giải cho đề này",
  "solutions.entry.body":
    "Lời giải từng câu do người đã làm đề viết. Bạn cũng có thể viết bài của mình.",
  "solutions.entry.write": "Viết bài giải",
  "solutions.entry.continue": "Viết tiếp",
  "solutions.entry.edit": "Sửa bài giải",
  "solutions.entry.hidden": "Bài giải của bạn đang bị ẩn",
  "solutions.entry.viewCount": "Xem {count} bài giải",
  "solutions.entry.view": "Xem bài giải",
  "solutions.entry.changed": "{count} câu hỏi đã thay đổi, hãy cập nhật",
  "solutions.entry.deleted": "Bài giải của bạn đã bị gỡ: {reason}",
  // Danh sách (S-03, C-04 SolutionList / C-05 OwnSolutionBlock / C-06
  // SolutionCard, task 17) — nguyên văn UI Spec § "Chuỗi tiếng Việt cần thêm"
  // → "Danh sách (S-03)". `own.*` là khối đầu trang của CHÍNH người xem
  // (C-05); `card.*` là một thẻ bài giải của NGƯỜI KHÁC hoặc đã đăng (C-06).
  // Dòng "k câu hỏi đã thay đổi, hãy cập nhật" của khối `own` dùng lại
  // `solutions.entry.changed` (cùng chữ, không thêm khoá `own.changed`).
  // Khung trang danh sách (C-04 SolutionList + route, task 18) — nguyên văn
  // UI Spec § "Chuỗi tiếng Việt cần thêm" → "Danh sách (S-03)"; đứng trước
  // `own.*`/`card.*` (task 17) đúng thứ tự UI Spec liệt kê.
  "solutions.list.crumb": "Bài giải",
  "solutions.list.title": "Bài giải cho đề này",
  "solutions.list.description": "{count} bài giải. Chỉ người đã nộp bài mới xem được.",
  "solutions.list.empty": "Chưa có bài giải nào. Hãy là người đầu tiên.",
  "solutions.own.title": "Bài giải của bạn",
  "solutions.own.noted": "Đã ghi chú",
  "solutions.own.progress": "{done}/{total} câu",
  "solutions.own.writeCta": "Viết bài giải của bạn",
  "solutions.own.continue": "Viết tiếp",
  "solutions.own.hiddenLine": "Bài giải của bạn đã bị ẩn bởi quản trị viên.",
  "solutions.own.seeReason": "Xem lý do",
  "solutions.card.mine": "Bài của bạn",
  "solutions.card.updated": "Cập nhật {time}",
  "solutions.card.helpfulCount": "{count} hữu ích",
  "solutions.card.commentCount": "{count} bình luận",
  // Chấm chưa đọc trên ĐÚNG thẻ của chính người viết (AC-092, task 29) — chữ
  // mang thông tin, chấm chỉ là trang trí (aria-hidden).
  "solutions.card.unreadComments": "{count} bình luận mới",
  "solutions.card.pinned": "Tác giả đề ghim",
  "solutions.card.openLabel": "Mở bài giải của {name}",
  // Công tắc cài đặt (C-12): chữ trạng thái hiện rõ cạnh rãnh, không chỉ màu.
  "solutions.switch.on": "Bật",
  "solutions.switch.off": "Tắt",
  // Hộp thoại đóng tấm trượt khi còn thay đổi chưa lưu (C-32, AC-104).
  "solutions.dirty.title": "Bạn có thay đổi chưa lưu",
  "solutions.dirty.body": "Lưu lại trước khi đóng?",
  "solutions.dirty.save": "Lưu",
  "solutions.dirty.discard": "Bỏ",
  "solutions.dirty.stay": "Ở lại",
  // Màn viết (S-04, task 09) — SolutionEditorHeader/SolutionSettingsPanel/
  // NoteQuestionRow/SolutionPublishBar. Nguyên văn UI Spec § "Chuỗi tiếng Việt
  // cần thêm" → "Màn viết (S-04)".
  "solutions.emptyExam": "Đề này hiện không còn câu hỏi nào.",
  "solutions.status.draft": "Nháp",
  "solutions.status.hidden": "Bị ẩn",
  "solutions.editor.title": "Bài giải của bạn",
  "solutions.editor.progress": "{done}/{total} câu đã ghi chú",
  "solutions.editor.settings": "Cài đặt bài giải",
  "solutions.editor.settingsSub": "Hiện hồ sơ, hiện điểm và lựa chọn gốc",
  "solutions.editor.showProfile": "Hiện hồ sơ",
  "solutions.editor.showProfileSub":
    "Tắt thì bài hiện là Ẩn danh, không tên, không ảnh. Thay đổi có hiệu lực từ lần tải sau.",
  "solutions.editor.showScore": "Hiện điểm và lựa chọn gốc",
  "solutions.editor.showScoreSub": "Điểm và câu trả lời của lần làm bạn mở bài giải từ đó",
  "solutions.row.noted": "Đã ghi chú",
  "solutions.row.missing": "Chưa ghi chú",
  "solutions.row.short": "Chưa đủ 15 từ",
  "solutions.row.changed": "Câu hỏi đã thay đổi",
  // Hàng câu màn xem (task 20, `SolutionQuestionRow`) dùng lại đúng khoá này —
  // cùng khái niệm "câu chưa có ghi chú" ở cả hai màn, một bảng tra một khoá.
  "solutions.row.noSolution": "Chưa có lời giải",
  "solutions.bar.remaining": "Còn {count} câu chưa có ghi chú. Ghi chú đủ {total} câu mới đăng được.",
  "solutions.bar.ready": "Đủ {total} câu. Bạn có thể đăng.",
  "solutions.bar.publishedNote": "Bài giải đang hiện với mọi người đã nộp đề.",
  "solutions.bar.saveDraft": "Lưu nháp",
  "solutions.bar.publish": "Đăng",
  "solutions.bar.publishing": "Đang đăng…",
  "solutions.bar.unpublish": "Gỡ về nháp",
  "solutions.bar.viewMine": "Xem bài giải",
  // Route S-04 (task 10) — routeError dùng chung cho cả 3 route (SolutionRouteError,
  // task 10/18/19); editor.crumb là mốc cuối breadcrumb màn viết; hiddenBanner là
  // nguyên văn biến thể "alert" của ModerationReasonBanner (AC-083); toast.*/
  // unpublish.* đúng UI Spec § "Chuỗi tiếng Việt cần thêm" → "Màn viết (S-04)".
  "solutions.routeError": "Không mở được trang này. Bạn thử lại nhé.",
  "solutions.editor.crumb": "Bài giải của bạn",
  "solutions.hiddenBanner": "Bài giải của bạn đã bị ẩn bởi quản trị viên. Lý do: {reason}",
  "solutions.toast.saved": "Đã lưu",
  "solutions.toast.published": "Đã đăng bài giải",
  "solutions.unpublish.title": "Gỡ bài giải về nháp?",
  "solutions.unpublish.body":
    "Bài sẽ không hiện với ai; Hữu ích và bình luận được giữ; uy tín từ bài này tạm không tính.",
  // DD-pinned (frontend DD v1.6 § Error Handling "solutions.editor.settingsSaveError").
  "solutions.editor.settingsSaveError": "Chưa lưu được cài đặt. Bạn thử lại nhé.",
  // solutions.note.saveError nguyên văn thuộc namespace "Tấm trượt ghi chú" (O-01,
  // task 11) nhưng render ĐẦU TIÊN ở đây: thanh đáy "Lưu nháp" (saveSolution
  // generic), "Đăng"/"Gỡ về nháp" generic (không có khoá bar riêng — DD § Error
  // Handling gộp chung "the component's own generic key"), và giàn giáo ghi chú
  // tối giản chờ NoteSheet thật (task 11 dùng lại đúng khoá này, không định nghĩa
  // lại — quy tắc "first task in execution order that renders it", DD :1793).
  "solutions.note.saveError": "Chưa lưu được. Bạn thử lại nhé.",
  "solutions.note.tooShortPublished":
    "Ghi chú phải có ít nhất 15 từ. Muốn để ngắn thì gỡ bài về nháp trước.",
  // Task 11 — NoteSheet/NoteEditor/FormulaPreview (UI Spec § Chuỗi tiếng Việt
  // cần thêm → "Tấm trượt ghi chú (O-01)", nguyên văn).
  "solutions.note.placeholder":
    "Giải thích vì sao đáp án đúng, ít nhất 15 từ. Viết được công thức như $x^2$.",
  "solutions.note.counter": "{count}/15 từ",
  "solutions.note.charsLeft": "Còn {remaining} ký tự",
  "solutions.note.saveNext": "Lưu và sang câu {number}",
  "solutions.note.preview": "Xem trước công thức",
  "solutions.note.previewLoading": "Đang mở xem trước…",
  "solutions.note.previewEmpty": "Chưa có gì để xem trước.",
  "solutions.note.previewError": "Chưa mở được phần xem trước. Bạn thử lại nhé.",
  "solutions.note.yourCorrect": "Bạn làm đúng",
  "solutions.note.yourWrong": "Bạn làm sai",
  "solutions.note.yourSkipped": "Bạn bỏ trống",
  // Nút gập/mở danh sách phương án trắc nghiệm (AC-022, AC-060) — dùng chung
  // cả hai biến thể QuestionAnswerSummary (viết ở đây, xem ở task 20).
  "solutions.note.choices": "Xem {count} phương án",
  "solutions.note.choicesHide": "Ẩn phương án",
  // UI Spec liệt các khoá này dưới "Màn xem (S-05)" (task 20), nhưng
  // `QuestionAnswerSummary` biến thể NGƯỜI VIẾT (task 11) render nhãn tự luận
  // này TRƯỚC (cùng chữ, dùng chung cả hai biến thể) — theo đúng "owning-task
  // rule" của Design Doc (§ Vietnamese Copy Keys): "task ĐẦU TIÊN theo thứ tự
  // thực thi render nó" là chủ của khoá, không phải màn nào UI Spec liệt kê nó
  // dưới tên.
  "solutions.view.essayScored": "Đã chấm: {earned}/{max} điểm",
  "solutions.view.essayPending": "Chưa chấm",
  // Màn xem (S-05, task 20) — SolutionQuestionRow + QuestionAnswerSummary biến
  // thể "Người viết" + SolutionNoteBlock (UI-D16, UI-D17, AC-040, AC-041).
  // `writerChoice` giữ nguyên placeholder `{answer}` dù giá trị truyền vào là
  // ReactNode (đề câu render sẵn phía server, UI-D22) chứ không phải chuỗi —
  // `t()` không nội suy được ReactNode, nên nơi gọi tách chuỗi tại `{answer}`
  // rồi tự chèn node (xem `interpolateNode` trong QuestionAnswerSummary.tsx).
  "solutions.view.writerChoice": "Người viết chọn {answer}",
  "solutions.view.writerWrong": "Người viết làm sai",
  "solutions.view.writerSkipped": "Người viết bỏ trống",
  "solutions.view.writerAnswer": "Người viết trả lời:",
  "solutions.view.solutionLabel": "Lời giải",
  // Khoá thuộc "Tấm trượt bình luận (O-02)" trong UI Spec, nhưng `SolutionQuestionRow`
  // (task 20) render CHÍNH hai chuỗi này trước — trên nút bình luận của hàng câu
  // và trên chữ đếm ở đầu hàng — dù tấm trượt thật (`CommentSheet`) tới sau ở
  // task 28. Theo đúng "owning-task rule" (task ĐẦU TIÊN theo thứ tự thực thi
  // render nó là chủ của khoá — xem lý giải của `essayScored`/`essayPending` ở
  // trên): task 20 là chủ, task 28 dùng lại nguyên văn, không định nghĩa lại.
  "solutions.comments.open": "{count} bình luận",
  "solutions.comments.openEmpty": "Bình luận",
  // Tấm trượt bình luận thật (O-02, task 28) — CommentSheet/CommentItem/
  // CommentComposer. DD-pinned: sendError, deleteError (frontend DD § Error
  // Handling). "solutions.comments.report"/"solutions.comments.reported"
  // thuộc task 37 (nút Báo cáo trên hàng `CommentItem`, không phải task 28).
  "solutions.comments.title": "Bình luận",
  "solutions.comments.report": "Báo cáo",
  "solutions.comments.reported": "Bạn đã báo cáo bình luận này.",
  "solutions.comments.writerBadge": "Người viết",
  "solutions.comments.empty": "Chưa có bình luận nào cho câu này.",
  "solutions.comments.loadError": "Chưa tải được bình luận. Bạn thử lại nhé.",
  "solutions.comments.hiddenByAdmin": "Bình luận đã bị ẩn bởi quản trị viên. Lý do: {reason}",
  "solutions.comments.deleteTitle": "Xoá bình luận này?",
  "solutions.comments.deleteBody": "Mọi người sẽ không thấy nó nữa.",
  "solutions.comments.deleteError": "Chưa xoá được bình luận. Bạn thử lại nhé.",
  "solutions.comments.sendError": "Chưa gửi được bình luận. Bạn thử lại nhé.",
  "solutions.comments.emptyError": "Bạn hãy viết nội dung trước khi gửi.",
  "solutions.comments.tooLongError": "Bình luận quá dài. Bạn rút ngắn bớt rồi gửi lại nhé.",
  "solutions.comments.anonymousLabel": "Ẩn danh",
  "solutions.comments.anonymousLocked":
    "Bài giải của bạn đang ẩn danh nên bình luận của bạn cũng hiện là Ẩn danh.",
  "solutions.comments.placeholder": "Viết bình luận cho câu này…",
  "solutions.comments.send": "Gửi",
  // Trả lời một cấp (hướng C) — docs/design/community-solutions-comment-replies.md.
  "solutions.comments.replyAction": "Trả lời",
  "solutions.comments.replyCount": "{count} trả lời",
  "solutions.comments.thread.title": "Trả lời",
  "solutions.comments.thread.back": "Về danh sách bình luận",
  "solutions.comments.deletedPlaceholder": "Bình luận đã bị xoá.",
  "solutions.comments.hiddenPlaceholder": "Bình luận đã bị ẩn bởi quản trị viên.",
  "solutions.comments.replyPlaceholder": "Trả lời {name}…",
  "solutions.comments.replyPlaceholderGeneric": "Viết câu trả lời…",
  // Màn xem (S-05, task 19) — SolutionAuthorCard/HelpfulButton/SolutionMenu.
  "solutions.view.helpful": "Hữu ích",
  "solutions.view.helpfulCount": "{count} hữu ích",
  // DD-pinned (frontend DD v1.6 § Error Handling "solutions.view.helpfulError").
  "solutions.view.helpfulError": "Chưa ghi nhận được lượt Hữu ích. Bạn thử lại nhé.",
  "solutions.view.more": "Thêm",
  "solutions.menu.pin": "Ghim bài này",
  "solutions.menu.unpin": "Bỏ ghim",
  "solutions.menu.edit": "Sửa bài giải",
  // DD-pinned (frontend DD v1.6 § Error Handling "solutions.menu.pinError").
  "solutions.menu.pinError": "Chưa ghim được bài này. Bạn thử lại nhé.",
  // Ngoại lệ (v1.5): hai khoá này thuộc phạm vi task 36 (ReportDialog), nhưng
  // task 19 đã render hai nhánh iReported của SolutionMenu nên cần đúng hai
  // khoá này trước — không thêm gì khác thuộc task 36 (không hộp thoại, không
  // gọi reportSolution).
  "solutions.menu.report": "Báo cáo bài giải",
  "solutions.menu.reported": "Bạn đã báo cáo bài giải này.",

  // --- Thời gian tương đối (lib/format/relativeTime.ts) ---------------------
  // Dùng ở danh sách bài giải, màn xem và tab Bình luận của hồ sơ; quá 30 ngày
  // thì hiện ngày tháng của formatDate thay cho các câu này.
  "time.justNow": "Vừa xong",
  "time.minutesAgo": "{count} phút trước",
  "time.hoursAgo": "{count} giờ trước",
  "time.yesterday": "Hôm qua",
  "time.daysAgo": "{count} ngày trước",
} satisfies Record<string, string>;

export type Dictionary = typeof copy;
export type MessageKey = keyof Dictionary;
export type TranslateValues = Record<string, string | number>;
/** Hàm tra chuỗi. Dùng được ở cả server lẫn client component (thuần, không context). */
export type Translate = (key: MessageKey, values?: TranslateValues) => string;

export const t: Translate = (key, values) => {
  const template: string | undefined = copy[key];
  // Không bao giờ trả chuỗi rỗng: khoá lọt lưới kiểu thì hiện chính khoá đó ra
  // màn hình còn hơn một khoảng trống câm không ai biết là bug.
  if (template === undefined) return key;
  if (!values) return template;
  return template.replace(/\{(\w+)\}/g, (whole, name: string) =>
    name in values ? String(values[name]) : whole
  );
};
