using System.Net;
using AnalyticsDashboard.Application;
using AnalyticsDashboard.Domain;
using AnalyticsDashboard.Infrastructure;

namespace AnalyticsDashboard.Tests;

public sealed class ConnectionDestinationPolicyTests
{
    private sealed class FixedResolver(params IPAddress[] answers) : IDnsResolver
    {
        public Task<IPAddress[]> ResolveAsync(string host, CancellationToken token) =>
            Task.FromResult(answers);
    }

    [Test]
    public async Task ExactAllowlistAndPublicDnsAreBothRequired()
    {
        var policy = Create(new[] { IPAddress.Parse("8.8.8.8") });
        var approved = await policy.ValidateAsync(DataSourceProvider.PostgreSql,
            new NetworkConnectionDetails("DB.Example.Com", 5432, "analytics", "reader"), CancellationToken.None);

        Assert.Multiple(() =>
        {
            Assert.That(approved.Host, Is.EqualTo("db.example.com"));
            Assert.That(approved.Addresses, Has.Count.EqualTo(1));
        });
        Assert.ThrowsAsync<InvalidConnectionException>(async () =>
            await policy.ValidateAsync(DataSourceProvider.MySql,
                new NetworkConnectionDetails("db.example.com", 5432, "a", "b"), CancellationToken.None));
        Assert.ThrowsAsync<InvalidConnectionException>(async () =>
            await policy.ValidateAsync(DataSourceProvider.PostgreSql,
                new NetworkConnectionDetails("db.example.com", 5433, "a", "b"), CancellationToken.None));
    }

    [TestCase("127.0.0.1")]
    [TestCase("10.0.1.2")]
    [TestCase("172.16.0.1")]
    [TestCase("192.168.20.1")]
    [TestCase("169.254.169.254")]
    [TestCase("100.64.0.1")]
    [TestCase("192.0.2.1")]
    [TestCase("198.51.100.10")]
    [TestCase("203.0.113.3")]
    [TestCase("224.0.0.1")]
    [TestCase("::1")]
    [TestCase("fc00::1")]
    [TestCase("fe80::1")]
    [TestCase("2001:db8::1")]
    [TestCase("::ffff:8.8.8.8")]
    public void NonPublicDnsAnswersAreRejected(string ip)
    {
        var policy = Create([IPAddress.Parse(ip)]);
        Assert.ThrowsAsync<InvalidConnectionException>(async () =>
            await policy.ValidateAsync(DataSourceProvider.PostgreSql,
                new NetworkConnectionDetails("db.example.com", 5432, "analytics", "reader"),
                CancellationToken.None));
    }

    [Test]
    public void MixedOrMissingDnsAnswersAreRejected()
    {
        foreach (var answers in new[]
        {
            Array.Empty<IPAddress>(),
            new[] { IPAddress.Parse("8.8.8.8"), IPAddress.Parse("169.254.169.254") },
            Enumerable.Repeat(IPAddress.Parse("8.8.8.8"), 17).ToArray()
        })
        {
            var policy = Create(answers);
            Assert.ThrowsAsync<InvalidConnectionException>(async () =>
                await policy.ValidateAsync(DataSourceProvider.PostgreSql,
                    new NetworkConnectionDetails("db.example.com", 5432, "a", "b"),
                    CancellationToken.None));
        }
    }

    [TestCase("http://db.example.com")]
    [TestCase("alice:password@db.example.com")]
    [TestCase("localhost")]
    [TestCase("localhost.local")]
    [TestCase("127.0.0.1")]
    [TestCase("[::1]")]
    [TestCase("db.example.com.")]
    [TestCase("db..example.com")]
    [TestCase("*.example.com")]
    [TestCase("db.example.com:5432")]
    [TestCase("db.internal")]
    [TestCase("db.example.com/other")]
    [TestCase("db.example.com%00")]
    public void MalformedHostsAreRejected(string host)
    {
        Assert.Throws<InvalidConnectionException>(() => ApprovedDestinationPolicy.CanonicalHost(host));
    }

    [Test]
    public void PublicIpv4AndIpv6AddressesAreRecognized()
    {
        Assert.Multiple(() =>
        {
            Assert.That(PublicIpAddress.IsAllowed(IPAddress.Parse("8.8.8.8")), Is.True);
            Assert.That(PublicIpAddress.IsAllowed(IPAddress.Parse("2001:4860:4860::8888")), Is.True);
        });
    }

    private static ApprovedDestinationPolicy Create(IPAddress[] answers) => new(
        new Dictionary<DataSourceProvider, IReadOnlySet<string>>
        {
            [DataSourceProvider.PostgreSql] = new HashSet<string> { "db.example.com:5432" }
        }, new FixedResolver(answers));
}
