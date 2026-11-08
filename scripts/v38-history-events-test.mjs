import assert from 'node:assert/strict';
import fs from 'node:fs/promises';

const { events } = JSON.parse(await fs.readFile(new URL('../rpg/data/v38-historical-events.json', import.meta.url), 'utf8'));
assert.equal(events.length, 3, 'exactly three newly authored historical events');
assert.equal(new Set(events.map(event => event.id)).size, events.length);
for (const event of events) {
  assert.equal(event.castPossessable, false, `${event.id} cast cannot be possessed`);
  assert.equal(new Set(event.cast).size, 4, `${event.id} has four distinct participants`);
  assert.equal(event.rounds.length, 2, `${event.id} has a joined second conversation round`);
  assert.ok(event.dateLabelKo && event.openingKo && event.historyKo);
  assert.match(event.sourceUrl, /^https:\/\//);
  assert.ok(event.sourceLabelKo && event.sourceRangeKo);
  for (const round of event.rounds) {
    assert.ok(round.beats.length >= 3 && round.beats.length <= 4, `${event.id} group conversation has three or four speaking turns`);
    for (const [speaker, line] of round.beats) {
      assert.ok(event.cast.includes(speaker), `${event.id}: ${speaker} is an event participant`);
      assert.ok(line.trim().length > 12);
    }
    assert.ok(round.choices.length >= 2);
    for (const choice of round.choices) assert.ok(choice.directionKo && choice.recordKo && choice.reactionKo);
  }
  assert.equal(event.rounds[0].beats.length, 3, `${event.id} begins with three people`);
  assert.equal(event.rounds[1].beats.length, 4, `${event.id} gains its fourth participant`);
  assert.ok(event.rounds[1].joinKo, `${event.id} explains who joins and why`);
  assert.ok(event.rounds[1].beats.some(([speaker]) => speaker === event.rounds[1].joiningSpeakerId));
  assert.ok(!event.rounds[0].beats.some(([speaker]) => speaker === event.rounds[1].joiningSpeakerId), `${event.id} joining speaker was not already in the conversation`);
}
assert.deepEqual(events.map(event => event.id).sort(), ['EMANCIPATION_1861', 'GOGOL_INSPECTOR_1836', 'SENATE_SQUARE_1825']);
console.log('V38 historical event catalog passed: 3 scenes, three initial speakers plus a joining fourth, sourced outcomes, and non-possessable casts.');
