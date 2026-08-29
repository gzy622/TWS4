(function() {
    const {
        initNavbar,
        initDrawer,
        initGrid,
        initSeatView,
        initEditSheet,
        initModal,
        initBackHandler,
        logger,
        store
    } = window.TWS3;

    let viewElementsCache = null;
    function getViewElements() {
        if (!viewElementsCache) {
            viewElementsCache = {
                grid: document.getElementById('card-grid'),
                seat: document.getElementById('seat-view')
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
        // 1. 初始化通用模态服务
        initModal();

        // 2. 初始化编辑面板
        const editSheet = initEditSheet();

        // 3. 初始化导航栏
        initNavbar({});

        // 4. 初始化侧边抽屉
        initDrawer();

        // 5. 主视图首次打开时再初始化，避免首屏构建不可见内容
        const initializedViews = new Set();
        const openEdit = studentId => editSheet.open(studentId);
        const viewInitializers = {
            grid: () => initGrid({ onOpenEdit: openEdit }),
            seat: () => initSeatView({ onOpenEdit: openEdit })
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
