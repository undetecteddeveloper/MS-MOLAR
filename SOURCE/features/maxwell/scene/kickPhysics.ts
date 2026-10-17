// Vật lý cú đá của Maxwell (brief 20261017-feature-maxwell-da-van). Hàm/lớp THUẦN
// (chỉ dùng toán của `three`, không WebGL) nên test được trong node.
//
// Vì sao tự viết thay vì thêm cannon-es/rapier: chỉ có MỘT vật thể (hộp bao của
// mô hình) rơi lên hai bề mặt đơn giản — mặt sàn nằm ngang và cột bục tròn. Tự
// viết ≈ 200 dòng, không kéo thêm thư viện vào chunk của route này, và kết quả
// cho trước hoàn toàn (không có chỗ nào để "vật lý tự quyết" làm test chập chờn).
//
// Mô hình: vật rắn hình hộp, khối lượng 1, tích phân bước cố định 1/240 s; mỗi
// bước xét 8 đỉnh hộp với sàn (y = floorY) và cột bục (bán kính R, từ sàn lên y = 0),
// giải xung va chạm + ma sát Coulomb theo kiểu "sequential impulses". Thiếu cố
// ý: cạnh hộp chạm mép bục mà không có đỉnh nào lọt vào thì bị bỏ qua — với một
// vật đang lộn nhào chuyện đó không nhìn thấy được.

import { Quaternion, Vector3 } from "three";

/** Cảnh dựng gấp ~4 lần cỡ thật nên trọng lực lớn hơn 9,8 để cú rơi có "trọng lượng". */
export const GRAVITY = 14;

const STEP = 1 / 240;
/** Một khung hình dài bất thường (tab nền quay lại) không được nuốt cả giây mô phỏng. */
const MAX_FRAME_SECONDS = 1 / 15;
const SOLVER_ITERATIONS = 4;
const FRICTION = 0.6;
const RESTITUTION = 0.3;
/** Chạm chậm hơn ngưỡng này thì không nảy — tránh rung lắc khi đã nằm yên. */
const BOUNCE_MIN_SPEED = 1.2;
const PENETRATION_SLOP = 0.001;
const CORRECTION_RATE = 0.8;
/** Hệ số tắt dần (1/giây). Chạm đất tắt xoay nhanh để vật sớm nằm yên. */
const AIR_ANGULAR_DAMPING = 0.1;
const GROUND_ANGULAR_DAMPING = 3;
const GROUND_LINEAR_DAMPING = 0.8;
const SLEEP_LINEAR_SPEED = 0.08;
const SLEEP_ANGULAR_SPEED = 0.2;
const SLEEP_AFTER_SECONDS = 0.3;

/** Thông số cú đá: lùi ra sau (−z, xa camera), hất lên, lộn ngược về sau. */
export const KICK_BACK_SPEED = 3.8;
export const KICK_UP_SPEED = 3.8;
export const KICK_SIDE_SPEED = 2.2;
export const KICK_SPIN = 8;

export type KickWorld = {
  /** Cao độ mặt sàn (< 0). Mặt trên của bục là y = 0. */
  floorY: number;
  /** Bán kính cột bục. */
  pedestalRadius: number;
};

type Contact = { r: Vector3; n: Vector3; depth: number };

const CORNER_SIGNS: ReadonlyArray<readonly [number, number, number]> = [
  [-1, -1, -1],
  [-1, -1, 1],
  [-1, 1, -1],
  [-1, 1, 1],
  [1, -1, -1],
  [1, -1, 1],
  [1, 1, -1],
  [1, 1, 1],
];

const scratchTorque = new Vector3();
const scratchResponse = new Vector3();
const scratchPointVelocity = new Vector3();
const scratchTangent = new Vector3();

/** Độ sâu lún của một đỉnh (0 nếu không chạm) và pháp tuyến đẩy ra, ghi vào `normal`. */
function contactAt(point: Vector3, world: KickWorld, normal: Vector3): number {
  if (point.y < world.floorY) {
    normal.set(0, 1, 0);
    return world.floorY - point.y;
  }
  if (point.y < 0) {
    const rho = Math.hypot(point.x, point.z);
    if (rho < world.pedestalRadius) {
      const fromTop = -point.y;
      const fromSide = world.pedestalRadius - rho;
      // Lún cạn theo chiều nào thì bị đẩy ra theo chiều đó.
      if (fromTop <= fromSide || rho < 1e-6) {
        normal.set(0, 1, 0);
        return fromTop;
      }
      normal.set(point.x / rho, 0, point.z / rho);
      return fromSide;
    }
  }
  return 0;
}

export class KickBody {
  readonly position = new Vector3();
  readonly quaternion = new Quaternion();
  readonly velocity = new Vector3();
  readonly angularVelocity = new Vector3();
  /** Đã nằm yên: `advance` không làm gì nữa. */
  asleep = false;

