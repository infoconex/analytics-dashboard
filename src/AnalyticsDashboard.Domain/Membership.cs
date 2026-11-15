namespace AnalyticsDashboard.Domain;

public sealed record Membership(string OrganizationId, string UserId, OrganizationRole Role);
