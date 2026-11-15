import { ApiError, type Dashboard, type DashboardDraft, type Membership } from './model';

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
          ? 'This dashboard changed in another session. Reload before editing.'
          : `Request failed (${response.status}).`);
  }

  return response.status === 204 ? undefined as T : await response.json() as T;
}

const prefix = (organizationId: string) =>
  `/organizations/${encodeURIComponent(organizationId)}/dashboards`;

export const dashboardApi = {
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
