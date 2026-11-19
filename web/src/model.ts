export type OrganizationRole = 'viewer' | 'editor' | 'owner';
export type WidgetKind = 'metric' | 'line' | 'area' | 'bar' | 'donut' | 'table' | 'pie' | 'histogram' | 'scatter';
export type DatasetKey = 'commerce' | 'channels';
export type DataSourceProvider = 'sqlServer' | 'mySql' | 'postgreSql' | 'sqlite' | 'elasticsearch';

export interface DataSourceDefinition {
  id: string;
  organizationId: string;
  name: string;
  provider: DataSourceProvider;
  revision: number;
  createdBy: string;
  createdAt: string;
  updatedAt: string;
}

export interface DataSourceDraft {
  name: string;
  provider: DataSourceProvider;
}

export interface Membership {
  id: string;
  name: string;
  role: OrganizationRole;
}

export interface CurrentIdentity {
  userId: string;
  displayName: string;
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
