import { ApiError, type CurrentIdentity, type Dashboard, type DashboardDraft, type DataSourceDefinition, type DataSourceDraft, type Membership } from './model';

async function request<T>(path: string, init?: RequestInit): Promise<T> {
  let response: Response;
  try {
    response = await fetch(`/api${path}`, {
      ...init,
      headers: {
        ...(init?.body ? { 'Content-Type': 'application/json' } : {}),
        ...init?.headers,
      },
    });
  } catch {
    throw new ApiError(0, 'The API is unavailable. Start the .NET service and try again.');
  }

  if (!response.ok) {
    throw new ApiError(response.status, response.status === 401
      ? 'Your session has expired. Sign in to continue.'
      : response.status === 403
        ? 'You do not have permission for this operation.'
        : response.status === 409
          ? 'This resource changed in another session. Reload before editing.'
          : `Request failed (${response.status}).`);
  }

  return response.status === 204 ? undefined as T : await response.json() as T;
}

const prefix = (organizationId: string) =>
  `/organizations/${encodeURIComponent(organizationId)}/dashboards`;

export const dashboardApi = {
  identity: () => request<CurrentIdentity>('/identity'),
  organizations: () => request<Membership[]>('/organizations'),
  list: (organizationId: string) => request<Dashboard[]>(prefix(organizationId)),
  find: (organizationId: string, id: string) => request<Dashboard>(`${prefix(organizationId)}/${id}`),
  create: (organizationId: string, draft: DashboardDraft) => request<Dashboard>(prefix(organizationId), {
    method: 'POST', body: JSON.stringify(draft),
  }),
  update: (organizationId: string, dashboard: Dashboard, draft: DashboardDraft) =>
    request<Dashboard>(`${prefix(organizationId)}/${dashboard.id}`, {
      method: 'PUT',
      body: JSON.stringify({ ...draft, expectedRevision: dashboard.revision }),
    }),
  remove: (organizationId: string, id: string) => request<void>(`${prefix(organizationId)}/${id}`, {
    method: 'DELETE',
  }),
};

const sourcesPrefix = (organizationId: string) =>
  `/organizations/${encodeURIComponent(organizationId)}/data-sources`;

export const dataSourceApi = {
  list: (organizationId: string) => request<DataSourceDefinition[]>(sourcesPrefix(organizationId)),
  find: (organizationId: string, id: string) =>
    request<DataSourceDefinition>(`${sourcesPrefix(organizationId)}/${encodeURIComponent(id)}`),
  create: (organizationId: string, draft: DataSourceDraft) =>
    request<DataSourceDefinition>(sourcesPrefix(organizationId), {
      method: 'POST', body: JSON.stringify(draft),
    }),
  update: (organizationId: string, definition: DataSourceDefinition, name: string) =>
    request<DataSourceDefinition>(`${sourcesPrefix(organizationId)}/${encodeURIComponent(definition.id)}`, {
      method: 'PUT', body: JSON.stringify({ name, expectedRevision: definition.revision }),
    }),
  remove: (organizationId: string, definition: DataSourceDefinition) =>
    request<void>(`${sourcesPrefix(organizationId)}/${encodeURIComponent(definition.id)}?expectedRevision=${definition.revision}`, {
      method: 'DELETE',
    }),
};
