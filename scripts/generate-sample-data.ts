/**
 * Generates ~500 realistic audience records with planted patterns + noise.
 * Run: npx tsx scripts/generate-sample-data.ts
 */

import { writeFileSync } from 'fs';
import { join, dirname } from 'path';
import { fileURLToPath } from 'url';

const __dirname = dirname(fileURLToPath(import.meta.url));

// --- Helpers ---
const pick = <T>(arr: T[]): T => arr[Math.floor(Math.random() * arr.length)];
const pickN = <T>(arr: T[], n: number): T[] => {
  const shuffled = [...arr].sort(() => Math.random() - 0.5);
  return shuffled.slice(0, n);
};
const maybe = (pct: number): boolean => Math.random() < pct;
const randInt = (min: number, max: number) => Math.floor(Math.random() * (max - min + 1)) + min;
const pad = (n: number, len = 3) => String(n).padStart(len, '0');

let userCounter = 0;
const nextUserID = () => `user-${pad(++userCounter)}`;

// --- Constants ---
const ZIP_CODES = [
  { zip: '63101', locality: 'St. Louis', weight: 0.12 },
  { zip: '63103', locality: 'St. Louis', weight: 0.10 },
  { zip: '63104', locality: 'St. Louis', weight: 0.09 },
  { zip: '63106', locality: 'St. Louis', weight: 0.08 },
  { zip: '63108', locality: 'St. Louis', weight: 0.09 },
  { zip: '63110', locality: 'St. Louis', weight: 0.08 },
  { zip: '63112', locality: 'St. Louis', weight: 0.07 },
  { zip: '63115', locality: 'St. Louis', weight: 0.11 },  // Underserved cluster
  { zip: '63116', locality: 'St. Louis', weight: 0.07 },
  { zip: '63118', locality: 'St. Louis', weight: 0.06 },
  { zip: '63120', locality: 'St. Louis', weight: 0.05 },
  { zip: '63130', locality: 'University City', weight: 0.04 },
  { zip: '63139', locality: 'St. Louis', weight: 0.04 },
];

const FIRST_NAMES = [
  'Maria', 'James', 'Aisha', 'Robert', 'Patricia', 'David', 'Lisa', 'Michael',
  'Sarah', 'Kevin', 'Angela', 'Thomas', 'Jennifer', 'Marcus', 'Rachel', 'Destiny',
  'Andre', 'Keisha', 'Terrence', 'Monique', 'Jamal', 'Latoya', 'Darnell', 'Crystal',
  'Elizabeth', 'Christopher', 'Amanda', 'Daniel', 'Nancy', 'Brian', 'Stephanie',
  'Gregory', 'Catherine', 'Frank', 'Diane', 'Jason', 'Sharon', 'Kenneth', 'Laura',
  'Paul', 'Sandra', 'Steven', 'Kimberly', 'Edward', 'Dorothy', 'Wayne', 'Virginia',
  'Russell', 'Evelyn', 'Peter', 'Carolyn', 'Harold', 'Joyce', 'Henry', 'Cheryl',
  'Ralph', 'Martha', 'Willie', 'Teresa', 'Lawrence', 'Gloria', 'Roy', 'Louis',
  'Judith', 'Eugene', 'Rose', 'Alan', 'Irene', 'Carl', 'Pamela', 'Raymond',
  'Beverly', 'Gerald', 'Denise', 'Arthur', 'Donna', 'Roger', 'Cynthia', 'Keith',
  'Brenda', 'Albert', 'Janet', 'Philip', 'Helen', 'Jerry', 'Samantha', 'Dennis',
  'Katherine', 'Tyler', 'Deborah', 'Brandon', 'Olivia', 'Noah', 'Emma', 'Liam',
  'Sophia', 'Ethan', 'Isabella', 'Mason', 'Ava', 'Lucas', 'Mia', 'Logan',
  'Charlotte', 'Alexander', 'Amelia', 'Sebastian', 'Harper', 'Mateo', 'Ella',
];

const LAST_NAMES = [
  'Santos', 'Chen', 'Johnson', 'Williams', 'Kim', 'Okafor', 'Nguyen', 'Torres',
  'Mitchell', 'Park', 'Rivera', 'Weber', 'Patel', 'Brown', 'Hoffman', 'Washington',
  'Jackson', 'Davis', 'Moore', 'Taylor', 'Harris', 'Robinson', 'Lewis', 'Anderson',
  'Garcia', 'Lee', 'White', 'Martinez', 'Thompson', 'Clark', 'Adams', 'Nelson',
  'Hill', 'Young', 'King', 'Wright', 'Lopez', 'Scott', 'Green', 'Baker',
  'Gonzalez', 'Carter', 'Phillips', 'Campbell', 'Evans', 'Cox', 'Reed', 'Morgan',
  'Bell', 'Murphy', 'Bailey', 'Perry', 'Powell', 'Long', 'Hughes', 'Flores',
  'Butler', 'Simmons', 'Foster', 'Bryant', 'Alexander', 'Russell', 'Griffin',
  'Diaz', 'Hayes', 'Meyer', 'Shaw', 'Warren', 'Stone', 'Fox', 'Rose', 'Hunt',
  'Woods', 'Coleman', 'Patterson', 'Sanders', 'Price', 'Bennett', 'Wood', 'Brooks',
  'Ward', 'Watson', 'Gray', 'James', 'Reyes', 'Cruz', 'Fisher', 'Morales',
  'Gomez', 'Murray', 'Freeman', 'Wells', 'Webb', 'Simpson', 'Stevens', 'Tucker',
];

