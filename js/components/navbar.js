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
    function initNavbar({ onNewTaskClick, onEditTaskClick }) {
        const navTitleTrigger = document.getElementById('nav-title-trigger');
        const currentTaskNameEl = document.getElementById('current-task-name');
        const taskDropdown = document.getElementById('task-dropdown');
        const taskDropdownOverlay = document.getElementById('task-dropdown-overlay');
        const progressBar = document.getElementById('progress-bar');
        const navPlusBtn = document.getElementById('nav-new-task-btn');

        // 构建持久化容器节点
        taskDropdown.innerHTML = '';

        // 顶部工具栏：搜索过滤
        const toolbar = document.createElement('div');
        toolbar.className = 'task-dropdown-toolbar';
        toolbar.innerHTML = `
            <div class="task-search-wrapper">
                <svg class="task-search-icon" viewBox="0 0 24 24">
                    <circle cx="11" cy="11" r="7" fill="none" stroke="currentColor" stroke-width="2"/>
                    <path d="M21 21l-4.35-4.35" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round"/>
                </svg>
                <input type="text" class="task-search-input" placeholder="搜索作业..." aria-label="搜索作业">
                <button type="button" class="task-search-clear" aria-label="清空搜索" style="display: none;">✕</button>
            </div>
        `;

        const listContainer = document.createElement('div');
        listContainer.className = 'task-list-container';

        const footer = document.createElement('div');
        footer.className = 'task-dropdown-footer';
        footer.innerHTML = `
            <div class="mode-segmented-control" data-mode="check">
                <div class="mode-slider-thumb"></div>
                <button type="button" class="mode-segment-btn active" data-mode="check">
                    <svg viewBox="0 0 24 24" class="mode-icon">
                        <polyline points="9 11 12 14 22 4" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round"/>
                        <path d="M21 12v7a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h11" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round"/>
                    </svg>
                    <span>登记模式</span>
                </button>
                <button type="button" class="mode-segment-btn" data-mode="grade">
                    <svg viewBox="0 0 24 24" class="mode-icon">
                        <path d="M12 20h9" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round"/>
                        <path d="M16.5 3.5a2.121 2.121 0 0 1 3 3L7 19l-4 1 1-4L16.5 3.5z" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round"/>
                    </svg>
                    <span>打分模式</span>
                </button>
            </div>
        `;

        const dragHandle = document.createElement('div');
        dragHandle.className = 'task-drag-handle';
        dragHandle.setAttribute('aria-hidden', 'true');

        taskDropdown.appendChild(toolbar);
        taskDropdown.appendChild(listContainer);
        taskDropdown.appendChild(footer);
        taskDropdown.appendChild(dragHandle);

        let activeMenuTaskId = null;
        let activeMoreBtn = null;

        // 全局单例作业操作二级小菜单（挂载在 taskDropdown 根级，避免被 listContainer 的 overflow 裁剪）
        const actionMenu = document.createElement('div');
        actionMenu.className = 'task-action-menu';
        actionMenu.setAttribute('role', 'menu');
        actionMenu.innerHTML = `
            <button type="button" class="task-action-menu-item edit-task-action" role="menuitem">
                <svg viewBox="0 0 24 24">
                    <path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"/>
                    <path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"/>
                </svg>
                <span>重命名</span>
            </button>
            <button type="button" class="task-action-menu-item archive-task-action" role="menuitem">
                <svg viewBox="0 0 24 24">
                    <path d="M21 8v13H3V8M1 3h22v5H1zM10 12h4" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"/>
                </svg>
                <span class="archive-action-text">归档</span>
            </button>
            <div class="task-action-menu-divider" role="separator"></div>
            <button type="button" class="task-action-menu-item delete-task-action danger" role="menuitem">
                <svg viewBox="0 0 24 24">
                    <path d="M3 6h18M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"/>
                    <path d="M10 11v6M14 11v6" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"/>
                </svg>
                <span>删除</span>
            </button>
        `;
        taskDropdown.appendChild(actionMenu);

        actionMenu.querySelector('.edit-task-action').addEventListener('click', (e) => {
            e.stopPropagation();
            const taskId = activeMenuTaskId;
            closeAllActionMenus();
            if (taskId) {
                const targetTask = store.getState().tasks.find(t => t.id === taskId);
                if (targetTask) handleRenameTask(targetTask);
            }
        });

        actionMenu.querySelector('.archive-task-action').addEventListener('click', (e) => {
            e.stopPropagation();
            const taskId = activeMenuTaskId;
            closeAllActionMenus();
            if (taskId) store.toggleArchiveTask(taskId);
        });

        actionMenu.querySelector('.delete-task-action').addEventListener('click', (e) => {
            e.stopPropagation();
            const taskId = activeMenuTaskId;
            closeAllActionMenus();
            if (taskId) {
                const targetTask = store.getState().tasks.find(t => t.id === taskId);
                if (targetTask) handleDeleteTask(targetTask);
            }
        });
        const segmentedControl = footer.querySelector('.mode-segmented-control');
        const segmentBtns = footer.querySelectorAll('.mode-segment-btn');
        const searchInput = toolbar.querySelector('.task-search-input');
        const searchClearBtn = toolbar.querySelector('.task-search-clear');

        let searchQuery = '';
        let isArchivedGroupExpanded = null; // null 表示随当前作业自动决定
        let taskListDirty = false;
        // 搜索事件监听
        if (searchInput) {
            searchInput.addEventListener('input', (e) => {
                searchQuery = e.target.value.trim().toLowerCase();
                if (searchClearBtn) {
                    searchClearBtn.style.display = searchQuery ? 'flex' : 'none';
                }
                renderTaskList();
            });
        }
        if (searchClearBtn) {
            searchClearBtn.addEventListener('click', (e) => {
                e.stopPropagation();
                if (searchInput) {
                    searchInput.value = '';
                    searchQuery = '';
                    searchClearBtn.style.display = 'none';
                    searchInput.focus();
                }
                renderTaskList();
            });
        }


        // 绑定模式切换点击事件与即时触感/动画反馈
        segmentBtns.forEach(btn => {
            btn.addEventListener('click', (e) => {
                e.stopPropagation();
                const targetMode = btn.dataset.mode;
                if (!targetMode || store.getOperationMode() === targetMode) return;
                updateModeSwitcher(targetMode);
                setTimeout(() => {
                    try { window.TWS3.haptics?.('light'); } catch (_) {}
                }, 30);
                queueMicrotask(() => {
                    store.setOperationMode(targetMode);
                });
            });
        });

        function updateHeaderTitle() {
            if (!currentTaskNameEl) return;
            const viewMode = store.getViewMode();
            const currentClass = store.getState().currentClass || '班级';
            const chevronSvg = navTitleTrigger.querySelector('svg');
            const progressWrapper = document.querySelector('.tab-indicator-wrapper');

            if (viewMode === 'grid' || viewMode === 'seat') {
                if (chevronSvg) chevronSvg.style.display = '';
                if (navPlusBtn) navPlusBtn.style.display = '';
                if (progressWrapper) progressWrapper.style.display = '';
                navTitleTrigger.style.pointerEvents = '';

                const currentTask = store.getCurrentTask();
                if (currentTask) {
                    let badgesHtml = '';
                    if (currentTask.subject && currentTask.subject !== '未设置') {
                        badgesHtml += `<span class="nav-subject-badge">${escapeHtml(currentTask.subject)}</span>`;
                    }
                    const isArchived = !!currentTask.archived;
                    currentTaskNameEl.innerHTML = `
                        <span class="nav-task-title-text ${isArchived ? 'archived' : ''}">${escapeHtml(currentTask.name)}</span>
                        ${badgesHtml ? `<span class="nav-badges-wrap">${badgesHtml}</span>` : ''}
                    `;
                } else {
                    currentTaskNameEl.innerHTML = `<span class="nav-task-title-text">作业</span>`;
                }
            } else {
                if (chevronSvg) chevronSvg.style.display = 'none';
                if (navPlusBtn) navPlusBtn.style.display = 'none';
                if (progressWrapper) progressWrapper.style.display = 'none';
                navTitleTrigger.style.pointerEvents = 'none';
                closeDropdown();

                let titleText = '视图';
                if (viewMode === 'table') titleText = `记分册表格 · ${currentClass}`;
                else if (viewMode === 'schedule') titleText = `课程表 · ${currentClass}`;
                else if (viewMode === 'officers') titleText = `班干部表 · ${currentClass}`;
                else if (viewMode === 'duty') titleText = `值日生表 · ${currentClass}`;
                currentTaskNameEl.innerHTML = `<span class="nav-view-title">${escapeHtml(titleText)}</span>`;
            }
        }

        function updateModeSwitcher(mode = store.getOperationMode()) {
            if (segmentedControl) segmentedControl.dataset.mode = mode;
            const progressWrapper = document.querySelector('.tab-indicator-wrapper');
            if (progressWrapper) progressWrapper.dataset.mode = mode;
            const navbarEl = document.querySelector('.navbar');
            if (navbarEl) navbarEl.dataset.mode = mode;

            if (segmentBtns) {
                segmentBtns.forEach(btn => {
                    btn.classList.toggle('active', btn.dataset.mode === mode);
                });
            }
        }

        async function handleSetSubject(task) {
            const modal = window.TWS3.modal;
            const subjects = store.SUBJECT_OPTIONS || ['未设置', '语文', '数学', '英语', '物理', '化学', '生物', '政治', '历史', '地理', '其他'];
            if (modal) {
                const newSub = await modal.prompt({
                    title: `设置作业科目`,
                    message: `当前作业：${task.name}\n可选科目：${subjects.join(' / ')}`,
                    defaultValue: task.subject || '未设置',
                    placeholder: '请输入科目名称'
                });
                if (newSub !== null && newSub !== undefined && newSub.trim()) {
                    store.setTaskSubject(task.id, newSub.trim());
                }
            } else {
                const curIdx = subjects.indexOf(task.subject || '未设置');
                const nextSub = subjects[(curIdx + 1) % subjects.length];
                store.setTaskSubject(task.id, nextSub);
            }
        }

        async function handleRenameTask(task) {
            const modal = window.TWS3.modal;
            if (modal) {
                const newName = await modal.prompt({
                    title: '重命名作业',
                    defaultValue: task.name,
                    placeholder: '作业名称'
                });
                if (newName && newName.trim()) {
                    store.updateTaskName(task.id, newName.trim());
                }
            } else if (onEditTaskClick) {
                onEditTaskClick(task.id, task.name);
            }
        }

        async function handleDeleteTask(task) {
            const state = store.getState();
            const modal = window.TWS3.modal;
            if (state.tasks.length <= 1) {
                if (modal) {
                    modal.alert({ title: '无法删除', message: '至少需保留一个作业。' });
                } else {
                    alert('至少需保留一个作业。');
                }
                return;
            }

            const confirmed = modal
                ? await modal.confirm({
                    title: '删除作业',
                    message: `确定删除「${task.name}」？该作业下的所有提交与评分记录将被清除。`,
                    danger: true,
                    confirmText: '删除'
                })
                : confirm(`确定删除「${task.name}」吗？`);

            if (confirmed) {
                const res = store.deleteTask(task.id);
                if (!res.success && modal) {
                    modal.alert({ title: '删除失败', message: res.reason || '删除失败' });
                }
            }
        }

        function closeAllActionMenus() {
            activeMenuTaskId = null;
            if (activeMoreBtn) {
                activeMoreBtn.classList.remove('active');
                activeMoreBtn.setAttribute('aria-expanded', 'false');
                activeMoreBtn = null;
            }
            actionMenu.classList.remove('show');
        }

        function openActionMenu(task, btnElement) {
            const isSame = activeMenuTaskId === task.id && actionMenu.classList.contains('show');
            closeAllActionMenus();
            if (isSame) return;

            activeMenuTaskId = task.id;
            activeMoreBtn = btnElement;

            const isArchived = !!task.archived;
            const state = store.getState();
            const canDelete = state.tasks.length > 1;

            const archiveText = actionMenu.querySelector('.archive-action-text');
            if (archiveText) archiveText.textContent = isArchived ? '解除归档' : '归档';

            const deleteBtn = actionMenu.querySelector('.delete-task-action');
            if (deleteBtn) {
                deleteBtn.classList.toggle('disabled', !canDelete);
                deleteBtn.disabled = !canDelete;
            }

            const dropdownRect = taskDropdown.getBoundingClientRect();
            const btnRect = btnElement.getBoundingClientRect();

            // 测量菜单尺寸并计算方向
            actionMenu.style.visibility = 'hidden';
            actionMenu.style.display = 'flex';
            const menuHeight = actionMenu.offsetHeight || 122;
            actionMenu.style.visibility = '';
            actionMenu.style.display = '';

            const spaceBelow = dropdownRect.bottom - btnRect.bottom;
            const spaceAbove = btnRect.top - dropdownRect.top;

            let topOffset;
            if (spaceBelow < menuHeight + 6 && spaceAbove > menuHeight) {
                // 空间不足且上方充足时向上弹出
                topOffset = btnRect.top - dropdownRect.top - menuHeight - 3;
            } else {
                // 默认向下弹出
                topOffset = btnRect.bottom - dropdownRect.top + 3;
            }

            const rightOffset = dropdownRect.right - btnRect.right;

            actionMenu.style.top = `${topOffset}px`;
            actionMenu.style.right = `${Math.max(10, rightOffset)}px`;
            actionMenu.style.left = 'auto';
            actionMenu.style.bottom = 'auto';
            actionMenu.classList.add('show');
            btnElement.classList.add('active');
            btnElement.setAttribute('aria-expanded', 'true');
        }

        function createTaskItemElement(task, state) {
            const isCurrent = task.id === state.currentTaskId;
            const isArchived = !!task.archived;
            const item = document.createElement('div');
            item.className = `task-item ${isCurrent ? 'active' : ''} ${isArchived ? 'archived' : ''}`;
            item.dataset.taskId = task.id;
            const subject = task.subject || '未设置';
            const isEnglish = subject === '英语';
            const subjectBadgeClass = isEnglish ? 'task-chip chip-english' : 'task-chip chip-subject';

            item.innerHTML = `
                <div class="task-main">
                    <div class="task-active-indicator" aria-hidden="true"></div>
                    <div class="task-content">
                        <div class="task-title-row">
                            <span class="task-name" title="${escapeHtml(task.name)}">${escapeHtml(task.name)}</span>
                        </div>
                    </div>
                </div>
                <div class="task-meta-actions">
                    <button type="button" class="${subjectBadgeClass}" title="点击修改科目" aria-label="科目：${escapeHtml(subject)}">
                        <span>${escapeHtml(subject)}</span>
                    </button>
                    <button type="button" class="task-more-btn" title="更多操作" aria-label="更多操作" aria-haspopup="true" aria-expanded="false">
                        <svg viewBox="0 0 24 24">
                            <circle cx="12" cy="5" r="1.75" fill="currentColor"/>
                            <circle cx="12" cy="12" r="1.75" fill="currentColor"/>
                            <circle cx="12" cy="19" r="1.75" fill="currentColor"/>
                        </svg>
                    </button>
                </div>
            `;

            // 点击条目主体切换当前作业
            item.addEventListener('click', () => {
                store.setCurrentTask(task.id);
                closeDropdown();
            });

            // 科目标签点击切换
            const subjectBtn = item.querySelector('.task-chip.chip-subject, .task-chip.chip-english');
            if (subjectBtn) {
                subjectBtn.addEventListener('click', (e) => {
                    e.stopPropagation();
                    closeAllActionMenus();
                    handleSetSubject(task);
                });
            }

            // 三圆点更多操作菜单切换
            const moreBtn = item.querySelector('.task-more-btn');
            if (moreBtn) {
                moreBtn.addEventListener('click', (e) => {
                    e.stopPropagation();
                    openActionMenu(task, moreBtn);
                });
            }

            return item;
        }

        function updateActiveTaskHighlight() {
            const state = store.getState();
            const currentTaskId = state.currentTaskId;
            const items = listContainer.querySelectorAll('.task-item');
            items.forEach(item => {
                item.classList.toggle('active', item.dataset.taskId === currentTaskId);
            });
        }

        function renderTaskList() {
            taskListDirty = false;
            const state = store.getState();
            const fragment = document.createDocumentFragment();

            let allTasks = state.tasks || [];

            // 搜索过滤
            if (searchQuery) {
                allTasks = allTasks.filter(t => {
                    const nameMatch = (t.name || '').toLowerCase().includes(searchQuery);
                    const subjectMatch = (t.subject || '').toLowerCase().includes(searchQuery);
                    return nameMatch || subjectMatch;
                });
            }

            if (allTasks.length === 0) {
                const emptyEl = document.createElement('div');
                emptyEl.className = 'task-empty-state';
                emptyEl.innerHTML = `<span>未找到匹配的作业</span>`;
                fragment.appendChild(emptyEl);
                listContainer.innerHTML = '';
                listContainer.appendChild(fragment);
                return;
            }

            const ongoingTasks = allTasks.filter(t => !t.archived);
            const archivedTasks = allTasks.filter(t => !!t.archived);

            // 当前选中作业是否在归档中
            const currentIsArchived = archivedTasks.some(t => t.id === state.currentTaskId);
            const shouldExpandArchived = isArchivedGroupExpanded !== null
                ? isArchivedGroupExpanded
                : (currentIsArchived || (ongoingTasks.length === 0));

            // 1. 渲染进行中分组
            if (ongoingTasks.length > 0) {
                if (archivedTasks.length > 0) {
                    const groupHeader = document.createElement('div');
                    groupHeader.className = 'task-group-header';
                    groupHeader.innerHTML = `
                        <div class="task-group-header-left">
                            <span class="task-group-title">进行中</span>
                            <span class="task-group-count">${ongoingTasks.length}</span>
                        </div>
                    `;
                    fragment.appendChild(groupHeader);
                }
                const ongoingGroup = document.createElement('div');
                ongoingGroup.className = 'task-group-list';
                ongoingTasks.forEach(task => {
                    ongoingGroup.appendChild(createTaskItemElement(task, state));
                });
                fragment.appendChild(ongoingGroup);
            }

            // 2. 渲染已归档分组
            if (archivedTasks.length > 0) {
                const archivedHeader = document.createElement('div');
                archivedHeader.className = `task-group-header clickable ${shouldExpandArchived ? 'expanded' : ''}`;
                archivedHeader.innerHTML = `
                    <div class="task-group-header-left">
                        <span class="task-group-title">已归档</span>
                        <span class="task-group-count">${archivedTasks.length}</span>
                    </div>
                    <svg class="task-group-chevron" viewBox="0 0 24 24">
                        <path d="M6 9l6 6 6-6" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"/>
                    </svg>
                `;

                archivedHeader.addEventListener('click', (e) => {
                    e.stopPropagation();
                    isArchivedGroupExpanded = !shouldExpandArchived;
                    renderTaskList();
                });

                fragment.appendChild(archivedHeader);

                if (shouldExpandArchived) {
                    const archivedGroup = document.createElement('div');
                    archivedGroup.className = 'task-group-list archived-list';
                    archivedTasks.forEach(task => {
                        archivedGroup.appendChild(createTaskItemElement(task, state));
                    });
                    fragment.appendChild(archivedGroup);
                }
            }

            listContainer.innerHTML = '';
            listContainer.appendChild(fragment);
        }
        function updateProgress() {
            const stats = store.getStats();
            progressBar.style.width = stats.percentage + '%';
        }

        function toggleDropdown(forceState) {
            const wasShown = taskDropdown.classList.contains('show');
            const isShown = typeof forceState === 'boolean'
                ? taskDropdown.classList.toggle('show', forceState)
                : taskDropdown.classList.toggle('show');
            navTitleTrigger.classList.toggle('active', isShown);
            if (taskDropdownOverlay) {
                taskDropdownOverlay.classList.toggle('show', isShown);
            }
            if (isShown && !wasShown) {
                const hadSearch = searchQuery !== '' || (searchInput && searchInput.value !== '');
                if (searchInput) searchInput.value = '';
                searchQuery = '';
                if (searchClearBtn) searchClearBtn.style.display = 'none';
                isArchivedGroupExpanded = null;
                // 仅当数据有脏标记、此前存在搜索过滤或列表尚未生成时才重建 DOM，避免拖拽初帧卡顿
                if (taskListDirty || hadSearch || listContainer.children.length === 0) {
                    renderTaskList();
                } else {
                    updateActiveTaskHighlight();
                }
            }
        }

        function closeDropdown() {
            closeAllActionMenus();
            taskDropdown.classList.remove('show');
            navTitleTrigger.classList.remove('active');
            if (taskDropdownOverlay) {
                taskDropdownOverlay.classList.remove('show');
            }
        }

        async function handleCreateNewTask() {
            const now = new Date();
            const mm = String(now.getMonth() + 1).padStart(2, '0');
            const dd = String(now.getDate()).padStart(2, '0');
            const defaultName = `${mm}${dd}作业`;

            const modal = window.TWS3.modal;
            if (modal) {
                const name = await modal.prompt({
                    title: '新建作业',
                    defaultValue: defaultName,
                    placeholder: '如：0621英语背诵'
                });
                if (name && name.trim()) {
                    store.addTask(name.trim());
                }
            } else if (onNewTaskClick) {
                onNewTaskClick(defaultName);
            } else {
                const name = prompt('新建作业：', defaultName);
                if (name && name.trim()) {
                    store.addTask(name.trim());
                }
            }
        }

        navTitleTrigger.addEventListener('click', (e) => {
            const mode = store.getViewMode();
            if (mode !== 'grid' && mode !== 'seat') return;
            e.stopPropagation();
            toggleDropdown();
        });
        if (taskDropdownOverlay) {
            taskDropdownOverlay.addEventListener('click', (e) => {
                e.stopPropagation();
                closeDropdown();
            });
        }

        listContainer.addEventListener('scroll', closeAllActionMenus, { passive: true });

        document.addEventListener('click', (e) => {
            if (!actionMenu.contains(e.target) && !e.target.closest('.task-more-btn')) {
                closeAllActionMenus();
            }
            if (taskDropdown.contains(e.target) || navTitleTrigger.contains(e.target)) return;
            if (e.target.closest('.modal-overlay, .edit-sheet-overlay, .drawer-overlay, .drawer')) return;
            if (document.querySelector('.modal-overlay.show, .edit-sheet-overlay.show, .drawer.show')) return;
            closeDropdown();
        });

        if (navPlusBtn) {
            navPlusBtn.addEventListener('click', async () => {
                handleCreateNewTask();
            });
        }

        // 订阅状态更新
        store.subscribe((state, eventType, payload) => {
            if (eventType === 'OPERATION_MODE_CHANGED') {
                updateModeSwitcher(payload.mode);
            } else if (eventType === 'VIEW_MODE_CHANGED') {
                updateHeaderTitle();
            } else if (eventType === 'TASK_CHANGED') {
                updateActiveTaskHighlight();
                updateHeaderTitle();
                updateProgress();
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
                if (taskDropdown.classList.contains('show')) {
                    renderTaskList();
                } else {
                    taskListDirty = true;
                }
                updateHeaderTitle();
                updateProgress();
            } else if (
                eventType === 'STUDENT_STATUS_CHANGED' ||
                eventType === 'STUDENT_RECORD_UPDATED' ||
                eventType === 'ROSTER_RESET'
            ) {
                updateProgress();
            }
        });

        // 初始渲染：仅更新可见头部状态与进度，列表 DOM 延后至首次打开下拉时构建
        taskListDirty = true;
        updateHeaderTitle();
        updateModeSwitcher();
        updateProgress();
        return {
            updateProgress,
            renderTasks: () => {
                renderTaskList();
                updateHeaderTitle();
                updateModeSwitcher();
            },
            toggleDropdown,
            closeDropdown
        };
    }

    window.TWS3.initNavbar = initNavbar;
})();
