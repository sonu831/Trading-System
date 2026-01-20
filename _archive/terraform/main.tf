module "vpc" {
  source = "./modules/vpc"

  vpc_cidr             = "10.0.0.0/16"
  project_name         = var.project_name
  environment          = var.environment
  availability_zones   = ["${var.aws_region}a", "${var.aws_region}b"]
  public_subnet_cidrs  = ["10.0.1.0/24", "10.0.2.0/24"]
  private_subnet_cidrs = ["10.0.10.0/24", "10.0.11.0/24"]
}

module "eks" {
  source = "./modules/eks"

  cluster_name = "${var.project_name}-${var.environment}-cluster"
  vpc_id       = module.vpc.vpc_id
  subnet_ids   = module.vpc.private_subnet_ids

  node_group_desired_size = 2
  node_group_max_size     = 3
  node_group_min_size     = 1
  instance_types          = ["t3.medium"]
  ssh_key_name            = "trading-key"
}

variable "rds_password" {
  description = "RDS Password (pass via -var or env var)"
  type        = string
  sensitive   = true
}

module "data_stores" {
  source = "./modules/data-stores"

  project_name = var.project_name
  environment  = var.environment
  vpc_id       = module.vpc.vpc_id
  subnet_ids   = module.vpc.private_subnet_ids
  rds_password = var.rds_password
}
