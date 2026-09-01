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

        function escapeHtml(str) {
            return String(str === null || str === undefined ? '' : str)
                .replace(/&/g, '&amp;')
                .replace(/</g, '&lt;')
                .replace(/>/g, '&gt;')
                .replace(/"/g, '&quot;')
                .replace(/'/g, '&#39;');
        }

        function getCardInnerHtml(student, record, isEnglishTask) {
            const rawNo = String(student.studentNo || student.id || '').trim();
            const formattedNo = /^\d+$/.test(rawNo) && rawNo.length === 1 ? '0' + rawNo : rawNo;

            // 1. 提取分数与状态标识
            const scoreVal = record.score !== null && record.score !== undefined && record.score !== ''
                ? record.score
                : String(record.badge || '').match(/^(\d+(?:\.\d+)?)分?$/)?.[1];
            const hasScore = scoreVal !== null && scoreVal !== undefined && scoreVal !== '';

            // 2. 提取文本徽章（如 全对、优、订正中、补交、迟交、请假、免交 等）
            let badgeText = '';
            let isNonEnglishExempt = false;

            if (isEnglishTask && student.isNonEnglish && record.status === 'muted') {
                badgeText = '免交';
                isNonEnglishExempt = true;
            } else if (record.badge && !String(record.badge).match(/^(\d+(?:\.\d+)?)分?$/)) {
                badgeText = String(record.badge).trim();
            }

            // 3. 提取备注
            let noteText = '';
            if (record.note) {
                noteText = String(record.note).trim();
            }

            // 4. 构建右侧区域 HTML（分数胶囊 / 状态徽章 / 已提交勾选图标）
            let rightHtml = '';
            if (hasScore) {
                const isPerfect = Number(scoreVal) >= 100;
                const perfectClass = isPerfect ? ' is-perfect' : '';
                rightHtml = `
                    <div class="wide-card-score${perfectClass}">
                        <span class="wide-card-score-val">${escapeHtml(scoreVal)}</span>
                        <span class="wide-card-score-unit">分</span>
                    </div>
                `;
            } else if (badgeText) {
                let badgeTypeClass = '';
                if (isNonEnglishExempt || badgeText === '免交') {
                    badgeTypeClass = ' badge-exempt';
                } else if (/全对|优|满分/.test(badgeText)) {
                    badgeTypeClass = ' badge-success';
                } else if (/订正|错/.test(badgeText)) {
                    badgeTypeClass = ' badge-warning';
                } else if (/迟交|补交/.test(badgeText)) {
                    badgeTypeClass = ' badge-notice';
                } else if (/请假|缺席/.test(badgeText)) {
                    badgeTypeClass = ' badge-info';
                }
                rightHtml = `<span class="wide-card-badge${badgeTypeClass}">${escapeHtml(badgeText)}</span>`;
            } else if (record.status === 'dark') {
                rightHtml = `
                    <div class="wide-card-check" aria-hidden="true">
                        <svg viewBox="0 0 24 24">
                            <polyline points="20 6 9 17 4 12" fill="none" stroke="currentColor" stroke-width="2.6" stroke-linecap="round" stroke-linejoin="round"/>
                        </svg>
                    </div>
                `;
            }

            // 5. 第一行（姓名行）：学生姓名优先级最高，仅在英语作业且非免交时附加紧凑「非英」身份标
            let nameTagHtml = '';
            if (store.getShowNonEnglishTags() && isEnglishTask && student.isNonEnglish && !isNonEnglishExempt) {
                nameTagHtml = `<span class="wide-card-tag tag-lang">非英</span>`;
            }

            // 6. 第二行（次级详情行）：状态标签（如迟交/补交/订正中/全对）与备注信息
            // 当右侧已有分数展示时，状态徽章下沉至第二行，与备注协同展示，避免姓名行拥挤截断
            let subRowHtml = '';
            let statusTagInSub = '';
            if (hasScore && badgeText) {
                let tagClass = 'tag-sub';
                if (/全对|优/.test(badgeText)) tagClass += ' tag-success';
                else if (/订正/.test(badgeText)) tagClass += ' tag-warning';
                else if (/迟交|补交/.test(badgeText)) tagClass += ' tag-notice';
                statusTagInSub = `<span class="wide-card-tag ${tagClass}">${escapeHtml(badgeText)}</span>`;
            }

            if (statusTagInSub || noteText) {
                let noteContentHtml = '';
                if (noteText) {
                    noteContentHtml = `<span class="wide-card-note">${escapeHtml(noteText)}</span>`;
                }
                subRowHtml = `
                    <div class="wide-card-sub-row">
                        ${statusTagInSub}
                        ${noteContentHtml}
                    </div>
                `;
            }

            return `
                <div class="wide-card-num-box">
                    <span class="wide-card-no">${escapeHtml(formattedNo)}</span>
                </div>
                <div class="wide-card-main">
                    <div class="wide-card-name-row">
                        <span class="wide-card-name">${escapeHtml(student.name)}</span>
                        ${nameTagHtml}
                    </div>
                    ${subRowHtml}
                </div>
                <div class="wide-card-right">
                    ${rightHtml}
                </div>
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

        function matchesFilter(student, record, filter) {
            if (!filter) return true;
            if (filter.query) {
                const name = String(student.name || '').toLowerCase();
                const no = String(student.studentNo || student.id || '').toLowerCase();
                if (!name.includes(filter.query) && !no.includes(filter.query)) return false;
            }
            if (filter.status && filter.status !== 'all') {
                const st = record.status || 'white';
                if (filter.status === 'unsubmitted' && st !== 'white') return false;
                if (filter.status === 'submitted' && st !== 'dark') return false;
                if (filter.status === 'muted' && st !== 'muted') return false;
            }
            return true;
        }

        function syncArchivedMode() {
            const currentTask = store.getCurrentTask();
            const isArchived = !!(currentTask && currentTask.archived);
            wideContainer.classList.toggle('archived-mode', isArchived);
        }

        function renderWide(animate = false) {
            const state = store.getState();
            const records = store.getStudentRecords();
            const filter = typeof store.getStudentFilter === 'function' ? store.getStudentFilter() : null;
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
            let visibleCount = 0;
            for (let i = 0; i < students.length; i++) {
                const student = students[i];
                const record = records[student.id] || { status: 'white', badge: null };
                if (!matchesFilter(student, record, filter)) continue;
                visibleCount++;
                const hiddenClass = showNumbers ? '' : ' number-hidden';
                html += `<div class="card wide-card ${record.status || 'white'}${hiddenClass}" data-id="${student.id}">${getCardInnerHtml(student, record, isEnglish)}</div>`;
            }

            if (visibleCount === 0 && students.length > 0) {
                html = `<div class="wide-filter-empty" style="grid-column: 1 / -1; padding: 48px 16px; text-align: center; color: #94a3b8; font-size: 13px;">无匹配的学生</div>`;
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
            } else if (eventType === 'ROSTER_RESET' || eventType === 'STUDENT_FILTER_CHANGED' || eventType === 'NON_ENGLISH_TAG_VISIBILITY_CHANGED') {
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
