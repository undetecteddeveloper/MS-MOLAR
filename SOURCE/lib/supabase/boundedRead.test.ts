// Cổng canh cho biên đọc danh sách (P3). Thứ được bảo vệ ở đây KHÔNG phải "hàm
// trả đúng mảng" mà là CƠ CHẾ PHÁT HIỆN: một thay đổi vô tình làm tripwire ngừng
// nổ sẽ đưa dự án về đúng trạng thái trước P3 — bị cắt cụt trong im lặng — và
// không có test nào khác trong repo hỏi tới chuyện đó.
import { afterEach, describe, expect, it, vi } from "vitest";

import { LIST_ROW_CEILING, POSTGREST_MAX_ROWS, readBounded } from "./boundedRead";

/** Query giả: ghi lại `limit` đã nhận rồi trả về `rowCount` dòng. */
function fakeQuery(rowCount: number) {
  const calls: number[] = [];
  return {
    calls,
    limit(count: number) {
      calls.push(count);
      // Trả về tối đa `count` dòng — đúng hành vi PostgREST: nó cắt theo limit
      // nhỏ hơn giữa limit của client và max_rows của server.
      const n = Math.min(count, rowCount);
      return Promise.resolve({
        data: Array.from({ length: n }, (_, i) => ({ i })),
        error: null,
      });
    },
  };
}

afterEach(() => {
  vi.restoreAllMocks();
});

describe("readBounded", () => {
  it("xin đúng LIST_ROW_CEILING + 1 dòng — dòng mồi là toàn bộ cơ chế phát hiện", async () => {
    const q = fakeQuery(10);
    await readBounded("test", q);
    // Ghim con số THẬT gửi đi, không chỉ "có gọi limit": xin đúng bằng trần thì
    // hàm không bao giờ phân biệt được "đủ trần" với "vượt trần", và tripwire
    // chết trong im lặng đúng kiểu hỏng mà nó được viết ra để chặn.
    expect(q.calls).toEqual([LIST_ROW_CEILING + 1]);
  });

  it("dưới trần: trả đủ dòng, không báo động", async () => {
    const spy = vi.spyOn(console, "error").mockImplementation(() => {});
    const rows = await readBounded("test", fakeQuery(3));
    expect(rows).toHaveLength(3);
    expect(spy).not.toHaveBeenCalled();
  });

  it("ĐÚNG bằng trần: vẫn không báo động (ranh giới off-by-one)", async () => {
    const spy = vi.spyOn(console, "error").mockImplementation(() => {});
    const rows = await readBounded("test", fakeQuery(LIST_ROW_CEILING));
    expect(rows).toHaveLength(LIST_ROW_CEILING);
    // Đúng trần nghĩa là dòng mồi KHÔNG được giao → dữ liệu vừa đủ, không thiếu.
    // Báo động ở đây là báo động giả, và báo động giả là cách nhanh nhất để một
    // cổng canh bị người ta tắt đi (cùng bài học với `checkSchemaVersion` phân
    // biệt `mismatch` với `unknown`).
    expect(spy).not.toHaveBeenCalled();
  });

  it("vượt trần: cắt về đúng trần và báo động KÈM label", async () => {
    const spy = vi.spyOn(console, "error").mockImplementation(() => {});
    const rows = await readBounded("listExams", fakeQuery(LIST_ROW_CEILING + 1));

    // Trả về `LIST_ROW_CEILING`, KHÔNG phải +1: dòng mồi là dụng cụ đo, để nó
    // lọt ra ngoài là làm sai lệch chính dữ liệu mà nó đi kiểm.
    expect(rows).toHaveLength(LIST_ROW_CEILING);
    expect(spy).toHaveBeenCalledTimes(1);
    const msg = String(spy.mock.calls[0][0]);
    // Label phải có trong log: người đọc log cần biết đi sửa query NÀO, và stack
    // trace của một Server Component không nói được điều đó.
    expect(msg).toContain("listExams");
    expect(msg).toContain(String(LIST_ROW_CEILING));
  });

  it("ném lỗi hạ tầng — giữ quy ước throw-on-infrastructure-error của queries.ts", async () => {
    const err = { code: "42501", message: "permission denied" };
    const q = { limit: () => Promise.resolve({ data: null, error: err }) };
    await expect(readBounded("test", q)).rejects.toBe(err);
  });

  it("data null (không kèm error) → mảng rỗng, không nổ", async () => {
    const q = { limit: () => Promise.resolve({ data: null, error: null }) };
    await expect(readBounded("test", q)).resolves.toEqual([]);
  });
});

describe("bất biến giữa trần ứng dụng và trần PostgREST", () => {
  it("LIST_ROW_CEILING + 1 phải NHỎ HƠN HẲN POSTGREST_MAX_ROWS", async () => {
    // Đây là case quan trọng nhất của cả file, và nó bảo vệ một thứ không nằm
    // trong repo: cấu hình `max_rows` của Supabase.
    //
    // Dòng mồi chỉ được giao khi `LIST_ROW_CEILING + 1 <= max_rows`. Nâng
    // LIST_ROW_CEILING sát trần PostgREST (vd 1000) thì PostgREST cắt ở 1000
    // TRƯỚC khi dòng mồi kịp tới, `rows.length` bằng đúng trần, tripwire kết luận
    // "vừa đủ, không thiếu" — và mọi lệnh đọc quay về bị cắt cụt trong im lặng,
    // trong khi test ở trên vẫn xanh vì chúng dùng query giả.
    //
    // Nên: ai nâng LIST_ROW_CEILING vì "danh sách chạm trần rồi" sẽ dừng ở đây và
    // đọc được lý do vì sao nâng trần KHÔNG phải câu trả lời — phân trang thật mới là.
    expect(LIST_ROW_CEILING + 1).toBeLessThanOrEqual(POSTGREST_MAX_ROWS);
    // Đòi thêm dư địa 2×, không chỉ vừa khít: `max_rows` đổi được từ dashboard
    // Supabase mà không ai phải sửa một dòng code nào, nên một biên vừa-khít là
    // một biên chờ hỏng.
    expect(LIST_ROW_CEILING * 2).toBeLessThanOrEqual(POSTGREST_MAX_ROWS);
  });
});
