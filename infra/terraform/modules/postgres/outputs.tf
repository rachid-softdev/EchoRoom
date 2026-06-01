# ─── PostgreSQL Module — Outputs ───────────────────────────────────────────────
# EchoRoom — Aiven PostgreSQL Module Outputs

output "service_name" {
  description = "Nom du service Aiven PostgreSQL"
  value       = aiven_pg.this.service_name
}

output "host" {
  description = "Hôte de connexion à la base PostgreSQL"
  value       = aiven_pg.this.service_host
}

output "port" {
  description = "Port de connexion à la base PostgreSQL"
  value       = aiven_pg.this.service_port
}

output "database_name" {
  description = "Nom de la base de données applicative"
  value       = aiven_database.app.database_name
}

output "database_username" {
  description = "Nom de l'utilisateur applicatif PostgreSQL"
  value       = aiven_pg_user.app.username
}

output "database_password" {
  description = "Mot de passe de l'utilisateur applicatif PostgreSQL (sensible)"
  value       = aiven_pg_user.app.password
  sensitive   = true
}

output "connection_uri_template" {
  description = "Template d'URI de connexion PostgreSQL (remplacer {PASSWORD} et {DB_NAME})"
  value       = "postgresql://${aiven_pg_user.app.username}:{PASSWORD}@${aiven_pg.this.service_host}:${aiven_pg.this.service_port}/{var.default_database}?sslmode=${var.sslmode}"
  sensitive   = false
}

output "connection_uri" {
  description = "URI complète de connexion PostgreSQL (sensible — contient le mot de passe)"
  value       = "postgresql://${aiven_pg_user.app.username}:${aiven_pg_user.app.password}@${aiven_pg.this.service_host}:${aiven_pg.this.service_port}/${aiven_database.app.database_name}?sslmode=${var.sslmode}"
  sensitive   = true
}

output "cloud_name" {
  description = "Fournisseur cloud et région de l'instance"
  value       = aiven_pg.this.cloud_name
}

output "plan" {
  description = "Plan Aiven sélectionné"
  value       = aiven_pg.this.plan
}

output "state" {
  description = "État actuel du service PostgreSQL"
  value       = aiven_pg.this.state
}
