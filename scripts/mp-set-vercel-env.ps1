# Carga variables Mercado Pago en Vercel (production + preview).
# Requiere: vercel login  |  y el Access Token de la app MP (test primero).
#
# Uso:
#   $env:MERCADOPAGO_ACCESS_TOKEN = "APP_USR-...."
#   powershell -ExecutionPolicy Bypass -File scripts/mp-set-vercel-env.ps1

$ErrorActionPreference = "Stop"
$Root = Split-Path -Parent $PSScriptRoot
Set-Location $Root

$token = $env:MERCADOPAGO_ACCESS_TOKEN
if (-not $token -or $token.Length -lt 10) {
  Write-Error "Definí MERCADOPAGO_ACCESS_TOKEN en el entorno antes de correr este script."
}

$webhook = if ($env:MERCADOPAGO_WEBHOOK_URL) { $env:MERCADOPAGO_WEBHOOK_URL } else { "https://www.plotcenterlab.com.ar" }
$sandbox = if ($env:MERCADOPAGO_SANDBOX) { $env:MERCADOPAGO_SANDBOX } else { "true" }

Write-Host "Proyecto: $Root"
Write-Host "Webhook:  $webhook"
Write-Host "Sandbox:  $sandbox"

function Set-VercelEnv([string]$Name, [string]$Value, [string]$EnvName) {
  Write-Host "→ vercel env add $Name $EnvName"
  $Value | npx --yes vercel env add $Name $EnvName --force 2>$null
  if ($LASTEXITCODE -ne 0) {
    # Fallback interactivo / overwrite
    $Value | npx --yes vercel env add $Name $EnvName
  }
}

foreach ($e in @("production", "preview")) {
  Set-VercelEnv "MERCADOPAGO_ACCESS_TOKEN" $token $e
  Set-VercelEnv "MERCADOPAGO_WEBHOOK_URL" $webhook $e
  Set-VercelEnv "MERCADOPAGO_SANDBOX" $sandbox $e
}

Write-Host ""
Write-Host "Listo. Redeploy: npx vercel --prod"
Write-Host "Verificar: node scripts/mp-onboard.mjs --ping-webhook"
