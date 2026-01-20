# 🚀 Deployment Guide: Low-Cost Spot Instance

This project uses a cost-optimized architecture running on a single AWS EC2 **t3.micro Spot Instance**.
All services (Frontend, Backend, Kafka, Redis, DB) run via Docker Compose on this single node.

**Estimated Cost**: ~ $3.00 / month

---

## 1. Prerequisites

### Local Tools (for manual deployment)

- AWS CLI (`brew install awscli`)
- Zip (`brew install zip`)

### GitHub Secrets (for CI/CD)

You must set these in **Settings -> Secrets and variables -> Actions**:

| Secret Name             | Value                        |
| :---------------------- | :--------------------------- |
| `AWS_ACCESS_KEY_ID`     | Your AWS Access Key ID       |
| `AWS_SECRET_ACCESS_KEY` | Your AWS Secret Access Key   |
| `SSH_PRIVATE_KEY`       | Content of `trading-key.pem` |

---

## 2. Automated Deployment (CI/CD)

**Recommended Method**

Every time you push to the `main` branch, the deployment workflow runs automatically.

1.  Commit your changes:
    ```bash
    git add .
    git commit -m "feat: amazing new feature"
    ```
2.  Push to main:
    ```bash
    git push origin main
    ```
3.  Watch the progress in the **Actions** tab on GitHub.

---

## 3. Manual Deployment

If you need to deploy from your local machine:

1.  Make sure you have `trading-key.pem` in the project root.
2.  Run the script:
    ```bash
    ./scripts/deploy_spot.sh
    ```
    _(The script will automatically handle zipping, uploading, and restarting the services)_

---

## 4. Troubleshooting

### "Disk Space Full" (ENOSPC)

The script now requests a **20GB** disk by default. If you see this, check if an old 8GB instance is still running and terminate it manually via AWS Console.

### "Valid UTF-8" Error (Next.js)

This was caused by Mac metadata (`._` files). The script now uses `zip` instead of `tar` to cleanly remove these artifacts before upload.

---

## 5. Directory Structure

- `.github/workflows/deploy.yml`: CI/CD Workflow configuration.
- `scripts/deploy_spot.sh`: Main deployment logic (Idempotent).
- `docker-compose.prod.yml`: Production Docker configuration (Optimized memory limits).
