// MIME → đuôi file cho khoá object trong Storage.
//
// QUY TẮC BA, và quyết định mà nó buộc phải đưa ra (Design Doc C11). Bảng ánh xạ này đã
// tồn tại hai lần — lib/support/actions.ts:22 (ba loại ảnh) và
// features/authoring/actions.ts:55 (cùng ba loại cộng application/pdf) — mỗi nơi kèm
// một comment giải thích vì sao viết ra thay vì dùng chung. changeAvatar
// sẽ là bản thứ ba, chính là lúc "hai thứ giống nhau" thành
// "một thứ trôi lệch", nên nó được tách ra ở đây.
//
// VÌ SAO NẰM DƯỚI lib/profile/ CHỨ KHÔNG PHẢI lib/ugc/ HAY lib/storage/ MỚI: hai
// bản sẵn có không phải trùng lặp tình cờ, chúng khác nhau ở TẬP được phép,
// và bản ở lib/ugc cố ý có PDF. Nâng nó vào một trong hai module đó
// nghĩa là sửa hai đường tải lên đã ship — tải đề và
// phiếu hỗ trợ — cho một thay đổi không có lý do nào khác để đụng tới chúng, và
// hướng rủi ro hơn (avatar import các hằng có kèm PDF của lib/ugc) chính là
// sai lầm mà lib/support/validateScreenshot.ts:2-3 cảnh báo. Vì thế phần
// tách ra nằm trong tính năng đã kích hoạt nó, xuất nửa dùng chung
// để hai nơi kia có thể hội tụ về đây khi một trong hai được sửa lần tới, thay vì để
// bản thứ tư xuất hiện.
//
// MIME chỉ là chuỗi do trình duyệt cung cấp; checkAvatarFile đã
// giới hạn nó trong AVATAR_LIMITS.ALLOWED_MIME trước khi tới đây.

const EXT_BY_MIME: Record<string, string> = {
  "image/png": "png",
  "image/jpeg": "jpg",
  "image/webp": "webp",
};

/** Đuôi cho khoá Storage, không có dấu chấm. MIME lạ → `"bin"`,
 *  khớp với phương án dự phòng `?? "bin"` ở lib/support/actions.ts:79 — một object
 *  có đuôi lạ thì khôi phục được, còn khoá dựng từ `undefined` thì không. */
export function extensionForMime(mime: string): string {
  return EXT_BY_MIME[mime] ?? "bin";
}
