import { t } from "@/lib/copy";

// HeroFigure — hình minh hoạ cạnh tiêu đề trang chủ, CHỈ cho khách chưa đăng
// nhập (người đã đăng nhập thấy thẻ đề thật ở đúng chỗ này — xem app/page.tsx).
//
// VẼ BẰNG CSS, KHÔNG PHẢI ẢNH. Lý do là ba thứ đo được, không phải sở thích:
//   1. Nặng ~0 byte. Một ảnh hero JPEG/WebP tử tế là 60–200KB và luôn là phần
//      tử LCP — đúng thứ mà mục tiêu Lighthouse ≥85 trên Android tầm trung
//      (PROJECT_OVERVIEW §8) phải trả giá đầu tiên.
//   2. Không cần thư viện ảnh, không cần `remotePatterns`, không có ngày ảnh
//      chết vì đổi CDN.
//   3. Ảnh minh hoạ chung chung (học sinh cười bên laptop) là dấu hiệu "mẫu có
//      sẵn" mà cả đợt refactor này tồn tại để tránh.
//
// NỘI DUNG là thứ đặc trưng nhất trong thế giới của sản phẩm: một PHIẾU TRẢ LỜI
// trắc nghiệm — thứ mọi học sinh Việt Nam nhận ra trong nửa giây. Bốn ô A/B/C/D
// mỗi câu, vài câu đã tô, câu đang làm có viền vàng, và một thẻ điểm nổi ở góc.
// Thẻ điểm chính là lời hứa "chấm ngay" của tiêu đề bên trái được vẽ ra.
//
// `aria-hidden`: đây là trang trí thuần tuý. Mọi thông tin nó gợi ra đều đã nằm
// trong tiêu đề + ba gạch đầu dòng bên cạnh dưới dạng chữ thật; đọc lên lần nữa
// là bắt người dùng trình đọc màn hình nghe hai lần một nội dung.

/** Trạng thái một câu: `picked` = chỉ số đáp án đã tô (0–3), `null` = chưa làm. */
const ROWS: { picked: number | null; current?: boolean }[] = [
  { picked: 1 },
  { picked: 3 },
  { picked: 0 },
  { picked: 2, current: true },
  { picked: null },
  { picked: null },
];

const CHOICES = ["A", "B", "C", "D"];

export function HeroFigure() {
  return (
    <div
      aria-hidden
      className="border-border bg-card rounded-card relative w-full max-w-md border p-5 sm:p-6"
      // Lưới mờ — cùng thủ pháp Supabase dùng làm nền cho khối minh hoạ: nó nói
      // "đây là một sơ đồ", không phải một tấm ảnh. 24px khớp thang khoảng cách.
      style={{
        backgroundImage:
          "linear-gradient(to right, var(--border) 1px, transparent 1px), linear-gradient(to bottom, var(--border) 1px, transparent 1px)",
        backgroundSize: "24px 24px",
        backgroundPosition: "center",
      }}
    >
      {/* Đầu phiếu: tên phiếu + đồng hồ. Nền đặc để lưới không chạy xuyên chữ. */}
      <div className="bg-card mb-4 flex items-center justify-between gap-3 rounded-xl px-1">
        <span className="text-foreground text-sm font-semibold">{t("home.figure.sheet")}</span>
        <span className="bg-surface text-foreground inline-flex items-center gap-1.5 rounded-full px-2.5 py-1 text-xs font-semibold tabular-nums">
          <ClockIcon />
          12:45
        </span>
      </div>

      <div className="flex flex-col gap-2">
        {ROWS.map((row, i) => (
          <div
            key={i}
            // `justify-items-center` + bubble `size-7`: ô lưới co giãn theo bề
            // rộng thẻ nhưng Ô TÔ thì không — thiếu nó, ở 360px bốn đáp án bị
            // kéo dẹt thành viên thuốc và phiếu trả lời hết ra hình phiếu.
            className={`grid grid-cols-[1.25rem_repeat(4,minmax(0,1fr))] items-center justify-items-center gap-1 rounded-xl py-1 pr-1 pl-0.5 ${
              // Câu đang làm: viền vàng nắng. Vàng chỉ 1,6:1 trên trắng nên nó
              // KHÔNG bao giờ đứng một mình mang thông tin — ở đây nó bọc quanh
              // một hàng vốn đã đọc được, đúng quy tắc cứng của theme.
              row.current ? "bg-sun-soft ring-sun ring-2" : "bg-card"
            }`}
          >
            <span className="text-muted-foreground justify-self-start text-xs font-semibold tabular-nums">
              {i + 1}
            </span>
            {CHOICES.map((letter, c) => {
              const filled = row.picked === c;
              return (
                <span
                  key={letter}
                  className={`grid size-7 place-items-center rounded-full text-[11px] font-semibold ${
                    filled
                      ? "bg-primary text-primary-foreground"
                      : "border-border text-muted-foreground border"
                  }`}
                >
                  {letter}
                </span>
              );
            })}
          </div>
        ))}
      </div>

      {/* Thẻ điểm nổi — MỘT chỗ táo bạo của cả khối. Đặt lấn ra mép dưới-phải để
          nó đọc như một thứ VỪA hiện ra, không phải một ô trong biểu mẫu. */}
      <div className="bg-sun absolute -right-2 -bottom-4 flex items-center gap-2 rounded-2xl px-4 py-2.5 sm:-right-4">
        <span className="text-foreground text-2xl leading-none font-bold tabular-nums">8,5</span>
        <span className="text-foreground/70 text-xs leading-tight font-semibold">
          {t("home.figure.scored")}
        </span>
      </div>
    </div>
  );
}

function ClockIcon() {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" className="size-3.5">
      <circle cx="12" cy="12" r="9" />
      <path d="M12 7v5l3 2" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  );
}
