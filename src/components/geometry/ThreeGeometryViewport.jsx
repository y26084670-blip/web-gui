import {
  Show,
  createEffect,
  createSignal,
  onCleanup,
  onMount,
} from "solid-js";

import {
  instanceVisible,
  primitiveVisible,
} from "../../services/visualization/geometryRenderFilters.js";
import {
  findVertexMetadataRange,
  formatGeometryTooltip,
  formatVertexTooltip,
  geometryHitInstance,
  vertexHitMetadata,
} from "../../services/visualization/geometryPicking.js";
import {
  GEOMETRY_MATERIAL_KINDS,
  geometryMaterialStyle as resolveGeometryMaterialStyle,
} from "../../services/visualization/geometryMaterialStyle.js";

export const GEOMETRY_INSTANCE_BUDGET = 20_000;
export const GEOMETRY_RENDER_OBJECT_BUDGET = 1_000;

const INSTANCE_CATEGORIES = Object.freeze(["base", "copy", "mirror"]);
const DEFAULT_PROJECTION = "orthographic";
const PERSPECTIVE_FOV = 45;
const CAMERA_FRAME_PADDING = 1.25;
const AXES_GIZMO_SIZE = 104;
const AXES_GIZMO_MARGIN = 8;
const VERTEX_POINT_SIZE = 9;
const PICK_INTERVAL_MS = 80;

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

function materialStyle(primitive, category, mode) {
  const isElement = primitive.kind === "element-volume";
  const original = category === "base";
  const palette = isElement
    ? resolveGeometryMaterialStyle(primitive.materialKind, original)
    : {
        color: original ? 0xd99043 : 0xffb65e,
        edgeColor: 0x754817,
      };

  return {
    ...palette,
    opacity: mode === "translucent"
      ? primitive.kind === "region-line" ? 0.68 : 0.42
      : 1,
  };
}

function renderObjectCost(primitive, mode, showEdges) {
  if (
    primitive.kind === "region-line" ||
    mode === "wireframe" ||
    !showEdges
  ) {
    return 1;
  }

  return 2;
}

