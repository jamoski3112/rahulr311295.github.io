---
title: Dubai Cyber Challenge 2026 - Data Portal
description: Writeup for Data Portal, a Cloud/AWS challenge from Dubai Cyber Challenge 2026 - an unauthenticated SSRF proxy chained through ECS task metadata into a public ECR image pull.
date: 2026-09-17
slug: Dubai-Cyber-Challenge-2026-Data-Portal
teaser: /assets/images/dubai-cyber-challenge-2026/logo.png
categories:
- capture the flag
- infosec
tags:
- ctf
- aws
- cloud
- ssrf
- ecs
- ecr
- dubai cyber challenge
---
![Dubai Cyber Challenge 2026](/assets/images/dubai-cyber-challenge-2026/logo.png)

**Target:** `http://dubai-urban-data-portal-alb-1045840200.us-east-1.elb.amazonaws.com`
**Category:** Cloud / AWS - Medium, 90 pts
**Flag:** `THM{0p3nd4t4_SSRF_2_ECS_m3t4d4t4_2_ECR_pu11}`

## Recon

Public landing page for an open-data catalogue. No login required.

![Landing page with the Preview widget](/assets/images/dubai-cyber-challenge-2026-data-portal/01-landing-page.jpg)

The page includes a "Dataset Source Preview" widget - a staff tool for previewing an upstream publisher's URL before harvesting it, left exposed on the public internet ("internal harvesting tooling. Not intended for public access" per its own footer comment).

Its JS calls `GET /fetch?url=<url>` and renders the JSON response (`status`, `headers`, `content`) - a plain, unauthenticated SSRF proxy.

## Exploitation

1. Confirmed the SSRF works against arbitrary external URLs by pasting `http://example.com` into the widget itself and hitting Preview - `200`, Example Domain's raw HTML comes back:

   ![SSRF confirmed against an external URL](/assets/images/dubai-cyber-challenge-2026-data-portal/02-ssrf-benign-example-com.jpg)

2. The target is behind an ALB, so I tried both cloud metadata styles:
   - EC2 IMDS (`169.254.169.254`) - connection failed (not EC2/IMDS not reachable this way).
   - **ECS Task Metadata v2** (`169.254.170.2/v2/metadata`) - succeeded, returning full task/container JSON, again straight through the UI form:

     ![ECS metadata SSRF leaking the ECR image reference](/assets/images/dubai-cyber-challenge-2026-data-portal/03-ssrf-ecs-metadata-image-leak.jpg)

     - Cluster/Task ARNs (account `332173347248`, `us-east-1`)
     - **Image**: `public.ecr.aws/w1q2y4n7/dubai-urban-data-portal:latest@sha256:e5f7dd34963aaa7f0b2f959b0b5adb8c4fe2dfcfcb53a5dfbbf8a1feae6a72` (a *public* ECR repo - no AWS auth needed to pull it)

3. Per the objective wording ("how the service is built and distributed"), I pulled the image directly instead of chasing ECS task-role credentials:

   ```
   $ skopeo copy docker://public.ecr.aws/w1q2y4n7/dubai-urban-data-portal:latest \
       dir:./ecr_image
   Getting image source signatures
   Copying blob sha256:1d8241e1e0dabc32d7bd8544338831e91ce67a97796d504f7fbc0f57f100d68d
   Copying blob sha256:6760bfe2ff00c4530bc73b2f88a1e9615a56c9a77028f41f8bb4b978d08b8439
   ...
   Copying config sha256:08f3652046e1cd2b195cdbc155abd3271e4619a888dd80d0abe13d680e1e52d8
   Writing manifest to image destination
   ```

   The `dir:` transport writes each layer as a bare gzip blob (no `.tar` extension) plus `manifest.json` - extract by content-type, not filename:

   ```
   $ for blob in ecr_image/*; do
       file -b "$blob" | grep -q gzip && tar -xzf "$blob"
     done
   $ grep -r "THM{" .
   root/flag-v87adgvnfasdna7.txt:THM{0p3nd4t4_SSRF_2_ECS_m3t4d4t4_2_ECR_pu11}

   $ cat root/flag-v87adgvnfasdna7.txt
   THM{0p3nd4t4_SSRF_2_ECS_m3t4d4t4_2_ECR_pu11}
   ```

## Root cause

- An internal-only staff preview tool was deployed reachable from the public internet with no authentication.
- The preview feature is an unrestricted server-side URL fetcher - no allow-list, no block on the AWS link-local metadata range (`169.254.169.254`/`169.254.170.2`).
- The ECS task's container image is hosted in a *public* ECR repository, so once the image name/tag leaks via metadata, anyone can pull and inspect it directly - no need to even steal the task's IAM credentials.

## Fix

- Never expose internal tooling directly to the internet; put it behind auth and/or a private network path.
- Block outbound requests to `169.254.0.0/16` (and other cloud metadata ranges) from any server-side "fetch a URL" feature; allow-list expected publisher domains instead.
- Keep application images in a private ECR repository with resource-based policies, and don't bake flags/secrets into image layers regardless.
