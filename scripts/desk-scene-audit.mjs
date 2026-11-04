import { readFile } from 'node:fs/promises';

const source = await readFile(new URL('../three-desk.js', import.meta.url), 'utf8');
const walkSource = await readFile(new URL('../three-walk.js', import.meta.url), 'utf8');
const styles = await readFile(new URL('../styles.css', import.meta.url), 'utf8');
const manifest = JSON.parse(await readFile(new URL('../data/desk-prop-manifest.json', import.meta.url)));
const threeModule = await readFile(new URL('../vendor/three/three.module.min.js', import.meta.url), 'utf8');
const threeCore = await readFile(new URL('../vendor/three/three.core.min.js', import.meta.url), 'utf8');
const threeLicense = await readFile(new URL('../vendor/three/LICENSE', import.meta.url), 'utf8');
const failures = [];
const ids = manifest.props.map((prop) => prop.id);
if (new Set(ids).size < 15) failures.push(`desk prop count ${new Set(ids).size}, target 15`);
for (const prop of manifest.props) {
  if (!prop.rights || !prop.provenance || !prop.confidence || !prop.source_reference) failures.push(`${prop.id}: incomplete provenance`);
  if (!source.includes(`'${prop.id}'`)) failures.push(`${prop.id}: missing from three-desk.js`);
}
for (const token of ['pointerdown','dblclick','wheel','desk-prop']) if (!source.includes(token)) failures.push(`missing interaction ${token}`);
for (const token of ['petersburg-window','vista-x','window-snow','window-mist']) if (!source.includes(token) && !styles.includes(token)) failures.push(`missing Petersburg vista layer ${token}`);
for (const [name, condition] of [
  ['desk imports local Three.js module', source.includes("import('./vendor/three/three.module.min.js')")],
  ['courier imports local Three.js module', walkSource.includes("import('./vendor/three/three.module.min.js')")],
  ['vendored module has local core dependency', threeModule.includes('./three.core.min.js') && threeCore.length > 300000],
  ['vendored MIT license included', /MIT License/i.test(threeLicense)],
  ['no Three.js CDN dependency', !/cdn\.jsdelivr\.net/.test(source + walkSource)],
  ['unused shadow pass disabled', /renderer\.shadowMap\.enabled\s*=\s*false/.test(source)],
  ['dirty-frame rendering', /function requestSceneRender/.test(source) && /function renderScene/.test(source)],
  ['camera transition stays animated', /requestSceneRender\(true\)/.test(source) && /camera\.position\.lerp/.test(source)],
  ['render activity is observable', /renderedFrames\+\+/.test(source) && /renderedFrames,lastRenderDurationMs/.test(source)],
  ['no unconditional desk render loop', !/requestAnimationFrame\(frame\)/.test(source)],
]) if (!condition) failures.push(`performance: ${name}`);
console.log(`desk-scene-audit: ${manifest.props.length} props, pick/open/rotate/tray interactions — ${failures.length ? 'FAIL' : 'PASS'}`);
if (failures.length) { console.error(failures.join('\n')); process.exit(1); }
