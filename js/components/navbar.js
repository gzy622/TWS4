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

    function initNavbar({ onEditTaskClick }) {
        const navTitleTrigger = document.getElementById('nav-title-trigger');
        const currentTaskNameEl = document.getElementById('current-task-name');
        const taskDropdown = document.getElementById('task-dropdown');
        const taskDropdownOverlay = document.getElementById('task-dropdown-overlay');
        const progressBar = document.getElementById('progress-bar');

        // 新建作业二级弹窗节点
        const newTaskModal = document.getElementById('new-task-modal');
        const newTaskCloseBtn = document.getElementById('new-task-modal-close-btn');
        const newTaskCancelBtn = document.getElementById('new-task-cancel-btn');
        const newTaskConfirmBtn = document.getElementById('new-task-confirm-btn');
        const newTaskNameInput = document.getElementById('new-task-name-input');
        const newTaskSubjectChips = document.getElementById('new-task-subject-chips');
        const newTaskTargetClasses = document.getElementById('new-task-target-classes');


        let selectedSubject = '未设置';

        // 构建精简快捷面板 DOM
        taskDropdown.innerHTML = `
            <div class="quick-panel-body">
                <!-- 1. 授课班级卡片网格 -->
                <div class="quick-classes" id="quick-class-comparison" role="group" aria-label="授课班级切换"></div>

                <!-- 2. 视图与模式控制行 -->
                <div class="quick-controls-row">
                    <div class="quick-views-segmented" role="group" aria-label="视图切换">
                        <button type="button" class="quick-view-btn" data-view="grid" title="网格视图" aria-pressed="false">
                            <svg viewBox="0 0 24 24"><path d="M4 5h7v6H4zM13 5h7v6h-7zM4 13h7v6H4zM13 13h7v6h-7z"/></svg><span>网格</span>
                        </button>
                        <button type="button" class="quick-view-btn" data-view="wide" title="宽栏视图" aria-pressed="false">
                            <svg viewBox="0 0 24 24"><path d="M4 5h7v14H4zM13 5h7v14h-7z"/></svg><span>宽栏</span>
                        </button>
                        <button type="button" class="quick-view-btn" data-view="seat" title="座位视图" aria-pressed="false">
                            <svg viewBox="0 0 24 24"><path d="M4 5h16v14H4zM8 5v14m8-14v14M4 12h16"/></svg><span>座位</span>
                        </button>
                        <button type="button" class="quick-view-btn" data-view="table" title="表格视图" aria-pressed="false">
                            <svg viewBox="0 0 24 24"><path d="M3 5h18v14H3zM3 10h18M9 5v14M15 5v14"/></svg><span>表格</span>
                        </button>
                    </div>

                    <div class="quick-mode-segmented" role="group" aria-label="操作模式切换">
                        <button type="button" class="quick-mode-segment-btn" data-mode="check" title="切换至登记模式" aria-pressed="false">
                            <svg viewBox="0 0 24 24">
                                <polyline points="9 11 12 14 22 4" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round"/>
                                <path d="M21 12v7a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h11" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round"/>
                            </svg>
                            <span>登记</span>
                        </button>
                        <button type="button" class="quick-mode-segment-btn" data-mode="grade" title="切换至打分模式" aria-pressed="false">
                            <svg viewBox="0 0 24 24">
                                <path d="M12 20h9" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round"/>
                                <path d="M16.5 3.5a2.121 2.121 0 0 1 3 3L7 19l-4 1 1-4L16.5 3.5z" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round"/>
                            </svg>
                            <span>打分</span>
                        </button>
                    </div>
                </div>
            </div>

            <div class="task-drag-handle" aria-hidden="true"></div>
        `;

        const viewButtons = taskDropdown.querySelectorAll('.quick-view-btn');
        const classComparisonContainer = taskDropdown.querySelector('#quick-class-comparison');
        const modeSegmentButtons = taskDropdown.querySelectorAll('.quick-mode-segment-btn');
        const navNewTaskBtn = document.getElementById('nav-new-task-btn');
        const navDrawerBtn = document.getElementById('nav-drawer-btn');

        // 渲染班级卡片（在课程表视图下渲染已导入的班级列表与课表快捷操作）
        function renderClassCards() {
            if (!classComparisonContainer) return;
            const currentView = store.getViewMode();

            if (currentView === 'schedule') {
                const library = store.getScheduleLibrary();
                const selectedId = store.getSelectedScheduleClassId();
                const activeSchedule = store.getActiveSchedule();
                const highlighted = store.getScheduleHighlightedSubject() || '';
                const teacherSubject = store.getScheduleTeacherSubject ? store.getScheduleTeacherSubject() : '英语';
                const isCombined = store.isCombinedScheduleMode ? store.isCombinedScheduleMode() : (selectedId === 'combined');

                // 提取课表中出现的所有科目
                const subjectSet = new Set(['英语', '语文', '数学', '物理', '生物', '政治', '历史', '地理', '体育', '音乐', '美术', '信息', '通用', '班会']);
                if (library && library.length > 0) {
                    library.forEach(cls => {
                        Object.values(cls.grid || {}).forEach(cell => {
                            const name = cell.fullName || cell.name;
                            if (name && name !== '—') subjectSet.add(name);
                        });
                    });
                }
                const subjectsList = Array.from(subjectSet);

                let classCardsHtml = '';
                if (library && library.length > 0) {
                    const teacherClasses = store.getScheduleTeacherClasses ? store.getScheduleTeacherClasses() : library;
                    const combinedSchedule = store.getCombinedSchedule ? store.getCombinedSchedule(teacherSubject) : null;
                    const totalCombinedCount = combinedSchedule ? (combinedSchedule.totalCourses || 0) : 0;
                    const classNamesStr = (teacherClasses.length > 0 ? teacherClasses : library).map(c => c.shortName || c.name).join(' · ');
                    const combinedCardHtml = `
                        <button type="button" class="quick-class-card quick-combined-card ${isCombined ? 'active' : ''}" data-schedule-class-id="combined" aria-pressed="${isCombined ? 'true' : 'false'}" title="双班任课总览">
                            <div class="quick-class-card-head">
                                <strong class="quick-class-name">双班任课总览</strong>
                                <span class="quick-class-badge">${totalCombinedCount} 节 · ${escapeHtml(teacherSubject)}</span>
                            </div>
                            <div class="quick-class-card-metrics">
                                <span class="quick-class-label">合并 ${escapeHtml(classNamesStr)} (${escapeHtml(teacherSubject)}周课表)</span>
                            </div>
                            <span class="quick-class-progress"><i style="width:${isCombined ? 100 : 0}%"></i></span>
                        </button>
                    `;

                    const singleClassCardsHtml = library.map(cls => {
                        const isSelected = !isCombined && (cls.id === selectedId || cls.shortName === selectedId || cls.name === selectedId);
                        const courseCount = cls.totalCourses || Object.keys(cls.grid || {}).length;
                        const teacherText = cls.teacher ? `班主任: ${escapeHtml(cls.teacher)}` : (cls.grade || '班级课表');
                        return `
                            <button type="button" class="quick-class-card ${isSelected ? 'active' : ''}" data-schedule-class-id="${escapeHtml(cls.id)}" aria-pressed="${isSelected ? 'true' : 'false'}" title="${escapeHtml(cls.name || cls.shortName)} (${courseCount} 节)">
                                <div class="quick-class-card-head">
                                    <strong class="quick-class-name">${escapeHtml(cls.name || cls.shortName)}</strong>
                                    <span class="quick-class-badge">${courseCount} 节</span>
                                </div>
                                <div class="quick-class-card-metrics">
                                    <span class="quick-class-label">${teacherText}</span>
                                </div>
                                <span class="quick-class-progress"><i style="width:${isSelected ? 100 : 0}%"></i></span>
                            </button>
                        `;
                    }).join('');

                    classCardsHtml = combinedCardHtml + singleClassCardsHtml;
                } else {
                    const name = activeSchedule.name || activeSchedule.shortName || store.getState().currentClass || '默认课表';
                    const courseCount = Object.keys(activeSchedule.grid || {}).length;
                    classCardsHtml = `
                        <button type="button" class="quick-class-card active" data-schedule-class-id="${escapeHtml(activeSchedule.id || 'default')}" aria-pressed="true" title="${escapeHtml(name)} (${courseCount} 节)">
                            <div class="quick-class-card-head">
                                <strong class="quick-class-name">${escapeHtml(name)}</strong>
                                <span class="quick-class-badge">${courseCount} 节</span>
                            </div>
                            <div class="quick-class-card-metrics">
                                <span class="quick-class-label">当前活跃课表</span>
                            </div>
                            <span class="quick-class-progress"><i style="width:100%"></i></span>
                        </button>
                    `;
                }

                let chipsHtml = '';
                let sectionTitle = '';
                if (isCombined) {
                    sectionTitle = '任课科目';
                    chipsHtml = subjectsList.map(sub => {
                        const normSub = sub.replace(/（.*）|\(.*\)/g, '');
                        const isActive = teacherSubject === sub || teacherSubject === normSub || sub.startsWith(teacherSubject) || teacherSubject.startsWith(sub);
                        return `
                            <button type="button" class="quick-highlight-chip ${isActive ? 'active' : ''}" data-teacher-subject="${escapeHtml(sub)}" aria-pressed="${isActive ? 'true' : 'false'}" title="${escapeHtml(sub)}">
                                ${escapeHtml(sub)}
                            </button>
                        `;
                    }).join('');
                } else {
                    sectionTitle = '突出显示科目';
                    const isAllActive = !highlighted;
                    chipsHtml = `
                        <button type="button" class="quick-highlight-chip ${isAllActive ? 'active' : ''}" data-highlight-subject="" aria-pressed="${isAllActive ? 'true' : 'false'}" title="全部科目">
                            全部
                        </button>
                        ${subjectsList.map(sub => {
                            const isActive = highlighted === sub || (sub.length > 1 && highlighted === sub.charAt(0));
                            return `
                                <button type="button" class="quick-highlight-chip ${isActive ? 'active' : ''}" data-highlight-subject="${escapeHtml(sub)}" aria-pressed="${isActive ? 'true' : 'false'}" title="${escapeHtml(sub)}">
                                    ${escapeHtml(sub)}
                                </button>
                            `;
                        }).join('')}
                    `;
                }
                let classTogglesSection = '';
                if (isCombined && library.length > 2) {
                    const teacherClasses = store.getScheduleTeacherClasses ? store.getScheduleTeacherClasses() : library;
                    const teacherClassIds = new Set(teacherClasses.map(c => c.id));
                    classTogglesSection = `
                        <div class="quick-highlight-section quick-teacher-classes-section" role="group" aria-label="任教班级选择">
                            <div class="quick-highlight-header">
                                <span class="quick-highlight-title">任教班级选择 (${teacherClasses.length}/${library.length})</span>
                            </div>
                            <div class="quick-highlight-chips">
                                ${library.map(cls => {
                                    const isChecked = teacherClassIds.has(cls.id);
                                    return `
                                        <button type="button" class="quick-highlight-chip ${isChecked ? 'active' : ''}" data-toggle-teacher-class="${escapeHtml(cls.id)}" aria-pressed="${isChecked ? 'true' : 'false'}" title="${escapeHtml(cls.shortName || cls.name)}">
                                            ${isChecked ? '✓ ' : ''}${escapeHtml(cls.shortName || cls.name)}
                                        </button>
                                    `;
                                }).join('')}
                            </div>
                        </div>
                    `;
                }

                classComparisonContainer.innerHTML = `
                    <div class="quick-schedule-cards-grid" role="group" aria-label="课程表班级选择">
                        ${classCardsHtml}
                    </div>
                    ${classTogglesSection}
                    <div class="quick-highlight-section ${isCombined ? 'quick-teacher-subject-section' : ''}" role="group" aria-label="${escapeHtml(sectionTitle)}">
                        <div class="quick-highlight-header">
                            <span class="quick-highlight-title">${escapeHtml(sectionTitle)}</span>
                            ${isCombined ? `<span class="quick-highlight-current">当前：${escapeHtml(teacherSubject)}</span>` : ''}
                            ${!isCombined && highlighted ? `<span class="quick-highlight-hint">当前高亮: ${escapeHtml(highlighted)}</span>` : ''}
                        </div>
                        <div class="quick-highlight-chips">
                            ${chipsHtml}
                        </div>
                    </div>
                `;
                return;
            }

            const mode = store.getOperationMode();
            const comparison = store.getTaskComparison(undefined, mode);
            classComparisonContainer.innerHTML = comparison.classes.map(cls => {
                const hasTask = !!cls.taskId;
                const count = mode === 'grade' ? (cls.graded || 0) : (cls.submitted || 0);
                const actionLabel = mode === 'grade' ? '已评' : '已交';
                const badgeText = hasTask ? `${count}/${cls.required}` : '未分配';
                const percentageText = hasTask ? `${Math.round(cls.percentage || 0)}%` : '—';
                const isCurrent = !!cls.isCurrent;
                return `
                    <button type="button" class="quick-class-card ${isCurrent ? 'active' : ''}" data-class-id="${escapeHtml(cls.id)}" aria-pressed="${isCurrent ? 'true' : 'false'}" title="${escapeHtml(cls.name)} (${badgeText})">
                        <div class="quick-class-card-head">
                            <strong class="quick-class-name">${escapeHtml(cls.name)}</strong>
                            <span class="quick-class-badge">${badgeText}</span>
                        </div>
                        <div class="quick-class-card-metrics">
                            <span class="quick-class-ratio">${percentageText}</span>
                            <span class="quick-class-label">${hasTask ? actionLabel : '无作业'}</span>
                        </div>
                        <span class="quick-class-progress"><i style="width:${hasTask ? cls.percentage : 0}%"></i></span>
                    </button>
                `;
            }).join('');
        }

        // 渲染视图切换高亮与控制行可见性
        function renderViewSwitcher() {
            const currentView = store.getViewMode();
            const controlsRow = taskDropdown.querySelector('.quick-controls-row');
            if (controlsRow) {
                controlsRow.style.display = currentView === 'schedule' ? 'none' : '';
            }
            viewButtons.forEach(btn => {
                const isActive = btn.dataset.view === currentView;
                btn.classList.toggle('active', isActive);
                btn.setAttribute('aria-pressed', isActive ? 'true' : 'false');
            });
        }

        // 渲染模式切换按钮状态与可见性
        function updateModeButton(mode = store.getOperationMode()) {
            const currentView = store.getViewMode();
            const controlsRow = taskDropdown.querySelector('.quick-controls-row');
            if (controlsRow) {
                controlsRow.style.display = currentView === 'schedule' ? 'none' : '';
            }
            const modeSegmentWrap = taskDropdown.querySelector('.quick-mode-segmented');
            if (modeSegmentWrap) {
                modeSegmentWrap.style.display = currentView === 'schedule' ? 'none' : '';
            }
            modeSegmentButtons.forEach(btn => {
                const isActive = btn.dataset.mode === mode;
                btn.classList.toggle('active', isActive);
                btn.setAttribute('aria-pressed', isActive ? 'true' : 'false');
            });
            taskDropdown.dataset.mode = mode;
            const progressWrapper = document.querySelector('.tab-indicator-wrapper');
            if (progressWrapper) progressWrapper.dataset.mode = mode;
            const navbarEl = document.querySelector('.navbar');
            if (navbarEl) navbarEl.dataset.mode = mode;
        }

        // 更新左侧操作按钮图标与功能提示
        function updateLeftNavButton() {
            if (!navDrawerBtn) return;
            navDrawerBtn.setAttribute('title', '打开菜单');
            navDrawerBtn.setAttribute('aria-label', '打开菜单');
            navDrawerBtn.innerHTML = `
                <div class="nav-menu-icon">
                    <span></span>
                    <span></span>
                    <span></span>
                </div>
            `;
        }

        // 更新右侧操作按钮图标与功能提示（新建 vs 导入）
        function updateRightNavButton() {
            if (!navNewTaskBtn) return;
            const isSchedule = store.getViewMode() === 'schedule';
            if (isSchedule) {
                navNewTaskBtn.setAttribute('title', '导入课表 (.xlsx)');
                navNewTaskBtn.setAttribute('aria-label', '导入课表');
                navNewTaskBtn.innerHTML = `
                    <svg viewBox="0 0 24 24" style="width:19px;height:19px;" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round">
                        <path d="M14 2H6a2 2 0 00-2 2v16a2 2 0 002 2h12a2 2 0 002-2V8z"/>
                        <path d="M14 2v6h6"/>
                        <path d="M12 18v-6m0 0l-3 3m3-3l3 3"/>
                    </svg>
                `;
            } else {
                navNewTaskBtn.setAttribute('title', '新建作业');
                navNewTaskBtn.setAttribute('aria-label', '新建作业');
                navNewTaskBtn.innerHTML = `
                    <svg class="nav-add-svg" viewBox="0 0 24 24">
                        <path d="M12 4v16m-8-8h16" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round"/>
                    </svg>
                `;
            }
        }
        // 1. 视图切换点击
        viewButtons.forEach(btn => {
            btn.addEventListener('click', (e) => {
                e.stopPropagation();
                const view = btn.dataset.view;
                if (!view) return;
                store.setViewMode(view);
                renderViewSwitcher();
                closeDropdown();
            });
        });
        // 2. 班级切换与科目高亮点击（支持作业班级、课表班级与科目突出显示）
        if (classComparisonContainer) {
            classComparisonContainer.addEventListener('click', (e) => {
                const toggleClassBtn = e.target.closest('[data-toggle-teacher-class]');
                if (toggleClassBtn) {
                    const classId = toggleClassBtn.dataset.toggleTeacherClass;
                    if (classId) {
                        store.toggleScheduleTeacherClass(classId);
                        renderClassCards();
                        updateHeaderTitle();
                    }
                    return;
                }

                const teacherChip = e.target.closest('[data-teacher-subject]');
                if (teacherChip) {
                    const targetSubject = teacherChip.dataset.teacherSubject || '英语';
                    store.setScheduleTeacherSubject(targetSubject);
                    renderClassCards();
                    updateHeaderTitle();
                    return;
                }
                const chip = e.target.closest('[data-highlight-subject]');
                if (chip) {
                    const targetSubject = chip.dataset.highlightSubject || '';
                    store.setScheduleHighlightedSubject(targetSubject);
                    renderClassCards();
                    return;
                }

                const schedImportBtn = e.target.closest('#quick-schedule-import-trigger');
                if (schedImportBtn) {
                    closeDropdown();
                    const schedInput = document.getElementById('schedule-xlsx-file-input');
                    if (schedInput) schedInput.click();
                    return;
                }

                const schedCard = e.target.closest('[data-schedule-class-id]');
                if (schedCard) {
                    const schedClassId = schedCard.dataset.scheduleClassId;
                    if (schedClassId) {
                        store.setSelectedScheduleClassId(schedClassId);
                        closeDropdown();
                        updateHeaderTitle();
                    }
                    return;
                }

                const card = e.target.closest('.quick-class-card[data-class-id]');
                if (!card || card.classList.contains('active')) return;
                const classId = card.dataset.classId;
                if (classId) {
                    store.switchClassForTask(classId);
                }
            });
        }

        // 3. 操作模式分段切换点击
        modeSegmentButtons.forEach(btn => {
            btn.addEventListener('click', (e) => {
                e.stopPropagation();
                const targetMode = btn.dataset.mode;
                if (!targetMode || targetMode === store.getOperationMode()) return;
                updateModeButton(targetMode);
                setTimeout(() => {
                    try { window.TWS3.haptics?.('light'); } catch (_) {}
                }, 30);
                queueMicrotask(() => {
                    store.setOperationMode(targetMode);
                });
            });
        });

        // 4. 顶栏右侧按钮点击（课程表视图触发导入，其他视图触发新建作业）
        if (navNewTaskBtn) {
            navNewTaskBtn.addEventListener('click', (e) => {
                e.stopPropagation();
                closeDropdown();
                if (store.getViewMode() === 'schedule') {
                    const schedInput = document.getElementById('schedule-xlsx-file-input');
                    if (schedInput) schedInput.click();
                } else {
                    openNewTaskModal();
                }
            });
        }

        // =======================================================
        // 新建作业二级弹窗逻辑
        // =======================================================
        const subjects = store.SUBJECT_OPTIONS || ['未设置', '语文', '数学', '英语', '物理', '化学', '生物', '政治', '历史', '地理', '其他'];

        function openNewTaskModal() {
            if (!newTaskModal) return;
            selectedSubject = '未设置';
            if (newTaskNameInput) {
                newTaskNameInput.value = '';
            }

            // 渲染科目选择 Chips
            if (newTaskSubjectChips) {
                newTaskSubjectChips.innerHTML = subjects.map(sub => `
                    <button type="button" class="new-task-subject-chip ${sub === selectedSubject ? 'active' : ''}" data-subject="${escapeHtml(sub)}">
                        ${escapeHtml(sub)}
                    </button>
                `).join('');
            }

            // 渲染分配班级 Checkbox Chips
            if (newTaskTargetClasses) {
                const classes = store.getClasses();
                newTaskTargetClasses.innerHTML = classes.map(cls => `
                    <label class="target-class-chip">
                        <input type="checkbox" value="${escapeHtml(cls.id)}" checked />
                        <span>${escapeHtml(cls.name)}</span>
                    </label>
                `).join('');
            }

            newTaskModal.classList.add('show');
            setTimeout(() => {
                if (newTaskNameInput) newTaskNameInput.focus();
            }, 100);
        }

        function closeNewTaskModal() {
            if (newTaskModal) newTaskModal.classList.remove('show');
        }

        function inferSubject(name) {
            const text = String(name || '').trim();
            if (/语文|默写|文言文|古诗|作文/.test(text)) return '语文';
            if (/数学|几何|代数|函数|算术/.test(text)) return '数学';
            if (/英语|单词|听力|改错|完形|阅读|背诵/.test(text)) return '英语';
            if (/物理|力学|电学|光学/.test(text)) return '物理';
            if (/化学/.test(text)) return '化学';
            if (/生物/.test(text)) return '生物';
            if (/政治|道法|道德与法治/.test(text)) return '政治';
            if (/历史/.test(text)) return '历史';
            if (/地理/.test(text)) return '地理';
            return '未设置';
        }

        if (newTaskSubjectChips) {
            newTaskSubjectChips.addEventListener('click', (e) => {
                const chip = e.target.closest('.new-task-subject-chip');
                if (!chip) return;
                selectedSubject = chip.dataset.subject || '未设置';
                newTaskSubjectChips.querySelectorAll('.new-task-subject-chip').forEach(c => {
                    c.classList.toggle('active', c === chip);
                });
            });
        }

        if (newTaskNameInput) {
            newTaskNameInput.addEventListener('input', (e) => {
                const autoSub = inferSubject(e.target.value);
                if (autoSub !== '未设置' && selectedSubject === '未设置') {
                    selectedSubject = autoSub;
                    if (newTaskSubjectChips) {
                        newTaskSubjectChips.querySelectorAll('.new-task-subject-chip').forEach(c => {
                            c.classList.toggle('active', c.dataset.subject === autoSub);
                        });
                    }
                }
            });

            newTaskNameInput.addEventListener('keydown', (e) => {
                if (e.key === 'Enter') {
                    e.preventDefault();
                    handleConfirmNewTask();
                }
            });
        }

        function handleConfirmNewTask() {
            const name = (newTaskNameInput?.value || '').trim();
            if (!name) {
                if (newTaskNameInput) newTaskNameInput.focus();
                window.TWS3.showToast?.('请输入作业名称');
                return;
            }

            const checkedInputs = newTaskTargetClasses ? newTaskTargetClasses.querySelectorAll('input:checked') : [];
            const classIds = Array.from(checkedInputs).map(inp => inp.value);
            const targetIds = classIds.length > 0 ? classIds : [store.getCurrentClassId()];

            const res = store.addTaskToClasses(name, selectedSubject, targetIds);
            if (res) {
                closeNewTaskModal();
                closeDropdown();
                const classNames = store.getClasses()
                    .filter(cls => res.classIds.includes(cls.id))
                    .map(cls => cls.name)
                    .join('、');
                window.TWS3.showToast?.(`已创建作业并分配至 ${classNames}`);
            }
        }


        if (newTaskCloseBtn) newTaskCloseBtn.addEventListener('click', closeNewTaskModal);
        if (newTaskCancelBtn) newTaskCancelBtn.addEventListener('click', closeNewTaskModal);
        if (newTaskConfirmBtn) newTaskConfirmBtn.addEventListener('click', handleConfirmNewTask);

        if (newTaskModal) {
            newTaskModal.addEventListener('click', (e) => {
                if (e.target === newTaskModal) closeNewTaskModal();
            });
        }

        // =======================================================
        // Navbar 标题与状态更新
        // =======================================================
        function updateHeaderTitle() {
            if (!currentTaskNameEl) return;
            const isScheduleView = store.getViewMode() === 'schedule';
            const chevronSvg = navTitleTrigger.querySelector('svg');
            const progressWrapper = document.querySelector('.tab-indicator-wrapper');
            if (chevronSvg) chevronSvg.style.display = '';
            navTitleTrigger.style.pointerEvents = '';

            if (isScheduleView) {
                if (progressWrapper) progressWrapper.style.display = 'none';
                const activeSchedule = store.getActiveSchedule();
                const isCombined = store.isCombinedScheduleMode ? store.isCombinedScheduleMode() : (store.getSelectedScheduleClassId() === 'combined');

                if (isCombined) {
                    const teacherSub = store.getScheduleTeacherSubject ? store.getScheduleTeacherSubject() : '英语';
                    const totalLessons = activeSchedule.totalCourses || 0;
                    currentTaskNameEl.innerHTML = `
                        <span class="nav-task-title-text">双班任课课表</span>
                        <span class="nav-badges-wrap">
                            <span class="nav-class-badge">${escapeHtml(teacherSub)}</span>
                            <span class="nav-subject-badge">共${totalLessons}节</span>
                        </span>
                    `;
                    return;
                }

                const currentClass = store.getState().currentClass || '班级';
                const className = activeSchedule.name || activeSchedule.shortName || currentClass;
                const gradeName = activeSchedule.grade || '课表';

                currentTaskNameEl.innerHTML = `
                    <span class="nav-task-title-text">${escapeHtml(className)}</span>
                    <span class="nav-badges-wrap">
                        <span class="nav-class-badge">${escapeHtml(gradeName)}</span>
                    </span>
                `;
                return;
            }

            if (progressWrapper) progressWrapper.style.display = '';
            const currentTask = store.getCurrentTask();
            const currentClass = store.getState().currentClass || '班级';

            if (!currentTask) {
                currentTaskNameEl.innerHTML = `<span class="nav-task-title-text">作业</span>`;
                return;
            }
            const subjectBadge = store.getShowSubjectTags() &&
                currentTask.subject &&
                currentTask.subject !== '未设置'
                ? `<span class="nav-subject-badge">${escapeHtml(currentTask.subject)}</span>`
                : '';
            currentTaskNameEl.innerHTML = `
                <span class="nav-task-title-text ${currentTask.archived ? 'archived' : ''}">${escapeHtml(currentTask.name)}</span>
                <span class="nav-badges-wrap">
                    <span class="nav-class-badge">${escapeHtml(currentClass)}</span>
                    ${subjectBadge}
                </span>
            `;
        }

        function updateProgress() {
            if (!progressBar) return;
            const stats = store.getStats();
            progressBar.style.width = stats.percentage + '%';
            progressBar.classList.toggle('completed', stats.percentage >= 100);
        }

        function toggleDropdown(forceState) {
            const isShown = typeof forceState === 'boolean'
                ? taskDropdown.classList.toggle('show', forceState)
                : taskDropdown.classList.toggle('show');
            navTitleTrigger.classList.toggle('active', isShown);
            if (taskDropdownOverlay) {
                taskDropdownOverlay.classList.toggle('show', isShown);
            }
            if (isShown) {
                renderClassCards();
                renderViewSwitcher();
                updateModeButton();
            }
        }

        function closeDropdown() {
            taskDropdown.classList.remove('show');
            navTitleTrigger.classList.remove('active');
            if (taskDropdownOverlay) {
                taskDropdownOverlay.classList.remove('show');
            }
        }

        navTitleTrigger.addEventListener('click', (e) => {
            e.stopPropagation();
            toggleDropdown();
        });

        if (taskDropdownOverlay) {
            taskDropdownOverlay.addEventListener('click', (e) => {
                e.stopPropagation();
                closeDropdown();
            });
        }

        document.addEventListener('click', (e) => {
            if (taskDropdown.contains(e.target) || navTitleTrigger.contains(e.target)) return;
            if (e.target.closest('.modal-overlay, .edit-sheet-overlay, .drawer-overlay, .drawer, .fullscreen-panel')) return;
            if (document.querySelector('.modal-overlay.show, .edit-sheet-overlay.show, .drawer.show, .fullscreen-panel.show')) return;
            closeDropdown();
        });

        // 订阅状态更新
        store.subscribe((state, eventType, payload) => {
            if (eventType === 'VIEW_MODE_CHANGED') {
                updateHeaderTitle();
                updateLeftNavButton();
                updateRightNavButton();
                renderViewSwitcher();
                updateModeButton();
            } else if (eventType === 'SCHEDULE_CLASS_CHANGED' || eventType === 'SCHEDULE_LIBRARY_UPDATED' || eventType === 'SCHEDULE_CHANGED' || eventType === 'SCHEDULE_HIGHLIGHT_CHANGED' || eventType === 'SCHEDULE_TEACHER_SUBJECT_CHANGED' || eventType === 'SCHEDULE_TEACHER_CLASSES_CHANGED') {
                if (store.getViewMode() === 'schedule') {
                    updateHeaderTitle();
                    if (taskDropdown.classList.contains('show')) renderClassCards();
                }
            } else if (eventType === 'OPERATION_MODE_CHANGED') {
                updateModeButton(payload.mode);
                updateProgress();
                if (taskDropdown.classList.contains('show')) renderClassCards();
                updateHeaderTitle();
                renderViewSwitcher();
            } else if (eventType === 'TASK_CHANGED') {
                updateHeaderTitle();
                updateProgress();
                if (taskDropdown.classList.contains('show')) renderClassCards();
            } else if (eventType === 'SUBJECT_TAG_VISIBILITY_CHANGED') {
                updateHeaderTitle();
            } else if (
                eventType === 'TASK_ADDED' ||
                eventType === 'TASK_RENAMED' ||
                eventType === 'TASK_SUBJECT_CHANGED' ||
                eventType === 'TASK_DELETED' ||
                eventType === 'TASK_ARCHIVE_TOGGLED' ||
                eventType === 'STUDENT_ADDED' ||
                eventType === 'STUDENT_DELETED' ||
                eventType === 'STUDENT_NON_ENGLISH_CHANGED' ||
                eventType === 'STORE_OVERRIDDEN' ||
                eventType === 'STORE_SMART_MERGED' ||
                eventType === 'CLASS_CHANGED'
            ) {
                updateHeaderTitle();
                if (taskDropdown.classList.contains('show')) renderClassCards();
                updateProgress();
            } else if (
                eventType === 'STUDENT_STATUS_CHANGED' ||
                eventType === 'STUDENT_RECORD_UPDATED' ||
                eventType === 'ROSTER_RESET'
            ) {
                updateProgress();
                if (taskDropdown.classList.contains('show')) renderClassCards();
            }
        });

        // 初始渲染
        renderClassCards();
        renderViewSwitcher();
        updateHeaderTitle();
        updateLeftNavButton();
        updateRightNavButton();
        updateModeButton();
        updateProgress();
        const navbarService = {
            updateProgress,
            renderTasks: () => {
                updateHeaderTitle();
                updateModeButton();
                renderClassCards();
            },
            toggleDropdown,
            closeDropdown,
            openNewTaskModal,
            closeNewTaskModal
        };

        window.TWS3.navbar = navbarService;
        return navbarService;
    }

    window.TWS3.initNavbar = initNavbar;
})();
