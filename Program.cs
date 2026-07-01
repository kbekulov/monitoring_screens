using MonitoringScreens.Blazor;
using Microsoft.EntityFrameworkCore;
using MonitoringScreens.Blazor.Data;
using MonitoringScreens.Blazor.Services;

var builder = WebApplication.CreateBuilder(args);
builder.WebHost.UseStaticWebAssets();

var connectionString = builder.Configuration.GetConnectionString("MonitoringDatabase")
    ?? builder.Configuration["MonitoringDatabase:ConnectionString"];

builder.Services
    .AddRazorComponents()
    .AddInteractiveServerComponents();

if (!string.IsNullOrWhiteSpace(connectionString))
{
    builder.Services.AddDbContext<MonitoringDbContext>(options => options.UseNpgsql(connectionString));
    builder.Services.AddScoped<IDashboardCatalogRepository, EfDashboardCatalogRepository>();
}
else
{
    builder.Services.AddSingleton<IDashboardCatalogRepository, SeededDashboardCatalogRepository>();
}

builder.Services.AddScoped<DashboardService>();

var app = builder.Build();

if (!string.IsNullOrWhiteSpace(connectionString))
{
    await MonitoringDatabaseSeeder.InitializeAsync(app.Services);
}

if (!app.Environment.IsDevelopment())
{
    app.UseHsts();
}

app.UseAntiforgery();

app.MapStaticAssets();
app.MapRazorComponents<App>()
    .AddInteractiveServerRenderMode();

app.Run();
