<template>
  <div
    class="note-card"
    :style="{ ...tintStyle, animationDelay: stagger }"
    @click="$emit('open', note.id)"
  >
    <div class="row">
      <span class="color-dot" :style="{ background: swatch }"></span>
      <div class="title">{{ note.title || '无标题' }}</div>
      <button class="del md-state" :class="{ confirm }" @click.stop="onDel">
        <Icon v-if="!confirm" name="delete" />
        <span v-else>移入回收站</span>
      </button>
    </div>
    <div class="preview">{{ note.preview || '' }}</div>
    <div class="meta">
      <span class="time">{{ timeAgo(note.updatedAt) }}</span>
      <span v-if="note.remind" class="remind-badge" :class="{ overdue: remindOverdue }">⏰ {{ remindText }}</span>
    </div>
  </div>
</template>

<script setup>
import { ref, computed, onUnmounted } from 'vue'
import { noteColors } from '../tokens'
import Icon from './Icon.vue'

const props = defineProps({ note: Object, index: { type: Number, default: 0 } })
const emit = defineEmits(['open', 'delete'])

const confirm = ref(false)
let timer = null

const swatch = computed(() => (noteColors[props.note.color] || noteColors.yellow).swatch)
// 纸面着色：色卡淡染（深浅主题都落在卡片底色上）
const tintStyle = computed(() => ({
  background: `color-mix(in srgb, ${swatch.value} 10%, var(--surface-solid))`
}))
// 入场错落：前几张依次延迟，营造轻柔的瀑布感
const stagger = `${Math.min(props.index * 45, 315)}ms`

// 提醒徽标：显示「⏰ MM-DD HH:MM」，已逾期标红
const remindText = computed(() => {
  if (!props.note.remind) return ''
  const d = new Date(props.note.remind)
  const p = (n) => String(n).padStart(2, '0')
  return `${p(d.getMonth() + 1)}-${p(d.getDate())} ${p(d.getHours())}:${p(d.getMinutes())}`
})
const remindOverdue = computed(() => !!props.note.remind && props.note.remind < Date.now())

function onDel() {
  if (!confirm.value) {
    confirm.value = true
    timer = setTimeout(() => { confirm.value = false }, 3000)
    return
  }
  clearTimeout(timer)
  confirm.value = false
  emit('delete', props.note.id)
}

function timeAgo(ts) {
  if (!ts) return ''
  const diff = Date.now() - ts
  if (diff < 60e3) return '刚刚'
  if (diff < 3600e3) return Math.floor(diff / 60e3) + ' 分钟前'
  if (diff < 86400e3) return Math.floor(diff / 3600e3) + ' 小时前'
  const d = new Date(ts)
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`
}

onUnmounted(() => clearTimeout(timer))
</script>

<style scoped>
/* MD3 Outlined / Elevated Card：12dp 圆角 + outline 描边 + 悬停抬升到 elevation 1 */
.note-card {
  position: relative;
  border: 1px solid var(--md-outline-variant);
  border-radius: var(--shape-m);
  padding: 14px 14px 12px 16px;
  cursor: pointer;
  flex-shrink: 0;
  box-shadow: var(--elev-0);
  transition: border-color var(--dur-short) var(--md-ease-standard),
    box-shadow var(--dur-short) var(--md-ease-standard),
    transform var(--dur-short) var(--md-ease-standard);
  animation: card-in var(--dur-medium) var(--md-ease-emphasized) backwards;
}
@keyframes card-in {
  from { opacity: 0; transform: translateY(8px) scale(.98); }
}
.note-card:hover {
  border-color: var(--md-outline);
  box-shadow: var(--elev-1);
  transform: translateY(-1px);
}
.note-card:active { transform: translateY(0) scale(.995); }

/* 标题始终横向单行：nowrap + 不参与换行，窗口再窄也只是省略号，不会折行变纵向 */
.row {
  display: flex;
  align-items: center;
  gap: 10px;
  flex-wrap: nowrap;
  min-width: 0;
}
.color-dot {
  flex: 0 0 auto;
  width: 10px;
  height: 10px;
  border-radius: var(--shape-full);
}
.title {
  flex: 1 1 auto;
  min-width: 0;
  font-weight: 700;
  font-size: 14px;
  font-family: "Microsoft YaHei", "Microsoft YaHei UI", "Segoe UI", sans-serif;
  color: var(--md-on-surface);
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
}
.preview {
  font-size: 13px; /* body-small */
  line-height: 1.5;
  color: var(--md-on-surface-variant);
  display: -webkit-box;
  -webkit-line-clamp: 2;
  -webkit-box-orient: vertical;
  overflow: hidden;
  min-height: 19px;
  margin: 2px 0 0 20px;
}
.meta { display: flex; align-items: center; gap: 8px; margin: 6px 0 0 20px; }
.time { font-size: 11px; color: var(--md-on-surface-variant); opacity: .75; }
/* 提醒徽标：⏰ MM-DD HH:MM（逾期标红） */
.remind-badge {
  display: inline-flex;
  align-items: center;
  font-size: 11px;
  padding: 1px 7px;
  border-radius: var(--shape-full);
  background: var(--md-primary-container);
  color: var(--md-on-primary-container);
  font-variant-numeric: tabular-nums;
}
.remind-badge.overdue { background: var(--md-error-container); color: var(--md-on-error-container); }

/* MD3 图标按钮（32dp）+ 二次确认变 tonal 按钮 */
.del {
  flex: 0 0 auto;
  min-width: 32px;
  height: 32px;
  display: flex;
  align-items: center;
  justify-content: center;
  border: none;
  border-radius: var(--shape-full);
  background: transparent;
  color: var(--md-on-surface-variant);
  font-size: 11.5px;
  cursor: pointer;
  opacity: 0;
  transition: opacity var(--dur-short) var(--md-ease-standard), color var(--dur-short) var(--md-ease-standard);
}
.note-card:hover .del { opacity: 1; }
.del:hover { color: var(--md-error); }
.del.confirm {
  opacity: 1;
  width: auto;
  padding: 0 12px;
  border-radius: var(--shape-full);
  background: var(--md-error-container);
  color: var(--md-on-error-container);
}
</style>
