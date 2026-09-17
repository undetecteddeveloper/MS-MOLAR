// Bài giải cộng đồng — toAuthorIdentity / toScoreField [unit]
// Design Doc: docs/design/community-solutions-frontend-design.md (§ Main
//   Components → lib/solutions/identity.ts; § Field Propagation Map — cột bị
//   che là JSON `null` nhưng khoá luôn có mặt (D003); § Minimal Surface
//   Alternatives Element 1 — Alternative A, không còn chặn ảnh theo is_mine)
// Backend DD: docs/design/community-solutions-backend-design.md (§ Field
//   Propagation Map — khoá vắng mặt và giá trị null được đối xử như nhau)
// PRD: AC-039, AC-105, M5 — danh tính ẩn danh không được rò qua bất kỳ bề mặt nào.
//
// Mọi hàng đầu vào đi qua `fromWire` (JSON.stringify → JSON.parse) để mang ĐÚNG
// hình dạng PostgREST gửi về: đủ mọi khoá, giá trị bị che là `null`. Một object
// literal viết tay có thể lọt `undefined` — thứ không bao giờ đi qua dây — và cho
// test xanh trên một hình dạng không tồn tại.

import { describe, expect, it } from "vitest";
import { toAuthorIdentity, toScoreField } from "../identity";

/** Hàng `community_solutions_list` SAU KHI queries.ts đã ký `author_avatar_path`
 *  thành `author_avatar_url`. `author_id` và `is_mine` có mặt để chứng minh
 *  mapper không đọc chúng. */
type SignedListRow = {
  id: string;
  is_mine: boolean;
  author_id: string | null;
  author_display_name: string | null;
  author_avatar_url: string | null;
  score: number | null;
  helpful_count: number;
};

const SIGNED_URL =
  "https://example.supabase.co/storage/v1/object/sign/avatars/u-2/avatar.webp?token=t0k3n";

function fromWire<T>(row: T): T {
  return JSON.parse(JSON.stringify(row)) as T;
}

function listRow(overrides: Partial<SignedListRow>): SignedListRow {
  return fromWire<SignedListRow>({
    id: "s-1",
    is_mine: false,
    author_id: "u-2",
    author_display_name: "nguyen.van",
    author_avatar_url: SIGNED_URL,
    score: 8.5,
    helpful_count: 3,
    ...overrides,
  });
}

describe("toAuthorIdentity", () => {
  it("tên null mà URL ảnh ký vẫn còn → đúng { kind: 'anonymous' }, không rò ảnh, tên hay id", () => {
    const row = listRow({ author_display_name: null });

    const identity = toAuthorIdentity(row);

    expect(identity).toStrictEqual({ kind: "anonymous" });
    expect(Object.keys(identity)).toEqual(["kind"]);
  });

  it.each([false, true])(
    "hàng có tên, is_mine=%s → avatarUrl đi qua nguyên vẹn (chặn theo is_mine không quay lại)",
    (isMine) => {
      const row = listRow({ is_mine: isMine });

      expect(toAuthorIdentity(row)).toStrictEqual({
        kind: "named",
        displayName: "nguyen.van",
        avatarUrl: SIGNED_URL,
      });
    }
  );

  it("hàng có tên nhưng URL ảnh null → không có khoá avatarUrl, để Avatar nhận src null và hiện chữ cái đầu", () => {
    const row = listRow({ author_avatar_url: null });

    const identity = toAuthorIdentity(row);

    expect(identity).toStrictEqual({ kind: "named", displayName: "nguyen.van" });
    expect(Object.keys(identity)).toEqual(["kind", "displayName"]);
  });

  it("hàng trôi dạng thiếu hẳn khoá author_display_name → vẫn ẩn danh (đóng khi lỗi), không mang ảnh theo", () => {
    const drifted = JSON.parse(JSON.stringify({ author_avatar_url: SIGNED_URL }));

    expect(toAuthorIdentity(drifted)).toStrictEqual({ kind: "anonymous" });
  });
});

describe("toScoreField", () => {
  it("score null → khoá score bị xoá hẳn, trường khác giữ nguyên, hàng đầu vào không bị sửa", () => {
    const row = fromWire({ id: "s-1", helpful_count: 3, score: null });

    const mapped = toScoreField(row);

    expect("score" in mapped).toBe(false);
    expect(mapped).toStrictEqual({ id: "s-1", helpful_count: 3 });
    expect(row).toStrictEqual({ id: "s-1", helpful_count: 3, score: null });
  });

  it("score khác null → giá trị giữ nguyên", () => {
    const mapped = toScoreField(fromWire({ id: "s-1", helpful_count: 3, score: 8.5 }));

    expect(mapped).toStrictEqual({ id: "s-1", helpful_count: 3, score: 8.5 });
  });

  it("score = 0 là điểm thật, không bị coi là vắng", () => {
    const mapped = toScoreField(fromWire({ id: "s-1", helpful_count: 0, score: 0 }));

    expect("score" in mapped).toBe(true);
    expect(mapped.score).toBe(0);
  });

  it("hàng trôi dạng thiếu hẳn khoá score → không sinh khoá score", () => {
    const drifted = JSON.parse(JSON.stringify({ id: "s-1", helpful_count: 3 }));

    expect("score" in toScoreField(drifted)).toBe(false);
  });
});
