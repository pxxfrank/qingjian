<template>
  <div class="capture">
    <div class="cap-row" :class="{ saving }">
      <span class="cap-ico">❈</span>
      <input
        ref="inputEl"
        v-model="text"
        class="cap-input"
        placeholder="随手记一笔，回车存入小球…"
        spellcheck="false"
        maxlength="2000"
        @keydown="onKey"
      />
      <span class="cap-hint"><b>⏎</b> 存入 <b>^⏎</b> 打开</span>
    </div>
    <div v-if="toast" class="cap-toast">已存入便笺</div>
  </div>
</template>

<script setup>
import { ref, onMounted } from 'vue'

const api = window.api
const inputEl = ref(null)
const text = ref('')
const saving = ref(false)
const toast = ref(false)

let toastTimer = null

function reset() {
  text.value = ''
  saving.value = false
  inputEl.value && inputEl.value.focus()
}

async function submit(open) {
  const body = text.value.trim()
  if (!body || saving.value) return
  saving.value = true
  await api.captureSave({ text: body, open })
  if (open) {
    // 直接打开便笺：主进程会隐藏速记条
    saving.value = false
    text.value = ''
    return
  }
  text.value = ''
  toast.value = true
  clearTimeout(toastTimer)
  toastTimer = setTimeout(() => { toast.value = false; saving.value = false }, 500)
}

function onKey(e) {
  if (e.isComposing || e.keyCode === 229) return // 输入法合成中（含回车选词）交给输入法
  if (e.key === 'Enter' && !e.shiftKey) {
    e.preventDefault()
    submit(e.ctrlKey || e.metaKey)
  } else if (e.key === 'Escape') {
    e.preventDefault()
    api.captureClose()
  }
}

onMounted(() => {
  inputEl.value && inputEl.value.focus()
  api.onWindowReset(() => {})
  api.onCaptureReset(reset)
})
</script>

<style scoped>
.capture {
  position: relative;
  width: 100%;
  height: 100%;
  display: flex;
  align-items: center;
  padding: 12px;
  box-sizing: border-box;
}
/* MD3 Search bar（56dp 全圆角 + surface-container-high，聚焦升到 elevation 1） */
.cap-row {
  flex: 1;
  height: 56px;
  display: flex;
  align-items: center;
  gap: 12px;
  padding: 0 18px;
  box-sizing: border-box;
  background: var(--md-surface-container-high);
  border: 1px solid var(--md-outline-variant);
  border-radius: var(--shape-xl);
  box-shadow: var(--elev-0);
  transition: border-color var(--dur-short) var(--md-ease-standard),
    box-shadow var(--dur-short) var(--md-ease-standard),
    transform var(--dur-short) var(--md-ease-standard);
}
.cap-row:focus-within {
  border-color: var(--md-primary);
  box-shadow: var(--elev-1);
}
.cap-row.saving { transform: scale(.98); }
.cap-ico {
  color: var(--md-primary);
  font-size: 18px;
  line-height: 1;
}
.cap-input {
  flex: 1;
  min-width: 0;
  border: none;
  outline: none;
  background: transparent;
  color: var(--md-on-surface);
  font-size: 15px; /* body-large */
}
.cap-input::placeholder { color: var(--md-on-surface-variant); }
.cap-hint {
  flex-shrink: 0;
  font-size: 11.5px; /* label-small */
  color: var(--md-on-surface-variant);
  white-space: nowrap;
}
.cap-hint b { font-weight: 500; color: var(--md-primary); }
.cap-toast {
  position: absolute;
  right: 22px;
  bottom: 4px;
  font-size: 11px;
  color: var(--accent-deep);
  animation: toast-in .2s var(--ease);
}
@keyframes toast-in {
  from { opacity: 0; transform: translateY(4px); }
}
</style>
