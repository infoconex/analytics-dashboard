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

var builder = WebApplication.CreateBuilder(args);

builder.Services.ConfigureHttpJsonOptions(options =>
    options.SerializerOptions.Converters.Add(
        new JsonStringEnumConverter(JsonNamingPolicy.CamelCase, allowIntegerValues: false)));

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
builder.Services.AddSingleton(TimeProvider.System);
builder.Services.AddScoped<DashboardService>();
builder.Services.AddScoped<DataSourceService>();

var app = builder.Build();

await app.Services.GetRequiredService<SqliteCatalog>().InitializeAsync();
await app.Services.GetRequiredService<SqliteDataSourceRepository>().InitializeAsync();
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
        BadHttpRequestException badRequest => (badRequest.StatusCode, "Invalid request"),
        _ => (StatusCodes.Status500InternalServerError, "Unexpected error")
    };

    context.Response.StatusCode = status;
    await Results.Problem(title: title,
        detail: exception is InvalidDashboardException or InvalidDataSourceException
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

app.Run();

static string UserId(HttpContext context) =>
    context.User.FindFirstValue(ClaimTypes.NameIdentifier)
    ?? context.User.FindFirstValue("sub")
    ?? throw new ForbiddenException();

public partial class Program;
