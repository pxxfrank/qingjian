<template>
  <div class="titlebar drag">
    <input
      class="title-input no-drag"
      :value="title"
      placeholder="标题"
      maxlength="60"
      spellcheck="false"
      @input="$emit('update:title', $event.target.value)"
    />
    <div class="win-controls no-drag">
      <button class="ctrl md-state" title="便笺颜色" @click="$emit('toggle-color')"><Icon name="palette" /></button>
      <button class="ctrl md-state" title="查找（Ctrl+F）" @click="$emit('find')"><Icon name="search" /></button>
      <button class="ctrl md-state" :class="{ on: !!remind }" :title="remindTitle" @click="$emit('remind')"><Icon name="alarm" /></button>
      <button class="ctrl md-state" data-act="dock" title="收起到贴边" @click="$emit('hide-to-dock')"><Icon name="collapse" /></button>
      <button class="ctrl md-state" :class="{ on: pinned }" title="切换悬浮置顶" @click="$emit('toggle-pin')"><Icon name="pin" /></button>
      <button class="ctrl md-state" title="最小化" @click="$emit('minimize')"><Icon name="minus" /></button>
      <button class="ctrl md-state danger" title="关闭便笺" @click="$emit('close')"><Icon name="x" /></button>
    </div>
  </div>
</template>

<script setup>
import { computed } from 'vue'
import Icon from './Icon.vue'

const props = defineProps({ title: String, pinned: Boolean, remind: { type: Number, default: null } })
const emit = defineEmits([
  'update:title', 'toggle-color', 'find', 'remind',
  'toggle-pin', 'hide-to-dock', 'minimize', 'close'
])

// 有提醒时按钮高亮，并把下一次触发时间放进 tooltip（窄窗不占正文宽度）
const remindTitle = computed(() => {
  if (!props.remind) return '设置提醒'
  const d = new Date(props.remind)
  const p = (n) => String(n).padStart(2, '0')
  return `提醒：${p(d.getMonth() + 1)}-${p(d.getDate())} ${p(d.getHours())}:${p(d.getMinutes())}`
})
</script>

<style scoped>
/* MD3 Small Top App Bar：便笺窄窗取紧凑 48dp；底色随便笺纸色（--chrome） */
.titlebar {
  height: 48px;
  flex-shrink: 0;
  display: flex;
  align-items: center;
  gap: 8px;
  padding: 0 6px 0 16px;
  user-select: none;
  background: var(--chrome);
  border-bottom: 1px solid var(--md-outline-variant);
}
/* 标题始终占位且不被图标吞没：基准 96px（不是 auto，避免输入框固有宽度挤爆布局），
   有富余空间时再 grow 展开；窗口再窄也只是省略号，不会折行。 */
.title-input {
  flex: 1 1 96px;
  min-width: 96px;
  max-width: 100%;
  height: 32px;
  box-sizing: border-box;
  border: none;
  outline: none;
  padding: 0 10px;
  /* 加深的输入底色 + 圆角：标题一眼可辨，标题栏其余留白即「可拖动区」 */
  border-radius: var(--shape-s);
  background: color-mix(in srgb, var(--paper) 80%, var(--md-on-surface));
  color: var(--md-on-surface);
  font-family: "Microsoft YaHei", "Microsoft YaHei UI", "Segoe UI", sans-serif;
  font-size: 14.5px;
  font-weight: 700;
  letter-spacing: 0;
  transition: background var(--dur-short) var(--md-ease-standard);
}
.title-input::placeholder { color: var(--md-on-surface-variant); font-weight: 400; }
.title-input:focus { background: color-mix(in srgb, var(--paper) 72%, var(--md-on-surface)); }
.win-controls { display: flex; gap: 2px; flex: 0 0 auto; }
/* MD3 Standard icon button：圆形 + state layer。
   按钮始终保持正方形（宽高同步变化）——只缩宽度会变成椭圆，图标会被挤扁显示不全。 */
.ctrl {
  position: relative;
  flex: 0 0 auto;
  width: 36px;
  height: 36px;
  display: flex;
  align-items: center;
  justify-content: center;
  border: none;
  border-radius: var(--shape-full);
  background: transparent;
  color: var(--md-on-surface-variant);
  cursor: pointer;
  transition: color var(--dur-short) var(--md-ease-standard), transform var(--dur-short) var(--md-ease-standard);
}
.ctrl:hover { color: var(--md-primary); }
.ctrl:active { transform: scale(.92); }
.ctrl.on { color: var(--md-primary); }
.ctrl.on::before {
  content: '';
  position: absolute;
  inset: 0;
  border-radius: inherit;
  background: currentColor;
  opacity: .12;
  pointer-events: none;
}
.ctrl.danger:hover { color: var(--md-error); }

/* 窗口变窄时图标同步收拢（宽高一起变，保持正圆）：保证「图标不缺 + 标题不消失」。
   最小宽度 380 时内容为 356：7×28 + 内边距 ≈ 208，标题仍有 96+。 */
@media (max-width: 440px) {
  .titlebar { padding: 0 4px 0 12px; gap: 4px; }
  .win-controls { gap: 0; }
  .ctrl { width: 32px; height: 32px; }
}
@media (max-width: 390px) {
  .ctrl { width: 28px; height: 28px; }
  .titlebar { padding: 0 2px 0 10px; }
}

/* 标题栏图标统一加粗，且不小于 16px（SVG 描边：CSS 优先级高于 presentation attribute） */
.titlebar svg { stroke-width: 2.25; min-width: 16px; min-height: 16px; }
</style>
