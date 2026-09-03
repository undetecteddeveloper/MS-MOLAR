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

import { useState, useSyncExternalStore } from "react";
import { useT } from "@/lib/i18n/client";
import { distributePoints, isTotalBalanced, sumPoints } from "@/lib/ugc/distributePoints";
import { LIMITS } from "@/lib/ugc/limits";
import type { AssembledQuestion, ExtractedPart } from "@/lib/ugc/types";
import { partNumbersOf } from "./AssembledQuestionList";

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

export function PointsPanel({ questions, parts, onApply, disabled = false }: PointsPanelProps) {
  const t = useT();
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
  // Trọng số theo khoá `part:number`. Vắng khoá = trọng số 1 (chia đều). Giữ
  // thưa như vậy để "chia đều" không phải là một mảng số 1 phải đồng bộ mỗi
  // lần phạm vi đổi — nó là trạng thái KHÔNG có gì cả.
  const [weights, setWeights] = useState<Record<string, string>>({});
  const [showWeights, setShowWeights] = useState(false);
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

  const keyOf = (q: { part: number; number: number }) => `${q.part}:${q.number}`;

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
    const w = scoped.map((q) => {
      const raw = weights[keyOf(q)];
      if (raw === undefined || raw.trim() === "") return 1;
      const n = Number(raw.replace(",", "."));
      return Number.isFinite(n) && n >= 0 ? n : 1;
    });
    const distributed = distributePoints(total, w);
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

  // GÓC DƯỚI PHẢI CÓ SẴN BA THỨ, và panel phải xếp trên tất cả:
  //   · PublishBar — sticky bottom, cao ~72px (desktop);
  //   · BottomNav — fixed bottom, `--bottom-nav-h` = 3.5rem (chỉ mobile);
  //   · nút "Send feedback" — fixed, size-14, ngồi ngay trên BottomNav
  //     (SupportWidgetTrigger.tsx:38).
  //
  // Mobile: nav + 1rem (chân nút feedback) + 3.5rem (chính nó) + 1rem cách =
  // nav + 5.5rem. Viết bằng CHÍNH biểu thức của nút feedback, không phải một
  // con số chép tay: hai chỗ cùng đọc `--bottom-nav-h` thì một lần đổi chiều
  // cao thanh nav kéo cả hai đi theo. Desktop: `bottom-20` vượt PublishBar, và
  // nút feedback lúc này ở `bottom-6` + size-14 = đúng 80px, vừa chạm không đè.
  //
  // Panel che mất nút Publish — hoặc bị nút feedback che mất tổng điểm — là
  // cách chắc chắn nhất để một công cụ tiện tay biến thành một thứ chặn đường.
  //
  // Lớp ngoài `pointer-events-none` + lớp trong `pointer-events-auto`: khung
  // fixed trải hết chiều ngang để canh phải, nhưng phần trống của nó không được
  // nuốt cú bấm vào các thẻ câu nằm dưới.
  return (
    <div className="pointer-events-none fixed inset-x-0 bottom-[calc(var(--bottom-nav-h)+env(safe-area-inset-bottom,0px)+5.5rem)] z-30 flex justify-end px-4 sm:px-6 md:bottom-20">
      <div className="border-border bg-background/95 pointer-events-auto w-full max-w-sm rounded-[6px] border shadow-lg backdrop-blur">
        <button
          type="button"
          onClick={() => setOpen(!open)}
          aria-expanded={open}
          aria-controls="points-panel-body"
          className="flex w-full items-center justify-between gap-3 px-4 py-3 text-left"
        >
          <span className="eyebrow">{t("upload.pointsPanelTitle")}</span>
          <span className="flex items-center gap-2">
            <span
              className={`text-xs tabular-nums ${balanced ? "text-muted-foreground" : "text-brand"}`}
            >
              {t("upload.pointsPanelTotal", {
                total: String(examTotal),
                expected: String(LIMITS.EXAM_TOTAL_POINTS),
              })}
            </span>
            <span aria-hidden className="text-muted-foreground text-xs">
              {open ? "▴" : "▾"}
            </span>
          </span>
        </button>

        <div id="points-panel-body" hidden={!open} className="border-border border-t px-4 py-3">
          <div className="flex flex-col gap-3">
            {/* Phạm vi — phần, hoặc dãy câu trong phần đó. Dãy câu LUÔN nằm
                trong một phần vì danh tính câu ở layer 4 là cặp (part, number)
                (ADR-0005): "câu 5 đến 12" không có nghĩa nếu không nói phần nào. */}
            <div className="flex items-center gap-2">
              <select
                value={scopePart}
                onChange={(e) => setScopePart(Number(e.target.value))}
                disabled={disabled}
                aria-label={t("upload.pointsPanelPartLabel")}
                // `min-w-0`: chiều rộng tối thiểu mặc định của <select> là option DÀI NHẤT,
                // và tiêu đề phần đề gốc ("PHẦN I. Câu trắc nghiệm nhiều phương án lựa
                // chọn.") dài hơn cả panel — không có nó thì `flex-1` không co được và
                // nút đổi phạm vi bên cạnh bị đẩy ra ngoài mép panel.
                className="border-border bg-card text-foreground focus:border-brand min-w-0 flex-1 truncate rounded-[4px] border px-2 py-1.5 text-sm outline-none"
              >
                {partNumbers.map((pn) => (
                  <option key={pn} value={pn}>
                    {parts.find((p) => p.number === pn)?.title ??
                      t("upload.partLabel", { part: pn })}
                  </option>
                ))}
              </select>
              <button
                type="button"
                onClick={() => setScopeKind((k) => (k === "part" ? "range" : "part"))}
                disabled={disabled}
                className="text-muted-foreground hover:text-brand shrink-0 text-xs underline-offset-4 hover:underline"
              >
                {scopeKind === "part"
                  ? t("upload.pointsPanelUseRange")
                  : t("upload.pointsPanelUseWholePart")}
              </button>
            </div>

            {scopeKind === "range" && (
              <div className="flex items-center gap-2">
                <input
                  type="number"
                  min={1}
                  value={rangeFrom}
                  onChange={(e) => setRangeFrom(e.target.value)}
                  disabled={disabled}
                  aria-label={t("upload.pointsPanelFromLabel")}
                  className="border-border bg-card text-foreground focus:border-brand w-20 rounded-[4px] border px-2 py-1.5 text-sm outline-none"
                />
                <span className="text-muted-foreground text-xs">
                  {t("upload.pointsPanelRangeTo")}
                </span>
                <input
                  type="number"
                  min={1}
                  value={rangeTo}
                  onChange={(e) => setRangeTo(e.target.value)}
                  disabled={disabled}
                  aria-label={t("upload.pointsPanelToLabel")}
                  className="border-border bg-card text-foreground focus:border-brand w-20 rounded-[4px] border px-2 py-1.5 text-sm outline-none"
                />
              </div>
            )}

            <p className="text-muted-foreground text-xs">{scopeSummary}</p>

            <div className="flex items-center gap-2">
              <input
                type="number"
                inputMode="decimal"
                min={0}
                step="any"
                value={totalInput}
                onChange={(e) => setTotalInput(e.target.value)}
                disabled={disabled}
                placeholder={t("upload.pointsPanelTotalPlaceholder")}
                aria-label={t("upload.pointsPanelTotalLabel")}
                className="border-border bg-card text-foreground focus:border-brand w-24 rounded-[4px] border px-2 py-1.5 text-sm outline-none"
              />
              <span className="text-muted-foreground text-xs">{t("upload.pointsSuffix")}</span>
              <button
                type="button"
                onClick={apply}
                disabled={disabled}
                className="bg-brand text-brand-foreground ml-auto rounded-[4px] px-4 py-1.5 text-xs font-medium tracking-[0.14em] uppercase transition-opacity hover:opacity-90 disabled:opacity-50"
              >
                {t("upload.pointsPanelApply")}
              </button>
            </div>

            {/* Trọng số — mặc định ĐÓNG. Chia đều là thứ tác giả muốn ở đại đa
                số lượt dùng; mở sẵn 40 ô trọng số biến thao tác một dòng thành
                một bảng tính. */}
            <button
              type="button"
              onClick={() => setShowWeights((v) => !v)}
              aria-expanded={showWeights}
              className="text-muted-foreground hover:text-brand self-start text-xs underline-offset-4 hover:underline"
            >
              {showWeights ? t("upload.pointsPanelHideRatio") : t("upload.pointsPanelShowRatio")}
            </button>

            {showWeights && scoped.length > 0 && (
              <div className="border-border max-h-40 overflow-y-auto rounded-[4px] border p-2">
                <p className="text-muted-foreground mb-2 text-xs">
                  {t("upload.pointsPanelRatioHint")}
                </p>
                <ul className="flex flex-col gap-1">
                  {scoped.map((q) => (
                    <li key={keyOf(q)} className="flex items-center justify-between gap-2">
                      <span className="text-muted-foreground text-xs">
                        {t("upload.questionLabel", { number: q.number })}
                      </span>
                      <input
                        type="number"
                        min={0}
                        step="any"
                        value={weights[keyOf(q)] ?? ""}
                        onChange={(e) => setWeights((w) => ({ ...w, [keyOf(q)]: e.target.value }))}
                        disabled={disabled}
                        placeholder="1"
                        aria-label={t("upload.pointsPanelRatioLabel", { number: q.number })}
                        className="border-border bg-card text-foreground focus:border-brand w-16 rounded-[4px] border px-2 py-1 text-right text-xs outline-none"
                      />
                    </li>
                  ))}
                </ul>
              </div>
            )}

            {error && (
              <p role="alert" className="text-brand text-xs">
                {error}
              </p>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
