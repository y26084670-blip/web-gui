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

test("geometry viewer builds a reactive scene in a modeless floating window", async () => {
  const source = await readFile(windowUrl, "utf8");

  assert.match(source, /buildGeometryScene\(model\)/u);
  assert.match(source, /<FloatingWindow/u);
  assert.match(source, /open=\{props\.open\}/u);
  assert.match(source, /onClose=\{props\.onClose\}/u);
  assert.match(source, /scene=\{sceneModel\(\)\}/u);
  assert.match(source, /Элементы/u);
  assert.match(source, /Области/u);
  assert.match(source, /Исходные/u);
  assert.match(source, /Образы/u);
  assert.match(source, /Зеркала/u);
  assert.match(source, /Поверхности/u);
  assert.match(source, /Каркас/u);
  assert.match(source, /createSignal\("orthographic"\)/u);
  assert.match(source, /Ортогональная/u);
  assert.match(source, /Перспективная/u);
  assert.match(source, /projection=\{projection\(\)\}/u);
  assert.match(source, /Вписать всё/u);
  assert.match(source, /Диагностика геометрии/u);
  assert.match(source, /recordIndex \+ 1/u);
  assert.match(source, /diagnostic\?\.schemaId === "elements"/u);
  assert.match(source, /diagnostic\?\.schemaId === "regions"/u);
  assert.match(source, /DIAGNOSTIC_REASONS/u);
  assert.match(source, /title=\{diagnosticDetail\(diagnostic\)\}/u);
  assert.match(source, /setSceneModel\(null\)/u);
  assert.match(source, /role="toolbar"/u);
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
});

test("geometry viewer canvas fills the resizable window", async () => {
  const styles = await readFile(stylesUrl, "utf8");

  assert.match(
    styles,
    /\.geometry-viewer-window\s*\{[^}]*height:\s*100%;[^}]*min-height:\s*0;/su,
  );
  assert.match(
    styles,
    /\.geometry-viewer-canvas-region\s*\{[^}]*flex:\s*1 1 0;[^}]*min-height:\s*0;/su,
  );
  assert.match(styles, /\.three-geometry-viewport\s*\{[^}]*inset:\s*0;/su);
  assert.match(styles, /\.three-geometry-viewport canvas\s*\{[^}]*width:\s*100%;[^}]*height:\s*100%;/su);
  assert.match(
    styles,
    /\.geometry-viewer-filter-group\s*\{[^}]*flex:\s*1 0 auto;[^}]*justify-content:\s*center;/su,
  );
  assert.match(
    styles,
    /\.geometry-viewer-mode-group\s*\{[^}]*flex:\s*1 0 auto;/su,
  );
  assert.match(
    styles,
    /\.geometry-viewer-fit\s*\{[^}]*flex:\s*1 0 auto;/su,
  );
});
