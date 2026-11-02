export function selectDialogueTurn(data) {
  if (data?.fallback === true || data?.mode !== 'AI') {
    return { kind: 'unavailable', providerErrorCode: data?.providerErrorCode ?? 'provider_not_ready' };
  }
  return { kind: 'generated', turn: data.turn };
}

export function dialogueSessionNeedsReconnect(session) {
  return !session?.token || session.mode !== 'AI';
}

export function shouldUseAuthoredOfflineReply({ apiFailureCode = '', sessionWasLive = false } = {}) {
  // Authored fallback is for an explicitly unconfigured installation. Once an
  // AI session exists, network/provider failures must not masquerade as replies.
  return apiFailureCode === 'BLOCKED_NO_KEY' && !sessionWasLive;
}
