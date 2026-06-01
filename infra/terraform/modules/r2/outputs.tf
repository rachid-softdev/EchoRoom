# ─── R2 Module — Outputs ───────────────────────────────────────────────────────
# EchoRoom — Cloudflare R2 Bucket Module Outputs

output "bucket_name" {
  description = "Nom du bucket R2 créé"
  value       = cloudflare_r2_bucket.this.name
}

output "bucket_endpoint" {
  description = "Endpoint S3-compatible du bucket R2 (utilisé comme R2_ENDPOINT)"
  value       = "https://${var.account_id}.r2.cloudflarestorage.com"
}

output "public_url" {
  description = "URL publique du bucket (si l'accès public est activé)"
  value       = var.public_access ? "https://${cloudflare_r2_bucket.this.name}.${cloudflare_r2_bucket.this.location}.r2.cloudflarestorage.com" : null
}

output "jurisdiction" {
  description = "Juridiction du bucket R2 (null = automatique, 'eu' = RGPD)"
  value       = cloudflare_r2_bucket.this.jurisdiction
}

output "location" {
  description = "Région de localisation du bucket"
  value       = cloudflare_r2_bucket.this.location
}

output "account_id" {
  description = "Cloudflare Account ID associé au bucket"
  value       = var.account_id
}
