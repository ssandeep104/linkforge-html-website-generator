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
import android.graphics.drawable.Drawable;
import android.graphics.drawable.GradientDrawable;
import android.graphics.drawable.LayerDrawable;
import android.net.Uri;
import android.os.Bundle;
import android.os.Message;
import android.os.SystemClock;
import android.view.InputDevice;
import android.view.KeyEvent;
import android.view.MotionEvent;
import android.view.View;
import android.view.WindowManager;
import android.webkit.CookieManager;
import android.webkit.ValueCallback;
import android.webkit.WebChromeClient;
import android.webkit.WebResourceRequest;
import android.webkit.WebResourceResponse;
import android.webkit.WebSettings;
import android.webkit.WebView;
import android.webkit.WebViewClient;
import android.widget.FrameLayout;

import androidx.webkit.UserAgentMetadata;
import androidx.webkit.WebSettingsCompat;
import androidx.webkit.WebViewCompat;
import androidx.webkit.WebViewFeature;

import java.io.ByteArrayInputStream;
import java.util.Arrays;
import java.util.HashSet;
import java.util.Set;

/**
 * Fullscreen WebView wrapper around the Linkforge-generated TV page.
 *
 * Remote support comes for free on our own generated page: Fire TV delivers
 * the D-pad to the WebView as arrow-key events and the center button as
 * Enter, which the bundled page's spatial-navigation script consumes. Only
 * BACK needs plumbing — Android routes it to the Activity, so we offer it
 * to the page first (window.lfBack() closes the video player / resets
 * focus) and fall back to WebView history, then to leaving the app.
 *
 * Links that aren't playable in-app (see tvEmbedFor / genericEmbedSrc in the
 * generated page) navigate the WebView to the real, external site, which has
 * no D-pad-aware navigation of its own and is usually built for touch. While
 * on one of those pages this Activity switches to "pointer mode": D-pad keys
 * never reach the page at all (dispatchKeyEvent swallows them outright, so
 * the page can't tab through links or scroll on its own), and instead move a
 * native cursor overlay drawn on top of the WebView; OK synthesizes a real
 * touch tap at the cursor's position. Intercepting at the Activity level —
 * rather than injecting JS into the page — means the cursor can't be wiped
 * out by client-side navigation and never has to race the page's own load.
 *
 * The remote's dedicated media buttons (play/pause, rewind, fast-forward)
 * always control the page's video directly through evaluateJavascript. That
 * channel is deliberate: while a native fullscreen video surface is up,
 * input focus sits on that surface rather than the page, so real key
 * events cannot be trusted to arrive — JS injection always works. In
 * fullscreen the D-pad joins in as transport control (left/right seek,
 * up/down long seek, OK play/pause) instead of moving the cursor.
 *
 * The menu (≡) button toggles "cinema mode" on external pages: the page's
 * video is pinned over a fixed black backdrop at full screen size, no site
 * cooperation needed. Touch players hide their controls after a couple of
 * seconds, which made the real fullscreen button nearly impossible to hit
 * with a cursor — and a mis-click on the faded control bar would seek the
 * video instead. Cinema mode skips that whole interaction.
 *
 * Ad blocking is built in and always on, because this app has no tabs: an
 * ad that opens a window or redirects doesn't go "somewhere else", it
 * hijacks the only WebView there is. Requests to major ad/popunder
 * networks are dropped, gestureless popups are swallowed (gestured
 * target=_blank links fold into the main view), non-web schemes are
 * blocked, and long-pressing Back always returns to the shelves.
 */
public class MainActivity extends Activity {
    private static final String ASSET_PREFIX = "file:///android_asset/";
    private static final String DESKTOP_UA =
            "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 "
                    + "(KHTML, like Gecko) Chrome/124.0.0.0 Safari/537.36";
    // Cursor tuning: big enough to spot from the couch, fast enough to
    // cross the screen before a player's auto-hiding control bar fades —
    // but a single press moves only BASE_STEP_DP, so small targets
    // (checkboxes, player buttons) can be lined up press by press while a
    // held key accelerates hard for distance.
    private static final float CURSOR_DP = 40f;
    private static final float CURSOR_DOT_DP = 8f;
    private static final float BASE_STEP_DP = 12f;
    private static final float MAX_STEP_DP = 48f;
    private static final float ACCEL_DP = 3f;
    private static final float EDGE_DP = 56f;
    // Applied to every external page: some sites decide "mobile" purely
    // from viewport width (ignoring the desktop UA above), so this widens
    // the CSS viewport to a desktop width — and then scales the page down
    // so that full width fits the screen. The scale must be pinned via
    // minimum/maximum-scale: a bare initial-scale is ignored when the meta
    // tag is edited after the page's own viewport was already parsed, and
    // forcing scale 1 on a viewport wider than the screen zooms the page in
    // so only part of it is visible.
    private String fitViewportBody(int screenCssWidth) {
        return "var w=Math.max(window.innerWidth,1280);"
                + "var s=Math.min(1," + screenCssWidth + "/w);"
                + "var m=document.querySelector('meta[name=viewport]');"
                + "if(!m){m=document.createElement('meta');"
                + "m.setAttribute('name','viewport');"
                + "document.head&&document.head.appendChild(m);}"
                + "m.setAttribute('content','width='+w+', initial-scale='+s"
                + "+', minimum-scale='+s+', maximum-scale='+s);";
    }

