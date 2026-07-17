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
import java.io.BufferedReader;
import java.io.IOException;
import java.io.InputStreamReader;
import java.nio.charset.StandardCharsets;

/**
 * Fullscreen WebView wrapper around the Linkforge-generated TV page.
 *
 * Remote support comes for free: Fire TV delivers the D-pad to the WebView
 * as arrow-key events and the center button as Enter, which the bundled
 * page's spatial-navigation script consumes. Only BACK needs plumbing —
 * Android routes it to the Activity, so we offer it to the page first
 * (window.lfBack() closes the video player / resets focus) and fall back
 * to WebView history, then to leaving the app.
 *
 * Links that aren't playable in-app (see tvEmbedFor / genericEmbedSrc in the
 * generated page) navigate the WebView to the real, external site — which
 * has no idea it's being driven by a D-pad. lf-cursor.js gives those pages a
 * remote-controlled pointer (move + "click" wherever it lands) so they're
 * still usable without a touchscreen or mouse.
 */
public class MainActivity extends Activity {
    private static final String ASSET_PREFIX = "file:///android_asset/";
    private static final String DESKTOP_UA =
            "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 "
                    + "(KHTML, like Gecko) Chrome/124.0.0.0 Safari/537.36";

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
        // External sites get a desktop UA: their mobile layouts assume touch
        // (hamburger menus, tiny tap targets) and often redirect to an
        // m.-subdomain based on user agent. Desktop layouts are friendlier
        // to the remote-driven pointer and this app's screen is plenty wide.
        s.setUserAgentString(DESKTOP_UA);

        webView.setBackgroundColor(0xFF0A0C10);
        webView.setWebViewClient(new WebViewClient() {
            @Override
            public void onPageFinished(WebView view, String url) {
                super.onPageFinished(view, url);
                if (url == null || url.startsWith(ASSET_PREFIX)) return;
                view.evaluateJavascript(loadAsset("lf-cursor.js"), null);
            }
        });
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

