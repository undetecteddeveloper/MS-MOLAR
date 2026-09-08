import { describe, expect, it } from "vitest";
import { normalizeSearch, SEARCH_MAX_LENGTH, toSearchTerm } from "../normalize";

describe("normalizeSearch", () => {
  it("thường hoá và bỏ dấu chữ Việt, kể cả chữ hai dấu", () => {
    expect(normalizeSearch("Toán 10")).toBe("toan 10");
    expect(normalizeSearch("KIỂM TRA CUỐI HỌC KÌ 2")).toBe("kiem tra cuoi hoc ki 2");
    expect(normalizeSearch("Hóa Học — Nguyên tử & Bảng tuần hoàn")).toBe(
      "hoa hoc nguyen tu bang tuan hoan"
    );
    expect(normalizeSearch("ấ ầ ẩ ẫ ậ ế ề ể ễ ệ ố ồ ổ ỗ ộ ớ ờ ở ỡ ợ ứ ừ ử ữ ự")).toBe(
      "a a a a a e e e e e o o o o o o o o o o u u u u u"
    );
  });

  it("đổi đ/Đ thành d — chữ này không phân rã được bằng NFD", () => {
    expect(normalizeSearch("Đề Địa lý")).toBe("de dia ly");
  });

  it("cho cùng kết quả với chuỗi NFC lẫn NFD", () => {
    const nfc = "Đề luyện Vật Lý 10".normalize("NFC");
    const nfd = "Đề luyện Vật Lý 10".normalize("NFD");
    expect(normalizeSearch(nfd)).toBe(normalizeSearch(nfc));
    expect(normalizeSearch(nfc)).toBe("de luyen vat ly 10");
  });

  it("đổi mọi ký tự không phải chữ/số thành dấu cách, gộp khoảng trắng, cắt hai đầu", () => {
    expect(normalizeSearch("[e1-manual-pass] Đề nguyên hàm (sai)")).toBe(
      "e1 manual pass de nguyen ham sai"
    );
    expect(normalizeSearch("  toán   10  ")).toBe("toan 10");
    // Ký tự đặc biệt của LIKE và của bộ lọc PostgREST không bao giờ lọt ra.
    expect(normalizeSearch("100% _toán_ \\ (a,b)")).toBe("100 toan a b");
  });
});

describe("toSearchTerm", () => {
  it("trả null khi rỗng hoặc quá ngắn sau chuẩn hoá", () => {
    expect(toSearchTerm(undefined)).toBeNull();
    expect(toSearchTerm("")).toBeNull();
    expect(toSearchTerm("   ")).toBeNull();
    expect(toSearchTerm("a")).toBeNull();
    expect(toSearchTerm("!!!")).toBeNull();
  });

  it("trả từ khoá đã chuẩn hoá khi đủ dài", () => {
    expect(toSearchTerm("Toán")).toBe("toan");
    expect(toSearchTerm("  Hóa học 10 ")).toBe("hoa hoc 10");
  });

  it("cắt chuỗi thô về trần độ dài TRƯỚC khi chuẩn hoá", () => {
    const long = "a".repeat(SEARCH_MAX_LENGTH + 50);
    expect(toSearchTerm(long)).toBe("a".repeat(SEARCH_MAX_LENGTH));
  });
});
