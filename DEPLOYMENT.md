# Production Deployment Guide

This guide covers deploying the Nifty 50 Trading System to production environments.

## Table of Contents

1. [Quick Start - Low-Cost AWS Spot Instance](#quick-start---low-cost-aws-spot-instance)
2. [Deployment Options](#deployment-options)
3. [Prerequisites](#prerequisites)
4. [Local Production Setup](#local-production-setup)
5. [AWS Full Deployment](#aws-full-deployment)
6. [Docker Swarm Deployment](#docker-swarm-deployment)
7. [Kubernetes Deployment](#kubernetes-deployment)
8. [Environment Configuration](#environment-configuration)
9. [Monitoring & Logging](#monitoring--logging)
10. [Backup & Recovery](#backup--recovery)
11. [Security Hardening](#security-hardening)
12. [Troubleshooting](#troubleshooting)

---

## Quick Start - Low-Cost AWS Spot Instance

**Best for**: Testing, small-scale deployments
**Cost**: ~$3/month
**Architecture**: Single EC2 t3.micro Spot Instance running all services via Docker Compose

### Prerequisites

**Local Tools**:

- AWS CLI: `brew install awscli`
- Zip: `brew install zip`

**GitHub Secrets** (for CI/CD in Settings → Secrets):

- `AWS_ACCESS_KEY_ID`
- `AWS_SECRET_ACCESS_KEY`
- `SSH_PRIVATE_KEY` (content of `trading-key.pem`)

### Automated Deployment (CI/CD)

```bash
# Commit changes
git add .
git commit -m "feat: deploy to production"

# Push to main (triggers auto-deployment)
git push origin main

# Monitor in GitHub Actions tab
```

### Manual Deployment

```bash
# Ensure you have trading-key.pem in project root
./scripts/deploy_spot.sh
```

### Troubleshooting Spot Instance

**Disk Space Full (ENOSPC)**:

- Script requests 20GB disk by default
- Check AWS Console for old 8GB instances and terminate

**Valid UTF-8 Error (Next.js)**:

- Fixed by using `zip` instead of `tar`
- Removes Mac metadata (`._` files) automatically

---

## Deployment Options

| Option               | Best For     | Complexity | Cost/Month | Scalability |
| -------------------- | ------------ | ---------- | ---------- | ----------- |
| **Spot Instance**    | Testing, POC | Low        | $3         | Limited     |
| **Local Production** | Small teams  | Low        | Minimal    | Limited     |
| **AWS Managed**      | Enterprise   | Medium     | $450+      | High        |
| **Docker Swarm**     | Self-hosted  | Medium     | $100+      | Medium      |
| **Kubernetes**       | Large-scale  | High       | $500+      | Very High   |

---

## Prerequisites

### System Requirements

**Minimum**:

- 4 CPU cores
- 8GB RAM
- 50GB SSD

**Recommended**:

- 8 CPU cores
- 16GB RAM
- 200GB SSD
- Ubuntu 22.04 LTS

### Software

- Docker 24.0+
- Docker Compose 2.20+
- Git 2.30+

### Network Ports

- `80/443`: HTTP/HTTPS
- `4000`: Core API
- `3000`: Dashboard
- `3001`: Grafana
- `9090`: Prometheus

---

## Local Production Setup

### Step 1: Clone & Configure

```bash
git clone https://github.com/your-org/Trading-System.git
cd Trading-System
git checkout main

# Configure environment
cp .env.production.example .env
nano .env  # Edit with production credentials
```

### Step 2: Start Services

```bash
# Start production stack
make up-prod

# Verify
docker ps
make logs
```

### Step 3: Health Check

```bash
curl http://localhost:4000/api/v1/health
open http://localhost:3001  # Grafana
```

### Step 4: Load Data

```bash
make batch  # Fetch historical data
```

---

## AWS Full Deployment

See detailed AWS deployment guide with ECS, RDS, ElastiCache, and MSK in the full documentation.

**Estimated Cost**: ~$450/month for full managed services

---

## Docker Swarm Deployment

For self-hosted high-availability deployments across multiple servers.

```bash
# Initialize swarm
docker swarm init --advertise-addr <MANAGER_IP>

# Deploy stack
docker stack deploy -c docker-compose.swarm.yml trading

# Scale services
docker service scale trading_analysis=3
```

---

## Kubernetes Deployment

For enterprise-scale deployments.

```bash
# Create namespace
kubectl create namespace trading-system

# Deploy via Helm
helm install trading ./k8s/charts/trading-system

# Scale
kubectl scale deployment analysis --replicas=5
```

---

## Environment Configuration

### Critical Production Settings

```bash
# Database
POSTGRES_PASSWORD=<strong-password>
PGSSLMODE=require

# Broker API
MSTOCK_API_KEY=<production-key>
MSTOCK_PASSWORD=<production-password>

# AI Provider
AI_PROVIDER=pytorch  # or openai/claude
OPENAI_API_KEY=<if-using-openai>

# Security
API_KEY_SALT=<random-32-char>
JWT_SECRET=<random-64-char>

# Feature Flags
ENABLE_LIVE_TRADING=true  # Use with caution!
```

---

## Monitoring & Logging

### Prometheus Metrics

```bash
# Access Prometheus
open http://localhost:9090

# Key metrics
- websocket_packets_total
- analysis_duration_seconds
- http_requests_total
```

### Grafana Dashboards

```bash
# Access Grafana
open http://localhost:3001

# Default login: admin / admin123

# Import dashboards from:
infrastructure/monitoring/grafana/dashboards/
```

---

## Backup & Recovery

### Automated Backups

```bash
# Add to crontab (daily at 2 AM)
0 2 * * * /usr/local/bin/backup-db.sh
```

**backup-db.sh**:

```bash
#!/bin/bash
DATE=$(date +%Y%m%d_%H%M%S)
docker exec timescaledb pg_dump -U trading nifty50 | \
  gzip > /backups/nifty50_$DATE.sql.gz

# Keep last 30 days
find /backups -name "*.sql.gz" -mtime +30 -delete
```

### Restore

```bash
gunzip < /backups/nifty50_20240125.sql.gz | \
  docker exec -i timescaledb psql -U trading nifty50
```

---

## Security Hardening

### Firewall (UFW)

```bash
# Allow SSH from trusted IPs only
sudo ufw allow from 203.0.113.0/24 to any port 22

# Allow HTTP/HTTPS
sudo ufw allow 80/tcp
sudo ufw allow 443/tcp

# Enable firewall
sudo ufw enable
```

### SSL/TLS (Let's Encrypt)

```bash
sudo apt install certbot python3-certbot-nginx
sudo certbot --nginx -d trading.example.com

# Auto-renewal
0 3 * * * certbot renew --quiet
```

---

## Troubleshooting

### High CPU

```bash
# Check container stats
docker stats

# Scale horizontally
docker service scale trading_analysis=3
```

### Out of Memory

```bash
# Increase limits in docker-compose.yml
services:
  analysis:
    deploy:
      resources:
        limits:
          memory: 2G
```

### Kafka Consumer Lag

```bash
# Check lag
kafka-consumer-groups --bootstrap-server kafka:9092 \
  --group candle-processors --describe

# Add more consumers
docker service scale trading_processing=3
```

---

## Support

**Documentation**:

- [ARCHITECTURE.md](ARCHITECTURE.md) - Technical details
- [README.md](README.md) - User guide

**Issues**: [GitHub Issues](https://github.com/your-repo/Trading-System/issues)

---

**Last Updated**: 2024-01-25
**Document Version**: 2.0
