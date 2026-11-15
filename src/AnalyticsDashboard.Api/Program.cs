using System.Security.Claims;
using System.Text.Json;
using System.Text.Json.Serialization;
using AnalyticsDashboard.Api;
using AnalyticsDashboard.Application;
using AnalyticsDashboard.Domain;
using AnalyticsDashboard.Infrastructure;
using Microsoft.AspNetCore.Authentication;
using Microsoft.AspNetCore.Authentication.JwtBearer;
using Microsoft.AspNetCore.Diagnostics;
using Microsoft.AspNetCore.Mvc;

var builder = WebApplication.CreateBuilder(args);

builder.Services.ConfigureHttpJsonOptions(options =>
{
    options.SerializerOptions.Converters.Add(
        new JsonStringEnumConverter(JsonNamingPolicy.CamelCase, allowIntegerValues: false));
    options.SerializerOptions.UnmappedMemberHandling = JsonUnmappedMemberHandling.Disallow;
});

var demoIdentityEnabled = builder.Environment.IsDevelopment()
    && builder.Configuration.GetValue<bool>("DevelopmentIdentity:Enabled");

if (demoIdentityEnabled)
{
    builder.Services.AddAuthentication("Development")
        .AddScheme<AuthenticationSchemeOptions, DevelopmentAuthenticationHandler>(
            "Development", _ => { });
}
else
{
    var issuer = builder.Configuration["Authentication:Authority"];
    var audience = builder.Configuration["Authentication:Audience"];
    if (string.IsNullOrWhiteSpace(issuer) || string.IsNullOrWhiteSpace(audience))
    {
        throw new InvalidOperationException(
            "Authentication:Authority and Authentication:Audience must be configured. "
            + "Development identity is never available outside Development.");
    }

    builder.Services.AddAuthentication(JwtBearerDefaults.AuthenticationScheme)
        .AddJwtBearer(options =>
        {
            options.Authority = issuer;
            options.Audience = audience;
            options.RequireHttpsMetadata = true;
            options.MapInboundClaims = false;
        });
}

builder.Services.AddAuthorization();
var allowedOrigins = builder.Configuration.GetSection("Cors:AllowedOrigins").Get<string[]>() ?? [];
builder.Services.AddCors(options => options.AddDefaultPolicy(policy =>
    policy.WithOrigins(allowedOrigins).AllowAnyHeader().AllowAnyMethod()));

builder.Services.AddSingleton(_ => new SqliteCatalog(
    builder.Configuration["Catalog:Path"] ?? "data/catalog.db"));
builder.Services.AddSingleton<IDashboardRepository>(provider =>
    provider.GetRequiredService<SqliteCatalog>());
builder.Services.AddSingleton(_ => new SqliteDataSourceRepository(
    builder.Configuration["Catalog:Path"] ?? "data/catalog.db"));
builder.Services.AddSingleton<IDataSourceRepository>(provider =>
    provider.GetRequiredService<SqliteDataSourceRepository>());
builder.Services.AddSingleton<IOrganizationCatalog>(provider =>
    provider.GetRequiredService<SqliteCatalog>());
builder.Services.AddSingleton<IQueryDatasetCatalog, UnconfiguredQueryDatasetCatalog>();
builder.Services.AddSingleton(_ => new SqliteConnectionRepository(
    builder.Configuration["Catalog:Path"] ?? "data/catalog.db"));
builder.Services.AddSingleton<IConnectionRepository>(provider =>
    provider.GetRequiredService<SqliteConnectionRepository>());
builder.Services.AddSingleton<IConnectionSecretProtector>(_ => new AesGcmConnectionSecretProtector(
    builder.Configuration["ConnectionSecurity:ActiveKeyId"],
    builder.Configuration.GetSection("ConnectionSecurity:Keys").GetChildren()
        .ToDictionary(entry => entry.Key, entry => entry.Value ?? string.Empty)));
builder.Services.AddSingleton<IDnsResolver, SystemDnsResolver>();
builder.Services.AddSingleton<IConnectionDestinationPolicy>(provider =>
    new ApprovedDestinationPolicy(
        Enum.GetValues<DataSourceProvider>().ToDictionary(
            kind => kind,
            kind => (IReadOnlySet<string>)(builder.Configuration
                .GetSection($"ConnectionSecurity:AllowedDestinations:{kind}")
                .Get<string[]>() ?? []).ToHashSet(StringComparer.Ordinal)),
        provider.GetRequiredService<IDnsResolver>()));
builder.Services.AddSingleton<ISqliteFilePolicy>(_ => new MappedSqliteFilePolicy(
    builder.Configuration["ConnectionSecurity:SqliteRoot"],
    builder.Configuration.GetSection("ConnectionSecurity:SqliteFiles").GetChildren()
        .ToDictionary(entry => entry.Key, entry => entry.Value ?? string.Empty),
    builder.Configuration["Catalog:Path"] ?? "data/catalog.db"));
