const effects = new Map([
  ['nevsky', 'weather'],
  ['courtyard', 'weather'],
  ['market-quay', 'weather'],
  ['canal-road', 'weather'],
  ['workyard', 'weather'],
  ['bookshop-lane', 'weather'],
  ['printshop', 'dust'],
  ['chancery', 'dust'],
]);

const OUTDOOR_WEATHER = Object.freeze({
  winter: ['snow', 'snow', 'fog', 'wind', 'overcast'],
  spring: ['drizzle', 'fog', 'overcast', 'overcast', 'clear'],
  summer: ['drizzle', 'overcast', 'clear', 'clear', 'fog'],
  autumn: ['drizzle', 'fog', 'fog', 'overcast', 'wind'],
});

export function weatherForDate(date, dayIndex = 0) {
  const month = Number(date?.slice?.(5, 7));
  const season = month === 12 || month <= 2 ? 'winter'
    : month <= 5 ? 'spring' : month <= 8 ? 'summer' : 'autumn';
  const day = Number.isInteger(dayIndex) && dayIndex >= 0 ? dayIndex : 0;
  let seed = 17 + day * 31 + month * 13;
  for (const char of String(date ?? '')) seed = (seed * 33 + char.charCodeAt(0)) % 104729;
  return OUTDOOR_WEATHER[season][seed % OUTDOOR_WEATHER[season].length];
}

export function atmosphereForMap(mapId, width, height, time = 0, reducedMotion = false, weather = null) {
  const mapEffect = effects.get(mapId);
  const kind = mapEffect === 'weather' ? weather ?? 'drizzle' : mapEffect;
  if (!kind || width <= 0 || height <= 0) return null;
  if (kind === 'clear') return null;
  const clock = reducedMotion ? 0 : Math.max(0, time);
  const count = kind === 'drizzle' ? 48 : kind === 'snow' ? 42 : kind === 'wind' ? 24 : 13;
  const particles = Array.from({ length: count }, (_, index) => {
    const seedX = ((index * 47 + 13) % 97) / 97;
    const seedY = ((index * 61 + 29) % 89) / 89;
    if (kind === 'drizzle') return {
      x: (seedX * width - clock * 0.018 + width) % width,
      y: (seedY * height + clock * 0.055) % height,
      length: 8 + index % 7,
      alpha: 0.22 + (index % 3) * 0.07,
    };
    if (kind === 'snow') return {
      x: (seedX * width - clock * (0.004 + index % 3 * 0.001) + width) % width,
      y: (seedY * height + clock * (0.012 + index % 4 * 0.002)) % height,
      size: index % 5 === 0 ? 2 : 1,
      alpha: 0.32 + (index % 4) * 0.09,
    };
    if (kind === 'wind') return {
      x: (seedX * width - clock * 0.026 + width) % width,
      y: seedY * height,
      length: 4 + index % 8,
      alpha: 0.09 + (index % 4) * 0.035,
    };
    return {
      x: (seedX * width + clock * 0.003 + width) % width,
      y: (seedY * height - clock * 0.004 + height) % height,
      size: index % 3 === 0 ? 2 : 1,
      alpha: 0.12 + (index % 4) * 0.025,
    };
  });
  return { kind, particles };
}

export function mapHasAtmosphere(mapId) {
  return effects.has(mapId);
}