const ALL_TOPICS = [
  'local_government', 'education', 'water_quality', 'housing', 'investigative',
  'environment', 'health', 'crime', 'development', 'finance', 'business',
  'sports', 'entertainment', 'transportation', 'arts_culture',
];

const AGE_GROUPS = ['18-24', '25-34', '35-44', '45-54', '55-64', '65+'];
const DATA_SOURCES = ['mailchimp', 'google_analytics', 'survey_tool', 'donation_platform'];

// --- Weighted ZIP picker ---
function pickZip(): typeof ZIP_CODES[number] {
  const r = Math.random();
  let cumulative = 0;
  for (const z of ZIP_CODES) {
    cumulative += z.weight;
    if (r < cumulative) return z;
  }
  return ZIP_CODES[ZIP_CODES.length - 1];
}

// --- Articles ---
const ARTICLES = [
  // Water quality investigation series
  { id: 'water-quality-investigation-part-1', title: 'Investigation: What\'s Really in St. Louis Drinking Water?', type: 'article', subType: 'investigative', published: '2025-11-15T09:00:00Z', subject: ['water_quality', 'investigative', 'environment', 'health'] },
  { id: 'water-quality-investigation-part-2', title: 'Water Quality Part 2: The Cover-Up', type: 'article', subType: 'investigative', published: '2025-12-01T09:00:00Z', subject: ['water_quality', 'investigative', 'environment', 'local_government'] },
  { id: 'water-quality-investigation-part-3', title: 'Water Quality Part 3: What Officials Knew', type: 'article', subType: 'investigative', published: '2026-01-05T09:00:00Z', subject: ['water_quality', 'investigative', 'local_government'] },
  // School redistricting
  { id: 'school-redistricting-plan', title: 'New School Redistricting Plan Draws Neighborhood Protests', type: 'article', subType: 'news', published: '2025-08-20T09:00:00Z', subject: ['education', 'school_redistricting', 'local_government'] },
  { id: 'school-redistricting-update', title: 'School Redistricting: Board Delays Vote After Backlash', type: 'article', subType: 'news', published: '2025-09-10T09:00:00Z', subject: ['education', 'school_redistricting', 'local_government'] },
  // Regular coverage
  { id: 'city-budget-2026', title: 'Breaking Down the 2026 City Budget', type: 'article', subType: 'explainer', published: '2025-11-01T09:00:00Z', subject: ['finance', 'local_government', 'budget'] },
  { id: 'local-business-roundup-q4', title: 'Local Business Roundup: Q4 2025', type: 'article', subType: 'news', published: '2025-12-15T09:00:00Z', subject: ['finance', 'business'] },
  { id: 'housing-development-north', title: 'Major Housing Development Planned for North St. Louis', type: 'article', subType: 'news', published: '2026-01-20T09:00:00Z', subject: ['housing', 'development', 'local_government'] },
  { id: 'city-council-recap-jan', title: 'City Council Recap: January 2026', type: 'article', subType: 'recap', published: '2026-01-31T09:00:00Z', subject: ['local_government'] },
  { id: 'health-clinic-expansion', title: 'Community Health Clinics Announce Expansion', type: 'article', subType: 'news', published: '2026-02-10T09:00:00Z', subject: ['health', 'local_government'] },
  { id: 'police-overtime-audit', title: 'Audit Reveals Police Overtime Costs Doubled in 2025', type: 'article', subType: 'investigative', published: '2025-10-05T09:00:00Z', subject: ['crime', 'local_government', 'finance'] },
  { id: 'metro-bus-route-changes', title: 'Metro Proposes Major Bus Route Changes', type: 'article', subType: 'news', published: '2025-12-20T09:00:00Z', subject: ['transportation', 'local_government'] },
  { id: 'downtown-arts-district', title: 'Downtown Arts District Gets $5M Investment', type: 'article', subType: 'news', published: '2026-01-15T09:00:00Z', subject: ['arts_culture', 'development', 'business'] },
  { id: 'teacher-shortage-crisis', title: 'St. Louis Schools Face Record Teacher Shortages', type: 'article', subType: 'news', published: '2025-10-20T09:00:00Z', subject: ['education', 'local_government'] },
  { id: 'lead-pipe-followup', title: 'Six Months Later: Lead Pipe Replacement Stalls', type: 'article', subType: 'news', published: '2026-02-20T09:00:00Z', subject: ['water_quality', 'environment', 'local_government'] },
  { id: 'north-stl-grocery-desert', title: 'North St. Louis Grocery Desert Grows as Last Store Closes', type: 'article', subType: 'news', published: '2026-02-05T09:00:00Z', subject: ['housing', 'health', 'development'] },
  { id: 'sports-stadium-debate', title: 'MLS Stadium Debate Heats Up at City Hall', type: 'article', subType: 'news', published: '2026-01-25T09:00:00Z', subject: ['sports', 'local_government', 'development'] },
  { id: 'local-business-roundup-q1', title: 'Local Business Roundup: Q1 2026', type: 'article', subType: 'news', published: '2026-02-28T09:00:00Z', subject: ['finance', 'business'] },
  { id: 'environmental-justice-forum', title: 'Community Forum on Environmental Justice Draws 200+', type: 'article', subType: 'news', published: '2026-02-15T09:00:00Z', subject: ['environment', 'local_government', 'health'] },
  { id: 'rent-control-proposal', title: 'Aldermen Float Rent Control Proposal', type: 'article', subType: 'news', published: '2026-02-12T09:00:00Z', subject: ['housing', 'local_government'] },
];

