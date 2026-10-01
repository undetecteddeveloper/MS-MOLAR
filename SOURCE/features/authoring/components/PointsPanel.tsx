"use client";

// PointsPanel — gán điểm cho MỘT NHÓM câu cùng lúc, màn sửa đề (2026-09-03).
//
// Vấn đề nó giải: cổng publish B1 buộc mọi câu có `points > 0` và tổng đúng 10
// (validatePointsForPublish). Đường nhập duy nhất trước bản này là ô số trên
// từng thẻ câu — một đề 40 câu là 40 lượt gõ tay để nói đúng một câu: "phần III
// đáng 3 điểm". Panel này nhận CHÍNH câu đó.
//
// Nó KHÔNG phải nguồn chân lý thứ hai của biểu điểm: nó ghi thẳng vào `points`
// của từng câu qua `onApply`, đúng những giá trị mà ô số trên thẻ hiển thị và
// server lưu. Sau khi áp, tác giả vẫn sửa tay từng câu được như cũ.
//
// VỊ TRÍ — cố định góc dưới phải, KHÔNG nằm trong luồng cuộn: gán điểm là việc
// tác giả làm trong lúc mắt đang ở giữa danh sách 40 câu để xem mình vừa đổi
// cái gì. Một panel phải cuộn đi tìm sẽ buộc họ mất chỗ đang đọc mỗi lần dùng.
//
// TỔNG ĐIỂM CHẠY — có, và CHỈ ở đây. ReviewScreen cố ý không hiện tổng cạnh 40
// ô nhập (comment B1: "một con số 7.75/10 nhấp nháy... là lời hối thúc suốt
// buổi soát đề"). Lập luận đó nói về một con số bám theo tác giả khi họ đang
// soát NỘI DUNG. Trong panel gán điểm thì tổng chính là thứ họ đang thao tác,
// và giấu nó đi nghĩa là bắt họ bấm Publish để hỏi server còn thiếu bao nhiêu.
//
// Theme "Sân trường" (2026-09-09): vỏ popover trắng viền mảnh bo 14px — cùng
// lớp vỏ với menu tài khoản và menu ⋯ (thứ nổi trên nội dung là popover, và
// popover là chỗ duy nhất theme còn kẻ viền ngoài ô nhập). Hết bóng, hết blur.
// Ô nhập là primitive Input/Select cỡ 40px (panel là công cụ phụ, 44px ở đây
// phình panel lên quá nửa màn hình 360px); tổng lệch tô đỏ đậm.

import { useState, useSyncExternalStore } from "react";
import { ChevronDown } from "lucide-react";
import { t } from "@/lib/copy";
import { distributePoints, isTotalBalanced, sumPoints } from "@/lib/ugc/distributePoints";
import { LIMITS } from "@/lib/ugc/limits";
import type { AssembledQuestion, ExtractedPart } from "@/lib/ugc/types";
import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import { Input, Select } from "@/components/ui/input";
import { partNumbersOf } from "@/features/authoring/components/AssembledQuestionList";

/** Điểm được gán cho một câu, định danh theo (part, number) như mọi nơi ở layer 4. */
export interface PointsAssignment {
  part: number;
  number: number;
  points: number;
}

interface PointsPanelProps {
  questions: AssembledQuestion[];
  parts: ExtractedPart[];
  onApply: (assignments: PointsAssignment[]) => void;
  disabled?: boolean;
}

/** Ngưỡng "màn hình đủ rộng để panel mở sẵn" — khớp breakpoint `md` của Tailwind. */
const WIDE_QUERY = "(min-width: 768px)";

function subscribeWide(onChange: () => void): () => void {
  const mql = window.matchMedia(WIDE_QUERY);
  mql.addEventListener("change", onChange);
  return () => mql.removeEventListener("change", onChange);
}

function getWideSnapshot(): boolean {
  return window.matchMedia(WIDE_QUERY).matches;
}

/** Phạm vi đang chọn: cả một phần, hoặc một dãy câu trong một phần. */
type ScopeKind = "part" | "range";

/** Ô nhập cỡ panel — 40px, chữ 14px. */
const FIELD = "h-10 text-sm";

