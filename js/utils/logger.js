(function() {
    window.TWS3 = window.TWS3 || {};
    const getStore = () => window.TWS3.store;

    let isRecording = false;
    let recordStartTime = 0;
    let eventsBuffer = [];
    let floatingBtnEl = null;
    let dotEl = null;

    const STORAGE_KEY_POS = 'tws3_debug_btn_pos';
    const STORAGE_KEY_VIS = 'tws3_debug_btn_visible';
    const STORAGE_KEY_BACKUP = 'tws3_latest_debug_log';

    function getRelativeTime() {
        return Math.round(performance.now() - recordStartTime);
    }

    function recordEvent(type, details = {}) {
        if (!isRecording) return;
        eventsBuffer.push({
            t: getRelativeTime(),
            type,
            ...details
        });
    }

    function getTargetSummary(target) {
        if (!target) return 'unknown';
        const card = target.closest('.card');
        if (card) {
            return `card#${card.dataset.id || '?'}(${card.className})`;
        }
        const taskItem = target.closest('.task-item');
        if (taskItem) {
            return `taskItem(${taskItem.className})`;
        }
        const btn = target.closest('button, .nav-icon, .drawer-menu-item, .keypad-btn');
        if (btn) {
            return `btn:${btn.className || btn.textContent.trim().slice(0, 10)}`;
        }
        return target.tagName.toLowerCase() + (target.className ? `.${target.className.split(' ')[0]}` : '');
    }

    function startRecording() {
        if (isRecording) return;
        isRecording = true;
        recordStartTime = performance.now();
        eventsBuffer = [];

        if (dotEl) {
            dotEl.classList.add('recording');
        }

        const store = getStore();
        const currentTask = store ? store.getCurrentTask() : null;
        recordEvent('session:start', {
            device: {
                userAgent: navigator.userAgent,
                viewport: `${window.innerWidth}x${window.innerHeight}`,
                dpr: window.devicePixelRatio || 1,
                touchSupport: 'ontouchstart' in window
            },
            state: store ? {
                currentClass: store.getState().currentClass,
                currentTask: currentTask ? currentTask.name : null,
                isArchived: !!(currentTask && currentTask.archived),
                operationMode: store.getOperationMode(),
                studentsCount: store.getState().students.length
            } : {}
        });

        if (window.TWS3.showToast) {
            window.TWS3.showToast('开始录制调试日志');
        }
    }

    async function sendLogPayload(payload) {
        const payloadStr = JSON.stringify(payload);

        // 1. 本地 LocalStorage 永久备份，防止网络波动丢失
        try {
            localStorage.setItem(STORAGE_KEY_BACKUP, payloadStr);
        } catch (_) {}

        // 2. 尝试当前 Origin 的 /api/logs
        const endpoints = ['/api/logs'];
        if (window.location && window.location.hostname && window.location.port !== '8080') {
            // 如果页面运行在 LiveServer(5500) 或其他端口，增加 8080 回传候选地址
            endpoints.push(`http://${window.location.hostname}:8080/api/logs`);
        }

        let lastError = null;

        for (const url of endpoints) {
            try {
                const response = await fetch(url, {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: payloadStr
                });

                const rawText = await response.text();
                let resData = null;
                try {
                    resData = JSON.parse(rawText);
                } catch (_) {
                    if (!response.ok) {
                        throw new Error(`服务返回非JSON响应 (HTTP ${response.status})`);
                    }
                }

                if (response.ok && resData && resData.success) {
                    return { success: true, count: payload.eventsCount, endpoint: url };
                } else {
                    throw new Error((resData && resData.error) || `HTTP ${response.status}`);
                }
            } catch (err) {
                lastError = err;
            }
        }

        return { success: false, error: lastError ? lastError.message : '所有回传接口均不可达' };
    }

    async function stopRecording() {
        if (!isRecording) return;
        isRecording = false;

        if (dotEl) {
            dotEl.classList.remove('recording');
        }

        recordEvent('session:end', {
            totalDurationMs: Math.round(performance.now() - recordStartTime),
            totalEvents: eventsBuffer.length
        });

        const payload = {
            timestamp: new Date().toISOString(),
            durationMs: Math.round(performance.now() - recordStartTime),
            eventsCount: eventsBuffer.length,
            events: eventsBuffer
        };

        const result = await sendLogPayload(payload);

        if (window.TWS3.showToast) {
            if (result.success) {
                window.TWS3.showToast(`录制完成（已回传 ${payload.eventsCount} 条日志）`);
            } else {
                window.TWS3.showToast('录制完成（已暂存本地）');
            }
        }
    }

    function toggleRecording() {
        const now = performance.now();
        if (isRecording) {
            // 防抖屏障：录制开启至少 400ms 后才允许停止，避免极速连击误触
            if (now - recordStartTime < 400) {
                return;
            }
            stopRecording();
        } else {
            startRecording();
        }
    }

    function hideFloatingBtn() {
        if (!floatingBtnEl) return;
        if (isRecording) {
            stopRecording();
        }
        floatingBtnEl.classList.add('hidden');
        localStorage.setItem(STORAGE_KEY_VIS, 'false');
        if (window.TWS3.showToast) {
            window.TWS3.showToast('悬浮球已隐藏');
        }
    }
    function isFloatingBtnVisible() {
        return !!(floatingBtnEl && !floatingBtnEl.classList.contains('hidden'));
    }

    function toggleFloatingBtn() {
        if (isFloatingBtnVisible()) {
            hideFloatingBtn();
            return false;
        } else {
            showFloatingBtn();
            return true;
        }
    }

    function showFloatingBtn() {
        if (!floatingBtnEl) return;
        floatingBtnEl.classList.remove('hidden');
        localStorage.setItem(STORAGE_KEY_VIS, 'true');
        if (window.TWS3.showToast) {
            window.TWS3.showToast('悬浮球已显示');
        }
    }

    function initFloatingButtonDOM() {
        if (floatingBtnEl) return;

        floatingBtnEl = document.createElement('div');
        floatingBtnEl.id = 'debug-floating-btn';
        floatingBtnEl.className = 'debug-floating-btn';
        floatingBtnEl.title = '点按录制/停止，拖动改位置，长按隐藏';

        dotEl = document.createElement('div');
        dotEl.className = 'debug-dot';
        floatingBtnEl.appendChild(dotEl);

        document.body.appendChild(floatingBtnEl);

        // 恢复位置与可见性
        const savedVis = localStorage.getItem(STORAGE_KEY_VIS);
        if (savedVis === 'false') {
            floatingBtnEl.classList.add('hidden');
        }

        const savedPos = localStorage.getItem(STORAGE_KEY_POS);
        if (savedPos) {
            try {
                const { left, top } = JSON.parse(savedPos);
                if (typeof left === 'number' && typeof top === 'number') {
                    const maxLeft = window.innerWidth - 44;
                    const maxTop = window.innerHeight - 44;
                    floatingBtnEl.style.left = `${Math.min(Math.max(8, left), maxLeft)}px`;
                    floatingBtnEl.style.top = `${Math.min(Math.max(8, top), maxTop)}px`;
                    floatingBtnEl.style.bottom = 'auto';
                }
            } catch (_) {}
        }

        // 采用统一标准的 Pointer Events 驱动单点触摸/鼠标拖拽与点击
        let activePointerId = null;
        let startX = 0, startY = 0;
        let initialLeft = 0, initialTop = 0;
        let isDragging = false;
        let pressTimer = null;
        let isLongPress = false;

        function onPointerDown(e) {
            // 仅响应鼠标主按键或触控
            if (e.button !== undefined && e.button !== 0) return;

            activePointerId = e.pointerId;
            startX = e.clientX;
            startY = e.clientY;
            isDragging = false;
            isLongPress = false;

            const rect = floatingBtnEl.getBoundingClientRect();
            initialLeft = rect.left;
            initialTop = rect.top;

            if (floatingBtnEl.setPointerCapture) {
                try {
                    floatingBtnEl.setPointerCapture(e.pointerId);
                } catch (_) {}
            }

            pressTimer = setTimeout(() => {
                isLongPress = true;
                try { window.TWS3.haptics?.('medium'); } catch (_) {}
                hideFloatingBtn();
            }, 600);
        }

        function onPointerMove(e) {
            if (activePointerId === null || e.pointerId !== activePointerId) return;

            const dx = e.clientX - startX;
            const dy = e.clientY - startY;
            const dist = Math.hypot(dx, dy);

            if (dist > 8) {
                if (pressTimer) {
                    clearTimeout(pressTimer);
                    pressTimer = null;
                }
                isDragging = true;
                const newLeft = Math.min(Math.max(8, initialLeft + dx), window.innerWidth - 46);
                const newTop = Math.min(Math.max(8, initialTop + dy), window.innerHeight - 46);
                floatingBtnEl.style.left = `${newLeft}px`;
                floatingBtnEl.style.top = `${newTop}px`;
                floatingBtnEl.style.bottom = 'auto';
            }
        }

        function onPointerUp(e) {
            if (activePointerId === null || e.pointerId !== activePointerId) return;

            if (floatingBtnEl.releasePointerCapture) {
                try {
                    floatingBtnEl.releasePointerCapture(e.pointerId);
                } catch (_) {}
            }

            if (pressTimer) {
                clearTimeout(pressTimer);
                pressTimer = null;
            }

            const wasDragging = isDragging;
            const wasLongPress = isLongPress;
            activePointerId = null;
            isDragging = false;
            isLongPress = false;

            if (wasLongPress) {
                return;
            }

            if (wasDragging) {
                // 保存拖拽后的新位置
                const rect = floatingBtnEl.getBoundingClientRect();
                localStorage.setItem(STORAGE_KEY_POS, JSON.stringify({ left: rect.left, top: rect.top }));
            } else {
                // 干净的单次点击：切换录制状态
                toggleRecording();
            }
        }

        function onPointerCancel(e) {
            if (activePointerId !== null && e.pointerId === activePointerId) {
                if (pressTimer) {
                    clearTimeout(pressTimer);
                    pressTimer = null;
                }
                activePointerId = null;
                isDragging = false;
                isLongPress = false;
            }
        }

        floatingBtnEl.addEventListener('pointerdown', onPointerDown);
        floatingBtnEl.addEventListener('pointermove', onPointerMove);
        floatingBtnEl.addEventListener('pointerup', onPointerUp);
        floatingBtnEl.addEventListener('pointercancel', onPointerCancel);
    }

    function initGlobalEventHooks() {
        // 捕获全局触控事件（带高频 touchmove 采样节流）
        let lastTouchMoveTime = 0;
        let lastMoveX = 0, lastMoveY = 0;

        window.addEventListener('touchstart', (e) => {
            if (!isRecording) return;
            const touch = e.touches[0];
            lastMoveX = touch ? touch.clientX : 0;
            lastMoveY = touch ? touch.clientY : 0;
            lastTouchMoveTime = performance.now();

            recordEvent('touch:start', {
                target: getTargetSummary(e.target),
                x: Math.round(lastMoveX),
                y: Math.round(lastMoveY),
                touchesCount: e.touches.length
            });
        }, { passive: true, capture: true });

        window.addEventListener('touchmove', (e) => {
            if (!isRecording) return;
            const now = performance.now();
            // 节流采样：每 25ms 且移动大于 2px 记录一次，避免无谓的数据膨胀与碎片
            if (now - lastTouchMoveTime < 25) return;

            const touch = e.touches[0];
            if (!touch) return;

            const curX = touch.clientX;
            const curY = touch.clientY;
            if (Math.hypot(curX - lastMoveX, curY - lastMoveY) < 2) return;

            lastTouchMoveTime = now;
            lastMoveX = curX;
            lastMoveY = curY;

            recordEvent('touch:move', {
                x: Math.round(curX),
                y: Math.round(curY)
            });
        }, { passive: true, capture: true });

        window.addEventListener('touchend', (e) => {
            if (!isRecording) return;
            recordEvent('touch:end', {
                target: getTargetSummary(e.target)
            });
        }, { passive: true, capture: true });

        window.addEventListener('click', (e) => {
            if (!isRecording) return;
            recordEvent('dom:click', {
                target: getTargetSummary(e.target)
            });
        }, { passive: true, capture: true });

        window.addEventListener('contextmenu', (e) => {
            if (!isRecording) return;
            recordEvent('dom:contextmenu', {
                target: getTargetSummary(e.target)
            });
        }, { capture: true });

        // 捕获 Store 响应式事件
        const store = getStore();
        if (store && store.subscribe) {
            store.subscribe((state, eventType, payload) => {
                if (!isRecording) return;
                recordEvent('store:event', {
                    eventType,
                    payload: payload || null,
                    currentTaskId: state.currentTaskId,
                    operationMode: state.operationMode
                });
            });
        }
    }
    function initLogger() {
        initFloatingButtonDOM();
        initGlobalEventHooks();

        return {
            startRecording,
            stopRecording,
            toggleRecording,
            showFloatingBtn,
            hideFloatingBtn,
            toggleFloatingBtn,
            isFloatingBtnVisible,
            isRecording: () => isRecording
        };
    }

    window.TWS3.logger = {
        initLogger,
        startRecording,
        stopRecording,
        toggleRecording,
        showFloatingBtn,
        hideFloatingBtn,
        toggleFloatingBtn,
        isFloatingBtnVisible,
        isRecording: () => isRecording
    };
})();
