#!/bin/bash
set -e

# ==============================================================================
# 💸 ROBUST CHEAP EC2 SPOT DEPLOYMENT (us-east-1)
# ==============================================================================
# Provisions a Spot Instance.
# FALLBACK STRATEGY: Tries t3.micro -> t3a.micro -> t2.micro if capacity fails.
# ==============================================================================

REGION="us-east-1"
# List of instance types to try in order of preference
INSTANCE_CANDIDATES=("t3.micro" "t3a.micro" "t2.micro")
AMI_ID="resolve:ssm:/aws/service/canonical/ubuntu/server/22.04/stable/current/amd64/hvm/ebs-gp2/ami-id"
KEY_NAME="trading-key-final"
SEC_GROUP="TradingSG"
PROJECT_NAME="nifty50-trading"

echo "----------------------------------------------------------------"
echo "🚀 Starting Robust Deployment to ${REGION}"
echo "----------------------------------------------------------------"

# 1. Check Key Pair
if [ ! -f "${KEY_NAME}.pem" ]; then
    echo "⚠️  Key pair ${KEY_NAME}.pem not found locally!"
    echo "    In CI/CD, ensure you write the secret to this file."
    exit 1
fi

# 2. Check/Create Security Group
echo "[1/4] Configuring Security Group..."
SG_ID=$(aws ec2 describe-security-groups --region ${REGION} --group-names ${SEC_GROUP} --query "SecurityGroups[0].GroupId" --output text 2>/dev/null || echo "None")

if [ "$SG_ID" == "None" ]; then
    echo "Creating Security Group ${SEC_GROUP}..."
    SG_ID=$(aws ec2 create-security-group --region ${REGION} --group-name ${SEC_GROUP} --description "Trading Bot SG" --query GroupId --output text)
fi

echo "Ensuring Security Group Rules for ${SG_ID}..."
# Use || true to prevent failure if rules already exist
aws ec2 authorize-security-group-ingress --region ${REGION} --group-id ${SG_ID} --protocol tcp --port 22 --cidr 0.0.0.0/0 2>/dev/null || true
aws ec2 authorize-security-group-ingress --region ${REGION} --group-id ${SG_ID} --protocol tcp --port 80 --cidr 0.0.0.0/0 2>/dev/null || true
aws ec2 authorize-security-group-ingress --region ${REGION} --group-id ${SG_ID} --protocol tcp --port 3000 --cidr 0.0.0.0/0 2>/dev/null || true
aws ec2 authorize-security-group-ingress --region ${REGION} --group-id ${SG_ID} --protocol tcp --port 4000 --cidr 0.0.0.0/0 2>/dev/null || true

# 2.5 Configure IAM Role & Instance Profile
echo "[2.5/4] Checking IAM Role & Instance Profile..."
ROLE_NAME="TradingBotSSMRole"
PROFILE_NAME="TradingBotSSMProfile"

ROLE_ARN=$(aws iam get-role --role-name ${ROLE_NAME} --query "Role.Arn" --output text 2>/dev/null || echo "None")
if [ "$ROLE_ARN" == "None" ]; then
    TRUST_POLICY='{"Version": "2012-10-17","Statement": [{"Effect": "Allow","Principal": { "Service": "ec2.amazonaws.com" },"Action": "sts:AssumeRole"}]}'
    aws iam create-role --role-name ${ROLE_NAME} --assume-role-policy-document "${TRUST_POLICY}" >/dev/null
    aws iam attach-role-policy --role-name ${ROLE_NAME} --policy-arn arn:aws:iam::aws:policy/AmazonSSMManagedInstanceCore
    sleep 5
fi

PROFILE_ARN=$(aws iam get-instance-profile --instance-profile-name ${PROFILE_NAME} --query "InstanceProfile.Arn" --output text 2>/dev/null || echo "None")
if [ "$PROFILE_ARN" == "None" ]; then
    aws iam create-instance-profile --instance-profile-name ${PROFILE_NAME} >/dev/null
    aws iam add-role-to-instance-profile --instance-profile-name ${PROFILE_NAME} --role-name ${ROLE_NAME}
    sleep 10
fi

# 3. Launch or Retrieve Spot Instance (With Failover Loop)
echo "[2/4] Checking for existing instance..."
EXISTING_ID=$(aws ec2 describe-instances \
    --region ${REGION} \
    --filters "Name=tag:Name,Values=${PROJECT_NAME}-spot" "Name=instance-state-name,Values=running" \
    --query "Reservations[0].Instances[0].InstanceId" --output text)

if [ "$EXISTING_ID" != "None" ] && [ ! -z "$EXISTING_ID" ]; then
    echo "✅ Found running instance: ${EXISTING_ID}. Skipping launch."
    INSTANCE_ID=$EXISTING_ID
