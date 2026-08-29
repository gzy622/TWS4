(function() {
    window.TWS3 = window.TWS3 || {};

    let toastEl = null;
    let toastTimer = null;

    function ensureToastEl() {
        if (!toastEl && document.body) {
            toastEl = document.createElement('div');
            toastEl.className = 'toast-container';
            document.body.appendChild(toastEl);
            void toastEl.offsetHeight;
        }
        return toastEl;
    }

    /**
     * 全局轻提示 (Toast)
     * @param {string} message 提示文案
     * @param {number} duration 持续显示时长(ms)，默认 2200ms
     */
    function showToast(message, duration = 2200) {
        const el = ensureToastEl();
        if (!el) return;
        el.textContent = message;

        if (!el.classList.contains('show')) {
            void el.offsetHeight;
            el.classList.add('show');
        }

        clearTimeout(toastTimer);
        toastTimer = setTimeout(() => {
            el.classList.remove('show');
        }, duration);
    }

    if (document.readyState === 'loading') {
        document.addEventListener('DOMContentLoaded', ensureToastEl, { once: true });
    } else {
        ensureToastEl();
    }

    window.TWS3.showToast = showToast;
})();
