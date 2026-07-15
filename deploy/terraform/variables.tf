# Inputs for the Terraform config. Pass them via a gitignored terraform.tfvars,
# `-var` flags, or TF_VAR_* environment variables. Never put secrets in a
# committed .tfvars - source them from the environment or a secrets manager.

variable "app_name" {
  description = "Name of the deployed application."
  type        = string
}

variable "region" {
  description = "Provider region to deploy into."
  type        = string
}

variable "image" {
  description = "Container image reference (repo:tag, or repo@digest for a pinned build) to run."
  type        = string
  default     = ""
}