// Newsletters
const NEWSLETTERS = [
  { id: 'weekly-2025-10-06', title: 'Weekly Newsletter: Oct 6, 2025', published: '2025-10-06T07:00:00Z', subject: ['local_government', 'crime'] },
  { id: 'weekly-2025-10-20', title: 'Weekly Newsletter: Oct 20, 2025', published: '2025-10-20T07:00:00Z', subject: ['education', 'local_government'] },
  { id: 'weekly-2025-11-03', title: 'Weekly Newsletter: Nov 3, 2025', published: '2025-11-03T07:00:00Z', subject: ['finance', 'local_government'] },
  { id: 'weekly-2025-11-17', title: 'Weekly Newsletter: Nov 17, 2025', published: '2025-11-17T07:00:00Z', subject: ['water_quality', 'investigative'] },
  { id: 'weekly-2025-12-01', title: 'Weekly Newsletter: Dec 1, 2025', published: '2025-12-01T07:00:00Z', subject: ['water_quality', 'environment'] },
  { id: 'weekly-2025-12-15', title: 'Weekly Newsletter: Dec 15, 2025', published: '2025-12-15T07:00:00Z', subject: ['finance', 'business'] },
  { id: 'weekly-2026-01-05', title: 'Weekly Newsletter: Jan 5, 2026', published: '2026-01-05T07:00:00Z', subject: ['water_quality', 'local_government'] },
  { id: 'weekly-2026-01-12', title: 'Weekly Newsletter: Jan 12, 2026', published: '2026-01-12T07:00:00Z', subject: ['finance', 'business'] },
  { id: 'weekly-2026-01-19', title: 'Weekly Newsletter: Jan 19, 2026', published: '2026-01-19T07:00:00Z', subject: ['housing', 'local_government'] },
  { id: 'weekly-2026-01-26', title: 'Weekly Newsletter: Jan 26, 2026', published: '2026-01-26T07:00:00Z', subject: ['finance', 'budget'] },
  { id: 'weekly-2026-02-02', title: 'Weekly Newsletter: Feb 2, 2026', published: '2026-02-02T07:00:00Z', subject: ['local_government', 'health'] },
  { id: 'weekly-2026-02-09', title: 'Weekly Newsletter: Feb 9, 2026', published: '2026-02-09T07:00:00Z', subject: ['local_government', 'environment'] },
  { id: 'weekly-2026-02-16', title: 'Weekly Newsletter: Feb 16, 2026', published: '2026-02-16T07:00:00Z', subject: ['environment', 'health'] },
  { id: 'weekly-2026-02-23', title: 'Weekly Newsletter: Feb 23, 2026', published: '2026-02-23T07:00:00Z', subject: ['housing', 'local_government'] },
];

