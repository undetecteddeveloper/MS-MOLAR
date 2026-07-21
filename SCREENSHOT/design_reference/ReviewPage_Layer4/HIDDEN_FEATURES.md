# Hidden / non-visible features — File Review prototype

Features that exist in the interaction logic but aren't visible in a static screenshot.

## Pending tab
- **Hover tooltip**: hovering any row shows "Nhấp chuột phải để mở tác vụ" (right-click to open actions), following the cursor position.
- **Right-click context menu**: right-clicking a row opens a floating menu (Chỉnh sửa / Xóa) positioned exactly at the click point, not in a fixed layout slot.
- **Tooltip suppression**: hovering the Publish button suppresses the row tooltip; right-clicking the Publish button is blocked from opening the row's context menu.
- **Click-outside to close**: an invisible full-screen overlay closes the open context menu when clicking anywhere else.
- **Publish action**: clicking "Xuất bản" moves the file to the Published tab and stamps it with the current date/time (no page reload, local state only).
- **Delete action**: "Xóa" in the context menu removes the file from state immediately.
- **Internal scroll**: the file list scrolls within its own container (max-height, capped) instead of growing the page — the outer page never needs to scroll to see more files.

## Published tab
- Same row hover/scroll behavior as Pending, minus the context menu and Publish button (published files are read-only) — instead shows the "Xuất bản {date}" timestamp and a static Published badge.

## General
- Tab switching (Pending/Published) and all hover/press states use short CSS transitions (200–300ms) rather than instant snaps.
- Tab style (underline vs boxed), file icons, and sort order (newest/oldest first) are exposed as tweakable props, not user-facing UI controls.
