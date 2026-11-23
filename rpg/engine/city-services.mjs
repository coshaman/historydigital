export function attachCityServiceCounters(maps, catalog) {
  for (const [serviceId, counter] of Object.entries(catalog.counters)) {
    const map = maps[counter.mapId];
    const objects = map?.layers.find(layer => layer.name === 'Interactions')?.objects;
    if (!objects || objects.some(object => object.id === counter.objectId)) continue;
    objects.push({ id: counter.objectId, type: 'inspectable', name: counter.counterKo,
      x: counter.tile.x * 16, y: counter.tile.y * 16,
      properties: Object.entries({ serviceId, displayAsset: counter.asset, displayWidth: 25,
        displayHeight: 20, displayOffsetX: -4, displayOffsetY: -4 }).map(([name, value]) => ({ name, value })) });
  }
  const job = catalog.dayJob;
  const objects = maps[job.mapId]?.layers.find(layer => layer.name === 'Interactions')?.objects;
  for (const [step, site] of Object.entries({ board: job.board, delivery: job.delivery })) {
    if (!objects || objects.some(object => object.id === site.id)) continue;
    objects.push({ id: site.id, type: 'inspectable', name: site.name, x: site.tile.x * 16, y: site.tile.y * 16,
      properties: [{ name: 'serviceId', value: `day-job-${step}` }, { name: 'assetTileId', value: site.assetTileId }] });
  }
}

export function residentServiceTopics(catalog, hostId, date) {
  if (date < '1847-06-01' || !date) return [];
  return Object.entries(catalog.topics).flatMap(([topicId, topic]) => topic.residents[hostId]
    ? [{ topicId, questionKo: topic.questionKo, terms: topic.terms, replyKo: topic.residents[hostId] }] : []);
}

export function residentServiceAnswer(catalog, hostId, date, question) {
  const text = question.replace(/\s/g, '');
  const topics = residentServiceTopics(catalog, hostId, date);
  return topics.find(topic => topic.questionKo === question)
    ?? topics.find(topic => topic.terms.some(term => text.includes(term.replace(/\s/g, ''))));
}

function counterDay(state) {
  return `${state.world.date}:${Math.floor(state.world.clockMinutes / 1440)}`;
}

export function cityCounterOffers(state, counter) {
  const buyer = state.hosts[state.player.embodiment];
  const seller = state.hosts[counter.sellerId];
  const minute = state.world.clockMinutes % 1440;
  const distance = buyer ? Math.abs(counter.tile.x - buyer.position.x) + Math.abs(counter.tile.y - buyer.position.y) : Infinity;
  if (!buyer || buyer.historicalAliveAndPresent === false || buyer.id === counter.sellerId
    || buyer.mapId !== counter.mapId || state.world.currentMapId !== counter.mapId || distance > 1
    || state.world.activeRealm || state.player.civic?.custody?.active) return { reason: 'counter_unavailable', offers: [] };
  if (!seller || seller.historicalAliveAndPresent === false || seller.mapId !== counter.mapId
    || minute < counter.opensMinute || minute >= counter.closesMinute) return { reason: 'counter_closed', offers: [] };
  const dailySales = state.ledger.filter(row => row.eventType === 'CITY_COUNTER_PURCHASE'
    && row.sellerHostId === counter.sellerId && row.serviceDay === counterDay(state));
  const offers = counter.products.map(product => {
    const remaining = product.stock - dailySales.filter(row => row.productId === product.id).length;
    const alreadyOwned = product.kind === 'clothes' && buyer.inventory.includes(product.labelKo);
    const recentlyAte = product.kind === 'meal' && Number.isFinite(buyer.needs.lastMealAtMinute)
      && state.world.clockMinutes - buyer.needs.lastMealAtMinute < 60;
    const affordable = buyer.money?.unit === 'kopeks' && seller.money?.unit === 'kopeks'
      && Number.isFinite(seller.money.amount) && buyer.money.amount >= product.price;
    const reason = remaining <= 0 ? 'sold_out' : alreadyOwned ? 'already_owned' : recentlyAte ? 'recently_ate'
      : !affordable ? 'insufficient_funds' : null;
    return { ...product, remaining, reason };
  });
  return { offers, reason: null };
}

