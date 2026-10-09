import { readFile } from 'node:fs/promises';

const source = await readFile(new URL('../three-desk.js', import.meta.url), 'utf8');
const styles = await readFile(new URL('../styles.css', import.meta.url), 'utf8');
const manifest = JSON.parse(await readFile(new URL('../data/desk-prop-manifest.json', import.meta.url)));
const failures = [];
const ids = manifest.props.map((prop) => prop.id);
if (new Set(ids).size < 15) failures.push(`desk prop count ${new Set(ids).size}, target 15`);
for (const prop of manifest.props) {
  if (!prop.rights || !prop.provenance || !prop.confidence || !prop.source_reference) failures.push(`${prop.id}: incomplete provenance`);
  if (!source.includes(`'${prop.id}'`)) failures.push(`${prop.id}: missing from three-desk.js`);
}
for (const token of ['pointerdown','dblclick','wheel','desk-prop']) if (!source.includes(token)) failures.push(`missing interaction ${token}`);
for (const token of ['petersburg-window','vista-x','window-snow','window-mist']) if (!source.includes(token) && !styles.includes(token)) failures.push(`missing Petersburg vista layer ${token}`);
console.log(`desk-scene-audit: ${manifest.props.length} props, pick/open/rotate/tray interactions — ${failures.length ? 'FAIL' : 'PASS'}`);
if (failures.length) { console.error(failures.join('\n')); process.exit(1); }
