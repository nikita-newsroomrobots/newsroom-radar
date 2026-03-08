import { readFile } from 'fs/promises';
import { fileURLToPath } from 'url';
import { dirname, join } from 'path';
import { MetricsSummary } from './metrics.js';
import { createOpenAIClient, generateInsights } from '../utils/llm.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

export interface InsightData {
  briefingDate: string;
  totalAudienceAnalyzed: number;
  sections: Array<{
    category: string;
    insights: Array<{
      headline: string;
      detail: string;
      action: string;
      confidence: 'high' | 'medium' | 'low';
      dataPoints: string[];
    }>;
  }>;
  topLineMetrics: {
    totalReaders: number;
    highEngagement: number;
    atRiskReaders: number;
    totalDonors: number;
    topTopics: string[];
  };
}

export async function generateInsightReport(metrics: MetricsSummary): Promise<InsightData> {
  const client = createOpenAIClient();

  if (client) {
    try {
      const promptPath = join(__dirname, '..', '..', 'static', 'insight-prompt.txt');
      const systemPrompt = await readFile(promptPath, 'utf-8');
      const metricsJson = JSON.stringify(metrics, null, 2);
      const rawResponse = await generateInsights(client, systemPrompt, metricsJson);
      return JSON.parse(rawResponse) as InsightData;
    } catch (error) {
      const msg = error instanceof Error ? error.message : String(error);
      console.error(`\nOpenAI API call failed: ${msg}`);
      console.error('Falling back to pre-generated insights...\n');
    }
  }

  return loadFallbackInsights();
}

export async function loadFallbackInsights(): Promise<InsightData> {
  const fallbackPath = join(__dirname, '..', '..', 'sample-data', 'sample-insights.json');
  const raw = await readFile(fallbackPath, 'utf-8');
  return JSON.parse(raw) as InsightData;
}
