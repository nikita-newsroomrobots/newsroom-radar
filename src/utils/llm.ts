import OpenAI from 'openai';

export function createOpenAIClient(): OpenAI | null {
  const apiKey = process.env.OPENAI_API_KEY;
  if (!apiKey || apiKey === 'your-api-key-here') {
    return null;
  }
  return new OpenAI({ apiKey, timeout: 90_000 });
}

export async function generateInsights(
  client: OpenAI,
  systemPrompt: string,
  metricsJson: string,
): Promise<string> {
  const response = await client.chat.completions.create({
    model: 'gpt-4.1',
    messages: [
      { role: 'system', content: systemPrompt },
      {
        role: 'user',
        content: `Here is the audience metrics summary. Analyze it and produce the briefing.\n\n${metricsJson}`,
      },
    ],
    temperature: 0.7,
    response_format: { type: 'json_object' },
  });

  return response.choices[0]?.message?.content || '{}';
}
