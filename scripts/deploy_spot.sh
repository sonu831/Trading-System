#!/bin/bash
set -e

# ==============================================================================
# 💸 CHEAP EC2 SPOT DEPLOYMENT (us-east-1)
# ==============================================================================
# Provisions a t3.micro Spot Instance (~$0.003/hr) and deploys Docker Compose.
# ==============================================================================

REGION="us-east-1"
INSTANCE_TYPE="t3.micro"
AMI_ID="ami-0c7217cdde317cfec" # Ubuntu 22.04 LTS in us-east-1 (Verify if needed, using standard Ubuntu)
KEY_NAME="trading-key-final"
SEC_GROUP="TradingSG"
PROJECT_NAME="nifty50-trading"

echo "----------------------------------------------------------------"
echo "Starting Low-Cost Deployment to ${REGION} (${INSTANCE_TYPE})..."
echo "⚠️  DEPLOYING TO REGION: ${REGION} (Make sure this is us-east-1 for lowest cost)"
echo "----------------------------------------------------------------"

# 1. Check Key Pair (Skip this check in CI if handled via env vars/secrets)
if [ ! -f "${KEY_NAME}.pem" ]; then
    echo "⚠️  Key pair ${KEY_NAME}.pem not found locally!"
    echo "    In CI/CD, ensure you write the secret to this file."
    echo "    Locally, create it using AWS CLI if missing."
    # We exit only if we really can't proceed (e.g., interactive usage)
    # But for now, let's keep strict check to avoid confusion, user can adapt for CI.
    exit 1
fi

# 2. Check/Create Security Group
echo "[1/4] Configuring Security Group in ${REGION}..."
SG_ID=$(aws ec2 describe-security-groups --region ${REGION} --group-names ${SEC_GROUP} --query "SecurityGroups[0].GroupId" --output text 2>/dev/null || echo "None")

if [ "$SG_ID" == "None" ]; then
    echo "Creating Security Group ${SEC_GROUP}..."
    SG_ID=$(aws ec2 create-security-group --region ${REGION} --group-name ${SEC_GROUP} --description "Trading Bot SG" --query GroupId --output text)
    aws ec2 authorize-security-group-ingress --region ${REGION} --group-id ${SG_ID} --protocol tcp --port 22 --cidr 0.0.0.0/0
    aws ec2 authorize-security-group-ingress --region ${REGION} --group-id ${SG_ID} --protocol tcp --port 80 --cidr 0.0.0.0/0
    aws ec2 authorize-security-group-ingress --region ${REGION} --group-id ${SG_ID} --protocol tcp --port 3000 --cidr 0.0.0.0/0 # Dashboard
    aws ec2 authorize-security-group-ingress --region ${REGION} --group-id ${SG_ID} --protocol tcp --port 4000 --cidr 0.0.0.0/0 # API
fi
echo "Using SG: ${SG_ID}"

# 2.5 Configure IAM Role & Instance Profile (Required for SSM)
echo "[2.5/4] Checking IAM Role & Instance Profile..."
ROLE_NAME="TradingBotSSMRole"
PROFILE_NAME="TradingBotSSMProfile"

# Check if Role exists
ROLE_ARN=$(aws iam get-role --role-name ${ROLE_NAME} --query "Role.Arn" --output text 2>/dev/null || echo "None")
if [ "$ROLE_ARN" == "None" ]; then
    echo "Creating IAM Role ${ROLE_NAME}..."
    TRUST_POLICY='{
      "Version": "2012-10-17",
      "Statement": [
        {
          "Effect": "Allow",
          "Principal": { "Service": "ec2.amazonaws.com" },
          "Action": "sts:AssumeRole"
        }
      ]
    }'
    aws iam create-role --role-name ${ROLE_NAME} --assume-role-policy-document "${TRUST_POLICY}" >/dev/null
    aws iam attach-role-policy --role-name ${ROLE_NAME} --policy-arn arn:aws:iam::aws:policy/AmazonSSMManagedInstanceCore
    # Wait for propagation
    sleep 5
fi

# Check if Profile exists
PROFILE_ARN=$(aws iam get-instance-profile --instance-profile-name ${PROFILE_NAME} --query "InstanceProfile.Arn" --output text 2>/dev/null || echo "None")
if [ "$PROFILE_ARN" == "None" ]; then
    echo "Creating Instance Profile ${PROFILE_NAME}..."
    aws iam create-instance-profile --instance-profile-name ${PROFILE_NAME} >/dev/null
    aws iam add-role-to-instance-profile --instance-profile-name ${PROFILE_NAME} --role-name ${ROLE_NAME}
    # Wait for propagation
    echo "Waiting for IAM propagation..."
    sleep 10
fi


