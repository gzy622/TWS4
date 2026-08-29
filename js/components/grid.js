(function() {
    window.TWS3 = window.TWS3 || {};
    const store = window.TWS3.store;
    const { bindCardGestures } = window.TWS3.gestures;

    const showToast = (msg, duration) => {
        if (window.TWS3.showToast) window.TWS3.showToast(msg, duration);
    };
    function initGrid({ onOpenEdit }) {
        const gridContainer = document.getElementById('card-grid');

        function createCardElement(student, record) {
            const card = document.createElement('div');
            card.className = `card ${record.status || 'white'}`;
            card.classList.toggle('number-hidden', !store.getShowStudentNumbers());
            card.dataset.id = student.id;

            let badgeHtml = '';
            const score = record.score !== null && record.score !== undefined && record.score !== ''
                ? record.score
                : String(record.badge || '').match(/^(\d+(?:\.\d+)?)分?$/)?.[1];
            const note = record.note || (!score ? record.badge : '');
            if (score) {
                badgeHtml = `<span class="badge">${score}分</span>`;
            } else if (store.isEnglishTask() && student.isNonEnglish && record.status === 'muted') {
                badgeHtml = `<span class="badge non-english">免交</span>`;
            }
            const noteHtml = note ? `<span class="card-note">${note}</span>` : '';

            card.innerHTML = `
                ${badgeHtml}
                <span class="card-number">${student.studentNo || student.id}</span>
                <span class="card-text">
                    <span class="card-name">${student.name}</span>
                    ${noteHtml}
                </span>
            `;
            return card;
        }

        function syncArchivedMode() {
            const currentTask = store.getCurrentTask();
            const isArchived = !!(currentTask && currentTask.archived);
            gridContainer.classList.toggle('archived-mode', isArchived);
        }

        function renderGrid(animate = false) {
            const state = store.getState();
            const records = store.getStudentRecords();
            syncArchivedMode();
            if (animate) {
                gridContainer.style.animation = 'none';
                void gridContainer.offsetWidth;
                gridContainer.style.animation = 'fadeInGrid 0.28s ease-out';
            }

            gridContainer.innerHTML = '';
            const fragment = document.createDocumentFragment();

            state.students.forEach(student => {
                const record = records[student.id] || { status: 'white', badge: null };
                const card = createCardElement(student, record);
                fragment.appendChild(card);
            });

            gridContainer.appendChild(fragment);
        }

        function updateSingleCard(studentId) {
            const card = gridContainer.querySelector(`.card[data-id="${studentId}"]`);
            if (!card) return;

            const record = store.getStudentRecord(studentId);
            const student = store.getState().students.find(s => s.id === studentId);
            if (student) card.replaceWith(createCardElement(student, record));
        }

        // 绑定手势交互（支持登记模式与打分模式反转）
        bindCardGestures(gridContainer, {
            onClick: (studentId) => {
                const currentTask = store.getCurrentTask();
                if (currentTask && currentTask.archived) {
                    showToast('当前任务已归档（只读）');
                    return;
                }

                const mode = store.getOperationMode();
                if (mode === 'grade') {
                    // 打分模式：单击直接打开打分/备注面板
                    if (onOpenEdit) {
                        onOpenEdit(studentId);
                    }
                } else {
                    // 登记模式（默认）：单击二态切换 未提交↔已提交
                    store.cycleStudentStatus(studentId);
                }
            },
            onLongPress: (studentId) => {
                const currentTask = store.getCurrentTask();
                if (currentTask && currentTask.archived) {
                    showToast('当前任务已归档（只读）');
                    return;
                }

                const mode = store.getOperationMode();
                if (mode === 'grade') {
                    // 打分模式：长按/右键二态切换 未提交↔已提交
                    store.cycleStudentStatus(studentId);
                } else {
                    // 登记模式（默认）：长按/右键打开打分/备注面板
                    if (onOpenEdit) {
                        onOpenEdit(studentId);
                    }
                }
            }
        });

        // 订阅状态变更
        store.subscribe((state, eventType, payload) => {
            if (
                eventType === 'TASK_CHANGED' ||
                eventType === 'TASK_ADDED' ||
                eventType === 'TASK_DELETED' ||
                eventType === 'TASK_SUBJECT_CHANGED' ||
                eventType === 'STUDENT_ADDED' ||
                eventType === 'STUDENT_DELETED' ||
                eventType === 'STORE_OVERRIDDEN' ||
                eventType === 'STORE_SMART_MERGED' ||
                eventType === 'CLASS_CHANGED'
            ) {
                renderGrid(true);
            } else if (eventType === 'STUDENT_UPDATED' || eventType === 'STUDENT_NON_ENGLISH_CHANGED') {
                renderGrid(false);
            } else if (eventType === 'TASK_ARCHIVE_TOGGLED') {
                if (!payload || payload.taskId === state.currentTaskId) {
                    syncArchivedMode();
                }
            } else if (eventType === 'ROSTER_RESET') {
                renderGrid(false);
            } else if (eventType === 'STUDENT_NUMBER_VISIBILITY_CHANGED') {
                gridContainer.querySelectorAll('.card').forEach(card => {
                    card.classList.toggle('number-hidden', !payload.show);
                });
            } else if (
                (eventType === 'STUDENT_STATUS_CHANGED' || eventType === 'STUDENT_BADGE_CHANGED' || eventType === 'STUDENT_RECORD_UPDATED') &&
                payload && payload.studentId
            ) {
                updateSingleCard(payload.studentId);
            } else if (eventType === 'OPERATION_MODE_CHANGED') {
                const modeText = payload.mode === 'grade' ? '已切换至打分模式' : '已切换至登记模式';
                requestAnimationFrame(() => {
                    showToast(modeText);
                });
            }
        });

        // 初始渲染
        renderGrid(false);

        return {
            renderGrid,
            updateSingleCard
        };
    }

    window.TWS3.initGrid = initGrid;
})();
