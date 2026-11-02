import fs from 'node:fs/promises';
import path from 'node:path';

const root = process.cwd();
const chains = [
  {
    host:'clerk_alexei', chain:'ALEXEI_ENVELOPE_REGISTER_1847', title:'접수 순서가 어긋난 봉투', other:'printer_ekaterina', metricsKo:{verifiedSequence:'확인한 순서',publicExposure:'공식 기록에 드러난 범위'},
    stages:[
      { file:'chancery', object:1021, tile:[9,6], name:'도착 시각과 접수 번호 메모', premise:'봉투는 도착했는데 접수표의 번호가 앞뒤 기록과 맞지 않는다. 알렉세이는 문서를 넘기기 전에 확인 범위를 정해야 한다.',
        actions:[
          ['도착 시각과 봉인 상태만 적는다','접수 담당자와 배달원이 압니다 · 확인 메모에 시각만 남습니다 · 처리 순서가 늦어질 수 있습니다','봉투의 도착 시각과 봉인 상태를 따로 적었다. 번호가 맞는지는 아직 단정하지 않았다.','arrivalTime',{verifiedSequence:1,publicExposure:0}],
          ['번호를 고쳐 공식 접수부에 먼저 올린다','관청 접수실이 봅니다 · 공식 접수부에 수정 번호가 남습니다 · 잘못 고치면 결재 책임을 질 수 있습니다','번호를 고쳐 접수부에 올렸다. 서류는 움직이지만 수정 이유를 설명해야 한다.','numberCorrected',{verifiedSequence:0,publicExposure:2}],
          ['배달원에게 전달 경로를 다시 묻는다','알렉세이와 배달원이 압니다 · 비공식 확인 쪽지에 남습니다 · 배달이 더 지연될 수 있습니다','접수 번호는 그대로 두고 배달 경로부터 확인하기로 했다.','routeChecked',{verifiedSequence:2,publicExposure:0}],
        ]},
      { file:'chancery', object:1022, tile:[16,7], name:'서명과 사본 대조표', premise:'접수 순서는 확인했지만 봉투 안의 사본에는 서명 한 곳이 빠져 있다. 원본을 보지 못한 채 다음 단계로 넘길 수는 없다.',
        actions:[
          ['원본과 사본의 서명 위치를 나란히 적는다','검토 담당자와 작성자가 봅니다 · 대조표에 차이가 남습니다 · 결재가 하루 늦어질 수 있습니다','두 문서의 서명 위치를 대조표에 나눠 적었다. 차이와 책임자를 한 줄로 뭉개지 않았다.','copiesCompared',{verifiedSequence:2,publicExposure:0}],
          ['누락된 서명을 보충해 달라고 돌려보낸다','문서 작성자와 배달원이 압니다 · 반송 기록에 사유가 남습니다 · 기한을 놓칠 위험이 있습니다','서명 보충을 요청하며 봉투를 돌려보냈다. 기한이 지켜질지는 아직 알 수 없다.','signatureReturned',{verifiedSequence:1,publicExposure:1}],
          ['상급자에게 현재 자료만으로 판단해 달라고 한다','상급 검토자가 봅니다 · 상신 메모와 결재 기록에 남습니다 · 판단 책임이 위로 넘어갈 수 있습니다','확인한 사실과 모르는 부분을 나눠 상급자에게 올렸다. 서기의 검토 범위는 기록으로 남는다.','reviewEscalated',{verifiedSequence:1,publicExposure:2}],
        ]},
      { file:'chancery', object:1023, tile:[18,10], name:'봉투 처리 결과 기록', premise:'접수표와 두 사본을 확인했다. 이제 이 봉투를 어떤 기록으로 마무리할지 정해야 한다.',
        actions:[
          ['확인된 부분만 적고 결재를 기다린다','검토자와 접수실이 봅니다 · 보류 사유가 공식 기록에 남습니다 · 오늘 처리가 끝나지 않을 수 있습니다','확인된 시각과 서명 차이만 적고 결재를 기다리기로 했다. 빠르진 않지만 추측은 사실처럼 쓰지 않았다.','heldForReview',{verifiedSequence:2,publicExposure:1}],
          ['수정 경위까지 접수부에 공개한다','관청의 다음 담당자들이 봅니다 · 공식 접수부에 수정 경위가 남습니다 · 본인과 배달원의 책임이 함께 검토될 수 있습니다','번호와 전달 경위를 공식 접수부에 적었다. 누가 고쳤는지도 함께 확인할 수 있게 했다.','fullRecord',{verifiedSequence:2,publicExposure:2}],
          ['배달 경로를 확인한 뒤 사본을 다시 보낸다','작성자와 인쇄소가 봅니다 · 재발송 메모에 경로가 남습니다 · 도착이 다시 늦어질 수 있습니다','봉투를 다시 보냈고, 접수 번호는 확인 전 상태로 남겼다.','resentAfterCheck',{verifiedSequence:2,publicExposure:0}],
        ]},
    ]
  },
  {
    host:'courier_pavel', chain:'PAVEL_PROOF_DELIVERY_1847', title:'늦은 교정쇄의 전달', other:'printer_ekaterina', metricsKo:{safeDelivery:'안전한 전달',delay:'지연'},
    stages:[
      {file:'courtyard',object:1021,tile:[11,9],name:'배달 순서 메모',premise:'인쇄소 교정쇄를 오늘 안에 전해야 하지만 평소 길에 공사 자재가 쌓였다. 파벨은 서두를지 우회할지 먼저 정해야 한다.',actions:[
        ['우회 시간을 계산해 수취인에게 알린다','수취인과 인쇄소가 압니다 · 배달 메모에 우회 시각이 남습니다 · 다른 심부름이 늦어질 수 있습니다','우회 시간을 적고 수취인에게 늦어질 수 있다고 알렸다. 약속은 바뀌지만 문서는 분실 위험을 덜었다.','routeNotice',{safeDelivery:2,delay:1}],
        ['봉투를 옷 안에 넣고 가장 짧은 길로 간다','파벨만 압니다 · 공식 배달 기록에는 남지 않습니다 · 봉투가 젖거나 훼손될 위험이 있습니다','짧은 길로 가기로 했다. 기록은 남지 않았고 봉투는 직접 지켜야 한다.','shortRoute',{safeDelivery:0,delay:0}],
        ['막힌 구간과 운반물을 장부에 적고 출발을 미룬다','안뜰 관리인과 인쇄소가 압니다 · 지연 장부에 사유가 남습니다 · 수취인이 기한을 넘길 수 있습니다','막힌 길과 봉투 상태를 적고 길이 비기를 기다렸다. 늦어지는 이유는 분명해졌다.','waitForClearance',{safeDelivery:2,delay:2}],
      ]},
      {file:'nevsky',object:1021,tile:[14,12],name:'거리의 수취 확인',premise:'네프스키 거리에 나왔지만 인쇄소에는 전달 시각이 바뀌었다는 소식이 닿지 않았다. 누구에게 먼저 알릴지 고른다.',actions:[
        ['인쇄소 문 앞에서 직접 수취인을 확인한다','파벨과 인쇄소 직원이 압니다 · 전달 확인표에 이름과 시각이 남습니다 · 다른 배달을 놓칠 수 있습니다','봉투를 손에서 손으로 건네고 받은 시각을 확인했다. 다른 일은 늦어졌지만 전달 여부는 분명해졌다.','recipientConfirmed',{safeDelivery:2,delay:1}],
        ['가게 앞 사람에게 봉투를 맡긴다','그 사람과 주변 행인이 볼 수 있습니다 · 공식 수취 기록은 남지 않습니다 · 잘못된 사람에게 갈 위험이 있습니다','가게 앞에 봉투를 맡겼다. 수취 확인은 없고 전달 책임이 흐려졌다.','leftWithBystander',{safeDelivery:-2,delay:0}],
        ['인쇄소에 지연 쪽지를 먼저 보내고 봉투를 보관한다','인쇄소 직원이 압니다 · 임시 보관표와 쪽지에 남습니다 · 인쇄 일정이 밀릴 수 있습니다','봉투는 가지고 있고 지연 쪽지만 보냈다. 인쇄는 늦어져도 내용은 확인된 사람에게 건넬 수 있다.','heldForRecipient',{safeDelivery:2,delay:2}],
      ]},
      {file:'printshop',object:1021,tile:[12,10],name:'수취 서명과 전달 대장',premise:'수취인이 봉투를 받았다. 전달이 끝났다고 적기 전에 봉인이 온전했는지와 수령 시각을 함께 남겨야 한다.',actions:[
        ['봉인 상태와 수령 시각을 함께 서명받는다','파벨과 수취인이 압니다 · 전달 대장에 두 항목이 남습니다 · 서명을 거부하면 마무리가 늦습니다','봉인 상태와 시각을 함께 적고 수취 서명을 받았다. 무엇을 확인했는지 서로 같은 기록을 갖는다.','signedReceipt',{safeDelivery:2,delay:0}],
        ['수령인 이름만 적고 바로 다음 배달로 간다','인쇄소 접수 담당이 봅니다 · 이름만 배달부에 남습니다 · 봉투 상태를 두고 다툴 수 있습니다','이름만 적고 출발했다. 빠르게 움직였지만 봉투가 온전했는지는 기록되지 않았다.','nameOnlyReceipt',{safeDelivery:0,delay:0}],
        ['봉인에 흠이 있어 수취를 보류하고 함께 확인한다','수취인과 인쇄소 책임자가 봅니다 · 보류 사유가 전달 기록에 남습니다 · 작업 일정이 멈출 수 있습니다','봉투를 열기 전에 흠집을 같이 확인하기로 했다. 늦어지더라도 전달 전 상태를 숨기지 않았다.','sealHeld',{safeDelivery:2,delay:2}],
      ]},
    ]
  },
  {
    host:'seamstress_anna', chain:'ANNA_COAT_REPAIR_1847', title:'기한이 다른 두 벌의 옷', other:'tenant_mikhail', metricsKo:{workQuality:'수선 품질',neighborTrust:'이웃 신뢰'},
    stages:[
      {file:'courtyard',object:1022,tile:[18,13],name:'수선 주문과 치수 메모',premise:'두 이웃이 외투 수선을 부탁했지만 한 벌은 내일 필요하고 다른 한 벌은 품삯을 미룬다. 안나는 먼저 할 일을 고른다.',actions:[
        ['급한 외투의 찢어진 곳과 치수를 먼저 잰다','손님과 안나가 압니다 · 수선 주문 메모에 치수가 남습니다 · 다른 주문이 늦어질 수 있습니다','급한 외투의 찢어진 곳부터 재고 치수를 적었다. 새 천을 사기 전 필요한 양을 알 수 있다.','urgentMeasured',{workQuality:2,neighborTrust:1}],
        ['두 손님에게 가능한 완성 시각을 각각 알린다','두 손님과 안나가 압니다 · 주문 쪽지에 기한이 남습니다 · 둘 다 기다리게 될 수 있습니다','두 손님에게 가능한 시각을 따로 말했다. 약속을 낮춰 잡았지만 작업 순서는 분명해졌다.','bothNotified',{workQuality:1,neighborTrust:2}],
        ['품삯을 먼저 받은 주문부터 시작한다','먼저 낸 손님이 압니다 · 선금과 순서가 주문 장부에 남습니다 · 급한 손님이 옷을 못 받을 수 있습니다','선금을 받은 주문부터 시작했다. 일한 값은 보장되지만 급한 사정은 뒤로 밀렸다.','depositFirst',{workQuality:1,neighborTrust:-1}],
      ]},
      {file:'nevsky',object:1022,tile:[22,14],name:'천과 실의 구입 쪽지',premise:'수선에 필요한 천과 실을 사러 나왔다. 돈은 한 벌 몫뿐이라 재료를 어떻게 고를지 정해야 한다.',actions:[
        ['튼튼한 천을 조금만 사서 급한 부분을 덧댄다','안나와 천 파는 사람이 압니다 · 구입 쪽지에 천의 양이 남습니다 · 다른 주문의 재료가 부족할 수 있습니다','튼튼한 천을 필요한 만큼만 샀다. 외투는 오래 버티겠지만 다른 주문에는 남는 재료가 적다.','durablePatch',{workQuality:2,neighborTrust:0}],
        ['싼 조각천을 사서 두 벌에 나눠 쓴다','두 손님과 재료상이 압니다 · 재료 장부에 나눠 쓴 양이 남습니다 · 옷감 색이 맞지 않을 수 있습니다','조각천을 사 두 벌에 나눴다. 비용은 줄었지만 색과 결이 같지는 않다.','sharedCloth',{workQuality:0,neighborTrust:1}],
        ['손님에게 재료값 일부를 먼저 부탁한다','손님과 안나가 압니다 · 선금 메모에 금액이 남습니다 · 손님이 주문을 거둘 수 있습니다','재료값 일부를 먼저 부탁했다. 빚은 피했지만 주문을 기다릴지 손님이 정해야 한다.','askedForAdvance',{workQuality:1,neighborTrust:1}],
      ]},
      {file:'courtyard',object:1023,tile:[19,13],name:'수선 완료와 품삯 기록',premise:'바늘질은 끝났다. 두 손님에게 옷을 건네며 품삯과 다음 주문의 순서를 정리한다.',actions:[
        ['완성한 부분과 받은 품삯을 따로 적는다','안나와 손님이 압니다 · 개인 수첩에 작업과 돈이 남습니다 · 남은 품삯을 다시 받아야 합니다','어디를 고쳤고 얼마를 받았는지 나눠 적었다. 일이 끝난 범위와 아직 받을 돈이 구분된다.','workAndPaySeparate',{workQuality:2,neighborTrust:1}],
        ['두 벌을 함께 건네고 다음 일감을 약속한다','두 손님과 안뜰 이웃이 압니다 · 구두 약속만 남습니다 · 다음 품삯과 기한을 다툴 수 있습니다','두 벌을 함께 건네고 다음 주문도 맡기로 했다. 장부는 가벼워졌지만 약속을 기억해야 한다.','nextOrderPromise',{workQuality:1,neighborTrust:2}],
        ['미납 품삯이 정리될 때까지 한 벌을 보관한다','해당 손님과 안나가 압니다 · 보관 메모에 남습니다 · 이웃 사이가 불편해질 수 있습니다','한 벌은 품삯이 정리될 때까지 보관했다. 일한 값을 지키지만 손님은 당장 옷을 입을 수 없다.','heldUntilPaid',{workQuality:1,neighborTrust:-1}],
      ]},
    ]
  },
  {
    host:'bookseller_lev', chain:'LEV_BOOK_RESERVATION_1847', title:'돌아오지 않은 책 한 권', other:'reader_darya', metricsKo:{bookAccess:'책을 빌릴 수 있는 정도',creditRisk:'외상 위험'},
    stages:[
      {file:'nevsky',object:1023,tile:[20,14],name:'책 대여와 선금 장부',premise:'단골이 빌려 간 책을 돌려주지 못하고 있다. 레프는 다음 독자에게 약속한 책을 어떻게 마련할지 정해야 한다.',actions:[
        ['반납 날짜와 현재 사정을 먼저 묻는다','레프와 책을 빌린 사람이 압니다 · 개인 대여 장부에 날짜가 남습니다 · 다른 독자가 더 기다릴 수 있습니다','반납 날짜와 사정을 먼저 물었다. 책이 어디 있는지 확인할 시간을 주되 다음 독자에게는 기다려 달라 해야 한다.','askedReturnDate',{bookAccess:2,creditRisk:1}],
        ['새 책을 구할 때까지 다음 손님에게 예약을 받지 않는다','레프와 다음 손님이 압니다 · 예약 장부에 보류가 남습니다 · 오늘 매상을 놓칠 수 있습니다','새 책을 구하기 전까지 예약을 멈췄다. 약속은 줄었고 오늘의 수입도 줄 수 있다.','pausedReservation',{bookAccess:1,creditRisk:0}],
        ['선금을 받고 다른 손님의 책을 빌려 준다','레프와 두 손님이 압니다 · 선금과 대여자가 장부에 남습니다 · 책이 제때 돌아오지 않을 위험이 있습니다','선금을 받고 다른 손님에게 책을 빌렸다. 한 사람의 기다림은 줄었지만 책을 돌려받을 책임이 늘었다.','borrowedReplacement',{bookAccess:2,creditRisk:2}],
      ]},
      {file:'printshop',object:1022,tile:[17,10],name:'책의 다음 인쇄와 종이 값',premise:'책을 다시 구하려면 인쇄소에 남은 종이와 활자 작업 시간을 확인해야 한다. 수량이 모자랄 수 있다.',actions:[
        ['인쇄소에 남은 종이 수량부터 확인한다','레프와 인쇄소 작업자가 압니다 · 재고 쪽지에 수량이 남습니다 · 오늘 인쇄가 시작되지 않을 수 있습니다','남은 종이 수량부터 확인했다. 재인쇄는 미뤄질 수 있어도 없는 재고를 약속하지 않는다.','checkedPaper',{bookAccess:2,creditRisk:0}],
        ['작은 분량만 먼저 찍어 달라고 부탁한다','레프와 인쇄소 책임자가 압니다 · 소량 주문 메모에 남습니다 · 권당 값이 더 비쌀 수 있습니다','소량 인쇄를 부탁했다. 독자는 빨리 책을 보지만 한 권마다 드는 비용은 커진다.','smallRun',{bookAccess:2,creditRisk:1}],
        ['외상으로 종이를 받아 큰 분량을 약속한다','레프와 인쇄소 책임자가 압니다 · 외상 장부와 주문표에 남습니다 · 팔리지 않으면 빚을 질 수 있습니다','종이를 외상으로 받아 인쇄를 약속했다. 책은 더 많이 나오지만 팔리지 않은 몫은 빚으로 남는다.','creditPrint',{bookAccess:2,creditRisk:2}],
      ]},
      {file:'nevsky',object:1024,tile:[23,14],name:'예약자와 반납 기한 정리',premise:'새 책을 받을 방법을 확인했다. 레프는 기다린 손님과 빌린 사람에게 반납 조건을 어떻게 전할지 결정한다.',actions:[
        ['예약 순서와 반납 날짜를 함께 공개한다','가게 손님이 읽을 수 있습니다 · 예약 장부에 순서와 날짜가 남습니다 · 늦은 사람의 사정도 드러날 수 있습니다','예약 순서와 날짜를 장부에 적었다. 누구 차례인지 분명하지만 개인 사정은 덜 가려진다.','publicQueue',{bookAccess:2,creditRisk:1}],
        ['각 손님에게 따로 날짜를 알린다','레프와 당사자만 압니다 · 개인 쪽지에 날짜가 남습니다 · 순서를 서로 모를 수 있습니다','각 손님에게 따로 날짜를 전했다. 사정은 보호되지만 차례를 다시 설명해야 할 수 있다.','privateNotice',{bookAccess:1,creditRisk:0}],
        ['반납 보증금을 받고 대여 기간을 짧게 정한다','레프와 빌리는 사람이 압니다 · 대여 장부에 기한과 보증금이 남습니다 · 돈이 없는 독자는 책을 빌리기 어렵습니다','기한과 보증금을 정했다. 책이 돌아올 가능성은 커지지만 형편이 어려운 독자는 빌리기 힘들다.','depositRule',{bookAccess:0,creditRisk:2}],
      ]},
    ]
  },
];

