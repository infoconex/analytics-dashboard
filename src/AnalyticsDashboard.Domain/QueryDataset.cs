namespace AnalyticsDashboard.Domain;

public sealed record QueryDataset(string Name, IReadOnlyList<QueryField> Fields);