// Survey questions and answer pools
const SURVEY_QUESTIONS = [
  { question: 'What topics would you like us to cover more?', pool: [
    'Education - especially K-12 school news',
    'Education and schools',
    'Education policy, teacher shortages',
    'Schools and education',
    'Local education, environment',
    'Housing and development',
    'Local government and accountability',
    'More investigative reporting',
    'Health and wellness',
    'Crime and public safety',
    'Transportation and infrastructure',
    'Arts and culture',
    'Sports',
    'Environment and climate',
    'Business and economy',
  ]},
  { question: 'How satisfied are you with our coverage?', pool: [
    'Very satisfied',
    'Satisfied',
    'Somewhat satisfied',
    'Neutral',
    'Somewhat dissatisfied',
    'Dissatisfied',
  ]},
  { question: "What's missing from our coverage?", pool: [
    'More neighborhood-level reporting',
    'I want more education reporting, the redistricting coverage was great but it stopped',
    'Education beat - you covered redistricting then just stopped',
    'More coverage of individual neighborhoods',
    'Environmental reporting is great, keep it up. But need more education.',
    'Need more coverage of North St. Louis',
    'Would love a housing/development beat',
    'More follow-up on investigative pieces',
    'Nothing specific, keep up the good work',
    'More diverse voices and perspectives',
    'Better mobile experience',
    'More data-driven reporting',
    'Coverage of my neighborhood (63115)',
    'Anything about schools and kids',
  ]},
];

// --- Person generation ---
interface PersonSpec {
  cohort: string;
  zip: string;
  locality: string;
  engagementScore: number;
  previousEngagementScore: number;
  donorStatus: string;
  previousDonorStatus: string;
  topics: string[];
  tags: string[];
  dataSource: string;
  ageGroup: string;
  lastDonationDate?: string;
  firstDonationDate?: string;
}

const persons: PersonSpec[] = [];
const usedNames = new Set<string>();

function uniqueName(): { first: string; last: string } {
  for (let i = 0; i < 100; i++) {
    const first = pick(FIRST_NAMES);
    const last = pick(LAST_NAMES);
    const key = `${first} ${last}`;
    if (!usedNames.has(key)) {
      usedNames.add(key);
      return { first, last };
    }
  }
  // Fallback with number suffix
  const first = pick(FIRST_NAMES);
  const last = pick(LAST_NAMES);
  usedNames.add(`${first} ${last}${usedNames.size}`);
  return { first, last };
}

// COHORT 1: Water quality engagement jumpers (~45 people)
// ~28 actually jumped engagement, ~10 became donors, ~17 jumped but didn't donate
// ~12 read it but engagement didn't change, ~5 read it and disengaged anyway
for (let i = 0; i < 28; i++) {
  const z = pick(ZIP_CODES.filter(z => z.zip !== '63101')); // Spread across zips
  const becameDonor = i < 10;
  persons.push({
    cohort: 'wq_jumper',
    zip: z.zip, locality: z.locality,
    engagementScore: maybe(0.6) ? 5 : 4,
    previousEngagementScore: maybe(0.7) ? 2 : 1,
    donorStatus: becameDonor ? 'minor_donor' : 'non_donor',
    previousDonorStatus: 'non_donor',
    topics: ['water_quality', ...pickN(['environment', 'investigative', 'health', 'local_government'], randInt(1, 3))],
    tags: becameDonor ? ['subscriber', 'donor', 'newsletter'] : ['subscriber', ...(maybe(0.6) ? ['newsletter'] : [])],
    dataSource: pick(['mailchimp', 'google_analytics']),
    ageGroup: pick(AGE_GROUPS),
    ...(becameDonor ? {
      lastDonationDate: `2026-0${randInt(1, 2)}-${pad(randInt(1, 28), 2)}T00:00:00Z`,
      firstDonationDate: `2026-0${randInt(1, 2)}-${pad(randInt(1, 28), 2)}T00:00:00Z`,
    } : {}),
  });
}
// Read WQ but didn't jump
for (let i = 0; i < 12; i++) {
  const z = pickZip();
  persons.push({
    cohort: 'wq_unchanged',
    zip: z.zip, locality: z.locality,
    engagementScore: 3,
    previousEngagementScore: 3,
    donorStatus: 'non_donor',
    previousDonorStatus: 'non_donor',
    topics: ['water_quality', ...pickN(['environment', 'health', 'local_government'], randInt(1, 2))],
    tags: ['subscriber', ...(maybe(0.5) ? ['newsletter'] : [])],
    dataSource: pick(['mailchimp', 'google_analytics']),
    ageGroup: pick(AGE_GROUPS),
  });
}
// Read WQ but still disengaged
for (let i = 0; i < 5; i++) {
  const z = pickZip();
  persons.push({
    cohort: 'wq_still_low',
    zip: z.zip, locality: z.locality,
    engagementScore: 2,
    previousEngagementScore: 2,
    donorStatus: 'non_donor',
    previousDonorStatus: 'non_donor',
    topics: pickN(['water_quality', 'environment', 'health'], 2),
    tags: ['subscriber'],
    dataSource: pick(['mailchimp', 'google_analytics']),
    ageGroup: pick(AGE_GROUPS),
  });
}

