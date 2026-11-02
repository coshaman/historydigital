export function selectDialogueTurn(data) {
  if (data?.fallback === true || data?.mode !== 'AI') {
    return { kind: 'unavailable', providerErrorCode: data?.providerErrorCode ?? 'provider_not_ready' };
  }
  return { kind: 'generated', turn: data.turn };
}
