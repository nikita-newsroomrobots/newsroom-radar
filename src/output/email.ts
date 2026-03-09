import { writeFile } from 'fs/promises';
import { InsightData } from '../analysis/insights.js';
import { MetricsSummary } from '../analysis/metrics.js';

const CATEGORY_COLORS: Record<string, string> = {
  'Engagement Shifts': '#0891b2',
  'Coverage Opportunities': '#16a34a',
  'Audience Risks': '#dc2626',
  'Revenue Signals': '#ca8a04',
  'Geographic Intelligence': '#9333ea',
};

const CONFIDENCE_COLORS: Record<string, { bg: string; text: string }> = {
  high: { bg: '#16a34a', text: '#ffffff' },
  medium: { bg: '#ca8a04', text: '#ffffff' },
  low: { bg: '#dc2626', text: '#ffffff' },
};

function buildDataSummaryHtml(metrics: MetricsSummary): string {
  const ec = metrics.engagementChanges;
  const df = metrics.donorFunnel;

  // Engagement histogram
  const histogramRows = [1, 2, 3, 4, 5].map(i => {
    const curr = metrics.engagementDistribution.current[String(i)] || 0;
    const prev = metrics.engagementDistribution.previous[String(i)] || 0;
    const delta = curr - prev;
    const deltaColor = delta > 0 ? '#16a34a' : delta < 0 ? '#dc2626' : '#6b7280';
    const deltaStr = delta > 0 ? `+${delta}` : `${delta}`;
    const barWidth = Math.max(2, Math.round((curr / metrics.overview.totalPersons) * 200));
    return `<tr>
      <td style="padding:4px 8px;font-size:13px;color:#374151;">Score ${i}</td>
      <td style="padding:4px 8px;"><div style="background:#2563eb;height:14px;width:${barWidth}px;border-radius:3px;"></div></td>
      <td style="padding:4px 8px;font-size:13px;color:#374151;">${curr}</td>
      <td style="padding:4px 8px;font-size:13px;color:${deltaColor};">${deltaStr} vs prior</td>
    </tr>`;
  }).join('');

  // Top content
  const topContentRows = metrics.contentPerformance.slice(0, 5).map(c =>
    `<tr>
      <td style="padding:4px 8px;font-size:13px;color:#374151;">${c.title}</td>
      <td style="padding:4px 8px;font-size:13px;color:#374151;text-align:center;">${c.totalViews}</td>
      <td style="padding:4px 8px;font-size:13px;color:#374151;text-align:center;">${c.avgTimeMinutes}m</td>
      <td style="padding:4px 8px;font-size:13px;color:#374151;text-align:center;">${Math.round(c.avgCompletionRate * 100)}%</td>
    </tr>`
  ).join('');

  // Geographic
  const geoRows = metrics.geographicBreakdown.slice(0, 6).map(g => {
    const matchColor = g.contentMatchScore < 60 ? '#dc2626' : '#16a34a';
    return `<tr>
      <td style="padding:4px 8px;font-size:13px;color:#374151;">ZIP ${g.postalCode}</td>
      <td style="padding:4px 8px;font-size:13px;color:#374151;text-align:center;">${g.readerCount}</td>
      <td style="padding:4px 8px;font-size:13px;color:#374151;text-align:center;">${g.avgEngagement}</td>
      <td style="padding:4px 8px;font-size:13px;color:#374151;text-align:center;">${g.donors}</td>
      <td style="padding:4px 8px;font-size:13px;color:${matchColor};text-align:center;">${g.contentMatchScore}%</td>
    </tr>`;
  }).join('');

  // Churn clusters
  const churnHtml = metrics.cohortAnalysis.churnClusters.slice(0, 3).map(c =>
    `<div style="background:#fef2f2;border-radius:6px;padding:10px;margin:6px 0;font-size:13px;">
      <strong>ZIP ${c.postalCode}:</strong> ${c.count} readers declined (avg ${c.avgPreviousScore} → ${c.avgCurrentScore})
      <br/><span style="color:#6b7280;">Shared interests: ${c.sharedTopics.join(', ')}</span>
    </div>`
  ).join('');

  // Jumper content
  const jumperHtml = metrics.cohortAnalysis.engagementJumpersByContent.slice(0, 5).map(j => {
    const donorNote = j.newDonorCount > 0 ? ` <span style="color:#ca8a04;">(${j.newDonorCount} became donors)</span>` : '';
    return `<div style="font-size:13px;padding:3px 0;"><strong>${j.contentTopic}:</strong> ${j.jumperCount} readers jumped${donorNote}</div>`;
  }).join('');

  // Survey themes
  const surveyHtml = metrics.surveyHighlights.byQuestion.map(q => {
    if (q.topThemes.length === 0) return '';
    const themes = q.topThemes.slice(0, 4).map(t => `${t.theme} (${t.count})`).join(', ');
    return `<div style="font-size:13px;padding:4px 0;"><em>"${q.question}"</em><br/><span style="color:#6b7280;">Top themes: ${themes}</span></div>`;
  }).filter(Boolean).join('');

  return `
    <div style="margin:24px 0;padding:20px;background:#f8fafc;border-radius:8px;border:1px solid #e2e8f0;">
      <h2 style="color:#1e3a5f;font-size:18px;margin:0 0 16px 0;">Computed Data Summary</h2>
      <p style="color:#6b7280;font-size:12px;margin:0 0 16px 0;">
        Period: ${metrics.overview.engagementPeriod} &bull;
        Sources: ${metrics.overview.dataSources.join(', ')} &bull;
        ${metrics.overview.totalActions} total interactions analyzed
      </p>

      <h3 style="color:#374151;font-size:14px;margin:16px 0 8px 0;">Engagement Distribution</h3>
      <table style="width:100%;border-collapse:collapse;">${histogramRows}</table>

      <div style="background:#f0f9ff;border-radius:6px;padding:12px;margin:12px 0;">
        <span style="color:#16a34a;font-weight:700;">↑ ${ec.jumpedCount}</span> jumped &bull;
        <span style="color:#dc2626;font-weight:700;">↓ ${ec.declinedCount}</span> declined &bull;
        <span style="color:#6b7280;">${ec.stableCount} stable</span>
      </div>

      <h3 style="color:#374151;font-size:14px;margin:16px 0 8px 0;">Content That Drove Engagement Jumps</h3>
      ${jumperHtml}

      <h3 style="color:#374151;font-size:14px;margin:16px 0 8px 0;">Churn Clusters</h3>
      ${churnHtml || '<p style="font-size:13px;color:#6b7280;">No significant geographic churn clusters detected.</p>'}

      <h3 style="color:#374151;font-size:14px;margin:16px 0 8px 0;">Top Content</h3>
      <table style="width:100%;border-collapse:collapse;">
        <tr style="border-bottom:1px solid #e5e7eb;">
          <th style="padding:4px 8px;font-size:12px;color:#6b7280;text-align:left;">Article</th>
          <th style="padding:4px 8px;font-size:12px;color:#6b7280;text-align:center;">Views</th>
          <th style="padding:4px 8px;font-size:12px;color:#6b7280;text-align:center;">Avg Time</th>
          <th style="padding:4px 8px;font-size:12px;color:#6b7280;text-align:center;">Completion</th>
        </tr>
        ${topContentRows}
      </table>

      <h3 style="color:#374151;font-size:14px;margin:16px 0 8px 0;">Geographic Breakdown</h3>
      <table style="width:100%;border-collapse:collapse;">
        <tr style="border-bottom:1px solid #e5e7eb;">
          <th style="padding:4px 8px;font-size:12px;color:#6b7280;text-align:left;">Area</th>
          <th style="padding:4px 8px;font-size:12px;color:#6b7280;text-align:center;">Readers</th>
          <th style="padding:4px 8px;font-size:12px;color:#6b7280;text-align:center;">Avg Eng</th>
          <th style="padding:4px 8px;font-size:12px;color:#6b7280;text-align:center;">Donors</th>
          <th style="padding:4px 8px;font-size:12px;color:#6b7280;text-align:center;">Coverage</th>
        </tr>
        ${geoRows}
      </table>

      <h3 style="color:#374151;font-size:14px;margin:16px 0 8px 0;">Donor Pipeline</h3>
      <div style="font-size:13px;">
        ${df.nonDonors} non-donors &bull; ${df.minorDonors} minor donors &bull; ${df.majorDonors} major donors<br/>
        <span style="color:#16a34a;font-weight:700;">${df.newDonors} new donors</span> this period &bull;
        <span style="color:#ca8a04;font-weight:700;">${df.highEngagementNonDonors} high-engagement non-donors</span> (conversion pipeline)
      </div>

      ${metrics.surveyHighlights.totalResponses > 0 ? `
        <h3 style="color:#374151;font-size:14px;margin:16px 0 8px 0;">Survey Highlights (${metrics.surveyHighlights.totalResponses} responses)</h3>
        ${surveyHtml}
      ` : ''}
    </div>`;
}

