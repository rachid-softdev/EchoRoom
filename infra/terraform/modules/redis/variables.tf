# ─── Redis Module — Variables ──────────────────────────────────────────────────
# EchoRoom — Upstash Redis Module

variable "database_name" {
  description = "Name of the Upstash Redis database (e.g. echoroom-cache-dev)"
  type        = string
}

variable "region" {
  description = "Cloud region for the Redis instance (e.g. eu-west-1, us-east-1). See https://docs.upstash.com/redis/features/regions"
  type        = string
}

variable "tier" {
  description = "Upstash Redis tier (free, pay-as-you-go). Default: free"
  type        = string
  default     = "free"
}

variable "max_connections" {
  description = "Maximum number of concurrent connections. Default: 100"
  type        = number
  default     = 100
}

variable "enable_eviction" {
  description = "Enable key eviction when memory limit is reached. Default: true"
  type        = bool
  default     = true
}

variable "enable_tls" {
  description = "Enable TLS for Redis connections. Default: true"
  type        = bool
  default     = true
}
