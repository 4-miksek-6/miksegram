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

const AVATAR_FRAMES = [
    { key: 'none', label: 'Нет' },
    { key: 'rainbow', label: 'Радуга' },
    { key: 'dashed', label: 'Пунктир' },
    { key: 'glow', label: 'Свечение' },
    { key: 'fire', label: 'Огонь' }
];

const NAME_EFFECTS = [
    { key: 'none', label: 'Обычный' },
    { key: 'rainbow', label: 'Радуга' },
    { key: 'glow', label: 'Свечение' },
    { key: 'duo', label: 'Два цвета' }
];

function buildSettingsUI() {
    const body = document.getElementById('settingsBody');
    if (!body || !window.currentUser) return;
    const u = window.currentUser;

    body.innerHTML = `
        <div class="settings-layout">
            <div class="settings-sidebar">
                <div class="settings-tab active" data-tab="profile">Профиль</div>
                <div class="settings-tab" data-tab="appearance">Оформление</div>
                <div class="settings-tab" data-tab="notifications">Уведомления</div>
                <div class="settings-tab" data-tab="security">Безопасность</div>
                <div class="settings-tab" data-tab="account">Аккаунт</div>
                <button class="danger-btn" id="logoutBtn" style="margin-top:auto; padding:10px;">Выйти</button>
            </div>
            
            <div class="settings-preview-col" id="settingsPreviewCol">
                <!-- Сюда рендерится превью -->
            </div>

            <div class="settings-controls-col" id="settingsContent">
                <!-- Сюда рендерятся настройки -->
            </div>
        </div>
    `;

    document.querySelectorAll('.settings-tab').forEach(tab => {
        tab.addEventListener('click', () => {
            document.querySelectorAll('.settings-tab').forEach(t => t.classList.remove('active'));
            tab.classList.add('active');
            renderTab(tab.dataset.tab);
        });
    });

    function updatePreview() {
        const previewCol = document.getElementById('settingsPreviewCol');
        previewCol.innerHTML = `
            <div class="preview-profile-card">
                <div class="preview-banner" id="previewBanner"></div>
                <div class="preview-avatar-wrap">
                    <div class="avatar preview-avatar" id="previewAvatar">?</div>
                </div>
                <div class="preview-info">
                    <div class="preview-name" id="previewName">...</div>
                    <div class="preview-login" id="previewLogin">@...</div>
                    <div class="preview-bio" id="previewBio">...</div>
                </div>
            </div>
        `;

        applyBannerTo(document.getElementById('previewBanner'), u.banner);
        applyAvatarTo(document.getElementById('previewAvatar'), u.avatar, u.display_name, u.avatar_frame);
        document.getElementById('previewName').textContent = u.display_name || 'Имя';
        applyNameEffect(document.getElementById('previewName'), u.name_effect);
        document.getElementById('previewLogin').textContent = '@' + u.login;
        document.getElementById('previewBio').textContent = u.bio || 'Расскажи о себе...';
    }

    function renderTab(tabName) {
        const content = document.getElementById('settingsContent');
        const previewCol = document.getElementById('settingsPreviewCol');
        content.innerHTML = '';

        if (tabName === 'profile') {
            previewCol.style.display = 'flex'; // Показываем превью
            updatePreview();

            content.innerHTML = `
                <div class="settings-section">
                    <div class="settings-label">Аватарка</div>
                    <div class="color-row" id="avatarPicker"></div>
                    <button class="secondary-btn" id="uploadAvatarBtn">Загрузить свою аватарку</button>
                    <input type="file" id="avatarFile" accept="image/*" style="display:none">
                </div>

                <div class="settings-section">
                    <div class="settings-label">Рамка аватара</div>
                    <div class="live-picker-row" id="framePicker"></div>
                </div>

                <div class="settings-section">
                    <div class="settings-label">Баннер</div>
                    <div class="color-row" id="bannerPicker"></div>
                    <button class="secondary-btn" id="uploadBannerBtn">Загрузить свой баннер</button>
                    <input type="file" id="bannerFile" accept="image/*" style="display:none">
                </div>

                <div class="settings-section">
                    <div class="settings-label">Эффект имени</div>
                    <div class="live-picker-row" id="effectPicker"></div>
                </div>

                <div class="settings-section">
                    <div class="settings-label">Личные данные</div>
                    <label class="settings-field">
                        <span class="settings-field-label">Отображаемое имя</span>
                        <input id="settingsNameInput" maxlength="40" value="${escapeHtml(u.display_name)}">
                    </label>
                    <label class="settings-field">
                        <span class="settings-field-label">О себе</span>
                        <textarea id="settingsBioInput" maxlength="200" rows="2">${escapeHtml(u.bio || '')}</textarea>
                    </label>
                    <button class="primary-btn" id="saveProfileBtn">Сохранить профиль</button>
                </div>
            `;

            // Отрисовка выбора аватара (кружочки)
            const avatarPicker = document.getElementById('avatarPicker');
            AVATAR_GRADIENTS.forEach(g => {
                const d = document.createElement('button');
                d.className = 'color-circle ' + g.key + (u.avatar === g.key ? ' active' : '');
                d.title = g.label;
                d.addEventListener('click', async () => {
                    const data = await saveProfilePatch({ avatar: g.key });
                    if (data.ok) {
                        u.avatar = g.key;
                        updatePreview();
                        document.querySelectorAll('#avatarPicker .color-circle').forEach(x => x.classList.remove('active'));
                        d.classList.add('active');
                    }
                });
                avatarPicker.appendChild(d);
            });

            // Отрисовка выбора баннера (кружочки)
            const bannerPicker = document.getElementById('bannerPicker');
            BANNER_GRADIENTS.forEach(b => {
                const d = document.createElement('button');
                d.className = 'color-circle' + (u.banner === b.key ? ' active' : '');
                d.style.background = b.css;
                d.title = b.label;
                d.addEventListener('click', async () => {
                    const data = await saveProfilePatch({ banner: b.key });
                    if (data.ok) {
                        u.banner = b.key;
                        updatePreview();
                        document.querySelectorAll('#bannerPicker .color-circle').forEach(x => x.classList.remove('active'));
                        d.classList.add('active');
                    }
                });
                bannerPicker.appendChild(d);
            });

            // Отрисовка выбора рамки (живое превью с аватаркой)
            const framePicker = document.getElementById('framePicker');
            AVATAR_FRAMES.forEach(f => {
                const d = document.createElement('button');
                d.className = 'live-picker-btn' + (u.avatar_frame === f.key ? ' active' : '');
                d.innerHTML = `<div class="avatar live-avatar ${u.avatar.startsWith('grad') ? u.avatar : 'has-image'}" 
                                style="${u.avatar.startsWith('grad') ? '' : `background-image:url(${u.avatar}); background-size:cover;`} 
                                ${f.key !== 'none' ? `class="avatar live-avatar frame-${f.key}"` : ''}">
                                ${u.avatar.startsWith('grad') ? (u.display_name || '?').trim().charAt(0).toUpperCase() : ''}
                              </div>
                              <span style="font-size:10px; margin-top:4px;">${f.label}</span>`;
                
                // Костыль для правильного применения классов рамок
                const avatarDiv = d.querySelector('.avatar');
                avatarDiv.className = `avatar live-avatar ${u.avatar.startsWith('grad') ? u.avatar : 'has-image'}`;
                if (f.key !== 'none') avatarDiv.classList.add(`frame-${f.key}`);
                if (!u.avatar.startsWith('grad')) {
                    avatarDiv.style.backgroundImage = `url(${u.avatar})`;
                    avatarDiv.style.backgroundSize = 'cover';
                }

                d.addEventListener('click', async () => {
                    const data = await saveProfilePatch({ avatar_frame: f.key });
                    if (data.ok) {
                        u.avatar_frame = f.key;
                        updatePreview();
                        document.querySelectorAll('#framePicker .live-picker-btn').forEach(x => x.classList.remove('active'));
                        d.classList.add('active');
                    }
                });
                framePicker.appendChild(d);
            });

            // Отрисовка выбора эффекта имени (живое превью с твоим именем)
            const effectPicker = document.getElementById('effectPicker');
            NAME_EFFECTS.forEach(e => {
                const d = document.createElement('button');
                d.className = 'live-picker-btn' + (u.name_effect === e.key ? ' active' : '');
                d.innerHTML = `<span class="live-name-text ${e.key !== 'none' ? 'name-' + e.key : ''}">${escapeHtml(u.display_name || 'Имя')}</span>`;
                d.addEventListener('click', async () => {
                    const data = await saveProfilePatch({ name_effect: e.key });
                    if (data.ok) {
                        u.name_effect = e.key;
                        updatePreview();
                        document.querySelectorAll('#effectPicker .live-picker-btn').forEach(x => x.classList.remove('active'));
                        d.classList.add('active');
                    }
                });
                effectPicker.appendChild(d);
            });

            // Кроппер и сохранение
            document.getElementById('uploadAvatarBtn').addEventListener('click', () => document.getElementById('avatarFile').click());
            document.getElementById('uploadBannerBtn').addEventListener('click', () => document.getElementById('bannerFile').click());

            function openCropper(file, isBanner) {
                if (!file.type.startsWith('image/')) { showToast('Только картинки'); return; }
                if (file.size > 5 * 1024 * 1024) { showToast('Максимум 5 МБ'); return; }

                const reader = new FileReader();
                reader.onload = (e) => {
                    const modal = document.createElement('div');
                    modal.className = 'modal-overlay open';
                    modal.style.zIndex = '3000';
                    modal.innerHTML = `
                        <div class="modal" style="max-width: 600px; padding: 20px; background: var(--bg-0);">
                            <div class="modal-header"><h2 class="modal-title">Обрезка</h2></div>
                            <div style="max-height: 50vh; background: #000; border-radius: 12px; overflow: hidden; margin-bottom: 16px;">
                                <img id="cropImage" src="${e.target.result}" style="max-width: 100%; display: block;">
                            </div>
                            <div style="display:flex; gap:10px;">
                                <button class="primary-btn" id="saveCropBtn" style="flex:1;">Сохранить</button>
                                <button class="secondary-btn" id="cancelCropBtn" style="flex:1;">Отмена</button>
                            </div>
                        </div>
                    `;
                    document.body.appendChild(modal);

                    const image = modal.querySelector('#cropImage');
                    const cropper = new Cropper(image, {
                        aspectRatio: isBanner ? 16 / 6 : 1,
                        viewMode: 1, dragMode: 'move', autoCropArea: 1, background: false
                    });

                    modal.querySelector('#cancelCropBtn').onclick = () => { cropper.destroy(); modal.remove(); };

                    modal.querySelector('#saveCropBtn').onclick = () => {
                        modal.querySelector('#saveCropBtn').textContent = 'Загрузка...';
                        cropper.getCroppedCanvas({ width: isBanner ? 1200 : 400 }).toBlob(async (blob) => {
                            const formData = new FormData();
                            formData.append('file', blob, 'avatar.jpg');
                            try {
                                const res = await fetch('/api/upload-avatar', { method: 'POST', body: formData });
                                const data = await res.json();
                                if (data.ok) {
                                    const patch = isBanner ? { banner: data.url } : { avatar: data.url };
                                    const updateRes = await saveProfilePatch(patch);
                                    if (updateRes.ok) {
                                        if (isBanner) u.banner = data.url; else u.avatar = data.url;
                                        updatePreview();
                                        renderTab('profile'); // Перерисовываем, чтобы обновить превью рамок
                                        showToast('Успешно обновлено!');
                                    }
                                } else showToast(data.error);
                            } catch (err) { showToast('Ошибка сети'); } 
                            finally { cropper.destroy(); modal.remove(); }
                        }, 'image/jpeg', 0.9);
                    };
                };
                reader.readAsDataURL(file);
            }

            document.getElementById('avatarFile').addEventListener('change', (e) => { if (e.target.files[0]) openCropper(e.target.files[0], false); e.target.value = ''; });
            document.getElementById('bannerFile').addEventListener('change', (e) => { if (e.target.files[0]) openCropper(e.target.files[0], true); e.target.value = ''; });

            document.getElementById('saveProfileBtn').addEventListener('click', async () => {
                const display_name = document.getElementById('settingsNameInput').value.trim();
                const bio = document.getElementById('settingsBioInput').value.trim();
                const data = await saveProfilePatch({ display_name, bio });
                if (data.ok) { 
                    u.display_name = display_name; 
                    u.bio = bio; 
                    updatePreview();
                    renderTab('profile'); // Обновляем превью имени в кнопках
                    showToast('Профиль сохранён ✨'); 
                } else showToast(data.error);
            });
        }

        if (tabName === 'appearance') {
            previewCol.style.display = 'none'; // Скрываем превью, чтобы не мешало
            content.innerHTML = `
                <div class="settings-section">
                    <div class="settings-label">Цветовой акцент</div>
                    <div class="color-row" id="accentGrid"></div>
                </div>
                <div class="settings-section">
                    <div class="settings-label">Фон и Анимации</div>
                    <div class="toggle-list">
                        <label class="toggle-row"><span>Живые пятна</span><input type="checkbox" data-toggle="bg-blobs"><span class="toggle-switch"></span></label>
                        <label class="toggle-row"><span>Звёзды</span><input type="checkbox" data-toggle="bg-stars"><span class="toggle-switch"></span></label>
                        <label class="toggle-row"><span>Сетка</span><input type="checkbox" data-toggle="bg-grid"><span class="toggle-switch"></span></label>
                        <label class="toggle-row"><span>Зернистость</span><input type="checkbox" data-toggle="bg-grain"><span class="toggle-switch"></span></label>
                        <label class="toggle-row"><span>Магнитные кнопки</span><input type="checkbox" data-toggle="anim"><span class="toggle-switch"></span></label>
                    </div>
                </div>
            `;

            const accentGrid = document.getElementById('accentGrid');
            ACCENTS.forEach(a => {
                const btn = document.createElement('button');
                btn.className = 'color-circle';
                btn.style.background = a.color;
                btn.title = a.label;
                if ((document.body.dataset.accent || 'default') === a.key) btn.classList.add('active');
                btn.addEventListener('click', () => {
                    if (a.key === 'default') delete document.body.dataset.accent;
                    else document.body.dataset.accent = a.key;
                    localStorage.setItem('accent', a.key);
                    document.querySelectorAll('#accentGrid .color-circle').forEach(x => x.classList.remove('active'));
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
        }

        if (tabName === 'notifications') {
            previewCol.style.display = 'none';
            content.innerHTML = `
                <div class="settings-section">
                    <div class="settings-label">Уведомления</div>
                    <div class="toggle-list">
                        <label class="toggle-row"><span>Звуки сообщений</span><input type="checkbox" checked><span class="toggle-switch"></span></label>
                        <label class="toggle-row"><span>Push-уведомления</span><input type="checkbox" checked><span class="toggle-switch"></span></label>
                    </div>
                </div>
            `;
        }

        if (tabName === 'security') {
            previewCol.style.display = 'none';
            content.innerHTML = `
                <div class="settings-section">
                    <div class="settings-label">Смена пароля</div>
                    <label class="settings-field">
                        <span class="settings-field-label">Текущий пароль</span>
                        <input type="password" id="oldPassword" placeholder="Старый пароль">
                    </label>
                    <label class="settings-field">
                        <span class="settings-field-label">Новый пароль</span>
                        <input type="password" id="newPassword" placeholder="Новый пароль">
                    </label>
                    <button class="primary-btn" id="changePassBtn">Сменить пароль</button>
                </div>
            `;
            document.getElementById('changePassBtn').addEventListener('click', async () => {
                const old_password = document.getElementById('oldPassword').value;
                const new_password = document.getElementById('newPassword').value;
                if (!old_password || !new_password) return showToast('Заполни оба поля');
                
                const res = await fetch('/api/change-password', {
                    method: 'POST', headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({ old_password, new_password })
                });
                const data = await res.json();
                if (data.ok) { showToast('Пароль изменен'); document.getElementById('oldPassword').value = ''; document.getElementById('newPassword').value = ''; }
                else showToast(data.error);
            });
        }

        if (tabName === 'account') {
            previewCol.style.display = 'none';
            content.innerHTML = `
                <div class="settings-section">
                    <div class="settings-label">Аккаунт</div>
                    <p style="font-size:13px; color:var(--text-dim);">Выйдя из аккаунта, вы можете войти снова в любой момент.</p>
                    <button class="secondary-btn" id="logoutBtn2" style="width:100%;">Выйти из аккаунта</button>
                </div>
                <div class="settings-section" style="margin-top:24px; border:1px solid rgba(255,60,100,0.3); padding:16px; border-radius:16px;">
                    <div class="settings-label" style="color:#ff5c7c;">Удаление аккаунта</div>
                    <p style="font-size:13px; color:var(--text-dim);">Это действие необратимо.</p>
                    <button class="danger-btn" id="deleteAccountBtn" style="width:100%;">Удалить аккаунт навсегда</button>
                </div>
            `;
            document.getElementById('logoutBtn2').addEventListener('click', () => {
                fetch('/api/logout', { method: 'POST' }).then(() => window.location.href = '/login.html');
            });
            document.getElementById('deleteAccountBtn').addEventListener('click', () => {
                showToast('Функция удаления появится позже');
            });
        }
    }

    renderTab('profile');

    document.getElementById('logoutBtn').addEventListener('click', () => {
        fetch('/api/logout', { method: 'POST' }).then(() => window.location.href = '/login.html');
    });
}