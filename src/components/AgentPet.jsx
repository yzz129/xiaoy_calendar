import { useEffect, useMemo, useRef, useState } from 'react'
import { Capacitor, registerPlugin } from '@capacitor/core'
import {
  BookOpenCheck,
  BriefcaseBusiness,
  CalendarCheck2,
  Check,
  ChevronDown,
  ExternalLink,
  Globe2,
  EyeOff,
  LoaderCircle,
  MessageCircleQuestion,
  KeyRound,
  ListTodo,
  MoveDiagonal2,
  PencilLine,
  Plus,
  RotateCcw,
  Send,
  Sparkles,
  StickyNote,
  Trash2,
  UserRoundCog,
  X,
} from 'lucide-react'
import mascot from '../assets/illustrations/empty-mascot.webp'
import mascotCelebrate from '../assets/illustrations/agent-celebrate.png'
import mascotFocused from '../assets/illustrations/agent-focused.png'
import mascotSleepy from '../assets/illustrations/agent-sleepy.png'
import mascotThinking from '../assets/illustrations/agent-thinking.png'
import { formatWeekdays } from '../plan-utils'
import { authFetch } from '../auth'
import { createTypewriterController } from '../agent-typewriter'

const MEMORY_KEY = 'xiaoy-calendar-agent:v2'
const LEGACY_MEMORY_OWNER_KEY = 'xiaoy-calendar-agent:legacy-owner:v1'
const PET_POSITION_KEY = 'xiaoy-calendar-agent-pet-position:v1'
const BUBBLE_SIZE_KEY = 'xiaoy-calendar-agent-bubble-size:v1'
const AGENT_API_URL = Capacitor.isNativePlatform()
  ? 'https://calendar.yzzwnw.asia/api/agent'
  : '/api/agent'
const ExternalBrowser = registerPlugin('ExternalBrowser')
const QUICK_PROMPTS = [
  '帮我安排一个学习计划',
  '根据我的空闲时间规划工作',
  '联网查资料后给我最合适的方案',
]
const DEFAULT_PROFILE = { dailyMinutes: '', intensity: 'balanced', restPreference: '', fixedSchedule: '' }
const PET_IMAGES = {
  idle: mascot,
  focused: mascotFocused,
  thinking: mascotThinking,
  celebrate: mascotCelebrate,
  sleepy: mascotSleepy,
}

function ambientPetMoods() {
  const hour = new Date().getHours()
  return hour >= 22 || hour < 7
    ? ['sleepy', 'idle']
    : ['idle', 'focused', 'idle', 'thinking']
}

function launcherSize() {
  return window.innerWidth <= 760 ? 67 : 84
}

function clampPosition(position) {
  const size = launcherSize()
  const margin = 8
  return {
    x: Math.max(margin, Math.min(window.innerWidth - size - margin, Number(position?.x) || margin)),
    y: Math.max(margin, Math.min(window.innerHeight - size - margin, Number(position?.y) || margin)),
  }
}

function defaultPetPosition() {
  const size = launcherSize()
  const mobile = window.innerWidth <= 760
  return clampPosition({
    x: window.innerWidth - size - (mobile ? 11 : 22),
    y: window.innerHeight - size - (mobile ? 88 : 22),
  })
}

function readPetPosition() {
  try {
    const saved = JSON.parse(localStorage.getItem(PET_POSITION_KEY) || 'null')
    return saved ? clampPosition(saved) : defaultPetPosition()
  } catch {
    return defaultPetPosition()
  }
}

function getHiddenPetPosition(position) {
  const size = launcherSize()
  const side = position.x + size / 2 < window.innerWidth / 2 ? 'left' : 'right'
  return {
    side,
    position: {
      x: side === 'left' ? -size / 2 : window.innerWidth - size / 2,
      y: clampPosition(position).y,
    },
  }
}

function bubbleSizeLimits(compact = false) {
  const mobile = window.innerWidth <= 760
  return {
    minWidth: compact ? (mobile ? 250 : 320) : (mobile ? 270 : 360),
    maxWidth: Math.max(250, Math.min(mobile ? window.innerWidth - 16 : 760, window.innerWidth - 16)),
    minHeight: compact ? (mobile ? 150 : 190) : (mobile ? 220 : 280),
    maxHeight: Math.max(190, Math.min(mobile ? window.innerHeight * .72 : window.innerHeight * .88, window.innerHeight - 16)),
  }
}

function defaultBubbleSize(compact = false) {
  const mobile = window.innerWidth <= 760
  const limits = bubbleSizeLimits(compact)
  return {
    width: Math.min(limits.maxWidth, compact ? (mobile ? 310 : 360) : (mobile ? window.innerWidth - 42 : 500)),
    height: Math.min(limits.maxHeight, compact ? (mobile ? 170 : 230) : (mobile ? 330 : 560)),
  }
}