function disposeMaterial(material) {
  if (Array.isArray(material)) {
    for (const item of material) item?.dispose?.();
    return;
  }
  material?.map?.dispose?.();
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

function mergedWireframeGeometry(THREE, primitive, instances) {
  const sourceVertices = primitive.vertices ?? [];
  const sourceIndices = primitive.indices ?? [];
  if (sourceVertices.length === 0 || sourceIndices.length === 0) return null;

  const sourceGeometry = new THREE.BufferGeometry();
  sourceGeometry.setAttribute(
    "position",
    new THREE.BufferAttribute(new Float32Array(sourceVertices), 3),
  );
  sourceGeometry.setIndex(Array.from(sourceIndices));
  const sourceEdges = new THREE.EdgesGeometry(sourceGeometry);
  sourceGeometry.dispose();

  const sourcePositions = sourceEdges.getAttribute("position");
  const vertexSpan = sourcePositions?.count ?? 0;
  if (vertexSpan === 0) {
    sourceEdges.dispose();
    return null;
  }

  const positions = new Float32Array(
    sourcePositions.array.length * instances.length,
  );
  const matrix = new THREE.Matrix4();
  const vertex = new THREE.Vector3();
  instances.forEach((instance, instanceIndex) => {
    matrix.fromArray(instance.matrix);
    const targetOffset = instanceIndex * sourcePositions.array.length;
    for (let index = 0; index < vertexSpan; index += 1) {
      vertex.fromBufferAttribute(sourcePositions, index).applyMatrix4(matrix);
      const offset = targetOffset + index * 3;
      positions[offset] = vertex.x;
      positions[offset + 1] = vertex.y;
      positions[offset + 2] = vertex.z;
    }
  });
  sourceEdges.dispose();

  const geometry = new THREE.BufferGeometry();
  geometry.setAttribute("position", new THREE.BufferAttribute(positions, 3));
  return { geometry, vertexSpan };
}

function appendSurfaceEdges(
  THREE,
  surface,
  primitive,
  instances,
  style,
  mode,
) {
  const wireframe = mergedWireframeGeometry(THREE, primitive, instances);
  if (!wireframe) return;

  const translucent = mode === "translucent";
  const edges = new THREE.LineSegments(
    wireframe.geometry,
    new THREE.LineBasicMaterial({
      color: style.edgeColor,
      depthTest: true,
      depthWrite: false,
      linewidth: 1,
      opacity: translucent ? 0.78 : 1,
      transparent: translucent,
    }),
  );
  edges.name = "surface-edges";
  edges.renderOrder = 2;
  surface.add(edges);
}

function renderableFor(
  THREE,
  primitive,
  instances,
  category,
  mode,
  showEdges,
) {
  const style = materialStyle(primitive, category, mode);
  const virtual = primitive.materialKind === GEOMETRY_MATERIAL_KINDS.VIRTUAL;
  const showSurfaceEdges = showEdges === true;
  let object;
  let pickKind;
  let pickSpan;
  if (primitive.kind === "region-line") {
    const geometry = mergedGeometry(THREE, primitive, instances);
    if (!geometry) return null;
    object = new THREE.LineSegments(
      geometry,
      new THREE.LineBasicMaterial({
        color: style.color,
        depthWrite: mode !== "translucent",
        opacity: style.opacity,
        transparent: style.opacity < 1,
      }),
    );
    pickKind = "lines";
    pickSpan = primitive.indices?.length ?? 0;
  } else if (mode === "wireframe") {
    const wireframe = mergedWireframeGeometry(THREE, primitive, instances);
    if (!wireframe) return null;
    object = new THREE.LineSegments(
      wireframe.geometry,
      new THREE.LineBasicMaterial({
        color: virtual ? style.edgeColor : style.color,
        opacity: style.opacity,
        transparent: style.opacity < 1,
      }),
    );
    pickKind = "lines";
    pickSpan = wireframe.vertexSpan;
  } else {
    const geometry = mergedGeometry(THREE, primitive, instances);
    if (!geometry) return null;
    object = new THREE.Mesh(
      geometry,
      new THREE.MeshLambertMaterial({
        color: style.color,
        opacity: style.opacity,
        transparent: style.opacity < 1,
        depthWrite: mode !== "translucent",
        flatShading: true,
        polygonOffset: showSurfaceEdges,
        polygonOffsetFactor: showSurfaceEdges ? 1 : 0,
        polygonOffsetUnits: showSurfaceEdges ? 1 : 0,
        side: THREE.DoubleSide,
      }),
    );
    if (showSurfaceEdges) {
      appendSurfaceEdges(
        THREE,
        object,
        primitive,
        instances,
        style,
        mode,
      );
    }
    pickKind = "mesh";
    pickSpan = Math.floor((primitive.indices?.length ?? 0) / 3);
  }

  object.name = `${primitive.source?.schemaId ?? "geometry"}:` +
    `${primitive.source?.recordIndex ?? "?"}:${category}`;
  object.userData = {
    category,
    instanceCount: instances.length,
    pick: {
      instances,
      kind: pickKind,
      span: pickSpan,
    },
    primitiveKind: primitive.kind,
    source: primitive.source,
  };
  return object;
}

function appendVertexBatch(THREE, primitive, instances, positions, ranges) {
  const sourceVertices = primitive.vertices ?? [];
  const sourceVertexCount = Math.floor(sourceVertices.length / 3);
  if (sourceVertexCount === 0) return;

  const start = positions.length / 3;
  const matrix = new THREE.Matrix4();
  const vertex = new THREE.Vector3();

  for (const instance of instances) {
    matrix.fromArray(instance.matrix);
    for (let index = 0; index < sourceVertexCount; index += 1) {
      const offset = index * 3;
      vertex.set(
        sourceVertices[offset],
        sourceVertices[offset + 1],
        sourceVertices[offset + 2],
      ).applyMatrix4(matrix);
      positions.push(vertex.x, vertex.y, vertex.z);
    }
  }

  ranges.push({
    end: positions.length / 3,
    instances,
    source: primitive.source,
    sourceVertexCount,
    start,
  });
}

function createVertexPoints(THREE, positions) {
  if (positions.length === 0) return null;

  const geometry = new THREE.BufferGeometry();
  geometry.setAttribute(
    "position",
    new THREE.BufferAttribute(new Float32Array(positions), 3),
  );
  geometry.computeBoundingSphere();
  const points = new THREE.Points(
    geometry,
    new THREE.PointsMaterial({
      color: 0xffee75,
      depthTest: true,
      depthWrite: false,
      size: VERTEX_POINT_SIZE,
      sizeAttenuation: false,
    }),
  );
  points.name = "geometry-vertices";
  points.renderOrder = 20;
  return points;
}

function createAxisLabel(THREE, text, color) {
  const canvas = document.createElement("canvas");
  canvas.width = 64;
  canvas.height = 64;
  const context = canvas.getContext("2d");
  context.clearRect(0, 0, canvas.width, canvas.height);
  context.fillStyle = color;
  context.font = "bold 40px sans-serif";
  context.textAlign = "center";
  context.textBaseline = "middle";
  context.fillText(text, 32, 33);

  const texture = new THREE.CanvasTexture(canvas);
  if (THREE.SRGBColorSpace) texture.colorSpace = THREE.SRGBColorSpace;
  const sprite = new THREE.Sprite(new THREE.SpriteMaterial({
    depthTest: false,
    depthWrite: false,
    map: texture,
    transparent: true,
  }));
  sprite.scale.set(0.34, 0.34, 0.34);
  sprite.renderOrder = 4;
  return sprite;
}

function createAxisArrow(THREE, direction, color, label, cssColor) {
  const root = new THREE.Group();
  const material = new THREE.MeshBasicMaterial({
    color,
    depthTest: false,
    depthWrite: false,
  });
  const shaft = new THREE.Mesh(
    new THREE.CylinderGeometry(0.035, 0.035, 0.72, 12),
    material,
  );
  shaft.position.y = 0.36;
  const head = new THREE.Mesh(
    new THREE.ConeGeometry(0.11, 0.28, 16),
    material.clone(),
  );
  head.position.y = 0.86;
  root.add(shaft, head);
  root.quaternion.setFromUnitVectors(
    new THREE.Vector3(0, 1, 0),
    direction,
  );

  const labelSprite = createAxisLabel(THREE, label, cssColor);
  labelSprite.position.set(0, 1.17, 0);
  root.add(labelSprite);
  return root;
}

function createAxesGizmo(THREE) {
  const root = new THREE.Group();
  root.name = "screen-axes-gizmo";
  root.add(
    createAxisArrow(
      THREE,
      new THREE.Vector3(1, 0, 0),
      0xf05252,
      "X",
      "#ff6b6b",
    ),
    createAxisArrow(
      THREE,
      new THREE.Vector3(0, 1, 0),
      0x4bc26b,
      "Y",
      "#62dc82",
    ),
    createAxisArrow(
      THREE,
      new THREE.Vector3(0, 0, 1),
      0x4c8ff2,
      "Z",
      "#75aaff",
    ),
  );
  return root;
}

function worldUnitsPerPixel(camera, target, viewportHeight) {
  const height = Math.max(1, viewportHeight);
  if (camera.isOrthographicCamera) {
    return Math.abs(camera.top - camera.bottom) /
      Math.max(camera.zoom * height, 1e-9);
  }

  const distance = Math.max(camera.position.distanceTo(target), 1e-9);
  const verticalFov = camera.fov * Math.PI / 180;
  return 2 * distance * Math.tan(verticalFov / 2) / height;
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
  let axesScene;
  let axesCamera;
  let axesRoot;
  let camera;
  let controls;
  let geometryRoot;
  let helperRoot;
  let vertexPoints;
  let vertexBatches = [];
  let vertexRanges = [];
  let geometryPickTargets = [];
  let currentBounds;
  let resizeObserver;
  let raycaster;
  let pointerNdc;
  let pendingPointer;
  let handlePointerMove;
  let handlePointerLeave;
  let handleControlsStart;
  let handleControlsEnd;
  let renderFrame = 0;
  let pickFrame = 0;
  let pickTimer = 0;
  let lastPickTime = Number.NEGATIVE_INFINITY;
  let viewportWidth = 1;
  let viewportHeight = 1;
  let verticesVisible = false;
  let controlsInteracting = false;
  let contextLost = false;
  let disposed = false;
  let hasFramedGeometry = false;
  let activeProjection = DEFAULT_PROJECTION;
  let THREE;

  const [ready, setReady] = createSignal(false);
  const [loading, setLoading] = createSignal(true);
  const [error, setError] = createSignal("");
  const [renderedCount, setRenderedCount] = createSignal(0);
  const [hoverTooltip, setHoverTooltip] = createSignal(null);

  const reportError = (value) => {
    const message = value instanceof Error ? value.message : String(value);
    setError(message);
    props.onError?.(message);
  };

  const requestRender = () => {
    if (!renderer || !threeScene || !camera || renderFrame) return;
    renderFrame = requestAnimationFrame(() => {
      renderFrame = 0;
      renderer.setScissorTest(false);
      renderer.setViewport(0, 0, viewportWidth, viewportHeight);
      renderer.clear(true, true, true);
      renderer.render(threeScene, camera);

      if (axesScene && axesCamera && axesRoot && controls) {
        const size = axesGizmoSize();
        const direction = camera.position.clone().sub(controls.target);
        if (direction.lengthSq() < 1e-12) direction.set(1, 1, 1);
        axesCamera.position.copy(direction.normalize().multiplyScalar(5));
        axesCamera.up.copy(camera.up);
        axesCamera.lookAt(0, 0, 0);
        axesCamera.updateMatrixWorld();

        renderer.clearDepth();
        renderer.setScissor(
          AXES_GIZMO_MARGIN,
          AXES_GIZMO_MARGIN,
          size,
          size,
        );
        renderer.setViewport(
          AXES_GIZMO_MARGIN,
          AXES_GIZMO_MARGIN,
          size,
          size,
        );
        renderer.setScissorTest(true);
        renderer.render(axesScene, axesCamera);
        renderer.setScissorTest(false);
        renderer.setViewport(0, 0, viewportWidth, viewportHeight);
      }
    });
  };

  const resizeRenderer = () => {
    if (!host || !renderer || !camera) return;
    viewportWidth = Math.max(1, Math.floor(host.clientWidth));
    viewportHeight = Math.max(1, Math.floor(host.clientHeight));
    renderer.setSize(viewportWidth, viewportHeight, false);
    resizeCameraProjection(camera, viewportWidth / viewportHeight);
    setHoverTooltip(null);
    requestRender();
  };

  const cancelPendingPick = () => {
    pendingPointer = null;
    if (pickFrame) cancelAnimationFrame(pickFrame);
    if (pickTimer) clearTimeout(pickTimer);
    pickFrame = 0;
    pickTimer = 0;
  };

  const clearHoverTooltip = () => {
    cancelPendingPick();
    setHoverTooltip(null);
  };

  const axesGizmoSize = () => Math.max(
    1,
    Math.min(
      AXES_GIZMO_SIZE,
      viewportWidth - 2 * AXES_GIZMO_MARGIN,
      viewportHeight - 2 * AXES_GIZMO_MARGIN,
    ),
  );

  const pointCoordinates = (globalIndex) => {
    const attribute = vertexPoints?.geometry?.getAttribute?.("position");
    if (!attribute || globalIndex < 0 || globalIndex >= attribute.count) {
      return null;
    }

    return [
      attribute.getX(globalIndex),
      attribute.getY(globalIndex),
      attribute.getZ(globalIndex),
    ];
  };

  const showTooltip = (text, x, y) => {
    const widthEstimate = Math.min(390, Math.max(180, text.length * 6));
    const lineCount = Math.max(1, Math.ceil(text.length * 6 / widthEstimate));
    const heightEstimate = 18 + lineCount * 15;
    const left = x + 14 + widthEstimate <= viewportWidth
      ? x + 14
      : Math.max(8, x - widthEstimate - 14);
    const top = y + 14 + heightEstimate <= viewportHeight
      ? y + 14
      : Math.max(8, y - heightEstimate - 14);
    setHoverTooltip({ left, text, top });
  };

  const pickAtPointer = (pointer) => {
    if (
      !pointer ||
      !renderer ||
      !camera ||
      !controls ||
      !raycaster ||
      !pointerNdc
    ) {
      setHoverTooltip(null);
      return;
    }

    const bounds = renderer.domElement.getBoundingClientRect();
    const x = pointer.clientX - bounds.left;
    const y = pointer.clientY - bounds.top;
    if (x < 0 || y < 0 || x > bounds.width || y > bounds.height) {
      setHoverTooltip(null);
      return;
    }

    const gizmoSize = axesGizmoSize();
    if (
      x <= AXES_GIZMO_MARGIN + gizmoSize &&
      y >= bounds.height - AXES_GIZMO_MARGIN - gizmoSize
    ) {
      setHoverTooltip(null);
      return;
    }

    pointerNdc.set(
      x / Math.max(bounds.width, 1) * 2 - 1,
      -(y / Math.max(bounds.height, 1)) * 2 + 1,
    );
    raycaster.setFromCamera(pointerNdc, camera);
    const unitsPerPixel = worldUnitsPerPixel(
      camera,
      controls.target,
      bounds.height,
    );
    raycaster.params.Line.threshold = unitsPerPixel * 5;
    raycaster.params.Points.threshold = unitsPerPixel * 9;

    const geometryHit = raycaster.intersectObjects(
      geometryPickTargets,
      false,
    )[0] ?? null;
    const vertexHit = verticesVisible && vertexPoints
      ? raycaster.intersectObject(vertexPoints, false)[0] ?? null
      : null;

    if (
      vertexHit &&
      Number.isSafeInteger(vertexHit.index) &&
      (
        !geometryHit ||
        vertexHit.distance <= geometryHit.distance + unitsPerPixel * 9
      )
    ) {
      const range = findVertexMetadataRange(vertexRanges, vertexHit.index);
      const coordinates = pointCoordinates(vertexHit.index);
      if (range && coordinates) {
        const metadata = vertexHitMetadata(range, vertexHit.index);
        if (metadata) {
          showTooltip(
            formatVertexTooltip(
              range.source,
              metadata.vertexIndex,
              coordinates,
              metadata.instance,
            ),
            x,
            y,
          );
          return;
        }
      }
    }

    if (geometryHit?.object?.userData?.source) {
      showTooltip(
        formatGeometryTooltip(
          geometryHit.object.userData.source,
          geometryHitInstance(geometryHit),
        ),
        x,
        y,
      );
      return;
    }

    setHoverTooltip(null);
  };

  const queuePointerPick = (event) => {
    if (controlsInteracting) return;
    pendingPointer = {
      clientX: event.clientX,
      clientY: event.clientY,
    };
    if (pickFrame || pickTimer) return;

    const scheduleFrame = () => {
      pickTimer = 0;
      if (!pendingPointer || controlsInteracting) return;
      pickFrame = requestAnimationFrame(() => {
        pickFrame = 0;
        const pointer = pendingPointer;
        pendingPointer = null;
        lastPickTime = performance.now();
        pickAtPointer(pointer);
      });
    };
    const delay = Math.max(0, PICK_INTERVAL_MS - (
      performance.now() - lastPickTime
    ));
    if (delay > 0) {
      pickTimer = window.setTimeout(scheduleFrame, delay);
    } else {
      scheduleFrame();
    }
  };

  const materializeVertexPoints = () => {
    if (!THREE || !helperRoot || vertexPoints) return;

    const positions = [];
    vertexRanges = [];
    for (const batch of vertexBatches) {
      appendVertexBatch(
        THREE,
        batch.primitive,
        batch.instances,
        positions,
        vertexRanges,
      );
    }

    vertexPoints = createVertexPoints(THREE, positions);
    if (vertexPoints) {
      vertexPoints.visible = verticesVisible;
      helperRoot.add(vertexPoints);
    }
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

  const replaceGeometry = (sceneModel, filters, mode, showEdges) => {
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
    geometryPickTargets = [];
    vertexBatches = [];
    vertexRanges = [];
    vertexPoints = null;
    clearHoverTooltip();

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
      if (!primitiveVisible(
        primitive,
        filters?.objectModes,
        filters?.selections,
      )) {
        continue;
      }
      const instances = primitive.instances ?? [];

      for (const category of INSTANCE_CATEGORIES) {
        const categoryInstances = instances.filter(
          (instance) =>
            instanceCategory(instance) === category &&
            instanceVisible(instance, filters?.symmetry),
        );
        const validInstances = categoryInstances.filter(
          (instance) => validMatrix(instance.matrix),
        );
        const objectCost = renderObjectCost(primitive, mode, showEdges);
        selectedInstances += categoryInstances.length;
        invalidInstances += categoryInstances.length - validInstances.length;
        if (
          remaining <= 0 ||
          renderedPrimitives + objectCost > objectBudget ||
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
          showEdges,
        );
        if (!object) continue;
        geometryRoot.add(object);
        geometryPickTargets.push(object);
        vertexBatches.push({ instances: accepted, primitive });
        renderedPrimitives += objectCost;
        renderedInstances += accepted.length;
        remaining -= accepted.length;
      }
    }

    if (verticesVisible) materializeVertexPoints();

    currentBounds = new THREE.Box3().setFromObject(geometryRoot);
    if (!currentBounds.isEmpty()) {
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
    if (!contextLost) {
      setError("");
      props.onError?.("");
    }
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
      axesScene = new THREE.Scene();
      axesCamera = new THREE.OrthographicCamera(
        -1.35,
        1.35,
        1.35,
        -1.35,
        0.1,
        20,
      );
      axesRoot = createAxesGizmo(THREE);
      axesScene.add(axesRoot);
      activeProjection = normalizeProjection(props.projection);
      camera = createCamera(THREE, activeProjection, 1);
      raycaster = new THREE.Raycaster();
      pointerNdc = new THREE.Vector2();

      renderer = new THREE.WebGLRenderer({
        antialias: true,
        powerPreference: "high-performance",
      });
      renderer.autoClear = false;
      renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, 2));
      if (THREE.SRGBColorSpace) renderer.outputColorSpace = THREE.SRGBColorSpace;
      host.append(renderer.domElement);

      controls = new controlsModule.OrbitControls(camera, renderer.domElement);
      controls.enableDamping = false;
      controls.screenSpacePanning = true;
      controls.addEventListener("change", requestRender);
      handleControlsStart = () => {
        controlsInteracting = true;
        clearHoverTooltip();
      };
      handleControlsEnd = () => {
        controlsInteracting = false;
      };
      controls.addEventListener("start", handleControlsStart);
      controls.addEventListener("end", handleControlsEnd);

      handlePointerMove = queuePointerPick;
      handlePointerLeave = clearHoverTooltip;
      renderer.domElement.addEventListener("pointermove", handlePointerMove);
      renderer.domElement.addEventListener("pointerleave", handlePointerLeave);

      threeScene.add(new THREE.AmbientLight(0xffffff, 1.25));
      const light = new THREE.DirectionalLight(0xffffff, 0.55);
      light.position.set(1, -1, 2);
      threeScene.add(light);

      const handleContextLost = (event) => {
        event.preventDefault();
        contextLost = true;
        reportError("Контекст WebGL потерян");
      };
      const handleContextRestored = () => {
        contextLost = false;
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
    verticesVisible = props.showVertices === true;
    if (!ready()) return;
    if (verticesVisible && !vertexPoints) materializeVertexPoints();
    if (vertexPoints) vertexPoints.visible = verticesVisible;
    clearHoverTooltip();
    requestRender();
  });

  createEffect(() => {
    const sceneModel = props.scene;
    const filters = props.filters;
    const mode = props.mode ?? "solid";
    const showEdges = props.showEdges !== false;
    if (!ready()) return;

    try {
      replaceGeometry(sceneModel, filters, mode, showEdges);
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
    cancelPendingPick();
    controls?.removeEventListener("change", requestRender);
    controls?.removeEventListener("start", handleControlsStart);
    controls?.removeEventListener("end", handleControlsEnd);
    controls?.dispose();
    disposeObject(geometryRoot);
    disposeObject(helperRoot);
    disposeObject(axesRoot);
    if (renderer?.domElement) {
      renderer.domElement.removeEventListener("pointermove", handlePointerMove);
      renderer.domElement.removeEventListener("pointerleave", handlePointerLeave);
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
    axesScene = null;
    axesCamera = null;
    axesRoot = null;
    raycaster = null;
    pointerNdc = null;
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
          Нет геометрии для текущих настроек
        </div>
      </Show>
      <Show when={error()}>
        <div class="geometry-viewport-overlay geometry-viewport-error" role="alert">
          3D-представление недоступно: {error()}
        </div>
      </Show>
      <Show when={hoverTooltip()} keyed>
        {(tooltip) => (
          <div
            class="geometry-viewport-tooltip"
            role="tooltip"
            style={{
              left: `${tooltip.left}px`,
              top: `${tooltip.top}px`,
            }}
          >
            {tooltip.text}
          </div>
        )}
      </Show>
    </div>
  );
}
