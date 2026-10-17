// Cảnh 3D của trang ẩn Maxwell the Cat (brief 20261012-feature-maxwell-easter-egg).
//
// Dựng bằng `three` thuần, KHÔNG React: vòng đời cảnh là "tạo → chạy → dispose",
// gắn vào một div do component sở hữu. Chỉ module này (và `three`) nằm trong
// chunk của route /maxwell — component nạp nó bằng `import()` động nên các trang
// khác không nặng thêm một byte.
//
// Bố cục: bệ là một cột tròn tối màu đứng trên sàn; một đèn rọi (SpotLight) thẳng
// từ trên xuống kèm chùm sáng mờ + vệt sáng trên mặt bệ; mô hình lơ lửng trên bệ,
// xoay và nhấp nhô (motion.ts); nền đen tuyền, sàn là đĩa tối mờ dần ra mép. Camera
// lùi theo CẠNH HẸP của khung (xem framing.ts) nên điện thoại cầm dọc không bị cắt
// hai bên.
//
// Cú đá (2026-10-17): nhấn trúng mô hình MỘT lần thì nó rời `pivot`, do KickBody
// (kickPhysics.ts) lái — bị hất chéo ra sau, lộn nhào, rơi khỏi bục xuống sàn rồi
// nằm yên. Không có đường quay lại: muốn Maxwell về bục thì tải lại trang.
//
// Máy yếu (điện thoại tầm trung): độ nét ≤ 2x, một đèn có bóng 1024, không hậu
// kỳ, môi trường phản chiếu dựng MỘT lần rồi bỏ bộ sinh.

import {
  ACESFilmicToneMapping,
  AdditiveBlending,
  Box3,
  CanvasTexture,
  CircleGeometry,
  ConeGeometry,
  CylinderGeometry,
  DoubleSide,
  Group,
  Mesh,
  MeshBasicMaterial,
  MeshStandardMaterial,
  PCFShadowMap,
  PerspectiveCamera,
  PMREMGenerator,
  PointLight,
  Raycaster,
  Scene,
  SpotLight,
  SRGBColorSpace,
  TorusGeometry,
  Vector2,
  Vector3,
  WebGLRenderer,
  type BufferGeometry,
  type Intersection,
  type Material,
  type Object3D,
  type Texture,
} from "three";
import { RoomEnvironment } from "three/addons/environments/RoomEnvironment.js";
import { GLTFLoader } from "three/addons/loaders/GLTFLoader.js";
import { fitDistance } from "./framing";
import { KickBody, kickLaunch, kickPush, type KickWorld } from "./kickPhysics";
import { poseAt } from "./motion";

// .gltf + ảnh rời (scripts/split-glb.mjs), KHÔNG phải .glb: texture nhúng trong
// .glb được giải mã qua `fetch(blob:)`, mà CSP của site không cho `blob:` ở
// connect-src — mô hình sẽ hiện trắng toát trên Chrome/Firefox.
export const MAXWELL_MODEL_URL = "/models/maxwell-the-cat.gltf";