export function purchaseCityCounterOffer(state, counter, productId) {
  const { reason, offers } = cityCounterOffers(state, counter);
  const product = offers.find(item => item.id === productId);
  if (!product || product.reason) return { ok: false, reason: reason ?? product?.reason ?? 'unknown_product', state };
  const next = structuredClone(state);
  const buyer = next.hosts[next.player.embodiment], seller = next.hosts[counter.sellerId];
  buyer.money.amount -= product.price;
  seller.money.amount += product.price;
  const hungerBefore = buyer.needs.hunger;
  if (product.kind === 'clothes') buyer.inventory.push(product.labelKo);
  if (product.kind === 'meal') {
    buyer.needs.hunger = Math.max(0, hungerBefore - product.hungerRelief);
    buyer.needs.lastMealAtMinute = next.world.clockMinutes;
  }
  next.ledger.push({ eventId: `COUNTER_${next.ledger.length + 1}`, eventType: 'CITY_COUNTER_PURCHASE',
    date: next.world.date, mapId: counter.mapId, hostId: buyer.id, sellerHostId: seller.id,
    serviceDay: counterDay(next), productId, itemKo: product.labelKo, price: product.price,
    basisSourceIds: [...product.sourceIds], ...(product.kind === 'meal' ? { hungerBefore, hungerAfter: buyer.needs.hunger } : {}) });
  return { ok: true, state: next, product };
}

export function cityDayJobStatus(state, job, step) {
  const worker = state.hosts[state.player.embodiment], payer = state.hosts[job.payerId];
  const site = job[step];
  if (!worker || !site || worker.historicalAliveAndPresent === false || worker.id === payer?.id
    || worker.mapId !== job.mapId || state.world.currentMapId !== job.mapId || state.world.activeRealm
    || state.player.civic?.custody?.active
    || Math.abs(worker.position.x - site.tile.x) + Math.abs(worker.position.y - site.tile.y) > 1) return 'unavailable';
  const latest = state.ledger.findLast(row => row.hostId === worker.id
    && (row.eventType === 'CITY_JOB_ACCEPTED' || row.eventType === 'CITY_JOB_PAID'));
  if (step === 'delivery') return latest?.eventType === 'CITY_JOB_ACCEPTED' && worker.inventory.includes(job.cargoKo) ? 'deliver' : 'no_cargo';
  if (latest?.eventType === 'CITY_JOB_ACCEPTED') return 'carrying';
  if (latest?.serviceDay === counterDay(state)) return 'done_today';
  if (!payer || payer.historicalAliveAndPresent === false || payer.mapId !== job.mapId
    || payer.money?.unit !== 'kopeks' || worker.money?.unit !== 'kopeks'
    || !Number.isFinite(worker.money.amount) || !Number.isFinite(payer.money.amount) || payer.money.amount < job.pay) return 'no_work';
  return 'accept';
}

export function performCityDayJobStep(state, job, step) {
  const status = cityDayJobStatus(state, job, step);
  if (status !== 'accept' && status !== 'deliver') return { ok: false, reason: status, state };
  const next = structuredClone(state), worker = next.hosts[next.player.embodiment];
  const accepting = status === 'accept';
  if (accepting) {
    next.hosts[job.payerId].money.amount -= job.pay;
    worker.inventory.push(job.cargoKo);
  } else {
    worker.inventory.splice(worker.inventory.indexOf(job.cargoKo), 1);
    worker.money.amount += job.pay;
    worker.needs.fatigue = Math.min(100, worker.needs.fatigue + job.fatigue);
  }
  next.ledger.push({ eventId: `CITY_JOB_${next.ledger.length + 1}`, eventType: accepting ? 'CITY_JOB_ACCEPTED' : 'CITY_JOB_PAID',
    date: next.world.date, serviceDay: counterDay(next), mapId: job.mapId, hostId: worker.id,
    payerHostId: job.payerId, itemKo: job.cargoKo, amount: job.pay, basisSourceIds: [...job.basisSourceIds] });
  return { ok: true, state: next };
}
