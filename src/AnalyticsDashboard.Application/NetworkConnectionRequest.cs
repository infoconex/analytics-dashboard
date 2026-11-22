namespace AnalyticsDashboard.Application;

public sealed record NetworkConnectionRequest(string Host, int Port, string? Database, string? Username);
