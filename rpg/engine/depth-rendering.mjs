// Soft, directionally lit contact shadows help pixel figures and props sit in
// the same ground plane without changing their authored sprite art.
export function drawGroundShadow(ctx, { x, baseY, width = 16, scale = 1, strength = 1 } = {}) {
  const size = Math.max(1, width * scale);
  const centerX = x + size / 2;
  const groundY = baseY;
  ctx.save();

  // The longer, faint lobe falls down and right from the cool upper-left light.
  ctx.globalAlpha = 0.12 * strength;
  ctx.fillStyle = '#171513';
  ctx.beginPath();
  ctx.ellipse(centerX + size * 0.12, groundY - size * 0.045, size * 0.43, size * 0.14, -0.06, 0, Math.PI * 2);
  ctx.fill();

  // Tight dark contact at the feet/base keeps the subject from reading as airborne.
  ctx.globalAlpha = 0.26 * strength;
  ctx.beginPath();
  ctx.ellipse(centerX, groundY, size * 0.27, Math.max(1, size * 0.075), 0, 0, Math.PI * 2);
  ctx.fill();
  ctx.restore();
}

export function sortSceneByGroundDepth(entries) {
  return [...entries].sort((a, b) => a.groundY - b.groundY || a.depthOrder - b.depthOrder || a.stableOrder - b.stableOrder);
}
