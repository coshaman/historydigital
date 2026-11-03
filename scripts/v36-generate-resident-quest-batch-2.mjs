import { readFile, writeFile } from 'node:fs/promises';
import path from 'node:path';

const root = process.cwd();
const chains = [
  { host:'market_nadezhda', other:'baker_fyodor', id:'NADEZHDA_STALL_WEATHER_1847', title:'비 맞은 좌판의 하루', metric:'상한 물건 손실과 손님 신뢰', stages:[
    { map:'market-quay', tile:[7,8], object:1151, name:'젖은 채소와 오늘의 값', premise:'밤비 뒤 채소 바구니가 축축해졌다. 오늘 안에 팔지 못하면 손해가 커지지만, 값부터 낮추면 다른 좌판의 시세도 흔들릴 수 있다.', actions:[
      ['상한 곳을 골라내고 남은 양을 잰다','나데즈다와 도우미가 압니다 · 재고 메모에 양이 남습니다 · 손님을 받는 시간이 늦어집니다','상한 부분을 먼저 골라냈다. 얼마를 팔 수 있는지 확인한 뒤 값을 정하기로 했다.',{stockLoss:1,trust:1}],
      ['오늘 안에 팔 수 있게 값을 낮춘다','좌판 손님들이 봅니다 · 가격표와 남은 수량이 보입니다 · 이웃 상인이 값을 따라 낮출 수 있습니다','값을 낮춰 바구니를 비웠다. 물건은 덜 남았지만 평소 값을 믿고 온 손님에게 설명해야 한다.',{stockLoss:2,trust:0}],
      ['가까운 좌판에 덮개를 빌릴 수 있는지 묻는다','나데즈다와 이웃 상인이 압니다 · 빌린 물건 쪽지에 남습니다 · 상대 좌판의 준비가 늦을 수 있습니다','덮개를 나눠 쓰기로 했다. 판매는 늦어져도 물건을 급히 헐값에 내놓지는 않았다.',{stockLoss:0,trust:2}],
    ]},
    { map:'nevsky', tile:[8,8], object:1152, name:'값을 기억하는 단골 메모', premise:'단골이 어제 값과 오늘 값이 다르다고 따진다. 비를 맞은 물건의 상태와 바뀐 값을 어떻게 설명할지 정해야 한다.', actions:[
      ['어제와 오늘의 물건 상태를 나눠 설명한다','단골과 나데즈다가 압니다 · 개인 메모에 상태와 값이 남습니다 · 설명이 길어져 다른 손님이 기다립니다','어제와 오늘 바구니가 다르다는 점부터 설명했다. 같은 값으로 보이는 이유를 숨기지 않았다.',{stockLoss:0,trust:2}],
      ['오늘 새로 받은 물건의 값을 표에 적는다','좌판 손님들이 봅니다 · 공개 가격표에 새 값이 남습니다 · 어제 값과 차이가 더 눈에 띕니다','오늘 값을 표에 적었다. 손님은 이유를 묻기 쉬워졌고, 값을 임의로 바꿨다는 오해는 줄었다.',{stockLoss:1,trust:1}],
      ['단골에게만 지난 값으로 조금 내준다','단골과 나데즈다가 압니다 · 개인 거래 쪽지에 남습니다 · 다른 손님에게 차이를 설명해야 합니다','단골에게 지난 값을 적용했다. 한 사람은 납득했지만 좌판의 기준을 다시 말해야 한다.',{stockLoss:0,trust:1}],
    ]},
    { map:'market-quay', tile:[25,8], object:1153, name:'좌판 마감과 남은 바구니', premise:'장터를 접을 시간이 다가온다. 남은 채소와 오늘의 거래를 어떤 기록으로 남길지 고른다.', actions:[
      ['팔린 양과 버린 양을 따로 적는다','나데즈다와 빵집 주인이 압니다 · 마감 장부에 수량이 남습니다 · 손실이 또렷하게 드러납니다','팔린 것과 버린 것을 나눠 적었다. 오늘 손해는 감출 수 없지만 내일 주문량은 다시 맞출 수 있다.',{stockLoss:2,trust:1}],
      ['남은 물건을 이웃과 나눠 가져간다','나데즈다와 이웃 상인이 압니다 · 나눔 쪽지에 받는 사람이 남습니다 · 다음 거래 몫이 줄 수 있습니다','남은 물건 일부를 이웃에게 건넸다. 버리는 양은 줄었고 다음 거래를 부탁하기가 편해졌다.',{stockLoss:1,trust:2}],
      ['상태가 괜찮은 것만 내일 몫으로 남긴다','나데즈다만 압니다 · 개인 재고 메모에 남습니다 · 내일 팔 수 있다는 보장은 없습니다','괜찮은 것만 남겨 두었다. 오늘은 덜 팔았지만 상태를 확인하지 않은 물건을 손님에게 넘기지 않았다.',{stockLoss:0,trust:1}],
    ]},
  ]},
  { host:'porter_gavrila', other:'warehouse_pyotr', id:'GAVRILA_LOAD_AND_REST_1847', title:'짐 무게와 다음 품삯', metric:'몸의 부담과 다음 일감의 신뢰', stages:[
    { map:'market-quay', tile:[13,8], object:1154, name:'들기 전 짐 무게 확인', premise:'창고에서 시장까지 옮길 짐이 평소보다 무겁다. 어깨가 뻐근하지만 오늘 일을 거절하면 다음 차례에서 빠질 수 있다.', actions:[
      ['짐을 나눠 두 사람이 함께 든다','가브릴라와 동료가 압니다 · 분담 쪽지에 맡은 몫이 남습니다 · 작업 시간이 더 걸립니다','짐을 둘로 나눠 들었다. 늦어졌지만 한 사람에게 무게를 몰아주지는 않았다.',{bodyRisk:0,workTrust:2}],
      ['저울로 무게를 재고 맡을 양을 정한다','창고 담당과 고용인이 봅니다 · 작업 장부에 무게가 남습니다 · 남은 짐을 맡을 사람이 필요합니다','무게를 재고 가능한 양만 맡았다. 남은 몫은 그대로지만 누가 얼마나 들었는지는 분명해졌다.',{bodyRisk:1,workTrust:2}],
      ['아무 말 없이 한 번에 옮긴다','가브릴라만 압니다 · 작업 장부에는 추가 기록이 없습니다 · 어깨가 더 상하면 내일 일을 놓칠 수 있습니다','혼자 한 번에 들었다. 오늘 일은 빨리 끝났지만 몸이 더 나빠져도 고용인은 알기 어렵다.',{bodyRisk:2,workTrust:0}],
    ]},
    { map:'courtyard', tile:[10,5], object:1155, name:'쉬는 시간과 맡은 짐 메모', premise:'잠깐 쉬면 다시 일할 수 있을 것 같다. 함께 일하는 동료에게 일을 나눠 달라고 할지, 쉬는 시간을 장부에 남길지 결정한다.', actions:[
      ['쉬는 동안 동료가 맡은 짐을 세어 둔다','가브릴라와 동료가 압니다 · 인계 메모에 수량이 남습니다 · 동료의 작업이 늘어납니다','잠깐 쉬고 돌아와 인계한 짐을 확인했다. 맡긴 양은 분명하고 다음 품삯도 협의할 수 있다.',{bodyRisk:0,workTrust:1}],
      ['어깨가 아프다고 고용인에게 말한다','고용인과 가브릴라가 압니다 · 작업 메모에 상태가 남습니다 · 다음 일감을 적게 받을 수 있습니다','어깨 상태를 알렸다. 오늘은 작업이 늦어질 수 있지만 이유를 숨기지 않았다.',{bodyRisk:0,workTrust:2}],
      ['기록 없이 잠깐 자리를 비운다','가브릴라와 동료가 압니다 · 공식 인계 기록은 없습니다 · 맡은 짐이 비면 책임이 돌아올 수 있습니다','기록 없이 쉬었다. 몸은 잠깐 나아졌지만 누가 무엇을 맡았는지 다시 맞춰야 한다.',{bodyRisk:1,workTrust:0}],
    ]},
    { map:'market-quay', tile:[19,8], object:1156, name:'오늘의 품삯과 남은 일', premise:'마지막 짐을 옮겼다. 맡은 일과 실제 받은 품삯이 맞는지 확인하고 다음 날의 몸 상태도 생각해야 한다.', actions:[
      ['맡은 무게와 받은 품삯을 같이 적는다','가브릴라와 고용인이 압니다 · 품삯 메모에 작업량이 남습니다 · 차이가 있으면 다시 따져야 합니다','오늘 옮긴 양과 받은 품삯을 함께 적었다. 계산이 맞는지 내일 다시 확인할 수 있다.',{bodyRisk:0,workTrust:2}],
      ['오늘은 돈을 받고 다음 일은 쉬겠다고 말한다','가브릴라와 고용인이 압니다 · 다음 차례 쪽지에 휴식이 남습니다 · 그날 품삯은 줄어듭니다','오늘 일은 정산하고 다음 차례는 쉬기로 했다. 수입은 줄어도 몸을 회복할 시간을 마련했다.',{bodyRisk:0,workTrust:1}],
      ['몸 상태를 숨기고 다음 짐도 맡는다','고용인만 압니다 · 작업 장부에는 다음 짐만 남습니다 · 부상이 심해지면 더 오래 일하지 못할 수 있습니다','다음 짐까지 맡았다. 당장은 일감이 이어지지만 몸이 버틸지는 알 수 없다.',{bodyRisk:2,workTrust:0}],
    ]},
  ]},
  { host:'warehouse_pyotr', other:'carter_roman', id:'PYOTR_MISSING_CRATE_AUDIT_1847', title:'장부에서 빠진 상자', metric:'재고의 확실성과 운송 책임', stages:[
    { map:'market-quay', tile:[25,9], object:1157, name:'들어온 상자와 인장 대조', premise:'장부 수량보다 상자 하나가 적다. 상차가 잘못됐는지, 기록이 늦었는지 아직 모른다. 먼저 무엇을 확인할지 정한다.', actions:[
      ['남은 상자의 인장과 표식을 맞춰 본다','표트르와 창고 동료가 압니다 · 대조표에 확인한 표식이 남습니다 · 출고가 잠시 늦어집니다','상자 표식을 하나씩 대조했다. 누락 위치는 찾지 못했지만 확인한 수량은 남겼다.',{verifiedStock:2,delay:1}],
      ['마차가 떠난 시각을 운송인에게 묻는다','표트르와 마부가 압니다 · 질문 쪽지에 시각이 남습니다 · 운송인이 책임을 추궁받는다고 느낄 수 있습니다','떠난 시각과 경로를 물었다. 아직 누구의 실수인지 정하지 않고 이동 기록부터 확인했다.',{verifiedStock:1,delay:1}],
      ['우선 장부에서 상자 한 개를 지운다','창고 장부를 보는 사람이 압니다 · 재고부에 감액이 남습니다 · 실제 물건이 다른 곳에 있으면 기록이 더 틀어집니다','상자를 찾기 전에 수량을 줄였다. 다음 사람은 재고를 믿기 어렵고, 뒤늦게 찾으면 다시 고쳐야 한다.',{verifiedStock:0,delay:0}],
    ]},
    { map:'printshop', tile:[5,4], object:1158, name:'인수 쪽지와 운송 기록 비교', premise:'운송 쪽지에는 상자 수량이 적혀 있지만 창고 장부와 다르다. 두 기록의 차이를 어떻게 처리할지 결정한다.', actions:[
      ['두 기록의 작성 시각과 수량을 나란히 적는다','창고와 인쇄소 담당자가 봅니다 · 대조 메모에 차이가 남습니다 · 인쇄소의 인수도 늦어질 수 있습니다','두 기록의 시각과 수량을 나눠 적었다. 어느 쪽을 고칠지는 확인 뒤로 미뤘다.',{verifiedStock:2,delay:2}],
      ['확인된 상자만 먼저 인계한다','창고와 인쇄소 담당자가 압니다 · 부분 인수증에 수량이 남습니다 · 나머지 물량이 따로 보관됩니다','확인한 상자만 넘겼다. 작업은 일부 이어지고 남은 수량은 찾을 때까지 따로 남는다.',{verifiedStock:2,delay:1}],
      ['운송인에게 전체 수량을 다시 서명해 달라 한다','운송인과 창고 담당자가 압니다 · 수정 인수증에 서명이 남습니다 · 운송인이 서명을 거부할 수 있습니다','다시 서명해 달라고 요청했다. 기록은 정리될 수 있지만 상대의 확인을 기다려야 한다.',{verifiedStock:1,delay:2}],
    ]},
    { map:'market-quay', tile:[26,9], object:1159, name:'누락 수량과 책임자 기록', premise:'확인 절차를 마쳤다. 상자가 어디 있는지 끝내 찾지 못했더라도 장부에 사실과 추정을 섞지 않도록 마무리한다.', actions:[
      ['확인한 수량과 미확인 한 개를 나눠 기록한다','창고 책임자가 봅니다 · 재고부에 미확인 수량이 남습니다 · 장부 검토가 계속됩니다','찾은 수량과 찾지 못한 수량을 나눠 남겼다. 손실을 확정하지 않아 다음 확인이 이어질 수 있다.',{verifiedStock:2,delay:1}],
      ['운송 기록과 함께 상급자에게 보고한다','상급자와 운송 담당자가 봅니다 · 공식 보고에 책임 경로가 남습니다 · 조사 대상이 넓어질 수 있습니다','차이를 공식 보고로 올렸다. 책임을 정하지는 않았고 추가 확인을 맡겼다.',{verifiedStock:1,delay:2}],
      ['미확인 수량을 손실로 처리하고 장부를 닫는다','창고 장부를 보는 사람이 압니다 · 손실 처리 기록이 남습니다 · 나중에 상자를 찾으면 다시 정정해야 합니다','미확인 상자를 손실로 닫았다. 오늘 장부는 끝났지만 그 결론을 되돌릴 가능성도 남았다.',{verifiedStock:0,delay:0}],
    ]},
  ]},
  { host:'baker_fyodor', other:'market_nadezhda', id:'FYODOR_OVEN_ORDER_1847', title:'화덕 앞에 선 주문들', metric:'약속한 빵과 재료의 여유', stages:[
    { map:'market-quay', tile:[9,9], object:1160, name:'밀가루 자루와 주문 수량', premise:'오늘 들어온 밀가루가 주문을 모두 채우기에 부족하다. 자루의 상태를 확인하고 어떤 주문을 먼저 살릴지 골라야 한다.', actions:[
      ['자루를 다시 재고 만들 수량을 계산한다','표도르와 보조가 압니다 · 작업 메모에 수량이 남습니다 · 굽기를 시작하는 시간이 늦어집니다','밀가루를 다시 재고 만들 수량을 정했다. 약속을 바꾸기 전에 부족한 양을 확인했다.',{waste:0,promise:2}],
      ['급한 주문부터 굽고 나머지는 늦춘다','주문한 손님들이 압니다 · 납기 쪽지에 순서가 남습니다 · 늦어진 손님이 불만을 가질 수 있습니다','급한 주문을 먼저 화덕에 넣었다. 필요한 사람에게는 맞췄지만 다른 손님에게 늦는 이유를 알려야 한다.',{waste:1,promise:1}],
      ['모든 주문의 수량을 조금씩 줄인다','빵집 손님들이 압니다 · 변경한 수량이 공개 장부에 남습니다 · 모두가 약속보다 적게 받습니다','모든 주문을 조금씩 줄였다. 한 사람에게만 부담을 넘기지 않았지만 누구도 약속한 양을 받지 못한다.',{waste:0,promise:0}],
    ]},
    { map:'nevsky', tile:[19,9], object:1161, name:'손님에게 보낼 굽기 시각 쪽지', premise:'화덕 순서를 정했지만 손님은 아직 바뀐 시각을 모른다. 누구에게 어떤 방식으로 먼저 알릴지 선택한다.', actions:[
      ['기다리는 손님에게 새 시각을 직접 알린다','해당 손님과 표도르가 압니다 · 개인 쪽지에 시각이 남습니다 · 다른 손님이 공지를 못 볼 수 있습니다','기다리는 손님에게 새 시각을 말했다. 그 사람은 헛걸음을 피하고 다른 주문은 따로 알려야 한다.',{waste:0,promise:2}],
      ['문 앞에 변경한 순서를 붙인다','빵집을 찾는 손님이 봅니다 · 주문 순서표가 공개됩니다 · 누가 먼저인지 다툼이 생길 수 있습니다','순서를 문 앞에 붙였다. 누구나 확인할 수 있지만 사정이 공개되는 부담도 생겼다.',{waste:1,promise:1}],
      ['시간을 알리지 않고 준비되는 대로 건넨다','표도르만 압니다 · 공식 변경 기록은 없습니다 · 손님이 기다리거나 다시 찾아와야 합니다','따로 알리지 않았다. 일이 끝나면 건넬 수 있지만 손님은 언제 올지 모른다.',{waste:0,promise:0}],
    ]},
    { map:'market-quay', tile:[10,9], object:1162, name:'화덕을 끄기 전 주문 마감', premise:'마지막 빵이 나왔다. 남은 밀가루와 실제 인도한 수량을 정리하고 다음 주문에 어떤 약속을 남길지 고른다.', actions:[
      ['만든 양과 건넨 양을 따로 적는다','표도르와 시장 상인이 봅니다 · 마감 장부에 수량이 남습니다 · 약속을 못 채운 부분이 드러납니다','만든 양과 건넨 양을 나눠 적었다. 다음 주문은 남은 재료에 맞춰 잡을 수 있다.',{waste:1,promise:2}],
      ['남은 재료를 내일 몫으로 따로 둔다','표도르만 압니다 · 개인 재고 쪽지에 남습니다 · 내일 재료가 들어온다는 보장은 없습니다','남은 밀가루를 따로 두었다. 오늘 더 팔지는 못하지만 재료가 있는 것처럼 약속하지 않았다.',{waste:0,promise:1}],
      ['늦어진 손님에게 다음 굽기 때 먼저 주겠다고 한다','손님과 표도르가 압니다 · 다음 주문 메모에 약속이 남습니다 · 다음에도 재료가 모자라면 약속이 겹칩니다','다음 굽기에 먼저 주겠다고 말했다. 오늘 문제는 남았고 새 약속도 지켜야 한다.',{waste:0,promise:1}],
    ]},
  ]},
  { host:'landlady_polina', other:'tenant_mikhail', id:'POLINA_COMMON_FIREWOOD_1847', title:'장작값과 방세 사이', metric:'공동 살림의 부담과 세입자 신뢰', stages:[
    { map:'courtyard', tile:[10,6], object:1163, name:'공용 장작 더미와 몫 계산', premise:'공용 장작이 예상보다 빨리 줄었다. 세입자 가운데 누가 더 썼는지 보지 못한 상태에서 다음 몫을 정해야 한다.', actions:[
      ['남은 장작 수부터 다시 세고 공동 몫을 정한다','폴리나와 안뜰 관리인이 압니다 · 수량 메모에 남습니다 · 결정이 하루 늦어집니다','장작 수를 다시 세었다. 누가 가져갔는지는 적지 않고 다음 몫을 논의하기로 했다.',{fairShare:2,tenantTrust:1}],
      ['세입자마다 같은 몫을 걷는다','모든 세입자가 압니다 · 공동 장부에 같은 몫이 남습니다 · 형편이 다른 집도 같은 부담을 집니다','같은 몫을 정했다. 계산은 단순하지만 각 집의 사정은 반영하지 못했다.',{fairShare:1,tenantTrust:0}],
      ['장작을 더 쓴 집을 추측해 비용을 붙인다','폴리나와 지목된 세입자가 압니다 · 개인 독촉 쪽지에 남습니다 · 잘못 지목하면 다툼이 커집니다','추측으로 한 집에 비용을 붙였다. 장부는 빨리 채워도 근거를 물으면 답할 수 없다.',{fairShare:0,tenantTrust:-1}],
    ]},
    { map:'market-quay', tile:[20,9], object:1164, name:'공동 비용과 방세 납부 쪽지', premise:'세입자 한 명은 방세를 하루 미루고 싶어 한다. 공동 장작값도 받아야 해서 기다려 주는 일을 어떻게 기록할지 선택한다.', actions:[
      ['방세와 장작 몫을 나눠 하루 유예를 적는다','폴리나와 해당 세입자가 압니다 · 유예 쪽지에 날짜가 남습니다 · 다른 세입자가 기준을 물을 수 있습니다','방세와 장작 몫을 따로 적고 하루를 기다리기로 했다. 공용 비용은 사라지지 않아 다시 확인해야 한다.',{fairShare:2,tenantTrust:2}],
      ['공동 장작 몫만 먼저 받고 방세는 다시 논의한다','폴리나와 세입자가 압니다 · 납부 메모에 두 항목이 분리됩니다 · 방세 수입은 늦어집니다','장작 몫부터 받고 방세는 남겨 두었다. 공동 비용은 마련됐고 방세 문제는 그대로 남았다.',{fairShare:2,tenantTrust:1}],
      ['유예 없이 모든 비용을 오늘 요구한다','폴리나와 세입자들이 압니다 · 독촉 장부에 전액이 남습니다 · 세입자가 방을 비울 수 있습니다','전액을 요구했다. 기준은 한결같지만 돈을 마련하지 못한 세입자의 선택이 좁아졌다.',{fairShare:1,tenantTrust:-1}],
    ]},
    { map:'courtyard', tile:[11,6], object:1165, name:'이번 주 공동 살림 정산', premise:'장작 몫과 미뤄 둔 방세를 정리할 때다. 이름을 공개할지, 공동 비용만 확인할지 마무리 방식을 고른다.', actions:[
      ['공동 장작 지출과 받은 몫만 공개한다','안뜰 세입자들이 봅니다 · 공동 장부에 비용만 남습니다 · 개인별 미납은 알 수 없습니다','공동 지출과 수입만 공유했다. 비용은 확인할 수 있고 개인 사정은 장부에서 가려졌다.',{fairShare:2,tenantTrust:2}],
      ['미납과 유예 날짜를 당사자와 따로 확인한다','폴리나와 해당 세입자가 압니다 · 개인 쪽지에 약속이 남습니다 · 다른 세입자에게 기준을 반복해 설명해야 합니다','유예한 날짜를 당사자와 확인했다. 사정은 공개되지 않고 약속은 남았다.',{fairShare:1,tenantTrust:2}],
      ['모든 세입자 이름과 납부 여부를 붙인다','안뜰을 오가는 사람이 봅니다 · 공개 장부에 이름과 금액이 남습니다 · 형편이 알려져 관계가 상할 수 있습니다','이름과 납부 여부를 공개했다. 빠진 몫은 보이지만 사적인 사정도 함께 드러난다.',{fairShare:1,tenantTrust:-1}],
    ]},
  ]},
  { host:'carter_roman', other:'courier_pavel', id:'ROMAN_ROUTE_PRIORITY_1847', title:'먼저 실을 짐, 먼저 도착할 약속', metric:'배달의 정확성과 운송 지연', stages:[
    { map:'market-quay', tile:[26,10], object:1166, name:'마차에 실을 짐의 순서', premise:'시장 물건과 인쇄소 봉투를 한 번에 실을 수 없다. 길이 막히기 전에 무엇을 먼저 옮길지 고른다.', actions:[
      ['봉투를 젖지 않게 싸고 인쇄소로 간다','로만과 인쇄소가 압니다 · 봉투 인수 메모에 남습니다 · 시장 물건은 다음 운행까지 기다립니다','봉투를 감싸 먼저 실었다. 글은 제때 갈 수 있지만 시장 쪽 물량이 늦어진다.',{deliveryCare:2,delay:1}],
      ['상하기 쉬운 시장 물건을 먼저 옮긴다','로만과 시장 상인이 압니다 · 인도 수량표에 남습니다 · 인쇄소 약속이 늦어집니다','시장 물건을 먼저 옮겼다. 상할 위험은 줄었고 봉투는 다음 길을 기다린다.',{deliveryCare:1,delay:1}],
      ['두 짐의 수취인에게 순서를 묻는다','두 수취인과 로만이 압니다 · 답변 쪽지에 우선순위가 남습니다 · 출발이 늦어질 수 있습니다','수취인의 사정을 먼저 물었다. 출발은 늦었지만 누구에게 왜 기다려 달라 했는지 남겼다.',{deliveryCare:2,delay:2}],
    ]},
    { map:'nevsky', tile:[20,9], object:1167, name:'길이 막힌 곳과 새 도착 시각', premise:'바퀴가 진창에 걸려 예정한 길보다 늦어졌다. 기다리는 사람에게 새 시각을 알릴지, 우회할지 정한다.', actions:[
      ['수취인에게 늦어질 시각을 먼저 알린다','로만과 수취인이 압니다 · 지연 쪽지에 새 시각이 남습니다 · 다음 운행의 손님이 바뀔 수 있습니다','늦어질 시각을 알려 기다리는 사람이 헛걸음하지 않게 했다. 다른 짐의 약속은 다시 맞춰야 한다.',{deliveryCare:2,delay:1}],
      ['돌아가더라도 넓은 길로 우회한다','로만만 압니다 · 운행 메모에 우회 경로가 남습니다 · 도착은 더 늦어집니다','넓은 길로 돌았다. 마차는 덜 흔들렸지만 약속한 시각을 맞추지는 못했다.',{deliveryCare:2,delay:2}],
      ['짐을 내려 가까운 사람에게 나눠 옮겨 달라 한다','로만과 돕는 사람이 압니다 · 임시 인계 쪽지에 짐이 남습니다 · 물건이 여러 손을 거칠 수 있습니다','가까운 사람과 짐을 나눠 들었다. 이동은 빨라졌고 인계한 물건을 다시 확인해야 한다.',{deliveryCare:1,delay:0}],
    ]},
    { map:'printshop', tile:[21,5], object:1168, name:'도착한 짐과 수취 확인', premise:'짐을 건넸다. 무엇이 도착했고 무엇이 늦었는지 수취인과 함께 확인한 뒤 다음 운행을 정한다.', actions:[
      ['짐 상태와 도착 시각을 함께 적는다','로만과 수취인이 압니다 · 인수표에 상태와 시각이 남습니다 · 확인하는 데 시간이 더 듭니다','짐 상태와 시각을 같이 적었다. 다음에 문제가 생기면 인계 전후를 구분할 수 있다.',{deliveryCare:2,delay:1}],
      ['받은 사람에게 수량만 확인받고 출발한다','로만과 수취인이 압니다 · 인수표에 수량이 남습니다 · 손상 여부는 나중에 다툴 수 있습니다','수량만 확인하고 출발했다. 다음 운행은 시작했지만 짐 상태는 서로 확인하지 못했다.',{deliveryCare:1,delay:0}],
      ['수취인이 자리에 없으면 짐을 싣고 돌아간다','로만과 인쇄소가 압니다 · 미수령 기록에 남습니다 · 다시 오는 비용과 시간이 듭니다','수취인이 없어 짐을 가져왔다. 잘못된 사람에게 넘기지는 않았고 재방문이 필요하다.',{deliveryCare:2,delay:2}],
    ]},
  ]},
];

