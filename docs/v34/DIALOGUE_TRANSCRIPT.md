# V34 dialogue evidence

All API routes were intercepted during the browser evidence runs. The fallback sample below came from a fresh offline mobile playtest; it did not call the AI provider.

## Offline authored fallback

**플레이어 입력:** 오늘은 어떤 일이 바쁘세요?

**안나:** 그건 내가 직접 본 일이 아니에요.

The text field remained available after the response. Prepared responses remained available alongside free text. Conversation turns were kept in the expandable transcript, separate from the current dialogue line.

## Mocked online response

The automated online test supplied a mock response, not a provider response:

**안나:** 수선은 끝났어요. 오늘은 값을 받아야 해요.

The automated test then supplied mocked 429 and timeout responses and verified that the authored fallback appeared without trapping the conversation.
