import { readdir, readFile, writeFile } from 'node:fs/promises';
import path from 'node:path';

const root = process.cwd();
const profiles = {
  apothecary_yakov: { stockRecords: 4, remedyPreparation: 3, trade: 2 },
  baker_fyodor: { breadMaking: 4, ovenManagement: 3, stockRecords: 2 },
  bookbinder_elizaveta: { bookbinding: 4, sewing: 3, reading: 3 },
  bookseller_lev: { trade: 4, reading: 3, accounts: 3 },
  carter_roman: { loadHandling: 4, routeFinding: 3, horseHandling: 3 },
  clerk_alexei: { copying: 4, documentSorting: 4, officeProcedure: 3 },
  coachman_timofey: { horseDriving: 4, routeFinding: 3, passengerCare: 2 },
  courier_pavel: { routeFinding: 4, parcelHandling: 4, deliveryTiming: 3 },
  editor_sofia: { proofreading: 4, editing: 4, publicationPlanning: 3 },
  fishseller_klavdiya: { fishHandling: 4, trade: 3, foodPreservation: 2 },
  housemaid_olga: { cleaning: 4, householdCare: 3, errands: 4 },
  innkeeper_irina: { lodgingManagement: 4, accounts: 3, cooking: 2 },
  junior_guard_sergey: { observation: 3, accessControl: 4, deescalation: 2 },
  landlady_polina: { rentAccounts: 4, roomMaintenance: 3, negotiation: 3 },
  laundress_mariya: { laundry: 4, garmentCare: 3, ironing: 4 },
  lodging_tatyana: { sewing: 3, reading: 1, garmentRepair: 3 },
  market_nadezhda: { trade: 4, stockManagement: 3, priceJudgment: 4 },
  midwife_avdotya: { birthCare: 4, householdCare: 3, attentiveListening: 3 },
  minor_noble_andrei: { reading: 4, accounts: 3, documentCopying: 2 },
  police_sergeant_ivan: { patrol: 3, inquiryTaking: 3, deescalation: 3 },
  porter_gavrila: { loadHandling: 4, routeFinding: 3, parcelCare: 2 },
  printer_ekaterina: { proofReading: 4, typesetting: 3, pressSafety: 2 },
  reader_darya: { teaching: 4, translation: 3, reading: 4 },
  scribal_yuri: { copying: 4, handwriting: 4, documentSorting: 3 },
  seamstress_anna: { sewing: 4, garmentRepair: 4, priceNegotiation: 2 },
  senior_clerk_konstantin: { documentReview: 4, officeProcedure: 4, committeeRecords: 3 },
  servant_varvara: { householdCare: 4, cleaning: 3, errands: 4 },
  street_musician_ivan: { performance: 4, audienceReading: 3, instrumentCare: 3 },
  street_vendor_matryona: { trade: 4, stockManagement: 3, weatherReading: 2 },
  student_vasily: { reading: 4, debate: 3, translation: 2 },
  print_apprentice_stepan: { basicReading: 1, typesetting: 2, pressSafety: 1 },
  teacher_lyubov: { basicReading: 4, lessonPlanning: 4, childInstruction: 4 },
  tenant_mikhail: { loadHandling: 3, routeFinding: 2, bargaining: 3 },
  typesetter_nikita: { typesetting: 4, letterSpacing: 3, pressSafety: 3 },
  warehouse_pyotr: { inventoryRecords: 4, cargoTally: 4, freightInspection: 3 },
  watercarrier_luka: { waterDelivery: 4, routeFinding: 3, loadHandling: 3 },
  yardkeeper_semyon: { buildingMaintenance: 4, tenancyRecords: 3, conflictMediation: 3 },
};
const workSkillAssignments = {
  apothecary_yakov: ['stockRecords', 'remedyPreparation'], baker_fyodor: ['breadMaking', 'ovenManagement'],
  bookbinder_elizaveta: ['bookbinding', 'reading'], bookseller_lev: ['trade', 'accounts'],
  carter_roman: ['loadHandling', 'routeFinding'], clerk_alexei: ['documentSorting', 'copying'],
  coachman_timofey: ['horseDriving', 'routeFinding'], courier_pavel: ['parcelHandling', 'deliveryTiming'],
  editor_sofia: ['proofreading', 'editing'], fishseller_klavdiya: ['fishHandling', 'foodPreservation'],
  housemaid_olga: ['householdCare', 'errands'], innkeeper_irina: ['lodgingManagement', 'cooking'],
  junior_guard_sergey: ['accessControl', 'observation'], landlady_polina: ['rentAccounts', 'negotiation'],
  laundress_mariya: ['laundry', 'ironing'], lodging_tatyana: ['sewing', 'garmentRepair'],
  market_nadezhda: ['stockManagement', 'trade'], midwife_avdotya: ['birthCare', 'attentiveListening'],
  minor_noble_andrei: ['documentCopying', 'accounts'], police_sergeant_ivan: ['inquiryTaking', 'patrol'],
  porter_gavrila: ['loadHandling', 'loadHandling', 'loadHandling'], printer_ekaterina: ['proofReading', 'typesetting'],
  print_apprentice_stepan: ['typesetting', 'basicReading'], reader_darya: ['reading', 'teaching'],
  scribal_yuri: ['handwriting', 'copying'], seamstress_anna: ['sewing', 'priceNegotiation'],
  senior_clerk_konstantin: ['documentReview', 'committeeRecords'], servant_varvara: ['cleaning', 'errands'],
  street_vendor_matryona: ['trade', 'stockManagement'], student_vasily: ['reading', 'translation'],
  teacher_lyubov: ['lessonPlanning', 'childInstruction', 'basicReading'], tenant_mikhail: ['routeFinding', 'loadHandling'],
  typesetter_nikita: ['typesetting', 'letterSpacing'], warehouse_pyotr: ['freightInspection', 'cargoTally'],
  watercarrier_luka: ['waterDelivery', 'routeFinding'], yardkeeper_semyon: ['buildingMaintenance', 'tenancyRecords'],
};
const files = (await readdir(path.join(root, 'rpg/characters'))).filter(file => file.endsWith('.json'));
const cards = await Promise.all(files.map(async file => {
  const filePath = path.join(root, 'rpg/characters', file);
  const card = JSON.parse(await readFile(filePath, 'utf8'));
  return { filePath, card };
}));
const fictionalIds = new Set(cards.filter(({ card }) => card.kind === 'FICTIONAL').map(({ card }) => card.id));
if (fictionalIds.size !== Object.keys(profiles).length) throw new Error(`Expected profile coverage for ${fictionalIds.size} fictional cards`);
if (Object.keys(profiles).some(id => !fictionalIds.has(id))) throw new Error('Skill profile references a missing resident');
for (const { filePath, card } of cards) {
  if (card.kind !== 'FICTIONAL') continue;
  const skills = { ...profiles[card.id], ...(card.skills ?? {}) };
  const status = 'FICTIONAL_CHARACTER_DESIGN';
  const workActions = (card.schedule ?? []).filter(slot => slot.workAction);
  const assignedSkills = workSkillAssignments[card.id] ?? [];
  if (assignedSkills.length !== workActions.length) throw new Error(`${card.id}: expected ${workActions.length} work skill assignments, received ${assignedSkills.length}`);
  const skillsAlreadyAuthored = JSON.stringify(card.skills) === JSON.stringify(skills)
    && card.skillsValueStatus === status;
  const workSkillsAlreadyAuthored = workActions.every((action, index) => action.workAction.skillId === assignedSkills[index]);
  for (const [index, skillId] of assignedSkills.entries()) {
    if (!Number.isInteger(skills[skillId])) throw new Error(`${card.id}: unknown work skill ${skillId}`);
    workActions[index].workAction.skillId = skillId;
  }
  if (skillsAlreadyAuthored && workSkillsAlreadyAuthored) continue;
  card.skills = skills;
  card.skillsValueStatus = status;
  await writeFile(filePath, `${JSON.stringify(card, null, 2)}\n`, 'utf8');
}
