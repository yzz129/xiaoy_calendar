import { useEffect, useRef, useState } from 'react'
import {
  Activity,
  ArrowDownUp,
  ArrowLeft,
  Bot,
  CalendarDays,
  ChevronRight,
  CircleUserRound,
  Clock3,
  Database,
  Gauge,
  KeyRound,
  Laptop,
  LogIn,
  LogOut,
  MessageCircle,
  Pencil,
  Plus,
  RefreshCw,
  Search,
  ShieldCheck,
  Trash2,
  UsersRound,
  X,
} from 'lucide-react'
import { authFetch } from '../auth'
import Logo from './Logo'

const TABS = [
  ['overview', '用户概览', CircleUserRound],
  ['plans', '规划', CalendarDays],
  ['usage', '使用情况', Gauge],
  ['chats', '聊天记录', MessageCircle],
  ['calls', 'AI 调用', Bot],
  ['activity', '用户行为', Activity],
]

const SORT_OPTIONS = [
  ['recent', '最近活跃'],
  ['registered', '最新注册'],
  ['nickname', '昵称排序'],
  ['plans', '规划数量'],
  ['calls', 'AI 调用量'],
  ['activity', '行为数量'],
]

const ACTION_LABELS = {
  registered: '注册账号',
  login: '登录',
  login_failed: '登录失败',
  logout: '退出登录',
  data_sync: '同步日历数据',
  agent_search: 'Agent 联网搜索',
  agent_completed: 'Agent 完成任务',
  admin_user_created: '管理员创建用户',
  admin_user_updated: '管理员修改用户',
  admin_user_deleted: '管理员删除用户',
}

function localTime(value) {
  if (!value) return '—'
  return new Intl.DateTimeFormat('zh-CN', { dateStyle: 'medium', timeStyle: 'short' }).format(new Date(value))
}

function safeJson(value) {
  try { return value ? JSON.parse(value) : {} } catch { return {} }
}

function displayValue(value) {
  if (value == null) return '—'
  if (typeof value === 'object') return JSON.stringify(value)
  return String(value)
}

function requestLocationLabel(value) {
  const seen = new Set()
  const parts = String(value || '').split('·').map((part) => part.trim()).filter((part) => {
    if (!part) return false
    const key = part.toLocaleLowerCase('en-US')
    if (seen.has(key)) return false
    seen.add(key)
    return true
  })
  return parts.join(' · ') || '旧记录未采集'
}

async function api(path, options) {
  const response = await authFetch(path, options)
  const payload = await response.json().catch(() => ({}))
  if (!response.ok) {
    const error = new Error(payload.error || '请求失败')
    error.status = response.status
    throw error
  }
  return payload
}

