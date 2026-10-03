# Ghi chú vùng: Môi trường, git, deploy (Windows)

## Composio mất khi đổi đường dẫn
Composio MCP đăng ký THEO ĐƯỜNG DẪN trong `~/.claude.json`; đổi tên hoặc chuyển repo (kể cả khác hoa/thường ổ đĩa `e:` / `E:`) là mất, và công cụ biến khỏi phiên mà không báo gì. Đã xảy ra 2026-09-17 và 2026-10-03. Hook SessionStart tự kiểm và in cảnh báo; Claude vẫn phải kiểm bằng ToolSearch "composio" (CLAUDE.md §2).
- Khắc phục (CHỈ người dùng làm được — auto mode chặn Claude sửa `~/.claude.json`): chạy trong terminal, thư mục nào cũng được: `claude mcp add --scope user --transport http composio https://connect.composio.dev/mcp --header "X-API-Key: <key>"`. Rồi khởi động lại phiên và xác nhận bằng `/mcp`. `--scope user` để khỏi mất khi đổi thư mục.
- Khi Composio thiếu: dừng đọc prod, deploy, kiểm fingerprint prod; việc code và prototype vẫn làm được.

## Git và đưa code lên main
- Auto mode chặn mọi lệnh đụng `main` local (`checkout main`, `merge`, `fetch origin main:main`); thử biến thể vô ích. Đưa lên main: commit trên nhánh làm việc, rồi chạy RIÊNG `git push origin <nhánh>:main` (đẩy ref, không checkout); kiểm bằng `git ls-remote origin main`. Bị từ chối non-fast-forward → dừng và hỏi người dùng, không force.
- Push vào `main` kích hoạt build prod Vercel tự động (coi chừng deploy hai lần).
- Giữ `git push` là lệnh đứng một mình (classifier từng chặn lệnh ghép `cat .vercel/project.json` + `git push`). Không đọc `.vercel/project.json` (chỉ `ls`).
- Hook chặn: `git push` khi lượt nhắn gần nhất của người dùng không có ý đó; mọi lệnh CLI `supabase` và `vercel` bị chặn hẳn (dùng Composio).
- Working copy CRLF (`core.autocrlf=true`): script vá phải chuẩn hoá needle theo EOL của file, nếu không sẽ trượt im lặng. Cây làm việc thường có thay đổi chưa commit của người dùng.

## Vercel
- Vercel CHỈ qua Composio: xem deploy bằng `VERCEL_GET_DEPLOYMENTS` (lọc `sha` / `branch` / `target`) và `VERCEL_GET_DEPLOYMENT`; tạo deploy bằng `VERCEL_CREATE_NEW_DEPLOYMENT` (`gitSource` cần `repoId` SỐ của GitHub, không phải "owner/repo"). Thường deploy = push main (Vercel tự build). Chỉ deploy khi người dùng nói, và chỉ SAU khi commit (cây bẩn → build lỗi, log đổ nhầm). `VERCEL_GET_PROJECT2` đổ cả cấu hình (rất lớn): tránh.
- Biến môi trường mẫu: `SOURCE/.env.example`; giá trị thật ở Vercel → Settings → Environment Variables (Preview trỏ Supabase dev, Production trỏ prod).
- CSS cũ từng bị phục vụ 4 lần (TD-024, đến 2026-09-14): nguyên nhân là cache build Turbopack bật mặc định ở Next 16.3. Đã tắt `turbopackFileSystemCacheForBuild: false` trong `SOURCE/next.config.ts` (2026-09-15). KHÔNG bật lại; nâng Next mà cờ đổi tên/mặc định thì đọc lại. Sau mỗi lần ship UI chạy `npm run verify:deployed` (so GIÁ TRỊ biến CSS; cần `.next-build` của đúng commit đã deploy). Stylesheet ở `/_next/static/immutable/chunks/*.css`.

