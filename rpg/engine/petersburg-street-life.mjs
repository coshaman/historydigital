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

export function streetCartFrame(time = 0, reducedMotion = false) {
  const clock = reducedMotion ? 0 : Math.max(0, time);
  return {
    wheelAngle: (clock / 360) % (Math.PI * 2),
    bodyBob: reducedMotion ? 0 : Math.sin(clock / 150) * 0.48,
    horseStep: reducedMotion ? 0 : Math.sin(clock / 150) * 0.8,
    hoofLift: reducedMotion ? 0 : Math.max(0, Math.sin(clock / 150)) * 0.7,
  };
}

export function drawPetersburgStreetLife(ctx, mapId, ox, oy, scale, time = 0, reducedMotion = false, mapWidth = 30, weather = 'clear') {
  const frame = streetLifeFrame(mapId, time, reducedMotion, mapWidth);
  if (!frame) return;
  const x = ox + frame.cartX * scale;
  const y = oy + frame.cartY * scale;
  const s = scale;
  const motion = streetCartFrame(time, reducedMotion);
  const cartY = y + motion.bodyBob * s;
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
  const alpha = frame.lane ? 0.8 : 0.92;
  const cart = (cx, cy) => {
    // Dark road contact and a fainter cast lobe create separation from the paving.
    ctx.globalAlpha = alpha * 0.24; ctx.fillStyle = '#100d0b';
    ctx.beginPath(); ctx.ellipse(cx + 21*s, cy + 5*s, 27*s, 2.6*s, 0, 0, Math.PI*2); ctx.fill();
    ctx.globalAlpha = alpha;
    // Horse body, mane, head and articulated legs.
    ctx.fillStyle = '#251b17';
    ctx.fillRect(cx + 30*s, cy - 7*s, 12*s, 6*s);
    ctx.fillRect(cx + 37*s, cy - 11*s, 4*s, 6*s);
    ctx.fillRect(cx + 39*s, cy - 13*s, 5*s, 3*s);
    ctx.fillRect(cx + 42*s, cy - 12*s, 2*s, 2*s);
    ctx.fillRect(cx + 29*s, cy - 8*s, 2*s, 3*s);
    ctx.fillStyle = '#76543b'; ctx.fillRect(cx + 31*s, cy - 6*s, 9*s, 2*s);
    ctx.fillStyle = '#30231d';
    ctx.fillRect(cx + 31*s, cy - 1*s, 2*s, (6 + motion.horseStep)*s);
    ctx.fillRect(cx + 38*s, cy - 1*s, 2*s, (6 - motion.horseStep)*s);
    ctx.fillRect(cx + 34*s, cy - 1*s, 2*s, 5*s);
    ctx.fillRect(cx + 41*s, cy - 2*s, 2*s, 5*s);
    ctx.fillStyle = '#a78b69';
    ctx.fillRect(cx + 31*s, cy + (5 + motion.hoofLift)*s, 2*s, s);
    ctx.fillRect(cx + 38*s, cy + (5 - motion.hoofLift)*s, 2*s, s);
    // Shafts and a box body with bevel, side boards, metal corner straps and cargo.
    ctx.fillStyle = '#553c2c';
    ctx.fillRect(cx + 5*s, cy - 1*s, 26*s, 2*s);
    ctx.fillStyle = '#36251c';
    ctx.fillRect(cx + 6*s, cy - 7*s, 22*s, 2*s);
    ctx.fillRect(cx + 5*s, cy - 5*s, 24*s, 8*s);
    ctx.fillStyle = '#805838'; ctx.fillRect(cx + 7*s, cy - 4*s, 20*s, 5*s);
    ctx.fillStyle = '#a97946'; ctx.fillRect(cx + 7*s, cy - 5*s, 19*s, s);
    ctx.fillStyle = '#4c3324';
    ctx.fillRect(cx + 9*s, cy - 3*s, 16*s, s);
    ctx.fillRect(cx + 8*s, cy - 1*s, 18*s, s);
    ctx.fillStyle = '#c49a61';
    ctx.fillRect(cx + 8*s, cy - 5*s, s, 6*s);
    ctx.fillRect(cx + 25*s, cy - 5*s, s, 6*s);
    // Rolled bundles rise above the bed; alternating planes suggest volume.
    ctx.fillStyle = '#45372d'; ctx.fillRect(cx + 10*s, cy - 11*s, 8*s, 5*s);
    ctx.fillRect(cx + 18*s, cy - 10*s, 7*s, 4*s);
    ctx.fillStyle = '#90775a'; ctx.fillRect(cx + 11*s, cy - 10*s, 6*s, 3*s);
    ctx.fillStyle = '#b09a79'; ctx.fillRect(cx + 19*s, cy - 9*s, 5*s, 2*s);
    ctx.fillStyle = '#604631'; ctx.fillRect(cx + 14*s, cy - 11*s, s, 5*s);
    // Driver silhouette sits behind the front rail with a cap and coat highlights.
    ctx.fillStyle = '#261e1a'; ctx.fillRect(cx + 19*s, cy - 16*s, 6*s, 5*s);
    ctx.fillRect(cx + 18*s, cy - 17*s, 8*s, 2*s);
    ctx.fillStyle = '#b4926f'; ctx.fillRect(cx + 22*s, cy - 15*s, s, 2*s);
    ctx.fillStyle = '#463027'; ctx.fillRect(cx + 18*s, cy - 11*s, 8*s, 4*s);
    // Iron-rimmed wheels with hub, inner well and rotating spokes.
    for (const [wheelX, radius] of [[cx + 12*s, 3.4*s], [cx + 26*s, 3.7*s]]) {
      const wheelY = cy + 3*s;
      ctx.fillStyle = '#201916'; ctx.beginPath(); ctx.arc(wheelX, wheelY, radius + 0.8*s, 0, Math.PI*2); ctx.fill();
      ctx.strokeStyle = '#b48d5d'; ctx.lineWidth = Math.max(1, 0.8*s);
      ctx.beginPath(); ctx.arc(wheelX, wheelY, radius, 0, Math.PI*2); ctx.stroke();
      ctx.strokeStyle = '#8b6845'; ctx.lineWidth = Math.max(1, 0.55*s);
      for (let spoke = 0; spoke < 6; spoke += 1) {
        const angle = motion.wheelAngle + spoke * Math.PI/3;
        ctx.beginPath(); ctx.moveTo(wheelX, wheelY);
        ctx.lineTo(wheelX + Math.cos(angle)*radius*0.78, wheelY + Math.sin(angle)*radius*0.78); ctx.stroke();
      }
      ctx.fillStyle = '#d0ab72'; ctx.beginPath(); ctx.arc(wheelX, wheelY, 0.9*s, 0, Math.PI*2); ctx.fill();
    }
    ctx.globalAlpha = alpha;
    ctx.strokeStyle = '#d0ae76'; ctx.lineWidth = Math.max(1, 0.55*s);
    ctx.beginPath(); ctx.moveTo(cx + 17*s, cy - 12*s); ctx.lineTo(cx + 33*s, cy - 9*s); ctx.lineTo(cx + 41*s, cy - 11*s); ctx.stroke();
  };
  cart(x, cartY);
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
