# ─── Aiven PostgreSQL Module ───────────────────────────────────────────────────
# EchoRoom — Provisionne une instance PostgreSQL managée via Aiven
# Documentation: https://registry.terraform.io/providers/aiven/aiven/latest/docs/resources/pg

resource "aiven_pg" "this" {
  project      = var.project
  service_name = var.service_name
  cloud_name   = var.cloud_name
  plan         = var.plan
  disk_size    = var.disk_size

  pg_user_config {
    pg_version    = var.pg_version
    ip_filter     = var.ip_filter
    backup_hour   = var.backup_hour
    backup_minute = var.backup_minute

    # Sécurité : forcer SSL pour toutes les connexions
    pg_sslmode = var.sslmode
  }

  maintenance_window_dow  = var.maintenance_window_dow
  maintenance_window_time = var.maintenance_window_time

  # Création de la base de données par défaut
  # La base de données `defaultdb` est créée automatiquement par Aiven
  # On utilise une ressource séparée pour la base de données applicative
}

# Base de données applicative
resource "aiven_database" "app" {
  project       = var.project
  service_name  = aiven_pg.this.service_name
  database_name = var.default_database
}

# Utilisateur administrateur applicatif
resource "aiven_pg_user" "app" {
  project      = var.project
  service_name = aiven_pg.this.service_name
  username     = var.default_user
}

# Un utilisateur `avnadmin` est créé automatiquement par Aiven.
# On ajoute un utilisateur applicatif dédié pour limiter les permissions.
