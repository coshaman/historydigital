import test from 'node:test';
import assert from 'node:assert/strict';
import { ownsKeyboardInput, observationText } from '../rpg/engine/player-presentation.mjs';

test('native editing, composition, modified keys and focused controls retain keyboard input', () => {
  for (const property of ['defaultPrevented', 'isComposing', 'ctrlKey', 'metaKey', 'altKey']) {
    assert.equal(ownsKeyboardInput({ [property]: true }), true);
  }
  for (const tag of ['input', 'textarea', 'select', 'button', 'a', 'summary']) {
    assert.equal(ownsKeyboardInput({ target: { closest: selector => selector.split(', ').includes(tag) ? {} : null } }), true);
  }
  assert.equal(ownsKeyboardInput({ target: { closest: () => null } }), false);
  assert.equal(ownsKeyboardInput({}), false);
});

test('observations show the object once and add only the current host thought', () => {
  const clue = { textKo: '접힌 종이에 두 줄이 적혀 있다.', hostLines: { pavel: '주소가 없네.' } };
  assert.equal(observationText(clue, null), clue.textKo);
  assert.equal(observationText(clue, 'unknown'), clue.textKo);
  assert.equal(observationText(clue, 'pavel'), `${clue.textKo}\n\n“주소가 없네.”`);
});
