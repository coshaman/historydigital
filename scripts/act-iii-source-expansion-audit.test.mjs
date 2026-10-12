import test from 'node:test';
import assert from 'node:assert/strict';
import { mkdtemp, mkdir, readFile, rm, writeFile } from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import { auditSourceExpansion, discoverBaselineFiles } from './act-iii-source-expansion-audit.mjs';

const good = (overrides = {}) => ({
  sourceId: 'NEW-01', sourceClass: 'PRIMARY_DOCUMENT', witnessKey: 'author|work|1848|edition-a',
  authorOrIssuer: 'A. Author', title: 'A verified letter', date: '1848-01-02', edition: 'Edition A',
  holdingInstitution: 'Archive A', locator: 'letter 4, paragraph 2',
  originalRussian: [{ segmentId: 'p1', order: 1, text: 'Russian paragraph one.' }, { segmentId: 'p2', order: 2, text: 'Russian paragraph two.' }],
  contextRange: { paragraphStart: 1, paragraphEnd: 2, speaker: 'A. Author', claim: 'A claim', immediateIssue: 'An immediate dispute' },
  koreanTranslation: [{ segmentId: 'p1', order: 1, text: '러시아어 문단 하나.' }, { segmentId: 'p2', order: 2, text: '러시아어 문단 둘.' }],
  translationStatus: 'project-translation', availabilityDate: '1848-01-02',
  url: 'https://example.org/archive/a', provenanceNote: 'Checked against scan.', sceneUsage: ['SCENE-1'],
  ...overrides
});

const route = { scenes: [{ id: 'SCENE-1', sourceIds: ['NEW-01'] }] };
const run = (additions, baselineFiles = [], routeData = route) => auditSourceExpansion({ baselineFiles, additions, route: routeData });

test('counts a verified new witness once', () => {
  const result = run([good()]);
  assert.equal(result.uniqueCount, 1);
  assert.deepEqual(result.errors, []);
});

test('rejects a source already represented by URL or witness identity', () => {
  const baseline = [{ id: 'OLD-1', stable_url: 'https://example.org/archive/a', witnessKey: 'old|key' }];
  assert.match(run([good()], baseline).errors.join('\n'), /duplicate.*URL/i);
  assert.match(run([good({ url: 'https://example.org/different' })], [{ id: 'OLD-2', stable_url: 'https://example.org/old', witnessKey: good().witnessKey }]).errors.join('\n'), /duplicate.*witness/i);
});

test('normalizes Wikisource revision URLs by page title without collapsing different pages', () => {
  const firstRevision = 'https://ru.wikisource.org/w/index.php?title=Poor_Folk&oldid=100';
  const laterRevision = 'https://ru.wikisource.org/w/index.php?title=Poor_Folk&oldid=200';
  const otherPage = 'https://ru.wikisource.org/w/index.php?title=Another_Work&oldid=200';
  assert.match(run([good({ url: laterRevision })], [{ id: 'OLD', stable_url: firstRevision, witnessKey: 'old|witness' }]).errors.join('\n'), /duplicate.*URL/i);
  const distinct = run([
    good({ url: firstRevision }),
    good({ sourceId: 'NEW-02', witnessKey: 'author|other-work|1848|edition-b', url: otherPage })
  ], [], { scenes: [{ id: 'SCENE-1', sourceIds: ['NEW-01', 'NEW-02'] }] });
  assert.equal(distinct.uniqueCount, 2);
  assert.deepEqual(distinct.errors, []);
});

test('requires a precise source locator', () => {
  assert.match(run([good({ locator: '' })]).errors.join('\n'), /locator/i);
});

test('rejects missing, unordered, or noncontiguous context paragraphs', () => {
  const broken = good({ originalRussian: [{ segmentId: 'p1', order: 1, text: 'One.' }, { segmentId: 'p3', order: 3, text: 'Three.' }] });
  assert.match(run([broken]).errors.join('\n'), /contiguous|sequence/i);
});

test('does not count secondary commentary as a primary witness', () => {
  assert.match(run([good({ sourceClass: 'SECONDARY_COMMENTARY' })]).errors.join('\n'), /source class/i);
});

test('requires paragraph-aligned Korean translation', () => {
  const broken = good({ koreanTranslation: [{ segmentId: 'p1', order: 1, text: '하나.' }] });
  assert.match(run([broken]).errors.join('\n'), /translation.*(segment|align)/i);
});

test('requires every added record to be used by an active route scene', () => {
  assert.match(run([good()], [], { scenes: [] }).errors.join('\n'), /unused|route usage/i);
  assert.match(run([good()], [], { scenes: [{ id: 'SCENE-1', sourceIds: ['SCENE-1'] }] }).errors.join('\n'), /unused|route usage/i);
});

test('does not include unverified or invalid records in the unique-source count', () => {
  const result = run([good({ locator: '' })]);
  assert.equal(result.uniqueCount, 0);
  assert.ok(result.errors.length > 0);
});

test('does not treat the dedicated Act III additions ledger as its own baseline', async () => {
  const root = await mkdtemp(path.join(os.tmpdir(), 'act3-source-baseline-'));
  try {
    await mkdir(path.join(root, 'data'));
    await mkdir(path.join(root, 'narrative'));
    await writeFile(path.join(root, 'data', 'content.json'), JSON.stringify({ sources: [{ id: 'BASE-1', url: 'https://example.org/base', title: 'Base source', authorOrIssuer: 'Issuer' }] }));
    await writeFile(path.join(root, 'narrative', 'ACT_III_BRANCHING_SOURCES.json'), JSON.stringify([good()]));
    await writeFile(path.join(root, 'narrative', 'E04_SCENE.json'), JSON.stringify({ id: 'E04', excerpts: [{ sourceId: 'NEW-01', sourceUrl: 'https://example.org/new', publication: 'New source', edition: 'New source edition' }] }));
    const baseline = await discoverBaselineFiles(root);
    assert.deepEqual(baseline.map(source => source.id), ['BASE-1']);
  } finally {
    await rm(root, { recursive: true, force: true });
  }
});
