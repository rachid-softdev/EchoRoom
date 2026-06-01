# ─── Redis Module — Outputs ────────────────────────────────────────────────────
# EchoRoom — Upstash Redis Module Outputs

output "database_id" {
  description = "Identifiant unique de la base Redis Upstash"
  value       = upstash_redis_database.this.database_id
}

output "database_name" {
  description = "Nom de la base Redis"
  value       = upstash_redis_database.this.database_name
}

output "endpoint" {
  description = "Endpoint URL de la base Redis (utilisé comme REDIS_URL)"
  value       = upstash_redis_database.this.endpoint
}

output "rest_url" {
  description = "URL REST de l'API Upstash pour Redis"
  value       = upstash_redis_database.this.rest_url
}

output "rest_token" {
  description = "Token d'accès REST pour Redis (sensible — utilisé comme REDIS_TOKEN)"
  value       = upstash_redis_database.this.rest_token
  sensitive   = true
}

output "port" {
  description = "Port de connexion Redis"
  value       = upstash_redis_database.this.port
}

output "region" {
  description = "Région cloud de l'instance Redis"
  value       = upstash_redis_database.this.region
}

output "tier" {
  description = "Tier Upstash sélectionné"
  value       = upstash_redis_database.this.tier
}

output "connection_url" {
  description = "URL de connexion Redis complète (sensible — contient le token)"
  value       = upstash_redis_database.this.endpoint
  sensitive   = true
}