export default function AdminApp({ currentUser, onLogout }) {
  const detailRequest = useRef(0)
  const [users, setUsers] = useState([])
  const [summary, setSummary] = useState({ users: 0, active: 0, chats: 0, calls: 0, activities: 0 })
  const [search, setSearch] = useState('')
  const [sort, setSort] = useState('recent')
  const [selectedId, setSelectedId] = useState('')
  const [detail, setDetail] = useState(null)
  const [tab, setTab] = useState('overview')
  const [loading, setLoading] = useState(true)
  const [detailLoading, setDetailLoading] = useState(false)
  const [error, setError] = useState('')
  const [createOpen, setCreateOpen] = useState(false)
  const [createForm, setCreateForm] = useState({ nickname: '', password: '', role: 'user' })
  const [editForm, setEditForm] = useState(null)

  const loadUsers = async (query = search, sortValue = sort) => {
    setLoading(true)
    setError('')
    try {
      const payload = await api(`/api/admin/users?search=${encodeURIComponent(query.trim())}&sort=${encodeURIComponent(sortValue)}`)
      const nextUsers = payload.users || []
      setUsers(nextUsers)
      setSummary(payload.summary || { users: 0, active: 0, chats: 0, calls: 0, activities: 0 })
      setSelectedId((current) => nextUsers.some((user) => user.id === current) ? current : (nextUsers[0]?.id || ''))
    } catch (loadError) {
      setError(loadError.message)
    } finally {
      setLoading(false)
    }
  }

  const loadDetail = async (id, allowAuthRetry = true) => {
    if (!id) return
    const requestId = ++detailRequest.current
    setDetailLoading(true)
    setError('')
    try {
      const payload = await api(`/api/admin/users/${encodeURIComponent(id)}`)
      if (requestId !== detailRequest.current) return
      setDetail(payload)
      setEditForm({ nickname: payload.user.nickname, role: payload.user.role, status: payload.user.status, password: '' })
      setError('')
    } catch (loadError) {
      if (requestId !== detailRequest.current) return
      if (allowAuthRetry && loadError.status === 403 && currentUser.role === 'admin') {
        try {
          const session = await api('/api/auth/session?scope=admin')
          if (session.user?.role === 'admin') {
            await loadDetail(id, false)
            return
          }
        } catch {
          // 下面统一显示明确的登录失效提示。
        }
        setError('管理员登录已失效，请退出后重新登录')
        return
      }
      setError(loadError.message)
    } finally {
      if (requestId === detailRequest.current) setDetailLoading(false)
    }
  }

  useEffect(() => { loadUsers('', 'recent') }, [])
  useEffect(() => {
    setDetail(null)
    if (selectedId) loadDetail(selectedId)
    else {
      detailRequest.current += 1
      setDetailLoading(false)
    }
  }, [selectedId])

  const createUser = async (event) => {
    event.preventDefault()
    try {
      await api('/api/admin/users', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(createForm) })
      setCreateOpen(false)
      setCreateForm({ nickname: '', password: '', role: 'user' })
      await loadUsers()
    } catch (submitError) { setError(submitError.message) }
  }

  const saveUser = async (event) => {
    event.preventDefault()
    try {
      await api(`/api/admin/users/${encodeURIComponent(selectedId)}`, { method: 'PATCH', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(editForm) })
      await Promise.all([loadUsers(), loadDetail(selectedId)])
    } catch (submitError) { setError(submitError.message) }
  }

  const deleteUser = async () => {
    if (!detail?.user || !window.confirm(`确定删除用户“${detail.user.nickname}”及其全部数据吗？此操作不可恢复。`)) return
    try {
      await api(`/api/admin/users/${encodeURIComponent(selectedId)}`, { method: 'DELETE' })
      setSelectedId('')
      setDetail(null)
      await loadUsers()
    } catch (submitError) { setError(submitError.message) }
  }

  const snapshot = detail?.snapshot || {}
  const plans = Array.isArray(snapshot.plans) ? snapshot.plans : []
  const entries = snapshot.entries && typeof snapshot.entries === 'object' ? snapshot.entries : {}
  const notes = snapshot.notes && typeof snapshot.notes === 'object' ? snapshot.notes : {}
  const noteCount = Object.values(notes).reduce((total, list) => total + (Array.isArray(list) ? list.length : 0), 0)
  const usage = detail?.usage || {}
  const callCount = Number(usage.call_count || 0)
  const successfulCalls = Number(usage.successful_calls || 0)
  const successRate = callCount ? Math.round((successfulCalls / callCount) * 100) : 0

  return (
    <main className="admin-page">
      <header className="admin-header"><Logo /><div><span><ShieldCheck />管理员后台</span><small>用户、规划、聊天与模型调用审计</small></div><nav><a href="/"><ArrowLeft />返回日历</a><button onClick={onLogout}><LogOut />退出</button></nav></header>
      <section className="admin-summary">
        <article><UsersRound /><span><small>全部用户</small><strong>{summary.users || 0}</strong></span></article>
        <article><ShieldCheck /><span><small>正常账号</small><strong>{summary.active || 0}</strong></span></article>
        <article><MessageCircle /><span><small>聊天消息</small><strong>{summary.chats || 0}</strong></span></article>
        <article><Bot /><span><small>AI 调用</small><strong>{summary.calls || 0}</strong></span></article>
      </section>
      {error ? <div className="admin-alert">{error}<button onClick={() => setError('')}><X /></button></div> : null}
      <section className="admin-workspace">
        <aside className="admin-users">
          <div className="admin-panel-title"><div><strong>全部用户</strong><small>共 {summary.users || 0} 位 · 当前管理员：{currentUser.nickname}</small></div><button onClick={() => setCreateOpen(true)}><Plus />新增</button></div>
          <div className="admin-user-tools">
            <form className="admin-search" onSubmit={(event) => { event.preventDefault(); loadUsers() }}><Search /><input value={search} onChange={(event) => setSearch(event.target.value)} placeholder="搜索昵称" /><button aria-label="搜索并刷新"><RefreshCw /></button></form>
            <label className="admin-sort"><ArrowDownUp /><select value={sort} onChange={(event) => { const value = event.target.value; setSort(value); loadUsers(search, value) }} aria-label="用户排序方式">{SORT_OPTIONS.map(([value, label]) => <option key={value} value={value}>{label}</option>)}</select></label>
          </div>
          <div className="admin-user-list">{loading ? <p className="admin-empty">正在加载用户…</p> : users.length ? users.map((user) => <button className={selectedId === user.id ? 'active' : ''} onClick={() => { setSelectedId(user.id); setTab('overview') }} key={user.id}><span className={`admin-user-avatar ${user.role}`}>{user.nickname.slice(0, 1).toUpperCase()}</span><span><strong>{user.nickname}{user.role === 'admin' ? <em>管理员</em> : null}</strong><small>{user.status === 'active' ? '正常' : '已停用'} · 最近活跃 {localTime(user.last_active_at)}</small><span className="admin-user-counts"><i>{user.plan_count || 0} 规划</i><i>{user.model_call_count || 0} AI</i><i>{user.activity_count || 0} 行为</i></span></span><ChevronRight /></button>) : <p className="admin-empty">没有找到匹配用户</p>}</div>
        </aside>
        <section className={`admin-detail ${selectedId ? 'mobile-open' : ''}`}>
          {!selectedId ? <div className="admin-empty"><UsersRound /><strong>选择一个用户查看详情</strong></div> : detailLoading && !detail ? <div className="admin-empty">正在读取用户资料…</div> : detail ? <>
            <div className="admin-detail-head"><button className="admin-mobile-back" onClick={() => setSelectedId('')} aria-label="返回用户列表"><ArrowLeft /></button><div><span className={`admin-user-avatar ${detail.user.role}`}>{detail.user.nickname.slice(0, 1).toUpperCase()}</span><span><strong>{detail.user.nickname}<em className={`admin-status ${detail.user.status}`}>{detail.user.status === 'active' ? '正常' : '停用'}</em></strong><small>注册 {localTime(detail.user.created_at)} · 最近登录 {localTime(detail.user.last_login_at)} · 最近活跃 {localTime(usage.last_activity_at || usage.last_seen_at || detail.user.last_login_at)}</small></span></div>{detail.user.id !== currentUser.id ? <button className="danger" onClick={deleteUser} aria-label="删除用户" title="删除用户"><Trash2 /><span>删除用户</span></button> : null}</div>
            <div className="admin-tabs">{TABS.map(([value, label, Icon]) => <button className={tab === value ? 'active' : ''} onClick={() => setTab(value)} key={value}><Icon />{label}</button>)}</div>
            <div className="admin-tab-body">
              {tab === 'overview' ? <div className="admin-overview">
                <form className="admin-edit-card" onSubmit={saveUser}><div className="admin-section-title"><Pencil /><span><strong>账号资料</strong><small>修改昵称、权限、状态或重置密码</small></span></div><div className="admin-form-grid"><label><span>昵称</span><input value={editForm?.nickname || ''} onChange={(event) => setEditForm({ ...editForm, nickname: event.target.value })} /></label><label><span>角色</span><select value={editForm?.role || 'user'} onChange={(event) => setEditForm({ ...editForm, role: event.target.value })}><option value="user">普通用户</option><option value="admin">管理员</option></select></label><label><span>状态</span><select value={editForm?.status || 'active'} onChange={(event) => setEditForm({ ...editForm, status: event.target.value })}><option value="active">正常</option><option value="disabled">停用</option></select></label><label><span>新密码（不修改请留空）</span><input type="password" value={editForm?.password || ''} onChange={(event) => setEditForm({ ...editForm, password: event.target.value })} /></label></div><button className="admin-primary"><KeyRound />保存修改</button></form>
                <div className="admin-overview-side"><div className="admin-data-card"><div className="admin-section-title"><Database /><span><strong>用户数据概览</strong><small>最近同步 {localTime(detail.snapshotUpdatedAt)}</small></span></div><div className="admin-data-grid"><span><strong>{plans.length}</strong><small>规划</small></span><span><strong>{Object.keys(entries).length}</strong><small>日期记录</small></span><span><strong>{noteCount}</strong><small>便签</small></span><span><strong>{usage.chat_count || 0}</strong><small>聊天消息</small></span></div></div><div className="admin-account-facts"><span><small>用户 ID</small><strong>{detail.user.id}</strong></span><span><small>账号角色</small><strong>{detail.user.role === 'admin' ? '管理员' : '普通用户'}</strong></span><span><small>账号创建</small><strong>{localTime(detail.user.created_at)}</strong></span><span><small>最近更新</small><strong>{localTime(detail.user.updated_at)}</strong></span></div></div>
              </div> : null}
              {tab === 'plans' ? <div className="admin-record-list">{plans.length ? plans.map((plan) => <article key={plan.id || plan.title}><span className={`record-icon ${plan.type === 'work' ? 'work' : ''}`}><CalendarDays /></span><div><strong>{plan.title || '未命名规划'}</strong><p>{plan.goal || plan.dailyTask || '暂无目标说明'}</p><small>{plan.start || '—'} 至 {plan.end || '—'} · {plan.type === 'work' ? '工作规划' : '学习规划'}</small></div></article>) : <p className="admin-empty">该用户暂无规划</p>}</div> : null}
              {tab === 'usage' ? <div className="admin-usage"><div className="admin-usage-grid"><article><LogIn /><span><small>累计登录</small><strong>{usage.login_count || 0} 次</strong></span></article><article><Laptop /><span><small>登录会话</small><strong>{usage.session_count || 0} 个</strong></span></article><article><Database /><span><small>数据同步</small><strong>{usage.sync_count || 0} 次</strong></span></article><article><Bot /><span><small>AI 成功率</small><strong>{successRate}%</strong></span></article><article><Clock3 /><span><small>平均响应</small><strong>{usage.average_latency_ms || 0} ms</strong></span></article><article><Activity /><span><small>行为记录</small><strong>{usage.activity_count || 0} 条</strong></span></article></div><section className="admin-usage-section"><div className="admin-section-title"><Bot /><span><strong>模型与提供商使用分布</strong><small>按模型、状态和调用量统计</small></span></div>{usage.providers?.length ? <div className="admin-breakdown">{usage.providers.map((item) => <article key={`${item.provider}-${item.model}-${item.status}`}><span><strong>{item.provider}</strong><small>{item.model}</small></span><span><b>{item.count}</b><small>{item.status === 'success' ? '成功' : '失败'} · 平均 {item.average_latency_ms || 0}ms</small></span></article>)}</div> : <p className="admin-inline-empty">暂无 AI 使用数据</p>}</section><section className="admin-usage-section"><div className="admin-section-title"><Activity /><span><strong>行为分布</strong><small>展示该用户主要使用动作</small></span></div>{usage.actionBreakdown?.length ? <div className="admin-action-breakdown">{usage.actionBreakdown.map((item) => <span key={item.action}><strong>{ACTION_LABELS[item.action] || item.action}</strong><i>{item.count}</i><small>{localTime(item.last_used_at)}</small></span>)}</div> : <p className="admin-inline-empty">暂无用户行为</p>}</section><section className="admin-usage-section"><div className="admin-section-title"><Laptop /><span><strong>登录设备与会话</strong><small>仅展示最近 50 个会话，不包含令牌</small></span></div>{usage.sessions?.length ? <div className="admin-session-list">{usage.sessions.map((session, index) => <article key={`${session.created_at}-${index}`}><Laptop /><span><strong>{session.user_agent || '未知设备'}</strong><small className="admin-meta-line">创建 {localTime(session.created_at)} · 最后活动 {localTime(session.last_seen_at)} · 城市：{requestLocationLabel(session.location)}</small>{session.ip || session.user_agent ? <small className="admin-meta-line admin-technical">{session.ip ? `IP ${session.ip}` : ''}{session.ip && session.user_agent ? ' · ' : ''}{session.user_agent || ''}</small> : null}</span><em className={new Date(session.expires_at).getTime() > Date.now() ? 'active' : ''}>{new Date(session.expires_at).getTime() > Date.now() ? '有效' : '过期'}</em></article>)}</div> : <p className="admin-inline-empty">暂无会话记录</p>}</section></div> : null}
              {tab === 'chats' ? <div className="admin-record-list">{detail.chats.length ? detail.chats.map((chat) => <article key={chat.id}><span className={`record-icon ${chat.role}`}><MessageCircle /></span><div><strong>{chat.role === 'user' ? '用户' : '小Y Agent'}</strong><p>{chat.content}</p><small>{localTime(chat.created_at)}{chat.provider ? ` · ${chat.provider} / ${chat.model}` : ''}</small></div></article>) : <p className="admin-empty">暂无聊天记录</p>}</div> : null}
              {tab === 'calls' ? <div className="admin-record-list">{detail.modelCalls.length ? detail.modelCalls.map((call) => <article key={call.id}><span className={`record-icon ${call.status}`}><Bot /></span><div><strong>{call.provider} · {call.model}</strong><p>{call.request_preview || '无请求摘要'}</p>{call.response_preview ? <details><summary>查看模型返回</summary><pre>{call.response_preview}</pre></details> : null}<small>{localTime(call.created_at)} · {call.latency_ms}ms · {call.status === 'success' ? '成功' : `失败：${call.error || '未知错误'}`}</small></div></article>) : <p className="admin-empty">暂无模型调用</p>}</div> : null}
              {tab === 'activity' ? <div className="admin-record-list">{detail.activities.length ? detail.activities.map((item) => <article key={item.id}><span className="record-icon"><Activity /></span><div><strong>{ACTION_LABELS[item.action] || item.action}</strong><p>{Object.entries(safeJson(item.detail_json)).map(([key, value]) => `${key}: ${displayValue(value)}`).join(' · ') || '—'}</p><small className="admin-meta-line">{localTime(item.created_at)} · 网络出口位置（IP 推断）：{requestLocationLabel(item.location)}</small>{item.ip || item.user_agent ? <small className="admin-meta-line admin-technical">{item.ip ? `IP ${item.ip}` : ''}{item.ip && item.user_agent ? ' · ' : ''}{item.user_agent || ''}</small> : null}</div></article>) : <p className="admin-empty">暂无用户行为</p>}</div> : null}
            </div>
          </> : null}
        </section>
      </section>
      {createOpen ? <div className="admin-modal" role="dialog" aria-modal="true"><form onSubmit={createUser}><div className="admin-section-title"><Plus /><span><strong>新增用户</strong><small>创建后可立即登录</small></span><button type="button" onClick={() => setCreateOpen(false)}><X /></button></div><label><span>昵称</span><input value={createForm.nickname} onChange={(event) => setCreateForm({ ...createForm, nickname: event.target.value })} required /></label><label><span>初始密码</span><input type="password" value={createForm.password} onChange={(event) => setCreateForm({ ...createForm, password: event.target.value })} minLength="6" required /></label><label><span>角色</span><select value={createForm.role} onChange={(event) => setCreateForm({ ...createForm, role: event.target.value })}><option value="user">普通用户</option><option value="admin">管理员</option></select></label><button className="admin-primary"><Plus />创建用户</button></form></div> : null}
    </main>
  )
}
