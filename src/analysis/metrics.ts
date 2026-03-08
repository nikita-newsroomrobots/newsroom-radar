import { AudienceData } from './loader.js';

export interface MetricsSummary {
  overview: {
    totalPersons: number;
    totalObjects: number;
    totalActions: number;
    dataSources: string[];
  };
  engagementDistribution: {
    score1: number;
    score2: number;
    score3: number;
    score4: number;
    score5: number;
    high: number;   // 4-5
    medium: number;  // 3
    low: number;     // 1-2
  };
  geographicBreakdown: Array<{
    postalCode: string;
    locality: string;
    readerCount: number;
    avgEngagement: number;
    donors: number;
    topTopics: string[];
  }>;
  topicInterestMap: Array<{
    topic: string;
    interestedReaders: number;
    avgEngagement: number;
    hasRecentContent: boolean;
  }>;
  donorFunnel: {
    nonDonors: number;
    minorDonors: number;
    majorDonors: number;
    recentDonations: Array<{
      person: string;
      date: string;
    }>;
    highEngagementNonDonors: number;
  };
  contentPerformance: Array<{
    objectID: string;
    title: string;
    type: string;
    topics: string[];
    totalViews: number;
    avgTimeSpent: string;
    avgCompletionRate: number;
  }>;
  newsletterPerformance: Array<{
    objectID: string;
    title: string;
    topics: string[];
    opens: number;
  }>;
  surveyHighlights: Array<{
    question: string;
    answers: string[];
  }>;
  cohortAnalysis: {
    churnedReaders: Array<{
      userID: string;
      name: string;
      location: string;
      previousInterests: string[];
      lastEngagedTopic: string;
    }>;
    engagementJumpers: Array<{
      userID: string;
      name: string;
      currentScore: number;
      commonContent: string[];
      becameDonor: boolean;
    }>;
    geographicClusters: Array<{
      postalCode: string;
      locality: string;
      readerCount: number;
      avgEngagement: number;
      dominantTopics: string[];
      hasBeatCoverage: boolean;
    }>;
  };
}

function parseISODuration(duration: string): number {
  const match = duration.match(/PT(?:(\d+)H)?(?:(\d+)M)?(?:(\d+)S)?/);
  if (!match) return 0;
  const hours = parseInt(match[1] || '0');
  const minutes = parseInt(match[2] || '0');
  const seconds = parseInt(match[3] || '0');
  return hours * 60 + minutes + seconds / 60;
}

