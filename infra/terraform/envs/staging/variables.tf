# ─── Staging Environment — Variables ───────────────────────────────────────────
# EchoRoom — Infrastructure de préproduction

# ─── Provider Credentials ──────────────────────────────────────────────────────

variable "aiven_api_token" {
  description = "Aiven API token for staging environment"
  type        = string
  sensitive   = true
}

variable "upstash_email" {
  description = "Upstash account email for staging environment"
  type        = string
  sensitive   = true
}

variable "upstash_api_key" {
  description = "Upstash API key for staging environment"
  type        = string
  sensitive   = true
}

variable "cloudflare_api_token" {
  description = "Cloudflare API token for staging environment"
  type        = string
  sensitive   = true
}

# ─── PostgreSQL (Aiven) ────────────────────────────────────────────────────────

variable "pg_project" {
  description = "Aiven project name for staging"
  type        = string
}

variable "pg_cloud_name" {
  description = "Cloud provider and region for staging PostgreSQL (e.g. google-europe-west1)"
  type        = string
  default     = "google-europe-west1"
}

variable "pg_plan" {
  description = "Aiven PostgreSQL plan for staging (e.g. startup-4)"
  type        = string
  default     = "startup-4"
}

variable "pg_disk_size" {
  description = "Disk size in GB for staging PostgreSQL"
  type        = number
  default     = 50
}

# ─── Redis (Upstash) ──────────────────────────────────────────────────────────

variable "redis_region" {
  description = "Upstash Redis region for staging (e.g. eu-west-1)"
  type        = string
  default     = "eu-west-1"
}

variable "redis_tier" {
  description = "Upstash Redis tier for staging (pay-as-you-go)"
  type        = string
  default     = "pay-as-you-go"
}

# ─── R2 (Cloudflare) ──────────────────────────────────────────────────────────

variable "cloudflare_account_id" {
  description = "Cloudflare account ID for staging"
  type        = string
}

variable "r2_bucket_name" {
  description = "Cloudflare R2 bucket name for staging"
  type        = string
  default     = "echoroom-recordings-staging"
}

variable "r2_location" {
  description = "R2 bucket location for staging (e.g. WEUR)"
  type        = string
  default     = "WEUR"
}
