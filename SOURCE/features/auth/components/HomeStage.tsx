"use client";

// HomeStage — vùng hero của trang chủ. Hero và AuthForm là HAI TRẠNG THÁI của
// cùng một vùng (không tách page /login riêng): cả hai cùng mount, xếp chồng
// trong một grid cell, hoán đổi bằng transition opacity/translate theo prop
// `auth` (đọc từ URL `?auth=signin|signup` — server page truyền xuống). Điều
// hướng bằng <Link> soft navigation → component KHÔNG remount → transition chạy
// mượt cả hai chiều. Panel đang ẩn có `inert` (không tab/đọc screen-reader).
//
// Theme "Sân trường" (2026-09-04): hero căn trái — một câu tiêu đề display, một
// đoạn dẫn, một nút chính, một liên kết phụ. Băng chuyền 3 mục cũ đã gỡ: một
// trang chủ nói MỘT điều rõ hơn ba điều luân phiên.
import Link from "next/link";
import { ChevronLeft } from "lucide-react";
import { t } from "@/lib/copy";
import { AuthForm } from "@/features/auth/components/AuthForm";
import { Button } from "@/components/ui/button";

export type AuthMode = "signin" | "signup" | null;

export function HomeStage({ auth, signedIn }: { auth: AuthMode; signedIn: boolean }) {
  const showAuth = auth !== null;

  return (
    // `grid-cols-1` chứ không phải `grid` trần: cột ngầm `auto` phình theo
    // max-content của con và biến <main> thành khung cuộn NGANG ở 360px (đo
    // được scrollWidth 488). `grid-cols-1` sinh `minmax(0, 1fr)` — chặn trần
    // đúng bằng bề rộng khung.
    // Panel đang ẨN rời khỏi luồng (`absolute`) để chiều cao vùng hero chỉ do
    // panel đang HIỆN quyết định — nếu để cả hai trong cùng một ô grid, thẻ đăng
    // nhập cao hơn hero sẽ đẩy phần "Đề mới đăng" xuống dưới màn hình đầu tiên
    // ngay cả khi không ai mở form (đo 2026-09-04: hở ~350px trên desktop).
    <div className="relative grid w-full grid-cols-1">
      {/* ---------- Trạng thái 1: Hero ---------- */}
      <section
        inert={showAuth || undefined}
        aria-labelledby="home-title"
        className={`flex flex-col gap-5 transition-[opacity,translate] duration-500 ease-out motion-reduce:transition-none ${
          showAuth
            ? "pointer-events-none absolute inset-x-0 top-0 -translate-x-6 opacity-0"
            : "relative translate-x-0 opacity-100"
        }`}
      >
        <h1 id="home-title" className="text-display max-w-[16ch] font-bold">
          {t("home.title")}
        </h1>
        <p className="text-muted-foreground max-w-[36ch] text-base leading-relaxed sm:text-lg">
          {t("home.lead")}
        </p>
        <div className="flex flex-col items-start gap-3 sm:flex-row sm:items-center sm:gap-5">
          {/* Khách → mở form đăng nhập tại chỗ; đã đăng nhập → vào thẳng kho đề. */}
          <Button
            render={<Link href={signedIn ? "/exams" : "/?auth=signup"} />}
            size="lg"
            nativeButton={false}
          >
            {t("home.cta")}
          </Button>
          <Link
            href="/exams"
            className="text-primary focus-visible:ring-ring inline-flex min-h-11 items-center rounded-lg font-semibold underline-offset-4 hover:underline focus-visible:ring-3 focus-visible:outline-none"
          >
            {t("home.browse")}
          </Link>
        </div>
      </section>

      {/* ---------- Trạng thái 2: Form đăng nhập / đăng ký ---------- */}
      {/* `justify-self-center`: form nằm giữa ô grid (engineer 2026-09-06);
          hero ở trạng thái kia vẫn căn trái theo design doc §3. */}
      <section
        inert={!showAuth || undefined}
        className={`flex w-full max-w-md flex-col gap-3 transition-[opacity,translate] duration-500 ease-out motion-reduce:transition-none ${
          showAuth
            ? "relative translate-x-0 justify-self-center opacity-100"
            : "pointer-events-none absolute inset-x-0 top-0 translate-x-6 opacity-0"
        }`}
      >
        <Link
          href="/"
          className="text-muted-foreground hover:text-foreground focus-visible:ring-ring inline-flex min-h-11 items-center gap-1 self-start rounded-lg pr-2 text-sm font-medium transition-colors focus-visible:ring-3 focus-visible:outline-none"
        >
          <ChevronLeft aria-hidden className="size-4" />
          {t("common.back")}
        </Link>
        {/* key theo mode: deep-link ?auth=signup mở đúng tab (AuthForm giữ mode
            trong state nội bộ, chỉ đọc initialMode lúc mount). */}
        <AuthForm key={auth ?? "signin"} initialMode={auth ?? "signin"} />
      </section>
    </div>
  );
}
