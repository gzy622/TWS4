(function() {
    window.TWS3 = window.TWS3 || {};

    const pendingScripts = new Map();

    function loadScriptOnce(src, isReady) {
        if (isReady()) return Promise.resolve();
        if (pendingScripts.has(src)) return pendingScripts.get(src);

        const promise = new Promise((resolve, reject) => {
            const script = document.createElement('script');
            script.src = src;
            script.async = true;
            script.onload = () => isReady()
                ? resolve()
                : reject(new Error(`依赖加载后不可用: ${src}`));
            script.onerror = () => reject(new Error(`依赖加载失败: ${src}`));
            document.head.appendChild(script);
        }).catch(error => {
            pendingScripts.delete(src);
            throw error;
        });

        pendingScripts.set(src, promise);
        return promise;
    }

    async function ensureJSZip() {
        await loadScriptOnce('js/vendor/jszip.min.js', () => typeof window.JSZip === 'function');
        return window.JSZip;
    }

    window.TWS3.dependencies = { loadScriptOnce, ensureJSZip };
})();
