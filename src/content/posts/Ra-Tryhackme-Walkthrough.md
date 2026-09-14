---
title: Tryhackme Ra Walkthrough
description: Ra is a windows machine which starts with a typical business website for Windcorp where there is a password reset function which can be used to change a user's password to gain access to a SMB share to download spark live chat application which is vulnerable that can be used to harvest a user's NTLM hash that can be used to gain initial access to the machine.On further exploring the machine a script can be seen that contains a username who's password can be changed since the user has extended rights to change password as he is a member of the account operator group.Analysing the script we can see that there is command injection vulnerability that can be abused to gain admin privilege and pwn the machine
date: 2022-02-11
slug: Ra-Tryhackme-Walkthrough
teaser: /assets/images/ra/ra.png
categories:
- tryhackme
- infosec
tags:
- smb
- privesc
- windows
- bloodhound
- spark
- winrm
---
## Story
```
You have gained access to the internal network of WindCorp, the multibillion dollar company, running an extensive social media campaign claiming to be unhackable (ha! so much for that claim!).

Next step would be to take their crown jewels and get full access to their internal network. You have spotted a new windows machine that may lead you to your end goal. Can you conquer this end boss and own their internal network?

Happy Hacking!
```
## Nmap
A Nmap  full scan shows multiple open ports running different services one of then that stands out is port **80** which is a webserver also in the nmap output there is a domain name which can be added to out hosts file.
```bash
# Nmap 7.92 scan initiated Sun Feb  6 11:21:06 2022 as: nmap -sC -sV -Pn -p- -oN initial 10.10.85.15
Nmap scan report for 10.10.85.15
Host is up (0.21s latency).
Not shown: 65499 filtered tcp ports (no-response)
PORT      STATE SERVICE             VERSION
53/tcp    open  domain              Simple DNS Plus
80/tcp    open  http                Microsoft IIS httpd 10.0
|_http-server-header: Microsoft-IIS/10.0
|_http-title: Windcorp.
| http-methods: 
|_  Potentially risky methods: TRACE
88/tcp    open  kerberos-sec        Microsoft Windows Kerberos (server time: 2022-02-06 06:10:15Z)
135/tcp   open  msrpc               Microsoft Windows RPC
139/tcp   open  netbios-ssn         Microsoft Windows netbios-ssn
389/tcp   open  ldap                Microsoft Windows Active Directory LDAP (Domain: windcorp.thm0., Site: Default-First-Site-Name)
445/tcp   open  microsoft-ds?
464/tcp   open  kpasswd5?
593/tcp   open  ncacn_http          Microsoft Windows RPC over HTTP 1.0
636/tcp   open  ldapssl?
2179/tcp  open  vmrdp?
3268/tcp  open  ldap                Microsoft Windows Active Directory LDAP (Domain: windcorp.thm0., Site: Default-First-Site-Name)
3269/tcp  open  globalcatLDAPssl?
3389/tcp  open  ms-wbt-server       Microsoft Terminal Services
|_ssl-date: 2022-02-06T06:12:05+00:00; 0s from scanner time.
| rdp-ntlm-info: 
|   Target_Name: WINDCORP
|   NetBIOS_Domain_Name: WINDCORP
|   NetBIOS_Computer_Name: FIRE
|   DNS_Domain_Name: windcorp.thm
|   DNS_Computer_Name: Fire.windcorp.thm
|   DNS_Tree_Name: windcorp.thm
|   Product_Version: 10.0.17763
|_  System_Time: 2022-02-06T06:11:27+00:00
| ssl-cert: Subject: commonName=Fire.windcorp.thm
| Not valid before: 2022-02-05T05:45:30
|_Not valid after:  2022-08-07T05:45:30
5222/tcp  open  jabber              Ignite Realtime Openfire Jabber server 3.10.0 or later
| xmpp-info: 
|   STARTTLS Failed
|   info: 
|     capabilities: 
|     errors: 
|       invalid-namespace
|       (timeout)
|     features: 
|     auth_mechanisms: 
|     unknown: 
|     xmpp: 
|       version: 1.0
|     stream_id: 6q1pw8isix
|_    compression_methods: 
| ssl-cert: Subject: commonName=fire.windcorp.thm
| Subject Alternative Name: DNS:fire.windcorp.thm, DNS:*.fire.windcorp.thm
| Not valid before: 2020-05-01T08:39:00
|_Not valid after:  2025-04-30T08:39:00
|_ssl-date: 2022-02-06T06:12:06+00:00; 0s from scanner time.
5223/tcp  open  ssl/jabber
| ssl-cert: Subject: commonName=fire.windcorp.thm
| Subject Alternative Name: DNS:fire.windcorp.thm, DNS:*.fire.windcorp.thm
| Not valid before: 2020-05-01T08:39:00
|_Not valid after:  2025-04-30T08:39:00
|_ssl-date: 2022-02-06T06:12:05+00:00; 0s from scanner time.
| fingerprint-strings: 
|   RPCCheck: 
|_    <stream:error xmlns:stream="http://etherx.jabber.org/streams"><not-well-formed xmlns="urn:ietf:params:xml:ns:xmpp-streams"/></stream:error></stream:stream>
| xmpp-info: 
|   STARTTLS Failed
|   info: 
|     capabilities: 
|     errors: 
|       (timeout)
|     features: 
|     auth_mechanisms: 
|     unknown: 
|     xmpp: 
|_    compression_methods: 
5229/tcp  open  jaxflow?
5262/tcp  open  jabber
| xmpp-info: 
|   STARTTLS Failed
|   info: 
|     capabilities: 
|     errors: 
|       invalid-namespace
|       (timeout)
|     features: 
|     auth_mechanisms: 
|     unknown: 
|     xmpp: 
|       version: 1.0
|     stream_id: 7kayxe2awz
|_    compression_methods: 
| fingerprint-strings: 
|   RPCCheck: 
|_    <stream:error xmlns:stream="http://etherx.jabber.org/streams"><not-well-formed xmlns="urn:ietf:params:xml:ns:xmpp-streams"/></stream:error></stream:stream>
5263/tcp  open  ssl/jabber
| ssl-cert: Subject: commonName=fire.windcorp.thm
| Subject Alternative Name: DNS:fire.windcorp.thm, DNS:*.fire.windcorp.thm
| Not valid before: 2020-05-01T08:39:00
|_Not valid after:  2025-04-30T08:39:00
|_ssl-date: 2022-02-06T06:12:05+00:00; 0s from scanner time.
| xmpp-info: 
|   STARTTLS Failed
|   info: 
|     capabilities: 
|     errors: 
|       (timeout)
|     features: 
|     auth_mechanisms: 
|     unknown: 
|     xmpp: 
|_    compression_methods: 
| fingerprint-strings: 
|   RPCCheck: 
|_    <stream:error xmlns:stream="http://etherx.jabber.org/streams"><not-well-formed xmlns="urn:ietf:params:xml:ns:xmpp-streams"/></stream:error></stream:stream>
5269/tcp  open  xmpp                Wildfire XMPP Client
| xmpp-info: 
|   STARTTLS Failed
|   info: 
|     capabilities: 
|     errors: 
|       (timeout)
|     features: 
|     auth_mechanisms: 
|     unknown: 
|     xmpp: 
|_    compression_methods: 
5270/tcp  open  ssl/xmpp            Wildfire XMPP Client
| ssl-cert: Subject: commonName=fire.windcorp.thm
| Subject Alternative Name: DNS:fire.windcorp.thm, DNS:*.fire.windcorp.thm
| Not valid before: 2020-05-01T08:39:00
|_Not valid after:  2025-04-30T08:39:00
|_ssl-date: 2022-02-06T06:12:06+00:00; 0s from scanner time.
5275/tcp  open  jabber
| fingerprint-strings: 
|   RPCCheck: 
|_    <stream:error xmlns:stream="http://etherx.jabber.org/streams"><not-well-formed xmlns="urn:ietf:params:xml:ns:xmpp-streams"/></stream:error></stream:stream>
| xmpp-info: 
|   STARTTLS Failed
|   info: 
|     capabilities: 
|     errors: 
|       invalid-namespace
|       (timeout)
|     features: 
|     auth_mechanisms: 
|     unknown: 
|     xmpp: 
|       version: 1.0
|     stream_id: 6p72sw8xd
|_    compression_methods: 
5276/tcp  open  ssl/jabber          Ignite Realtime Openfire Jabber server 3.10.0 or later
|_ssl-date: 2022-02-06T06:12:05+00:00; 0s from scanner time.
| xmpp-info: 
|   STARTTLS Failed
|   info: 
|     capabilities: 
|     errors: 
|       (timeout)
|     features: 
|     auth_mechanisms: 
|     unknown: 
|     xmpp: 
|_    compression_methods: 
| ssl-cert: Subject: commonName=fire.windcorp.thm
| Subject Alternative Name: DNS:fire.windcorp.thm, DNS:*.fire.windcorp.thm
| Not valid before: 2020-05-01T08:39:00
|_Not valid after:  2025-04-30T08:39:00
5985/tcp  open  http                Microsoft HTTPAPI httpd 2.0 (SSDP/UPnP)
|_http-server-header: Microsoft-HTTPAPI/2.0
|_http-title: Not Found
7070/tcp  open  http                Jetty 9.4.18.v20190429
|_http-server-header: Jetty(9.4.18.v20190429)
|_http-title: Openfire HTTP Binding Service
7443/tcp  open  ssl/http            Jetty 9.4.18.v20190429
| ssl-cert: Subject: commonName=fire.windcorp.thm
| Subject Alternative Name: DNS:fire.windcorp.thm, DNS:*.fire.windcorp.thm
| Not valid before: 2020-05-01T08:39:00
|_Not valid after:  2025-04-30T08:39:00
|_http-title: Openfire HTTP Binding Service
|_http-server-header: Jetty(9.4.18.v20190429)
7777/tcp  open  socks5              (No authentication; connection failed)
| socks-auth-info: 
|_  No authentication
9090/tcp  open  zeus-admin?
9091/tcp  open  ssl/xmltec-xmlmail?
| ssl-cert: Subject: commonName=fire.windcorp.thm
| Subject Alternative Name: DNS:fire.windcorp.thm, DNS:*.fire.windcorp.thm
| Not valid before: 2020-05-01T08:39:00
|_Not valid after:  2025-04-30T08:39:00
9389/tcp  open  mc-nmf              .NET Message Framing
49670/tcp open  msrpc               Microsoft Windows RPC
49674/tcp open  ncacn_http          Microsoft Windows RPC over HTTP 1.0
49675/tcp open  msrpc               Microsoft Windows RPC
49676/tcp open  msrpc               Microsoft Windows RPC
49695/tcp open  msrpc               Microsoft Windows RPC
49911/tcp open  msrpc               Microsoft Windows RPC
6 services unrecognized despite returning data. If you know the service/version, please submit the following fingerprints at https://nmap.org/cgi-bin/submit.cgi?new-service :

Host script results:
| smb2-time: 
|   date: 2022-02-06T06:11:30
|_  start_date: N/A
| smb2-security-mode: 
|   3.1.1: 
|_    Message signing enabled and required

Service detection performed. Please report any incorrect results at https://nmap.org/submit/ .
# Nmap done at Sun Feb  6 11:42:19 2022 -- 1 IP address (1 host up) scanned in 1272.50 seconds

```

