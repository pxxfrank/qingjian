<template>
  <svg
    class="icon"
    width="18"
    height="18"
    viewBox="0 0 24 24"
    fill="none"
    stroke="currentColor"
    stroke-width="1.75"
    stroke-linecap="round"
    stroke-linejoin="round"
    aria-hidden="true"
    v-html="markup"
  ></svg>
</template>

<script setup>
import { computed } from 'vue'

// 统一规格的线性图标（Lucide 风格，24 视窗 / 线性描边），保证标题栏图标风格一致
const ICONS = {
  // 便笺颜色（调色板）
  palette:
    '<circle cx="13.5" cy="6.5" r="0.7" fill="currentColor" stroke="none"></circle>' +
    '<circle cx="17.5" cy="10.5" r="0.7" fill="currentColor" stroke="none"></circle>' +
    '<circle cx="8.5" cy="7.5" r="0.7" fill="currentColor" stroke="none"></circle>' +
    '<circle cx="6.5" cy="12.5" r="0.7" fill="currentColor" stroke="none"></circle>' +
    '<path d="M12 2C6.5 2 2 6.5 2 12s4.5 10 10 10c.93 0 1.65-.75 1.65-1.69 0-.44-.18-.83-.44-1.12-.29-.29-.44-.65-.44-1.13a1.64 1.64 0 0 1 1.67-1.67h2c3.05 0 5.55-2.5 5.55-5.55C21.99 6.01 17.46 2 12 2z"></path>',
  // 收起到贴边（向内收缩）
  collapse:
    '<polyline points="4 14 10 14 10 20"></polyline>' +
    '<polyline points="20 10 14 10 14 4"></polyline>' +
    '<line x1="14" y1="10" x2="21" y2="3"></line>' +
    '<line x1="3" y1="21" x2="10" y2="14"></line>',
  // 置顶（图钉）
  pin:
    '<path d="M12 17v5"></path>' +
    '<path d="M9 10.76a2 2 0 0 1-1.11 1.79l-1.78.9A2 2 0 0 0 5 15.24V16a1 1 0 0 0 1 1h12a1 1 0 0 0 1-1v-.76a2 2 0 0 0-1.11-1.79l-1.78-.9A2 2 0 0 1 15 10.76V7a1 1 0 0 1 1-1 2 2 0 0 0 0-4H8a2 2 0 0 0 0 4 1 1 0 0 1 1 1z"></path>',
  minus: '<path d="M5 12h14"></path>',
  x: '<path d="M18 6 6 18"></path><path d="m6 6 12 12"></path>',
  plus: '<path d="M5 12h14"></path><path d="M12 5v14"></path>',
  list: '<path d="M8 6h13"></path><path d="M8 12h13"></path><path d="M8 18h13"></path><path d="M3 6h.01"></path><path d="M3 12h.01"></path><path d="M3 18h.01"></path>',
  search: '<circle cx="11" cy="11" r="7"></circle><path d="m20 20-3.2-3.2"></path>',
  'chevron-up': '<path d="m6 15 6-6 6 6"></path>',
  'chevron-down': '<path d="m6 9 6 6 6-6"></path>',
  trash:
    '<path d="M3 6h18"></path>' +
    '<path d="M8 6V4a1 1 0 0 1 1-1h6a1 1 0 0 1 1 1v2"></path>' +
    '<path d="M19 6l-1 14a2 2 0 0 1-2 2H8a2 2 0 0 1-2-2L5 6"></path>',
  // 删除（垃圾桶）——与「回收站」入口的时钟图标明确区分
  delete:
    '<path d="M4 7h16"></path>' +
    '<path d="M9 7V5a1 1 0 0 1 1-1h4a1 1 0 0 1 1 1v2"></path>' +
    '<path d="M6 7l1 12a2 2 0 0 0 2 2h6a2 2 0 0 0 2-2l1-12"></path>' +
    '<path d="M10 11v6"></path><path d="M14 11v6"></path>',
  // 回收站入口（历史/可恢复）
  history:
    '<path d="M3 12a9 9 0 1 0 3-7.7L3 8"></path>' +
    '<path d="M3 3v5h5"></path>' +
    '<path d="M12 7.5V12l3.5 2"></path>',
  // 彻底删除（不可恢复）
  'delete-forever':
    '<circle cx="12" cy="12" r="9"></circle>' +
    '<path d="m9.5 9.5 5 5"></path><path d="m14.5 9.5-5 5"></path>',
  undo: '<path d="M3 7v6h6"></path><path d="M3 13a9 9 0 1 0 3-7.7L3 8"></path>',
  image: '<rect x="3" y="3" width="18" height="18" rx="2"></rect><circle cx="9" cy="9" r="1.6"></circle><path d="m21 15-4.5-4.5L7 20"></path>',
  // 主题四态
  contrast: '<circle cx="12" cy="12" r="9"></circle><path d="M12 3v18"></path>',
  square: '<rect x="4" y="4" width="16" height="16" rx="2"></rect>',
  sun:
    '<circle cx="12" cy="12" r="4"></circle>' +
    '<path d="M12 2v2"></path><path d="M12 20v2"></path>' +
    '<path d="m4.93 4.93 1.41 1.41"></path><path d="m17.66 17.66 1.41 1.41"></path>' +
    '<path d="M2 12h2"></path><path d="M20 12h2"></path>' +
    '<path d="m6.34 17.66-1.41 1.41"></path><path d="m19.07 4.93-1.41 1.41"></path>',
  moon: '<path d="M12 3a6 6 0 0 0 9 9 9 9 0 1 1-9-9z"></path>'
}

const props = defineProps({ name: { type: String, required: true } })
const markup = computed(() => ICONS[props.name] || '')
</script>

<style scoped>
.icon { display: block; }
</style>
