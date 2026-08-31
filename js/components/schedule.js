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
        '1': '08:00 - 08:45',
        '2': '08:55 - 09:40',
        '3': '10:10 - 10:55',
        '4': '11:05 - 11:50',
        '5': '14:30 - 15:15',
        '6': '15:25 - 16:10',
        '7': '16:20 - 17:05',
        '8': '17:15 - 18:00'
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
            detailModal.className = 'modal-overlay';
            detailModal.innerHTML = `
                <div class="schedule-detail-modal-container">
                    <div class="schedule-detail-header">
                        <div class="schedule-detail-title" id="schedule-detail-course-title">课程详情</div>
                        <button type="button" class="schedule-modal-close" id="schedule-detail-close-btn" aria-label="关闭">✕</button>
                    </div>
                    <div class="schedule-detail-list" id="schedule-detail-info-list"></div>
                    <button type="button" class="schedule-btn schedule-btn-primary" id="schedule-detail-ok-btn" style="width:100%; justify-content:center; height:34px;">确定</button>
                </div>
            `;
            document.body.appendChild(detailModal);
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

        // 绑定详情弹窗事件
        const detailCloseBtn = detailModal.querySelector('#schedule-detail-close-btn');
        const detailOkBtn = detailModal.querySelector('#schedule-detail-ok-btn');
        if (detailCloseBtn) detailCloseBtn.addEventListener('click', () => closeDetailModal());
        if (detailOkBtn) detailOkBtn.addEventListener('click', () => closeDetailModal());
        detailModal.addEventListener('click', (e) => {
            if (e.target === detailModal) closeDetailModal();
        });

        function openClassModal() {
            classModal.classList.add('show');
            classSearchKeyword = '';
            if (modalSearchInput) modalSearchInput.value = '';
            renderClassModalList();
        }

        function closeClassModal() {
            classModal.classList.remove('show');
        }

        function openDetailModal(course, dayName, periodName, schedule) {
            const titleEl = detailModal.querySelector('#schedule-detail-course-title');
            const listEl = detailModal.querySelector('#schedule-detail-info-list');
            if (titleEl) {
                titleEl.textContent = `${course.fullName || course.name} 课程详情`;
            }
            if (listEl) {
                const timeSlot = DEFAULT_PERIOD_TIMES[periodName] || `第 ${periodName} 节`;
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
                        <span class="schedule-detail-val">${escapeHtml(dayName)} 第 ${escapeHtml(periodName)} 节 (${escapeHtml(timeSlot)})</span>
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

                if (filtered.length === 0) {
                    gridEl.innerHTML = `<div style="grid-column: 1/-1; text-align:center; padding: 24px; color: var(--text-muted); font-size:12.5px;">无匹配班级</div>`;
                    return;
                }

                gridEl.innerHTML = filtered.map(c => {
                    const isSelected = c.id === currentSelectedId;
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
                    <h3 class="schedule-empty-title">课程表系统</h3>
                    <p class="schedule-empty-desc">支持导入《2026-2027学年第一学期初二课程表.xlsx》等多工作表全校排课表格，智能识别班级、班主任与每日课程排期，并保存您的查看选择。</p>
                    <div class="schedule-empty-btn-group">
                        <button type="button" class="schedule-btn schedule-btn-primary" id="schedule-empty-load-builtin-btn">
                            <svg viewBox="0 0 24 24"><path d="M12 5v14M5 12h14"/></svg>
                            <span>载入内置初二课程表</span>
                        </button>
                        <button type="button" class="schedule-btn schedule-btn-secondary" id="schedule-empty-import-btn">
                            <svg viewBox="0 0 24 24"><path d="M14 2H6a2 2 0 00-2 2v16a2 2 0 002 2h12a2 2 0 002-2V8z"/><path d="M14 2v6h6"/><path d="M12 18v-6m0 0l-3 3m3-3l3 3"/></svg>
                            <span>选择 .xlsx 文件导入</span>
                        </button>
                    </div>
                </div>
            `;

            const loadBtn = container.querySelector('#schedule-empty-load-builtin-btn');
            if (loadBtn) loadBtn.addEventListener('click', () => loadBuiltinSchedule());

            const importBtn = container.querySelector('#schedule-empty-import-btn');
            if (importBtn) importBtn.addEventListener('click', () => fileInput && fileInput.click());
        }

        // 主渲染函数
        function render() {
            const library = store.getScheduleLibrary();
            const activeSchedule = store.getActiveSchedule();

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

            const periods = (activeSchedule.periods && activeSchedule.periods.length > 0)
                ? activeSchedule.periods
                : [
                    { id: 'p_1', name: '1', order: 1 },
                    { id: 'p_2', name: '2', order: 2 },
                    { id: 'p_3', name: '3', order: 3 },
                    { id: 'p_4', name: '4', order: 4 },
                    { id: 'p_5', name: '5', order: 5 },
                    { id: 'p_6', name: '6', order: 6 },
                    { id: 'p_7', name: '7', order: 7 }
                ];

            const lunchAfter = (activeSchedule.lunchBreak && activeSchedule.lunchBreak.afterPeriod) || 4;
            const lunchName = (activeSchedule.lunchBreak && activeSchedule.lunchBreak.name) || '午间休息';
            const grid = activeSchedule.grid || {};

            const gradeName = activeSchedule.grade || (activeSchedule.name ? activeSchedule.name.split(' ')[0] : '初中');
            const totalCourseCount = Object.keys(grid).length;

            container.innerHTML = `
                <!-- 顶部控制栏与班级状态 -->
                <div class="schedule-header-card">
                    <div class="schedule-header-top-row">
                        <div class="schedule-class-info-wrap" id="schedule-header-class-picker" title="点击切换班级">
                            <span class="schedule-grade-badge">${escapeHtml(gradeName)}</span>
                            <span class="schedule-class-title">${escapeHtml(activeSchedule.name || activeSchedule.shortName || '当前班级')}</span>
                            <span class="schedule-teacher-tag">
                                <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                                    <path d="M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2"/>
                                    <circle cx="12" cy="7" r="4"/>
                                </svg>
                                ${escapeHtml(activeSchedule.teacher || '未设班主任')}
                            </span>
                            <span class="schedule-teacher-tag">· ${totalCourseCount} 节课</span>
                            <svg class="schedule-class-dropdown-arrow" viewBox="0 0 24 24">
                                <polyline points="6 9 12 15 18 9"/>
                            </svg>
                        </div>

                        <div class="schedule-actions-group">
                            <button type="button" class="schedule-btn schedule-btn-secondary" id="schedule-switch-btn">
                                <svg viewBox="0 0 24 24"><path d="M17 1l4 4-4 4"/><path d="M3 11V9a4 4 0 0 1 4-4h14"/><path d="M7 23l-4-4 4-4"/><path d="M21 13v2a4 4 0 0 1-4 4H3"/></svg>
                                <span>选班级</span>
                            </button>
                            <button type="button" class="schedule-btn schedule-btn-secondary" id="schedule-today-btn">
                                <svg viewBox="0 0 24 24"><circle cx="12" cy="12" r="10"/><polyline points="12 6 12 12 16 14"/></svg>
                                <span>今日</span>
                            </button>
                            <button type="button" class="schedule-btn schedule-btn-primary" id="schedule-import-btn">
                                <svg viewBox="0 0 24 24"><path d="M14 2H6a2 2 0 00-2 2v16a2 2 0 002 2h12a2 2 0 002-2V8z"/><path d="M14 2v6h6"/><path d="M12 18v-6m0 0l-3 3m3-3l3 3"/></svg>
                                <span>导入课表</span>
                            </button>
                        </div>
                    </div>
                </div>

                <!-- 课程表主体表格滚动容器 -->
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
                                const periodNum = p.name || (pIdx + 1);
                                const isAfterLunch = (pIdx + 1) === lunchAfter + 1;
                                const timeStr = DEFAULT_PERIOD_TIMES[periodNum] || '';
                                
                                let lunchRowHtml = '';
                                if (isAfterLunch) {
                                    lunchRowHtml = `
                                        <tr class="schedule-lunch-row">
                                            <td colspan="${days.length + 1}">
                                                <div class="schedule-lunch-banner">
                                                    <svg viewBox="0 0 24 24">
                                                        <circle cx="12" cy="12" r="5"/>
                                                        <line x1="12" y1="1" x2="12" y2="3"/>
                                                        <line x1="12" y1="21" x2="12" y2="23"/>
                                                        <line x1="4.22" y1="4.22" x2="5.64" y2="5.64"/>
                                                        <line x1="18.36" y1="18.36" x2="19.78" y2="19.78"/>
                                                        <line x1="1" y1="12" x2="3" y2="12"/>
                                                        <line x1="21" y1="12" x2="23" y2="12"/>
                                                        <line x1="4.22" y1="19.78" x2="5.64" y2="18.36"/>
                                                        <line x1="18.36" y1="5.64" x2="19.78" y2="4.22"/>
                                                    </svg>
                                                    <span>${escapeHtml(lunchName)} · 大课间与自主活动</span>
                                                </div>
                                            </td>
                                        </tr>
                                    `;
                                }

                                const rowHtml = `
                                    <tr>
                                        <td class="schedule-period-cell">
                                            <div class="schedule-period-num">${escapeHtml(periodNum)}</div>
                                            ${timeStr ? `<div class="schedule-period-time">${escapeHtml(timeStr)}</div>` : ''}
                                        </td>
                                        ${days.map(d => {
                                            const cellKey = `${d.id}_${p.id}`;
                                            const cellData = grid[cellKey];
                                            if (!cellData || (!cellData.name && !cellData.courseId)) {
                                                return `
                                                    <td class="schedule-td">
                                                        <div class="course-empty">—</div>
                                                    </td>
                                                `;
                                            }

                                            const courseName = cellData.name || cellData.customName || '课程';
                                            const colorClass = `course-${cellData.color || 'default'}`;
                                            const fullName = cellData.fullName || courseName;

                                            return `
                                                <td class="schedule-td">
                                                    <div class="schedule-course-card ${colorClass}" data-cell-key="${escapeHtml(cellKey)}" data-day="${escapeHtml(d.name)}" data-period="${escapeHtml(periodNum)}">
                                                        <div class="schedule-course-name">${escapeHtml(courseName)}</div>
                                                        <div class="schedule-course-footer">
                                                            <span class="schedule-course-tag">${escapeHtml(fullName !== courseName ? fullName : (cellData.category || '学科'))}</span>
                                                        </div>
                                                    </div>
                                                </td>
                                            `;
                                        }).join('')}
                                    </tr>
                                `;

                                return lunchRowHtml + rowHtml;
                            }).join('')}
                        </tbody>
                    </table>
                </div>
            `;

            // 绑定操作事件
            const classPickerBtn = container.querySelector('#schedule-header-class-picker');
            const switchBtn = container.querySelector('#schedule-switch-btn');
            const importBtn = container.querySelector('#schedule-import-btn');
            const todayBtn = container.querySelector('#schedule-today-btn');

            if (classPickerBtn) classPickerBtn.addEventListener('click', () => openClassModal());
            if (switchBtn) switchBtn.addEventListener('click', () => openClassModal());
            if (importBtn) importBtn.addEventListener('click', () => fileInput && fileInput.click());

            if (todayBtn) {
                todayBtn.addEventListener('click', () => {
                    const todayTh = container.querySelector('.schedule-th.today-col');
                    if (todayTh) {
                        todayTh.scrollIntoView({ behavior: 'smooth', inline: 'center', block: 'nearest' });
                        showToast(`已定位到今日 (${days[currentDayIdx - 1]?.name || '周' + currentDayIdx}) 课表`, 1500);
                    } else {
                        showToast('今日为周末非排课时间', 1500);
                    }
                });
            }

            // 绑定课程卡片点击弹出详情
            container.querySelectorAll('.schedule-course-card').forEach(card => {
                card.addEventListener('click', () => {
                    const cellKey = card.dataset.cellKey;
                    const dayName = card.dataset.day;
                    const periodNum = card.dataset.period;
                    const cellData = grid[cellKey];
                    if (cellData) {
                        openDetailModal(cellData, dayName, periodNum, activeSchedule);
                    }
                });
            });
        }

        // 注册全局状态监听
        store.subscribe((state, eventType) => {
            if (eventType === 'VIEW_MODE_CHANGED' && state.viewMode === 'schedule') {
                render();
            } else if (eventType === 'SCHEDULE_CLASS_CHANGED' || eventType === 'SCHEDULE_LIBRARY_UPDATED' || eventType === 'SCHEDULE_CHANGED') {
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
            loadBuiltinSchedule
        };
    }
    window.TWS3.initScheduleView = initScheduleView;
    window.TWS3.schedule = {
        initScheduleView
    };
})();