// COHORT 2: School redistricting churned readers (~35 in 63101)
// ~22 actually churned, ~8 stayed engaged, ~5 were already low
for (let i = 0; i < 22; i++) {
  persons.push({
    cohort: 'redistricting_churned',
    zip: '63101', locality: 'St. Louis',
    engagementScore: maybe(0.7) ? 1 : 2,
    previousEngagementScore: maybe(0.6) ? 4 : 3,
    donorStatus: 'non_donor',
    previousDonorStatus: 'non_donor',
    topics: ['school_redistricting', 'education', ...(maybe(0.4) ? ['local_government'] : [])],
    tags: ['lapsed'],
    dataSource: 'mailchimp',
    ageGroup: pick(AGE_GROUPS),
  });
}
for (let i = 0; i < 8; i++) {
  persons.push({
    cohort: 'redistricting_stayed',
    zip: '63101', locality: 'St. Louis',
    engagementScore: maybe(0.5) ? 4 : 3,
    previousEngagementScore: maybe(0.5) ? 3 : 4,
    donorStatus: maybe(0.25) ? 'minor_donor' : 'non_donor',
    previousDonorStatus: 'non_donor',
    topics: ['education', 'local_government', ...(maybe(0.5) ? ['school_redistricting'] : [])],
    tags: ['subscriber', ...(maybe(0.6) ? ['newsletter'] : [])],
    dataSource: pick(['mailchimp', 'google_analytics']),
    ageGroup: pick(AGE_GROUPS),
    ...(maybe(0.25) ? { lastDonationDate: '2025-10-15T00:00:00Z' } : {}),
  });
}
for (let i = 0; i < 5; i++) {
  persons.push({
    cohort: 'redistricting_already_low',
    zip: '63101', locality: 'St. Louis',
    engagementScore: 2,
    previousEngagementScore: 2,
    donorStatus: 'non_donor',
    previousDonorStatus: 'non_donor',
    topics: ['education', ...(maybe(0.3) ? ['school_redistricting'] : [])],
    tags: ['subscriber'],
    dataSource: 'google_analytics',
    ageGroup: pick(AGE_GROUPS),
  });
}

// COHORT 3: 63115 underserved cluster (~50 readers)
// High engagement relative to no coverage — mix of 2-5 scores
for (let i = 0; i < 50; i++) {
  const eng = maybe(0.3) ? 5 : maybe(0.35) ? 4 : maybe(0.4) ? 3 : 2;
  persons.push({
    cohort: '63115_cluster',
    zip: '63115', locality: 'St. Louis',
    engagementScore: eng,
    previousEngagementScore: eng + (maybe(0.2) ? -1 : maybe(0.1) ? 1 : 0),
    donorStatus: maybe(0.04) ? 'minor_donor' : 'non_donor', // Almost no donors — 2 at most
    previousDonorStatus: 'non_donor',
    topics: pickN(['housing', 'local_government', 'education', 'crime', 'development', 'health'], randInt(2, 4)),
    tags: eng >= 3 ? ['subscriber', ...(maybe(0.5) ? ['newsletter'] : [])] : ['subscriber'],
    dataSource: pick(['mailchimp', 'google_analytics']),
    ageGroup: pick(AGE_GROUPS),
  });
}

// COHORT 4: Finance/business readers (~30 readers)
// Declining engagement
for (let i = 0; i < 15; i++) {
  persons.push({
    cohort: 'finance_declining',
    zip: pickZip().zip, locality: 'St. Louis',
    engagementScore: maybe(0.5) ? 1 : 2,
    previousEngagementScore: maybe(0.6) ? 3 : 4,
    donorStatus: 'non_donor',
    previousDonorStatus: maybe(0.1) ? 'minor_donor' : 'non_donor',
    topics: ['finance', ...(maybe(0.5) ? ['business'] : []), ...(maybe(0.3) ? ['local_government'] : [])],
    tags: maybe(0.4) ? ['lapsed'] : ['subscriber'],
    dataSource: 'mailchimp',
    ageGroup: pick(AGE_GROUPS),
  });
}
// Finance readers still engaged (noise)
for (let i = 0; i < 15; i++) {
  persons.push({
    cohort: 'finance_stable',
    zip: pickZip().zip, locality: 'St. Louis',
    engagementScore: maybe(0.4) ? 4 : 3,
    previousEngagementScore: maybe(0.4) ? 4 : 3,
    donorStatus: maybe(0.2) ? 'minor_donor' : 'non_donor',
    previousDonorStatus: maybe(0.2) ? 'minor_donor' : 'non_donor',
    topics: ['finance', 'local_government', ...(maybe(0.3) ? ['business'] : [])],
    tags: ['subscriber', ...(maybe(0.5) ? ['newsletter'] : [])],
    dataSource: pick(['mailchimp', 'google_analytics']),
    ageGroup: pick(AGE_GROUPS),
    ...(maybe(0.2) ? { lastDonationDate: `2025-${pad(randInt(6, 12), 2)}-15T00:00:00Z` } : {}),
  });
}

