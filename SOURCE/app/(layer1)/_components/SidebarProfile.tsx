"use client";

// SidebarProfile — ô profile góc dưới-trái sidebar homepage (Layer 1, S#17
// vòng sửa 1). Chỉ render khi ĐÃ đăng nhập (guest thấy tag "Account" trong nav
// thay thế). Click → dropup (mở LÊN TRÊN vì ô nằm đáy màn hình) gồm:
//  - "Edit": đổi Tên hiển thị ngay tại chỗ qua updateProfile Server Action
//    (ràng buộc như HeaderProfile: ≤12 ký tự, chỉ chữ cái + dấu chấm — lọc lúc
//    gõ ở client, server validate lại authoritative).
//  - "Sign out": signOut Server Action → về /?auth=signin.
// Panel dropup nền ngà trên sidebar đen sơn mài (phân lớp bằng màu nền +
// hairline — DESIGN.md, không shadow). Nhãn tiếng Anh đồng bộ homepage.
import Image from "next/image";
import Link from "next/link";
import { useActionState, useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { signOut, updateProfile, type AuthState } from "@/app/(layer1)/actions";
import { useT } from "@/lib/i18n/client";

const AVATAR = "/images/user-avatar-placeholder.png";

export function SidebarProfile({ displayName: initial }: { displayName: string }) {
  const t = useT();
  const [open, setOpen] = useState(false);
  const [editing, setEditing] = useState(false);
  const [displayName, setDisplayName] = useState(initial);
  const [draft, setDraft] = useState(initial);
  const router = useRouter();
  const [state, formAction, pending] = useActionState<AuthState, FormData>(updateProfile, null);
  const wasPending = useRef(false);

  // Server Action xong (pending true → false) không lỗi → chốt tên mới, đóng
  // form, refresh data server (persist DB thật, không chỉ state ảo client).
  useEffect(() => {
    if (wasPending.current && !pending && !state?.error) {
      setDisplayName(draft);
      setEditing(false);
      router.refresh();
    }
    wasPending.current = pending;
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [pending]);

  function close() {
    setOpen(false);
    setEditing(false);
  }

  return (
    <div className="relative">
      {open && (
        <button
          aria-hidden
          tabIndex={-1}
          onClick={close}
          className="fixed inset-0 z-10 cursor-default"
        />
      )}

      {/* Trigger — avatar + tên (truncate "…"), giữ bố cục ô account cũ. */}
      <button
        type="button"
        aria-haspopup="menu"
        aria-expanded={open}
        onClick={() => setOpen((v) => !v)}
        className="flex w-full items-center gap-3 rounded-md border border-[#EDE1C8]/12 px-3 py-2.5 transition-colors hover:border-[#EDE1C8]/30"
      >
        <Image src={AVATAR} alt="" width={32} height={32} className="shrink-0 rounded-full" />
        <span className="min-w-0 flex-1 truncate text-left font-sans text-sm text-[#EDE1C8]">
          {displayName}
        </span>
        <ChevronUp open={open} />
      </button>

      {/* Dropup — mở lên trên, nền ngà đảo tông trên sidebar đen. */}
      {open && (
        <div
          role="menu"
          className="absolute bottom-full left-0 z-20 mb-2 w-full rounded-md border border-[#D8C9A8] bg-[#EDE1C8] p-1"
        >
          {!editing ? (
            <>
              <button
                type="button"
                onClick={() => {
                  setDraft(displayName);
                  setEditing(true);
                }}
                className="block w-full rounded-[4px] px-3 py-2 text-center font-sans text-sm text-[#1B1512] transition-colors hover:bg-[#E3D5B6]"
              >
                {t("common.edit")}
              </button>
              {/* My exams (UGC v2.0, Task 6.1) — giữa Edit và Sign out (D7). */}
              <Link
                role="menuitem"
                href="/me/exams"
                onClick={close}
                className="block w-full rounded-[4px] px-3 py-2 text-center font-sans text-sm text-[#1B1512] transition-colors hover:bg-[#E3D5B6]"
              >
                {t("common.myExams")}
              </Link>
              <form action={signOut}>
                <button
                  type="submit"
                  className="block w-full rounded-[4px] px-3 py-2 text-center font-sans text-sm text-[#1B1512] transition-colors hover:bg-[#E3D5B6]"
                >
                  {t("common.signOut")}
                </button>
              </form>
            </>
          ) : (
            <form action={formAction} className="flex flex-col items-center gap-2 p-2">
              <label htmlFor="sidebar-profile-display-name" className="sr-only">
                {t("common.displayName")}
              </label>
              <input
                id="sidebar-profile-display-name"
                name="displayName"
                value={draft}
                onChange={(e) => {
                  // Ràng buộc: ≤12 ký tự, chỉ chữ cái (kể cả có dấu) + dấu chấm.
                  const filtered = e.target.value.replace(/[^\p{L}.]/gu, "").slice(0, 12);
                  setDraft(filtered);
                }}
                maxLength={12}
                autoFocus
                className="w-full rounded-[4px] border border-[color:var(--input)] bg-transparent px-3 py-2 text-center font-sans text-sm text-[#1B1512] outline-none focus:border-[color:var(--ring)]"
              />
              <p className="px-1 text-center font-sans text-[0.65rem] text-[color:var(--muted-foreground)]">
                {t("common.displayNameHint")}
              </p>
              {state?.error && (
                <p className="px-1 text-center font-sans text-xs text-[#A62C2B]">{state.error}</p>
              )}
              <div className="flex w-full gap-2">
                <button
                  type="submit"
                  disabled={pending || draft.length === 0}
                  className="flex-1 rounded-full bg-[#A62C2B] px-3 py-1.5 font-sans text-xs font-medium text-[#EDE1C8] transition-colors hover:bg-[#8F2523] disabled:opacity-60"
                >
                  {pending ? t("common.saving") : t("common.save")}
                </button>
                <button
                  type="button"
                  onClick={() => setEditing(false)}
                  className="flex-1 rounded-[4px] border border-[#D8C9A8] px-3 py-1.5 font-sans text-xs text-[#1B1512] transition-colors hover:bg-[#E3D5B6]"
                >
                  {t("common.cancel")}
                </button>
              </div>
            </form>
          )}
        </div>
      )}
    </div>
  );
}

function ChevronUp({ open }: { open: boolean }) {
  return (
    <svg
      aria-hidden
      viewBox="0 0 12 8"
      className={`size-3 shrink-0 text-[#EDE1C8]/60 transition-transform ${
        open ? "rotate-180" : ""
      }`}
    >
      <path
        d="M1 6.5 6 1.5 11 6.5"
        fill="none"
        stroke="currentColor"
        strokeWidth="1.5"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </svg>
  );
}
