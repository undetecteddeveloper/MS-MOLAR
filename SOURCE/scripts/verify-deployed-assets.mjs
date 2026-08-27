// verify:deployed — cổng xác nhận CSS/JS ĐÃ DEPLOY THẬT khớp với build cục bộ
// (TD-025, 2026-08-27).
//
// ⚠ VÌ SAO CỔNG NÀY TỒN TẠI — đọc trước khi sửa hay tắt nó ⚠
//
// TD-024 (2026-08-17): một khối CSS thuần thêm vào cuối `globals.css` BIẾN MẤT
// khỏi bundle CSS mà Vercel build ra, trong khi `next build` trên đúng commit
// đó ở máy local lại cho kết quả đúng. Cả 5 cổng verify của dự án
// (`tsc --noEmit`, `eslint --max-warnings 0`, `vitest run`, `next build`,
// `check:bundle`) đều XANH trước khi ship, vì không cổng nào trong số đó hỏi
// câu "asset đã lên Vercel THẬT có khớp asset build local không" — tất cả chỉ
// kiểm CỤC BỘ. Người dùng thật là thứ duy nhất phát hiện ra.
//
// Đây là hình dạng TD-005 (schema DB lệch giữa local/deploy) lặp lại ở một
// TẦNG KHÁC: build artifact tĩnh thay vì database. Và cách chữa cũng cùng hình
// dạng — hỏi thẳng MÔI TRƯỜNG THẬT, đừng suy từ repo.
//
// VÌ SAO KHÔNG SO HASH FILE: Vercel build trên hạ tầng của nó, nên tên chunk và
// byte của bản deploy KHÔNG BAO GIỜ khớp `.next-build` cục bộ — kể cả khi mọi
// thứ đúng. So hash sẽ đỏ 100% số lần và bị tắt đi trong tuần đầu. Thứ so được
// là NỘI DUNG NGỮ NGHĨA: mỗi biến CSS (`--foo:`) và mỗi selector mà build cục
// bộ khai, bản deploy phải có đủ. Khối CSS mất tích của TD-024 khai ra biến và
// selector, nên nó rơi đúng vào lưới này.
//
// VÌ SAO SO THEO TỪNG FILE, KHÔNG GỘP CHUNG (bài học từ chính lần chạy đầu):
// gộp toàn bộ CSS cục bộ rồi so với CSS của mấy route công khai cho ra 139
// "class thiếu" — tất cả đều là KaTeX, và chúng thiếu vì đúng: KaTeX chỉ được
// nạp ở route có nội dung câu hỏi, không có ở `/about`. Một cổng báo động giả
// ngay lần chạy đầu là một cổng sắp bị tắt.
//
// Nên phép so là ĐỘ PHỦ THEO TỪNG FILE. Một file CSS cục bộ chỉ có hai trạng
// thái hợp lệ với tập route đang lấy mẫu: KHÔNG được nạp (độ phủ ~0 — bỏ qua,
// đó là chunk của route khác) hoặc ĐƯỢC nạp (độ phủ phải là 100%). Trạng thái
// THỨ BA — nạp một phần — chính là hình dạng của TD-024, và nó là thứ duy nhất
// cổng này báo đỏ.
//
// CHẠY KHI NÀO: sau MỖI lần ship UI có đụng `globals.css` hoặc thêm asset tĩnh
// mới. `npm run verify:deployed -- https://ms-molar.vercel.app`
// (hoặc URL preview). Cần `.next-build` của ĐÚNG commit đang deploy — chạy
// `npm run build` trước, nếu không cổng này so với một quá khứ nào đó.

import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const DIST = path.join(ROOT, ".next-build");

/** Route để lấy mẫu CSS/JS đã deploy. Công khai hết — cổng này không đăng nhập,
 *  và CSS là MỘT bundle dùng chung nên route công khai đủ soi ra khối thiếu. */
const ROUTES = ["/", "/about", "/terms", "/refund-policy"];

/** Biến CSS mà mất đi thì giao diện hỏng NHÌN THẤY ĐƯỢC — kiểm riêng, tên rõ,
 *  để thông báo lỗi chỉ thẳng chỗ đau thay vì in ra một danh sách dài.
 *  Nguồn: `.claude/MEMORY.md` §3 (các giá trị đã hiệu chỉnh theo WCAG). */
const CRITICAL_VARS = [
  "--background",
  "--foreground",
  "--brand-on-dark",
  "--muted-foreground",
  "--ring",
  "--input",
  "--border",
];

function fail(msg) {
  console.error(`\n❌ ${msg}`);
  process.exitCode = 1;
}

