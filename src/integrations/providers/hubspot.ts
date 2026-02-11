import { BaseIntegration } from '../base-integration.js';
import type { CredentialStore } from '../credential-store.js';
import type { ITool, ToolDefinition, ToolResult, ToolExecutionContext } from '../../tools/types.js';

const BASE_URL = 'https://api.hubapi.com';

export class HubSpotIntegration extends BaseIntegration {
  readonly provider = 'hubspot' as const;
  readonly credentialType = 'oauth2' as const;

  constructor(credentialStore: CredentialStore) {
    super(credentialStore);
  }

  getTools(): ITool[] {
    return [
      new HubSpotSearchContactsTool(this),
      new HubSpotGetContactTool(this),
      new HubSpotCreateContactTool(this),
      new HubSpotSearchDealsTool(this),
      new HubSpotCreateDealTool(this),
      new HubSpotGetCompanyTool(this),
    ];
  }

  async request(path: string, options: { method?: string; body?: unknown; agentId?: string } = {}) {
    return this.apiRequest(`${BASE_URL}${path}`, options);
  }
}

class HubSpotSearchContactsTool implements ITool {
  constructor(private integration: HubSpotIntegration) {}
  definition: ToolDefinition = {
    name: 'hubspot_search_contacts',
    description: 'Search HubSpot contacts by name, email, or other properties.',
    parameters: {
      type: 'object',
      properties: {
        query: { type: 'string', description: 'Search query' },
        limit: { type: 'number', description: 'Max results (default: 10)' },
        properties: { type: 'array', description: 'Properties to include', items: { type: 'string' } },
      },
      required: ['query'],
    },
    category: 'hubspot',
  };
  async execute(args: Record<string, unknown>, context: ToolExecutionContext): Promise<ToolResult> {
    const query = args['query'] as string;
    const limit = (args['limit'] as number) ?? 10;
    const properties = (args['properties'] as string[]) ?? ['firstname', 'lastname', 'email', 'phone', 'company', 'lifecyclestage'];
    const res = await this.integration.request('/crm/v3/objects/contacts/search', {
      method: 'POST',
      body: {
        query,
        limit,
        properties,
      },
      agentId: context.agentId,
    });
    const data = await res.json() as { results: Array<{ id: string; properties: Record<string, string> }> };
    if (!res.ok) return { success: false, output: JSON.stringify(data) };
    return { success: true, output: JSON.stringify(data.results ?? [], null, 2) };
  }
}

class HubSpotGetContactTool implements ITool {
  constructor(private integration: HubSpotIntegration) {}
  definition: ToolDefinition = {
    name: 'hubspot_get_contact',
    description: 'Get details of a specific HubSpot contact.',
    parameters: {
      type: 'object',
      properties: {
        contactId: { type: 'string', description: 'Contact ID' },
        properties: { type: 'array', description: 'Properties to include', items: { type: 'string' } },
      },
      required: ['contactId'],
    },
    category: 'hubspot',
  };
  async execute(args: Record<string, unknown>, context: ToolExecutionContext): Promise<ToolResult> {
    const contactId = args['contactId'] as string;
    const properties = (args['properties'] as string[]) ?? ['firstname', 'lastname', 'email', 'phone', 'company', 'lifecyclestage', 'hs_lead_status'];
    const params = properties.map(p => `properties=${encodeURIComponent(p)}`).join('&');
    const res = await this.integration.request(`/crm/v3/objects/contacts/${contactId}?${params}`, {
      agentId: context.agentId,
    });
    const data = await res.json() as Record<string, unknown>;
    if (!res.ok) return { success: false, output: JSON.stringify(data) };
    return { success: true, output: JSON.stringify(data, null, 2) };
  }
}

class HubSpotCreateContactTool implements ITool {
  constructor(private integration: HubSpotIntegration) {}
  definition: ToolDefinition = {
    name: 'hubspot_create_contact',
    description: 'Create a new contact in HubSpot.',
    parameters: {
      type: 'object',
      properties: {
        email: { type: 'string', description: 'Email address' },
        firstName: { type: 'string', description: 'First name' },
        lastName: { type: 'string', description: 'Last name' },
        phone: { type: 'string', description: 'Phone number' },
        company: { type: 'string', description: 'Company name' },
        lifecycleStage: { type: 'string', description: 'Lifecycle stage (e.g., "lead", "customer")' },
      },
      required: ['email'],
    },
    category: 'hubspot',
    requiresApproval: true,
    approvalReason: 'Creating a contact in HubSpot CRM',
  };
  async execute(args: Record<string, unknown>, context: ToolExecutionContext): Promise<ToolResult> {
    const properties: Record<string, string> = { email: args['email'] as string };
    if (args['firstName']) properties['firstname'] = args['firstName'] as string;
    if (args['lastName']) properties['lastname'] = args['lastName'] as string;
    if (args['phone']) properties['phone'] = args['phone'] as string;
    if (args['company']) properties['company'] = args['company'] as string;
    if (args['lifecycleStage']) properties['lifecyclestage'] = args['lifecycleStage'] as string;

    const res = await this.integration.request('/crm/v3/objects/contacts', {
      method: 'POST',
      body: { properties },
      agentId: context.agentId,
    });
    const data = await res.json() as { id: string };
    if (!res.ok) return { success: false, output: JSON.stringify(data) };
    return { success: true, output: `Contact created (ID: ${data.id})` };
  }
}

