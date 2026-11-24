using AnalyticsDashboard.Application;
using AnalyticsDashboard.Domain;
using AnalyticsDashboard.Infrastructure;
using MySqlConnector;

namespace AnalyticsDashboard.Tests;

[TestFixture]
public sealed class MySqlQueryCompilerTests
{
    private static readonly QueryDataset Sales = new("sales",
    [
        new QueryField("id", QueryValueType.Number),
        new QueryField("region", QueryValueType.Text),
        new QueryField("amount", QueryValueType.Number),
        new QueryField("paid", QueryValueType.Boolean),
        new QueryField("occurred_at", QueryValueType.Timestamp),
        new QueryField("secret", QueryValueType.Text, Filterable: false,
            Groupable: false, Sortable: false, Aggregatable: false)
    ]);

    private static readonly RelationalDatasetBinding Bound = new(Sales, "analytics_fixture", "sales", "id");

    [Test]
    public void ValuesAreBoundAndDialectUsesTrustedIdentifiers()
    {
        const string attack = "' OR 1=1; DROP TABLE sales; -- %_[]";
        var query = new QueryRequest("sales", ["id", "region"],
        [
            new QueryFilter("region", QueryOperator.Contains,
                [new QueryScalar(QueryValueType.Text, Text: attack)]),
            new QueryFilter("amount", QueryOperator.In,
                [new QueryScalar(QueryValueType.Number, Number: 12.5m),
                    new QueryScalar(QueryValueType.Number, Number: 31m)])
        ], Sort: [new QuerySort("region", QuerySortDirection.Ascending)], Limit: 2, Offset: 1);

        var plan = new MySqlQueryCompiler().Compile(Bound, query);
        Assert.Multiple(() =>
        {
            Assert.That(plan.CommandText, Does.StartWith("SELECT "));
            Assert.That(plan.CommandText, Does.Contain("INSTR("));
            Assert.That(plan.CommandText, Does.Contain("LIMIT 2 OFFSET 1"));
            Assert.That(plan.CommandText, Does.Not.Contain(attack));
            Assert.That(plan.Parameters.Select(x => x.Name), Is.EqualTo(new[] { "@p0", "@p1", "@p2" }));
            Assert.That(plan.Parameters[0].Value, Is.EqualTo(attack));
            Assert.That(plan.Limit, Is.EqualTo(2));
        });
        Assert.That(plan.CommandText, Does.Contain("id"));
        Assert.That(plan.CommandText, Does.Contain(((char)96).ToString()));
    }

    [Test]
    public void FactoryBindsNativeParametersAndNormalizesUtc()
    {
        var timestamp = new DateTimeOffset(2026, 11, 15, 8, 30, 0, TimeSpan.FromHours(-8));
        var query = new QueryRequest("sales", ["id"],
        [
            new QueryFilter("occurred_at", QueryOperator.GreaterThanOrEqual,
                [new QueryScalar(QueryValueType.Timestamp, Timestamp: timestamp)]),
            new QueryFilter("paid", QueryOperator.Equal,
                [new QueryScalar(QueryValueType.Boolean, Boolean: true)]),
            new QueryFilter("amount", QueryOperator.GreaterThan,
                [new QueryScalar(QueryValueType.Number, Number: 12.5m)])
        ]);

        var plan = new MySqlQueryCompiler().Compile(Bound, query);
        using var connection = new MySqlConnection();
        using var command = MySqlCommandFactory.Create(connection, plan);
        Assert.Multiple(() =>
        {
            Assert.That(command.Parameters[0].MySqlDbType, Is.EqualTo(MySqlDbType.DateTime));
            Assert.That(command.Parameters[0].Value, Is.EqualTo(timestamp.UtcDateTime));
            Assert.That(command.Parameters[1].Value, Is.EqualTo((short)1));
            Assert.That(command.Parameters[2].MySqlDbType, Is.EqualTo(MySqlDbType.Decimal));
            Assert.That(command.Parameters[2].Value, Is.EqualTo(12.5m));
            Assert.That(command.CommandTimeout, Is.EqualTo(new QueryBudget().TimeoutMilliseconds / 1000));
        });
    }

    [Test]
    public void NonMicrosecondBoundaryIsRejectedRatherThanTruncated()
    {
        var timestamp = new DateTimeOffset(2026, 11, 15, 16, 30, 0, TimeSpan.Zero).AddTicks(1);
        var query = new QueryRequest("sales", ["id"],
            [new QueryFilter("occurred_at", QueryOperator.LessThan,
                [new QueryScalar(QueryValueType.Timestamp, Timestamp: timestamp)])]);
        var plan = new MySqlQueryCompiler().Compile(Bound, query);
        using var connection = new MySqlConnection();
        Assert.Throws<InvalidQueryException>(() => MySqlCommandFactory.Create(connection, plan));
    }

    [Test]
    public void RejectsUnapprovedFieldsBindingsAndForeignPlans()
    {
        var compiler = new MySqlQueryCompiler();
        var query = new QueryRequest("sales", ["id"]);
        Assert.Throws<InvalidQueryException>(() => compiler.Compile(
            Bound with { Table = "sales;DROP" }, query));
        Assert.Throws<InvalidQueryException>(() => compiler.Compile(
            Bound with { StableOrderField = "unknown" }, query));
        Assert.Throws<InvalidQueryException>(() => compiler.Compile(Bound,
            new QueryRequest("sales", ["id"],
                [new QueryFilter("secret", QueryOperator.Equal,
                    [new QueryScalar(QueryValueType.Text, Text: "x")])])));
        Assert.Throws<InvalidQueryException>(() => compiler.Compile(Bound,
            new QueryRequest("sales", ["id"], Limit: 501)));
        using var connection = new MySqlConnection();
        var foreign = new PostgreSqlQueryCompiler().Compile(Bound, query);
        Assert.Throws<InvalidQueryException>(() => MySqlCommandFactory.Create(connection, foreign));
    }
}