export function computeMetrics(data: AudienceData): MetricsSummary {
  const { persons, objects, actions, personMap, objectMap, personActions } = data;

  // Overview
  const dataSources = [...new Set(persons.map(p => p.dataSource))];

  // Engagement distribution
  const engagementDistribution = { score1: 0, score2: 0, score3: 0, score4: 0, score5: 0, high: 0, medium: 0, low: 0 };
  for (const p of persons) {
    const score = p.engagementScore || 1;
    if (score === 1) engagementDistribution.score1++;
    else if (score === 2) engagementDistribution.score2++;
    else if (score === 3) engagementDistribution.score3++;
    else if (score === 4) engagementDistribution.score4++;
    else if (score === 5) engagementDistribution.score5++;

    if (score >= 4) engagementDistribution.high++;
    else if (score === 3) engagementDistribution.medium++;
    else engagementDistribution.low++;
  }

  // Geographic breakdown
  const geoMap = new Map<string, { persons: typeof persons; locality: string }>();
  for (const p of persons) {
    const zip = p.location?.postalCode || 'unknown';
    const existing = geoMap.get(zip) || { persons: [], locality: p.location?.addressLocality || '' };
    existing.persons.push(p);
    geoMap.set(zip, existing);
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
      .slice(0, 3)
      .map(([t]) => t);
    return { postalCode, locality, readerCount: geoPersons.length, avgEngagement: Math.round(avgEngagement * 10) / 10, donors, topTopics };
  }).sort((a, b) => b.readerCount - a.readerCount);

  // Topic interest map
  const topicMap = new Map<string, { readers: Set<string>; totalEngagement: number }>();
  for (const p of persons) {
    for (const t of p.interests?.topics || []) {
      const existing = topicMap.get(t) || { readers: new Set(), totalEngagement: 0 };
      existing.readers.add(p.userID);
      existing.totalEngagement += p.engagementScore || 1;
      topicMap.set(t, existing);
    }
  }

  const recentCutoff = new Date('2025-10-01').getTime();
  const recentContentTopics = new Set<string>();
  for (const o of objects) {
    if (o.published && new Date(o.published).getTime() > recentCutoff) {
      for (const s of o.subject || []) {
        recentContentTopics.add(s);
      }
    }
  }

  const topicInterestMap = [...topicMap.entries()].map(([topic, { readers, totalEngagement }]) => ({
    topic,
    interestedReaders: readers.size,
    avgEngagement: Math.round((totalEngagement / readers.size) * 10) / 10,
    hasRecentContent: recentContentTopics.has(topic),
  })).sort((a, b) => b.interestedReaders - a.interestedReaders);

  // Donor funnel
  let nonDonors = 0, minorDonors = 0, majorDonors = 0;
  const recentDonations: Array<{ person: string; date: string }> = [];
  let highEngagementNonDonors = 0;

  for (const p of persons) {
    const status = p.behavior?.donorStatus || 'non_donor';
    if (status === 'non_donor') {
      nonDonors++;
      if ((p.engagementScore || 1) >= 4) highEngagementNonDonors++;
    } else if (status === 'minor_donor') {
      minorDonors++;
    } else if (status === 'major_donor') {
      majorDonors++;
    }
  }

  const donationActions = actions.filter(a => a.actionType === 'donation');
  const threeMonthsAgo = new Date('2025-11-01').getTime();
  for (const da of donationActions) {
    if (new Date(da.published).getTime() > threeMonthsAgo) {
      const person = personMap.get(da.person);
      recentDonations.push({
        person: person ? `${person.givenName} ${person.familyName}` : da.person,
        date: da.published,
      });
    }
  }
  recentDonations.sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime());

  // Content performance
  const contentActions = actions.filter(a => a.actionType === 'pageView');
  const contentMap = new Map<string, { views: number; totalTime: number; totalCompletion: number }>();
  for (const ca of contentActions) {
    const existing = contentMap.get(ca.object) || { views: 0, totalTime: 0, totalCompletion: 0 };
    existing.views++;
    if (ca.timeSpent) existing.totalTime += parseISODuration(ca.timeSpent);
    if (ca.completionRate != null) existing.totalCompletion += ca.completionRate;
    contentMap.set(ca.object, existing);
  }

  const contentPerformance = [...contentMap.entries()]
    .map(([objectID, stats]) => {
      const obj = objectMap.get(objectID);
      const avgMinutes = stats.views > 0 ? stats.totalTime / stats.views : 0;
      return {
        objectID,
        title: obj?.title || objectID,
        type: obj?.type || 'unknown',
        topics: obj?.subject || [],
        totalViews: stats.views,
        avgTimeSpent: `${Math.round(avgMinutes)}m`,
        avgCompletionRate: stats.views > 0 ? Math.round((stats.totalCompletion / stats.views) * 100) / 100 : 0,
      };
    })
    .sort((a, b) => b.totalViews - a.totalViews);

  // Newsletter performance
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
      };
    })
    .sort((a, b) => {
      const dateA = objectMap.get(a.objectID)?.published || '';
      const dateB = objectMap.get(b.objectID)?.published || '';
      return dateA.localeCompare(dateB);
    });

  // Survey highlights
  const surveyObjects = objects.filter(o => o.type === 'surveyResponse' && o.responses);
  const questionAnswers = new Map<string, string[]>();
  for (const so of surveyObjects) {
    for (const r of so.responses || []) {
      const existing = questionAnswers.get(r.question) || [];
      existing.push(r.answer);
      questionAnswers.set(r.question, existing);
    }
  }
  const surveyHighlights = [...questionAnswers.entries()].map(([question, answers]) => ({ question, answers }));

  // Cohort analysis: churned readers (low engagement, had previous interest in stopped coverage)
  const churnedReaders = persons
    .filter(p => (p.engagementScore || 1) <= 2 && p.tags?.includes('lapsed'))
    .map(p => {
      const pActions = personActions.get(p.userID) || [];
      const lastAction = pActions.sort((a, b) => new Date(b.published).getTime() - new Date(a.published).getTime())[0];
      const lastObj = lastAction ? objectMap.get(lastAction.object) : undefined;
      return {
        userID: p.userID,
        name: `${p.givenName || ''} ${p.familyName || ''}`.trim(),
        location: p.location?.postalCode || 'unknown',
        previousInterests: p.interests?.topics || [],
        lastEngagedTopic: lastObj?.subject?.[0] || p.interests?.topics?.[0] || 'unknown',
      };
    });

  // Cohort analysis: engagement jumpers (high engagement readers who read specific content)
  const waterQualityArticles = objects
    .filter(o => o.subject?.includes('water_quality') && o.type === 'article')
    .map(o => o.objectID);

  const engagementJumpers = persons
    .filter(p => (p.engagementScore || 1) >= 4 && p.interests?.topics?.includes('water_quality'))
    .map(p => {
      const pActions = personActions.get(p.userID) || [];
      const wqActions = pActions.filter(a => waterQualityArticles.includes(a.object));
      const hasDonated = pActions.some(a => a.actionType === 'donation');
      return {
        userID: p.userID,
        name: `${p.givenName || ''} ${p.familyName || ''}`.trim(),
        currentScore: p.engagementScore || 1,
        commonContent: wqActions.map(a => objectMap.get(a.object)?.title || a.object),
        becameDonor: hasDonated,
      };
    });

  // Geographic clusters
  const geographicClusters = geographicBreakdown
    .filter(g => g.readerCount >= 5)
    .map(g => ({
      postalCode: g.postalCode,
      locality: g.locality,
      readerCount: g.readerCount,
      avgEngagement: g.avgEngagement,
      dominantTopics: g.topTopics,
      hasBeatCoverage: false, // 63115 cluster has no dedicated beat
    }));

  return {
    overview: {
      totalPersons: persons.length,
      totalObjects: objects.length,
      totalActions: actions.length,
      dataSources,
    },
    engagementDistribution,
    geographicBreakdown,
    topicInterestMap,
    donorFunnel: { nonDonors, minorDonors, majorDonors, recentDonations, highEngagementNonDonors },
    contentPerformance,
    newsletterPerformance,
    surveyHighlights,
    cohortAnalysis: { churnedReaders, engagementJumpers, geographicClusters },
  };
}