    private String forceDesktopViewportJs() {
        int screenCssWidth = Math.max(1, Math.round(
                webView.getWidth() / getResources().getDisplayMetrics().density));
        return "(function(){try{" + fitViewportBody(screenCssWidth) + "}catch(e){}})();";
    }

    // Runs at document start in every http(s) frame (WebView permitting):
    // sites sniff "mobile" from JS long before any onPageCommitVisible
    // injection can land, so the desktop disguise has to be in place before
    // the page's first script executes. Also fits the viewport the moment
    // the DOM is ready instead of waiting for the first painted frame.
    // file:// (the bundled page) never matches the http(s) origin rules.
    private String desktopSpoofJs() {
        android.util.DisplayMetrics dm = getResources().getDisplayMetrics();
        int sw = Math.max(1, Math.round(dm.widthPixels / dm.density));
        return "(function(){try{"
                + "var def=function(o,k,v){try{Object.defineProperty(o,k,"
                + "{get:function(){return v},configurable:true});}catch(e){}};"
                + "def(navigator,'platform','Win32');"
                + "def(navigator,'maxTouchPoints',0);"
                + "if(navigator.userAgentData){var b=navigator.userAgentData.brands||[];"
                + "def(navigator,'userAgentData',{brands:b,mobile:false,platform:'Windows',"
                + "getHighEntropyValues:function(){return Promise.resolve({brands:b,"
                + "fullVersionList:b,mobile:false,platform:'Windows',"
                + "platformVersion:'10.0.0',architecture:'x86',bitness:'64',"
                + "model:'',uaFullVersion:''});},"
                + "toJSON:function(){return{brands:b,mobile:false,platform:'Windows'};}});}"
                + "var fit=function(){try{" + fitViewportBody(sw) + "}catch(e){}};"
                + "if(document.readyState==='loading'){"
                + "document.addEventListener('DOMContentLoaded',fit);}else{fit();}"
                + "}catch(e){}})();";
    }

    // While a native fullscreen surface is up, the layout viewport must
    // match the screen 1:1 — the fullscreen layer inherits the page scale,
    // and leaving the desktop viewport pinned below 1 is exactly what
    // rendered fullscreen video at three-quarter size with black around it.
    private static final String FULLSCREEN_VIEWPORT_JS =
            "(function(){try{var m=document.querySelector('meta[name=viewport]');"
                    + "if(!m){m=document.createElement('meta');"
                    + "m.setAttribute('name','viewport');"
                    + "document.head&&document.head.appendChild(m);}"
                    + "m.setAttribute('content','width=device-width, initial-scale=1, "
                    + "minimum-scale=1, maximum-scale=1');}catch(e){}})();";

    // ---- built-in ad blocking ----
    // Host-suffix blocklist of major ad, popunder, and ad-tracking
    // networks. Not a full EasyList engine — the goal is narrower: in a
    // single-WebView app there are no tabs, so an ad that navigates or
    // pops a window doesn't open "somewhere else", it hijacks the whole
    // app. Blocking the networks that do that (plus their measurement
    // partners) keeps external pages usable from a couch.
    private static final Set<String> AD_HOSTS = new HashSet<String>(Arrays.asList(
            "doubleclick.net", "googlesyndication.com", "googleadservices.com",
            "adservice.google.com", "google-analytics.com", "amazon-adsystem.com",
            "adnxs.com", "adsrvr.org", "adform.net", "criteo.com", "criteo.net",
            "taboola.com", "outbrain.com", "revcontent.com", "mgid.com", "zedo.com",
            "openx.net", "pubmatic.com", "rubiconproject.com", "casalemedia.com",
            "contextweb.com", "smartadserver.com", "teads.tv", "sharethrough.com",
            "gumgum.com", "33across.com", "sonobi.com", "yieldmo.com",
            "bidswitch.net", "adroll.com", "quantserve.com", "scorecardresearch.com",
            "moatads.com", "adsafeprotected.com", "doubleverify.com",
            "springserve.com", "spotxchange.com", "spotx.tv", "tremorhub.com",
            "propellerads.com", "propellerclick.com", "exoclick.com", "exosrv.com",
            "juicyads.com", "trafficjunky.net", "popads.net", "popcash.net",
            "poptm.com", "adsterra.com", "hilltopads.net", "clickadu.com",
            "adcash.com", "zeropark.com", "adblade.com", "undertone.com",
            "mopub.com", "inmobi.com"));

