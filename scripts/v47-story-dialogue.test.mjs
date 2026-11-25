import test from 'node:test';
import assert from 'node:assert/strict';
import {
  MAIN01_STORY_DIALOGUE_TRACKS,
  main01StoryDialogueStage,
  main01StoryDialogueTrack,
  advanceMain01StoryDialogue,
  main01StoryDialogueAllowsAi,
} from '../rpg/engine/v47-story-dialogue.mjs';

test('MAIN01 story conversations keep free text closed until three authored exchanges are complete', () => {
  const track = main01StoryDialogueTrack({ storyId: 'MAIN01', questId: 'V47_MAIN01_A01', hostId: 'reader_darya' });
  assert.ok(track);
  let progress = { step: 0 };
  assert.equal(main01StoryDialogueAllowsAi(progress), false);
  const first = main01StoryDialogueStage(track, progress);
  assert.equal(first.options.length, 3);
  progress = advanceMain01StoryDialogue(progress, first.options[1]);
  assert.equal(progress.step, 1);
  const branch = main01StoryDialogueStage(track, progress);
  assert.equal(branch.options.length, 3, 'each first choice opens a new three-choice branch');
  assert.notDeepEqual(branch.options.map(option => option.id), first.options.map(option => option.id));
  progress = advanceMain01StoryDialogue(progress, branch.options[0]);
  assert.equal(main01StoryDialogueStage(track, progress).options.length, 3);
  progress = advanceMain01StoryDialogue(progress, main01StoryDialogueStage(track, progress).options[2]);
  assert.equal(progress.completed, true);
  assert.equal(main01StoryDialogueAllowsAi(progress), true);
});

test('only a matching active MAIN01 quest and resident receive authored story dialogue', () => {
  assert.ok(main01StoryDialogueTrack({ storyId: 'MAIN01', questId: 'V47_MAIN01_A03', hostId: 'midwife_avdotya' }));
  assert.equal(main01StoryDialogueTrack({ storyId: 'MAIN01', questId: 'V47_MAIN01_A03', hostId: 'reader_darya' }), null);
  assert.equal(main01StoryDialogueTrack({ storyId: 'MAIN03', questId: 'V47_MAIN01_A03', hostId: 'midwife_avdotya' }), null);
  assert.ok(MAIN01_STORY_DIALOGUE_TRACKS.length >= 8);
});
