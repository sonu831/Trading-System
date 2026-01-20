# 🏗️ Trading System - AWS Infrastructure

This Terraform configuration provisions AWS managed services for production deployment.

## What Gets Created

| Resource          | Type           | Cost (us-east-1) |
| ----------------- | -------------- | ---------------- |
| VPC               | Network        | Free             |
| RDS PostgreSQL    | db.t3.micro    | ~$15/month       |
| ElastiCache Redis | cache.t3.micro | ~$12/month       |
| **Total**         |                | **~$27/month**   |

## Prerequisites

1. [Terraform](https://terraform.io/downloads) installed
2. [AWS CLI](https://aws.amazon.com/cli/) configured with credentials
3. AWS account with appropriate permissions

## Quick Start

```bash
# 1. Navigate to terraform directory
cd infrastructure/terraform/aws

# 2. Copy and configure variables
cp terraform.tfvars.example terraform.tfvars
# Edit terraform.tfvars with your values

# 3. Initialize Terraform
terraform init

# 4. Preview changes
terraform plan

# 5. Apply (creates resources)
terraform apply

# 6. Copy outputs to .env.aws
terraform output -json
```

## After Infrastructure is Created

1. Copy the connection strings from Terraform output:

   ```bash
   terraform output rds_connection_string
   terraform output redis_connection_string
   ```

2. Update your `.env.aws` file with these values

3. Run your app:
   ```bash
   make up-aws
   ```

## Destroy Infrastructure

```bash
terraform destroy
```

⚠️ **Warning**: This will delete all data in RDS and ElastiCache!

## Notes on TimescaleDB

AWS RDS doesn't natively support TimescaleDB extension. Options:

1. **Use standard PostgreSQL** - Works fine for most use cases
2. **Use Timescale Cloud** - Managed TimescaleDB service
3. **Self-managed EC2** - Run TimescaleDB on EC2 (more work)

For this setup, we use standard PostgreSQL which is compatible with your application.
