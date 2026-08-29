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

    window.TWS3.gestures = {
        bindCardGestures
    };

    window.TWS3.haptics = haptic;
})();