// COHORT 5: Loyal high-engagement core (~40 readers, pre-existing donors)
for (let i = 0; i < 40; i++) {
  const z = pickZip();
  const isDonor = maybe(0.6);
  const isMajor = isDonor && maybe(0.15);
  persons.push({
    cohort: 'loyal_core',
    zip: z.zip, locality: z.locality,
    engagementScore: maybe(0.6) ? 5 : 4,
    previousEngagementScore: maybe(0.7) ? 5 : 4,
    donorStatus: isMajor ? 'major_donor' : isDonor ? 'minor_donor' : 'non_donor',
    previousDonorStatus: isMajor ? 'major_donor' : isDonor ? 'minor_donor' : 'non_donor',
    topics: pickN(['local_government', 'investigative', 'education', 'environment', 'health', 'housing'], randInt(2, 4)),
    tags: ['subscriber', 'newsletter', ...(isDonor ? ['donor'] : [])],
    dataSource: pick(['mailchimp', 'google_analytics', 'donation_platform']),
    ageGroup: pick(AGE_GROUPS),
    ...(isDonor ? { lastDonationDate: `2025-${pad(randInt(1, 12), 2)}-${pad(randInt(1, 28), 2)}T00:00:00Z` } : {}),
  });
}

// COHORT 6: General mixed audience (fill to ~500)
const remaining = 500 - persons.length;
for (let i = 0; i < remaining; i++) {
  const z = pickZip();
  const eng = maybe(0.1) ? 5 : maybe(0.2) ? 4 : maybe(0.35) ? 3 : maybe(0.3) ? 2 : 1;
  const prevEng = Math.max(1, Math.min(5, eng + (maybe(0.15) ? 1 : maybe(0.15) ? -1 : 0)));
  const isDonor = eng >= 4 && maybe(0.15);
  persons.push({
    cohort: 'general',
    zip: z.zip, locality: z.locality,
    engagementScore: eng,
    previousEngagementScore: prevEng,
    donorStatus: isDonor ? 'minor_donor' : 'non_donor',
    previousDonorStatus: isDonor && maybe(0.5) ? 'minor_donor' : 'non_donor',
    topics: pickN(ALL_TOPICS, randInt(1, 4)),
    tags: eng >= 3 ? ['subscriber', ...(maybe(0.4) ? ['newsletter'] : [])] : (eng <= 1 && maybe(0.4) ? ['lapsed'] : ['subscriber']),
    dataSource: pick(DATA_SOURCES.slice(0, 2)),
    ageGroup: pick(AGE_GROUPS),
    ...(isDonor ? { lastDonationDate: `2025-${pad(randInt(1, 12), 2)}-${pad(randInt(1, 28), 2)}T00:00:00Z` } : {}),
  });
}

// --- Build JSON-LD graph ---
const graph: Record<string, unknown>[] = [];

// Persons
const personRecords: Array<{ userID: string; spec: PersonSpec; name: { first: string; last: string } }> = [];
for (const spec of persons) {
  const id = nextUserID();
  const name = uniqueName();
  const emailName = `${name.first.toLowerCase()}.${name.last.toLowerCase()}`;

  const record: Record<string, unknown> = {
    '@type': 'Person',
    userID: id,
    givenName: name.first,
    familyName: name.last,
    primaryEmail: `${emailName}@email.com`,
    engagementScore: spec.engagementScore,
    previousEngagementScore: spec.previousEngagementScore,
    engagementPeriod: '2025-Q3',
    tags: spec.tags,
    dataSource: spec.dataSource,
    location: { postalCode: spec.zip, addressLocality: spec.locality },
    behavior: {
      donorStatus: spec.donorStatus,
      previousDonorStatus: spec.previousDonorStatus,
      ...(spec.lastDonationDate ? { lastDonationDate: spec.lastDonationDate } : {}),
      ...(spec.firstDonationDate ? { firstDonationDate: spec.firstDonationDate } : {}),
    },
    interests: { topics: spec.topics },
    demographics: { ageGroup: spec.ageGroup },
  };
  graph.push(record);
  personRecords.push({ userID: id, spec, name });
}

// Objects (articles)
for (const a of ARTICLES) {
  graph.push({
    '@type': 'Object',
    objectID: `https://stlnews.example.com/articles/${a.id}`,
    title: a.title,
    type: a.type,
    subType: a.subType,
    published: a.published,
    subject: a.subject,
    dataSource: 'google_analytics',
  });
}

// Objects (newsletters)
for (const n of NEWSLETTERS) {
  graph.push({
    '@type': 'Object',
    objectID: `https://stlnews.example.com/newsletters/${n.id}`,
    title: n.title,
    type: 'newsletter',
    published: n.published,
    subject: n.subject,
    dataSource: 'mailchimp',
  });
}

