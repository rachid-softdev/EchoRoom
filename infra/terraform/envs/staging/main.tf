# ─── Staging Environment ───────────────────────────────────────────────────────
# EchoRoom — Infrastructure de préproduction
# Utilise des plans de taille moyenne pour valider le comportement en conditions
# proches de la production avant déploiement final.

terraform {
  # Backend local pour le staging — pourra être migré vers un backend distant
  # quand l'équipe sera prête à partager le state.
  backend "local" {
    path = "terraform.tfstate.staging"
  }
}

# ─── Modules ───────────────────────────────────────────────────────────────────

module "postgres" {
  source = "../../modules/postgres"

  project      = var.pg_project
  service_name = "echoroom-db-staging"
  cloud_name   = var.pg_cloud_name
  plan         = var.pg_plan
  disk_size    = var.pg_disk_size

  # Staging : sauvegardes automatiques pour tester les procédures de restore
  backup_hour   = 2
  backup_minute = 0

  # Staging : restreindre l'accès IP aux plages EchoRoom
  ip_filter = [
    "0.0.0.0/0", # À remplacer par les IPs spécifiques du projet
  ]

  default_database = "echoroom_staging"
  default_user     = "echoroom_admin_staging"
}

module "redis" {
  source = "../../modules/redis"

  database_name   = "echoroom-cache-staging"
  region          = var.redis_region
  tier            = var.redis_tier
  max_connections = 250
}

module "r2" {
  source = "../../modules/r2"

  account_id   = var.cloudflare_account_id
  bucket_name  = var.r2_bucket_name
  location     = var.r2_location
  jurisdiction = "eu" # RGPD
}
