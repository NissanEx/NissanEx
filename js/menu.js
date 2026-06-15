// Supabase functions tersedia via window._SB (diload oleh module script di head)
// Semua fungsi diakses sebagai: window._SB.getCurrentUser(), dll

// ============================
// GLOBAL STATE (memory only, no localStorage)
// ============================
let CURRENT_USER = null
let CURRENT_PROFILE = null

let categoriesCache = []
let contentsCache = []
let postsCache = []
let savesCache = []           // array of target_id strings
let linkwebsCache = []
let projectsCache = []

// ============================
// DATA LOADING (from Supabase)
// ============================

async function loadCategories() {
  if (!CURRENT_USER) return []
  try {
    const data = await window._SB.getCategories(CURRENT_USER.id)
    categoriesCache = data.map(c => ({
      id: c.id,
      name: c.title,
      slug: c.title?.toLowerCase(),
      icon: c.icon || 'fas fa-folder',
      iconUrl: c.file_url || ''
    }))
    if (categoriesCache.length === 0) {
      await seedDefaultCategories()
      return loadCategories()
    }
    return categoriesCache
  } catch(e) {
    console.warn('loadCategories error', e)
    categoriesCache = []
    return []
  }
}

async function loadContents() {
  if (!CURRENT_USER) return []
  try {
    const data = await window._SB.getContents(CURRENT_USER.id)
    contentsCache = data.map(c => ({
      id: c.id,
      userId: c.user_id,
      categoryId: c.category_id,
      title: c.name,
      description: c.description,
      authorName: c.users?.username || CURRENT_PROFILE?.username || '',
      authorAvatar: c.users?.avatar_url || CURRENT_PROFILE?.avatar_url || '',
      fileType: c.icon_type || 'doc',
      thumbUrl: c.preview_image || '',
      fileData: c.file_url || null,
      fileName: c.file_name || null,
      fileSize: c.file_size || null,
      webUrl: c.display_url || null,
      views: c.views || 0,
      likes: c.likes || 0,
      bookmarked: false,  // will be updated from savesCache
      createdAt: c.created_at,
      comments: c.comments || [],
      ratings: c.ratings || []
    }))
    // update bookmarked flag
    for (let c of contentsCache) {
      c.bookmarked = savesCache.includes(c.id)
    }
    return contentsCache
  } catch(e) {
    console.warn('loadContents error', e)
    contentsCache = []
    return []
  }
}

async function loadPosts() {
  try {
    const data = await window._SB.getPosts()
    postsCache = data.map(p => ({
      id: p.id,
      userId: p.user_id,
      userName: p.users?.username || 'Pengguna',
      userAvatar: p.users?.avatar_url || '',
      content: p.content,
      likes: p.likes_count || 0,
      comments: p.comments_count || 0,
      shares: p.shares_count || 0,
      createdAt: p.created_at
    }))
    return postsCache
  } catch(e) {
    console.warn('loadPosts error', e)
    postsCache = []
    return []
  }
}

async function loadSaves() {
  if (!CURRENT_USER) return []
  try {
    const data = await window._SB.getSaves(CURRENT_USER.id)
    savesCache = data.filter(s => s.target_type === 'content').map(s => s.target_id)
    // update bookmarked di contentsCache
    for (let c of contentsCache) {
      c.bookmarked = savesCache.includes(c.id)
    }
    return savesCache
  } catch(e) {
    console.warn('loadSaves error', e)
    savesCache = []
    return []
  }
}

async function loadLinkwebs() {
  if (!CURRENT_USER) return []
  try {
    // asumsikan ada window._SB.getRefs(userId)
    const data = await window._SB.getRefs(CURRENT_USER.id)
    linkwebsCache = data.map(l => ({
      id: l.id,
      userId: l.user_id,
      categoryId: l.category_id,
      title: l.theme,
      url: l.language,
      description: l.description || '',
      iconUrl: l.icon_url || '',
      status: l.status || 'active',
      bookmarked: false,
      createdAt: l.created_at
    }))
    return linkwebsCache
  } catch(e) {
    console.warn('loadLinkwebs error', e)
    linkwebsCache = []
    return []
  }
}

async function loadProjects() {
  if (!CURRENT_USER) return []
  try {
    const data = await window._SB.getProjects(CURRENT_USER.id)
    projectsCache = data.map(p => ({
      id: p.id,
      userId: p.user_id,
      name: p.name,
      description: p.description,
      deployUrl: p.deploy_url,
      techStack: p.tech_stack,
      status: p.status,
      visitCount: p.visit_count || 0,
      performanceScore: p.performance_score || 80,
      uptimePercent: p.uptime_percent || 99,
      lastDeployed: p.last_deployed,
      createdAt: p.created_at
    }))
    return projectsCache
  } catch(e) {
    console.warn('loadProjects error', e)
    projectsCache = []
    return []
  }
}

async function loadAllData() {
  if (!CURRENT_USER) return
  await Promise.all([
    loadCategories(),
    loadContents(),
    loadPosts(),
    loadSaves(),
    loadLinkwebs(),
    loadProjects()
  ])
}

// ============================
// SEED DEFAULT CATEGORIES
// ============================
async function seedDefaultCategories() {
  if (!CURRENT_USER) return
  const defaultCats = [
    { title: 'Tech', icon: 'fas fa-microchip', file_url: '' },
    { title: 'Politik', icon: 'fas fa-landmark', file_url: '' },
    { title: 'UI/UX', icon: 'fas fa-pen-nib', file_url: '' },
    { title: 'Cyber', icon: 'fas fa-shield-halved', file_url: '' },
    { title: 'Game', icon: 'fas fa-gamepad', file_url: '' }
  ]
  for (let cat of defaultCats) {
    try {
      await window._SB.addCategory(CURRENT_USER.id, cat)
    } catch(e) { console.warn(e) }
  }
}

// ============================
// INIT & AUTH
// ============================
async function init() {
  if (!window._SB_READY) {
    window._pendingInit = init
    return
  }

  ensureSBMethods()

  window._SB.onAuthChange(async (event, user) => {
    if (event === 'SIGNED_IN') {
      CURRENT_USER = user
      try { CURRENT_PROFILE = await window._SB.getProfile(user.id) } catch(e) { CURRENT_PROFILE = null }
      await loadAllData()
      updateSidebarUser()
      closeAuthModal()
      renderPage(getCurrentPage())
    } else if (event === 'SIGNED_OUT') {
      CURRENT_USER = null
      CURRENT_PROFILE = null
      categoriesCache = []
      contentsCache = []
      postsCache = []
      savesCache = []
      linkwebsCache = []
      projectsCache = []
      updateSidebarUser()
      renderBeranda()
    }
  })

  try {
    CURRENT_USER = await window._SB.getCurrentUser()
    if (CURRENT_USER) {
      CURRENT_PROFILE = await window._SB.getProfile(CURRENT_USER.id)
      await loadAllData()
    }
  } catch(e) {
    CURRENT_USER = null
  }

  updateSidebarUser()
  renderBeranda()
}

// ============================
// AUTH GUARD
// ============================
const AUTH_REQUIRED_PAGES = ['profil', 'disimpan', 'pengaturan']

function requireAuth(action) {
  if (CURRENT_USER) {
    action()
  } else {
    openAuthModal()
    toast('⚠️ Silakan login terlebih dahulu')
  }
}

function updateSidebarUser() {
  const el = document.getElementById('sidebar-user-info')
  if (!el) return
  if (CURRENT_USER && CURRENT_PROFILE) {
    const initial = (CURRENT_PROFILE.username || CURRENT_USER.email || 'U')[0].toUpperCase()
    const avatarHtml = CURRENT_PROFILE.avatar_url
      ? `<img src="${CURRENT_PROFILE.avatar_url}" class="w-9 h-9 rounded-xl object-cover">`
      : `<div class="w-9 h-9 rounded-xl bg-white text-black flex items-center justify-center font-bold text-sm">${initial}</div>`
    el.innerHTML = `
      <div class="flex items-center gap-3 px-3 py-2 rounded-xl bg-white/10">
        ${avatarHtml}
        <div class="flex-1 min-w-0">
          <p class="text-sm font-bold truncate">${CURRENT_PROFILE.username || 'User'}</p>
          <p class="text-xs text-gray-400 truncate">${CURRENT_USER.email}</p>
        </div>
      </div>
    `
  } else {
    el.innerHTML = `
      <button onclick="openAuthModal()" class="w-full flex items-center gap-3 px-3 py-2 rounded-xl bg-white/10 hover:bg-white/20 transition text-sm">
        <div class="w-9 h-9 rounded-xl bg-white/20 flex items-center justify-center">
          <i class="fas fa-user text-gray-400"></i>
        </div>
        <span class="text-gray-300">Login / Daftar</span>
      </button>
    `
  }
}

// ============================
// AUTH MODAL (unchanged)
// ============================
function openAuthModal(tab = 'login') {
  let modal = document.getElementById('modal-auth')
  if (!modal) {
    document.body.insertAdjacentHTML('beforeend', buildAuthModal())
    modal = document.getElementById('modal-auth')
  }
  modal.classList.add('open')
  document.body.style.overflow = 'hidden'
  switchAuthTab(tab)
}

function closeAuthModal() {
  const modal = document.getElementById('modal-auth')
  if (modal) { modal.classList.remove('open'); document.body.style.overflow = '' }
}

function switchAuthTab(tab) {
  const loginPanel = document.getElementById('auth-login-panel')
  const regPanel = document.getElementById('auth-reg-panel')
  const loginTab = document.getElementById('auth-tab-login')
  const regTab = document.getElementById('auth-tab-reg')
  if (!loginPanel) return
  loginPanel.classList.toggle('hidden', tab !== 'login')
  regPanel.classList.toggle('hidden', tab !== 'register')
  loginTab.classList.toggle('active-tab', tab === 'login')
  regTab.classList.toggle('active-tab', tab === 'register')
}

