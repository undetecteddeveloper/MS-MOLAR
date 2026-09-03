"use client";

// HomeStage — content area của homepage (Layer 1, S#17). Hero và AuthForm là
// HAI TRẠNG THÁI của cùng một vùng nội dung (không tách 2 page riêng): cả hai
// cùng mount, xếp chồng trong một grid cell, swap bằng CSS transition
// opacity/translate theo prop `auth` (đọc từ URL `?auth=signin|signup` — server
// page truyền xuống). Điều hướng bằng <Link> soft navigation → component KHÔNG
// remount → transition chạy mượt cả hai chiều. Panel đang ẩn có `inert` (không
// tab/đọc screen-reader vào được). Hướng transition: NGANG phải→trái (engineer
// chốt vòng sửa 1) — hero trượt ra trái, form trượt vào từ phải.
import Link from "next/link";
import { useT } from "@/lib/i18n/client";
import { AuthForm } from "@/features/auth/components/AuthForm";
import { HomeCarousel } from "@/features/auth/components/HomeCarousel";

export type AuthMode = "signin" | "signup" | null;

export function HomeStage({ auth }: { auth: AuthMode }) {
  const t = useT();
  const showAuth = auth !== null;

  return (
    // `grid-cols-1` chứ không phải `grid` trần: `grid` không khai cột nào thì
    // hai section rơi vào một cột NGẦM có kích thước `auto`, mà `auto` co giãn
    // theo max-content của nội dung — cột phình to hơn khung chứa và `w-full`
    // không ngăn được. Thẻ AuthForm vì thế rộng 440px trong khung 360px, biến
    // <main> thành khung cuộn NGANG (đo được: scrollWidth 488 / clientWidth
    // 360). `grid-cols-1` sinh ra `minmax(0, 1fr)` — chặn trần đúng bằng bề
    // rộng khung, và cận dưới 0 cho phép con thật sự co lại.
    <div className="relative z-10 my-auto grid w-full grid-cols-1">
      {/* ---------- Trạng thái 1: Hero ---------- */}
      {/* Section hero bỏ max-w-3xl (S#22 vòng sửa 1) — hàng h1+logo cần trải
          FULL bề ngang content area để logo nằm sát mép phải; các khối text
          khác tự giới hạn bề rộng riêng (p có max-w-xl, eyebrow/CTA theo
          nội dung) nên không bị ảnh hưởng. */}
      {/* Nội dung hero nay là MỘT MỤC trong HomeCarousel ("Giới thiệu"), cạnh
          "Có tích hợp AI" và "Học tập thích ứng" — xem HomeCarousel.tsx. */}
      <section
        inert={showAuth || undefined}
        className={`col-start-1 row-start-1 w-full self-center transition-all duration-500 ease-out ${
          showAuth ? "pointer-events-none -translate-x-6 opacity-0" : "translate-x-0 opacity-100"
        }`}
      >
        <HomeCarousel />
      </section>

      {/* ---------- Trạng thái 2: Auth form ---------- */}
      <section
        inert={!showAuth || undefined}
        className={`col-start-1 row-start-1 flex max-w-3xl flex-col self-center transition-all duration-500 ease-out ${
          showAuth ? "translate-x-0 opacity-100" : "pointer-events-none translate-x-6 opacity-0"
        }`}
      >
        <Link
          href="/"
          className="mb-4 inline-flex items-center gap-2 self-start font-sans text-xs font-medium tracking-[0.16em] text-[color:var(--muted-foreground)] uppercase transition-colors hover:text-[#1B1512]"
        >
          <span aria-hidden>←</span> {t("common.back")}
        </Link>
        {/* key theo mode: deep-link ?auth=signup mở đúng tab (AuthForm giữ mode
            trong state nội bộ, chỉ đọc initialMode lúc mount). */}
        <AuthForm key={auth ?? "signin"} initialMode={auth ?? "signin"} />
      </section>
    </div>
  );
}
