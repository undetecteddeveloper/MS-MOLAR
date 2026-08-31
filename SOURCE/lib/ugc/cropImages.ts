// UGC Exam Upload v2.1 — crop hình câu hỏi + upload Storage (ADR-0004 + ADR-0006).
//
// Code thuần + Storage, KHÔNG gọi AI. Với mỗi câu có imageBox:
//   - Nguồn PDF: render trang bằng mupdf (WASM) rồi crop bounding box (sharp).
//     (O-4: chọn bbox-crop-từ-trang-render thống nhất cho MVP; trích ảnh
//     nhúng PDF là tối ưu hoá tương lai.)
//   - Nguồn ảnh: crop bounding box trực tiếp bằng sharp.
// v2.1: bbox theo GIAO THỨC NATIVE GEMINI — box2d [ymin,xmin,ymax,xmax] số
// nguyên 0..1000 (ADR-0006); quy đổi pixel DUY NHẤT tại boxToPixels. Khoá map
// hình + đường dẫn file mang PHẦN (ADR-0005) — tránh "Câu 1" các phần đè nhau.
// Upload exam-images/{examId}/p{part}q{n}.png qua Supabase client được inject
// (O-3: action truyền client phiên user → RLS enforced; row exams phải tồn tại
// trước — action tạo exam status='processing' trước khi gọi hàm này).
// Thất bại từng hình → IMAGE_CROP_FAILED(part, n).
//
// URL trả về: dạng object-URL ổn định cùng origin Supabase (getPublicUrl).
// Bucket private → tầng đọc (queries) đổi sang signed URL trước khi render;
// QuestionFigure chỉ allowlist origin này.

import sharp from "sharp";
import type { SupabaseClient } from "@supabase/supabase-js";
import { qKey } from "./assembleExam";
import { makeUgcError } from "./errorCopy";
import type { PipelineLogger } from "./pipelineLog";
import type { BoundingBox, ExtractedQuestion, Result, UgcError } from "./types";
import type { FileRef } from "./fileRef";
import { renderPdfPage } from "./pdf";

const BUCKET = "exam-images";

function clamp1000(v: number): number {
  return Math.min(1000, Math.max(0, v));
}

/** box2d native Gemini ([ymin,xmin,ymax,xmax] 0..1000) → vùng pixel hợp lệ
 * trong ảnh width×height (ADR-0006 — điểm quy đổi DUY NHẤT). */
export function boxToPixels(
  box: BoundingBox,
  width: number,
  height: number
): { left: number; top: number; width: number; height: number } | null {
  const [ymin, xmin, ymax, xmax] = box.box2d.map(clamp1000);
  if (ymin >= ymax || xmin >= xmax) return null;
  const px = {
    left: Math.round((xmin / 1000) * width),
    top: Math.round((ymin / 1000) * height),
    width: Math.round(((xmax - xmin) / 1000) * width),
    height: Math.round(((ymax - ymin) / 1000) * height),
  };
  if (px.width < 1 || px.height < 1) return null;
  // Không tràn mép ảnh sau khi làm tròn.
  px.width = Math.min(px.width, width - px.left);
  px.height = Math.min(px.height, height - px.top);
  if (px.width < 1 || px.height < 1) return null;
  return px;
}

/** Crop 1 hình theo bbox từ file nguồn (PDF hoặc ảnh) → PNG buffer. */
async function cropOne(file: FileRef, box: BoundingBox): Promise<Buffer> {
  const pageBytes =
    file.mediaType === "application/pdf" ? await renderPdfPage(file.bytes, box.page) : file.bytes;
  const image = sharp(Buffer.from(pageBytes));
  const meta = await image.metadata();
  if (!meta.width || !meta.height) throw new Error("Không đọc được kích thước ảnh");
  const px = boxToPixels(box, meta.width, meta.height);
  if (!px) throw new Error("Bounding box rỗng sau khi quy đổi pixel");
  return image.extract(px).png().toBuffer();
}

/** Buffer PNG -> Blob để storage-js đi nhánh FormData (giữ nguyên byte).
 *  Tách thành hàm riêng để chỗ gọi đọc được ý định, và để test ghim được đúng
 *  hình dạng body mà upload nhận. */
function pngBlob(png: Buffer): Blob {
  // `new Uint8Array(png)` chứ không phải `[png]`: kiểu của Buffer là
  // `Buffer<ArrayBufferLike>`, mà `ArrayBufferLike` gồm cả SharedArrayBuffer —
  // không thoả `BlobPart`, nên `tsc` đỏ. Bản sao này tạo một view nền
  // ArrayBuffer thật; nó SAO CHÉP byte chứ không diễn giải lại, nên không đưa
  // vào đúng cái lớp chuyển đổi mà bản vá này tồn tại để loại bỏ.
  return new Blob([new Uint8Array(png)], { type: "image/png" });
}

