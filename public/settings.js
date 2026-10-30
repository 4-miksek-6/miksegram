function applyBackgroundToggle(key, on) {
    if (key === 'bg-blobs') document.querySelectorAll('.bg-blobs').forEach(e => e.style.display = on ? '' : 'none');
    if (key === 'bg-stars') document.querySelectorAll('.stars').forEach(e => e.style.display = on ? '' : 'none');
    if (key === 'bg-grid') document.querySelectorAll('.bg-grid').forEach(e => e.style.display = on ? '' : 'none');
    if (key === 'bg-grain') document.querySelectorAll('.grain').forEach(e => e.style.display = on ? '' : 'none');
    if (key === 'anim') document.body.classList.toggle('no-anim', !on);
}

function applyTheme(theme) {
    document.body.dataset.theme = theme;
    localStorage.setItem('theme', theme);
}

function buildSettingsUI() {
    const body = document.getElementById('settingsBody');
    if (!body || !window.currentUser) return;
    const u = window.currentUser;

    body.innerHTML = `
        <section class="settings-section">
            <div class="settings-label">Профиль</div>
            <div class="settings-preview">
                <div class="settings-banner" id="previewBanner"></div>
                <div class="settings-preview-avatar" id="previewAvatar">?</div>
            </div>
            <div class="settings-grid-label">Аватар (цвет)</div>
            <div class="grid-picker" id="avatarPicker"></div>
            <button class="secondary-btn" id="uploadAvatarBtn">Загрузить свою аватарку</button>
            <input type="file" id="avatarFile" accept="image/*" style="display:none">
            <div class="settings-grid-label">Баннер (цвет)</div>
            <div class="grid-picker" id="bannerPicker"></div>
            <button class="secondary-btn" id="uploadBannerBtn">Загрузить свой баннер</button>
            <input type="file" id="bannerFile" accept="image/*" style="display:none">
            <label class="settings-field">
                <span class="settings-field-label">Отображаемое имя</span>
                <input id="settingsNameInput" maxlength="40" value="${escapeHtml(u.display_name)}">
            </label>
            <label class="settings-field">
                <span class="settings-field-label">О себе</span>
                <textarea id="settingsBioInput" maxlength="200" rows="2" placeholder="Расскажи о себе...">${escapeHtml(u.bio || '')}</textarea>
            </label>
            <button class="primary-btn" id="saveProfileBtn">Сохранить профиль</button>
        </section>

        <section class="settings-section">
            <div class="settings-label">Безопасность</div>
            <label class="settings-field">
                <span class="settings-field-label">Текущий пароль</span>
                <input type="password" id="oldPassword" placeholder="Введите старый пароль">
            </label>
            <label class="settings-field">
                <span class="settings-field-label">Новый пароль</span>
                <input type="password" id="newPassword" placeholder="Введите новый пароль">
            </label>
            <button class="primary-btn" id="changePassBtn">Сменить пароль</button>
        </section>

        <section class="settings-section">
            <div class="settings-label">Тема оформления</div>
            <div class="theme-grid" id="themeGrid"></div>
        </section>

        <section class="settings-section">
            <div class="settings-label">Акцент</div>
            <div class="accent-grid" id="accentGrid"></div>
        </section>

        <section class="settings-section">
            <div class="settings-label">Фон</div>
            <div class="toggle-list">
                <label class="toggle-row"><span>Живые пятна</span><input type="checkbox" data-toggle="bg-blobs"><span class="toggle-switch"></span></label>
                <label class="toggle-row"><span>Звёзды</span><input type="checkbox" data-toggle="bg-stars"><span class="toggle-switch"></span></label>
                <label class="toggle-row"><span>Сетка</span><input type="checkbox" data-toggle="bg-grid"><span class="toggle-switch"></span></label>
                <label class="toggle-row"><span>Зернистость</span><input type="checkbox" data-toggle="bg-grain"><span class="toggle-switch"></span></label>
                <label class="toggle-row"><span>Анимации</span><input type="checkbox" data-toggle="anim"><span class="toggle-switch"></span></label>
            </div>
        </section>

        <section class="settings-section">
            <button class="danger-btn" id="logoutBtn">Выйти из аккаунта</button>
        </section>
    `;

    const previewBanner = document.getElementById('previewBanner');
    const previewAvatar = document.getElementById('previewAvatar');
    applyBannerTo(previewBanner, u.banner);
    applyAvatarTo(previewAvatar, u.avatar, u.display_name);

    const avatarPicker = document.getElementById('avatarPicker');
    AVATAR_GRADIENTS.forEach(g => {
        const d = document.createElement('button');
        d.className = 'grad-swatch ' + g.key + (u.avatar === g.key ? ' active' : '');
        d.title = g.label;
        d.addEventListener('click', async () => {
            const data = await saveProfilePatch({ avatar: g.key });
            if (data.ok) {
                u.avatar = g.key;
                applyAvatarTo(previewAvatar, g.key, u.display_name);
                document.querySelectorAll('#avatarPicker .grad-swatch').forEach(x => x.classList.remove('active'));
                d.classList.add('active');
            }
        });
        avatarPicker.appendChild(d);
    });
    document.getElementById('uploadAvatarBtn').addEventListener('click', () => document.getElementById('avatarFile').click());
    document.getElementById('avatarFile').addEventListener('change', async (e) => {
        if (!e.target.files[0]) return;
        const dataUrl = await fileToDataURL(e.target.files[0], 400);
        const data = await saveProfilePatch({ avatar: dataUrl });
        if (data.ok) { u.avatar = dataUrl; applyAvatarTo(previewAvatar, dataUrl, u.display_name); }
    });

    const bannerPicker = document.getElementById('bannerPicker');
    BANNER_GRADIENTS.forEach(b => {
        const d = document.createElement('button');
        d.className = 'grad-swatch' + (u.banner === b.key ? ' active' : '');
        d.style.background = b.css; d.title = b.label;
        d.addEventListener('click', async () => {
            const data = await saveProfilePatch({ banner: b.key });
            if (data.ok) {
                u.banner = b.key;
                applyBannerTo(previewBanner, b.key);
                document.querySelectorAll('#bannerPicker .grad-swatch').forEach(x => x.classList.remove('active'));
                d.classList.add('active');
            }
        });
        bannerPicker.appendChild(d);
    });
    document.getElementById('uploadBannerBtn').addEventListener('click', () => document.getElementById('bannerFile').click());
    document.getElementById('bannerFile').addEventListener('change', async (e) => {
        if (!e.target.files[0]) return;
        const dataUrl = await fileToDataURL(e.target.files[0], 1200);
        const data = await saveProfilePatch({ banner: dataUrl });
        if (data.ok) { u.banner = dataUrl; applyBannerTo(previewBanner, dataUrl); }
    });

    document.getElementById('saveProfileBtn').addEventListener('click', async () => {
        const display_name = document.getElementById('settingsNameInput').value.trim();
        const bio = document.getElementById('settingsBioInput').value.trim();
        const data = await saveProfilePatch({ display_name, bio });
        if (data.ok) showToast('Профиль сохранён ✨'); else showToast(data.error);
    });

    document.getElementById('changePassBtn').addEventListener('click', async () => {
        const old_password = document.getElementById('oldPassword').value;
        const new_password = document.getElementById('newPassword').value;
        if (!old_password || !new_password) return showToast('Заполни оба поля');
        
        const res = await fetch('/api/change-password', {
            method: 'POST', 
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ old_password, new_password })
        });
        const data = await res.json();
        if (data.ok) { 
            showToast('Пароль изменен'); 
            document.getElementById('oldPassword').value = ''; 
            document.getElementById('newPassword').value = ''; 
        } else {
            showToast(data.error);
        }
    });

    const themeGrid = document.getElementById('themeGrid');
    THEMES.forEach(t => {
        const btn = document.createElement('button');
        btn.className = 'theme-card' + (document.body.dataset.theme === t.key ? ' active' : '');
        btn.innerHTML = `<div class="theme-preview preview-${t.key}"></div><div class="theme-name">${t.label}</div>`;
        btn.addEventListener('click', () => {
            applyTheme(t.key);
            document.querySelectorAll('#themeGrid .theme-card').forEach(x => x.classList.remove('active'));
            btn.classList.add('active');
            showToast('Тема: ' + t.label);
        });
        themeGrid.appendChild(btn);
    });

    const accentGrid = document.getElementById('accentGrid');
    ACCENTS.forEach(a => {
        const btn = document.createElement('button');
        btn.className = 'accent-swatch';
        btn.style.background = a.color; btn.title = a.label;
        if ((document.body.dataset.accent || 'default') === a.key) btn.classList.add('active');
        btn.addEventListener('click', () => {
            if (a.key === 'default') delete document.body.dataset.accent;
            else document.body.dataset.accent = a.key;
            localStorage.setItem('accent', a.key);
            document.querySelectorAll('#accentGrid .accent-swatch').forEach(x => x.classList.remove('active'));
            btn.classList.add('active');
            showToast('Акцент: ' + a.label);
        });
        accentGrid.appendChild(btn);
    });

    document.querySelectorAll('[data-toggle]').forEach(input => {
        const key = input.dataset.toggle;
        input.checked = (localStorage.getItem(key) !== 'off');
        input.addEventListener('change', () => {
            localStorage.setItem(key, input.checked ? 'on' : 'off');
            applyBackgroundToggle(key, input.checked);
        });
    });

    document.getElementById('logoutBtn').addEventListener('click', () => {
        fetch('/api/logout', { method: 'POST' }).then(() => window.location.href = '/login.html');
    });
}