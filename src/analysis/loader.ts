import { readFile } from 'fs/promises';

export interface PersonRecord {
  '@type': 'Person';
  userID: string;
  givenName?: string;
  familyName?: string;
  primaryEmail?: string;
  engagementScore?: number;
  tags?: string[];
  dataSource: string;
  location?: {
    postalCode?: string;
    addressLocality?: string;
    addressCountry?: string;
  };
  behavior?: {
    donorStatus?: string;
    lastDonationDate?: string;
  };
  interests?: {
    topics?: string[];
    commentedOn?: string[];
  };
  demographics?: {
    ageGroup?: string;
    gender?: string;
  };
}

export interface ObjectRecord {
  '@type': 'Object';
  objectID: string;
  title?: string;
  type?: string;
  subType?: string;
  published?: string;
  subject?: string[];
  responses?: Array<{ question: string; answer: string }>;
  dataSource: string;
}

export interface ActionRecord {
  '@type': 'Action';
  actionType: string;
  person: string;
  object: string;
  published: string;
  timeSpent?: string;
  completionRate?: number;
  dataSource: string;
  referrer?: string;
}

export interface AudienceData {
  persons: PersonRecord[];
  objects: ObjectRecord[];
  actions: ActionRecord[];
  personMap: Map<string, PersonRecord>;
  objectMap: Map<string, ObjectRecord>;
  personActions: Map<string, ActionRecord[]>;
}

export async function loadAudienceData(filePath: string): Promise<AudienceData> {
  const raw = await readFile(filePath, 'utf-8');
  const data = JSON.parse(raw);

  const graph: Array<Record<string, unknown>> = data['@graph'] || [];

  const persons: PersonRecord[] = [];
  const objects: ObjectRecord[] = [];
  const actions: ActionRecord[] = [];

  for (const node of graph) {
    switch (node['@type']) {
      case 'Person':
        persons.push(node as unknown as PersonRecord);
        break;
      case 'Object':
        objects.push(node as unknown as ObjectRecord);
        break;
      case 'Action':
        actions.push(node as unknown as ActionRecord);
        break;
    }
  }

  const personMap = new Map(persons.map(p => [p.userID, p]));
  const objectMap = new Map(objects.map(o => [o.objectID, o]));

  const personActions = new Map<string, ActionRecord[]>();
  for (const action of actions) {
    const existing = personActions.get(action.person) || [];
    existing.push(action);
    personActions.set(action.person, existing);
  }

  return { persons, objects, actions, personMap, objectMap, personActions };
}
