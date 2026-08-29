package com.tws4.app;

import android.content.ContentValues;
import android.content.Intent;
import android.net.Uri;
import android.os.Build;
import android.os.Bundle;
import android.os.Environment;
import android.provider.MediaStore;
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
import java.io.OutputStream;

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
            return saveFileInternal(base64Data, fileName, null);
        }

        @JavascriptInterface
        public boolean saveFile(String base64Data, String fileName, String mimeType) {
            return saveFileInternal(base64Data, fileName, mimeType);
        }

        private boolean saveFileInternal(String base64Data, String fileName, String mimeType) {
            if (base64Data == null || fileName == null || fileName.trim().isEmpty()) {
                return false;
            }

            try {
                byte[] bytes = decodeBase64(base64Data);
                if (bytes == null || bytes.length == 0) {
                    runOnUiThread(() -> Toast.makeText(MainActivity.this, "文件数据为空", Toast.LENGTH_SHORT).show());
                    return false;
                }

                String cleanFileName = fileName.trim();
                String effectiveMimeType = (mimeType != null && !mimeType.isEmpty()) ? mimeType : resolveMimeType(cleanFileName);
                boolean success = false;
                String targetDescription = "系统「下载」目录";

                // Android 10 (Q, API 29)+: 使用 MediaStore.Downloads 写入公共下载目录
                if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.Q) {
                    try {
                        ContentValues values = new ContentValues();
                        values.put(MediaStore.MediaColumns.DISPLAY_NAME, cleanFileName);
                        values.put(MediaStore.MediaColumns.MIME_TYPE, effectiveMimeType);
                        values.put(MediaStore.MediaColumns.RELATIVE_PATH, Environment.DIRECTORY_DOWNLOADS + "/TWS4");

                        Uri uri = getContentResolver().insert(MediaStore.Downloads.EXTERNAL_CONTENT_URI, values);
                        if (uri != null) {
                            try (OutputStream os = getContentResolver().openOutputStream(uri)) {
                                if (os != null) {
                                    os.write(bytes);
                                    os.flush();
                                    success = true;
                                    targetDescription = "下载/TWS4/" + cleanFileName;
                                }
                            }
                        }
                    } catch (Exception e) {
                        e.printStackTrace();
                    }
                }

                // 低版本 Android 或 MediaStore 写入失败时的回退逻辑
                if (!success) {
                    try {
                        File downloadDir = Environment.getExternalStoragePublicDirectory(Environment.DIRECTORY_DOWNLOADS);
                        File tws4Dir = new File(downloadDir, "TWS4");
                        if (!tws4Dir.exists()) {
                            tws4Dir.mkdirs();
                        }
                        File destFile = new File(tws4Dir.exists() ? tws4Dir : downloadDir, cleanFileName);
                        try (FileOutputStream fos = new FileOutputStream(destFile)) {
                            fos.write(bytes);
                            fos.flush();
                            success = true;
                            targetDescription = (tws4Dir.exists() ? "下载/TWS4/" : "下载/") + cleanFileName;
                        }
                    } catch (Exception e) {
                        e.printStackTrace();
                    }
                }

                // 外部公共目录均失败时的应用私有目录回退
                if (!success) {
                    try {
                        File fallbackDir = getExternalFilesDir(Environment.DIRECTORY_DOWNLOADS);
                        if (fallbackDir == null) {
                            fallbackDir = getFilesDir();
                        }
                        File destFile = new File(fallbackDir, cleanFileName);
                        try (FileOutputStream fos = new FileOutputStream(destFile)) {
                            fos.write(bytes);
                            fos.flush();
                            success = true;
                            targetDescription = destFile.getAbsolutePath();
                        }
                    } catch (Exception e) {
                        e.printStackTrace();
                    }
                }

                final boolean finalSuccess = success;
                final String finalDesc = targetDescription;
                runOnUiThread(() -> {
                    String msg = finalSuccess ? ("已导出至 " + finalDesc) : "文件导出失败";
                    Toast.makeText(MainActivity.this, msg, Toast.LENGTH_LONG).show();
                });

                return success;
            } catch (Exception e) {
                e.printStackTrace();
                runOnUiThread(() -> Toast.makeText(MainActivity.this, "导出异常: " + e.getMessage(), Toast.LENGTH_SHORT).show());
                return false;
            }
        }

        @JavascriptInterface
        public void shareFile(String base64Data, String fileName) {
            try {
                byte[] bytes = decodeBase64(base64Data);
                if (bytes == null || bytes.length == 0) return;

                File shareDir = new File(getCacheDir(), "shared_export");
                if (!shareDir.exists()) shareDir.mkdirs();
                File targetFile = new File(shareDir, fileName);
                try (FileOutputStream fos = new FileOutputStream(targetFile)) {
                    fos.write(bytes);
                    fos.flush();
                }

                Uri fileUri = FileProvider.getUriForFile(MainActivity.this, getPackageName() + ".fileprovider", targetFile);
                Intent intent = new Intent(Intent.ACTION_SEND);
                intent.setType(resolveMimeType(fileName));
                intent.putExtra(Intent.EXTRA_STREAM, fileUri);
                intent.addFlags(Intent.FLAG_GRANT_READ_URI_PERMISSION);

                Intent chooser = Intent.createChooser(intent, "分享 / 导出文件");
                chooser.addFlags(Intent.FLAG_ACTIVITY_NEW_TASK);
                startActivity(chooser);
            } catch (Exception e) {
                e.printStackTrace();
                runOnUiThread(() -> Toast.makeText(MainActivity.this, "分享失败: " + e.getMessage(), Toast.LENGTH_SHORT).show());
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
