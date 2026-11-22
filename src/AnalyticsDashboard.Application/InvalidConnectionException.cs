namespace AnalyticsDashboard.Application;

public sealed class InvalidConnectionException(string message) : Exception(message);
