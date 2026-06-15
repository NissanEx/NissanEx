// ── SCROLL HINT ──
const scrollHint = document.getElementById('scrollHint');
window.addEventListener('scroll', () => {
  scrollHint.classList.toggle('hidden', window.scrollY > 80);
}, { passive: true });

// ── TOMBOL MASUK → scroll ke halaman Information ──
const btnMasuk = document.getElementById('btnMasuk');
const secInfo  = document.getElementById('sec-info');

if (btnMasuk && secInfo) {
  btnMasuk.addEventListener('click', () => {
    secInfo.scrollIntoView({ behavior: 'smooth' });
  });
}

// ── TOMBOL CONTACT → scroll ke halaman Contact ──
const btnContact     = document.getElementById('btnContact');
const contactSection = document.getElementById('contactSection');

if (btnContact && contactSection) {
  btnContact.addEventListener('click', () => {
    contactSection.scrollIntoView({ behavior: 'smooth' });
  });
}

// ── PAGE DOTS INDICATOR ──
const sections = [
  document.getElementById('sec-hero'),
  document.getElementById('sec-info'),
  document.getElementById('contactSection'),
];

// Buat dots
const dotsContainer = document.createElement('nav');
dotsContainer.className = 'page-dots';
sections.forEach((sec, i) => {
  const dot = document.createElement('div');
  dot.className = 'dot' + (i === 0 ? ' active' : '');
  dot.addEventListener('click', () => sec.scrollIntoView({ behavior: 'smooth' }));
  dotsContainer.appendChild(dot);
});
document.body.appendChild(dotsContainer);

const dots = dotsContainer.querySelectorAll('.dot');

const observer = new IntersectionObserver((entries) => {
  entries.forEach(entry => {
    if (entry.isIntersecting) {
      const idx = sections.indexOf(entry.target);
      dots.forEach((d, i) => d.classList.toggle('active', i === idx));
    }
  });
}, { threshold: 0.5 });

sections.forEach(sec => observer.observe(sec));

// ── SEND BUTTON ──
const btnSend      = document.getElementById('btnSend');
const messageInput = document.getElementById('messageInput');

function showToast(msg) {
  let toast = document.querySelector('.toast');
  if (!toast) {
    toast = document.createElement('div');
    toast.className = 'toast';
    document.body.appendChild(toast);
  }
  toast.textContent = msg;
  toast.classList.add('show');
  setTimeout(() => toast.classList.remove('show'), 3000);
}

if (btnSend && messageInput) {
  btnSend.addEventListener('click', () => {
    const text = messageInput.value.trim();
    if (!text) { showToast('Tulis pesan terlebih dahulu.'); return; }
    showToast('Pesan berhasil dikirim!');
    messageInput.value = '';
  });
}