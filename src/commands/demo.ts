import { Command } from 'commander';
import ora from 'ora';
import { fileURLToPath } from 'url';
import { dirname, join } from 'path';
import { loadAudienceData } from '../analysis/loader.js';
import { computeMetrics } from '../analysis/metrics.js';
import { generateInsightReport } from '../analysis/insights.js';
import { renderTerminalReport } from '../output/terminal.js';
import { saveEmailReport } from '../output/email.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

export function registerDemoCommand(program: Command): void {
  program
    .command('demo')
    .description('Run analysis on built-in sample data (no setup required)')
    .option('-f, --output-format <format>', 'Output format: terminal, email, or both', 'terminal')
    .option('-o, --output-path <path>', 'Path for email HTML output', 'briefing.html')
    .action(async (options: { outputFormat: string; outputPath: string }) => {
      console.log('\n  Newsroom Radar — Demo Mode\n');

      const samplePath = join(__dirname, '..', '..', 'sample-data', 'audience-data.jsonld');

      const spinner = ora('Loading sample audience data...').start();

      try {
        const data = await loadAudienceData(samplePath);
        spinner.succeed(`Loaded ${data.persons.length} persons, ${data.objects.length} objects, ${data.actions.length} actions`);

        const metricsSpinner = ora('Computing audience metrics...').start();
        const metrics = computeMetrics(data);
        metricsSpinner.succeed('Metrics computed');

        const hasKey = !!process.env.OPENAI_API_KEY && process.env.OPENAI_API_KEY !== 'your-api-key-here';
        const insightSpinner = ora(
          hasKey ? 'Generating AI insights via OpenAI...' : 'Loading pre-generated insights (set OPENAI_API_KEY for live AI analysis)...'
        ).start();

        const insights = await generateInsightReport(metrics);
        insightSpinner.succeed(hasKey ? 'AI insights generated' : 'Pre-generated insights loaded');

        if (options.outputFormat === 'terminal' || options.outputFormat === 'both') {
          renderTerminalReport(insights);
        }

        if (options.outputFormat === 'email' || options.outputFormat === 'both') {
          await saveEmailReport(insights, options.outputPath);
          console.log(`\nEmail briefing saved to: ${options.outputPath}`);
        }
      } catch (error) {
        spinner.fail('Demo failed');
        const msg = error instanceof Error ? error.message : String(error);
        console.error(`Error: ${msg}`);
        process.exit(1);
      }
    });
}