function buildAuthModal() {
  return `
  <div id="modal-auth" class="modal-backdrop" onclick="if(event.target.id==='modal-auth')closeAuthModal()">
    <div class="modal-box" style="max-width:420px">
      <button onclick="closeAuthModal()" class="absolute top-4 right-4 text-gray-400 hover:text-black"><i class="fas fa-times text-lg"></i></button>
      <div class="flex items-center gap-3 mb-6">
        <div class="w-9 h-9 bg-black rounded-xl flex items-center justify-center">
          <span class="text-white font-bold text-lg">N</span>
        </div>
        <h1 class="text-xl font-bold brand-lora">Nissan Ex</h1>
      </div>
      <div class="flex bg-gray-100 rounded-xl p-1 mb-6">
        <button id="auth-tab-login" onclick="switchAuthTab('login')" class="flex-1 py-2 rounded-lg text-sm font-bold transition active-tab">Masuk</button>
        <button id="auth-tab-reg" onclick="switchAuthTab('register')" class="flex-1 py-2 rounded-lg text-sm font-bold transition">Daftar</button>
      </div>
      <div id="auth-login-panel">
        <div class="space-y-4">
          <div><label class="form-label">Email</label><input id="auth-login-email" type="email" class="form-input" placeholder="email@kamu.com"></div>
          <div><label class="form-label">Password</label><div class="relative"><input id="auth-login-pass" type="password" class="form-input pr-10" placeholder="Password..."><button type="button" onclick="togglePassVis('auth-login-pass')" class="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400 hover:text-black"><i class="fas fa-eye text-sm"></i></button></div></div>
          <p id="auth-login-err" class="text-red-500 text-xs hidden"></p>
        </div>
        <button onclick="doLogin()" class="w-full bg-black text-white py-3 rounded-xl font-bold hover:bg-zinc-800 transition mt-5 flex items-center justify-center gap-2" id="btn-login"><i class="fas fa-sign-in-alt"></i> Masuk</button>
        <p class="text-center text-sm text-gray-500 mt-4">Belum punya akun? <button onclick="switchAuthTab('register')" class="font-bold text-black underline">Daftar sekarang</button></p>
      </div>
      <div id="auth-reg-panel" class="hidden">
        <div class="space-y-4">
          <div><label class="form-label">Username</label><input id="auth-reg-user" type="text" class="form-input" placeholder="username kamu..."></div>
          <div><label class="form-label">Email</label><input id="auth-reg-email" type="email" class="form-input" placeholder="email@kamu.com"></div>
          <div><label class="form-label">Password</label><div class="relative"><input id="auth-reg-pass" type="password" class="form-input pr-10" placeholder="Min. 6 karakter"><button type="button" onclick="togglePassVis('auth-reg-pass')" class="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400 hover:text-black"><i class="fas fa-eye text-sm"></i></button></div></div>
          <p id="auth-reg-err" class="text-red-500 text-xs hidden"></p>
        </div>
        <button onclick="doRegister()" class="w-full bg-black text-white py-3 rounded-xl font-bold hover:bg-zinc-800 transition mt-5 flex items-center justify-center gap-2" id="btn-register"><i class="fas fa-user-plus"></i> Buat Akun</button>
        <p class="text-center text-sm text-gray-500 mt-4">Sudah punya akun? <button onclick="switchAuthTab('login')" class="font-bold text-black underline">Masuk</button></p>
      </div>
    </div>
  </div>`
}

function togglePassVis(inputId) {
  const inp = document.getElementById(inputId)
  inp.type = inp.type === 'password' ? 'text' : 'password'
}

async function doLogin() {
  const email = document.getElementById('auth-login-email').value.trim()
  const pass = document.getElementById('auth-login-pass').value
  const errEl = document.getElementById('auth-login-err')
  const btn = document.getElementById('btn-login')
  errEl.classList.add('hidden')
  if (!email || !pass) { errEl.textContent = 'Email dan password wajib diisi.'; errEl.classList.remove('hidden'); return }
  btn.disabled = true; btn.innerHTML = '<i class="fas fa-spinner fa-spin"></i> Memproses...'
  try {
    await window._SB.signIn(email, pass)
  } catch(e) {
    errEl.textContent = e.message === 'Invalid login credentials' ? 'Email atau password salah.' : e.message
    errEl.classList.remove('hidden')
    btn.disabled = false; btn.innerHTML = '<i class="fas fa-sign-in-alt"></i> Masuk'
  }
}

async function doRegister() {
  const username = document.getElementById('auth-reg-user').value.trim()
  const email = document.getElementById('auth-reg-email').value.trim()
  const pass = document.getElementById('auth-reg-pass').value
  const errEl = document.getElementById('auth-reg-err')
  const btn = document.getElementById('btn-register')
  errEl.classList.add('hidden')
  if (!username || !email || !pass) { errEl.textContent = 'Semua field wajib diisi.'; errEl.classList.remove('hidden'); return }
  if (pass.length < 6) { errEl.textContent = 'Password minimal 6 karakter.'; errEl.classList.remove('hidden'); return }
  btn.disabled = true; btn.innerHTML = '<i class="fas fa-spinner fa-spin"></i> Mendaftar...'
  try {
    const result = await window._SB.signUp(email, pass, username)
    const user = result?.user ?? result
    if (user && !user.email_confirmed_at && user.confirmed_at === null) {
      toast('✅ Cek email kamu untuk konfirmasi akun!')
      closeAuthModal()
    }
  } catch(e) {
    errEl.textContent = e.message || 'Terjadi kesalahan saat mendaftar'
    errEl.classList.remove('hidden')
    btn.disabled = false; btn.innerHTML = '<i class="fas fa-user-plus"></i> Buat Akun'
  }
}

async function logout() {
  if (!CURRENT_USER) return
  try {
    await window._SB.signOut()
    toast('👋 Berhasil keluar')
  } catch(e) {
    toast('⚠️ Gagal logout: ' + e.message)
  }
}

// ============================
// TEMP FILE STORAGE (memory only)
// ============================
let tempFiles = { main: null, thumb: null, thumbFile: null, linkIcon: null }

// ============================
// NAVIGATION
// ============================
function navigateTo(pageId) {
  if (AUTH_REQUIRED_PAGES.includes(pageId) && !CURRENT_USER) {
    openAuthModal()
    toast('⚠️ Login dulu untuk mengakses halaman ini')
    return
  }
  document.querySelectorAll('.page-content').forEach(p => p.classList.remove('active'))
  const target = document.getElementById('page-'+pageId)
  if (target) target.classList.add('active')
  document.querySelectorAll('.nav-link').forEach(l => {
    l.classList.remove('active')
    if (l.dataset.page === pageId) l.classList.add('active')
  })
  if (window.innerWidth < 1024) {
    document.getElementById('sidebar').classList.add('-translate-x-full')
    document.getElementById('overlay').classList.add('hidden')
  }
  window.scrollTo({top:0,behavior:'smooth'})
  renderPage(pageId)
}

function renderPage(pageId) {
  const map = {
    beranda: renderBeranda,
    kategori: renderKategori,
    tren: renderTren,
    disimpan: renderDisimpan,
    diskusi: renderDiskusi,
    analyst: renderAnalyst,
    profil: renderProfil,
    pengaturan: renderPengaturan,
  }
  if (map[pageId]) map[pageId]()
}

function toggleSidebar() {
  const sb = document.getElementById('sidebar')
  const ov = document.getElementById('overlay')
  sb.classList.toggle('-translate-x-full')
  ov.classList.toggle('hidden')
}

// ============================
// RENDER FUNCTIONS (use caches)
// ============================

const CAT_SVG = {
  'cat-tech': `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round" class="w-10 h-10"><rect x="2" y="3" width="20" height="14" rx="2"/><path d="M8 21h8M12 17v4"/><path d="M6 8h.01M10 8h4"/></svg>`,
  'cat-politik': `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round" class="w-10 h-10"><path d="M3 21h18M3 10h18M5 6l7-3 7 3M4 10v11M20 10v11M8 10v5M12 10v5M16 10v5"/></svg>`,
  'cat-uiux': `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round" class="w-10 h-10"><rect x="3" y="3" width="18" height="18" rx="3"/><path d="M3 9h18M9 21V9"/></svg>`,
  'cat-cyber': `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round" class="w-10 h-10"><path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z"/><path d="M9 12l2 2 4-4"/></svg>`,
  'cat-game': `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round" class="w-10 h-10"><rect x="2" y="6" width="20" height="12" rx="4"/><path d="M6 12h4M8 10v4M15 11h.01M17 13h.01"/></svg>`,
}

function getCatSvg(cat) {
  if (CAT_SVG[cat.id]) return CAT_SVG[cat.id]
  return `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round" class="w-10 h-10"><rect x="3" y="3" width="18" height="18" rx="3"/><path d="M3 9h18"/></svg>`
}

const CAT_GRADIENT = {
  'cat-tech': 'from-blue-600 to-blue-900',
  'cat-politik': 'from-red-600 to-red-900',
  'cat-uiux': 'from-purple-600 to-purple-900',
  'cat-cyber': 'from-emerald-600 to-emerald-900',
  'cat-game': 'from-orange-500 to-orange-900',
}

function renderBeranda() {
  const cats = categoriesCache.length ? categoriesCache : []
  const iconGrid = document.getElementById('category-icons')
  iconGrid.innerHTML = cats.map(c => {
    const grad = CAT_GRADIENT[c.id] || 'from-zinc-700 to-zinc-900'
    return `
    <div onclick="navigateTo('kategori')"
      class="cursor-pointer rounded-2xl bg-gradient-to-br ${grad} shadow-lg hover:scale-105 hover:shadow-xl active:scale-95 transition-all select-none overflow-hidden"
      style="min-height:120px;">
      <div class="flex flex-col items-center justify-center gap-3 w-full h-full p-4 text-white" style="min-height:120px;">
        ${c.iconUrl ? `<img src="${c.iconUrl}" class="w-10 h-10 object-cover rounded-xl">` : (c.icon && c.icon.startsWith('fas') ? `<i class="${c.icon} text-3xl"></i>` : getCatSvg(c))}
        <span class="text-sm font-bold tracking-wide drop-shadow">${c.name}</span>
      </div>
    </div>`
  }).join('')

  const grid = document.getElementById('beranda-content-grid')
  if (!contentsCache.length) {
    grid.innerHTML = `<div class="col-span-6 text-center py-12 text-gray-400"><i class="fas fa-folder-open text-4xl mb-3 block text-gray-200"></i><p>Belum ada konten. Upload pertama Anda!</p></div>`
    return
  }
  grid.innerHTML = contentsCache.slice(0,6).map(c => contentCard(c)).join('')
}

