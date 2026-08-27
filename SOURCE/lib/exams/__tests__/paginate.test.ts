// paginateExams — phép số học phân trang của /exams (TD-026, 2026-08-27).
//
// Vì sao canh riêng phép số học này thay vì chỉ canh qua `listExamsRanked`:
// off-by-one trong phân trang là kiểu hỏng KHÔNG NHÌN RA ĐƯỢC. Một trang bỏ
// sót đúng một đề, hoặc lặp lại đề cuối của trang trước, vẫn cho ra một lưới
// đầy thẻ trông hoàn toàn bình thường — cùng hình dạng im lặng với chính món
// nợ TD-026 (danh sách bị cắt cụt, status 200, không cảnh báo).
//
// BẤT BIẾN QUAN TRỌNG NHẤT ở đây là bất biến CUỐI: cắt trang KHÔNG được sắp
// xếp lại gì cả. Đó là toàn bộ khác biệt giữa đường "xếp-rồi-cắt" đã chọn và
// đường "cắt-rồi-xếp" đã loại — và nếu nó vỡ thì ADR-0015 vỡ theo, trong im
// lặng, vì "thứ tự sai" trông y hệt "thứ tự đúng" với người không biết thứ tự
// đúng là gì.
//
// @category: core-functionality
// @dependency: none — hàm thuần, không I/O, không mock

import { describe, expect, it } from "vitest";
import { EXAMS_PAGE_SIZE, paginateExams } from "@/lib/exams/paginate";

/** Danh sách đã SẮP THỨ TỰ sẵn — mô phỏng output của `rankExamIds`. */
const ordered = (n: number) => Array.from({ length: n }, (_, i) => `exam-${i}`);

describe("paginateExams — số học trang", () => {
  it("trang đầy: đúng EXAMS_PAGE_SIZE phần tử, bắt đầu từ phần tử đầu", () => {
    const r = paginateExams(ordered(30), 1);

    expect(r.exams).toHaveLength(EXAMS_PAGE_SIZE);
    expect(r.exams[0]).toBe("exam-0");
    expect(r.exams.at(-1)).toBe(`exam-${EXAMS_PAGE_SIZE - 1}`);
    expect(r.total).toBe(30);
  });

  it("trang giữa nối liền trang trước, không hở không chồng", () => {
    const all = ordered(30);
    const p1 = paginateExams(all, 1).exams;
    const p2 = paginateExams(all, 2).exams;
    const p3 = paginateExams(all, 3).exams;

    // Ghép ba trang lại phải ra ĐÚNG danh sách gốc — đây là phép kiểm bắt được
    // cả phần tử bị bỏ sót lẫn phần tử bị lặp, thứ mà so từng trang rời không
    // bắt được.
    expect([...p1, ...p2, ...p3]).toEqual(all);
  });

  it("trang cuối lẻ chỉ chứa phần dư", () => {
    const r = paginateExams(ordered(EXAMS_PAGE_SIZE + 3), 2);

    expect(r.exams).toHaveLength(3);
    expect(r.pageCount).toBe(2);
  });

  it("bội số chẵn KHÔNG sinh thêm một trang rỗng ở cuối", () => {
    // Lỗi kinh điển của `Math.floor(total / size) + 1`.
    const r = paginateExams(ordered(EXAMS_PAGE_SIZE * 2), 1);

    expect(r.pageCount).toBe(2);
  });

  it("danh sách rỗng vẫn là trang 1/1, không phải 1/0", () => {
    const r = paginateExams([], 1);

    expect(r.exams).toEqual([]);
    expect(r.page).toBe(1);
    expect(r.pageCount).toBe(1);
    expect(r.total).toBe(0);
  });
});

describe("paginateExams — kẹp trang vào khoảng hợp lệ", () => {
  it.each([
    ["quá lớn", 999, 3],
    ["số không", 0, 1],
    ["âm", -5, 1],
    ["NaN", Number.NaN, 1],
    ["phân số", 2.7, 2],
  ])("%s → trang %s được kẹp về %s", (_label, input, expected) => {
    // Không trả trang RỖNG cho `?page` ngoài khoảng: một URL cũ (đề bị gỡ bớt)
    // hay một lần gõ tay phải cho thấy đề, không phải một lưới trắng im lặng.
    const r = paginateExams(ordered(30), input as number);

    expect(r.page).toBe(expected);
    expect(r.exams.length).toBeGreaterThan(0);
  });
});

describe("paginateExams — KHÔNG sắp xếp lại (bất biến của ADR-0015)", () => {
  it("giữ nguyên thứ tự đã nhận, kể cả khi thứ tự đó không theo quy luật nào", () => {
    // Thứ tự cố ý XÁO TRỘN: đây là hình dạng thật của output `rankExamIds`
    // (điểm cá nhân hoá), không phải một dãy tăng dần. Một cài đặt lỡ tay
    // sort/reverse trong lúc cắt sẽ xanh với dãy tăng dần và đỏ ở đây.
    const ranked = ["z", "m", "a", "q", "b"];

    const p1 = paginateExams(ranked, 1);

    expect(p1.exams).toEqual(ranked);
  });

  it("thứ tự trong từng trang khớp lát cắt tương ứng của danh sách gốc", () => {
    const ranked = ordered(EXAMS_PAGE_SIZE * 2).reverse();

    expect(paginateExams(ranked, 2).exams).toEqual(
      ranked.slice(EXAMS_PAGE_SIZE, EXAMS_PAGE_SIZE * 2)
    );
  });
});
