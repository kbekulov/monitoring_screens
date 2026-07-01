using MonitoringScreens.Blazor;
using MonitoringScreens.Blazor.Services;

var builder = WebApplication.CreateBuilder(args);
builder.WebHost.UseStaticWebAssets();

builder.Services
    .AddRazorComponents()
    .AddInteractiveServerComponents();

builder.Services.AddSingleton<DashboardService>();

var app = builder.Build();

if (!app.Environment.IsDevelopment())
{
    app.UseHsts();
}

app.UseAntiforgery();

app.MapStaticAssets();
app.MapRazorComponents<App>()
    .AddInteractiveServerRenderMode();

app.Run();
