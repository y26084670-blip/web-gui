import {
  Show,
  createEffect,
  createSignal,
  onCleanup,
  onMount,
} from "solid-js";

export const GEOMETRY_INSTANCE_BUDGET = 20_000;
export const GEOMETRY_RENDER_OBJECT_BUDGET = 1_000;

const INSTANCE_CATEGORIES = Object.freeze(["base", "copy", "mirror"]);
const DEFAULT_PROJECTION = "orthographic";
const PERSPECTIVE_FOV = 45;
const CAMERA_FRAME_PADDING = 1.25;

function normalizeProjection(value) {
  return value === "perspective" ? "perspective" : DEFAULT_PROJECTION;
}

function instanceCategory(instance) {
  if (instance?.mirrorX || instance?.mirrorY) return "mirror";
  if (
    Number(instance?.ls ?? 0) === 0 &&
    Number(instance?.as ?? 0) === 0 &&
    Number(instance?.ps ?? 0) === 0
  ) {
    return "base";
  }
  return "copy";
}

function sourceCategory(primitive) {
  return primitive?.kind === "element-volume" ? "elements" : "regions";
}

function filterEnabled(filters, name) {
  const filterName = name === "copy"
    ? "copies"
    : name === "mirror"
      ? "mirrors"
      : name;
  return filters?.[filterName] !== false;
}

function materialStyle(primitive, category, mode) {
  if (category === "mirror") {
    return {
      color: mode === "wireframe" ? 0xff9aa9 : 0xe76f86,
      opacity: mode === "wireframe" ? 0.82 : 0.38,
    };
  }

  const isElement = primitive.kind === "element-volume";
  const baseColor = isElement ? 0x63a9ff : 0xffb65e;
  const copyColor = isElement ? 0x8dc4ff : 0xffd08f;
  return {
    color: category === "base" ? baseColor : copyColor,
    opacity: mode === "wireframe"
      ? category === "base" ? 0.96 : 0.72
      : category === "base" ? 0.64 : 0.35,
  };
}

function disposeMaterial(material) {
  if (Array.isArray(material)) {
    for (const item of material) item?.dispose?.();
    return;
  }
  material?.dispose?.();
}

function disposeObject(root) {
  root?.traverse?.((object) => {
    object.geometry?.dispose?.();
    disposeMaterial(object.material);
  });
}

function validMatrix(value) {
  return value?.length === 16 && Array.from(value).every(Number.isFinite);
}

function mergedGeometry(THREE, primitive, instances) {
  const sourceVertices = primitive.vertices ?? [];
  const sourceIndices = primitive.indices ?? [];
  const sourceVertexCount = Math.floor(sourceVertices.length / 3);
  if (sourceVertexCount === 0 || sourceVertices.length % 3 !== 0) return null;

  const positions = new Float32Array(sourceVertices.length * instances.length);
  const indexCount = sourceIndices.length;
  const totalVertexCount = sourceVertexCount * instances.length;
  const IndexArray = totalVertexCount > 65_535 ? Uint32Array : Uint16Array;
  const indices = indexCount > 0
    ? new IndexArray(indexCount * instances.length)
    : null;
  const matrix = new THREE.Matrix4();
  const vertex = new THREE.Vector3();
  const isSurface = primitive.kind !== "region-line";

  instances.forEach((instance, instanceIndex) => {
    matrix.fromArray(instance.matrix);
    const vertexOffset = instanceIndex * sourceVertexCount;
    const positionOffset = instanceIndex * sourceVertices.length;

    for (let index = 0; index < sourceVertexCount; index += 1) {
      const sourceOffset = index * 3;
      vertex.set(
        sourceVertices[sourceOffset],
        sourceVertices[sourceOffset + 1],
        sourceVertices[sourceOffset + 2],
      );
      vertex.applyMatrix4(matrix);
      const targetOffset = positionOffset + sourceOffset;
      positions[targetOffset] = vertex.x;
      positions[targetOffset + 1] = vertex.y;
      positions[targetOffset + 2] = vertex.z;
    }

    if (!indices) return;
    const targetIndexOffset = instanceIndex * indexCount;
    const reflected = isSurface && matrix.determinant() < 0;
    if (reflected && indexCount % 3 === 0) {
      for (let index = 0; index < indexCount; index += 3) {
        indices[targetIndexOffset + index] =
          vertexOffset + sourceIndices[index];
        indices[targetIndexOffset + index + 1] =
          vertexOffset + sourceIndices[index + 2];
        indices[targetIndexOffset + index + 2] =
          vertexOffset + sourceIndices[index + 1];
      }
      return;
    }

    for (let index = 0; index < indexCount; index += 1) {
      indices[targetIndexOffset + index] =
        vertexOffset + sourceIndices[index];
    }
  });

  const geometry = new THREE.BufferGeometry();
  geometry.setAttribute("position", new THREE.BufferAttribute(positions, 3));
  if (indices) geometry.setIndex(new THREE.BufferAttribute(indices, 1));
  return geometry;
}

