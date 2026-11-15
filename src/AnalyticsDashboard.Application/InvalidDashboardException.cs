namespace AnalyticsDashboard.Application;

public sealed class InvalidDashboardException(string message) : Exception(message);
