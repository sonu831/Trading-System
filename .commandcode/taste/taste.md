# Taste (Continuously Learned by [CommandCode][cmd])

[cmd]: https://commandcode.ai/

# Architecture
- Store all credentials and configuration in the database managed via dashboard UI, not in .env files. All layers including ingestion must authenticate via the API/dashboard, not from .env. Avoid Docker image rebuilds for credential changes. Confidence: 0.85
- For mstock provider: Store the JWT access token (from MConnect login response) in the database after initial login and reuse it for subsequent requests rather than re-authenticating each time. Confidence: 0.70