builder.Services.AddSingleton(TimeProvider.System);
builder.Services.AddScoped<DashboardService>();
builder.Services.AddScoped<DataSourceService>();
builder.Services.AddScoped<QueryService>();
builder.Services.AddScoped<ConnectionService>();

var app = builder.Build();

await app.Services.GetRequiredService<SqliteCatalog>().InitializeAsync();
await app.Services.GetRequiredService<SqliteDataSourceRepository>().InitializeAsync();
await app.Services.GetRequiredService<SqliteConnectionRepository>().InitializeAsync();
if (demoIdentityEnabled)
{
    await app.Services.GetRequiredService<SqliteCatalog>().SeedDevelopmentAsync();
}

app.UseExceptionHandler(exceptionApp => exceptionApp.Run(async context =>
{
    var exception = context.Features.Get<IExceptionHandlerFeature>()?.Error;
    var (status, title) = exception switch
    {
        ForbiddenException => (StatusCodes.Status403Forbidden, "Access denied"),
        ConflictException => (StatusCodes.Status409Conflict, "The resource was modified"),
        InvalidDashboardException => (StatusCodes.Status400BadRequest, "Invalid dashboard"),
        InvalidDataSourceException => (StatusCodes.Status400BadRequest, "Invalid data source"),
        InvalidQueryException => (StatusCodes.Status400BadRequest, "Invalid query"),
        InvalidConnectionException => (StatusCodes.Status400BadRequest, "Invalid connection"),
        ConnectionSecurityUnavailableException => (StatusCodes.Status503ServiceUnavailable, "Connection security unavailable"),
        BadHttpRequestException badRequest => (badRequest.StatusCode, "Invalid request"),
        _ => (StatusCodes.Status500InternalServerError, "Unexpected error")
    };

    context.Response.StatusCode = status;
    await Results.Problem(title: title,
        detail: exception is InvalidDashboardException or InvalidDataSourceException or InvalidQueryException
            ? exception.Message : null,
        statusCode: status).ExecuteAsync(context);
}));

app.UseCors();
app.UseAuthentication();
app.UseAuthorization();

app.MapGet("/api/health", () => Results.Ok(new { status = "healthy" }));

app.MapGet("/api/identity", (HttpContext context) => Results.Ok(new
{
    UserId = UserId(context),
    DisplayName = context.User.FindFirstValue(ClaimTypes.Name)
        ?? context.User.FindFirstValue("name")
        ?? context.User.FindFirstValue("preferred_username")
        ?? UserId(context)
})).RequireAuthorization();

app.MapGet("/api/organizations", async (
    HttpContext context, IOrganizationCatalog catalog, CancellationToken token) =>
{
    var memberships = await catalog.GetOrganizationsAsync(UserId(context), token);
    return Results.Ok(memberships.Select(membership => new
    {
        membership.Organization.Id,
        membership.Organization.Name,
        membership.Role
    }));
}).RequireAuthorization();

var dashboardRoutes = app.MapGroup("/api/organizations/{organizationId}/dashboards")
    .RequireAuthorization();

dashboardRoutes.MapGet("", async (
    string organizationId, HttpContext context, DashboardService service, CancellationToken token) =>
    Results.Ok(await service.ListAsync(organizationId, UserId(context), token)));

dashboardRoutes.MapGet("/{id:guid}", async (
    string organizationId, Guid id, HttpContext context, DashboardService service,
    CancellationToken token) =>
{
    var dashboard = await service.FindAsync(organizationId, id, UserId(context), token);
    return dashboard is null ? Results.NotFound() : Results.Ok(dashboard);
});

dashboardRoutes.MapPost("", async (
    string organizationId, DashboardDraft draft, HttpContext context,
    DashboardService service, CancellationToken token) =>
{
    var dashboard = await service.CreateAsync(organizationId, UserId(context), draft, token);
    return Results.Created(
        $"/api/organizations/{organizationId}/dashboards/{dashboard.Id}", dashboard);
});

dashboardRoutes.MapPut("/{id:guid}", async (
    string organizationId, Guid id, DashboardUpdate request, HttpContext context,
    DashboardService service, CancellationToken token) =>
{
    var dashboard = await service.UpdateAsync(organizationId, id, UserId(context),
        new DashboardDraft(request.Name, request.Description, request.Widgets),
        request.ExpectedRevision, token);
    return dashboard is null ? Results.NotFound() : Results.Ok(dashboard);
});

