using AnalyticsDashboard.Application;

namespace AnalyticsDashboard.Infrastructure;

public sealed class MappedSqliteFilePolicy(
    string? root, IReadOnlyDictionary<string, string> files, string metadataCatalogPath) : ISqliteFilePolicy
{
    public void Validate(string fileId)
    {
        if (string.IsNullOrWhiteSpace(fileId) || fileId.Length > 80
            || fileId.Any(c => !(char.IsAsciiLetterOrDigit(c) || c is '-' or '_'))
            || !files.TryGetValue(fileId, out var mappedPath) || string.IsNullOrWhiteSpace(root))
            throw new InvalidConnectionException("SQLite file is not approved.");

        try
        {
            if (!Path.IsPathFullyQualified(root) || !Path.IsPathFullyQualified(mappedPath))
                throw new InvalidConnectionException("SQLite file is not approved.");
            var boundary = Path.TrimEndingDirectorySeparator(Path.GetFullPath(root));
            var path = Path.GetFullPath(mappedPath);
            var prefix = boundary + Path.DirectorySeparatorChar;
            if (!path.StartsWith(prefix, PathComparison)
                || string.Equals(path, Path.GetFullPath(metadataCatalogPath), PathComparison)
                || (File.GetAttributes(boundary) & FileAttributes.ReparsePoint) != 0)
                throw new InvalidConnectionException("SQLite file is not approved.");

            // The mapped target and every directory beneath the approved root must be real.
            var relative = Path.GetRelativePath(boundary, path);
            var cursor = boundary;
            foreach (var component in relative.Split(Path.DirectorySeparatorChar))
            {
                cursor = Path.Combine(cursor, component);
                if ((File.GetAttributes(cursor) & FileAttributes.ReparsePoint) != 0)
                    throw new InvalidConnectionException("SQLite file is not approved.");
            }
            if ((File.GetAttributes(path) & FileAttributes.Directory) != 0)
                throw new InvalidConnectionException("SQLite file is not approved.");
        }
        catch (Exception ex) when (ex is IOException or UnauthorizedAccessException or ArgumentException)
        {
            throw new InvalidConnectionException("SQLite file is not approved.");
        }
    }

    private static StringComparison PathComparison => OperatingSystem.IsWindows()
        ? StringComparison.OrdinalIgnoreCase : StringComparison.Ordinal;
}
