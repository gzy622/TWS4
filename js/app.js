(function() {
    const {
        initNavbar,
        initDrawer,
        initGrid,
        initSeatView,
        initTableView,
        initEditSheet,
        initModal,
        initBackHandler,
        gestures,
        logger,
        store
    } = window.TWS3;
    let viewElementsCache = null;
    function getViewElements() {
        if (!viewElementsCache) {
            viewElementsCache = {
                grid: document.getElementById('card-grid'),
                seat: document.getElementById('seat-view'),
                table: document.getElementById('table-view')
            };
        }
        return viewElementsCache;
    }

    function syncAllViews(mode = store.getViewMode()) {
        const els = getViewElements();
        for (const [key, el] of Object.entries(els)) {
            if (el) el.hidden = key !== mode;
        }
    }

    document.addEventListener('DOMContentLoaded', () => {
        // 0. Capacitor 原生状态栏初始化 (沉浸式 + 浅色底深色图标)
        if (window.Capacitor && window.Capacitor.Plugins && window.Capacitor.Plugins.StatusBar) {
            try {
                const { StatusBar } = window.Capacitor.Plugins;
                StatusBar.setOverlaysWebView({ overlay: true });
                StatusBar.setStyle({ style: 'DARK' });
            } catch (_) {}
        }

        // 1. 初始化通用模态服务
        initModal();
        // 2. 初始化编辑面板
        const editSheet = initEditSheet();

        // 3. 初始化导航栏与侧边抽屉
        const navbar = initNavbar({});
        const drawer = initDrawer();

        // 4. 统一接管横纵面板手势，避免组件分别监听造成方向竞争
        if (gestures && typeof gestures.initGlobalPanelGestures === 'function') {
            gestures.initGlobalPanelGestures({
                setDrawerOpen: open => drawer.toggleDrawer(open),
                setTaskDropdownOpen: open => {
                    if (open) navbar.toggleDropdown(true);
                    else navbar.closeDropdown();
                },
                canOpenTaskDropdown: () => {
                    const mode = store.getViewMode();
                    return mode === 'grid' || mode === 'seat';
                },
                closeEditSheet: editSheet.close
            });
        }

        // 5. 主视图首次打开时再初始化，避免首屏构建不可见内容
        const initializedViews = new Set();
        const openEdit = studentId => editSheet.open(studentId);
        const viewInitializers = {
            grid: () => initGrid({ onOpenEdit: openEdit }),
            seat: () => initSeatView({ onOpenEdit: openEdit }),
            table: () => initTableView({ onOpenEdit: openEdit })
        };
        function ensureViewInitialized(mode) {
            if (initializedViews.has(mode)) return;
            const initialize = viewInitializers[mode];
            if (typeof initialize !== 'function') return;
            initialize();
            initializedViews.add(mode);
        }

        // 7. 注册全局视图同步监听
        store.subscribe((state, eventType, payload) => {
            if (eventType === 'VIEW_MODE_CHANGED') {
                // 优先离屏构建新视图 DOM，再统一批量切换显隐，避免增量布局重排
                ensureViewInitialized(payload.mode);
                syncAllViews(payload.mode);
            }
        });
        ensureViewInitialized(store.getViewMode());
        syncAllViews();
        // 8. 初始化系统返回键接管
        if (typeof initBackHandler === 'function') {
            initBackHandler();
        }

        // 9. 初始化调试录制器与悬浮球
        if (logger && logger.initLogger) {
            logger.initLogger();
        }
    });
})();
