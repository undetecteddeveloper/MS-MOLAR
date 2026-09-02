// passageBlanks — cắt bài đọc quanh CHỖ TRỐNG để màn làm bài điền được đáp án
// vào giữa câu văn (2026-09-02).

import { describe, expect, it } from "vitest";
import {
  mapBlanksToQuestions,
  splitPassageBlanks,
  splitPassageParagraphs,
} from "../passageBlanks";

describe("splitPassageParagraphs", () => {
  it("cắt theo dòng trống", () => {
    expect(splitPassageParagraphs("Đoạn một.\n\nĐoạn hai.")).toEqual(["Đoạn một.", "Đoạn hai."]);
  });

  it("xuống dòng đơn KHÔNG cắt — markdown vốn coi đó là cùng một đoạn", () => {
    expect(splitPassageParagraphs("dòng một\ndòng hai")).toEqual(["dòng một\ndòng hai"]);
  });

  it("bài không có dòng trống nào vẫn ra đúng một đoạn", () => {
    expect(splitPassageParagraphs("chỉ một đoạn")).toEqual(["chỉ một đoạn"]);
    expect(splitPassageParagraphs("   ")).toEqual([]);
  });
});

describe("splitPassageBlanks — định dạng chuẩn (prompt đã pin)", () => {
  it('"(34) ____" — số đứng trước, nuốt cả nhãn vào chỗ trống', () => {
    expect(splitPassageBlanks("thousands of students (34) ____ up for it.")).toEqual([
      { kind: "text", text: "thousands of students " },
      { kind: "blank", number: 34 },
      { kind: "text", text: " up for it." },
    ]);
  });

  it("nhiều chỗ trống trong một đoạn, giữ đúng thứ tự đọc", () => {
    const chunks = splitPassageBlanks("a (1) ___ b (2) ___ c");
    expect(chunks.filter((c) => c.kind === "blank")).toEqual([
      { kind: "blank", number: 1 },
      { kind: "blank", number: 2 },
    ]);
  });
});

describe("splitPassageBlanks — các định dạng đã nằm sẵn trong DB", () => {
  it("chấp nhận [34], 34., 34)", () => {
    expect(splitPassageBlanks("x [34] ____ y")[1]).toEqual({ kind: "blank", number: 34 });
    expect(splitPassageBlanks("x 34. ____ y")[1]).toEqual({ kind: "blank", number: 34 });
    expect(splitPassageBlanks("x 34) ____ y")[1]).toEqual({ kind: "blank", number: 34 });
  });

  it("số đứng SAU chỗ trống, chỉ khi có ngoặc", () => {
    expect(splitPassageBlanks("x ____ (34) y")[1]).toEqual({ kind: "blank", number: 34 });
    // "____ 34." gần như luôn là chỗ trống rồi tới câu 34 của phần kế tiếp.
    expect(splitPassageBlanks("x ____ 34. y")[1]).toEqual({ kind: "blank", number: null });
  });

  it("chỗ trống KHÔNG đánh số vẫn là chỗ trống", () => {
    expect(splitPassageBlanks("students ______ up")).toEqual([
      { kind: "text", text: "students " },
      { kind: "blank", number: null },
      { kind: "text", text: " up" },
    ]);
  });

  it("chỉ cần hai gạch dưới — đề in font hẹp hay rút ngắn dãy gạch", () => {
    expect(splitPassageBlanks("a __ b")[1]).toEqual({ kind: "blank", number: null });
  });
});

describe("splitPassageBlanks — chỗ KHÔNG được nhận nhầm", () => {
  it("số trần trong câu văn không bị nuốt làm nhãn", () => {
    // "in 34 ____": 34 là một phần câu văn. Nhận nó làm nhãn nghĩa là xoá chữ
    // số khỏi bài đọc để đổi lấy một cái nhãn đoán mò.
    expect(splitPassageBlanks("in 34 ____ years")).toEqual([
      { kind: "text", text: "in 34 " },
      { kind: "blank", number: null },
      { kind: "text", text: " years" },
    ]);
  });

  it("không cắt nửa sau của một con số dài", () => {
    // "1975." — lookbehind phải chặn, nếu không nhãn ra 975 và bài đọc mất "1".
    const chunks = splitPassageBlanks("since 1975. ____ later");
    expect(chunks[0]).toEqual({ kind: "text", text: "since 1975. " });
    expect(chunks[1]).toEqual({ kind: "blank", number: null });
  });

  it("đoạn không có chỗ trống nào trả về đúng một mẩu văn bản", () => {
    expect(splitPassageBlanks("không có gì để điền")).toEqual([
      { kind: "text", text: "không có gì để điền" },
    ]);
  });
});

