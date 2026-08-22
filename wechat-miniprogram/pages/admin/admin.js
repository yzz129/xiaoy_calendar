const app = getApp()
const api = require('../../utils/api')

const SORTS = [
  { value: 'recent', label: '最近活跃' }, { value: 'registered', label: '最新注册' },
  { value: 'nickname', label: '昵称排序' }, { value: 'plans', label: '规划数量' },
  { value: 'calls', label: 'AI 调用量' }, { value: 'activity', label: '行为数量' },
]
const TABS = [
  { value: 'overview', label: '用户概览' }, { value: 'plans', label: '规划' },
  { value: 'usage', label: '使用情况' }, { value: 'chats', label: '聊天记录' },
  { value: 'calls', label: 'AI 调用' }, { value: 'activity', label: '用户行为' },
]

function localTime(value) {
  if (!value) return '—'
  const date = new Date(value)
  if (Number.isNaN(date.getTime())) return '—'
  const pad = (number) => String(number).padStart(2, '0')
  return `${date.getFullYear()}年${date.getMonth() + 1}月${date.getDate()}日 ${pad(date.getHours())}:${pad(date.getMinutes())}`
}

function presentUser(user) {
  return {
    ...user,
    initial: String(user.nickname || 'Y').slice(0, 1),
    roleLabel: user.role === 'admin' ? '管理员' : '用户',
    statusLabel: user.status === 'active' ? '正常' : '停用',
    lastActiveLabel: localTime(user.last_active_at),
  }
}

Page({
  data: {
    loading: true, error: '', users: [], summary: { users: 0, active: 0, chats: 0, calls: 0, activities: 0 },
    search: '', sorts: SORTS, sortIndex: 0, tabs: TABS, activeTab: 'overview',
    detailOpen: false, detailLoading: false, detail: null, detailPlans: [],
    createOpen: false, createForm: { nickname: '', password: '', role: 'user' },
    editOpen: false, editForm: { nickname: '', password: '', role: 'user', status: 'active' },
  },

  async onLoad() {
    try {
      const user = await app.ensureSession()
      if (!user || user.role !== 'admin') {
        wx.showToast({ title: '需要管理员权限', icon: 'none' }); setTimeout(() => wx.navigateBack(), 500); return
      }
      await this.loadUsers()
    } catch (error) { this.setData({ loading: false, error: error.message || '管理员登录已失效' }) }
  },
  async onPullDownRefresh() { await this.loadUsers(); wx.stopPullDownRefresh() },
  back() { wx.navigateBack() },
  async logout() { await app.logout(); wx.reLaunch({ url: '/pages/login/login' }) },
  inputSearch(event) { this.setData({ search: event.detail.value }) },
  submitSearch() { this.loadUsers() },
  changeSort(event) { this.setData({ sortIndex: Number(event.detail.value) }); this.loadUsers() },

  async loadUsers() {
    this.setData({ loading: true, error: '' })
    try {
      const sort = this.data.sorts[this.data.sortIndex]?.value || 'recent'
      const payload = await api.request(`/api/admin/users?search=${encodeURIComponent(this.data.search.trim())}&sort=${encodeURIComponent(sort)}`)
      this.setData({ users: (payload.users || []).map(presentUser), summary: payload.summary || {}, loading: false })
    } catch (error) { this.setData({ error: error.message || '加载用户失败', loading: false }) }
  },

  async openDetail(event) {
    const id = event.currentTarget.dataset.id
    this.setData({ detailOpen: true, detailLoading: true, activeTab: 'overview', error: '' })
    try {
      const payload = await api.request(`/api/admin/users/${encodeURIComponent(id)}`)
      const detail = {
        ...payload,
        user: { ...presentUser(payload.user), createdLabel: localTime(payload.user.created_at), updatedLabel: localTime(payload.user.updated_at) },
        snapshotUpdatedLabel: localTime(payload.snapshotUpdatedAt),
        chats: (payload.chats || []).map((item) => ({ ...item, timeLabel: localTime(item.created_at) })),
        modelCalls: (payload.modelCalls || []).map((item) => ({ ...item, timeLabel: localTime(item.created_at) })),
        activities: (payload.activities || []).map((item) => ({ ...item, timeLabel: localTime(item.created_at) })),
      }
      this.setData({ detail, detailPlans: Array.isArray(payload.snapshot?.plans) ? payload.snapshot.plans : [], detailLoading: false,
        editForm: { nickname: payload.user.nickname, password: '', role: payload.user.role, status: payload.user.status } })
    } catch (error) { this.setData({ error: error.message || '加载详情失败', detailLoading: false }) }
  },
  closeDetail() { this.setData({ detailOpen: false, detail: null }) },
  switchTab(event) { this.setData({ activeTab: event.currentTarget.dataset.tab }) },
  openCreate() { this.setData({ createOpen: true, createForm: { nickname: '', password: '', role: 'user' } }) },
  closeCreate() { this.setData({ createOpen: false }) },
  inputCreate(event) { this.setData({ [`createForm.${event.currentTarget.dataset.field}`]: event.detail.value }) },
  changeCreateRole(event) { this.setData({ 'createForm.role': event.detail.value ? 'admin' : 'user' }) },
  async createUser() {
    try {
      await api.request('/api/admin/users', { method: 'POST', data: this.data.createForm })
      this.setData({ createOpen: false }); await this.loadUsers(); wx.showToast({ title: '用户已创建', icon: 'success' })
    } catch (error) { wx.showToast({ title: error.message || '创建失败', icon: 'none' }) }
  },
  openEdit() { this.setData({ editOpen: true }) },
  closeEdit() { this.setData({ editOpen: false }) },
  inputEdit(event) { this.setData({ [`editForm.${event.currentTarget.dataset.field}`]: event.detail.value }) },
  changeEditRole(event) { this.setData({ 'editForm.role': event.detail.value ? 'admin' : 'user' }) },
  changeEditStatus(event) { this.setData({ 'editForm.status': event.detail.value ? 'active' : 'disabled' }) },
  async saveUser() {
    try {
      const data = { ...this.data.editForm }
      if (!data.password) delete data.password
      await api.request(`/api/admin/users/${encodeURIComponent(this.data.detail.user.id)}`, { method: 'PATCH', data })
      this.setData({ editOpen: false }); await this.loadUsers(); await this.openDetail({ currentTarget: { dataset: { id: this.data.detail.user.id } } }); wx.showToast({ title: '已保存', icon: 'success' })
    } catch (error) { wx.showToast({ title: error.message || '保存失败', icon: 'none' }) }
  },
  async deleteUser() {
    const user = this.data.detail?.user
    if (!user) return
    const result = await new Promise((resolve) => wx.showModal({ title: '删除用户', content: `确定删除“${user.nickname}”及其全部数据吗？此操作不可恢复。`, confirmColor: '#ff806d', success: resolve }))
    if (!result.confirm) return
    try { await api.request(`/api/admin/users/${encodeURIComponent(user.id)}`, { method: 'DELETE' }); this.closeDetail(); await this.loadUsers(); wx.showToast({ title: '用户已删除', icon: 'success' }) }
    catch (error) { wx.showToast({ title: error.message || '删除失败', icon: 'none' }) }
  },
})
