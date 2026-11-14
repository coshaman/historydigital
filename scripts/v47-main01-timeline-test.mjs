import assert from 'node:assert/strict';
import { test } from 'node:test';
import { createMain01TimelineState, main01TimelineSources, main01TimelineStage, resolveMain01Timeline } from '../rpg/engine/v47-main01-timeline.mjs';
import { v47StoryBeats } from '../rpg/data/v47-story-beats.mjs';

test('MAIN01 chronology sorts only dated source-backed records across Julian and Gregorian calendars', () => {
  assert.deepEqual(main01TimelineSources.map(card => card.dateJulian), [
    '31 января 1848 · 허가', '20 августа 1848', '20 октября 1848', '17 ноября 1848',
  ]);
  assert.deepEqual(main01TimelineSources.map(card => card.dateGregorian), [
    '1848-02-12', '1848-09-01', '1848-11-01', '1848-11-29',
  ]);
  assert.equal(main01TimelineSources.find(card => card.id === 'announcement').titleKo, '2월호에 실린 연감 공고',
    'the timeline does not mislabel the magazine issue approval date as the almanac publication date');
  assert.equal(main01TimelineSources.find(card => card.id === 'ban').sourceKindKo, '1997년 편집 주기',
    'the ban date is identified as a later editorial chronology, not an 1848 document');
  assert.ok(main01TimelineSources.every(card => card.sourceId), 'each card has a checked-in provenance ID');

  let state = createMain01TimelineState();
  for (const id of ['subscriber', 'ban', 'request', 'announcement']) {
    const result = resolveMain01Timeline(state, `V47_TIMELINE_PLACE:${id}`);
    assert.equal(result.accepted, true);
    state = result.state;
  }
  let result = resolveMain01Timeline(state, 'V47_TIMELINE_CHECK');
  assert.equal(result.accepted, false, 'a shuffled chronology cannot be confirmed');
  assert.equal(result.reason, 'dates_out_of_order');
  assert.equal(result.state.attempts, 1);
  state = resolveMain01Timeline(result.state, 'V47_TIMELINE_RESET').state;
  for (const id of ['announcement', 'request', 'ban', 'subscriber']) {
    state = resolveMain01Timeline(state, `V47_TIMELINE_PLACE:${id}`).state;
  }
  result = resolveMain01Timeline(state, 'V47_TIMELINE_CHECK');
  assert.equal(result.accepted, true);
  assert.equal(result.state.status, 'COMPLETE');
  assert.deepEqual(result.effects.item, { hostId: 'editor_sofia', itemKo: '연감의 날짜를 정리한 대조표' });
  assert.equal(main01TimelineStage(result.state), null, 'the solved physical puzzle does not remain replayable');
});

test('MAIN01 places the subscriber letter after its arrival without claiming it is still in the future', () => {
  const a10 = v47StoryBeats.find(beat => beat.storyId === 'MAIN01' && beat.beatId === 'A10');
  const a11 = v47StoryBeats.find(beat => beat.storyId === 'MAIN01' && beat.beatId === 'A11');
  const letterId = 'V47-NEKRASOV-SUBSCRIBER-LETTER-1848';
  assert.equal(a10.date, '1848-12-06', '24 November Julian is December 6 on the game clock');
  assert.ok(!a10.sourceIds.includes(letterId), 'the bookshop scene does not open a letter kept for the later printshop scene');
  assert.ok(a11.date > a10.date && a11.sourceIds.includes(letterId), 'the letter is read in the later dated scene');
  assert.ok(!a10.sourceContextKo.includes('도착하는 구독자 편지'), 'the December 6 scene does not describe a November 29 arrival as future');
});
