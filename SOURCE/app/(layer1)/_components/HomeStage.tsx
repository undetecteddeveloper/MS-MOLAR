"use client";

// HomeStage — content area của homepage (Layer 1, S#17). Hero và AuthForm là
// HAI TRẠNG THÁI của cùng một vùng nội dung (không tách 2 page riêng): cả hai
// cùng mount, xếp chồng trong một grid cell, swap bằng CSS transition
// opacity/translate theo prop `auth` (đọc từ URL `?auth=signin|signup` — server
// page truyền xuống). Điều hướng bằng <Link> soft navigation → component KHÔNG
// remount → transition chạy mượt cả hai chiều. Panel đang ẩn có `inert` (không
// tab/đọc screen-reader vào được). Hướng transition: NGANG phải→trái (engineer
// chốt vòng sửa 1) — hero trượt ra trái, form trượt vào từ phải.
import Image from "next/image";
import Link from "next/link";
import { useT } from "@/lib/i18n/client";
import { AuthForm } from "./AuthForm";

export type AuthMode = "signin" | "signup" | null;

export function HomeStage({ auth }: { auth: AuthMode }) {
  const t = useT();
  const showAuth = auth !== null;

  return (
    <div className="relative z-10 my-auto grid w-full">
      {/* ---------- Trạng thái 1: Hero ---------- */}
      {/* Section hero bỏ max-w-3xl (S#22 vòng sửa 1) — hàng h1+logo cần trải
          FULL bề ngang content area để logo nằm sát mép phải; các khối text
          khác tự giới hạn bề rộng riêng (p có max-w-xl, eyebrow/CTA theo
          nội dung) nên không bị ảnh hưởng. */}
      <section
        inert={showAuth || undefined}
        className={`col-start-1 row-start-1 w-full self-center transition-all duration-500 ease-out ${
          showAuth ? "pointer-events-none -translate-x-6 opacity-0" : "translate-x-0 opacity-100"
        }`}
      >
        <p className="font-sans text-xs font-medium tracking-[0.2em] text-[color:var(--muted-foreground)] uppercase">
          {t("home.eyebrow")}
        </p>
        {/* Copper rule-divider (40px × 2px) — DESIGN.md section-opening mark,
            at most one per viewport. */}
        <div className="mt-4 h-0.5 w-10 bg-[#B8863B]" aria-hidden />

        {/* h1 + brand logo ngang hàng (S#22, vòng sửa 1): hàng trải FULL bề
            ngang — h1 giữ max-w-2xl bên trái (chữ trải đều 2–3 dòng, không bị
            logo dồn), logo đẩy SÁT MÉP PHẢI content area (ml-auto). Khung logo
            18.5vw×18.5vh (16.5 +12%, S#26) + object-contain giữ tỉ lệ 715×650 (không méo).
            flex-wrap: màn quá hẹp thì logo xuống dòng thay vì tràn/bóp méo. */}
        <div className="mt-5 flex flex-wrap items-center gap-6 lg:gap-8">
          <h1 className="max-w-3xl min-w-0 flex-1 basis-64 font-serif text-xl leading-[1.2] font-semibold tracking-tight text-[#1B1512] sm:text-3xl lg:text-4xl">
            {t("home.headline")}
          </h1>
          <Image
            src="/images/brand_logo.png"
            alt=""
            aria-hidden
            width={220}
            height={200}
            className="ml-auto shrink-0 object-contain"
            style={{ width: "18.5vw", height: "18.5vh" }}
          />
        </div>

        <p className="mt-5 max-w-xl font-sans text-sm leading-[1.7] text-[#1B1512]/80 sm:text-lg">
          {t("home.bodyPart1")}
          <span className="border-b-2 border-[#B8863B] pb-0.5 font-medium text-[#1B1512]">
            {t("home.continuouslyUpdated")}
          </span>
          {t("home.bodyPart2")}
          <span className="border-b-2 border-[#B8863B] pb-0.5 font-medium text-[#1B1512]">
            {t("home.instantGrading")}
          </span>
          {t("home.bodyPart3")}
        </p>

        <div className="mt-8">
          <Link
            href="/exams"
            className="group inline-flex items-center gap-3 rounded-[4px] border-2 border-[#1B1512] px-8 py-3 font-sans text-xs font-medium tracking-[0.16em] text-[#1B1512] uppercase transition-colors hover:border-[#A62C2B] hover:bg-[#A62C2B] hover:text-[#EDE1C8]"
          >
            {t("home.getStarted")}
            <span aria-hidden className="transition-transform group-hover:translate-x-1">
              →
            </span>
          </Link>
        </div>
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
