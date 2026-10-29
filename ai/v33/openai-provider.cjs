'use strict';

function createResponsesProvider({ apiKey, fetchImpl = fetch, endpoint = 'https://api.openai.com/v1/responses', timeoutMs = 18000 } = {}) {
  return {
    async generate({ input, format, model = 'gpt-6.1-terra', instructions = '', maxOutputTokens = 420 } = {}) {
      if (!apiKey) throw new Error('provider request failed');
      const controller = new AbortController();
      const timer = setTimeout(() => controller.abort(), timeoutMs);
      try {
        const response = await fetchImpl(endpoint, {
          method: 'POST', headers: { authorization: `Bearer ${apiKey}`, 'content-type': 'application/json' },
          body: JSON.stringify({ model, instructions, input: [{ role: 'user', content: JSON.stringify(input) }], text: { format }, max_output_tokens: Math.min(700, Math.max(100, maxOutputTokens)), store: false }),
          signal: controller.signal,
        });
        if (!response.ok) throw new Error(`provider request failed (${response.status})`);
        const data = await response.json();
        if (data.status !== 'completed') throw new Error('provider response incomplete');
        let output = data.output_text;
        if (typeof output !== 'string' || !output.trim()) output = data.output?.flatMap(item => item.content ?? []).find(item => item.type === 'output_text')?.text;
        if (typeof output !== 'string' || !output.trim()) throw new Error('provider response incomplete');
        return JSON.parse(output);
      } catch (error) {
        if (error?.name === 'AbortError') throw new Error('provider request timed out');
        if (error instanceof SyntaxError) throw new Error('provider returned malformed structured output');
        throw error;
      } finally { clearTimeout(timer); }
    },
  };
}

module.exports = { createResponsesProvider };
