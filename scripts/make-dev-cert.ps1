# 生成一张自签名的「代码签名」证书，用于本机开发/自测打签名包。
#
# 说明：自签名证书能产生合法的 Authenticode 签名，但它的根不在系统信任列表里，
#       所以别人机器上安装时 SmartScreen 仍会提示"未知发布者"。
#       正式发布请替换为 CA（DigiCert / Sectigo 等）颁发的代码签名证书：
#       把 CA 给的 .pfx 放到 certs\qingjian-sign.pfx（或改 sign-and-package.ps1 里的路径）即可，
#       无需改动任何代码。

$ErrorActionPreference = 'Stop'

$root = Split-Path -Parent $PSScriptRoot
$certDir = Join-Path $root 'certs'
New-Item -ItemType Directory -Force -Path $certDir | Out-Null

$pfx = Join-Path $certDir 'qingjian-sign.pfx'
$pwdFile = Join-Path $certDir 'qingjian-sign.pwd'
$password = 'qingjian-dev'   # 仅本机开发用口令，不是机密；正式证书请自行保管口令

$secure = ConvertTo-SecureString -String $password -AsPlainText -Force

$cert = New-SelfSignedCertificate `
  -Type CodeSigningCert `
  -Subject 'CN=QingJian, O=QingJian, C=CN' `
  -FriendlyName 'QingJian Code Signing (Dev)' `
  -CertStoreLocation 'Cert:\CurrentUser\My' `
  -KeyUsage DigitalSignature `
  -KeyExportPolicy Exportable `
  -KeyAlgorithm RSA `
  -KeyLength 3072 `
  -NotAfter (Get-Date).AddYears(3)

Export-PfxCertificate -Cert $cert -FilePath $pfx -Password $secure | Out-Null
Set-Content -Path $pwdFile -Value $password -NoNewline -Encoding ascii

Write-Host '[ok] 已生成自签名代码签名证书'
Write-Host "     PFX        : $pfx"
Write-Host "     Subject    : $($cert.Subject)"
Write-Host "     Thumbprint : $($cert.Thumbprint)"
Write-Host "     NotAfter   : $($cert.NotAfter)"
