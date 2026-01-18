# 🌐 Public Exposure Guide

This guide explains how to expose your Trading System (Dashboard, Grafana, API) to the internet so you can show it to your friends.

## Option 1: The "Pro" Unified Gateway (Recommended)

This method uses an Nginx gateway to put all services under ONE URL. It's clean, professional, and handles all path routing automatically.

### 1. Launch the Gateway

Run the specialized exposure configuration:

```bash
# Start the system with the Exposure Gateway enabled
docker-compose -f docker-compose.yml -f docker-compose.expose.yml --profile app up -d
```

### 2. Get a Public URL

You have two sub-options for the tunnel:

#### A. Automtated Cloudflare Tunnel (Easiest)

The `docker-compose.expose.yml` includes a `tunnel` service.

1. Run it: `docker-compose -f docker-compose.yml -f docker-compose.expose.yml --profile expose up -d tunnel`
2. Check the logs to find your random URL:
   `docker logs trading-tunnel 2>&1 | grep trycloudflare.com`
3. Share that URL!

#### B. Manual LocalTunnel (If you prefer NPM)

1. Install localtunnel: `npm install -g localtunnel`
2. Expose the gateway (Port 8088): `lt --port 8088`
3. Share the generated URL!

### 3. What your friends will see

Once they open the URL:

- **`https://your-url.loca.lt/`** -> Main Dashboard
- **`https://your-url.loca.lt/grafana/`** -> Grafana (Login: `admin` / `admin123`)
- **`https://your-url.loca.lt/kafka/`** -> Kafka UI
- **`https://your-url.loca.lt/api/v1/system-status`** -> Raw API Status

---

## Option 2: Quick Multi-Tunnel (The "I'm in a hurry" way)

If you just want to show the Dashboard and don't care about unified links.

1. **Dashboard**: `npx localtunnel --port 3000`
2. **Grafana**: `npx localtunnel --port 3001`

> [!WARNING]
> **Dashboard API Limitation**: In Option 2, the Dashboard might not show live data if its API endpoint is still pointing to `localhost`. Option 1 is strongly recommended as it fixes this by using relative paths.

---

## 🛠 Troubleshooting

- **White Screen in Dashboard**: Ensure the API is healthy. Check `trading-gateway` logs.
- **Grafana CSS/JS break**: Ensure you used the `docker-compose.expose.yml` which sets the `GF_SERVER_ROOT_URL`.
- **"TryCloudflare" not showing URL**: It may take 10-20 seconds to establish the link. Re-run the log command.
