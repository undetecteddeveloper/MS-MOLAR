# Tiến độ — MS-MOLAR

> Chỉ việc ĐANG MỞ và vừa xong; mỗi mục có số đo và LÝ DO. Claude tự cắt mục đã xong quá ~2 tuần (lịch sử nằm trong git log). Nợ kỹ thuật: `TECH-DEBT.md`.
> Cập nhật lần cuối: 2026-10-03.

## Đang mở
- **Bài giải cộng đồng** (nhánh `feat/community-solutions`): 53/53 task đã commit; 6 migration đã áp dev VÀ prod (fingerprint `13a8e93ea8e7` khớp); 110/110 tiêu chí chấp nhận có phủ. Còn: task 49 (đo thị giác 5 màn × 3 viewport, sàn 44px), chờ người dùng đăng nhập phiên Playwright CLI (`.claude/workflow/ops-ui.md`). Kéo theo 4 tiêu chí (AC-049/059/064/097) đang ở "đạt (hành vi) — chờ task 49" và đo lại TBD-01 của task 45. Bàn giao: `docs/plans/community-solutions-HANDOFF.md`.
- **Bình luận trả lời** (schema §27, fingerprint `90dadbd4e453`, làm 2026-10-01): chưa có ghi nhận đã áp lên prod. Đọc `schema_version` của prod qua Composio trước khi coi là xong.
- **Kho đề theo kệ** (ship 2026-09-19, prod fingerprint `340bab74ca57`; quyết định sản phẩm đã khoá: `docs/plans/20260918-feature-exam-shelves.md`): còn TalkBack trên thiết bị thật; hai lượt làm dở trên dev (`exam-toan-10`, `exam-hoa-10`). Lỗi có từ trước, ngoài phạm vi: hằng điểm Rating trong `SOURCE/supabase/test-rls.ts` nằm ngoài [1,5].
- **Composio MCP chưa nạp** trong phiên 2026-10-03: người dùng đăng ký lại (`.claude/workflow/ops-env.md`, mục "Composio mất khi đổi đường dẫn"). Chặn: đọc prod, deploy, kiểm fingerprint.
- **Recipe bị chặn trong VSCode** (ghi 2026-09-25, 09-27; chưa kiểm lại): `/recipe-fullstack-implement` và `/recipe-diagnose` có thể trả lỗi `disable-model-invocation`. Gặp thì báo, không chép quy trình bằng tay.
- Cây làm việc có file CHƯA commit của người dùng (tài liệu community-solutions, `exam-folder/`, `SOURCE/.ts`): không đụng.

## Vừa xong
- 2026-10-03 **Cải tạo luật làm việc** (nhánh `chore/workflow-reform`): luật từ ~8 chỗ về `CLAUDE.md` + `.claude/workflow/` (4 đường + 3 ghi chú vùng) + hook; bỏ Notion; xoá 16/18 recipe. Lý do: luật lặp ở nhiều file nên lệch nhau và bị quên giữa phiên; công cụ thiếu thì Claude lặng lẽ bỏ bước, nên giờ có hook kiểm đầu phiên và dòng đầu báo cáo `ĐỦ BƯỚC` / `THIẾU`.
