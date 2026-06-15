
import {
  supabase, getCurrentUser,
  getProfile, updateProfile,
  uploadAvatar as uploadAvatarFile, uploadCoverFile,
  getCategories, addCategory,
  getContents, addContent, updateContent, deleteContent,
  uploadContentFile, uploadThumbnail,
  getPosts, addPost,
  getSaves, toggleSave,
  addRef
} from './supabase.js'

// User yang sedang login (diisi saat init)
let CURRENT_USER = null
let CURRENT_PROFILE = null

// Init: cek login, load data dari Supabase
async function init() {
  CURRENT_USER = await getCurrentUser()
  if (!CURRENT_USER) {
    window.location.href = 'auth.html'
    return
  }
  CURRENT_PROFILE = await getProfile(CURRENT_USER.id)
  await seedDataSupabase()
  renderBeranda()
}


// ============================================================
// [LANGKAH 5] — Ganti object DB lama dengan ini
// ============================================================
const DB = {
  // Fallback localStorage tetap ada untuk data sementara (tempFiles dll)
  get(key) { try { return JSON.parse(localStorage.getItem('nissanex_'+key)) || null } catch(e){ return null } },
  set(key, val) { localStorage.setItem('nissanex_'+key, JSON.stringify(val)) },
  getArr(key) { return this.get(key) || [] },
  pushArr(key, item) { const arr = this.getArr(key); arr.unshift(item); this.set(key, arr); return arr },
  uuid() { return crypto.randomUUID() },

  // ── Versi async Supabase ──
  async fetchCategories() {
    const data = await getCategories(CURRENT_USER.id)
    this.set('categories', data.map(c => ({
      id: c.id, name: c.title, slug: c.title?.toLowerCase(),
      icon: c.icon || 'fas fa-folder', iconUrl: c.file_url || ''
    })))
    return this.getArr('categories')
  },

  async fetchContents() {
    const data = await getContents(CURRENT_USER.id)
    const mapped = data.map(c => ({
      id: c.id, userId: c.user_id, categoryId: c.category_id,
      title: c.name, description: c.description,
      fileType: c.icon_type || 'doc', thumbUrl: c.preview_image || '',
      views: 0, likes: 0, bookmarked: false,
      createdAt: c.created_at
    }))
    this.set('contents', mapped)
    return mapped
  },

  async fetchPosts() {
    const data = await getPosts()
    const mapped = data.map(p => ({
      id: p.id, userId: p.user_id,
      userName: p.users?.username || 'Pengguna',
      content: p.content, likes: 0, comments: 0, shares: 0,
      createdAt: p.created_at
    }))
    this.set('discussions', mapped)
    return mapped
  },

  async fetchSaves() {
    const data = await getSaves(CURRENT_USER.id)
    this.set('saves', data)
    return data
  }
}


// ============================================================
// [LANGKAH 6] — Ganti fungsi seedData() dengan ini
// ============================================================
async function seedDataSupabase() {
  // Load semua data dari Supabase ke cache lokal
  await DB.fetchCategories()
  await DB.fetchContents()
  await DB.fetchPosts()
  await DB.fetchSaves()

  // Sync profil
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
}


// ============================================================
// [LANGKAH 7] — Ganti fungsi-fungsi berikut
// ============================================================

// Ganti submitUpload()
async function submitUpload() {
  const title = document.getElementById('up-title').value.trim()
  const catId = document.getElementById('up-category').value
  const desc  = document.getElementById('up-desc').value.trim()
  if (!title) { toast('⚠️ Judul wajib diisi!'); return }

  let fileUrl = null, thumbUrl = null, fileType = 'doc'

  if (tempFiles.main) {
    const ext = tempFiles.main.name.split('.').pop().toLowerCase()
    const typeMap = {png:'image',jpg:'image',jpeg:'image',gif:'image',webp:'image',mp4:'video',pdf:'pdf',doc:'doc',docx:'docx'}
    fileType = typeMap[ext] || 'doc'
    toast('⏳ Mengupload file...')
    fileUrl = await uploadContentFile(CURRENT_USER.id, tempFiles.main)
  }

  if (tempFiles.thumbFile) {
    thumbUrl = await uploadThumbnail(CURRENT_USER.id, tempFiles.thumbFile)
  }

  const content = await addContent(CURRENT_USER.id, {
    name: title,
    description: desc,
    category_id: catId || null,
    icon_type: fileType,
    display_url: fileUrl || document.getElementById('up-url').value.trim() || null,
    preview_image: thumbUrl || null,
    status: 'published'
  })

  // Tambah ke cache lokal juga
  DB.pushArr('contents', {
    id: content.id, userId: CURRENT_USER.id, categoryId: catId,
    title, description: desc, fileType,
    thumbUrl: thumbUrl || '', views: 0, likes: 0, bookmarked: false,
    createdAt: content.created_at
  })

  toast('✅ Konten berhasil diupload!')
  closeModal('modal-upload')
  resetUploadForm()
  renderPage(getCurrentPage())
}

