import assert from 'node:assert/strict';
import { test } from 'node:test';

const printwork = await import('../rpg/engine/v47-printwork.mjs');

test('the MAIN01 printing task turns proof, material, and four bundle decisions into persistent outcomes', () => {
  assert.equal(typeof printwork.resolveMain01Printwork, 'function',
    'a real printwork resolver must replace the fixed-answer checklist');
  let state = printwork.createMain01PrintworkState();
  const titleError = printwork.resolveMain01Printwork(state, 'V47_PRINT_TITLE_WRONG_CASE');
  assert.equal(titleError.accepted, false);
  assert.equal(titleError.state.step, 0, 'an incorrect title requires the player to typeset again');
  assert.equal(titleError.state.spoiledSheets, 1, 'the wrong title costs an actual sheet');
  state = printwork.resolveMain01Printwork(state, 'V47_PRINT_TITLE_TALNIKOVY').state;
  const paperBeforeProof = state.inventory.dryPaper;
  const checked = printwork.resolveMain01Printwork(state, 'V47_PRINT_CHECK_PROOF');
  const rushed = printwork.resolveMain01Printwork(state, 'V47_PRINT_RUSH_PROOF');
  assert.equal(checked.state.proofChecked, true);
  assert.equal(rushed.state.proofChecked, false);
  assert.ok(rushed.state.spoiledSheets > checked.state.spoiledSheets,
    'rushing the press leaves a material cost');
  assert.ok(checked.state.inventory.dryPaper < paperBeforeProof && rushed.state.inventory.dryPaper < paperBeforeProof,
    'both proof decisions consume paper stock');
  state = checked.state;
  state = printwork.resolveMain01Printwork(state, 'V47_PRINT_USE_DRY_STOCK').state;
  const choices = [
    'V47_PRINT_SEND_SUBSCRIPTIONS', 'V47_PRINT_CONSIGN_BOOKSHOP',
    'V47_PRINT_SHARE_WORKER_COPY', 'V47_PRINT_RECYCLE_REMAINDER',
  ];
  for (const choice of choices) state = printwork.resolveMain01Printwork(state, choice).state;
  assert.equal(state.status, 'COMPLETE');
  assert.equal(state.allocations.length, 4);
  assert.ok(state.outgoingItems.some(item => item.toHostId === 'courier_pavel'));
  assert.ok(state.outgoingItems.some(item => item.toHostId === 'courier_pavel' && item.itemKo === '서점 위탁 연감 묶음'));
  assert.ok(state.outgoingItems.some(item => item.toHostId === 'print_apprentice_stepan'));
  assert.ok(state.outgoingItems.some(item => item.itemKo === '종이 조각'));
  let consignmentState = printwork.createMain01PrintworkState();
  for (const action of ['V47_PRINT_TITLE_TALNIKOVY', 'V47_PRINT_CHECK_PROOF', 'V47_PRINT_USE_DRY_STOCK', 'V47_PRINT_SEND_SUBSCRIPTIONS']) {
    consignmentState = printwork.resolveMain01Printwork(consignmentState, action).state;
  }
  const consignment = printwork.resolveMain01Printwork(consignmentState, 'V47_PRINT_CONSIGN_BOOKSHOP');
  assert.deepEqual(consignment.effects.money, [{ fromHostId: 'bookseller_lev', toHostId: 'editor_sofia', amount: 1 }],
    'sending a consignment produces a real, auditable payment');
  assert.deepEqual(consignment.effects.moves, [{ hostId: 'courier_pavel', mapId: 'bookshop-interior', x: 7, y: 9,
    activityKo: '서점 위탁 묶음을 구독자 주문과 함께 나른다' }],
  'the consignment joins the courier route to a named in-world destination');
  const invalid = printwork.resolveMain01Printwork(printwork.createMain01PrintworkState(), 'V47_PRINT_CHECK_PROOF');
  assert.equal(invalid.accepted, false, 'later press work cannot skip the title collation');
});

test('MAIN01 composition uses individual Russian type pieces and rejects a mis-set title on proof', () => {
  let state = printwork.createMain01PrintworkState();
  let stage = printwork.main01PrintworkStage(state);
  assert.equal(stage.typeSetter?.targetLength, 'Семейство Тальниковых'.length,
    'the press begins with a real letterpress board');
  const initialRack = stage.typeSetter.rack;
  const decoy = initialRack.find(tile => tile.glyph === 'я');
  assert.ok(decoy, 'the composing tray includes a plausible distractor sort');
  let result = printwork.resolveMain01Printwork(state, `V47_PRINT_TYPE_TILE:${decoy.id}`);
  assert.equal(result.accepted, true);
  state = result.state;
  const remainingTitle = [...'Семейство Тальниковых'].slice(1);
  for (const glyph of remainingTitle) {
    const tile = printwork.main01PrintworkStage(state).typeSetter.rack.find(row => row.glyph === glyph);
    result = printwork.resolveMain01Printwork(state, `V47_PRINT_TYPE_TILE:${tile.id}`);
    assert.equal(result.accepted, true);
    state = result.state;
  }
  result = printwork.resolveMain01Printwork(state, 'V47_PRINT_IMPRESS_TITLE');
  assert.equal(result.accepted, false, 'the press can be tested only after the full title is composed');
  assert.equal(result.reason, 'title_mismatch');
  assert.equal(result.state.spoiledSheets, 1, 'a wrong proof consumes a real sheet');
  assert.equal(result.state.step, 0, 'the player can reset and compose again');

  state = printwork.createMain01PrintworkState();
  const correctRack = printwork.main01PrintworkStage(state).typeSetter.rack;
  for (const glyph of 'Семейство Тальниковых') {
    const tile = printwork.main01PrintworkStage(state).typeSetter.rack.find(row => row.glyph === glyph);
    result = printwork.resolveMain01Printwork(state, `V47_PRINT_TYPE_TILE:${tile.id}`);
    assert.equal(result.accepted, true);
    state = result.state;
  }
  result = printwork.resolveMain01Printwork(state, 'V47_PRINT_IMPRESS_TITLE');
  assert.equal(result.accepted, true);
  assert.equal(result.state.titleSet, true);
  assert.equal(result.state.step, 1, 'a correctly composed and proofed title opens the next press stage');
});
