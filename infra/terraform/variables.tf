# ─── Global Variables ──────────────────────────────────────────────────────────
# EchoRoom — Infrastructure as Code
# Variables partagées utilisées par providers.tf

variable "aiven_api_token" {
  description = "Aiven API token for authentication. Peut aussi être défini via AIVEN_API_TOKEN."
  type        = string
  sensitive   = true
}

variable "upstash_email" {
  description = "Upstash account email. Peut aussi être défini via UPSTASH_EMAIL."
  type        = string
  sensitive   = true
}

variable "upstash_api_key" {
  description = "Upstash API key for authentication. Peut aussi être défini via UPSTASH_API_KEY."
  type        = string
  sensitive   = true
}

variable "cloudflare_api_token" {
  description = "Cloudflare API token for authentication. Peut aussi être défini via CLOUDFLARE_API_TOKEN."
  type        = string
  sensitive   = true
}
