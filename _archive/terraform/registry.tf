resource "aws_ecr_repository" "repos" {
  for_each = toset([
    "layer-1-ingestion",
    "layer-2-processing",
    "layer-4-analysis",
    "layer-5-aggregation",
    "layer-6-signal",
    "layer-7-api",
    "layer-7-dashboard"
  ])

  name                 = "${var.project_name}/${each.key}"
  image_tag_mutability = "MUTABLE"
  force_delete         = true # For dev/testing ease

  image_scanning_configuration {
    scan_on_push = true
  }

  tags = {
    Environment = var.environment
  }
}

output "ecr_repository_urls" {
  value = { for k, v in aws_ecr_repository.repos : k => v.repository_url }
}
