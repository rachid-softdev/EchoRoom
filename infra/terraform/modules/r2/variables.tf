# ─── R2 Module — Variables ─────────────────────────────────────────────────────
# EchoRoom — Cloudflare R2 Bucket Module

variable "bucket_name" {
  description = "Name of the Cloudflare R2 bucket (e.g. echoroom-recordings-prod)"
  type        = string
}

variable "account_id" {
  description = "Cloudflare account ID where the R2 bucket will be created"
  type        = string
}

variable "location" {
  description = "Location hint for the R2 bucket (e.g. WEUR, EEUR, APAC). Default: WEUR (Western Europe)"
  type        = string
  default     = "WEUR"
}

variable "jurisdiction" {
  description = "Jurisdiction for the R2 bucket (default: null for automatic). Use 'eu' for GDPR compliance."
  type        = string
  default     = null
}

variable "public_access" {
  description = "Enable public access to the bucket. Default: false"
  type        = bool
  default     = false
}