export function PointsPanel({ questions, parts, onApply, disabled = false }: PointsPanelProps) {
  const partNumbers = partNumbersOf(questions);

  // Mobile mặc định THU GỌN (panel chiếm chỗ hiển thị vốn đã hẹp), desktop mở.
  //
  // MẶC ĐỊNH, không phải giá trị chốt: `override` là lựa chọn tác giả đã bấm,
  // `null` nghĩa là họ chưa bấm gì và panel còn theo bề rộng màn hình. Nhờ tách
  // hai thứ đó, xoay ngang máy KHÔNG bật lại một panel mà họ vừa cố ý đóng.
  //
  // Đọc matchMedia qua useSyncExternalStore chứ không qua useEffect + setState:
  // đây đúng là "subscribe một hệ thống ngoài React", và setState trong effect
  // vừa là một lượt render thừa vừa bị eslint chặn thẳng. Snapshot phía server
  // là `false` — mobile-first, và cũng là phía an toàn: một panel đóng lúc
  // hydrate thì mở ra, còn một panel mở nhầm đã che mất nội dung rồi.
  const isWide = useSyncExternalStore(subscribeWide, getWideSnapshot, () => false);
  const [override, setOverride] = useState<boolean | null>(null);
  const open = override ?? isWide;
  const setOpen = (next: boolean) => setOverride(next);

  const [scopeKind, setScopeKind] = useState<ScopeKind>("part");
  const [scopePart, setScopePart] = useState<number>(partNumbers[0] ?? 1);
  const [rangeFrom, setRangeFrom] = useState("");
  const [rangeTo, setRangeTo] = useState("");
  const [totalInput, setTotalInput] = useState("");
  const [error, setError] = useState<string | null>(null);

  const examTotal = sumPoints(questions.map((q) => q.points));
  const balanced = isTotalBalanced(examTotal);

  const partQuestions = questions.filter((q) => q.part === scopePart);
  const from = Number.parseInt(rangeFrom, 10);
  const to = Number.parseInt(rangeTo, 10);
  const scoped =
    scopeKind === "part"
      ? partQuestions
      : Number.isInteger(from) && Number.isInteger(to)
        ? partQuestions.filter((q) => q.number >= from && q.number <= to)
        : [];

  function apply() {
    setError(null);
    // `,` → `.`: bàn phím Việt gõ "2,5" là chuyện thường, và prompt trích xuất
    // đã phải dặn Gemini đúng điều này (extractQuestions.ts, "2,0 điểm" -> 2.0).
    const total = Number(totalInput.replace(",", "."));
    if (!Number.isFinite(total) || total <= 0) {
      setError(t("upload.pointsPanelInvalidTotal"));
      return;
    }
    if (scoped.length === 0) {
      setError(t("upload.pointsPanelEmptyScope"));
      return;
    }
    // Chỉ chia ĐỀU (trọng số 1 cho mọi câu). Câu nào đáng khác đi thì sửa tay ở
    // ô điểm trên thẻ câu sau khi áp — panel không giữ bảng tỉ lệ riêng.
    const distributed = distributePoints(
      total,
      scoped.map(() => 1)
    );
    // Rỗng = luật chia từ chối vì kết quả sẽ có câu ≤ 0 — đúng thứ cổng publish
    // chặn. Báo ra thay vì ghi một biểu điểm mà tác giả sẽ phải tự đi tìm lỗi.
    if (distributed.length === 0) {
      setError(t("upload.pointsPanelCannotSplit", { count: scoped.length }));
      return;
    }
    onApply(scoped.map((q, i) => ({ part: q.part, number: q.number, points: distributed[i] })));
  }

  const scopeSummary =
    scoped.length === 0
      ? t("upload.pointsPanelNoQuestions")
      : t("upload.pointsPanelScopeSummary", {
          count: scoped.length,
          first: scoped[0].number,
          last: scoped[scoped.length - 1].number,
        });

  // GÓC DƯỚI PHẢI CÓ SẴN BA THỨ, và panel không được đè lên thứ nào:
  //   · BottomNav — fixed bottom, `--bottom-nav-h` (chỉ mobile);
  //   · PublishBar — sticky ngay trên BottomNav (mobile) / mép dưới (desktop),
  //     cao ~69px;
  //   · nút hỗ trợ — fixed, size-14, góc phải; khi trang có thanh hành động
  //     nó tự nhấc lên nav + 5.5rem (mobile) / 6rem (desktop) —
  //     SupportWidgetTrigger.tsx.
  //
  // Panel đứng CÙNG DẢI với nút hỗ trợ, bên trái nó (đệm phải 5rem mobile =
  // 1rem lề + 3.5rem nút + 0.5rem khe; 5.5rem desktop vì lề 1.5rem), chứ không
  // chồng thêm một tầng nữa lên trên: đo 2026-09-09 ở 360×740, xếp bốn tầng
  // (nav, thanh, nút, panel) ăn 270px — hơn một phần ba màn hình — cho một
  // công cụ mà lúc thu gọn chỉ là một dòng chữ. Cùng dải thì còn 201px, và
  // panel mở ra cũng không bị nút hỗ trợ (z-45) đè lên vì hai thứ không giao
  // nhau theo chiều ngang. Chân panel viết bằng CHÍNH biểu thức của nút hỗ
  // trợ, không phải một con số chép tay: hai chỗ cùng đọc `--bottom-nav-h`
  // thì một lần đổi chiều cao thanh nav kéo cả hai đi theo.
  //
  // Lớp ngoài `pointer-events-none` + lớp trong `pointer-events-auto`: khung
  // fixed trải hết chiều ngang để canh phải, nhưng phần trống của nó không được
  // nuốt cú bấm vào các thẻ câu nằm dưới.
  return (
    <div className="pointer-events-none fixed inset-x-0 bottom-[calc(var(--bottom-nav-h)+env(safe-area-inset-bottom,0px)+5.5rem)] z-30 flex justify-end pr-20 pl-4 md:bottom-24 md:pr-22 md:pl-6">
      <div className="border-border bg-popover pointer-events-auto w-full max-w-sm rounded-xl border">
        <button
          type="button"
          onClick={() => setOpen(!open)}
          aria-expanded={open}
          aria-controls="points-panel-body"
          className="focus-visible:ring-ring/40 flex min-h-12 w-full items-center justify-between gap-3 rounded-xl px-4 py-2.5 text-left focus-visible:ring-3 focus-visible:outline-none"
        >
          <span className="text-sm font-semibold">{t("upload.pointsPanelTitle")}</span>
          <span className="flex items-center gap-2">
            <span
              className={cn(
                "text-sm tabular-nums",
                balanced ? "text-muted-foreground" : "text-destructive font-semibold"
              )}
            >
              {t("upload.pointsPanelTotal", {
                total: String(examTotal),
                expected: String(LIMITS.EXAM_TOTAL_POINTS),
              })}
            </span>
            <ChevronDown
              aria-hidden
              className={cn(
                "text-muted-foreground size-4 transition-[rotate] ease-out",
                open && "rotate-180"
              )}
            />
          </span>
        </button>

        <div id="points-panel-body" hidden={!open} className="border-border border-t px-4 py-3">
          <div className="flex flex-col gap-3">
            {/* Phạm vi — phần, hoặc dãy câu trong phần đó. Dãy câu LUÔN nằm
                trong một phần vì danh tính câu ở layer 4 là cặp (part, number)
                (ADR-0005): "câu 5 đến 12" không có nghĩa nếu không nói phần nào. */}
            {/* `min-w-0` trên vỏ: chiều rộng tối thiểu mặc định của <select> là
                option DÀI NHẤT, và tiêu đề phần đề gốc ("PHẦN I. Câu trắc
                nghiệm nhiều phương án lựa chọn.") dài hơn cả panel. */}
            <Select
              value={scopePart}
              onChange={(e) => setScopePart(Number(e.target.value))}
              disabled={disabled}
              aria-label={t("upload.pointsPanelPartLabel")}
              wrapperClassName="min-w-0"
              className={FIELD}
            >
              {partNumbers.map((pn) => (
                <option key={pn} value={pn}>
                  {parts.find((p) => p.number === pn)?.title ??
                    t("upload.partLabel", { part: pn })}
                </option>
              ))}
            </Select>

            {/* Tóm tắt phạm vi và nút đổi phạm vi chung MỘT hàng: select độc chiếm
                bề ngang ở trên (tiêu đề phần đọc được nhiều hơn), còn hàng này
                không còn ô trống bên phải như khi link nằm cạnh select. */}
            <div className="flex items-center justify-between gap-2">
              <p className="text-muted-foreground min-w-0 text-sm">{scopeSummary}</p>
              <Button
                type="button"
                variant="link"
                size="sm"
                onClick={() => setScopeKind((k) => (k === "part" ? "range" : "part"))}
                disabled={disabled}
                className="shrink-0 px-0"
              >
                {scopeKind === "part"
                  ? t("upload.pointsPanelUseRange")
                  : t("upload.pointsPanelUseWholePart")}
              </Button>
            </div>

            {scopeKind === "range" && (
              <div className="motion-unfold flex items-center gap-2">
                <Input
                  type="number"
                  min={1}
                  value={rangeFrom}
                  onChange={(e) => setRangeFrom(e.target.value)}
                  disabled={disabled}
                  aria-label={t("upload.pointsPanelFromLabel")}
                  className={cn(FIELD, "min-w-0 flex-1")}
                />
                <span className="text-muted-foreground text-sm">
                  {t("upload.pointsPanelRangeTo")}
                </span>
                <Input
                  type="number"
                  min={1}
                  value={rangeTo}
                  onChange={(e) => setRangeTo(e.target.value)}
                  disabled={disabled}
                  aria-label={t("upload.pointsPanelToLabel")}
                  className={cn(FIELD, "min-w-0 flex-1")}
                />
              </div>
            )}

            {/* Ô nhập `flex-1`: nó nhận hết bề ngang còn lại giữa chữ "điểm" và
                nút, nên hàng luôn kín từ mép trái tới mép phải — không còn
                khoảng trống giữa ô và nút như khi ô cố định `w-28` + nút
                `ml-auto`. Không `flex-wrap`: ở 360px (panel 264px, trừ đệm còn
                232px) nút ~90px + chữ ~35px + khe 16px vẫn chừa ô ~90px. */}
            <div className="flex items-center gap-2">
              <Input
                type="number"
                inputMode="decimal"
                min={0}
                step="any"
                value={totalInput}
                onChange={(e) => setTotalInput(e.target.value)}
                disabled={disabled}
                placeholder={t("upload.pointsPanelTotalPlaceholder")}
                aria-label={t("upload.pointsPanelTotalLabel")}
                className={cn(FIELD, "min-w-0 flex-1")}
              />
              <span className="text-muted-foreground text-sm">{t("upload.pointsSuffix")}</span>
              <Button type="button" size="sm" onClick={apply} disabled={disabled}>
                {t("upload.pointsPanelApply")}
              </Button>
            </div>

            {error && (
              <p role="alert" className="text-destructive text-sm">
                {error}
              </p>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
