(function() {
    window.TWS3 = window.TWS3 || {};
    const store = window.TWS3.store;

    let lastBackPressTime = 0;
    const DOUBLE_PRESS_INTERVAL = 2000;

    /**
     * 检查并尝试关闭当前顶层浮层、弹窗或返回主视图
     * @returns {boolean} 是否消费了返回事件
     */
    function handleBackStep() {
        // 1. 关闭作业条目更多操作菜单
        const actionMenu = document.querySelector('.task-action-menu.show');
        if (actionMenu) {
            actionMenu.classList.remove('show');
            const activeMoreBtns = document.querySelectorAll('.task-more-btn.active');
            activeMoreBtns.forEach(btn => {
                btn.classList.remove('active');
                btn.setAttribute('aria-expanded', 'false');
            });
            return true;
        }

        // 2. 关闭作业下拉面板
        const taskDropdown = document.getElementById('task-dropdown');
        if (taskDropdown && taskDropdown.classList.contains('show')) {
            if (window.TWS3.navbar && typeof window.TWS3.navbar.closeDropdown === 'function') {
                window.TWS3.navbar.closeDropdown();
            } else {
                taskDropdown.classList.remove('show');
                const overlay = document.getElementById('task-dropdown-overlay');
                if (overlay) overlay.classList.remove('show');
                const trigger = document.getElementById('nav-title-trigger');
                if (trigger) trigger.classList.remove('active');
            }
            return true;
        }

        // 3. 关闭学生打分/编辑底部面板
        const editSheetOverlay = document.getElementById('edit-sheet-overlay');
        if (editSheetOverlay && editSheetOverlay.classList.contains('show')) {
            const closeBtn = editSheetOverlay.querySelector('.sheet-close-btn');
            if (closeBtn) closeBtn.click();
            else editSheetOverlay.classList.remove('show');
            return true;
        }

        // 4. 关闭花名册管理弹窗
        const rosterModal = document.getElementById('roster-modal');
        if (rosterModal && rosterModal.classList.contains('show')) {
            const closeBtn = document.getElementById('roster-close-btn');
            if (closeBtn) closeBtn.click();
            else rosterModal.classList.remove('show');
            return true;
        }

        // 5. 关闭差异比对合并弹窗
        const diffModal = document.getElementById('diff-modal');
        if (diffModal && diffModal.classList.contains('show')) {
            const cancelBtn = document.getElementById('diff-btn-cancel');
            if (cancelBtn) cancelBtn.click();
            else diffModal.classList.remove('show');
            return true;
        }

        // 6. 关闭通用模态弹窗 / 课程/职务/值日配置自定义弹窗
        const appModal = document.getElementById('app-modal');
        if (appModal && appModal.classList.contains('show')) {
            const cancelBtn = document.getElementById('modal-cancel-btn');
            if (cancelBtn && cancelBtn.style.display !== 'none') {
                cancelBtn.click();
            } else if (window.TWS3.modal && typeof window.TWS3.modal.close === 'function') {
                window.TWS3.modal.close(null);
            } else {
                appModal.classList.remove('show');
            }
            return true;
        }

        // 7. 关闭左侧抽屉菜单
        const drawer = document.getElementById('drawer');
        const drawerOverlay = document.getElementById('drawer-overlay');
        if ((drawer && drawer.classList.contains('show')) || (drawerOverlay && drawerOverlay.classList.contains('show'))) {
            if (drawer) drawer.classList.remove('show');
            if (drawerOverlay) drawerOverlay.classList.remove('show');
            return true;
        }

        // 8. 若当前处于非网格视图（如座位表、课程表、班干部表、值日生表），返回网格视图（首页）
        if (store && typeof store.getViewMode === 'function') {
            const currentView = store.getViewMode();
            if (currentView !== 'grid') {
                store.setViewMode('grid');
                return true;
            }
        }

        return false;
    }

    /**
     * 维持历史栈保护层
     */
    function pushGuardState() {
        try {
            history.pushState({ tws_guard: true, t: Date.now() }, document.title, location.href);
        } catch (_) {}
    }

    /**
     * 响应系统返回键（供原生容器或通用调用直接触发）
     * @returns {"consumed" | "exit"} 处理结果状态
     */
    function onSystemBackPressed() {
        const consumed = handleBackStep();
        if (consumed) {
            pushGuardState();
            return 'consumed';
        }

        const now = Date.now();
        if (now - lastBackPressTime < DOUBLE_PRESS_INTERVAL) {
            return 'exit';
        }

        lastBackPressTime = now;
        if (window.TWS3.showToast) {
            window.TWS3.showToast('再按一次退出程序');
        }
        pushGuardState();
        return 'consumed';
    }

    /**
     * 初始化系统返回键拦截器
     */
    function initBackHandler() {
        // 初始注入保护状态
        pushGuardState();

        // 1. 监听 Capacitor 原生硬件/手势返回事件
        if (window.Capacitor && window.Capacitor.Plugins && window.Capacitor.Plugins.App) {
            try {
                window.Capacitor.Plugins.App.addListener('backButton', () => {
                    const result = onSystemBackPressed();
                    if (result === 'exit') {
                        window.Capacitor.Plugins.App.exitApp();
                    }
                });
            } catch (_) {}
        }

        // 2. 监听浏览器自带后退事件 (popstate)
        window.addEventListener('popstate', () => {
            const result = onSystemBackPressed();
            if (result === 'exit') {
                if (window.Capacitor && window.Capacitor.Plugins && window.Capacitor.Plugins.App) {
                    window.Capacitor.Plugins.App.exitApp();
                } else if (window.AndroidApp && typeof window.AndroidApp.exit === 'function') {
                    window.AndroidApp.exit();
                } else if (window.AndroidFiles && typeof window.AndroidFiles.exit === 'function') {
                    window.AndroidFiles.exit();
                } else {
                    history.back();
                }
            }
        });
    }

    window.TWS3.initBackHandler = initBackHandler;
    window.TWS3.handleBackStep = handleBackStep;
    window.TWS3.onSystemBackPressed = onSystemBackPressed;
})();