function contentCard(c) {
  const fileIconsMap = {image:'fas fa-image',video:'fas fa-video',pdf:'fas fa-file-pdf',doc:'fas fa-file-word',docx:'fas fa-file-word'}
  const fileIcon = fileIconsMap[c.fileType] || 'fas fa-file'
  return `
    <div>
      <div class="content-card group cursor-pointer" onclick="showContentDetail('${c.id}')" onmouseenter="showCardDesc(this)" onmouseleave="hideCardDesc(this)">
        <div class="content-thumb bg-zinc-900 relative">
          ${c.thumbUrl ? `<img src="${c.thumbUrl}" class="w-full h-full object-cover absolute inset-0">` : ''}
          <div class="absolute inset-0 flex items-center justify-center">
            <i class="${fileIcon} text-3xl ${c.thumbUrl?'opacity-0 group-hover:opacity-60':'opacity-40'} transition text-white"></i>
          </div>
          <div class="absolute inset-0 bg-black/0 group-hover:bg-black/40 transition flex items-center justify-center">
            <i class="fas fa-eye text-white opacity-0 group-hover:opacity-100 transition text-3xl"></i>
          </div>
          <button onclick="event.stopPropagation();toggleBookmark('${c.id}')" class="absolute top-2 right-2 w-8 h-8 rounded-lg bg-black/50 flex items-center justify-center text-white text-sm hover:bg-black transition">
            <i class="${c.bookmarked?'fas':'far'} fa-bookmark"></i>
          </button>
        </div>
        <div class="content-desc-overlay">
          <p>${c.description || 'Tidak ada deskripsi'}</p>
        </div>
      </div>
      <div class="content-info">
        <h3 title="${c.title}">${c.title}</h3>
        <div class="flex items-center gap-1.5 mt-1">
          ${avatarEl(c.authorName, c.authorAvatar, 'w-4 h-4', 'rounded-full')}
          <span class="text-xs text-gray-400 truncate">${c.authorName || 'Unknown'}</span>
        </div>
        <p>${c.views} views · ${c.likes} suka</p>
      </div>
    </div>
  `
}

function renderKategori() {
  const cats = categoriesCache
  const pills = document.getElementById('cat-filter-pills')
  let activeCat = null

  function renderPills(selected) {
    activeCat = selected
    pills.innerHTML = `
      <button onclick="filterKategori(null)" class="px-4 py-2 rounded-full text-sm font-bold border-2 transition ${!selected?'bg-black text-white border-black':'border-gray-300 text-gray-600 hover:border-black'}">
        Semua
      </button>
      ${cats.map(c=>`
        <button onclick="filterKategori('${c.id}')" class="px-4 py-2 rounded-full text-sm font-bold border-2 transition flex items-center gap-2 ${selected===c.id?'bg-black text-white border-black':'border-gray-300 text-gray-600 hover:border-black'}">
          ${c.iconUrl ? `<img src="${c.iconUrl}" class="w-4 h-4 rounded">` : `<i class="${c.icon}"></i>`}
          ${c.name}
        </button>
      `).join('')}
    `
  }

  window.filterKategori = function(catId) {
    renderPills(catId)
    const filteredContents = contentsCache.filter(c => !catId || c.categoryId === catId)
    const filteredLinks = linkwebsCache.filter(l => !catId || l.categoryId === catId)
    const label = catId ? cats.find(c=>c.id===catId)?.name : 'Semua'
    document.getElementById('cat-result-label').textContent = label+' — Konten'
    document.getElementById('kategori-content-grid').innerHTML = filteredContents.length
      ? filteredContents.map(c=>contentCard(c)).join('')
      : `<div class="col-span-4 text-gray-400 py-8 text-sm">Belum ada konten di kategori ini.</div>`
    document.getElementById('kategori-links-grid').innerHTML = filteredLinks.length
      ? `<p class="col-span-2 text-sm font-bold text-gray-500 uppercase tracking-wider mb-2">Link Web</p>`+filteredLinks.map(l=>linkCard(l)).join('')
      : ''
  }

  renderPills(null)
  window.filterKategori(null)
}

function linkCard(l) {
  const statusBadge = {active:'badge-green',development:'badge-yellow',archived:'badge-blue'}[l.status]||'badge-blue'
  const statusLabel = {active:'Live',development:'Dev',archived:'Arsip'}[l.status]||l.status
  return `
    <div class="link-card" onclick="window.open('${l.url}','_blank')">
      <div class="link-icon">
        ${l.iconUrl ? `<img src="${l.iconUrl}" class="w-full h-full object-cover rounded-xl">` : `<i class="fas fa-globe text-gray-400"></i>`}
      </div>
      <div class="flex-1 min-w-0">
        <div class="flex items-center gap-2 mb-0.5">
          <p class="font-bold text-black text-sm truncate">${l.title}</p>
          <span class="badge ${statusBadge} flex-shrink-0">${statusLabel}</span>
        </div>
        <p class="text-xs text-gray-400 truncate">${l.url}</p>
        ${l.description ? `<p class="text-xs text-gray-600 mt-1 line-clamp-1">${l.description}</p>` : ''}
      </div>
      <i class="fas fa-external-link-alt text-gray-300 text-sm flex-shrink-0"></i>
    </div>
  `
}

function renderTren() {
  const sorted = [...contentsCache].sort((a,b)=>b.views - a.views)
  const el = document.getElementById('tren-list')
  if (!sorted.length) {
    el.innerHTML = `<div class="text-center py-16 text-gray-400"><i class="fas fa-chart-line text-5xl mb-3 block text-gray-200"></i><p>Belum ada konten trending.</p></div>`
    return
  }
  el.innerHTML = sorted.map((c,i) => `
    <div class="bg-white rounded-2xl border border-gray-100 p-5 flex gap-5 items-center hover:shadow-md transition cursor-pointer" onclick="showContentDetail('${c.id}')">
      <span class="rank-num w-8 text-center">${i+1}</span>
      <div class="w-14 h-14 rounded-xl bg-zinc-900 flex items-center justify-center flex-shrink-0 overflow-hidden">
        ${c.thumbUrl ? `<img src="${c.thumbUrl}" class="w-full h-full object-cover">` : `<i class="fas fa-file text-gray-600"></i>`}
      </div>
      <div class="flex-1 min-w-0">
        <p class="font-bold text-black truncate">${c.title}</p>
        <p class="text-sm text-gray-500 mt-0.5">${c.description||''}</p>
        <div class="flex gap-4 mt-2 text-xs text-gray-400">
          <span><i class="fas fa-eye mr-1"></i>${c.views}</span>
          <span><i class="fas fa-heart mr-1"></i>${c.likes}</span>
        </div>
      </div>
      <button onclick="event.stopPropagation();toggleBookmark('${c.id}')" class="text-gray-300 hover:text-black transition">
        <i class="${c.bookmarked?'fas text-black':'far'} fa-bookmark text-lg"></i>
      </button>
    </div>
  `).join('')
}

function renderDisimpan() {
  const savedContents = contentsCache.filter(c => c.bookmarked)
  const savedLinks = linkwebsCache.filter(l => l.bookmarked)
  const grid = document.getElementById('disimpan-grid')
  const empty = document.getElementById('disimpan-empty')
  const all = [...savedContents, ...savedLinks]
  if (!all.length) { grid.innerHTML=''; empty.classList.remove('hidden'); return; }
  empty.classList.add('hidden')
  grid.innerHTML = [
    ...savedContents.map(c=>contentCard(c)),
    ...savedLinks.map(l=>`<div class="col-span-1">${linkCard(l)}</div>`)
  ].join('')
}

function renderDiskusi() {
  const list = document.getElementById('diskusi-list')
  const empty = document.getElementById('diskusi-empty')
  if (!postsCache.length) { list.innerHTML=''; empty.classList.remove('hidden'); return; }
  empty.classList.add('hidden')
  list.innerHTML = postsCache.map(p => {
    const isOwner = CURRENT_USER && p.userId === CURRENT_USER.id
    return `
    <div class="post-item" id="post-${p.id}">
      <div class="flex gap-4 mb-3">
        ${avatarEl(p.userName, p.userAvatar)}
        <div class="flex-1">
          <p class="font-bold text-black">${p.userName}</p>
          <p class="text-xs text-gray-400">${timeAgo(p.createdAt)}</p>
        </div>
        ${isOwner ? `
        <div class="relative" id="menu-wrap-${p.id}">
          <button onclick="togglePostMenu('${p.id}')" class="w-8 h-8 flex items-center justify-center rounded-full hover:bg-gray-100 text-gray-400 hover:text-black transition">
            <i class="fas fa-ellipsis-h"></i>
          </button>
          <div id="post-menu-${p.id}" class="hidden absolute right-0 top-9 z-50 bg-white border border-gray-100 rounded-2xl shadow-xl py-2 min-w-[140px]">
            <button onclick="openEditPost('${p.id}');togglePostMenu('${p.id}')" class="w-full flex items-center gap-2 px-4 py-2.5 text-sm hover:bg-gray-50 text-black font-medium">
              <i class="fas fa-pen w-4 text-center text-blue-500"></i> Edit Post
            </button>
            <button onclick="deletePost('${p.id}')" class="w-full flex items-center gap-2 px-4 py-2.5 text-sm hover:bg-red-50 text-red-500 font-medium">
              <i class="fas fa-trash w-4 text-center"></i> Hapus
            </button>
          </div>
        </div>` : ''}
      </div>
      <p class="text-gray-700 mb-4 leading-relaxed text-sm pl-14" id="post-content-${p.id}">${p.content}</p>
      <div class="flex gap-4 text-sm text-gray-500 pl-14">
        <button onclick="likePost('${p.id}')" class="flex items-center gap-1.5 hover:text-red-500 transition">
          <i class="fas fa-heart"></i><span>${p.likes}</span>
        </button>
        <button class="flex items-center gap-1.5 hover:text-black transition">
          <i class="fas fa-comment"></i><span>${p.comments}</span>
        </button>
        <button class="flex items-center gap-1.5 hover:text-black transition">
          <i class="fas fa-share"></i><span>${p.shares}</span>
        </button>
      </div>
    </div>
  `}).join('')
  document.addEventListener('click', closeAllPostMenus, { once: true })
}

function renderAnalyst() {
  const list = document.getElementById('projects-list')
  const perfList = document.getElementById('perf-list')
  if (!projectsCache.length) {
    list.innerHTML = `<p class="text-gray-400 text-sm py-4 text-center">Belum ada project. Tambah yang pertama!</p>`
    perfList.innerHTML = ''
  } else {
    list.innerHTML = projectsCache.map(p => {
      const s = {live:'badge-green',development:'badge-yellow',archived:'badge-blue'}[p.status]||'badge-blue'
      const sl = {live:'✓ Live',development:'⏳ Dev',archived:'Arsip'}[p.status]||p.status
      return `
        <div class="border border-gray-200 rounded-xl p-4 hover:bg-gray-50 transition">
          <div class="flex items-start justify-between mb-1">
            <div>
              <p class="font-bold text-black">${p.name}</p>
              <p class="text-sm text-gray-500">${p.description}</p>
            </div>
            <span class="badge ${s}">${sl}</span>
          </div>
          <p class="text-xs text-gray-400 mb-3">${p.techStack||''}</p>
          <div class="flex gap-2">
            ${p.deployUrl ? `<a href="${p.deployUrl}" target="_blank" class="text-xs bg-black text-white px-3 py-1.5 rounded-lg hover:bg-zinc-800 transition font-bold">Lihat</a>` : ''}
            <button onclick="deleteProject('${p.id}')" class="text-xs border border-red-200 text-red-500 px-3 py-1.5 rounded-lg hover:bg-red-50 transition font-bold">Hapus</button>
          </div>
        </div>
      `
    }).join('')
    perfList.innerHTML = projectsCache.map(p => `
      <div>
        <div class="flex justify-between mb-1.5">
          <p class="text-sm font-bold text-black">${p.name}</p>
          <p class="text-sm font-bold text-black">${p.performanceScore}%</p>
        </div>
        <div class="progress"><div class="progress-bar" style="width:${p.performanceScore}%"></div></div>
      </div>
    `).join('')
  }

  const live = projectsCache.filter(p=>p.status==='live')
  const dev = projectsCache.filter(p=>p.status==='development')
  document.getElementById('stat-total').textContent = projectsCache.length
  document.getElementById('stat-live').textContent = live.length
  document.getElementById('stat-dev').textContent = dev.length
  document.getElementById('stat-visits').textContent = projectsCache.reduce((a,p)=>a+p.visitCount,0).toLocaleString()
  const avgPerf = projectsCache.length ? Math.round(projectsCache.reduce((a,p)=>a+p.performanceScore,0)/projectsCache.length) : 0
  const avgUptime = live.length ? (live.reduce((a,p)=>a+p.uptimePercent,0)/live.length).toFixed(0)+'%' : '—'
  document.getElementById('stat-avgperf').textContent = projectsCache.length ? avgPerf+'%' : '—'
  document.getElementById('stat-uptime').textContent = avgUptime
}

