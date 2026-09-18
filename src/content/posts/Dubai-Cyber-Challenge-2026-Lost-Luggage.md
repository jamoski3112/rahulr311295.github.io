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

Lost Luggage is one of the Cloud/AWS challenges from Dubai Cyber Challenge 2026, a fake travel-document upload portal where the goal is to get your hands on a document the app itself won't serve you through its own UI. Like most of these, the actual bug isn't in any business logic - it's in what the app accidentally tells you about the infrastructure behind it.

## Recon

The root page is a spoofed "Wego.ae" travel document upload portal, complete with a booking reference `WG-4471982` and separate categories for passports, visas and e-tickets.

![Spoofed Wego.ae travel document portal](/assets/images/dubai-cyber-challenge-2026-lost-luggage/01-landing-page.jpg)

A quick `ffuf` against the root turned up a few things worth a closer look. `/download` needs a `key` query parameter:

```console
$ curl -s https://3tnymcac3a.execute-api.us-east-1.amazonaws.com/download
{"error":"400 Bad Request: missing key parameter"}
```

which is a small mistake on the app's part - instead of a generic 400 it names the exact parameter it expects, saving a round of guessing. `/ping` is just a health check. And `robots.txt` disallows `/debug/`, which on its own is a confirmation that the path exists - nobody writes a crawl rule for a directory that isn't there.

![/download without a key - the app names its own parameter](/assets/images/dubai-cyber-challenge-2026-lost-luggage/02-download-missing-key-param.jpg)

`POST /upload` stores files under their literal filename with no per-session namespacing at all, and uploading a name that already exists returns `409 Conflict: '<name>' already exists` - a pre-auth existence oracle you don't even need read access to use.

## Following the robots.txt hint

The `Disallow: /debug/` rule was too good a lead to skip, so a second `ffuf` pass under `/debug/FUZZ` found `/debug/logs` - 200, about 15 KB, no auth required. Pulling it down shows it's exactly what it sounds like: the app's own startup debug output, logged in plaintext and served back to anyone who asks.

```console
$ curl -s https://3tnymcac3a.execute-api.us-east-1.amazonaws.com/debug/logs | head -5
[INFO]  2026-09-17T12:45:34Z Application started
[INFO]  2026-09-17T12:45:34Z Wego Traveller Documents v2.3.1 ready
[DEBUG] 2026-09-17T12:45:34Z Storage backend: s3
[DEBUG] 2026-09-17T12:45:34Z Bucket name: wego-traveldocs-97a48b1c
[DEBUG] 2026-09-17T12:45:34Z Bucket region: us-east-1
```

Straight disclosure of the exact S3 bucket name and region - no error-message archaeology needed, it's just sitting there in the response.

![/debug/logs: bucket name/region disclosure + upload history](/assets/images/dubai-cyber-challenge-2026-lost-luggage/03-debug-logs-bucket-disclosure.jpg)

Scrolling further down the same log turns up a full upload history for the bucket. Most of it is obvious noise from every other team hammering the same endpoint - `passport.pdf`, `flag.txt`, `sensitive.pdf`, all 0-13 bytes, clearly just probing uploads. One entry stands apart from the rest:

```
[INFO] 2026-03-10T04:44:06Z File uploaded: booking-manifest-v9an7bf09MeANbS7GeB1N.txt
```

Dated months before the event even started, with a long random-looking suffix nobody would ever stumble onto by guessing - clearly the pre-seeded "restricted" document the app's own `/download` route was built to gatekeep. Guessing names through `/download` directly just returns 200 or 404 with no explicit deny anywhere in the mix, so the app doesn't actually enforce anything on the read path - the only thing standing between "public" and "restricted" is whether you happen to know the filename.

## Pulling the file straight from S3

Since the bucket name is known now, there's no reason to keep going through the app's `/download` route - it's just a thin, unauthenticated proxy in front of S3. Skip it and hit the bucket directly:

```console
$ curl -s -i https://wego-traveldocs-97a48b1c.s3.amazonaws.com/booking-manifest-v9an7bf09MeANbS7GeB1N.txt
HTTP/1.1 200 OK
Last-Modified: Thu, 13 Aug 2026 18:21:13 GMT
x-amz-server-side-encryption: AES256
Content-Type: application/octet-stream
Content-Length: 40
Server: AmazonS3

THM{publ1c_s3_byp4ss3s_4pp_r3str1ct10ns}
```

Confirmed the same result a second way, straight through the AWS CLI with `--no-sign-request` - no AWS credentials of any kind involved, anonymous or otherwise:

```console
$ aws s3api get-object --region us-east-1 --bucket wego-traveldocs-97a48b1c \
    --key booking-manifest-v9an7bf09MeANbS7GeB1N.txt --no-sign-request out.txt
$ cat out.txt
THM{publ1c_s3_byp4ss3s_4pp_r3str1ct10ns}
```

Both come back byte-identical, which rules out any caching artefact - the bucket really is just publicly readable, no app in the way at all.