function renderableFor(THREE, primitive, instances, category, mode) {
  const geometry = mergedGeometry(THREE, primitive, instances);
  if (!geometry) return null;

  const style = materialStyle(primitive, category, mode);
  let object;
  if (primitive.kind === "region-line") {
    object = new THREE.LineSegments(
      geometry,
      new THREE.LineBasicMaterial({
        color: style.color,
        opacity: style.opacity,
        transparent: style.opacity < 1,
      }),
    );
  } else if (mode === "wireframe") {
    const edgeGeometry = new THREE.EdgesGeometry(geometry);
    geometry.dispose();
    object = new THREE.LineSegments(
      edgeGeometry,
      new THREE.LineBasicMaterial({
        color: style.color,
        opacity: style.opacity,
        transparent: style.opacity < 1,
      }),
    );
  } else {
    geometry.computeVertexNormals();
    object = new THREE.Mesh(
      geometry,
      new THREE.MeshStandardMaterial({
        color: style.color,
        opacity: style.opacity,
        transparent: style.opacity < 1,
        depthWrite: style.opacity >= 0.6,
        metalness: 0.05,
        roughness: 0.78,
        side: THREE.DoubleSide,
      }),
    );
  }

  object.name = `${primitive.source?.schemaId ?? "geometry"}:` +
    `${primitive.source?.recordIndex ?? "?"}:${category}`;
  object.userData = {
    category,
    instanceCount: instances.length,
    primitiveKind: primitive.kind,
    source: primitive.source,
  };
  return object;
}

function fitCameraToBounds(THREE, camera, controls, bounds, targetOverride) {
  if (!bounds || bounds.isEmpty()) return false;

  const sphere = bounds.getBoundingSphere(new THREE.Sphere());
  const target = targetOverride?.clone?.() ?? sphere.center;
  const radius = Math.max(
    sphere.radius + sphere.center.distanceTo(target),
    1e-6,
  );
  let distance;

  if (camera.isOrthographicCamera) {
    const aspect = Math.max(
      (camera.right - camera.left) / (camera.top - camera.bottom),
      1e-6,
    );
    const halfHeight = CAMERA_FRAME_PADDING * radius * Math.max(1, 1 / aspect);
    camera.left = -halfHeight * aspect;
    camera.right = halfHeight * aspect;
    camera.top = halfHeight;
    camera.bottom = -halfHeight;
    camera.zoom = 1;
    distance = Math.max(radius * 3, 1);
  } else {
    const verticalFov = THREE.MathUtils.degToRad(camera.fov);
    const horizontalFov = 2 * Math.atan(
      Math.tan(verticalFov / 2) * camera.aspect,
    );
    distance = CAMERA_FRAME_PADDING * Math.max(
      radius / Math.tan(verticalFov / 2),
      radius / Math.tan(Math.max(horizontalFov, 1e-6) / 2),
    );
  }

  const direction = camera.position.clone().sub(controls.target);
  if (direction.lengthSq() < 1e-12) direction.set(1, 1, 1);
  direction.normalize();

  controls.target.copy(target);
  camera.position.copy(target).addScaledVector(direction, distance);
  camera.near = Math.max(radius / 10_000, 1e-5);
  camera.far = Math.max(distance + radius * 10, radius * 1_000, 1);
  camera.updateProjectionMatrix();
  controls.update();
  return true;
}

function createCamera(THREE, projection, aspect) {
  const camera = projection === "perspective"
    ? new THREE.PerspectiveCamera(
      PERSPECTIVE_FOV,
      aspect,
      0.01,
      1_000_000,
    )
    : new THREE.OrthographicCamera(
      -aspect,
      aspect,
      1,
      -1,
      0.01,
      1_000_000,
    );

  camera.position.set(1, 1, 1);
  camera.up.set(0, 0, 1);
  return camera;
}

function resizeCameraProjection(camera, aspect) {
  if (camera.isOrthographicCamera) {
    const halfHeight = Math.max((camera.top - camera.bottom) / 2, 1e-9);
    camera.left = -halfHeight * aspect;
    camera.right = halfHeight * aspect;
  } else {
    camera.aspect = aspect;
  }
  camera.updateProjectionMatrix();
}

