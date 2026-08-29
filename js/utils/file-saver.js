(function() {
    window.TWS3 = window.TWS3 || {};

    function resolveMimeType(fileName) {
        if (!fileName) return 'application/octet-stream';
        const lower = fileName.toLowerCase();
        if (lower.endsWith('.xlsx')) return 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet';
        if (lower.endsWith('.xls')) return 'application/vnd.ms-excel';
        if (lower.endsWith('.json')) return 'application/json';
        if (lower.endsWith('.csv')) return 'text/csv';
        if (lower.endsWith('.txt')) return 'text/plain';
        return 'application/octet-stream';
    }

    /**
     * 全局文件导出/分享方法
     * 优先调用系统原生分享功能（Capacitor 原生桥接 / Web Share API），在不支持的环境下回退为浏览器标准下载
     * @param {Blob|File} blob 二进制数据对象
     * @param {string} fileName 导出的文件名
     * @returns {Promise<boolean>}
     */
    async function saveBlob(blob, fileName) {
        if (!blob || !fileName) return false;

        // 1. Android 原生套壳桥接层：调起系统分享
        if (window.AndroidFiles && (typeof window.AndroidFiles.shareFile === 'function' || typeof window.AndroidFiles.saveFile === 'function')) {
            return new Promise((resolve) => {
                const reader = new FileReader();
                reader.onload = () => {
                    try {
                        const handler = typeof window.AndroidFiles.shareFile === 'function'
                            ? window.AndroidFiles.shareFile
                            : window.AndroidFiles.saveFile;
                        const result = handler.call(window.AndroidFiles, reader.result, fileName);
                        resolve(result !== false);
                    } catch (e) {
                        console.error('Android 原生分享异常:', e);
                        resolve(false);
                    }
                };
                reader.onerror = () => {
                    if (window.TWS3.showToast) window.TWS3.showToast('读取文件数据失败');
                    resolve(false);
                };
                reader.readAsDataURL(blob);
            });
        }

        // 2. 现代浏览器 Web Share API (移动端浏览器等支持文件分享的环境)
        if (navigator.share && typeof navigator.canShare === 'function') {
            try {
                const mimeType = blob.type || resolveMimeType(fileName);
                const file = new File([blob], fileName, { type: mimeType });
                if (navigator.canShare({ files: [file] })) {
                    await navigator.share({
                        files: [file],
                        title: fileName
                    });
                    return true;
                }
            } catch (err) {
                // 用户主动取消分享 (AbortError) 则直接返回
                if (err.name === 'AbortError') {
                    return true;
                }
                console.warn('Web Share 失败，降级使用标准下载:', err);
            }
        }

        // 3. 桌面端或不支持分享的浏览器环境：标准 <a> 标签下载
        try {
            const url = URL.createObjectURL(blob);
            const link = document.createElement('a');
            link.style.display = 'none';
            link.setAttribute('href', url);
            link.setAttribute('download', fileName);
            document.body.appendChild(link);
            link.click();
            setTimeout(() => {
                if (link.parentNode) {
                    document.body.removeChild(link);
                }
                URL.revokeObjectURL(url);
            }, 1000);
            return true;
        } catch (e) {
            console.error('浏览器环境导出文件失败:', e);
            return false;
        }
    }

    window.TWS3.saveBlob = saveBlob;
})();
