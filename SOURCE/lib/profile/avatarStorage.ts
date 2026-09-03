// Danh tính của object ảnh đại diện trong Storage — dùng chung giữa ĐƯỜNG GHI
// (changeAvatar, features/auth/actions.ts) và ĐƯỜNG ĐỌC (getCurrentUserProfile,
// lib/auth/getCurrentUser.ts).
//
// Vì sao là hằng số dùng chung chứ không phải một const nội bộ mỗi file như
// SCREENSHOTS_BUCKET (lib/support/actions.ts) hay IMAGES_BUCKET
// (lib/ugc/imageUrl.ts): hai tính năng đó ghi và đọc trong CÙNG một file. Ở đây
// ghi một nơi, đọc một nơi khác, và gõ lệch tên bucket giữa hai nơi không làm
// hỏng build, không làm hỏng test mock — nó chỉ làm mọi ảnh đại diện âm thầm
// tụt về initials, trông y hệt "người dùng chưa tải ảnh lên" (PRD R-f).

export const AVATARS_BUCKET = "avatars";

/** TTL của signed URL, giây. Bằng đúng SIGNED_URL_TTL_SECONDS của
 *  lib/ugc/imageUrl.ts:13 — cùng đánh đổi: đủ dài để trình duyệt còn cache được
 *  ảnh trong một phiên, đủ ngắn để một URL bị lộ không sống mãi. */
export const AVATAR_SIGNED_URL_TTL_SECONDS = 60 * 60;
