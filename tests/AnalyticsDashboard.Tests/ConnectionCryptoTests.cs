using System.Security.Cryptography;
using AnalyticsDashboard.Application;
using AnalyticsDashboard.Domain;
using AnalyticsDashboard.Infrastructure;

namespace AnalyticsDashboard.Tests;

public sealed class ConnectionCryptoTests
{
    private static readonly Guid SourceId = Guid.Parse("6b4dbf49-3b7d-451e-876c-75eb6327c4e0");

    [Test]
    public void EncryptionIsRandomizedAndBoundToTenantSourceAndProvider()
    {
        var protector = Create("primary", new Dictionary<string, string>
        {
            ["primary"] = FreshKey()
        });
        var first = protector.Protect("credential-canary-1423", "northstar", SourceId,
            DataSourceProvider.PostgreSql);
        var second = protector.Protect("credential-canary-1423", "northstar", SourceId,
            DataSourceProvider.PostgreSql);

        Assert.Multiple(() =>
        {
            Assert.That(first.Ciphertext, Is.Not.EqualTo("credential-canary-1423"));
            Assert.That(first.Nonce, Is.Not.EqualTo(second.Nonce));
            Assert.That(first.Ciphertext, Is.Not.EqualTo(second.Ciphertext));
            Assert.That(protector.Unprotect(first, "northstar", SourceId, DataSourceProvider.PostgreSql),
                Is.EqualTo("credential-canary-1423"));
        });
        Assert.Throws<ConnectionSecurityUnavailableException>(() =>
            protector.Unprotect(first, "other", SourceId, DataSourceProvider.PostgreSql));
        Assert.Throws<ConnectionSecurityUnavailableException>(() =>
            protector.Unprotect(first, "northstar", Guid.NewGuid(), DataSourceProvider.PostgreSql));
        Assert.Throws<ConnectionSecurityUnavailableException>(() =>
            protector.Unprotect(first, "northstar", SourceId, DataSourceProvider.MySql));
        Assert.Throws<ConnectionSecurityUnavailableException>(() =>
            protector.Unprotect(first with { Tag = Convert.ToBase64String(new byte[16]) },
                "northstar", SourceId, DataSourceProvider.PostgreSql));
    }

    [Test]
    public void KeysMayRotateWithoutLosingOlderEnvelopesUntilOldKeyIsRemoved()
    {
        var keys = new Dictionary<string, string> { ["v1"] = FreshKey(), ["v2"] = FreshKey() };
        var old = Create("v1", keys).Protect("credential", "northstar", SourceId,
            DataSourceProvider.SqlServer);
        var rotating = Create("v2", keys);
        var rewrapped = rotating.Protect(rotating.Unprotect(old, "northstar", SourceId,
            DataSourceProvider.SqlServer), "northstar", SourceId, DataSourceProvider.SqlServer);

        Assert.Multiple(() =>
        {
            Assert.That(old.KeyId, Is.EqualTo("v1"));
            Assert.That(rewrapped.KeyId, Is.EqualTo("v2"));
            Assert.That(rotating.Unprotect(rewrapped, "northstar", SourceId,
                DataSourceProvider.SqlServer), Is.EqualTo("credential"));
        });
        Assert.Throws<ConnectionSecurityUnavailableException>(() =>
            Create("v2", new Dictionary<string, string> { ["v2"] = keys["v2"] })
                .Unprotect(old, "northstar", SourceId, DataSourceProvider.SqlServer));
    }

    [Test]
    public void MissingInvalidAndWrongLengthKeysFailClosed()
    {
        var noKeys = Create(null, new Dictionary<string, string>());
        Assert.Throws<ConnectionSecurityUnavailableException>(() =>
            noKeys.Protect("secret", "northstar", SourceId, DataSourceProvider.MySql));
        Assert.Throws<ConnectionSecurityUnavailableException>(() =>
            Create("active", new Dictionary<string, string> { ["active"] = "oops" })
                .Protect("secret", "northstar", SourceId, DataSourceProvider.MySql));
        Assert.Throws<ConnectionSecurityUnavailableException>(() =>
            Create("active", new Dictionary<string, string>
                { ["active"] = Convert.ToBase64String(new byte[8]) })
                .Protect("secret", "northstar", SourceId, DataSourceProvider.MySql));
    }

    private static AesGcmConnectionSecretProtector Create(string? active, Dictionary<string, string> keys) =>
        new(active, keys);

    private static string FreshKey() => Convert.ToBase64String(RandomNumberGenerator.GetBytes(32));
}
