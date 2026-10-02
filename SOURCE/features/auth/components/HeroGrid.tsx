// HeroGrid — lưới caro nền của khối hero trang chủ, CHỈ trang trí và chỉ ở khổ
// điện thoại/cửa sổ hẹp (`sm:hidden`; engineer 2026-10-02). Đặt như con ĐẦU của khối
// `relative isolate` bao cả hero lẫn kệ "Đề nổi nhất" (app/page.tsx) để lưới tràn từ
// quanh khoảng trống bên phải nút chính xuống cụm tiêu đề "Đề nổi nhất" — nét ở đó
// mờ hơn. `-z-10` trong khối isolate nên nằm sau mọi nội dung; thẻ đề có nền riêng nên
// nét chỉ thấy ở khoảng hở giữa các khối. Màu/mặt nạ ở `.hero-grid` (app/globals.css).
export function HeroGrid() {
  return (
    <div
      aria-hidden
      data-testid="hero-grid"
      className="hero-grid pointer-events-none absolute -inset-x-4 -top-3 bottom-0 -z-10 sm:hidden"
    />
  );
}