/** Cạnh lớn nhất của hộp bao mô hình sau khi chuẩn hoá. */
const MODEL_SIZE = 1.6;
/** Mô hình lơ lửng cách mặt bệ chừng này (chưa kể nhấp nhô). */
const HOVER = 0.2;
const PEDESTAL_RADIUS = 1.15;
/** Bục là một cột cao chừng này, đứng trên sàn: cú đá làm Maxwell rơi ra sàn chứ không rơi vô hạn. */
const PEDESTAL_HEIGHT = 0.6;
const FLOOR_Y = -PEDESTAL_HEIGHT;
/** Sàn là một đĩa tối mờ dần ra mép — không có đường chân trời cắt ngang nền đen. */
const FLOOR_RADIUS = 9;
const KICK_WORLD: KickWorld = { floorY: FLOOR_Y, pedestalRadius: PEDESTAL_RADIUS };
const Y_AXIS = new Vector3(0, 1, 0);
/** Đèn phụ sáng dần tới cường độ này trong chừng ấy giây sau cú đá (đơn vị candela). */
const FILL_INTENSITY = 100;
const FILL_RAMP_SECONDS = 0.5;
/** Bóng dưới chân: bán kính, độ đậm khi chạm sàn, và độ cao (so với sàn) mà tại đó nó tan hẳn. */
const CONTACT_SHADOW_RADIUS = 0.95;
const CONTACT_SHADOW_OPACITY = 0.75;
const CONTACT_SHADOW_FADE_HEIGHT = 1.6;
const LIGHT_HEIGHT = 5;
/** Nửa góc mở của đèn rọi (rad); chùm sáng vẽ trùng đúng góc này. */
const BEAM_ANGLE = 0.26;
/** Khối cầu bao: bệ + mô hình + biên độ nhấp nhô. */
const FRAME_RADIUS = 1.7;
/** Tâm khung nhìn: hơi trên mặt bệ để mô hình nằm giữa. */
const LOOK_AT = new Vector3(0, 0.55, 0);
const CAMERA_FOV = 32;
const CAMERA_ELEVATION = 0.5; // rad: nhìn từ trên xuống một chút để thấy mặt bệ
const MAX_PIXEL_RATIO = 2;

export type MaxwellScene = {
  /** Resolve khi mô hình đã vào cảnh; reject khi không tải/giải mã được. */
  ready: Promise<void>;
  /**
   * Nhấn tại toạ độ màn hình (clientX/clientY): trúng mô hình thì Maxwell bị đá
   * văng — ĐÚNG MỘT LẦN mỗi cảnh. Trả `true` khi cú đá vừa xảy ra; trượt, chưa tải
   * xong hay đã đá rồi thì `false` và không làm gì.
   */
  kickAt: (clientX: number, clientY: number) => boolean;
  /** Đá thẳng, không cần trỏ vào mô hình (phím Enter/Space). Cùng luật một lần. */
  kick: () => boolean;
  /** Toạ độ màn hình có đang nằm trên mô hình chưa bị đá không (để đổi con trỏ). */
  isOverModel: (clientX: number, clientY: number) => boolean;
  dispose: () => void;
};

export type MaxwellSceneOptions = {
  /** Trình duyệt thu hồi ngữ cảnh WebGL (hiếm: máy hết bộ nhớ đồ hoạ). */
  onContextLost?: () => void;
};

/** Gradient 2D → texture; `null` nếu canvas 2D không dùng được (khi đó bỏ hiệu ứng). */
function gradientTexture(
  width: number,
  height: number,
  paint: (ctx: CanvasRenderingContext2D) => void
): CanvasTexture | null {
  const canvas = document.createElement("canvas");
  canvas.width = width;
  canvas.height = height;
  const ctx = canvas.getContext("2d");
  if (!ctx) return null;
  paint(ctx);
  const texture = new CanvasTexture(canvas);
  texture.colorSpace = SRGBColorSpace;
  return texture;
}

/** Chùm sáng: sáng ở đầu đèn, tan dần xuống bệ. Canvas hàng trên = đỉnh nón. */
function beamAlphaTexture(): CanvasTexture | null {
  return gradientTexture(4, 128, (ctx) => {
    const g = ctx.createLinearGradient(0, 0, 0, 128);
    g.addColorStop(0, "#ffffff");
    g.addColorStop(0.55, "#6b6b6b");
    g.addColorStop(1, "#1f1f1f");
    ctx.fillStyle = g;
    ctx.fillRect(0, 0, 4, 128);
  });
}

/** Vệt sáng tròn trên mặt bệ: đậm ở giữa, mờ ra mép. */
function poolTexture(): CanvasTexture | null {
  return gradientTexture(128, 128, (ctx) => {
    const g = ctx.createRadialGradient(64, 64, 0, 64, 64, 64);
    g.addColorStop(0, "#ffffff");
    g.addColorStop(0.5, "#6e6e6e");
    g.addColorStop(1, "#000000");
    ctx.fillStyle = g;
    ctx.fillRect(0, 0, 128, 128);
  });
}