// Ganti submitLink()
async function submitLink() {
  const title = document.getElementById('lk-title').value.trim()
  const url   = document.getElementById('lk-url').value.trim()
  if (!title || !url) { toast('⚠️ Judul dan URL wajib diisi!'); return }

  const ref = await addRef(CURRENT_USER.id, { theme: title, language: url })

  DB.pushArr('linkwebs', {
    id: ref.id, userId: CURRENT_USER.id,
    categoryId: document.getElementById('lk-category').value || null,
    title, url,
    description: document.getElementById('lk-desc').value.trim(),
    iconUrl: '', status: 'active', bookmarked: false,
    createdAt: ref.created_at
  })

  toast('✅ Link web berhasil disimpan!')
  closeModal('modal-link')
  resetLinkForm()
  renderPage(getCurrentPage())
}

// Ganti submitPost()
async function submitPost() {
  const content = document.getElementById('post-content').value.trim()
  if (!content) { toast('⚠️ Tulis sesuatu dulu!'); return }

  const post = await addPost(CURRENT_USER.id, content)

  DB.pushArr('discussions', {
    id: post.id, userId: CURRENT_USER.id,
    userName: CURRENT_PROFILE?.username || 'Pengguna',
    content, likes: 0, comments: 0, shares: 0,
    createdAt: post.created_at
  })

  document.getElementById('post-content').value = ''
  toast('✅ Post berhasil dipublikasikan!')
  closeModal('modal-post')
  renderDiskusi()
}

// Ganti toggleBookmark()
async function toggleBookmark(contentId) {
  const saved = await toggleSave(CURRENT_USER.id, contentId, 'content')
  const contents = DB.getArr('contents')
  const idx = contents.findIndex(c => c.id === contentId)
  if (idx >= 0) {
    contents[idx].bookmarked = saved
    DB.set('contents', contents)
  }
  toast(saved ? '🔖 Disimpan ke koleksi' : 'Dihapus dari koleksi')
  renderPage(getCurrentPage())
}

// Ganti saveEditProfil()
async function saveEditProfil() {
  const updates = {
    username:   document.getElementById('ep-username').value.trim() || CURRENT_PROFILE.username,
    bio:        document.getElementById('ep-bio').value.trim(),
    location:   document.getElementById('ep-location').value.trim(),
    occupation: document.getElementById('ep-occupation').value.trim(),
    tech_stack: document.getElementById('ep-techstack').value.trim(),
    interests:  document.getElementById('ep-interests').value.trim(),
  }
  CURRENT_PROFILE = await updateProfile(CURRENT_USER.id, updates)
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
  toast('✅ Profil berhasil diperbarui!')
  closeModal('modal-editprofil')
  renderProfil()
}

// Ganti uploadAvatar()
async function uploadAvatar(input) {
  if (!input.files[0]) return
  toast('⏳ Mengupload foto...')
  const url = await uploadAvatarFile(CURRENT_USER.id, input.files[0])
  await updateProfile(CURRENT_USER.id, { avatar_url: url })
  CURRENT_PROFILE.avatar_url = url
  const profile = DB.get('user_profile') || {}
  profile.avatarUrl = url
  DB.set('user_profile', profile)
  toast('✅ Foto profil diperbarui!')
  renderProfil()
}

// Ganti uploadCover()
async function uploadCover(input) {
  if (!input.files[0]) return
  toast('⏳ Mengupload cover...')
  const url = await uploadCoverFile(CURRENT_USER.id, input.files[0])
  await updateProfile(CURRENT_USER.id, { cover_url: url })
  CURRENT_PROFILE.cover_url = url
  const profile = DB.get('user_profile') || {}
  profile.coverUrl = url
  DB.set('user_profile', profile)
  toast('✅ Cover diperbarui!')
  renderProfil()
}


// ============================================================
// Ganti baris terakhir:  seedData(); renderBeranda();
// dengan:                init();
// ============================================================
// init()