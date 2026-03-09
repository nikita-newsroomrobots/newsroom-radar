import { Command } from 'commander';
import ora from 'ora';
import { loadAudienceData } from '../analysis/loader.js';
import { computeMetrics } from '../analysis/metrics.js';
import { generateInsightReport } from '../analysis/insights.js';
import { renderTerminalReport } from '../output/terminal.js';
import { saveEmailReport } from '../output/email.js';

export function registerAnalyzeCommand(program: Command): void {
  program
    .command('analyze')
    .description('Analyze JSON-LD audience data and generate an intelligence briefing')
    .requiredOption('-i, --input <path>', 'Path to JSON-LD audience data file')
    .option('-f, --output-format <format>', 'Output format: terminal, email, or both', 'terminal')
    .option('-o, --output-path <path>', 'Path for email HTML output', 'briefing.html')
    .action(async (options: { input: string; outputFormat: string; outputPath: string }) => {
      const spinner = ora('Loading audience data...').start();

      try {
        const data = await loadAudienceData(options.input);
        spinner.text = `Loaded ${data.persons.length} persons, ${data.objects.length} objects, ${data.actions.length} actions`;
        spinner.succeed();

        const metricsSpinner = ora('Computing audience metrics...').start();
        const metrics = computeMetrics(data);
        metricsSpinner.succeed('Metrics computed');

        const insightSpinner = ora('Generating insights...').start();
        const insights = await generateInsightReport(metrics);
        insightSpinner.succeed('Insights generated');

        if (options.outputFormat === 'terminal' || options.outputFormat === 'both') {
          renderTerminalReport(insights, metrics);
        }

        if (options.outputFormat === 'email' || options.outputFormat === 'both') {
          await saveEmailReport(insights, options.outputPath, metrics);
          console.log(`\nEmail briefing saved to: ${options.outputPath}`);
        }
      } catch (error) {
        spinner.fail('Analysis failed');
        const msg = error instanceof Error ? error.message : String(error);
        console.error(`Error: ${msg}`);
        process.exit(1);
      }
    });
}
