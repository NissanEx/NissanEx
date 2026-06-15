// Supabase functions tersedia via window._SB (diload oleh module script di head)
// Semua fungsi diakses sebagai: window._SB.getCurrentUser(), dll
 
// User yang sedang login (diisi saat init)
let CURRENT_USER = null
let CURRENT_PROFILE = null
 
// ============================
// AUTH GUARD UNTUK URL LANGSUNG
// ============================
// Halaman yang memerlukan login
const PROTECTED_PAGES = ['profil', 'pengaturan', 'disimpan']

// Ambil nama file dari URL
const currentPage = window.location.pathname.split('/').pop().replace('.html', '') || 'index'

// Cek apakah halaman saat ini butuh login
if (PROTECTED_PAGES.includes(currentPage)) {
  (async function() {
    // Tunggu window._SB siap
    let wait = 0
    while (!window._SB && wait < 50) {
      await new Promise(r => setTimeout(r, 100))
      wait++
    }
    
    if (window._SB) {
      const user = await window._SB.getCurrentUser()
      if (!user) {
        // Redirect ke auth.html
        window.location.href = 'auth.html'
      }
    }
  })()
}


// ============================
// GLOBAL CONSTANTS
// ============================
const fileIcons = {image:'fas fa-image',video:'fas fa-file-video',pdf:'fas fa-file-pdf',doc:'fas fa-file-word',docx:'fas fa-file-word'};
 
// ============================
// DEFAULT CATEGORIES (fallback jika Supabase kosong)
// ============================
const DEFAULT_CATEGORIES = [
  { id:'cat-tech',   name:'Tech',    slug:'tech',    icon:'fas fa-microchip',     iconUrl:'' },
  { id:'cat-politik',name:'Politik', slug:'politik', icon:'fas fa-landmark',      iconUrl:'' },
  { id:'cat-uiux',   name:'UI/UX',   slug:'uiux',    icon:'fas fa-pen-nib',       iconUrl:'' },
  { id:'cat-cyber',  name:'Cyber',   slug:'cyber',   icon:'fas fa-shield-halved', iconUrl:'' },
  { id:'cat-game',   name:'Game',    slug:'game',    icon:'fas fa-gamepad',       iconUrl:'' },
];
 
// ============================
// DATABASE (localStorage cache + Supabase)
// ============================
const DB = {
  get(key) { try { return JSON.parse(localStorage.getItem('nissanex_'+key)) || null; } catch(e){ return null; } },
  set(key, val) { localStorage.setItem('nissanex_'+key, JSON.stringify(val)); },
  getArr(key) { return this.get(key) || []; },
  pushArr(key, item) { const arr = this.getArr(key); arr.unshift(item); this.set(key, arr); return arr; },
  uuid() { return crypto.randomUUID(); },
 
  async fetchCategories() {
    try {
      const data = await window._SB.getCategories(CURRENT_USER.id)
      const mapped = data.map(c => ({
        id: c.id, name: c.title, slug: c.title?.toLowerCase(),
        icon: c.icon || 'fas fa-folder', iconUrl: c.file_url || ''
      }))
      const final = mapped.length > 0 ? mapped : DEFAULT_CATEGORIES
      this.set('categories', final)
      return final
    } catch(e) {
      this.set('categories', DEFAULT_CATEGORIES)
      return DEFAULT_CATEGORIES
    }
  },
 
  async fetchContents() {
    if (!CURRENT_USER) return []
    try {
      const data = await window._SB.getContents(CURRENT_USER.id)
      const mapped = data.map(c => ({
        id: c.id, userId: c.user_id, categoryId: c.category_id,
        title: c.name, description: c.description,
        authorName: c.users?.username || CURRENT_PROFILE?.username || '',
        authorAvatar: c.users?.avatar_url || CURRENT_PROFILE?.avatar_url || '',
        fileType: c.icon_type || 'doc', thumbUrl: c.preview_image || '',
        fileData: c.file_url || null, fileName: c.file_name || null, fileSize: c.file_size || null,
        webUrl: c.display_url || null,
        views: c.views || 0, likes: c.likes || 0, bookmarked: false,
        createdAt: c.created_at
      }))
      this.set('contents', mapped)
      return mapped
    } catch(e) { return this.getArr('contents') }
  },
 
  async fetchPosts() {
    try {
      const data = await window._SB.getPosts()
      const mapped = data.map(p => ({
        id: p.id, userId: p.user_id,
        userName: p.users?.username || 'Pengguna',
        userAvatar: p.users?.avatar_url || '',
        content: p.content, likes: p.likes_count || 0, comments: p.comments_count || 0, shares: p.shares_count || 0,
        createdAt: p.created_at
      }))
      this.set('discussions', mapped)
      return mapped
    } catch(e) { return this.getArr('discussions') }
  },
 
  async fetchSaves() {
    if (!CURRENT_USER) return []
    try {
      const data = await window._SB.getSaves(CURRENT_USER.id)
      this.set('saves', data)
      // Update bookmark status di contents
      const contents = this.getArr('contents')
      const savedIds = data.filter(s => s.target_type === 'content').map(s => s.target_id)
      contents.forEach(c => { c.bookmarked = savedIds.includes(c.id) })
      this.set('contents', contents)
      return data
    } catch(e) { return this.getArr('saves') }
  }
};
 
// ============================
// INIT & SEED (Supabase)
// ============================
async function init() {
  if (!window._SB_READY) {
    window._pendingInit = init
    return
  }

  _ensureSBMethods();

  window._SB.onAuthChange(async (event, user) => {
    if (event === 'SIGNED_IN') {
      CURRENT_USER = user
      try { CURRENT_PROFILE = await window._SB.getProfile(user.id) } catch(e) { CURRENT_PROFILE = null }
      await seedDataSupabase()
      updateSidebarUser()
      closeAuthModal()
      renderPage(getCurrentPage())
    } else if (event === 'SIGNED_OUT') {
      CURRENT_USER = null
      CURRENT_PROFILE = null
      updateSidebarUser()
      renderBeranda()
    }
  })

  try {
    CURRENT_USER = await window._SB.getCurrentUser()
  } catch(e) {
    CURRENT_USER = null
  }

  if (CURRENT_USER) {
    try { CURRENT_PROFILE = await window._SB.getProfile(CURRENT_USER.id) } catch(e) { CURRENT_PROFILE = null }
  }

  await seedDataSupabase()
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
// AUTH MODAL
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
  const loginPanel  = document.getElementById('auth-login-panel')
  const regPanel    = document.getElementById('auth-reg-panel')
  const loginTab    = document.getElementById('auth-tab-login')
  const regTab      = document.getElementById('auth-tab-reg')
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
          <div>
            <label class="form-label">Email</label>
            <input id="auth-login-email" type="email" class="form-input" placeholder="email@kamu.com">
          </div>
          <div>
            <label class="form-label">Password</label>
            <div class="relative">
              <input id="auth-login-pass" type="password" class="form-input pr-10" placeholder="Password...">
              <button type="button" onclick="togglePassVis('auth-login-pass')" class="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400 hover:text-black">
                <i class="fas fa-eye text-sm"></i>
              </button>
            </div>
          </div>
          <p id="auth-login-err" class="text-red-500 text-xs hidden"></p>
        </div>
        <button onclick="doLogin()" class="w-full bg-black text-white py-3 rounded-xl font-bold hover:bg-zinc-800 transition mt-5 flex items-center justify-center gap-2" id="btn-login">
          <i class="fas fa-sign-in-alt"></i> Masuk
        </button>
        <p class="text-center text-sm text-gray-500 mt-4">Belum punya akun? <button onclick="switchAuthTab('register')" class="font-bold text-black underline">Daftar sekarang</button></p>
      </div>
      <div id="auth-reg-panel" class="hidden">
        <div class="space-y-4">
          <div>
            <label class="form-label">Username</label>
            <input id="auth-reg-user" type="text" class="form-input" placeholder="username kamu...">
          </div>
          <div>
            <label class="form-label">Email</label>
            <input id="auth-reg-email" type="email" class="form-input" placeholder="email@kamu.com">
          </div>
          <div>
            <label class="form-label">Password</label>
            <div class="relative">
              <input id="auth-reg-pass" type="password" class="form-input pr-10" placeholder="Min. 6 karakter">
              <button type="button" onclick="togglePassVis('auth-reg-pass')" class="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400 hover:text-black">
                <i class="fas fa-eye text-sm"></i>
              </button>
            </div>
          </div>
          <p id="auth-reg-err" class="text-red-500 text-xs hidden"></p>
        </div>
        <button onclick="doRegister()" class="w-full bg-black text-white py-3 rounded-xl font-bold hover:bg-zinc-800 transition mt-5 flex items-center justify-center gap-2" id="btn-register">
          <i class="fas fa-user-plus"></i> Buat Akun
        </button>
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
  const pass  = document.getElementById('auth-login-pass').value
  const errEl = document.getElementById('auth-login-err')
  const btn   = document.getElementById('btn-login')
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
  const email    = document.getElementById('auth-reg-email').value.trim()
  const pass     = document.getElementById('auth-reg-pass').value
  const errEl    = document.getElementById('auth-reg-err')
  const btn      = document.getElementById('btn-register')
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
 
async function seedDataSupabase() {
  await DB.fetchCategories()
  await DB.fetchContents()
  await DB.fetchPosts()
  await DB.fetchSaves()
 
  if (CURRENT_PROFILE) {
    DB.set('user_profile', {
      name: CURRENT_PROFILE.username,
      username: CURRENT_PROFILE.username,
      bio: CURRENT_PROFILE.bio || '',
      location: CURRENT_PROFILE.location || '',
      occupation: CURRENT_PROFILE.occupation || '',
      techStack: CURRENT_PROFILE.tech_stack || '',
      interests: CURRENT_PROFILE.interests || '',
      avatarUrl: CURRENT_PROFILE.avatar_url || '',
      coverUrl: CURRENT_PROFILE.cover_url || '',
      followers: 0, following: 0,
    })
  }
 
  if (!DB.get('projects')) {
    DB.set('projects', [
      {id:'p1',userId:'u1',name:'OYBook Platform',description:'Web Novel Platform',deployUrl:'https://oybook.vercel.app',techStack:'Next.js, Supabase',status:'live',visitCount:1245,performanceScore:95,uptimePercent:99,lastDeployed: new Date(Date.now()-86400000*2).toISOString()},
      {id:'p2',userId:'u1',name:'Portfolio Website',description:'Dark Luxury Design',deployUrl:'https://sanpelong.dev',techStack:'HTML/CSS/JS',status:'live',visitCount:532,performanceScore:88,uptimePercent:98,lastDeployed: new Date(Date.now()-86400000*7).toISOString()},
      {id:'p3',userId:'u1',name:'Rangership Game',description:'Space Flight Simulator',deployUrl:'',techStack:'Godot 4, GDScript',status:'development',visitCount:0,performanceScore:72,uptimePercent:0,lastDeployed:null},
    ])
  }
  if (!DB.get('linkwebs')) {
    DB.set('linkwebs', [
      {id:'lk1',userId:'u1',categoryId:'cat-tech',title:'OYBook Platform',url:'https://oybook.vercel.app',description:'Platform web novel dengan monetisasi',iconUrl:'',status:'active',bookmarked:false,createdAt:new Date(Date.now()-86400000).toISOString()},
      {id:'lk2',userId:'u1',categoryId:'cat-uiux',title:'Portfolio Website',url:'https://sanpelong.dev',description:'Dark luxury personal site',iconUrl:'',status:'active',bookmarked:false,createdAt:new Date(Date.now()-86400000*3).toISOString()},
    ])
  }
}
 
// ============================
// TEMP FILE STORAGE
// ============================
let tempFiles = { main:null, thumb:null, thumbFile:null, linkIcon:null };
 
// ============================
// NAVIGATION
// ============================
function navigateTo(pageId) {
  if (AUTH_REQUIRED_PAGES.includes(pageId) && !CURRENT_USER) {
    openAuthModal()
    toast('⚠️ Login dulu untuk mengakses halaman ini')
    return
  }
  document.querySelectorAll('.page-content').forEach(p => p.classList.remove('active'));
  const target = document.getElementById('page-'+pageId);
  if (target) target.classList.add('active');
  document.querySelectorAll('.nav-link').forEach(l => {
    l.classList.remove('active');
    if (l.dataset.page === pageId) l.classList.add('active');
  });
  if (window.innerWidth < 1024) {
    document.getElementById('sidebar').classList.add('-translate-x-full');
    document.getElementById('overlay').classList.add('hidden');
  }
  window.scrollTo({top:0,behavior:'smooth'});
  renderPage(pageId);
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
  };
  if (map[pageId]) map[pageId]();
}
 
