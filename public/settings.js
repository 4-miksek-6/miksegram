function applyBackgroundToggle(key, on) {
    if (key === 'bg-blobs') document.querySelectorAll('.bg-blobs').forEach(e => e.style.display = on ? '' : 'none');
    if (key === 'bg-stars') document.querySelectorAll('.stars').forEach(e => e.style.display = on ? '' : 'none');
    if (key === 'bg-grid') document.querySelectorAll('.bg-grid').forEach(e => e.style.display = on ? '' : 'none');
    if (key === 'bg-grain') document.querySelectorAll('.grain').forEach(e => e.style.display = on ? '' : 'none');
    if (key === 'anim') document.body.classList.toggle('no-anim', !on);
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
                <div class="settings-label" style="margin-bottom: 16px; text-align: center; width: 100%;">Предпросмотр</div>
                <!-- Превью рендерится здесь -->
            </div>

            <div class="settings-controls-col" id="settingsContent">
                <!-- Настройки рендерятся здесь -->
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
        // Сохраняем надпись, перерисовываем только карточку
        const label = previewCol.querySelector('.settings-label');
        previewCol.innerHTML = '';
        previewCol.appendChild(label);

        const card = document.createElement('div');
        card.className = 'preview-profile-card';
        card.innerHTML = `
            <div class="preview-banner" id="previewBanner"></div>
            <div class="preview-avatar-wrap">
                <div class="avatar preview-avatar" id="previewAvatar">?</div>
            </div>
            <div class="preview-info">
                <div class="preview-name" id="previewName">...</div>
                <div class="preview-login" id="previewLogin">@...</div>
                <div class="preview-bio" id="previewBio">...</div>
            </div>
        `;
        previewCol.appendChild(card);

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
            previewCol.style.display = 'flex';
            updatePreview();

            content.innerHTML = `
                <div class="settings-section">
                    <div class="settings-label">Рамка аватара</div>
                    <div class="live-picker-row" id="framePicker"></div>
                    <div class="color-picker-wrapper" id="frameColorWrapper" style="display:none;">
                        <span style="font-size:12px; color:var(--text-dim);">Свой цвет свечения:</span>
                        <input type="color" id="frameColorPicker" value="#00d4ff">
                    </div>
                </div>

                <div class="settings-section">
                    <div class="settings-label">Эффект имени</div>
                    <div class="live-picker-row" id="effectPicker"></div>
                    <div class="color-picker-wrapper" id="nameColorWrapper" style="display:none;">
                        <span style="font-size:12px; color:var(--text-dim);">Свой цвет свечения:</span>
                        <input type="color" id="nameColorPicker" value="#00d4ff">
                    </div>
                </div>

                <div class="settings-section" style="margin-top: 10px;">
                    <label class="settings-field">
                        <span class="settings-field-label">Отображаемое имя</span>
                        <input id="settingsNameInput" maxlength="40" value="${escapeHtml(u.display_name)}">
                    </label>
                    <label class="settings-field">
                        <span class="settings-field-label">О себе</span>
                        <textarea id="settingsBioInput" maxlength="200" rows="2">${escapeHtml(u.bio || '')}</textarea>
                    </label>
                </div>
            `;

            // Аватарка (загрузить)
            const avatarSec = document.createElement('div');
            avatarSec.className = 'settings-section';
            avatarSec.innerHTML = `
                <div class="settings-label">Аватарка</div>
                <div class="color-row">
                    <div class="color-circle grad-cyan active" style="pointer-events:none;"></div>
                </div>
                <button class="secondary-btn" id="uploadAvatarBtn" style="margin-top:8px;">Загрузить свою аватарку</button>
                <input type="file" id="avatarFile" accept="image/*" style="display:none">
            `;
            content.insertBefore(avatarSec, content.firstChild);

            // Баннер (загрузить)
            const bannerSec = document.createElement('div');
            bannerSec.className = 'settings-section';
            bannerSec.innerHTML = `
                <div class="settings-label">Баннер</div>
                <div class="color-row">
                    <div class="color-circle grad-aurora active" style="pointer-events:none;"></div>
                </div>
                <button class="secondary-btn" id="uploadBannerBtn" style="margin-top:8px;">Загрузить свой баннер</button>
                <input type="file" id="bannerFile" accept="image/*" style="display:none">
            `;
            content.insertBefore(bannerSec, content.children[1]);

            // Отрисовка рамок
            const framePicker = document.getElementById('framePicker');
            const frameColorWrapper = document.getElementById('frameColorWrapper');
            const frameColorPicker = document.getElementById('frameColorPicker');

            // Если цвет кастомный, парсим его
            let currentFrame = u.avatar_frame;
            let customFrameColor = '#00d4ff';
            if (currentFrame && currentFrame.startsWith('custom:')) {
                customFrameColor = currentFrame.split(':')[1];
                currentFrame = 'glow';
            }
            frameColorPicker.value = customFrameColor;
            document.documentElement.style.setProperty('--custom-glow-color', customFrameColor);

            AVATAR_FRAMES.forEach(f => {
                const isActive = currentFrame === f.key || (f.key === 'glow' && u.avatar_frame.startsWith('custom:'));
                const d = document.createElement('button');
                d.className = 'live-picker-btn' + (isActive ? ' active' : '');
                
                let avatarClass = `avatar live-avatar ${u.avatar.startsWith('grad') ? u.avatar : 'has-image'}`;
                if (f.key !== 'none') avatarClass += ` frame-${f.key}`;
                
                d.innerHTML = `<div class="${avatarClass}" style="${!u.avatar.startsWith('grad') ? `background-image:url(${u.avatar}); background-size:cover;` : ''}">${u.avatar.startsWith('grad') ? (u.display_name || '?').trim().charAt(0).toUpperCase() : ''}</div>
                              <span style="font-size:10px; margin-top:4px;">${f.label}</span>`;

                d.addEventListener('click', async () => {
                    let patchValue = f.key;
                    if (f.key === 'glow') {
                        frameColorWrapper.style.display = 'flex';
                        patchValue = `custom:${frameColorPicker.value}`;
                    } else {
                        frameColorWrapper.style.display = 'none';
                    }
                    const data = await saveProfilePatch({ avatar_frame: patchValue });
                    if (data.ok) {
                        u.avatar_frame = patchValue;
                        updatePreview();
                        renderTab('profile'); // Перерисовка для обновления активных состояний
                    }
                });
                framePicker.appendChild(d);
            });

            frameColorPicker.addEventListener('input', async (e) => {
                const color = e.target.value;
                document.documentElement.style.setProperty('--custom-glow-color', color);
                const patchValue = `custom:${color}`;
                await saveProfilePatch({ avatar_frame: patchValue });
                u.avatar_frame = patchValue;
                updatePreview();
            });

            // Отрисовка эффектов имени
            const effectPicker = document.getElementById('effectPicker');
            const nameColorWrapper = document.getElementById('nameColorWrapper');
            const nameColorPicker = document.getElementById('nameColorPicker');

            let currentEffect = u.name_effect;
            let customNameColor = '#00d4ff';
            if (currentEffect && currentEffect.startsWith('custom:')) {
                customNameColor = currentEffect.split(':')[1];
                currentEffect = 'glow';
            }
            nameColorPicker.value = customNameColor;

            NAME_EFFECTS.forEach(e => {
                const isActive = currentEffect === e.key || (e.key === 'glow' && u.name_effect.startsWith('custom:'));
                const d = document.createElement('button');
                d.className = 'live-picker-btn' + (isActive ? ' active' : '');
                
                let nameClass = e.key !== 'none' ? `name-${e.key}` : '';
                d.innerHTML = `<span class="live-name-text ${nameClass}">${escapeHtml(u.display_name || 'Имя')}</span>`;
                
                d.addEventListener('click', async () => {
                    let patchValue = e.key;
                    if (e.key === 'glow') {
                        nameColorWrapper.style.display = 'flex';
                        patchValue = `custom:${nameColorPicker.value}`;
                    } else {
                        nameColorWrapper.style.display = 'none';
                    }
                    const data = await saveProfilePatch({ name_effect: patchValue });
                    if (data.ok) {
                        u.name_effect = patchValue;
                        updatePreview();
                        renderTab('profile');
                    }
                });
                effectPicker.appendChild(d);
            });

            nameColorPicker.addEventListener('input', async (e) => {
                const color = e.target.value;
                document.documentElement.style.setProperty('--custom-glow-color', color); // Влияет и на имя и на рамку, если обе светятся
                const patchValue = `custom:${color}`;
                await saveProfilePatch({ name_effect: patchValue });
                u.name_effect = patchValue;
                updatePreview();
            });

            // АВТОСОХРАНЕНИЕ ИМЕНИ И BIO
            document.getElementById('settingsNameInput').addEventListener('change', async (e) => {
                const val = e.target.value.trim();
                if (!val) return showToast('Имя не может быть пустым');
                const data = await saveProfilePatch({ display_name: val });
                if (data.ok) { u.display_name = val; updatePreview(); renderTab('profile'); }
            });

            document.getElementById('settingsBioInput').addEventListener('change', async (e) => {
                const val = e.target.value.trim();
                const data = await saveProfilePatch({ bio: val });
                if (data.ok) { u.bio = val; updatePreview(); }
            });

            // Загрузка картинок
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
                                        renderTab('profile');
                                        showToast('Успешно!');
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
        }

        if (tabName === 'appearance') {
            previewCol.style.display = 'none';
            content.innerHTML = `
                <div class="settings-section">
                    <div class="settings-label">Цветовой акцент</div>
                    <div class="color-row" id="accentGrid"></div>
                </div>
                <div class="settings-section" style="margin-top:16px;">
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
                    <button class="primary-btn" id="changePassBtn" style="margin-top:10px;">Сменить пароль</button>
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
                    <button class="secondary-btn" id="logoutBtn2" style="width:100%; margin-top:10px;">Выйти из аккаунта</button>
                </div>
                <div class="settings-section" style="margin-top:24px; border:1px solid rgba(255,60,100,0.3); padding:16px; border-radius:16px;">
                    <div class="settings-label" style="color:#ff5c7c;">Удаление аккаунта</div>
                    <p style="font-size:13px; color:var(--text-dim);">Это действие необратимо.</p>
                    <button class="danger-btn" id="deleteAccountBtn" style="width:100%; margin-top:10px;">Удалить аккаунт навсегда</button>
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