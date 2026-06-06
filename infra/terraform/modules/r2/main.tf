# ─── Cloudflare R2 Bucket Module ──────────────────────────────────────────────
# EchoRoom — Provisionne un bucket R2 pour le stockage d'objets (clips audio)
# Documentation: https://registry.terraform.io/providers/cloudflare/cloudflare/latest/docs/resources/r2_bucket

resource "cloudflare_r2_bucket" "this" {
  account_id = var.account_id
  name = var.bucket_name
  location = var.location
  jurisdiction = var.jurisdiction
}

# ─── CORS Policy ───────────────────────────────────────────────────────────────
# Autorise les requêtes depuis le domaine applicatif EchoRoom
resource "cloudflare_r2_bucket_cors" "this" {
  count = var.public_access ? 1 : 0

  account_id = var.account_id
  bucket = cloudflare_r2_bucket.this.name

  rules {
    allowed_origins = ["https://echoroom.app", "https://*.echoroom.app"]
    allowed_methods = ["GET", "HEAD", "PUT", "POST"]
    allowed_headers = ["Content-Type", "Authorization"]
    expose_headers = ["ETag"]
    max_age_seconds = 3600
  }
}
