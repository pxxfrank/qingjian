<template>
  <div class="quickfind">
    <div class="qf-bar">
      <span class="qf-ico"><Icon name="search" /></span>
      <input
        ref="inputEl"
        v-model="query"
        class="qf-input"
        placeholder="搜索所有便笺…"
        spellcheck="false"
        @keydown="onKey"
      />
      <span class="qf-hint"><b>↑↓</b> 选择 <b>⏎</b> 打开 <b>esc</b> 关闭</span>
    </div>
    <div v-if="results.length" ref="listEl" class="qf-list">
      <div
        v-for="(r, i) in results"
        :key="r.id"
        class="qf-item"
        :class="{ on: i === active }"
        @mouseenter="active = i"
        @click="choose(r)"
      >
        <div class="qf-head">
          <span class="qf-dot" :style="{ background: swatchOf(r.color) }"></span>
          <span class="qf-title" v-html="titleHtml(r)"></span>
          <span class="qf-count">{{ r.count }} 处</span>
        </div>
        <div v-for="(m, mi) in bodyMatches(r)" :key="mi" class="qf-snippet" v-html="highlight(m)"></div>
      </div>
    </div>
    <div v-else class="qf-empty">
      {{ query.trim() ? '没有匹配的便笺' : '输入关键词，搜索便笺标题与正文' }}
    </div>
  </div>
</template>

<script setup>
import { ref, watch, nextTick, onMounted, onUnmounted } from 'vue'
import Icon from '../src/components/Icon.vue'
import { noteColors } from '../src/tokens'

const api = window.api
const inputEl = ref(null)
const listEl = ref(null)
const query = ref('')
const results = ref([])
const active = ref(0)

let timer = null

function swatchOf(c) {
  return (noteColors[c] || noteColors.yellow).swatch
}

function escapeHtml(s) {
  return String(s == null ? '' : s).replace(/[&<>"']/g, (c) => (
    { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]
  ))
}

function highlight(m) {
  const s = m.snippet || ''
  const a = Math.max(0, Math.min(s.length, m.start | 0))
  const b = Math.max(a, Math.min(s.length, m.end | 0))
  return escapeHtml(s.slice(0, a)) +
    '<mark class="qf-mark">' + escapeHtml(s.slice(a, b)) + '</mark>' +
    escapeHtml(s.slice(b))
}

function titleHtml(r) {
  const m = r.matches.find((x) => x.field === 'title')
  return m ? highlight(m) : escapeHtml(r.title || '无标题')
}

function bodyMatches(r) {
  return r.matches.filter((x) => x.field === 'body')
}

function scrollActive() {
  nextTick(() => {
    const el = listEl.value && listEl.value.children[active.value]
    if (el && el.scrollIntoView) el.scrollIntoView({ block: 'nearest' })
  })
}

function move(delta) {
  const n = results.value.length
  if (!n) return
  active.value = (active.value + delta + n) % n
  scrollActive()
}

function choose(r) {
  if (!r) return
  api.openNote(r.id, query.value.trim()) // 打开便笺并高亮命中
  api.quickFindClose()
}

function onKey(e) {
  if (e.isComposing || e.keyCode === 229) return // 输入法合成中交给输入法
  if (e.key === 'ArrowDown') { e.preventDefault(); move(1) }
  else if (e.key === 'ArrowUp') { e.preventDefault(); move(-1) }
  else if (e.key === 'Enter') { e.preventDefault(); choose(results.value[active.value]) }
  else if (e.key === 'Escape') { e.preventDefault(); api.quickFindClose() }
}

function reset() {
  query.value = ''
  results.value = []
  active.value = 0
  nextTick(() => inputEl.value && inputEl.value.focus())
}

watch(query, () => {
  clearTimeout(timer)
  const q = query.value.trim()
  if (!q) { results.value = []; active.value = 0; return }
  timer = setTimeout(async () => {
    let res = []
    try { res = await api.searchNotes(q) } catch { res = [] }
    if (query.value.trim() !== q) return // 竞态保护
    results.value = Array.isArray(res) ? res : []
    active.value = 0
    scrollActive()
  }, 150)
})

onMounted(() => {
  api.onWindowReset(() => {})
  api.onQuickFindReset(reset)
  inputEl.value && inputEl.value.focus()
})
onUnmounted(() => clearTimeout(timer))
</script>

<style scoped>
.quickfind {
  height: 100%;
  display: flex;
  flex-direction: column;
  background: var(--md-surface-container-high);
  border: 1px solid var(--md-outline-variant);
  border-radius: var(--shape-l);
  overflow: hidden;
}

/* 顶部搜索条 */
.qf-bar {
  flex-shrink: 0;
  display: flex;
  align-items: center;
  gap: 10px;
  height: 56px;
  padding: 0 16px;
  border-bottom: 1px solid var(--md-outline-variant);
}
.qf-ico { display: flex; color: var(--md-on-surface-variant); }
.qf-input {
  flex: 1;
  min-width: 0;
  border: none;
  outline: none;
  background: transparent;
  color: var(--md-on-surface);
  font-size: 15px;
}
.qf-input::placeholder { color: var(--md-on-surface-variant); }
.qf-hint { flex-shrink: 0; font-size: 11.5px; color: var(--md-on-surface-variant); white-space: nowrap; }
.qf-hint b { font-weight: 500; color: var(--md-primary); }

/* 结果列表 */
.qf-list { flex: 1; min-height: 0; overflow-y: auto; padding: 6px; }
.qf-item { padding: 10px 12px; border-radius: var(--shape-m); cursor: pointer; }
.qf-item.on { background: color-mix(in srgb, var(--md-primary) 12%, transparent); }
.qf-head { display: flex; align-items: center; gap: 10px; min-width: 0; }
.qf-dot { flex: 0 0 auto; width: 10px; height: 10px; border-radius: var(--shape-full); }
.qf-title {
  flex: 1 1 auto;
  min-width: 0;
  font-weight: 700;
  font-size: 14px;
  color: var(--md-on-surface);
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
}
.qf-count { flex: 0 0 auto; font-size: 11.5px; color: var(--md-on-surface-variant); font-variant-numeric: tabular-nums; }
.qf-snippet {
  margin: 4px 0 0 20px;
  font-size: 12.5px;
  line-height: 1.5;
  color: var(--md-on-surface-variant);
  display: -webkit-box;
  -webkit-line-clamp: 2;
  -webkit-box-orient: vertical;
  overflow: hidden;
}
.qf-mark {
  background: var(--md-primary-container);
  color: var(--md-on-primary-container);
  border-radius: var(--shape-xs);
  padding: 0 1px;
}

/* 空态提示 */
.qf-empty {
  flex: 1;
  display: flex;
  align-items: center;
  justify-content: center;
  padding: 24px;
  font-size: 13px;
  color: var(--md-on-surface-variant);
  text-align: center;
}
</style>