export function ThreeGeometryViewport(props) {
  let host;
  let renderer;
  let threeScene;
  let camera;
  let controls;
  let geometryRoot;
  let helperRoot;
  let currentBounds;
  let resizeObserver;
  let renderFrame = 0;
  let disposed = false;
  let hasFramedGeometry = false;
  let activeProjection = DEFAULT_PROJECTION;
  let THREE;

  const [ready, setReady] = createSignal(false);
  const [loading, setLoading] = createSignal(true);
  const [error, setError] = createSignal("");
  const [renderedCount, setRenderedCount] = createSignal(0);

  const reportError = (value) => {
    const message = value instanceof Error ? value.message : String(value);
    setError(message);
    props.onError?.(message);
  };

  const requestRender = () => {
    if (!renderer || !threeScene || !camera || renderFrame) return;
    renderFrame = requestAnimationFrame(() => {
      renderFrame = 0;
      renderer.render(threeScene, camera);
    });
  };

  const resizeRenderer = () => {
    if (!host || !renderer || !camera) return;
    const width = Math.max(1, Math.floor(host.clientWidth));
    const height = Math.max(1, Math.floor(host.clientHeight));
    renderer.setSize(width, height, false);
    resizeCameraProjection(camera, width / height);
    requestRender();
  };

  const switchProjection = (value) => {
    const projection = normalizeProjection(value);
    if (
      !ready() ||
      !THREE ||
      !camera ||
      !controls ||
      projection === activeProjection
    ) {
      return;
    }

    const width = Math.max(1, Math.floor(host?.clientWidth ?? 1));
    const height = Math.max(1, Math.floor(host?.clientHeight ?? 1));
    const preservedTarget = controls.target.clone();
    const nextCamera = createCamera(THREE, projection, width / height);
    nextCamera.position.copy(camera.position);
    nextCamera.up.copy(camera.up);
    camera = nextCamera;
    activeProjection = projection;
    controls.object = camera;

    if (currentBounds && !currentBounds.isEmpty()) {
      fitCameraToBounds(
        THREE,
        camera,
        controls,
        currentBounds,
        preservedTarget,
      );
    } else {
      controls.update();
    }
    requestRender();
  };

  const replaceGeometry = (sceneModel, filters, mode) => {
    if (!ready() || !THREE || !threeScene) return;

    if (geometryRoot) {
      threeScene.remove(geometryRoot);
      disposeObject(geometryRoot);
    }
    if (helperRoot) {
      threeScene.remove(helperRoot);
      disposeObject(helperRoot);
    }

    geometryRoot = new THREE.Group();
    geometryRoot.name = "geometry-root";
    helperRoot = new THREE.Group();
    helperRoot.name = "geometry-helpers";
    threeScene.add(geometryRoot, helperRoot);

    const budget = Math.max(
      1,
      Math.floor(props.instanceBudget ?? GEOMETRY_INSTANCE_BUDGET),
    );
    const objectBudget = Math.max(
      1,
      Math.floor(
        props.objectBudget ?? GEOMETRY_RENDER_OBJECT_BUDGET,
      ),
    );
    let remaining = budget;
    let selectedInstances = 0;
    let renderedInstances = 0;
    let renderedPrimitives = 0;
    let invalidInstances = 0;

    for (const primitive of sceneModel?.primitives ?? []) {
      if (!filterEnabled(filters, sourceCategory(primitive))) continue;
      const instances = primitive.instances ?? [];

      for (const category of INSTANCE_CATEGORIES) {
        if (!filterEnabled(filters, category)) continue;
        const categoryInstances = instances.filter(
          (instance) => instanceCategory(instance) === category,
        );
        const validInstances = categoryInstances.filter(
          (instance) => validMatrix(instance.matrix),
        );
        selectedInstances += categoryInstances.length;
        invalidInstances += categoryInstances.length - validInstances.length;
        if (
          remaining <= 0 ||
          renderedPrimitives >= objectBudget ||
          validInstances.length === 0
        ) {
          continue;
        }

        const accepted = validInstances.slice(0, remaining);
        const object = renderableFor(
          THREE,
          primitive,
          accepted,
          category,
          mode,
        );
        if (!object) continue;
        geometryRoot.add(object);
        renderedPrimitives += 1;
        renderedInstances += accepted.length;
        remaining -= accepted.length;
      }
    }

    currentBounds = new THREE.Box3().setFromObject(geometryRoot);
    if (!currentBounds.isEmpty()) {
      const size = currentBounds.getSize(new THREE.Vector3());
      const axesSize = Math.max(size.x, size.y, size.z, 1) * 0.18;
      helperRoot.add(new THREE.AxesHelper(axesSize));
      if (!hasFramedGeometry) {
        fitCameraToBounds(THREE, camera, controls, currentBounds);
        hasFramedGeometry = true;
      }
    } else {
      hasFramedGeometry = false;
    }

    const truncated = selectedInstances - invalidInstances > renderedInstances;
    const stats = {
      budget,
      objectBudget,
      invalidInstances,
      renderedInstances,
      renderedPrimitives,
      selectedInstances,
      truncated,
    };
    setRenderedCount(renderedInstances);
    props.onRenderStats?.(stats);
    setError("");
    props.onError?.("");
    requestRender();
  };

  const fitAll = () => {
    if (!ready() || !currentBounds) return;
    fitCameraToBounds(THREE, camera, controls, currentBounds);
    requestRender();
  };

  onMount(() => {
    void Promise.all([
      import("three"),
      import("three/addons/controls/OrbitControls.js"),
    ]).then(([threeModule, controlsModule]) => {
      if (disposed || !host) return;
      THREE = threeModule;
      threeScene = new THREE.Scene();
      threeScene.background = new THREE.Color(0x141a20);
      activeProjection = normalizeProjection(props.projection);
      camera = createCamera(THREE, activeProjection, 1);

      renderer = new THREE.WebGLRenderer({
        antialias: true,
        powerPreference: "high-performance",
      });
      renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, 2));
      if (THREE.SRGBColorSpace) renderer.outputColorSpace = THREE.SRGBColorSpace;
      host.append(renderer.domElement);

      controls = new controlsModule.OrbitControls(camera, renderer.domElement);
      controls.enableDamping = false;
      controls.screenSpacePanning = true;
      controls.addEventListener("change", requestRender);

      threeScene.add(new THREE.HemisphereLight(0xffffff, 0x283441, 1.7));
      const light = new THREE.DirectionalLight(0xffffff, 1.35);
      light.position.set(1, -1, 2);
      threeScene.add(light);

      const handleContextLost = (event) => {
        event.preventDefault();
        reportError("Контекст WebGL потерян");
      };
      const handleContextRestored = () => {
        setError("");
        props.onError?.("");
        requestRender();
      };
      renderer.domElement.addEventListener("webglcontextlost", handleContextLost);
      renderer.domElement.addEventListener(
        "webglcontextrestored",
        handleContextRestored,
      );
      renderer.domElement.__geometryContextHandlers = {
        handleContextLost,
        handleContextRestored,
      };

      resizeObserver = new ResizeObserver(resizeRenderer);
      resizeObserver.observe(host);
      resizeRenderer();
      setReady(true);
      setLoading(false);
    }).catch((loadError) => {
      if (disposed) return;
      setLoading(false);
      reportError(loadError);
    });
  });

  createEffect(() => {
    const sceneModel = props.scene;
    const filters = props.filters;
    const mode = props.mode ?? "surfaces";
    if (!ready()) return;

    try {
      replaceGeometry(sceneModel, filters, mode);
    } catch (renderError) {
      reportError(renderError);
    }
  });

  createEffect(() => {
    const projection = props.projection;
    if (ready()) switchProjection(projection);
  });

  createEffect(() => {
    props.fitRequest;
    if (ready()) fitAll();
  });

  onCleanup(() => {
    disposed = true;
    setReady(false);
    resizeObserver?.disconnect();
    if (renderFrame) cancelAnimationFrame(renderFrame);
    controls?.removeEventListener("change", requestRender);
    controls?.dispose();
    disposeObject(geometryRoot);
    disposeObject(helperRoot);
    if (renderer?.domElement) {
      const handlers = renderer.domElement.__geometryContextHandlers;
      if (handlers) {
        renderer.domElement.removeEventListener(
          "webglcontextlost",
          handlers.handleContextLost,
        );
        renderer.domElement.removeEventListener(
          "webglcontextrestored",
          handlers.handleContextRestored,
        );
      }
    }
    renderer?.renderLists?.dispose?.();
    renderer?.dispose?.();
    renderer?.forceContextLoss?.();
    renderer?.domElement?.remove();
    renderer = null;
    threeScene = null;
  });

  return (
    <div
      ref={(element) => (host = element)}
      class="three-geometry-viewport"
      role="img"
      aria-label="Трёхмерная геометрия элементов и областей"
      aria-busy={loading()}
    >
      <Show when={loading()}>
        <div class="geometry-viewport-overlay">Загрузка 3D-модуля…</div>
      </Show>
      <Show when={!loading() && !error() && renderedCount() === 0}>
        <div class="geometry-viewport-overlay">
          Нет геометрии для выбранных слоёв
        </div>
      </Show>
      <Show when={error()}>
        <div class="geometry-viewport-overlay geometry-viewport-error" role="alert">
          3D-представление недоступно: {error()}
        </div>
      </Show>
    </div>
  );
}
