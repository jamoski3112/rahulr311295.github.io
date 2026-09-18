---
title: Dubai Cyber Challenge 2026 - Lost Luggage
description: Writeup for Lost Luggage, a Cloud/AWS challenge from Dubai Cyber Challenge 2026 - chaining a debug endpoint leak into a direct, unauthenticated S3 read that bypasses the app's own access control.
date: 2026-09-17
slug: Dubai-Cyber-Challenge-2026-Lost-Luggage
teaser: /assets/images/dubai-cyber-challenge-2026/logo.png
categories:
- capture the flag
- infosec
tags:
- ctf
- aws
- cloud
- s3
- dubai cyber challenge
---
![Dubai Cyber Challenge 2026](/assets/images/dubai-cyber-challenge-2026/logo.png)

**Target:** `https://3tnymcac3a.execute-api.us-east-1.amazonaws.com/` (AWS API Gateway)
**Category:** Cloud / AWS - Easy, 60 pts
**Flag:** `THM{publ1c_s3_byp4ss3s_4pp_r3str1ct10ns}`

## Recon

The root page is a spoofed "Wego.ae" travel document upload portal for booking `WG-4471982` (passport/visa/e-ticket categories).

![Spoofed Wego.ae travel document portal](/assets/images/dubai-cyber-challenge-2026-lost-luggage/01-landing-page.jpg)

A quick `ffuf` path enumeration with a common wordlist turned up:

- `/download` - needs a `key` query param (`400 Bad Request: missing key parameter` when omitted - the app names its own parameter for you).
- `/ping` - health check.
- `/robots.txt` - disallows `/debug/`, which is itself a disclosure that the path exists.

![/download without a key - the app names its own parameter](/assets/images/dubai-cyber-challenge-2026-lost-luggage/02-download-missing-key-param.jpg)

`POST /upload` stores files under their **literal filename** with no per-session namespacing - uploading a name that already exists in the bucket returns `409 Conflict: '<name>' already exists`, a pre-auth existence oracle.

## Exploitation

### Objective 1 - find unintended paths

`robots.txt`'s `Disallow: /debug/` pointed straight at a hidden path. A follow-up `ffuf` under `/debug/FUZZ` found `/debug/logs` (200, ~15 KB) - a plaintext application log left world-readable.

### Objective 2 - recover storage backend details

`/debug/logs` opens with the app's own startup debug output:

```
$ curl -s https://3tnymcac3a.execute-api.us-east-1.amazonaws.com/debug/logs | head -5
[INFO]  2026-09-17T12:45:34Z Application started
[INFO]  2026-09-17T12:45:34Z Wego Traveller Documents v2.3.1 ready
[DEBUG] 2026-09-17T12:45:34Z Storage backend: s3
[DEBUG] 2026-09-17T12:45:34Z Bucket name: wego-traveldocs-97a48b1c
[DEBUG] 2026-09-17T12:45:34Z Bucket region: us-east-1
```

Straight disclosure of the exact S3 bucket name and region - no error-message inference needed.

![/debug/logs: bucket name/region disclosure + upload history](/assets/images/dubai-cyber-challenge-2026-lost-luggage/03-debug-logs-bucket-disclosure.jpg)

### Objective 3 - reach the restricted document directly via S3

The same log is also a full upload history. Most entries are obvious CTF noise from every team fuzzing common filenames (`passport.pdf`, `flag.txt`, `sensitive.pdf`, ..., 0-13 bytes each). One entry stands apart:

```
[INFO] 2026-03-10T04:44:06Z File uploaded: booking-manifest-v9an7bf09MeANbS7GeB1N.txt
```

Dated months before the event, with a long random-looking suffix no one would ever guess - clearly the pre-seeded "restricted" document the app's own `/download` route was built to gatekeep (guessed names via `/download` all just came back 200/404 with no explicit deny - the app doesn't actually enforce anything on the read path, it just relies on the filename being unguessable).

Since the bucket name is now known, skip the app's `/download` route entirely and hit S3 directly:

```
$ curl -s -i https://wego-traveldocs-97a48b1c.s3.amazonaws.com/booking-manifest-v9an7bf09MeANbS7GeB1N.txt
HTTP/1.1 200 OK
Last-Modified: Thu, 13 Aug 2026 18:21:13 GMT
x-amz-server-side-encryption: AES256
Content-Type: application/octet-stream
Content-Length: 40
Server: AmazonS3

THM{publ1c_s3_byp4ss3s_4pp_r3str1ct10ns}
```

Confirmed identically a second way, straight through the AWS CLI with no credentials at all:

```
$ aws s3api get-object --region us-east-1 --bucket wego-traveldocs-97a48b1c \
    --key booking-manifest-v9an7bf09MeANbS7GeB1N.txt --no-sign-request out.txt
$ cat out.txt
THM{publ1c_s3_byp4ss3s_4pp_r3str1ct10ns}
```

## Root cause

1. A debug log endpoint (`/debug/logs`) was left publicly reachable and disclosed the internal S3 bucket name plus a full upload history - including the one filename meant to stay secret through obscurity alone.
2. "Security" for the restricted document was pure security-by-obscurity: an unguessable filename, not an actual access-control check - the app's own `/download` route would have served it too, to anyone who could guess or learn the name.
3. The underlying S3 bucket is directly, publicly readable over HTTPS with no authentication, so any app-layer restriction is trivially bypassed by going straight to S3 once the bucket name is known.

## Fix

- Never expose application debug/log output on a public route; if needed for ops, put it behind auth and strip secrets (bucket names, object keys) before logging them at all.
- Block public `s3:GetObject` on the bucket (bucket policy / Block Public Access) and require the app's own IAM role for reads; don't rely on unguessable keys as an access boundary.
- Enforce authorization for "restricted" documents at the S3/IAM layer (per-object ACL, signed URLs with short expiry, or a proxy that checks entitlement), not by naming convention alone.
