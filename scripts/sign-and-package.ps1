# 用证书对安装包做数字签名并打包（会签名 app 主程序 / 卸载器 / 安装包）。
#
# 证书来源优先级：
#   1) 外部已设置的 CSC_LINK / CSC_KEY_PASSWORD（CI 或正式证书常用这种）
#   2) certs\qingjian-sign.pfx（+ 同目录 .pwd 里的口令）
#   3) 都没有 → 自动调用 make-dev-cert.ps1 生成一张自签名开发证书
#
# 用法：
#   npm run dist               # 构建 + 签名打包（自动确保有证书）
#   npm run dist:unsigned      # 不签名打包
#   npm run cert:dev           # 只生成开发证书

$ErrorActionPreference = 'Stop'

$root = Split-Path -Parent $PSScriptRoot
Set-Location $root

if (-not $env:CSC_LINK) {
  $pfx = Join-Path $root 'certs\qingjian-sign.pfx'
  $pwdFile = Join-Path $root 'certs\qingjian-sign.pwd'

  if (-not (Test-Path $pfx)) {
    Write-Host '未发现证书，生成自签名开发证书…'
    & (Join-Path $PSScriptRoot 'make-dev-cert.ps1')
  }

  $env:CSC_LINK = $pfx
  if (-not $env:CSC_KEY_PASSWORD) {
    $env:CSC_KEY_PASSWORD = if (Test-Path $pwdFile) { (Get-Content $pwdFile -Raw).Trim() } else { 'qingjian-dev' }
  }
}

Write-Host "使用证书签名：$($env:CSC_LINK)"
npx electron-builder --win
