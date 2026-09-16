# Cây kỹ năng (dạng bài) cho cả 7 môn + % đúng theo dạng bài ở Thống kê

> **Trạng thái:** HOÀN TẤT 2026-09-16 21:05 VN — PROD đã seed 91 node / 49 cạnh và
> gắn thẻ 4 môn (Sinh/Lý/Hoá/Văn) từ report đã duyệt; số liệu đọc lại từ prod ở mục E.
> Việc còn mở duy nhất là tag DEV phần còn lại (mục E), ngoài phạm vi.
>
> **Nhánh:** `design/ui-refactor-san-truong`. Tối 2026-09-16 product owner đổi quyết
> định buổi sáng: đẩy thẳng nhánh lên `origin/main` bằng
> `git push origin design/ui-refactor-san-truong:main` (HEAD `d0336f1`), Vercel production
> READY/PROMOTED (`dpl_HMr3d6eCW6QDnWygdG2zveq7dFZh`) — rồi mới seed + apply (đúng D6).
>
> Đánh dấu `[x]` khi xong để phiên sau nối tiếp được nếu phiên này đứt.

---

## Vấn đề

`lib/adaptive/skillTaxonomy.ts` chỉ có Toán (20 node). `questions.skill_node_id`
của mọi môn khác là NULL, nên Thống kê không nói được "sai ở dạng bài nào" cho
Lý/Hoá/Sinh/Văn/Anh/Sử. Thẻ "Cần sửa chỗ nào" hiện đọc `exam_results.topic_breakdown`,
mà `topic := subject` cho mọi câu UGC (ADR-0004) — trên prod cả 6 đề đều có
đúng MỘT topic trùng tên môn (đo 2026-09-16: `Biology:Biology`, `Math:Math`…),
tức thẻ ấy chỉ lặp lại biểu đồ theo môn và còn in khoá tiếng Anh ra màn hình.

## Số đo đầu phiên (2026-09-16)

| Nguồn | Toán | Lý | Hoá | Sinh | Văn | Anh | Sử |
|---|---|---|---|---|---|---|---|
| PROD `questions` (137 câu) | 9 (4 tagged; 5 câu lớp 8) | 23 (lớp 11: từ trường, cảm ứng, quang hình) | 18 (lớp 10: nguyên tử, BTH, liên kết, oxi hoá–khử) | 40 (lớp 12: tiến hoá, di truyền quần thể) | 7 (lớp 10: đọc hiểu thơ + NLVH + NLXH, toàn tự luận) | 40 câu nhưng `subject=''`, đề `status=failed` | 0 |
| DEV `questions` (105 câu) | 55 (38 tagged) | 5 (lớp 10 seed) | 5 (lớp 10 seed) | 0 | 0 | 40 (lớp 11) | 0 |

- `schema_version.fingerprint` prod = `187d3ed24f0c` = `SCHEMA_FINGERPRINT` trong code → **không cần migration**; `skill_nodes` không có cột `subject`, môn của node giữ ở code (xem Quyết định D1).
- Prod: 20 node / 15 cạnh Toán, 14 dòng `user_skill_mastery`, 18 `exam_results`.
- Report gắn thẻ Toán gần nhất: `supabase/skill-tagging-report-pebjd…-2026-08-16T11-56-12`: 28 câu, 25 tagged, 2 no-matching-node, 1 classification-error. Từ đó prod đã bị xoá bớt đề Toán (còn 9 câu).

## Quyết định thiết kế

- **D1 — Không thêm cột `subject` vào `skill_nodes`.** Môn của node nằm ở code
  (`SkillNode.subject`) và id được đặt tiền tố theo môn (`ly-`, `hoa-`, `sinh-`,
  `van-`, `anh-`, `su-`; Toán giữ id cũ vì đã có mastery trên prod). Lý do: một
  migration prod cần engineer đối chiếu fingerprint lúc deploy (Pha 3.5), tức
  chặn luôn việc seed/tag prod trong phiên này; còn Thống kê lấy môn từ
  `exams.subject` của lượt làm (đúng nguồn biểu đồ đang dùng), không cần môn ở node.