  private leftover = 0;
  private restSeconds = 0;
  private readonly invInertia: Vector3;
  private readonly corners: Vector3[];
  private readonly contacts: Contact[];
  private readonly inverse = new Quaternion();
  private readonly spin = new Quaternion();
  private readonly point = new Vector3();

  /** `half`: nửa cạnh của hộp bao; gốc toạ độ của thân là TÂM hộp. */
  constructor(
    readonly half: Vector3,
    private readonly world: KickWorld
  ) {
    const { x: hx, y: hy, z: hz } = half;
    // Hộp đặc, khối lượng 1: I = (1/3)·(b² + c²) với b, c là NỬA cạnh còn lại.
    this.invInertia = new Vector3(
      3 / (hy * hy + hz * hz),
      3 / (hx * hx + hz * hz),
      3 / (hx * hx + hy * hy)
    );
    this.corners = CORNER_SIGNS.map(([sx, sy, sz]) => new Vector3(sx * hx, sy * hy, sz * hz));
    this.contacts = this.corners.map(() => ({
      r: new Vector3(),
      n: new Vector3(),
      depth: 0,
    }));
  }

  /** Chạy mô phỏng thêm `seconds` giây (cộng dồn, chia thành bước cố định). */
  advance(seconds: number): void {
    if (this.asleep || !Number.isFinite(seconds) || seconds <= 0) return;
    this.leftover += Math.min(seconds, MAX_FRAME_SECONDS);
    while (this.leftover >= STEP && !this.asleep) {
      this.step();
      this.leftover -= STEP;
    }
  }

  private step(): void {
    const dt = STEP;
    const { velocity: v, angularVelocity: w, position: p, quaternion: q } = this;

    v.y -= GRAVITY * dt;
    p.addScaledVector(v, dt);
    // q ← q + (dt/2)·(0, w)⊗q, rồi chuẩn hoá.
    this.spin.set(w.x * dt * 0.5, w.y * dt * 0.5, w.z * dt * 0.5, 0).multiply(q);
    q.set(q.x + this.spin.x, q.y + this.spin.y, q.z + this.spin.z, q.w + this.spin.w).normalize();
    this.inverse.copy(q).invert();

    const count = this.collect();
    for (let iteration = 0; iteration < SOLVER_ITERATIONS; iteration++) {
      for (let i = 0; i < count; i++) this.solve(this.contacts[i]);
    }

    // Đẩy thân ra khỏi bề mặt theo đỉnh lún sâu nhất (một lần mỗi bước, không cộng dồn).
    let deepest: Contact | null = null;
    for (let i = 0; i < count; i++) {
      if (!deepest || this.contacts[i].depth > deepest.depth) deepest = this.contacts[i];
    }
    if (deepest && deepest.depth > PENETRATION_SLOP) {
      p.addScaledVector(deepest.n, (deepest.depth - PENETRATION_SLOP) * CORRECTION_RATE);
    }

    const grounded = count > 0;
    w.multiplyScalar(1 - (grounded ? GROUND_ANGULAR_DAMPING : AIR_ANGULAR_DAMPING) * dt);
    if (grounded) {
      v.x *= 1 - GROUND_LINEAR_DAMPING * dt;
      v.z *= 1 - GROUND_LINEAR_DAMPING * dt;
    }

    if (grounded && v.length() < SLEEP_LINEAR_SPEED && w.length() < SLEEP_ANGULAR_SPEED) {
      this.restSeconds += dt;
      if (this.restSeconds >= SLEEP_AFTER_SECONDS) {
        this.asleep = true;
        v.set(0, 0, 0);
        w.set(0, 0, 0);
      }
    } else {
      this.restSeconds = 0;
    }
  }

  /** Gom các đỉnh đang lún vào `contacts`; trả về số điểm chạm. */
  private collect(): number {
    let count = 0;
    for (const corner of this.corners) {
      const contact = this.contacts[count];
      contact.r.copy(corner).applyQuaternion(this.quaternion);
      this.point.copy(contact.r).add(this.position);
      const depth = contactAt(this.point, this.world, contact.n);
      if (depth > 0) {
        contact.depth = depth;
        count++;
      }
    }
    return count;
  }

  private solve({ r, n }: Contact): void {
    const normalSpeed = this.pointVelocity(r).dot(n);
    if (normalSpeed >= 0) return;

    const bounce = -normalSpeed > BOUNCE_MIN_SPEED ? RESTITUTION : 0;
    const normalImpulse = (-(1 + bounce) * normalSpeed) / this.effectiveMass(r, n);
    this.applyImpulse(r, n, normalImpulse);

    // Ma sát: triệt vận tốc trượt, nhưng không quá μ·(xung pháp tuyến).
    const velocity = this.pointVelocity(r);
    scratchTangent.copy(velocity).addScaledVector(n, -velocity.dot(n));
    const slide = scratchTangent.length();
    if (slide < 1e-6) return;
    scratchTangent.divideScalar(slide);
    const frictionImpulse = Math.min(slide / this.effectiveMass(r, scratchTangent), FRICTION * normalImpulse);
    this.applyImpulse(r, scratchTangent, -frictionImpulse);
  }