/** Vệt bóng tròn mềm: đen đặc ở giữa, tan hẳn ở mép (kênh alpha của canvas). */
function blobShadowTexture(): CanvasTexture | null {
  return gradientTexture(64, 64, (ctx) => {
    const g = ctx.createRadialGradient(32, 32, 0, 32, 32, 32);
    g.addColorStop(0, "rgba(0, 0, 0, 0.9)");
    g.addColorStop(0.5, "rgba(0, 0, 0, 0.5)");
    g.addColorStop(1, "rgba(0, 0, 0, 0)");
    ctx.fillStyle = g;
    ctx.fillRect(0, 0, 64, 64);
  });
}

/** Độ mờ của sàn: đặc ở giữa, tan hẳn ở mép đĩa. */
function floorFadeTexture(): CanvasTexture | null {
  return gradientTexture(128, 128, (ctx) => {
    const g = ctx.createRadialGradient(64, 64, 0, 64, 64, 64);
    g.addColorStop(0, "#ffffff");
    g.addColorStop(0.4, "#c8c8c8");
    g.addColorStop(1, "#000000");
    ctx.fillStyle = g;
    ctx.fillRect(0, 0, 128, 128);
  });
}

export function createMaxwellScene(
  container: HTMLElement,
  options: MaxwellSceneOptions = {}
): MaxwellScene {
  // Ném ở đây nếu không có WebGL — người gọi bắt và hiện câu báo thay cho trang trắng.
  const renderer = new WebGLRenderer({ antialias: true, powerPreference: "high-performance" });
  try {
    return buildScene(renderer, container, options);
  } catch (error) {
    // Lỗi giữa chừng (bộ nhớ đồ hoạ, shader…): không để lại canvas và ngữ cảnh
    // WebGL mồ côi — người gọi chỉ nhận một lỗi và hiện câu báo.
    renderer.dispose();
    renderer.domElement.remove();
    throw error;
  }
}

