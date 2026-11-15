using AnalyticsDashboard.Application;
using AnalyticsDashboard.Infrastructure;

namespace AnalyticsDashboard.Tests;

public sealed class SqliteFilePolicyTests
{
    private string root = null!;
    private string allowed = null!;

    [SetUp]
    public void SetUp()
    {
        root = Path.Combine(Path.GetTempPath(), $"analytics-allowed-{Guid.NewGuid():N}");
        Directory.CreateDirectory(root);
        allowed = Path.Combine(root, "customer.sqlite");
        File.WriteAllText(allowed, "fixture");
    }

    [TearDown]
    public void TearDown()
    {
        Directory.Delete(root, recursive: true);
    }

    [Test]
    public void OnlyConfiguredIdsForExistingRegularFilesInsideRootAreAccepted()
    {
        var policy = new MappedSqliteFilePolicy(root,
            new Dictionary<string, string> { ["customer"] = allowed }, Path.Combine(root, "catalog.db"));
        Assert.DoesNotThrow(() => policy.Validate("customer"));
        foreach (var id in new[] { "../customer", allowed, "missing", "", "bad/id" })
            Assert.Throws<InvalidConnectionException>(() => policy.Validate(id));
        Assert.Throws<InvalidConnectionException>(() =>
            new MappedSqliteFilePolicy(root, new Dictionary<string, string> { ["bad"] =
                Path.Combine(root, "..", "outside.sqlite") }, "catalog.db").Validate("bad"));
        Assert.Throws<InvalidConnectionException>(() =>
            new MappedSqliteFilePolicy(root, new Dictionary<string, string> { ["catalog"] = allowed },
                allowed).Validate("catalog"));
    }

    [Test]
    public void SymlinksAndDirectoriesCannotBeMappedAsCustomerFiles()
    {
        Assert.Throws<InvalidConnectionException>(() =>
            new MappedSqliteFilePolicy(root, new Dictionary<string, string> { ["dir"] = root },
                Path.Combine(root, "metadata.db")).Validate("dir"));

        var symlink = Path.Combine(root, "alias.sqlite");
        try
        {
            File.CreateSymbolicLink(symlink, allowed);
        }
        catch (Exception ex) when (ex is UnauthorizedAccessException or PlatformNotSupportedException or IOException)
        {
            Assert.Ignore("This test runner does not permit symlink creation.");
            return;
        }
        Assert.Throws<InvalidConnectionException>(() =>
            new MappedSqliteFilePolicy(root, new Dictionary<string, string> { ["link"] = symlink },
                Path.Combine(root, "metadata.db")).Validate("link"));
    }
}
