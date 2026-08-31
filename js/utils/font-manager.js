(function() {
    window.TWS3 = window.TWS3 || {};

    const TEST_STRING = 'mmmmmmmmmmlli中文字体测试1234567890AaBbCcGgQqWw';
    const TEST_SIZE = '72px';
    const BASE_FONTS = ['monospace', 'sans-serif', 'serif'];

    const BUNDLED_FONTS = new Set([
        'noto sans sc',
        'sarasa ui sc', 'sarasa gothic sc', '更纱黑体', 'sarasa term sc', 'sarasa fixed sc',
        'lxgw wenkai', 'stkaiti', 'kaiti', '楷体', '楷体_gb2312',
        'noto serif sc', 'simsun', 'songti sc', 'stsong', '宋体', '新宋体'
    ]);

    const FONT_PRESETS = [
        {
            id: 'default',
            name: '默认智能搭配',
            subtitle: '更纱等宽优先 · 内置思源保底 · 系统黑体回退',
            tag: '推荐',
            primaryName: '更纱黑体',
            stack: '"Sarasa UI SC", "Sarasa Gothic SC", "更纱黑体", "Sarasa Term SC", "Sarasa Fixed SC", "Noto Sans SC", -apple-system, "PingFang SC", "Hiragino Sans GB", "Microsoft YaHei", "MiSans", "HarmonyOS Sans", Roboto, sans-serif',
            preview: '高二 (3) 班 · 张三 01 号 · 作业已提交 100 分'
        },
        {
            id: 'noto',
            name: '思源黑体',
            subtitle: 'App 内置离线完整字库 · 跨平台现代黑体',
            tag: '内置离线',
            primaryName: '思源黑体',
            stack: '"Noto Sans SC", -apple-system, "PingFang SC", "Microsoft YaHei", sans-serif',
            preview: '高二 (3) 班 · 李四 02 号 · 作业已提交 98.5 分'
        },
        {
            id: 'sarasa',
            name: '更纱黑体 / 等宽黑体',
            subtitle: '内置离线等宽字库 · 中英数 2:1 整齐划一',
            tag: '内置离线',
            primaryName: '更纱黑体',
            stack: '"Sarasa UI SC", "Sarasa Gothic SC", "更纱黑体", "Sarasa Term SC", "Sarasa Fixed SC", ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas, monospace, "Noto Sans SC", sans-serif',
            preview: '高二 (3) 班 · 王五 03 号 · 作业已提交 95.0 分'
        },
        {
            id: 'kaiti',
            name: '楷体 (KaiTi)',
            subtitle: '内置霞鹜文楷/楷体离线字库 · 清秀书法端庄',
            tag: '内置离线',
            primaryName: '楷体',
            stack: '"LXGW WenKai", "STKaiti", "KaiTi", "楷体", "楷体_GB2312", serif',
            preview: '高二 (3) 班 · 孙七 05 号 · 作业已提交 96.0 分'
        },
        {
            id: 'songti',
            name: '宋体 (SongTi)',
            subtitle: '内置思源宋体离线字库 · 经典印刷衬线质感',
            tag: '内置离线',
            primaryName: '宋体',
            stack: '"Noto Serif SC", "SimSun", "Songti SC", "STSong", "宋体", serif',
            preview: '高二 (3) 班 · 周八 06 号 · 作业已提交 89.5 分'
        },
        {
            id: 'system',
            name: '系统原生字体',
            subtitle: '完全跟随手机/电脑操作系统原生 UI 界面字体',
            tag: '系统原生',
            primaryName: '系统原生',
            stack: 'system-ui, -apple-system, "PingFang SC", "HarmonyOS Sans", "MiSans", "Microsoft YaHei", "Segoe UI", sans-serif',
            preview: '高二 (3) 班 · 赵六 04 号 · 作业已提交 92.0 分'
        },
        {
            id: 'youyuan',
            name: '幼圆 (YouYuan)',
            subtitle: '柔和圆润笔触 · 亲和护眼温润风格',
            tag: '圆体',
            primaryName: '幼圆',
            stack: '"YouYuan", "幼圆", "PingFang SC", "Hiragino Sans GB", "Microsoft YaHei", sans-serif',
            preview: '高二 (3) 班 · 吴九 07 号 · 作业已提交 94.0 分'
        },
        {
            id: 'custom',
            name: '自定义字体',
            subtitle: '输入任意本地已安装字体名称或字体族',
            tag: '自定义',
            primaryName: '自定义字体',
            stack: '',
            preview: '高二 (3) 班 · 钱十 08 号 · 自定义渲染测试'
        }
    ];

    const FONT_NAME_MAP = {
        'sarasa ui sc': '更纱黑体 (Sarasa UI SC)',
        'sarasa gothic sc': '更纱黑体 (Sarasa Gothic SC)',
        '更纱黑体': '更纱黑体 (Sarasa Gothic)',
        'sarasa term sc': '更纱等宽 (Sarasa Term SC)',
        'sarasa fixed sc': '更纱等宽 (Sarasa Fixed SC)',
        'noto sans sc': '思源黑体 (Noto Sans SC)',
        'lxgw wenkai': '霞鹜文楷 / 楷体 (LXGW WenKai)',
        'stkaiti': '华文楷体 (STKaiti)',
        'kaiti': '楷体 (KaiTi)',
        '楷体': '楷体 (KaiTi)',
        '楷体_gb2312': '楷体 (KaiTi)',
        'noto serif sc': '思源宋体 (Noto Serif SC)',
        'simsun': '宋体 (SimSun)',
        'songti sc': '苹方宋体 (Songti SC)',
        'stsong': '华文宋体 (STSong)',
        'youyuan': '幼圆 (YouYuan)',
        '幼圆': '幼圆 (YouYuan)',
        'pingfang sc': '苹方 (PingFang SC)',
        'hiragino sans gb': '冬青黑体 (Hiragino Sans GB)',
        'microsoft yahei': '微软雅黑 (Microsoft YaHei)',
        'misans': '小米黑体 (MiSans)',
        'harmonyos sans': '鸿蒙黑体 (HarmonyOS Sans)',
        'harmonyos sans sc': '鸿蒙黑体 (HarmonyOS Sans SC)',
        'oppo sans': 'OPPO Sans',
        'vivo sans': 'vivo Sans',
        'segoe ui': 'Segoe UI',
        'roboto': 'Roboto',
        'ui-monospace': '系统等宽 (UI Monospace)',
        'sfmono-regular': 'SF Mono 等宽',
        'menlo': 'Menlo 等宽',
        'monaco': 'Monaco 等宽',
        'consolas': 'Consolas 等宽',
        'liberation mono': 'Liberation Mono',
        'courier new': 'Courier New',
        'jetbrains mono': 'JetBrains Mono',
        'fira code': 'Fira Code',
        '霞鹜文楷': '霞鹜文楷 (LXGW WenKai)',
        'arial': 'Arial',
        'helvetica': 'Helvetica',
        '-apple-system': 'Apple 苹方 / San Francisco',
        'blinkmacsystemfont': 'Apple 苹方 / San Francisco',
        'system-ui': '系统原生字体 (System UI)',
        'sans-serif': '系统无衬线字体 (Sans-Serif)',
        'serif': '系统衬线字体 (Serif)',
        'monospace': '系统等宽字体 (Monospace)'
    };

    let canvasCache = null;
    function getCanvasContext() {
        if (typeof document === 'undefined') return null;
        if (!canvasCache) {
            canvasCache = document.createElement('canvas');
            canvasCache.width = 1600;
            canvasCache.height = 120;
        }
        return canvasCache.getContext('2d', { willReadFrequently: true });
    }

    /**
     * 检测某个指定字体在当前环境中是否真实可用
     */
    function isFontAvailable(fontName) {
        if (!fontName) return false;
        const cleanName = fontName.trim().replace(/^["']|["']$/g, '');
        if (!cleanName) return false;

        const lower = cleanName.toLowerCase();
        // 1. 项目内置离线字库直接返回可用
        if (BUNDLED_FONTS.has(lower)) {
            return true;
        }

        const genericFamilies = ['sans-serif', 'serif', 'monospace', 'cursive', 'fantasy', 'system-ui', 'ui-monospace'];
        if (genericFamilies.includes(lower)) {
            return true;
        }

        if (lower === '-apple-system' || lower === 'blinkmacsystemfont') {
            return typeof navigator !== 'undefined' && /Macintosh|Mac OS|iPhone|iPad|iPod/.test(navigator.userAgent);
        }

        // Web 离线字体检测
        if (typeof document !== 'undefined' && document.fonts && typeof document.fonts.check === 'function') {
            try {
                if (document.fonts.check(`16px "${cleanName}"`)) {
                    return true;
                }
            } catch (_) {}
        }

        const ctx = getCanvasContext();
        if (!ctx) return true;

        const baseWidths = {};
        for (const base of BASE_FONTS) {
            ctx.font = `${TEST_SIZE} ${base}`;
            baseWidths[base] = ctx.measureText(TEST_STRING).width;
        }

        let detected = false;
        for (const base of BASE_FONTS) {
            ctx.font = `${TEST_SIZE} "${cleanName}", ${base}`;
            const width = ctx.measureText(TEST_STRING).width;
            if (Math.abs(width - baseWidths[base]) > 0.5) {
                detected = true;
                break;
            }
        }

        return detected;
    }

    /**
     * 将 font-family 字符串拆解为独立字体候选数组
     */
    function parseFontStack(stackStr) {
        if (!stackStr) return [];
        return stackStr.split(',')
            .map(f => f.trim().replace(/^["']|["']$/g, ''))
            .filter(Boolean);
    }

    /**
     * 获取字体的人性化展示名称
     */
    function getFriendlyFontName(rawName) {
        if (!rawName) return '系统默认字体';
        const key = rawName.trim().toLowerCase().replace(/^["']|["']$/g, '');
        return FONT_NAME_MAP[key] || rawName.trim().replace(/^["']|["']$/g, '');
    }

    /**
     * 检测各预设在当前客户端环境下的真实可用状态
     */
    function getPresetAvailability(preset) {
        if (!preset) return { available: true, label: '系统支持', tagClass: 'tag-system' };

        if (preset.id === 'noto') {
            return {
                available: true,
                label: '内置离线',
                tagClass: 'tag-offline',
                note: 'App 内置思源黑体离线完整字库'
            };
        }
        if (preset.id === 'default') {
            return {
                available: true,
                label: '内置离线',
                tagClass: 'tag-primary',
                note: '更纱等宽优先，内置思源保底'
            };
        }
        if (preset.id === 'sarasa') {
            return {
                available: true,
                label: '内置离线',
                tagClass: 'tag-offline',
                note: 'App 内置更纱等宽离线字库（西文/数字 2:1 等宽对齐）'
            };
        }
        if (preset.id === 'kaiti') {
            return {
                available: true,
                label: '内置离线',
                tagClass: 'tag-offline',
                note: 'App 内置霞鹜文楷/楷体离线完整字库'
            };
        }
        if (preset.id === 'songti') {
            return {
                available: true,
                label: '内置离线',
                tagClass: 'tag-offline',
                note: 'App 内置思源宋体离线完整字库'
            };
        }
        if (preset.id === 'system') {
            return {
                available: true,
                label: '系统原生',
                tagClass: 'tag-system',
                note: '使用当前操作系统原生界面字体'
            };
        }
        if (preset.id === 'youyuan') {
            const hasYouYuan = isFontAvailable('YouYuan') || isFontAvailable('幼圆');
            return {
                available: true,
                label: hasYouYuan ? '系统已安装' : '圆润平滑',
                tagClass: 'tag-primary',
                note: '柔和圆润风格黑体'
            };
        }
        return {
            available: true,
            label: '自定义',
            tagClass: 'tag-custom',
            note: '自定义字体配置'
        };
    }

    /**
     * 检测操作系统的原生默认字体
     */
    function detectSystemDefaultFont(category = 'sans-serif') {
        const ua = typeof navigator !== 'undefined' ? navigator.userAgent : '';
        const isMac = /Macintosh|Mac OS|iPhone|iPad|iPod/.test(ua);
        const isWindows = /Windows NT/.test(ua);
        const isAndroid = /Android/.test(ua);

        if (category === 'serif') {
            return { rawName: 'Noto Serif SC', displayName: '思源宋体 (Noto Serif SC)', source: 'bundled', sourceText: '内置离线字库' };
        }
        if (category === 'monospace') {
            return { rawName: 'Sarasa UI SC', displayName: '更纱黑体 (Sarasa UI SC)', source: 'bundled', sourceText: '内置离线字库' };
        }

        if (isMac || isFontAvailable('PingFang SC')) {
            return { rawName: 'PingFang SC', displayName: '苹方 (PingFang SC)', source: 'system', sourceText: '系统原生' };
        }
        if (isFontAvailable('MiSans')) {
            return { rawName: 'MiSans', displayName: '小米黑体 (MiSans)', source: 'system', sourceText: '系统原生' };
        }
        if (isFontAvailable('HarmonyOS Sans') || isFontAvailable('HarmonyOS Sans SC')) {
            return { rawName: 'HarmonyOS Sans', displayName: '鸿蒙黑体 (HarmonyOS Sans)', source: 'system', sourceText: '系统原生' };
        }
        if (isFontAvailable('OPPO Sans')) {
            return { rawName: 'OPPO Sans', displayName: 'OPPO Sans', source: 'system', sourceText: '系统原生' };
        }
        if (isWindows || isFontAvailable('Microsoft YaHei')) {
            return { rawName: 'Microsoft YaHei', displayName: '微软雅黑 (Microsoft YaHei)', source: 'system', sourceText: '系统原生' };
        }
        if (isAndroid) {
            return { rawName: 'Roboto', displayName: 'Android 原生黑体 (Roboto)', source: 'system', sourceText: '系统原生' };
        }
        return { rawName: 'Noto Sans SC', displayName: '思源黑体 (Noto Sans SC)', source: 'bundled', sourceText: '内置离线字库' };
    }

    /**
     * 精确检测当前页面中实际生效渲染的字体
     */
    function detectActiveFont(customStackStr) {
        let stackStr = customStackStr;
        if (!stackStr && typeof document !== 'undefined') {
            stackStr = document.documentElement.style.getPropertyValue('--font-family');
            if (!stackStr && document.body) {
                stackStr = window.getComputedStyle(document.body).fontFamily;
            }
        }
        if (!stackStr) {
            stackStr = FONT_PRESETS[0].stack;
        }

        const stack = parseFontStack(stackStr);

        for (const font of stack) {
            const clean = font.trim().replace(/^["']|["']$/g, '');
            if (!clean) continue;

            const lower = clean.toLowerCase();
            if (BUNDLED_FONTS.has(lower)) {
                return {
                    rawName: clean,
                    displayName: getFriendlyFontName(clean),
                    source: 'bundled',
                    sourceText: '内置离线字库',
                    isAvailable: true,
                    stack: stackStr
                };
            }

            if (lower === '-apple-system' || lower === 'blinkmacsystemfont') {
                if (typeof navigator !== 'undefined' && /Macintosh|Mac OS|iPhone|iPad|iPod/.test(navigator.userAgent)) {
                    return {
                        rawName: 'PingFang SC',
                        displayName: '苹方 (PingFang SC)',
                        source: 'system',
                        sourceText: '系统原生',
                        isAvailable: true,
                        stack: stackStr
                    };
                }
                continue;
            }

            if (lower === 'system-ui') {
                const sys = detectSystemDefaultFont();
                return {
                    rawName: sys.rawName,
                    displayName: sys.displayName,
                    source: sys.source,
                    sourceText: sys.sourceText,
                    isAvailable: true,
                    stack: stackStr
                };
            }

            if (lower === 'sans-serif' || lower === 'serif' || lower === 'monospace' || lower === 'ui-monospace') {
                const sys = detectSystemDefaultFont(lower === 'serif' ? 'serif' : (lower.includes('mono') ? 'monospace' : 'sans-serif'));
                return {
                    rawName: sys.rawName,
                    displayName: sys.displayName,
                    source: 'fallback',
                    sourceText: '系统回退',
                    isAvailable: true,
                    stack: stackStr
                };
            }

            if (isFontAvailable(clean)) {
                return {
                    rawName: clean,
                    displayName: getFriendlyFontName(clean),
                    source: 'installed',
                    sourceText: '系统已安装',
                    isAvailable: true,
                    stack: stackStr
                };
            }
        }

        const fallbackSys = detectSystemDefaultFont();
        return {
            rawName: fallbackSys.rawName,
            displayName: fallbackSys.displayName,
            source: fallbackSys.source,
            sourceText: fallbackSys.sourceText,
            isAvailable: true,
            stack: stackStr
        };
    }

    /**
     * 根据 presetId 和 customFont 计算完整的 CSS font-family 字符串
     */
    function computeFontFamily(presetId, customFont) {
        if (presetId === 'custom') {
            const custom = (customFont || '').trim();
            if (custom) {
                return `"${custom}", "Noto Sans SC", -apple-system, "PingFang SC", "Microsoft YaHei", sans-serif`;
            }
            return '"Noto Sans SC", -apple-system, "PingFang SC", "Microsoft YaHei", sans-serif';
        }
        const preset = FONT_PRESETS.find(p => p.id === presetId) || FONT_PRESETS[0];
        return preset.stack;
    }

    /**
     * 立即应用字体到 DOM 根节点，并同步调整等宽数字特性
     */
    function applyFont(fontFamilyStr, presetId = '') {
        if (typeof document === 'undefined') return;
        const targetFont = fontFamilyStr || FONT_PRESETS[0].stack;
        document.documentElement.style.setProperty('--font-family', targetFont);
        if (document.body) {
            document.body.style.fontFamily = targetFont;
        }

        // 当选择更纱/等宽预设时，开启全局 tabular-nums 数字等宽特性
        if (presetId === 'sarasa' || presetId === 'default') {
            document.documentElement.style.setProperty('--font-numeric', 'tabular-nums');
            document.documentElement.style.setProperty('--font-features', '"tnum" 1');
        } else {
            document.documentElement.style.setProperty('--font-numeric', 'normal');
            document.documentElement.style.setProperty('--font-features', 'normal');
        }
    }

    /**
     * 监听外部通知或字体加载完成事件
     */
    const listeners = new Set();
    function subscribe(fn) {
        if (typeof fn === 'function') {
            listeners.add(fn);
        }
        return () => listeners.delete(fn);
    }

    function notifyChange(fontInfo) {
        listeners.forEach(fn => {
            try { fn(fontInfo); } catch (_) {}
        });
    }

    // 在字体加载完成后自动重新检测并刷新展示
    if (typeof document !== 'undefined' && document.fonts && document.fonts.ready) {
        document.fonts.ready.then(() => {
            const currentInfo = detectActiveFont();
            notifyChange(currentInfo);
        }).catch(() => {});
    }

    // 立即尝试从 localStorage 加载保存的字体，杜绝页面闪烁
    try {
        if (typeof localStorage !== 'undefined') {
            const raw = localStorage.getItem('tws4_grid_seat_store_v1');
            if (raw) {
                const parsed = JSON.parse(raw);
                if (parsed && (parsed.fontPreset || parsed.customFont)) {
                    applyFont(computeFontFamily(parsed.fontPreset, parsed.customFont), parsed.fontPreset);
                }
            }
        }
    } catch (_) {}

    const fontManager = {
        FONT_PRESETS,
        isFontAvailable,
        parseFontStack,
        getFriendlyFontName,
        getPresetAvailability,
        detectActiveFont,
        detectSystemDefaultFont,
        computeFontFamily,
        applyFont,
        subscribe,
        notifyChange
    };

    window.TWS3.fontManager = fontManager;
})();