const property = (name, value) => ({ name, type: 'string', value });
const filesByMap = new Map();
let created = 0;
for (const chain of chains) for (const [index, stage] of chain.stages.entries()) {
  const questId = `${chain.chain}_STAGE_${index + 1}`;
  const previousQuestId = index ? `${chain.chain}_STAGE_${index}` : null;
  const fileName = `${chain.host.replaceAll('_','-')}-life-${index + 1}-1847.json`;
  const quest = {
    id: questId, titleKo: chain.title, chapterId: 'V33_1847_PRINT', date: '1847-06-01', premiseKo: stage.premise,
    historicalOutcome: { id: `${questId}_FICTIONAL_OUTCOME`, value: 'fictional resident daily life choice only; no historical public record is altered', sourceIds: [] },
    entry: { mapId: stage.file, objectId: stage.object, requiredHostId: chain.host },
    actions: stage.actions.map(([labelKo, subcopyKo, resultKo, resultFlag, metrics], choiceIndex) => ({
      id: `${questId}_CHOICE_${choiceIndex + 1}`, hostIds: [chain.host], labelKo, subcopyKo, resultKo, resultFlag,
      followupTitleKo: stage.name, followupKo: '이 선택은 허구 주민의 일과와 이웃 관계에만 남는다.',
      effects: { situationKo: resultKo, relations: { [chain.other]: `오늘 함께 확인한 일: ${stage.name}` }, lifeChainDelta: metrics },
    })),
    completion: 'one authorized choice at the named physical work object',
    lifeChain: { id: chain.chain, titleKo: chain.title, stage: index + 1, stageCount: 3, ...(previousQuestId ? { previousQuestId } : {}), metricsKo: chain.metricsKo },
    ...(previousQuestId ? { prerequisiteQuestIds: [previousQuestId] } : {}),
  };
  await fs.writeFile(path.join(root, `rpg/quests/${fileName}`), `${JSON.stringify(quest, null, 2)}\n`);
  const mapPath = path.join(root, `rpg/maps/${stage.file}.json`);
  const map = filesByMap.get(stage.file) ?? JSON.parse(await fs.readFile(mapPath, 'utf8'));
  const objectLayer = map.layers.find(layer => layer.name === 'Interactions');
  const newObject = {
    id: stage.object, name: stage.name, type: 'quest-object', x: stage.tile[0] * 16, y: stage.tile[1] * 16, width: 16, height: 16, visible: true,
    properties: [property('questId', questId)],
  };
  const objectIndex = objectLayer.objects.findIndex(object => object.id === stage.object);
  if (objectIndex >= 0) {
    if (!objectLayer.objects[objectIndex].properties?.some(item => item.name === 'questId' && item.value === questId)) throw new Error(`Interaction object ID ${stage.object} is already owned by another map feature in ${stage.file}`);
    objectLayer.objects[objectIndex] = newObject;
  } else objectLayer.objects.push(newObject);
  filesByMap.set(stage.file, map);
  created += 1;
}
for (const [mapId, map] of filesByMap) await fs.writeFile(path.join(root, `rpg/maps/${mapId}.json`), `${JSON.stringify(map, null, 2)}\n`);
console.log(JSON.stringify({ status: 'PASS', fictionalResidents: chains.map(chain => chain.host), threeStageChains: chains.length, questsCreated: created, mapsUpdated: [...filesByMap.keys()] }, null, 2));
