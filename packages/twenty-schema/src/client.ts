// Minimal GraphQL client for Twenty Metadata API.
// No graphql-request dep — we don't need fragments or subscriptions for seeding.

export interface TwentyClientConfig {
  metadata_url: string; // e.g. http://localhost:3000/metadata
  api_token: string;
  workspace_id?: string;
}

export interface GqlResponse<T> {
  data?: T;
  errors?: { message: string; path?: string[] }[];
}

export class TwentyMetadataClient {
  constructor(private cfg: TwentyClientConfig) {}

  async query<T>(query: string, variables: Record<string, unknown> = {}): Promise<GqlResponse<T>> {
    const res = await fetch(this.cfg.metadata_url, {
      method: 'POST',
      headers: {
        'content-type': 'application/json',
        authorization: `Bearer ${this.cfg.api_token}`,
      },
      body: JSON.stringify({ query, variables }),
    });
    if (!res.ok) {
      const text = await res.text().catch(() => '');
      return {
        errors: [{ message: `HTTP ${res.status}: ${text.slice(0, 300)}` }],
      };
    }
    return (await res.json()) as GqlResponse<T>;
  }

  async listObjects(): Promise<{ id: string; nameSingular: string; namePlural: string }[]> {
    const q = /* GraphQL */ `
      query {
        objects(paging: { first: 200 }) {
          edges {
            node {
              id
              nameSingular
              namePlural
              isCustom
            }
          }
        }
      }
    `;
    const res = await this.query<{
      objects: { edges: { node: { id: string; nameSingular: string; namePlural: string } }[] };
    }>(q);
    if (res.errors || !res.data) return [];
    return res.data.objects.edges.map((e) => e.node);
  }

  async createObject(input: {
    nameSingular: string;
    namePlural: string;
    labelSingular: string;
    labelPlural: string;
    description: string;
    icon: string;
  }): Promise<{ id: string } | { error: string }> {
    const m = /* GraphQL */ `
      mutation CreateObject($input: CreateObjectInput!) {
        createOneObject(input: $input) {
          id
          nameSingular
        }
      }
    `;
    const res = await this.query<{ createOneObject: { id: string } }>(m, {
      input: { object: input },
    });
    if (res.errors) return { error: res.errors.map((e) => e.message).join('; ') };
    return res.data ? { id: res.data.createOneObject.id } : { error: 'no_data' };
  }

  async createField(input: {
    objectMetadataId: string;
    name: string;
    label: string;
    description?: string;
    type: string;
    isNullable?: boolean;
    defaultValue?: unknown;
    options?: unknown[];
    settings?: Record<string, unknown>;
  }): Promise<{ id: string } | { error: string }> {
    const m = /* GraphQL */ `
      mutation CreateField($input: CreateFieldInput!) {
        createOneField(input: $input) {
          id
          name
        }
      }
    `;
    const res = await this.query<{ createOneField: { id: string } }>(m, {
      input: { field: input },
    });
    if (res.errors) return { error: res.errors.map((e) => e.message).join('; ') };
    return res.data ? { id: res.data.createOneField.id } : { error: 'no_data' };
  }

  async createRelation(input: {
    fromObjectMetadataId: string;
    toObjectMetadataId: string;
    fromName: string;
    fromLabel: string;
    fromDescription?: string;
    toName: string;
    toLabel: string;
    toDescription?: string;
    relationType: 'ONE_TO_MANY' | 'MANY_TO_ONE' | 'ONE_TO_ONE';
  }): Promise<{ id: string } | { error: string }> {
    const m = /* GraphQL */ `
      mutation CreateRelation($input: CreateRelationInput!) {
        createOneRelation(input: $input) {
          id
        }
      }
    `;
    const res = await this.query<{ createOneRelation: { id: string } }>(m, {
      input: { relation: input },
    });
    if (res.errors) return { error: res.errors.map((e) => e.message).join('; ') };
    return res.data ? { id: res.data.createOneRelation.id } : { error: 'no_data' };
  }
}
