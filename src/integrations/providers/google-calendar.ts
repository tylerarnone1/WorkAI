import { BaseIntegration } from '../base-integration.js';
import type { CredentialStore } from '../credential-store.js';
import type { ITool, ToolDefinition, ToolResult, ToolExecutionContext } from '../../tools/types.js';

const BASE_URL = 'https://www.googleapis.com/calendar/v3';

export class GoogleCalendarIntegration extends BaseIntegration {
  readonly provider = 'google_calendar' as const;
  readonly credentialType = 'oauth2' as const;

  constructor(credentialStore: CredentialStore) {
    super(credentialStore);
  }

  getTools(): ITool[] {
    return [
      new CalendarListEventsTool(this),
      new CalendarCreateEventTool(this),
      new CalendarGetFreeBusyTool(this),
    ];
  }

  async request(path: string, options: { method?: string; body?: unknown; agentId?: string } = {}) {
    return this.apiRequest(`${BASE_URL}${path}`, options);
  }
}

class CalendarListEventsTool implements ITool {
  constructor(private integration: GoogleCalendarIntegration) {}
  definition: ToolDefinition = {
    name: 'calendar_list_events',
    description: 'List upcoming calendar events. Shows meetings, their times, attendees, and locations.',
    parameters: {
      type: 'object',
      properties: {
        calendarId: { type: 'string', description: 'Calendar ID (default: "primary")' },
        maxResults: { type: 'number', description: 'Max events to return (default: 10)' },
        timeMin: { type: 'string', description: 'Start time (ISO 8601). Defaults to now.' },
        timeMax: { type: 'string', description: 'End time (ISO 8601). Defaults to 7 days from now.' },
      },
    },
    category: 'google_calendar',
  };
  async execute(args: Record<string, unknown>, context: ToolExecutionContext): Promise<ToolResult> {
    const calendarId = (args['calendarId'] as string) ?? 'primary';
    const maxResults = (args['maxResults'] as number) ?? 10;
    const timeMin = (args['timeMin'] as string) ?? new Date().toISOString();
    const timeMax = (args['timeMax'] as string) ?? new Date(Date.now() + 7 * 86400000).toISOString();
    const params = `timeMin=${encodeURIComponent(timeMin)}&timeMax=${encodeURIComponent(timeMax)}&maxResults=${maxResults}&singleEvents=true&orderBy=startTime`;
    const res = await this.integration.request(`/calendars/${encodeURIComponent(calendarId)}/events?${params}`, { agentId: context.agentId });
    const data = await res.json() as { items: Array<{ summary: string; start: { dateTime: string }; end: { dateTime: string }; attendees?: Array<{ email: string }>; location?: string; htmlLink: string }> };
    if (!res.ok) return { success: false, output: JSON.stringify(data) };
    const events = (data.items ?? []).map(e => ({
      title: e.summary,
      start: e.start?.dateTime,
      end: e.end?.dateTime,
      attendees: e.attendees?.map(a => a.email),
      location: e.location,
      link: e.htmlLink,
    }));
    return { success: true, output: JSON.stringify(events, null, 2) };
  }
}

class CalendarCreateEventTool implements ITool {
  constructor(private integration: GoogleCalendarIntegration) {}
  definition: ToolDefinition = {
    name: 'calendar_create_event',
    description: 'Create a new calendar event.',
    parameters: {
      type: 'object',
      properties: {
        summary: { type: 'string', description: 'Event title' },
        description: { type: 'string', description: 'Event description' },
        startTime: { type: 'string', description: 'Start time (ISO 8601)' },
        endTime: { type: 'string', description: 'End time (ISO 8601)' },
        attendees: { type: 'array', description: 'Email addresses of attendees', items: { type: 'string' } },
        location: { type: 'string', description: 'Event location or meeting link' },
      },
      required: ['summary', 'startTime', 'endTime'],
    },
    category: 'google_calendar',
    requiresApproval: true,
    approvalReason: 'Creating a calendar event and potentially inviting attendees',
  };
  async execute(args: Record<string, unknown>, context: ToolExecutionContext): Promise<ToolResult> {
    const attendees = (args['attendees'] as string[])?.map(email => ({ email }));
    const res = await this.integration.request('/calendars/primary/events', {
      method: 'POST',
      body: {
        summary: args['summary'],
        description: args['description'],
        start: { dateTime: args['startTime'], timeZone: 'UTC' },
        end: { dateTime: args['endTime'], timeZone: 'UTC' },
        attendees,
        location: args['location'],
      },
      agentId: context.agentId,
    });
    const data = await res.json() as { htmlLink: string; id: string };
    if (!res.ok) return { success: false, output: JSON.stringify(data) };
    return { success: true, output: `Event created: ${data.htmlLink}` };
  }
}

class CalendarGetFreeBusyTool implements ITool {
  constructor(private integration: GoogleCalendarIntegration) {}
  definition: ToolDefinition = {
    name: 'calendar_free_busy',
    description: 'Check free/busy status for calendars. Useful for finding available meeting times.',
    parameters: {
      type: 'object',
      properties: {
        timeMin: { type: 'string', description: 'Start of window (ISO 8601)' },
        timeMax: { type: 'string', description: 'End of window (ISO 8601)' },
        emails: { type: 'array', description: 'Email addresses to check', items: { type: 'string' } },
      },
      required: ['timeMin', 'timeMax'],
    },
    category: 'google_calendar',
  };
  async execute(args: Record<string, unknown>, context: ToolExecutionContext): Promise<ToolResult> {
    const emails = (args['emails'] as string[]) ?? ['primary'];
    const res = await this.integration.request('/freeBusy', {
      method: 'POST',
      body: {
        timeMin: args['timeMin'],
        timeMax: args['timeMax'],
        items: emails.map(id => ({ id })),
      },
      agentId: context.agentId,
    });
    const data = await res.json() as Record<string, unknown>;
    if (!res.ok) return { success: false, output: JSON.stringify(data) };
    return { success: true, output: JSON.stringify(data, null, 2) };
  }
}