/**
 * Bản lenient (Task 4.1): LUÔN trả về map các hình crop THÀNH CÔNG (khoá
 * composite `part:number` — ADR-0005) + lỗi IMAGE_CROP_FAILED cho từng hình
 * fail — action dùng để persist bản nháp kèm hình nào được thì gắn hình đó
 * (re-run idempotent nhờ upsert). `multiPart` chỉ ảnh hưởng NHÃN lỗi.
 */
export async function cropImagesLenient(
  questionFile: FileRef,
  questions: ExtractedQuestion[],
  examId: string,
  supabase: SupabaseClient,
  log?: PipelineLogger,
  multiPart = false
): Promise<{ images: Map<string, string>; errors: UgcError[] }> {
  const images = new Map<string, string>();
  const errors: UgcError[] = [];

  for (const q of questions) {
    if (!q.imageBox) continue;
    const label = multiPart ? `phần ${q.part} câu ${q.number}` : `câu ${q.number}`;
    try {
      const png = await cropOne(questionFile, q.imageBox);
      const path = `${examId}/p${q.part}q${q.number}.png`;
      // BỌC Blob, KHÔNG truyền thẳng Buffer — và đây là một sửa lỗi HỎNG DỮ
      // LIỆU, không phải khẩu vị code.
      //
      // storage-js chỉ đi nhánh FormData khi body `instanceof Blob`; một Buffer
      // rơi xuống nhánh "gán thẳng vào body của fetch", và ở đó nó bị ép thành
      // CHUỖI UTF-8 rồi mã hoá lại. Mọi byte >= 0x80 không hợp lệ UTF-8 trở
      // thành U+FFFD (`ef bf bd`) — PNG hỏng vĩnh viễn ngay lúc upload.
      //
      // ĐO TRÊN PROD, không phải suy đoán (2026-08-31): tải
      // `exam-images/ugc-1dcb6d3e.../p1q9.png` về thấy HTTP 200,
      // `Content-Type: image/png`, 77.077 byte, nhưng magic number là
      // `ef bf bd 50 4e 47` thay vì `89 50 4e 47` — byte 0x89 đã bị thay bằng
      // U+FFFD. Đếm được 17.566 lần U+FFFD trong file; suy ngược ra ảnh gốc
      // ~41.9KB (77077 - 2×17566). Trình duyệt nhận đủ byte, đúng content-type,
      // nên KHÔNG có lỗi mạng nào để đọc — chỉ hiện icon ảnh vỡ.
      //
      // Vì sao lỗi này sống sót lâu: `up.error` KHÔNG BAO GIỜ nổ (upload thành
      // công thật, chỉ là sai nội dung), `png.length` log ra đúng kích thước
      // TRƯỚC khi hỏng, và mọi cổng verify đều mù với nội dung một object
      // Storage. Hai đường upload khác của repo (avatar `(layer1)/actions.ts`,
      // ảnh chụp màn hình `support/actions.ts`) không dính vì chúng truyền
      // `File` — vốn đã là Blob.
      const up = await supabase.storage.from(BUCKET).upload(path, pngBlob(png), {
        contentType: "image/png",
        upsert: true,
      });
      if (up.error) throw up.error;
      const { data } = supabase.storage.from(BUCKET).getPublicUrl(path);
      images.set(qKey(q.part, q.number), data.publicUrl);
      log?.info(`hình ${label}: cắt & lưu OK (${(png.length / 1024).toFixed(0)}KB)`);
    } catch (err) {
      errors.push(
        makeUgcError("IMAGE_CROP_FAILED", q.number, {
          partNumber: multiPart ? q.part : undefined,
        })
      );
      log?.info(`hình ${label}: LỖI — ${err instanceof Error ? err.message : String(err)}`);
    }
  }

  return { images, errors };
}

/**
 * Hợp đồng gốc (Design Doc §Contracts): ok=true → Map khoá `part:number` → URL;
 * bất kỳ hình nào fail → ok=false với IMAGE_CROP_FAILED cho từng hình lỗi.
 */
export async function cropImages(
  questionFile: FileRef,
  questions: ExtractedQuestion[],
  examId: string,
  supabase: SupabaseClient
): Promise<Result<Map<string, string>>> {
  const { images, errors } = await cropImagesLenient(questionFile, questions, examId, supabase);
  if (errors.length > 0) return { ok: false, errors };
  return { ok: true, value: images };
}
