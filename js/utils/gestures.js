(function() {
    window.TWS3 = window.TWS3 || {};

    /**
     * 手势与交互判定工具模块
     */

    /**
     * 统一触感反馈入口
     * @param {'light'|'medium'} [strength='light'] 触感反馈强度（统一为 40ms 短振动）。
     * @returns {boolean|undefined} navigator.vibrate 的返回值，便于上层诊断
     */
    function haptic(strength = 'light') {
        if (window.Capacitor && window.Capacitor.Plugins && window.Capacitor.Plugins.Haptics) {
            try {
                const style = strength === 'medium' ? 'MEDIUM' : 'LIGHT';
                window.Capacitor.Plugins.Haptics.impact({ style });
                return true;
            } catch (_) {}
        }
        if (window.AndroidHaptics && typeof window.AndroidHaptics.vibrate === 'function') {
            try {
                window.AndroidHaptics.vibrate(strength === 'medium' ? 60 : 40);
                return true;
            } catch (_) {}
        }
        return vibrate(strength === 'medium' ? 60 : 40);
    }

    function vibrate(pattern) {
        const exposedVibrate = navigator.vibrate;
        const nativeVibrate = typeof Navigator !== 'undefined'
            ? Navigator.prototype.vibrate
            : null;
        const vibrate = window['via-fake-vibrate'] === true && typeof nativeVibrate === 'function'
            ? nativeVibrate
            : exposedVibrate;
        if (typeof vibrate !== 'function') return false;
        try { return vibrate.call(navigator, pattern); } catch (_) { return false; }
    }

    function bindCardGestures(containerEl, { onClick, onLongPress }) {
        const longPressDelay = 500;
        const isViaVibrationBlocked = window['via-fake-vibrate'] === true;
        let pressTimer = null;
        let isLongPressTriggered = false;
        let suppressClickForTouch = false;
        let isTouchActive = false;
        let startX = 0;
        let startY = 0;
        let awaitingViaLongPress = false;
        // 移动端轻振动在 touchend 中触发，此标记防止 click 再次重复振动
        let tapHapticHandled = false;

        function cancelPress() {
            if (pressTimer) {
                clearTimeout(pressTimer);
                pressTimer = null;
            }
            awaitingViaLongPress = false;
        }

        function triggerLongPress(card, shouldVibrate = true) {
            pressTimer = null;
            isLongPressTriggered = true;
            suppressClickForTouch = true;
            if (shouldVibrate) {
                haptic('medium');
            }
            if (onLongPress) {
                const studentId = Number(card.dataset.id);
                onLongPress(studentId, card);
            }
        }

        // 移动端触摸开始
        containerEl.addEventListener('touchstart', (e) => {
            const touch = e.touches[0];
            const card = e.target.closest('.card');
            if (!card || !touch) return;

            isTouchActive = true;
            isLongPressTriggered = false;
            suppressClickForTouch = false;
            tapHapticHandled = false;
            startX = touch.clientX;
            startY = touch.clientY;

            const hasUserActivation = !!(navigator.userActivation && navigator.userActivation.hasBeenActive);
            // Via 首次触摸时等待 WebView 的原生长按事件，保留系统长按触感。
            awaitingViaLongPress = isViaVibrationBlocked && !hasUserActivation;
            if (awaitingViaLongPress) return;

            pressTimer = setTimeout(() => {
                triggerLongPress(card, true);
            }, longPressDelay);
        }, { passive: true });

        // 移动端触摸移动判定（防抖与位移阈值）
        containerEl.addEventListener('touchmove', (e) => {
            if ((pressTimer || awaitingViaLongPress) && e.touches[0]) {
                const diffX = Math.abs(e.touches[0].clientX - startX);
                const diffY = Math.abs(e.touches[0].clientY - startY);
                if (diffX > 8 || diffY > 8) {
                    cancelPress();
                }
            }
        }, { passive: true });

        // 触摸结束清理
        containerEl.addEventListener('touchend', () => {
            isTouchActive = false;
            if (awaitingViaLongPress) {
                cancelPress();
                return;
            }
            if (isLongPressTriggered) {
                cancelPress();
                isLongPressTriggered = false;
                tapHapticHandled = true;
                return;
            }
            if (pressTimer) {
                cancelPress();
                // 完整的短按：在原生手势上下文内立即轻振动
                tapHapticHandled = true;
                haptic('light');
            }
        }, { passive: true });

        containerEl.addEventListener('touchcancel', () => {
            isTouchActive = false;
            isLongPressTriggered = false;
            cancelPress();
        }, { passive: true });

        // 桌面端右键 / 移动端原生长按事件
        containerEl.addEventListener('contextmenu', (e) => {
            e.preventDefault();
            const card = e.target.closest('.card');
            if (!card || isLongPressTriggered) return;

            cancelPress();
            // 触控触发的原生 contextmenu 已由系统提供长按触感反馈，不重复触发 JS 振动；桌面端右键则主动触发反馈
            const shouldVibrate = !isTouchActive;
            triggerLongPress(card, shouldVibrate);
            // 桌面端右键触发后重置标志，避免拦截后续左键点击
            if (!isTouchActive) {
                isLongPressTriggered = false;
                suppressClickForTouch = false;
            }
        });

        // 单击事件（移动端的轻振动已在 touchend 触发并置标记，此处仅处理桌面鼠标路径）
        containerEl.addEventListener('click', (e) => {
            if (suppressClickForTouch || isLongPressTriggered) {
                suppressClickForTouch = false;
                isLongPressTriggered = false;
                tapHapticHandled = false;
                return;
            }
            const card = e.target.closest('.card');
            if (!card) return;

            const studentId = Number(card.dataset.id);
            if (!tapHapticHandled) {
                haptic('light');
            } else {
                tapHapticHandled = false;
            }
            if (onClick) {
                onClick(studentId, card);
            }
        });
    }

    function initGlobalPanelGestures({ setDrawerOpen, setTaskDropdownOpen, canOpenTaskDropdown, closeEditSheet }) {
        const app = document.querySelector('.app-container');
        const drawer = document.getElementById('drawer');
        const drawerOverlay = document.getElementById('drawer-overlay');
        const taskDropdown = document.getElementById('task-dropdown');
        const taskDropdownOverlay = document.getElementById('task-dropdown-overlay');
        const editSheetOverlay = document.getElementById('edit-sheet-overlay');
        const editSheetPanel = editSheetOverlay ? editSheetOverlay.querySelector('.edit-sheet') : null;
        if (!app || !drawer || !drawerOverlay || !taskDropdown || !taskDropdownOverlay || !editSheetPanel) return;

        const DIRECTION_SLOP = 10;
        const DIRECTION_RATIO = 1.2;
        const FLING_VELOCITY = 0.45;
        const MIN_SETTLE_MS = 140;
        const MAX_SETTLE_MS = 340;
        let gesture = null;
        let renderFrame = 0;
        let settleTimer = 0;
        let suppressClick = false;

        function clamp(value, min, max) {
            return Math.min(max, Math.max(min, value));
        }

        function getTouch(touchList, identifier) {
            for (let index = 0; index < touchList.length; index += 1) {
                if (touchList[index].identifier === identifier) return touchList[index];
            }
            return null;
        }

        function getScrollableAncestor(target, axis) {
            let element = target instanceof Element ? target : null;
            while (element && element !== app) {
                const style = getComputedStyle(element);
                const overflow = axis === 'x' ? style.overflowX : style.overflowY;
                const hasOverflow = axis === 'x'
                    ? element.scrollWidth > element.clientWidth + 1
                    : element.scrollHeight > element.clientHeight + 1;
                if (hasOverflow && (overflow === 'auto' || overflow === 'scroll')) return element;
                element = element.parentElement;
            }
            return null;
        }

        function canConsumeDrag(element, axis, delta) {
            if (!element) return false;
            if (axis === 'x') {
                const maxScroll = element.scrollWidth - element.clientWidth;
                return delta > 0 ? element.scrollLeft > 1 : element.scrollLeft < maxScroll - 1;
            }
            const maxScroll = element.scrollHeight - element.clientHeight;
            return delta > 0 ? element.scrollTop > 1 : element.scrollTop < maxScroll - 1;
        }

        function hasBlockingLayer() {
            return !!document.querySelector('.modal-overlay.show, .fullscreen-panel.show');
        }

        function canDragOpenTask(target, deltaY) {
            if (deltaY <= 0) return false;
            if (typeof canOpenTaskDropdown === 'function' && !canOpenTaskDropdown()) return false;
            const scroller = getScrollableAncestor(target, 'y');
            return !canConsumeDrag(scroller, 'y', deltaY);
        }

        function canDragShownTask(target, deltaY) {
            if (deltaY >= 0) return false;
            if (target.closest('.task-list-container, .task-action-menu, input, textarea, select, button')) {
                return false;
            }
            return !!target.closest('#task-dropdown, #task-dropdown-overlay, .navbar');
        }

        function clearInlineStyles() {
            [drawer, drawerOverlay, taskDropdown, taskDropdownOverlay, editSheetPanel, editSheetOverlay].forEach(el => {
                el.style.cssText = '';
            });
        }

        function finishSettlement() {
            if (!settleTimer) return;
            clearTimeout(settleTimer);
            settleTimer = 0;
            clearInlineStyles();
        }

        function renderProgress(axis, progress) {
            const size = gesture.size;
            if (axis === 'drawer') {
                drawer.style.transition = 'none';
                drawer.style.visibility = 'visible';
                drawer.style.pointerEvents = 'none';
                drawer.style.transform = `translate3d(${(progress - 1) * size}px, 0, 0)`;
                drawerOverlay.style.transition = 'none';
                drawerOverlay.style.pointerEvents = 'none';
                drawerOverlay.style.opacity = String(progress);
                return;
            }

            if (axis === 'sheet') {
                editSheetPanel.style.transition = 'none';
                editSheetPanel.style.pointerEvents = 'none';
                editSheetPanel.style.transform = `translate3d(0, ${(1 - progress) * size}px, 0)`;
                editSheetOverlay.style.transition = 'none';
                editSheetOverlay.style.pointerEvents = 'none';
                editSheetOverlay.style.backgroundColor = `rgba(15, 23, 42, ${0.32 * progress})`;
                return;
            }

            taskDropdown.style.transition = 'none';
            taskDropdown.style.visibility = 'visible';
            taskDropdown.style.pointerEvents = 'none';
            taskDropdown.style.transform = `translate3d(0, ${(progress - 1) * size}px, 0)`;
            taskDropdownOverlay.style.transition = 'none';
            taskDropdownOverlay.style.pointerEvents = 'none';
            taskDropdownOverlay.style.opacity = String(progress);
        }

        function scheduleRender() {
            if (renderFrame) return;
            renderFrame = requestAnimationFrame(() => {
                renderFrame = 0;
                if (gesture && gesture.axis) {
                    renderProgress(gesture.axis, gesture.progress);
                }
            });
        }

        function recordSample(x, y, time) {
            const samples = gesture.samples;
            samples.push({ x, y, time });
            // 保留最近 200ms 窗口用于速度估算
            const cutoff = time - 200;
            let i = 0;
            while (i < samples.length - 2 && samples[i].time < cutoff) i++;
            if (i > 0) samples.splice(0, i);
        }

        function lockGesture(axis, currentX, currentY, time) {
            gesture.axis = axis;
            if (axis === 'drawer') {
                gesture.initialProgress = gesture.drawerOpen ? 1 : 0;
                if (!gesture.drawerOpen) setDrawerOpen(true);
                if (gesture.taskOpen) setTaskDropdownOpen(false);
                gesture.size = Math.max(1, drawer.getBoundingClientRect().width);
            } else if (axis === 'task') {
                gesture.initialProgress = gesture.taskOpen ? 1 : 0;
                if (!gesture.taskOpen) setTaskDropdownOpen(true);
                if (gesture.drawerOpen) setDrawerOpen(false);
                gesture.size = Math.max(1, taskDropdown.getBoundingClientRect().height);
            } else {
                gesture.initialProgress = 1;
                gesture.size = Math.max(1, editSheetPanel.getBoundingClientRect().height);
            }

            gesture.samples = [{ x: currentX, y: currentY, time }];
            suppressClick = true;
            renderProgress(axis, gesture.initialProgress);
        }

        function updateGesture(touch, time) {
            const deltaX = touch.clientX - gesture.startX;
            const deltaY = touch.clientY - gesture.startY;

            if (!gesture.axis) {
                const absX = Math.abs(deltaX);
                const absY = Math.abs(deltaY);
                if (Math.max(absX, absY) < DIRECTION_SLOP) return false;

                if (gesture.sheetOpen) {
                    if (absY <= absX * DIRECTION_RATIO || deltaY <= 0) {
                        gesture = null;
                        return false;
                    }
                    lockGesture('sheet', touch.clientX, touch.clientY, time);
                } else if (gesture.drawerOpen) {
                    if (absX <= absY * DIRECTION_RATIO) {
                        gesture = null;
                        return false;
                    }
                    lockGesture('drawer', touch.clientX, touch.clientY, time);
                } else if (gesture.taskOpen) {
                    if (absY <= absX * DIRECTION_RATIO || !canDragShownTask(gesture.target, deltaY)) {
                        gesture = null;
                        return false;
                    }
                    lockGesture('task', touch.clientX, touch.clientY, time);
                } else if (absX > absY * DIRECTION_RATIO && deltaX > 0) {
                    // 避开 Android 全面屏边缘返回热区 (0~22px)，防止与系统返回手势冲突
                    if (gesture.startX < 22) {
                        gesture = null;
                        return false;
                    }
                    const scroller = getScrollableAncestor(gesture.target, 'x');
                    if (canConsumeDrag(scroller, 'x', deltaX)) {
                        gesture = null;
                        return false;
                    }
                    lockGesture('drawer', touch.clientX, touch.clientY, time);
                } else if (absY > absX * DIRECTION_RATIO && canDragOpenTask(gesture.target, deltaY)) {
                    lockGesture('task', touch.clientX, touch.clientY, time);
                } else {
                    gesture = null;
                    return false;
                }
            }

            const axisDelta = gesture.axis === 'drawer'
                ? deltaX
                : (gesture.axis === 'sheet' ? -deltaY : deltaY);
            gesture.progress = clamp(gesture.initialProgress + axisDelta / gesture.size, 0, 1);
            recordSample(touch.clientX, touch.clientY, time);
            scheduleRender();
            return true;
        }

        function getAxisVelocity() {
            if (!gesture || gesture.samples.length < 2) return 0;
            const samples = gesture.samples;
            const last = samples[samples.length - 1];
            const isDrawer = gesture.axis === 'drawer';
            const isSheet = gesture.axis === 'sheet';

            // 相邻样本对的瞬时速度，按时间接近度加权平均
            let weightedV = 0, wTotal = 0;
            for (let i = 1; i < samples.length; i++) {
                const prev = samples[i - 1];
                const curr = samples[i];
                const dt = curr.time - prev.time;
                if (dt < 0.5) continue;
                const dp = isDrawer
                    ? curr.x - prev.x
                    : (isSheet ? -(curr.y - prev.y) : curr.y - prev.y);
                const v = dp / dt;
                // 越近的样本对权重越大
                const age = last.time - curr.time;
                const w = 1 / (1 + age * 0.025);
                weightedV += v * w;
                wTotal += w;
            }
            return wTotal > 0 ? weightedV / wTotal : 0;
        }

        /**
         * 根据释放时的归一化速度生成自定义 cubic-bezier，
         * 让 CSS transition 的起始斜率匹配手指离开瞬间的实际速度，消除突变顿挫。
         */
        function buildSettleEasing(normalizedV) {
            // normalizedV: 释放瞬间速度占 (剩余距离/持续时间) 的比值
            // 低速 → 标准减速 (0.2,0,0,1)；高速 → 起始段更陡
            const v = clamp(Math.abs(normalizedV), 0, 4);
            // P1.x 越小起始越陡；P1.y 按速度比例拉高
            const p1x = clamp(0.18 - v * 0.03, 0.02, 0.18);
            const p1y = clamp(v * 0.28, 0, 1.2);
            return `cubic-bezier(${p1x.toFixed(3)},${p1y.toFixed(3)},0,1)`;
        }

        function settleGesture(cancelled) {
            if (!gesture || !gesture.axis) {
                gesture = null;
                return;
            }
            if (renderFrame) {
                cancelAnimationFrame(renderFrame);
                renderFrame = 0;
            }
            // 先同步写入当前跟踪位置（transition:none），确保浏览器提交此帧
            renderProgress(gesture.axis, gesture.progress);

            const axis = gesture.axis;
            const progress = gesture.progress;
            const size = gesture.size;
            const velocity = cancelled ? 0 : getAxisVelocity();
            const absV = Math.abs(velocity);
            const shouldOpen = cancelled
                ? gesture.initialProgress === 1
                : (absV >= FLING_VELOCITY ? velocity > 0 : progress + velocity * 180 / size >= 0.5);
            const targetProgress = shouldOpen ? 1 : 0;
            const remaining = Math.abs(targetProgress - progress) * size;

            // 根据速度动态计算时长：匀减速模型
            let duration;
            if (absV > 0.05 && remaining > 0.5) {
                duration = Math.round(clamp(remaining / absV, MIN_SETTLE_MS, MAX_SETTLE_MS));
            } else {
                duration = 220;
            }

            // 归一化速度 = 实际速度 / (剩余距离 / 持续时间)
            const refSpeed = remaining > 0.5 ? remaining / duration : 1;
            const normalizedV = absV / refSpeed;
            const easing = cancelled ? 'cubic-bezier(0.2,0,0,1)' : buildSettleEasing(normalizedV);
            const transition = `${duration}ms ${easing}`;

            gesture = null;

            // 单次 offsetWidth 强制提交 transition:none 状态，然后立即设置过渡目标
            // 比双 rAF 少一帧空白（~16ms），消除快速滑动时的停顿感
            if (axis === 'drawer') {
                void drawer.offsetWidth;
                drawer.style.transition = `transform ${transition}`;
                drawerOverlay.style.transition = `opacity ${transition}`;
                drawer.style.transform = `translate3d(${targetProgress === 1 ? 0 : -size}px, 0, 0)`;
                drawer.style.boxShadow = targetProgress === 1
                    ? '2px 0 12px rgba(0, 0, 0, 0.12)' : 'none';
                drawerOverlay.style.opacity = String(targetProgress);
                setDrawerOpen(shouldOpen);
            } else if (axis === 'task') {
                void taskDropdown.offsetWidth;
                taskDropdown.style.transition = `transform ${transition}`;
                taskDropdownOverlay.style.transition = `opacity ${transition}`;
                taskDropdown.style.transform = `translate3d(0, ${targetProgress === 1 ? 0 : -size}px, 0)`;
                taskDropdown.style.boxShadow = targetProgress === 1
                    ? '0 14px 30px rgba(0, 0, 0, 0.12)' : 'none';
                taskDropdownOverlay.style.opacity = String(targetProgress);
                setTaskDropdownOpen(shouldOpen);
            } else {
                void editSheetPanel.offsetWidth;
                editSheetPanel.style.transition = `transform ${transition}`;
                editSheetOverlay.style.transition = `background-color ${transition}`;
                editSheetPanel.style.transform = `translate3d(0, ${targetProgress === 1 ? 0 : size}px, 0)`;
                editSheetPanel.style.boxShadow = targetProgress === 1
                    ? '0 -10px 30px rgba(0, 0, 0, 0.12)' : 'none';
                editSheetOverlay.style.backgroundColor = targetProgress === 1
                    ? 'rgba(15, 23, 42, 0.32)' : 'rgba(15, 23, 42, 0)';
                if (!shouldOpen && typeof closeEditSheet === 'function') closeEditSheet();
            }

            settleTimer = window.setTimeout(() => {
                settleTimer = 0;
                clearInlineStyles();
            }, duration + 34);
        }

        app.addEventListener('touchstart', event => {
            suppressClick = false;
            finishSettlement();
            if (event.touches.length !== 1 || hasBlockingLayer()) {
                gesture = null;
                return;
            }
            const target = event.target instanceof Element ? event.target : app;
            if (target.closest('input, textarea, select, [contenteditable="true"], .debugger-floating-btn, .fullscreen-panel')) {
                gesture = null;
                return;
            }
            const touch = event.touches[0];
            const now = performance.now();
            gesture = {
                identifier: touch.identifier,
                target,
                startX: touch.clientX,
                startY: touch.clientY,
                drawerOpen: drawer.classList.contains('show'),
                taskOpen: taskDropdown.classList.contains('show'),
                sheetOpen: editSheetOverlay.classList.contains('show'),
                axis: null,
                initialProgress: 0,
                progress: 0,
                size: 1,
                samples: [{ x: touch.clientX, y: touch.clientY, time: now }]
            };
        }, { passive: true, capture: true });

        app.addEventListener('touchmove', event => {
            if (!gesture || event.touches.length !== 1) return;
            const touch = getTouch(event.touches, gesture.identifier);
            if (!touch) return;
            if (updateGesture(touch, performance.now())) {
                event.preventDefault();
            }
        }, { passive: false, capture: true });

        app.addEventListener('touchend', event => {
            if (!gesture) return;
            const touch = getTouch(event.changedTouches, gesture.identifier);
            if (!touch) return;
            if (gesture.axis) recordSample(touch.clientX, touch.clientY, performance.now());
            settleGesture(false);
        }, { passive: true, capture: true });

        app.addEventListener('touchcancel', event => {
            if (!gesture || !getTouch(event.changedTouches, gesture.identifier)) return;
            settleGesture(true);
        }, { passive: true, capture: true });

        app.addEventListener('click', event => {
            if (!suppressClick) return;
            suppressClick = false;
            event.preventDefault();
            event.stopPropagation();
        }, true);
    }


    window.TWS3.gestures = {
        bindCardGestures,
        initGlobalPanelGestures
    };

    window.TWS3.haptics = haptic;
})();
