function initStars() {
    const container = document.getElementById('stars');
    if (!container) return;
    for (let i = 0; i < 90; i++) {
        const s = document.createElement('span');
        s.className = 'star';
        s.style.left = Math.random() * 100 + '%';
        s.style.top = Math.random() * 100 + '%';
        s.style.animationDelay = (Math.random() * 6) + 's';
        s.style.animationDuration = (2 + Math.random() * 4) + 's';
        const size = Math.random() * 2 + 1;
        s.style.width = size + 'px'; s.style.height = size + 'px';
        container.appendChild(s);
    }
}

function initMagnetics() {
    document.addEventListener('mousemove', (e) => {
        if (localStorage.getItem('anim') === 'off') return;
        document.querySelectorAll('.magnetic').forEach(el => {
            const r = el.getBoundingClientRect();
            const cx = r.left + r.width / 2, cy = r.top + r.height / 2;
            const dx = e.clientX - cx, dy = e.clientY - cy;
            const dist = Math.hypot(dx, dy);
            const radius = Math.max(r.width, r.height) + 40;
            if (dist < radius) {
                const k = (1 - dist / radius) * 0.25;
                el.style.transform = `translate(${dx * k}px, ${dy * k}px)`;
            } else { el.style.transform = ''; }
        });
    });
}

const notificationSound = new Audio('/notify.mp3');
notificationSound.volume = 0.5;
let isPlayingSound = false;

function playNotification() {
    if (isPlayingSound) return;
    try {
        isPlayingSound = true;
        notificationSound.currentTime = 0;
        notificationSound.play();
        notificationSound.onended = () => { isPlayingSound = false; };
    } catch(e) { isPlayingSound = false; }
}

function requestNotifications() {
    if ("Notification" in window && Notification.permission !== "granted" && Notification.permission !== "denied") {
        Notification.requestPermission();
    }
}

(function applyStoredSettings() {
    document.body.dataset.theme = localStorage.getItem('theme') || 'cosmos';
    const accent = localStorage.getItem('accent');
    if (accent && accent !== 'default') document.body.dataset.accent = accent;
    if (localStorage.getItem('bg-blobs') === 'off') document.querySelectorAll('.bg-blobs').forEach(e => e.style.display = 'none');
    if (localStorage.getItem('bg-stars') === 'off') document.querySelectorAll('.stars').forEach(e => e.style.display = 'none');
    if (localStorage.getItem('bg-grid') === 'off') document.querySelectorAll('.bg-grid').forEach(e => e.style.display = 'none');
    if (localStorage.getItem('bg-grain') === 'off') document.querySelectorAll('.grain').forEach(e => e.style.display = 'none');
    if (localStorage.getItem('anim') === 'off') document.body.classList.add('no-anim');
})();

let toastTimer;
function showToast(text) {
    let toast = document.getElementById('toast');
    if (!toast) { toast = document.createElement('div'); toast.id = 'toast'; document.body.appendChild(toast); }
    toast.textContent = text;
    toast.classList.add('show');
    clearTimeout(toastTimer);
    toastTimer = setTimeout(() => toast.classList.remove('show'), 2200);
}

const AVATAR_GRADIENTS = [
    { key: 'grad-aurora', label: 'Аврора' }, { key: 'grad-emerald', label: 'Изумруд' },
    { key: 'grad-cyan', label: 'Бирюза' }, { key: 'grad-violet', label: 'Фиолет' },
    { key: 'grad-pink', label: 'Розовый' }, { key: 'grad-lavender', label: 'Лаванда' },
    { key: 'grad-magenta', label: 'Малина' }, { key: 'grad-sunset', label: 'Закат' }
];

const BANNER_GRADIENTS = [
    { key: 'ban-aurora', label: 'Аврора', css: 'linear-gradient(135deg, #00ffa3 0%, #00d4ff 30%, #a855f7 70%, #ff4ec7 100%)' },
    { key: 'ban-sunset', label: 'Закат', css: 'linear-gradient(135deg, #ff512f 0%, #ffb347 50%, #ff4ec7 100%)' },
    { key: 'ban-ocean', label: 'Океан', css: 'linear-gradient(135deg, #001f54 0%, #0057b8 50%, #00d4ff 100%)' },
    { key: 'ban-forest', label: 'Лес', css: 'linear-gradient(135deg, #0a3d1c 0%, #00ffa3 100%)' },
    { key: 'ban-candy', label: 'Карамель', css: 'linear-gradient(135deg, #ff9a9e 0%, #fecfef 50%, #a18cd1 100%)' },
    { key: 'ban-fire', label: 'Огонь', css: 'linear-gradient(135deg, #200122 0%, #6f0000 50%, #ff512f 100%)' },
    { key: 'ban-neon', label: 'Неон', css: 'linear-gradient(135deg, #00ffff 0%, #cc00ff 50%, #ff00aa 100%)' },
    { key: 'ban-ice', label: 'Лёд', css: 'linear-gradient(135deg, #e0eafc 0%, #7db9e8 50%, #1e3c72 100%)' }
];

