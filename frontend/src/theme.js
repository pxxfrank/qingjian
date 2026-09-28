import { themeDefs } from './tokens'

// 主进程 nativeTheme 下发的系统深色（比渲染层媒体查询更权威）
let systemDark = null

export function setSystemDark(v) {
  systemDark = !!v
}

// 把主题偏好解析为实际视觉主题（system 映射为 light/dark）
export function resolveVisual(pref) {
  if (pref === 'system') {
    const dark = systemDark == null
      ? window.matchMedia('(prefers-color-scheme: dark)').matches
      : systemDark
    return dark ? 'dark' : 'light'
  }
  return pref === 'white' || pref === 'dark' ? pref : 'light'
}

export function applyTheme(pref) {
  document.body.dataset.theme = resolveVisual(pref)
}

export function naiveOverrides(pref) {
  return themeDefs[resolveVisual(pref)].naive
}

export function themeLabel(pref) {
  return themeDefs[resolveVisual(pref)].label
}
