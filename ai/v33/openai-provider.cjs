'use strict';

function createResponsesProvider({ apiKey, fetchImpl = fetch, endpoint = 'https://api.openai.com/v1/responses', timeoutMs = 18000 } = {}) {
  const provider = {
    lastFailureCode: '',
    async generate({ input, format, model = 'gpt-5.4-mini', instructions = '', maxOutputTokens = 420 } = {}) {
      if (!apiKey) throw new Error('provider request failed');
      provider.lastFailureCode = '';
      const controller = new AbortController();
      const timer = setTimeout(() => controller.abort(), timeoutMs);
      try {
        const response = await fetchImpl(endpoint, {
          method: 'POST', headers: { authorization: `Bearer ${apiKey}`, 'content-type': 'application/json' },
          body: JSON.stringify({ model, reasoning: { effort: 'none' }, instructions, input: [{ role: 'user', content: JSON.stringify(input) }], text: { format }, max_output_tokens: Math.min(700, Math.max(100, maxOutputTokens)), store: false }),
          signal: controller.signal,
        });
        if (!response.ok) { provider.lastFailureCode = `http_${response.status}`; throw new Error(`provider request failed (${response.status})`); }
        const data = await response.json();
        if (data.status !== 'completed') { provider.lastFailureCode = 'incomplete_response'; throw new Error('provider response incomplete'); }
        let output = data.output_text;
        if (typeof output !== 'string' || !output.trim()) output = data.output?.flatMap(item => item.content ?? []).find(item => item.type === 'output_text')?.text;
        if (typeof output !== 'string' || !output.trim()) { provider.lastFailureCode = 'missing_output'; throw new Error('provider response incomplete'); }
        const parsed = JSON.parse(output);
        provider.lastFailureCode = '';
        return parsed;
      } catch (error) {
        if (error?.name === 'AbortError') { provider.lastFailureCode = 'timeout'; throw new Error('provider request timed out'); }
        if (error instanceof SyntaxError) { provider.lastFailureCode = 'malformed_json'; throw new Error('provider returned malformed structured output'); }
        if (!provider.lastFailureCode) provider.lastFailureCode = 'network_error';
        throw error;
      } finally { clearTimeout(timer); }
    },
  };
  return provider;
}

module.exports = { createResponsesProvider };