const THEMES = [
    { key: 'cosmos', label: 'Космос' }, { key: 'neon', label: 'Киберпанк' }, 
    { key: 'amethyst', label: 'Аметист' }, { key: 'forest', label: 'Изумрудный лес' },
    { key: 'volcano', label: 'Вулкан' }, { key: 'ocean', label: 'Глубина' },
    { key: 'mono', label: 'Монохром' }
];

const ACCENTS = [
    { key: 'default', label: 'Аврора', color: '#00d4ff' }, { key: 'emerald', label: 'Изумруд', color: '#00ffa3' },
    { key: 'cyan', label: 'Бирюза', color: '#00d4ff' }, { key: 'violet', label: 'Фиолет', color: '#a855f7' },
    { key: 'pink', label: 'Розовый', color: '#ff4ec7' }, { key: 'amber', label: 'Янтарь', color: '#ffb347' },
    { key: 'magenta', label: 'Малина', color: '#ff2d95' }, { key: 'blue', label: 'Голубой', color: '#4d9fff' },
    { key: 'lime', label: 'Лайм', color: '#b8ff00' }, { key: 'gold', label: 'Золото', color: '#ffd700' }
];

function applyAvatarTo(el, avatar, displayName) {
    el.style.backgroundImage = ''; el.style.backgroundSize = ''; el.style.backgroundPosition = '';
    el.textContent = '';
    el.className = el.className.replace(/\b(has-image|grad-\w+)\b/g, '').replace(/\s+/g, ' ').trim();
    if (!avatar || avatar.startsWith('grad-')) {
        el.classList.add(avatar || 'grad-emerald');
        el.textContent = (displayName || '?').trim().charAt(0).toUpperCase();
    } else {
        el.classList.add('has-image');
        el.style.backgroundImage = `url(${avatar})`;
        el.style.backgroundSize = 'cover'; el.style.backgroundPosition = 'center';
    }
}

function applyBannerTo(el, banner) {
    if (!banner) {
        el.style.background = 'linear-gradient(135deg, #00ffa3, #00d4ff, #a855f7, #ff4ec7)';
        el.style.backgroundImage = ''; return;
    }
    if (banner.startsWith('ban-')) {
        const b = BANNER_GRADIENTS.find(x => x.key === banner);
        el.style.backgroundImage = '';
        el.style.background = b ? b.css : 'linear-gradient(135deg, #00ffa3, #ff4ec7)';
    } else {
        el.style.background = '';
        el.style.backgroundImage = `url(${banner})`;
        el.style.backgroundSize = 'cover'; el.style.backgroundPosition = 'center';
    }
}

function fileToDataURL(file, maxSize = 800) {
    return new Promise((resolve, reject) => {
        const reader = new FileReader();
        reader.onload = () => {
            const img = new Image();
            img.onload = () => {
                const canvas = document.createElement('canvas');
                let { width, height } = img;
                if (width > maxSize || height > maxSize) {
                    if (width > height) { height = height * maxSize / width; width = maxSize; }
                    else { width = width * maxSize / height; height = maxSize; }
                }
                canvas.width = width; canvas.height = height;
                canvas.getContext('2d').drawImage(img, 0, 0, width, height);
                resolve(canvas.toDataURL('image/jpeg', 0.85));
            };
            img.onerror = reject;
            img.src = reader.result;
        };
        reader.onerror = reject;
        reader.readAsDataURL(file);
    });
}

async function saveProfilePatch(patch) {
    const res = await fetch('/api/update-profile', {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(patch)
    });
    const data = await res.json();
    if (data.ok && typeof window.onSettingsSaved === 'function') window.onSettingsSaved(data.user);
    return data;
}

function escapeHtml(str) {
    return String(str || '').replace(/[&<>"']/g, s => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[s]));
}