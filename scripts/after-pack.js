// electron-builder 的 afterPack 钩子：删掉 Electron 分发里本应用用不到的文件，减小安装体积。
//
// 保留：
//   - icudtl.dat / *.pak          运行时必需（i18n、资源）
//   - vk_swiftshader.dll / vulkan-1.dll / libEGL / libGLESv2
//                                 GPU 不可用时（虚拟机/远程桌面/老显卡）的软件渲染回退，必须保留
//   - d3dcompiler_47.dll          ANGLE 走 D3D11 时编译着色器需要
//   - LICENSES.chromium.html      Chromium 的开源许可声明（合规，尽量别删）
//
// 删除：
//   - dxcompiler.dll / dxil.dll   DXIL 着色器编译器，仅 WebGPU / D3D12 路径使用；
//                                 本应用不用 WebGPU，缺失时 Chromium 会回退到 D3D11 / SwiftShader
const fs = require('fs')
const path = require('path')

const DROP = ['dxcompiler.dll', 'dxil.dll']

module.exports = async function afterPack(context) {
  const dir = context.appOutDir
  let freed = 0
  for (const name of DROP) {
    const file = path.join(dir, name)
    try {
      const size = fs.statSync(file).size
      fs.rmSync(file, { force: true })
      freed += size
      console.log(`  • [afterPack] 移除 ${name}  省 ${(size / 1048576).toFixed(1)} MB`)
    } catch {
      // 不存在就忽略（不同 Electron 版本文件名可能不同）
    }
  }
  if (freed) {
    console.log(`  • [afterPack] 共减少约 ${(freed / 1048576).toFixed(1)} MB`)
  }
}
