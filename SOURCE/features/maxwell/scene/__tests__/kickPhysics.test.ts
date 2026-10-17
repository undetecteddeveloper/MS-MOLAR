// Vật lý cú đá của Maxwell — hàm thuần, chạy trong node (không WebGL).

import { Quaternion, Vector3 } from "three";
import { describe, expect, it } from "vitest";
import { KICK_BACK_SPEED, KickBody, kickLaunch, kickPush, type KickWorld } from "../kickPhysics";

// Số đo thật của cảnh: bục cao 0,6 (sàn ở −0,6), bán kính 1,15; hộp bao của mô
// hình sau khi chuẩn hoá là 1,6 × 0,886 × 1,03.
const WORLD: KickWorld = { floorY: -0.6, pedestalRadius: 1.15 };
const HALF = new Vector3(0.8, 0.443, 0.515);

const Y_AXIS = new Vector3(0, 1, 0);

function makeBody(position: Vector3, yaw = 0): KickBody {
  const body = new KickBody(HALF.clone(), WORLD);
  body.position.copy(position);
  body.quaternion.setFromAxisAngle(Y_AXIS, yaw);
  return body;
}

/** Chạy theo nhịp 60 fps tới khi nằm yên hoặc hết `limitSeconds`; trả giây đã chạy. */
function run(body: KickBody, limitSeconds: number): number {
  let elapsed = 0;
  while (!body.asleep && elapsed < limitSeconds) {
    body.advance(1 / 60);
    elapsed += 1 / 60;
  }
  return elapsed;
}

function expectFinite(body: KickBody) {
  for (const vector of [body.position, body.velocity, body.angularVelocity]) {
    expect(Number.isFinite(vector.x + vector.y + vector.z)).toBe(true);
  }
  const q: Quaternion = body.quaternion;
  expect(Number.isFinite(q.x + q.y + q.z + q.w)).toBe(true);
  expect(q.length()).toBeCloseTo(1, 6);
}

describe("KickBody — rơi và nằm yên", () => {
  it("thả xuống sàn (ngoài bục): nằm yên trên một mặt, không lún qua sàn", () => {
    const body = makeBody(new Vector3(3, 1, 0), 0.7);
    const seconds = run(body, 8);

    expect(body.asleep).toBe(true);
    expect(seconds).toBeLessThan(6);
    expect(body.lowestCornerY()).toBeGreaterThan(WORLD.floorY - 0.02);
    // Nằm trên một mặt hộp: tâm cách sàn đúng một nửa cạnh (0,443 / 0,515 / 0,8).
    const gap = body.position.y - WORLD.floorY;
    expect([HALF.x, HALF.y, HALF.z].some((half) => Math.abs(gap - half) < 0.03)).toBe(true);
    expectFinite(body);
  });

  it("đặt trên mặt bục: đứng yên, không trượt đi đâu", () => {
    const body = makeBody(new Vector3(0, HALF.y + 0.002, 0), 0.4);
    run(body, 3);

    expect(body.asleep).toBe(true);
    expect(Math.hypot(body.position.x, body.position.z)).toBeLessThan(0.01);
    expect(body.position.y).toBeCloseTo(HALF.y, 2);
  });

  it("đã nằm yên thì không nhúc nhích nữa", () => {
    const body = makeBody(new Vector3(3, 1, 0));
    run(body, 8);
    const where = body.position.clone();

    body.advance(0.5);
    body.advance(0.5);

    expect(body.position.equals(where)).toBe(true);
  });
});

describe("KickBody — cú đá từ trên bục", () => {
  const cases = [-1, -0.4, 0, 0.6, 1].flatMap((push) =>
    [0, 0.5, 1].map((jitter) => ({ push, jitter }))
  );

  it.each(cases)("push=$push jitter=$jitter: rời bục, rơi xuống sàn và nằm yên", ({ push, jitter }) => {
    // Đang lơ lửng 0,2 trên mặt bục, quay một góc bất kỳ.
    const body = makeBody(new Vector3(0, 0.2 + HALF.y, 0), push + jitter * 3);
    const { velocity, angularVelocity } = kickLaunch(push, jitter);
    body.velocity.copy(velocity);
    body.angularVelocity.copy(angularVelocity);

    run(body, 10);

    expect(body.asleep).toBe(true);
    expectFinite(body);
    // Nằm trên SÀN chứ không kẹt trên bục: điểm thấp nhất của hộp chạm sàn (mặt
    // bục cao hơn sàn 0,6) và tâm hộp nằm ngoài cột bục. Không so tâm với mặt bục:
    // hộp đứng trên đầu hẹp cao 1,6 nên tâm có thể cao hơn mặt bục mà vẫn ở sàn.
    expect(Math.abs(body.lowestCornerY() - WORLD.floorY)).toBeLessThan(0.03);
    expect(Math.hypot(body.position.x, body.position.z)).toBeGreaterThan(WORLD.pedestalRadius);
  });

  it("bị hất ra phía sau (z âm), xa camera", () => {
    const body = makeBody(new Vector3(0, 0.2 + HALF.y, 0));
    const { velocity, angularVelocity } = kickLaunch(0, 0.5);
    body.velocity.copy(velocity);
    body.angularVelocity.copy(angularVelocity);

    run(body, 10);

    expect(body.position.z).toBeLessThan(-WORLD.pedestalRadius);
  });
});

