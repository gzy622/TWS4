(function() {
    window.TWS3 = window.TWS3 || {};
    const store = window.TWS3.store;

    function escapeHtml(str) {
        return String(str === null || str === undefined ? '' : str)
            .replace(/&/g, '&amp;')
            .replace(/</g, '&lt;')
            .replace(/>/g, '&gt;')
            .replace(/"/g, '&quot;')
            .replace(/'/g, '&#39;');
    }

    function showToast(msg, duration) {
        if (window.TWS3 && window.TWS3.showToast) {
            window.TWS3.showToast(msg, duration);
        }
    }

    const DEFAULT_PERIOD_TIMES = {
        'p_morning': '07:40 - 08:00',
        'morning': '07:40 - 08:00',
        '早': '07:40 - 08:00',
        '早读': '07:40 - 08:00',
        'p_1': '08:00 - 08:45',
        '1': '08:00 - 08:45',
        'p_2': '08:55 - 09:40',
        '2': '08:55 - 09:40',
        'p_3': '10:10 - 10:55',
        '3': '10:10 - 10:55',
        'p_4': '11:05 - 11:50',
        '4': '11:05 - 11:50',
        'p_noon': '14:00 - 14:25',
        'noon': '14:00 - 14:25',
        '午': '14:00 - 14:25',
        '午测': '14:00 - 14:25',
        'p_5': '14:30 - 15:15',
        '5': '14:30 - 15:15',
        'p_6': '15:25 - 16:10',
        '6': '15:25 - 16:10',
        'p_7': '16:20 - 17:05',
        '7': '16:20 - 17:05',
        'p_afterschool': '17:20 - 18:05',
        'afterschool': '17:20 - 18:05',
        '后': '17:20 - 18:05',
        '课后': '17:20 - 18:05'
    };
    function getCurrentDayIndex() {
        const d = new Date().getDay(); // 0 is Sunday, 1 is Monday, ...
        return d === 0 ? 7 : d;
    }

    function initScheduleView({ onOpenEdit } = {}) {
        const container = document.getElementById('schedule-view');
        if (!container) return;

        let activeGradeFilter = '全部';
        let classSearchKeyword = '';

        // 确保文件输入控件存在
        let fileInput = document.getElementById('schedule-xlsx-file-input');
        if (!fileInput) {
            fileInput = document.createElement('input');
            fileInput.type = 'file';
            fileInput.id = 'schedule-xlsx-file-input';
            fileInput.accept = '.xlsx,application/vnd.openxmlformats-officedocument.spreadsheetml.sheet';
            fileInput.style.display = 'none';
            document.body.appendChild(fileInput);
        }

        // 确保班级选择弹窗存在
        let classModal = document.getElementById('schedule-class-modal');
        if (!classModal) {
            classModal = document.createElement('div');
            classModal.id = 'schedule-class-modal';
            classModal.className = 'modal-overlay';
            classModal.innerHTML = `
                <div class="schedule-modal-container">
                    <div class="schedule-modal-header">
                        <div class="schedule-modal-title-wrap">
                            <h3 id="schedule-modal-title">选择查看班级</h3>
                            <p id="schedule-modal-subtitle">从已导入的班级课表中快速切换</p>
                        </div>
                        <button type="button" class="schedule-modal-close" id="schedule-modal-close-btn" aria-label="关闭">✕</button>
                    </div>
                    <div class="schedule-modal-body">
                        <div class="schedule-search-input-wrap">
                            <svg viewBox="0 0 24 24">
                                <circle cx="11" cy="11" r="7"/>
                                <path d="M21 21l-4.35-4.35" stroke-linecap="round"/>
                            </svg>
                            <input type="text" id="schedule-modal-search-input" class="schedule-search-input" placeholder="输入班级名（如初一1）或班主任搜索..." />
                        </div>
                        <div class="schedule-grade-bar" id="schedule-modal-grade-bar"></div>
                        <div class="schedule-classes-grid" id="schedule-modal-classes-grid"></div>
                    </div>
                </div>
            `;
            document.body.appendChild(classModal);
        }

        // 确保课程详情弹窗存在
        let detailModal = document.getElementById('schedule-detail-modal');
        if (!detailModal) {
            detailModal = document.createElement('div');
            detailModal.id = 'schedule-detail-modal';
            detailModal.className = 'modal-overlay schedule-modal';
            detailModal.innerHTML = `
                <div class="schedule-detail-modal-container">
                    <div class="schedule-detail-header">
                        <div class="schedule-detail-title" id="schedule-detail-course-title">课程详情</div>
                        <button type="button" class="schedule-modal-close" id="schedule-detail-close-btn" aria-label="关闭">✕</button>
                    </div>
                    <div class="schedule-detail-list" id="schedule-detail-info-list"></div>
                    <div class="schedule-detail-actions">
                        <button type="button" class="schedule-btn schedule-btn-secondary" id="schedule-detail-edit-btn" style="flex: 1; justify-content: center; height: 34px;">
                            <svg viewBox="0 0 24 24" style="width:14px;height:14px;"><path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"/><path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"/></svg>
                            <span>编辑排课</span>
                        </button>
                        <button type="button" class="schedule-btn schedule-btn-primary" id="schedule-detail-ok-btn" style="flex: 1; justify-content: center; height: 34px;">确定</button>
                    </div>
                </div>
            `;
            document.body.appendChild(detailModal);
        }

        // 确保课程编辑弹窗存在
        let editModal = document.getElementById('schedule-edit-modal');
        if (!editModal) {
            editModal = document.createElement('div');
            editModal.id = 'schedule-edit-modal';
            editModal.className = 'modal-overlay schedule-modal';
            editModal.innerHTML = `
                <div class="schedule-edit-modal-container">
                    <div class="schedule-edit-header">
                        <div class="schedule-edit-header-text">
                            <h3 class="schedule-edit-title" id="schedule-edit-title">编辑排课</h3>
                            <span class="schedule-edit-subtitle" id="schedule-edit-subtitle">初二 (3) 班 · 周一 · 早读</span>
                        </div>
                        <button type="button" class="schedule-modal-close" id="schedule-edit-close-btn" aria-label="关闭">✕</button>
                    </div>

                    <!-- 双班/多班模式下排课的目标班级选择器 -->
                    <div id="schedule-edit-class-selector-wrap" style="display: none;">
                        <div class="schedule-edit-section-title">排课目标班级</div>
                        <div class="schedule-edit-class-selector" id="schedule-edit-class-selector"></div>
                    </div>

                    <!-- 常用科目快捷选择 -->
                    <div>
                        <div class="schedule-edit-section-title">选择科目</div>
                        <div class="schedule-subject-grid" id="schedule-edit-subject-grid"></div>
                    </div>

                    <!-- 自定义课程名称与单字 -->
                    <div>
                        <div class="schedule-edit-section-title">自定义课程 (选填)</div>
                        <div class="schedule-edit-custom-group">
                            <div class="schedule-edit-input-wrap" style="flex: 2;">
                                <input type="text" id="schedule-edit-custom-name" class="schedule-edit-input" placeholder="输入课程名 (如: 心理/社团/自习)" />
                            </div>
                            <div class="schedule-edit-input-wrap" style="flex: 1;">
                                <input type="text" id="schedule-edit-custom-char" class="schedule-edit-input" maxlength="2" placeholder="简写单字" />
                            </div>
                        </div>
                    </div>

                    <!-- 底部操作按钮 -->
                    <div class="schedule-edit-actions">
                        <button type="button" class="schedule-btn schedule-btn-danger" id="schedule-edit-clear-btn" title="清空此节课">
                            <svg viewBox="0 0 24 24"><path d="M3 6h18M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"/><line x1="10" y1="11" x2="10" y2="17" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round"/><line x1="14" y1="11" x2="14" y2="17" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round"/></svg>
                            <span>留空</span>
                        </button>
                        <div style="display: flex; gap: 8px;">
                            <button type="button" class="schedule-btn schedule-btn-secondary" id="schedule-edit-cancel-btn">取消</button>
                            <button type="button" class="schedule-btn schedule-btn-primary" id="schedule-edit-save-btn">
                                <svg viewBox="0 0 24 24"><path d="M20 6L9 17l-5-5" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"/></svg>
                                <span>保存</span>
                            </button>
                        </div>
                    </div>
                </div>
            `;
            document.body.appendChild(editModal);
        }
        // 绑定班级弹窗事件
        const modalCloseBtn = classModal.querySelector('#schedule-modal-close-btn');
        if (modalCloseBtn) {
            modalCloseBtn.addEventListener('click', () => closeClassModal());
        }
        classModal.addEventListener('click', (e) => {
            if (e.target === classModal) closeClassModal();
        });

        const modalSearchInput = classModal.querySelector('#schedule-modal-search-input');
        if (modalSearchInput) {
            modalSearchInput.addEventListener('input', (e) => {
                classSearchKeyword = e.target.value.trim().toLowerCase();
                renderClassModalList();
            });
        }

        // 详情弹窗上下文与事件
        let currentDetailContext = null;
        const detailCloseBtn = detailModal.querySelector('#schedule-detail-close-btn');
        const detailOkBtn = detailModal.querySelector('#schedule-detail-ok-btn');
        const detailEditBtn = detailModal.querySelector('#schedule-detail-edit-btn');
        if (detailCloseBtn) detailCloseBtn.addEventListener('click', () => closeDetailModal());
        if (detailOkBtn) detailOkBtn.addEventListener('click', () => closeDetailModal());
        if (detailEditBtn) {
            detailEditBtn.addEventListener('click', () => {
                if (currentDetailContext) {
                    const ctx = { ...currentDetailContext };
                    closeDetailModal();
                    openEditModal(ctx);
                }
            });
        }
        detailModal.addEventListener('click', (e) => {
            if (e.target === detailModal) closeDetailModal();
        });

        // 常用科目预设配置
        const PRESET_SUBJECTS = [
            { name: '语文', char: '语', fullName: '语文', color: 'chinese', courseId: 'c_yw' },
            { name: '数学', char: '数', fullName: '数学', color: 'math', courseId: 'c_sx' },
            { name: '英语', char: '英', fullName: '英语', color: 'english', courseId: 'c_yy' },
            { name: '物理', char: '物', fullName: '物理', color: 'physics', courseId: 'c_wl' },
            { name: '化学', char: '化', fullName: '化学', color: 'chemistry', courseId: 'c_hx' },
            { name: '生物', char: '生', fullName: '生物', color: 'biology', courseId: 'c_sw' },
            { name: '道法', char: '政', fullName: '道法/政治', color: 'politics', courseId: 'c_zz' },
            { name: '历史', char: '历', fullName: '历史', color: 'history', courseId: 'c_ls' },
            { name: '地理', char: '地', fullName: '地理', color: 'geography', courseId: 'c_dl' },
            { name: '体育', char: '体', fullName: '体育', color: 'pe', courseId: 'c_pe' },
            { name: '音乐', char: '音', fullName: '音乐', color: 'music', courseId: 'c_mu' },
            { name: '美术', char: '美', fullName: '美术/心理', color: 'art', courseId: 'c_ms' },
            { name: '信息', char: '信', fullName: '信息技术', color: 'tech', courseId: 'c_xx' },
            { name: '通用', char: '通', fullName: '通用技术', color: 'tech', courseId: 'c_ty' },
            { name: '班会', char: '班', fullName: '班会', color: 'class', courseId: 'c_bh' },
            { name: '自习', char: '习', fullName: '自习', color: 'study', courseId: 'c_zx' }
        ];

        let editingContext = {
            classId: '',
            dayId: '',
            dayName: '',
            periodId: '',
            periodName: '',
            periodLabel: '',
            timeSlot: '',
            selectedSubject: null,
            isCombined: false
        };

        function openEditModal({ classId, className, dayId, dayName, periodId, periodName, periodLabel, timeSlot, cellData, isCombined = false }) {
            editingContext.classId = classId || store.getSelectedScheduleClassId();
            editingContext.dayId = dayId;
            editingContext.dayName = dayName || '';
            editingContext.periodId = periodId;
            editingContext.periodName = periodName || '';
            editingContext.periodLabel = periodLabel || periodName || '';
            editingContext.timeSlot = timeSlot || DEFAULT_PERIOD_TIMES[periodId] || DEFAULT_PERIOD_TIMES[periodName] || '';
            editingContext.isCombined = isCombined;
            editingContext.selectedSubject = null;

            const titleEl = editModal.querySelector('#schedule-edit-title');
            const subtitleEl = editModal.querySelector('#schedule-edit-subtitle');
            const classSelectorWrap = editModal.querySelector('#schedule-edit-class-selector-wrap');
            const classSelectorEl = editModal.querySelector('#schedule-edit-class-selector');
            const subjectGridEl = editModal.querySelector('#schedule-edit-subject-grid');
            const customNameInput = editModal.querySelector('#schedule-edit-custom-name');
            const customCharInput = editModal.querySelector('#schedule-edit-custom-char');

            const activeSchedule = store.getActiveSchedule();
            const currentClassName = className || activeSchedule.name || activeSchedule.shortName || '当前班级';

            if (titleEl) {
                titleEl.textContent = '编辑排课';
            }
            if (subtitleEl) {
                const timeInfo = editingContext.timeSlot ? ` (${editingContext.timeSlot})` : '';
                subtitleEl.textContent = `${currentClassName} · ${editingContext.dayName} · ${editingContext.periodLabel}${timeInfo}`;
            }

            // 处理双班模式下的班级选择器
            if (isCombined) {
                const teacherClasses = store.getScheduleTeacherClasses ? store.getScheduleTeacherClasses() : [];
                if (teacherClasses.length > 0) {
                    classSelectorWrap.style.display = 'block';
                    classSelectorEl.innerHTML = teacherClasses.map(c => {
                        const isSelected = c.id === editingContext.classId || (!editingContext.classId && c.id === teacherClasses[0].id);
                        if (isSelected) editingContext.classId = c.id;
                        return `
                            <button type="button" class="schedule-edit-class-btn ${isSelected ? 'active' : ''}" data-class-id="${escapeHtml(c.id)}">
                                ${escapeHtml(c.shortName || c.name)}
                            </button>
                        `;
                    }).join('');

                    classSelectorEl.querySelectorAll('.schedule-edit-class-btn').forEach(btn => {
                        btn.addEventListener('click', () => {
                            classSelectorEl.querySelectorAll('.schedule-edit-class-btn').forEach(b => b.classList.remove('active'));
                            btn.classList.add('active');
                            editingContext.classId = btn.dataset.classId;
                            const targetClass = teacherClasses.find(c => c.id === editingContext.classId);
                            if (targetClass && subtitleEl) {
                                const timeInfo = editingContext.timeSlot ? ` (${editingContext.timeSlot})` : '';
                                subtitleEl.textContent = `${targetClass.shortName || targetClass.name} · ${editingContext.dayName} · ${editingContext.periodLabel}${timeInfo}`;
                            }
                        });
                    });
                } else {
                    classSelectorWrap.style.display = 'none';
                }
            } else {
                classSelectorWrap.style.display = 'none';
            }

            // 当前单元格数据匹配
            const curName = cellData?.name || cellData?.fullName || '';
            const curChar = cellData?.char || (curName ? curName.charAt(0) : '');
            let matchedSubject = PRESET_SUBJECTS.find(s => s.name === curName || s.fullName === curName || s.char === curChar || (curName && s.fullName.includes(curName)));

            if (matchedSubject) {
                editingContext.selectedSubject = matchedSubject;
                if (customNameInput) customNameInput.value = '';
                if (customCharInput) customCharInput.value = '';
            } else if (cellData && (cellData.name || cellData.customName)) {
                editingContext.selectedSubject = null;
                if (customNameInput) customNameInput.value = cellData.customName || cellData.fullName || cellData.name || '';
                if (customCharInput) customCharInput.value = cellData.char || '';
            } else {
                editingContext.selectedSubject = null;
                if (customNameInput) customNameInput.value = '';
                if (customCharInput) customCharInput.value = '';
            }

            // 渲染科目选择网格
            if (subjectGridEl) {
                subjectGridEl.innerHTML = PRESET_SUBJECTS.map(s => {
                    const isActive = editingContext.selectedSubject && editingContext.selectedSubject.name === s.name;
                    return `
                        <button type="button" class="schedule-subject-pill ${isActive ? 'active' : ''}" data-subject-name="${escapeHtml(s.name)}">
                            <span class="schedule-subject-pill-dot" style="background-color: var(--badge-sub-${s.color}, #3b82f6);"></span>
                            <span>${escapeHtml(s.name)}</span>
                        </button>
                    `;
                }).join('');

                subjectGridEl.querySelectorAll('.schedule-subject-pill').forEach(pill => {
                    pill.addEventListener('click', () => {
                        const subName = pill.dataset.subjectName;
                        const subObj = PRESET_SUBJECTS.find(s => s.name === subName);
                        if (subObj) {
                            editingContext.selectedSubject = subObj;
                            subjectGridEl.querySelectorAll('.schedule-subject-pill').forEach(p => p.classList.remove('active'));
                            pill.classList.add('active');
                            if (customNameInput) customNameInput.value = '';
                            if (customCharInput) customCharInput.value = '';
                        }
                    });
                });
            }

            if (customNameInput) {
                customNameInput.oninput = () => {
                    if (customNameInput.value.trim()) {
                        subjectGridEl.querySelectorAll('.schedule-subject-pill').forEach(p => p.classList.remove('active'));
                        editingContext.selectedSubject = null;
                        if (!customCharInput.value) {
                            customCharInput.value = customNameInput.value.trim().charAt(0);
                        }
                    }
                };
            }

            editModal.classList.add('show');
        }

        function closeEditModal() {
            editModal.classList.remove('show');
        }

        // 绑定编辑弹窗按钮事件
        const editCloseBtn = editModal.querySelector('#schedule-edit-close-btn');
        const editCancelBtn = editModal.querySelector('#schedule-edit-cancel-btn');
        const editClearBtn = editModal.querySelector('#schedule-edit-clear-btn');
        const editSaveBtn = editModal.querySelector('#schedule-edit-save-btn');

        if (editCloseBtn) editCloseBtn.addEventListener('click', closeEditModal);
        if (editCancelBtn) editCancelBtn.addEventListener('click', closeEditModal);
        editModal.addEventListener('click', (e) => {
            if (e.target === editModal) closeEditModal();
        });

        if (editClearBtn) {
            editClearBtn.addEventListener('click', () => {
                const { dayId, periodId, classId, dayName, periodLabel } = editingContext;
                store.clearScheduleCell(dayId, periodId, classId);
                closeEditModal();
                showToast(`已留空 ${dayName} ${periodLabel} 课程`, 2000);
                render();
            });
        }

        if (editSaveBtn) {
            editSaveBtn.addEventListener('click', () => {
                const { dayId, periodId, classId, dayName, periodLabel, selectedSubject } = editingContext;
                const customName = editModal.querySelector('#schedule-edit-custom-name')?.value.trim() || '';
                const customChar = editModal.querySelector('#schedule-edit-custom-char')?.value.trim() || '';

                let courseData = {};
                if (selectedSubject && !customName) {
                    courseData = {
                        courseId: selectedSubject.courseId,
                        name: selectedSubject.name,
                        fullName: selectedSubject.fullName,
                        char: selectedSubject.char,
                        color: selectedSubject.color
                    };
                } else if (customName) {
                    const norm = window.TWS3?.scheduleWorkbook?.normalizeSubject ? window.TWS3.scheduleWorkbook.normalizeSubject(customName) : null;
                    courseData = {
                        courseId: norm ? norm.courseId : 'c_custom',
                        name: customName,
                        fullName: customName,
                        char: customChar || (norm ? norm.char : customName.charAt(0)),
                        color: norm ? norm.color : 'default',
                        customName
                    };
                } else {
                    showToast('请选择科目或输入课程名称', 2000);
                    return;
                }

                store.setScheduleCell(dayId, periodId, courseData, classId);
                closeEditModal();
                showToast(`已保存：${dayName} ${periodLabel} -> ${courseData.fullName || courseData.name}`, 2000);
                render();
            });
        }

        function openClassModal() {
            classModal.classList.add('show');
            classSearchKeyword = '';
            if (modalSearchInput) modalSearchInput.value = '';
            renderClassModalList();
        }

        function closeClassModal() {
            classModal.classList.remove('show');
        }

        function openDetailModal(course, dayName, periodName, schedule, dayId, periodId, timeSlot) {
            const titleEl = detailModal.querySelector('#schedule-detail-course-title');
            const listEl = detailModal.querySelector('#schedule-detail-info-list');
            const isCombined = schedule.isCombined || course.type === 'single' || course.type === 'multi';

            currentDetailContext = {
                classId: course.classId || schedule.id,
                className: course.className || schedule.name,
                dayId: dayId || course.dayId,
                dayName,
                periodId: periodId || course.periodId,
                periodName,
                periodLabel: periodName,
                timeSlot: timeSlot || course.timeSlot || DEFAULT_PERIOD_TIMES[periodName] || '',
                cellData: course,
                isCombined
            };

            if (isCombined) {
                if (titleEl) {
                    titleEl.textContent = `${course.fullName || course.name || '任课'} 安排详情`;
                }
                if (listEl) {
                    const slot = currentDetailContext.timeSlot || `第 ${periodName} 节`;
                    let classDisplay = '';
                    let teacherDisplay = '';
                    if (course.type === 'single') {
                        classDisplay = course.className || course.classShortName || '任教班级';
                        teacherDisplay = course.teacher || '未设置';
                    } else if (course.type === 'multi') {
                        classDisplay = `${course.classNames || '多班级'} (同时安排)`;
                        teacherDisplay = course.teachers || '未设置';
                    } else {
                        classDisplay = schedule.name || schedule.shortName;
                        teacherDisplay = schedule.teacher || '未设置';
                    }

                    const statsHtml = Array.isArray(schedule.classStats) && schedule.classStats.length > 0
                        ? `
                        <div class="schedule-detail-item" style="align-items: flex-start;">
                            <span class="schedule-detail-label">周课时统计</span>
                            <div class="schedule-detail-val" style="display:flex; flex-direction:column; gap:2px;">
                                ${schedule.classStats.map(c => `<span>${escapeHtml(c.name)}: <strong>${c.count}</strong> 节</span>`).join('')}
                                <span style="margin-top:2px; color:var(--surface-dark, #1b3831); font-weight:700;">共计: ${schedule.totalCourses} 节课</span>
                            </div>
                        </div>`
                        : '';

                    listEl.innerHTML = `
                        <div class="schedule-detail-item">
                            <span class="schedule-detail-label">任教班级</span>
                            <span class="schedule-detail-val"><strong>${escapeHtml(classDisplay)}</strong></span>
                        </div>
                        <div class="schedule-detail-item">
                            <span class="schedule-detail-label">任课科目</span>
                            <span class="schedule-detail-val">${escapeHtml(course.fullName || course.name || schedule.subject || '英语')}</span>
                        </div>
                        <div class="schedule-detail-item">
                            <span class="schedule-detail-label">上课时间</span>
                            <span class="schedule-detail-val">${escapeHtml(dayName)} · ${escapeHtml(periodName)} (${escapeHtml(slot)})</span>
                        </div>
                        <div class="schedule-detail-item">
                            <span class="schedule-detail-label">班主任</span>
                            <span class="schedule-detail-val">${escapeHtml(teacherDisplay)}</span>
                        </div>
                        ${statsHtml}
                    `;
                }
                detailModal.classList.add('show');
                return;
            }

            // 单班常规弹窗
            if (titleEl) {
                titleEl.textContent = `${course.fullName || course.name} 课程详情`;
            }
            if (listEl) {
                const slot = currentDetailContext.timeSlot || `第 ${periodName} 节`;
                listEl.innerHTML = `
                    <div class="schedule-detail-item">
                        <span class="schedule-detail-label">班级</span>
                        <span class="schedule-detail-val">${escapeHtml(schedule.name || schedule.shortName)}</span>
                    </div>
                    <div class="schedule-detail-item">
                        <span class="schedule-detail-label">班主任</span>
                        <span class="schedule-detail-val">${escapeHtml(schedule.teacher || '未设置')}</span>
                    </div>
                    <div class="schedule-detail-item">
                        <span class="schedule-detail-label">时间</span>
                        <span class="schedule-detail-val">${escapeHtml(dayName)} · ${escapeHtml(periodName)} (${escapeHtml(slot)})</span>
                    </div>
                    <div class="schedule-detail-item">
                        <span class="schedule-detail-label">课程名称</span>
                        <span class="schedule-detail-val">${escapeHtml(course.fullName || course.name)}</span>
                    </div>
                    ${course.customName ? `
                    <div class="schedule-detail-item">
                        <span class="schedule-detail-label">自定义备注</span>
                        <span class="schedule-detail-val">${escapeHtml(course.customName)}</span>
                    </div>` : ''}
                `;
            }
            detailModal.classList.add('show');
        }

        function closeDetailModal() {
            detailModal.classList.remove('show');
        }
        // 处理文件上传
        fileInput.addEventListener('change', async (e) => {
            const file = e.target.files && e.target.files[0];
            try {
                showToast('正在解析课程表 Excel 文件...', 2000);
                const arrayBuffer = await file.arrayBuffer();
                if (!window.TWS3.scheduleWorkbook || !window.TWS3.scheduleWorkbook.parseScheduleWorkbook) {
                    throw new Error('未加载课程表解析模块');
                }
                const parsed = await window.TWS3.scheduleWorkbook.parseScheduleWorkbook(arrayBuffer);
                const success = store.importScheduleLibrary(parsed);
                if (success) {
                    showToast(`成功导入 ${parsed.totalClasses} 个班级课程表！`, 2500);
                    render();
                } else {
                    showToast('导入失败：数据结构不匹配', 2500);
                }
            } catch (err) {
                console.error('导入课程表失败:', err);
                showToast(`导入失败: ${err.message || '格式错误'}`, 3000);
            } finally {
                fileInput.value = '';
            }
        });

        // 一键载入内置初二课程表文件
        async function loadBuiltinSchedule() {
            try {
                showToast('正在载入 2026-2027 学年课程表...', 2000);
                const fileName = encodeURIComponent('2026-2027学年第一学期初二课程表(1) - 副本.xlsx');
                const response = await fetch(`/${fileName}`);
                if (!response.ok) {
                    throw new Error(`无法从服务器获取预设文件 (${response.status})`);
                }
                const blob = await response.blob();
                const parsed = await window.TWS3.scheduleWorkbook.parseScheduleWorkbook(blob);
                const success = store.importScheduleLibrary(parsed);
                if (success) {
                    showToast(`成功载入 ${parsed.totalClasses} 个班级课程表！`, 2500);
                    render();
                } else {
                    showToast('载入失败：数据不匹配', 2500);
                }
            } catch (err) {
                console.error('载入内置课程表失败:', err);
                showToast('请点击「导入课表」选择本地 .xlsx 文件导入', 3000);
                if (fileInput) fileInput.click();
            }
        }

        // 渲染班级选择弹窗列表
        function renderClassModalList() {
            const library = store.getScheduleLibrary();
            const currentSelectedId = store.getSelectedScheduleClassId();
            const subtitleEl = classModal.querySelector('#schedule-modal-subtitle');
            const gradeBarEl = classModal.querySelector('#schedule-modal-grade-bar');
            const gridEl = classModal.querySelector('#schedule-modal-classes-grid');

            if (subtitleEl) {
                subtitleEl.textContent = `共 ${library.length} 个班级课表，点击直接切换`;
            }

            // 提取所有年级
            const gradesSet = new Set(['全部']);
            library.forEach(c => {
                if (c.grade) gradesSet.add(c.grade);
            });
            const gradesList = Array.from(gradesSet);

            if (gradeBarEl) {
                gradeBarEl.innerHTML = gradesList.map(g => {
                    const count = g === '全部' ? library.length : library.filter(c => c.grade === g).length;
                    const isActive = g === activeGradeFilter;
                    return `
                        <button type="button" class="schedule-grade-pill ${isActive ? 'active' : ''}" data-grade="${escapeHtml(g)}">
                            ${escapeHtml(g)} (${count})
                        </button>
                    `;
                }).join('');

                gradeBarEl.querySelectorAll('.schedule-grade-pill').forEach(btn => {
                    btn.addEventListener('click', () => {
                        activeGradeFilter = btn.dataset.grade;
                        renderClassModalList();
                    });
                });
            }

            if (gridEl) {
                const isCombined = currentSelectedId === 'combined';
                const teacherSubject = store.getScheduleTeacherSubject ? store.getScheduleTeacherSubject() : '英语';
                const teacherClasses = store.getScheduleTeacherClasses ? store.getScheduleTeacherClasses() : library;
                const combinedSchedule = store.getCombinedSchedule ? store.getCombinedSchedule(teacherSubject) : null;
                const combinedCount = combinedSchedule ? (combinedSchedule.totalCourses || 0) : 0;
                const classNames = (teacherClasses.length > 0 ? teacherClasses : library).map(c => c.shortName || c.name).join(' + ');

                const combinedCardHtml = `
                    <button type="button" class="schedule-class-card-btn schedule-combined-modal-card ${isCombined ? 'active' : ''}" data-class-id="combined" style="grid-column: 1 / -1; margin-bottom: 4px;">
                        <div class="schedule-class-card-btn-head">
                            <span class="schedule-class-card-name">双班任课总览 (${escapeHtml(classNames)})</span>
                            ${isCombined ? '<span class="schedule-class-active-dot" title="当前选中"></span>' : ''}
                        </div>
                        <span class="schedule-class-card-teacher">合并显示任教班级排课（当前科目：${escapeHtml(teacherSubject)}）</span>
                        <span class="schedule-class-card-badge">${combinedCount} 节课 · 任课总课表</span>
                    </button>
                `;

                const filtered = library.filter(c => {
                    if (activeGradeFilter !== '全部' && c.grade !== activeGradeFilter) {
                        return false;
                    }
                    if (classSearchKeyword) {
                        const target = `${c.name} ${c.shortName} ${c.teacher} ${c.grade}`.toLowerCase();
                        if (!target.includes(classSearchKeyword)) return false;
                    }
                    return true;
                });

                const classCardsHtml = filtered.map(c => {
                    const isSelected = !isCombined && (c.id === currentSelectedId);
                    return `
                        <button type="button" class="schedule-class-card-btn ${isSelected ? 'active' : ''}" data-class-id="${escapeHtml(c.id)}">
                            <div class="schedule-class-card-btn-head">
                                <span class="schedule-class-card-name">${escapeHtml(c.name || c.shortName)}</span>
                                ${isSelected ? '<span class="schedule-class-active-dot" title="当前选中"></span>' : ''}
                            </div>
                            <span class="schedule-class-card-teacher">班主任：${escapeHtml(c.teacher || '未设置')}</span>
                            <span class="schedule-class-card-badge">${c.totalCourses || Object.keys(c.grid || {}).length} 节课 · ${escapeHtml(c.sheet || c.grade)}</span>
                        </button>
                    `;
                }).join('');

                gridEl.innerHTML = (activeGradeFilter === '全部' && !classSearchKeyword ? combinedCardHtml : '') + (filtered.length === 0 ? `<div style="grid-column: 1/-1; text-align:center; padding: 24px; color: var(--text-muted); font-size:12.5px;">无匹配班级</div>` : classCardsHtml);

                gridEl.querySelectorAll('.schedule-class-card-btn').forEach(btn => {
                    btn.addEventListener('click', () => {
                        const classId = btn.dataset.classId;
                        store.setSelectedScheduleClassId(classId);
                        closeClassModal();
                        render();
                    });
                });
            }
        }

        // 渲染空状态
        function renderEmptyState() {
            container.innerHTML = `
                <div class="schedule-empty-state">
                    <div class="schedule-empty-icon">
                        <svg viewBox="0 0 24 24">
                            <rect x="3" y="4" width="18" height="18" rx="2" ry="2"/>
                            <line x1="16" y1="2" x2="16" y2="6"/>
                            <line x1="8" y1="2" x2="8" y2="6"/>
                            <line x1="3" y1="10" x2="21" y2="10"/>
                        </svg>
                    </div>
                    <h3 class="schedule-empty-title">尚未导入课程表</h3>
                    <div class="schedule-empty-btn-group">
                        <button type="button" class="schedule-btn schedule-btn-primary" id="schedule-empty-import-btn">
                            <svg viewBox="0 0 24 24"><path d="M14 2H6a2 2 0 00-2 2v16a2 2 0 002 2h12a2 2 0 002-2V8z"/><path d="M14 2v6h6"/><path d="M12 18v-6m0 0l-3 3m3-3l3 3"/></svg>
                            <span>导入 .xlsx 课程表</span>
                        </button>
                        <button type="button" class="schedule-btn schedule-btn-secondary" id="schedule-empty-load-builtin-btn">
                            <svg viewBox="0 0 24 24"><path d="M12 5v14M5 12h14"/></svg>
                            <span>载入内置初二课程表</span>
                        </button>
                        <button type="button" class="schedule-empty-help-link" id="schedule-empty-format-help-btn">格式说明</button>
                    </div>
                </div>
            `;

            const importBtn = container.querySelector('#schedule-empty-import-btn');
            if (importBtn) importBtn.addEventListener('click', () => fileInput && fileInput.click());

            const loadBtn = container.querySelector('#schedule-empty-load-builtin-btn');
            if (loadBtn) loadBtn.addEventListener('click', () => loadBuiltinSchedule());

            const helpBtn = container.querySelector('#schedule-empty-format-help-btn');
            if (helpBtn) {
                helpBtn.addEventListener('click', () => {
                    const modal = window.TWS3.modal;
                    if (modal) {
                        modal.alert({
                            title: '课程表格式说明',
                            message: '支持多工作表全校排课表格（.xlsx）。每个工作表名称即班级名称，表内包含星期排期与节次课程信息。'
                        });
                    }
                });
            }
        }

        // 主渲染函数
        function render() {
            const library = store.getScheduleLibrary();
            const activeSchedule = store.getActiveSchedule();
            const highlightedSubject = store.getScheduleHighlightedSubject() || '';
            // 若没有任何课表数据且无内置课表格子
            if ((!library || library.length === 0) && (!activeSchedule || !activeSchedule.grid || Object.keys(activeSchedule.grid).length === 0)) {
                renderEmptyState();
                return;
            }

            const currentDayIdx = getCurrentDayIndex();
            const days = (activeSchedule.days && activeSchedule.days.length > 0)
                ? activeSchedule.days
                : [
                    { id: 'day_1', name: '周一', order: 1 },
                    { id: 'day_2', name: '周二', order: 2 },
                    { id: 'day_3', name: '周三', order: 3 },
                    { id: 'day_4', name: '周四', order: 4 },
                    { id: 'day_5', name: '周五', order: 5 }
                ];

            let periods = (activeSchedule.periods && activeSchedule.periods.length > 0)
                ? activeSchedule.periods
                : [
                    { id: 'p_morning', name: '早', label: '早读', shortLabel: '早', type: 'morning', order: 0 },
                    { id: 'p_1', name: '1', label: '1', shortLabel: '1', type: 'regular', order: 1 },
                    { id: 'p_2', name: '2', label: '2', shortLabel: '2', type: 'regular', order: 2 },
                    { id: 'p_3', name: '3', label: '3', shortLabel: '3', type: 'regular', order: 3 },
                    { id: 'p_4', name: '4', label: '4', shortLabel: '4', type: 'regular', order: 4 },
                    { id: 'p_noon', name: '午', label: '午测', shortLabel: '午', type: 'noon', order: 4.5 },
                    { id: 'p_5', name: '5', label: '5', shortLabel: '5', type: 'regular', order: 5 },
                    { id: 'p_6', name: '6', label: '6', shortLabel: '6', type: 'regular', order: 6 },
                    { id: 'p_7', name: '7', label: '7', shortLabel: '7', type: 'regular', order: 7 },
                    { id: 'p_afterschool', name: '后', label: '课后', shortLabel: '后', type: 'afterschool', order: 8 }
                ];

            // 确保节次按权重正确排序
            const getSortWeight = window.TWS3.scheduleWorkbook?.getPeriodSortWeight || function(pName) {
                const key = String(pName || '').trim();
                if (['早', '早读', '晨', '晨读'].includes(key)) return 0;
                if (['午', '午测', '午读', '午考'].includes(key)) return 4.5;
                if (['晚', '后', '课后', '课后服务', '延时'].includes(key)) return 90;
                const n = parseFloat(key);
                return isNaN(n) ? 99 : n;
            };

            periods = [...periods].sort((a, b) => getSortWeight(a.name || a.id) - getSortWeight(b.name || b.id));

            const grid = activeSchedule.grid || {};
            let lunchInserted = false;

            container.innerHTML = `
                <!-- 课程表主体表格全视口无滚动容器 -->
                <div class="schedule-grid-container" id="schedule-table-wrap">
                    <table class="schedule-table">
                        <thead>
                            <tr>
                                <th class="schedule-th schedule-period-th">节次</th>
                                ${days.map((d, idx) => {
                                    const isToday = (idx + 1) === currentDayIdx;
                                    return `
                                        <th class="schedule-th ${isToday ? 'today-col' : ''}" data-day-idx="${idx + 1}">
                                            <span>${escapeHtml(d.name)}</span>
                                            ${isToday ? '<span class="schedule-th-today-badge">今日</span>' : ''}
                                        </th>
                                    `;
                                }).join('')}
                            </tr>
                        </thead>
                        <tbody>
                            ${periods.map((p, pIdx) => {
                                const pName = String(p.name || p.id || (pIdx + 1)).replace(/^p_/, '');
                                const pType = p.type || (window.TWS3.scheduleWorkbook?.getPeriodType ? window.TWS3.scheduleWorkbook.getPeriodType(pName) : (
                                    ['早', '早读', '晨', '晨读', 'morning'].includes(pName) ? 'morning' :
                                    ['午', '午测', '午读', '午考', 'noon'].includes(pName) ? 'noon' :
                                    ['晚', '后', '课后', '课后服务', '延时', 'afterschool'].includes(pName) ? 'afterschool' : 'regular'
                                ));

                                const periodLabel = p.label || (window.TWS3.scheduleWorkbook?.getPeriodLabel ? window.TWS3.scheduleWorkbook.getPeriodLabel(pName) : pName);
                                const periodChar = p.shortLabel || (window.TWS3.scheduleWorkbook?.getPeriodShortChar ? window.TWS3.scheduleWorkbook.getPeriodShortChar(pName) : (
                                    pType === 'morning' ? '早' : (pType === 'noon' ? '午' : (pType === 'afterschool' ? '后' : pName))
                                ));

                                // 判断午休静默分隔线插入时机（在午测前，或上午正课 4 节后插入一次）
                                let lunchDividerHtml = '';
                                const weight = getSortWeight(pName);
                                if (!lunchInserted && weight >= 4.5) {
                                    lunchDividerHtml = `
                                        <tr class="schedule-lunch-row" aria-hidden="true">
                                            <td colspan="${days.length + 1}" class="schedule-lunch-td">
                                                <div class="schedule-lunch-divider"></div>
                                            </td>
                                        </tr>
                                    `;
                                    lunchInserted = true;
                                }

                                const rowClass = `schedule-row period-row--${pType}`;

                                const rawTime = p.time || DEFAULT_PERIOD_TIMES[p.id] || DEFAULT_PERIOD_TIMES[pName] || DEFAULT_PERIOD_TIMES[pType] || '';
                                let timeHtml = '';
                                if (rawTime && rawTime.includes('-')) {
                                    const parts = rawTime.split('-').map(s => s.trim());
                                    timeHtml = `<div class="schedule-period-time"><span class="time-start">${escapeHtml(parts[0])}</span><span class="time-end">${escapeHtml(parts[1])}</span></div>`;
                                } else if (rawTime) {
                                    timeHtml = `<div class="schedule-period-time">${escapeHtml(rawTime)}</div>`;
                                }

                                const rowHtml = `
                                    <tr class="${rowClass}">
                                        <td class="schedule-period-cell type-${pType}" title="${escapeHtml(periodLabel)} ${escapeHtml(rawTime)}">
                                            <div class="schedule-period-inner">
                                                <span class="schedule-period-num">${escapeHtml(periodChar)}</span>
                                                ${timeHtml}
                                            </div>
                                        </td>
                                        ${days.map(d => {
                                            const cellKey = `${d.id}_${p.id}`;
                                            let cellData = grid[cellKey];
                                            if (!cellData) {
                                                // 容错匹配 p.name
                                                cellData = grid[`${d.id}_p_${pName}`] || grid[`${d.id}_${pName}`];
                                            }

                                            const isEmpty = !cellData || (!cellData.name && !cellData.courseId && !cellData.customName && !cellData.type);
                                            const tdDataAttrs = `data-cell-key="${escapeHtml(cellKey)}" data-day-id="${escapeHtml(d.id)}" data-day-name="${escapeHtml(d.name)}" data-period-id="${escapeHtml(p.id)}" data-period-name="${escapeHtml(pName)}" data-period-label="${escapeHtml(periodLabel)}" data-time="${escapeHtml(rawTime)}"`;

                                            if (isEmpty) {
                                                return `
                                                    <td class="schedule-td is-empty" ${tdDataAttrs}>
                                                        <div class="course-empty" title="点击为此节排课">—</div>
                                                    </td>
                                                `;
                                            }

                                            if (activeSchedule.isCombined) {
                                                if (cellData.type === 'single') {
                                                    const themeIdx = ((cellData.classIndex || 0) % 4) + 1;
                                                    return `
                                                        <td class="schedule-td" ${tdDataAttrs}>
                                                            <div class="schedule-course-card schedule-combined-card class-theme-${themeIdx}" ${tdDataAttrs}>
                                                                <div class="schedule-combined-card-inner">
                                                                    <span class="schedule-combined-class-badge">${escapeHtml(cellData.classShortName || cellData.className)}</span>
                                                                    <span class="schedule-combined-sub-badge">${escapeHtml(cellData.fullName || cellData.name || '英语')}</span>
                                                                </div>
                                                            </div>
                                                        </td>
                                                    `;
                                                }
                                                if (cellData.type === 'multi') {
                                                    return `
                                                        <td class="schedule-td" ${tdDataAttrs}>
                                                            <div class="schedule-course-card schedule-combined-card is-multi" ${tdDataAttrs}>
                                                                <div class="schedule-combined-card-inner">
                                                                    <div class="schedule-combined-multi-row">
                                                                        ${(cellData.classes || []).map(c => `<span class="schedule-combined-class-badge class-theme-${((c.classIndex || 0) % 4) + 1}">${escapeHtml(c.classShortName)}</span>`).join('')}
                                                                    </div>
                                                                    <span class="schedule-combined-sub-badge">${escapeHtml(periodChar === '早' ? '早读' : (cellData.fullName || '同时'))}</span>
                                                                </div>
                                                            </div>
                                                        </td>
                                                    `;
                                                }
                                            }

                                            const rawCourseName = cellData.name || cellData.customName || '课';
                                            const singleChar = (cellData.char || rawCourseName.charAt(0) || '—').trim();
                                            const isHighlighted = !!highlightedSubject && (singleChar === highlightedSubject || rawCourseName === highlightedSubject || (cellData.fullName && cellData.fullName.includes(highlightedSubject)));
                                            const isDimmed = !!highlightedSubject && !isHighlighted;
                                            const highlightClass = isHighlighted ? 'is-highlighted' : (isDimmed ? 'is-dimmed' : '');

                                            return `
                                                <td class="schedule-td" ${tdDataAttrs}>
                                                    <div class="schedule-course-card ${highlightClass}" ${tdDataAttrs} data-char="${escapeHtml(singleChar)}">
                                                        <span class="schedule-course-char">${escapeHtml(singleChar)}</span>
                                                    </div>
                                                </td>
                                            `;
                                        }).join('')}
                                    </tr>
                                `;

                                return lunchDividerHtml + rowHtml;
                            }).join('')}
                        </tbody>
                    </table>
                </div>
            `;

            // 绑定单元格点击事件（支持点击已有课程编辑/查看，或点击空白处排课）
            container.querySelectorAll('.schedule-td').forEach(td => {
                td.addEventListener('click', () => {
                    const cellKey = td.dataset.cellKey;
                    const dayId = td.dataset.dayId;
                    const dayName = td.dataset.dayName;
                    const periodId = td.dataset.periodId;
                    const periodName = td.dataset.periodName;
                    const periodLabel = td.dataset.periodLabel;
                    const timeSlot = td.dataset.time;

                    let cellData = grid[cellKey];
                    if (!cellData) {
                        const parts = cellKey.split('_');
                        cellData = grid[`${parts[0]}_${parts[1]}_${parts[2]}`] || grid[`${parts[0]}_${parts[1]}`];
                    }

                    if (activeSchedule.isCombined) {
                        if (cellData && (cellData.type || cellData.name)) {
                            // 在双班课表下，点击有课的卡片先打开详情（详情内提供“编辑排课”入口）
                            openDetailModal(cellData, dayName, periodLabel, activeSchedule, dayId, periodId, timeSlot);
                        } else {
                            // 在双班课表下，点击空白格子直接打开排课弹窗，供选择任教班级
                            openEditModal({
                                isCombined: true,
                                dayId,
                                dayName,
                                periodId,
                                periodName,
                                periodLabel,
                                timeSlot,
                                cellData: null
                            });
                        }
                    } else {
                        // 在单班课表下，点击直接弹出该班排课编辑弹窗
                        openEditModal({
                            classId: activeSchedule.id,
                            className: activeSchedule.name || activeSchedule.shortName,
                            dayId,
                            dayName,
                            periodId,
                            periodName,
                            periodLabel,
                            timeSlot,
                            cellData,
                            isCombined: false
                        });
                    }
                });
            });
        }

        // 注册全局状态监听
        store.subscribe((state, eventType) => {
            if (eventType === 'VIEW_MODE_CHANGED' && state.viewMode === 'schedule') {
                render();
            } else if (
                eventType === 'SCHEDULE_CLASS_CHANGED' ||
                eventType === 'SCHEDULE_LIBRARY_UPDATED' ||
                eventType === 'SCHEDULE_CHANGED' ||
                eventType === 'SCHEDULE_GRID_CHANGED' ||
                eventType === 'SCHEDULE_CLASS_UPDATED' ||
                eventType === 'SCHEDULE_HIGHLIGHT_CHANGED' ||
                eventType === 'SCHEDULE_TEACHER_SUBJECT_CHANGED' ||
                eventType === 'SCHEDULE_TEACHER_CLASSES_CHANGED'
            ) {
                if (store.getViewMode() === 'schedule') {
                    render();
                }
            }
        });

        // 首次初始化
        render();

        return {
            render,
            openClassModal,
            openEditModal,
            loadBuiltinSchedule
        };
    }
    window.TWS3.initScheduleView = initScheduleView;
    window.TWS3.schedule = {
        initScheduleView
    };
})();