function renderProfil() {
  // Guard: jika belum login, jangan render dan beri pesan
  if (!CURRENT_USER) {
    console.log('renderProfil: User belum login');
    
    // Sembunyikan elemen yang membutuhkan auth atau tampilkan placeholder
    const profilContainer = document.getElementById('page-profil');
    if (profilContainer) {
      // Tampilkan pesan di grid konten
      const kontenGrid = document.getElementById('profil-konten-grid');
      if (kontenGrid) {
        kontenGrid.innerHTML = `
          <div class="col-span-full text-center py-20">
            <i class="fas fa-lock text-5xl text-gray-300 mb-4"></i>
            <p class="text-gray-500 font-medium">Silakan login untuk melihat profil Anda</p>
            <button onclick="openAuthModal()" class="mt-4 bg-black text-white px-6 py-2.5 rounded-xl font-bold hover:bg-zinc-800 transition">
              Login Sekarang
            </button>
          </div>
        `;
      }
      
      // Sembunyikan panel diskusi
      const diskusiPanel = document.getElementById('profil-panel-diskusi');
      if (diskusiPanel) diskusiPanel.classList.add('hidden');
      
      // Sembunyikan tombol upload/edit
      const actionButtons = document.querySelectorAll('.flex.gap-2.flex-wrap button');
      actionButtons.forEach(btn => {
        if (btn.textContent.includes('Upload') || btn.textContent.includes('Edit')) {
          btn.style.display = 'none';
        }
      });
    }
    return;
  }
  
  // Jika login, pastikan profile data tersedia
  if (!CURRENT_PROFILE) {
    console.log('renderProfil: Menunggu profile data...');
    // Tunggu sebentar lalu coba lagi
    setTimeout(() => {
      if (CURRENT_PROFILE) renderProfil();
      else toast('⚠️ Gagal memuat data profil');
    }, 500);
    return;
  }
  
  // Data profile (gunakan CURRENT_PROFILE langsung)
  const profile = {
    name: CURRENT_PROFILE.username || 'Pengguna',
    username: CURRENT_PROFILE.username || 'pengguna',
    bio: CURRENT_PROFILE.bio || '',
    location: CURRENT_PROFILE.location || '',
    occupation: CURRENT_PROFILE.occupation || '',
    techStack: CURRENT_PROFILE.tech_stack || '',
    interests: CURRENT_PROFILE.interests || '',
    avatarUrl: CURRENT_PROFILE.avatar_url || '',
    coverUrl: CURRENT_PROFILE.cover_url || '',
    followers: CURRENT_PROFILE.followers_count || 0,
    following: CURRENT_PROFILE.following_count || 0
  };
  
  // Filter konten milik user
  const myContents = contentsCache.filter(c => c.userId === CURRENT_USER.id);
  const myDiscussions = postsCache.filter(d => d.userId === CURRENT_USER.id);
  
  // Update DOM dengan pengecekan element exist
  const nameEl = document.getElementById('profil-name');
  if (nameEl) nameEl.textContent = profile.name;
  
  const usernameEl = document.getElementById('profil-username');
  if (usernameEl) usernameEl.textContent = '@' + profile.username;
  
  const bioEl = document.getElementById('profil-bio');
  if (bioEl) bioEl.textContent = profile.bio || 'Tidak ada bio';
  
  const locationEl = document.getElementById('info-location');
  if (locationEl) locationEl.textContent = profile.location || 'Tidak diisi';
  
  const occupationEl = document.getElementById('info-occupation');
  if (occupationEl) occupationEl.textContent = profile.occupation || 'Tidak diisi';
  
  const techStackEl = document.getElementById('info-techstack');
  if (techStackEl) techStackEl.textContent = profile.techStack || 'Tidak diisi';
  
  const interestsEl = document.getElementById('info-interests');
  if (interestsEl) interestsEl.textContent = profile.interests || 'Tidak diisi';
  
  // Avatar handling
  const avatarImg = document.getElementById('avatar-img');
  const avatarInitial = document.getElementById('avatar-initial');
  
  if (profile.avatarUrl && avatarImg && avatarInitial) {
    avatarImg.src = profile.avatarUrl;
    avatarImg.classList.remove('hidden');
    avatarInitial.classList.add('hidden');
  } else if (avatarInitial) {
    avatarInitial.textContent = (profile.name || 'U')[0].toUpperCase();
    if (avatarImg) avatarImg.classList.add('hidden');
    avatarInitial.classList.remove('hidden');
  }
  
  // Cover image
  const coverImg = document.getElementById('cover-img');
  if (coverImg && profile.coverUrl) {
    coverImg.src = profile.coverUrl;
    coverImg.classList.remove('hidden');
  } else if (coverImg) {
    coverImg.classList.add('hidden');
  }
  
  // Update statistik
  const followersEl = document.getElementById('stat-followers');
  if (followersEl) followersEl.textContent = profile.followers;
  
  const followingEl = document.getElementById('stat-following');
  if (followingEl) followingEl.textContent = profile.following;
  
  const postsEl = document.getElementById('stat-posts');
  if (postsEl) postsEl.textContent = myContents.length;
  
  const likesEl = document.getElementById('stat-likes-total');
  if (likesEl) likesEl.textContent = myContents.reduce((a,c) => a + (c.likes || 0), 0);
  
  const commentsEl = document.getElementById('stat-comments');
  if (commentsEl) commentsEl.textContent = myDiscussions.reduce((a,d) => a + (d.comments || 0), 0);
  
  const sharesEl = document.getElementById('stat-shares');
  if (sharesEl) sharesEl.textContent = myDiscussions.reduce((a,d) => a + (d.shares || 0), 0);
  
  // Tampilkan tombol aksi
  const actionButtons = document.querySelectorAll('.flex.gap-2.flex-wrap button');
  actionButtons.forEach(btn => {
    btn.style.display = 'inline-flex';
  });
  
  // Render komponen turunan
  renderRecentUploads();
  renderProfilKonten();
  renderProfilDiskusi();
}

function renderProfilKonten() {
  const grid = document.getElementById('profil-konten-grid')
  if (!grid) return
  const myContents = contentsCache.filter(c => c.userId === CURRENT_USER?.id)
  if (!myContents.length) {
    grid.innerHTML = `
      <div class="col-span-4 text-center py-16 text-gray-400">
        <i class="fas fa-cloud-upload-alt text-5xl mb-4 block text-gray-200"></i>
        <p class="font-bold text-lg">Belum ada konten</p>
        <p class="text-sm mt-1">Upload konten pertamamu!</p>
        <button onclick="openUploadModal()" class="mt-4 bg-black text-white px-6 py-2.5 rounded-xl font-bold text-sm hover:bg-zinc-800 transition">
          <i class="fas fa-upload mr-2"></i>Upload Sekarang
        </button>
      </div>`
    return
  }
  const fileIconsMap = {image:'fas fa-image',video:'fas fa-video',pdf:'fas fa-file-pdf',doc:'fas fa-file-word',docx:'fas fa-file-word'}
  grid.innerHTML = myContents.map(c => {
    const icon = fileIconsMap[c.fileType] || 'fas fa-file'
    return `
      <div class="group relative rounded-2xl overflow-hidden border border-gray-100 shadow-sm hover:shadow-lg transition bg-white">
        <div class="aspect-[4/3] bg-zinc-100 relative overflow-hidden cursor-pointer" onclick="showContentDetail('${c.id}')">
          ${c.thumbUrl ? `<img src="${c.thumbUrl}" class="w-full h-full object-cover group-hover:scale-105 transition duration-300">` : `<div class="w-full h-full flex items-center justify-center"><i class="${icon} text-4xl text-gray-300"></i></div>`}
          <div class="absolute inset-0 bg-black/0 group-hover:bg-black/30 transition flex items-center justify-center">
            <i class="fas fa-eye text-white opacity-0 group-hover:opacity-100 transition text-2xl"></i>
          </div>
          <div class="absolute top-2 right-2 opacity-0 group-hover:opacity-100 transition" onclick="event.stopPropagation()">
            <div class="relative" id="content-menu-wrap-${c.id}">
              <button onclick="toggleContentMenu('${c.id}')" class="w-8 h-8 rounded-full bg-black/60 hover:bg-black flex items-center justify-center text-white text-xs">
                <i class="fas fa-ellipsis-v"></i>
              </button>
              <div id="content-menu-${c.id}" class="hidden absolute right-0 top-9 z-50 bg-white border border-gray-100 rounded-2xl shadow-xl py-2 min-w-[150px]">
                <button onclick="openEditKonten('${c.id}');toggleContentMenu('${c.id}')" class="w-full flex items-center gap-2 px-4 py-2.5 text-sm hover:bg-gray-50 text-black font-medium">
                  <i class="fas fa-pen w-4 text-center text-blue-500"></i> Edit Konten
                </button>
                <button onclick="deleteKonten('${c.id}')" class="w-full flex items-center gap-2 px-4 py-2.5 text-sm hover:bg-red-50 text-red-500 font-medium">
                  <i class="fas fa-trash w-4 text-center"></i> Hapus
                </button>
              </div>
            </div>
          </div>
        </div>
        <div class="p-3">
          <h3 class="font-bold text-black text-sm truncate mb-1" title="${c.title}">${c.title}</h3>
          <p class="text-xs text-gray-400 truncate mb-2">${c.description || 'Tidak ada deskripsi'}</p>
          <div class="flex items-center justify-between text-xs text-gray-400">
            <span><i class="fas fa-eye mr-1"></i>${c.views}</span>
            <span><i class="fas fa-heart mr-1 text-red-400"></i>${c.likes}</span>
            <span class="uppercase bg-gray-100 px-2 py-0.5 rounded-full font-medium">${c.fileType||'file'}</span>
          </div>
        </div>
      </div>`
  }).join('')
}

