# ─── PostgreSQL Module — Variables ─────────────────────────────────────────────
# EchoRoom — Aiven PostgreSQL Module

variable "project" {
  description = "Aiven project name where the PostgreSQL service will be deployed"
  type        = string
}

variable "service_name" {
  description = "Name of the Aiven PostgreSQL service (e.g. echoroom-db-prod)"
  type        = string
}

variable "cloud_name" {
  description = "Cloud provider and region for the PostgreSQL instance (e.g. google-europe-west1, aws-eu-west-3)"
  type        = string
}

variable "plan" {
  description = "Aiven PostgreSQL plan (e.g. startup-4, business-8, hobbyist). See https://aiven.io/pricing"
  type        = string
}

variable "disk_size" {
  description = "Disk size in GB for the PostgreSQL service. Default: 50 GB."
  type        = number
  default     = 50
}

variable "pg_version" {
  description = "PostgreSQL major version (ex: 15, 16). Default: 16"
  type        = number
  default     = 16
}

variable "maintenance_window_dow" {
  description = "Day of week for maintenance window (monday, tuesday, ..., sunday). Default: sunday"
  type        = string
  default     = "sunday"
}

variable "maintenance_window_time" {
  description = "Time of day for maintenance window in UTC (HH:MM:SS). Default: 03:00:00"
  type        = string
  default     = "03:00:00"
}

variable "backup_hour" {
  description = "Hour of day for automatic backups (0-23). Default: 2"
  type        = number
  default     = 2
}

variable "backup_minute" {
  description = "Minute of hour for automatic backups (0-59). Default: 0"
  type        = number
  default     = 0
}

variable "ip_filter" {
  description = "List of IP CIDR ranges allowed to connect. Default: allow all (0.0.0.0/0)"
  type        = list(string)
  default     = ["0.0.0.0/0"]
}

variable "default_database" {
  description = "Name of the default database to create. Default: echoroom"
  type        = string
  default     = "echoroom"
}

variable "default_user" {
  description = "Name of the default admin user. Default: echoroom_admin"
  type        = string
  default     = "echoroom_admin"
}

variable "sslmode" {
  description = "SSL mode for PostgreSQL connections (require, verify-ca, verify-full). Default: require"
  type        = string
  default     = "require"
}
