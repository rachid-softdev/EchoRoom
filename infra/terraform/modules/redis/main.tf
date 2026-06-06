# ─── Upstash Redis Module ──────────────────────────────────────────────────────
# EchoRoom — Provisionne une base Redis serverless via Upstash
# Documentation: https://registry.terraform.io/providers/upstash/upstash/latest/docs/resources/redis_database

resource "upstash_redis_database" "this" {
  database_name = var.database_name
  region = var.region
  tier = var.tier
  max_connections = var.max_connections
  enable_eviction = var.enable_eviction
  enable_tls = var.enable_tls
}
