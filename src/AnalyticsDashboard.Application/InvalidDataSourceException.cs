namespace AnalyticsDashboard.Application;

public sealed class InvalidDataSourceException(string message) : Exception(message);
