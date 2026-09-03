// UGC Exam Upload v2.0 — chuyển image_url lưu trong DB → signed URL (Task 4.2/5.1).
//
// DB lưu URL object ổn định cùng origin Supabase (dạng getPublicUrl) nhưng
// bucket exam-images là PRIVATE — <img> trong browser không gửi được header
// auth, nên tầng đọc phải đổi sang SIGNED URL trước khi đưa xuống client.
// Tạo signed URL qua client PHIÊN USER → RLS select trên storage.objects vẫn
// là tầng cưỡng chế (non-author không sign được hình đề chưa published);
// QuestionFigure allowlist origin Supabase nên signed URL đi qua được.

import type { SupabaseClient } from "@supabase/supabase-js";

const IMAGES_BUCKET = "exam-images";
const SIGNED_URL_TTL_SECONDS = 60 * 60; // 1h — đủ một phiên làm bài/review

/** Path object trong bucket từ URL đã lưu (`.../exam-images/{examId}/qN.png`). */
export function imagePathFromUrl(url: string): string | null {
  try {
    const m = /\/exam-images\/(.+)$/.exec(new URL(url).pathname);
    return m?.[1] ?? null;
  } catch {
    return null;
  }
}

/** URL lưu trong DB → signed URL cho <img>; fail → undefined (fail closed). */
export async function resolveSignedImageUrl(
  supabase: SupabaseClient,
  storedUrl: string | null | undefined
): Promise<string | undefined> {
  if (!storedUrl) return undefined;
  const path = imagePathFromUrl(storedUrl);
  if (!path) return undefined;
  const { data } = await supabase.storage
    .from(IMAGES_BUCKET)
    .createSignedUrl(path, SIGNED_URL_TTL_SECONDS);
  return data?.signedUrl ?? undefined;
}

/**
 * Ký CẢ LOẠT trong MỘT lượt gọi Storage (`createSignedUrls`) — dùng khi một
 * màn hình có nhiều ảnh (đề 40 câu có hình = 40 round-trip nếu ký từng cái,
 * dù đã chạy song song bằng Promise.all thì vẫn là 40 request tới Storage).
 *
 * Trả về Map `storedUrl → signedUrl | undefined`, tra theo ĐÚNG chuỗi đã lưu
 * trong DB (không phải path), để chỗ gọi thay `await resolveSignedImageUrl(sb,
 * row.image_url)` bằng `signed.get(row.image_url)` mà không phải bóc path.
 *
 * FAIL CLOSED y như bản ký từng ảnh, và ở MỌI tầng (ADR-0016):
 *   - URL rỗng / không bóc được path → không có trong Map (get() trả undefined);
 *   - một mục ký hỏng (không tồn tại, RLS từ chối) → Storage trả `error` THEO
 *     TỪNG MỤC, mục đó là undefined, các ảnh còn lại vẫn có URL;
 *   - cả lô hỏng (mạng, 4xx toàn cục) hoặc ném → MỌI mục undefined, KHÔNG ném
 *     tiếp — một ảnh vỡ không được phép làm hỏng cả trang.
 * Ký bằng client PHIÊN USER như bản cũ, nên RLS `exam_images_select` vẫn là
 * tầng cưỡng chế: non-author không ký được hình của đề chưa published.
 *
 * Giữ nguyên `resolveSignedImageUrl` cho chỗ chỉ cần một ảnh.
 */
export async function resolveSignedImageUrls(
  supabase: SupabaseClient,
  storedUrls: ReadonlyArray<string | null | undefined>
): Promise<Map<string, string | undefined>> {
  const signedByUrl = new Map<string, string | undefined>();
  const pathByUrl = new Map<string, string>();
  for (const url of storedUrls) {
    if (!url || pathByUrl.has(url)) continue;
    const path = imagePathFromUrl(url);
    if (path) pathByUrl.set(url, path);
  }
  if (pathByUrl.size === 0) return signedByUrl;

  // Hai URL lưu khác nhau có thể trỏ cùng một path (cùng object, token cũ khác
  // nhau) — ký mỗi path đúng một lần rồi chia lại cho các URL.
  const paths = [...new Set(pathByUrl.values())];
  const signedByPath = new Map<string, string>();
  try {
    const { data, error } = await supabase.storage
      .from(IMAGES_BUCKET)
      .createSignedUrls(paths, SIGNED_URL_TTL_SECONDS);
    if (error) {
      console.warn("[resolveSignedImageUrls] ký cả lô hỏng:", error.message);
    } else {
      for (const item of data ?? []) {
        if (item.path && item.signedUrl && !item.error) {
          signedByPath.set(item.path, item.signedUrl);
        }
      }
    }
  } catch (err) {
    console.warn("[resolveSignedImageUrls] Storage không kết nối được:", err);
  }
  for (const [url, path] of pathByUrl) signedByUrl.set(url, signedByPath.get(path));
  return signedByUrl;
}
