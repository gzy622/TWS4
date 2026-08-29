(function() {
    window.TWS3 = window.TWS3 || {};
    const store = window.TWS3.store;

    function escapeHtml(str) {
        if (str === null || str === undefined) return '';
        return String(str)
            .replace(/&/g, '&amp;')
            .replace(/</g, '&lt;')
            .replace(/>/g, '&gt;')
            .replace(/"/g, '&quot;')
            .replace(/'/g, '&#39;');
    }

    function showToast(msg, duration) {
        if (window.TWS3.showToast) window.TWS3.showToast(msg, duration);
    }

    function saveBlob(blob, fileName) {
        if (window.TWS3 && typeof window.TWS3.saveBlob === 'function') {
            return window.TWS3.saveBlob(blob, fileName);
        }
        const url = URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = fileName;
        document.body.appendChild(a);
        a.click();
        setTimeout(() => {
            if (a.parentNode) document.body.removeChild(a);
            URL.revokeObjectURL(url);
        }, 1000);
    }

    function initTableView({ onOpenEdit }) {
        const tableContainer = document.getElementById('table-view');
        if (!tableContainer) return;

        let searchQuery = '';
        let subjectFilter = 'all';
        let renderPending = false;
        let tableDirty = false;

        function requestRender() {
            if (store.getViewMode() !== 'table') {
                tableDirty = true;
                return;
            }
            if (renderPending) return;
            renderPending = true;
            requestAnimationFrame(() => {
                renderPending = false;
                if (store.getViewMode() === 'table') {
                    tableDirty = false;
                    renderTableData();
                }
            });
        }

        // 构建精简顶栏与主卡片结构
        function buildStructure() {
            const showNo = store.getShowStudentNumbers();
            tableContainer.innerHTML = `
                <!-- 精简紧凑工具栏 -->
                <div class="table-toolbar-compact">
                    <div class="table-search-wrap">
                        <svg class="table-search-icon" viewBox="0 0 24 24">
                            <circle cx="11" cy="11" r="8"/>
                            <path d="M21 21l-4.35-4.35" stroke-linecap="round"/>
                        </svg>
                        <input type="text" class="table-search-input" id="table-search-input" placeholder="搜索姓名、学号..." value="${escapeHtml(searchQuery)}" />
                        <button type="button" class="table-search-clear" id="table-search-clear" style="display: ${searchQuery ? 'flex' : 'none'};">×</button>
                    </div>

                    <div class="table-select-wrap">
                        <select class="table-select-compact" id="table-subject-select" aria-label="科目筛选">
                            <option value="all">全部科目</option>
                        </select>
                        <svg class="table-select-arrow" viewBox="0 0 24 24"><path d="M6 9l6 6 6-6" stroke-linecap="round" stroke-linejoin="round"/></svg>
                    </div>

                    <button type="button" class="table-btn-toggle-no ${showNo ? 'active' : ''}" id="table-toggle-no-btn" title="显示或隐藏学号列">
                        <span># 学号</span>
                    </button>

                    <button type="button" class="table-btn-export-compact" id="table-export-btn" title="导出记分册 (.xlsx)">
                        <svg viewBox="0 0 24 24">
                            <path d="M14 2H6a2 2 0 00-2 2v16a2 2 0 002 2h12a2 2 0 002-2V8z"/>
                            <path d="M14 2v6h6"/>
                            <path d="M12 12v6m0 0l-2.5-2.5M12 18l2.5-2.5" stroke-linecap="round" stroke-linejoin="round"/>
                        </svg>
                        <span>导出</span>
                    </button>
                </div>

                <!-- 记分册表格主卡片 -->
                <div class="table-card" id="table-card">
                    <div class="table-scroll-wrapper" id="table-scroll-wrapper">
                        <div id="table-body-container"></div>
                    </div>
                </div>
            `;

            bindToolbarEvents();
        }

        function bindToolbarEvents() {
            const searchInput = document.getElementById('table-search-input');
            const searchClear = document.getElementById('table-search-clear');
            const subjectSelect = document.getElementById('table-subject-select');
            const toggleNoBtn = document.getElementById('table-toggle-no-btn');
            const exportBtn = document.getElementById('table-export-btn');

            if (searchInput) {
                searchInput.addEventListener('input', (e) => {
                    searchQuery = e.target.value.trim().toLowerCase();
                    if (searchClear) searchClear.style.display = searchQuery ? 'flex' : 'none';
                    renderTableData();
                });
            }

            if (searchClear) {
                searchClear.addEventListener('click', () => {
                    searchQuery = '';
                    if (searchInput) {
                        searchInput.value = '';
                        searchInput.focus();
                    }
                    searchClear.style.display = 'none';
                    renderTableData();
                });
            }

            if (subjectSelect) {
                subjectSelect.addEventListener('change', (e) => {
                    subjectFilter = e.target.value;
                    renderTableData();
                });
            }

            if (toggleNoBtn) {
                toggleNoBtn.addEventListener('click', () => {
                    const nextVal = !store.getShowStudentNumbers();
                    store.setShowStudentNumbers(nextVal);
                });
            }

            if (exportBtn) {
                exportBtn.addEventListener('click', async () => {
                    const workbook = window.TWS3.workbook;
                    const modal = window.TWS3.modal;
                    if (!workbook) {
                        showToast('导出组件未就绪');
                        return;
                    }

                    const currentClass = store.getState().currentClass || '高二 (3) 班';
                    const defaultTitle = workbook.getDefaultExportTitle(currentClass, store.getState().students.length);

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
                        showToast('记分册已成功导出');
                    } catch (err) {
                        console.error('导出失败:', err);
                        if (modal) {
                            modal.alert({ title: '导出失败', message: err.message || '生成文件异常' });
                        } else {
                            alert(`导出失败: ${err.message}`);
                        }
                    }
                });
            }
        }

        // 计算并渲染数据
        function renderTableData() {
            const state = store.getState();
            const students = state.students || [];
            const allTasks = state.tasks || [];
            const recordsByTask = state.records || {};
            const currentTaskId = state.currentTaskId;
            const showNo = store.getShowStudentNumbers();

            // 1. 同步科目下拉选项
            const subjectSelect = document.getElementById('table-subject-select');
            if (subjectSelect) {
                const subjects = new Set();
                allTasks.forEach(t => {
                    if (t.subject && t.subject !== '未设置') subjects.add(t.subject);
                });
                const curVal = subjectFilter;
                let html = '<option value="all">全部科目</option>';
                Array.from(subjects).sort().forEach(s => {
                    html += `<option value="${escapeHtml(s)}"${s === curVal ? ' selected' : ''}>${escapeHtml(s)}</option>`;
                });
                subjectSelect.innerHTML = html;
            }

            // 2. 筛选任务列
            const visibleTasks = subjectFilter === 'all'
                ? allTasks
                : allTasks.filter(t => t.subject === subjectFilter);

            // 3. 计算汇总指标
            let totalRecordsCount = 0;
            let totalSubmittedCount = 0;

            allTasks.forEach(task => {
                const taskRecords = recordsByTask[task.id] || {};
                const isEnglish = store.isEnglishTask(task);
                students.forEach(student => {
                    const record = taskRecords[student.id] || { status: 'white' };
                    const isExempt = isEnglish && student.isNonEnglish && record.status === 'muted';
                    if (!isExempt) {
                        totalRecordsCount++;
                        if (record.status === 'dark') {
                            totalSubmittedCount++;
                        }
                    }
                });
            });

            const overallRate = totalRecordsCount > 0
                ? ((totalSubmittedCount / totalRecordsCount) * 100).toFixed(1)
                : '0.0';
            // 4. 过滤学生列表（默认按学号升序）
            // 5. 过滤学生列表（默认按学号升序）
            let studentStatsList = students.map(student => {
                let submitted = 0;
                let total = 0;
                let uncompleted = 0;

                visibleTasks.forEach(task => {
                    const taskRecords = recordsByTask[task.id] || {};
                    const record = taskRecords[student.id] || { status: 'white' };
                    const isExempt = store.isEnglishTask(task) && student.isNonEnglish && record.status === 'muted';
                    if (!isExempt) {
                        total++;
                        if (record.status === 'dark') submitted++;
                        else uncompleted++;
                    }
                });

                const rate = total > 0 ? (submitted / total) * 100 : 100;
                return {
                    student,
                    submitted,
                    total,
                    uncompleted,
                    rate
                };
            });

            // 搜索过滤
            if (searchQuery) {
                studentStatsList = studentStatsList.filter(item => {
                    const no = String(item.student.studentNo || item.student.id || '').toLowerCase();
                    const name = String(item.student.name || '').toLowerCase();
                    return no.includes(searchQuery) || name.includes(searchQuery);
                });
            }

            // 按学号升序排序
            studentStatsList.sort((a, b) => {
                const noA = Number(a.student.studentNo || a.student.id);
                const noB = Number(b.student.studentNo || b.student.id);
                if (Number.isFinite(noA) && Number.isFinite(noB)) return noA - noB;
                return String(a.student.studentNo || a.student.id).localeCompare(String(b.student.studentNo || b.student.id));
            });


            const bodyContainer = document.getElementById('table-body-container');
            if (!bodyContainer) return;

            // 6. 空状态处理
            if (students.length === 0) {
                bodyContainer.innerHTML = `
                    <div class="table-empty-state">
                        <svg class="table-empty-icon" viewBox="0 0 24 24"><path d="M17 20h5v-2a3 3 0 00-5.356-1.857M17 20H7m10 0v-2c0-.656-.126-1.283-.356-1.857M7 20H2v-2a3 3 0 015.356-1.857M7 20v-2c0-.656.126-1.283.356-1.857m0 0a5.002 5.002 0 019.288 0M15 7a3 3 0 11-6 0 3 3 0 016 0z" stroke-linecap="round" stroke-linejoin="round"/></svg>
                        <div class="table-empty-text">当前班级暂无学生数据</div>
                    </div>
                `;
                return;
            }

            if (visibleTasks.length === 0) {
                bodyContainer.innerHTML = `
                    <div class="table-empty-state">
                        <svg class="table-empty-icon" viewBox="0 0 24 24"><path d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2" stroke-linecap="round" stroke-linejoin="round"/></svg>
                        <div class="table-empty-text">当前筛选条件下暂无作业任务</div>
                    </div>
                `;
                return;
            }

            if (studentStatsList.length === 0) {
                bodyContainer.innerHTML = `
                    <div class="table-empty-state">
                        <svg class="table-empty-icon" viewBox="0 0 24 24"><circle cx="11" cy="11" r="8"/><path d="M21 21l-4.35-4.35" stroke-linecap="round"/></svg>
                        <div class="table-empty-text">未找到符合条件的学生</div>
                    </div>
                `;
                return;
            }

            // 7. 计算每列任务的汇总统计
            const taskStatsMap = {};
            visibleTasks.forEach(task => {
                const taskRecords = recordsByTask[task.id] || {};
                const isEnglish = store.isEnglishTask(task);
                let taskSubmitted = 0;
                let taskExpected = 0;
                students.forEach(s => {
                    const rec = taskRecords[s.id] || { status: 'white' };
                    const isExempt = isEnglish && s.isNonEnglish && rec.status === 'muted';
                    if (!isExempt) {
                        taskExpected++;
                        if (rec.status === 'dark') taskSubmitted++;
                    }
                });
                const rate = taskExpected > 0 ? ((taskSubmitted / taskExpected) * 100).toFixed(0) : '0';
                taskStatsMap[task.id] = {
                    submitted: taskSubmitted,
                    expected: taskExpected,
                    rate
                };
            });

            // 8. 组装数据表格 HTML
            let tableHtml = `<table class="score-table ${showNo ? '' : 'hide-student-no'}">`;

            // 表头
            tableHtml += '<thead><tr>';
            tableHtml += '<th class="col-sticky-no">学号</th>';
            tableHtml += '<th class="col-sticky-name">姓名</th>';

            visibleTasks.forEach(task => {
                const isCurrent = task.id === currentTaskId;
                const stats = taskStatsMap[task.id] || { submitted: 0, expected: 0, rate: '0' };
                const subjectBadge = task.subject && task.subject !== '未设置'
                    ? `<span class="task-subject-pill">${escapeHtml(task.subject)}</span>`
                    : '';
                const currentBadge = isCurrent ? `<span class="task-current-badge">当前</span>` : '';

                tableHtml += `
                    <th class="task-header-cell ${isCurrent ? 'is-current' : ''}" data-task-id="${task.id}" title="${escapeHtml(task.name)} (点击切换为当前作业)">
                        <div class="task-header-content">
                            <div class="task-header-title">${escapeHtml(task.name)}</div>
                            <div class="task-header-meta">
                                ${subjectBadge}
                                ${currentBadge}
                            </div>
                            <div class="task-rate-mini">${stats.submitted}/${stats.expected} (${stats.rate}%)</div>
                        </div>
                    </th>
                `;
            });

            tableHtml += '<th class="col-summary">已交/总数</th>';
            tableHtml += '<th class="col-summary-rate">提交率</th>';
            tableHtml += '</tr></thead>';

            // 表体数据行
            tableHtml += '<tbody>';
            studentStatsList.forEach(({ student, submitted, total, rate }) => {
                const studentNo = student.studentNo || student.id;
                const isNonEng = !!student.isNonEnglish;

                tableHtml += `<tr data-student-id="${student.id}">`;
                tableHtml += `<td class="col-sticky-no">${escapeHtml(studentNo)}</td>`;
                tableHtml += `
                    <td class="col-sticky-name" title="${escapeHtml(student.name)}${isNonEng ? ' (非英语生)' : ''}">
                        <div class="student-name-cell">
                            <span class="student-name-text">${escapeHtml(student.name)}</span>
                            ${isNonEng ? '<span class="student-tag-non-english">免</span>' : ''}
                        </div>
                    </td>
                `;

                visibleTasks.forEach(task => {
                    const taskRecords = recordsByTask[task.id] || {};
                    const record = taskRecords[student.id] || { status: 'white', badge: null, score: null, note: null };
                    const isExempt = store.isEnglishTask(task) && isNonEng && record.status === 'muted';
                    const isArchived = !!task.archived;

                    let pillClass = record.status || 'white';
                    let displayContent = '-';
                    let isScore = false;

                    const score = record.score !== null && record.score !== undefined && record.score !== ''
                        ? record.score
                        : String(record.badge || '').match(/^(\d+(?:\.\d+)?)分?$/)?.[1];

                    if (score) {
                        displayContent = `${score}分`;
                        isScore = true;
                    } else if (record.badge) {
                        displayContent = escapeHtml(record.badge);
                    } else if (record.status === 'dark') {
                        displayContent = '√';
                    } else if (isExempt) {
                        displayContent = '免交';
                    } else if (record.status === 'muted') {
                        displayContent = '/';
                    }

                    const noteDot = record.note ? '<span class="cell-note-dot" title="' + escapeHtml(record.note) + '"></span>' : '';

                    tableHtml += `
                        <td class="score-cell ${isArchived ? 'is-archived' : ''}" data-student-id="${student.id}" data-task-id="${task.id}" title="${escapeHtml(student.name)} - ${escapeHtml(task.name)}: ${displayContent}">
                            <span class="cell-pill ${pillClass} ${isScore ? 'is-score' : ''}">
                                ${displayContent}
                            </span>
                            ${noteDot}
                        </td>
                    `;
                });

                // 个人汇总
                const rateClass = rate >= 90 ? 'high' : (rate >= 60 ? 'medium' : 'low');
                tableHtml += `<td class="summary-count-cell">${submitted}/${total}</td>`;
                tableHtml += `<td class="summary-rate-cell ${rateClass}">${rate.toFixed(0)}%</td>`;
                tableHtml += '</tr>';
            });
            tableHtml += '</tbody>';

            // 表尾汇总行
            tableHtml += '<tfoot><tr>';
            tableHtml += '<td class="col-sticky-no">汇总</td>';
            tableHtml += '<td class="col-sticky-name">全班统计</td>';

            visibleTasks.forEach(task => {
                const stats = taskStatsMap[task.id] || { submitted: 0, expected: 0, rate: '0' };
                tableHtml += `
                    <td>
                        <div class="foot-summary-wrap">
                            <span class="foot-summary-count">${stats.submitted}/${stats.expected}</span>
                            <span class="foot-summary-rate">${stats.rate}%</span>
                        </div>
                    </td>
                `;
            });

            tableHtml += `<td class="summary-count-cell">${totalSubmittedCount}/${totalRecordsCount}</td>`;
            tableHtml += `<td class="summary-rate-cell">${overallRate}%</td>`;
            tableHtml += '</tr></tfoot>';

            tableHtml += '</table>';
            bodyContainer.innerHTML = tableHtml;

            bindTableInteractions();
        }

        // 绑定表格单元格手势与交互
        function bindTableInteractions() {
            const bodyContainer = document.getElementById('table-body-container');
            if (!bodyContainer) return;

            // 1. 点击任务表头切换当前任务
            const taskHeaders = bodyContainer.querySelectorAll('.task-header-cell');
            taskHeaders.forEach(th => {
                th.addEventListener('click', () => {
                    const taskId = th.dataset.taskId;
                    if (taskId) {
                        store.setCurrentTask(taskId);
                        const task = store.getState().tasks.find(t => t.id === taskId);
                        showToast(`已切换当前作业为：${task ? task.name : taskId}`);
                    }
                });
            });

            // 2. 单元格手势与点击
            const scoreCells = bodyContainer.querySelectorAll('.score-cell');
            scoreCells.forEach(cell => {
                let pressTimer = null;
                let touchMoved = false;

                const studentId = cell.dataset.studentId;
                const taskId = cell.dataset.taskId;

                function handleCellClick() {
                    const task = store.getState().tasks.find(t => t.id === taskId);
                    if (task && task.archived) {
                        showToast('当前任务已归档（只读）');
                        return;
                    }

                    const mode = store.getOperationMode();
                    if (mode === 'grade') {
                        // 打分模式：切换为该任务并打开打分/备注弹层
                        store.setCurrentTask(taskId);
                        if (onOpenEdit) onOpenEdit(studentId);
                    } else {
                        // 登记模式：二态切换
                        if (typeof store.cycleStudentRecord === 'function') {
                            store.cycleStudentRecord(studentId, taskId);
                        } else {
                            store.setCurrentTask(taskId);
                            store.cycleStudentStatus(studentId);
                        }
                    }
                }

                function handleCellLongPress() {
                    const task = store.getState().tasks.find(t => t.id === taskId);
                    if (task && task.archived) {
                        showToast('当前任务已归档（只读）');
                        return;
                    }

                    const mode = store.getOperationMode();
                    if (mode === 'grade') {
                        // 打分模式下长按：二态切换
                        if (typeof store.cycleStudentRecord === 'function') {
                            store.cycleStudentRecord(studentId, taskId);
                        } else {
                            store.setCurrentTask(taskId);
                            store.cycleStudentStatus(studentId);
                        }
                    } else {
                        // 登记模式下长按：打开打分面板
                        store.setCurrentTask(taskId);
                        if (onOpenEdit) onOpenEdit(studentId);
                    }
                }

                cell.addEventListener('click', (e) => {
                    if (touchMoved) return;
                    handleCellClick();
                });

                cell.addEventListener('contextmenu', (e) => {
                    e.preventDefault();
                    handleCellLongPress();
                });

                cell.addEventListener('touchstart', () => {
                    touchMoved = false;
                    pressTimer = setTimeout(() => {
                        handleCellLongPress();
                        pressTimer = null;
                    }, 500);
                }, { passive: true });

                cell.addEventListener('touchmove', () => {
                    touchMoved = true;
                    if (pressTimer) {
                        clearTimeout(pressTimer);
                        pressTimer = null;
                    }
                }, { passive: true });

                cell.addEventListener('touchend', () => {
                    if (pressTimer) {
                        clearTimeout(pressTimer);
                        pressTimer = null;
                    }
                }, { passive: true });
            });

            // 3. 点击学生姓名打开编辑面板
            const nameCells = bodyContainer.querySelectorAll('td.col-sticky-name');
            nameCells.forEach(td => {
                td.style.cursor = 'pointer';
                td.addEventListener('click', () => {
                    const tr = td.closest('tr');
                    const studentId = tr ? tr.dataset.studentId : null;
                    if (studentId && onOpenEdit) {
                        onOpenEdit(studentId);
                    }
                });
            });
        }

        // 初始化结构与首屏数据
        buildStructure();
        renderTableData();

        // 订阅 store 数据变更
        store.subscribe((state, eventType, payload) => {
            if (eventType === 'VIEW_MODE_CHANGED') {
                if (payload.mode === 'table') {
                    if (tableDirty) {
                        tableDirty = false;
                        renderTableData();
                    }
                }
                return;
            }

            if (eventType === 'STUDENT_NUMBER_VISIBILITY_CHANGED') {
                const show = store.getShowStudentNumbers();
                const btn = document.getElementById('table-toggle-no-btn');
                if (btn) btn.classList.toggle('active', show);
                const tbl = document.querySelector('.score-table');
                if (tbl) tbl.classList.toggle('hide-student-no', !show);
            } else if (
                eventType === 'TASK_CHANGED' ||
                eventType === 'TASK_ADDED' ||
                eventType === 'TASK_DELETED' ||
                eventType === 'TASK_SUBJECT_CHANGED' ||
                eventType === 'TASK_RENAMED' ||
                eventType === 'TASK_ARCHIVE_TOGGLED' ||
                eventType === 'STUDENT_ADDED' ||
                eventType === 'STUDENT_DELETED' ||
                eventType === 'STUDENT_UPDATED' ||
                eventType === 'STUDENT_NON_ENGLISH_CHANGED' ||
                eventType === 'STUDENT_STATUS_CHANGED' ||
                eventType === 'STUDENT_BADGE_CHANGED' ||
                eventType === 'STUDENT_RECORD_UPDATED' ||
                eventType === 'ROSTER_RESET' ||
                eventType === 'STORE_OVERRIDDEN' ||
                eventType === 'STORE_SMART_MERGED' ||
                eventType === 'CLASS_CHANGED'
            ) {
                requestRender();
            }
        });

        return {
            render: renderTableData
        };
    }

    window.TWS3.initTableView = initTableView;
})();
