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
let isPlayingSound = false;

function playNotification() {
    if (localStorage.getItem('notif-sound') === 'off') return;
    if (isPlayingSound) return;
    
    try {
        isPlayingSound = true;
        notificationSound.volume = parseFloat(localStorage.getItem('notif-volume') || '0.5');
        notificationSound.currentTime = 0;
        notificationSound.play();
        notificationSound.onended = () => { isPlayingSound = false; };
    } catch(e) { 
        isPlayingSound = false; 
    }
}

function requestNotifications() {
    if ("Notification" in window && Notification.permission !== "granted" && Notification.permission !== "denied") {
        Notification.requestPermission();
    }
}

(function applyStoredSettings() {
    document.body.dataset.theme = 'cosmos';
    
    // Применяем МОЙ акцент
    const accent = localStorage.getItem('accent');
    if (accent && accent !== 'default' && accent !== 'cyan') {
        document.body.dataset.accent = accent;
        // Если это HEX-код (из новой палитры)
        if (accent.startsWith('#')) {
            document.documentElement.style.setProperty('--accent', accent);
            // Делаем второй цвет чуть темнее для градиента
            document.documentElement.style.setProperty('--accent-2', `color-mix(in srgb, ${accent} 60%, #000)`);
        }
    } else if (accent && accent.startsWith('#')) {
         document.documentElement.style.setProperty('--accent', accent);
    }
    
    // Применяем АКЦЕНТ СОБЕДНИКА
    const otherAccent = localStorage.getItem('interlocutor-accent');
    if (otherAccent && otherAccent !== 'none') {
        document.documentElement.style.setProperty('--interlocutor-accent', otherAccent);
        document.body.setAttribute('data-other-accent', otherAccent);
    } else {
        document.body.removeAttribute('data-other-accent');
        document.documentElement.style.removeProperty('--interlocutor-accent');
    }

    // Двойной фон
    if (localStorage.getItem('dual-bg-accent') === 'on') {
        document.body.classList.add('dual-accent-bg');
    } else {
        document.body.classList.remove('dual-accent-bg');
    }

    // Пресет фона
    const bgPreset = localStorage.getItem('bg-preset') || 'cosmos';
    document.body.dataset.bg = bgPreset;

    // Прозрачность
    const sidebarOpacity = localStorage.getItem('sidebar-opacity') || '0.55';
    const chatOpacity = localStorage.getItem('chat-opacity') || '0.85';
    document.documentElement.style.setProperty('--sidebar-opacity', sidebarOpacity);
    document.documentElement.style.setProperty('--chat-opacity', chatOpacity);

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

function applyAvatarTo(el, avatar, displayName, frame = 'none') {
    if (!el) return;
    el.style.backgroundImage = ''; el.style.backgroundSize = ''; el.style.backgroundPosition = '';
    el.textContent = '';
    el.className = el.className.replace(/\b(has-image|grad-\w+|frame-\w+)\b/g, '').replace(/\s+/g, ' ').trim();
    
    el.style.border = 'none';
    el.style.boxShadow = '';
    el.style.padding = '0';

    if (!avatar || avatar.startsWith('grad-')) {
        el.classList.add(avatar || 'grad-cyan');
        el.textContent = (displayName || '?').trim().charAt(0).toUpperCase();
    } else {
        el.classList.add('has-image');
        el.style.backgroundImage = `url(${avatar})`;
        el.style.backgroundSize = 'cover'; el.style.backgroundPosition = 'center';
    }

    if (frame && frame !== 'none') {
        if (frame.startsWith('frame_glow:')) {
            const color = frame.split(':')[1];
            el.style.border = `2px solid ${color}`;
            el.style.boxShadow = `0 0 15px ${color}`;
        } else if (frame.startsWith('frame_dashed:')) {
            const color = frame.split(':')[1];
            el.style.border = `2px dashed ${color}`;
        }
    }
}

function applyNameEffect(el, effect) {
    if (!el) return;
    el.className = el.className.replace(/\bname-\w+\b/g, '').replace(/\s+/g, ' ').trim();
    el.style.textShadow = '';
    el.style.color = '';
    el.style.background = '';
    el.style.webkitBackgroundClip = '';
    el.style.webkitTextFillColor = '';
    
    if (!effect || effect === 'none') return;
    
    if (effect.startsWith('name_glow:')) {
        const color = effect.split(':')[1];
        el.style.textShadow = `0 0 10px ${color}, 0 0 20px ${color}`;
        el.style.color = '#fff';
    } else if (effect.startsWith('name_color:')) {
        const color = effect.split(':')[1];
        el.style.color = color;
        el.style.textShadow = `0 0 5px ${color}`;
        el.style.fontWeight = '800';
    }
}

function applyBannerTo(el, banner) {
    if (!el) return;
    if (!banner) {
        el.style.background = 'var(--grad-aurora)';
        el.style.backgroundImage = ''; return;
    }
    el.style.background = '';
    el.style.backgroundImage = `url(${banner})`;
    el.style.backgroundSize = 'cover'; el.style.backgroundPosition = 'center';
}

function escapeHtml(str) {
    return String(str || '').replace(/[&<>"']/g, s => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[s]));
}

async function saveProfilePatch(patch) {
    try {
        const res = await fetch('/api/update-profile', {
            method: 'POST', headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(patch)
        });
        const data = await res.json();
        if (data.ok && typeof window.onSettingsSaved === 'function') window.onSettingsSaved(data.user);
        return data;
    } catch (e) {
        return { ok: false, error: 'Ошибка сети' };
    }
}