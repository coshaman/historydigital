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
  // The game must never present authored text as an answer to a player question.
  // Missing credentials and provider failures are shown as actionable errors.
  void apiFailureCode;
  void sessionWasLive;
  return false;
}
