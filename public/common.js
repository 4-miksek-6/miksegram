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

function applyStoredSettings() {
    if (!document.body) return;

    document.body.dataset.theme = 'cosmos';
    
    const accent = localStorage.getItem('accent');
    if (accent && accent !== 'default' && accent !== 'cyan') {
        document.body.dataset.accent = accent;
        if (accent.startsWith('#')) {
            document.documentElement.style.setProperty('--accent', accent);
            document.documentElement.style.setProperty('--accent-2', `color-mix(in srgb, ${accent} 60%, #000)`);
        }
    } else if (accent && accent.startsWith('#')) {
         document.documentElement.style.setProperty('--accent', accent);
    }
    
    const otherAccent = localStorage.getItem('interlocutor-accent');
    if (otherAccent && otherAccent !== 'none') {
        document.documentElement.style.setProperty('--interlocutor-accent', otherAccent);
        document.body.setAttribute('data-other-accent', otherAccent);
    } else {
        document.body.removeAttribute('data-other-accent');
        document.documentElement.style.removeProperty('--interlocutor-accent');
    }

    if (localStorage.getItem('dual-bg-accent') === 'on') {
        document.body.classList.add('dual-accent-bg');
    } else {
        document.body.classList.remove('dual-accent-bg');
    }

    const bgPreset = localStorage.getItem('bg-preset') || 'cosmos';
    document.body.dataset.bg = bgPreset;

    const sidebarOpacity = localStorage.getItem('sidebar-opacity') || '0.55';
    const chatOpacity = localStorage.getItem('chat-opacity') || '0.85';
    document.documentElement.style.setProperty('--sidebar-opacity', sidebarOpacity);
    document.documentElement.style.setProperty('--chat-opacity', chatOpacity);

    if (localStorage.getItem('anim') === 'off') document.body.classList.add('no-anim');
}

if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', applyStoredSettings);
} else {
    applyStoredSettings();
}

let toastTimer;
function showToast(text) {
    let toast = document.getElementById('toast');
    if (!toast) { toast = document.createElement('div'); toast.id = 'toast'; document.body.appendChild(toast); }
    toast.textContent = text;
    toast.classList.add('show');
    clearTimeout(toastTimer);
    toastTimer = setTimeout(() => toast.classList.remove('show'), 2200);
}

// ===== БЕЙДЖИ (SVG + ТУЛТИПЫ) =====

(function injectBadgeStyles() {
    if (document.getElementById('badge-styles-injected')) return;
    const style = document.createElement('style');
    style.id = 'badge-styles-injected';
    style.textContent = `
        .custom-badge { 
            position: relative; 
            display: inline-flex; 
            align-items: center; 
            justify-content: center; 
            width: 18px; 
            height: 18px; 
            margin-left: 4px; 
            vertical-align: middle; 
            cursor: help; 
        }
        .custom-badge img { width: 100%; height: 100%; object-fit: contain; }
        .custom-badge::after { 
            content: attr(data-tooltip); 
            position: absolute; 
            bottom: 100%; 
            left: 50%; 
            transform: translateX(-50%) translateY(-4px); 
            background: var(--panel-strong); 
            border: 1px solid var(--accent); 
            color: var(--text); 
            padding: 6px 12px; 
            border-radius: 8px; 
            font-size: 11px; 
            font-weight: 500; 
            white-space: nowrap; 
            opacity: 0; 
            pointer-events: none; 
            transition: all 0.2s ease; 
            box-shadow: 0 4px 15px rgba(0,0,0,0.5); 
            z-index: 1000; 
            font-family: 'Inter', sans-serif; 
        }
        .custom-badge:hover::after { 
            opacity: 1; 
            transform: translateX(-50%) translateY(-8px); 
        }
    `;
    document.head.appendChild(style);
})();

const BADGES_CONFIG = {
    crown: { name: 'Создатель', src: '/badges/crown.svg' },
    check: { name: 'Официальный', src: '/badges/check.svg' },
    star: { name: 'Легенда', src: '/badges/star.svg' },
    fire: { name: 'Тестер', src: '/badges/fire.svg' }
};

function getBadgeSVG(badgeKey) {
    if (!badgeKey || badgeKey === 'none' || !BADGES_CONFIG[badgeKey]) return '';
    const b = BADGES_CONFIG[badgeKey];
    return `<span class="custom-badge" data-tooltip="Бейдж «${b.name}». Выдан администратором Miksegram."><img src="${b.src}" alt="${b.name}"></span>`;
}

// ===================================

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