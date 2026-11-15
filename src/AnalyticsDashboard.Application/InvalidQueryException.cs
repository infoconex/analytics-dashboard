namespace AnalyticsDashboard.Application;

public sealed class InvalidQueryException(string message) : Exception(message);