    private String loadAsset(String name) {
        StringBuilder sb = new StringBuilder();
        try (BufferedReader r = new BufferedReader(
                new InputStreamReader(getAssets().open(name), StandardCharsets.UTF_8))) {
            String line;
            while ((line = r.readLine()) != null) sb.append(line).append('\n');
        } catch (IOException e) {
            return "";
        }
        return sb.toString();
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

  // Injected into every external page the WebView navigates to (see
  // MainActivity.onPageFinished). Draws a remote-controlled pointer and
  // turns D-pad arrows + OK into cursor movement + a synthesized click,
  // since the external site has no idea it's being driven by a TV remote.
  function cursorJs() {
    return `(function () {
  if (window.__lfCursorInit) return;
  window.__lfCursorInit = true;

  var SIZE = 30;
  var cursor = document.createElement('div');
  cursor.id = '__lf_cursor';
  cursor.style.cssText = 'position:fixed;z-index:2147483647;pointer-events:none;' +
    'top:0;left:0;width:' + SIZE + 'px;height:' + SIZE + 'px;margin:-2px 0 0 -2px;' +
    'filter:drop-shadow(0 1px 2px rgba(0,0,0,.6));';
  cursor.innerHTML = '<svg width="' + SIZE + '" height="' + SIZE + '" viewBox="0 0 24 24">' +
    '<path d="M4 2l16 8.2-6.9 1.6L11 19.5z" fill="#fbbf24" stroke="#0a0c10" stroke-width="1.4" stroke-linejoin="round"/></svg>';

  function mount() { document.documentElement.appendChild(cursor); place(); }
  if (document.body) mount(); else document.addEventListener('DOMContentLoaded', mount);

  var x = Math.round(window.innerWidth / 2);
  var y = Math.round(window.innerHeight / 2);
  var held = Object.create(null);
  var BASE_SPEED = 16, MAX_SPEED = 46, ACCEL = 2.4, EDGE = 64;
  var speed = BASE_SPEED, raf = null, hoverEl = null;

  function place() { cursor.style.transform = 'translate(' + x + 'px,' + y + 'px)'; }

  function fireMouse(el, type) {
    try {
      el.dispatchEvent(new MouseEvent(type, { bubbles: true, cancelable: true, view: window, clientX: x, clientY: y }));
    } catch (e) {}
  }

  function updateHover() {
    var el = document.elementFromPoint(x, y);
    if (el === hoverEl) return;
    if (hoverEl) { fireMouse(hoverEl, 'mouseout'); fireMouse(hoverEl, 'mouseleave'); }
    hoverEl = el;
    if (hoverEl) { fireMouse(hoverEl, 'mouseover'); fireMouse(hoverEl, 'mouseenter'); fireMouse(hoverEl, 'mousemove'); }
  }

  function step() {
    var dx = 0, dy = 0;
    if (held.ArrowLeft) dx -= speed;
    if (held.ArrowRight) dx += speed;
    if (held.ArrowUp) dy -= speed;
    if (held.ArrowDown) dy += speed;
    if (!dx && !dy) { speed = BASE_SPEED; raf = null; return; }
    speed = Math.min(MAX_SPEED, speed + ACCEL);
    x = Math.max(2, Math.min(window.innerWidth - 2, x + dx));
    y = Math.max(2, Math.min(window.innerHeight - 2, y + dy));
    place();
    if (y < EDGE) window.scrollBy(0, -20);
    else if (y > window.innerHeight - EDGE) window.scrollBy(0, 20);
    updateHover();
    raf = requestAnimationFrame(step);
  }

  function clickAtCursor() {
    var el = document.elementFromPoint(x, y);
    if (!el) return;
    var opts = { bubbles: true, cancelable: true, view: window, clientX: x, clientY: y, button: 0 };
    try { el.dispatchEvent(new PointerEvent('pointerdown', opts)); } catch (e) {}
    fireMouse(el, 'mousedown');
    try { el.dispatchEvent(new PointerEvent('pointerup', opts)); } catch (e) {}
    fireMouse(el, 'mouseup');
    fireMouse(el, 'click');
    if (typeof el.focus === 'function') { try { el.focus({ preventScroll: true }); } catch (e) { try { el.focus(); } catch (e2) {} } }
  }

  var CODE = { 37: 'ArrowLeft', 38: 'ArrowUp', 39: 'ArrowRight', 40: 'ArrowDown', 13: 'Enter' };
  document.addEventListener('keydown', function (e) {
    var key = e.key && e.key !== 'Unidentified' ? e.key : CODE[e.keyCode];
    if (!key) return;
    if (key === 'ArrowLeft' || key === 'ArrowRight' || key === 'ArrowUp' || key === 'ArrowDown') {
      if (!held[key]) { held[key] = true; if (!raf) raf = requestAnimationFrame(step); }
      e.preventDefault();
    } else if (key === 'Enter') {
      clickAtCursor();
      e.preventDefault();
    }
  }, true);
  document.addEventListener('keyup', function (e) {
    var key = e.key && e.key !== 'Unidentified' ? e.key : CODE[e.keyCode];
    if (key && held[key]) { held[key] = false; e.preventDefault(); }
  }, true);
  window.addEventListener('resize', function () {
    x = Math.min(x, window.innerWidth - 2);
    y = Math.min(y, window.innerHeight - 2);
    place();
  });
})();
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
- **Plain links get a remote-controlled pointer** — links that aren't
  playable in-app open the real external site, and since that site has no
  idea it's being driven by a D-pad, this app gives it a visible cursor:
  arrows move it, OK clicks whatever it's over. Pages also load with a
  desktop user agent so external sites give you real (mouse-friendly)
  layouts instead of a cramped touch-only mobile view. Back returns you to
  your shelves.

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
      t('app/src/main/assets/lf-cursor.js', cursorJs()),
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