function renderProfilDiskusi() {
  const actEl = document.getElementById('profil-activity')
  if (!actEl) return
  const myDiscussions = postsCache.filter(d => d.userId === CURRENT_USER?.id)
  if (!myDiscussions.length) {
    actEl.innerHTML = `<p class="text-gray-400 text-sm py-6 text-center">Belum ada diskusi.</p>`
    return
  }
  actEl.innerHTML = myDiscussions.map(d => `
    <div class="post-item" id="post-${d.id}">
      <div class="flex gap-4 mb-3">
        ${avatarEl(d.userName, d.userAvatar)}
        <div class="flex-1">
          <p class="font-bold text-black">${d.userName}</p>
          <p class="text-xs text-gray-400">${timeAgo(d.createdAt)}</p>
        </div>
        <div class="relative" id="menu-wrap-${d.id}">
          <button onclick="togglePostMenu('${d.id}')" class="w-8 h-8 flex items-center justify-center rounded-full hover:bg-gray-100 text-gray-400 hover:text-black transition">
            <i class="fas fa-ellipsis-h"></i>
          </button>
          <div id="post-menu-${d.id}" class="hidden absolute right-0 top-9 z-50 bg-white border border-gray-100 rounded-2xl shadow-xl py-2 min-w-[140px]">
            <button onclick="openEditPost('${d.id}');togglePostMenu('${d.id}')" class="w-full flex items-center gap-2 px-4 py-2.5 text-sm hover:bg-gray-50 text-black font-medium">
              <i class="fas fa-pen w-4 text-center text-blue-500"></i> Edit Post
            </button>
            <button onclick="deletePost('${d.id}')" class="w-full flex items-center gap-2 px-4 py-2.5 text-sm hover:bg-red-50 text-red-500 font-medium">
              <i class="fas fa-trash w-4 text-center"></i> Hapus
            </button>
          </div>
        </div>
      </div>
      <p class="text-gray-700 mb-3 leading-relaxed text-sm pl-14" id="post-content-${d.id}">${d.content}</p>
      <div class="flex gap-4 text-sm text-gray-500 pl-14">
        <span><i class="fas fa-heart mr-1"></i>${d.likes}</span>
        <span><i class="fas fa-comment mr-1"></i>${d.comments}</span>
        <span><i class="fas fa-share mr-1"></i>${d.shares}</span>
      </div>
    </div>
  `).join('')
}

function switchProfilTab(tab) {
  const kontenPanel = document.getElementById('profil-panel-konten')
  const diskusiPanel = document.getElementById('profil-panel-diskusi')
  const kontenBtn = document.getElementById('profil-tab-konten')
  const diskusiBtn = document.getElementById('profil-tab-diskusi')
  if (tab === 'konten') {
    kontenPanel.classList.remove('hidden')
    diskusiPanel.classList.add('hidden')
    kontenBtn.classList.add('text-black', 'border-black')
    kontenBtn.classList.remove('text-gray-400', 'border-transparent')
    diskusiBtn.classList.remove('text-black', 'border-black')
    diskusiBtn.classList.add('text-gray-400', 'border-transparent')
  } else {
    diskusiPanel.classList.remove('hidden')
    kontenPanel.classList.add('hidden')
    diskusiBtn.classList.add('text-black', 'border-black')
    diskusiBtn.classList.remove('text-gray-400', 'border-transparent')
    kontenBtn.classList.remove('text-black', 'border-black')
    kontenBtn.classList.add('text-gray-400', 'border-transparent')
  }
}

function renderRecentUploads() {
  const recentContents = contentsCache.slice(0,3)
  const recentLinks = linkwebsCache.slice(0,2)
  const el = document.getElementById('recent-uploads')
  const fileIconsMap = {image:'fas fa-file-image text-orange-400',video:'fas fa-file-video text-purple-400',pdf:'fas fa-file-pdf text-red-400',doc:'fas fa-file-word text-blue-400'}
  const all = [
    ...recentContents.map(c=>({icon:fileIconsMap[c.fileType]||'fas fa-file text-gray-400',name:c.title,size:c.fileType?.toUpperCase()||'FILE',type:'content'})),
    ...recentLinks.map(l=>({icon:'fas fa-link text-green-500',name:l.title,size:'LINK',type:'link'})),
  ].slice(0,4)
  if (!all.length) { el.innerHTML = `<p class="text-xs text-gray-400">Belum ada upload</p>`; return; }
  el.innerHTML = all.map(f=>`
    <div class="flex items-center gap-2 p-2 hover:bg-gray-50 rounded-lg">
      <i class="${f.icon} w-5 text-center"></i>
      <p class="text-xs text-gray-700 flex-1 truncate">${f.name}</p>
      <span class="text-xs text-gray-400 flex-shrink-0">${f.size}</span>
    </div>
  `).join('')
}

function renderPengaturan() {
  const dbStats = document.getElementById('db-stats')
  dbStats.innerHTML = [
    ['Konten Upload', contentsCache.length, 'fas fa-file-alt text-blue-500'],
    ['Link Web', linkwebsCache.length, 'fas fa-link text-green-500'],
    ['Projects', projectsCache.length, 'fas fa-rocket text-purple-500'],
    ['Diskusi', postsCache.length, 'fas fa-comments text-yellow-500'],
    ['Kategori', categoriesCache.length, 'fas fa-th-large text-gray-500'],
  ].map(([label,count,icon])=>`
    <div class="flex items-center justify-between p-3 bg-gray-50 rounded-xl">
      <div class="flex items-center gap-3">
        <i class="${icon}"></i>
        <span class="text-sm font-bold">${label}</span>
      </div>
      <span class="font-bold text-black">${count}</span>
    </div>
  `).join('')
}

// ============================
// ACTIONS (direct to Supabase, then reload)
// ============================

async function toggleBookmark(contentId) {
  if (!CURRENT_USER) { openAuthModal(); toast('⚠️ Login dulu untuk menyimpan konten'); return }
  const saved = await window._SB.toggleSave(CURRENT_USER.id, contentId, 'content')
  await loadSaves()   // refresh savesCache and update bookmarked flags
  renderPage(getCurrentPage())
  toast(saved ? '🔖 Disimpan ke koleksi' : 'Dihapus dari koleksi')
}

async function likePost(postId) {
  try {
    await window._SB.likePost(postId, CURRENT_USER.id)
    await loadPosts()
    renderDiskusi()
  } catch(e) { console.warn(e) }
}

// POST EDIT / DELETE

function togglePostMenu(postId) {
  const menu = document.getElementById('post-menu-' + postId)
  if (!menu) return
  const isHidden = menu.classList.contains('hidden')
  document.querySelectorAll('[id^="post-menu-"]').forEach(m => m.classList.add('hidden'))
  if (isHidden) {
    menu.classList.remove('hidden')
    setTimeout(() => {
      document.addEventListener('click', function handler(e) {
        if (!menu.contains(e.target) && e.target.id !== 'btn-menu-' + postId) {
          menu.classList.add('hidden')
          document.removeEventListener('click', handler)
        }
      })
    }, 50)
  }
}

function closeAllPostMenus() {
  document.querySelectorAll('[id^="post-menu-"]').forEach(m => m.classList.add('hidden'))
}

async function openEditPost(postId) {
  const post = postsCache.find(p => p.id === postId)
  if (!post) return

  let modal = document.getElementById('modal-edit-post')
  if (!modal) {
    document.body.insertAdjacentHTML('beforeend', `
      <div id="modal-edit-post" class="modal-backdrop" onclick="closeModalBackdrop(event,'modal-edit-post')">
        <div class="modal-box">
          <button onclick="closeModal('modal-edit-post')" class="absolute top-4 right-4 text-gray-400 hover:text-black"><i class="fas fa-times text-lg"></i></button>
          <h2 class="text-2xl font-bold mb-5">Edit Postingan</h2>
          <input type="hidden" id="edit-post-id">
          <div class="flex gap-4">
            <div id="edit-post-avatar" class="w-10 h-10 rounded-xl bg-black flex items-center justify-center text-white font-bold flex-shrink-0 text-sm">?</div>
            <textarea id="edit-post-content" class="form-input flex-1" rows="4" placeholder="Bagikan pemikiranmu..."></textarea>
          </div>
          <div class="flex gap-3 mt-4">
            <button onclick="closeModal('modal-edit-post')" class="flex-1 border-2 border-gray-200 py-3 rounded-xl font-bold hover:bg-gray-50 transition">Batal</button>
            <button onclick="saveEditPost()" class="flex-1 bg-black text-white py-3 rounded-xl font-bold hover:bg-zinc-800 transition"><i class="fas fa-save mr-2"></i>Simpan</button>
          </div>
        </div>
      </div>
    `)
    modal = document.getElementById('modal-edit-post')
  }

  document.getElementById('edit-post-id').value = postId
  document.getElementById('edit-post-content').value = post.content
  const avatarEl2 = document.getElementById('edit-post-avatar')
  if (avatarEl2 && CURRENT_PROFILE) {
    avatarEl2.outerHTML = avatarEl(CURRENT_PROFILE.username, CURRENT_PROFILE.avatar_url)
      .replace('class="', 'id="edit-post-avatar" class="')
  }
  openModal('modal-edit-post')
}

async function saveEditPost() {
  const postId = document.getElementById('edit-post-id').value
  const newContent = document.getElementById('edit-post-content').value.trim()
  if (!newContent) { toast('⚠️ Konten tidak boleh kosong'); return }
  await window._SB.updatePost(postId, { content: newContent })
  await loadPosts()
  closeModal('modal-edit-post')
  renderPage(getCurrentPage())
  toast('✅ Post berhasil diperbarui!')
}

async function deletePost(postId) {
  if (!confirm('Yakin hapus postingan ini?')) return
  await window._SB.deletePost(postId)
  await loadPosts()
  renderPage(getCurrentPage())
  toast('🗑️ Postingan dihapus')
}

// KONTEN EDIT / DELETE

function toggleContentMenu(contentId) {
  const menu = document.getElementById('content-menu-' + contentId)
  if (!menu) return
  const isHidden = menu.classList.contains('hidden')
  document.querySelectorAll('[id^="content-menu-"]').forEach(m => m.classList.add('hidden'))
  if (isHidden) {
    menu.classList.remove('hidden')
    setTimeout(() => {
      document.addEventListener('click', function handler(e) {
        if (!menu.contains(e.target)) {
          menu.classList.add('hidden')
          document.removeEventListener('click', handler)
        }
      })
    }, 50)
  }
}

