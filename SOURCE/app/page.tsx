import { headers } from "next/headers";
import Link from "next/link";
import { redirect } from "next/navigation";
import { AboutPrompt } from "@/features/auth/components/AboutPrompt";
import { HomeStage, type AuthMode } from "@/features/auth/components/HomeStage";
import { TechStack } from "@/features/auth/components/TechStack";
import { HomeRipple } from "@/features/home/ripple/HomeRipple";
import { ExamBrowser } from "@/features/exams/components/ExamBrowser";
import { listExamsRanked } from "@/features/exams/queries";
import { BottomNav } from "@/components/layout/BottomNav";
import { PageContainer } from "@/components/layout/PageContainer";
import { SiteHeader } from "@/components/layout/SiteHeader";
import { SkipLink } from "@/components/shared/SkipLink";
import { SupportWidget } from "@/components/support/SupportWidget";
import { getCurrentUserProfile } from "@/lib/auth/getCurrentUser";
import { t } from "@/lib/copy";
import { buildHomeJsonLd, serializeJsonLd } from "@/lib/seo/jsonLd";

// Trang chủ (route công khai duy nhất có nội dung). Theme "Sân trường"
// (2026-09-04): dùng CÙNG khung điều hướng với mọi trang khác (SiteHeader +
// BottomNav) — sidebar riêng của trang chủ cũ đã gỡ, xem
// docs/design/ui-refactor-san-truong-design.md §3.
//
// BỐ CỤC HAI CỘT từ 1024px, và CỘT PHẢI ĐỔI THEO TRẠNG THÁI ĐĂNG NHẬP:
//   - khách  → TechStack (bốn công nghệ website chạy trên + công cụ đã xây nó,
//              logo màu chính thức). Kho đề nằm sau đăng nhập (RLS `to
//              authenticated`) nên KHÔNG có thẻ đề thật nào để hiện cho khách.
//   - đã vào → ba đề mới nhất, thẻ thật, bấm được. Người đã đăng nhập mở trang
//              chủ là để làm đề, nên đường tới đề ngắn nhất có thể.
// Dưới 1024px cả hai rơi xuống dưới khối chữ theo đúng thứ tự DOM.
//
// KHÔNG dùng AppShell: trang này công khai và có redirect riêng, còn AppShell
// đọc entitlement cho người đã đăng nhập — hai lý do đủ để khung tự dựng.
const HOME_EXAM_COUNT = 3;

