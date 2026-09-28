// 设计令牌：清新薄荷 · 玻璃拟态
// 供 Naive UI themeOverrides 与组件样式共同使用

export const themeDefs = {
  light: {
    label: '清新',
    css: {
      accent: '#2fbf8f',
      accentDeep: '#25a67b',
      bg: '#f2f6f3',
      surface: 'rgba(255, 255, 255, .72)',
      surfaceSolid: '#ffffff',
      text: '#2d3833',
      muted: '#7b8781',
      line: 'rgba(45, 56, 51, .08)',
      danger: '#e5564b',
      dangerSoft: 'rgba(229, 86, 75, .1)',
      scroll: 'rgba(45, 56, 51, .16)',
      shadow1: '0 1px 2px rgba(30,41,36,.05), 0 2px 8px rgba(30,41,36,.04)',
      shadow2: '0 8px 24px rgba(30,41,36,.12)',
      shadowWin: '0 16px 48px rgba(20,30,26,.2)'
    },
    naive: {
      common: {
        primaryColor: '#2fbf8f',
        primaryColorHover: '#25a67b',
        primaryColorPressed: '#1f8f6a',
        primaryColorSuppl: '#4fd0a3',
        borderRadius: '9px',
        textColorBase: '#2d3833'
      }
    }
  },
  white: {
    label: '白底',
    css: {
      accent: '#2fbf8f',
      accentDeep: '#25a67b',
      bg: '#fafafa',
      surface: 'rgba(255, 255, 255, .78)',
      surfaceSolid: '#ffffff',
      text: '#2d3833',
      muted: '#7b8781',
      line: 'rgba(45, 56, 51, .1)',
      danger: '#e5564b',
      dangerSoft: 'rgba(229, 86, 75, .1)',
      scroll: 'rgba(45, 56, 51, .18)',
      shadow1: '0 1px 2px rgba(30,41,36,.06), 0 2px 8px rgba(30,41,36,.05)',
      shadow2: '0 8px 24px rgba(30,41,36,.13)',
      shadowWin: '0 16px 48px rgba(20,30,26,.2)'
    },
    naive: {
      common: {
        primaryColor: '#2fbf8f',
        primaryColorHover: '#25a67b',
        primaryColorPressed: '#1f8f6a',
        primaryColorSuppl: '#4fd0a3',
        borderRadius: '9px',
        textColorBase: '#2d3833'
      }
    }
  },
  dark: {
    label: '暗色',
    css: {
      accent: '#4fd0a3',
      accentDeep: '#6adbb4',
      bg: '#161d1a',
      surface: 'rgba(30, 38, 34, .68)',
      surfaceSolid: '#222b26',
      text: '#e4ece8',
      muted: '#8b988f',
      line: 'rgba(255, 255, 255, .08)',
      danger: '#f07a6f',
      dangerSoft: 'rgba(240, 122, 111, .14)',
      scroll: 'rgba(255, 255, 255, .14)',
      shadow1: '0 1px 2px rgba(0,0,0,.25), 0 2px 8px rgba(0,0,0,.2)',
      shadow2: '0 8px 24px rgba(0,0,0,.4)',
      shadowWin: '0 16px 48px rgba(0,0,0,.5)'
    },
    naive: {
      common: {
        primaryColor: '#4fd0a3',
        primaryColorHover: '#6adbb4',
        primaryColorPressed: '#3fae88',
        primaryColorSuppl: '#2fbf8f',
        borderRadius: '9px',
        textColorBase: '#e4ece8'
      }
    }
  }
}

// 便笺六色：常规便笺配色（明快、好辨认）
// 说明：--paper 的明暗由 base.css 按 [data-theme] 落地；此处 light/dark 供 JS 侧使用
export const noteColors = {
  yellow: { light: '#fff4c2', dark: '#332e18', swatch: '#f5c93f' }, // 便签黄
  green: { light: '#d7f0d5', dark: '#1f2d20', swatch: '#7ec98a' },  // 草绿
  blue: { light: '#d3e8fb', dark: '#1e2836', swatch: '#7fb6ea' },   // 天蓝
  pink: { light: '#fbdde5', dark: '#332027', swatch: '#ef9ab3' },   // 桃粉
  purple: { light: '#e6dcf7', dark: '#2a2436', swatch: '#b39ddb' }, // 薰衣草
  white: { light: '#ffffff', dark: '#1f211f', swatch: '#cfd4d0' }   // 纯白
}

export const noteColorKeys = Object.keys(noteColors)