function clampBubbleSize(size, compact = false) {
  const limits = bubbleSizeLimits(compact)
  const fallback = defaultBubbleSize(compact)
  return {
    width: Math.round(Math.max(limits.minWidth, Math.min(limits.maxWidth, Number(size?.width) || fallback.width))),
    height: Math.round(Math.max(limits.minHeight, Math.min(limits.maxHeight, Number(size?.height) || fallback.height))),
  }
}

function readBubbleSize(userId) {
  try {
    const device = window.innerWidth <= 760 ? 'mobile' : 'desktop'
    return clampBubbleSize(JSON.parse(localStorage.getItem(`${BUBBLE_SIZE_KEY}:${userId}:${device}`) || 'null'))
  } catch {
    return defaultBubbleSize()
  }
}

function getChatBubbleLayout(position, compact = false, preferredSize) {
  const viewportWidth = window.innerWidth
  const viewportHeight = window.innerHeight
  const size = launcherSize()
  const mobile = viewportWidth <= 760
  const resolvedSize = compact ? defaultBubbleSize(true) : clampBubbleSize(preferredSize)
  const width = resolvedSize.width
  const height = resolvedSize.height
  const petCenterX = position.x + size / 2
  const left = Math.max(8, Math.min(viewportWidth - width - 8, petCenterX - width / 2))
  const aboveSpace = Math.max(0, position.y - 12)
  const belowSpace = Math.max(0, viewportHeight - position.y - size - 12)
  const placement = aboveSpace >= belowSpace ? 'above' : 'below'
  const top = placement === 'above'
    ? Math.max(8, position.y - height - 12)
    : Math.min(viewportHeight - height - 8, position.y + size + 12)
  const tailX = Math.max(30, Math.min(width - 30, petCenterX - left))
  const baseline = mobile ? { width: 348, height: 330 } : { width: 500, height: 560 }
  const fontScale = Math.max(.78, Math.min(1.34, Math.sqrt((width / baseline.width) * (height / baseline.height))))

  return {
    placement,
    metrics: { width, height },
    style: {
      left: `${left}px`,
      top: `${top}px`,
      width: `${width}px`,
      height: `${height}px`,
      '--xy-agent-tail-x': `${tailX}px`,
      '--xy-agent-font-scale': fontScale.toFixed(3),
    },
  }
}

function readMemory(userId) {
  try {
    const scopedKey = `${MEMORY_KEY}:${userId}`
    let raw = localStorage.getItem(scopedKey)
    if (!raw && !localStorage.getItem(LEGACY_MEMORY_OWNER_KEY)) {
      raw = localStorage.getItem(MEMORY_KEY)
      if (raw) {
        localStorage.setItem(scopedKey, raw)
        localStorage.setItem(LEGACY_MEMORY_OWNER_KEY, userId)
      }
    }
    const parsed = JSON.parse(raw || '{}')
    return {
      messages: Array.isArray(parsed.messages) ? parsed.messages.filter((message) => !message?.proactive).slice(-30) : [],
      profile: { ...DEFAULT_PROFILE, ...(parsed.profile || {}) },
      result: parsed.result && typeof parsed.result === 'object' ? parsed.result : null,
      applied: Boolean(parsed.applied),
      actionStates: parsed.actionStates && typeof parsed.actionStates === 'object' ? parsed.actionStates : {},
    }
  } catch {
    return { messages: [], profile: DEFAULT_PROFILE, result: null, applied: false, actionStates: {} }
  }
}

