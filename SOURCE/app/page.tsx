import { headers } from "next/headers";
import { redirect } from "next/navigation";
import { AboutPrompt } from "@/features/auth/components/AboutPrompt";
import { HomeStage, type AuthMode } from "@/features/auth/components/HomeStage";
import { HeroGrid } from "@/features/auth/components/HeroGrid";
import { TechStack } from "@/features/auth/components/TechStack";
import { HomeRipple } from "@/features/home/ripple/HomeRipple";
import { LatestSolutionsSpotlight } from "@/features/home/components/LatestSolutionsSpotlight";
import { PersonalProgressStrip } from "@/features/home/components/PersonalProgressStrip";
import { ExamBrowser } from "@/features/exams/components/ExamBrowser";
import { listHotExams } from "@/features/exams/queries/shelves";
import { listLatestSolutionsForHome } from "@/features/solutions/queries";
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
//   - đã vào → ba đề NỔI NHẤT toàn site (F-001, kệ Nổi nhất thu gọn — xem
//              docs/design/exam-shelves-backend-design.md § Integration Point
//              I5), thẻ thật, bấm được. Người đã đăng nhập mở trang chủ là để
//              làm đề, nên đường tới đề ngắn nhất có thể.
// Dưới 1024px cả hai rơi xuống dưới khối chữ theo đúng thứ tự DOM.
//
// BA KHỐI FULL-WIDTH thêm bên dưới lưới hai cột, CHỈ đã đăng nhập (F-041,
// 2026-09-30 — trang chủ "bớt đơn điệu" sau khi kho đề chuyển hẳn sau đăng
// nhập): dải tiến độ cá nhân (PersonalProgressStrip, tính lại KHÔNG tốn lượt
// đọc thêm), kệ lời giải cộng đồng mới nhất (LatestSolutionsSpotlight, RPC
// riêng schema.sql §26 — cá nhân hoá theo eligibility, không phải feed chung),
// rồi TechStack (dời từ cột phải-chỉ-cho-khách sang một dải chung cho MỌI
// người đã đăng nhập).
//
// KHÔNG dùng AppShell: trang này công khai và có redirect riêng, còn AppShell
// đọc entitlement cho người đã đăng nhập — hai lý do đủ để khung tự dựng.
const HOME_EXAM_COUNT = 3;

