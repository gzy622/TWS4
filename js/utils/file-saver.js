(function() {
    window.TWS3 = window.TWS3 || {};

    /**
     * 全局文件保存/导出方法
     * 兼容浏览器环境与 Android (Capacitor 原生 WebView)
     * @param {Blob|File} blob 二进制数据对象
     * @param {string} fileName 导出的文件名
     * @returns {Promise<boolean>}
     */
    async function saveBlob(blob, fileName) {
        if (!blob || !fileName) return false;

        // 1. Android 原生桥接层检测与调用
        if (window.AndroidFiles && typeof window.AndroidFiles.saveFile === 'function') {
            return new Promise((resolve) => {
                const reader = new FileReader();
                reader.onload = () => {
                    try {
                        const result = window.AndroidFiles.saveFile(reader.result, fileName);
                        resolve(result !== false);
                    } catch (e) {
                        console.error('Android 原生保存异常:', e);
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

        // 2. 浏览器环境标准 <a> 标签下载
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
