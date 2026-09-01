import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";

const windowUrl = new URL(
  "../src/components/geometry/GeometryViewerWindow.jsx",
  import.meta.url,
);
const viewportUrl = new URL(
  "../src/components/geometry/ThreeGeometryViewport.jsx",
  import.meta.url,
);
const stylesUrl = new URL(
  "../src/components/geometry/GeometryViewerWindow.css",
  import.meta.url,
);

function assertAppearsAfter(source, later, earlier) {
  const laterIndex = source.indexOf(later);
  const earlierIndex = source.indexOf(earlier);
  assert.notEqual(earlierIndex, -1, `missing earlier marker: ${earlier}`);
  assert.notEqual(laterIndex, -1, `missing later marker: ${later}`);
  assert.ok(
    laterIndex > earlierIndex,
    `expected ${later} to appear after ${earlier}`,
  );
}

test("geometry viewer builds a reactive scene in a modeless floating window", async () => {
  const source = await readFile(windowUrl, "utf8");

  assert.match(source, /buildGeometryScene\(model\)/u);
  assert.match(source, /<FloatingWindow/u);
  assert.match(source, /open=\{props\.open\}/u);
  assert.match(source, /onClose=\{props\.onClose\}/u);
  assert.match(source, /scene=\{sceneModel\(\)\}/u);
  assert.match(source, /setSceneModel\(null\)/u);
  assert.match(source, /role="toolbar"/u);
  assert.match(source, /role="dialog"/u);
  assert.match(source, /aria-modal="false"/u);
});

test("toolbar uses the requested menus, dropdowns, and ordering", async () => {
  const source = await readFile(windowUrl, "utf8");

  assert.match(source, />\s*Элементы\s*<\/button>/u);
  assert.match(source, />\s*Области\s*<\/button>/u);
  assert.match(source, />\s*Симметрии\s*<\/button>/u);
  assert.match(source, /aria-expanded=\{openPanel\(\) === "elements"\}/u);
  assert.match(source, /aria-expanded=\{openPanel\(\) === "regions"\}/u);
  assert.match(source, /aria-expanded=\{openPanel\(\) === "symmetry"\}/u);

  assert.match(source, /createSignal\("geometry"\)/u);
  assert.match(source, /<option value="geometry">Только геометрия<\/option>/u);
  assert.match(source, /<option value="vertices">\+вершины<\/option>/u);
  assert.match(source, /createSignal\("solid"\)/u);
  assert.match(source, /<option value="solid">Сплошной<\/option>/u);
  assert.match(
    source,
    /<option value="translucent">Полупрозрачный<\/option>/u,
  );
  assert.match(source, /<option value="wireframe">Каркас<\/option>/u);
  assert.match(source, /createSignal\("orthographic"\)/u);
  assert.match(
    source,
    /<option value="orthographic">Ортогональная<\/option>/u,
  );
  assert.match(
    source,
    /<option value="perspective">Перспективная<\/option>/u,
  );
  assert.match(source, />\s*Вписать всё\s*<\/button>/u);

  assertAppearsAfter(
    source,
    "aria-label=\"Режим представления\"",
    "aria-label=\"Детализация геометрии\"",
  );
  assertAppearsAfter(
    source,
    "geometry-viewer-fit",
    "aria-label=\"Режим представления\"",
  );
  assertAppearsAfter(
    source,
    "geometry-viewer-projection-select",
    "geometry-viewer-fit",
  );

  assert.match(source, /mode=\{renderMode\(\)\}/u);
  assert.match(source, /showVertices=\{detailMode\(\) === "vertices"\}/u);
  assert.match(source, /projection=\{projection\(\)\}/u);
  assert.match(source, /filters=\{filters\(\)\}/u);
});