describe("mapBlanksToQuestions", () => {
  it("khớp theo SỐ khi mọi chỗ trống đều đánh số và trùng khít nhóm câu", () => {
    // Nhóm bắt đầu từ giữa đề: số in là 34–36, vị trí trong đề là 34–36.
    expect(mapBlanksToQuestions([34, 35, 36], [34, 35, 36])).toEqual([0, 1, 2]);
  });

  it("khớp theo SỐ giữ đúng câu kể cả khi chỗ trống in lệch thứ tự", () => {
    expect(mapBlanksToQuestions([36, 34, 35], [34, 35, 36])).toEqual([2, 0, 1]);
  });

  it("rơi về VỊ TRÍ khi có chỗ trống không đánh số", () => {
    expect(mapBlanksToQuestions([34, null, 36], [34, 35, 36])).toEqual([0, 1, 2]);
  });

  it("rơi về VỊ TRÍ khi số in không trùng nhóm câu", () => {
    // Bài đọc lẫn một dãy gạch không phải chỗ trống → số lượng lệch. Chiến
    // lược theo số tự loại mình thay vì gán bừa.
    expect(mapBlanksToQuestions([34, 35, 36, 37], [34, 35, 36])).toEqual([0, 1, 2, -1]);
  });

  it("chỗ trống thừa so với số câu không gán cho ai", () => {
    expect(mapBlanksToQuestions([null, null, null], [1, 2])).toEqual([0, 1, -1]);
  });

  it("nhóm rỗng — không chỗ trống nào gán được", () => {
    expect(mapBlanksToQuestions([null], [])).toEqual([-1]);
  });
});

// ---------------------------------------------------------------------------
// Dữ liệu THẬT từ prod (đọc qua Supabase 2026-09-02) — đề "Đề kiểm tra giữa học
// kì 1 Tiếng Anh 12 — THPT Thống Nhất A", câu 18–23.
//
// Ghim đúng đoạn văn có thật thay vì một chuỗi tự nghĩ ra: định dạng chỗ trống
// là thứ model phiên âm sinh ra, không phải thứ dự án tự quyết, nên bộ nhận
// dạng phải được đo trên cái model THỰC SỰ đã viết. Ghi chú kèm: ở thời điểm
// đọc, đề này lưu bài đọc LẶP trong `content` của từng câu (cột
// `exams.passages` rỗng trên toàn prod) — nên đoạn dưới đây là phần bài đọc
// cắt ra từ chính thân câu.
// ---------------------------------------------------------------------------
const PROD_PASSAGE =
  "Vo Thi Sau was born in Ba Ria - Vung Tau province in 1933. She was just a schoolgirl (18) _____ in revolutionary activities. When Ho Chi Minh declared independence against the French in 1945, she was only 12 years old.\n" +
  "At the age of 14 while in a busy market, she threw a grenade at a group of French soldiers. She managed to kill one officer and (19) _____. At 16, she planned another grenade attack, however, the grenade failed to explode and (20) _____.\n" +
  "Today, Vietnamese people consider Vo Thi Sau to be a symbol of the revolutionary spirit. (22) _____. Her grave is frequently visited by Vietnamese citizens, especially at night, to honor her memory. (23) _____.";

describe("splitPassageBlanks — đoạn văn THẬT trong prod", () => {
  it("đọc đúng số của từng chỗ trống theo thứ tự", () => {
    const numbers = splitPassageParagraphs(PROD_PASSAGE)
      .flatMap(splitPassageBlanks)
      .filter((c) => c.kind === "blank")
      .map((c) => (c as { number: number | null }).number);
    expect(numbers).toEqual([18, 19, 20, 22, 23]);
  });

  it("không nuốt mất năm tháng trong câu văn (1933, 1945, 14, 16)", () => {
    const text = splitPassageParagraphs(PROD_PASSAGE)
      .flatMap(splitPassageBlanks)
      .filter((c) => c.kind === "text")
      .map((c) => (c as { text: string }).text)
      .join("");
    for (const token of ["1933", "1945", "12 years old", "age of 14", "At 16"]) {
      expect(text, token).toContain(token);
    }
  });

  it("bài đọc prod ngăn đoạn bằng MỘT \\n nên vẫn là một đoạn — y như hiện nay", () => {
    // Phát hiện từ dữ liệu thật: model phiên âm ngăn đoạn bằng một xuống dòng,
    // không phải dòng trống. Markdown coi đó là soft break, nên `RichText` chế
    // độ block VỐN ĐÃ render cả bài thành một <p> và xuống dòng thành dấu cách.
    // Giữ nguyên hành vi ấy là CHỦ ĐÍCH: yêu cầu của phiên này là điền chỗ
    // trống mà KHÔNG đổi hình dạng màn làm bài. Muốn ba đoạn hiện thành ba
    // đoạn thì phải là một quyết định riêng, có người duyệt.
    const paragraphs = splitPassageParagraphs(PROD_PASSAGE);
    expect(paragraphs).toHaveLength(1);

    const chunks = splitPassageBlanks(paragraphs[0]);
    expect(chunks.filter((c) => c.kind === "blank")).toHaveLength(5);
    // Chỗ trống đứng riêng thành câu — "(23) _____." ở cuối bài.
    expect(chunks[chunks.length - 1]).toEqual({ kind: "text", text: "." });
  });
});
