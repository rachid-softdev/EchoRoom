# ─── Dev Environment — Variables ───────────────────────────────────────────────
# EchoRoom — Infrastructure de développement

# ─── Provider Credentials ──────────────────────────────────────────────────────

variable "aiven_api_token" {
  description = "Aiven API token for dev environment"
  type        = string
  sensitive   = true
}

variable "upstash_email" {
  description = "Upstash account email for dev environment"
  type        = string
  sensitive   = true
}

variable "upstash_api_key" {
  description = "Upstash API key for dev environment"
  type        = string
  sensitive   = true
}

variable "cloudflare_api_token" {
  description = "Cloudflare API token for dev environment"
  type        = string
  sensitive   = true
}

# ─── PostgreSQL (Aiven) ────────────────────────────────────────────────────────

variable "pg_project" {
  description = "Aiven project name for dev"
  type        = string
}

variable "pg_cloud_name" {
  description = "Cloud provider and region for dev PostgreSQL (e.g. google-europe-west1)"
  type        = string
  default     = "google-europe-west1"
}

variable "pg_plan" {
  description = "Aiven PostgreSQL plan for dev (e.g. hobbyist or startup-4)"
  type        = string
  default     = "hobbyist"
}

# ─── Redis (Upstash) ──────────────────────────────────────────────────────────

variable "redis_region" {
  description = "Upstash Redis region for dev (e.g. eu-west-1)"
  type        = string
  default     = "eu-west-1"
}

variable "redis_tier" {
  description = "Upstash Redis tier for dev (free or pay-as-you-go)"
  type        = string
  default     = "free"
}

# ─── R2 (Cloudflare) ──────────────────────────────────────────────────────────

variable "cloudflare_account_id" {
  description = "Cloudflare account ID for dev"
  type        = string
}

variable "r2_bucket_name" {
  description = "Cloudflare R2 bucket name for dev"
  type        = string
  default     = "echoroom-recordings-dev"
}

variable "r2_location" {
  description = "R2 bucket location for dev (e.g. WEUR)"
  type        = string
  default     = "WEUR"
}
