(function() {
    window.TWS3 = window.TWS3 || {};
    const store = window.TWS3.store;

    function escapeHtml(value) {
        return String(value === null || value === undefined ? '' : value)
            .replace(/&/g, '&amp;')
            .replace(/</g, '&lt;')
            .replace(/>/g, '&gt;')
            .replace(/"/g, '&quot;')
            .replace(/'/g, '&#39;');
    }

    function showToast(msg, duration) {
        if (window.TWS3.showToast) {
            window.TWS3.showToast(msg, duration);
        }
    }

    function saveBlob(blob, fileName) {
        if (window.TWS3 && typeof window.TWS3.saveBlob === 'function') {
            return window.TWS3.saveBlob(blob, fileName);
        }
        const url = URL.createObjectURL(blob);
        const link = document.createElement('a');
        link.setAttribute('href', url);
        link.setAttribute('download', fileName);
        document.body.appendChild(link);
        link.click();
        setTimeout(() => {
            if (link.parentNode) document.body.removeChild(link);
            URL.revokeObjectURL(url);
        }, 1000);
    }

    function initDrawer() {
        const navDrawerBtn = document.getElementById('nav-drawer-btn');
        const drawer = document.getElementById('drawer');
        const drawerOverlay = document.getElementById('drawer-overlay');
        const drawerTaskSubtitle = document.getElementById('drawer-task-subtitle');
        const drawerTaskList = document.getElementById('drawer-task-list');
        const drawerSearchInput = document.getElementById('drawer-task-search-input');
        const drawerSearchClear = document.getElementById('drawer-task-search-clear');
        const drawerActionMenu = document.getElementById('drawer-task-action-menu');
        const drawerOpenSettingsBtn = document.getElementById('drawer-open-settings-btn');

        // 二级全屏设置界面节点
        const settingsView = document.getElementById('settings-view');
        const settingsBackBtn = document.getElementById('settings-back-btn');
        const settingsClassTitle = document.getElementById('settings-class-title');
        const settingsClassSubtitle = document.getElementById('settings-class-subtitle');
        const settingsCardHeader = settingsView ? settingsView.querySelector('.settings-card-header') : null;

        // 设置界面中的菜单项
        const switchClassBtn = document.getElementById('drawer-switch-class-btn');
        const manageRosterBtn = document.getElementById('drawer-manage-roster-btn');
        const importSeatBtn = document.getElementById('drawer-import-seat-btn');
        const exportSeatBtn = document.getElementById('drawer-export-seat-btn');
        const importXlsxBtn = document.getElementById('drawer-import-xlsx-btn');
        const exportXlsxBtn = document.getElementById('drawer-export-xlsx-btn');
        const importJsonBtn = document.getElementById('drawer-import-json-btn');
        const exportJsonBtn = document.getElementById('drawer-export-json-btn');
        const exportDataBtn = document.getElementById('drawer-export-data-btn');
        const resetRosterBtn = document.getElementById('drawer-reset-roster-btn');
        const studentNumberToggle = document.getElementById('drawer-student-number-toggle');
        const subjectTagToggle = document.getElementById('drawer-subject-tag-toggle');
        const toggleDebuggerBtn = document.getElementById('drawer-toggle-debugger-btn');

        // 班级弹窗
        const classModal = document.getElementById('class-modal');
        const classModalCloseBtn = document.getElementById('class-modal-close-btn');
        const classListBody = document.getElementById('class-list-body');

        // 花名册全屏界面
        const rosterView = document.getElementById('roster-view');
        const rosterBackBtn = document.getElementById('roster-back-btn');
        const rosterSearchInput = document.getElementById('roster-search-input');
        const rosterSearchClear = document.getElementById('roster-search-clear');
        const rosterAddBtn = document.getElementById('roster-add-btn');
        const rosterListBody = document.getElementById('roster-list-body');
        const rosterCountBadge = document.getElementById('roster-count-badge');
        // 文件上传 Input
        const xlsxFileInput = document.getElementById('xlsx-file-input');
        const seatXlsxFileInput = document.getElementById('seat-xlsx-file-input');
        const jsonFileInput = document.getElementById('json-file-input');

        // 差异比对弹窗
        const diffModal = document.getElementById('diff-modal');
        const diffSourceTag = document.getElementById('diff-source-tag');
        const diffSourceInfo = document.getElementById('diff-source-info');
        const diffHeaderDesc = document.getElementById('diff-header-desc');
        const diffMergePreview = document.getElementById('diff-merge-preview');
        const diffFilterTabs = document.getElementById('diff-filter-tabs');
        const diffSearchInput = document.getElementById('diff-search-input');
        const diffDetailsList = document.getElementById('diff-details-list');
        const diffLoadMore = document.getElementById('diff-load-more');
        const diffEmpty = document.getElementById('diff-empty');
        const diffBtnOverride = document.getElementById('diff-btn-override');
        const diffBtnMerge = document.getElementById('diff-btn-merge');
        const diffBtnCancel = document.getElementById('diff-btn-cancel');
        const diffModalBody = document.getElementById('diff-modal-body');

        let currentParsedImportData = null;
        let currentDiffResult = null;
        let currentDiffFilter = 'all';
        let diffVisibleCount = 40;

        let taskSearchQuery = '';
        let isArchivedGroupExpanded = null;
        let activeMenuTaskId = null;
        let activeMoreBtn = null;

        // =======================================================
        // 侧边抽屉控制与作业列表逻辑
        // =======================================================

        function toggleDrawer(open) {
            if (!drawer) return;
            const isShown = typeof open === 'boolean' ? open : !drawer.classList.contains('show');
            drawer.classList.toggle('show', isShown);
            if (drawerOverlay) drawerOverlay.classList.toggle('show', isShown);
            if (isShown) {
                closeAllActionMenus();
                if (drawerSearchInput) drawerSearchInput.value = '';
                taskSearchQuery = '';
                if (drawerSearchClear) drawerSearchClear.style.display = 'none';
                renderDrawerTaskList();
                renderDrawerHeader();
            } else {
                closeAllActionMenus();
            }
        }

        function renderDrawerHeader() {
            const state = store.getState();
            const currentClass = state.currentClass || '班级';
            const tasksCount = (state.tasks || []).length;
            if (drawerTaskSubtitle) {
                drawerTaskSubtitle.textContent = `${currentClass} · 共 ${tasksCount} 项作业`;
            }
        }

        function closeAllActionMenus() {
            activeMenuTaskId = null;
            if (activeMoreBtn) {
                activeMoreBtn.classList.remove('active');
                activeMoreBtn.setAttribute('aria-expanded', 'false');
                activeMoreBtn = null;
            }
            if (drawerActionMenu) drawerActionMenu.classList.remove('show');
        }

        function openActionMenu(task, btnElement) {
            if (!drawerActionMenu) return;
            const isSame = activeMenuTaskId === task.id && drawerActionMenu.classList.contains('show');
            closeAllActionMenus();
            if (isSame) return;

            activeMenuTaskId = task.id;
            activeMoreBtn = btnElement;

            const isArchived = !!task.archived;
            const state = store.getState();
            const canDelete = state.tasks.length > 1;

            const archiveText = drawerActionMenu.querySelector('.archive-action-text');
            if (archiveText) archiveText.textContent = isArchived ? '解除归档' : '归档';

            const deleteBtn = drawerActionMenu.querySelector('.delete-task-action');
            if (deleteBtn) {
                deleteBtn.classList.toggle('disabled', !canDelete);
                deleteBtn.disabled = !canDelete;
            }

            const drawerRect = drawer.getBoundingClientRect();
            const btnRect = btnElement.getBoundingClientRect();

            drawerActionMenu.style.visibility = 'hidden';
            drawerActionMenu.style.display = 'flex';
            const menuHeight = drawerActionMenu.offsetHeight || 130;
            drawerActionMenu.style.visibility = '';
            drawerActionMenu.style.display = '';

            const spaceBelow = drawerRect.bottom - btnRect.bottom;
            const spaceAbove = btnRect.top - drawerRect.top;

            let topOffset;
            if (spaceBelow < menuHeight + 8 && spaceAbove > menuHeight) {
                topOffset = btnRect.top - drawerRect.top - menuHeight - 4;
            } else {
                topOffset = btnRect.bottom - drawerRect.top + 4;
            }

            const rightOffset = drawerRect.right - btnRect.right;

            drawerActionMenu.style.top = `${Math.max(8, topOffset)}px`;
            drawerActionMenu.style.right = `${Math.max(10, rightOffset)}px`;
            drawerActionMenu.style.left = 'auto';
            drawerActionMenu.style.bottom = 'auto';
            drawerActionMenu.classList.add('show');
            btnElement.classList.add('active');
            btnElement.setAttribute('aria-expanded', 'true');
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
                    showToast(`已重命名为「${newName.trim()}」`);
                }
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
                    showToast(`已设置科目为「${newSub.trim()}」`);
                }
            }
        }

        async function handleDeleteTask(task) {
            const state = store.getState();
            const modal = window.TWS3.modal;
            if (state.tasks.length <= 1) {
                if (modal) modal.alert({ title: '无法删除', message: '至少需保留一个作业。' });
                else alert('至少需保留一个作业。');
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
                } else {
                    showToast(`已删除作业「${task.name}」`);
                }
            }
        }

        // 绑定 Action Menu 按钮操作
        if (drawerActionMenu) {
            drawerActionMenu.querySelector('.edit-task-action')?.addEventListener('click', (e) => {
                e.stopPropagation();
                const taskId = activeMenuTaskId;
                closeAllActionMenus();
                if (taskId) {
                    const targetTask = store.getState().tasks.find(t => t.id === taskId);
                    if (targetTask) handleRenameTask(targetTask);
                }
            });

            drawerActionMenu.querySelector('.set-subject-action')?.addEventListener('click', (e) => {
                e.stopPropagation();
                const taskId = activeMenuTaskId;
                closeAllActionMenus();
                if (taskId) {
                    const targetTask = store.getState().tasks.find(t => t.id === taskId);
                    if (targetTask) handleSetSubject(targetTask);
                }
            });

            drawerActionMenu.querySelector('.archive-task-action')?.addEventListener('click', (e) => {
                e.stopPropagation();
                const taskId = activeMenuTaskId;
                closeAllActionMenus();
                if (taskId) {
                    const targetTask = store.getState().tasks.find(t => t.id === taskId);
                    store.toggleArchiveTask(taskId);
                    if (targetTask) {
                        showToast(targetTask.archived ? '已归档' : '已解除归档');
                    }
                }
            });

            drawerActionMenu.querySelector('.delete-task-action')?.addEventListener('click', (e) => {
                e.stopPropagation();
                const taskId = activeMenuTaskId;
                closeAllActionMenus();
                if (taskId) {
                    const targetTask = store.getState().tasks.find(t => t.id === taskId);
                    if (targetTask) handleDeleteTask(targetTask);
                }
            });
        }

        function createDrawerTaskItemElement(task, state) {
            const isCurrent = task.id === state.currentTaskId;
            const isArchived = !!task.archived;
            const item = document.createElement('div');
            item.className = `task-item ${isCurrent ? 'active' : ''} ${isArchived ? 'archived' : ''}`;
            item.dataset.taskId = task.id;
            const subject = task.subject || '未设置';
            const isEnglish = subject === '英语';
            const subjectBadgeClass = isEnglish ? 'task-chip chip-english' : 'task-chip chip-subject';
            const showSubject = store.getShowSubjectTags();

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
                    ${showSubject ? `
                    <button type="button" class="${subjectBadgeClass}" title="点击修改科目" aria-label="科目：${escapeHtml(subject)}">
                        <span>${escapeHtml(subject)}</span>
                    </button>` : ''}
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
                toggleDrawer(false);
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

        function renderDrawerTaskList() {
            if (!drawerTaskList) return;
            const state = store.getState();
            const fragment = document.createDocumentFragment();

            let allTasks = state.tasks || [];

            // 搜索过滤
            if (taskSearchQuery) {
                allTasks = allTasks.filter(t => {
                    const nameMatch = (t.name || '').toLowerCase().includes(taskSearchQuery);
                    const subjectMatch = (t.subject || '').toLowerCase().includes(taskSearchQuery);
                    return nameMatch || subjectMatch;
                });
            }

            if (allTasks.length === 0) {
                const emptyEl = document.createElement('div');
                emptyEl.className = 'task-empty-state';
                emptyEl.innerHTML = `<span>未找到匹配的作业</span>`;
                fragment.appendChild(emptyEl);
                drawerTaskList.innerHTML = '';
                drawerTaskList.appendChild(fragment);
                return;
            }

            const ongoingTasks = allTasks.filter(t => !t.archived);
            const archivedTasks = allTasks.filter(t => !!t.archived);

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
                    ongoingGroup.appendChild(createDrawerTaskItemElement(task, state));
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
                    renderDrawerTaskList();
                });

                fragment.appendChild(archivedHeader);

                if (shouldExpandArchived) {
                    const archivedGroup = document.createElement('div');
                    archivedGroup.className = 'task-group-list archived-list';
                    archivedTasks.forEach(task => {
                        archivedGroup.appendChild(createDrawerTaskItemElement(task, state));
                    });
                    fragment.appendChild(archivedGroup);
                }
            }

            drawerTaskList.innerHTML = '';
            drawerTaskList.appendChild(fragment);
        }

        // 搜索事件监听
        if (drawerSearchInput) {
            drawerSearchInput.addEventListener('input', (e) => {
                taskSearchQuery = e.target.value.trim().toLowerCase();
                if (drawerSearchClear) {
                    drawerSearchClear.style.display = taskSearchQuery ? 'flex' : 'none';
                }
                renderDrawerTaskList();
            });
        }

        if (drawerSearchClear) {
            drawerSearchClear.addEventListener('click', (e) => {
                e.stopPropagation();
                if (drawerSearchInput) {
                    drawerSearchInput.value = '';
                    taskSearchQuery = '';
                    drawerSearchClear.style.display = 'none';
                    drawerSearchInput.focus();
                }
                renderDrawerTaskList();
            });
        }

        if (navDrawerBtn) {
            navDrawerBtn.addEventListener('click', () => toggleDrawer(true));
        }

        if (drawerOverlay) {
            drawerOverlay.addEventListener('click', (e) => {
                e.stopPropagation();
                toggleDrawer(false);
            });
        }

        const drawerScrollArea = drawer ? drawer.querySelector('.drawer-scroll-area') : null;
        if (drawerScrollArea) {
            drawerScrollArea.addEventListener('scroll', closeAllActionMenus, { passive: true });
        }

        document.addEventListener('click', (e) => {
            if (drawerActionMenu && !drawerActionMenu.contains(e.target) && !e.target.closest('.task-more-btn')) {
                closeAllActionMenus();
            }
        });

        // =======================================================
        // 二级全屏界面 (数据管理与设置) 控制逻辑
        // =======================================================

        function openSettingsView() {
            toggleDrawer(false);
            renderSettingsHeader();
            renderStudentNumberToggle();
            renderSubjectTagToggle();
            renderDebuggerToggle();
            if (settingsView) {
                settingsView.classList.add('show');
                const scrollArea = settingsView.querySelector('.settings-scroll-area');
                if (scrollArea) scrollArea.scrollTop = 0;
            }
        }
        function closeSettingsView() {
            if (settingsView) settingsView.classList.remove('show');
        }

        function isSettingsViewOpen() {
            return !!(settingsView && settingsView.classList.contains('show'));
        }

        if (drawerOpenSettingsBtn) {
            drawerOpenSettingsBtn.addEventListener('click', () => {
                openSettingsView();
            });
        }

        if (settingsBackBtn) {
            settingsBackBtn.addEventListener('click', () => {
                closeSettingsView();
            });
        }

        function renderSettingsHeader() {
            const state = store.getState();
            if (settingsClassTitle) settingsClassTitle.textContent = state.currentClass || '班级';
            if (settingsClassSubtitle) settingsClassSubtitle.textContent = `在籍学生：${(state.students || []).length} 人`;
        }

        function renderStudentNumberToggle() {
            if (!studentNumberToggle) return;
            const isVisible = store.getShowStudentNumbers();
            studentNumberToggle.classList.toggle('active', isVisible);
            studentNumberToggle.setAttribute('aria-pressed', String(isVisible));
        }

        function renderSubjectTagToggle() {
            if (!subjectTagToggle) return;
            const isVisible = store.getShowSubjectTags();
            subjectTagToggle.classList.toggle('active', isVisible);
            subjectTagToggle.setAttribute('aria-pressed', String(isVisible));
        }
        function renderDebuggerToggle() {
            if (!toggleDebuggerBtn) return;
            const isVisible = window.TWS3.logger && typeof window.TWS3.logger.isFloatingBtnVisible === 'function'
                ? window.TWS3.logger.isFloatingBtnVisible()
                : (localStorage.getItem('tws3_debug_btn_visible') === 'true');
            toggleDebuggerBtn.classList.toggle('active', isVisible);
            toggleDebuggerBtn.setAttribute('aria-pressed', String(isVisible));
        }

        if (studentNumberToggle) {
            studentNumberToggle.addEventListener('click', () => {
                store.setShowStudentNumbers(!store.getShowStudentNumbers());
            });
        }

        if (subjectTagToggle) {
            subjectTagToggle.addEventListener('click', () => {
                store.setShowSubjectTags(!store.getShowSubjectTags());
            });
        }

        // 1. 切换班级
        function openClassModal() {
            renderClassList();
            if (classModal) classModal.classList.add('show');
        }

        function closeClassModal() {
            if (classModal) classModal.classList.remove('show');
        }

        function renderClassList() {
            if (!classListBody) return;
            const classes = store.getClasses();
            const currentClassId = store.getCurrentClassId();

            classListBody.innerHTML = '';
            const frag = document.createDocumentFragment();

            classes.forEach(c => {
                const item = document.createElement('div');
                const isCurrent = c.id === currentClassId;
                item.className = `class-card-item ${isCurrent ? 'active' : ''}`;
                item.dataset.id = c.id;

                item.innerHTML = `
                    <div class="class-card-left">
                        <div class="class-card-header-row">
                            <span class="class-card-name">${escapeHtml(c.name)}</span>
                            ${isCurrent ? '<span class="class-active-badge">当前班级</span>' : ''}
                        </div>
                        <div class="class-card-meta">
                            <div class="class-card-meta-line">在籍学生：${c.studentCount} 人</div>
                            <div class="class-card-meta-line">作业任务：${c.taskCount} 项</div>
                        </div>
                    </div>
                    <div class="class-card-actions">
                        <button type="button" class="class-rename-btn" data-id="${c.id}" title="重命名班级">
                            <svg viewBox="0 0 24 24" width="13" height="13" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
                                <path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7"></path>
                                <path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z"></path>
                            </svg>
                            <span>重命名</span>
                        </button>
                    </div>
                `;

                frag.appendChild(item);
            });

            classListBody.appendChild(frag);
        }

        if (switchClassBtn) {
            switchClassBtn.addEventListener('click', () => {
                openClassModal();
            });
        }

        if (settingsCardHeader) {
            settingsCardHeader.style.cursor = 'pointer';
            settingsCardHeader.title = '点击切换班级';
            settingsCardHeader.addEventListener('click', () => {
                openClassModal();
            });
        }

        if (classModalCloseBtn) {
            classModalCloseBtn.addEventListener('click', closeClassModal);
        }

        if (classModal) {
            classModal.addEventListener('click', (e) => {
                if (e.target === classModal) {
                    closeClassModal();
                }
            });
        }

        if (classListBody) {
            classListBody.addEventListener('click', async (e) => {
                const renameBtn = e.target.closest('.class-rename-btn');
                if (renameBtn) {
                    e.stopPropagation();
                    const classId = renameBtn.dataset.id;
                    const classes = store.getClasses();
                    const targetCls = classes.find(c => c.id === classId);
                    if (!targetCls) return;
                    const modal = window.TWS3.modal;
                    const newName = modal
                        ? await modal.prompt({
                            title: '重命名班级',
                            placeholder: '班级名称',
                            defaultValue: targetCls.name
                        })
                        : prompt('班级名称：', targetCls.name);
                    if (newName && newName.trim() && newName.trim() !== targetCls.name) {
                        store.renameClass(classId, newName.trim());
                        renderClassList();
                        renderSettingsHeader();
                        renderDrawerHeader();
                        showToast(`已重命名为 ${newName.trim()}`);
                    }
                    return;
                }

                const cardItem = e.target.closest('.class-card-item');
                if (cardItem) {
                    const classId = cardItem.dataset.id;
                    if (classId !== store.getCurrentClassId()) {
                        closeClassModal();
                        setTimeout(() => {
                            const target = store.switchClass(classId);
                            if (target) {
                                showToast(`已切换至 ${target.name}`);
                            }
                        }, 160);
                    } else {
                        closeClassModal();
                    }
                }
            });
        }

        // 2. 导入导出座位表
        if (importSeatBtn) {
            importSeatBtn.addEventListener('click', () => {
                if (!seatXlsxFileInput) return;
                seatXlsxFileInput.value = '';
                seatXlsxFileInput.click();
            });
        }

        if (seatXlsxFileInput) {
            seatXlsxFileInput.addEventListener('change', async event => {
                const file = event.target.files && event.target.files[0];
                if (!file) return;
                const seatWorkbook = window.TWS3.seatWorkbook;
                if (!seatWorkbook) {
                    showToast('座位表模块未准备就绪');
                    return;
                }
                try {
                    const state = store.getState();
                    const result = await seatWorkbook.parseSeatWorkbook(await file.arrayBuffer(), state.students);
                    store.setSeatLayout(result.layout, result.groupNames);
                    store.setSeatPodiumPosition('bottom');
                    store.setViewMode('seat');
                    const unmatchedText = result.unmatched.length ? `，${result.unmatched.length} 个座位未匹配` : '';
                    showToast(`已导入 ${result.matchedCount} 个座位${unmatchedText}`, 3200);
                    closeSettingsView();
                } catch (error) {
                    console.error('座位表导入失败:', error);
                    const modal = window.TWS3.modal;
                    if (modal) modal.alert({ title: '导入失败', message: error.message || '无法读取座位表文件' });
                    else alert(`导入失败：${error.message || '无法读取座位表文件'}`);
                } finally {
                    seatXlsxFileInput.value = '';
                }
            });
        }

        if (exportSeatBtn) {
            exportSeatBtn.addEventListener('click', async () => {
                const seatWorkbook = window.TWS3.seatWorkbook;
                if (!seatWorkbook) {
                    showToast('座位表模块未准备就绪');
                    return;
                }
                try {
                    const { blob, fileName } = await seatWorkbook.exportSeatWorkbook(store);
                    saveBlob(blob, fileName);
                    showToast('座位表已导出');
                } catch (error) {
                    console.error('座位表导出失败:', error);
                    const modal = window.TWS3.modal;
                    if (modal) modal.alert({ title: '导出失败', message: error.message || '无法生成座位表文件' });
                    else alert(`导出失败：${error.message || '无法生成座位表文件'}`);
                }
            });
        }

        // 3. 导出标准记分册 (.xlsx)
        if (exportXlsxBtn) {
            exportXlsxBtn.addEventListener('click', async () => {
                const state = store.getState();
                const workbook = window.TWS3.workbook;
                if (!workbook) {
                    showToast('记分册模块未准备就绪');
                    return;
                }

                const defaultTitle = workbook.getDefaultExportTitle(state.currentClass, state.students.length);
                const modal = window.TWS3.modal;

                const confirmedTitle = modal
                    ? await modal.prompt({
                        title: '导出记分册',
                        placeholder: '表格大标题',
                        defaultValue: defaultTitle,
                        confirmText: '导出'
                    })
                    : prompt('表格大标题：', defaultTitle);

                if (confirmedTitle === null) return;

                try {
                    const { blob, fileName } = await workbook.exportWorkbook({
                        title: confirmedTitle.trim() || defaultTitle,
                        storeInstance: store
                    });

                    saveBlob(blob, fileName);
                    showToast('记分册已导出');
                } catch (err) {
                    console.error('导出失败:', err);
                    if (modal) {
                        modal.alert({ title: '导出失败', message: err.message || '生成文件发生异常' });
                    } else {
                        alert(`导出失败: ${err.message}`);
                    }
                }
            });
        }

        // 4. 差异比对弹窗与导入
        function formatDiffTime(value) {
            if (!value) return '时间未知';
            const date = new Date(value);
            if (Number.isNaN(date.getTime())) return String(value);
            return date.toLocaleString('zh-CN', { year: 'numeric', month: '2-digit', day: '2-digit', hour: '2-digit', minute: '2-digit' });
        }

        function sideDisplay(side, isImported) {
            if (!side.exists) return isImported ? '文件中不存在' : '本地不存在';
            if (side.display !== undefined && side.display !== null && side.display !== '') return side.display;
            return '空白';
        }

        function rawDisplay(side) {
            if (!side.exists && (side.rawValue === null || side.rawValue === undefined)) return '';
            const raw = side.rawValue === null || side.rawValue === undefined || side.rawValue === '' ? '空白' : side.rawValue;
            return `原值“${raw}”`;
        }

        function getDiffTitle(item) {
            const context = item.context || {};
            if (context.entity === 'table') return `${context.tableName || '表格'} · ${context.fieldName || '配置'}`;
            if (context.entity === 'record') return `${context.taskName || '未知任务'} · ${context.studentNo || ''} · ${context.studentName || ''}`;
            if (context.entity === 'student') return `${context.studentNo || ''} · ${context.studentName || ''}`;
            if (context.entity === 'task') return context.taskName || '未知任务';
            if (context.entity === 'class') return context.className || '班级';
            return context.fieldName || '差异';
        }

        function getOperationLabel(operation) {
            return { add: '新增', modify: '修改', clear: '清空', delete: '删除', 'local-only': '仅本地', 'file-only': '仅文件' }[operation] || operation;
        }

        function isDeleteItem(item) {
            return item.category === 'delete' || item.operation === 'local-only';
        }

        function getFilteredDiffItems() {
            if (!currentDiffResult) return [];
            const query = (diffSearchInput && diffSearchInput.value || '').trim().toLowerCase();
            return currentDiffResult.items.filter(item => {
                const matchesFilter = currentDiffFilter === 'all'
                    || (currentDiffFilter === 'conflict' && item.conflict)
                    || (currentDiffFilter === 'delete' && isDeleteItem(item))
                    || item.category === currentDiffFilter;
                const matchesSearch = !query || String(item.searchText || '').includes(query);
                return matchesFilter && matchesSearch;
            });
        }

        function updateDiffFilterCounts() {
            if (!diffFilterTabs || !currentDiffResult) return;
            const items = currentDiffResult.items;
            const counts = {
                all: items.length,
                conflict: items.filter(item => item.conflict).length,
                class: items.filter(item => item.category === 'class').length,
                student: items.filter(item => item.category === 'student').length,
                task: items.filter(item => item.category === 'task').length,
                record: items.filter(item => item.category === 'record').length,
                table: items.filter(item => item.category === 'table').length,
                delete: items.filter(isDeleteItem).length
            };
            diffFilterTabs.querySelectorAll('.diff-filter-btn').forEach(button => {
                const count = counts[button.dataset.filter] || 0;
                const countEl = button.querySelector('span');
                if (countEl) countEl.textContent = count;
                button.classList.toggle('active', button.dataset.filter === currentDiffFilter);
            });
        }

        function renderDiffCard(item) {
            const local = item.local || {};
            const imported = item.imported || {};
            const resolution = item.resolution || {};
            const resultLabel = resolution.choice === 'file' ? '采用文件' : '保留本地';
            const operationClass = item.operation === 'modify' ? '' : item.operation;
            const badge = item.conflict ? '<span class="diff-card-badge">同时间冲突</span>' : '';
            const localRaw = rawDisplay(local);
            const importedRaw = rawDisplay(imported);
            const changedFields = item.context && item.context.changedFields && item.context.changedFields.length
                ? `，字段：${item.context.changedFields.join('、')}`
                : '';
            return `<article class="diff-card">
                <div class="diff-card-head">
                    <div class="diff-card-title">${escapeHtml(getDiffTitle(item))}<div class="diff-side-time">${escapeHtml(item.context && item.context.fieldName || '')}${escapeHtml(changedFields)}</div></div>
                    <div class="diff-card-meta">${badge}<span class="diff-operation-badge ${escapeHtml(operationClass)}">${escapeHtml(getOperationLabel(item.operation))}</span></div>
                </div>
                <div class="diff-sides">
                    <div class="diff-side">
                        <div class="diff-side-label">本地数据</div>
                        <div class="diff-side-value ${local.exists ? '' : 'missing'}">${escapeHtml(sideDisplay(local, false))}</div>
                        ${localRaw ? `<div class="diff-side-raw"><strong>原始值</strong> ${escapeHtml(localRaw)}</div>` : ''}
                        <div class="diff-side-time">修改时间：${escapeHtml(formatDiffTime(local.updatedAt))}</div>
                    </div>
                    <div class="diff-side imported">
                        <div class="diff-side-label">导入文件</div>
                        <div class="diff-side-value ${imported.exists ? '' : 'missing'}">${escapeHtml(sideDisplay(imported, true))}</div>
                        ${importedRaw ? `<div class="diff-side-raw"><strong>Excel 原始值</strong> ${escapeHtml(importedRaw)}</div>` : ''}
                        <div class="diff-side-time">修改时间：${escapeHtml(formatDiffTime(imported.updatedAt))}</div>
                    </div>
                </div>
                <div class="diff-result"><span class="diff-result-label">智能合并预计结果</span><span class="diff-result-value">${escapeHtml(resultLabel)}</span><span class="diff-result-reason">${escapeHtml(item.reason || resolution.reason || '')}</span></div>
            </article>`;
        }

        function renderDiffItems() {
            const items = getFilteredDiffItems();
            const visibleItems = items.slice(0, diffVisibleCount);
            if (diffDetailsList) diffDetailsList.innerHTML = visibleItems.map(renderDiffCard).join('');
            if (diffEmpty) diffEmpty.style.display = items.length === 0 ? 'block' : 'none';
            if (diffLoadMore) diffLoadMore.style.display = items.length > visibleItems.length ? 'block' : 'none';
        }

        function renderDiffViewer() {
            if (!currentDiffResult) return;
            const source = currentDiffResult.sourceInfo || {};
            const preview = currentDiffResult.mergePreview || {};
            if (diffSourceTag) {
                diffSourceTag.textContent = source.label || '普通模板';
                diffSourceTag.style.display = 'inline-block';
            }
            if (diffSourceInfo) {
                const fileInfo = source.fileName || '导入文件';
                const mtime = source.fileMtime ? `文件修改：${formatDiffTime(source.fileMtime)}` : '';
                const backupTime = source.backupExportedAt ? `备份导出：${formatDiffTime(source.backupExportedAt)}` : '';
                diffSourceInfo.textContent = [fileInfo, mtime, backupTime].filter(Boolean).join('　·　');
            }
            if (diffMergePreview) {
                diffMergePreview.innerHTML = `
                    <div class="diff-preview-card file"><div class="diff-preview-num">${preview.adoptFile || 0}</div><div class="diff-preview-label">预计采用文件</div></div>
                    <div class="diff-preview-card local"><div class="diff-preview-num">${preview.keepLocal || 0}</div><div class="diff-preview-label">预计保留本地</div></div>
                    <div class="diff-preview-card conflict"><div class="diff-preview-num">${preview.conflicts || 0}</div><div class="diff-preview-label">同时间冲突</div></div>`;
            }
            if (diffHeaderDesc) {
                diffHeaderDesc.textContent = `共 ${currentDiffResult.summary.total} 条差异，按字段修改时间预览合并结果。`;
            }
            updateDiffFilterCounts();
            renderDiffItems();
        }

        function openDiffModal(diffResult, parsedData) {
            currentParsedImportData = parsedData;
            currentDiffResult = diffResult;
            currentDiffFilter = 'all';
            diffVisibleCount = 40;
            if (diffSearchInput) diffSearchInput.value = '';
            renderDiffViewer();
            if (diffModal) diffModal.classList.add('show');
        }

        function closeDiffModal() {
            if (diffModal) {
                diffModal.classList.remove('show');
            }
            currentParsedImportData = null;
            currentDiffResult = null;
            currentDiffFilter = 'all';
            diffVisibleCount = 40;
            if (xlsxFileInput) {
                xlsxFileInput.value = '';
            }
        }

        if (diffFilterTabs) {
            diffFilterTabs.addEventListener('click', (event) => {
                const button = event.target.closest('.diff-filter-btn');
                if (!button) return;
                currentDiffFilter = button.dataset.filter || 'all';
                diffVisibleCount = 40;
                updateDiffFilterCounts();
                renderDiffItems();
            });
        }

        if (diffSearchInput) {
            diffSearchInput.addEventListener('input', () => {
                diffVisibleCount = 40;
                renderDiffItems();
            });
        }

        if (diffModalBody) {
            diffModalBody.addEventListener('scroll', () => {
                if (diffModalBody.scrollTop + diffModalBody.clientHeight >= diffModalBody.scrollHeight - 80) {
                    const filteredItems = getFilteredDiffItems();
                    if (diffVisibleCount < filteredItems.length) {
                        diffVisibleCount += 40;
                        renderDiffItems();
                    }
                }
            });
        }

        if (importXlsxBtn) {
            importXlsxBtn.addEventListener('click', () => {
                if (xlsxFileInput) {
                    xlsxFileInput.value = '';
                    xlsxFileInput.click();
                }
            });
        }

        if (xlsxFileInput) {
            xlsxFileInput.addEventListener('change', async (e) => {
                const file = e.target.files && e.target.files[0];
                if (!file) return;

                const modal = window.TWS3.modal;
                const workbook = window.TWS3.workbook;
                if (!workbook) {
                    showToast('记分册模块未准备就绪');
                    return;
                }

                try {
                    const arrayBuffer = await file.arrayBuffer();
                    const fileMtimeIso = file.lastModified ? new Date(file.lastModified).toISOString() : new Date().toISOString();

                    const parsedResult = await workbook.parseWorkbook(arrayBuffer, fileMtimeIso);
                    parsedResult.fileName = file.name;
                    const diffResult = store.diff(parsedResult);

                    if (!diffResult.hasDifference) {
                        showToast('数据与备份一致');
                        xlsxFileInput.value = '';
                        return;
                    }

                    openDiffModal(diffResult, parsedResult);
                } catch (err) {
                    console.error('解析记分册失败:', err);
                    if (modal) {
                        modal.alert({ title: '导入失败', message: err.message || '文件格式不符合规范' });
                    } else {
                        alert(`导入失败: ${err.message}`);
                    }
                    xlsxFileInput.value = '';
                }
            });
        }

        // 5. 导入 JSON 备份
        if (importJsonBtn) {
            importJsonBtn.addEventListener('click', () => {
                if (jsonFileInput) {
                    jsonFileInput.value = '';
                    jsonFileInput.click();
                }
            });
        }

        if (jsonFileInput) {
            jsonFileInput.addEventListener('change', async (e) => {
                const file = e.target.files && e.target.files[0];
                if (!file) return;

                const modal = window.TWS3.modal;
                try {
                    const text = await file.text();
                    const parsed = JSON.parse(text);
                    const stateData = parsed.state || parsed;

                    if (!stateData || !Array.isArray(stateData.students) || !Array.isArray(stateData.tasks) || !stateData.records) {
                        throw new Error('JSON 备份缺少关键数据结构（students/tasks/records）');
                    }

                    const parsedResult = {
                        state: stateData,
                        metadata: parsed.metadata || {},
                        sourceType: 'json_backup',
                        hasBackup: true,
                        fileName: file.name,
                        tasks: stateData.tasks || [],
                        students: stateData.students || [],
                        records: stateData.records || {}
                    };

                    const diffResult = store.diff(parsedResult);
                    if (!diffResult.hasDifference) {
                        showToast('数据与备份一致');
                        jsonFileInput.value = '';
                        return;
                    }

                    openDiffModal(diffResult, parsedResult);
                } catch (err) {
                    console.error('解析 JSON 备份失败:', err);
                    if (modal) {
                        modal.alert({ title: '导入失败', message: err.message || 'JSON 格式不符合规范' });
                    } else {
                        alert(`导入失败: ${err.message}`);
                    }
                }
                jsonFileInput.value = '';
            });
        }

        function getOverrideRemovalSummary() {
            const items = currentDiffResult ? currentDiffResult.items : [];
            const students = items.filter(item => (item.category === 'student' && item.operation === 'local-only') || (item.category === 'delete' && item.context && item.context.entity === 'student')).length;
            const tasks = items.filter(item => (item.category === 'task' && item.operation === 'local-only') || (item.category === 'delete' && item.context && item.context.entity === 'task')).length;
            const records = items.filter(item => {
                if (item.category !== 'record' || !item.local || !item.local.exists) return false;
                const value = item.local.value || {};
                return value.status !== 'white' || value.badge || value.score !== null && value.score !== undefined || value.note;
            }).length;
            return { students, tasks, records };
        }

        if (diffBtnOverride) {
            diffBtnOverride.addEventListener('click', async () => {
                if (!currentParsedImportData) return;
                const removal = getOverrideRemovalSummary();
                const message = `覆盖将清除本地独有：${removal.students} 名学生、${removal.tasks} 个任务、${removal.records} 条记录。确定覆盖？`;
                const modal = window.TWS3.modal;
                if (diffModal) diffModal.classList.remove('show');
                const confirmed = modal
                    ? await modal.confirm({ title: '覆盖本地数据', message, confirmText: '覆盖', danger: true })
                    : window.confirm(message);
                if (!confirmed) {
                    if (diffModal) diffModal.classList.add('show');
                    return;
                }
                try {
                    store.overrideWith(currentParsedImportData);
                    showToast('数据已覆盖导入');
                } catch (e) {
                    showToast(`覆盖失败: ${e.message}`);
                }
                closeDiffModal();
            });
        }

        if (diffBtnMerge) {
            diffBtnMerge.addEventListener('click', async () => {
                if (!currentParsedImportData) return;
                const preview = currentDiffResult && currentDiffResult.mergePreview || {};
                const mergeMessage = `采用文件 ${preview.adoptFile || 0} 条，保留本地 ${preview.keepLocal || 0} 条，冲突 ${preview.conflicts || 0} 条。确定合并？`;
                const modal = window.TWS3.modal;
                if (diffModal) diffModal.classList.remove('show');
                const confirmed = modal
                    ? await modal.confirm({ title: '智能合并', message: mergeMessage, confirmText: '合并' })
                    : window.confirm(mergeMessage);
                if (!confirmed) {
                    if (diffModal) diffModal.classList.add('show');
                    return;
                }
                try {
                    const res = store.smartMerge(currentParsedImportData);
                    if (res.conflictCount > 0) {
                        showToast(`合并完成（保留 ${res.conflictCount} 处冲突）`);
                    } else {
                        showToast('数据合并完成');
                    }
                } catch (e) {
                    showToast(`合并失败: ${e.message}`);
                }
                closeDiffModal();
            });
        }

        if (diffBtnCancel) {
            diffBtnCancel.addEventListener('click', () => {
                closeDiffModal();
                showToast('已取消导入');
            });
        }

        // 6. 导出 JSON 备份
        if (exportJsonBtn) {
            exportJsonBtn.addEventListener('click', () => {
                const state = store.getState();
                const snapshot = store.exportStateSnapshot();
                const jsonStr = JSON.stringify(snapshot, null, 2);

                const now = new Date();
                const pad = n => String(n).padStart(2, '0');
                const dateStamp = `${now.getFullYear()}${pad(now.getMonth() + 1)}${pad(now.getDate())}_${pad(now.getHours())}${pad(now.getMinutes())}`;
                const fileName = `${state.currentClass}_作业提交备份_${dateStamp}.json`;

                const blob = new Blob([jsonStr], { type: 'application/json;charset=utf-8;' });
                saveBlob(blob, fileName);

                showToast('JSON 备份已导出');
            });
        }

        // 7. 导出 CSV 报表
        if (exportDataBtn) {
            exportDataBtn.addEventListener('click', () => {
                const state = store.getState();
                const tasks = [...state.tasks].sort((a, b) => {
                    const ta = a.createdAt || a.id;
                    const tb = b.createdAt || b.id;
                    return ta.localeCompare(tb);
                });

                function formatCellContent(record, isExempt) {
                    if (!record) return isExempt ? '免交' : '';
                    const { status, badge } = record;
                    if (badge && String(badge).trim()) {
                        const badgeStr = String(badge).trim();
                        const scoreMatch = badgeStr.match(/^(\d+(?:\.\d+)?)分?$/);
                        if (scoreMatch) return scoreMatch[1];
                        return badgeStr;
                    }
                    if (status === 'dark') return '√';
                    if (isExempt) return '免交';
                    if (status === 'muted') return '/';
                    return '';
                }

                function escapeCsvCell(val) {
                    if (val === null || val === undefined) return '';
                    const str = String(val);
                    if (str.includes(',') || str.includes('"') || str.includes('\n') || str.includes('\r')) {
                        return `"${str.replace(/"/g, '""')}"`;
                    }
                    return str;
                }

                const titleText = `${state.currentClass}学生作业提交名单${state.students.length}人`;
                const titleRow = [escapeCsvCell(titleText), ...Array(tasks.length + 1).fill('')].join(',');
                const headerRow = ['学号', '姓名', ...tasks.map(t => escapeCsvCell(t.name))].join(',');

                const dataRows = state.students.map(student => {
                    const row = [
                        student.studentNo || student.id,
                        escapeCsvCell(student.name),
                        ...tasks.map(t => {
                            const rec = (state.records[t.id] && state.records[t.id][student.id]) || null;
                            const isExempt = store.isEnglishTask(t) && student.isNonEnglish && (!rec || rec.status === 'muted');
                            return escapeCsvCell(formatCellContent(rec, isExempt));
                        })
                    ];
                    return row.join(',');
                });

                const csvContent = `\uFEFF${[titleRow, headerRow, ...dataRows].join('\n')}`;
                const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
                saveBlob(blob, `${state.currentClass}_学生作业提交汇总表.csv`);

                showToast('CSV 报表已导出');
            });
        }

        // 8. 重置全员状态
        if (resetRosterBtn) {
            resetRosterBtn.addEventListener('click', async () => {
                const currentTask = store.getCurrentTask();
                const modal = window.TWS3.modal;
                if (currentTask && currentTask.archived) {
                    if (modal) {
                        modal.alert({
                            title: '无法重置',
                            message: `当前作业「${currentTask.name}」已归档，请先解除归档。`
                        });
                    }
                    return;
                }

                const confirmed = modal
                    ? await modal.confirm({
                        title: '重置当前作业',
                        message: `确定清空「${currentTask ? currentTask.name : '当前作业'}」全员提交与打分？此操作不可撤销。`,
                        confirmText: '重置',
                        danger: true
                    })
                    : confirm(`确定重置「${currentTask ? currentTask.name : '当前作业'}」全员状态？`);

                if (confirmed) {
                    store.resetCurrentTaskRoster();
                    showToast('当前作业状态已重置');
                }
            });
        }

        // 9. 花名册全屏界面管理
        function openRosterView() {
            if (rosterSearchInput) rosterSearchInput.value = '';
            if (rosterSearchClear) rosterSearchClear.style.display = 'none';
            renderRosterList();
            if (rosterView) {
                rosterView.classList.add('show');
                if (window.TWS3.pushGuardState) {
                    window.TWS3.pushGuardState();
                }
            }
        }

        function closeRosterView() {
            if (rosterView) {
                rosterView.classList.remove('show');
            }
        }

        function isRosterViewOpen() {
            return !!(rosterView && rosterView.classList.contains('show'));
        }

        function renderRosterList() {
            if (!rosterListBody) return;
            const state = store.getState();
            const students = state.students || [];
            const rawQuery = rosterSearchInput ? rosterSearchInput.value.trim() : '';
            const query = rawQuery.toLowerCase();

            if (rosterSearchClear) {
                rosterSearchClear.style.display = rawQuery ? 'flex' : 'none';
            }

            const filtered = students.filter(s => {
                if (!query) return true;
                return String(s.name || '').toLowerCase().includes(query) ||
                       String(s.studentNo || s.id).toLowerCase().includes(query);
            });

            if (rosterCountBadge) {
                rosterCountBadge.textContent = `${students.length} 人`;
            }

            if (filtered.length === 0) {
                rosterListBody.innerHTML = `<div class="roster-empty">未找到匹配的学生</div>`;
                return;
            }

            rosterListBody.innerHTML = '';
            const frag = document.createDocumentFragment();

            filtered.forEach(s => {
                const item = document.createElement('div');
                item.className = 'roster-student-item';
                const isNonEng = !!s.isNonEnglish;
                const langTagClass = isNonEng ? 'roster-lang-tag non-english' : 'roster-lang-tag';
                const langTagText = isNonEng ? '非英语生' : '英语生';

                item.innerHTML = `
                    <div class="roster-student-main">
                        <span class="roster-student-no">${escapeHtml(s.studentNo || s.id)}</span>
                        <span class="roster-student-name" title="${escapeHtml(s.name)}">${escapeHtml(s.name)}</span>
                    </div>
                    <div class="roster-student-actions">
                        <span class="${langTagClass}" data-id="${s.id}" title="点击切换是否为英语生">${langTagText}</span>
                        <button type="button" class="roster-icon-btn edit-name" data-id="${s.id}" title="修改姓名">
                            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
                                <path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7"></path>
                                <path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z"></path>
                            </svg>
                        </button>
                        <button type="button" class="roster-icon-btn delete" data-id="${s.id}" title="删除学生">
                            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
                                <path d="M3 6h18M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2"></path>
                            </svg>
                        </button>
                    </div>
                `;
                frag.appendChild(item);
            });

            rosterListBody.appendChild(frag);
        }

        if (manageRosterBtn) {
            manageRosterBtn.addEventListener('click', () => {
                openRosterView();
            });
        }

        if (rosterBackBtn) {
            rosterBackBtn.addEventListener('click', closeRosterView);
        }

        if (rosterSearchClear) {
            rosterSearchClear.addEventListener('click', () => {
                if (rosterSearchInput) {
                    rosterSearchInput.value = '';
                    rosterSearchInput.focus();
                }
                renderRosterList();
            });
        }

        if (rosterSearchInput) {
            rosterSearchInput.addEventListener('input', () => {
                renderRosterList();
            });
        }

        if (rosterAddBtn) {
            rosterAddBtn.addEventListener('click', async () => {
                const modal = window.TWS3.modal;
                if (modal) {
                    const name = await modal.prompt({
                        title: '添加新学生',
                        placeholder: '请输入学生姓名'
                    });
                    if (name && name.trim()) {
                        const student = store.addStudent({ name: name.trim() });
                        if (student) {
                            renderRosterList();
                            renderSettingsHeader();
                            showToast(`已添加学生：${student.name}（学号 ${student.studentNo}）`);
                        }
                    }
                }
            });
        }

        if (rosterListBody) {
            rosterListBody.addEventListener('click', async (e) => {
                const langTag = e.target.closest('.roster-lang-tag');
                if (langTag) {
                    const id = Number(langTag.dataset.id);
                    const s = store.getState().students.find(x => x.id === id);
                    if (s) {
                        const nextVal = !s.isNonEnglish;
                        store.setStudentNonEnglish(id, nextVal);
                        renderRosterList();
                        showToast(nextVal ? `已将 ${s.name} 设为非英语生` : `已将 ${s.name} 设为英语生`);
                    }
                    return;
                }

                const editBtn = e.target.closest('.roster-icon-btn.edit-name');
                if (editBtn) {
                    const id = Number(editBtn.dataset.id);
                    const s = store.getState().students.find(x => x.id === id);
                    if (!s) return;
                    const modal = window.TWS3.modal;
                    if (modal) {
                        const newName = await modal.prompt({
                            title: `修改学生姓名`,
                            defaultValue: s.name,
                            placeholder: '学生姓名'
                        });
                        if (newName && newName.trim() && newName.trim() !== s.name) {
                            store.updateStudent(id, { name: newName.trim() });
                            renderRosterList();
                            showToast(`已更新学生姓名为：${newName.trim()}`);
                        }
                    }
                    return;
                }

                const deleteBtn = e.target.closest('.roster-icon-btn.delete');
                if (deleteBtn) {
                    const id = Number(deleteBtn.dataset.id);
                    const s = store.getState().students.find(x => x.id === id);
                    if (!s) return;
                    const modal = window.TWS3.modal;
                    const confirmed = modal
                        ? await modal.confirm({
                            title: '删除学生',
                            message: `确定从全班花名册中移除「${s.name}」（学号 ${s.studentNo || s.id}）？`,
                            confirmText: '删除',
                            danger: true
                        })
                        : confirm(`确定删除「${s.name}」？`);

                    if (confirmed) {
                        const res = store.deleteStudent(id);
                        if (res.success) {
                            renderRosterList();
                            renderSettingsHeader();
                            showToast(`已删除学生：${s.name}`);
                        } else {
                            showToast(`删除失败: ${res.reason}`);
                        }
                    }
                }
            });
        }

        // 10. 调试悬浮球切换
        if (toggleDebuggerBtn) {
            toggleDebuggerBtn.addEventListener('click', () => {
                if (window.TWS3.logger) {
                    if (typeof window.TWS3.logger.toggleFloatingBtn === 'function') {
                        window.TWS3.logger.toggleFloatingBtn();
                    } else if (typeof window.TWS3.logger.showFloatingBtn === 'function') {
                        window.TWS3.logger.showFloatingBtn();
                    }
                }
                renderDebuggerToggle();
            });
        }

        // 11. 版本号与构建信息
        function updateVersionFooters() {
            const buildInfo = window.TWS3.BUILD_INFO || {};
            const appVersion = buildInfo.appVersion || '1.0.0';
            const buildTime = buildInfo.time || '2026-08-30 20:39:16';
            const versionStr = `v${appVersion} · ${buildTime}`;

            const footerEls = document.querySelectorAll('.drawer-footer-text, .settings-footer-text');
            footerEls.forEach(el => {
                el.textContent = versionStr;
                el.title = `应用版本: v${appVersion}\n代码构建时间: ${buildTime} (点击复制)`;
                el.style.cursor = 'pointer';
                el.onclick = () => {
                    const copyPayload = `TWS4 v${appVersion} (${buildInfo.version || buildTime})`;
                    if (navigator.clipboard && navigator.clipboard.writeText) {
                        navigator.clipboard.writeText(copyPayload).then(() => {
                            showToast(`已复制版本信息: ${copyPayload}`);
                        }).catch(() => {
                            showToast(`版本: ${copyPayload}`);
                        });
                    } else {
                        showToast(`版本: ${copyPayload}`);
                    }
                };
            });
        }

        // 12. 订阅 store 数据变更
        store.subscribe((state, eventType, payload) => {
            if (eventType === 'STUDENT_NUMBER_VISIBILITY_CHANGED') {
                renderStudentNumberToggle();
            } else if (eventType === 'SUBJECT_TAG_VISIBILITY_CHANGED') {
                renderSubjectTagToggle();
                renderDrawerTaskList();
            } else if (
                eventType === 'TASK_CHANGED' ||
                eventType === 'TASK_ADDED' ||
                eventType === 'TASK_DELETED' ||
                eventType === 'TASK_RENAMED' ||
                eventType === 'TASK_SUBJECT_CHANGED' ||
                eventType === 'TASK_ARCHIVE_TOGGLED'
            ) {
                renderDrawerHeader();
                renderDrawerTaskList();
            } else if (
                eventType === 'CLASS_CHANGED' ||
                eventType === 'STUDENT_ADDED' ||
                eventType === 'STUDENT_DELETED' ||
                eventType === 'STORE_OVERRIDDEN' ||
                eventType === 'STORE_SMART_MERGED'
            ) {
                renderDrawerHeader();
                renderDrawerTaskList();
                renderSettingsHeader();
                if (rosterView && rosterView.classList.contains('show')) {
                    renderRosterList();
                }
                if (classModal && classModal.classList.contains('show')) {
                    renderClassList();
                }
            }
        });

        // 初始渲染
        renderDrawerHeader();
        renderDrawerTaskList();
        renderSettingsHeader();
        renderStudentNumberToggle();
        renderSubjectTagToggle();
        renderDebuggerToggle();
        updateVersionFooters();

        const drawerService = {
            toggleDrawer,
            openSettingsView,
            closeSettingsView,
            isSettingsViewOpen,
            openRosterView,
            closeRosterView,
            isRosterViewOpen,
            renderDrawerTasks: renderDrawerTaskList,
            renderDebuggerToggle
        };

        window.TWS3.drawer = drawerService;
        return drawerService;
    }

    window.TWS3.initDrawer = initDrawer;
})();
