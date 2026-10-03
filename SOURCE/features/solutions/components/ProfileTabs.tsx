"use client";

// ProfileTabs — ba ô "Tài khoản" / "Bài giải" / "Bình luận" ngay dưới tiêu đề trang hồ sơ
// (UI Spec § Component ProfileTabs, UI-D15, AC-095). Đặt ở `features/solutions`
// chứ không `features/profile` (B4): bấm "Bình luận" gọi `markCommentsRead()`
// của tính năng này (frontend DD § UI Spec Deviations, đoạn "work plan already
// places ProfileTabs … in features/solutions/components/").
//
// `activeTab` do trang (Server Component) truyền xuống — kết quả của
// `parseProfileTab()` chạy trên `searchParams` thật, MỘT nguồn phân tích duy
// nhất cho lượt tải đầu. Trạng thái CHỌN trên màn hình sau đó là state cục bộ
// (`useState`, khởi tạo từ `activeTab`): bấm chip phải đổi `aria-pressed`
// NGAY LẬP TỨC (UI Spec "Đang chuyển ô": "chip vừa bấm đã ở trạng thái chọn —
// lạc quan"), không đợi `router.push` từ `startTransition` xong.
import { useState, useTransition } from "react";
import { usePathname, useRouter, useSearchParams } from "next/navigation";
import { t } from "@/lib/copy";
import { Chip } from "@/components/ui/chip";
import { markCommentsRead } from "@/features/solutions/actions";
import type { ProfileTab } from "@/features/solutions/lib/profileTab";

interface ProfileTabsProps {
  activeTab: ProfileTab;
  /** Số "bình luận mới" cấp hồ sơ (AC-091/AC-092, task 45) — CHA (`page.tsx`,
   *  qua `getMyUnreadCommentCount()`, KHÔNG lọc theo bài) tính sẵn đúng MỘT
   *  lần mỗi lượt render; component này không tự đếm. `undefined`/`0` ⇒ tên
   *  trợ năng giữ nguyên "Bình luận", không chấm — cùng khoá kép với
   *  `SolutionCard`'s `unreadCommentCount` (D38/AC-094: chấm là trang trí,
   *  con số nằm trong TÊN TRỢ NĂNG, không phải một khối văn bản riêng). */
  commentCount?: number;
}

export function ProfileTabs({ activeTab, commentCount }: ProfileTabsProps) {
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const [, startTransition] = useTransition();
  // Lạc quan: cập nhật NGAY khi bấm, không nằm trong startTransition (mục đó
  // chỉ bọc `router.push`, việc điều hướng thật — theo tiền lệ ExamFilters.tsx).
  const [tab, setTab] = useState<ProfileTab>(activeTab);
  // Đồng bộ khi `activeTab` đổi vì một điều hướng KHÔNG đi qua `selectTab` bên
  // dưới (ví dụ liên kết "Trả lời" của task 45) — "điều chỉnh state theo prop"
  // chạy ngay trong lượt render, không qua `useEffect` (tránh render domino,
  // react-hooks/set-state-in-effect).
  const [prevActiveTab, setPrevActiveTab] = useState(activeTab);
  if (activeTab !== prevActiveTab) {
    setPrevActiveTab(activeTab);
    setTab(activeTab);
  }

  function selectTab(next: ProfileTab) {
    setTab(next);

    const params = new URLSearchParams(searchParams.toString());
    if (next === "account") {
      params.delete("tab");
    } else {
      params.set("tab", next);
    }
    // `cpage` chỉ có nghĩa ở ô Bình luận; rời ô đó thì bỏ, khỏi kéo một tham số
    // thừa sang URL của ô khác.
    if (next !== "comments") params.delete("cpage");
    startTransition(() => {
      router.push(params.toString() ? `${pathname}?${params}` : pathname, { scroll: false });
    });

    if (next === "comments") {
      // Side-effect nền im lặng (frontend DD § UI Action - API Contract
      // Mapping, hàng `communityCommentsMarkRead`: "silent retry-next-visit —
      // no user-blocking error UI"). Không await, không hiện lỗi cho người
      // dùng dù thành công hay thất bại — thử lại tự nhiên ở lượt ghé kế tiếp.
      void markCommentsRead().catch(() => {});
    }
  }

  return (
    <div role="group" aria-label={t("profile.tabs.label")} className="flex flex-wrap gap-2">
      <Chip active={tab === "account"} className="h-11" onClick={() => selectTab("account")}>
        {t("profile.tabs.account")}
      </Chip>
      <Chip active={tab === "solutions"} className="h-11" onClick={() => selectTab("solutions")}>
        {t("profile.tabs.solutions")}
      </Chip>
      <Chip
        active={tab === "comments"}
        className="h-11"
        onClick={() => selectTab("comments")}
        aria-label={
          commentCount !== undefined && commentCount > 0
            ? t("profile.tabs.commentsA11y", { count: commentCount })
            : undefined
        }
      >
        {t("profile.tabs.comments")}
        {commentCount !== undefined && commentCount > 0 && (
          <span aria-hidden className="bg-destructive size-2 rounded-full" />
        )}
      </Chip>
    </div>
  );
}
