# ─── Terraform Version Constraints ─────────────────────────────────────────────
# EchoRoom — Infrastructure as Code
# Contraintes de versions pour Terraform et les providers

terraform {
  required_version = ">= 1.5"

  required_providers {
    aiven = {
      source  = "aiven/aiven"
      version = ">= 4.0"
    }
    upstash = {
      source  = "upstash/upstash"
      version = ">= 2.0"
    }
    cloudflare = {
      source  = "cloudflare/cloudflare"
      version = ">= 4.0"
    }
  }
}
