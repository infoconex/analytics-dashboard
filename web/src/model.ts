export type OrganizationRole = 'viewer' | 'editor' | 'owner';
export type WidgetKind = 'metric' | 'line' | 'area' | 'bar' | 'donut' | 'table';
export type DatasetKey = 'commerce' | 'channels';

export interface Membership {
  id: string;
  name: string;
  role: OrganizationRole;
}

export interface DashboardWidget {
  id: string;
  title: string;
  kind: WidgetKind;
  datasetKey: DatasetKey;
  metricKey: string;
  dimensionKey: string;
}

export interface Dashboard {
  id: string;
  organizationId: string;
  name: string;
  description: string;
  widgets: DashboardWidget[];
  revision: number;
  createdBy: string;
  createdAt: string;
  updatedAt: string;
}

export interface DashboardDraft {
  name: string;
  description: string;
  widgets: DashboardWidget[];
}

export class ApiError extends Error {
  constructor(public readonly status: number, message: string) {
    super(message);
    this.name = 'ApiError';
  }
}