// Objects (surveys) — generate ~25 survey response objects
const surveyObjects: string[] = [];
for (let i = 0; i < 25; i++) {
  const sid = `reader-survey-2026-${pad(i + 1)}`;
  const responses = SURVEY_QUESTIONS.map(q => ({
    question: q.question,
    answer: pick(q.pool),
  }));
  surveyObjects.push(`https://stlnews.example.com/surveys/${sid}`);
  graph.push({
    '@type': 'Object',
    objectID: `https://stlnews.example.com/surveys/${sid}`,
    title: '2026 Reader Interest Survey',
    type: 'surveyResponse',
    published: `2026-01-${pad(randInt(10, 25), 2)}T00:00:00Z`,
    responses,
    dataSource: 'survey_tool',
  });
}

// --- Actions ---
const wqArticleIDs = ARTICLES.filter(a => a.subject.includes('water_quality')).map(a => `https://stlnews.example.com/articles/${a.id}`);
const redistArticleIDs = ARTICLES.filter(a => a.subject.includes('school_redistricting')).map(a => `https://stlnews.example.com/articles/${a.id}`);

for (const pr of personRecords) {
  const { userID, spec } = pr;

  // Water quality cohort actions
  if (spec.cohort === 'wq_jumper' || spec.cohort === 'wq_unchanged' || spec.cohort === 'wq_still_low') {
    // Read water quality articles
    const numWQ = spec.cohort === 'wq_jumper' ? randInt(2, 3) : randInt(1, 2);
    for (const articleID of wqArticleIDs.slice(0, numWQ)) {
      const pubDate = new Date(ARTICLES.find(a => `https://stlnews.example.com/articles/${a.id}` === articleID)!.published);
      const viewDate = new Date(pubDate.getTime() + randInt(1, 7) * 86400000);
      graph.push({
        '@type': 'Action',
        actionType: 'pageView',
        person: userID,
        object: articleID,
        published: viewDate.toISOString(),
        timeSpent: `PT${randInt(4, 15)}M`,
        completionRate: spec.cohort === 'wq_jumper' ? Math.round((0.8 + Math.random() * 0.2) * 100) / 100 : Math.round((0.4 + Math.random() * 0.5) * 100) / 100,
        dataSource: 'google_analytics',
      });
    }
    // Donation action for donors
    if (spec.donorStatus !== 'non_donor' && spec.lastDonationDate) {
      graph.push({
        '@type': 'Action',
        actionType: 'donation',
        person: userID,
        object: 'https://stlnews.example.com/donate',
        published: spec.lastDonationDate,
        dataSource: 'donation_platform',
      });
    }
  }

  // Redistricting cohort actions
  if (spec.cohort.startsWith('redistricting')) {
    for (const articleID of redistArticleIDs.slice(0, randInt(1, 2))) {
      const pubDate = new Date(ARTICLES.find(a => `https://stlnews.example.com/articles/${a.id}` === articleID)!.published);
      const viewDate = new Date(pubDate.getTime() + randInt(1, 5) * 86400000);
      graph.push({
        '@type': 'Action',
        actionType: 'pageView',
        person: userID,
        object: articleID,
        published: viewDate.toISOString(),
        timeSpent: `PT${randInt(3, 8)}M`,
        completionRate: Math.round((0.5 + Math.random() * 0.4) * 100) / 100,
        dataSource: 'google_analytics',
      });
    }
  }

  // 63115 cluster actions — read housing/government content
  if (spec.cohort === '63115_cluster' && spec.engagementScore >= 3) {
    const localArticles = ARTICLES.filter(a =>
      a.subject.some(s => ['housing', 'local_government', 'crime', 'development'].includes(s))
    );
    for (const article of pickN(localArticles, randInt(1, 4))) {
      const pubDate = new Date(article.published);
      const viewDate = new Date(pubDate.getTime() + randInt(1, 10) * 86400000);
      graph.push({
        '@type': 'Action',
        actionType: 'pageView',
        person: userID,
        object: `https://stlnews.example.com/articles/${article.id}`,
        published: viewDate.toISOString(),
        timeSpent: `PT${randInt(3, 10)}M`,
        completionRate: Math.round((0.5 + Math.random() * 0.5) * 100) / 100,
        dataSource: 'google_analytics',
      });
    }
  }

  // Finance cohort actions
  if (spec.cohort.startsWith('finance')) {
    const finArticles = ARTICLES.filter(a => a.subject.includes('finance'));
    for (const article of pickN(finArticles, randInt(1, 2))) {
      const pubDate = new Date(article.published);
      const viewDate = new Date(pubDate.getTime() + randInt(1, 5) * 86400000);
      graph.push({
        '@type': 'Action',
        actionType: 'pageView',
        person: userID,
        object: `https://stlnews.example.com/articles/${article.id}`,
        published: viewDate.toISOString(),
        timeSpent: `PT${randInt(2, 6)}M`,
        completionRate: Math.round((0.3 + Math.random() * 0.5) * 100) / 100,
        dataSource: 'google_analytics',
      });
    }
  }

  // Loyal core + general — random article reads
  if (spec.cohort === 'loyal_core' || spec.cohort === 'general') {
    const topicArticles = ARTICLES.filter(a =>
      a.subject.some(s => spec.topics.includes(s))
    );
    if (topicArticles.length > 0) {
      const numReads = spec.engagementScore >= 4 ? randInt(2, 5) : spec.engagementScore >= 3 ? randInt(1, 3) : maybe(0.5) ? 1 : 0;
      for (const article of pickN(topicArticles, numReads)) {
        const pubDate = new Date(article.published);
        const viewDate = new Date(pubDate.getTime() + randInt(1, 14) * 86400000);
        graph.push({
          '@type': 'Action',
          actionType: 'pageView',
          person: userID,
          object: `https://stlnews.example.com/articles/${article.id}`,
          published: viewDate.toISOString(),
          timeSpent: `PT${randInt(2, 12)}M`,
          completionRate: Math.round((0.3 + Math.random() * 0.7) * 100) / 100,
          dataSource: 'google_analytics',
        });
      }
    }
    // Donation actions for existing donors
    if (spec.donorStatus !== 'non_donor' && spec.lastDonationDate) {
      graph.push({
        '@type': 'Action',
        actionType: 'donation',
        person: userID,
        object: 'https://stlnews.example.com/donate',
        published: spec.lastDonationDate,
        dataSource: 'donation_platform',
      });
    }
  }

  // Newsletter opens — correlated with engagement and newsletter tag
  if (spec.tags.includes('newsletter') && spec.engagementScore >= 3) {
    const relevantNLs = NEWSLETTERS.filter(n =>
      n.subject.some(s => spec.topics.includes(s))
    );
    const numOpens = spec.engagementScore >= 4 ? randInt(3, Math.min(8, relevantNLs.length)) : randInt(1, Math.min(4, relevantNLs.length));
    for (const nl of pickN(relevantNLs, numOpens)) {
      const pubDate = new Date(nl.published);
      const openDate = new Date(pubDate.getTime() + randInt(0, 2) * 86400000 + randInt(1, 12) * 3600000);
      graph.push({
        '@type': 'Action',
        actionType: 'emailOpen',
        person: userID,
        object: `https://stlnews.example.com/newsletters/${nl.id}`,
        published: openDate.toISOString(),
        dataSource: 'mailchimp',
      });
    }
  }
}