function RichText({ content }) {
  const inline = (value) => String(value || '').split(/(\*\*[^*]+\*\*)/g).filter(Boolean).map((part, index) => (
    /^\*\*[^*]+\*\*$/.test(part)
      ? <strong key={`${part}-${index}`}>{part.slice(2, -2)}</strong>
      : <span key={`${part}-${index}`}>{part}</span>
  ))
  return (
    <div className="xy-agent-rich-text">
      {String(content || '').split('\n').map((line, index) => {
        const value = line.trim()
        if (!value) return <span className="xy-agent-rich-gap" key={`gap-${index}`} />
        const heading = /^(#{1,3})\s+(.+)$/.exec(value)
        if (heading) return <h4 key={`heading-${index}`}>{inline(heading[2])}</h4>
        const step = /^(\d+)[.、]\s*(.+)$/.exec(value)
        if (step) return <p className="xy-agent-rich-step" key={`step-${index}`}><b>{step[1]}</b><span>{inline(step[2])}</span></p>
        const bullet = /^[-•]\s*(.+)$/.exec(value)
        if (bullet) return <p className="xy-agent-rich-bullet" key={`bullet-${index}`}><i /> <span>{inline(bullet[1])}</span></p>
        return <p key={`line-${index}`}>{inline(value)}</p>
      })}
    </div>
  )
}

async function consumeAgentStream(response, handlers) {
  const contentType = response.headers.get('Content-Type') || ''
  if (!contentType.includes('text/event-stream')) {
    const payload = await response.json().catch(() => ({}))
    if (!response.ok) throw new Error(payload.error || '小Y 暂时没有收到模型回复')
    handlers.result?.(payload)
    return
  }
  if (!response.ok || !response.body) throw new Error('小Y 暂时没有收到模型回复')
  const reader = response.body.getReader()
  const decoder = new TextDecoder()
  let buffer = ''
  const dispatch = (block) => {
    const lines = block.split(/\r?\n/)
    const event = lines.find((line) => line.startsWith('event:'))?.slice(6).trim() || 'message'
    const data = lines.filter((line) => line.startsWith('data:')).map((line) => line.slice(5).trim()).join('\n')
    if (!data) return
    try {
      handlers[event]?.(JSON.parse(data))
    } catch {
      // Ignore malformed keep-alive frames without interrupting the conversation.
    }
  }
  while (true) {
    const { done, value } = await reader.read()
    buffer += decoder.decode(value || new Uint8Array(), { stream: !done })
    const blocks = buffer.split(/\r?\n\r?\n/)
    buffer = blocks.pop() || ''
    blocks.forEach(dispatch)
    if (done) break
  }
  if (buffer.trim()) dispatch(buffer)
}

function PlanIcon({ type }) {
  return type === 'work' ? <BriefcaseBusiness /> : <BookOpenCheck />
}

function PlanCard({ plan }) {
  return (
    <article className={`xy-agent-plan-card ${plan.type}`}>
      <span className="xy-agent-plan-icon"><PlanIcon type={plan.type} /></span>
      <div>
        <small>{plan.type === 'work' ? '工作规划' : '学习规划'}</small>
        <strong>{plan.title}</strong>
        <p>{plan.dailyTask}</p>
        <span>{plan.start} 至 {plan.end} · {formatWeekdays(plan.weekdays)}</span>
        {plan.reason ? <em>{plan.reason}</em> : null}
      </div>
    </article>
  )
}

const ACTION_LABELS = {
  set_day_status: '设置日期状态',
  set_date_range_status: '批量设置日期状态',
  add_note: '记录便签',
  update_note: '修改便签',
  delete_note: '删除便签',
  add_plan_task: '新增每日任务',
  update_plan_task: '调整每日任务',
  set_plan_task_done: '更新任务进度',
  move_plan_task: '移动每日任务',
  delete_plan_task: '移除每日任务',
  update_plan: '修改总规划',
  delete_plan: '删除规划',
  change_nickname: '修改昵称',
  open_profile: '打开账号设置',
  jump_to_date: '跳转到指定日期',
  open_date: '打开日期详情',
  open_plans: '打开规划中心',
  open_range: '打开工期统计',
  go_today: '回到今天',
  change_month: '切换月份',
  toggle_theme: '切换主题',
}

function ActionIcon({ kind }) {
  if (kind.includes('note')) return <StickyNote />
  if (kind.includes('task') || kind.includes('plan')) return <ListTodo />
  if (kind === 'change_nickname') return <PencilLine />
  if (kind === 'open_profile') return <KeyRound />
  return <CalendarCheck2 />
}

function actionDescription(action) {
  const statusLabels = { work: '工作日', rest: '休息日', leave: '请假' }
  const weekdayLabels = ['周日', '周一', '周二', '周三', '周四', '周五', '周六']
  const weekdays = Array.isArray(action.weekdays) ? [...new Set(action.weekdays)].sort((a, b) => a - b) : []
  const weekdayText = weekdays.length === 7 ? '每天'
    : weekdays.join(',') === '1,2,3,4,5' ? '周一至周五'
      : weekdays.join(',') === '0,6' ? '周末'
        : weekdays.map((day) => weekdayLabels[day]).filter(Boolean).join('、')
  switch (action.kind) {
    case 'set_day_status': return `${action.date} · ${statusLabels[action.status]}${action.status === 'work' ? ` · ${action.duration} 天工期` : ''}`
    case 'set_date_range_status': return `${action.startDate} 至 ${action.endDate} · ${weekdayText || '每天'} · ${statusLabels[action.status]} · 共 ${action.dayCount} 天${action.status === 'work' ? ` · 每天 ${action.duration} 天工期` : ''}`
    case 'add_note': return `${action.date} · ${action.text}`
    case 'update_note': return `${action.date} · ${action.text || (action.done ? '标为完成' : '恢复待办')}`
    case 'delete_note': return `${action.date} · 删除指定便签`
    case 'add_plan_task': return `${action.date} · ${action.title}`
    case 'update_plan_task': return `${action.date} · 改为“${action.title}”`
    case 'set_plan_task_done': return action.done ? '把指定任务标记为完成' : '把指定任务恢复为待办'
    case 'move_plan_task': return `${action.fromDate} → ${action.toDate}`
    case 'delete_plan_task': return `${action.date} · 移除指定任务`
    case 'update_plan': return '按上方方案调整已有规划'
    case 'delete_plan': return '删除指定总规划及其每日任务'
    case 'change_nickname': return `新昵称：${action.nickname}`
    case 'open_profile': return action.section === 'password' ? '密码不会发送给小Y，请在安全表单中填写' : '打开昵称与密码设置'
    case 'jump_to_date': return `${action.date} · 自动翻到对应月份并选中`
    case 'open_date': return action.date
    case 'change_month': return action.offset > 0 ? `向后 ${action.offset} 个月` : `向前 ${Math.abs(action.offset)} 个月`
    case 'open_plans': return '查看、创建和调整学习/工作规划'
    case 'open_range': return '选择时间段并统计总工期'
    case 'go_today': return '定位到今天的日期'
    case 'toggle_theme': return '在日间与夜间主题间切换'
    default: return '由小Y操作应用'
  }
}

export default function AgentPet({ calendarContext, onApplyPlans, onExecuteAction, hidden = false, onHide, onShow, userId }) {
  const initial = useMemo(() => readMemory(userId), [userId])
  const [open, setOpen] = useState(false)
  const [profileOpen, setProfileOpen] = useState(false)
  const [messages, setMessages] = useState(initial.messages)
  const [profile, setProfile] = useState(initial.profile)
  const [input, setInput] = useState('')
  const [busy, setBusy] = useState(false)
  const [phase, setPhase] = useState('待命')
  const [result, setResult] = useState(initial.result)
  const [error, setError] = useState('')
  const [applied, setApplied] = useState(initial.applied)
  const [actionStates, setActionStates] = useState(initial.actionStates || {})
  const [batchExecuting, setBatchExecuting] = useState(false)
  const [celebrating, setCelebrating] = useState(false)
  const [ambientMood, setAmbientMood] = useState(() => ambientPetMoods()[0])
  const [petPosition, setPetPosition] = useState(readPetPosition)
  const [dragging, setDragging] = useState(false)
  const [bubbleSize, setBubbleSize] = useState(() => readBubbleSize(userId))
  const [resizingBubble, setResizingBubble] = useState(false)
  const scrollRef = useRef(null)
  const inputRef = useRef(null)
  const dragRef = useRef(null)
  const bubbleResizeRef = useRef(null)
  const typewriterRef = useRef(null)
  if (!typewriterRef.current) {
    typewriterRef.current = createTypewriterController({
      onUpdate: (id, content, streaming) => setMessages((current) => current.map((message) => (
        message.id === id ? { ...message, content, streaming } : message
      ))),
    })
  }

  useEffect(() => {
    const storedMessages = messages.slice(-30).filter((message) => message.content && !message.proactive).map((message) => ({
      ...message,
      streaming: false,
    }))
    const saveTimer = window.setTimeout(() => {
      localStorage.setItem(`${MEMORY_KEY}:${userId}`, JSON.stringify({
        messages: storedMessages,
        profile,
        result,
        applied,
        actionStates,
      }))
    }, messages.some((message) => message.streaming) ? 320 : 0)
    return () => window.clearTimeout(saveTimer)
  }, [messages, profile, result, applied, actionStates, userId])

  useEffect(() => () => typewriterRef.current?.dispose(), [])

  useEffect(() => {
    if (!open) return
    scrollRef.current?.scrollTo({ top: scrollRef.current.scrollHeight, behavior: 'smooth' })
  }, [messages, result, busy, profileOpen, open])

  useEffect(() => {
    if (!open || window.innerWidth <= 760) return undefined
    const focusComposer = window.setTimeout(() => inputRef.current?.focus(), 180)
    return () => window.clearTimeout(focusComposer)
  }, [open])

  useEffect(() => {
    const keepPetVisible = () => {
      setPetPosition((current) => {
        const next = clampPosition(current)
        localStorage.setItem(PET_POSITION_KEY, JSON.stringify(next))
        return next
      })
      setBubbleSize((current) => clampBubbleSize(current))
    }
    window.addEventListener('resize', keepPetVisible)
    return () => window.removeEventListener('resize', keepPetVisible)
  }, [])

  useEffect(() => setBubbleSize(readBubbleSize(userId)), [userId])

  useEffect(() => {
    if (open || busy || dragging || celebrating || hidden) return undefined
    const changeMood = () => {
      const moods = ambientPetMoods()
      setAmbientMood((current) => moods[(moods.indexOf(current) + 1) % moods.length] || moods[0])
    }
    const timer = window.setInterval(changeMood, 7200)
    return () => window.clearInterval(timer)
  }, [open, busy, dragging, celebrating, hidden])

  useEffect(() => {
    if (!celebrating) return undefined
    const timer = window.setTimeout(() => setCelebrating(false), 4200)
    return () => window.clearTimeout(timer)
  }, [celebrating])

  const startPetDrag = (event) => {
    if (event.button !== 0) return
    event.currentTarget.setPointerCapture(event.pointerId)
    dragRef.current = {
      pointerId: event.pointerId,
      startX: event.clientX,
      startY: event.clientY,
      originX: petPosition.x,
      originY: petPosition.y,
      moved: false,
    }
    setDragging(true)
  }

  const movePet = (event) => {
    const drag = dragRef.current
    if (!drag || drag.pointerId !== event.pointerId) return
    const dx = event.clientX - drag.startX
    const dy = event.clientY - drag.startY
    if (Math.hypot(dx, dy) > 4) drag.moved = true
    setPetPosition(clampPosition({ x: drag.originX + dx, y: drag.originY + dy }))
  }

  const finishPetDrag = (event) => {
    const drag = dragRef.current
    if (!drag || drag.pointerId !== event.pointerId) return
    const moved = drag.moved
    dragRef.current = null
    setDragging(false)
    setPetPosition((current) => {
      const next = clampPosition(current)
      localStorage.setItem(PET_POSITION_KEY, JSON.stringify(next))
      return next
    })
    if (!moved) {
      setOpen((current) => !current)
    }
  }

  const cancelPetDrag = () => {
    dragRef.current = null
    setDragging(false)
    setPetPosition((current) => clampPosition(current))
  }

  const startBubbleResize = (event) => {
    if (event.button !== 0) return
    event.preventDefault()
    event.stopPropagation()
    event.currentTarget.setPointerCapture(event.pointerId)
    const current = clampBubbleSize(bubbleSize)
    bubbleResizeRef.current = { pointerId: event.pointerId, startX: event.clientX, startY: event.clientY, width: current.width, height: current.height }
    setResizingBubble(true)
  }

  const resizeBubble = (event) => {
    const resize = bubbleResizeRef.current
    if (!resize || resize.pointerId !== event.pointerId) return
    event.preventDefault()
    setBubbleSize(clampBubbleSize({
      width: resize.width + event.clientX - resize.startX,
      height: resize.height + event.clientY - resize.startY,
    }))
  }

  const finishBubbleResize = (event) => {
    const resize = bubbleResizeRef.current
    if (!resize || resize.pointerId !== event.pointerId) return
    bubbleResizeRef.current = null
    setResizingBubble(false)
    setBubbleSize((current) => {
      const next = clampBubbleSize(current)
      const device = window.innerWidth <= 760 ? 'mobile' : 'desktop'
      localStorage.setItem(`${BUBBLE_SIZE_KEY}:${userId}:${device}`, JSON.stringify(next))
      return next
    })
  }

  const cancelBubbleResize = () => {
    bubbleResizeRef.current = null
    setResizingBubble(false)
  }

  const send = async (preset) => {
    const content = String(preset ?? input).trim()
    if (!content || busy) return
    if (navigator.onLine === false) {
      setInput(content)
      setError('Agent 需要联网，日历、工期和本地规划仍可正常使用。')
      setPhase('等待联网')
      return
    }
    const nextMessages = [...messages, { role: 'user', content }].slice(-30)
    const streamId = globalThis.crypto?.randomUUID?.() || `stream-${Date.now()}`
    const typingComplete = typewriterRef.current.begin(streamId)
    setMessages([...nextMessages, { id: streamId, role: 'assistant', content: '', streaming: true }].slice(-30))
    setInput('')
    setBusy(true)
    setError('')
    setResult(null)
    setActionStates({})
    setApplied(false)
    setCelebrating(false)
    setPhase(content.includes('查') || content.includes('联网') ? '准备联网' : '正在思考')

    try {
      const response = await authFetch(AGENT_API_URL, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Accept: 'text/event-stream' },
        body: JSON.stringify({
          message: content,
          messages: nextMessages.slice(0, -1).slice(-11),
          calendar: { ...calendarContext, profile },
          stream: true,
        }),
      })
      let finalPayload = null
      let streamError = ''
      await consumeAgentStream(response, {
        status: (event) => setPhase(event.message || '正在整理'),
        delta: (event) => typewriterRef.current.push(streamId, event.text || ''),
        reset: () => typewriterRef.current.reset(streamId),
        result: (payload) => {
          finalPayload = payload
          setResult(payload)
          const automaticActions = (payload.actionDrafts || []).filter((action) => action.automatic && action.kind === 'jump_to_date')
          setActionStates(Object.fromEntries(automaticActions.map((action) => [action.id, { status: 'running', message: '正在翻日历…' }])))
          automaticActions.forEach((action) => {
            Promise.resolve(onExecuteAction?.(action)).then((message) => {
              setActionStates((current) => ({ ...current, [action.id]: { status: 'done', message: message || '已跳转' } }))
              setPhase('已定位日期')
            }).catch((reason) => {
              setActionStates((current) => ({ ...current, [action.id]: { status: 'error', message: reason?.message || '跳转失败' } }))
            })
          })
          typewriterRef.current.complete(streamId, payload)
          if (payload.planDrafts?.length) setCelebrating(true)
          setPhase(payload.sources?.length ? '已联网整理' : payload.status === 'clarify' ? '等你补充' : '方案已就绪')
        },
        error: (event) => { streamError = event.error || '小Y 暂时没有收到模型回复' },
      })
      if (streamError) throw new Error(streamError)
      if (!finalPayload) throw new Error('模型回复中断，请重试')
      await typingComplete
    } catch (requestError) {
      typewriterRef.current.cancel(streamId, true)
      setMessages((current) => current.filter((message) => message.id !== streamId || message.content))
      const offline = navigator.onLine === false || requestError instanceof TypeError
      setError(offline
        ? 'Agent 需要联网，日历、工期和本地规划仍可正常使用。'
        : requestError.message || '网络开小差了，请稍后再试')
      setPhase(offline ? '等待联网' : '需要重试')
    } finally {
      setBusy(false)
    }
  }

  const applyPlans = () => {
    if (!result?.planDrafts?.length || applied) return
    onApplyPlans(result.planDrafts)
    setApplied(true)
    setCelebrating(true)
    setPhase('已写入日历')
    setMessages((current) => [...current, { role: 'assistant', content: `已把 ${result.planDrafts.length} 个规划写入规划中心。每日任务仍可单独修改、移动或跳过。` }].slice(-30))
  }

  const executeAction = async (action) => {
    const currentState = actionStates[action.id]
    if (!onExecuteAction || currentState?.status === 'running' || currentState?.status === 'done') return
    if (action.destructive && currentState?.status !== 'armed') {
      setActionStates((current) => ({ ...current, [action.id]: { status: 'armed', message: '再点一次确认删除' } }))
      return
    }
    setActionStates((current) => ({ ...current, [action.id]: { status: 'running', message: '执行中…' } }))
    try {
      const message = await onExecuteAction(action)
      setActionStates((current) => ({ ...current, [action.id]: { status: 'done', message: message || '已完成' } }))
      setCelebrating(true)
      setPhase('操作已完成')
    } catch (reason) {
      setActionStates((current) => ({ ...current, [action.id]: { status: 'error', message: reason?.message || '执行失败，请重试' } }))
    }
  }

  const executeSafeActions = async () => {
    if (batchExecuting) return
    const pending = (result?.actionDrafts || []).filter((action) => !action.automatic && !action.destructive && !action.sensitive && actionStates[action.id]?.status !== 'done')
    setBatchExecuting(true)
    try {
      for (const action of pending) await executeAction(action)
    } finally {
      setBatchExecuting(false)
    }
  }

  const clearConversation = () => {
    typewriterRef.current.cancel(undefined, false)
    setMessages([])
    setResult(null)
    setActionStates({})
    setError('')
    setPhase('待命')
  }

  const hidePet = () => {
    setOpen(false)
    onHide?.()
  }

  const openSource = async (event, url) => {
    if (!Capacitor.isNativePlatform()) return
    event.preventDefault()
    try {
      await ExternalBrowser.open({ url })
    } catch {
      window.open(url, '_system', 'noopener,noreferrer')
    }
  }

  const chatBubble = getChatBubbleLayout(petPosition, false, bubbleSize)
  const hiddenPet = getHiddenPetPosition(petPosition)
  const displayPosition = hidden ? hiddenPet.position : petPosition
  const petMood = busy
    ? 'thinking'
    : celebrating || dragging
      ? 'celebrate'
      : open
        ? (messages.length || input.trim() ? 'focused' : 'idle')
        : ambientMood
  const petImage = PET_IMAGES[petMood] || mascot

  return (
    <>
      <div
        className={`xy-agent-launcher-wrap mood-${petMood} ${open && !hidden ? 'is-open' : ''} ${dragging ? 'is-dragging' : ''} ${hidden ? `is-hidden dock-${hiddenPet.side}` : ''} ${petPosition.x < window.innerWidth / 2 ? 'bubble-on-right' : ''}`}
        data-pet-mood={petMood}
        style={{ transform: `translate3d(${displayPosition.x}px, ${displayPosition.y}px, 0)` }}
      >
        {!open && !hidden ? (
          <button
            className="xy-agent-quick-hide"
            type="button"
            onPointerDown={(event) => event.stopPropagation()}
            onClick={hidePet}
            aria-label="隐藏小Y宠物"
            title="隐藏宠物"
          >
            <EyeOff />
          </button>
        ) : null}
        <button
          className="xy-agent-launcher"
          type="button"
          onPointerDown={hidden ? undefined : startPetDrag}
          onPointerMove={hidden ? undefined : movePet}
          onPointerUp={hidden ? undefined : finishPetDrag}
          onPointerCancel={hidden ? undefined : cancelPetDrag}
          onClick={(event) => {
            event.preventDefault()
            if (hidden) {
              onShow?.()
              return
            }
            if (event.detail === 0) {
              setOpen((current) => !current)
            }
          }}
          aria-label={hidden ? '显示小Y宠物' : '拖动或打开小Y智能规划助手'}
          title={hidden ? '点击唤回小Y' : undefined}
        >
          <i className="xy-agent-aura" />
          <img key={petMood} src={petImage} alt="" />
          <span className="xy-agent-spark one">✦</span>
          <span className="xy-agent-spark two">·</span>
          <em>AI</em>
        </button>
      </div>

      <aside
        className={`xy-agent-drawer xy-agent-chat-bubble ${chatBubble.placement} ${open && !hidden ? 'is-open' : ''} ${dragging ? 'is-dragging' : ''} ${resizingBubble ? 'is-resizing' : ''}`}
        style={chatBubble.style}
        aria-hidden={!open || hidden}
        aria-label="小Y智能规划助手"
      >
        <header className="xy-agent-header">
          <span className={`xy-agent-avatar mood-${petMood}`}><img src={petImage} alt="" /></span>
          <div><strong>小Y Agent</strong><small><i className={busy ? 'busy' : ''} />{phase}</small></div>
          <button type="button" onClick={() => setProfileOpen((value) => !value)} aria-label="设置我的情况"><UserRoundCog /></button>
          <button type="button" onClick={hidePet} aria-label="隐藏小Y宠物" title="隐藏宠物"><EyeOff /></button>
          <button type="button" onClick={clearConversation} aria-label="清空对话"><Trash2 /></button>
          <button type="button" onClick={() => setOpen(false)} aria-label="关闭"><X /></button>
        </header>

        <div className="xy-agent-scroll" ref={scrollRef}>
          {profileOpen ? (
            <section className="xy-agent-profile">
              <div className="xy-agent-section-title"><UserRoundCog /><div><strong>我的情况</strong><small>这些信息只保存在本机，帮助小Y少问几次</small></div><ChevronDown /></div>
              <div className="xy-agent-profile-grid">
                <label><span>每天可用时间（分钟）</span><input inputMode="numeric" value={profile.dailyMinutes} onChange={(event) => setProfile({ ...profile, dailyMinutes: event.target.value.replace(/\D/g, '').slice(0, 4) })} placeholder="例如 90" /></label>
                <label><span>计划强度</span><select value={profile.intensity} onChange={(event) => setProfile({ ...profile, intensity: event.target.value })}><option value="gentle">轻松</option><option value="balanced">均衡</option><option value="intensive">冲刺</option></select></label>
                <label className="wide"><span>休息偏好</span><input value={profile.restPreference} onChange={(event) => setProfile({ ...profile, restPreference: event.target.value.slice(0, 100) })} placeholder="例如：周日休息、晚上不安排" /></label>
                <label className="wide"><span>固定安排</span><textarea value={profile.fixedSchedule} onChange={(event) => setProfile({ ...profile, fixedSchedule: event.target.value.slice(0, 300) })} placeholder="例如：工作日 9:00—18:00 上班" /></label>
              </div>
            </section>
          ) : null}

          {!messages.length ? (
            <section className="xy-agent-welcome">
              <span className="xy-agent-welcome-art"><img src={mascotFocused} alt="" /><Sparkles /></span>
              <p className="xy-agent-eyebrow">你的自由规划搭子</p>
              <h2>你说目标，小Y 来拆步骤、查资料、排时间</h2>
              <p>我会先看你的日历和已有规划；信息不够会追问。方案只有在你确认后才会写入。</p>
              <div className="xy-agent-quick-list">
                {QUICK_PROMPTS.map((prompt, index) => <button type="button" key={prompt} onClick={() => send(prompt)}><span>{index === 2 ? <Globe2 /> : index === 1 ? <BriefcaseBusiness /> : <BookOpenCheck />}</span>{prompt}</button>)}
              </div>
            </section>
          ) : (
            <section className="xy-agent-messages" aria-live="polite" aria-busy={busy}>
              {messages.map((message, index) => <div className={`xy-agent-message ${message.role} ${message.streaming ? 'is-streaming' : ''}`} key={message.id || `${message.role}-${index}`}><span><RichText content={message.content} />{message.streaming ? <i className="xy-agent-stream-caret" /> : null}</span></div>)}
              {busy && !messages.at(-1)?.content ? <div className="xy-agent-thinking"><LoaderCircle /><span>{phase}</span></div> : null}
            </section>
          )}

          {error ? <section className="xy-agent-error"><p>{error}</p><button type="button" onClick={() => send([...messages].reverse().find((message) => message.role === 'user')?.content)}><RotateCcw />重试</button></section> : null}

          {result?.questions?.length ? (
            <section className="xy-agent-followups"><div className="xy-agent-section-title"><MessageCircleQuestion /><div><strong>还差一点信息</strong><small>点一个问题直接补充</small></div></div>{result.questions.map((question) => <button type="button" key={question} onClick={() => { setInput(`${question}：`); inputRef.current?.focus() }}>{question}</button>)}</section>
          ) : null}

          {result?.actionDrafts?.length ? (
            <section className="xy-agent-actions">
              <div className="xy-agent-section-title"><CalendarCheck2 /><div><strong>小Y 准备操作</strong><small>按批次预览，一次确认完成整段设置</small></div></div>
              <div className="xy-agent-action-list">
                {result.actionDrafts.map((action) => {
                  const state = actionStates[action.id] || {}
                  return (
                    <article className={`xy-agent-action-card ${action.destructive ? 'is-destructive' : ''} ${state.status === 'done' ? 'is-done' : ''}`} key={action.id}>
                      <span className="xy-agent-action-icon"><ActionIcon kind={action.kind} /></span>
                      <div><strong>{ACTION_LABELS[action.kind] || '应用操作'}</strong><p>{actionDescription(action)}</p>{action.sensitive ? <small>敏感操作 · 需要本人确认</small> : null}{state.message ? <em className={state.status}>{state.message}</em> : null}</div>
                      <button type="button" onClick={() => executeAction(action)} disabled={state.status === 'running' || state.status === 'done'}>
                        {state.status === 'done' ? <><Check />完成</> : state.status === 'running' ? <><LoaderCircle className="spin" />执行</> : state.status === 'armed' ? '确认删除' : action.destructive ? '删除' : '确认'}
                      </button>
                    </article>
                  )
                })}
              </div>
              {result.actionDrafts.some((action) => !action.automatic && !action.destructive && !action.sensitive && actionStates[action.id]?.status !== 'done') ? <button className="xy-agent-apply" type="button" onClick={executeSafeActions} disabled={batchExecuting}>{batchExecuting ? <><LoaderCircle className="spin" />正在执行</> : <><Check />确认执行普通操作</>}</button> : null}
            </section>
          ) : null}

          {result?.planDrafts?.length ? (
            <section className="xy-agent-proposal">
              <div className="xy-agent-section-title"><Sparkles /><div><strong>小Y 的规划草案</strong><small>确认前不会修改你的日历</small></div></div>
              <div className="xy-agent-plan-list">{result.planDrafts.map((plan, index) => <PlanCard plan={plan} key={`${plan.title}-${index}`} />)}</div>
              <button className={`xy-agent-apply ${applied ? 'is-done' : ''}`} type="button" onClick={applyPlans} disabled={applied}>{applied ? <><Check />已写入规划中心</> : <><Plus />确认并写入日历</>}</button>
            </section>
          ) : null}

          {result?.sources?.length ? (
            <section className="xy-agent-sources"><div className="xy-agent-section-title"><Globe2 /><div><strong>联网参考</strong><small>打开来源核对详情</small></div></div>{result.sources.map((source, index) => <a href={source.url} target="_blank" rel="noreferrer" onClick={(event) => openSource(event, source.url)} key={`${source.url}-${index}`}><span><b>{source.title || `参考资料 ${index + 1}`}</b><small>{source.url}</small></span><ExternalLink /></a>)}</section>
          ) : null}
        </div>

        <footer className="xy-agent-composer">
          <textarea ref={inputRef} rows="1" value={input} onChange={(event) => setInput(event.target.value.slice(0, 1200))} onKeyDown={(event) => { if (event.key === 'Enter' && !event.shiftKey) { event.preventDefault(); send() } }} placeholder="说目标、时间和你的实际情况…" disabled={busy} />
          <button type="button" onClick={() => send()} disabled={!input.trim() || busy} aria-label="发送"><Send /></button>
          <small>回车发送 · Shift + 回车换行 · 计划确认后才写入</small>
        </footer>
        <button className="xy-agent-resize-handle" type="button" onPointerDown={startBubbleResize} onPointerMove={resizeBubble} onPointerUp={finishBubbleResize} onPointerCancel={cancelBubbleResize} aria-label="拖动调整聊天气泡大小" title="拖动调整气泡大小"><MoveDiagonal2 /></button>
      </aside>
    </>
  )
}
