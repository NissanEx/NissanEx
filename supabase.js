import { createClient } from 'https://cdn.jsdelivr.net/npm/@supabase/supabase-js@2.49.4/+esm'

const SUPABASE_URL = 'https://ewezbxdhwuwfzfuqgymb.supabase.co'
const SUPABASE_KEY = 'sb_publishable_hWnbHiYsUObBrPJuzDu3YQ_PYBhLn39'
const supabase = createClient(SUPABASE_URL, SUPABASE_KEY)

async function getCurrentUser() {
  const { data } = await supabase.auth.getUser()
  return data?.user ?? null
}
async function getProfile(userId) {
  const { data, error } = await supabase
    .from('users')
    .select('*')
    .eq('auth_id', userId)  // ✅ ganti dari 'id' ke 'auth_id'
    .single()
  if (error) throw error
  return data
}

async function updateProfile(userId, updates) {
  const { data, error } = await supabase
    .from('users')
    .update(updates)
    .eq('auth_id', userId)  // ✅ ganti
    .select().single()
  if (error) throw error
  return data
}
async function uploadAvatarFile(userId, file) {
  const path = `${userId}/avatar.${file.name.split('.').pop()}`
  const { error } = await supabase.storage.from('avatars').upload(path, file, { upsert: true })
  if (error) throw error
  return supabase.storage.from('avatars').getPublicUrl(path).data.publicUrl
}
async function uploadCoverFile(userId, file) {
  const path = `${userId}/cover.${file.name.split('.').pop()}`
  const { error } = await supabase.storage.from('avatars').upload(path, file, { upsert: true })
  if (error) throw error
  return supabase.storage.from('avatars').getPublicUrl(path).data.publicUrl
}
async function getCategories(userId) {
  const { data, error } = await supabase.from('categories').select('*').eq('user_id', userId).order('sort_order')
  if (error) throw error
  return data
}
async function getContents(userId) {
  const { data, error } = await supabase.from('contents').select('*, categories(title), users(username, avatar_url)').eq('user_id', userId).order('created_at', { ascending: false })
  if (error) throw error
  return data
}
async function addContent(userId, content) {
  const { data, error } = await supabase.from('contents').insert({ user_id: userId, ...content }).select().single()
  if (error) throw error
  return data
}
async function uploadContentFile(userId, file) {
  const ext = file.name.split('.').pop()
  const path = `${userId}/${Date.now()}.${ext}`
  const { error } = await supabase.storage.from('content-files').upload(path, file)
  if (error) throw error
  return supabase.storage.from('content-files').getPublicUrl(path).data.publicUrl
}
async function uploadThumbnail(userId, file) {
  const ext = file.name.split('.').pop()
  const path = `${userId}/thumb_${Date.now()}.${ext}`
  const { error } = await supabase.storage.from('thumbnails').upload(path, file, { upsert: true })
  if (error) throw error
  return supabase.storage.from('thumbnails').getPublicUrl(path).data.publicUrl
}
async function getPosts() {
  const { data, error } = await supabase.from('posts').select('*, users(username, avatar_url)').order('created_at', { ascending: false })
  if (error) throw error
  return data
}
async function addPost(userId, content) {
  const { data, error } = await supabase.from('posts').insert({ user_id: userId, content }).select().single()
  if (error) throw error
  return data
}
async function getSaves(userId) {
  const { data, error } = await supabase.from('saves').select('*').eq('user_id', userId)
  if (error) throw error
  return data
}
async function toggleSave(userId, targetId, targetType) {
  const { data: existing } = await supabase.from('saves').select('id').eq('user_id', userId).eq('target_id', targetId).eq('target_type', targetType).single()
  if (existing) {
    await supabase.from('saves').delete().eq('id', existing.id)
    return false
  } else {
    await supabase.from('saves').insert({ user_id: userId, target_id: targetId, target_type: targetType })
    return true
  }
}
async function addRef(userId, ref) {
  const { data, error } = await supabase.from('refs').insert({ user_id: userId, ...ref }).select().single()
  if (error) throw error
  return data
}

async function updatePost(postId, updates) {
  const { data, error } = await supabase
    .from('posts')
    .update(updates)
    .eq('id', postId)
    .select().single()
  if (error) throw error
  return data
}

async function deletePost(postId) {
  const { error } = await supabase.from('posts').delete().eq('id', postId)
  if (error) throw error
}

async function updateContent(contentId, updates) {
  const { data, error } = await supabase
    .from('contents')
    .update(updates)
    .eq('id', contentId)
    .select().single()
  if (error) throw error
  return data
}

async function deleteContent(contentId) {
  const { error } = await supabase.from('contents').delete().eq('id', contentId)
  if (error) throw error
}

async function signUp(email, password, username) {
  const { data, error } = await supabase.auth.signUp({
    email, password,
    options: { data: { username } }
  })
  if (error) throw error

  if (data.user) {
    supabase.from('users').insert({
      auth_id: data.user.id,   // ✅ simpan di auth_id
      username: username || email.split('@')[0],
      email: email,
      created_at: new Date().toISOString()
    }).then().catch(() => {})  // fire and forget
  }

  return { user: data.user, session: data.session }
}
async function signIn(email, password) {
  const { data, error } = await supabase.auth.signInWithPassword({ email, password })
  if (error) throw error
  return data
}

async function signOut() {
  const { error } = await supabase.auth.signOut()
  if (error) throw error
}

function onAuthChange(callback) {
  return supabase.auth.onAuthStateChange((event, session) => {
    callback(event, session?.user ?? null)
  })
}
// Di supabase.js, tambahkan:
async function uploadCategoryIcon(userId, categoryId, file) {
  const ext = file.name.split('.').pop()
  const path = `categories/${categoryId}/icon.${ext}`
  const { error } = await supabase.storage.from('avatars').upload(path, file, { upsert: true })
  if (error) throw error
  return supabase.storage.from('avatars').getPublicUrl(path).data.publicUrl
}

async function updateCategoryIcon(categoryId, iconUrl) {
  const { data, error } = await supabase
    .from('categories')
    .update({ file_url: iconUrl })
    .eq('id', categoryId)
    .select()
    .single()
  if (error) throw error
  return data
}

// Expose semua ke window agar bisa dipakai script biasa
window._SB = {
  getCurrentUser, getProfile, updateProfile,
  uploadAvatarFile, uploadCoverFile,
  getCategories, getContents, addContent, updateContent, deleteContent,
  uploadContentFile, uploadThumbnail,
  getPosts, addPost, updatePost, deletePost,
  getSaves, toggleSave,
  addRef,
  uploadCategoryIcon, updateCategoryIcon,
  supabase,
  // Auth
  signUp, signIn, signOut, onAuthChange
}

// Tandai siap, lalu trigger init jika sudah ada
window._SB_READY = true
if (typeof window._pendingInit === 'function') window._pendingInit()