// Cảnh 3D của trang ẩn Maxwell the Cat (brief 20261012-feature-maxwell-easter-egg).
//
// Dựng bằng `three` thuần, KHÔNG React: vòng đời cảnh là "tạo → chạy → dispose",
// gắn vào một div do component sở hữu. Chỉ module này (và `three`) nằm trong
// chunk của route /maxwell — component nạp nó bằng `import()` động nên các trang
// khác không nặng thêm một byte.
//
// Bố cục: bệ tròn tối màu như bệ trưng bày; một đèn rọi (SpotLight) thẳng từ trên
// xuống kèm chùm sáng mờ + vệt sáng trên mặt bệ; mô hình lơ lửng trên bệ, xoay và
// nhấp nhô (motion.ts); nền đen tuyền. Camera lùi theo CẠNH HẸP của khung (xem
// framing.ts) nên điện thoại cầm dọc không bị cắt hai bên.
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
  Scene,
  SpotLight,
  SRGBColorSpace,
  TorusGeometry,
  Vector3,
  WebGLRenderer,
  type BufferGeometry,
  type Material,
  type Object3D,
  type Texture,
} from "three";
import { RoomEnvironment } from "three/addons/environments/RoomEnvironment.js";
import { GLTFLoader } from "three/addons/loaders/GLTFLoader.js";
import { fitDistance } from "./framing";
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

  // Bệ trưng bày.
  const pedestal = new Mesh(
    new CylinderGeometry(PEDESTAL_RADIUS, PEDESTAL_RADIUS * 1.05, 0.3, 72),
    new MeshStandardMaterial({ color: 0x17191c, roughness: 0.35, metalness: 0.55 })
  );
  pedestal.position.y = -0.15;
  pedestal.receiveShadow = true;
  scene.add(pedestal);

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

  renderer.setAnimationLoop((now) => {
    const pose = poseAt((now - startedAt) / 1000);
    pivot.rotation.y = pose.rotationY;
    pivot.position.y = HOVER + pose.offsetY;
    renderer.render(scene, camera);
  });

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

  return { ready, dispose };
}
