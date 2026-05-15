# Deploy to a VPS

Targets a fresh **Debian / Ubuntu** VPS (1 vCPU / 1 GB RAM is enough). Installs Node 20, nginx, builds the app, sets up a systemd service. **Runs as `root`.**

## One-shot install

SSH into the VPS as root, then paste:

```bash
export ADMIN_PASSWORD='choose-a-strong-password'
export MMDSMART_API_KEY='your-mmdsmart-api-key'
curl -fsSL https://raw.githubusercontent.com/wenbin0021/pro-sender/master/scripts/deploy.sh | bash
```

The script:

1. Installs `nodejs` (NodeSource 20.x), `nginx`, `git`, build tools
2. Clones the repo into `/opt/pro-sender`
3. Runs `npm ci` + `npm run build`
4. Writes `/opt/pro-sender/.env.local` with the generated `AUTH_SECRET` + `MMDSMART_WEBHOOK_SECRET`, plus your `ADMIN_PASSWORD` and `MMDSMART_API_KEY`
5. Creates a `pro-sender` systemd service (auto-starts on boot, auto-restarts on crash)
6. Configures nginx as a reverse proxy on port 80 → 3000

Re-running the script is **idempotent** — it pulls the latest commit, rebuilds, and restarts. `.env.local` is preserved across runs.

## After it finishes

The script prints:

- The app URL (e.g. `http://<your-vps-ip>`)
- The login credentials (`admin` / your password)
- **The webhook URL + secret** to configure in your mmdsmart dashboard

Go log into your mmdsmart account and set the **Delivery Receipt webhook URL** to:

```
http://<your-vps-ip>/api/webhook/sms
```

…and the **X-Webhook-Secret** header to the value the script printed. Without this, delivery status stays `pending` because mmdsmart's callback never reaches you.

## Useful commands

```bash
systemctl status pro-sender       # is it running?
journalctl -u pro-sender -f       # tail the app logs
systemctl restart pro-sender      # restart after editing .env.local
nano /opt/pro-sender/.env.local   # tweak env vars
```

## Redeploy after a `git push`

Just re-run the one-shot install command — it'll pull, rebuild, and restart, keeping the existing `.env.local`.

Or, if SSH'd in:

```bash
cd /opt/pro-sender
git pull && npm ci && npm run build && systemctl restart pro-sender
```

## Add a domain (later)

```bash
# 1. Point your domain's A record to this VPS IP, wait for DNS to propagate
# 2. Get a free Let's Encrypt cert:
apt install -y certbot python3-certbot-nginx
certbot --nginx -d your-domain.com
# 3. Update the env file:
sed -i 's|APP_BASE_URL=.*|APP_BASE_URL=https://your-domain.com|' /opt/pro-sender/.env.local
systemctl restart pro-sender
# 4. In mmdsmart dashboard, change the webhook URL to use https://your-domain.com/api/webhook/sms
```
