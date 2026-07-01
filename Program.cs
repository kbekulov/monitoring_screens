using MonitoringScreens.Blazor;
using Microsoft.EntityFrameworkCore;
using MonitoringScreens.Blazor.Data;
using MonitoringScreens.Blazor.Services;

var builder = WebApplication.CreateBuilder(args);
builder.WebHost.UseStaticWebAssets();

var dataDirectory = Path.Combine(builder.Environment.ContentRootPath, "Data");
Directory.CreateDirectory(dataDirectory);
var databasePath = Path.Combine(dataDirectory, "monitoring-screens.db");
var connectionString = builder.Configuration.GetConnectionString("MonitoringDatabase")
    ?? $"Data Source={databasePath}";

builder.Services
    .AddRazorComponents()
    .AddInteractiveServerComponents();

builder.Services.AddDbContext<MonitoringDbContext>(options => options.UseSqlite(connectionString));
builder.Services.AddScoped<DashboardService>();

var app = builder.Build();

await MonitoringDatabaseSeeder.InitializeAsync(app.Services);

if (!app.Environment.IsDevelopment())
{
    app.UseHsts();
}

app.UseAntiforgery();

app.MapStaticAssets();
app.MapRazorComponents<App>()
    .AddInteractiveServerRenderMode();

app.Run();
