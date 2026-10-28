function createResponsesProvider({ apiKey, fetchImpl = fetch, endpoint = 'https://api.openai.com/v1/responses', timeoutMs = 18000 } = {}) {
  const generate = async ({ input, format, model, instructions = '', maxOutputTokens = 900, signal } = {}) => {
      if (!apiKey) throw new Error('provider request failed');
      const controller = new AbortController();
      const timer = setTimeout(() => controller.abort(), timeoutMs);
      const abort = () => controller.abort(signal.reason);
      signal?.addEventListener('abort', abort, { once: true });
      try {
        const response = await fetchImpl(endpoint, {
          method: 'POST',
          headers: { authorization: `Bearer ${apiKey}`, 'content-type': 'application/json' },
          body: JSON.stringify({ model, instructions, input: [{ role: 'user', content: JSON.stringify(input) }], text: { format }, max_output_tokens: Math.min(1200, Math.max(100, maxOutputTokens)), store: false }),
          signal: controller.signal,
        });
        if (!response.ok) throw new Error(`provider request failed (${response.status})`);
        const data = await response.json();
        if (data.status !== 'completed') throw new Error('provider response incomplete');
        if (typeof data.output_text !== 'string' || !data.output_text.trim()) {
          const text = data.output?.flatMap(item => item.content ?? []).find(item => item.type === 'output_text')?.text;
          if (typeof text !== 'string' || !text.trim()) throw new Error('provider response incomplete');
          return JSON.parse(text);
        }
        return JSON.parse(data.output_text);
      } catch (error) {
        if (error?.name === 'AbortError') throw new Error('provider request timed out');
        if (error instanceof SyntaxError) throw new Error('provider returned malformed structured output');
        throw error;
      } finally {
        clearTimeout(timer);
        signal?.removeEventListener('abort', abort);
      }
  };
  const summarySchema = require('../../schemas/ai-memory-summary.schema.json');
  return {
    generate,
    summarize({ input, model = 'gpt-6-luna', signal } = {}) {
      const schema = { type: summarySchema.type, additionalProperties: summarySchema.additionalProperties, required: summarySchema.required, properties: summarySchema.properties };
      return generate({ input, model, signal, maxOutputTokens: 260, instructions: require('../prompts/summary-rules.js'), format: { type: 'json_schema', name: 'ai_scene_memory_summary_v1', strict: true, schema } });
    },
  };
}

exports.createResponsesProvider = createResponsesProvider;