dashboardRoutes.MapDelete("/{id:guid}", async (
    string organizationId, Guid id, HttpContext context, DashboardService service,
    CancellationToken token) =>
    await service.DeleteAsync(organizationId, id, UserId(context), token)
        ? Results.NoContent()
        : Results.NotFound());

var dataSourceRoutes = app.MapGroup("/api/organizations/{organizationId}/data-sources")
    .RequireAuthorization();

dataSourceRoutes.MapGet("", async (
    string organizationId, HttpContext context, DataSourceService service, CancellationToken token) =>
    Results.Ok(await service.ListAsync(organizationId, UserId(context), token)));

dataSourceRoutes.MapGet("/{id:guid}", async (
    string organizationId, Guid id, HttpContext context, DataSourceService service,
    CancellationToken token) =>
{
    var definition = await service.FindAsync(organizationId, id, UserId(context), token);
    return definition is null ? Results.NotFound() : Results.Ok(definition);
});

dataSourceRoutes.MapPost("", async (
    string organizationId, DataSourceDraft draft, HttpContext context,
    DataSourceService service, CancellationToken token) =>
{
    var definition = await service.CreateAsync(organizationId, UserId(context), draft, token);
    return Results.Created(
        $"/api/organizations/{organizationId}/data-sources/{definition.Id}", definition);
});

dataSourceRoutes.MapPut("/{id:guid}", async (
    string organizationId, Guid id, DataSourceUpdate update, HttpContext context,
    DataSourceService service, CancellationToken token) =>
{
    var definition = await service.UpdateAsync(organizationId, id, UserId(context), update, token);
    return definition is null ? Results.NotFound() : Results.Ok(definition);
});

dataSourceRoutes.MapDelete("/{id:guid}", async (
    string organizationId, Guid id, int expectedRevision, HttpContext context,
    DataSourceService service, CancellationToken token) =>
    await service.DeleteAsync(organizationId, id, UserId(context), expectedRevision, token)
        ? Results.NoContent() : Results.NotFound());

// Owner-only, configuration-only endpoints. No credential readback or network connection.
dataSourceRoutes.MapGet("/{id:guid}/connection", async (
    string organizationId, Guid id, HttpContext context, ConnectionService service,
    CancellationToken token) =>
{
    var status = await service.FindAsync(organizationId, id, UserId(context), token);
    return status is null ? Results.NotFound() : Results.Ok(status);
});

dataSourceRoutes.MapPut("/{id:guid}/connection", async (
    string organizationId, Guid id, ConnectionConfigurationRequest request,
    HttpContext context, ConnectionService service, CancellationToken token) =>
{
    var status = await service.ConfigureAsync(organizationId, id, UserId(context), request, token);
    return status is null ? Results.NotFound() : Results.Ok(status);
}).WithMetadata(new RequestSizeLimitAttribute(16 * 1024));

dataSourceRoutes.MapPost("/{id:guid}/connection/rotate", async (
    string organizationId, Guid id, ConnectionCredentialRotation request,
    HttpContext context, ConnectionService service, CancellationToken token) =>
{
    var status = await service.RotateAsync(organizationId, id, UserId(context), request, token);
    return status is null ? Results.NotFound() : Results.Ok(status);
}).WithMetadata(new RequestSizeLimitAttribute(16 * 1024));

dataSourceRoutes.MapPost("/{id:guid}/connection/rewrap", async (
    string organizationId, Guid id, ConnectionRevisionRequest request,
    HttpContext context, ConnectionService service, CancellationToken token) =>
{
    var status = await service.RewrapAsync(organizationId, id, UserId(context), request, token);
    return status is null ? Results.NotFound() : Results.Ok(status);
}).WithMetadata(new RequestSizeLimitAttribute(1024));

dataSourceRoutes.MapDelete("/{id:guid}/connection", async (
    string organizationId, Guid id, int expectedRevision, HttpContext context,
    ConnectionService service, CancellationToken token) =>
    await service.RevokeAsync(organizationId, id, UserId(context), expectedRevision, token)
        ? Results.NoContent() : Results.NotFound());

// Validation only. Does not create a connection, compile a provider query, or return data.
dataSourceRoutes.MapPost("/{id:guid}/queries/validate", async (
    string organizationId, Guid id, QueryRequest request, HttpContext context,
    QueryService service, CancellationToken token) =>
{
    var result = await service.ValidateAsync(organizationId, id, UserId(context), request, token);
    return result is null ? Results.NotFound() : Results.Ok(result);
}).WithMetadata(new RequestSizeLimitAttribute(64 * 1024));

app.Run();

static string UserId(HttpContext context) =>
    context.User.FindFirstValue(ClaimTypes.NameIdentifier)
    ?? context.User.FindFirstValue("sub")
    ?? throw new ForbiddenException();

public partial class Program;
