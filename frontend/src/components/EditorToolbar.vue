<template>
  <div class="toolbar">
    <button
      v-for="b in buttons"
      :key="b.cmd"
      class="tb-btn md-state"
      :title="b.title"
      :data-cmd="b.cmd"
      @click="$emit('cmd', b.cmd)"
      v-html="b.icon"
    ></button>
  </div>
</template>

<script setup>
// 只保留最常用的四个行内样式；标题/列表/引用/代码块/图片等能力
// 仍可通过 Markdown 语法（# / - / [] / > / `）与粘贴、拖入使用。
defineEmits(['cmd'])

const buttons = [
  { cmd: 'bold', icon: '<b>B</b>', title: '加粗  Ctrl+B' },
  { cmd: 'italic', icon: '<i>I</i>', title: '斜体  Ctrl+I' },
  { cmd: 'underline', icon: '<u>U</u>', title: '下划线  Ctrl+U' },
  { cmd: 'strikeThrough', icon: '<s>S</s>', title: '删除线  Ctrl+Shift+X' }
]
</script>

<style scoped>
/* MD3 工具栏：底色随纸色（--chrome）；按钮随窗口伸缩均匀分布 */
.toolbar {
  height: 44px;
  flex-shrink: 0;
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 4px;
  padding: 0 10px;
  background: var(--chrome);
  border-bottom: 1px solid var(--md-outline-variant);
  overflow: hidden;
}
.tb-btn {
  flex: 1 1 0;
  min-width: 30px;
  max-width: 56px;
  height: 32px;
  display: flex;
  align-items: center;
  justify-content: center;
  border: none;
  border-radius: var(--shape-s);
  background: transparent;
  color: var(--md-on-surface-variant);
  font-size: 13px;
  padding: 0;
  cursor: pointer;
  transition: color var(--dur-short) var(--md-ease-standard), transform var(--dur-short) var(--md-ease-standard);
}
.tb-btn:hover { color: var(--md-primary); }
.tb-btn:active { transform: scale(.92); }
.tb-btn svg { stroke-width: 2.25; }
</style>
