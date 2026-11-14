// Soft, directionally lit contact shadows help pixel figures and props sit in
// the same ground plane without changing their authored sprite art.
export function objectShadowElevation(height, tileSize = 16, authoredElevation = null) {
  if (authoredElevation !== null && authoredElevation !== undefined && Number.isFinite(Number(authoredElevation))) {
    return Math.min(26, Math.max(0, Number(authoredElevation)));
  }
  return Math.min(26, Math.max(0, (Number(height) || 0) - tileSize) * 0.62);
}

export function drawGroundShadow(ctx, { x, baseY, width = 16, scale = 1, strength = 1, elevation = 0 } = {}) {
  const size = Math.max(1, width * scale);
  const centerX = x + size / 2;
  const groundY = baseY;
  const height = Math.max(0, Number(elevation) || 0) * scale;
  ctx.save();

  // A raised object throws a broader, displaced shadow down-right from the
  // Petersburg overcast light; the contact ellipse remains pinned to its base.
  ctx.globalAlpha = (0.12 + Math.min(0.08, height / Math.max(1, size) * 0.018)) * strength;
  ctx.fillStyle = '#171513';
  ctx.beginPath();
  ctx.ellipse(centerX + size * 0.12 + height * 0.22, groundY + height * 0.12 - size * 0.045,
    size * 0.43 + height * 0.16, size * 0.14 + height * 0.045, -0.06, 0, Math.PI * 2);
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
