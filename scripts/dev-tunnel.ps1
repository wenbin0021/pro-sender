# scripts/dev-tunnel.ps1
#
# Spins up an ngrok tunnel to localhost:3000 so MessageWhiz can POST delivery
# receipts to your dev server. Usage:
#
#   powershell -ExecutionPolicy Bypass -File scripts\dev-tunnel.ps1
#
# Or via npm:
#
#   npm run tunnel
#
# Prereqs:
#   - ngrok installed (https://ngrok.com/download) or available via winget
#   - First-run auth: `ngrok config add-authtoken <your-token>`

$ErrorActionPreference = "Stop"
$Port = 3000

function Has-Ngrok {
    return [bool](Get-Command ngrok -ErrorAction SilentlyContinue)
}

if (-not (Has-Ngrok)) {
    Write-Host "ngrok not found on PATH." -ForegroundColor Yellow
    $hasWinget = [bool](Get-Command winget -ErrorAction SilentlyContinue)
    if ($hasWinget) {
        $answer = Read-Host "Install via winget now? [Y/n]"
        if ($answer -eq "" -or $answer -match "^[Yy]") {
            winget install --id Ngrok.Ngrok --silent --accept-source-agreements --accept-package-agreements
            if (-not (Has-Ngrok)) {
                Write-Host "Install ran but `ngrok` still isn't on PATH. Open a new PowerShell window and try again." -ForegroundColor Red
                exit 1
            }
        } else {
            Write-Host "Skipping install. Get ngrok from https://ngrok.com/download then re-run." -ForegroundColor Yellow
            exit 1
        }
    } else {
        Write-Host "winget is unavailable. Install ngrok manually from https://ngrok.com/download." -ForegroundColor Red
        exit 1
    }
}

# Check the dev server is actually listening — ngrok would happily expose
# nothing otherwise.
try {
    $null = Invoke-WebRequest -Uri "http://localhost:$Port" -Method Head -TimeoutSec 2 -UseBasicParsing
} catch {
    Write-Host "Nothing is responding on http://localhost:$Port — start `npm run dev` first in another terminal." -ForegroundColor Yellow
    Write-Host "(Continuing anyway in case the server is starting up.)" -ForegroundColor DarkGray
}

Write-Host ""
Write-Host "Starting ngrok tunnel for http://localhost:$Port..." -ForegroundColor Cyan
Write-Host "Copy the https://*.ngrok-free.app URL it prints into APP_BASE_URL in .env.local," -ForegroundColor DarkGray
Write-Host "and also paste {that URL}/api/webhook/sms into the MMDSmart dashboard callback field." -ForegroundColor DarkGray
Write-Host ""

ngrok http $Port
