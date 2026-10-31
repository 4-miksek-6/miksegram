const BG_PRESETS = [
    { key: 'cosmos', label: 'Космос' },
    { key: 'minimal', label: 'Минимализм' },
    { key: 'cyber', label: 'Киберпанк' },
    { key: 'matrix', label: 'Матрица' },
    { key: 'ocean', label: 'Океан' }
];

const ACCENTS = [
    { key: 'default', label: 'Аврора', color: '#00d4ff' },
    { key: 'emerald', label: 'Изумруд', color: '#00ffa3' },
    { key: 'cyan', label: 'Бирюза', color: '#00d4ff' },
    { key: 'blue', label: 'Голубой', color: '#4d9fff' },
    { key: 'violet', label: 'Фиолет', color: '#a855f7' },
    { key: 'lavender', label: 'Лаванда', color: '#b794f6' },
    { key: 'pink', label: 'Розовый', color: '#ff4ec7' },
    { key: 'magenta', label: 'Малина', color: '#ff2d95' },
    { key: 'red', label: 'Красный', color: '#ff3b3b' },
    { key: 'orange', label: 'Оранжевый', color: '#ff7b00' },
    { key: 'amber', label: 'Янтарь', color: '#ffb347' },
    { key: 'yellow', label: 'Желтый', color: '#facc15' },
    { key: 'lime', label: 'Лайм', color: '#b8ff00' },
    { key: 'gold', label: 'Золото', color: '#ffd700' },
    { key: 'white', label: 'Белый', color: '#ffffff' }
];

const AVATAR_FRAMES = [
    { key: 'none', label: 'Нет' },
    { key: 'glow', label: 'Свечение' },
    { key: 'dashed', label: 'Пунктир' }
];

const NAME_EFFECTS = [
    { key: 'none', label: 'Простое' },
    { key: 'glow', label: 'Свечение' },
    { key: 'duo', label: 'Цвет' }
];

