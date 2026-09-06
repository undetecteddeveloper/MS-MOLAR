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
          ctx.globalAlpha = a;
          ctx.fillRect(col * PITCH, row * PITCH, CELL, CELL);
        }
      }
    }
    ctx.globalAlpha = 1;
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