function toggleSidebar() {
  const sb = document.getElementById('sidebar');
  const ov = document.getElementById('overlay');
  sb.classList.toggle('-translate-x-full');
  ov.classList.toggle('hidden');
}
 
// ============================
// RENDER FUNCTIONS
// ============================
 
const CAT_SVG = {
  'cat-tech': `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round" class="w-10 h-10"><rect x="2" y="3" width="20" height="14" rx="2"/><path d="M8 21h8M12 17v4"/><path d="M6 8h.01M10 8h4"/></svg>`,
  'cat-politik': `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round" class="w-10 h-10"><path d="M3 21h18M3 10h18M5 6l7-3 7 3M4 10v11M20 10v11M8 10v5M12 10v5M16 10v5"/></svg>`,
  'cat-uiux': `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round" class="w-10 h-10"><rect x="3" y="3" width="18" height="18" rx="3"/><path d="M3 9h18M9 21V9"/></svg>`,
  'cat-cyber': `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round" class="w-10 h-10"><path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z"/><path d="M9 12l2 2 4-4"/></svg>`,
  'cat-game': `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round" class="w-10 h-10"><rect x="2" y="6" width="20" height="12" rx="4"/><path d="M6 12h4M8 10v4M15 11h.01M17 13h.01"/></svg>`,
};
 
function getCatSvg(cat) {
  if (CAT_SVG[cat.id]) return CAT_SVG[cat.id];
  return `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round" class="w-10 h-10"><rect x="3" y="3" width="18" height="18" rx="3"/><path d="M3 9h18"/></svg>`;
}
 
const CAT_GRADIENT = {
  'cat-tech':    'from-blue-600 to-blue-900',
  'cat-politik': 'from-red-600 to-red-900',
  'cat-uiux':    'from-purple-600 to-purple-900',
  'cat-cyber':   'from-emerald-600 to-emerald-900',
  'cat-game':    'from-orange-500 to-orange-900',
};
 
function renderBeranda() {
  const cats = DB.getArr('categories').length > 0 ? DB.getArr('categories') : DEFAULT_CATEGORIES;
  const iconGrid = document.getElementById('category-icons');
  
  iconGrid.innerHTML = cats.map(c => {
    const grad = CAT_GRADIENT[c.id] || 'from-zinc-700 to-zinc-900';
    return `
    <div onclick="navigateTo('kategori')"
      class="cursor-pointer rounded-2xl bg-gradient-to-br ${grad} shadow-lg hover:scale-105 hover:shadow-xl active:scale-95 transition-all select-none overflow-hidden"
      style="min-height:120px;">
      <div class="flex flex-col items-center justify-center gap-3 w-full h-full p-4 text-white" style="min-height:120px;">
        ${c.iconUrl
          ? `<img src="${c.iconUrl}" class="w-10 h-10 object-cover rounded-xl">`
          : c.icon && c.icon.startsWith('fas')
            ? `<i class="${c.icon} text-3xl"></i>`
            : getCatSvg(c)}
        <span class="text-sm font-bold tracking-wide drop-shadow">${c.name}</span>
      </div>
    </div>`;
  }).join('');
  
  const contents = DB.getArr('contents');
  const grid = document.getElementById('beranda-content-grid');
  
  if (!contents.length) {
    grid.innerHTML = `<div class="col-span-6 text-center py-12 text-gray-400"><i class="fas fa-folder-open text-4xl mb-3 block text-gray-200"></i><p>Belum ada konten. Upload pertama Anda!</p></div>`;
    return;
  }
  grid.innerHTML = contents.slice(0,6).map(c => contentCard(c)).join('');
}
 
function contentCard(c) {
  const fileIconsMap = {image:'fas fa-image',video:'fas fa-video',pdf:'fas fa-file-pdf',doc:'fas fa-file-word',docx:'fas fa-file-word'};
  const fileIcon = fileIconsMap[c.fileType] || 'fas fa-file';
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
  `;
}
 
function renderKategori() {
  const cats = DB.getArr('categories');
  const pills = document.getElementById('cat-filter-pills');
  let activeCat = null;
 
  function renderPills(selected) {
    activeCat = selected;
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
    `;
  }
 
  window.filterKategori = function(catId) {
    renderPills(catId);
    const contents = DB.getArr('contents').filter(c => !catId || c.categoryId===catId);
    const links = DB.getArr('linkwebs').filter(l => !catId || l.categoryId===catId);
    const label = catId ? cats.find(c=>c.id===catId)?.name : 'Semua';
    document.getElementById('cat-result-label').textContent = label+' — Konten';
    document.getElementById('kategori-content-grid').innerHTML = contents.length
      ? contents.map(c=>contentCard(c)).join('')
      : `<div class="col-span-4 text-gray-400 py-8 text-sm">Belum ada konten di kategori ini.</div>`;
    document.getElementById('kategori-links-grid').innerHTML = links.length
      ? `<p class="col-span-2 text-sm font-bold text-gray-500 uppercase tracking-wider mb-2">Link Web</p>`+links.map(l=>linkCard(l)).join('')
      : '';
  };
 
  renderPills(null);
  window.filterKategori(null);
}
 
function linkCard(l) {
  const statusBadge = {active:'badge-green',development:'badge-yellow',archived:'badge-blue'}[l.status]||'badge-blue';
  const statusLabel = {active:'Live',development:'Dev',archived:'Arsip'}[l.status]||l.status;
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
  `;
}
 
function renderTren() {
  const contents = DB.getArr('contents').sort((a,b)=>b.views-a.views);
  const el = document.getElementById('tren-list');
  if (!contents.length) {
    el.innerHTML = `<div class="text-center py-16 text-gray-400"><i class="fas fa-chart-line text-5xl mb-3 block text-gray-200"></i><p>Belum ada konten trending.</p></div>`;
    return;
  }
  el.innerHTML = contents.map((c,i) => `
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
  `).join('');
}
 
function renderDisimpan() {
  const contents = DB.getArr('contents').filter(c=>c.bookmarked);
  const links = DB.getArr('linkwebs').filter(l=>l.bookmarked);
  const grid = document.getElementById('disimpan-grid');
  const empty = document.getElementById('disimpan-empty');
  const all = [...contents, ...links];
  if (!all.length) { grid.innerHTML=''; empty.classList.remove('hidden'); return; }
  empty.classList.add('hidden');
  grid.innerHTML = [
    ...contents.map(c=>contentCard(c)),
    ...links.map(l=>`<div class="col-span-1">${linkCard(l)}</div>`)
  ].join('');
}
 
function renderDiskusi() {
  const posts = DB.getArr('discussions');
  const list = document.getElementById('diskusi-list');
  const empty = document.getElementById('diskusi-empty');
  if (!posts.length) { list.innerHTML=''; empty.classList.remove('hidden'); return; }
  empty.classList.add('hidden');
  list.innerHTML = posts.map(p => {
    const isOwner = CURRENT_USER && p.userId === CURRENT_USER.id;
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
  `}).join('');

  // Tutup dropdown kalau klik di luar
  document.addEventListener('click', closeAllPostMenus, { once: true });
}
 
