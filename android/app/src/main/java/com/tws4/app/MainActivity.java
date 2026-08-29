package com.tws4.app;

import android.content.Intent;
import android.net.Uri;
import android.os.Bundle;
import android.util.Base64;
import android.webkit.JavascriptInterface;
import android.webkit.WebView;
import android.widget.Toast;
import androidx.core.content.FileProvider;
import androidx.core.view.WindowCompat;
import androidx.core.view.WindowInsetsControllerCompat;
import com.getcapacitor.BridgeActivity;
import java.io.File;
import java.io.FileOutputStream;

public class MainActivity extends BridgeActivity {
    @Override
    public void onCreate(Bundle savedInstanceState) {
        super.onCreate(savedInstanceState);
        WindowInsetsControllerCompat controller = WindowCompat.getInsetsController(getWindow(), getWindow().getDecorView());
        if (controller != null) {
            controller.setAppearanceLightStatusBars(true);
        }

        if (getBridge() != null && getBridge().getWebView() != null) {
            getBridge().getWebView().addJavascriptInterface(new AndroidFilesBridge(), "AndroidFiles");
        }
    }

    public class AndroidFilesBridge {
        @JavascriptInterface
        public boolean saveFile(String base64Data, String fileName) {
            return shareFileInternal(base64Data, fileName, null);
        }

        @JavascriptInterface
        public boolean saveFile(String base64Data, String fileName, String mimeType) {
            return shareFileInternal(base64Data, fileName, mimeType);
        }

        @JavascriptInterface
        public boolean shareFile(String base64Data, String fileName) {
            return shareFileInternal(base64Data, fileName, null);
        }

        @JavascriptInterface
        public boolean shareFile(String base64Data, String fileName, String mimeType) {
            return shareFileInternal(base64Data, fileName, mimeType);
        }

        private boolean shareFileInternal(String base64Data, String fileName, String mimeType) {
            if (base64Data == null || fileName == null || fileName.trim().isEmpty()) {
                return false;
            }

            try {
                byte[] bytes = decodeBase64(base64Data);
                if (bytes == null || bytes.length == 0) {
                    runOnUiThread(() -> Toast.makeText(MainActivity.this, "导出文件数据为空", Toast.LENGTH_SHORT).show());
                    return false;
                }

                String cleanFileName = fileName.trim();
                String effectiveMimeType = (mimeType != null && !mimeType.isEmpty()) ? mimeType : resolveMimeType(cleanFileName);

                File exportDir = new File(getCacheDir(), "shared_export");
                if (!exportDir.exists()) {
                    exportDir.mkdirs();
                }

                File targetFile = new File(exportDir, cleanFileName);
                try (FileOutputStream fos = new FileOutputStream(targetFile)) {
                    fos.write(bytes);
                    fos.flush();
                }

                Uri fileUri = FileProvider.getUriForFile(MainActivity.this, getPackageName() + ".fileprovider", targetFile);

                Intent intent = new Intent(Intent.ACTION_SEND);
                intent.setType(effectiveMimeType);
                intent.putExtra(Intent.EXTRA_STREAM, fileUri);
                intent.putExtra(Intent.EXTRA_SUBJECT, cleanFileName);
                intent.addFlags(Intent.FLAG_GRANT_READ_URI_PERMISSION);

                Intent chooser = Intent.createChooser(intent, "处理导出的文件");
                chooser.addFlags(Intent.FLAG_ACTIVITY_NEW_TASK);
                startActivity(chooser);

                return true;
            } catch (Exception e) {
                e.printStackTrace();
                runOnUiThread(() -> Toast.makeText(MainActivity.this, "调起系统分享失败: " + e.getMessage(), Toast.LENGTH_SHORT).show());
                return false;
            }
        }

        @JavascriptInterface
        public void exit() {
            runOnUiThread(MainActivity.this::finish);
        }

        private byte[] decodeBase64(String data) {
            if (data == null) return null;
            String raw = data;
            int comma = raw.indexOf(",");
            if (comma != -1) {
                raw = raw.substring(comma + 1);
            }
            return Base64.decode(raw, Base64.DEFAULT);
        }

        private String resolveMimeType(String fileName) {
            if (fileName == null) return "application/octet-stream";
            String lower = fileName.toLowerCase();
            if (lower.endsWith(".xlsx")) return "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet";
            if (lower.endsWith(".xls")) return "application/vnd.ms-excel";
            if (lower.endsWith(".json")) return "application/json";
            if (lower.endsWith(".csv")) return "text/csv";
            if (lower.endsWith(".txt")) return "text/plain";
            return "application/octet-stream";
        }
    }
}
