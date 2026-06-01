# ─── Production Environment — Variables ────────────────────────────────────────
# EchoRoom — Infrastructure de production

# ─── Provider Credentials ──────────────────────────────────────────────────────

variable "aiven_api_token" {
  description = "Aiven API token for production environment"
  type        = string
  sensitive   = true
}

variable "upstash_email" {
  description = "Upstash account email for production environment"
  type        = string
  sensitive   = true
}

variable "upstash_api_key" {
  description = "Upstash API key for production environment"
  type        = string
  sensitive   = true
}

variable "cloudflare_api_token" {
  description = "Cloudflare API token for production environment"
  type        = string
  sensitive   = true
}

# ─── PostgreSQL (Aiven) ────────────────────────────────────────────────────────

variable "pg_project" {
  description = "Aiven project name for production"
  type        = string
}

variable "pg_cloud_name" {
  description = "Cloud provider and region for production PostgreSQL (e.g. google-europe-west1)"
  type        = string
  default     = "google-europe-west1"
}

variable "pg_plan" {
  description = "Aiven PostgreSQL plan for production (e.g. startup-8 or business-8)"
  type        = string
  default     = "startup-8"
}

variable "pg_disk_size" {
  description = "Disk size in GB for production PostgreSQL"
  type        = number
  default     = 100
}

# ─── Redis (Upstash) ──────────────────────────────────────────────────────────

variable "redis_region" {
  description = "Upstash Redis region for production (e.g. eu-west-1)"
  type        = string
  default     = "eu-west-1"
}

variable "redis_tier" {
  description = "Upstash Redis tier for production (pay-as-you-go)"
  type        = string
  default     = "pay-as-you-go"
}

# ─── R2 (Cloudflare) ──────────────────────────────────────────────────────────

variable "cloudflare_account_id" {
  description = "Cloudflare account ID for production"
  type        = string
}

variable "r2_bucket_name" {
  description = "Cloudflare R2 bucket name for production"
  type        = string
  default     = "echoroom-recordings-prod"
}

variable "r2_location" {
  description = "R2 bucket location for production (e.g. WEUR)"
  type        = string
  default     = "WEUR"
}
