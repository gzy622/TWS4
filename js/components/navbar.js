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

        // 搜索学生二级弹窗节点
        const searchModal = document.getElementById('student-search-modal');
        const searchCloseBtn = document.getElementById('student-search-close-btn');
        const searchClearBtn = document.getElementById('student-search-clear-btn');
        const searchConfirmBtn = document.getElementById('student-search-confirm-btn');
        const searchModalInput = document.getElementById('student-search-modal-input');
        const searchModalClearIcon = document.getElementById('student-search-modal-clear');

        let selectedSubject = '未设置';
        let currentSearchQuery = '';
        let currentStatusFilter = 'all';

        // 构建精简快捷面板 DOM
        taskDropdown.innerHTML = `
            <!-- 1. 视图切换行 -->
            <div class="quick-panel-section quick-views" aria-label="视图切换">
                <button type="button" class="quick-view-btn" data-view="grid" title="网格视图">
                    <svg viewBox="0 0 24 24"><path d="M4 5h7v6H4zM13 5h7v6h-7zM4 13h7v6H4zM13 13h7v6h-7z"/></svg><span>网格</span>
                </button>
                <button type="button" class="quick-view-btn" data-view="wide" title="宽栏视图">
                    <svg viewBox="0 0 24 24"><path d="M4 5h7v14H4zM13 5h7v14h-7z"/></svg><span>宽栏</span>
                </button>
                <button type="button" class="quick-view-btn" data-view="seat" title="座位视图">
                    <svg viewBox="0 0 24 24"><path d="M4 5h16v14H4zM8 5v14m8-14v14M4 12h16"/></svg><span>座位</span>
                </button>
                <button type="button" class="quick-view-btn" data-view="table" title="表格视图">
                    <svg viewBox="0 0 24 24"><path d="M3 5h18v14H3zM3 10h18M9 5v14M15 5v14"/></svg><span>表格</span>
                </button>
            </div>

            <!-- 2. 班级切换卡片行 -->
            <div class="quick-panel-section quick-classes" id="quick-class-comparison" aria-label="班级切换"></div>

            <!-- 3. 状态筛选胶囊行 -->
            <div class="quick-panel-section quick-filters" aria-label="状态筛选">
                <button type="button" class="quick-filter-pill active" data-status="all">全部</button>
                <button type="button" class="quick-filter-pill" data-status="unsubmitted">未交</button>
                <button type="button" class="quick-filter-pill" data-status="submitted">已交</button>
                <button type="button" class="quick-filter-pill" data-status="muted">免交</button>
            </div>

            <!-- 4. 核心三操作按钮行 (搜索、模式切换单个按钮、新建作业) -->
            <div class="quick-panel-section quick-actions-grid">
                <button type="button" class="quick-action-card search-btn" id="quick-search-trigger-btn">
                    <svg viewBox="0 0 24 24" class="quick-action-icon">
                        <circle cx="11" cy="11" r="7" fill="none" stroke="currentColor" stroke-width="2"/>
                        <path d="M21 21l-4.35-4.35" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round"/>
                    </svg>
                    <span class="quick-action-text" id="quick-search-btn-text">搜索学生</span>
                </button>
                <button type="button" class="quick-action-card mode-btn" id="quick-mode-toggle-btn" data-mode="check">
                    <svg viewBox="0 0 24 24" class="quick-action-icon" id="quick-mode-icon">
                        <polyline points="9 11 12 14 22 4" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round"/>
                        <path d="M21 12v7a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h11" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round"/>
                    </svg>
                    <span class="quick-action-text" id="quick-mode-btn-text">登记模式</span>
                </button>
                <button type="button" class="quick-action-card new-btn" id="quick-new-task-btn">
                    <svg viewBox="0 0 24 24" class="quick-action-icon">
                        <path d="M12 5v14m-7-7h14" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round"/>
                    </svg>
                    <span class="quick-action-text">新建作业</span>
                </button>
            </div>

            <div class="task-drag-handle" aria-hidden="true"></div>
        `;

        const viewButtons = taskDropdown.querySelectorAll('.quick-view-btn');
        const classComparisonContainer = taskDropdown.querySelector('#quick-class-comparison');
        const filterPills = taskDropdown.querySelectorAll('.quick-filter-pill');
        const searchTriggerBtn = taskDropdown.querySelector('#quick-search-trigger-btn');
        const searchBtnText = taskDropdown.querySelector('#quick-search-btn-text');
        const modeToggleBtn = taskDropdown.querySelector('#quick-mode-toggle-btn');
        const modeBtnText = taskDropdown.querySelector('#quick-mode-btn-text');
        const modeIcon = taskDropdown.querySelector('#quick-mode-icon');
        const newTaskBtn = taskDropdown.querySelector('#quick-new-task-btn');

        // 渲染班级卡片
        function renderClassCards() {
            if (!classComparisonContainer) return;
            const mode = store.getOperationMode();
            const comparison = store.getTaskComparison(undefined, mode);
            classComparisonContainer.innerHTML = comparison.classes.map(cls => {
                const hasTask = !!cls.taskId;
                const count = mode === 'grade' ? (cls.graded || 0) : (cls.submitted || 0);
                const actionLabel = mode === 'grade' ? '已评' : '已交';
                const summary = hasTask ? `${count}/${cls.required} ${actionLabel}` : '未分配';
                return `
                    <button type="button" class="quick-class-card ${cls.isCurrent ? 'active' : ''}" data-class-id="${escapeHtml(cls.id)}">
                        <div class="quick-class-card-head">
                            <strong class="quick-class-name">${escapeHtml(cls.name)}</strong>
                            <span class="quick-class-badge">${summary}</span>
                        </div>
                        <span class="quick-class-progress"><i style="width:${hasTask ? cls.percentage : 0}%"></i></span>
                    </button>
                `;
            }).join('');
        }

        // 渲染视图切换高亮
        function renderViewSwitcher() {
            const currentView = store.getViewMode();
            viewButtons.forEach(btn => {
                btn.classList.toggle('active', btn.dataset.view === currentView);
            });
        }

        // 渲染模式切换按钮状态
        function updateModeButton(mode = store.getOperationMode()) {
            if (!modeToggleBtn) return;
            modeToggleBtn.dataset.mode = mode;

            if (mode === 'grade') {
                if (modeBtnText) modeBtnText.textContent = '打分模式';
                if (modeIcon) {
                    modeIcon.innerHTML = `
                        <path d="M12 20h9" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round"/>
                        <path d="M16.5 3.5a2.121 2.121 0 0 1 3 3L7 19l-4 1 1-4L16.5 3.5z" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round"/>
                    `;
                }
            } else {
                if (modeBtnText) modeBtnText.textContent = '登记模式';
                if (modeIcon) {
                    modeIcon.innerHTML = `
                        <polyline points="9 11 12 14 22 4" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round"/>
                        <path d="M21 12v7a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h11" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round"/>
                    `;
                }
            }
            taskDropdown.dataset.mode = mode;
            const progressWrapper = document.querySelector('.tab-indicator-wrapper');
            if (progressWrapper) progressWrapper.dataset.mode = mode;
            const navbarEl = document.querySelector('.navbar');
            if (navbarEl) navbarEl.dataset.mode = mode;
        }

        // 渲染搜索按钮文字与状态
        function updateSearchButtonState() {
            if (!searchTriggerBtn) return;
            const hasQuery = Boolean(currentSearchQuery);
            searchTriggerBtn.classList.toggle('has-query', hasQuery);
            if (searchBtnText) {
                searchBtnText.textContent = hasQuery ? `搜: ${currentSearchQuery}` : '搜索学生';
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

        // 2. 班级切换点击
        if (classComparisonContainer) {
            classComparisonContainer.addEventListener('click', (e) => {
                const card = e.target.closest('.quick-class-card');
                if (!card || card.classList.contains('active')) return;
                const classId = card.dataset.classId;
                if (classId) {
                    store.switchClassForTask(classId);
                }
            });
        }

        // 3. 状态筛选胶囊点击
        filterPills.forEach(pill => {
            pill.addEventListener('click', (e) => {
                e.stopPropagation();
                const status = pill.dataset.status || 'all';
                currentStatusFilter = status;
                filterPills.forEach(p => p.classList.toggle('active', p === pill));
                if (typeof store.setStudentFilter === 'function') {
                    store.setStudentFilter({ query: currentSearchQuery, status: currentStatusFilter });
                }
            });
        });

        // 4. 单个模式切换按钮点击 (直接在 check ↔ grade 间切换)
        if (modeToggleBtn) {
            modeToggleBtn.addEventListener('click', (e) => {
                e.stopPropagation();
                const currentMode = store.getOperationMode();
                const nextMode = currentMode === 'grade' ? 'check' : 'grade';
                updateModeButton(nextMode);
                setTimeout(() => {
                    try { window.TWS3.haptics?.('light'); } catch (_) {}
                }, 30);
                queueMicrotask(() => {
                    store.setOperationMode(nextMode);
                });
            });
        }

        // =======================================================
        // 搜索学生二级弹窗逻辑
        // =======================================================
        function openSearchModal() {
            if (!searchModal) return;
            if (searchModalInput) {
                searchModalInput.value = currentSearchQuery;
            }
            if (searchModalClearIcon) {
                searchModalClearIcon.style.display = currentSearchQuery ? 'block' : 'none';
            }
            searchModal.classList.add('show');
            setTimeout(() => {
                if (searchModalInput) {
                    searchModalInput.focus();
                    searchModalInput.select();
                }
            }, 100);
        }

        function closeSearchModal() {
            if (searchModal) searchModal.classList.remove('show');
        }

        function applySearchFilter(query) {
            currentSearchQuery = (query || '').trim();
            updateSearchButtonState();
            if (typeof store.setStudentFilter === 'function') {
                store.setStudentFilter({ query: currentSearchQuery, status: currentStatusFilter });
            }
            closeSearchModal();
        }

        if (searchTriggerBtn) {
            searchTriggerBtn.addEventListener('click', (e) => {
                e.stopPropagation();
                openSearchModal();
            });
        }

        if (searchModalInput) {
            searchModalInput.addEventListener('input', (e) => {
                if (searchModalClearIcon) {
                    searchModalClearIcon.style.display = e.target.value.trim() ? 'block' : 'none';
                }
            });

            searchModalInput.addEventListener('keydown', (e) => {
                if (e.key === 'Enter') {
                    e.preventDefault();
                    applySearchFilter(searchModalInput.value);
                }
            });
        }

        if (searchModalClearIcon) {
            searchModalClearIcon.addEventListener('click', (e) => {
                e.stopPropagation();
                if (searchModalInput) {
                    searchModalInput.value = '';
                    searchModalClearIcon.style.display = 'none';
                    searchModalInput.focus();
                }
            });
        }

        if (searchClearBtn) {
            searchClearBtn.addEventListener('click', () => {
                if (searchModalInput) searchModalInput.value = '';
                applySearchFilter('');
            });
        }

        if (searchConfirmBtn) {
            searchConfirmBtn.addEventListener('click', () => {
                applySearchFilter(searchModalInput ? searchModalInput.value : '');
            });
        }

        if (searchCloseBtn) searchCloseBtn.addEventListener('click', closeSearchModal);

        if (searchModal) {
            searchModal.addEventListener('click', (e) => {
                if (e.target === searchModal) closeSearchModal();
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

        if (newTaskBtn) {
            newTaskBtn.addEventListener('click', (e) => {
                e.stopPropagation();
                openNewTaskModal();
            });
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
            const currentTask = store.getCurrentTask();
            const currentClass = store.getState().currentClass || '班级';
            const chevronSvg = navTitleTrigger.querySelector('svg');
            const progressWrapper = document.querySelector('.tab-indicator-wrapper');
            if (chevronSvg) chevronSvg.style.display = '';
            if (progressWrapper) progressWrapper.style.display = '';
            navTitleTrigger.style.pointerEvents = '';

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
                updateSearchButtonState();
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
            if (eventType === 'OPERATION_MODE_CHANGED') {
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
        updateModeButton();
        updateSearchButtonState();
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
            closeNewTaskModal,
            openSearchModal,
            closeSearchModal
        };

        window.TWS3.navbar = navbarService;
        return navbarService;
    }

    window.TWS3.initNavbar = initNavbar;
})();