## Port 80 (webserver)
Visiting the webserver shows a static website for  **windcorp** which contains information regaring the company the employees etc also in the website there is something that stands out a space that shows IT support people who are online at the moment which will be used in a later stage.

**Webpage**
![](/assets/images/ra/webpage.png)

**Currently online IT staff**
![](/assets/images/ra/itstaffs.png)

**Employees**
![](/assets/images/ra/users.png)

Also in the webpage there is a button to reset password for users which askes a secutity question which is required to change the password.One of the sercurity question is "**What is/was your favourite pets name ?**".

![](/assets/images/ra/resetpass.png)

In the employee section there is only one user who has a dog that is Lily.Opening the image the URI leaks the username and the dog's name which can be used to reset the password and compramise the account.

**Potential username and security question's answer**
![](/assets/images/ra/lily.png)

![](/assets/images/ra/resetpass1.png)

On submitting the request  a new password will be generated and displayed.

![](/assets/images/ra/newpass.png)

Using this credential we can check weather we have smb access or winrm access using crackmapexec.

**Checking SMB access**
![](/assets/images/ra/lilsmbtest.png)

**Checking WINRM access**
![](/assets/images/ra/lilwinrmtest.png)

By using this credential we can use crackmapexec and smbclient to connect to the SMB server and see what shares and files are there.

