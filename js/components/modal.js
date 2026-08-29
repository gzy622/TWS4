(function() {
    window.TWS3 = window.TWS3 || {};

    function initModal() {
        const modalOverlay = document.getElementById('app-modal');
        const modalTitle = document.getElementById('modal-title');
        const modalBody = document.getElementById('modal-body');
        const modalInput = document.getElementById('modal-input');
        const cancelBtn = document.getElementById('modal-cancel-btn');
        const confirmBtn = document.getElementById('modal-confirm-btn');

        let currentResolver = null;
        let currentType = 'alert'; // 'alert' | 'confirm' | 'prompt'
        let resetTimer = null;

        function resetModalState() {
            clearTimeout(resetTimer);
            resetTimer = null;
            if (modalTitle) modalTitle.textContent = '提示';
            if (modalBody) {
                modalBody.innerHTML = '';
                modalBody.style.display = 'none';
                modalBody.classList.remove('custom-modal');
            }
            if (modalInput) {
                modalInput.value = '';
                modalInput.placeholder = '';
                modalInput.style.display = 'none';
            }
            if (cancelBtn) {
                cancelBtn.style.display = 'none';
                cancelBtn.textContent = '取消';
            }
            if (confirmBtn) {
                confirmBtn.className = 'modal-btn confirm';
                confirmBtn.textContent = '确定';
            }
        }

        function showModal() {
            clearTimeout(resetTimer);
            resetTimer = null;
            if (modalOverlay) {
                modalOverlay.classList.add('show');
            }
        }

        function closeModal(result) {
            if (modalOverlay) {
                modalOverlay.classList.remove('show');
            }
            // 延迟等退出动画（250ms）结束后再清空 DOM 内容，保持淡出缩小动画整体平滑完整
            clearTimeout(resetTimer);
            resetTimer = setTimeout(() => {
                if (!modalOverlay || !modalOverlay.classList.contains('show')) {
                    resetModalState();
                }
            }, 280);

            if (currentResolver) {
                const resolve = currentResolver;
                currentResolver = null;
                resolve(result);
            }
        }

        function handleConfirm() {
            if (currentType === 'prompt') {
                const val = modalInput.value.trim();
                if (!val) {
                    modalInput.focus();
                    return;
                }
                closeModal(val);
            } else if (currentType === 'confirm') {
                closeModal(true);
            } else {
                closeModal(true);
            }
        }

        function handleCancel() {
            if (currentType === 'prompt') {
                closeModal(null);
            } else if (currentType === 'confirm') {
                closeModal(false);
            } else {
                closeModal(false);
            }
        }

        /**
         * 提示信息弹窗 (替换 window.alert)
         */
        function alert({ title = '提示', message = '', confirmText = '知道了' } = {}) {
            return new Promise((resolve) => {
                resetModalState();
                currentType = 'alert';
                currentResolver = resolve;

                modalTitle.textContent = title;
                modalBody.textContent = message;
                modalBody.style.display = message ? 'block' : 'none';

                cancelBtn.style.display = 'none';
                confirmBtn.textContent = confirmText;
                confirmBtn.className = 'modal-btn confirm';

                showModal();
            });
        }

        /**
         * 二次确认弹窗 (替换 window.confirm)
         */
        function confirm({ title = '确认操作', message = '', confirmText = '确定', cancelText = '取消', danger = false } = {}) {
            return new Promise((resolve) => {
                resetModalState();
                currentType = 'confirm';
                currentResolver = resolve;

                modalTitle.textContent = title;
                modalBody.textContent = message;
                modalBody.style.display = message ? 'block' : 'none';
                cancelBtn.style.display = 'block';
                cancelBtn.textContent = cancelText;

                confirmBtn.textContent = confirmText;
                confirmBtn.className = danger ? 'modal-btn confirm danger' : 'modal-btn confirm';

                showModal();
            });
        }

        /**
         * 输入弹窗 (替换 window.prompt / 新建与重命名)
         */
        function prompt({ title = '请输入', message = '', placeholder = '', defaultValue = '', confirmText = '确定', cancelText = '取消' } = {}) {
            return new Promise((resolve) => {
                resetModalState();
                currentType = 'prompt';
                currentResolver = resolve;

                modalTitle.textContent = title;
                modalBody.textContent = message;
                modalBody.style.display = message ? 'block' : 'none';

                modalInput.style.display = 'block';
                modalInput.value = defaultValue;

                cancelBtn.style.display = 'block';
                cancelBtn.textContent = cancelText;

                confirmBtn.textContent = confirmText;
                confirmBtn.className = 'modal-btn confirm';

                showModal();
                setTimeout(() => {
                    modalInput.focus();
                    if (defaultValue) {
                        modalInput.select();
                    }
                }, 150);
            });
        }

        if (confirmBtn) {
            confirmBtn.addEventListener('click', (e) => {
                e.stopPropagation();
                handleConfirm();
            });
        }

        if (cancelBtn) {
            cancelBtn.addEventListener('click', (e) => {
                e.stopPropagation();
                handleCancel();
            });
        }

        if (modalOverlay) {
            modalOverlay.addEventListener('click', (e) => {
                e.stopPropagation();
                if (e.target === modalOverlay) {
                    handleCancel();
                }
            });
        }

        if (modalInput) {
            modalInput.addEventListener('keydown', (e) => {
                if (e.key === 'Enter') {
                    handleConfirm();
                } else if (e.key === 'Escape') {
                    handleCancel();
                }
            });
        }

        const modalService = {
            alert,
            confirm,
            prompt,
            reset: resetModalState,
            close: () => closeModal(null)
        };
        window.TWS3.modal = modalService;
        return modalService;
    }

    window.TWS3.initModal = initModal;
})();
