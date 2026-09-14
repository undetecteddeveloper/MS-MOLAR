// Lớp vẽ sóng ô vuông — nạp ĐỘNG từ HomeRipple.tsx ở cú chạm đầu tiên, nên
// khách không chạm nền thì không tải, không chạy một dòng nào ở đây.
//
// Tiết kiệm hiệu năng (engineer 2026-09-05, máy đích là Android tầm trung):
//   - <canvas> chỉ gắn vào DOM khi có sóng đang chạy; sóng tắt là gỡ ngay, để
//     compositor không phải giữ một lớp full-màn (DPR 3 là ~10 MB) lúc rảnh.
//   - Độ phân giải vẽ chặn trần 1,5× DPR: ô vuông phẳng 32px không cần 3×.
//   - Mỗi khung hình chỉ lặp các ô trong hộp bao của vành (±3 sigma), bỏ qua
//     ô ngoài dải bằng một phép so khoảng cách trước khi fillRect.
//   - rAF chỉ chạy khi còn sóng; tab ẩn thì trình duyệt tự ngừng rAF.
//   - Tối đa MAX_RIPPLES sóng cùng lúc.
//
// PHÁT SÁNG (theme "Đêm hội", 2026-09-14): mỗi ô không còn là một hình vuông
// đặc mà là ba hình vuông đồng tâm vẽ chồng ở chế độ CỘNG ÁNH SÁNG
// (`globalCompositeOperation = "lighter"`): quầng ngoài mờ, quầng trong đậm
// hơn, lõi sắc nét. Quầng của hai ô cạnh nhau (cách 34px, quầng rộng ±10px)
// chồng lên nhau nên vành sóng liền thành một dải sáng thay vì một hàng ô rời.
//
// Đã cân nhắc và BỎ hai cách làm glow rẻ hơn về mã nhưng đắt hơn về máy:
//   - `ctx.shadowBlur`/`ctx.filter = blur()`: canvas 2D tính lại mờ cho TỪNG
//     fillRect, vài trăm lần mỗi khung hình — đúng thứ máy đích chịu không nổi.
//   - `filter: drop-shadow()` trên chính thẻ <canvas>: bắt GPU làm một lượt mờ
//     cả màn hình mỗi khung hình, trong khi lớp này đổi nội dung liên tục.
// Cách đang dùng chỉ thêm fillRect — cùng một phép vẽ máy đã làm tốt.
import {
  BAND,
  CELL,
  DURATION_MS,
  MAX_RIPPLES,
  MIN_ALPHA,
  PEAK_ALPHA,
  PITCH,
  bandRange,
  cellJitter,
  crestIntensity,
  fadeAt,
  maxRadiusFrom,
  radiusAt,
} from "./wave";

const DPR_CAP = 1.5;

/** Ba vòng của một ô phát sáng: `grow` là số px nở ra mỗi phía, `mul` là hệ số
 *  alpha. Tổng hệ số 1,18 — nhỉnh hơn 1 có chủ đích: cộng ánh sáng phải sáng
 *  hơn một mảng đặc, nếu không thì không gọi là phát sáng. Lõi hạ xuống 0,72
 *  để tổng không vọt quá xa PEAK_ALPHA. */
const GLOW_RINGS = [
  { grow: 10, mul: 0.18 },
  { grow: 4, mul: 0.28 },
  { grow: 0, mul: 0.72 },
] as const;

type Ripple = { x: number; y: number; start: number; maxRadius: number };

export type RippleLayer = { tap: (x: number, y: number) => void; destroy: () => void };

export function createRippleLayer(host: HTMLElement, color: string): RippleLayer {
  const canvas = document.createElement("canvas");
  canvas.style.cssText = "position:absolute;inset:0;width:100%;height:100%;display:block";
  let ctx: CanvasRenderingContext2D | null = null;
  let ripples: Ripple[] = [];
  let raf = 0;
  let attached = false;
  let width = 0;
  let height = 0;

  function attach() {
    if (attached) return;
    host.appendChild(canvas);
    attached = true;
    window.addEventListener("resize", size);
    size();
  }

  function detach() {
    if (!attached) return;
    window.removeEventListener("resize", size);
    canvas.remove();
    // Về 0×0 để trả bộ nhớ bitmap, không chỉ gỡ khỏi cây.
    canvas.width = 0;
    canvas.height = 0;
    attached = false;
  }

  function size() {
    width = window.innerWidth;
    height = window.innerHeight;
    const dpr = Math.min(window.devicePixelRatio || 1, DPR_CAP);
    canvas.width = Math.ceil(width * dpr);
    canvas.height = Math.ceil(height * dpr);
    ctx = canvas.getContext("2d");
    if (!ctx) return;
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    ctx.fillStyle = color;
  }

  function frame(now: number) {
    raf = 0;
    if (!ctx) return;
    ctx.clearRect(0, 0, width, height);
    // Cộng ánh sáng: ba vòng của một ô, và quầng của các ô cạnh nhau, cộng dồn
    // thành dải sáng. Đặt LẠI mỗi khung hình vì `size()` tạo context mới khi
    // đổi kích thước cửa sổ. (`clearRect` không chịu ảnh hưởng của chế độ này.)
    ctx.globalCompositeOperation = "lighter";
    const cols = Math.ceil(width / PITCH);
    const rows = Math.ceil(height / PITCH);
    const alive: Ripple[] = [];

    for (const r of ripples) {
      const p = (now - r.start) / DURATION_MS;
      if (p >= 1) continue;
      alive.push(r);
      const radius = radiusAt(p, r.maxRadius);
      const fade = fadeAt(p) * PEAK_ALPHA;
      const [rMin, rMax] = bandRange(radius, BAND);
      const c0 = Math.max(0, Math.floor((r.x - rMax) / PITCH));
      const c1 = Math.min(cols - 1, Math.ceil((r.x + rMax) / PITCH));
      const r0 = Math.max(0, Math.floor((r.y - rMax) / PITCH));
      const r1 = Math.min(rows - 1, Math.ceil((r.y + rMax) / PITCH));
      const half = CELL / 2;
      for (let row = r0; row <= r1; row++) {
        const cy = row * PITCH + half - r.y;
        for (let col = c0; col <= c1; col++) {
          const cx = col * PITCH + half - r.x;
          const d = Math.hypot(cx, cy);
          if (d < rMin || d > rMax) continue;
          const a = crestIntensity(d, radius, BAND) * fade * cellJitter(col, row);
          if (a < MIN_ALPHA) continue;
          const x = col * PITCH;
          const y = row * PITCH;
          for (const ring of GLOW_RINGS) {
            ctx.globalAlpha = a * ring.mul;
            ctx.fillRect(x - ring.grow, y - ring.grow, CELL + ring.grow * 2, CELL + ring.grow * 2);
          }
        }
      }
    }
    ctx.globalAlpha = 1;
    ctx.globalCompositeOperation = "source-over";
    ripples = alive;
    if (ripples.length > 0) raf = requestAnimationFrame(frame);
    else detach();
  }

  return {
    tap(x, y) {
      attach();
      if (!ctx) return;
      const now = performance.now();
      ripples.push({ x, y, start: now, maxRadius: maxRadiusFrom(x, y, width, height) });
      if (ripples.length > MAX_RIPPLES) ripples = ripples.slice(-MAX_RIPPLES);
      if (!raf) raf = requestAnimationFrame(frame);
    },
    destroy() {
      if (raf) cancelAnimationFrame(raf);
      raf = 0;
      ripples = [];
      detach();
    },
  };
}
