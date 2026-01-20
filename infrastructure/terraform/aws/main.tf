# ==============================================================================
# 🏗️ Trading System - AWS Infrastructure (Terraform)
# ==============================================================================
# This provisions managed AWS services for production:
#   - VPC with public/private subnets
#   - RDS PostgreSQL (with TimescaleDB extension)
#   - ElastiCache Redis
#   - Security Groups
#
# Usage:
#   cd infrastructure/terraform/aws
#   terraform init
#   terraform plan
#   terraform apply
#
# Cost Estimate (us-east-1):
#   - RDS db.t3.micro:     ~$15/month
#   - ElastiCache t3.micro: ~$12/month
#   - Total:               ~$27/month (+ EC2 for app)
# ==============================================================================

terraform {
  required_version = ">= 1.0"
  required_providers {
    aws = {
      source  = "hashicorp/aws"
      version = "~> 5.0"
    }
  }
}

provider "aws" {
  region = var.aws_region
}

# ==============================================================================
# VARIABLES
# ==============================================================================

variable "aws_region" {
  description = "AWS region"
  type        = string
  default     = "us-east-1"
}

variable "project_name" {
  description = "Project name for resource naming"
  type        = string
  default     = "trading-system"
}

variable "environment" {
  description = "Environment (dev/staging/prod)"
  type        = string
  default     = "prod"
}

variable "db_username" {
  description = "Database master username"
  type        = string
  default     = "trading"
}

variable "db_password" {
  description = "Database master password"
  type        = string
  sensitive   = true
}

variable "allowed_cidr_blocks" {
  description = "CIDR blocks allowed to access resources"
  type        = list(string)
  default     = ["0.0.0.0/0"]  # Restrict in production!
}

# ==============================================================================
# DATA SOURCES
# ==============================================================================

data "aws_availability_zones" "available" {
  state = "available"
}

# ==============================================================================
# VPC & NETWORKING
# ==============================================================================

resource "aws_vpc" "main" {
  cidr_block           = "10.0.0.0/16"
  enable_dns_hostnames = true
  enable_dns_support   = true

  tags = {
    Name = "${var.project_name}-vpc"
  }
}

resource "aws_internet_gateway" "main" {
  vpc_id = aws_vpc.main.id

  tags = {
    Name = "${var.project_name}-igw"
  }
}

# Public Subnets (for EC2 app servers)
resource "aws_subnet" "public" {
  count                   = 2
  vpc_id                  = aws_vpc.main.id
  cidr_block              = "10.0.${count.index + 1}.0/24"
  availability_zone       = data.aws_availability_zones.available.names[count.index]
  map_public_ip_on_launch = true

  tags = {
    Name = "${var.project_name}-public-${count.index + 1}"
  }
}

# Private Subnets (for RDS & ElastiCache)
resource "aws_subnet" "private" {
  count             = 2
  vpc_id            = aws_vpc.main.id
  cidr_block        = "10.0.${count.index + 10}.0/24"
  availability_zone = data.aws_availability_zones.available.names[count.index]

  tags = {
    Name = "${var.project_name}-private-${count.index + 1}"
  }
}

resource "aws_route_table" "public" {
  vpc_id = aws_vpc.main.id

  route {
    cidr_block = "0.0.0.0/0"
    gateway_id = aws_internet_gateway.main.id
  }

  tags = {
    Name = "${var.project_name}-public-rt"
  }
}

resource "aws_route_table_association" "public" {
  count          = 2
  subnet_id      = aws_subnet.public[count.index].id
  route_table_id = aws_route_table.public.id
}

# ==============================================================================
# SECURITY GROUPS
# ==============================================================================

# App Server Security Group
resource "aws_security_group" "app" {
  name        = "${var.project_name}-app-sg"
  description = "Security group for application servers"
  vpc_id      = aws_vpc.main.id

  # SSH
  ingress {
    from_port   = 22
    to_port     = 22
    protocol    = "tcp"
    cidr_blocks = var.allowed_cidr_blocks
  }

  # HTTP
  ingress {
    from_port   = 80
    to_port     = 80
    protocol    = "tcp"
    cidr_blocks = var.allowed_cidr_blocks
  }

  # Dashboard
  ingress {
    from_port   = 3000
    to_port     = 3000
    protocol    = "tcp"
    cidr_blocks = var.allowed_cidr_blocks
  }

  # API
  ingress {
    from_port   = 4000
    to_port     = 4000
    protocol    = "tcp"
    cidr_blocks = var.allowed_cidr_blocks
  }

  # All outbound
  egress {
    from_port   = 0
    to_port     = 0
    protocol    = "-1"
    cidr_blocks = ["0.0.0.0/0"]
  }

  tags = {
    Name = "${var.project_name}-app-sg"
  }
}