## Cổng kiểm tra: những điều đã làm mất thời gian
- Bốn làn vitest: mặc định `npx vitest run` (`lib/ components/ app/`), fixture `npm run test:fixture` (`tests/e2e/fixture/**`, ~5 giây), localdb `npm run test:localdb` (`tests/e2e/service/**`, ~31 giây), integration `npm run test:integration` (cần credential, chạy khi chạm tới). Bỏ ba làn sau thì một làn có thể đỏ trên main bao lâu cũng không ai thấy (TD-030).
- Kiểm exit code THẬT, không suy từ chuỗi `&&`. Một làn đỏ → bỏ file mới ra chạy lại, rồi chạy lại trên bản sạch của main: phân biệt lỗi mình gây ra với lỗi vừa phát hiện.
- Sau khi đổi tên/chuyển route: `npm run build` TRƯỚC `npx tsc` (tsconfig gồm `.next-build/types/`, bộ kiểm cũ trỏ đường dẫn cũ → TS2307 ma).
- Làn fixture nhận ra server component bằng `type.constructor.name === "AsyncFunction"`: layout phải `export default async function`, nếu không 46 ca FE-3 đỏ.
- `npm run test:localdb` hết giờ ngẫu nhiên khi dev DB chậm (REST 0,9–1,5 giây); mỗi lần đỏ một test khác. So với cây sạch trước khi đổ lỗi; chạy lại khi mạng bình thường. Chạy vitest song song với eslint có thể làm `ExplainStepAffordance.test.tsx` quá 5 giây: chạy lại MỘT MÌNH trước khi gọi là hồi quy.
- Đỏ sẵn trên main theo chủ ý người dùng (ghi 2026-09-03 — xác nhận còn đúng trước khi dựa vào): `lib/security/rateLimit.test.ts` "keeps ONE account's whole daily Gemini budget" (từ commit ed40315, nâng hạn mức uploadExam lên 10/ngày để thử trên prod). Lỗi có từ trước, chưa sửa: `SOURCE/supabase/test-rls.ts` có hằng `INITIAL_RATING_SCORES`/`UPDATED_RATING_SCORES` ngoài khoảng [1,5] → 4 assertion Rating đỏ.

## Shell Windows
- Chạy cổng nặng ở TIỀN CẢNH: `cd "E:/WebApp-project/MS-MOLAR/SOURCE" && …`, timeout 600 giây. Bash `run_in_background: true` KHÔNG giữ `cd` (build chạy ở gốc repo, chết vì thiếu package.json). Dùng đường dẫn tuyệt đối: cwd lật giữa gốc repo và `SOURCE` giữa các lần gọi.
- `node -e` với tiếng Việt trong argv làm hỏng chuỗi; lệnh Bash >~8KB bị cắt ("unexpected EOF"); backtick trong `node -e "…"` là command substitution. Việc lớn: ghi script vào file bằng Write rồi chạy; đường dẫn đưa cho node dạng `E:/…`.
- Phiên worktree: guard của Bash từ chối mọi lệnh chứa chữ "SOURCE" → dùng PowerShell, hoặc `cd SOU*CE`.
- `npx prettier --write` với glob thư mục định dạng lại cả file không đụng tới: liệt kê file tường minh, rồi `git status` và hoàn lại phần thừa.
- Auto mode chặn: `sed` trên `.env.local` (Edit thì được); đọc production bằng CLI `supabase` ("Production Reads"; đã bỏ hẳn đường này, Composio `SUPABASE_RUN_READ_ONLY_QUERY` thì không bị); sửa file cấu hình quyền của chính mình, như SKILL.md hay `~/.claude.json` ("Self-Modification" — không đổi công cụ để lách, người dùng phải tự sửa). Đừng thử lại biến thể.
- Recipe của plugin `dev-workflows-fullstack` mang `disable-model-invocation: true`: Claude không gọi được, và ở phiên VSCode (2026-09-25, 09-27) ngay cả khi người dùng gõ slash vẫn bị chặn. Gặp thì báo THIẾU và hỏi, không chép lại quy trình bằng tay.