function renderAnalyst() {
  const projects = DB.getArr('projects');
  const list = document.getElementById('projects-list');
  const perfList = document.getElementById('perf-list');
 
  if (!projects.length) {
    list.innerHTML = `<p class="text-gray-400 text-sm py-4 text-center">Belum ada project. Tambah yang pertama!</p>`;
    perfList.innerHTML = '';
  } else {
    list.innerHTML = projects.map(p => {
      const s = {live:'badge-green',development:'badge-yellow',archived:'badge-blue'}[p.status]||'badge-blue';
      const sl = {live:'✓ Live',development:'⏳ Dev',archived:'Arsip'}[p.status]||p.status;
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
      `;
    }).join('');
 
    perfList.innerHTML = projects.map(p => `
      <div>
        <div class="flex justify-between mb-1.5">
          <p class="text-sm font-bold text-black">${p.name}</p>
          <p class="text-sm font-bold text-black">${p.performanceScore}%</p>
        </div>
        <div class="progress"><div class="progress-bar" style="width:${p.performanceScore}%"></div></div>
      </div>
    `).join('');
  }
 
  const live = projects.filter(p=>p.status==='live');
  const dev = projects.filter(p=>p.status==='development');
  document.getElementById('stat-total').textContent = projects.length;
  document.getElementById('stat-live').textContent = live.length;
  document.getElementById('stat-dev').textContent = dev.length;
  document.getElementById('stat-visits').textContent = projects.reduce((a,p)=>a+p.visitCount,0).toLocaleString();
  const avgPerf = projects.length ? Math.round(projects.reduce((a,p)=>a+p.performanceScore,0)/projects.length) : 0;
  const avgUptime = live.length ? (live.reduce((a,p)=>a+p.uptimePercent,0)/live.length).toFixed(0)+'%' : '—';
  document.getElementById('stat-avgperf').textContent = projects.length ? avgPerf+'%' : '—';
  document.getElementById('stat-uptime').textContent = avgUptime;
}
 
function renderProfil() {
  if (!CURRENT_USER) { 
    openAuthModal(); 
    return; 
  }
  
  // Jika CURRENT_PROFILE belum ada, tunggu atau ambil ulang
  if (!CURRENT_PROFILE) {
    setTimeout(renderProfil, 500);
    return;
  }
  
  // Gunakan CURRENT_PROFILE langsung dari Supabase
  const profile = CURRENT_PROFILE;
  const contents = DB.getArr('contents').filter(c => c.userId === CURRENT_USER.id);
  const discussions = DB.getArr('discussions').filter(d => d.userId === CURRENT_USER.id);
 
  // Update UI dengan data dari Supabase
  document.getElementById('profil-name').textContent = profile.full_name || profile.username || 'Pengguna';
  document.getElementById('profil-username').textContent = '@' + (profile.username || 'user');
  document.getElementById('profil-bio').textContent = profile.bio || 'Tidak ada bio';
  document.getElementById('info-location').textContent = profile.location || 'Tidak disebutkan';
  document.getElementById('info-occupation').textContent = profile.occupation || 'Tidak disebutkan';
  document.getElementById('info-techstack').textContent = profile.tech_stack || 'Tidak disebutkan';
  document.getElementById('info-interests').textContent = profile.interests || 'Tidak disebutkan';
 
  // Avatar
  if (profile.avatar_url) {
    document.getElementById('avatar-img').src = profile.avatar_url;
    document.getElementById('avatar-img').classList.remove('hidden');
    document.getElementById('avatar-initial').classList.add('hidden');
  } else {
    const initial = (profile.full_name || profile.username || 'U')[0].toUpperCase();
    document.getElementById('avatar-initial').textContent = initial;
    document.getElementById('avatar-img').classList.add('hidden');
    document.getElementById('avatar-initial').classList.remove('hidden');
  }
  
  // Cover
  if (profile.cover_url) {
    const coverImg = document.getElementById('cover-img');
    coverImg.src = profile.cover_url;
    coverImg.classList.remove('hidden');
  } else {
    document.getElementById('cover-img').classList.add('hidden');
  }
 
  // Stats
  document.getElementById('stat-followers').textContent = profile.followers_count || 0;
  document.getElementById('stat-following').textContent = profile.following_count || 0;
  document.getElementById('stat-posts').textContent = contents.length;
  document.getElementById('stat-likes-total').textContent = contents.reduce((a,c)=>a+(c.likes||0), 0);
  document.getElementById('stat-comments').textContent = discussions.reduce((a,d)=>a+(d.comments||0), 0);
  document.getElementById('stat-shares').textContent = discussions.reduce((a,d)=>a+(d.shares||0), 0);
 
  renderRecentUploads();
  renderProfilKonten();
  renderProfilDiskusi();
}

// Render grid konten milik user di halaman profil
function renderProfilKonten() {
  const grid = document.getElementById('profil-konten-grid');
  if (!grid) return;
  const myContents = DB.getArr('contents').filter(c => c.userId === CURRENT_USER?.id || !c.userId);
  // Fallback: tampilkan semua kalau userId belum ter-set (data lama)
  const displayContents = myContents.length > 0 ? myContents : DB.getArr('contents');

  if (!displayContents.length) {
    grid.innerHTML = `
      <div class="col-span-4 text-center py-16 text-gray-400">
        <i class="fas fa-cloud-upload-alt text-5xl mb-4 block text-gray-200"></i>
        <p class="font-bold text-lg">Belum ada konten</p>
        <p class="text-sm mt-1">Upload konten pertamamu!</p>
        <button onclick="openUploadModal()" class="mt-4 bg-black text-white px-6 py-2.5 rounded-xl font-bold text-sm hover:bg-zinc-800 transition">
          <i class="fas fa-upload mr-2"></i>Upload Sekarang
        </button>
      </div>`;
    return;
  }

  const fileIconsMap = {image:'fas fa-image',video:'fas fa-video',pdf:'fas fa-file-pdf',doc:'fas fa-file-word',docx:'fas fa-file-word'};
  grid.innerHTML = displayContents.map(c => {
    const icon = fileIconsMap[c.fileType] || 'fas fa-file';
    return `
      <div class="group relative rounded-2xl overflow-hidden border border-gray-100 shadow-sm hover:shadow-lg transition bg-white">
        <!-- Thumbnail -->
        <div class="aspect-[4/3] bg-zinc-100 relative overflow-hidden cursor-pointer" onclick="showContentDetail('${c.id}')">
          ${c.thumbUrl
            ? `<img src="${c.thumbUrl}" class="w-full h-full object-cover group-hover:scale-105 transition duration-300">`
            : `<div class="w-full h-full flex items-center justify-center"><i class="${icon} text-4xl text-gray-300"></i></div>`}
          <div class="absolute inset-0 bg-black/0 group-hover:bg-black/30 transition flex items-center justify-center">
            <i class="fas fa-eye text-white opacity-0 group-hover:opacity-100 transition text-2xl"></i>
          </div>
          <!-- 3-dot menu -->
          <div class="absolute top-2 right-2 opacity-0 group-hover:opacity-100 transition" onclick="event.stopPropagation()">
            <div class="relative" id="content-menu-wrap-${c.id}">
              <button onclick="toggleContentMenu('${c.id}')"
                class="w-8 h-8 rounded-full bg-black/60 hover:bg-black flex items-center justify-center text-white text-xs">
                <i class="fas fa-ellipsis-v"></i>
              </button>
              <div id="content-menu-${c.id}" class="hidden absolute right-0 top-9 z-50 bg-white border border-gray-100 rounded-2xl shadow-xl py-2 min-w-[150px]">
                <button onclick="openEditKonten('${c.id}');toggleContentMenu('${c.id}')"
                  class="w-full flex items-center gap-2 px-4 py-2.5 text-sm hover:bg-gray-50 text-black font-medium">
                  <i class="fas fa-pen w-4 text-center text-blue-500"></i> Edit Konten
                </button>
                <button onclick="deleteKonten('${c.id}')"
                  class="w-full flex items-center gap-2 px-4 py-2.5 text-sm hover:bg-red-50 text-red-500 font-medium">
                  <i class="fas fa-trash w-4 text-center"></i> Hapus
                </button>
              </div>
            </div>
          </div>
        </div>
        <!-- Info -->
        <div class="p-3">
          <h3 class="font-bold text-black text-sm truncate mb-1" title="${c.title}">${c.title}</h3>
          <p class="text-xs text-gray-400 truncate mb-2">${c.description || 'Tidak ada deskripsi'}</p>
          <div class="flex items-center justify-between text-xs text-gray-400">
            <span><i class="fas fa-eye mr-1"></i>${c.views}</span>
            <span><i class="fas fa-heart mr-1 text-red-400"></i>${c.likes}</span>
            <span class="uppercase bg-gray-100 px-2 py-0.5 rounded-full font-medium">${c.fileType||'file'}</span>
          </div>
        </div>
      </div>`;
  }).join('');
}

// Render diskusi milik user di halaman profil
function renderProfilDiskusi() {
  const actEl = document.getElementById('profil-activity');
  if (!actEl) return;
  const profile = DB.get('user_profile') || {};
  const allDisc = DB.getArr('discussions').filter(d => d.userId === CURRENT_USER?.id);
  if (!allDisc.length) {
    actEl.innerHTML = `<p class="text-gray-400 text-sm py-6 text-center">Belum ada diskusi.</p>`;
    return;
  }
  actEl.innerHTML = allDisc.map(d => `
    <div class="post-item" id="post-${d.id}">
      <div class="flex gap-4 mb-3">
        ${avatarEl(profile.name || 'S', profile.avatarUrl)}
        <div class="flex-1">
          <p class="font-bold text-black">${profile.name||'San Pelong'}</p>
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
  `).join('');
}

// Tab switcher profil
function switchProfilTab(tab) {
  const kontenPanel = document.getElementById('profil-panel-konten');
  const diskusiPanel = document.getElementById('profil-panel-diskusi');
  const kontenBtn = document.getElementById('profil-tab-konten');
  const diskusiBtn = document.getElementById('profil-tab-diskusi');
  if (tab === 'konten') {
    kontenPanel.classList.remove('hidden');
    diskusiPanel.classList.add('hidden');
    kontenBtn.classList.add('text-black', 'border-black');
    kontenBtn.classList.remove('text-gray-400', 'border-transparent');
    diskusiBtn.classList.remove('text-black', 'border-black');
    diskusiBtn.classList.add('text-gray-400', 'border-transparent');
  } else {
    diskusiPanel.classList.remove('hidden');
    kontenPanel.classList.add('hidden');
    diskusiBtn.classList.add('text-black', 'border-black');
    diskusiBtn.classList.remove('text-gray-400', 'border-transparent');
    kontenBtn.classList.remove('text-black', 'border-black');
    kontenBtn.classList.add('text-gray-400', 'border-transparent');
  }
}
 
function renderRecentUploads() {
  const contents = DB.getArr('contents').slice(0,3);
  const links = DB.getArr('linkwebs').slice(0,2);
  const el = document.getElementById('recent-uploads');
  const fileIconsMap = {image:'fas fa-file-image text-orange-400',video:'fas fa-file-video text-purple-400',pdf:'fas fa-file-pdf text-red-400',doc:'fas fa-file-word text-blue-400'};
  const all = [
    ...contents.map(c=>({icon:fileIconsMap[c.fileType]||'fas fa-file text-gray-400',name:c.title,size:c.fileType?.toUpperCase()||'FILE',type:'content'})),
    ...links.map(l=>({icon:'fas fa-link text-green-500',name:l.title,size:'LINK',type:'link'})),
  ].slice(0,4);
  if (!all.length) { el.innerHTML = `<p class="text-xs text-gray-400">Belum ada upload</p>`; return; }
  el.innerHTML = all.map(f=>`
    <div class="flex items-center gap-2 p-2 hover:bg-gray-50 rounded-lg">
      <i class="${f.icon} w-5 text-center"></i>
      <p class="text-xs text-gray-700 flex-1 truncate">${f.name}</p>
      <span class="text-xs text-gray-400 flex-shrink-0">${f.size}</span>
    </div>
  `).join('');
}
 
function renderPengaturan() {
  const dbStats = document.getElementById('db-stats');
  const contents = DB.getArr('contents');
  const links = DB.getArr('linkwebs');
  const projects = DB.getArr('projects');
  const discussions = DB.getArr('discussions');
  const cats = DB.getArr('categories');
  dbStats.innerHTML = [
    ['Konten Upload', contents.length, 'fas fa-file-alt text-blue-500'],
    ['Link Web', links.length, 'fas fa-link text-green-500'],
    ['Projects', projects.length, 'fas fa-rocket text-purple-500'],
    ['Diskusi', discussions.length, 'fas fa-comments text-yellow-500'],
    ['Kategori', cats.length, 'fas fa-th-large text-gray-500'],
  ].map(([label,count,icon])=>`
    <div class="flex items-center justify-between p-3 bg-gray-50 rounded-xl">
      <div class="flex items-center gap-3">
        <i class="${icon}"></i>
        <span class="text-sm font-bold">${label}</span>
      </div>
      <span class="font-bold text-black">${count}</span>
    </div>
  `).join('');
}
 
// ============================
// ACTIONS
// ============================
async function toggleBookmark(contentId) {
  if (!CURRENT_USER) { openAuthModal(); toast('⚠️ Login dulu untuk menyimpan konten'); return }
  const saved = await window._SB.toggleSave(CURRENT_USER.id, contentId, 'content')
  const contents = DB.getArr('contents')
  const idx = contents.findIndex(c => c.id === contentId)
  if (idx >= 0) {
    contents[idx].bookmarked = saved
    DB.set('contents', contents)
  }
  toast(saved ? '🔖 Disimpan ke koleksi' : 'Dihapus dari koleksi')
  renderPage(getCurrentPage())
}
 
function likePost(postId) {
  const posts = DB.getArr('discussions');
  const idx = posts.findIndex(p=>p.id===postId);
  if (idx>=0) { posts[idx].likes++; DB.set('discussions', posts); renderDiskusi(); }
}

// ============================
// POST EDIT / DELETE
// ============================
function togglePostMenu(postId) {
  const menu = document.getElementById('post-menu-' + postId);
  if (!menu) return;
  const isHidden = menu.classList.contains('hidden');
  // Tutup semua menu dulu
  document.querySelectorAll('[id^="post-menu-"]').forEach(m => m.classList.add('hidden'));
  if (isHidden) {
    menu.classList.remove('hidden');
    // Satu kali klik di luar = tutup
    setTimeout(() => {
      document.addEventListener('click', function handler(e) {
        if (!menu.contains(e.target) && e.target.id !== 'btn-menu-' + postId) {
          menu.classList.add('hidden');
          document.removeEventListener('click', handler);
        }
      });
    }, 50);
  }
}

function closeAllPostMenus() {
  document.querySelectorAll('[id^="post-menu-"]').forEach(m => m.classList.add('hidden'));
}

function openEditPost(postId) {
  const posts = DB.getArr('discussions');
  const post = posts.find(p => p.id === postId);
  if (!post) return;

  // Buat modal edit inline kalau belum ada
  let modal = document.getElementById('modal-edit-post');
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
    `);
    modal = document.getElementById('modal-edit-post');
  }

  document.getElementById('edit-post-id').value = postId;
  document.getElementById('edit-post-content').value = post.content;

  // Update avatar di modal
  const avatarEl2 = document.getElementById('edit-post-avatar');
  if (avatarEl2 && CURRENT_PROFILE) {
    avatarEl2.outerHTML = avatarEl(CURRENT_PROFILE.username, CURRENT_PROFILE.avatar_url)
      .replace('class="', 'id="edit-post-avatar" class="');
  }

  openModal('modal-edit-post');
}

async function saveEditPost() {
  const postId = document.getElementById('edit-post-id').value;
  const newContent = document.getElementById('edit-post-content').value.trim();
  if (!newContent) { toast('⚠️ Konten tidak boleh kosong'); return; }

  // Update Supabase
  try {
    await window._SB.updatePost(postId, { content: newContent });
  } catch(e) { /* fallback ke localStorage saja */ }

  // Update localStorage
  const posts = DB.getArr('discussions');
  const idx = posts.findIndex(p => p.id === postId);
  if (idx >= 0) { posts[idx].content = newContent; DB.set('discussions', posts); }

  toast('✅ Post berhasil diperbarui!');
  closeModal('modal-edit-post');

  // Re-render halaman aktif
  const page = getCurrentPage();
  if (page === 'diskusi') renderDiskusi();
  else if (page === 'profil') renderProfil();
}

async function deletePost(postId) {
  if (!confirm('Yakin hapus postingan ini?')) return;

  try {
    await window._SB.deletePost(postId);
  } catch(e) { /* fallback */ }

  const posts = DB.getArr('discussions').filter(p => p.id !== postId);
  DB.set('discussions', posts);

  toast('🗑️ Postingan dihapus');

  const page = getCurrentPage();
  if (page === 'diskusi') renderDiskusi();
  else if (page === 'profil') renderProfil();
}

// ============================
// KONTEN EDIT / DELETE (di halaman Profil)
// ============================
function toggleContentMenu(contentId) {
  const menu = document.getElementById('content-menu-' + contentId);
  if (!menu) return;
  const isHidden = menu.classList.contains('hidden');
  document.querySelectorAll('[id^="content-menu-"]').forEach(m => m.classList.add('hidden'));
  if (isHidden) {
    menu.classList.remove('hidden');
    setTimeout(() => {
      document.addEventListener('click', function handler(e) {
        if (!menu.contains(e.target)) {
          menu.classList.add('hidden');
          document.removeEventListener('click', handler);
        }
      });
    }, 50);
  }
}

function openEditKonten(contentId) {
  const contents = DB.getArr('contents');
  const c = contents.find(c => c.id === contentId);
  if (!c) return;

  populateCategorySelects();
  document.getElementById('edit-konten-id').value = contentId;
  document.getElementById('edit-konten-title').value = c.title || '';
  document.getElementById('edit-konten-desc').value = c.description || '';
  document.getElementById('edit-konten-url').value = c.webUrl || '';

  // Set kategori
  const catSel = document.getElementById('edit-konten-category');
  if (catSel && c.categoryId) catSel.value = c.categoryId;

  openModal('modal-edit-konten');
}

async function saveEditKonten() {
  const contentId = document.getElementById('edit-konten-id').value;
  const title = document.getElementById('edit-konten-title').value.trim();
  if (!title) { toast('⚠️ Judul tidak boleh kosong'); return; }

  const updates = {
    name: title,
    description: document.getElementById('edit-konten-desc').value.trim(),
    category_id: document.getElementById('edit-konten-category').value || null,
    display_url: document.getElementById('edit-konten-url').value.trim() || null,
  };

  try {
    await window._SB.updateContent(contentId, updates);
  } catch(e) { /* fallback ke localStorage */ }

  const contents = DB.getArr('contents');
  const idx = contents.findIndex(c => c.id === contentId);
  if (idx >= 0) {
    contents[idx].title = title;
    contents[idx].description = updates.description;
    contents[idx].categoryId = updates.category_id;
    contents[idx].webUrl = updates.display_url;
    DB.set('contents', contents);
  }

  toast('✅ Konten berhasil diperbarui!');
  closeModal('modal-edit-konten');
  renderProfil();
}

async function deleteKonten(contentId) {
  if (!confirm('Yakin hapus konten ini? Tindakan ini tidak bisa dibatalkan.')) return;

  try {
    await window._SB.deleteContent(contentId);
  } catch(e) { /* fallback */ }

  const contents = DB.getArr('contents').filter(c => c.id !== contentId);
  DB.set('contents', contents);

  toast('🗑️ Konten dihapus');
  renderProfil();
  // Update stat di halaman lain juga
  renderBeranda();
}
 
function showContentDetail(id) {
  const contents = DB.getArr('contents');
  const c = contents.find(c => c.id === id);
  if (!c) return;
  
  const fileIconMap = {
    image: 'fas fa-file-image text-white',
    video: 'fas fa-file-video text-white',
    pdf: 'fas fa-file-pdf text-white',
    doc: 'fas fa-file-word text-white',
    docx: 'fas fa-file-word text-white'
  };
  const fileIcon = fileIconMap[c.fileType] || 'fas fa-file text-white';
 
  const idx = contents.findIndex(cc => cc.id === id);
  if (idx >= 0) { contents[idx].views++; DB.set('contents', contents); }
 
  if (!c.comments) { contents[idx].comments = []; DB.set('contents', contents); }
  if (!c.ratings)  { contents[idx].ratings = []; DB.set('contents', contents); }
 
  const comments = DB.getArr('contents').find(cc => cc.id === id).comments || [];
  const ratings = DB.getArr('contents').find(cc => cc.id === id).ratings || [];
  const avgRating = ratings.length ? (ratings.reduce((a,b) => a + b.score, 0) / ratings.length).toFixed(1) : null;
  
  const fileMetaExtra = c.fileName
    ? `<div class="bg-gray-50 rounded-xl p-3"><p class="text-xs text-gray-400 mb-0.5">Nama File</p><p class="text-sm font-semibold text-black truncate">${c.fileName}</p></div>
       <div class="bg-gray-50 rounded-xl p-3"><p class="text-xs text-gray-400 mb-0.5">Ukuran</p><p class="text-sm font-semibold text-black">${c.fileSize ? formatSize(c.fileSize) : '-'}</p></div>`
    : '';
 
  const webUrlBlock = c.webUrl
    ? `<a href="${c.webUrl}" target="_blank" rel="noopener" class="flex items-center gap-2 bg-blue-50 border border-blue-200 rounded-xl px-4 py-3 mb-4 text-sm text-blue-700 hover:bg-blue-100 transition"><i class="fas fa-external-link-alt"></i><span class="truncate flex-1">${c.webUrl}</span><span class="text-xs font-semibold flex-shrink-0">Buka →</span></a>`
    : '';
 
  const pdfOpenBtn = c.fileType === 'pdf'
    ? `<button onclick="togglePdfViewer('${c.id}')" class="flex-1 flex items-center justify-center gap-2 bg-black text-white text-sm py-3 rounded-xl font-semibold hover:bg-gray-800 transition"><i class="fas fa-file-pdf"></i> Buka PDF</button>`
    : '';
 
  const pdfViewerBlock = c.fileType === 'pdf' && c.fileData
    ? `<div id="pdf-viewer-${c.id}" class="hidden mb-6"><div class="flex items-center justify-between mb-2"><span class="text-sm font-semibold text-black">Preview PDF</span><button onclick="togglePdfViewer('${c.id}')" class="text-xs text-gray-400 hover:text-black"><i class="fas fa-times"></i> Tutup</button></div><iframe src="${c.fileData}" class="w-full rounded-2xl border border-gray-200" style="height:70vh;" title="${c.title}"></iframe></div>`
    : '';
 
  const fileActionsBlock = c.fileData
    ? `<div class="flex gap-3 mb-4">${pdfOpenBtn}<button onclick="downloadContent('${c.id}')" class="flex-1 flex items-center justify-center gap-2 bg-gray-100 text-black text-sm py-3 rounded-xl font-semibold hover:bg-gray-200 transition"><i class="fas fa-download"></i> Download</button></div>${pdfViewerBlock}`
    : `<div class="flex items-center gap-2 bg-yellow-50 border border-yellow-200 rounded-xl px-4 py-3 mb-4 text-sm text-yellow-700"><i class="fas fa-info-circle"></i><span>Konten ini tidak memiliki file yang diunggah.</span></div>`;
 
  const stars = (score, interactive = false, name = '') => [1, 2, 3, 4, 5].map(i =>
    interactive
      ? `<i class="${i <= score ? 'fas' : 'far'} fa-star text-yellow-400 cursor-pointer text-lg" onmouseover="hoverStar(this,${i})" onmouseout="resetStars('${name}')" onclick="setStar('${name}',${i})"></i>`
      : `<i class="${i <= Math.round(score) ? 'fas' : 'far'} fa-star text-yellow-400 text-sm"></i>`
  ).join('');
 
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
    : `<div class="text-center py-10 text-gray-400"><i class="far fa-comment-dots text-3xl mb-2 block"></i><p class="text-sm">Belum ada komentar. Jadilah yang pertama!</p></div>`;
 
  const html = `
    <div id="content-detail-modal" class="fixed inset-0 z-50 bg-black/60 backdrop-blur-sm flex items-end sm:items-center justify-center p-0 sm:p-4" onclick="if(event.target===this)closeContentDetail()">
      <div class="bg-white w-full sm:max-w-xl rounded-t-3xl sm:rounded-3xl max-h-[95vh] flex flex-col overflow-hidden shadow-2xl">
        <div class="flex items-center justify-between px-5 pt-4 pb-2 flex-shrink-0">
          <button onclick="closeContentDetail()" class="w-9 h-9 rounded-full bg-gray-100 flex items-center justify-center hover:bg-gray-200 transition">
            <i class="fas fa-arrow-left text-sm text-gray-700"></i>
          </button>
          <span class="text-xs font-medium text-gray-400 uppercase tracking-widest">${c.fileType || 'Konten'}</span>
          <button onclick="toggleBookmark('${c.id}');closeContentDetail();showContentDetail('${c.id}')" class="w-9 h-9 rounded-full bg-gray-100 flex items-center justify-center hover:bg-gray-200 transition">
            <i class="${c.bookmarked ? 'fas text-black' : 'far text-gray-400'} fa-bookmark text-sm"></i>
          </button>
        </div>
        <div class="overflow-y-auto flex-1 px-5 pb-8">
          <div class="w-full aspect-[3/2] rounded-2xl overflow-hidden bg-zinc-900 flex items-center justify-center mb-5 relative">
            ${c.thumbUrl
              ? `<img src="${c.thumbUrl}" class="w-full h-full object-cover">`
              : `<i class="${fileIcon} text-6xl text-white opacity-30"></i>`}
            <div class="absolute inset-0 bg-gradient-to-t from-black/60 to-transparent"></div>
            <div class="absolute bottom-4 left-4 right-4">
              <h2 class="text-white text-xl font-bold leading-tight drop-shadow">${c.title}</h2>
            </div>
          </div>
          <div class="flex items-center gap-3 mb-4">
            ${avgRating
              ? `<div class="flex items-center gap-1.5">
                  <span class="text-2xl font-bold text-black">${avgRating}</span>
                  <div class="flex flex-col gap-0.5">
                    <div class="flex">${stars(avgRating)}</div>
                    <span class="text-xs text-gray-400">${ratings.length} ulasan</span>
                  </div>
                </div>`
              : `<span class="text-sm text-gray-400 italic">Belum ada penilaian</span>`}
            <div class="ml-auto flex items-center gap-3 text-sm text-gray-500">
              <span><i class="fas fa-eye mr-1 text-gray-400"></i>${c.views}</span>
              <span><i class="fas fa-heart mr-1 text-red-400"></i>${c.likes}</span>
            </div>
          </div>
          <div class="mb-6">
            <h3 class="text-sm font-semibold text-black mb-2">Tentang Konten</h3>
            <p class="text-sm text-gray-600 leading-relaxed">${c.description || 'Tidak ada deskripsi tersedia.'}</p>
          </div>
          <div class="grid grid-cols-2 gap-3 mb-4">
            <div class="bg-gray-50 rounded-xl p-3">
              <p class="text-xs text-gray-400 mb-0.5">Tipe File</p>
              <p class="text-sm font-semibold text-black uppercase">${c.fileType || '-'}</p>
            </div>
            <div class="bg-gray-50 rounded-xl p-3">
              <p class="text-xs text-gray-400 mb-0.5">Diunggah</p>
              <p class="text-sm font-semibold text-black">${new Date(c.createdAt).toLocaleDateString('id-ID', { day: 'numeric', month: 'short', year: 'numeric' })}</p>
            </div>
            ${fileMetaExtra}
          </div>
          ${webUrlBlock}
          ${fileActionsBlock}
          <div class="bg-gray-50 rounded-2xl p-4 mb-6">
            <h3 class="text-sm font-semibold text-black mb-3">Beri Penilaian</h3>
            <div id="star-input-${c.id}" data-score="0" class="flex gap-1 mb-3">
              ${stars(0, true, c.id)}
            </div>
            <input id="comment-author-${c.id}" type="text" placeholder="Nama kamu" class="w-full border border-gray-200 rounded-xl px-3 py-2 text-sm outline-none mb-2 bg-white">
            <textarea id="comment-text-${c.id}" placeholder="Tulis komentar..." rows="3" class="w-full border border-gray-200 rounded-xl px-3 py-2 text-sm outline-none resize-none bg-white mb-3"></textarea>
            <button onclick="submitComment('${c.id}')" class="w-full bg-black text-white text-sm py-2.5 rounded-xl font-semibold hover:bg-gray-800 transition">
              Kirim Komentar
            </button>
          </div>
          <div>
            <h3 class="text-sm font-semibold text-black mb-1">Komentar <span class="text-gray-400 font-normal">(${comments.length})</span></h3>
            <div id="comments-list-${c.id}">
              ${commentsHtml}
            </div>
          </div>
        </div>
      </div>
    </div>`;
 
  document.body.insertAdjacentHTML('beforeend', html);
}
 
function togglePdfViewer(contentId) {
  const viewer = document.getElementById(`pdf-viewer-${contentId}`);
  if (!viewer) return;
  viewer.classList.toggle('hidden');
  if (!viewer.classList.contains('hidden')) {
    viewer.scrollIntoView({ behavior: 'smooth', block: 'start' });
  }
}
 
function downloadContent(contentId) {
  const c = DB.getArr('contents').find(c => c.id === contentId);
  if (!c || !c.fileData) { toast('⚠️ Tidak ada file untuk diunduh'); return; }
  const a = document.createElement('a');
  a.href = c.fileData;
  a.download = c.fileName || c.title;
  a.click();
  toast('⬇️ Mengunduh file...');
}
 
function closeContentDetail() {
  const modal = document.getElementById('content-detail-modal');
  if (modal) modal.remove();
}
 
function hoverStar(el, score) {
  const container = el.parentElement;
  [...container.querySelectorAll('i')].forEach((s, i) => {
    s.className = `${i < score ? 'fas' : 'far'} fa-star text-yellow-400 cursor-pointer text-lg`;
  });
}
 
function resetStars(contentId) {
  const container = document.getElementById(`star-input-${contentId}`);
  if (!container) return;
  const score = parseInt(container.dataset.score) || 0;
  [...container.querySelectorAll('i')].forEach((s, i) => {
    s.className = `${i < score ? 'fas' : 'far'} fa-star text-yellow-400 cursor-pointer text-lg`;
  });
}
 
function setStar(contentId, score) {
  const container = document.getElementById(`star-input-${contentId}`);
  if (!container) return;
  container.dataset.score = score;
  [...container.querySelectorAll('i')].forEach((s, i) => {
    s.className = `${i < score ? 'fas' : 'far'} fa-star text-yellow-400 cursor-pointer text-lg`;
  });
}
 
function submitComment(contentId) {
  const author = document.getElementById(`comment-author-${contentId}`).value.trim();
  const text = document.getElementById(`comment-text-${contentId}`).value.trim();
  const score = parseInt(document.getElementById(`star-input-${contentId}`)?.dataset.score) || 0;
 
  if (!author) { toast('⚠️ Masukkan nama kamu'); return; }
  if (!text) { toast('⚠️ Tulis komentar dulu'); return; }
  if (!score) { toast('⚠️ Beri bintang dulu'); return; }
 
  const contents = DB.getArr('contents');
  const idx = contents.findIndex(c => c.id === contentId);
  if (idx < 0) return;
 
  if (!contents[idx].comments) contents[idx].comments = [];
  if (!contents[idx].ratings) contents[idx].ratings = [];
 
  contents[idx].comments.unshift({ author, text, rating: score, date: new Date().toISOString() });
  contents[idx].ratings.push({ score });
  DB.set('contents', contents);
 
  closeContentDetail();
  showContentDetail(contentId);
  toast('✅ Komentar berhasil dikirim!');
}
 
// ============================
// SEARCH
// ============================
function handleSearch(q) {
  if (!q.trim()) return;
  const contents = DB.getArr('contents').filter(c => c.title.toLowerCase().includes(q.toLowerCase()));
  const links = DB.getArr('linkwebs').filter(l => l.title.toLowerCase().includes(q.toLowerCase()));
  toast(`${contents.length + links.length} hasil ditemukan`);
}
 
// ============================
// UPLOAD KONTEN
// ============================
function setUploadTab(tab) {
  document.getElementById('tab-konten').classList.toggle('active', tab === 'konten');
  document.getElementById('tab-linkweb').classList.toggle('active', tab === 'linkweb');
  document.getElementById('upload-konten-panel').classList.toggle('hidden', tab !== 'konten');
  document.getElementById('upload-linkweb-panel').classList.toggle('hidden', tab !== 'linkweb');
}
 
function handleMiniFile(input) {
  if (!input.files[0]) return;
  tempFiles.main = input.files[0];
  const el = document.getElementById('mini-file-preview');
  el.classList.remove('hidden');
  document.getElementById('mini-file-name').textContent = input.files[0].name;
  document.getElementById('mini-file-size').textContent = formatSize(input.files[0].size);
}
 
function handleMiniDrop(e) {
  e.preventDefault();
  e.currentTarget.classList.remove('hover');
  const f = e.dataTransfer.files[0];
  if (f) { tempFiles.main = f; document.getElementById('mini-file').files = e.dataTransfer.files; handleMiniFile({files:[f]}); }
}
 
function clearMiniFile() {
  tempFiles.main = null;
  document.getElementById('mini-file-preview').classList.add('hidden');
  document.getElementById('mini-file').value = '';
}
 
function handleMainFile(input) {
  if (!input.files[0]) return;
  tempFiles.main = input.files[0];
  document.getElementById('main-file-info').classList.remove('hidden');
  document.getElementById('main-file-name').textContent = input.files[0].name;
  document.getElementById('main-file-size').textContent = formatSize(input.files[0].size);
  const ext = input.files[0].name.split('.').pop().toLowerCase();
  const icons = {png:'fas fa-file-image text-orange-400',jpg:'fas fa-file-image text-orange-400',jpeg:'fas fa-file-image text-orange-400',gif:'fas fa-file-image text-orange-400',webp:'fas fa-file-image text-orange-400',mp4:'fas fa-file-video text-purple-400',pdf:'fas fa-file-pdf text-red-400',doc:'fas fa-file-word text-blue-400',docx:'fas fa-file-word text-blue-400'};
  document.getElementById('main-file-icon').className = icons[ext] || 'fas fa-file text-gray-400';
  document.getElementById('main-file-icon').className += ' text-xl';
}
 
function handleMainDrop(e) {
  e.preventDefault();
  e.currentTarget.classList.remove('hover');
  const f = e.dataTransfer.files[0];
  if (f) { tempFiles.main = f; handleMainFile({files:[f]}); }
}
 
function clearMainFile() {
  tempFiles.main = null;
  document.getElementById('main-file-info').classList.add('hidden');
}
 
function handleThumbFile(input) {
  if (!input.files[0]) return;
  tempFiles.thumbFile = input.files[0];
  const reader = new FileReader();
  reader.onload = e => {
    tempFiles.thumb = e.target.result;
    document.getElementById('thumb-preview').src = e.target.result;
    document.getElementById('thumb-preview').classList.remove('hidden');
    document.getElementById('thumb-icon-placeholder').classList.add('hidden');
  };
  reader.readAsDataURL(input.files[0]);
}
 
function handleLinkIcon(input) {
  if (!input.files[0]) return;
  tempFiles.linkIcon = input.files[0];
  const reader = new FileReader();
  reader.onload = e => {
    document.getElementById('lk-icon-preview').src = e.target.result;
    document.getElementById('lk-icon-preview').classList.remove('hidden');
    document.getElementById('lk-icon-placeholder').classList.add('hidden');
  };
  reader.readAsDataURL(input.files[0]);
}
 
async function submitUpload() {
  const title = document.getElementById('up-title').value.trim();
  const catId = document.getElementById('up-category').value;
  const desc = document.getElementById('up-desc').value.trim();
  if (!title) { toast('⚠️ Judul wajib diisi!'); return; }
 
  let fileUrl = null, thumbUrl = null, fileType = 'doc';
 
  if (tempFiles.main) {
    const ext = tempFiles.main.name.split('.').pop().toLowerCase();
    const typeMap = {png:'image',jpg:'image',jpeg:'image',gif:'image',webp:'image',mp4:'video',pdf:'pdf',doc:'doc',docx:'docx'};
    fileType = typeMap[ext] || 'doc';
    toast('⏳ Mengupload file...');
    fileUrl = await window._SB.uploadContentFile(CURRENT_USER.id, tempFiles.main);
  }
 
  if (tempFiles.thumbFile) {
    toast('⏳ Mengupload thumbnail...');
    thumbUrl = await window._SB.uploadThumbnail(CURRENT_USER.id, tempFiles.thumbFile);
  }
 
  const content = await window._SB.addContent(CURRENT_USER.id, {
    name: title,
    description: desc,
    category_id: catId || null,
    icon_type: fileType,
    file_url: fileUrl,
    preview_image: thumbUrl || null,
    display_url: document.getElementById('up-url').value.trim() || null,
    status: 'published'
  });
 
  DB.pushArr('contents', {
    id: content.id, userId: CURRENT_PROFILE.id, categoryId: catId,
    title, description: desc, fileType,
    authorName: CURRENT_PROFILE?.username || '',
    authorAvatar: CURRENT_PROFILE?.avatar_url || '',
    fileData: fileUrl, thumbUrl: thumbUrl || '',
    views: 0, likes: 0, bookmarked: false,
    createdAt: content.created_at
  });
 
  toast('✅ Konten berhasil diupload!');
  closeModal('modal-upload');
  resetUploadForm();
  renderPage(getCurrentPage());
}
 
async function submitLink() {
  const title = document.getElementById('lk-title').value.trim();
  const url = document.getElementById('lk-url').value.trim();
  if (!title || !url) { toast('⚠️ Judul dan URL wajib diisi!'); return; }
 
  let iconUrl = '';
  if (tempFiles.linkIcon) {
    toast('⏳ Mengupload icon...');
    const ext = tempFiles.linkIcon.name.split('.').pop();
    const path = `links/${CURRENT_USER.id}/${Date.now()}.${ext}`;
    const { error } = await window._SB.supabase.storage.from('avatars').upload(path, tempFiles.linkIcon);
    if (!error) {
      const { data: { publicUrl } } = window._SB.supabase.storage.from('avatars').getPublicUrl(path);
      iconUrl = publicUrl;
    }
  }
 
  const ref = await window._SB.addRef(CURRENT_USER.id, { 
    theme: title, 
    language: url,
    icon_url: iconUrl
  });
 
  DB.pushArr('linkwebs', {
    id: ref.id, userId: CURRENT_USER.id,
    categoryId: document.getElementById('lk-category').value || null,
    title, url,
    description: document.getElementById('lk-desc').value.trim(),
    iconUrl: iconUrl,
    status: document.getElementById('lk-status').value,
    bookmarked: false,
    createdAt: ref.created_at
  });
 
  toast('✅ Link web berhasil disimpan!');
  closeModal('modal-link');
  resetLinkForm();
  renderPage(getCurrentPage());
}
 
async function submitPost() {
  const content = document.getElementById('post-content').value.trim();
  if (!content) { toast('⚠️ Tulis sesuatu dulu!'); return; }
 
  const post = await window._SB.addPost(CURRENT_USER.id, content);
 
  DB.pushArr('discussions', {
    id: post.id, userId: CURRENT_USER.id,
    userName: CURRENT_PROFILE?.username || 'Pengguna',
    content, likes: 0, comments: 0, shares: 0,
    createdAt: post.created_at
  });
 
  document.getElementById('post-content').value = '';
  toast('✅ Post berhasil dipublikasikan!');
  closeModal('modal-post');
  renderDiskusi();
}
 
function submitProject() {
  const name = document.getElementById('proj-name').value.trim();
  if (!name) { toast('⚠️ Nama project wajib diisi!'); return; }
  const newProj = {
    id: DB.uuid(), userId: CURRENT_USER?.id || 'u1', name,
    description: document.getElementById('proj-desc').value.trim(),
    deployUrl: document.getElementById('proj-url').value.trim(),
    techStack: document.getElementById('proj-tech').value.trim(),
    status: document.getElementById('proj-status').value,
    visitCount: 0,
    performanceScore: parseInt(document.getElementById('proj-perf').value) || 80,
    uptimePercent: parseInt(document.getElementById('proj-uptime').value) || 99,
    lastDeployed: new Date().toISOString(),
    createdAt: new Date().toISOString(),
  };
  DB.pushArr('projects', newProj);
  ['proj-name', 'proj-desc', 'proj-url', 'proj-tech', 'proj-perf', 'proj-uptime'].forEach(id => document.getElementById(id).value = '');
  toast('✅ Project berhasil ditambahkan!');
  closeModal('modal-project');
  renderAnalyst();
}
 
function deleteProject(id) {
  const projects = DB.getArr('projects').filter(p => p.id !== id);
  DB.set('projects', projects);
  toast('🗑️ Project dihapus');
  renderAnalyst();
}
 
async function saveEditProfil() {
  const updates = {
    username: document.getElementById('ep-username').value.trim() || CURRENT_PROFILE.username,
    bio: document.getElementById('ep-bio').value.trim(),
    location: document.getElementById('ep-location').value.trim(),
    occupation: document.getElementById('ep-occupation').value.trim(),
    tech_stack: document.getElementById('ep-techstack').value.trim(),
    interests: document.getElementById('ep-interests').value.trim(),
  };
  CURRENT_PROFILE = await window._SB.updateProfile(CURRENT_USER.id, updates);
  DB.set('user_profile', {
    name: CURRENT_PROFILE.username,
    username: CURRENT_PROFILE.username,
    bio: CURRENT_PROFILE.bio || '',
    location: CURRENT_PROFILE.location || '',
    occupation: CURRENT_PROFILE.occupation || '',
    techStack: CURRENT_PROFILE.tech_stack || '',
    interests: CURRENT_PROFILE.interests || '',
    avatarUrl: CURRENT_PROFILE.avatar_url || '',
    coverUrl: CURRENT_PROFILE.cover_url || '',
    followers: 0, following: 0,
  });
  toast('✅ Profil berhasil diperbarui!');
  closeModal('modal-editprofil');
  renderProfil();
}
 
async function uploadAvatar(input) {
  if (!input.files[0]) return;
  toast('⏳ Mengupload foto...');
  const url = await window._SB.uploadAvatarFile(CURRENT_USER.id, input.files[0]);
  await window._SB.updateProfile(CURRENT_USER.id, { avatar_url: url });
  CURRENT_PROFILE.avatar_url = url;
  const profile = DB.get('user_profile') || {};
  profile.avatarUrl = url;
  DB.set('user_profile', profile);
  toast('✅ Foto profil diperbarui!');
  renderProfil();
}
 
async function uploadCover(input) {
  if (!input.files[0]) return;
  toast('⏳ Mengupload cover...');
  const url = await window._SB.uploadCoverFile(CURRENT_USER.id, input.files[0]);
  await window._SB.updateProfile(CURRENT_USER.id, { cover_url: url });
  CURRENT_PROFILE.cover_url = url;
  const profile = DB.get('user_profile') || {};
  profile.coverUrl = url;
  DB.set('user_profile', profile);
  toast('✅ Cover diperbarui!');
  renderProfil();
}
 
function clearAllData() {
  if (!confirm('Yakin hapus semua data? Ini tidak bisa dibatalkan.')) return;
  Object.keys(localStorage).filter(k => k.startsWith('nissanex_')).forEach(k => localStorage.removeItem(k));
  toast('🗑️ Semua data dihapus. Refresh halaman...');
  setTimeout(() => location.reload(), 1500);
}
 
// ============================
// MODAL HELPERS
// ============================
function openUploadModal() {
  if (!CURRENT_USER) { openAuthModal(); toast('⚠️ Login dulu untuk upload konten'); return }
  populateCategorySelects();
  tempFiles = { main: null, thumb: null, thumbFile: null, linkIcon: null };
  openModal('modal-upload');
}
 
function openLinkModal() {
  if (!CURRENT_USER) { openAuthModal(); toast('⚠️ Login dulu untuk menambah link'); return }
  populateCategorySelects();
  tempFiles = { main: null, thumb: null, thumbFile: null, linkIcon: null };
  document.getElementById('lk-icon-preview').classList.add('hidden');
  document.getElementById('lk-icon-placeholder').classList.remove('hidden');
  openModal('modal-link');
}
 
function openPostModal() {
  if (!CURRENT_USER) { openAuthModal(); toast('⚠️ Login dulu untuk posting diskusi'); return }
  openModal('modal-post')
  // Inject avatar user yang login ke modal
  const el = document.getElementById('modal-post-avatar')
  if (el && CURRENT_PROFILE) {
    el.outerHTML = avatarEl(CURRENT_PROFILE.username, CURRENT_PROFILE.avatar_url)
      .replace('class="', 'id="modal-post-avatar" class="')
  }
}
function openProjectModal() { openModal('modal-project'); }
 
function openEditProfil() {
  const profile = DB.get('user_profile') || {};
  document.getElementById('ep-name').value = profile.name || '';
  document.getElementById('ep-username').value = profile.username || '';
  document.getElementById('ep-bio').value = profile.bio || '';
  document.getElementById('ep-location').value = profile.location || '';
  document.getElementById('ep-occupation').value = profile.occupation || '';
  document.getElementById('ep-techstack').value = profile.techStack || '';
  document.getElementById('ep-interests').value = profile.interests || '';
  openModal('modal-editprofil');
}
 
function openModal(id) { document.getElementById(id).classList.add('open'); document.body.style.overflow = 'hidden'; }
function closeModal(id) { document.getElementById(id).classList.remove('open'); document.body.style.overflow = ''; }
function closeModalBackdrop(e, id) { if (e.target.id === id) closeModal(id); }
 
function populateCategorySelects() {
  const cats = DB.getArr('categories');
  const opts = cats.map(c => `<option value="${c.id}">${c.name}</option>`).join('');
  ['up-category', 'lk-category'].forEach(id => {
    const el = document.getElementById(id);
    if (el) el.innerHTML = '<option value="">Pilih kategori...</option>' + opts;
  });
}
 
function resetUploadForm() {
  ['up-title', 'up-desc', 'up-url'].forEach(id => document.getElementById(id).value = '');
  clearMainFile();
  tempFiles = { main: null, thumb: null, thumbFile: null, linkIcon: null };
  document.getElementById('thumb-preview').classList.add('hidden');
  document.getElementById('thumb-icon-placeholder').classList.remove('hidden');
}
 
function resetLinkForm() {
  ['lk-title', 'lk-url', 'lk-desc'].forEach(id => document.getElementById(id).value = '');
  tempFiles.linkIcon = null;
}
 
// ============================
// UTILITIES
// ============================
function toast(msg, duration = 2800) {
  const el = document.getElementById('toast');
  el.textContent = msg;
  el.classList.add('show');
  setTimeout(() => el.classList.remove('show'), duration);
}
 
function formatSize(bytes) {
  if (bytes < 1024) return bytes + 'B';
  if (bytes < 1048576) return (bytes / 1024).toFixed(1) + 'KB';
  return (bytes / 1048576).toFixed(1) + 'MB';
}
 
// Helper: render avatar HTML (foto atau inisial)
function avatarEl(name, avatarUrl, size = 'w-10 h-10', rounded = 'rounded-xl') {
  const initial = (name || 'U')[0].toUpperCase()
  if (avatarUrl) {
    return `<img src="${avatarUrl}" class="${size} ${rounded} object-cover flex-shrink-0" onerror="this.outerHTML='<div class=\\'${size} ${rounded} bg-black flex items-center justify-center text-white font-bold flex-shrink-0 text-sm\\'>${initial}</div>'">`
  }
  return `<div class="${size} ${rounded} bg-black flex items-center justify-center text-white font-bold flex-shrink-0 text-sm">${initial}</div>`
}

function timeAgo(dateStr) {
  const diff = (Date.now() - new Date(dateStr).getTime()) / 1000;
  if (diff < 60) return 'Baru saja';
  if (diff < 3600) return Math.floor(diff / 60) + 'm yang lalu';
  if (diff < 86400) return Math.floor(diff / 3600) + 'j yang lalu';
  if (diff < 604800) return Math.floor(diff / 86400) + ' hari yang lalu';
  return Math.floor(diff / 604800) + ' minggu yang lalu';
}
 
function getCurrentPage() {
  const active = document.querySelector('.page-content.active');
  if (!active) return 'beranda';
  return active.id.replace('page-', '');
}
 
// ============================
// CARD DESCRIPTION HANDLERS
// ============================
let activeCardDesc = null;
 
function showCardDesc(cardEl) {
  const overlay = cardEl.querySelector('.content-desc-overlay');
  if (!overlay) return;
  
  if (activeCardDesc && activeCardDesc !== cardEl) {
    const prevOverlay = activeCardDesc.querySelector('.content-desc-overlay');
    if (prevOverlay) {
      activeCardDesc.classList.remove('active-desc');
    }
  }
  
  cardEl.classList.add('active-desc');
  activeCardDesc = cardEl;
}
 
function hideCardDesc(cardEl) {
  cardEl.classList.remove('active-desc');
  if (activeCardDesc === cardEl) activeCardDesc = null;
}
 
function toggleCardDesc(cardEl) {
  if (cardEl.classList.contains('active-desc')) {
    hideCardDesc(cardEl);
  } else {
    showCardDesc(cardEl);
  }
  return false;
}
 
// ============================
// INIT
// ============================
;(function resetStaleCategories() {
  const cats = DB.getArr('categories');
  const isOldSeed = cats.length > 0 && cats.some(c =>
    ['Tekno', 'Musik', 'Film', 'Olahraga', 'Kuliner'].includes(c.name)
  );
  if (isOldSeed) {
    localStorage.removeItem('nissanex_categories');
  }
})();
 
// ============================
// SUPABASE FALLBACK SAFETY
// Pastikan updatePost & deletePost ada; kalau belum didefinisikan di supabase.js, buat stub
// ============================
function _ensureSBMethods() {
  if (!window._SB) return;
  if (!window._SB.updatePost) {
    window._SB.updatePost = async (postId, data) => {
      // Stub: update via supabase jika tersedia
      if (window._SB.supabase) {
        const { error } = await window._SB.supabase.from('posts').update(data).eq('id', postId);
        if (error) throw error;
      }
    };
  }
  if (!window._SB.deletePost) {
    window._SB.deletePost = async (postId) => {
      if (window._SB.supabase) {
        const { error } = await window._SB.supabase.from('posts').delete().eq('id', postId);
        if (error) throw error;
      }
    };
  }
}
// ============================
// PROFIL REFRESH FROM SUPABASE (NO LOCALSTORAGE)
// ============================

// Fungsi untuk refresh data profil langsung dari Supabase
async function refreshProfileFromSupabase() {
  if (!CURRENT_USER) return null;
  
  try {
    // Ambil data terbaru dari Supabase
    const freshProfile = await window._SB.getProfile(CURRENT_USER.id);
    if (freshProfile) {
      CURRENT_PROFILE = freshProfile;
      
      // Update UI jika halaman profil sedang aktif
      const activePage = getCurrentPage();
      if (activePage === 'profil') {
        renderProfil();
      }
      
      // Update sidebar user info
      updateSidebarUser();
      
      return freshProfile;
    }
  } catch(e) {
    console.error('Refresh profile error:', e);
  }
  return CURRENT_PROFILE;
}

// Override saveEditProfil agar refresh otomatis
const originalSaveEditProfil = saveEditProfil;
saveEditProfil = async function() {
  const updates = {
    full_name: document.getElementById('ep-name')?.value.trim(),
    username: document.getElementById('ep-username')?.value.trim(),
    bio: document.getElementById('ep-bio')?.value.trim(),
    location: document.getElementById('ep-location')?.value.trim(),
    occupation: document.getElementById('ep-occupation')?.value.trim(),
    tech_stack: document.getElementById('ep-techstack')?.value.trim(),
    interests: document.getElementById('ep-interests')?.value.trim(),
  };
  
  // Hapus field yang kosong
  Object.keys(updates).forEach(key => {
    if (updates[key] === undefined || updates[key] === '') {
      delete updates[key];
    }
  });
  
  if (Object.keys(updates).length === 0) {
    toast('⚠️ Tidak ada perubahan');
    closeModal('modal-editprofil');
    return;
  }
  
  try {
    // Update ke Supabase
    const updatedProfile = await window._SB.updateProfile(CURRENT_USER.id, updates);
    CURRENT_PROFILE = updatedProfile;
    
    // Update UI
    if (getCurrentPage() === 'profil') {
      renderProfil();
    }
    updateSidebarUser();
    
    toast('✅ Profil berhasil diperbarui!');
    closeModal('modal-editprofil');
  } catch(e) {
    toast('❌ Gagal update profil: ' + e.message, true);
  }
};

// Override uploadAvatar agar refresh otomatis
const originalUploadAvatar = uploadAvatar;
uploadAvatar = async function(input) {
  if (!input?.files?.[0]) return;
  
  toast('⏳ Mengupload foto...');
  try {
    const url = await window._SB.uploadAvatarFile(CURRENT_USER.id, input.files[0]);
    await window._SB.updateProfile(CURRENT_USER.id, { avatar_url: url });
    
    // Refresh profile dari database
    await refreshProfileFromSupabase();
    
    toast('✅ Foto profil diperbarui!');
  } catch(e) {
    toast('❌ Gagal upload foto: ' + e.message, true);
  }
};

// Override uploadCover agar refresh otomatis
const originalUploadCover = uploadCover;
uploadCover = async function(input) {
  if (!input?.files?.[0]) return;
  
  toast('⏳ Mengupload cover...');
  try {
    const url = await window._SB.uploadCoverFile(CURRENT_USER.id, input.files[0]);
    await window._SB.updateProfile(CURRENT_USER.id, { cover_url: url });
    
    // Refresh profile dari database
    await refreshProfileFromSupabase();
    
    toast('✅ Cover diperbarui!');
  } catch(e) {
    toast('❌ Gagal upload cover: ' + e.message, true);
  }
};

// Override renderProfil agar selalu pakai CURRENT_PROFILE fresh
const originalRenderProfil = renderProfil;
renderProfil = function() {
  if (!CURRENT_USER) { 
    openAuthModal(); 
    return; 
  }
  
  // Jika CURRENT_PROFILE belum ada, ambil dari database
  if (!CURRENT_PROFILE) {
    refreshProfileFromSupabase().then(() => {
      originalRenderProfil();
    });
    return;
  }
  
  // Gunakan CURRENT_PROFILE langsung (sudah fresh dari database)
  const profile = CURRENT_PROFILE;
  const contents = DB.getArr('contents').filter(c => c.userId === CURRENT_USER.id);
  const discussions = DB.getArr('discussions').filter(d => d.userId === CURRENT_USER.id);
 
  // Update UI
  const nameEl = document.getElementById('profil-name');
  if (nameEl) nameEl.textContent = profile.full_name || profile.username || 'Pengguna';
  
  const usernameEl = document.getElementById('profil-username');
  if (usernameEl) usernameEl.textContent = '@' + (profile.username || 'user');
  
  const bioEl = document.getElementById('profil-bio');
  if (bioEl) bioEl.textContent = profile.bio || 'Tidak ada bio';
  
  const locationEl = document.getElementById('info-location');
  if (locationEl) locationEl.textContent = profile.location || 'Tidak disebutkan';
  
  const occupationEl = document.getElementById('info-occupation');
  if (occupationEl) occupationEl.textContent = profile.occupation || 'Tidak disebutkan';
  
  const techstackEl = document.getElementById('info-techstack');
  if (techstackEl) techstackEl.textContent = profile.tech_stack || 'Tidak disebutkan';
  
  const interestsEl = document.getElementById('info-interests');
  if (interestsEl) interestsEl.textContent = profile.interests || 'Tidak disebutkan';
 
  // Avatar
  const avatarImg = document.getElementById('avatar-img');
  const avatarInitial = document.getElementById('avatar-initial');
  if (profile.avatar_url) {
    if (avatarImg) {
      avatarImg.src = profile.avatar_url;
      avatarImg.classList.remove('hidden');
    }
    if (avatarInitial) avatarInitial.classList.add('hidden');
  } else {
    const initial = (profile.full_name || profile.username || 'U')[0].toUpperCase();
    if (avatarInitial) {
      avatarInitial.textContent = initial;
      avatarInitial.classList.remove('hidden');
    }
    if (avatarImg) avatarImg.classList.add('hidden');
  }
  
  // Cover
  const coverImg = document.getElementById('cover-img');
  if (profile.cover_url) {
    if (coverImg) {
      coverImg.src = profile.cover_url;
      coverImg.classList.remove('hidden');
    }
  } else {
    if (coverImg) coverImg.classList.add('hidden');
  }
 
  // Stats
  const followersEl = document.getElementById('stat-followers');
  if (followersEl) followersEl.textContent = profile.followers_count || 0;
  
  const followingEl = document.getElementById('stat-following');
  if (followingEl) followingEl.textContent = profile.following_count || 0;
  
  const postsEl = document.getElementById('stat-posts');
  if (postsEl) postsEl.textContent = contents.length;
  
  const likesEl = document.getElementById('stat-likes-total');
  if (likesEl) likesEl.textContent = contents.reduce((a,c)=>a+(c.likes||0), 0);
  
  const commentsEl = document.getElementById('stat-comments');
  if (commentsEl) commentsEl.textContent = discussions.reduce((a,d)=>a+(d.comments||0), 0);
  
  const sharesEl = document.getElementById('stat-shares');
  if (sharesEl) sharesEl.textContent = discussions.reduce((a,d)=>a+(d.shares||0), 0);
 
  renderRecentUploads();
  renderProfilKonten();
  renderProfilDiskusi();
};

// Override openEditProfil agar pakai CURRENT_PROFILE
const originalOpenEditProfil = openEditProfil;
openEditProfil = function() {
  if (!CURRENT_PROFILE) {
    refreshProfileFromSupabase().then(() => {
      originalOpenEditProfil();
    });
    return;
  }
  
  const nameInput = document.getElementById('ep-name');
  if (nameInput) nameInput.value = CURRENT_PROFILE.full_name || '';
  
  const usernameInput = document.getElementById('ep-username');
  if (usernameInput) usernameInput.value = CURRENT_PROFILE.username || '';
  
  const bioInput = document.getElementById('ep-bio');
  if (bioInput) bioInput.value = CURRENT_PROFILE.bio || '';
  
  const locationInput = document.getElementById('ep-location');
  if (locationInput) locationInput.value = CURRENT_PROFILE.location || '';
  
  const occupationInput = document.getElementById('ep-occupation');
  if (occupationInput) occupationInput.value = CURRENT_PROFILE.occupation || '';
  
  const techstackInput = document.getElementById('ep-techstack');
  if (techstackInput) techstackInput.value = CURRENT_PROFILE.tech_stack || '';
  
  const interestsInput = document.getElementById('ep-interests');
  if (interestsInput) interestsInput.value = CURRENT_PROFILE.interests || '';
  
  openModal('modal-editprofil');
};

// Tambahkan fungsi forceRefreshProfil untuk dipanggil dari halaman profil
window.forceRefreshProfil = refreshProfileFromSupabase;

init();