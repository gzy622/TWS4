(function() {
    window.TWS3 = window.TWS3 || {};
    const store = window.TWS3.store;
    const { bindCardGestures } = window.TWS3.gestures;

    function initSeatView({ onOpenEdit }) {
        const gridContainer = document.getElementById('card-grid');
        const seatContainer = document.getElementById('seat-view');
        let enteredFullscreen = false;
        let landscapeActive = false;
        let adjustMode = false;
        let selectedStudentId = null;
        let orientationRequestId = 0;

        function showToast(message) {
            if (window.TWS3.showToast) window.TWS3.showToast(message);
        }

        function getSeatCardMeta(student, record) {
            const score = record.score !== null && record.score !== undefined && record.score !== ''
                ? record.score
                : String(record.badge || '').match(/^(\d+(?:\.\d+)?)分?$/)?.[1];
            const note = record.note || (!score ? record.badge : '');
            const isExempt = !score && !note && store.isEnglishTask() && student.isNonEnglish && record.status === 'muted';
            return { score, note, isExempt };
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

        function createSeatCard(student, record) {
            const filter = typeof store.getStudentFilter === 'function' ? store.getStudentFilter() : null;
            const card = document.createElement('div');
            const isMatch = matchesFilter(student, record, filter);
            card.className = `card seat-card ${record.status || 'white'}${isMatch ? '' : ' filter-dim'}`;
            card.dataset.id = student.id;

            const name = document.createElement('span');
            name.className = 'seat-card-name';
            name.textContent = student.name;
            card.appendChild(name);

            const { score, note, isExempt } = getSeatCardMeta(student, record);
            const badgeText = score ? `${score}` : (isExempt ? '免交' : '');
            if (badgeText) {
                const badge = document.createElement('span');
                badge.className = isExempt ? 'seat-card-badge non-english' : 'seat-card-badge';
                badge.textContent = badgeText;
                card.appendChild(badge);
            }
            if (note) {
                const noteElement = document.createElement('span');
                noteElement.className = 'seat-card-note';
                noteElement.textContent = note;
                card.appendChild(noteElement);
            }
            return card;
        }

        function syncForcedOrientation() {
            if (!landscapeActive || store.getViewMode() !== 'seat') return;
            document.body.classList.toggle('seat-forced-rotation', window.innerHeight > window.innerWidth);
        }

        function updateLandscapeButton() {
            const button = seatContainer.querySelector('.seat-landscape-btn');
            if (!button) return;
            button.classList.toggle('active', landscapeActive);
            button.querySelector('span').textContent = landscapeActive ? '退出横屏' : '横屏全屏';
        }

        async function enterLandscape() {
            const requestId = ++orientationRequestId;
            landscapeActive = true;
            document.body.classList.add('seat-landscape-mode');
            updateLandscapeButton();
            try {
                if (!document.fullscreenElement && document.documentElement.requestFullscreen) {
                    await document.documentElement.requestFullscreen({ navigationUI: 'hide' });
                    enteredFullscreen = true;
                }
            } catch (_) {}
            try {
                if (screen.orientation && typeof screen.orientation.lock === 'function') {
                    await screen.orientation.lock('landscape');
                }
            } catch (_) {}
            window.setTimeout(() => {
                if (requestId === orientationRequestId) syncForcedOrientation();
            }, 180);
        }

        function leaveLandscape(exitFullscreen = true) {
            orientationRequestId++;
            landscapeActive = false;
            document.body.classList.remove('seat-landscape-mode', 'seat-forced-rotation');
            try {
                if (screen.orientation && typeof screen.orientation.unlock === 'function') screen.orientation.unlock();
            } catch (_) {}
            if (exitFullscreen && enteredFullscreen && document.fullscreenElement && document.exitFullscreen) {
                document.exitFullscreen().catch(() => {});
            }
            enteredFullscreen = false;
            updateLandscapeButton();
        }

        function syncView(mode = store.getViewMode()) {
            const isSeat = mode === 'seat';
            if (!isSeat) leaveLandscape();
        }

        function renderSeatView() {
            const state = store.getState();
            const records = store.getStudentRecords();
            const studentsById = new Map(state.students.map(student => [String(student.id), student]));
            const layout = store.getSeatLayout();
            const maxOccupiedRow = Math.max(5, layout.reduce((max, item) => Math.max(max, Number(item.row) || 0), 0));
            const maxRow = maxOccupiedRow + (adjustMode ? 1 : 0);
            const podiumAtTop = state.seatPodiumPosition === 'top';
            const displayRows = Array.from({ length: maxRow + 1 }, (_, index) => index);
            if (podiumAtTop) displayRows.reverse();
            const seatsBySlot = new Map(layout.map(item => [`${item.row}:${item.group}:${item.side}`, studentsById.get(String(item.studentId))]));
            seatContainer.innerHTML = '';
            seatContainer.classList.toggle('archived-mode', !!store.getCurrentTask()?.archived);
            seatContainer.classList.toggle('podium-top', podiumAtTop);
            seatContainer.classList.toggle('podium-bottom', !podiumAtTop);
            seatContainer.classList.toggle('adjusting', adjustMode);

            const toolbar = document.createElement('div');
            toolbar.className = 'seat-toolbar';
            toolbar.innerHTML = `
                <div class="seat-toolbar-left">
                    <span class="seat-toolbar-title">座位表</span>
                    <span class="seat-adjust-hint">${selectedStudentId ? '请选择目标座位' : '先选择需要移动的学生'}</span>
                </div>
                <div class="seat-toolbar-actions">
                    <button type="button" class="seat-podium-btn ${podiumAtTop ? '' : 'move-up'}" aria-label="切换讲台位置">
                        <svg viewBox="0 0 24 24"><path d="M5 8h14l-2 8H7zM12 3v3m0 12v3m-3-3 3 3 3-3"/></svg>
                        <span>${podiumAtTop ? '移至下方' : '移至上方'}</span>
                    </button>
                    <button type="button" class="seat-landscape-btn" aria-label="切换横屏全屏">
                        <svg viewBox="0 0 24 24"><path d="M8 3H3v5M16 3h5v5M8 21H3v-5m13 5h5v-5"/></svg>
                        <span>横屏全屏</span>
                    </button>
                </div>
            `;
            toolbar.querySelector('.seat-podium-btn').addEventListener('click', () => {
                store.setSeatPodiumPosition(podiumAtTop ? 'bottom' : 'top');
            });
            toolbar.querySelector('.seat-landscape-btn').addEventListener('click', () => {
                if (landscapeActive) leaveLandscape();
                else enterLandscape();
            });
            seatContainer.appendChild(toolbar);
            updateLandscapeButton();

            const layoutActions = document.createElement('div');
            layoutActions.className = 'seat-layout-actions';
            layoutActions.innerHTML = `
                <button type="button" class="seat-layout-action seat-adjust-btn ${adjustMode ? 'active' : ''}">${adjustMode ? '完成调整' : '调整座位'}</button>
                <button type="button" class="seat-layout-action seat-import-layout-btn">导入布局</button>
                <button type="button" class="seat-layout-action seat-export-layout-btn">导出表格</button>
            `;
            layoutActions.querySelector('.seat-adjust-btn').addEventListener('click', () => {
                adjustMode = !adjustMode;
                selectedStudentId = null;
                renderSeatView();
            });
            layoutActions.querySelector('.seat-import-layout-btn').addEventListener('click', () => {
                document.getElementById('drawer-import-seat-btn')?.click();
            });
            layoutActions.querySelector('.seat-export-layout-btn').addEventListener('click', () => {
                document.getElementById('drawer-export-seat-btn')?.click();
            });
            seatContainer.appendChild(layoutActions);

            const desk = document.createElement('div');
            desk.className = 'teacher-desk';
            desk.textContent = '讲台';
            if (podiumAtTop) seatContainer.appendChild(desk);
            const groups = document.createElement('div');
            groups.className = 'seat-groups';
            for (let group = 0; group < 4; group++) {
                const sourceGroup = podiumAtTop ? 3 - group : group;
                const groupElement = document.createElement('section');
                groupElement.className = 'seat-group';
                const seats = document.createElement('div');
                seats.className = 'seat-group-grid';
                for (const row of displayRows) {
                    for (let side = 0; side < 2; side++) {
                        const sourceSide = podiumAtTop ? 1 - side : side;
                        const student = seatsBySlot.get(`${row}:${sourceGroup}:${sourceSide}`);
                        if (student) {
                            const card = createSeatCard(student, records[student.id] || { status: 'white', badge: null });
                            card.dataset.row = row;
                            card.dataset.group = sourceGroup;
                            card.dataset.side = sourceSide;
                            card.classList.toggle('seat-selected', String(student.id) === String(selectedStudentId));
                            seats.appendChild(card);
                        } else {
                            const empty = document.createElement('div');
                            empty.className = 'seat-empty';
                            empty.dataset.row = row;
                            empty.dataset.group = sourceGroup;
                            empty.dataset.side = sourceSide;
                            seats.appendChild(empty);
                        }
                    }
                }
                const title = document.createElement('div');
                title.className = 'seat-group-title';
                title.textContent = (state.seatGroupNames || [])[sourceGroup] || `第${sourceGroup + 1}组`;
                if (podiumAtTop) groupElement.appendChild(title);
                groupElement.appendChild(seats);
                if (!podiumAtTop) groupElement.appendChild(title);
                groups.appendChild(groupElement);
            }
            seatContainer.appendChild(groups);
            if (!podiumAtTop) seatContainer.appendChild(desk);
        }

        function updateSingleCard(studentId) {
            const card = seatContainer.querySelector(`.seat-card[data-id="${studentId}"]`);
            if (!card) return;
            const student = store.getState().students.find(entry => String(entry.id) === String(studentId));
            if (!student) return;
            const record = store.getStudentRecord(studentId);

            // 原地更新状态类，触发平滑颜色过渡与 active 缩放恢复
            card.classList.remove('white', 'dark', 'muted');
            card.classList.add(record.status || 'white');

            let badgeEl = card.querySelector('.seat-card-badge');
            const { score, note, isExempt } = getSeatCardMeta(student, record);
            const badgeText = score ? `${score}` : (isExempt ? '免交' : '');

            if (badgeText) {
                if (!badgeEl) {
                    badgeEl = document.createElement('span');
                    card.appendChild(badgeEl);
                }
                badgeEl.className = isExempt ? 'seat-card-badge non-english' : 'seat-card-badge';
                badgeEl.textContent = badgeText;
            } else {
                if (badgeEl) {
                    badgeEl.remove();
                }
            }

            let noteEl = card.querySelector('.seat-card-note');
            if (note) {
                if (!noteEl) {
                    noteEl = document.createElement('span');
                    noteEl.className = 'seat-card-note';
                    card.appendChild(noteEl);
                }
                noteEl.textContent = note;
            } else if (noteEl) {
                noteEl.remove();
            }
        }

        function selectOrMoveSeat(studentId, targetElement) {
            if (!adjustMode) return false;
            if (!selectedStudentId) {
                selectedStudentId = studentId;
                renderSeatView();
                return true;
            }
            if (String(selectedStudentId) === String(studentId)) {
                selectedStudentId = null;
                renderSeatView();
                return true;
            }

            const state = store.getState();
            const nextLayout = store.getSeatLayout().map(item => ({ ...item }));
            const selectedSeat = nextLayout.find(item => String(item.studentId) === String(selectedStudentId));
            if (!selectedSeat) {
                selectedStudentId = null;
                renderSeatView();
                return true;
            }

            const targetSeat = studentId
                ? nextLayout.find(item => String(item.studentId) === String(studentId))
                : null;
            const targetPosition = {
                row: Number(targetElement.dataset.row),
                group: Number(targetElement.dataset.group),
                side: Number(targetElement.dataset.side)
            };
            const originalPosition = { row: selectedSeat.row, group: selectedSeat.group, side: selectedSeat.side };
            selectedSeat.row = targetPosition.row;
            selectedSeat.group = targetPosition.group;
            selectedSeat.side = targetPosition.side;
            if (targetSeat) {
                targetSeat.row = originalPosition.row;
                targetSeat.group = originalPosition.group;
                targetSeat.side = originalPosition.side;
            }
            selectedStudentId = null;
            store.setSeatLayout(nextLayout, state.seatGroupNames);
            return true;
        }

        function handleClick(studentId, card) {
            if (selectOrMoveSeat(studentId, card)) return;
            if (store.getCurrentTask()?.archived) {
                showToast('当前任务已归档（只读）');
                return;
            }
            if (store.getOperationMode() === 'grade') onOpenEdit?.(studentId);
            else store.cycleStudentStatus(studentId);
        }

        function handleLongPress(studentId, card) {
            if (selectOrMoveSeat(studentId, card)) return;
            if (store.getCurrentTask()?.archived) {
                showToast('当前任务已归档（只读）');
                return;
            }
            if (store.getOperationMode() === 'grade') store.cycleStudentStatus(studentId);
            else onOpenEdit?.(studentId);
        }

        bindCardGestures(seatContainer, { onClick: handleClick, onLongPress: handleLongPress });
        seatContainer.addEventListener('click', event => {
            const emptySeat = event.target.closest('.seat-empty');
            if (!emptySeat || !adjustMode || !selectedStudentId) return;
            selectOrMoveSeat(null, emptySeat);
        });
        window.addEventListener('resize', () => {
            if (landscapeActive) syncForcedOrientation();
        });
        document.addEventListener('fullscreenchange', () => {
            if (enteredFullscreen && !document.fullscreenElement && landscapeActive) leaveLandscape(false);
        });

        let seatDirty = false;

        store.subscribe((state, eventType, payload) => {
            if (eventType === 'VIEW_MODE_CHANGED') {
                if (payload.mode !== 'seat') {
                    adjustMode = false;
                    selectedStudentId = null;
                } else if (seatDirty || seatContainer.children.length === 0) {
                    seatDirty = false;
                    renderSeatView();
                }
                syncView(payload.mode);
                return;
            }

            // 非座位表视图时仅标记脏状态，避免后台冗余 DOM 计算与卡顿
            if (store.getViewMode() !== 'seat') {
                if (
                    eventType === 'SEAT_LAYOUT_CHANGED' ||
                    eventType === 'SEAT_PODIUM_CHANGED' ||
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
                    eventType === 'TASK_ARCHIVE_TOGGLED' ||
                    eventType === 'STUDENT_STATUS_CHANGED' ||
                    eventType === 'STUDENT_BADGE_CHANGED' ||
                    eventType === 'STUDENT_RECORD_UPDATED'
                ) {
                    seatDirty = true;
                    if (eventType === 'SEAT_LAYOUT_CHANGED') selectedStudentId = null;
                }
                return;
            }

            if (
                eventType === 'SEAT_LAYOUT_CHANGED' ||
                eventType === 'SEAT_PODIUM_CHANGED' ||
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
                eventType === 'TASK_ARCHIVE_TOGGLED' ||
                eventType === 'STUDENT_FILTER_CHANGED'
            ) {
                if (eventType === 'SEAT_LAYOUT_CHANGED') selectedStudentId = null;
                renderSeatView();
            } else if (
                (eventType === 'STUDENT_STATUS_CHANGED' || eventType === 'STUDENT_BADGE_CHANGED' || eventType === 'STUDENT_RECORD_UPDATED') &&
                payload && payload.studentId
            ) {
                updateSingleCard(payload.studentId);
            }
        });

        renderSeatView();
        syncView();
        return { renderSeatView };
    }

    window.TWS3.initSeatView = initSeatView;
})();
