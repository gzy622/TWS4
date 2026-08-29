(function() {
    window.TWS3 = window.TWS3 || {};
    const store = window.TWS3.store;
    const { bindCardGestures } = window.TWS3.gestures;

    const showToast = (msg, duration) => {
        if (window.TWS3.showToast) window.TWS3.showToast(msg, duration);
    };

    function initWideView({ onOpenEdit }) {
        const wideContainer = document.getElementById('wide-view');
        if (!wideContainer) return;

        function getCardInnerHtml(student, record, isEnglishTask) {
            let badgeHtml = '';
            const score = record.score !== null && record.score !== undefined && record.score !== ''
                ? record.score
                : String(record.badge || '').match(/^(\d+(?:\.\d+)?)分?$/)?.[1];
            const note = record.note || (!score ? record.badge : '');
            if (score) {
                badgeHtml = `<span class="badge">${score}分</span>`;
            } else if (isEnglishTask && student.isNonEnglish && record.status === 'muted') {
                badgeHtml = `<span class="badge non-english">免交</span>`;
            }
            const noteHtml = note ? `<span class="wide-card-note">${note}</span>` : '';
            return `
                ${badgeHtml}
                <span class="wide-card-number">${student.studentNo || student.id}</span>
                <span class="wide-card-content">
                    <span class="wide-card-name">${student.name}</span>
                    ${noteHtml}
                </span>
            `;
        }

        function createCardElement(student, record, isEnglishTask = store.isEnglishTask(), showNumbers = store.getShowStudentNumbers()) {
            const card = document.createElement('div');
            card.className = `card wide-card ${record.status || 'white'}`;
            if (!showNumbers) card.classList.add('number-hidden');
            card.dataset.id = student.id;
            card.innerHTML = getCardInnerHtml(student, record, isEnglishTask);
            return card;
        }

        function syncArchivedMode() {
            const currentTask = store.getCurrentTask();
            const isArchived = !!(currentTask && currentTask.archived);
            wideContainer.classList.toggle('archived-mode', isArchived);
        }

        function renderWide(animate = false) {
            const state = store.getState();
            const records = store.getStudentRecords();
            syncArchivedMode();
            if (animate) {
                wideContainer.style.animation = 'none';
                void wideContainer.offsetWidth;
                wideContainer.style.animation = 'fadeInView 0.28s cubic-bezier(0.16, 1, 0.3, 1) forwards';
            }

            const showNumbers = store.getShowStudentNumbers();
            const isEnglish = store.isEnglishTask();
            const students = state.students || [];

            let html = '';
            for (let i = 0; i < students.length; i++) {
                const student = students[i];
                const record = records[student.id] || { status: 'white', badge: null };
                const hiddenClass = showNumbers ? '' : ' number-hidden';
                html += `<div class="card wide-card ${record.status || 'white'}${hiddenClass}" data-id="${student.id}">${getCardInnerHtml(student, record, isEnglish)}</div>`;
            }

            wideContainer.innerHTML = html;
        }

        function updateSingleCard(studentId) {
            const card = wideContainer.querySelector(`.card[data-id="${studentId}"]`);
            if (!card) return;

            const record = store.getStudentRecord(studentId);
            const student = store.getState().students.find(s => s.id === studentId);
            if (student) card.replaceWith(createCardElement(student, record));
        }

        // 绑定手势交互（支持登记模式与打分模式反转）
        bindCardGestures(wideContainer, {
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

        let wideDirty = false;

        // 订阅状态变更
        store.subscribe((state, eventType, payload) => {
            if (eventType === 'VIEW_MODE_CHANGED') {
                if (payload.mode === 'wide' && wideDirty) {
                    wideDirty = false;
                    renderWide(false);
                }
                return;
            }

            // 非当前宽栏视图时仅记录脏标记，避免后台大量不可见 DOM 计算与重排
            if (store.getViewMode() !== 'wide') {
                if (
                    eventType === 'TASK_CHANGED' ||
                    eventType === 'TASK_ADDED' ||
                    eventType === 'TASK_DELETED' ||
                    eventType === 'TASK_SUBJECT_CHANGED' ||
                    eventType === 'STUDENT_ADDED' ||
                    eventType === 'STUDENT_DELETED' ||
                    eventType === 'STUDENT_UPDATED' ||
                    eventType === 'STUDENT_NON_ENGLISH_CHANGED' ||
                    eventType === 'STORE_OVERRIDDEN' ||
                    eventType === 'STORE_SMART_MERGED' ||
                    eventType === 'CLASS_CHANGED' ||
                    eventType === 'ROSTER_RESET' ||
                    eventType === 'STUDENT_STATUS_CHANGED' ||
                    eventType === 'STUDENT_BADGE_CHANGED' ||
                    eventType === 'STUDENT_RECORD_UPDATED'
                ) {
                    wideDirty = true;
                }
                return;
            }

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
                renderWide(true);
            } else if (eventType === 'STUDENT_UPDATED' || eventType === 'STUDENT_NON_ENGLISH_CHANGED') {
                renderWide(false);
            } else if (eventType === 'TASK_ARCHIVE_TOGGLED') {
                if (!payload || payload.taskId === state.currentTaskId) {
                    syncArchivedMode();
                }
            } else if (eventType === 'ROSTER_RESET') {
                renderWide(false);
            } else if (eventType === 'STUDENT_NUMBER_VISIBILITY_CHANGED') {
                wideContainer.querySelectorAll('.card').forEach(card => {
                    card.classList.toggle('number-hidden', !payload.show);
                });
            } else if (
                (eventType === 'STUDENT_STATUS_CHANGED' || eventType === 'STUDENT_BADGE_CHANGED' || eventType === 'STUDENT_RECORD_UPDATED') &&
                payload && payload.studentId
            ) {
                updateSingleCard(payload.studentId);
            }
        });

        // 初始渲染
        renderWide(false);

        return {
            renderWide,
            updateSingleCard
        };
    }

    window.TWS3.initWideView = initWideView;
})();
