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

export function actorStepLift({ time = 0, lastMoveAt = -Infinity, active = false, reducedMotion = false } = {}) {
  const moveAge = time - lastMoveAt;
  if (!active || reducedMotion || moveAge < 0 || moveAge >= 360) return 0;
  return Math.abs(Math.sin(time / 90)) * 1.2;
}

export function drawElevatedSprite(ctx, image, sourceX, sourceY, sourceWidth, sourceHeight,
  x, y, width, height, scale = 1, lift = 0) {
  ctx.save();
  ctx.shadowColor = 'rgba(15, 12, 10, .52)';
  ctx.shadowBlur = scale * (0.7 + lift * 0.25);
  ctx.shadowOffsetX = scale * 0.45;
  ctx.shadowOffsetY = scale * (2.1 + lift);
  ctx.drawImage(image, sourceX, sourceY, sourceWidth, sourceHeight,
    x, y - lift * scale, width, height);
  ctx.restore();
}

export function sortSceneByGroundDepth(entries) {
  return [...entries].sort((a, b) => a.groundY - b.groundY || a.depthOrder - b.depthOrder || a.stableOrder - b.stableOrder);
}