function walk(dir) {
  if (!fs.existsSync(dir)) return [];
  return fs.readdirSync(dir, { withFileTypes: true }).flatMap((e) => {
    const p = path.join(dir, e.name);
    return e.isDirectory() ? walk(p) : [p];
  });
}

/** Tên biến CSS được KHAI BÁO (`--foo: value`), không tính chỗ ĐỌC (`var(--foo)`).
 *  Phân biệt này quan trọng: một bundle thiếu khối khai báo vẫn còn đầy chỗ đọc,
 *  nên đếm cả hai sẽ không thấy gì bất thường. */
function declaredVars(css) {
  const out = new Set();
  for (const m of css.matchAll(/(^|[;{\s])(--[a-zA-Z0-9_-]+)\s*:/g)) out.add(m[2]);
  return out;
}

/** Selector class (`.foo`). Đủ để bắt một khối CSS thuần biến mất; cố ý KHÔNG
 *  parse toàn bộ ngữ pháp CSS — cổng này cần đáng tin, không cần hoàn hảo. */
function classSelectors(css) {
  const out = new Set();
  for (const m of css.matchAll(/\.(-?[_a-zA-Z][\w-]*)(?=[\s,{:>.[)])/g)) out.add(m[1]);
  return out;
}

async function main() {
  const base = (process.argv[2] || "").replace(/\/+$/, "");
  if (!base) {
    console.error("Dùng: npm run verify:deployed -- <base-url>");
    console.error("  vd: npm run verify:deployed -- https://ms-molar.vercel.app");
    process.exit(2);
  }

  if (!fs.existsSync(DIST)) {
    console.error(
      `❌ Không thấy ${path.relative(ROOT, DIST)}. Chạy \`npm run build\` trước —\n` +
        "   không có build cục bộ thì cổng này không có gì để so."
    );
    process.exit(2);
  }

  // --- 1. Build CỤC BỘ: gom toàn bộ CSS đã sinh ra.
  const localCssFiles = walk(path.join(DIST, "static")).filter((f) => f.endsWith(".css"));
  if (localCssFiles.length === 0) {
    console.error("❌ Build cục bộ không có file CSS nào — build hỏng hoặc distDir sai.");
    process.exit(2);
  }
  const localFiles = localCssFiles.map((f) => {
    const css = fs.readFileSync(f, "utf8");
    return {
      name: path.relative(DIST, f),
      vars: declaredVars(css),
      classes: classSelectors(css),
    };
  });
  console.log(
    `Build cục bộ: ${localFiles.length} file CSS · ` +
      localFiles.map((f) => `${f.name} (${f.vars.size} biến, ${f.classes.size} class)`).join(" · ")
  );

  // --- 2. Bản ĐÃ DEPLOY: theo <link rel=stylesheet> của từng route.
  const cssUrls = new Set();
  const scriptUrls = new Set();
  for (const route of ROUTES) {
    const res = await fetch(base + route, { redirect: "follow" });
    if (!res.ok) {
      fail(`GET ${route} → HTTP ${res.status}. Không lấy được HTML để soi asset.`);
      continue;
    }
    const html = await res.text();
    for (const m of html.matchAll(/<link[^>]+rel="stylesheet"[^>]+href="([^"]+)"/g)) cssUrls.add(m[1]);
    for (const m of html.matchAll(/<link[^>]+href="([^"]+\.css)"/g)) cssUrls.add(m[1]);
    for (const m of html.matchAll(/<script[^>]+src="([^"]+)"/g)) scriptUrls.add(m[1]);
  }
  if (process.exitCode === 1) return;

  if (cssUrls.size === 0) {
    fail("HTML đã deploy KHÔNG tham chiếu file CSS nào — đúng hình dạng TD-024.");
    return;
  }

  let deployedCss = "";
  for (const u of cssUrls) {
    const res = await fetch(u.startsWith("http") ? u : base + u);
    if (!res.ok) {
      fail(`Không tải được CSS đã deploy: ${u} → HTTP ${res.status}`);
      continue;
    }
    deployedCss += "\n" + (await res.text());
  }
  console.log(
    `Đã deploy:    ${cssUrls.size} file CSS · ${scriptUrls.size} script · ${(deployedCss.length / 1024).toFixed(1)} KB CSS thô`
  );

  // --- 3. So NỘI DUNG, một phía: mọi thứ build cục bộ khai, bản deploy phải có.
  const deployedVars = declaredVars(deployedCss);
  const deployedClasses = classSelectors(deployedCss);

  const missingCritical = CRITICAL_VARS.filter((v) => !deployedVars.has(v));
  if (missingCritical.length > 0) {
    fail(
      `Biến CSS TRỌNG YẾU thiếu trong bản đã deploy: ${missingCritical.join(", ")}\n` +
        "   Giao diện trên production đang hỏng nhìn thấy được. Đây CHÍNH LÀ TD-024."
    );
  }

  // Độ phủ THEO TỪNG FILE — xem khối đầu file.
  //
  // `LOADED_MIN` chỉ để TRẢ LỜI MỘT CÂU: file này có nằm trong tập route đang
  // lấy mẫu không. Nó KHÔNG phải ngưỡng đạt/không đạt. Một ngưỡng kiểu "98% là
  // đạt" sẽ để lọt đúng bug sinh ra cổng này: khối CSS mất tích của TD-024 là
  // MỘT khối cuối file, cỡ vài class trên tổng số hàng trăm — 99.2% độ phủ,
  // xanh, và trang vẫn hỏng. Nên khi một file đã được xác định là CÓ NẠP thì
  // yêu cầu là ĐỦ TUYỆT ĐỐI: thiếu 1 token cũng đỏ.
  //
  // Dải 2%–50% ở giữa cũng đỏ, và cố ý: nó không khớp giả thiết nào (không
  // phải "không nạp", không phải "nạp đủ"), nên thứ đúng đắn là bắt người đọc
  // nhìn vào chứ không phải đoán hộ họ.
  const NOT_LOADED_MAX = 0.02;
  const LOADED_MIN = 0.5;
  let filesLoaded = 0;
  let filesSkipped = 0;

  for (const f of localFiles) {
    const tokens = [...f.vars, ...f.classes];
    if (tokens.length === 0) continue;
    const missing = tokens.filter(
      (t) => !(t.startsWith("--") ? deployedVars : deployedClasses).has(t)
    );
    const coverage = (tokens.length - missing.length) / tokens.length;

    if (coverage <= NOT_LOADED_MAX) {
      filesSkipped++;
      console.log(
        `  – ${f.name}: không được nạp ở các route lấy mẫu (độ phủ ${(coverage * 100).toFixed(1)}%) — bỏ qua`
      );
      continue;
    }
    if (coverage >= LOADED_MIN && missing.length === 0) {
      filesLoaded++;
      console.log(`  ✓ ${f.name}: có mặt ĐỦ ${tokens.length}/${tokens.length} token`);
      continue;
    }

    fail(
      `${f.name}: NẠP MỘT PHẦN — thiếu ${missing.length}/${tokens.length} token (độ phủ ${(coverage * 100).toFixed(2)}%).\n` +
        `   ${missing.slice(0, 20).join(", ")}${missing.length > 20 ? " …" : ""}\n` +
        "   Bản deploy đang chạy CSS KHÁC với commit này. Đây chính là hình dạng TD-024\n" +
        "   (nghi build cache của Vercel bỏ sót thay đổi CSS)."
    );
  }

  // CHỈ báo khi chưa có lỗi nào khác: một file vừa đỏ vì "nạp một phần" cũng
  // làm `filesLoaded === 0`, và nói thêm "không file nào có mặt" ở đó là sai
  // sự thật — nó chỉ thẳng người đọc sang một nguyên nhân không phải nguyên nhân.
  if (filesLoaded === 0 && process.exitCode !== 1) {
    fail(
      "KHÔNG file CSS cục bộ nào có mặt trong bản đã deploy. Bản deploy không phải build của\n" +
        "   commit này, hoặc `.next-build` đã cũ — chạy `npm run build` rồi thử lại."
    );
  }

  // --- 4. JS: chỉ kiểm bản deploy CÓ phục vụ được chunk nó tự khai. Một 404 ở
  //        đây là bản deploy hỏng, và nó im lặng y hệt CSS thiếu.
  let jsChecked = 0;
  for (const u of scriptUrls) {
    if (!u.includes("/_next/")) continue;
    const res = await fetch(u.startsWith("http") ? u : base + u, { method: "HEAD" });
    if (!res.ok) fail(`Script đã khai trong HTML nhưng KHÔNG tải được: ${u} → HTTP ${res.status}`);
    else jsChecked++;
  }

  if (process.exitCode === 1) {
    console.error(
      "\nCổng verify:deployed ĐỎ. Đừng coi bản deploy này là đã lên — xem TD-025 để biết vì sao\n" +
        "5 cổng cục bộ xanh vẫn không nói gì về chuyện này."
    );
    return;
  }

  console.log(
    `\n✅ verify:deployed PASS — ${filesLoaded} file CSS có mặt đầy đủ trong bản đã deploy ` +
      `(${filesSkipped} file không thuộc route lấy mẫu); ${jsChecked} chunk JS tải được.`
  );
}

await main();
