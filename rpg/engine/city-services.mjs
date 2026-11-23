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