    private static boolean isAdHost(String host) {
        if (host == null) return false;
        host = host.toLowerCase();
        int idx = 0;
        while (true) {
            if (AD_HOSTS.contains(idx == 0 ? host : host.substring(idx))) return true;
            idx = host.indexOf('.', idx);
            if (idx < 0) return false;
            idx++;
        }
    }

    // True = swallow the navigation. Ad hosts never get the top frame, and
    // non-web schemes (intent://, market://ads and their kin) would bounce
    // the user clean out of the app.
    private boolean blockNavigation(String url) {
        if (url == null) return false;
        if (url.startsWith(ASSET_PREFIX)) return false;
        if (!url.startsWith("http://") && !url.startsWith("https://")) return true;
        return isAdHost(Uri.parse(url).getHost());
    }

    private WebView webView;
    private FrameLayout root;
    private View cursorView;
    private View fullscreenView;
    private WebChromeClient.CustomViewCallback fullscreenCallback;
    private boolean pointerMode = false;
    private boolean cinemaMode = false;
    private boolean backLongPressed = false;
    private float cursorX, cursorY;
    private float baseStepPx, maxStepPx, accelPx, edgePx;
    private int cursorSizePx;

    @SuppressLint("SetJavaScriptEnabled")
    @Override
    protected void onCreate(Bundle savedInstanceState) {
        super.onCreate(savedInstanceState);
        float density = getResources().getDisplayMetrics().density;
        cursorSizePx = Math.round(CURSOR_DP * density);
        baseStepPx = BASE_STEP_DP * density;
        maxStepPx = MAX_STEP_DP * density;
        accelPx = ACCEL_DP * density;
        edgePx = EDGE_DP * density;

        root = new FrameLayout(this);
        webView = new WebView(this);
        root.addView(webView);

        // Ring with a small center dot, not a solid blob: the tap lands at
        // the cursor's center, and with a filled circle bigger than many
        // click targets (a consent checkbox, a player button) the eye can't
        // locate that center — clicks felt "slightly off" every time. The
        // dot marks the exact hotspot; the ring keeps it visible from the
        // couch.
        cursorView = new View(this);
        GradientDrawable ringShadow = new GradientDrawable();
        ringShadow.setShape(GradientDrawable.OVAL);
        ringShadow.setColor(0x00000000);
        ringShadow.setStroke(Math.max(2, Math.round(5 * density)), 0x990A0C10);
        GradientDrawable ring = new GradientDrawable();
        ring.setShape(GradientDrawable.OVAL);
        ring.setColor(0x00000000);
        ring.setStroke(Math.max(1, Math.round(3 * density)), 0xFFFBBF24);
        GradientDrawable dot = new GradientDrawable();
        dot.setShape(GradientDrawable.OVAL);
        dot.setColor(0xFFFBBF24);
        dot.setStroke(Math.max(1, Math.round(density)), 0xFF0A0C10);
        LayerDrawable cursor = new LayerDrawable(new Drawable[] { ringShadow, ring, dot });
        int dotInset = Math.round((CURSOR_DP - CURSOR_DOT_DP) / 2f * density);
        cursor.setLayerInset(2, dotInset, dotInset, dotInset, dotInset);
        cursorView.setBackground(cursor);
        cursorView.setVisibility(View.GONE);
        root.addView(cursorView, new FrameLayout.LayoutParams(cursorSizePx, cursorSizePx));

        setContentView(root);

        WebSettings s = webView.getSettings();
        s.setJavaScriptEnabled(true);
        s.setDomStorageEnabled(true);
        // Parity with regular TV browsers: WebView blocks third-party
        // cookies by default, which breaks embedded widgets (consent
        // prompts, verification checkboxes, comment frames) that real
        // browsers happily run.
        CookieManager.getInstance().setAcceptThirdPartyCookies(webView, true);
        s.setMediaPlaybackRequiresUserGesture(false);
        s.setUseWideViewPort(true);
        s.setLoadWithOverviewMode(true);
        s.setMixedContentMode(WebSettings.MIXED_CONTENT_ALWAYS_ALLOW);
        // External sites get a desktop UA: their mobile layouts assume touch
        // (hamburger menus, tiny tap targets) and often redirect to an
        // m.-subdomain based on user agent. Desktop layouts are friendlier
        // to the remote-driven pointer and this app's screen is plenty wide.
        s.setUserAgentString(DESKTOP_UA);
        // The UA string alone stopped being enough: modern WebViews also
        // send client hints (Sec-CH-UA-Mobile: ?1, Sec-CH-UA-Platform:
        // Android), and major sites trust those over the UA when choosing a
        // layout — which is why many pages still came back mobile.
        if (WebViewFeature.isFeatureSupported(WebViewFeature.USER_AGENT_METADATA)) {
            try {
                WebSettingsCompat.setUserAgentMetadata(s, new UserAgentMetadata.Builder()
                        .setMobile(false)
                        .setPlatform("Windows")
                        .setPlatformVersion("10.0.0")
                        .setArchitecture("x86")
                        .setBitness(64)
                        .setModel("")
                        .setWow64(false)
                        .build());
            } catch (RuntimeException ignored) { }
        }
        if (WebViewFeature.isFeatureSupported(WebViewFeature.DOCUMENT_START_SCRIPT)) {
            try {
                WebViewCompat.addDocumentStartJavaScript(webView, desktopSpoofJs(),
                        new HashSet<String>(Arrays.asList("http://*", "https://*")));
            } catch (RuntimeException ignored) { }
        }

        // Popups need declaring so onCreateWindow gets consulted at all;
        // without this, window.open() navigates the one and only WebView —
        // which is exactly how ad popunders trapped the app.
        s.setSupportMultipleWindows(true);

        webView.setBackgroundColor(0xFF0A0C10);
        webView.setWebViewClient(new WebViewClient() {
            @Override
            public WebResourceResponse shouldInterceptRequest(
                    WebView view, WebResourceRequest request) {
                if (request != null && request.getUrl() != null
                        && isAdHost(request.getUrl().getHost())) {
                    return new WebResourceResponse(
                            "text/plain", "utf-8", new ByteArrayInputStream(new byte[0]));
                }
                return super.shouldInterceptRequest(view, request);
            }

            @SuppressWarnings("deprecation")
            @Override
            public boolean shouldOverrideUrlLoading(WebView view, String url) {
                return blockNavigation(url);
            }

            @Override
            public boolean shouldOverrideUrlLoading(WebView view, WebResourceRequest request) {
                return blockNavigation(request.getUrl() == null
                        ? null : request.getUrl().toString());
            }

            @Override
            public void onPageStarted(WebView view, String url, android.graphics.Bitmap favicon) {
                super.onPageStarted(view, url, favicon);
                cinemaMode = false;
                setPointerMode(url == null || !url.startsWith(ASSET_PREFIX));
            }

            // Applied twice per external load: as soon as the first frame is
            // drawn (so the page doesn't sit over-zoomed while slow resources
            // finish loading; never fires on API < 23, where onPageFinished
            // still covers it) and again at load end, in case the page's own
            // late-parsed viewport meta overrode the first injection.
            @Override
            public void onPageCommitVisible(WebView view, String url) {
                super.onPageCommitVisible(view, url);
                if (url != null && !url.startsWith(ASSET_PREFIX)) {
                    view.evaluateJavascript(forceDesktopViewportJs(), null);
                }
            }

            @Override
            public void onPageFinished(WebView view, String url) {
                super.onPageFinished(view, url);
                if (url != null && !url.startsWith(ASSET_PREFIX)) {
                    view.evaluateJavascript(forceDesktopViewportJs(), null);
                }
            }
        });
        webView.setWebChromeClient(new WebChromeClient() {
            // No tabs exist here, so "open a new window" can only mean one
            // of two things: an ad popunder (no user gesture — drop it
            // silently), or a real target=_blank link the user clicked —
            // capture the URL it wants via a throwaway WebView and route it
            // into the main one, ad-filtered like any other navigation.
            @Override
            public boolean onCreateWindow(WebView view, boolean isDialog,
                    boolean isUserGesture, Message resultMsg) {
                if (!isUserGesture || resultMsg == null
                        || !(resultMsg.obj instanceof WebView.WebViewTransport)) {
                    return false;
                }
                final WebView popup = new WebView(MainActivity.this);
                popup.setWebViewClient(new WebViewClient() {
                    @SuppressWarnings("deprecation")
                    @Override
                    public boolean shouldOverrideUrlLoading(WebView v, String url) {
                        if (!blockNavigation(url)) webView.loadUrl(url);
                        v.destroy();
                        return true;
                    }
                });
                WebView.WebViewTransport transport = (WebView.WebViewTransport) resultMsg.obj;
                transport.setWebView(popup);
                resultMsg.sendToTarget();
                return true;
            }

            @Override
            public void onShowCustomView(View view, CustomViewCallback callback) {
                if (fullscreenView != null) { callback.onCustomViewHidden(); return; }
                fullscreenView = view;
                fullscreenCallback = callback;
                // Many external sites' <video> tags skip playsinline, so
                // Android drops them into this native fullscreen surface
                // automatically (not just on an explicit "fullscreen" tap).
                // The cursor is useless over it — the D-pad becomes transport
                // control instead (see handleFullscreenKey), driven through
                // evaluateJavascript so input works regardless of focus.
                //
                // The WebView must STAY VISIBLE underneath: hiding it pauses
                // Chromium's renderer, so the viewport swap below (and the
                // page's own fullscreen re-layout) would never be processed —
                // the video sat at windowed size inside black bars until
                // exit, when the un-paused renderer finally caught up. The
                // opaque surface covers the WebView, so nothing shows through.
                if (!isOnAssetPage()) {
                    webView.evaluateJavascript(FULLSCREEN_VIEWPORT_JS, null);
                }
                cursorView.setVisibility(View.GONE);
                getWindow().addFlags(WindowManager.LayoutParams.FLAG_KEEP_SCREEN_ON);
                view.setBackgroundColor(0xFF000000);
                root.addView(view, new FrameLayout.LayoutParams(
                        FrameLayout.LayoutParams.MATCH_PARENT,
                        FrameLayout.LayoutParams.MATCH_PARENT));
                view.requestLayout();
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
        if (hasFocus) {
            applyImmersive();
            webView.requestFocus();
        }
    }

    // Belt and braces on top of the fullscreen theme: some Fire OS builds
    // (and phones/tablets, where this app also installs) still overlay
    // system bars, which shrinks the usable surface and leaves dead black
    // strips at the edges.
    private void applyImmersive() {
        getWindow().getDecorView().setSystemUiVisibility(
                View.SYSTEM_UI_FLAG_IMMERSIVE_STICKY
                        | View.SYSTEM_UI_FLAG_FULLSCREEN
                        | View.SYSTEM_UI_FLAG_HIDE_NAVIGATION
                        | View.SYSTEM_UI_FLAG_LAYOUT_STABLE
                        | View.SYSTEM_UI_FLAG_LAYOUT_FULLSCREEN
                        | View.SYSTEM_UI_FLAG_LAYOUT_HIDE_NAVIGATION);
    }

    private void setPointerMode(boolean on) {
        if (pointerMode == on) return;
        pointerMode = on;
        cursorView.setVisibility(on ? View.VISIBLE : View.GONE);
        if (on) {
            cursorX = webView.getWidth() / 2f;
            cursorY = webView.getHeight() / 2f;
            placeCursor();
        }
    }

    private void placeCursor() {
        cursorView.setTranslationX(cursorX - cursorSizePx / 2f);
        cursorView.setTranslationY(cursorY - cursorSizePx / 2f);
    }

    // All remote input funnels through here.
    //
    // - Menu (≡) button: toggles video fullscreen. Exits a native fullscreen
    //   surface, else toggles cinema mode — so nobody has to chase a touch
    //   player's tiny auto-hiding fullscreen button with the cursor.
    // - Video surface up (native fullscreen or cinema mode): every D-pad and
    //   media key becomes a transport command delivered via JS — input that
    //   works regardless of where focus is, or whether the page can even
    //   receive key events.
    // - Pointer mode (external page, windowed): D-pad moves the cursor and
    //   never reaches the page; media buttons drive the page's video by JS,
    //   since touch-oriented sites don't listen for Media* keys anyway.
    // - Bundled page: everything passes through as real key events, which
    //   its spatial-navigation script consumes.
    @Override
    public boolean dispatchKeyEvent(KeyEvent event) {
        int code = event.getKeyCode();
        boolean down = event.getAction() == KeyEvent.ACTION_DOWN;
        if (code == KeyEvent.KEYCODE_BACK) {
            // Long-press Back: guaranteed escape hatch straight back to the
            // shelves, no matter how deep an ad redirect chain has buried
            // the history stack. The matching UP must be swallowed too, or
            // it would fire onBackPressed and immediately navigate again.
            if (down && event.getRepeatCount() > 0 && !isOnAssetPage()) {
                if (!backLongPressed) {
                    backLongPressed = true;
                    if (fullscreenView != null) exitFullscreen();
                    cinemaMode = false;
                    webView.loadUrl(ASSET_PREFIX + "index.html");
                }
                return true;
            }
            if (event.getAction() == KeyEvent.ACTION_UP && backLongPressed) {
                backLongPressed = false;
                return true;
            }
        }
        if (code == KeyEvent.KEYCODE_MENU
                && (fullscreenView != null || cinemaMode || pointerMode)) {
            if (down) toggleFullscreenMode();
            return true;
        }
        if ((fullscreenView != null || cinemaMode)
                && (isDpadKey(code) || isMediaKey(code))) {
            if (down) handleFullscreenKey(code);
            return true;
        }
        if (pointerMode && isMediaKey(code)) {
            if (down) handleMediaKey(code);
            return true;
        }
        if (pointerMode && isDpadKey(code)) {
            if (down) handleDpadKey(event);
            return true;
        }
        return super.dispatchKeyEvent(event);
    }

    private void toggleFullscreenMode() {
        if (fullscreenView != null) { exitFullscreen(); return; }
        if (cinemaMode) { exitCinema(); return; }
        enterCinema();
    }

    // "Cinema mode": CSS-level fullscreen for the page's video, toggled by
    // the remote's menu (≡) button. Real element fullscreen can't be
    // requested from injected JS (Chromium demands a user gesture), but
    // pinning the video over a fixed black backdrop needs no permission —
    // and it sidesteps touch players entirely: no waking their control bar,
    // no racing its fade-out to a corner button, no mis-click hitting the
    // invisible seek bar and jumping the video to the end.
    private void enterCinema() {
        webView.evaluateJavascript(
                "(function(){try{var v=document.fullscreenElement;"
                        + "if(v&&v.tagName!=='VIDEO'){v=v.querySelector('video');}"
                        + "if(!v){var l=document.querySelectorAll('video');"
                        + "for(var i=0;i<l.length;i++){"
                        + "if(!l[i].paused&&l[i].readyState>0){v=l[i];break;}}"
                        + "if(!v&&l.length){v=l[0];}}"
                        + "if(!v){return false;}"
                        + "window.__lfCv=v;"
                        + "v.__lfStyle=v.getAttribute('style')||'';"
                        + "v.__lfCtrl=v.controls;v.controls=false;"
                        + "var b=document.createElement('div');b.id='__lfCinemaBd';"
                        + "b.setAttribute('style','position:fixed;left:0;top:0;right:0;"
                        + "bottom:0;background:#000;z-index:2147483645;');"
                        + "document.body.appendChild(b);"
                        + "v.setAttribute('style','position:fixed!important;"
                        + "left:0!important;top:0!important;width:100vw!important;"
                        + "height:100vh!important;max-width:none!important;"
                        + "max-height:none!important;margin:0!important;"
                        + "padding:0!important;transform:none!important;"
                        + "z-index:2147483646!important;background:#000!important;"
                        + "object-fit:contain!important;');"
                        + "if(v.paused){v.play();}"
                        + "return true;}catch(e){return false;}})();",
                new ValueCallback<String>() {
                    @Override
                    public void onReceiveValue(String found) {
                        if ("true".equals(found)) {
                            cinemaMode = true;
                            cursorView.setVisibility(View.GONE);
                        }
                    }
                });
    }

    private void exitCinema() {
        cinemaMode = false;
        webView.evaluateJavascript(
                "(function(){try{var b=document.getElementById('__lfCinemaBd');"
                        + "if(b&&b.parentNode){b.parentNode.removeChild(b);}"
                        + "var v=window.__lfCv;if(v){"
                        + "if(v.__lfStyle){v.setAttribute('style',v.__lfStyle);}"
                        + "else{v.removeAttribute('style');}"
                        + "v.controls=!!v.__lfCtrl;window.__lfCv=null;}"
                        + "}catch(e){}})();",
                null);
        if (pointerMode) {
            cursorView.setVisibility(View.VISIBLE);
            placeCursor();
        }
    }

    private boolean isDpadKey(int keyCode) {
        switch (keyCode) {
            case KeyEvent.KEYCODE_DPAD_LEFT:
            case KeyEvent.KEYCODE_DPAD_RIGHT:
            case KeyEvent.KEYCODE_DPAD_UP:
            case KeyEvent.KEYCODE_DPAD_DOWN:
            case KeyEvent.KEYCODE_DPAD_CENTER:
            case KeyEvent.KEYCODE_ENTER:
                return true;
            default:
                return false;
        }
    }

    private boolean isMediaKey(int keyCode) {
        switch (keyCode) {
            case KeyEvent.KEYCODE_MEDIA_PLAY_PAUSE:
            case KeyEvent.KEYCODE_MEDIA_PLAY:
            case KeyEvent.KEYCODE_MEDIA_PAUSE:
            case KeyEvent.KEYCODE_MEDIA_REWIND:
            case KeyEvent.KEYCODE_MEDIA_FAST_FORWARD:
            case KeyEvent.KEYCODE_MEDIA_NEXT:
            case KeyEvent.KEYCODE_MEDIA_PREVIOUS:
                return true;
            default:
                return false;
        }
    }

    private void handleFullscreenKey(int code) {
        if (isOnAssetPage()) {
            // The bundled page (and its embedded YouTube/Vimeo players, via
            // its postMessage bridge) already knows what every key means —
            // re-deliver the key as a synthetic DOM event, since real key
            // delivery is unreliable while the fullscreen surface holds
            // input focus.
            String key = domKeyFor(code);
            if (key != null) sendKeyToPage(key);
            return;
        }
        switch (code) {
            case KeyEvent.KEYCODE_DPAD_CENTER:
            case KeyEvent.KEYCODE_ENTER:
            case KeyEvent.KEYCODE_MEDIA_PLAY_PAUSE:
                togglePlay();
                break;
            case KeyEvent.KEYCODE_MEDIA_PLAY:
                mediaAction("v.play();");
                break;
            case KeyEvent.KEYCODE_MEDIA_PAUSE:
                mediaAction("v.pause();");
                break;
            case KeyEvent.KEYCODE_DPAD_LEFT:
            case KeyEvent.KEYCODE_MEDIA_REWIND:
            case KeyEvent.KEYCODE_MEDIA_PREVIOUS:
                seekBy(-10);
                break;
            case KeyEvent.KEYCODE_DPAD_RIGHT:
            case KeyEvent.KEYCODE_MEDIA_FAST_FORWARD:
            case KeyEvent.KEYCODE_MEDIA_NEXT:
                seekBy(10);
                break;
            case KeyEvent.KEYCODE_DPAD_UP:
                seekBy(60);
                break;
            case KeyEvent.KEYCODE_DPAD_DOWN:
                seekBy(-60);
                break;
            default:
                break;
        }
    }

    private void handleMediaKey(int code) {
        switch (code) {
            case KeyEvent.KEYCODE_MEDIA_PLAY_PAUSE:
                togglePlay();
                break;
            case KeyEvent.KEYCODE_MEDIA_PLAY:
                mediaAction("v.play();");
                break;
            case KeyEvent.KEYCODE_MEDIA_PAUSE:
                mediaAction("v.pause();");
                break;
            case KeyEvent.KEYCODE_MEDIA_REWIND:
            case KeyEvent.KEYCODE_MEDIA_PREVIOUS:
                seekBy(-10);
                break;
            case KeyEvent.KEYCODE_MEDIA_FAST_FORWARD:
            case KeyEvent.KEYCODE_MEDIA_NEXT:
                seekBy(10);
                break;
            default:
                break;
        }
    }

    private String domKeyFor(int code) {
        switch (code) {
            case KeyEvent.KEYCODE_DPAD_LEFT: return "ArrowLeft";
            case KeyEvent.KEYCODE_DPAD_RIGHT: return "ArrowRight";
            case KeyEvent.KEYCODE_DPAD_UP: return "ArrowUp";
            case KeyEvent.KEYCODE_DPAD_DOWN: return "ArrowDown";
            case KeyEvent.KEYCODE_DPAD_CENTER:
            case KeyEvent.KEYCODE_ENTER: return "Enter";
            case KeyEvent.KEYCODE_MEDIA_PLAY_PAUSE: return "MediaPlayPause";
            case KeyEvent.KEYCODE_MEDIA_PLAY: return "MediaPlay";
            case KeyEvent.KEYCODE_MEDIA_PAUSE: return "MediaPause";
            case KeyEvent.KEYCODE_MEDIA_REWIND:
            case KeyEvent.KEYCODE_MEDIA_PREVIOUS: return "MediaRewind";
            case KeyEvent.KEYCODE_MEDIA_FAST_FORWARD:
            case KeyEvent.KEYCODE_MEDIA_NEXT: return "MediaFastForward";
            default: return null;
        }
    }

    private void sendKeyToPage(String key) {
        webView.evaluateJavascript(
                "(function(){try{document.dispatchEvent(new KeyboardEvent('keydown',"
                        + "{key:'" + key + "',bubbles:true,cancelable:true}));}catch(e){}})();",
                null);
    }

    // Finds the page's video — the fullscreen one if any, else the one
    // that's actually playing, else the first — and runs the given action
    // on it (bound to v). Cross-origin iframe players can't be reached this
    // way; those are rare on desktop layouts, where players are inline.
    private void mediaAction(String action) {
        webView.evaluateJavascript(
                "(function(){try{var v=document.fullscreenElement;"
                        + "if(v&&v.tagName!=='VIDEO'){v=v.querySelector('video');}"
                        + "if(!v){var l=document.querySelectorAll('video');"
                        + "for(var i=0;i<l.length;i++){"
                        + "if(!l[i].paused&&l[i].readyState>0){v=l[i];break;}}"
                        + "if(!v&&l.length){v=l[0];}}"
                        + "if(!v){return;}" + action + "}catch(e){}})();",
                null);
    }

    private void togglePlay() {
        mediaAction("if(v.paused){v.play();}else{v.pause();}");
    }

    private void seekBy(int seconds) {
        mediaAction("var t=v.currentTime+(" + seconds + ");"
                + "if(t<0){t=0;}if(v.duration&&t>v.duration){t=v.duration;}"
                + "v.currentTime=t;");
    }

    private void handleDpadKey(KeyEvent event) {
        int code = event.getKeyCode();
        if (code == KeyEvent.KEYCODE_DPAD_CENTER || code == KeyEvent.KEYCODE_ENTER) {
            tapAtCursor();
            return;
        }
        float step = Math.min(maxStepPx, baseStepPx + event.getRepeatCount() * accelPx);
        int w = webView.getWidth(), h = webView.getHeight();
        switch (code) {
            case KeyEvent.KEYCODE_DPAD_LEFT:
                cursorX = Math.max(0, cursorX - step);
                break;
            case KeyEvent.KEYCODE_DPAD_RIGHT:
                cursorX = Math.min(w, cursorX + step);
                break;
            case KeyEvent.KEYCODE_DPAD_UP:
                cursorY = Math.max(0, cursorY - step);
                if (cursorY <= edgePx) webView.scrollBy(0, -Math.round(step));
                break;
            case KeyEvent.KEYCODE_DPAD_DOWN:
                cursorY = Math.min(h, cursorY + step);
                if (cursorY >= h - edgePx) webView.scrollBy(0, Math.round(step));
                break;
            default:
                return;
        }
        placeCursor();
    }

    // Synthesizes a tap with real-input fidelity: touchscreen source, finger
    // tool type, and honest timing — the UP is dispatched when its timestamp
    // says, not immediately with a timestamp 60ms in the future. The old
    // bare-bones events (unknown source, unknown tool, time-travelling UP)
    // were simply malformed input; pages that sanity-check a click's event
    // stream, challenge widgets included, are right to distrust them.
    private void tapAtCursor() {
        final float x = cursorX, y = cursorY;
        final long downTime = SystemClock.uptimeMillis();
        dispatchTouch(MotionEvent.ACTION_DOWN, downTime, downTime, x, y);
        webView.postDelayed(new Runnable() {
            @Override
            public void run() {
                dispatchTouch(MotionEvent.ACTION_UP, downTime, SystemClock.uptimeMillis(), x, y);
            }
        }, 70);
    }

    private void dispatchTouch(int action, long downTime, long eventTime, float x, float y) {
        MotionEvent.PointerProperties pp = new MotionEvent.PointerProperties();
        pp.id = 0;
        pp.toolType = MotionEvent.TOOL_TYPE_FINGER;
        MotionEvent.PointerCoords pc = new MotionEvent.PointerCoords();
        pc.x = x;
        pc.y = y;
        pc.pressure = 1f;
        pc.size = 0.3f;
        MotionEvent ev = MotionEvent.obtain(downTime, eventTime, action, 1,
                new MotionEvent.PointerProperties[] { pp },
                new MotionEvent.PointerCoords[] { pc },
                0, 0, 1f, 1f, 0, 0, InputDevice.SOURCE_TOUCHSCREEN, 0);
        webView.dispatchTouchEvent(ev);
        ev.recycle();
    }

    private void exitFullscreen() {
        if (fullscreenView == null) return;
        root.removeView(fullscreenView);
        fullscreenView = null;
        if (fullscreenCallback != null) fullscreenCallback.onCustomViewHidden();
        fullscreenCallback = null;
        getWindow().clearFlags(WindowManager.LayoutParams.FLAG_KEEP_SCREEN_ON);
        // Undo the 1:1 fullscreen viewport and go back to desktop layout.
        if (!isOnAssetPage()) {
            webView.evaluateJavascript(forceDesktopViewportJs(), null);
        }
        if (pointerMode) {
            cursorView.setVisibility(View.VISIBLE);
            placeCursor();
        }
        applyImmersive();
    }

    private boolean isOnAssetPage() {
        String url = webView.getUrl();
        return url == null || url.startsWith(ASSET_PREFIX);
    }

    @Override
    public void onBackPressed() {
        if (fullscreenView != null) {
            exitFullscreen();
            return;
        }
        if (cinemaMode) {
            exitCinema();
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

dependencies {
    // Desktop-mode client hints + document-start scripts (feature-gated at
    // runtime, so old WebViews degrade gracefully instead of crashing).
    implementation 'androidx.webkit:webkit:1.11.0'
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

> **No Android tools needed.** Push this folder to a GitHub repository and
> the bundled workflow builds the sideloadable \`.apk\` for you — see
> **Option A** below. Android Studio and a local Gradle build are optional
> alternatives, not requirements.

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
- **Plain links switch to a remote-controlled pointer, nothing else** —
  links that aren't playable in-app open the real external site. Those pages
  have no D-pad navigation of their own, so the app takes the arrow keys away
  from them entirely and turns the remote into a mouse instead: arrows move a
  visible cursor, OK taps wherever it's sitting. External pages load in full
  desktop disguise — desktop user agent, desktop client hints, and spoofed
  JS fingerprint — so sites serve their mouse-friendly desktop layout
  instead of a cramped touch-only mobile view, zoomed so the full page
  width fits the TV screen. Back returns you to your shelves.
- **Video on external sites stays remote-controllable** — when a video on
  an external page goes fullscreen, the remote becomes a transport control:
  OK toggles play/pause, ◀ ▶ seek 10s, ▲ ▼ seek a minute, and the dedicated
  play/pause / rewind / fast-forward buttons work everywhere (fullscreen or
  not). Back leaves fullscreen.
- **The menu (≡) button makes any video fullscreen** — no hunting for the
  player's tiny fullscreen button before its control bar fades out. Press ≡
  while a video is playing on an external page and it snaps to fullscreen
  with the remote as transport control; press ≡ (or Back) again to return
  to the page.
- **Ad blocking is built in** — requests to the major ad and popunder
  networks are dropped, auto-opened popups are swallowed before they can
  hijack the page, and app-store/intent redirects are blocked. If a page
  ever does get you stuck, **hold Back** to jump straight home to your
  shelves.

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
