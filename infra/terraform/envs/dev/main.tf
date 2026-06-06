# ─── Dev Environment ───────────────────────────────────────────────────────────
# EchoRoom — Infrastructure de développement
# Utilise les plans les plus petits (hobbyist / free) pour minimiser les coûts.

terraform {
  # Backend local pour le développement — pas de state partagé
  backend "local" {
    path = "terraform.tfstate.dev"
  }
}

# ─── Modules ───────────────────────────────────────────────────────────────────

module "postgres" {
  source = "../../modules/postgres"

  project = var.pg_project
  service_name = "echoroom-db-dev"
  cloud_name = var.pg_cloud_name
  plan = var.pg_plan
  disk_size = 10

  # Base de dev avec données non sensibles
  default_database = "echoroom_dev"
  default_user = "echoroom_admin_dev"
}

module "redis" {
  source = "../../modules/redis"

  database_name = "echoroom-cache-dev"
  region = var.redis_region
  tier = var.redis_tier
}

module "r2" {
  source = "../../modules/r2"

  account_id = var.cloudflare_account_id
  bucket_name = var.r2_bucket_name
  location = var.r2_location
  jurisdiction = "eu" # RGPD
}