const prop = (name, value) => ({ name, type: 'string', value });
const mapCache = new Map();
for (const chain of chains) for (let index = 0; index < chain.stages.length; index += 1) {
  const stage = chain.stages[index], stageNumber = index + 1;
  const questId = `${chain.id}_STAGE_${stageNumber}`;
  const previousQuestId = stageNumber > 1 ? `${chain.id}_STAGE_${stageNumber - 1}` : null;
  const file = `${chain.host.replaceAll('_','-')}-life-extra-${stageNumber}-1847.json`;
  const quest = {
    id: questId,
    titleKo: chain.title,
    chapterId: 'V33_1847_PRINT',
    date: '1847-06-01',
    premiseKo: stage.premise,
    historicalOutcome: { id: `${questId}_FICTIONAL_OUTCOME`, value: 'fictional resident daily life choice only; no historical public record is altered', sourceIds: [] },
    entry: { mapId: stage.map, objectId: stage.object, requiredHostId: chain.host },
    actions: stage.actions.map(([labelKo, subcopyKo, resultKo, lifeChainDelta], choiceIndex) => ({
      id: `${questId}_CHOICE_${choiceIndex + 1}`,
      hostIds: [chain.host],
      labelKo,
      subcopyKo,
      resultKo,
      resultFlag: `${chain.id}_${stageNumber}_${choiceIndex + 1}`,
      followupTitleKo: stage.name,
      followupKo: '이 선택은 허구 주민의 생활과 이웃 관계에만 남으며, 기록된 역사 사건은 바꾸지 않는다.',
      effects: { situationKo: resultKo, relations: { [chain.other]: `함께 확인한 일: ${stage.name}` }, lifeChainDelta },
    })),
    completion: 'one authorized choice at the named physical work object',
    lifeChain: { id: chain.id, titleKo: chain.title, stage: stageNumber, stageCount: 3, metricKo: chain.metric, ...(previousQuestId ? { previousQuestId } : {}) },
    ...(previousQuestId ? { prerequisiteQuestIds: [previousQuestId] } : {}),
  };
  const questPath = path.join(root, `rpg/quests/${file}`);
  try { await readFile(questPath); throw new Error(`Quest file already exists: ${file}`); } catch (error) { if (error.code !== 'ENOENT') throw error; }
  await writeFile(questPath, `${JSON.stringify(quest, null, 2)}\n`, 'utf8');

  const map = mapCache.get(stage.map) ?? JSON.parse(await readFile(path.join(root, `rpg/maps/${stage.map}.json`), 'utf8'));
  const interactions = map.layers.find(layer => layer.name === 'Interactions');
  if (!interactions || interactions.objects.some(object => object.id === stage.object || (Math.floor(object.x / 16) === stage.tile[0] && Math.floor(object.y / 16) === stage.tile[1]))) throw new Error(`Interaction point collision: ${stage.map}:${stage.object}`);
  interactions.objects.push({ id: stage.object, name: stage.name, type: 'quest-object', x: stage.tile[0] * 16, y: stage.tile[1] * 16, width: 16, height: 16, visible: true, properties: [prop('questId', questId)] });
  mapCache.set(stage.map, map);
}
for (const [mapId, map] of mapCache) await writeFile(path.join(root, `rpg/maps/${mapId}.json`), `${JSON.stringify(map, null, 2)}\n`, 'utf8');
console.log(JSON.stringify({ status: 'PASS', batch: 2, residents: chains.map(chain => chain.host), personalThreeStageChains: chains.length, questsCreated: chains.length * 3, mapFilesUpdated: [...mapCache.keys()] }, null, 2));
