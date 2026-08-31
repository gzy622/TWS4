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

                                const rowHtml = `
                                    <tr class="${rowClass}">
                                        <td class="schedule-period-cell type-${pType}">
                                            <span class="schedule-period-badge">${escapeHtml(periodChar)}</span>
                                        </td>
                                        ${days.map(d => {
                                            const cellKey = `${d.id}_${p.id}`;
                                            let cellData = grid[cellKey];
                                            if (!cellData) {
                                                // 容错匹配 p.name
                                                cellData = grid[`${d.id}_p_${pName}`] || grid[`${d.id}_${pName}`];
                                            }

                                            if (!cellData || (!cellData.name && !cellData.courseId && !cellData.customName)) {
                                                return `
                                                    <td class="schedule-td">
                                                        <div class="course-empty">—</div>
                                                    </td>
                                                `;
                                            }

                                            const rawCourseName = cellData.name || cellData.customName || '课';
                                            const singleChar = (cellData.char || rawCourseName.charAt(0) || '—').trim();
                                            const colorClass = `course-${cellData.color || 'default'}`;

                                            return `
                                                <td class="schedule-td">
                                                    <div class="schedule-course-card ${colorClass}" data-cell-key="${escapeHtml(cellKey)}" data-day="${escapeHtml(d.name)}" data-period="${escapeHtml(periodLabel)}">
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

            // 绑定课程卡片点击弹出详情
            container.querySelectorAll('.schedule-course-card').forEach(card => {
                card.addEventListener('click', () => {
                    const cellKey = card.dataset.cellKey;
                    const dayName = card.dataset.day;
                    const periodNum = card.dataset.period;
                    let cellData = grid[cellKey];
                    if (!cellData) {
                        const parts = cellKey.split('_');
                        cellData = grid[`${parts[0]}_${parts[1]}_${parts[2]}`] || grid[`${parts[0]}_${parts[1]}`];
                    }
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
