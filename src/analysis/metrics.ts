import { AudienceData, PersonRecord } from './loader.js';

export interface MetricsSummary {
  overview: {
    totalPersons: number;
    totalObjects: number;
    totalActions: number;
    dataSources: string[];
    engagementPeriod: string;
  };
  engagementDistribution: {
    current: Record<string, number>;
    previous: Record<string, number>;
    high: number;
    medium: number;
    low: number;
  };
  engagementChanges: {
    jumped: Array<{
      userID: string;
      name: string;
      from: number;
      to: number;
      topContentRead: string[];
      becameDonor: boolean;
      zip: string;
    }>;
    declined: Array<{
      userID: string;
      name: string;
      from: number;
      to: number;
      previousTopics: string[];
      zip: string;
    }>;
    jumpedCount: number;
    declinedCount: number;
    stableCount: number;
  };
  geographicBreakdown: Array<{
    postalCode: string;
    locality: string;
    readerCount: number;
    avgEngagement: number;
    donors: number;
    topTopics: string[];
    contentMatchScore: number;
  }>;
  topicInterestMap: Array<{
    topic: string;
    interestedReaders: number;
    avgEngagement: number;
    recentArticleCount: number;
    hasRecentContent: boolean;
  }>;
  donorFunnel: {
    nonDonors: number;
    minorDonors: number;
    majorDonors: number;
    newDonors: number;
    highEngagementNonDonors: number;
    contentBeforeDonation: Array<{
      articleTitle: string;
      articleTopics: string[];
      donorCount: number;
    }>;
  };
  contentPerformance: Array<{
    objectID: string;
    title: string;
    type: string;
    topics: string[];
    totalViews: number;
    avgTimeMinutes: number;
    avgCompletionRate: number;
  }>;
  newsletterPerformance: Array<{
    objectID: string;
    title: string;
    topics: string[];
    opens: number;
    publishedDate: string;
  }>;
  surveyHighlights: {
    totalResponses: number;
    byQuestion: Array<{
      question: string;
      answers: string[];
      topThemes: Array<{ theme: string; count: number }>;
    }>;
  };
  cohortAnalysis: {
    churnClusters: Array<{
      postalCode: string;
      count: number;
      sharedTopics: string[];
      lastContentEngaged: string[];
      avgPreviousScore: number;
      avgCurrentScore: number;
    }>;
    engagementJumpersByContent: Array<{
      contentTopic: string;
      jumperCount: number;
      newDonorCount: number;
      exampleReaders: string[];
    }>;
  };
}

function parseISODuration(duration: string): number {
  const match = duration.match(/PT(?:(\d+)H)?(?:(\d+)M)?(?:(\d+)S)?/);
  if (!match) return 0;
  return parseInt(match[1] || '0') * 60 + parseInt(match[2] || '0') + parseInt(match[3] || '0') / 60;
}

function personName(p: PersonRecord): string {
  return `${p.givenName || ''} ${p.familyName || ''}`.trim() || p.userID;
}