describe("KickBody — đầu vào vô nghĩa", () => {
  it("giây âm / NaN / vô hạn không làm hỏng thân", () => {
    const body = makeBody(new Vector3(0, 1, 0));

    body.advance(-1);
    body.advance(Number.NaN);
    body.advance(Number.POSITIVE_INFINITY);
    expect(body.position.y).toBe(1);

    // Một lần gọi cực lớn bị chặn ở 1/15 giây: rơi chừng ½·14·(1/15)² ≈ 0,03.
    body.advance(1e9);
    expect(body.position.y).toBeGreaterThan(0.9);
    expectFinite(body);
  });
});

describe("kickPush", () => {
  it("nhấn lệch trái → hất sang phải, lệch phải → hất sang trái", () => {
    expect(kickPush(-0.8, 0.9)).toBeGreaterThan(0);
    expect(kickPush(0.8, 0.1)).toBeLessThan(0);
  });

  it("luôn có thành phần ngang đủ lớn để không rơi thẳng ra sau bục", () => {
    for (const offset of [-1, -0.5, -0.16, -0.1, 0, 0.1, 0.16, 0.5, 1]) {
      for (const coin of [0, 0.49, 0.5, 0.99]) {
        const push = kickPush(offset, coin);
        expect(Math.abs(push)).toBeGreaterThanOrEqual(0.65 - 1e-9);
        expect(Math.abs(push)).toBeLessThanOrEqual(1);
      }
    }
  });

  it("nhấn gần giữa (hoặc phím, offset 0): đồng xu quyết định bên", () => {
    expect(kickPush(0, 0.1)).toBeLessThan(0);
    expect(kickPush(0, 0.9)).toBeGreaterThan(0);
    expect(kickPush(0.1, 0.9)).toBeGreaterThan(0);
  });

  it("đầu vào vô nghĩa không sinh NaN", () => {
    expect(Number.isFinite(kickPush(Number.NaN, 0.2))).toBe(true);
    expect(Number.isFinite(kickPush(Number.POSITIVE_INFINITY, 0.2))).toBe(true);
  });
});

describe("kickLaunch", () => {
  it("luôn hất lên và về phía sau; push dương → sang phải, âm → sang trái", () => {
    for (const push of [-1, -0.5, 0, 0.5, 1]) {
      const { velocity } = kickLaunch(push, 0.5);
      expect(velocity.y).toBeGreaterThan(0);
      expect(velocity.z).toBeLessThan(0);
      expect(Math.sign(velocity.x)).toBe(Math.sign(push));
    }
  });

  it("push ngoài [−1, 1] bị chặn; NaN coi như thẳng ra sau", () => {
    expect(kickLaunch(9, 0.5).velocity.x).toBeCloseTo(kickLaunch(1, 0.5).velocity.x, 9);
    expect(kickLaunch(-9, 0.5).velocity.x).toBeCloseTo(kickLaunch(-1, 0.5).velocity.x, 9);
    expect(kickLaunch(Number.NaN, 0.5).velocity.x).toBe(0);
  });

  it("jitter chỉ lắc lực trong ±10%", () => {
    const low = kickLaunch(0, 0).velocity.z;
    const high = kickLaunch(0, 1).velocity.z;
    expect(Math.abs(low)).toBeCloseTo(KICK_BACK_SPEED * 1.1, 9);
    expect(Math.abs(high)).toBeCloseTo(KICK_BACK_SPEED * 0.9, 9);
    expect(Number.isFinite(kickLaunch(0, Number.NaN).velocity.z)).toBe(true);
  });
});