export function generateEmailHTML(insights: InsightData, metrics?: MetricsSummary): string {
  const m = insights.topLineMetrics;

  const dataSummaryHtml = metrics ? buildDataSummaryHtml(metrics) : '';

  const sectionsHtml = insights.sections.map(section => {
    const color = CATEGORY_COLORS[section.category] || '#6b7280';
    const insightsHtml = section.insights.map(insight => {
      const conf = CONFIDENCE_COLORS[insight.confidence] || CONFIDENCE_COLORS.medium;
      const dataPointsHtml = insight.dataPoints.length > 0
        ? `<p style="font-size:13px;color:#9ca3af;margin:8px 0 0 0;">Data: ${insight.dataPoints.join(' &bull; ')}</p>`
        : '';
      return `
        <div style="background:#f9fafb;border-radius:8px;padding:16px;margin:12px 0;">
          <div style="margin-bottom:8px;">
            <span style="display:inline-block;background:${conf.bg};color:${conf.text};font-size:11px;font-weight:700;padding:2px 8px;border-radius:4px;text-transform:uppercase;margin-right:8px;">${insight.confidence}</span>
            <strong style="font-size:16px;color:#111827;">${insight.headline}</strong>
          </div>
          <p style="color:#374151;font-size:14px;line-height:1.6;margin:8px 0;">${insight.detail}</p>
          <p style="color:#111827;font-size:14px;margin:8px 0;"><strong>&rarr;</strong> <em>${insight.action}</em></p>
          ${dataPointsHtml}
        </div>`;
    }).join('');

    return `
      <div style="margin:32px 0;">
        <h2 style="color:${color};font-size:18px;border-bottom:2px solid ${color};padding-bottom:8px;margin-bottom:16px;">
          &#9632; ${section.category}
        </h2>
        ${insightsHtml}
      </div>`;
  }).join('');

  return `<!DOCTYPE html>
<html>
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>Newsroom Radar Briefing — ${insights.briefingDate}</title>
</head>
<body style="margin:0;padding:0;background:#f3f4f6;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,sans-serif;">
  <div style="max-width:700px;margin:0 auto;background:#ffffff;border-radius:12px;overflow:hidden;margin-top:24px;margin-bottom:24px;box-shadow:0 1px 3px rgba(0,0,0,0.1);">

    <div style="background:linear-gradient(135deg,#1e3a5f,#2563eb);padding:32px;text-align:center;">
      <h1 style="color:#ffffff;font-size:24px;margin:0;">Newsroom Radar</h1>
      <p style="color:#93c5fd;font-size:14px;margin:8px 0 0 0;">Audience Intelligence Briefing &bull; ${insights.briefingDate}</p>
    </div>

    <div style="padding:24px;">
      <div style="text-align:center;background:#f0f9ff;border-radius:8px;padding:16px;margin-bottom:24px;">
        <div style="display:inline-block;text-align:center;padding:0 16px;">
          <div style="font-size:28px;font-weight:700;color:#1e3a5f;">${m.totalReaders}</div>
          <div style="font-size:12px;color:#6b7280;">Total Readers</div>
        </div>
        <div style="display:inline-block;text-align:center;padding:0 16px;">
          <div style="font-size:28px;font-weight:700;color:#16a34a;">${m.highEngagement}</div>
          <div style="font-size:12px;color:#6b7280;">Highly Engaged</div>
        </div>
        <div style="display:inline-block;text-align:center;padding:0 16px;">
          <div style="font-size:28px;font-weight:700;color:#dc2626;">${m.atRiskReaders}</div>
          <div style="font-size:12px;color:#6b7280;">At Risk</div>
        </div>
        <div style="display:inline-block;text-align:center;padding:0 16px;">
          <div style="font-size:28px;font-weight:700;color:#ca8a04;">${m.totalDonors}</div>
          <div style="font-size:12px;color:#6b7280;">Donors</div>
        </div>
      </div>

      <p style="color:#6b7280;font-size:13px;text-align:center;">Top topics: ${m.topTopics.join(' &bull; ')}</p>
      <p style="color:#6b7280;font-size:13px;text-align:center;margin-bottom:8px;">${insights.totalAudienceAnalyzed} audience members analyzed</p>

      ${dataSummaryHtml}

      <div style="margin:24px 0 8px 0;padding-top:16px;border-top:2px solid #1e3a5f;">
        <h2 style="color:#1e3a5f;font-size:18px;margin:0;">AI-Synthesized Insights</h2>
        <p style="color:#6b7280;font-size:13px;margin:4px 0 0 0;">The following insights were generated by analyzing the metrics above.</p>
      </div>

      ${sectionsHtml}
    </div>

    <div style="background:#f9fafb;padding:16px;text-align:center;border-top:1px solid #e5e7eb;">
      <p style="color:#9ca3af;font-size:12px;margin:0;">Generated by Newsroom Radar — AI-powered audience intelligence for local newsrooms</p>
    </div>
  </div>
</body>
</html>`;
}

export async function saveEmailReport(insights: InsightData, outputPath: string, metrics?: MetricsSummary): Promise<void> {
  const html = generateEmailHTML(insights, metrics);
  await writeFile(outputPath, html, 'utf-8');
}
