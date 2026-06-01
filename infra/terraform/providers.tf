# ─── Provider Configuration ───────────────────────────────────────────────────
# EchoRoom — Infrastructure as Code
# Configuration partagée des providers Terraform

# ─── Aiven Provider ────────────────────────────────────────────────────────────
# Gère les services managés PostgreSQL (et éventuellement Redis via Aiven).
# L'API token est passé via la variable `aiven_api_token` ou la var. d'env. AIVEN_API_TOKEN.
provider "aiven" {
  api_token = var.aiven_api_token
}

# ─── Upstash Provider ──────────────────────────────────────────────────────────
# Gère les bases Redis serverless (QStash, Redis, Kafka).
# L'email et l'API key sont passés via les variables d'environnement UPSTASH_EMAIL et UPSTASH_API_KEY.
provider "upstash" {
  email   = var.upstash_email
  api_key = var.upstash_api_key
}

# ─── Cloudflare Provider ───────────────────────────────────────────────────────
# Gère les buckets R2, DNS, et autres ressources Cloudflare.
# L'API token est passé via la variable `cloudflare_api_token` ou la var. d'env. CLOUDFLARE_API_TOKEN.
provider "cloudflare" {
  api_token = var.cloudflare_api_token
}
