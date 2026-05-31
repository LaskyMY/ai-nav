package com.ainav.browser;

import android.annotation.SuppressLint;
import android.graphics.Color;
import android.graphics.drawable.GradientDrawable;
import android.os.Bundle;
import android.os.Handler;
import android.os.Looper;
import android.view.Gravity;
import android.view.View;
import android.view.WindowInsets;
import android.view.WindowInsetsController;
import android.webkit.GeolocationPermissions;
import android.webkit.WebChromeClient;
import android.webkit.WebSettings;
import android.webkit.WebView;
import android.webkit.WebViewClient;
import android.widget.Button;
import android.widget.FrameLayout;
import android.widget.Toast;

import androidx.appcompat.app.AppCompatActivity;

public class MainActivity extends AppCompatActivity {

    private WebView webView;
    private Button refreshBtn;
    private boolean isRefreshing = false;
    private Handler handler = new Handler(Looper.getMainLooper());
    private Runnable hideBtnRunnable;

    @SuppressLint("SetJavaScriptEnabled")
    @Override
    protected void onCreate(Bundle savedInstanceState) {
        super.onCreate(savedInstanceState);

        FrameLayout root = new FrameLayout(this);

        webView = new WebView(this);
        FrameLayout.LayoutParams wvParams = new FrameLayout.LayoutParams(
            FrameLayout.LayoutParams.MATCH_PARENT,
            FrameLayout.LayoutParams.MATCH_PARENT
        );
        root.addView(webView, wvParams);

        // Semi-transparent refresh button — hidden by default
        refreshBtn = new Button(this);
        refreshBtn.setText("↻"); // ↻
        refreshBtn.setTextColor(Color.argb(180, 0, 210, 255)); // semi-transparent cyan
        refreshBtn.setTextSize(22);
        refreshBtn.setGravity(Gravity.CENTER);
        refreshBtn.setPadding(0, 0, 0, 0);
        refreshBtn.setIncludeFontPadding(false);

        GradientDrawable bg = new GradientDrawable();
        bg.setShape(GradientDrawable.OVAL);
        bg.setColor(Color.argb(60, 0, 210, 255)); // very transparent
        bg.setStroke(1, Color.argb(60, 0, 210, 255));
        refreshBtn.setBackground(bg);

        int btnSize = dpToPx(42);
        FrameLayout.LayoutParams btnParams = new FrameLayout.LayoutParams(btnSize, btnSize);
        btnParams.gravity = Gravity.BOTTOM | Gravity.END;
        btnParams.setMargins(0, 0, dpToPx(10), dpToPx(10));
        root.addView(refreshBtn, btnParams);

        refreshBtn.setVisibility(View.GONE); // hidden initially

        refreshBtn.setOnClickListener(new View.OnClickListener() {
            @Override
            public void onClick(View v) {
                if (isRefreshing) return;
                isRefreshing = true;
                refreshBtn.setAlpha(0.4f);
                webView.reload();
                Toast.makeText(MainActivity.this, "已刷新", Toast.LENGTH_SHORT).show();
                handler.postDelayed(new Runnable() {
                    @Override
                    public void run() {
                        isRefreshing = false;
                        refreshBtn.setAlpha(1.0f);
                        scheduleHideBtn();
                    }
                }, 1500);
            }
        });

        // Tap anywhere on screen to show refresh button
        root.setOnClickListener(new View.OnClickListener() {
            @Override
            public void onClick(View v) {
                showRefreshBtn();
            }
        });

        setContentView(root);
        hideSystemUI();

        WebSettings s = webView.getSettings();
        s.setJavaScriptEnabled(true);
        s.setDomStorageEnabled(true);
        s.setDatabaseEnabled(true);
        s.setGeolocationEnabled(true);
        s.setAllowFileAccess(true);
        s.setAllowContentAccess(true);
        s.setCacheMode(WebSettings.LOAD_DEFAULT);
        s.setMixedContentMode(WebSettings.MIXED_CONTENT_ALWAYS_ALLOW);
        s.setUseWideViewPort(true);
        s.setLoadWithOverviewMode(true);
        s.setSupportZoom(false);
        s.setBuiltInZoomControls(false);

        webView.setWebViewClient(new WebViewClient());
        webView.setWebChromeClient(new WebChromeClient() {
            @Override
            public void onGeolocationPermissionsShowPrompt(String origin, GeolocationPermissions.Callback callback) {
                callback.invoke(origin, true, false);
            }
        });

        webView.loadUrl("https://c46872d35aeba559-183-6-87-29.serveousercontent.com/clock-old.html");
    }

    private void showRefreshBtn() {
        refreshBtn.setVisibility(View.VISIBLE);
        refreshBtn.setAlpha(0.0f);
        refreshBtn.animate().alpha(1.0f).setDuration(200).start();
        scheduleHideBtn();
    }

    private void scheduleHideBtn() {
        if (hideBtnRunnable != null) handler.removeCallbacks(hideBtnRunnable);
        hideBtnRunnable = new Runnable() {
            @Override
            public void run() {
                refreshBtn.animate().alpha(0.0f).setDuration(400).withEndAction(new Runnable() {
                    @Override
                    public void run() {
                        refreshBtn.setVisibility(View.GONE);
                    }
                }).start();
            }
        };
        handler.postDelayed(hideBtnRunnable, 3000);
    }

    private int dpToPx(int dp) {
        return Math.round(dp * getResources().getDisplayMetrics().density);
    }

    @Override
    public void onBackPressed() {
        if (webView.canGoBack()) {
            webView.goBack();
        } else {
            super.onBackPressed();
        }
    }

    @Override
    protected void onResume() {
        super.onResume();
        webView.onResume();
        hideSystemUI();
    }

    @Override
    protected void onPause() {
        webView.onPause();
        super.onPause();
    }

    @Override
    protected void onDestroy() {
        if (webView != null) webView.destroy();
        super.onDestroy();
    }

    @Override
    public void onWindowFocusChanged(boolean hasFocus) {
        super.onWindowFocusChanged(hasFocus);
        if (hasFocus) hideSystemUI();
    }

    private void hideSystemUI() {
        if (android.os.Build.VERSION.SDK_INT >= 30) {
            getWindow().setDecorFitsSystemWindows(false);
            WindowInsetsController ctrl = getWindow().getInsetsController();
            if (ctrl != null) {
                ctrl.hide(WindowInsets.Type.systemBars());
                ctrl.setSystemBarsBehavior(WindowInsetsController.BEHAVIOR_SHOW_TRANSIENT_BARS_BY_SWIPE);
            }
        } else {
            getWindow().getDecorView().setSystemUiVisibility(
                View.SYSTEM_UI_FLAG_LAYOUT_STABLE
                | View.SYSTEM_UI_FLAG_LAYOUT_HIDE_NAVIGATION
                | View.SYSTEM_UI_FLAG_LAYOUT_FULLSCREEN
                | View.SYSTEM_UI_FLAG_HIDE_NAVIGATION
                | View.SYSTEM_UI_FLAG_FULLSCREEN
                | View.SYSTEM_UI_FLAG_IMMERSIVE_STICKY
            );
        }
        getWindow().getDecorView().setOnSystemUiVisibilityChangeListener(new View.OnSystemUiVisibilityChangeListener() {
            @Override
            public void onSystemUiVisibilityChange(int visibility) {
                if ((visibility & View.SYSTEM_UI_FLAG_FULLSCREEN) == 0) hideSystemUI();
            }
        });
    }
}
