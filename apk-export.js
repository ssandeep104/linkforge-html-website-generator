/* =====================================================
   LINKFORGE — Fire TV / Android app export

   Packages the generated "Fire TV App" template HTML into a complete,
   ready-to-build Android app project and downloads it as a .zip:

     <slug>-firetv/
       README.md                      how to build + sideload the APK
       .github/workflows/build-apk.yml  CI that produces the .apk for you
       settings.gradle / build.gradle / gradle.properties
       app/build.gradle
       app/src/main/AndroidManifest.xml   leanback launcher, remote-first
       app/src/main/java/com/linkforge/tvapp/MainActivity.java  WebView wrapper
       app/src/main/res/...               generated banner + launcher icon
       app/src/main/assets/index.html     the generated site

   A browser cannot compile an APK (that needs the Android SDK), so the
   export is a one-click-buildable project: push it to GitHub and the
   bundled workflow hands back the signed debug .apk as an artifact, or
   open the folder in Android Studio and press Build.

   The zip is assembled fully client-side (STORED entries, no deps).
   ===================================================== */

(function () {
  'use strict';

  // ---------- minimal ZIP writer (method 0 = stored) ----------
  const CRC_TABLE = (() => {
    const t = new Int32Array(256);
    for (let n = 0; n < 256; n++) {
      let c = n;
      for (let k = 0; k < 8; k++) c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1;
      t[n] = c;
    }
    return t;
  })();

  function crc32(u8) {
    let c = -1;
    for (let i = 0; i < u8.length; i++) c = CRC_TABLE[(c ^ u8[i]) & 0xff] ^ (c >>> 8);
    return (c ^ -1) >>> 0;
  }

  function dosDateTime(d) {
    return {
      time: (d.getHours() << 11) | (d.getMinutes() << 5) | (d.getSeconds() >> 1),
      date: (((d.getFullYear() - 1980) & 0x7f) << 9) | ((d.getMonth() + 1) << 5) | d.getDate(),
    };
  }

  // files: [{ name: 'path/in/zip', data: Uint8Array }]
  function makeZip(files) {
    const enc = new TextEncoder();
    const now = dosDateTime(new Date());
    const chunks = [];
    const central = [];
    let offset = 0;

    for (const f of files) {
      const nameBytes = enc.encode(f.name);
      const crc = crc32(f.data);
      const local = new DataView(new ArrayBuffer(30));
      local.setUint32(0, 0x04034b50, true);
      local.setUint16(4, 20, true);          // version needed
      local.setUint16(6, 0x0800, true);      // UTF-8 names
      local.setUint16(8, 0, true);           // stored
      local.setUint16(10, now.time, true);
      local.setUint16(12, now.date, true);
      local.setUint32(14, crc, true);
      local.setUint32(18, f.data.length, true);
      local.setUint32(22, f.data.length, true);
      local.setUint16(26, nameBytes.length, true);
      local.setUint16(28, 0, true);
      chunks.push(new Uint8Array(local.buffer), nameBytes, f.data);

      const cd = new DataView(new ArrayBuffer(46));
      cd.setUint32(0, 0x02014b50, true);
      cd.setUint16(4, 20, true);
      cd.setUint16(6, 20, true);
      cd.setUint16(8, 0x0800, true);
      cd.setUint16(10, 0, true);
      cd.setUint16(12, now.time, true);
      cd.setUint16(14, now.date, true);
      cd.setUint32(16, crc, true);
      cd.setUint32(20, f.data.length, true);
      cd.setUint32(24, f.data.length, true);
      cd.setUint16(28, nameBytes.length, true);
      cd.setUint32(42, offset, true);        // local header offset
      central.push(new Uint8Array(cd.buffer), nameBytes);

      offset += 30 + nameBytes.length + f.data.length;
    }

    let cdSize = 0;
    for (const c of central) cdSize += c.length;
    const eocd = new DataView(new ArrayBuffer(22));
    eocd.setUint32(0, 0x06054b50, true);
    eocd.setUint16(8, files.length, true);
    eocd.setUint16(10, files.length, true);
    eocd.setUint32(12, cdSize, true);
    eocd.setUint32(16, offset, true);
    return new Blob([...chunks, ...central, new Uint8Array(eocd.buffer)], { type: 'application/zip' });
  }

  // ---------- generated artwork (banner + launcher icon) ----------
  function canvasPng(width, height, draw) {
    const canvas = document.createElement('canvas');
    canvas.width = width;
    canvas.height = height;
    draw(canvas.getContext('2d'), width, height);
    return new Promise((resolve, reject) => {
      canvas.toBlob(async (blob) => {
        if (!blob) return reject(new Error('canvas.toBlob failed'));
        resolve(new Uint8Array(await blob.arrayBuffer()));
      }, 'image/png');
    });
  }

  function drawBase(g, w, h) {
    const grad = g.createLinearGradient(0, 0, w, h);
    grad.addColorStop(0, '#12151c');
    grad.addColorStop(1, '#0a0c10');
    g.fillStyle = grad;
    g.fillRect(0, 0, w, h);
    g.fillStyle = '#fbbf24';
    g.beginPath();
    g.arc(w * 0.92, h * 0.08, Math.max(w, h) * 0.2, 0, Math.PI * 2);
    g.globalAlpha = 0.28;
    g.fill();
    g.globalAlpha = 1;
  }

  // 320x180 Fire TV launcher banner (referenced by android:banner)
  function bannerPng(title) {
    return canvasPng(320, 180, (g, w, h) => {
      drawBase(g, w, h);
      g.fillStyle = '#fbbf24';
      g.beginPath();
      g.moveTo(34, 70); g.lineTo(34, 98); g.lineTo(58, 84);
      g.closePath();
      g.fill();
      g.fillStyle = '#f4f4f5';
      g.font = '600 22px "Segoe UI", Roboto, sans-serif';
      let label = title || 'Linkforge TV';
      while (label.length > 1 && g.measureText(label).width > w - 100) label = label.slice(0, -1);
      g.fillText(label + (label !== (title || 'Linkforge TV') ? '…' : ''), 72, 92);
      g.fillStyle = '#8b92a0';
      g.font = '500 11px "Segoe UI", Roboto, sans-serif';
      g.fillText('MADE WITH LINKFORGE', 72, 114);
    });
  }

  // 192x192 launcher icon
  function iconPng(title) {
    return canvasPng(192, 192, (g, w, h) => {
      drawBase(g, w, h);
      g.fillStyle = '#fbbf24';
      g.beginPath();
      g.moveTo(72, 62); g.lineTo(72, 130); g.lineTo(132, 96);
      g.closePath();
      g.fill();
      g.fillStyle = '#f4f4f5';
      g.font = '700 26px "Segoe UI", Roboto, sans-serif';
      g.textAlign = 'center';
      g.fillText((title || 'L').trim().charAt(0).toUpperCase(), w / 2, 168);
    });
  }

  // ---------- Android project sources ----------
  function appIdSuffix(slug) {
    const clean = String(slug || '').toLowerCase().replace(/[^a-z0-9]/g, '');
    if (!clean) return 'app';
    return /^[0-9]/.test(clean) ? 'a' + clean : clean;
  }

  const MAIN_ACTIVITY = `package com.linkforge.tvapp;

import android.annotation.SuppressLint;
import android.app.Activity;
import android.os.Bundle;
import android.view.View;
import android.webkit.ValueCallback;
import android.webkit.WebChromeClient;
import android.webkit.WebSettings;
import android.webkit.WebView;
import android.webkit.WebViewClient;
import android.widget.FrameLayout;

/**
 * Fullscreen WebView wrapper around the Linkforge-generated TV page.
 *
 * Remote support comes for free: Fire TV delivers the D-pad to the WebView
 * as arrow-key events and the center button as Enter, which the bundled
 * page's spatial-navigation script consumes. Only BACK needs plumbing —
 * Android routes it to the Activity, so we offer it to the page first
 * (window.lfBack() closes the video player / resets focus) and fall back
 * to WebView history, then to leaving the app.
 */
public class MainActivity extends Activity {
    private WebView webView;
    private FrameLayout root;
    private View fullscreenView;
    private WebChromeClient.CustomViewCallback fullscreenCallback;

    @SuppressLint("SetJavaScriptEnabled")
    @Override
    protected void onCreate(Bundle savedInstanceState) {
        super.onCreate(savedInstanceState);
        root = new FrameLayout(this);
        webView = new WebView(this);
        root.addView(webView);
        setContentView(root);

        WebSettings s = webView.getSettings();
        s.setJavaScriptEnabled(true);
        s.setDomStorageEnabled(true);
        s.setMediaPlaybackRequiresUserGesture(false);
        s.setUseWideViewPort(true);
        s.setLoadWithOverviewMode(true);
        s.setMixedContentMode(WebSettings.MIXED_CONTENT_ALWAYS_ALLOW);

        webView.setBackgroundColor(0xFF0A0C10);
        webView.setWebViewClient(new WebViewClient());
        webView.setWebChromeClient(new WebChromeClient() {
            @Override
            public void onShowCustomView(View view, CustomViewCallback callback) {
                if (fullscreenView != null) { callback.onCustomViewHidden(); return; }
                fullscreenView = view;
                fullscreenCallback = callback;
                webView.setVisibility(View.GONE);
                root.addView(view, new FrameLayout.LayoutParams(
                        FrameLayout.LayoutParams.MATCH_PARENT,
                        FrameLayout.LayoutParams.MATCH_PARENT));
            }

            @Override
            public void onHideCustomView() {
                exitFullscreen();
            }
        });

        webView.setFocusable(true);
        webView.setFocusableInTouchMode(true);
        webView.loadUrl("file:///android_asset/index.html");
    }

    @Override
    public void onWindowFocusChanged(boolean hasFocus) {
        super.onWindowFocusChanged(hasFocus);
        // Requesting focus in onCreate is too early: the Activity's window
        // doesn't reliably hold input focus yet on Fire TV, so D-pad key
        // events can miss the WebView. Doing it here, once the window
        // actually has focus, is what makes remote input land reliably.
        if (hasFocus) webView.requestFocus();
    }

    private void exitFullscreen() {
        if (fullscreenView == null) return;
        root.removeView(fullscreenView);
        fullscreenView = null;
        if (fullscreenCallback != null) fullscreenCallback.onCustomViewHidden();
        fullscreenCallback = null;
        webView.setVisibility(View.VISIBLE);
    }

    @Override
    public void onBackPressed() {
        if (fullscreenView != null) {
            exitFullscreen();
            return;
        }
        webView.evaluateJavascript(
                "window.lfBack ? window.lfBack() : false",
                new ValueCallback<String>() {
                    @Override
                    public void onReceiveValue(String handled) {
                        if ("true".equals(handled)) return;
                        runOnUiThread(new Runnable() {
                            @Override
                            public void run() {
                                if (webView.canGoBack()) webView.goBack();
                                else finish();
                            }
                        });
                    }
                });
    }

    @Override
    protected void onPause() {
        super.onPause();
        webView.onPause();
    }

    @Override
    protected void onResume() {
        super.onResume();
        webView.onResume();
    }

    @Override
    protected void onDestroy() {
        webView.destroy();
        super.onDestroy();
    }
}
`;

  function manifestXml() {
    return `<?xml version="1.0" encoding="utf-8"?>
<manifest xmlns:android="http://schemas.android.com/apk/res/android">

    <uses-permission android:name="android.permission.INTERNET" />

    <!-- Installable on TVs (leanback) AND phones/tablets; nothing is required. -->
    <uses-feature android:name="android.software.leanback" android:required="false" />
    <uses-feature android:name="android.hardware.touchscreen" android:required="false" />

    <application
        android:allowBackup="true"
        android:banner="@drawable/banner"
        android:icon="@mipmap/ic_launcher"
        android:label="@string/app_name"
        android:theme="@android:style/Theme.Black.NoTitleBar.Fullscreen"
        android:usesCleartextTraffic="true">

        <activity
            android:name=".MainActivity"
            android:configChanges="keyboard|keyboardHidden|orientation|screenLayout|screenSize|smallestScreenSize|uiMode"
            android:exported="true"
            android:screenOrientation="landscape">
            <intent-filter>
                <action android:name="android.intent.action.MAIN" />
                <category android:name="android.intent.category.LAUNCHER" />
                <!-- Shows up in the Fire TV / Android TV launcher row. -->
                <category android:name="android.intent.category.LEANBACK_LAUNCHER" />
            </intent-filter>
        </activity>
    </application>

</manifest>
`;
  }

  function appGradle(slug) {
    return `plugins {
    id 'com.android.application'
}

android {
    namespace 'com.linkforge.tvapp'
    compileSdk 34

    defaultConfig {
        applicationId 'com.linkforge.${appIdSuffix(slug)}'
        minSdk 21
        targetSdk 34
        versionCode 1
        versionName '1.0'
    }

    buildTypes {
        release {
            minifyEnabled false
        }
    }
}
`;
  }

  function workflowYml() {
    return `# Builds the sideloadable Fire TV APK on every push (and on demand).
# Grab it afterwards: Actions -> latest run -> Artifacts -> firetv-apk.
name: Build Fire TV APK

on:
  push:
    branches: [ main, master ]
  workflow_dispatch:

jobs:
  build:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4

      - uses: actions/setup-java@v4
        with:
          distribution: temurin
          java-version: '17'

      - uses: gradle/actions/setup-gradle@v4
        with:
          gradle-version: '8.7'

      - name: Build debug APK
        run: gradle assembleDebug

      - uses: actions/upload-artifact@v4
        with:
          name: firetv-apk
          path: app/build/outputs/apk/debug/app-debug.apk
`;
  }

  function readmeMd(title) {
    return `# ${title} — Fire TV app

This folder is a complete Android app project generated by
[Linkforge](https://github.com/ssandeep104/linkforge-html-website-generator).
It wraps your generated TV page (\`app/src/main/assets/index.html\`) in a
fullscreen WebView tuned for the living room:

- **Works with the standard Fire TV remote** — D-pad browses the shelves,
  the center button opens/plays, Back closes the player, and the
  play/pause / rewind / fast-forward buttons control playback.
  No mouse, no ADB keyboard app needed.
- **Videos play inside the app** — direct video links (MP4/WebM) play in a
  built-in fullscreen player using the device's hardware decoder, and
  YouTube / Vimeo / Dailymotion links open in an in-app embedded player
  that the remote controls the same way (OK play/pause, ◀ ▶ seek,
  Back to close). No jumping out to websites to watch something.
- Only links with no recognizable video source open as pages in-app;
  Back returns you to your shelves.

## Get the APK (pick whichever is easiest)

### Option A — GitHub builds it for you (no Android tools needed)
1. Create a new GitHub repository and push this folder to it.
2. Open the repo's **Actions** tab. The **Build Fire TV APK** workflow runs
   automatically (or press *Run workflow*).
3. When it finishes, download the **firetv-apk** artifact —
   \`app-debug.apk\` is inside.

### Option B — Android Studio
Open this folder in Android Studio, let Gradle sync, then
**Build → Build App Bundle(s) / APK(s) → Build APK(s)**.

### Option C — command line
With JDK 17 and the Android SDK installed:

\`\`\`bash
gradle assembleDebug        # any Gradle 8.x
# APK: app/build/outputs/apk/debug/app-debug.apk
\`\`\`

Debug APKs are automatically signed with your debug keystore — perfect for
sideloading. (Only Amazon Appstore / Play Store submissions need a release
keystore.)

## Install on your Fire TV

1. On the Fire TV: **Settings → My Fire TV → Developer Options** → enable
   **Apps from Unknown Sources** (and **ADB Debugging** if you'll use adb).
   If you don't see Developer Options, go to **Settings → My Fire TV →
   About**, and click your device name 7 times.
2. Easiest route: install the **Downloader** app from the Amazon Appstore,
   host the APK anywhere reachable (GitHub release, Google Drive direct
   link, your PC's local server), enter the URL, and install.
3. From a computer instead:
   \`\`\`bash
   adb connect <fire-tv-ip>:5555
   adb install app-debug.apk
   \`\`\`
4. Launch it from **Your Apps & Channels**.

## Updating the content

Regenerate the site in Linkforge (Fire TV App template), download again, and
replace \`app/src/main/assets/index.html\` — or just replace that one file in
your repo and let the workflow rebuild.
`;
  }

  const SETTINGS_GRADLE = `pluginManagement {
    repositories {
        google()
        mavenCentral()
        gradlePluginPortal()
    }
}
dependencyResolutionManagement {
    repositoriesMode.set(RepositoriesMode.FAIL_ON_PROJECT_REPOS)
    repositories {
        google()
        mavenCentral()
    }
}
rootProject.name = 'linkforge-firetv'
include ':app'
`;

  const ROOT_GRADLE = `plugins {
    id 'com.android.application' version '8.5.2' apply false
}
`;

  const GRADLE_PROPERTIES = `org.gradle.jvmargs=-Xmx2048m
android.useAndroidX=true
`;

  const GITIGNORE = `.gradle/
build/
local.properties
.idea/
*.iml
.DS_Store
`;

  function stringsXml(title) {
    const escXml = (s) => String(s).replace(/[&<>"']/g, (c) => ({
      '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;',
    }[c]));
    return `<?xml version="1.0" encoding="utf-8"?>
<resources>
    <string name="app_name">${escXml(title || 'Linkforge TV')}</string>
</resources>
`;
  }

  // ---------- public API ----------
  async function downloadProject({ html, title, slug }) {
    const enc = new TextEncoder();
    const safeSlug = (slug || 'site').replace(/[^a-z0-9-]/g, '') || 'site';
    const dir = `${safeSlug}-firetv/`;
    const t = (name, text) => ({ name: dir + name, data: enc.encode(text) });

    const [banner, icon] = await Promise.all([bannerPng(title), iconPng(title)]);

    const files = [
      t('README.md', readmeMd(title || 'Linkforge TV')),
      t('.gitignore', GITIGNORE),
      t('.github/workflows/build-apk.yml', workflowYml()),
      t('settings.gradle', SETTINGS_GRADLE),
      t('build.gradle', ROOT_GRADLE),
      t('gradle.properties', GRADLE_PROPERTIES),
      t('app/build.gradle', appGradle(safeSlug)),
      t('app/src/main/AndroidManifest.xml', manifestXml()),
      t('app/src/main/java/com/linkforge/tvapp/MainActivity.java', MAIN_ACTIVITY),
      t('app/src/main/res/values/strings.xml', stringsXml(title)),
      t('app/src/main/assets/index.html', html),
      { name: dir + 'app/src/main/res/drawable/banner.png', data: banner },
      { name: dir + 'app/src/main/res/mipmap-xxhdpi/ic_launcher.png', data: icon },
    ];

    const blob = makeZip(files);
    const a = document.createElement('a');
    a.href = URL.createObjectURL(blob);
    a.download = `${safeSlug}-firetv-app.zip`;
    document.body.appendChild(a);
    a.click();
    a.remove();
    setTimeout(() => URL.revokeObjectURL(a.href), 1000);
    return a.download;
  }

  window.LINKFORGE_APK = { downloadProject, makeZip };
})();