async function openEditKonten(contentId) {
  const c = contentsCache.find(c => c.id === contentId)
  if (!c) return
  populateCategorySelects()
  document.getElementById('edit-konten-id').value = contentId
  document.getElementById('edit-konten-title').value = c.title || ''
  document.getElementById('edit-konten-desc').value = c.description || ''
  document.getElementById('edit-konten-url').value = c.webUrl || ''
  const catSel = document.getElementById('edit-konten-category')
  if (catSel && c.categoryId) catSel.value = c.categoryId
  openModal('modal-edit-konten')
}

async function saveEditKonten() {
  const contentId = document.getElementById('edit-konten-id').value
  const title = document.getElementById('edit-konten-title').value.trim()
  if (!title) { toast('⚠️ Judul tidak boleh kosong'); return }
  const updates = {
    name: title,
    description: document.getElementById('edit-konten-desc').value.trim(),
    category_id: document.getElementById('edit-konten-category').value || null,
    display_url: document.getElementById('edit-konten-url').value.trim() || null
  }
  await window._SB.updateContent(contentId, updates)
  await loadContents()
  await loadSaves()
  closeModal('modal-edit-konten')
  renderProfil()
  toast('✅ Konten berhasil diperbarui!')
}

async function deleteKonten(contentId) {
  if (!confirm('Yakin hapus konten ini? Tindakan ini tidak bisa dibatalkan.')) return
  await window._SB.deleteContent(contentId)
  await loadContents()
  await loadSaves()
  renderProfil()
  renderBeranda()
  toast('🗑️ Konten dihapus')
}

// SHOW CONTENT DETAIL

async function showContentDetail(id) {
  const c = contentsCache.find(c => c.id === id)
  if (!c) return

  // increment views
  await window._SB.incrementViews(id)
  await loadContents()

  const updated = contentsCache.find(c => c.id === id)
  if (!updated) return

  const fileIconMap = {
    image: 'fas fa-file-image text-white',
    video: 'fas fa-file-video text-white',
    pdf: 'fas fa-file-pdf text-white',
    doc: 'fas fa-file-word text-white',
    docx: 'fas fa-file-word text-white'
  }
  const fileIcon = fileIconMap[updated.fileType] || 'fas fa-file text-white'

  const comments = updated.comments || []
  const ratings = updated.ratings || []
  const avgRating = ratings.length ? (ratings.reduce((a,b) => a + b.score, 0) / ratings.length).toFixed(1) : null

  const fileMetaExtra = updated.fileName
    ? `<div class="bg-gray-50 rounded-xl p-3"><p class="text-xs text-gray-400 mb-0.5">Nama File</p><p class="text-sm font-semibold text-black truncate">${updated.fileName}</p></div>
       <div class="bg-gray-50 rounded-xl p-3"><p class="text-xs text-gray-400 mb-0.5">Ukuran</p><p class="text-sm font-semibold text-black">${updated.fileSize ? formatSize(updated.fileSize) : '-'}</p></div>`
    : ''

  const webUrlBlock = updated.webUrl
    ? `<a href="${updated.webUrl}" target="_blank" rel="noopener" class="flex items-center gap-2 bg-blue-50 border border-blue-200 rounded-xl px-4 py-3 mb-4 text-sm text-blue-700 hover:bg-blue-100 transition"><i class="fas fa-external-link-alt"></i><span class="truncate flex-1">${updated.webUrl}</span><span class="text-xs font-semibold flex-shrink-0">Buka →</span></a>`
    : ''

  const pdfOpenBtn = updated.fileType === 'pdf'
    ? `<button onclick="togglePdfViewer('${updated.id}')" class="flex-1 flex items-center justify-center gap-2 bg-black text-white text-sm py-3 rounded-xl font-semibold hover:bg-gray-800 transition"><i class="fas fa-file-pdf"></i> Buka PDF</button>`
    : ''

  const pdfViewerBlock = updated.fileType === 'pdf' && updated.fileData
    ? `<div id="pdf-viewer-${updated.id}" class="hidden mb-6"><div class="flex items-center justify-between mb-2"><span class="text-sm font-semibold text-black">Preview PDF</span><button onclick="togglePdfViewer('${updated.id}')" class="text-xs text-gray-400 hover:text-black"><i class="fas fa-times"></i> Tutup</button></div><iframe src="${updated.fileData}" class="w-full rounded-2xl border border-gray-200" style="height:70vh;" title="${updated.title}"></iframe></div>`
    : ''

  const fileActionsBlock = updated.fileData
    ? `<div class="flex gap-3 mb-4">${pdfOpenBtn}<button onclick="downloadContent('${updated.id}')" class="flex-1 flex items-center justify-center gap-2 bg-gray-100 text-black text-sm py-3 rounded-xl font-semibold hover:bg-gray-200 transition"><i class="fas fa-download"></i> Download</button></div>${pdfViewerBlock}`
    : `<div class="flex items-center gap-2 bg-yellow-50 border border-yellow-200 rounded-xl px-4 py-3 mb-4 text-sm text-yellow-700"><i class="fas fa-info-circle"></i><span>Konten ini tidak memiliki file yang diunggah.</span></div>`

  const stars = (score, interactive = false, name = '') => [1,2,3,4,5].map(i =>
    interactive
      ? `<i class="${i <= score ? 'fas' : 'far'} fa-star text-yellow-400 cursor-pointer text-lg" onmouseover="hoverStar(this,${i})" onmouseout="resetStars('${name}')" onclick="setStar('${name}',${i})"></i>`
      : `<i class="${i <= Math.round(score) ? 'fas' : 'far'} fa-star text-yellow-400 text-sm"></i>`
  ).join('')

  const commentsHtml = comments.length
    ? comments.map(cm => `
        <div class="flex gap-3 py-4 border-b border-gray-100 last:border-0">
          <div class="w-9 h-9 rounded-full bg-black flex items-center justify-center text-white text-xs font-bold flex-shrink-0">${cm.author.charAt(0).toUpperCase()}</div>
          <div class="flex-1">
            <div class="flex items-center gap-2 mb-1">
              <span class="text-sm font-semibold text-black">${cm.author}</span>
              <div class="flex">${stars(cm.rating)}</div>
              <span class="text-xs text-gray-400 ml-auto">${new Date(cm.date).toLocaleDateString('id-ID', { day: 'numeric', month: 'short', year: 'numeric' })}</span>
            </div>
            <p class="text-sm text-gray-600 leading-relaxed">${cm.text}</p>
          </div>
        </div>`).join('')
    : `<div class="text-center py-10 text-gray-400"><i class="far fa-comment-dots text-3xl mb-2 block"></i><p class="text-sm">Belum ada komentar. Jadilah yang pertama!</p></div>`

  const html = `
    <div id="content-detail-modal" class="fixed inset-0 z-50 bg-black/60 backdrop-blur-sm flex items-end sm:items-center justify-center p-0 sm:p-4" onclick="if(event.target===this)closeContentDetail()">
      <div class="bg-white w-full sm:max-w-xl rounded-t-3xl sm:rounded-3xl max-h-[95vh] flex flex-col overflow-hidden shadow-2xl">
        <div class="flex items-center justify-between px-5 pt-4 pb-2 flex-shrink-0">
          <button onclick="closeContentDetail()" class="w-9 h-9 rounded-full bg-gray-100 flex items-center justify-center hover:bg-gray-200 transition"><i class="fas fa-arrow-left text-sm text-gray-700"></i></button>
          <span class="text-xs font-medium text-gray-400 uppercase tracking-widest">${updated.fileType || 'Konten'}</span>
          <button onclick="toggleBookmark('${updated.id}');closeContentDetail();showContentDetail('${updated.id}')" class="w-9 h-9 rounded-full bg-gray-100 flex items-center justify-center hover:bg-gray-200 transition">
            <i class="${updated.bookmarked ? 'fas text-black' : 'far text-gray-400'} fa-bookmark text-sm"></i>
          </button>
        </div>
        <div class="overflow-y-auto flex-1 px-5 pb-8">
          <div class="w-full aspect-[3/2] rounded-2xl overflow-hidden bg-zinc-900 flex items-center justify-center mb-5 relative">
            ${updated.thumbUrl ? `<img src="${updated.thumbUrl}" class="w-full h-full object-cover">` : `<i class="${fileIcon} text-6xl text-white opacity-30"></i>`}
            <div class="absolute inset-0 bg-gradient-to-t from-black/60 to-transparent"></div>
            <div class="absolute bottom-4 left-4 right-4"><h2 class="text-white text-xl font-bold leading-tight drop-shadow">${updated.title}</h2></div>
          </div>
          <div class="flex items-center gap-3 mb-4">
            ${avgRating ? `<div class="flex items-center gap-1.5"><span class="text-2xl font-bold text-black">${avgRating}</span><div class="flex flex-col gap-0.5"><div class="flex">${stars(avgRating)}</div><span class="text-xs text-gray-400">${ratings.length} ulasan</span></div></div>` : `<span class="text-sm text-gray-400 italic">Belum ada penilaian</span>`}
            <div class="ml-auto flex items-center gap-3 text-sm text-gray-500"><span><i class="fas fa-eye mr-1 text-gray-400"></i>${updated.views}</span><span><i class="fas fa-heart mr-1 text-red-400"></i>${updated.likes}</span></div>
          </div>
          <div class="mb-6"><h3 class="text-sm font-semibold text-black mb-2">Tentang Konten</h3><p class="text-sm text-gray-600 leading-relaxed">${updated.description || 'Tidak ada deskripsi tersedia.'}</p></div>
          <div class="grid grid-cols-2 gap-3 mb-4">
            <div class="bg-gray-50 rounded-xl p-3"><p class="text-xs text-gray-400 mb-0.5">Tipe File</p><p class="text-sm font-semibold text-black uppercase">${updated.fileType || '-'}</p></div>
            <div class="bg-gray-50 rounded-xl p-3"><p class="text-xs text-gray-400 mb-0.5">Diunggah</p><p class="text-sm font-semibold text-black">${new Date(updated.createdAt).toLocaleDateString('id-ID', { day: 'numeric', month: 'short', year: 'numeric' })}</p></div>
            ${fileMetaExtra}
          </div>
          ${webUrlBlock}
          ${fileActionsBlock}
          <div class="bg-gray-50 rounded-2xl p-4 mb-6">
            <h3 class="text-sm font-semibold text-black mb-3">Beri Penilaian</h3>
            <div id="star-input-${updated.id}" data-score="0" class="flex gap-1 mb-3">${stars(0, true, updated.id)}</div>
            <input id="comment-author-${updated.id}" type="text" placeholder="Nama kamu" class="w-full border border-gray-200 rounded-xl px-3 py-2 text-sm outline-none mb-2 bg-white">
            <textarea id="comment-text-${updated.id}" placeholder="Tulis komentar..." rows="3" class="w-full border border-gray-200 rounded-xl px-3 py-2 text-sm outline-none resize-none bg-white mb-3"></textarea>
            <button onclick="submitComment('${updated.id}')" class="w-full bg-black text-white text-sm py-2.5 rounded-xl font-semibold hover:bg-gray-800 transition">Kirim Komentar</button>
          </div>
          <div><h3 class="text-sm font-semibold text-black mb-1">Komentar <span class="text-gray-400 font-normal">(${comments.length})</span></h3><div id="comments-list-${updated.id}">${commentsHtml}</div></div>
        </div>
      </div>
    </div>`
  document.body.insertAdjacentHTML('beforeend', html)
}

