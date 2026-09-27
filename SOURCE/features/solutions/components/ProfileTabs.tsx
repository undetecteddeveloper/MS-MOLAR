"use client";

// ProfileTabs — hai ô "Tài khoản" / "Bình luận" ngay dưới tiêu đề trang hồ sơ
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
}

export function ProfileTabs({ activeTab }: ProfileTabsProps) {
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
    if (next === "comments") {
      params.set("tab", "comments");
    } else {
      params.delete("tab");
    }
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
      <Chip active={tab === "comments"} className="h-11" onClick={() => selectTab("comments")}>
        {t("profile.tabs.comments")}
      </Chip>
    </div>
  );
}
