// /profile — avatar input limits (Design Doc profile-and-about-design.md
// §Backend contracts; ADR-0016 §Decision).
//
// VÌ SAO ĐÂY KHÔNG PHẢI MỘT PHẦN BỔ SUNG CHO lib/ugc/limits.ts, nơi đã chứa mọi
// trần tải lên khác trong repo này: `LIMITS.ALLOWED_MIME` của module đó
// có `application/pdf`, vì nó phục vụ việc tải đề. Ai với tay lấy hằng gần nhất ở đó
// chỉ cách một lần autocomplete là cho một PDF lọt vào làm ảnh đại diện.
// `lib/support/validateScreenshot.ts:2-3` đã phải viết lời cảnh báo đó ra một lần —
// file này là cùng lời cảnh báo ấy dưới dạng một module riêng thay vì một comment mà ai đó phải đọc.
//
//MAX_BYTES và ALLOWED_MIME được phản chiếu, kèm trích dẫn, bởi mục `avatars`
// trong supabase/setup-storage.ts. Bản phản chiếu đó là chốt chặn ở tầng Storage
// (PRD AC-035); điểm cưỡng chế thật là Server Action (AC-027–AC-030).

export const AVATAR_LIMITS = {
  MAX_BYTES: 2 * 1024 * 1024,
  ALLOWED_MIME: ["image/jpeg", "image/png", "image/webp"] as const,
} as const;

export type AllowedAvatarMime = (typeof AVATAR_LIMITS.ALLOWED_MIME)[number];