function togglePdfViewer(contentId) {
  const viewer = document.getElementById(`pdf-viewer-${contentId}`)
  if (viewer) viewer.classList.toggle('hidden')
}

function downloadContent(contentId) {
  const c = contentsCache.find(c => c.id === contentId)
  if (!c || !c.fileData) { toast('⚠️ Tidak ada file untuk diunduh'); return }
  const a = document.createElement('a')
  a.href = c.fileData
  a.download = c.fileName || c.title
  a.click()
  toast('⬇️ Mengunduh file...')
}

function closeContentDetail() {
  const modal = document.getElementById('content-detail-modal')
  if (modal) modal.remove()
}

function hoverStar(el, score) {
  const container = el.parentElement
  if (!container) return
  ;[...container.querySelectorAll('i')].forEach((s, i) => {
    s.className = `${i < score ? 'fas' : 'far'} fa-star text-yellow-400 cursor-pointer text-lg`
  })
}

function resetStars(contentId) {
  const container = document.getElementById(`star-input-${contentId}`)
  if (!container) return
  const score = parseInt(container.dataset.score) || 0
  ;[...container.querySelectorAll('i')].forEach((s, i) => {
    s.className = `${i < score ? 'fas' : 'far'} fa-star text-yellow-400 cursor-pointer text-lg`
  })
}

function setStar(contentId, score) {
  const container = document.getElementById(`star-input-${contentId}`)
  if (!container) return
  container.dataset.score = score
  ;[...container.querySelectorAll('i')].forEach((s, i) => {
    s.className = `${i < score ? 'fas' : 'far'} fa-star text-yellow-400 cursor-pointer text-lg`
  })
}

async function submitComment(contentId) {
  const author = document.getElementById(`comment-author-${contentId}`).value.trim()
  const text = document.getElementById(`comment-text-${contentId}`).value.trim()
  const score = parseInt(document.getElementById(`star-input-${contentId}`)?.dataset.score) || 0
  if (!author || !text || !score) { toast('⚠️ Lengkapi data komentar'); return }
  await window._SB.addComment(contentId, { author, text, rating: score })
  await loadContents()
  closeContentDetail()
  showContentDetail(contentId)
  toast('✅ Komentar berhasil dikirim!')
}

// ============================
// SEARCH
// ============================
function handleSearch(q) {
  if (!q.trim()) return
  const resultContents = contentsCache.filter(c => c.title.toLowerCase().includes(q.toLowerCase()))
  const resultLinks = linkwebsCache.filter(l => l.title.toLowerCase().includes(q.toLowerCase()))
  toast(`${resultContents.length + resultLinks.length} hasil ditemukan`)
}

// ============================
// UPLOAD KONTEN & LINK
// ============================
function setUploadTab(tab) {
  document.getElementById('tab-konten').classList.toggle('active', tab === 'konten')
  document.getElementById('tab-linkweb').classList.toggle('active', tab === 'linkweb')
  document.getElementById('upload-konten-panel').classList.toggle('hidden', tab !== 'konten')
  document.getElementById('upload-linkweb-panel').classList.toggle('hidden', tab !== 'linkweb')
}

function handleMiniFile(input) {
  if (!input.files[0]) return
  tempFiles.main = input.files[0]
  const el = document.getElementById('mini-file-preview')
  el.classList.remove('hidden')
  document.getElementById('mini-file-name').textContent = input.files[0].name
  document.getElementById('mini-file-size').textContent = formatSize(input.files[0].size)
}

function handleMiniDrop(e) {
  e.preventDefault()
  e.currentTarget.classList.remove('hover')
  const f = e.dataTransfer.files[0]
  if (f) { tempFiles.main = f; document.getElementById('mini-file').files = e.dataTransfer.files; handleMiniFile({files:[f]}) }
}

function clearMiniFile() {
  tempFiles.main = null
  document.getElementById('mini-file-preview').classList.add('hidden')
  document.getElementById('mini-file').value = ''
}

function handleMainFile(input) {
  if (!input.files[0]) return
  tempFiles.main = input.files[0]
  document.getElementById('main-file-info').classList.remove('hidden')
  document.getElementById('main-file-name').textContent = input.files[0].name
  document.getElementById('main-file-size').textContent = formatSize(input.files[0].size)
  const ext = input.files[0].name.split('.').pop().toLowerCase()
  const icons = {png:'fas fa-file-image text-orange-400',jpg:'fas fa-file-image text-orange-400',jpeg:'fas fa-file-image text-orange-400',gif:'fas fa-file-image text-orange-400',webp:'fas fa-file-image text-orange-400',mp4:'fas fa-file-video text-purple-400',pdf:'fas fa-file-pdf text-red-400',doc:'fas fa-file-word text-blue-400',docx:'fas fa-file-word text-blue-400'}
  document.getElementById('main-file-icon').className = icons[ext] || 'fas fa-file text-gray-400'
  document.getElementById('main-file-icon').className += ' text-xl'
}

function handleMainDrop(e) {
  e.preventDefault()
  e.currentTarget.classList.remove('hover')
  const f = e.dataTransfer.files[0]
  if (f) { tempFiles.main = f; handleMainFile({files:[f]}) }
}

function clearMainFile() {
  tempFiles.main = null
  document.getElementById('main-file-info').classList.add('hidden')
}

function handleThumbFile(input) {
  if (!input.files[0]) return
  tempFiles.thumbFile = input.files[0]
  const reader = new FileReader()
  reader.onload = e => {
    tempFiles.thumb = e.target.result
    document.getElementById('thumb-preview').src = e.target.result
    document.getElementById('thumb-preview').classList.remove('hidden')
    document.getElementById('thumb-icon-placeholder').classList.add('hidden')
  }
  reader.readAsDataURL(input.files[0])
}

function handleLinkIcon(input) {
  if (!input.files[0]) return
  tempFiles.linkIcon = input.files[0]
  const reader = new FileReader()
  reader.onload = e => {
    document.getElementById('lk-icon-preview').src = e.target.result
    document.getElementById('lk-icon-preview').classList.remove('hidden')
    document.getElementById('lk-icon-placeholder').classList.add('hidden')
  }
  reader.readAsDataURL(input.files[0])
}

async function submitUpload() {
  const title = document.getElementById('up-title').value.trim()
  const catId = document.getElementById('up-category').value
  const desc = document.getElementById('up-desc').value.trim()
  if (!title) { toast('⚠️ Judul wajib diisi!'); return }

  let fileUrl = null, thumbUrl = null, fileType = 'doc'
  if (tempFiles.main) {
    const ext = tempFiles.main.name.split('.').pop().toLowerCase()
    const typeMap = {png:'image',jpg:'image',jpeg:'image',gif:'image',webp:'image',mp4:'video',pdf:'pdf',doc:'doc',docx:'docx'}
    fileType = typeMap[ext] || 'doc'
    toast('⏳ Mengupload file...')
    fileUrl = await window._SB.uploadContentFile(CURRENT_USER.id, tempFiles.main)
  }
  if (tempFiles.thumbFile) {
    toast('⏳ Mengupload thumbnail...')
    thumbUrl = await window._SB.uploadThumbnail(CURRENT_USER.id, tempFiles.thumbFile)
  }

  await window._SB.addContent(CURRENT_USER.id, {
    name: title,
    description: desc,
    category_id: catId || null,
    icon_type: fileType,
    file_url: fileUrl,
    preview_image: thumbUrl || null,
    display_url: document.getElementById('up-url').value.trim() || null,
    status: 'published'
  })

  await loadContents()
  await loadSaves()
  toast('✅ Konten berhasil diupload!')
  closeModal('modal-upload')
  resetUploadForm()
  renderPage(getCurrentPage())
}

async function submitLink() {
  const title = document.getElementById('lk-title').value.trim()
  const url = document.getElementById('lk-url').value.trim()
  if (!title || !url) { toast('⚠️ Judul dan URL wajib diisi!'); return }
  let iconUrl = ''
  if (tempFiles.linkIcon) {
    toast('⏳ Mengupload icon...')
    const ext = tempFiles.linkIcon.name.split('.').pop()
    const path = `links/${CURRENT_USER.id}/${Date.now()}.${ext}`
    const { error } = await window._SB.supabase.storage.from('avatars').upload(path, tempFiles.linkIcon)
    if (!error) {
      const { data: { publicUrl } } = window._SB.supabase.storage.from('avatars').getPublicUrl(path)
      iconUrl = publicUrl
    }
  }
  await window._SB.addRef(CURRENT_USER.id, {
    theme: title,
    language: url,
    icon_url: iconUrl,
    description: document.getElementById('lk-desc').value.trim(),
    status: document.getElementById('lk-status').value,
    category_id: document.getElementById('lk-category').value || null
  })
  await loadLinkwebs()
  toast('✅ Link web berhasil disimpan!')
  closeModal('modal-link')
  resetLinkForm()
  renderPage(getCurrentPage())
}

async function submitPost() {
  const content = document.getElementById('post-content').value.trim()
  if (!content) { toast('⚠️ Tulis sesuatu dulu!'); return }
  await window._SB.addPost(CURRENT_USER.id, content)
  await loadPosts()
  document.getElementById('post-content').value = ''
  toast('✅ Post berhasil dipublikasikan!')
  closeModal('modal-post')
  renderDiskusi()
}

async function submitProject() {
  const name = document.getElementById('proj-name').value.trim()
  if (!name) { toast('⚠️ Nama project wajib diisi!'); return }
  const newProj = {
    user_id: CURRENT_USER.id,
    name,
    description: document.getElementById('proj-desc').value.trim(),
    deploy_url: document.getElementById('proj-url').value.trim(),
    tech_stack: document.getElementById('proj-tech').value.trim(),
    status: document.getElementById('proj-status').value,
    visit_count: 0,
    performance_score: parseInt(document.getElementById('proj-perf').value) || 80,
    uptime_percent: parseInt(document.getElementById('proj-uptime').value) || 99,
    last_deployed: new Date().toISOString()
  }
  await window._SB.addProject(CURRENT_USER.id, newProj)
  await loadProjects()
  ;['proj-name', 'proj-desc', 'proj-url', 'proj-tech', 'proj-perf', 'proj-uptime'].forEach(id => document.getElementById(id).value = '')
  toast('✅ Project berhasil ditambahkan!')
  closeModal('modal-project')
  renderAnalyst()
}