export default async function Home({ searchParams }: { searchParams: Promise<{ auth?: string }> }) {
  // Đọc cookie auth mỗi request → `/` là dynamic (ƒ), đánh đổi hợp lý cho cá
  // nhân hoá (ô tài khoản, băng xếp hạng "đã làm").
  const [{ auth }, user, requestHeaders] = await Promise.all([
    searchParams,
    getCurrentUserProfile(),
    headers(),
  ]);

  const authMode: AuthMode = auth === "signup" ? "signup" : auth === "signin" ? "signin" : null;

  // Đã đăng nhập mà mở form auth → vào thẳng /exams (parity với /login cũ).
  if (user && authMode) redirect("/exams");

  // Ba đề đầu của bảng xếp hạng cá nhân hoá (ADR-0015) — cùng nguồn với /exams
  // nên "đã làm" trên thẻ ở đây và ở kho đề không thể lệch nhau.
  const ranked = await listExamsRanked({}, 1);
  const exams = ranked.exams.slice(0, HOME_EXAM_COUNT);

  // Nonce CSP của lượt request này (proxy.ts sinh, middleware đặt lên header
  // request `x-nonce`). Next chỉ tự gắn nonce vào script của CHÍNH nó; khối
  // JSON-LD thiếu nonce sẽ bị trình duyệt chặn thẳng ở production.
  const nonce = requestHeaders.get("x-nonce") ?? undefined;

  // Cột phải chỉ hiện khi vùng hero đang ở trạng thái GIỚI THIỆU. Lúc form đăng
  // nhập mở, mắt chỉ nên còn đúng một việc để làm.
  const showAside = authMode === null;

  return (
    // `relative isolate`: tạo stacking context riêng để lớp sóng ô vuông
    // (HomeRipple, z âm) nằm TRÊN nền trắng của chính div này nhưng DƯỚI mọi
    // nội dung. Thiếu `isolate`, z âm rơi xuống dưới cả nền trắng và không bao
    // giờ thấy được.
    // `data-ripple-root`: mốc dừng khi HomeRipple dò ngược từ điểm chạm lên
    // xem có đè lên khối có nền tô hay chữ không (features/home/ripple/tap.ts).
    <div data-ripple-root className="bg-background relative isolate min-h-dvh">
      <HomeRipple />
      {/* Structured data — lib/seo/jsonLd.ts. Hằng số do repo sinh, đã qua
          serializeJsonLd() để không thể cắt được thẻ script. */}
      <script
        type="application/ld+json"
        nonce={nonce}
        dangerouslySetInnerHTML={{ __html: serializeJsonLd(buildHomeJsonLd()) }}
      />
      <SkipLink />
      <SiteHeader user={user} />

      {/* id + tabIndex={-1} = đích nhảy của SkipLink (WCAG 2.4.1). pb-bottom-nav
          chừa chỗ cho BottomNav; tự về 0 từ 768px. */}
      <main id="main-content" tabIndex={-1} className="pb-bottom-nav">
        <PageContainer size="full" className="flex flex-col gap-10 py-6 sm:py-10">
          {/* Hai cột chỉ khi cột phải có mặt. Lúc form đăng nhập mở, cột phải
              ẩn mà lưới vẫn hai cột thì form bị dồn sang trái nửa màn hình —
              engineer 2026-09-06: form phải nằm giữa. */}
          <div
            className={`grid items-center gap-10 ${showAside ? "lg:grid-cols-2 lg:gap-12" : ""}`}
          >
            <div className="flex flex-col gap-6">
              <HomeStage auth={authMode} signedIn={user !== null} />

              {/* Ba câu nói rõ sản phẩm làm gì, cho khách. Không đánh số: đây
                  không phải một trình tự. */}
              {!user && showAside && (
                <ul className="text-foreground flex max-w-prose flex-col gap-3 text-base">
                  {(["home.point1", "home.point2", "home.point3"] as const).map((key) => (
                    <li key={key} className="flex items-start gap-3">
                      <span aria-hidden className="bg-sun mt-2 size-2.5 shrink-0 rounded-full" />
                      <span>{t(key)}</span>
                    </li>
                  ))}
                </ul>
              )}
            </div>

            {showAside &&
              (user ? (
                exams.length > 0 && (
                  <section aria-labelledby="home-new-exams" className="flex flex-col gap-3">
                    <div className="flex items-baseline justify-between gap-4">
                      <h2 id="home-new-exams" className="text-xl font-semibold">
                        {t("home.newExams")}
                      </h2>
                      <Link
                        href="/exams"
                        className="text-primary focus-visible:ring-ring inline-flex min-h-11 items-center rounded-lg text-sm font-semibold underline-offset-4 hover:underline focus-visible:ring-3 focus-visible:outline-none"
                      >
                        {t("home.viewAllExams")}
                      </Link>
                    </div>
                    <ExamBrowser
                      exams={exams}
                      submittedExamIds={ranked.submittedExamIds}
                      isLoggedIn
                      layout="stack"
                    />
                  </section>
                )
              ) : (
                // `max-w-md` + `justify-self-end`: khối neo về mép phải cột và
                // không phình theo cột, giữ khoảng thở với khối chữ.
                <div className="w-full max-w-md lg:justify-self-end">
                  <TechStack />
                </div>
              ))}
          </div>

          {/* justify-center: engineer 2026-09-06, liên kết chân trang căn giữa
              — ngoại lệ có chủ đích của quy tắc "căn trái toàn bộ" (design doc
              §3), vì đây là dòng khép trang, không phải nội dung để đọc. */}
          <div className="border-border flex justify-center border-t pt-4">
            <AboutPrompt />
          </div>
        </PageContainer>
      </main>

      <BottomNav signedIn={Boolean(user)} />
      <SupportWidget user={user} />
    </div>
  );
}
