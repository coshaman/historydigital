// Small authored scene animation for the 1840s Petersburg street maps.
// These details are atmospheric reconstruction, not evidence for an exact route.
export function streetLifeFrame(mapId, time = 0, reducedMotion = false, mapWidth = 30) {
  if (!['nevsky', 'bookshop-lane', 'morskaya-intersection'].includes(mapId)) return null;
  const width = Math.max(1, Number(mapWidth) || 30) * 16;
  const phase = reducedMotion ? 0.42 : ((Math.max(0, time) / 16000) % 1);
  const lane = mapId === 'bookshop-lane';
  return { cartX: phase * (width + 68) - 50, cartY: (lane ? 12 : 10) * 16,
    mapWidth: width, reducedMotion, lane };
}

export function drawPetersburgStreetLife(ctx, mapId, ox, oy, scale, time = 0, reducedMotion = false, mapWidth = 30, weather = 'clear') {
  const frame = streetLifeFrame(mapId, time, reducedMotion, mapWidth);
  if (!frame) return;
  const x = ox + frame.cartX * scale;
  const y = oy + frame.cartY * scale;
  const s = scale;
  ctx.save();
  ctx.beginPath(); ctx.rect(ox, oy, frame.mapWidth * s, 20 * 16 * s); ctx.clip();
  if (weather === 'drizzle' || weather === 'fog') {
    ctx.strokeStyle = 'rgba(193,207,208,.28)'; ctx.lineWidth = Math.max(1, s * .55);
    for (let index = 0; index < 9; index += 1) {
      const glintX = ox + ((index * 61 + 23 + (reducedMotion ? 0 : time * .008)) % frame.mapWidth) * s;
      const glintY = oy + (10 * 16 + 11 + index % 3) * s;
      ctx.beginPath(); ctx.moveTo(glintX, glintY); ctx.lineTo(glintX + (8 + index % 5) * s, glintY); ctx.stroke();
    }
  }
  ctx.globalAlpha = frame.lane ? 0.72 : 0.88;
  // Low Russian town cart: horse, shafts, box, iron-rimmed wheels. Kept below
  // the facade line and behind interaction markers and characters.
  ctx.fillStyle = '#34251e';
  ctx.fillRect(x + 29*s, y + 1*s, 11*s, 5*s);
  ctx.fillRect(x + 33*s, y - 2*s, 4*s, 4*s);
  ctx.fillRect(x + 38*s, y - 1*s, 4*s, 2*s);
  const stride = reducedMotion ? 0 : Math.sin(time / 150) * 1.2;
  ctx.fillRect(x + 29*s, y + 5*s, 2*s, (6 + stride)*s);
  ctx.fillRect(x + 37*s, y + 5*s, 2*s, (6 - stride)*s);
  ctx.fillStyle = '#8e6945';
  ctx.fillRect(x + 6*s, y + 1*s, 23*s, 2*s);
  ctx.fillRect(x + 8*s, y - 4*s, 19*s, 6*s);
  ctx.fillStyle = '#b38854';
  ctx.fillRect(x + 10*s, y - 3*s, 15*s, 3*s);
  // A bundled driver sits above the cart's front board.
  ctx.fillStyle = '#2b211d';
  ctx.fillRect(x + 16*s, y - 10*s, 5*s, 4*s);
  ctx.fillRect(x + 15*s, y - 11*s, 6*s, 2*s);
  ctx.fillStyle = '#6c4231';
  ctx.fillRect(x + 15*s, y - 6*s, 8*s, 4*s);
  ctx.fillStyle = '#b79a72';
  ctx.fillRect(x + 19*s, y - 9*s, s, s);
  ctx.fillStyle = '#30231d';
  ctx.beginPath(); ctx.arc(x + 12*s, y + 4*s, 4*s, 0, Math.PI*2); ctx.fill();
  ctx.beginPath(); ctx.arc(x + 25*s, y + 4*s, 4*s, 0, Math.PI*2); ctx.fill();
  ctx.strokeStyle = '#c1a16d'; ctx.lineWidth = Math.max(1, s);
  ctx.beginPath(); ctx.arc(x + 12*s, y + 4*s, 2.1*s, 0, Math.PI*2); ctx.stroke();
  ctx.beginPath(); ctx.arc(x + 25*s, y + 4*s, 2.1*s, 0, Math.PI*2); ctx.stroke();
  // Wheel spokes stay still for reduced-motion mode.
  const spokeAngle = reducedMotion ? 0 : (time / 360) % (Math.PI*2);
  for (const cx of [x + 12*s, x + 25*s]) {
    for (let i = 0; i < 4; i += 1) {
      const a = spokeAngle + i * Math.PI/2;
      ctx.beginPath(); ctx.moveTo(cx, y + 4*s);
      ctx.lineTo(cx + Math.cos(a)*2*s, y + 4*s + Math.sin(a)*2*s); ctx.stroke();
    }
  }
  if (weather === 'snow' || weather === 'fog') {
    const breath = reducedMotion ? 0 : Math.sin(time / 420) * 1.5 * s;
    ctx.globalAlpha = 0.18;
    ctx.fillStyle = '#e4e0d4';
    ctx.beginPath(); ctx.ellipse(x + 43*s + breath, y - 1*s, 4*s, 1.4*s, -.16, 0, Math.PI*2); ctx.fill();
    ctx.globalAlpha = 0.1;
    ctx.beginPath(); ctx.ellipse(x + 48*s + breath, y - 3*s, 5*s, 1.8*s, -.14, 0, Math.PI*2); ctx.fill();
  }
  if (weather === 'drizzle' || weather === 'fog') {
    // The road darkens under passing wheels; the broken, low reflections avoid
    // reading as a permanent painted stripe on the authored map.
    const shine = reducedMotion ? 0.18 : 0.12 + (Math.sin(time / 740) + 1) * 0.035;
    ctx.globalAlpha = shine;
    ctx.fillStyle = '#b3c2c4';
    for (let patch = 0; patch < 5; patch += 1) {
      const px = ox + ((patch * 83 + (reducedMotion ? 0 : time * 0.006)) % frame.mapWidth) * s;
      const py = oy + (frame.cartY + (patch % 2 ? 10 : 13)) * s;
      ctx.fillRect(px, py, (10 + patch % 3 * 4) * s, Math.max(1, s * 0.7));
    }
  }
  ctx.restore();
}