  /** Vận tốc của điểm cách tâm `r`: v + ω × r. Trả về vector dùng chung (đọc ngay). */
  private pointVelocity(r: Vector3): Vector3 {
    return scratchPointVelocity.copy(this.angularVelocity).cross(r).add(this.velocity);
  }

  /** K = 1/m + d·((I⁻¹(r × d)) × r): mẫu số của xung theo phương `d` tại điểm `r`. */
  private effectiveMass(r: Vector3, d: Vector3): number {
    scratchTorque.copy(r).cross(d);
    this.applyInverseInertia(scratchTorque, scratchResponse);
    return 1 + d.dot(scratchResponse.cross(r));
  }

  private applyImpulse(r: Vector3, d: Vector3, magnitude: number): void {
    this.velocity.addScaledVector(d, magnitude);
    scratchTorque.copy(r).cross(d).multiplyScalar(magnitude);
    this.applyInverseInertia(scratchTorque, scratchResponse);
    this.angularVelocity.add(scratchResponse);
  }

  /** out = R·diag(1/I)·Rᵀ·input (nghịch đảo mô-men quán tính trong hệ toạ độ cảnh). */
  private applyInverseInertia(input: Vector3, out: Vector3): void {
    out.copy(input).applyQuaternion(this.inverse).multiply(this.invInertia).applyQuaternion(this.quaternion);
  }

  /** Độ cao thấp nhất trong 8 đỉnh — dùng để kiểm "không lún qua sàn". */
  lowestCornerY(): number {
    let lowest = Infinity;
    for (const corner of this.corners) {
      this.point.copy(corner).applyQuaternion(this.quaternion).add(this.position);
      lowest = Math.min(lowest, this.point.y);
    }
    return lowest;
  }
}

const clamp = (value: number, min: number, max: number) => Math.min(max, Math.max(min, value));

/** Nhấn lệch tâm ít hơn ngưỡng này (tỉ lệ nửa bề ngang) thì hướng hất ngang được bốc thăm. */
const CENTER_DEAD_ZONE = 0.15;

/**
 * Hướng hất ngang `push` ∈ [−1, 1] cho một cú nhấn. `offset` ∈ [−1, 1] là chỗ nhấn
 * lệch tâm mô hình (âm = trái màn hình); `coin` ∈ [0, 1) là số ngẫu nhiên đưa vào.
 *
 * Luôn có thành phần ngang đáng kể (|push| ≥ 0,65): camera nhìn từ trên xuống ~29° nên
 * thứ rơi THẲNG ra sau bục bị chính bục che khuất — hất chéo thì Maxwell hạ cánh
 * ở cạnh bục, người xem thấy rõ cú rơi. Nhấn lệch trái thì bị hất sang phải;
 * nhấn gần giữa (hoặc phím Enter/Space, offset 0) thì bốc thăm bên.
 */
export function kickPush(offset: number, coin: number): number {
  const o = clamp(Number.isFinite(offset) ? offset : 0, -1, 1);
  const side = Math.abs(o) > CENTER_DEAD_ZONE ? -Math.sign(o) : coin < 0.5 ? -1 : 1;
  return clamp(side * 0.7 - o * 0.3, -1, 1);
}

/**
 * Vận tốc ban đầu của cú đá. `push` ∈ [−1, 1] là hướng hất NGANG: +1 = sang phải
 * màn hình (+x), −1 = sang trái; người gọi lấy dấu ngược với chỗ bị nhấn (nhấn
 * lệch trái thì bị hất sang phải). `jitter` ∈ [0, 1] thêm chút ngẫu nhiên vào
 * lực và độ xoay — hàm thuần: người gọi đưa số ngẫu nhiên vào để test được.
 */
export function kickLaunch(
  push: number,
  jitter: number
): { velocity: Vector3; angularVelocity: Vector3 } {
  const side = clamp(Number.isFinite(push) ? push : 0, -1, 1);
  const j = clamp(Number.isFinite(jitter) ? jitter : 0.5, 0, 1);
  return {
    velocity: new Vector3(
      side * KICK_SIDE_SPEED,
      KICK_UP_SPEED * (0.9 + 0.2 * j),
      -KICK_BACK_SPEED * (1.1 - 0.2 * j)
    ),
    // ω_x > 0 = lộn ngược về phía −z; ω_z cùng dấu với hướng văng ngang.
    angularVelocity: new Vector3(
      KICK_SPIN * (0.8 + 0.4 * j),
      side * 3 + (j - 0.5) * 4,
      side * KICK_SPIN * 0.5
    ),
  };
}