async function deleteProject(id) {
  if (!confirm('Hapus project ini?')) return
  await window._SB.deleteProject(id)
  await loadProjects()
  renderAnalyst()
  toast('🗑️ Project dihapus')
}

async function saveEditProfil() {
  const updates = {
    username: document.getElementById('ep-username').value.trim() || CURRENT_PROFILE.username,
    bio: document.getElementById('ep-bio').value.trim(),
    location: document.getElementById('ep-location').value.trim(),
    occupation: document.getElementById('ep-occupation').value.trim(),
    tech_stack: document.getElementById('ep-techstack').value.trim(),
    interests: document.getElementById('ep-interests').value.trim(),
  }
  CURRENT_PROFILE = await window._SB.updateProfile(CURRENT_USER.id, updates)
  toast('✅ Profil berhasil diperbarui!')
  closeModal('modal-editprofil')
  renderProfil()
}

async function uploadAvatar(input) {
  if (!input.files[0]) return
  toast('⏳ Mengupload foto...')
  const url = await window._SB.uploadAvatarFile(CURRENT_USER.id, input.files[0])
  await window._SB.updateProfile(CURRENT_USER.id, { avatar_url: url })
  CURRENT_PROFILE.avatar_url = url
  renderProfil()
  toast('✅ Foto profil diperbarui!')
}

async function uploadCover(input) {
  if (!input.files[0]) return
  toast('⏳ Mengupload cover...')
  const url = await window._SB.uploadCoverFile(CURRENT_USER.id, input.files[0])
  await window._SB.updateProfile(CURRENT_USER.id, { cover_url: url })
  CURRENT_PROFILE.cover_url = url
  renderProfil()
  toast('✅ Cover diperbarui!')
}

function clearAllData() {
  if (!confirm('Yakin hapus semua data? Ini tidak bisa dibatalkan.')) return
  // Hanya bersihkan localStorage untuk keperluan lain (jika ada), tapi data utama di Supabase tidak dihapus
  // Karena tidak pakai localStorage untuk data utama, fungsi ini bisa dihapus atau diberi peringatan
  toast('🗑️ Fitur ini tidak tersedia karena data tersimpan di cloud.')
}

// ============================
// MODAL HELPERS
// ============================
function openUploadModal() {
  if (!CURRENT_USER) { openAuthModal(); toast('⚠️ Login dulu untuk upload konten'); return }
  populateCategorySelects()
  tempFiles = { main: null, thumb: null, thumbFile: null, linkIcon: null }
  openModal('modal-upload')
}

function openLinkModal() {
  if (!CURRENT_USER) { openAuthModal(); toast('⚠️ Login dulu untuk menambah link'); return }
  populateCategorySelects()
  tempFiles = { main: null, thumb: null, thumbFile: null, linkIcon: null }
  document.getElementById('lk-icon-preview').classList.add('hidden')
  document.getElementById('lk-icon-placeholder').classList.remove('hidden')
  openModal('modal-link')
}

function openPostModal() {
  if (!CURRENT_USER) { openAuthModal(); toast('⚠️ Login dulu untuk posting diskusi'); return }
  openModal('modal-post')
  const el = document.getElementById('modal-post-avatar')
  if (el && CURRENT_PROFILE) {
    el.outerHTML = avatarEl(CURRENT_PROFILE.username, CURRENT_PROFILE.avatar_url)
      .replace('class="', 'id="modal-post-avatar" class="')
  }
}

function openProjectModal() { openModal('modal-project') }
function openEditProfil() {
  const profile = {
    name: CURRENT_PROFILE?.username || '',
    username: CURRENT_PROFILE?.username || '',
    bio: CURRENT_PROFILE?.bio || '',
    location: CURRENT_PROFILE?.location || '',
    occupation: CURRENT_PROFILE?.occupation || '',
    techStack: CURRENT_PROFILE?.tech_stack || '',
    interests: CURRENT_PROFILE?.interests || ''
  }
  document.getElementById('ep-name').value = profile.name
  document.getElementById('ep-username').value = profile.username
  document.getElementById('ep-bio').value = profile.bio
  document.getElementById('ep-location').value = profile.location
  document.getElementById('ep-occupation').value = profile.occupation
  document.getElementById('ep-techstack').value = profile.techStack
  document.getElementById('ep-interests').value = profile.interests
  openModal('modal-editprofil')
}

function openModal(id) { document.getElementById(id).classList.add('open'); document.body.style.overflow = 'hidden' }
function closeModal(id) { document.getElementById(id).classList.remove('open'); document.body.style.overflow = '' }
function closeModalBackdrop(e, id) { if (e.target.id === id) closeModal(id) }

function populateCategorySelects() {
  const opts = categoriesCache.map(c => `<option value="${c.id}">${c.name}</option>`).join('')
  ;['up-category', 'lk-category', 'edit-konten-category'].forEach(id => {
    const el = document.getElementById(id)
    if (el) el.innerHTML = '<option value="">Pilih kategori...</option>' + opts
  })
}

function resetUploadForm() {
  ;['up-title', 'up-desc', 'up-url'].forEach(id => document.getElementById(id).value = '')
  clearMainFile()
  tempFiles = { main: null, thumb: null, thumbFile: null, linkIcon: null }
  document.getElementById('thumb-preview').classList.add('hidden')
  document.getElementById('thumb-icon-placeholder').classList.remove('hidden')
}

function resetLinkForm() {
  ;['lk-title', 'lk-url', 'lk-desc'].forEach(id => document.getElementById(id).value = '')
  tempFiles.linkIcon = null
  document.getElementById('lk-icon-preview').classList.add('hidden')
  document.getElementById('lk-icon-placeholder').classList.remove('hidden')
}

// ============================
// UTILITIES
// ============================
function toast(msg, duration = 2800) {
  const el = document.getElementById('toast')
  el.textContent = msg
  el.classList.add('show')
  setTimeout(() => el.classList.remove('show'), duration)
}

function formatSize(bytes) {
  if (bytes < 1024) return bytes + 'B'
  if (bytes < 1048576) return (bytes / 1024).toFixed(1) + 'KB'
  return (bytes / 1048576).toFixed(1) + 'MB'
}

function avatarEl(name, avatarUrl, size = 'w-10 h-10', rounded = 'rounded-xl') {
  const initial = (name || 'U')[0].toUpperCase()
  if (avatarUrl) {
    return `<img src="${avatarUrl}" class="${size} ${rounded} object-cover flex-shrink-0" onerror="this.outerHTML='<div class=\\'${size} ${rounded} bg-black flex items-center justify-center text-white font-bold flex-shrink-0 text-sm\\'>${initial}</div>'">`
  }
  return `<div class="${size} ${rounded} bg-black flex items-center justify-center text-white font-bold flex-shrink-0 text-sm">${initial}</div>`
}

function timeAgo(dateStr) {
  const diff = (Date.now() - new Date(dateStr).getTime()) / 1000
  if (diff < 60) return 'Baru saja'
  if (diff < 3600) return Math.floor(diff / 60) + 'm yang lalu'
  if (diff < 86400) return Math.floor(diff / 3600) + 'j yang lalu'
  if (diff < 604800) return Math.floor(diff / 86400) + ' hari yang lalu'
  return Math.floor(diff / 604800) + ' minggu yang lalu'
}

function getCurrentPage() {
  const active = document.querySelector('.page-content.active')
  if (!active) return 'beranda'
  return active.id.replace('page-', '')
}

// CARD DESCRIPTION HANDLERS
let activeCardDesc = null
function showCardDesc(cardEl) {
  const overlay = cardEl.querySelector('.content-desc-overlay')
  if (!overlay) return
  if (activeCardDesc && activeCardDesc !== cardEl) {
    const prevOverlay = activeCardDesc.querySelector('.content-desc-overlay')
    if (prevOverlay) activeCardDesc.classList.remove('active-desc')
  }
  cardEl.classList.add('active-desc')
  activeCardDesc = cardEl
}
function hideCardDesc(cardEl) {
  cardEl.classList.remove('active-desc')
  if (activeCardDesc === cardEl) activeCardDesc = null
}
function toggleCardDesc(cardEl) {
  if (cardEl.classList.contains('active-desc')) hideCardDesc(cardEl)
  else showCardDesc(cardEl)
  return false
}

// ============================
// SUPABASE METHOD ENSURER
// ============================
function ensureSBMethods() {
  if (!window._SB) return
  // Add missing methods if needed (stub using supabase client)
  if (!window._SB.getRefs) {
    window._SB.getRefs = async (userId) => {
      const { data, error } = await window._SB.supabase.from('refs').select('*').eq('user_id', userId)
      if (error) throw error
      return data
    }
  }
  if (!window._SB.addRef) {
    window._SB.addRef = async (userId, ref) => {
      const { data, error } = await window._SB.supabase.from('refs').insert({ ...ref, user_id: userId }).select().single()
      if (error) throw error
      return data
    }
  }
  if (!window._SB.getProjects) {
    window._SB.getProjects = async (userId) => {
      const { data, error } = await window._SB.supabase.from('projects').select('*').eq('user_id', userId)
      if (error) throw error
      return data
    }
  }
  if (!window._SB.addProject) {
    window._SB.addProject = async (userId, project) => {
      const { data, error } = await window._SB.supabase.from('projects').insert({ ...project, user_id: userId }).select().single()
      if (error) throw error
      return data
    }
  }
  if (!window._SB.deleteProject) {
    window._SB.deleteProject = async (id) => {
      const { error } = await window._SB.supabase.from('projects').delete().eq('id', id)
      if (error) throw error
    }
  }
  if (!window._SB.likePost) {
    window._SB.likePost = async (postId, userId) => {
      // simple increment likes_count, no duplicate check for demo
      const { error } = await window._SB.supabase.rpc('increment_post_likes', { post_id: postId })
      if (error) console.warn(error)
    }
  }
  if (!window._SB.addComment) {
    window._SB.addComment = async (contentId, comment) => {
      const { error } = await window._SB.supabase.from('content_comments').insert({
        content_id: contentId,
        author: comment.author,
        text: comment.text,
        rating: comment.rating,
        date: new Date().toISOString()
      })
      if (error) throw error
      // also update ratings array in contents table (optional)
      await window._SB.supabase.rpc('add_content_rating', { content_id: contentId, rating: comment.rating })
    }
  }
  if (!window._SB.incrementViews) {
    window._SB.incrementViews = async (contentId) => {
      const { error } = await window._SB.supabase.rpc('increment_views', { content_id: contentId })
      if (error) console.warn(error)
    }
  }
}

// ============================
// INIT
// ============================
;(function resetStaleCategories() {
  // nothing to do with localStorage
})();

init()