**Crackmapexec SMB shares**
![](/assets/images/ra/lilsmbshares.png)

From the above output there are two shares that are not default .

**Smbclient**

![](/assets/images/ra/lilsmbclient.png)

In the shared folder there are installation files for Spark a live chat application and also the first flag for the machine.The version of spark provided in the share is vulnerable to [CVE-2020-12772](https://github.com/theart42/cves/blob/master/cve-2020-12772/CVE-2020-12772.md).To exploit this vulnerability we need to install spark on our local machine and since spark uses windows authentication we can use the credentials of the already compramised user to login.

**Spark login screen**

![](/assets/images/ra/spark1.png)

Upon loggin in there is an error due certificate issue which can be bypass by going to the advanced option and enabling the not to verify cetificate toggle

![](/assets/images/ra/spark2.png)
![](/assets/images/ra/spark3.png)

Now we can send the exploit payload to buse as he is the only IT staff member that is currently online and mean while start responder to capure incoming NTLM hashes.

![](/assets/images/ra/spark4.png)

**Responder to capture hashes**
![](/assets/images/ra/busehash.png)

We can now use hashcat to crack the captured hash for the user buse.

![](/assets/images/ra/busehashcat.png)

Now we can use this credential to check access on the server using crackmapexec.

**Checking SMB access**
![](/assets/images/ra/busesmbtest.png)

**Checking WINRM access**
![](/assets/images/ra/busewinrmtest.png)

The user buse has access to WINRM we can use evil-winrm to gain access to the server.

**Evil WINRM**

![](/assets/images/ra/busewinrm.png)

Logging into the server using winrm we can get the second flag.We can now enumerate the current user to find the privileges that the user have.

![](/assets/images/ra/buseinfo.png)

The user buse is a member of the group IT by using bloodhound to enumerate different relations.

![](/assets/images/ra/sharphound.png)

Importing the archive to bloodhound and searching for the user buse and listing its details it can be seen that the user buser is a member of the group IT which is also a member of the group Account Operators.

![](/assets/images/ra/busebloodhound.png)

Members in this group has extended rights to change a user's password this can be confimed using PowerView.

![](/assets/images/ra/busepasswdresetperm.png)

Upon further exploring the machine there is a directory called scripts in the C drive that contains a powershell script which contains a file name that is being read from a user's home directory which is being run by the Administrator user or run as the Administrator user.

![](/assets/images/ra/scriptsdir.png)
![](/assets/images/ra/scripts.png)
![](/assets/images/ra/scripts1.png)

We can see that the file hosts.txt is being read and the contents is being passed to the variable p which is then forwarded to Invoke-Expression.This code is vulnerable to code execution by adding a semicolon to the host file and adding arbitarary commands to it.
When the script is executed and the content of the hosts file is passed to Invoke-Expression the first command that is Test-Connection will fail and the commands after the semicolon will be executed.
Now we can use the extended rights of the user buse to change the password of the user mentioned in the script to edit the file.

![](/assets/images/ra/britpasswdreset.png)

We can test this operation using crackmapexec to see weather the password has changed or not.

**Checking SMB access**
![](/assets/images/ra/britsmbtest.png)

**Checking WINRM access**
![](/assets/images/ra/britwinrmtest.png)

The user has only access to SMB we can now use smbclient to download the hosts file and reupload after making the necessary changes.

![](/assets/images/ra/britsmbclient.png)
![](/assets/images/ra/britsmbclient2.png)

**Command Injection Payload**

![](/assets/images/ra/host.png)

![](/assets/images/ra/puthost.png)

After couple of seconds we can check weather our user is created and added to the Administrator group.

![](/assets/images/ra/admin.png)

Our user is now added to the Administrator group we can now either use psexec or evil-winrm to gain access to the machine and read the last flag.

![](/assets/images/ra/adminflag.png)
