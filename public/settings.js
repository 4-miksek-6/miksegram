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
                    <div class="settings-label" style="margin-bottom: 8px;">Основные</div>
                    <div class="toggle-list">
                        <label class="toggle-row">
                            <span>🔔 Push-уведомления</span>
                            <input type="checkbox" id="toggle-push"><span class="toggle-switch"></span>
                        </label>
                        <label class="toggle-row">
                            <span>🙈 Скрывать текст в Push</span>
                            <input type="checkbox" id="toggle-hide-text"><span class="toggle-switch"></span>
                        </label>
                        <label class="toggle-row">
                            <span>📳 Вибрация (на телефоне)</span>
                            <input type="checkbox" id="toggle-vibrate"><span class="toggle-switch"></span>
                        </label>
                        <label class="toggle-row">
                            <span>✨ Мигание заголовка вкладки</span>
                            <input type="checkbox" id="toggle-blink"><span class="toggle-switch"></span>
                        </label>
                    </div>
                </div>

                <div class="settings-section" style="margin-top:24px;">
                    <div class="settings-label" style="margin-bottom: 8px;">Звуки</div>
                    <div class="toggle-list" style="margin-bottom: 12px;">
                        <label class="toggle-row">
                            <span>🔊 Звуки сообщений</span>
                            <input type="checkbox" id="toggle-sound"><span class="toggle-switch"></span>
                        </label>
                    </div>
                    
                    <div class="opacity-control" id="volume-control">
                        <span>Громкость: <span id="val-volume">50%</span></span>
                        <input type="range" min="0" max="1" step="0.05" value="0.5" id="slider-volume" class="opacity-slider">
                    </div>
                    
                    <button class="secondary-btn" id="test-sound-btn" style="margin-top: 12px; width: fit-content;">🔉 Проверить звук</button>
                </div>
            `;

            const pushToggle = document.getElementById('toggle-push');
            const hideTextToggle = document.getElementById('toggle-hide-text');
            const vibrateToggle = document.getElementById('toggle-vibrate');
            const blinkToggle = document.getElementById('toggle-blink');
            const soundToggle = document.getElementById('toggle-sound');
            const volumeSlider = document.getElementById('slider-volume');
            const valVolume = document.getElementById('val-volume');
            const volumeControl = document.getElementById('volume-control');
            const testSoundBtn = document.getElementById('test-sound-btn');

            pushToggle.checked = localStorage.getItem('notif-push') !== 'off';
            hideTextToggle.checked = localStorage.getItem('notif-hide-text') !== 'off';
            vibrateToggle.checked = localStorage.getItem('notif-vibrate') !== 'off';
            blinkToggle.checked = localStorage.getItem('notif-blink') !== 'off';
            soundToggle.checked = localStorage.getItem('notif-sound') !== 'off';
            
            const savedVol = localStorage.getItem('notif-volume') || '0.5';
            volumeSlider.value = savedVol;
            valVolume.textContent = Math.round(savedVol * 100) + '%';

            if (!soundToggle.checked) {
                volumeSlider.disabled = true;
                testSoundBtn.disabled = true;
                volumeControl.style.opacity = '0.5';
            }

            pushToggle.addEventListener('change', (e) => localStorage.setItem('notif-push', e.target.checked ? 'on' : 'off'));
            hideTextToggle.addEventListener('change', (e) => localStorage.setItem('notif-hide-text', e.target.checked ? 'on' : 'off'));
            vibrateToggle.addEventListener('change', (e) => localStorage.setItem('notif-vibrate', e.target.checked ? 'on' : 'off'));
            blinkToggle.addEventListener('change', (e) => localStorage.setItem('notif-blink', e.target.checked ? 'on' : 'off'));
            
            soundToggle.addEventListener('change', (e) => {
                localStorage.setItem('notif-sound', e.target.checked ? 'on' : 'off');
                if (e.target.checked) {
                    volumeSlider.disabled = false;
                    testSoundBtn.disabled = false;
                    volumeControl.style.opacity = '1';
                } else {
                    volumeSlider.disabled = true;
                    testSoundBtn.disabled = true;
                    volumeControl.style.opacity = '0.5';
                }
            });

            volumeSlider.addEventListener('input', (e) => {
                const val = e.target.value;
                valVolume.textContent = Math.round(val * 100) + '%';
                localStorage.setItem('notif-volume', val);
            });

            testSoundBtn.addEventListener('click', () => {
                const vol = parseFloat(localStorage.getItem('notif-volume') || '0.5');
                const testAudio = new Audio('/notify.mp3');
                testAudio.volume = vol;
                testAudio.play().catch(() => showToast('Браузер заблокировал звук'));
            });
        }

        if (tabName === 'account') {
            layout.classList.add('no-preview');
            content.innerHTML = `
                <div class="account-block">
                    <div class="settings-label">Смена пароля</div>
                    
                    <div class="settings-field">
                        <span class="settings-field-label">Текущий пароль</span>
                        <div class="password-input-wrap">
                            <input type="password" id="oldPassword" placeholder="Введите старый пароль">
                            <button type="button" class="password-toggle" id="toggleOld">👁️</button>
                        </div>
                    </div>
                    
                    <div class="settings-field">
                        <span class="settings-field-label">Новый пароль</span>
                        <div class="password-input-wrap">
                            <input type="password" id="newPassword" placeholder="Введите новый пароль" oninput="updateStrength(this.value)">
                            <button type="button" class="password-toggle" id="toggleNew">👁️</button>
                        </div>
                    </div>

                    <div class="strength-meter"><div class="strength-bar" id="strengthBar"></div></div>
                    <div class="strength-text" id="strengthText"></div>
                    
                    <button class="primary-btn" id="changePassBtn">Сменить пароль</button>
                </div>

                <div class="account-block" style="margin-top: 16px;">
                    <div class="settings-label">Выход</div>
                    <p style="font-size:13px; color:var(--text-dim); margin:0;">Вы можете выйти из аккаунта на этом устройстве.</p>
                    <button class="secondary-btn" id="logoutBtn2">Выйти из аккаунта</button>
                </div>

                <div class="account-block danger-zone" style="margin-top: 16px;">
                    <div class="settings-label" style="color:#ff5c7c;">Удаление аккаунта</div>
                    <p style="font-size:13px; color:var(--text-dim); margin:0;">Это действие необратимо. Все ваши сообщения, чаты и файлы будут удалены навсегда.</p>
                    <button class="danger-btn" id="deleteAccountBtn">Удалить аккаунт навсегда</button>
                </div>
            `;

            // Логика показа пароля
            function setupToggle(btnId, inputId) {
                document.getElementById(btnId).addEventListener('click', () => {
                    const input = document.getElementById(inputId);
                    if (input.type === 'password') {
                        input.type = 'text';
                        document.getElementById(btnId).textContent = '🙈';
                    } else {
                        input.type = 'password';
                        document.getElementById(btnId).textContent = '👁️';
                    }
                });
            }
            setupToggle('toggleOld', 'oldPassword');
            setupToggle('toggleNew', 'newPassword');

            // Логика смены пароля
            document.getElementById('changePassBtn').addEventListener('click', async () => {
                const old_password = document.getElementById('oldPassword').value;
                const new_password = document.getElementById('newPassword').value;
                if (!old_password || !new_password) return showToast('Заполни оба поля');
                
                const res = await fetch('/api/change-password', {
                    method: 'POST', headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({ old_password, new_password })
                });
                const data = await res.json();
                if (data.ok) { 
                    showToast('Пароль успешно изменен'); 
                    document.getElementById('oldPassword').value = ''; 
                    document.getElementById('newPassword').value = ''; 
                    document.getElementById('strengthBar').style.width = '0%';
                    document.getElementById('strengthText').textContent = '';
                }
                else showToast(data.error);
            });

            // Логика выхода
            document.getElementById('logoutBtn2').addEventListener('click', () => {
                fetch('/api/logout', { method: 'POST' }).then(() => window.location.href = '/login.html');
            });

            // Логика удаления аккаунта
            document.getElementById('deleteAccountBtn').addEventListener('click', () => {
                const modal = document.createElement('div');
                modal.className = 'modal-overlay open';
                modal.style.zIndex = '3000';
                modal.innerHTML = `
                    <div class="modal" style="max-width: 400px; padding: 24px; background: var(--bg-0);">
                        <h2 class="modal-title" style="color: #ff5c7c; margin-bottom: 12px;">Вы уверены?</h2>
                        <p style="color: var(--text); margin-bottom: 16px; font-size: 14px;">Это действие навсегда удалит ваш аккаунт и все данные. Для подтверждения введите ваш пароль.</p>
                        <div class="password-input-wrap">
                            <input type="password" id="deleteConfirmPass" placeholder="Введите пароль">
                        </div>
                        <div style="display:flex; gap:10px; margin-top: 16px;">
                            <button class="danger-btn" id="confirmDeleteBtn" style="flex:1;">Удалить</button>
                            <button class="secondary-btn" id="cancelDeleteBtn" style="flex:1;">Отмена</button>
                        </div>
                    </div>
                `;
                document.body.appendChild(modal);

                modal.querySelector('#cancelDeleteBtn').onclick = () => modal.remove();
                
                modal.querySelector('#confirmDeleteBtn').onclick = async () => {
                    const password = modal.querySelector('#deleteConfirmPass').value;
                    if (!password) return showToast('Введите пароль');
                    
                    const btn = modal.querySelector('#confirmDeleteBtn');
                    btn.textContent = 'Удаление...';
                    btn.disabled = true;

                    const res = await fetch('/api/delete-account', {
                        method: 'POST', headers: { 'Content-Type': 'application/json' },
                        body: JSON.stringify({ password })
                    });
                    const data = await res.json();
                    
                    if (data.ok) {
                        window.location.href = '/login.html';
                    } else {
                        showToast(data.error);
                        btn.textContent = 'Удалить';
                        btn.disabled = false;
                    }
                };
            });
        }
    }

    // Логика сложности пароля (глобальная функция, чтобы работал oninput)
    window.updateStrength = (val) => {
        const bar = document.getElementById('strengthBar');
        const text = document.getElementById('strengthText');
        if (!bar || !text) return;
        
        let strength = 0;
        if (val.length >= 4) strength++;
        if (val.length >= 8) strength++;
        if (/[A-Z]/.test(val)) strength++;
        if (/[0-9]/.test(val)) strength++;
        if (/[^A-Za-z0-9]/.test(val)) strength++;

        const percent = (strength / 5) * 100;
        bar.style.width = percent + '%';

        if (val.length === 0) {
            bar.style.width = '0%';
            text.textContent = '';
        } else if (strength <= 2) {
            bar.style.background = '#ff3b3b';
            text.textContent = 'Слабый пароль';
            text.style.color = '#ff3b3b';
        } else if (strength <= 4) {
            bar.style.background = '#ffb347';
            text.textContent = 'Средний пароль';
            text.style.color = '#ffb347';
        } else {
            bar.style.background = '#00ffa3';
            text.textContent = 'Надежный пароль';
            text.style.color = '#00ffa3';
        }
    };

    renderTab('profile');

    document.getElementById('logoutBtn').addEventListener('click', () => {
        fetch('/api/logout', { method: 'POST' }).then(() => window.location.href = '/login.html');
    });
}