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
        if (window.AndroidHaptics && typeof window.AndroidHaptics.vibrate === 'function') {
            try {
                window.AndroidHaptics.vibrate(40);
                return true;
            } catch (_) {}
        }
        return vibrate(40);
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

    function initGlobalPanelGestures({ setDrawerOpen, setTaskDropdownOpen, canOpenTaskDropdown }) {
        const app = document.querySelector('.app-container');
        const drawer = document.getElementById('drawer');
        const drawerOverlay = document.getElementById('drawer-overlay');
        const taskDropdown = document.getElementById('task-dropdown');
        const taskDropdownOverlay = document.getElementById('task-dropdown-overlay');
        if (!app || !drawer || !drawerOverlay || !taskDropdown || !taskDropdownOverlay) return;

        const DIRECTION_SLOP = 10;
        const DIRECTION_RATIO = 1.2;
        const FLING_VELOCITY = 0.45;
        const PROJECTION_MS = 180;
        const MIN_SETTLE_MS = 160;
        const MAX_SETTLE_MS = 300;
        const DECELERATION_EASING = 'cubic-bezier(0.2, 0, 0, 1)';
        let gesture = null;
        let renderFrame = 0;
        let settleTimer = 0;
        let suppressClickUntil = 0;

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
            return !!document.querySelector('.modal-overlay.show, .edit-sheet-overlay.show');
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
            [drawer, drawerOverlay, taskDropdown, taskDropdownOverlay].forEach(element => {
                element.style.removeProperty('transition');
                element.style.removeProperty('transform');
                element.style.removeProperty('opacity');
                element.style.removeProperty('visibility');
                element.style.removeProperty('pointer-events');
                element.style.removeProperty('box-shadow');
            });
        }

        function finishSettlement() {
            if (!settleTimer) return;
            clearTimeout(settleTimer);
            settleTimer = 0;
            clearInlineStyles();
        }

        function renderProgress(axis, progress) {
            if (axis === 'drawer') {
                const width = Math.max(1, drawer.getBoundingClientRect().width);
                drawer.style.transition = 'none';
                drawer.style.visibility = 'visible';
                drawer.style.pointerEvents = 'none';
                drawer.style.transform = `translate3d(${(progress - 1) * width}px, 0, 0)`;
                drawer.style.boxShadow = `2px 0 12px rgba(0, 0, 0, ${0.12 * progress})`;
                drawerOverlay.style.transition = 'none';
                drawerOverlay.style.pointerEvents = 'none';
                drawerOverlay.style.opacity = String(progress);
                return;
            }

            const height = Math.max(1, taskDropdown.getBoundingClientRect().height);
            taskDropdown.style.transition = 'none';
            taskDropdown.style.visibility = 'visible';
            taskDropdown.style.pointerEvents = 'none';
            taskDropdown.style.transform = `translate3d(0, ${(progress - 1) * height}px, 0)`;
            taskDropdown.style.opacity = String(0.45 + progress * 0.55);
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
            gesture.samples.push({ x, y, time });
            const cutoff = time - 120;
            while (gesture.samples.length > 2 && gesture.samples[0].time < cutoff) {
                gesture.samples.shift();
            }
        }

        function lockGesture(axis, currentX, currentY, time) {
            gesture.axis = axis;
            gesture.initialProgress = axis === 'drawer'
                ? (gesture.drawerOpen ? 1 : 0)
                : (gesture.taskOpen ? 1 : 0);

            if (axis === 'drawer') {
                if (!gesture.drawerOpen) setDrawerOpen(true);
                if (gesture.taskOpen) setTaskDropdownOpen(false);
                gesture.size = Math.max(1, drawer.getBoundingClientRect().width);
            } else {
                if (!gesture.taskOpen) setTaskDropdownOpen(true);
                if (gesture.drawerOpen) setDrawerOpen(false);
                gesture.size = Math.max(1, taskDropdown.getBoundingClientRect().height);
            }

            gesture.samples = [{ x: currentX, y: currentY, time }];
            suppressClickUntil = time + 500;
            renderProgress(axis, gesture.initialProgress);
        }

        function updateGesture(touch, time) {
            const deltaX = touch.clientX - gesture.startX;
            const deltaY = touch.clientY - gesture.startY;

            if (!gesture.axis) {
                const absX = Math.abs(deltaX);
                const absY = Math.abs(deltaY);
                if (Math.max(absX, absY) < DIRECTION_SLOP) return false;

                if (gesture.drawerOpen) {
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

            const axisDelta = gesture.axis === 'drawer' ? deltaX : deltaY;
            gesture.progress = clamp(gesture.initialProgress + axisDelta / gesture.size, 0, 1);
            recordSample(touch.clientX, touch.clientY, time);
            scheduleRender();
            return true;
        }

        function getAxisVelocity() {
            if (!gesture || gesture.samples.length < 2) return 0;
            const first = gesture.samples[0];
            const last = gesture.samples[gesture.samples.length - 1];
            const elapsed = Math.max(1, last.time - first.time);
            return gesture.axis === 'drawer'
                ? (last.x - first.x) / elapsed
                : (last.y - first.y) / elapsed;
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
            renderProgress(gesture.axis, gesture.progress);

            const axis = gesture.axis;
            const progress = gesture.progress;
            const size = gesture.size;
            const velocity = cancelled ? 0 : getAxisVelocity();
            const projectedProgress = progress + velocity * PROJECTION_MS / size;
            const shouldOpen = cancelled
                ? gesture.initialProgress === 1
                : (Math.abs(velocity) >= FLING_VELOCITY ? velocity > 0 : projectedProgress >= 0.5);
            const targetProgress = shouldOpen ? 1 : 0;
            const remainingDistance = Math.abs(targetProgress - progress) * size;
            const velocityDuration = Math.abs(velocity) > 0.05
                ? remainingDistance / Math.abs(velocity)
                : 240;
            const duration = Math.round(clamp(velocityDuration, MIN_SETTLE_MS, MAX_SETTLE_MS));
            const transition = `${duration}ms ${DECELERATION_EASING}`;

            if (axis === 'drawer') {
                drawer.style.transition = `transform ${transition}, box-shadow ${transition}`;
                drawerOverlay.style.transition = `opacity ${transition}`;
                void drawer.offsetWidth;
                drawer.style.transform = `translate3d(${targetProgress === 1 ? 0 : -size}px, 0, 0)`;
                drawer.style.boxShadow = targetProgress === 1
                    ? '2px 0 12px rgba(0, 0, 0, 0.12)'
                    : '2px 0 12px rgba(0, 0, 0, 0)';
                drawerOverlay.style.opacity = String(targetProgress);
                setDrawerOpen(shouldOpen);
            } else {
                taskDropdown.style.transition = `transform ${transition}, opacity ${transition}`;
                taskDropdownOverlay.style.transition = `opacity ${transition}`;
                void taskDropdown.offsetWidth;
                taskDropdown.style.transform = `translate3d(0, ${targetProgress === 1 ? 0 : -size}px, 0)`;
                taskDropdown.style.opacity = targetProgress === 1 ? '1' : '0.45';
                taskDropdownOverlay.style.opacity = String(targetProgress);
                setTaskDropdownOpen(shouldOpen);
            }

            gesture = null;
            settleTimer = window.setTimeout(() => {
                settleTimer = 0;
                clearInlineStyles();
            }, duration + 34);
        }

        app.addEventListener('touchstart', event => {
            finishSettlement();
            if (event.touches.length !== 1 || hasBlockingLayer()) {
                gesture = null;
                return;
            }
            const target = event.target instanceof Element ? event.target : app;
            if (target.closest('input, textarea, select, [contenteditable="true"], .debugger-floating-btn')) {
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
            if (!gesture || !getTouch(event.changedTouches, gesture.identifier)) return;
            settleGesture(false);
        }, { passive: true, capture: true });

        app.addEventListener('touchcancel', event => {
            if (!gesture || !getTouch(event.changedTouches, gesture.identifier)) return;
            settleGesture(true);
        }, { passive: true, capture: true });

        app.addEventListener('click', event => {
            if (performance.now() > suppressClickUntil) return;
            suppressClickUntil = 0;
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
