const fetch = require('node-fetch');

/**
 * Calls whichever AI provider is configured in .env and returns
 * { text, provider, model }. Throws on failure.
 *
 * history: array of { role: 'user'|'assistant', content: string }
 */
async function callAssistant({ systemPrompt, history }) {
  const provider = (process.env.AI_PROVIDER || 'anthropic').toLowerCase();

  if (provider === 'anthropic') {
    const apiKey = process.env.ANTHROPIC_API_KEY;
    if (!apiKey) throw new Error('ANTHROPIC_API_KEY is not set in .env');
    const model = process.env.ANTHROPIC_MODEL || 'claude-sonnet-4-6';

    const resp = await fetch('https://api.anthropic.com/v1/messages', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'x-api-key': apiKey,
        'anthropic-version': '2023-06-01',
      },
      body: JSON.stringify({
        model,
        max_tokens: 800,
        system: systemPrompt,
        messages: history.map((m) => ({ role: m.role, content: m.content })),
      }),
    });
    if (!resp.ok) {
      const body = await resp.text();
      throw new Error(`Anthropic API error ${resp.status}: ${body}`);
    }
    const data = await resp.json();
    const text = (data.content || [])
      .filter((b) => b.type === 'text')
      .map((b) => b.text)
      .join('\n');
    return { text, provider: 'anthropic', model };
  }

  if (provider === 'azure') {
    // Claude in Microsoft Foundry is exposed through Anthropic's own Messages API
    // shape, just hosted at an Azure endpoint with Azure-style auth. Paste the
    // exact "Target URI" shown on your Foundry model deployment page into
    // AZURE_AI_ENDPOINT (e.g. https://<resource>.services.ai.azure.com/anthropic/v1/messages) -
    // do not append query params yourself, AZURE_AI_API_VERSION is added below if set.
    const endpoint = process.env.AZURE_AI_ENDPOINT;
    const apiKey = process.env.AZURE_AI_API_KEY;
    const model = process.env.AZURE_AI_MODEL; // your Foundry deployment name
    const apiVersion = process.env.AZURE_AI_API_VERSION; // optional, only if your resource requires it

    if (!endpoint) throw new Error('AZURE_AI_ENDPOINT is not set in .env');
    if (!apiKey) throw new Error('AZURE_AI_API_KEY is not set in .env');
    if (!model) throw new Error('AZURE_AI_MODEL is not set in .env');

    const url = apiVersion
      ? `${endpoint}${endpoint.includes('?') ? '&' : '?'}api-version=${encodeURIComponent(apiVersion)}`
      : endpoint;

    const resp = await fetch(url, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        // Azure resources typically authenticate with this header instead of x-api-key.
        'api-key': apiKey,
        'anthropic-version': '2023-06-01',
      },
      body: JSON.stringify({
        model,
        max_tokens: 800,
        system: systemPrompt,
        messages: history.map((m) => ({ role: m.role, content: m.content })),
      }),
    });
    if (!resp.ok) {
      const body = await resp.text();
      throw new Error(`Azure Foundry API error ${resp.status}: ${body}`);
    }
    const data = await resp.json();
    const text = (data.content || [])
      .filter((b) => b.type === 'text')
      .map((b) => b.text)
      .join('\n');
    return { text, provider: 'azure', model };
  }

  if (provider === 'azure-openai') {
    // Azure OpenAI / GPT models via Foundry's newer unified "v1" endpoint
    // (https://<resource>.services.ai.azure.com/openai/v1), which mirrors
    // OpenAI's own API shape directly: Bearer auth, no api-version query
    // param, no /deployments/<name>/ path segment - the model name just
    // goes in the request body, same as calling OpenAI directly.
    // NOT the same as AI_PROVIDER=azure (Claude on Foundry).
    const endpoint = process.env.AZURE_OPENAI_ENDPOINT; // e.g. https://<resource>.services.ai.azure.com/openai/v1
    const apiKey = process.env.AZURE_OPENAI_API_KEY;
    const deployment = process.env.AZURE_OPENAI_DEPLOYMENT; // deployment/model name, e.g. gpt-5.4-nano

    if (!endpoint) throw new Error('AZURE_OPENAI_ENDPOINT is not set in .env');
    if (!apiKey) throw new Error('AZURE_OPENAI_API_KEY is not set in .env');
    if (!deployment) throw new Error('AZURE_OPENAI_DEPLOYMENT is not set in .env');

    const baseUrl = endpoint.replace(/\/+$/, '');
    const url = `${baseUrl}/chat/completions`;

    const resp = await fetch(url, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${apiKey}`,
      },
      body: JSON.stringify({
        model: deployment,
        max_completion_tokens: 800,
        messages: [{ role: 'system', content: systemPrompt }, ...history],
      }),
    });
    if (!resp.ok) {
      const body = await resp.text();
      throw new Error(`Azure OpenAI API error ${resp.status}: ${body}`);
    }
    const data = await resp.json();
    const text = data.choices?.[0]?.message?.content || '';
    return { text, provider: 'azure-openai', model: deployment };
  }

  if (provider === 'openai') {
    const apiKey = process.env.OPENAI_API_KEY;
    if (!apiKey) throw new Error('OPENAI_API_KEY is not set in .env');
    const model = process.env.OPENAI_MODEL || 'gpt-4o-mini';

    const resp = await fetch('https://api.openai.com/v1/chat/completions', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${apiKey}`,
      },
      body: JSON.stringify({
        model,
        max_completion_tokens: 800,
        messages: [{ role: 'system', content: systemPrompt }, ...history],
      }),
    });
    if (!resp.ok) {
      const body = await resp.text();
      throw new Error(`OpenAI API error ${resp.status}: ${body}`);
    }
    const data = await resp.json();
    const text = data.choices?.[0]?.message?.content || '';
    return { text, provider: 'openai', model };
  }

  throw new Error(`Unknown AI_PROVIDER "${provider}". Use "anthropic", "azure", "azure-openai", or "openai".`);
}

module.exports = { callAssistant };