- **D2 — Định tuyến "Nên luyện gì tiếp theo" giữ Toán, có chủ ý.**
  `getSkillRecommendation()` lọc node/cạnh/mastery về tập id Toán trước khi gọi
  `recommendNextSkill()`. Không lọc thì ngay khi seed node môn khác, node chưa
  đụng (ratio 0) của môn khác thắng tie theo id (`anh-…` đứng đầu bảng chữ cái)
  và thẻ vàng gợi "Ngữ âm" kèm nút "Tìm đề Toán". Mở rộng định tuyến sang môn
  khác là quyết định sản phẩm (nút/copy theo môn) — ngoài phạm vi.
- **D3 — Thống kê theo dạng bài tính lúc ĐỌC từ `exam_results.per_question`
  × `questions.skill_node_id` × `skill_nodes.label_vi`**, không đọc
  `user_skill_mastery`: mastery chỉ ghi lúc nộp bài theo tag CÓ TẠI THỜI ĐIỂM ĐÓ,
  nên mọi lượt đã nộp trước đêm nay sẽ không có dữ liệu môn mới; đọc lại từ
  per_question thì hồi tố và theo được chip Tuần/Tháng. Câu `scored === false`
  (tự luận) không đếm — cùng quy ước với `record_skill_mastery()` và ô đúng/sai.
  Câu chưa gắn thẻ gom vào "Chưa phân loại" (không rơi, không crash).
- **D4 — Thẻ "Cần sửa chỗ nào" đổi nguồn** sang cùng bộ gộp dạng bài (bỏ
  `topic_breakdown`), giữ ngưỡng `MIN_TOPIC_QUESTIONS`/`MAX_WEAK_TOPICS`/75%;
  thêm thẻ mới "Kết quả theo dạng bài" liệt kê đủ mọi dạng bài đã làm theo môn.
  Hai thẻ suy từ MỘT bộ gộp nên không thể mâu thuẫn nhau.
- **D5 — Tagger:** `--subject=<Subject>` bắt buộc; danh mục node đưa vào prompt
  chỉ gồm node của môn đó; `--batch=N` (mặc định 10 câu/request) vì hạn ngạch
  free tier là 20 request/ngày/model; `--apply --from-report=<file>` ghi đúng
  bản report đã duyệt (0 request Gemini, mọi dòng vẫn qua `decideSkillTag()`);
  script TỪ CHỐI chạy nếu `GEMINI_API_KEY` trong env file trùng key của app
  (`.env.local` / `.env.local.prod-backup`) — mã hoá thẳng ràng buộc TD-019.
