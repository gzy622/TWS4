(function() {
    window.TWS3 = window.TWS3 || {};
    const store = window.TWS3.store;

    function initEditSheet() {
        const editSheetOverlay = document.getElementById('edit-sheet-overlay');
        const editSheetId = document.getElementById('edit-sheet-id');
        const editSheetTitle = document.getElementById('edit-sheet-title');
        const nonEnglishToggleBtn = document.getElementById('sheet-non-english-toggle');
        const editRemarkInput = document.getElementById('edit-remark-input');
        const editScoreDisplay = document.getElementById('edit-score-display');
        const closeBtn = editSheetOverlay.querySelector('.sheet-close-btn');
        const clearBtn = editSheetOverlay.querySelector('.sheet-btn.clear');
        const saveBtn = editSheetOverlay.querySelector('.sheet-btn.save');
        const keypadContainer = editSheetOverlay.querySelector('.keypad-grid');
        const quickTagsContainer = editSheetOverlay.querySelector('.sheet-quick-tags');
        const quickTagBtns = editSheetOverlay.querySelectorAll('.quick-tag-btn');
        let currentStudentId = null;
        let currentScoreStr = '';
        function triggerHaptic(strength = 'light') {
            try {
                if (window.TWS3 && typeof window.TWS3.haptics === 'function') {
                    window.TWS3.haptics(strength);
                }
            } catch (_) {}
        }

        function renderScoreDisplay() {
            if (editScoreDisplay) {
                editScoreDisplay.textContent = currentScoreStr ? currentScoreStr : '--';
            }
        }
        function updateActiveTag(activeTagText = '') {
            if (!quickTagBtns) return;
            quickTagBtns.forEach(btn => {
                btn.classList.toggle('active', btn.dataset.tag === activeTagText);
            });
        }

        function open(studentId) {
            currentStudentId = studentId;
            const state = store.getState();
            const student = state.students.find(s => s.id === studentId);
            if (!student) return;

            if (editSheetId) editSheetId.textContent = student.studentNo || student.id;
            if (editSheetTitle) editSheetTitle.textContent = student.name;
            if (nonEnglishToggleBtn) {
                const isNonEng = !!student.isNonEnglish;
                nonEnglishToggleBtn.classList.toggle('active', isNonEng);
                nonEnglishToggleBtn.textContent = isNonEng ? '非英语生' : '英语生';
            }
            const currentTask = store.getCurrentTask();
            const isArchived = !!(currentTask && currentTask.archived);
            const record = store.getStudentRecord(studentId);
            currentScoreStr = '';
            let remarkText = '';

            if (record && record.score !== null && record.score !== undefined && record.score !== '') {
                currentScoreStr = String(record.score);
            } else if (record && record.badge) {
                const badgeStr = String(record.badge).trim();
                const scoreMatch = badgeStr.match(/^(\d+(?:\.\d+)?)分?$/);
                if (scoreMatch) {
                    currentScoreStr = scoreMatch[1];
                }
            }
            if (record && record.note) remarkText = String(record.note);
            else if (!currentScoreStr && record && record.badge) remarkText = String(record.badge).trim();

            if (editRemarkInput) {
                editRemarkInput.value = remarkText;
                editRemarkInput.disabled = isArchived;
            }

            updateActiveTag(remarkText);
            renderScoreDisplay();

            if (isArchived) {
                if (editRemarkInput) editRemarkInput.placeholder = '已归档（只读）';
                if (saveBtn) {
                    saveBtn.disabled = true;
                    saveBtn.style.opacity = '0.45';
                    saveBtn.textContent = '已归档只读';
                }
                if (clearBtn) {
                    clearBtn.disabled = true;
                    clearBtn.style.opacity = '0.45';
                }
            } else {
                if (editRemarkInput) editRemarkInput.placeholder = '备注或标签';
                if (saveBtn) {
                    saveBtn.disabled = false;
                    saveBtn.style.opacity = '1';
                    saveBtn.textContent = '保存';
                }
                if (clearBtn) {
                    clearBtn.disabled = false;
                    clearBtn.style.opacity = '1';
                }
            }

            editSheetOverlay.classList.add('show');
        }

        function close() {
            editSheetOverlay.classList.remove('show');
            currentStudentId = null;
            currentScoreStr = '';
            updateActiveTag('');
        }

        function inputKey(val) {
            const currentTask = store.getCurrentTask();
            if (currentTask && currentTask.archived) return;

            triggerHaptic('light');

            if (val === 'del') {
                currentScoreStr = currentScoreStr.slice(0, -1);
            } else if (val === '.') {
                // 小数点输入逻辑
                if (!currentScoreStr) {
                    currentScoreStr = '0.';
                } else if (!currentScoreStr.includes('.')) {
                    currentScoreStr += '.';
                }
            } else {
                // 数字 0-9 输入逻辑
                if (currentScoreStr.includes('.')) {
                    // 已有小数点：严格限制只允许 1 位小数
                    const parts = currentScoreStr.split('.');
                    if (parts[1].length < 1) {
                        currentScoreStr += val;
                    }
                } else {
                    // 整数部分：最多允许 3 位整数 (如 100)
                    if (currentScoreStr === '0') {
                        currentScoreStr = val;
                    } else if (currentScoreStr.length < 3) {
                        currentScoreStr += val;
                    }
                }
            }
            renderScoreDisplay();
        }

        if (editRemarkInput) {
            editRemarkInput.addEventListener('input', () => {
                const val = editRemarkInput.value.trim();
                updateActiveTag(val);
            });

            // 备注框支持回车快速保存
            editRemarkInput.addEventListener('keydown', (e) => {
                if (e.key === 'Enter') {
                    save();
                }
            });
        }

        // 快捷标签点击
        if (quickTagsContainer) {
            quickTagsContainer.addEventListener('click', (e) => {
                const btn = e.target.closest('.quick-tag-btn');
                if (!btn) return;
                const currentTask = store.getCurrentTask();
                if (currentTask && currentTask.archived) return;

                triggerHaptic('light');

                const tagVal = btn.dataset.tag;
                if (btn.classList.contains('active')) {
                    // 再次点按取消选择
                    if (editRemarkInput) editRemarkInput.value = '';
                    updateActiveTag('');
                } else {
                    if (editRemarkInput) editRemarkInput.value = tagVal;
                    updateActiveTag(tagVal);
                }
            });
        }

        // 事件绑定
        if (nonEnglishToggleBtn) {
            nonEnglishToggleBtn.addEventListener('click', () => {
                if (!currentStudentId) return;
                const state = store.getState();
                const student = state.students.find(s => s.id === currentStudentId);
                if (!student) return;
                triggerHaptic('light');
                const nextVal = !student.isNonEnglish;
                store.setStudentNonEnglish(currentStudentId, nextVal);
                nonEnglishToggleBtn.classList.toggle('active', nextVal);
                nonEnglishToggleBtn.textContent = nextVal ? '非英语生' : '英语生';
                if (window.TWS3.showToast) {
                    window.TWS3.showToast(nextVal ? `已将 ${student.name} 设为非英语生` : `已将 ${student.name} 设为英语生`);
                }
            });
        }
        if (closeBtn) closeBtn.addEventListener('click', close);
        if (editSheetOverlay) {
            editSheetOverlay.addEventListener('click', (e) => {
                e.stopPropagation();
                if (e.target === editSheetOverlay) close();
            });
        }

        if (keypadContainer) {
            keypadContainer.addEventListener('click', (e) => {
                const btn = e.target.closest('.keypad-btn');
                if (!btn) return;
                const keyVal = btn.dataset.key;
                if (keyVal) {
                    inputKey(keyVal);
                }
            });
        }

        if (clearBtn) {
            clearBtn.addEventListener('click', () => {
                const currentTask = store.getCurrentTask();
                if (currentTask && currentTask.archived) return;

                triggerHaptic('light');

                if (currentStudentId !== null) {
                    const state = store.getState();
                    const student = state.students.find(s => s.id === currentStudentId);
                    const studentName = student ? student.name : '';
                    store.clearStudentBadge(currentStudentId);
                    if (window.TWS3.showToast && studentName) {
                        window.TWS3.showToast(`已清除 ${studentName} 的标记`);
                    }
                }
                close();
            });
        }

        function save() {
            const currentTask = store.getCurrentTask();
            if (currentTask && currentTask.archived) {
                close();
                return;
            }

            if (currentStudentId === null) return;
            const state = store.getState();
            const student = state.students.find(s => s.id === currentStudentId);
            const studentName = student ? student.name : '';

            triggerHaptic('light');
            const remark = editRemarkInput ? editRemarkInput.value.trim() : '';

            const cleanScore = currentScoreStr.replace(/\.$/, '');
            if (!cleanScore && !remark) {
                store.clearStudentBadge(currentStudentId);
                if (window.TWS3.showToast && studentName) {
                    window.TWS3.showToast(`已清除 ${studentName} 的标记`);
                }
            } else {
                store.updateStudentRecord(currentStudentId, {
                    badge: cleanScore ? `${cleanScore}` : null,
                    score: cleanScore ? Number(cleanScore) : null,
                    note: remark || null
                });
                if (window.TWS3.showToast && studentName) {
                    window.TWS3.showToast(`已保存 ${studentName} 的分数与备注`);
                }
            }

            close();
        }

        if (saveBtn) {
            saveBtn.addEventListener('click', save);
        }
        return {
            open,
            close
        };
    }

    window.TWS3.initEditSheet = initEditSheet;
})();