// Survey response actions — ~25 random persons
const surveyRespondents = pickN(personRecords.filter(p => p.spec.engagementScore >= 2), 25);
for (let i = 0; i < surveyRespondents.length; i++) {
  graph.push({
    '@type': 'Action',
    actionType: 'surveyResponse',
    person: surveyRespondents[i].userID,
    object: surveyObjects[i],
    published: `2026-01-${pad(randInt(10, 25), 2)}T${pad(randInt(8, 20), 2)}:00:00Z`,
    completionRate: 1.0,
    dataSource: 'survey_tool',
  });
}

// --- Write output ---
const output = {
  '@context': {
    '@vocab': 'https://schema.org/',
    'activitystream': 'https://www.w3.org/ns/activitystreams#',
    'userID': 'identifier',
    'objectID': 'identifier',
    'primaryEmail': 'email',
    'engagementScore': 'ratingValue',
    'previousEngagementScore': 'ratingValue',
    'donorStatus': 'category',
    'previousDonorStatus': 'category',
    'tags': 'keywords',
    'dataSource': 'isBasedOn',
    'title': 'name',
    'published': 'datePublished',
    'subject': 'keywords',
    'person': 'identifier',
    'object': 'identifier',
    'referrer': 'activitystream:origin',
    'timeSpent': 'duration',
    'completionRate': 'value',
  },
  '@graph': graph,
};

const outPath = join(__dirname, '..', 'sample-data', 'audience-data.jsonld');
writeFileSync(outPath, JSON.stringify(output, null, 2));

// Stats
const personCount = graph.filter(n => n['@type'] === 'Person').length;
const objectCount = graph.filter(n => n['@type'] === 'Object').length;
const actionCount = graph.filter(n => n['@type'] === 'Action').length;
console.log(`Generated: ${personCount} persons, ${objectCount} objects, ${actionCount} actions`);
console.log(`Total graph nodes: ${graph.length}`);

// Cohort breakdown
const cohortCounts = new Map<string, number>();
for (const p of persons) {
  cohortCounts.set(p.cohort, (cohortCounts.get(p.cohort) || 0) + 1);
}
console.log('\nCohort breakdown:');
for (const [cohort, count] of cohortCounts) {
  console.log(`  ${cohort}: ${count}`);
}