# 3. Launch or Retrieve Spot Instance
echo "[2/4] Checking for existing instance..."
EXISTING_ID=$(aws ec2 describe-instances \
    --region ${REGION} \
    --filters "Name=tag:Name,Values=${PROJECT_NAME}-spot" "Name=instance-state-name,Values=running" \
    --query "Reservations[0].Instances[0].InstanceId" --output text)

if [ "$EXISTING_ID" != "None" ] && [ ! -z "$EXISTING_ID" ]; then
    echo "✅ Found running instance: ${EXISTING_ID}. Skipping launch."
    INSTANCE_ID=$EXISTING_ID
else
    echo "No running instance found. Requesting new Spot Instance (20GB Storage)..."
    INSTANCE_ID=$(aws ec2 run-instances \
        --region ${REGION} \
        --image-id resolve:ssm:/aws/service/canonical/ubuntu/server/22.04/stable/current/amd64/hvm/ebs-gp2/ami-id \
        --count 1 \
        --instance-type ${INSTANCE_TYPE} \
        --key-name ${KEY_NAME} \
        --security-group-ids ${SG_ID} \
        --iam-instance-profile Name=${PROFILE_NAME} \
        --instance-market-options '{"MarketType":"spot","SpotOptions":{"SpotInstanceType":"one-time"}}' \
        --block-device-mappings '[{"DeviceName":"/dev/sda1","Ebs":{"VolumeSize":20,"DeleteOnTermination":true,"VolumeType":"gp3"}}]' \
        --tag-specifications "ResourceType=instance,Tags=[{Key=Name,Value=${PROJECT_NAME}-spot}]" \
        --query 'Instances[0].InstanceId' \
        --output text)
    
    echo "Launched Instance: ${INSTANCE_ID}. Waiting for running state..."
    aws ec2 wait instance-running --region ${REGION} --instance-ids ${INSTANCE_ID}
fi

PUBLIC_IP=$(aws ec2 describe-instances --region ${REGION} --instance-ids ${INSTANCE_ID} --query 'Reservations[0].Instances[0].PublicIpAddress' --output text)
echo "Instance is UP at ${PUBLIC_IP}"

echo "[3/4] Waiting for SSH (approx 30s)..."
sleep 30 # Give sshd time to start

# 4. Provision & Deploy (SSH Remote Execution)
echo "[4/4] Provisioning Server & Deploying..."

# Create a tarball of the project (excluding node_modules/git)
# Create a zip of the project (excluding node_modules/git)
echo "Packing project..."
# Remove Mac dot-underscore files locally first to be safe
find . -name "._*" -delete || true

# Use zip which isolates Mac metadata into __MACOSX folder which we can delete
zip -r -q project.zip . -x "node_modules/*" -x ".git/*" -x ".terraform/*" -x "._*"

# Copy to Server
scp -o StrictHostKeyChecking=no -i ${KEY_NAME}.pem project.zip ubuntu@${PUBLIC_IP}:~/

# Run Setup Script Remotely
ssh -o StrictHostKeyChecking=no -i ${KEY_NAME}.pem ubuntu@${PUBLIC_IP} << 'EOF'
    # 1. Setup Swap (CRITICAL for t3.micro)
    if [ ! -f /swapfile ]; then
        echo "Creating 2GB Swap..."
        sudo fallocate -l 2G /swapfile
        sudo chmod 600 /swapfile
        sudo mkswap /swapfile
        sudo swapon /swapfile
        echo '/swapfile none swap sw 0 0' | sudo tee -a /etc/fstab
    fi

    # 2. Install Docker & Unzip
    echo "Installing Docker..."
    sudo apt-get update -y
    sudo apt-get install -y docker.io docker-compose-v2 unzip
    sudo usermod -aG docker ubuntu || true
    sudo usermod -aG docker ubuntu

    # 3. Unpack & Deploy
    mkdir -p trading-system
    # Unzip and remove __MACOSX folder if it exists
    unzip -q -o project.zip -d trading-system
    rm -rf trading-system/__MACOSX
    
    cd trading-system

    # 4. Start Docker Compose
    echo "Starting Containers..."
    
    # Extract Version and add to .env
    VERSION=$(grep '"tag":' version.json | awk -F '"' '{print $4}')
    echo "APP_VERSION=$VERSION" >> .env
    echo "Deploying Version: $VERSION"

    # Use the optimized prod file
    sudo docker compose -f docker-compose.prod.yml up -d --build

    # Prune to save space
    sudo docker system prune -f
EOF

echo "----------------------------------------------------------------"
echo "✅ Deployment Complete!"
echo "Dashboard: http://${PUBLIC_IP}:3000"
echo "API:       http://${PUBLIC_IP}:4000"
echo "SSH:       ssh -i ${KEY_NAME}.pem ubuntu@${PUBLIC_IP}"
echo "----------------------------------------------------------------"
rm project.zip