# Database Security Group
resource "aws_security_group" "database" {
  name        = "${var.project_name}-db-sg"
  description = "Security group for databases"
  vpc_id      = aws_vpc.main.id

  # PostgreSQL from app servers
  ingress {
    from_port       = 5432
    to_port         = 5432
    protocol        = "tcp"
    security_groups = [aws_security_group.app.id]
  }

  # Redis from app servers
  ingress {
    from_port       = 6379
    to_port         = 6379
    protocol        = "tcp"
    security_groups = [aws_security_group.app.id]
  }

  egress {
    from_port   = 0
    to_port     = 0
    protocol    = "-1"
    cidr_blocks = ["0.0.0.0/0"]
  }

  tags = {
    Name = "${var.project_name}-db-sg"
  }
}

# ==============================================================================
# RDS PostgreSQL (TimescaleDB)
# ==============================================================================

resource "aws_db_subnet_group" "main" {
  name       = "${var.project_name}-db-subnet"
  subnet_ids = aws_subnet.private[*].id

  tags = {
    Name = "${var.project_name}-db-subnet"
  }
}

resource "aws_db_instance" "postgres" {
  identifier = "${var.project_name}-db"

  # Engine
  engine         = "postgres"
  engine_version = "15.4"
  instance_class = "db.t3.micro"  # Free tier eligible

  # Storage
  allocated_storage     = 20
  max_allocated_storage = 100  # Auto-scaling
  storage_type          = "gp3"
  storage_encrypted     = true

  # Credentials
  db_name  = "nifty50"
  username = var.db_username
  password = var.db_password

  # Network
  db_subnet_group_name   = aws_db_subnet_group.main.name
  vpc_security_group_ids = [aws_security_group.database.id]
  publicly_accessible    = false
  multi_az               = false  # Set true for HA

  # Maintenance
  backup_retention_period = 7
  skip_final_snapshot     = true
  deletion_protection     = false  # Set true in production

  # Performance
  performance_insights_enabled = false

  tags = {
    Name = "${var.project_name}-postgres"
  }
}

# ==============================================================================
# ElastiCache Redis
# ==============================================================================

resource "aws_elasticache_subnet_group" "main" {
  name       = "${var.project_name}-redis-subnet"
  subnet_ids = aws_subnet.private[*].id
}

resource "aws_elasticache_cluster" "redis" {
  cluster_id           = "${var.project_name}-redis"
  engine               = "redis"
  engine_version       = "7.0"
  node_type            = "cache.t3.micro"  # Free tier eligible
  num_cache_nodes      = 1
  parameter_group_name = "default.redis7"
  port                 = 6379

  subnet_group_name  = aws_elasticache_subnet_group.main.name
  security_group_ids = [aws_security_group.database.id]

  tags = {
    Name = "${var.project_name}-redis"
  }
}

# ==============================================================================
# OUTPUTS
# ==============================================================================

output "vpc_id" {
  description = "VPC ID"
  value       = aws_vpc.main.id
}

output "public_subnet_ids" {
  description = "Public subnet IDs (for EC2)"
  value       = aws_subnet.public[*].id
}

output "app_security_group_id" {
  description = "Security group ID for app servers"
  value       = aws_security_group.app.id
}

output "rds_endpoint" {
  description = "RDS PostgreSQL endpoint"
  value       = aws_db_instance.postgres.endpoint
}

output "rds_connection_string" {
  description = "PostgreSQL connection string"
  value       = "postgresql://${var.db_username}:PASSWORD@${aws_db_instance.postgres.endpoint}/nifty50"
  sensitive   = true
}

output "redis_endpoint" {
  description = "ElastiCache Redis endpoint"
  value       = aws_elasticache_cluster.redis.cache_nodes[0].address
}

output "redis_connection_string" {
  description = "Redis connection string"
  value       = "redis://${aws_elasticache_cluster.redis.cache_nodes[0].address}:6379"
}

# Generate .env.aws file
output "env_aws_content" {
  description = "Content for .env.aws file"
  value       = <<-EOT
    # Auto-generated by Terraform
    TIMESCALE_URL=postgresql://${var.db_username}:YOUR_PASSWORD@${aws_db_instance.postgres.endpoint}/nifty50
    REDIS_URL=redis://${aws_elasticache_cluster.redis.cache_nodes[0].address}:6379
    KAFKA_BROKERS=kafka:29092
  EOT
  sensitive   = true
}