export function computeMetrics(data: AudienceData): MetricsSummary {
  const { persons, objects, actions, personMap, objectMap, personActions } = data;

  const dataSources = [...new Set(persons.map(p => p.dataSource))];
  const engagementPeriods = persons.map(p => p.engagementPeriod).filter(Boolean);
  const engagementPeriod = engagementPeriods.length > 0
    ? [...new Set(engagementPeriods)].join(', ') + ' → current'
    : 'current snapshot';

  // --- Engagement distribution ---
  const current: Record<string, number> = { '1': 0, '2': 0, '3': 0, '4': 0, '5': 0 };
  const previous: Record<string, number> = { '1': 0, '2': 0, '3': 0, '4': 0, '5': 0 };
  let high = 0, medium = 0, low = 0;

  for (const p of persons) {
    const score = p.engagementScore || 1;
    const prevScore = p.previousEngagementScore || score;
    current[String(Math.min(5, Math.max(1, score)))]++;
    previous[String(Math.min(5, Math.max(1, prevScore)))]++;
    if (score >= 4) high++;
    else if (score === 3) medium++;
    else low++;
  }

  // --- Engagement changes (temporal) ---
  const jumped: MetricsSummary['engagementChanges']['jumped'] = [];
  const declined: MetricsSummary['engagementChanges']['declined'] = [];
  let stableCount = 0;

  for (const p of persons) {
    const curr = p.engagementScore || 1;
    const prev = p.previousEngagementScore ?? curr;
    const delta = curr - prev;

    if (delta >= 2 || (prev <= 2 && curr >= 4)) {
      const pActions = personActions.get(p.userID) || [];
      const readArticles = pActions
        .filter(a => a.actionType === 'pageView')
        .map(a => objectMap.get(a.object)?.title || '')
        .filter(Boolean);
      const donated = pActions.some(a => a.actionType === 'donation');
      const wasDonor = p.behavior?.previousDonorStatus !== 'non_donor' && p.behavior?.previousDonorStatus != null;

      jumped.push({
        userID: p.userID,
        name: personName(p),
        from: prev,
        to: curr,
        topContentRead: [...new Set(readArticles)].slice(0, 5),
        becameDonor: donated && !wasDonor,
        zip: p.location?.postalCode || 'unknown',
      });
    } else if (delta <= -2 || (prev >= 4 && curr <= 2)) {
      declined.push({
        userID: p.userID,
        name: personName(p),
        from: prev,
        to: curr,
        previousTopics: p.interests?.topics || [],
        zip: p.location?.postalCode || 'unknown',
      });
    } else {
      stableCount++;
    }
  }

  // --- Geographic breakdown ---
  const geoMap = new Map<string, { persons: PersonRecord[]; locality: string }>();
  for (const p of persons) {
    const zip = p.location?.postalCode || 'unknown';
    const existing = geoMap.get(zip) || { persons: [], locality: p.location?.addressLocality || '' };
    existing.persons.push(p);
    geoMap.set(zip, existing);
  }

  const recentCutoff = new Date('2025-10-01').getTime();
  const topicArticleCounts = new Map<string, number>();
  for (const o of objects) {
    if (o.published && new Date(o.published).getTime() > recentCutoff && o.type === 'article') {
      for (const s of o.subject || []) {
        topicArticleCounts.set(s, (topicArticleCounts.get(s) || 0) + 1);
      }
    }
  }

  const geographicBreakdown = [...geoMap.entries()].map(([postalCode, { persons: geoPersons, locality }]) => {
    const avgEngagement = geoPersons.reduce((sum, p) => sum + (p.engagementScore || 1), 0) / geoPersons.length;
    const donors = geoPersons.filter(p => p.behavior?.donorStatus && p.behavior.donorStatus !== 'non_donor').length;
    const topicCounts = new Map<string, number>();
    for (const p of geoPersons) {
      for (const t of p.interests?.topics || []) {
        topicCounts.set(t, (topicCounts.get(t) || 0) + 1);
      }
    }
    const topTopics = [...topicCounts.entries()]
      .sort((a, b) => b[1] - a[1])
      .slice(0, 5)
      .map(([t]) => t);

    const coveredTopics = topTopics.filter(t => (topicArticleCounts.get(t) || 0) > 0).length;
    const contentMatchScore = topTopics.length > 0 ? Math.round((coveredTopics / topTopics.length) * 100) : 0;

    return {
      postalCode, locality,
      readerCount: geoPersons.length,
      avgEngagement: Math.round(avgEngagement * 10) / 10,
      donors,
      topTopics,
      contentMatchScore,
    };
  }).sort((a, b) => b.readerCount - a.readerCount);

  // --- Topic interest map ---
  const topicMap = new Map<string, { readers: Set<string>; totalEngagement: number }>();
  for (const p of persons) {
    for (const t of p.interests?.topics || []) {
      const existing = topicMap.get(t) || { readers: new Set(), totalEngagement: 0 };
      existing.readers.add(p.userID);
      existing.totalEngagement += p.engagementScore || 1;
      topicMap.set(t, existing);
    }
  }

  const topicInterestMap = [...topicMap.entries()].map(([topic, { readers, totalEngagement }]) => ({
    topic,
    interestedReaders: readers.size,
    avgEngagement: Math.round((totalEngagement / readers.size) * 10) / 10,
    recentArticleCount: topicArticleCounts.get(topic) || 0,
    hasRecentContent: (topicArticleCounts.get(topic) || 0) > 0,
  })).sort((a, b) => b.interestedReaders - a.interestedReaders);

  // --- Donor funnel ---
  let nonDonors = 0, minorDonors = 0, majorDonors = 0, newDonors = 0, highEngagementNonDonors = 0;

  for (const p of persons) {
    const status = p.behavior?.donorStatus || 'non_donor';
    const prevStatus = p.behavior?.previousDonorStatus || 'non_donor';
    if (status === 'non_donor') {
      nonDonors++;
      if ((p.engagementScore || 1) >= 4) highEngagementNonDonors++;
    } else if (status === 'minor_donor') {
      minorDonors++;
      if (prevStatus === 'non_donor') newDonors++;
    } else if (status === 'major_donor') {
      majorDonors++;
      if (prevStatus === 'non_donor') newDonors++;
    }
  }

  const newDonorPersons = persons.filter(p => {
    const status = p.behavior?.donorStatus || 'non_donor';
    const prevStatus = p.behavior?.previousDonorStatus || 'non_donor';
    return status !== 'non_donor' && prevStatus === 'non_donor';
  });
  const contentDonorMap = new Map<string, { title: string; topics: string[]; count: number }>();
  for (const p of newDonorPersons) {
    const pActions = personActions.get(p.userID) || [];
    for (const a of pActions) {
      if (a.actionType === 'pageView') {
        const obj = objectMap.get(a.object);
        if (obj) {
          const existing = contentDonorMap.get(a.object) || { title: obj.title || a.object, topics: obj.subject || [], count: 0 };
          existing.count++;
          contentDonorMap.set(a.object, existing);
        }
      }
    }
  }
  const contentBeforeDonation = [...contentDonorMap.values()]
    .map(v => ({ articleTitle: v.title, articleTopics: v.topics, donorCount: v.count }))
    .sort((a, b) => b.donorCount - a.donorCount)
    .slice(0, 10);

  // --- Content performance ---
  const contentActions = actions.filter(a => a.actionType === 'pageView');
  const contentStatsMap = new Map<string, { views: number; totalTime: number; totalCompletion: number }>();
  for (const ca of contentActions) {
    const existing = contentStatsMap.get(ca.object) || { views: 0, totalTime: 0, totalCompletion: 0 };
    existing.views++;
    if (ca.timeSpent) existing.totalTime += parseISODuration(ca.timeSpent);
    if (ca.completionRate != null) existing.totalCompletion += ca.completionRate;
    contentStatsMap.set(ca.object, existing);
  }

  const contentPerformance = [...contentStatsMap.entries()]
    .map(([objectID, stats]) => {
      const obj = objectMap.get(objectID);
      return {
        objectID,
        title: obj?.title || objectID,
        type: obj?.type || 'unknown',
        topics: obj?.subject || [],
        totalViews: stats.views,
        avgTimeMinutes: stats.views > 0 ? Math.round((stats.totalTime / stats.views) * 10) / 10 : 0,
        avgCompletionRate: stats.views > 0 ? Math.round((stats.totalCompletion / stats.views) * 100) / 100 : 0,
      };
    })
    .sort((a, b) => b.totalViews - a.totalViews);

  // --- Newsletter performance ---
  const emailActions = actions.filter(a => a.actionType === 'emailOpen');
  const newsletterMap = new Map<string, number>();
  for (const ea of emailActions) {
    newsletterMap.set(ea.object, (newsletterMap.get(ea.object) || 0) + 1);
  }

  const newsletterPerformance = [...newsletterMap.entries()]
    .map(([objectID, opens]) => {
      const obj = objectMap.get(objectID);
      return {
        objectID,
        title: obj?.title || objectID,
        topics: obj?.subject || [],
        opens,
        publishedDate: obj?.published || '',
      };
    })
    .sort((a, b) => a.publishedDate.localeCompare(b.publishedDate));

  // --- Survey highlights ---
  const surveyObjs = objects.filter(o => o.type === 'surveyResponse' && o.responses);
  const questionAnswers = new Map<string, string[]>();
  for (const so of surveyObjs) {
    for (const r of so.responses || []) {
      const existing = questionAnswers.get(r.question) || [];
      existing.push(r.answer);
      questionAnswers.set(r.question, existing);
    }
  }

  const themeKeywords: Record<string, string> = {
    education: 'education', schools: 'education', 'k-12': 'education', teacher: 'education', redistricting: 'education',
    housing: 'housing', development: 'housing', rent: 'housing',
    neighborhood: 'neighborhood_coverage', 'individual neighborhoods': 'neighborhood_coverage',
    investigative: 'investigative', investigation: 'investigative',
    environment: 'environment', climate: 'environment',
    health: 'health', wellness: 'health',
    crime: 'crime', safety: 'crime', police: 'crime',
  };

  const surveyHighlights = {
    totalResponses: surveyObjs.length,
    byQuestion: [...questionAnswers.entries()].map(([question, answers]) => {
      const wordCounts = new Map<string, number>();
      for (const answer of answers) {
        const lower = answer.toLowerCase();
        for (const [keyword, theme] of Object.entries(themeKeywords)) {
          if (lower.includes(keyword)) {
            wordCounts.set(theme, (wordCounts.get(theme) || 0) + 1);
          }
        }
      }
      const topThemes = [...wordCounts.entries()]
        .sort((a, b) => b[1] - a[1])
        .slice(0, 5)
        .map(([theme, count]) => ({ theme, count }));
      return { question, answers, topThemes };
    }),
  };

  // --- Cohort analysis: churn clusters by ZIP ---
  const churnByZip = new Map<string, PersonRecord[]>();
  for (const d of declined) {
    const person = personMap.get(d.userID);
    if (!person) continue;
    const zip = person.location?.postalCode || 'unknown';
    const existing = churnByZip.get(zip) || [];
    existing.push(person);
    churnByZip.set(zip, existing);
  }

  const churnClusters = [...churnByZip.entries()]
    .filter(([, ps]) => ps.length >= 3)
    .map(([postalCode, ps]) => {
      const topicCounts = new Map<string, number>();
      for (const p of ps) {
        for (const t of p.interests?.topics || []) {
          topicCounts.set(t, (topicCounts.get(t) || 0) + 1);
        }
      }
      const sharedTopics = [...topicCounts.entries()]
        .filter(([, count]) => count >= ps.length * 0.4)
        .sort((a, b) => b[1] - a[1])
        .map(([t]) => t);

      const lastContent = new Set<string>();
      for (const p of ps) {
        const pActs = personActions.get(p.userID) || [];
        const pageViews = pActs.filter(a => a.actionType === 'pageView').sort((a, b) =>
          new Date(b.published).getTime() - new Date(a.published).getTime()
        );
        if (pageViews[0]) {
          const obj = objectMap.get(pageViews[0].object);
          if (obj?.title) lastContent.add(obj.title);
        }
      }

      return {
        postalCode,
        count: ps.length,
        sharedTopics,
        lastContentEngaged: [...lastContent].slice(0, 3),
        avgPreviousScore: Math.round(ps.reduce((s, p) => s + (p.previousEngagementScore || 3), 0) / ps.length * 10) / 10,
        avgCurrentScore: Math.round(ps.reduce((s, p) => s + (p.engagementScore || 1), 0) / ps.length * 10) / 10,
      };
    })
    .sort((a, b) => b.count - a.count);

  // --- Cohort analysis: engagement jumpers by content topic ---
  const topicJumpers = new Map<string, { jumpers: Set<string>; donors: Set<string>; names: string[] }>();
  for (const j of jumped) {
    for (const title of j.topContentRead) {
      const obj = [...objectMap.values()].find(o => o.title === title);
      if (!obj) continue;
      for (const topic of obj.subject || []) {
        const existing = topicJumpers.get(topic) || { jumpers: new Set(), donors: new Set(), names: [] };
        if (!existing.jumpers.has(j.userID)) {
          existing.jumpers.add(j.userID);
          if (existing.names.length < 5) existing.names.push(j.name);
          if (j.becameDonor) existing.donors.add(j.userID);
        }
        topicJumpers.set(topic, existing);
      }
    }
  }

  const engagementJumpersByContent = [...topicJumpers.entries()]
    .map(([contentTopic, { jumpers, donors, names }]) => ({
      contentTopic,
      jumperCount: jumpers.size,
      newDonorCount: donors.size,
      exampleReaders: names,
    }))
    .sort((a, b) => b.jumperCount - a.jumperCount)
    .slice(0, 10);

  return {
    overview: {
      totalPersons: persons.length,
      totalObjects: objects.length,
      totalActions: actions.length,
      dataSources,
      engagementPeriod,
    },
    engagementDistribution: { current, previous, high, medium, low },
    engagementChanges: { jumped, declined, jumpedCount: jumped.length, declinedCount: declined.length, stableCount },
    geographicBreakdown,
    topicInterestMap,
    donorFunnel: { nonDonors, minorDonors, majorDonors, newDonors, highEngagementNonDonors, contentBeforeDonation },
    contentPerformance,
    newsletterPerformance,
    surveyHighlights,
    cohortAnalysis: { churnClusters, engagementJumpersByContent },
  };
}