function buildSettingsUI() {
    const body = document.getElementById('settingsBody');
    if (!body || !window.currentUser) return;
    const u = window.currentUser;

    body.innerHTML = `
        <div class="settings-layout" id="settingsLayout">
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
            </div>

            <div class="settings-controls-col" id="settingsContent"></div>
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
        applyBannerTo(document.getElementById('previewBanner'), u.banner);
        applyAvatarTo(document.getElementById('previewAvatar'), u.avatar, u.display_name, u.avatar_frame);
        const nameEl = document.getElementById('previewName');
        nameEl.textContent = u.display_name || 'Имя';
        applyNameEffect(nameEl, u.name_effect);
        document.getElementById('previewLogin').textContent = '@' + u.login;
        document.getElementById('previewBio').textContent = u.bio || 'Расскажи о себе...';
    }

    function renderTab(tabName) {
        const content = document.getElementById('settingsContent');
        const layout = document.getElementById('settingsLayout');
        content.innerHTML = '';

        if (tabName === 'profile') {
            layout.classList.remove('no-preview');
            updatePreview();

            let frameColor = '#00d4ff';
            let currentFrame = 'none';
            if (u.avatar_frame && u.avatar_frame.startsWith('frame_')) {
                const parts = u.avatar_frame.split(':');
                currentFrame = parts[0].replace('frame_', '');
                frameColor = parts[1] || '#00d4ff';
            }

            let nameColor = '#00d4ff';
            let currentEffect = 'none';
            if (u.name_effect && u.name_effect.startsWith('name_')) {
                const parts = u.name_effect.split(':');
                currentEffect = parts[0].replace('name_', '');
                nameColor = parts[1] || '#00d4ff';
            }

            content.innerHTML = `
                <div class="settings-section">
                    <div class="settings-label">Аватарка и Баннер</div>
                    <button class="secondary-btn" id="uploadAvatarBtn" style="width:100%; margin-bottom:8px;">Загрузить свою аватарку</button>
                    <button class="secondary-btn" id="uploadBannerBtn" style="width:100%;">Загрузить свой баннер</button>
                    <input type="file" id="avatarFile" accept="image/*" style="display:none">
                    <input type="file" id="bannerFile" accept="image/*" style="display:none">
                </div>

                <div class="settings-section">
                    <div class="settings-label">Рамка аватара</div>
                    <div class="live-picker-row" id="framePicker"></div>
                    <div class="color-picker-row" id="frameColorRow">
                        <span class="color-picker-label">Цвет рамки:</span>
                        <input type="color" id="frameColorPicker" value="${frameColor}">
                    </div>
                </div>

                <div class="settings-section">
                    <div class="settings-label">Эффект имени</div>
                    <div class="live-picker-row" id="effectPicker"></div>
                    <div class="color-picker-row" id="nameColorRow">
                        <span class="color-picker-label">Цвет имени:</span>
                        <input type="color" id="nameColorPicker" value="${nameColor}">
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

            const framePicker = document.getElementById('framePicker');
            AVATAR_FRAMES.forEach(f => {
                const isActive = currentFrame === f.key;
                const d = document.createElement('button');
                d.className = 'live-picker-btn' + (isActive ? ' active' : '');
                
                let avatarClass = `avatar live-avatar ${u.avatar.startsWith('grad') ? u.avatar : 'has-image'}`;
                let inlineStyles = !u.avatar.startsWith('grad') ? `background-image:url(${u.avatar}); background-size:cover;` : '';
                
                if (f.key !== 'none') {
                    if (f.key === 'glow') inlineStyles += `border: 2px solid ${frameColor}; box-shadow: 0 0 10px ${frameColor};`;
                    if (f.key === 'dashed') inlineStyles += `border: 2px dashed ${frameColor};`;
                }
                
                d.innerHTML = `<div class="${avatarClass}" style="${inlineStyles}">${u.avatar.startsWith('grad') ? (u.display_name || '?').trim().charAt(0).toUpperCase() : ''}</div>
                              <span style="font-size:10px; margin-top:4px;">${f.label}</span>`;

                d.addEventListener('click', async () => {
                    document.querySelectorAll('#framePicker .live-picker-btn').forEach(x => x.classList.remove('active'));
                    d.classList.add('active');
                    
                    let patchValue = f.key;
                    if (f.key === 'glow') patchValue = `frame_glow:${frameColor}`;
                    if (f.key === 'dashed') patchValue = `frame_dashed:${frameColor}`;

                    const data = await saveProfilePatch({ avatar_frame: patchValue });
                    if (data.ok) { 
                        Object.assign(u, data.user); 
                        updatePreview(); 
                        renderTab('profile');
                    }
                });
                framePicker.appendChild(d);
            });

            document.getElementById('frameColorPicker').addEventListener('change', async (e) => {
                frameColor = e.target.value;
                if (currentFrame === 'glow' || currentFrame === 'dashed') {
                    let patchValue = currentFrame === 'glow' ? `frame_glow:${frameColor}` : `frame_dashed:${frameColor}`;
                    const data = await saveProfilePatch({ avatar_frame: patchValue });
                    if (data.ok) { 
                        Object.assign(u, data.user);
                        updatePreview(); 
                        renderTab('profile'); 
                    }
                }
            });

            const effectPicker = document.getElementById('effectPicker');
            NAME_EFFECTS.forEach(e => {
                const isActive = currentEffect === e.key;
                const d = document.createElement('button');
                d.className = 'live-picker-btn' + (isActive ? ' active' : '');
                
                let inlineStyles = '';
                if (e.key === 'glow') inlineStyles = `color: #fff; text-shadow: 0 0 10px ${nameColor};`;
                if (e.key === 'duo') inlineStyles = `color: ${nameColor}; font-weight: 800;`;
                
                d.innerHTML = `<span class="live-name-text" style="${inlineStyles}">${escapeHtml(u.display_name || 'Имя')}</span>`;

                d.addEventListener('click', async () => {
                    document.querySelectorAll('#effectPicker .live-picker-btn').forEach(x => x.classList.remove('active'));
                    d.classList.add('active');
                    
                    let patchValue = e.key;
                    if (e.key === 'glow') patchValue = `name_glow:${nameColor}`;
                    if (e.key === 'duo') patchValue = `name_color:${nameColor}`;

                    const data = await saveProfilePatch({ name_effect: patchValue });
                    if (data.ok) { 
                        Object.assign(u, data.user); 
                        updatePreview(); 
                        renderTab('profile');
                    }
                });
                effectPicker.appendChild(d);
            });

            document.getElementById('nameColorPicker').addEventListener('change', async (e) => {
                nameColor = e.target.value;
                if (currentEffect === 'glow' || currentEffect === 'duo') {
                    let patchValue = currentEffect === 'glow' ? `name_glow:${nameColor}` : `name_color:${nameColor}`;
                    const data = await saveProfilePatch({ name_effect: patchValue });
                    if (data.ok) { 
                        Object.assign(u, data.user);
                        updatePreview(); 
                        renderTab('profile');
                    }
                }
            });

            document.getElementById('settingsNameInput').addEventListener('change', async (e) => {
                const val = e.target.value.trim();
                if (!val) return showToast('Имя не может быть пустым');
                const data = await saveProfilePatch({ display_name: val });
                if (data.ok) { Object.assign(u, data.user); updatePreview(); }
            });

            document.getElementById('settingsBioInput').addEventListener('change', async (e) => {
                const val = e.target.value.trim();
                const data = await saveProfilePatch({ bio: val });
                if (data.ok) { Object.assign(u, data.user); updatePreview(); }
            });

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
            layout.classList.add('no-preview');
            const currentBg = localStorage.getItem('bg-preset') || 'cosmos';
            
            const savedSidebarOpacity = localStorage.getItem('sidebar-opacity') || '0.55';
            const savedChatOpacity = localStorage.getItem('chat-opacity') || '0.85';

            content.innerHTML = `
                <div class="settings-section">
                    <div class="settings-label" style="margin-bottom: 8px;">Фон приложения</div>
                    <div class="preset-grid" id="presetGrid"></div>
                </div>
                <div class="settings-section" style="margin-top:16px;">
                    <div class="settings-label" style="margin-bottom: 8px;">Цветовой акцент</div>
                    <div class="accent-grid" id="accentGrid"></div>
                </div>
                <div class="settings-section" style="margin-top:24px;">
                    <div class="settings-label" style="margin-bottom: 8px;">Прозрачность интерфейса</div>
                    
                    <div class="opacity-control">
                        <span>Левое меню (чаты): <span id="val-sidebar">${Math.round(savedSidebarOpacity * 100)}%</span></span>
                        <input type="range" min="0.1" max="1.0" step="0.05" value="${savedSidebarOpacity}" id="sidebarOpacity" class="opacity-slider">
                    </div>
                    
                    <div class="opacity-control" style="margin-top:12px;">
                        <span>Область чата: <span id="val-chat">${Math.round(savedChatOpacity * 100)}%</span></span>
                        <input type="range" min="0.1" max="1.0" step="0.05" value="${savedChatOpacity}" id="chatOpacity" class="opacity-slider">
                    </div>
                </div>
            `;

            // Ползунки прозрачности
            const sidebarSlider = document.getElementById('sidebarOpacity');
            const chatSlider = document.getElementById('chatOpacity');
            const valSidebar = document.getElementById('val-sidebar');
            const valChat = document.getElementById('val-chat');

            sidebarSlider.addEventListener('input', (e) => {
                const val = e.target.value;
                document.documentElement.style.setProperty('--sidebar-opacity', val);
                localStorage.setItem('sidebar-opacity', val);
                valSidebar.textContent = Math.round(val * 100) + '%';
            });

            chatSlider.addEventListener('input', (e) => {
                const val = e.target.value;
                document.documentElement.style.setProperty('--chat-opacity', val);
                localStorage.setItem('chat-opacity', val);
                valChat.textContent = Math.round(val * 100) + '%';
            });

            // Пресеты фона
            const presetGrid = document.getElementById('presetGrid');
            BG_PRESETS.forEach(p => {
                const btn = document.createElement('div');
                btn.className = 'preset-card' + (currentBg === p.key ? ' active' : '');
                btn.innerHTML = `
                    <div class="preset-preview" data-bg="${p.key}"></div>
                    <span class="preset-name">${p.label}</span>
                `;
                btn.addEventListener('click', () => {
                    document.body.dataset.bg = p.key;
                    localStorage.setItem('bg-preset', p.key);
                    
                    document.querySelectorAll('#presetGrid .preset-card').forEach(x => x.classList.remove('active'));
                    btn.classList.add('active');
                    showToast('Фон: ' + p.label);
                });
                presetGrid.appendChild(btn);
            });

            // Акценты
            const accentGrid = document.getElementById('accentGrid');
            ACCENTS.forEach(a => {
                const btn = document.createElement('button');
                btn.className = 'color-circle';
                btn.style.background = a.color;
                btn.style.color = a.color; 
                
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
        }

        if (tabName === 'notifications') {
            layout.classList.add('no-preview');
            content.innerHTML = `
                <div class="settings-section">
                    <div class="settings-label">Уведомления</div>
                    <p style="font-size:13px; color:var(--text-dim);">Эти настройки скоро появятся.</p>
                </div>
            `;
        }

        if (tabName === 'security') {
            layout.classList.add('no-preview');
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
            layout.classList.add('no-preview');
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