function buildScene(
  renderer: WebGLRenderer,
  container: HTMLElement,
  options: MaxwellSceneOptions
): MaxwellScene {
  renderer.setClearColor(0x000000, 1);
  renderer.toneMapping = ACESFilmicToneMapping;
  renderer.toneMappingExposure = 1.1;
  renderer.shadowMap.enabled = true;
  // `PCFSoftShadowMap` đã bị three gỡ (cảnh báo ở console); PCFShadowMap nay đã lọc mềm.
  renderer.shadowMap.type = PCFShadowMap;
  renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, MAX_PIXEL_RATIO));

  const canvas = renderer.domElement;
  canvas.style.display = "block";
  canvas.style.width = "100%";
  canvas.style.height = "100%";
  // Canvas chỉ để xem: không chặn cuộn dọc trang trên điện thoại.
  canvas.style.touchAction = "pan-y";
  container.appendChild(canvas);

  const onContextLost = (event: Event) => {
    event.preventDefault();
    options.onContextLost?.();
  };
  canvas.addEventListener("webglcontextlost", onContextLost);

  const scene = new Scene();

  // Ánh sáng môi trường rất nhẹ để phần ngoài chùm đèn không đen kịt hẳn.
  const pmrem = new PMREMGenerator(renderer);
  const room = new RoomEnvironment();
  scene.environment = pmrem.fromScene(room, 0.04).texture;
  scene.environmentIntensity = 0.5;
  room.dispose();
  pmrem.dispose();

  const camera = new PerspectiveCamera(CAMERA_FOV, 1, 0.1, 50);

  const spot = new SpotLight(0xfff1d6, 380, 0, BEAM_ANGLE, 0.55, 1.4);
  spot.position.set(0, LIGHT_HEIGHT, 0);
  spot.target.position.set(0, 0, 0);
  spot.castShadow = true;
  spot.shadow.mapSize.set(1024, 1024);
  spot.shadow.bias = -0.0004;
  spot.shadow.radius = 4;
  scene.add(spot, spot.target);

  // Bệ trưng bày: cột tròn, mặt trên ở y = 0, chân đứng trên sàn.
  const pedestal = new Mesh(
    new CylinderGeometry(PEDESTAL_RADIUS, PEDESTAL_RADIUS * 1.05, PEDESTAL_HEIGHT, 72),
    new MeshStandardMaterial({ color: 0x17191c, roughness: 0.35, metalness: 0.55 })
  );
  pedestal.position.y = -PEDESTAL_HEIGHT / 2;
  pedestal.receiveShadow = true;
  scene.add(pedestal);

  // Sàn dưới bục (người dùng chốt 2026-10-17): chỗ Maxwell rơi xuống sau cú đá.
  const floor = new Mesh(
    new CircleGeometry(FLOOR_RADIUS, 64),
    new MeshStandardMaterial({
      color: 0x14171a,
      roughness: 0.55,
      metalness: 0.4,
      alphaMap: floorFadeTexture(),
      transparent: true,
    })
  );
  floor.rotation.x = -Math.PI / 2;
  floor.position.y = FLOOR_Y;
  floor.receiveShadow = true;
  scene.add(floor);

  // Vệt sáng mờ trên sàn, rộng hơn chùm đèn: chỗ Maxwell hạ cánh nằm NGOÀI chùm
  // (chùm chỉ rộng ~1,6 ở sàn) nên cần chút sáng để còn nhìn thấy nó.
  const floorPool = new Mesh(
    new CircleGeometry(4.2, 72),
    new MeshBasicMaterial({
      color: 0xfff1d6,
      map: poolTexture(),
      transparent: true,
      opacity: 0.5,
      blending: AdditiveBlending,
      depthWrite: false,
    })
  );
  floorPool.rotation.x = -Math.PI / 2;
  floorPool.position.y = FLOOR_Y + 0.004;
  scene.add(floorPool);

  // Bóng dưới chân Maxwell sau cú đá. Đèn rọi chỉ phủ quanh bục nên ngoài đó không
  // có bóng thật; thiếu vệt này thì Maxwell nằm trên sàn trông như đang lơ lửng.
  // Ẩn cho tới khi bị đá; đậm dần khi hạ thấp, nhạt đi khi còn ở trên cao.
  const contactShadow = new Mesh(
    new CircleGeometry(1, 48),
    new MeshBasicMaterial({
      map: blobShadowTexture(),
      transparent: true,
      opacity: 0,
      depthWrite: false,
    })
  );
  contactShadow.rotation.x = -Math.PI / 2;
  contactShadow.position.y = FLOOR_Y + 0.006;
  contactShadow.scale.setScalar(CONTACT_SHADOW_RADIUS);
  contactShadow.visible = false;
  scene.add(contactShadow);

  // Đèn phụ, TẮT cho tới khi Maxwell bị đá rồi sáng dần: chỗ hạ cánh nằm ngoài
  // chùm đèn rọi nên không có nó thì Maxwell chìm vào nền đen ngay khi vừa rơi.
  // Tắt từ đầu để không đổi cách Maxwell trông lúc đứng trên bục.
  const fill = new PointLight(0xfff1d6, 0, 14, 2);
  fill.position.set(0, 1.6, 1.2);
  scene.add(fill);

  const rim = new Mesh(
    new TorusGeometry(PEDESTAL_RADIUS, 0.012, 12, 120),
    new MeshBasicMaterial({ color: 0xd7e9ff, transparent: true, opacity: 0.55 })
  );
  rim.rotation.x = Math.PI / 2;
  rim.position.y = 0.001;
  scene.add(rim);

  // Chùm sáng nhìn thấy được + vệt sáng trên mặt bệ.
  const beamHeight = LIGHT_HEIGHT;
  const beamAlpha = beamAlphaTexture();
  const beam = new Mesh(
    new ConeGeometry(Math.tan(BEAM_ANGLE) * beamHeight, beamHeight, 64, 1, true),
    new MeshBasicMaterial({
      color: 0xfff1d6,
      transparent: true,
      opacity: 0.2,
      alphaMap: beamAlpha,
      blending: AdditiveBlending,
      depthWrite: false,
      side: DoubleSide,
    })
  );
  beam.position.y = beamHeight / 2;
  scene.add(beam);

  const pool = new Mesh(
    new CircleGeometry(PEDESTAL_RADIUS * 0.96, 72),
    new MeshBasicMaterial({
      color: 0xfff1d6,
      map: poolTexture(),
      transparent: true,
      opacity: 0.55,
      blending: AdditiveBlending,
      depthWrite: false,
    })
  );
  pool.rotation.x = -Math.PI / 2;
  pool.position.y = 0.004;
  scene.add(pool);

  // `pivot` xoay + nhấp nhô; mô hình nằm trong `holder` đã căn giữa quanh trục.
  const pivot = new Group();
  pivot.position.y = HOVER;
  scene.add(pivot);

  function resize() {
    const width = Math.max(container.clientWidth, 1);
    const height = Math.max(container.clientHeight, 1);
    renderer.setSize(width, height, false);
    camera.aspect = width / height;
    const distance = fitDistance({
      radius: FRAME_RADIUS,
      fovDeg: CAMERA_FOV,
      aspect: camera.aspect,
    });
    camera.position.set(
      0,
      LOOK_AT.y + Math.sin(CAMERA_ELEVATION) * distance,
      Math.cos(CAMERA_ELEVATION) * distance
    );
    camera.lookAt(LOOK_AT);
    camera.updateProjectionMatrix();
  }
  resize();
  const observer = new ResizeObserver(resize);
  observer.observe(container);

  let disposed = false;
  const startedAt = performance.now();
  let lastFrameAt = startedAt;

  // Cú đá: từ lúc bị đá, mô hình rời `pivot` sang `kickGroup` và do `kickBody` lái.
  let figure: Group | null = null;
  let figureHalf: Vector3 | null = null;
  let kickBody: KickBody | null = null;
  let kickGroup: Group | null = null;
  let kickSeconds = 0;

  renderer.setAnimationLoop((now) => {
    const seconds = Math.max(0, (now - lastFrameAt) / 1000);
    lastFrameAt = now;
    if (kickBody && kickGroup) {
      kickBody.advance(seconds);
      kickGroup.position.copy(kickBody.position);
      kickGroup.quaternion.copy(kickBody.quaternion);
      kickSeconds += seconds;
      fill.intensity = FILL_INTENSITY * Math.min(1, kickSeconds / FILL_RAMP_SECONDS);

      const aboveFloor = Math.max(0, kickBody.lowestCornerY() - FLOOR_Y);
      contactShadow.visible = true;
      contactShadow.position.x = kickBody.position.x;
      contactShadow.position.z = kickBody.position.z;
      (contactShadow.material as MeshBasicMaterial).opacity =
        CONTACT_SHADOW_OPACITY * Math.max(0, 1 - aboveFloor / CONTACT_SHADOW_FADE_HEIGHT);
    } else {
      const pose = poseAt((now - startedAt) / 1000);
      pivot.rotation.y = pose.rotationY;
      pivot.position.y = HOVER + pose.offsetY;
    }
    renderer.render(scene, camera);
  });

  const raycaster = new Raycaster();
  const pointer = new Vector2();

  /** Điểm trên mô hình dưới toạ độ màn hình; `null` nếu trượt, chưa tải xong hay đã bị đá. */
  function pick(clientX: number, clientY: number): Intersection | null {
    if (!figure || kickBody) return null;
    const rect = canvas.getBoundingClientRect();
    if (rect.width <= 0 || rect.height <= 0) return null;
    pointer.set(
      ((clientX - rect.left) / rect.width) * 2 - 1,
      -(((clientY - rect.top) / rect.height) * 2 - 1)
    );
    raycaster.setFromCamera(pointer, camera);
    return raycaster.intersectObject(figure, true)[0] ?? null;
  }

  /** `offset` ∈ [−1, 1]: chỗ nhấn lệch tâm mô hình, 0 nếu không có (phím). */
  function startKick(offset: number): boolean {
    if (!figure || !figureHalf || kickBody) return false;
    // Thân vật lý có gốc ở TÂM hộp bao; mô hình có gốc ở chân nên hạ xuống nửa chiều cao.
    // Tư thế lúc bị đá = tư thế đang xoay/nhấp nhô của `pivot`, để không giật hình.
    const group = new Group();
    figure.removeFromParent();
    figure.position.set(0, -figureHalf.y, 0);
    group.add(figure);
    scene.add(group);

    const body = new KickBody(figureHalf.clone(), KICK_WORLD);
    body.position.set(0, pivot.position.y + figureHalf.y, 0);
    body.quaternion.setFromAxisAngle(Y_AXIS, pivot.rotation.y);
    const { velocity, angularVelocity } = kickLaunch(
      kickPush(offset, Math.random()),
      Math.random()
    );
    body.velocity.copy(velocity);
    body.angularVelocity.copy(angularVelocity);

    kickGroup = group;
    kickBody = body;
    return true;
  }

  const ready = new GLTFLoader().loadAsync(MAXWELL_MODEL_URL).then((gltf) => {
    if (disposed) return;
    const model = gltf.scene;

    // Chuẩn hoá: cạnh lớn nhất = MODEL_SIZE, tâm ngang về trục, đáy chạm y = 0.
    const box = new Box3().setFromObject(model);
    const size = box.getSize(new Vector3());
    model.scale.multiplyScalar(MODEL_SIZE / Math.max(size.x, size.y, size.z, 1e-6));
    const fitted = new Box3().setFromObject(model);
    const center = fitted.getCenter(new Vector3());
    model.position.x -= center.x;
    model.position.z -= center.z;
    model.position.y -= fitted.min.y;

    const maxAnisotropy = Math.min(renderer.capabilities.getMaxAnisotropy(), 4);
    model.traverse((node: Object3D) => {
      const mesh = node as Mesh;
      if (!mesh.isMesh) return;
      mesh.castShadow = true;
      const materials = Array.isArray(mesh.material) ? mesh.material : [mesh.material];
      for (const material of materials) {
        const map = (material as MeshStandardMaterial).map;
        if (map) map.anisotropy = maxAnisotropy;
      }
    });

    const holder = new Group();
    holder.add(model);
    pivot.add(holder);

    // Hộp bao đã chuẩn hoá (sau scale): nửa cạnh dùng làm hình dạng vật lý.
    figure = holder;
    figureHalf = fitted.getSize(new Vector3()).multiplyScalar(0.5);
  });

  function dispose() {
    if (disposed) return;
    disposed = true;
    renderer.setAnimationLoop(null);
    observer.disconnect();
    canvas.removeEventListener("webglcontextlost", onContextLost);

    const geometries = new Set<BufferGeometry>();
    const materials = new Set<Material>();
    const textures = new Set<Texture>();
    scene.traverse((node: Object3D) => {
      const mesh = node as Mesh;
      if (!mesh.isMesh) return;
      geometries.add(mesh.geometry);
      const list = Array.isArray(mesh.material) ? mesh.material : [mesh.material];
      for (const material of list) {
        materials.add(material);
        for (const value of Object.values(material)) {
          if (value && (value as Texture).isTexture) textures.add(value as Texture);
        }
      }
    });
    geometries.forEach((g) => g.dispose());
    materials.forEach((m) => m.dispose());
    textures.forEach((tx) => tx.dispose());
    scene.environment?.dispose();
    spot.shadow.dispose();
    renderer.dispose();
    canvas.remove();
  }

  return {
    ready,
    kickAt(clientX, clientY) {
      const hit = pick(clientX, clientY);
      if (!hit) return false;
      // Tâm mô hình ở x = 0 nên toạ độ x của điểm trúng chính là độ lệch tâm.
      return startKick(hit.point.x / (figureHalf?.x ?? 1));
    },
    kick: () => startKick(0),
    isOverModel: (clientX, clientY) => pick(clientX, clientY) !== null,
    dispose,
  };
}