- **D6 — Không seed prod trước khi code D2 được deploy** (xem mục "Chờ product
  owner"): seed prod đêm nay = thẻ vàng trên prod gợi sai môn cho tới sáng.
  Tag prod dù sao cũng phải chờ key riêng, nên seed prod dời sang cùng lúc.

## Việc

### A. Taxonomy (code + draft doc)
- [x] `lib/adaptive/skillTaxonomy.ts`: `SkillNode.subject`, `SKILL_TAXONOMY` theo môn, `SKILL_NODES`/`SKILL_PREREQUISITES` gộp, `skillNodesForSubject()`, `subjectOfSkillNodeId()`; `validateDag` chạy trên dữ liệu gộp. **91 node / 49 cạnh** (Toán 20/15 · Lý 15/10 · Hoá 15/12 · Sinh 16/9 · Văn 6/0 · Anh 9/3 · Sử 10/0).
- [x] 6 draft doc `docs/plans/analysis/engine1-<môn>-skill-dag-draft.md` (mirror bản Toán; mục duyệt ghi "tự rà theo corpus, chờ owner duyệt sáng").
- [x] Test `skillTaxonomy.test.ts` (44 ca): số node theo môn, tiền tố id, id duy nhất toàn cục, nhãn có dấu, DAG hợp lệ từng môn + gộp, **draft .md ↔ code khớp tập id/cạnh**.
- [x] `seedSkillTaxonomy.ts`: log số node theo môn + số node trước/sau; giữ upsert idempotent.

### B. Seed
- [x] Seed DEV 2026-09-16 18:15: 20 → 91 node, 15 → 49 cạnh; chạy lần 2: 91/91, 0 dòng mới (idempotent).
- [x] Seed PROD 2026-09-16 21:03 VN (sau khi `d0336f1` READY/PROMOTED trên production — D6 thoả): `SCHEMA_ENV_FILE=.env.local.prod-backup npx tsx supabase/seedSkillTaxonomy.ts` → 20 → **91 node**, 15 → **49 cạnh**, script báo "THÊM 71 node mới". Đọc lại qua Composio (ref `pebjdlbgbmizgfpuptjl`): 91 node / 49 cạnh, 0 node thiếu `label_vi`.

### C. Thống kê (UI + query)
- [x] `lib/analytics/skillBreakdown.ts` (reducer thuần: `aggregateSkillsByRange`, `rankWeakSkills`) + 13 ca test.
- [x] `features/analytics/queries.ts`: đọc `questions(id, skill_node_id)` theo lô 100 id + `skill_nodes` → gộp; `getSkillRecommendation` lọc node/cạnh/mastery theo `ROUTING_SUBJECT` (D2).
- [x] `SkillBreakdownCard.tsx` (+ test RTL) + 4 khoá copy `analytics.skillBreakdown*`/`skillUntagged` + nối vào `AnalyticsDashboard` (thẻ thứ tư, sau "Cần sửa chỗ nào").
- [x] `WeakTopicsCard` đổi nguồn (D4); xoá `lib/analytics/weakTopics.ts` + test cũ (`TopicWeakness`, `MIN_TOPIC_QUESTIONS`, `MAX_WEAK_TOPICS` chuyển sang `skillBreakdown.ts`).

### D. Tagger
- [x] `--subject` (bắt buộc, canonical), `--batch` (mặc định 10), `--apply --from-report=<file>` (0 request), `--key-file` (mặc định `.env.local.skill-tagging`), guard từ chối key trùng app (`--allow-shared-key` để cố ý vượt); dừng khi 429; report `{meta, entries}` có thêm `modelSkillNodeId` (đề xuất thô của model, kể cả khi bị từ chối).
- [x] Test phần thuần `lib/adaptive/tagBatch.ts` (16 ca): prompt lô + chỉ dẫn theo môn, parse phản hồi lô (thiếu/lặp/lạ/JSON hỏng → classification-error, không đoán), đọc report cũ/mới, so key.
- [x] Smoke trên DEV không gọi Gemini (`--from-report` rỗng): Physics 5 câu → 5 classification-error, 0 ghi; Math 55 câu → 38 already-tagged + 17 classification-error, 0 ghi; chạy không có key riêng → từ chối đúng thông điệp TD-019 (exit 1).
- [x] Key riêng: script đọc `GEMINI_API_KEY` từ `SOURCE/.env.local.skill-tagging` (file MỘT dòng, gitignored theo `.env*`) — không sao chép credential Supabase sang file thứ hai; Supabase vẫn lấy từ `SCHEMA_ENV_FILE`. Chưa có file này (chờ key).

### E. Gắn thẻ (key riêng đã có 2026-09-16 18:50, sha256 `6910ecbe`; product owner chọn: dry-run prod đêm nay, deploy → seed → apply sáng mai)
- [x] Dry-run PROD, 11 request Gemini, đọc 100% dòng tagged (AC-008): **Văn 7/7** (4 đọc hiểu thơ, 1 tiếng Việt, 1 NLVH, 1 NLXH — trùng rà tay) · **Lý 23/23** (14 từ trường–cảm ứng, 9 quang hình; toàn bộ confidence 1.00) · **Sinh 40/40** (13 học thuyết–nhân tố, 12 loài–hình thành loài, 11 di truyền quần thể, 4 bằng chứng; 7 câu ở 0.90, trong đó 3 câu p1q8/p1q38/p1q39 ranh giới nhân tố ↔ hình thành loài — cả hai đều trong Tiến hoá) · **Hoá 18/18** (6 cấu tạo nguyên tử, 6 oxi hoá–khử, 4 liên kết, 2 bảng tuần hoàn; hai câu tự luận đọc full text để xác nhận) · **Toán 4 already-tagged + 5 no-matching-node** (5 câu lớp 8, model tự trả rỗng với confidence 1.00 — đúng thiết kế). Không tìm thấy dòng sai. Coverage prod sau apply sẽ là 92/97 = 94.8% trên 5 môn có câu (Toán 44% vì 5/9 câu ngoài THPT).
- [x] **Apply PROD 2026-09-16 21:04–21:05 VN** (ngay sau seed, không đợi sáng) — từ đúng các report đã duyệt (0 request Gemini), trong `SOURCE/`:
  ```
  SCHEMA_ENV_FILE=.env.local.prod-backup npx tsx supabase/tagQuestionSkills.ts --subject=Biology    --apply --from-report=supabase/skill-tagging-report-pebjdlbgbmizgfpuptjl-biology-2026-09-16T11-52-07-994Z.json
  SCHEMA_ENV_FILE=.env.local.prod-backup npx tsx supabase/tagQuestionSkills.ts --subject=Physics    --apply --from-report=supabase/skill-tagging-report-pebjdlbgbmizgfpuptjl-physics-2026-09-16T11-51-44-950Z.json
  SCHEMA_ENV_FILE=.env.local.prod-backup npx tsx supabase/tagQuestionSkills.ts --subject=Chemistry  --apply --from-report=supabase/skill-tagging-report-pebjdlbgbmizgfpuptjl-chemistry-2026-09-16T11-52-19-797Z.json
  SCHEMA_ENV_FILE=.env.local.prod-backup npx tsx supabase/tagQuestionSkills.ts --subject=Literature --apply --from-report=supabase/skill-tagging-report-pebjdlbgbmizgfpuptjl-literature-2026-09-16T11-51-05-697Z.json
  ```
  Toán không cần apply (0 dòng sẽ ghi). Kiểm sau apply (Composio, prod): `select subject, count(*), count(skill_node_id) from public.questions group by subject` → Biology 40/40, Physics 23/23, Chemistry 18/18, Literature 7/7, Math 9/4.
  **Kết quả thật:** 4 lệnh đều in `request Gemini: 0` và `✅ Đã apply.` — Sinh ghi 40 dòng, Lý 23, Hoá 18, Văn 7 (88 dòng; mọi dòng `at-or-above-threshold`, coverage 100% mỗi môn). Report apply: `…-biology-2026-09-16T14-04-31-835Z` · `…-physics-…T14-04-40-461Z` · `…-chemistry-…T14-04-48-014Z` · `…-literature-…T14-04-52-975Z`.
  **Đọc lại từ PROD** (Composio `SUPABASE_RUN_READ_ONLY_QUERY`, ref `pebjdlbgbmizgfpuptjl`): **Biology 40/40 · Physics 23/23 · Chemistry 18/18 · Literature 7/7 · Math 9/4** (không đổi) · subject rỗng 40/0 (đề Anh `status=failed`, ngoài phạm vi) — khớp 100% kỳ vọng. Toàn vẹn: 0 thẻ trỏ node không tồn tại, 0 node thiếu `label_vi`, 17/91 node đang được dùng; coverage 5 môn có câu = 92/97 = 94,8%.
  **Spot-check UI PROD: CHƯA kiểm bằng mắt** — phiên tự hành không đăng nhập được tài khoản test (auto-mode chặn mọi hình thức đăng nhập Playwright). Dữ liệu nền: PROD có 18 lượt đã nộp (Lý 6 · Sinh 5 · Toán 4 · Hoá 2 · Văn 1); tài khoản `+rlstesta` có đúng 1 lượt Sinh (2026-08-28) → mở `/me/dashboard` bằng tài khoản đó sẽ thấy thẻ "Kết quả theo dạng bài" cho môn Sinh. Engineer nhìn một lần để đóng hẳn.
- [x] DEV: dry-run + apply Physics 5/5, Chemistry 5/5 (2 request; đã đọc từng dòng) — để `/me/dashboard` dev có dữ liệu 3 môn cho thẻ mới (tài khoản test có 24 lượt Lý, 12 lượt Hoá).
- [ ] DEV còn lại (chưa chạy, giữ hạn ngạch: đã dùng 13/20 trong ngày Pacific): Math 17 câu chưa thẻ (2 request), English 40 câu (4 request). Chạy sau 14:00 VN 17/09 (reset hạn ngạch) nếu muốn.

### F. Việc ngoài lề
- [x] Gắn logo mới vào ô Wordmark (`components/layout/Wordmark.tsx`, `public/images/ms-molar-logo.png`).

### G. Cổng verify (trong `SOURCE/`, 2026-09-16 18:30–18:45)
- [x] `npx tsc --noEmit` sạch · `npx eslint --max-warnings 0` sạch · `npx vitest run` **2050 passed / 10 skipped / 1 failed** — ca đỏ duy nhất là `lib/security/rateLimit.test.ts` "keeps ONE account's whole daily Gemini budget" (đỏ sẵn từ commit ed40315, không liên quan; lần chạy song song với eslint còn thêm `ExplainStepAffordance.test.tsx` timeout 5s — chạy riêng 7/7 xanh, là nghẽn CPU chứ không phải hồi quy) · `npm run build` xanh, không warning · `npm run test:fixture` 4/4 · `npm run test:localdb` 19/19.
- [x] `verify:schema`: KHÔNG chạy — không có thay đổi schema (D1); fingerprint prod = code = `187d3ed24f0c`.

### H. Đóng vòng
- [x] Notion MS-MOLAR: row "Cây kỹ năng (dạng bài) 7 môn + % đúng theo dạng bài ở Thống kê" (page `3dd78ba6-ae12-810c-9f16-c78a2130c490`, trạng thái Đang thực hiện) — số đo, quyết định D1–D6, cổng verify, việc chờ, chỗ tin cậy thấp. Cập nhật coverage + chuyển Hoàn tất sau khi tag prod.
- [x] 2026-09-16 tối: row Notion chuyển **Hoàn tất** + khối "Đóng vòng" ghi số liệu cuối (seed 91/49, apply 88 dòng, số đọc lại từ prod, spot-check UI chưa làm bằng mắt).
- [x] Commit theo từng bước: 5c5c13b logo · 29f074c taxonomy · efafb4f analytics · 5c82318 tagger · 3836366 dry-run trước seed · 3dfcf29 plan · 87b3540 + d0336f1 dry-run prod & checklist · commit đóng vòng này (seed + apply PROD) — tất cả đã lên `origin/main`.

## Chờ product owner (STOP conditions đã chạm) — ĐÃ GIẢI QUYẾT 2026-09-16 tối

> Cả hai điều kiện đã xong: key riêng có từ 18:50 (mục E); deploy `d0336f1` READY/PROMOTED rồi seed + apply lúc 21:03–21:05 VN. Phần dưới giữ làm lịch sử.

1. **Key Gemini riêng cho gắn thẻ** — tạo tại aistudio.google.com/apikey bằng một
   Google project MỚI (không dùng project của key app), rồi tạo file
   `SOURCE/.env.local.skill-tagging` với đúng một dòng `GEMINI_API_KEY=<key mới>`.
   Tôi không tự tạo được (cần đăng nhập Google). Script tự từ chối nếu key trùng key app.
   Lệnh sau đó (trong `SOURCE/`, dry-run rồi apply từ report đã đọc):
   ```
   SCHEMA_ENV_FILE=.env.local.prod-backup npx tsx supabase/tagQuestionSkills.ts --subject=Biology
   SCHEMA_ENV_FILE=.env.local.prod-backup npx tsx supabase/tagQuestionSkills.ts --subject=Biology --apply --from-report=supabase/skill-tagging-report-pebjdlbgbmizgfpuptjl-biology-<ISO>.json
   ```
   lặp cho Physics, Chemistry, Literature, Math (English prod: 0 câu có subject — bỏ, xem tổng kết).
   Ước lượng request: Sinh 4 + Lý 3 + Hoá 2 + Văn 1 + Toán 1 = 11 (lô 10 câu) — vừa một ngày hạn ngạch 20.
2. **Deploy nhánh này trước khi seed prod** (D6), rồi chạy seed prod + tag prod
   theo lệnh ở mục E.