class HubSpotSearchDealsTool implements ITool {
  constructor(private integration: HubSpotIntegration) {}
  definition: ToolDefinition = {
    name: 'hubspot_search_deals',
    description: 'Search HubSpot deals by name or properties.',
    parameters: {
      type: 'object',
      properties: {
        query: { type: 'string', description: 'Search query' },
        limit: { type: 'number', description: 'Max results (default: 10)' },
      },
      required: ['query'],
    },
    category: 'hubspot',
  };
  async execute(args: Record<string, unknown>, context: ToolExecutionContext): Promise<ToolResult> {
    const query = args['query'] as string;
    const limit = (args['limit'] as number) ?? 10;
    const res = await this.integration.request('/crm/v3/objects/deals/search', {
      method: 'POST',
      body: {
        query,
        limit,
        properties: ['dealname', 'amount', 'dealstage', 'pipeline', 'closedate', 'hs_lastmodifieddate'],
      },
      agentId: context.agentId,
    });
    const data = await res.json() as { results: Array<{ id: string; properties: Record<string, string> }> };
    if (!res.ok) return { success: false, output: JSON.stringify(data) };
    return { success: true, output: JSON.stringify(data.results ?? [], null, 2) };
  }
}

class HubSpotCreateDealTool implements ITool {
  constructor(private integration: HubSpotIntegration) {}
  definition: ToolDefinition = {
    name: 'hubspot_create_deal',
    description: 'Create a new deal in HubSpot.',
    parameters: {
      type: 'object',
      properties: {
        dealName: { type: 'string', description: 'Deal name' },
        pipeline: { type: 'string', description: 'Pipeline ID' },
        dealStage: { type: 'string', description: 'Deal stage ID' },
        amount: { type: 'string', description: 'Deal amount' },
        closeDate: { type: 'string', description: 'Expected close date (YYYY-MM-DD)' },
      },
      required: ['dealName'],
    },
    category: 'hubspot',
    requiresApproval: true,
    approvalReason: 'Creating a deal in HubSpot CRM',
  };
  async execute(args: Record<string, unknown>, context: ToolExecutionContext): Promise<ToolResult> {
    const properties: Record<string, string> = { dealname: args['dealName'] as string };
    if (args['pipeline']) properties['pipeline'] = args['pipeline'] as string;
    if (args['dealStage']) properties['dealstage'] = args['dealStage'] as string;
    if (args['amount']) properties['amount'] = args['amount'] as string;
    if (args['closeDate']) properties['closedate'] = args['closeDate'] as string;

    const res = await this.integration.request('/crm/v3/objects/deals', {
      method: 'POST',
      body: { properties },
      agentId: context.agentId,
    });
    const data = await res.json() as { id: string };
    if (!res.ok) return { success: false, output: JSON.stringify(data) };
    return { success: true, output: `Deal created (ID: ${data.id})` };
  }
}

class HubSpotGetCompanyTool implements ITool {
  constructor(private integration: HubSpotIntegration) {}
  definition: ToolDefinition = {
    name: 'hubspot_get_company',
    description: 'Get details of a HubSpot company.',
    parameters: {
      type: 'object',
      properties: {
        companyId: { type: 'string', description: 'Company ID' },
      },
      required: ['companyId'],
    },
    category: 'hubspot',
  };
  async execute(args: Record<string, unknown>, context: ToolExecutionContext): Promise<ToolResult> {
    const companyId = args['companyId'] as string;
    const props = ['name', 'domain', 'industry', 'numberofemployees', 'annualrevenue', 'city', 'state', 'country'];
    const params = props.map(p => `properties=${encodeURIComponent(p)}`).join('&');
    const res = await this.integration.request(`/crm/v3/objects/companies/${companyId}?${params}`, {
      agentId: context.agentId,
    });
    const data = await res.json() as Record<string, unknown>;
    if (!res.ok) return { success: false, output: JSON.stringify(data) };
    return { success: true, output: JSON.stringify(data, null, 2) };
  }
}