else
    echo "No running instance found. Attempting to launch new Spot Instance..."
    
    INSTANCE_ID="None"
    
    # === FAILOVER LOOP START ===
    for TYPE in "${INSTANCE_CANDIDATES[@]}"; do
        echo "🔄 Attempting to launch spot instance type: ${TYPE}..."
        
        # We use 'set +e' to allow this command to fail without killing the script
        set +e
        NEW_ID=$(aws ec2 run-instances \
            --region ${REGION} \
            --image-id ${AMI_ID} \
            --count 1 \
            --instance-type ${TYPE} \
            --key-name ${KEY_NAME} \
            --security-group-ids ${SG_ID} \
            --iam-instance-profile Name=${PROFILE_NAME} \
            --instance-market-options '{"MarketType":"spot","SpotOptions":{"SpotInstanceType":"one-time"}}' \
            --block-device-mappings '[{"DeviceName":"/dev/sda1","Ebs":{"VolumeSize":20,"DeleteOnTermination":true,"VolumeType":"gp3"}}]' \
            --tag-specifications "ResourceType=instance,Tags=[{Key=Name,Value=${PROJECT_NAME}-spot}]" \
            --query 'Instances[0].InstanceId' \
            --output text 2>&1)
        EXIT_CODE=$?
        set -e # Turn strict mode back on
        
        if [ $EXIT_CODE -eq 0 ]; then
            INSTANCE_ID=$NEW_ID
            echo "✅ Success! Launched ${TYPE} (${INSTANCE_ID})"
            break # Exit the loop, we found one!
        else
            echo "⚠️  Failed to launch ${TYPE}. AWS said: $NEW_ID"
            echo "👉 Switching to next cheapest option..."
        fi
    done
    # === FAILOVER LOOP END ===

    if [ "$INSTANCE_ID" == "None" ] || [ -z "$INSTANCE_ID" ]; then
        echo "❌ CRITICAL ERROR: Could not launch ANY instance type. All candidates failed."
        exit 1
    fi
    
    echo "Waiting for instance to be ready..."
    aws ec2 wait instance-running --region ${REGION} --instance-ids ${INSTANCE_ID}
fi

PUBLIC_IP=$(aws ec2 describe-instances --region ${REGION} --instance-ids ${INSTANCE_ID} --query 'Reservations[0].Instances[0].PublicIpAddress' --output text)
echo "Instance is UP at ${PUBLIC_IP}"

echo "[3/4] Waiting for SSH (approx 30s)..."
sleep 30

# 4. Provision & Deploy
echo "[4/4] Provisioning Server & Deploying..."
echo "Packing project..."
find . -name "._*" -delete || true
zip -r -q project.zip . -x "node_modules/*" -x ".git/*" -x ".terraform/*" -x "._*"

scp -o StrictHostKeyChecking=no -i ${KEY_NAME}.pem project.zip ubuntu@${PUBLIC_IP}:~/

ssh -o StrictHostKeyChecking=no -i ${KEY_NAME}.pem ubuntu@${PUBLIC_IP} << 'EOF'
    # 1. Setup Swap
    if [ ! -f /swapfile ]; then
        echo "Creating 2GB Swap..."
        sudo fallocate -l 2G /swapfile
        sudo chmod 600 /swapfile
        sudo mkswap /swapfile
        sudo swapon /swapfile
        echo '/swapfile none swap sw 0 0' | sudo tee -a /etc/fstab
    fi

    # 2. Install Docker
    echo "Installing Docker..."
    sudo apt-get update -y
    sudo apt-get install -y docker.io docker-compose-v2 unzip
    sudo usermod -aG docker ubuntu || true

    # 3. Unpack & Deploy
    mkdir -p trading-system
    unzip -q -o project.zip -d trading-system
    rm -rf trading-system/__MACOSX
    cd trading-system

    # 4. Start Docker Compose
    echo "Starting Containers..."
    VERSION=$(grep '"tag":' version.json | awk -F '"' '{print $4}')
    echo "APP_VERSION=$VERSION" >> .env
    echo "Deploying Version: $VERSION"

    sudo docker compose -f docker-compose.prod.yml up -d --build
    sudo docker system prune -f
EOF

echo "----------------------------------------------------------------"
echo "✅ Deployment Complete!"
echo "Dashboard: http://${PUBLIC_IP}:3000"
echo "API:       http://${PUBLIC_IP}:4000"
echo "SSH:       ssh -i ${KEY_NAME}.pem ubuntu@${PUBLIC_IP}"
echo "----------------------------------------------------------------"
rm project.zip