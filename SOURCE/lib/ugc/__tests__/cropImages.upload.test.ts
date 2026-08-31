// cropImagesLenient — HÌNH DẠNG BODY gửi lên Storage (sửa lỗi hỏng dữ liệu
// 2026-08-31).
//
// VÌ SAO FILE NÀY TỒN TẠI, và GIỚI HẠN của nó — nói thẳng vì đó là cái bẫy:
//
//   Việc hỏng KHÔNG xảy ra trong code của repo. Nó xảy ra BÊN TRONG fetch:
//   storage-js chỉ đi nhánh FormData khi body `instanceof Blob`; một Buffer rơi
//   xuống nhánh gán thẳng vào body và bị ép thành chuỗi UTF-8 rồi mã hoá lại,
//   biến mọi byte >= 0x80 thành U+FFFD. Một unit test KHÔNG dựng lại được cảnh
//   đó mà không có ngăn xếp mạng thật.
//   => File này ghim HÌNH DẠNG (body phải là Blob, và byte phải đi qua nguyên
//      vẹn), chứ KHÔNG chứng minh ảnh trên prod hết hỏng. Việc đó do một lượt
//      upload thật đóng.
//
// Nhưng hình dạng ĐÚNG LÀ hợp đồng ở đây: nó là thứ DUY NHẤT phân biệt đường
// upload này với hai đường đang chạy tốt của repo (avatar, ảnh chụp màn hình),
// vốn truyền `File` — thứ vốn đã là Blob. Bằng chứng đo trên prod nằm trong
// comment tại `cropImages.ts`.

import sharp from "sharp";
import type { SupabaseClient } from "@supabase/supabase-js";
import { describe, expect, it } from "vitest";
import { cropImagesLenient } from "../cropImages";
import type { FileRef } from "../fileRef";
import type { ExtractedQuestion } from "../types";

/** 8 byte đầu của mọi PNG hợp lệ. Byte đầu 0x89 CHÍNH LÀ byte mà lỗi cũ nuốt
 *  mất: nó không hợp lệ UTF-8 nên bị thay bằng U+FFFD (`ef bf bd`). */
const PNG_MAGIC = [0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a];

/** Ảnh nguồn THẬT (sharp), không phải byte giả: bản vá phải sống sót qua đúng
 *  đường mà production đi — render → extract → .png().toBuffer(). Nền đỏ đặc
 *  cho ra PNG có nhiều byte >= 0x80, tức là có thứ để mà hỏng. */
async function sourcePng(): Promise<Buffer> {
  return sharp({
    create: { width: 64, height: 48, channels: 3, background: { r: 200, g: 30, b: 40 } },
  })
    .png()
    .toBuffer();
}

const QUESTION: ExtractedQuestion = {
  part: 1,
  number: 9,
  type: "mcq",
  stem: "Câu có hình",
  imageBox: { page: 1, box2d: [0, 0, 1000, 1000] },
};

type Captured = { path: string; body: unknown; options: unknown };

/** Client giả CHỈ ghi lại lời gọi upload. NÉM khi không có lời gọi nào — một
 *  mảng rỗng sẽ làm mọi khẳng định `for` bên dưới xanh một cách vô nghĩa. */
function fakeSupabase(captured: Captured[]): SupabaseClient {
  return {
    storage: {
      from: () => ({
        upload: async (path: string, body: unknown, options: unknown) => {
          captured.push({ path, body, options });
          return { data: { path }, error: null };
        },
        getPublicUrl: (path: string) => ({
          data: { publicUrl: `https://example.supabase.co/storage/v1/object/public/exam-images/${path}` },
        }),
      }),
    },
  } as unknown as SupabaseClient;
}

async function runCrop(): Promise<Captured> {
  const png = await sourcePng();
  const file: FileRef = { bytes: new Uint8Array(png), mediaType: "image/png" };
  const captured: Captured[] = [];
  const { images, errors } = await cropImagesLenient(
    file,
    [QUESTION],
    "exam-fixture",
    fakeSupabase(captured)
  );
  // Presence trước, value sau: nếu crop lỗi thì `errors` nuốt mất và không có
  // upload nào — khi đó mọi khẳng định về body sẽ không có gì để nói.
  expect(errors).toEqual([]);
  expect(images.size).toBe(1);
  expect(captured).toHaveLength(1);
  return captured[0];
}

describe("body gửi lên Storage là Blob, không phải Buffer thô", () => {
  it("upload nhận một Blob — nhánh DUY NHẤT storage-js giữ nguyên byte", async () => {
    const { body } = await runCrop();
    // `instanceof Blob` là chính xác vị từ storage-js dùng để chọn nhánh. Một
    // Buffer cũng là Uint8Array nên mọi khẳng định kiểu "có .length" đều mù với
    // lỗi cũ; chỉ khẳng định này bắt được.
    expect(body).toBeInstanceOf(Blob);
    expect(Buffer.isBuffer(body)).toBe(false);
  });

  it("byte đi qua NGUYÊN VẸN — magic number PNG còn đủ, kể cả byte 0x89", async () => {
    const { body } = await runCrop();
    const bytes = new Uint8Array(await (body as Blob).arrayBuffer());
    // Đây là khẳng định thật sự nói về việc hỏng dữ liệu: dưới lỗi cũ byte đầu
    // 0x89 biến thành ef bf bd và file dài thêm 2 byte cho MỖI byte >= 0x80.
    expect(Array.from(bytes.slice(0, 8))).toEqual(PNG_MAGIC);
    expect(sharp(Buffer.from(bytes)).metadata()).resolves.toMatchObject({ format: "png" });
  });

  it("không còn byte U+FFFD nào trong ảnh gửi đi", async () => {
    const { body } = await runCrop();
    const hex = Buffer.from(await (body as Blob).arrayBuffer()).toString("hex");
    // Dấu vân tay CHÍNH XÁC của lỗi trên prod: 17.566 lần `efbfbd` trong một
    // file 77KB. Không lần nào là ngưỡng đúng.
    expect(hex).not.toContain("efbfbd");
  });

  it("contentType và path giữ nguyên hợp đồng cũ (p{part}q{number}.png)", async () => {
    const { path, options, body } = await runCrop();
    // Bọc Blob KHÔNG được phép đổi thứ gì khác mà tầng đọc đang dựa vào:
    // `imagePathFromUrl` cắt theo path này, `QuestionFigure` theo content-type.
    expect(path).toBe("exam-fixture/p1q9.png");
    expect(options).toMatchObject({ contentType: "image/png", upsert: true });
    expect((body as Blob).type).toBe("image/png");
  });
});
