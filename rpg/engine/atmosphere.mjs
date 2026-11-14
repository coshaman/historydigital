const effects = new Map([
  ['nevsky', 'weather'],
  ['morskaya-intersection', 'weather'],
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
  const count = kind === 'drizzle' ? 48 : kind === 'snow' ? 72 : kind === 'wind' ? 24 : 13;
  const particles = Array.from({ length: count }, (_, index) => {
    const seedX = ((index * 47 + 13) % 97) / 97;
    const seedY = ((index * 61 + 29) % 89) / 89;
    if (kind === 'drizzle') return {
      x: (seedX * width - clock * 0.018 + width) % width,
      y: (seedY * height + clock * 0.055) % height,
      length: 8 + index % 7,
      alpha: 0.34 + (index % 3) * 0.08,
    };
    if (kind === 'snow') return {
      x: (seedX * width - clock * (0.004 + index % 3 * 0.001) + width) % width,
      y: (seedY * height + clock * (0.012 + index % 4 * 0.002)) % height,
      size: index % 4 === 0 ? 2 : 1,
      alpha: 0.42 + (index % 4) * 0.08,
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
  return {
    kind,
    particles,
    ...(kind === 'drizzle' && mapEffect === 'weather' ? {
      surfaceEffect: 'wet-paving',
      pavingGlints: Array.from({ length: 24 }, (_, index) => ({
        x: ((index * 43 + 19) % 101) / 101 * width,
        y: height * (0.56 + ((index * 29 + 7) % 37) / 100),
        width: 3 + (index % 5) * 1.7,
        alpha: 0.22 + (index % 4) * 0.045,
      })),
    } : {}),
    ...(kind === 'fog' ? { fogBanks: Array.from({ length: 4 }, (_, index) => {
      const bandWidth = width * (0.36 + index * 0.055);
      const speed = reducedMotion ? 0 : 0.004 + index * 0.0014;
      const base = width * (index * 0.31 - 0.18);
      return {
        x: ((base + clock * speed) % (width + bandWidth) + width + bandWidth) % (width + bandWidth) - bandWidth,
        y: height * (0.46 + index * 0.115),
        width: bandWidth,
        height: height * (0.095 + index * 0.014),
        alpha: 0.38 + index * 0.05,
      };
    }) } : {}),
    ...(kind === 'snow' && mapEffect === 'weather'
      ? { surfaceEffect: 'snow-edge', snowBands: Array.from({ length: 18 }, (_, index) => {
        const segmentWidth = width / 18;
        return {
          x: index * segmentWidth + ((index * 13) % 5) * segmentWidth * 0.1,
          y: height * (mapId === 'nevsky' ? 0.43 : 0.72)
            + ((index * 11) % 3 - 1) * Math.max(0.5, height * 0.002),
          width: segmentWidth * (0.32 + ((index * 7) % 5) * 0.07),
          height: Math.max(1, height * (mapId === 'nevsky'
            ? 0.003 + ((index * 5) % 3) * 0.001
            : 0.013 + ((index * 5) % 3) * 0.004)),
          alpha: mapId === 'nevsky' ? 0.32 : 0.42 + (index % 3) * 0.04,
        };
      }) }
      : {}),
  };
}

export function mapHasAtmosphere(mapId) {
  return effects.has(mapId);
}
