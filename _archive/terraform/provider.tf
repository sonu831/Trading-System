terraform {
  required_providers {
    aws = {
      source  = "hashicorp/aws"
      version = "~> 5.0"
    }
  }

  # backend "s3" {
  #   # Update these values with your actual S3 bucket and DynamoDB table details
  #   # bucket         = "your-terraform-state-bucket"
  #   # key            = "trading-system/terraform.tfstate"
  #   # region         = "us-east-1"
  #   # encrypt        = true
  #   # dynamodb_table = "your-terraform-locks"
  # }
}

provider "aws" {
  region = var.aws_region
}