/** Số bài giải hiện trong LatestSolutionsSpotlight — xem khối comment F-041 ở trên. */
const HOME_SOLUTIONS_COUNT = 3;

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

  // Ba đề đầu của kệ Nổi nhất (F-001) + kệ lời giải cộng đồng mới nhất (F-041)
  // — GUARD bằng `user` CẢ HAI: RPC `exam_hot_counts` và
  // `community_solutions_latest_for_home` đều thu hồi quyền `anon` (backend DD
  // § Integration Point I5; schema.sql §26), nên một lượt gọi không canh sẽ
  // 42501/lỗi quyền và thay hero cho khách bằng trang lỗi. Khách chưa đăng
  // nhập không bao giờ chạm hai lượt đọc này — chạy SONG SONG (không phụ thuộc
  // nhau) khi đã có `user`.
  const [hot, latestSolutions] = user
    ? await Promise.all([
        listHotExams(HOME_EXAM_COUNT),
        listLatestSolutionsForHome(HOME_SOLUTIONS_COUNT),
      ])
    : [null, null];

  // Nonce CSP của lượt request này (proxy.ts sinh, middleware đặt lên header
  // request `x-nonce`). Next chỉ tự gắn nonce vào script của CHÍNH nó; khối
  // JSON-LD thiếu nonce sẽ bị trình duyệt chặn thẳng ở production.
  const nonce = requestHeaders.get("x-nonce") ?? undefined;

  // Một mốc cho cả lượt render (relativeTime trong LatestSolutionsSpotlight) —
  // hai lần gọi `new Date()` khác nhau ở server và lúc hydrate sẽ in ra hai
  // chuỗi khác nhau (cùng quy ước SolutionCard).
  const now = new Date();

  // Cột phải chỉ hiện khi vùng hero đang ở trạng thái GIỚI THIỆU. Lúc form đăng
  // nhập mở, mắt chỉ nên còn đúng một việc để làm.
  const showAside = authMode === null;

  return (
    // `relative isolate`: tạo stacking context riêng để lớp sóng ô vuông
    // (HomeRipple, z âm) nằm TRÊN nền của chính div này nhưng DƯỚI mọi nội
    // dung. Thiếu `isolate`, z âm rơi xuống dưới cả nền và không bao giờ thấy
    // được.
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
        {/* Đệm TRÊN nhỏ hơn đệm dưới (engineer 2026-09-13, test trên điện thoại
            thật: "nâng cụm hero cao hơn một chút") — hero đứng sát navbar hơn,
            đệm dưới giữ nguyên để chân trang không dâng theo. */}
        <PageContainer size="full" className="flex flex-col gap-10 pt-3 pb-6 sm:pt-6 sm:pb-10">
          {/* Hai cột chỉ khi cột phải có mặt. Lúc form đăng nhập mở, cột phải
              ẩn mà lưới vẫn hai cột thì form bị dồn sang trái nửa màn hình —
              engineer 2026-09-06: form phải nằm giữa. */}
          {/* `grid-cols-1` (= minmax(0,1fr)) là lớp CHẶN TRÀN mobile, không phải
              trang trí: lưới không khai cột thì cột ngầm là `auto`, và `auto`
              không co dưới min-content của con — tiêu đề thẻ đề `truncate`
              (nowrap) có min-content bằng cả tên đề, nên cột phình rộng hơn màn
              hình và kéo mọi thẻ ra khỏi mép phải. `overflow-x: hidden` ở
              globals.css chỉ che thanh cuộn, không trả lại bề rộng. */}
          <div
            className={`relative isolate grid grid-cols-1 items-center gap-10 ${showAside ? "lg:grid-cols-2 lg:gap-12" : ""}`}
          >
            {/* Lưới caro nền (chỉ điện thoại): ôm khoảng trống cạnh nút chính và tràn xuống
                cụm "Đề nổi nhất", nét ở đó mờ hơn. Ẩn khi form đăng nhập đang mở. */}
            {authMode === null && <HeroGrid />}
            <div className="flex flex-col gap-6">
              <HomeStage auth={authMode} signedIn={user !== null} />

              {/* Ba câu nói rõ sản phẩm làm gì, cho khách. Không đánh số: đây
                  không phải một trình tự. `.motion-hero-item` nối tiếp lead
                  (0) + CTA (1) của HomeStage — chỉ số 2/3/4 (F-041,
                  2026-09-30). */}
              {!user && showAside && (
                <ul className="text-foreground flex max-w-prose flex-col gap-3 text-base">
                  {(["home.point1", "home.point2", "home.point3"] as const).map((key, index) => (
                    <li
                      key={key}
                      className="motion-hero-item flex items-start gap-3"
                      style={{ "--motion-i": index + 2 } as React.CSSProperties}
                    >
                      <span
                        aria-hidden
                        className="bg-sun glow-sun mt-2 size-2.5 shrink-0 rounded-full"
                      />
                      <span>{t(key)}</span>
                    </li>
                  ))}
                </ul>
              )}
            </div>

            {showAside &&
              (user ? (
                hot !== null &&
                hot.exams.length > 0 && (
                  <section aria-labelledby="home-new-exams" className="flex flex-col gap-3">
                    <h2 id="home-new-exams" className="text-xl font-semibold">
                      {t("home.hotExams")}
                    </h2>
                    <ExamBrowser
                      exams={hot.exams}
                      submittedExamIds={hot.submittedExamIds}
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

          {/* Ba khối full-width, chỉ đã đăng nhập (F-041) — dưới lưới hai cột,
              trên dòng chân trang. Tiến độ của bạn → Lời giải cộng đồng mới
              nhất → TechStack: hành động trước, thông tin nền sau. */}
          {user && hot && (
            <PersonalProgressStrip
              totalCompleted={hot.totalSubmittedCount}
              topSubject={hot.topSubject}
            />
          )}

          {user && latestSolutions && latestSolutions.length > 0 && (
            <LatestSolutionsSpotlight items={latestSolutions} now={now} />
          )}

          {/* `max-w-2xl mx-auto`: TechStack dựng cho cột hẹp cạnh hero (guest) —
              thả thẳng vào PageContainer size="full" (max-w-6xl) sẽ kéo bốn ô
              vận hành rộng quá khổ. Giữ nguyên bề rộng gốc, chỉ đổi chỗ đứng. */}
          {user && (
            <div className="mx-auto w-full max-w-2xl">
              <TechStack />
            </div>
          )}

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
