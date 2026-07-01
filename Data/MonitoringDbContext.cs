using Microsoft.EntityFrameworkCore;
using MonitoringScreens.Blazor.Data.Entities;

namespace MonitoringScreens.Blazor.Data;

public sealed class MonitoringDbContext(DbContextOptions<MonitoringDbContext> options) : DbContext(options)
{
    public DbSet<DashboardSettingEntity> DashboardSettings => Set<DashboardSettingEntity>();
    public DbSet<ExceptionDefinitionEntity> ExceptionDefinitions => Set<ExceptionDefinitionEntity>();
    public DbSet<ProcessDefinitionEntity> ProcessDefinitions => Set<ProcessDefinitionEntity>();
    public DbSet<SquadDefinitionEntity> SquadDefinitions => Set<SquadDefinitionEntity>();

    protected override void OnModelCreating(ModelBuilder modelBuilder)
    {
        modelBuilder.Entity<DashboardSettingEntity>(entity =>
        {
            entity.ToTable("dashboard_settings");
            entity.HasKey(x => x.Id);
            entity.HasIndex(x => x.Key).IsUnique();
            entity.Property(x => x.Key).HasMaxLength(120).IsRequired();
            entity.Property(x => x.Value).HasMaxLength(500).IsRequired();
        });

        modelBuilder.Entity<ExceptionDefinitionEntity>(entity =>
        {
            entity.ToTable("exception_definitions");
            entity.HasKey(x => x.Id);
            entity.HasIndex(x => x.Name).IsUnique();
            entity.Property(x => x.Name).HasMaxLength(300).IsRequired();
            entity.Property(x => x.Type).HasMaxLength(40).IsRequired();
        });

        modelBuilder.Entity<ProcessDefinitionEntity>(entity =>
        {
            entity.ToTable("process_definitions");
            entity.HasKey(x => x.Id);
            entity.HasIndex(x => x.Name).IsUnique();
            entity.Property(x => x.Name).HasMaxLength(200).IsRequired();
        });

        modelBuilder.Entity<SquadDefinitionEntity>(entity =>
        {
            entity.ToTable("squad_definitions");
            entity.HasKey(x => x.Id);
            entity.HasIndex(x => x.Name).IsUnique();
            entity.Property(x => x.Name).HasMaxLength(120).IsRequired();
        });
    }
}
