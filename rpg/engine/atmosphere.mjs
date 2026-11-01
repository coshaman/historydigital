const effects = new Map([
  ['nevsky', 'drizzle'],
  ['courtyard', 'drizzle'],
  ['printshop', 'dust'],
  ['chancery', 'dust'],
]);

export function atmosphereForMap(mapId, width, height, time = 0, reducedMotion = false) {
  const kind = effects.get(mapId);
  if (!kind || width <= 0 || height <= 0) return null;
  const clock = reducedMotion ? 0 : Math.max(0, time);
  const count = kind === 'drizzle' ? 48 : 13;
  const particles = Array.from({ length: count }, (_, index) => {
    const seedX = ((index * 47 + 13) % 97) / 97;
    const seedY = ((index * 61 + 29) % 89) / 89;
    if (kind === 'drizzle') return {
      x: (seedX * width - clock * 0.018 + width) % width,
      y: (seedY * height + clock * 0.055) % height,
      length: 8 + index % 7,
      alpha: 0.22 + (index % 3) * 0.07,
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
