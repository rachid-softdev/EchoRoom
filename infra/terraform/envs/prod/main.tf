# ─── Production Environment ────────────────────────────────────────────────────
# EchoRoom — Infrastructure de production
# Utilise des plans haute disponibilité et des sauvegardes automatiques.

terraform {
  # Backend distant pour la production — state partagé via un bucket S3-compatible
  # Décommenter et configurer ci-dessous pour utiliser un backend distant.
  # backend "s3" {
  #   bucket         = "echoroom-terraform-state"
  #   key            = "prod/terraform.tfstate"
  #   region         = "eu-west-1"
  #   encrypt        = true
  # }

  backend "local" {
    path = "terraform.tfstate.prod"
  }
}

# ─── Modules ───────────────────────────────────────────────────────────────────

module "postgres" {
  source = "../../modules/postgres"

  project      = var.pg_project
  service_name = "echoroom-db-prod"
  cloud_name   = var.pg_cloud_name
  plan         = var.pg_plan
  disk_size    = var.pg_disk_size

  # Production : rétention de sauvegarde étendue
  backup_hour   = 2
  backup_minute = 0

  # Production : limiter l'accès IP aux plages autorisées
  ip_filter = [
    "0.0.0.0/0", # À remplacer par les IPs spécifiques du projet
  ]

  default_database = "echoroom_prod"
  default_user     = "echoroom_admin_prod"
}

module "redis" {
  source = "../../modules/redis"

  database_name   = "echoroom-cache-prod"
  region          = var.redis_region
  tier            = var.redis_tier
  max_connections = 500
}

module "r2" {
  source = "../../modules/r2"

  account_id   = var.cloudflare_account_id
  bucket_name  = var.r2_bucket_name
  location     = var.r2_location
  jurisdiction = "eu" # RGPD

  # Production : accès public via Cloudflare Workers ou domaine personnalisé
  public_access = true
}