test("object modes are exclusive while symmetry filters are independent", async () => {
  const source = await readFile(windowUrl, "utf8");

  assert.match(source, /createSignal\("all"\)/u);
  assert.match(source, /objectModes:\s*\{\s*elements:/su);
  assert.match(source, /selections:\s*\{\s*elements:/su);
  assert.match(source, /symmetry:\s*\{\s*axial:/su);

  assert.equal(
    source.match(/type="radio"/gu)?.length,
    6,
    "elements and regions must each expose three exclusive modes",
  );
  assert.match(source, /name="geometry-elements-mode"/u);
  assert.match(source, /name="geometry-regions-mode"/u);
  assert.match(source, /Все элементы/u);
  assert.match(source, /Все области/u);
  assert.equal(source.match(/Выделенные в списке/gu)?.length, 2);
  assert.equal(source.match(/Не показывать/gu)?.length, 2);

  assert.equal(
    source.match(/type="checkbox"/gu)?.length,
    4,
    "each symmetry family must be independently switchable",
  );
  assert.match(source, /Локальная/u);
  assert.match(source, /Азимутальная/u);
  assert.match(source, /Периодическая/u);
  assert.match(source, /Зеркальная/u);
});

test("diagnostics retain record numbers and concise reasons", async () => {
  const source = await readFile(windowUrl, "utf8");

  assert.match(source, /Диагностика геометрии/u);
  assert.match(source, /recordIndex \+ 1/u);
  assert.match(source, /diagnostic\?\.schemaId === "elements"/u);
  assert.match(source, /diagnostic\?\.schemaId === "regions"/u);
  assert.match(source, /DIAGNOSTIC_REASONS/u);
  assert.match(source, /title=\{diagnosticDetail\(diagnostic\)\}/u);
});

test("Three viewport loads lazily and releases WebGL resources", async () => {
  const source = await readFile(viewportUrl, "utf8");

  assert.match(source, /import\("three"\)/u);
  assert.match(
    source,
    /import\("three\/addons\/controls\/OrbitControls\.js"\)/u,
  );
  assert.match(source, /new ResizeObserver\(resizeRenderer\)/u);
  assert.match(source, /requestAnimationFrame/u);
  assert.doesNotMatch(source, /setAnimationLoop/u);
  assert.doesNotMatch(source, /new THREE\.InstancedMesh/u);
  assert.match(source, /controls\?\.dispose\(\)/u);
  assert.match(source, /renderer\?\.dispose\?\.\(\)/u);
  assert.match(source, /renderer\?\.forceContextLoss\?\.\(\)/u);
  assert.match(source, /geometry\?\.dispose\?\.\(\)/u);
});

test("Three viewport switches orthographic and perspective cameras", async () => {
  const source = await readFile(viewportUrl, "utf8");

  assert.match(source, /DEFAULT_PROJECTION = "orthographic"/u);
  assert.match(source, /new THREE\.OrthographicCamera/u);
  assert.match(source, /new THREE\.PerspectiveCamera/u);
  assert.match(source, /camera\.isOrthographicCamera/u);
  assert.match(source, /controls\.object = camera/u);
  assert.match(source, /const preservedTarget = controls\.target\.clone\(\)/u);
  assert.match(source, /switchProjection\(projection\)/u);
  assert.match(source, /fitCameraToBounds\(THREE, camera, controls, currentBounds\)/u);
});

test("Three viewport applies object, selection, and symmetry filters", async () => {
  const source = await readFile(viewportUrl, "utf8");

  assert.match(source, /primitiveVisible\(/u);
  assert.match(source, /instanceVisible\(/u);
  assert.match(source, /filters\?\.objectModes/u);
  assert.match(source, /filters\?\.selections/u);
  assert.match(source, /filters\?\.symmetry/u);
});

test("Three viewport limits expansion and fixes reflected face winding", async () => {
  const source = await readFile(viewportUrl, "utf8");

  assert.match(source, /GEOMETRY_INSTANCE_BUDGET = 20_000/u);
  assert.match(source, /GEOMETRY_RENDER_OBJECT_BUDGET = 1_000/u);
  assert.match(source, /renderedPrimitives >= objectBudget/u);
  assert.match(source, /matrix\.fromArray\(instance\.matrix\)/u);
  assert.match(source, /matrix\.determinant\(\) < 0/u);
  assert.match(source, /sourceIndices\[index \+ 2\]/u);
  assert.match(source, /instanceCategory\(instance\) === category/u);
  assert.match(source, /selectedInstances/u);
  assert.match(source, /truncated/u);
  assert.match(source, /depthWrite:\s*mode !== "translucent"/u);
});

test("vertices and geometry expose hover picking metadata", async () => {
  const source = await readFile(viewportUrl, "utf8");

  assert.match(source, /appendVertexBatch\(/u);
  assert.match(source, /new THREE\.Points\(/u);
  assert.match(source, /size:\s*VERTEX_POINT_SIZE/u);
  assert.match(source, /sizeAttenuation:\s*false/u);
  assert.match(source, /new THREE\.Raycaster\(/u);
  assert.match(source, /findVertexMetadataRange\(/u);
  assert.match(source, /formatGeometryTooltip\(/u);
  assert.match(source, /formatVertexTooltip\(/u);
  assert.match(source, /geometryHitInstance\(/u);
  assert.match(source, /vertexHitMetadata\(/u);
  assert.match(source, /instances,\s*kind:\s*pickKind,\s*span:\s*pickSpan/su);
  assert.match(source, /mergedWireframeGeometry\(/u);
  assert.match(source, /pickSpan = wireframe\.vertexSpan/u);
  assert.match(source, /pickFrame = requestAnimationFrame/u);
  assert.match(source, /PICK_INTERVAL_MS = 80/u);
  assert.match(source, /controlsInteracting/u);
  assert.match(source, /materializeVertexPoints/u);
  assert.match(source, /vertexBatches/u);
  assert.match(source, /showVertices/u);
  assert.match(source, /class="geometry-viewport-tooltip"/u);
});

test("surface lighting preserves visibly flat faces", async () => {
  const source = await readFile(viewportUrl, "utf8");

  assert.match(source, /new THREE\.MeshLambertMaterial/u);
  assert.match(source, /flatShading:\s*true/u);
  assert.match(source, /new THREE\.AmbientLight\(0xffffff, 1\.25\)/u);
  assert.match(source, /new THREE\.DirectionalLight\(0xffffff, 0\.55\)/u);
  assert.doesNotMatch(source, /new THREE\.MeshStandardMaterial/u);
  assert.doesNotMatch(source, /geometry\.computeVertexNormals\(\)/u);
  assert.doesNotMatch(source, /new THREE\.HemisphereLight/u);
});

test("axes use a separate bottom-left screen-space scene", async () => {
  const source = await readFile(viewportUrl, "utf8");

  assert.match(source, /createAxesGizmo\(THREE\)/u);
  assert.match(source, /createAxisArrow/u);
  assert.match(source, /new THREE\.CylinderGeometry/u);
  assert.match(source, /new THREE\.ConeGeometry/u);
  assert.match(source, /createAxisLabel/u);
  assert.match(source, /AXES_GIZMO_MARGIN/u);
  assert.match(source, /renderer\.setScissor\(/u);
  assert.match(source, /renderer\.clearDepth\(\)/u);
  assert.match(source, /renderer\.render\(axesScene, axesCamera\)/u);
  assert.doesNotMatch(source, /new THREE\.AxesHelper/u);
});

test("geometry viewer canvas, menus, and tooltip fill the resizable window", async () => {
  const styles = await readFile(stylesUrl, "utf8");

  assert.match(
    styles,
    /\.geometry-viewer-window\s*\{[^}]*position:\s*relative;[^}]*height:\s*100%;[^}]*min-height:\s*0;/su,
  );
  assert.match(
    styles,
    /\.geometry-viewer-canvas-region\s*\{[^}]*flex:\s*1 1 0;[^}]*min-height:\s*0;/su,
  );
  assert.match(styles, /\.three-geometry-viewport\s*\{[^}]*inset:\s*0;/su);
  assert.match(
    styles,
    /\.three-geometry-viewport canvas\s*\{[^}]*width:\s*100%;[^}]*height:\s*100%;/su,
  );
  assert.match(
    styles,
    /\.geometry-viewer-menu-button,[\s\S]*?\.geometry-viewer-select,[\s\S]*?\.geometry-viewer-fit\s*\{[^}]*flex:\s*1 0 auto;/su,
  );
  assert.match(
    styles,
    /\.geometry-viewer-options-panel\s*\{[^}]*position:\s*absolute;[^}]*z-index:\s*6;/su,
  );
  assert.match(
    styles,
    /\.geometry-viewport-tooltip\s*\{[^}]*position:\s*absolute;[^}]*overflow-wrap:\s*anywhere;[^}]*pointer-events:\s*none;/su,
  );
});
