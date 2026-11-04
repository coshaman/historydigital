export function selectDialogueTurn(data) {
  // A configured key or AI-mode session is not proof that this turn came
  // from the model. Only the server's explicit success marker may be shown.
  if (data?.aiGenerated !== true || data?.fallback === true || data?.mode !== 'AI') {
    return { kind: 'unavailable', providerErrorCode: data?.providerErrorCode ?? 'provider_not_ready' };
  }
  return { kind: 'generated', turn: data.turn };
}

export function dialogueSpeakerLabel(speakerId, hostName) {
  return speakerId === 'NARRATION' ? '주변 상황' : hostName;
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
