// ResultActions — Save PDF + Share buttons ở màn Result (Layer 2). GĐ 3 M3.1
// Task 4. S#26: icon THẬT (download/share, SVG inline đồng bộ style icon
// site) thay ô vuông trống; BỎ text hiển thị — thay bằng tooltip native
// (title) khi hover + text sr-only cho screen reader. Vẫn là placeholder
// disabled (chưa có function — sẽ gắn ở milestone sau).
// Visual "tờ giấy trắng": card hairline, KHÔNG fill màu.
//
// Renders its two buttons as siblings (no wrapping grid of its own) — the
// caller (result/page.tsx) places them inside its own 3-column row alongside
// "Return", so all three sit at the same height/width instead of Save/Share
// being sized by an aspect-square ratio that depended on a since-removed
// taller neighbor (Topics breakdown) to bound it.

const ACTIONS = [
  { key: "save", label: "Save", Icon: DownloadIcon },
  { key: "share", label: "Share", Icon: ShareIcon },
] as const;

export function ResultActions() {
  return (
    <>
      {ACTIONS.map(({ key, label, Icon }) => (
        <button
          key={key}
          type="button"
          disabled
          title={`${label} — coming soon`}
          className="flex items-center justify-center rounded-xl border border-border bg-card px-3 py-4 text-muted-foreground transition-colors hover:border-brand/40 disabled:cursor-not-allowed disabled:opacity-70"
        >
          <Icon className="size-6" />
          <span className="sr-only">{label}</span>
        </button>
      ))}
    </>
  );
}

function DownloadIcon({ className }: { className?: string }) {
  return (
    <svg viewBox="0 0 24 24" fill="none" aria-hidden className={className}>
      <path
        d="M12 4v10m0 0 4-4m-4 4-4-4"
        stroke="currentColor"
        strokeWidth="1.8"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
      <path
        d="M4 16v2a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2v-2"
        stroke="currentColor"
        strokeWidth="1.8"
        strokeLinecap="round"
      />
    </svg>
  );
}

function ShareIcon({ className }: { className?: string }) {
  return (
    <svg viewBox="0 0 24 24" fill="none" aria-hidden className={className}>
      <circle cx="6" cy="12" r="2.5" stroke="currentColor" strokeWidth="1.8" />
      <circle cx="17" cy="6" r="2.5" stroke="currentColor" strokeWidth="1.8" />
      <circle cx="17" cy="18" r="2.5" stroke="currentColor" strokeWidth="1.8" />
      <path
        d="m8.3 10.8 6.4-3.6M8.3 13.2l6.4 3.6"
        stroke="currentColor"
        strokeWidth="1.8"
        strokeLinecap="round"
      />
    </svg>
  );
}
