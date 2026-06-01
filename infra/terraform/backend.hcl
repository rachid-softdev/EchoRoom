# ─── Remote State Backend — Cloudflare R2 (S3-compatible) ──────────────────────
# EchoRoom — Infrastructure as Code
#
# Usage:
#   terraform init -backend-config=backend.hcl -backend-config="key=<env>/terraform.tfstate"
#
# Prerequisites:
#   1. Create the R2 bucket manually: echoroom-terraform-state
#   2. Generate R2 credentials (Access Key ID + Secret Access Key) in Cloudflare Dashboard
#   3. Set env vars: AWS_ACCESS_KEY_ID, AWS_SECRET_ACCESS_KEY
#
#   These credentials must have s3:PutObject, s3:GetObject, s3:DeleteObject
#   permissions on the echoroom-terraform-state bucket.

bucket         = "echoroom-terraform-state"
region         = "auto"
endpoint       = "https://<CLOUDFLARE_ACCOUNT_ID>.r2.cloudflarestorage.com"

skip_credentials_validation = true
skip_region_validation      = true
skip_requesting_account_id  = true
skip_metadata_api_check     = true
