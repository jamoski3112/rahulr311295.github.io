---
title: Sector443 CTF Walkthrough
description: This is the walkthrough for the challenges that were provided as a part of Sector443's CTF
date: 2019-08-12
slug: Sector-443-CTF-Walkthrough
teaser: /assets/images/sector443/sector443.png
categories:
- capture the flag
- infosec
tags:
- ctf
- jeopardy
---
This is where it all started I was watching an episode of The Boys when a friend of mine gave me a link to this CTF and asked me to play if I had the time, and I has plenty XD  
Most of the challenges where based on reverse engineering binaries.

**WEB**

![](/assets/images/sector443/sector443_web.png)

The challenge had an HTML file when opened with a browser it gives a prompt to enter a password the end goal is to find the password which is the flag.

```html
<html>
<head>
    <title>Obfuscation JS</title>
    <script type="text/javascript">
    function dechiffre(pass_enc){
        var pass = "70,65,85,88,32,80,65,83,83,87,79,82,68,32,72,65,72,65";
        var tab  = pass_enc.split(',');
                var tab2 = pass.split(',');
                var i,j,k,l=0,m,n,o,p = "";
                i = 0;
                j = tab.length;
                k = j + (l) + (n=0);
                n = tab2.length;
                for(i = (o=0); i < (k = j = n); i++ )
                {
                    o = tab[i-l];
                    p += String.fromCharCode((o = tab2[i]));
                    if(i == 5)break;
                }
                for(i = (o=0); i < (k = j = n); i++ )
                {
                o = tab[i-l]; 
                if(i > 5 && i < k-1)
                p += String.fromCharCode((o = tab2[i]));
                        }
        p += String.fromCharCode(tab2[17]);
        pass = p;return pass;
    }
    String["fromCharCode"](dechiffre("\x31\x30\x32\x2c\x31\x30\x38\x2c\x39\x37\x2c\x31\x30\x33\x2c\x31\x32\x33\x2c\x35\x35\x2c\x35\x36\x2c\x35\x34\x2c\x37\x39\x2c\x31\x31\x35\x2c\x36\x39\x2c\x31\x31\x34\x2c\x31\x31\x36\x2c\x31\x30\x37\x2c\x34\x39\x2c\x35\x30\x2c\x31\x32\x35"));
    
    h = window.prompt('Enter password');
    alert( dechiffre(h) );
    
</script>
</head>
</html>
```

By the looks of it I can see a load of variable declaration and looping by the hex thing looks promising by printing it on console it spits out some char codes.

```javascript
console.log("\x31\x30\x32\x2c\x31\x30\x38\x2c\x39\x37\x2c\x31\x30\x33\x2c\x31\x32\x33\x2c\x35\x35\x2c\x35\x36\x2c\x35\x34\x2c\x37\x39\x2c\x31\x31\x35\x2c\x36\x39\x2c\x31\x31\x34\x2c\x31\x31\x36\x2c\x31\x30\x37\x2c\x34\x39\x2c\x35\x30\x2c\x31\x32\x35");
```
Now we have a set of char codes which can then be converted using the String.fromCharCode function which returns the flag.

```javascript
print(String.fromCharCode(102, 108, 97,103,123,55,56,54,79,115,69,114,116,107,49,50,125));
//flag{786OsErtk12}
```

**STEG**

![](/assets/images/sector443/sector443_steg.png)

The challenge gives us a GIF of Captain America flying.

![](/assets/images/sector443/captain.gif)

By running binwalk over it to check for hidden files we can see that there is a RAR file embedded in the GIF.

![](/assets/images/sector443/binwalk.png)

After extracting the RAR file we have another image and a text file.

![](/assets/images/sector443/know_the_correct_cipher.jpg)

Chasing and avenging the hydra's head Arnim Zola, captain america finally got control over the ship and crashed into the Arctic going into a unconsciousness sleep of "steghide". Releasing Next: Captain America "wintersoldier".So we have steghide and wintersoldier which means only one thing.

![](/assets/images/sector443/steghide.png)

**Forensics**

![](/assets/images/sector443/sector443_forensic.png)

In this challenge we are given a btsnoop log file form which we have to find the unlock sequence and get the value which is the flag, We can view the log file on wireshark.

![](/assets/images/sector443/wireshark.png)

Now we have to find the Unlock Request , As the challenge description says the the unlock request is send through an app so the Source would be a Smart Phone and the destination is the Smart Lock.

By Filtering the source and searching for a Value attribute I was able to figure out the Unlock request.

![](/assets/images/sector443/wireshark1.png)

As the image shows a Send Write Request is generated from a Redmi4 to the Smart Lock with the handle of 0x0003 and as per the challenge description there should be 5 requests by counting them I knew this was it.

**OSINT**

![](/assets/images/sector443/sector443_osint.png)

In this challenge the goal is to find a person whose name is "Peter Grulich" who likes ponies and we need to find the flag.I started my search in google by entering the following.


![](/assets/images/sector443/sector443_osint_google.png)

![](/assets/images/sector443/sector443_osint_git.png)

The first thing is a GitHub profile by investigating I noticed that the account is created at the time of the CTF and there is only one repository by looking at the commit history there is a peculiar commit.

![](/assets/images/sector443/sector443_osint_git_comit.png)

By checking the Remove secret commit we have a flag.

![](/assets/images/sector443/sector443_osint_git_flag.png)

**PWN**

![](/assets/images/sector443/sector443_script_kiddie.png)

In this challenge we have to download a VM and import it to virtual box in order to solve the challenge,Before that a Host only connection has to be made in order to access the box (which I didn't like) ,After importing the machine and staring it we have a static IP address.  
By doing an NMAP on the IP address we can see that a port 8080 is open which is running Apache Tomcat.

![](/assets/images/sector443/sector443_script_kiddie_nmap.png)

![](/assets/images/sector443/sector443_script_kiddie1.png)

By checking the manager page we have a login prompt by trying admin:admin we are able to login to the app.

![](/assets/images/sector443/sector443_script_kiddie2.png)

![](/assets/images/sector443/sector443_script_kiddie3.png)

 Now we have a shell and the flag.
 
 **l33t**
 
 ![](/assets/images/sector443/sector443_133t.png)
 
 In this challenge we have an encrypted firmware file and our goal is to decrypt it and find the flag and this was the most point heavy challenge and the author says the challenge is for 1337s so I stared my research which ended up nowhere then I had to seek help from the 1337s themselves so I asked [liveoverflow](https://twitter.com/liveoverflow) to help me figure this out (hope he is not mad at me as I had to push his limit in patience) with one look he said that the file is XOR encrypted  and asked me to figure out the solution.Lets talk about XOR Encryption 

In a XOR encryption we have a plain text and a key if we want to encrypt the plain text we xor each byte of the plain text with the key which results in an encrypted text.

 ![](/assets/images/sector443/xor01.png)
 
 To decrypt the cipher we need to xor the cipher text again with the key which converts into the plain text.
 ![](/assets/images/sector443/xor02.png)
 
 This is a case of single byte XOR which means that the key is of only one character or one byte but in our case its not a single byte XOR but a multi byte XOR which means our key has multiple characters.

After hours of searching I stumbled upon a [stackoverflow](https://stackoverflow.com/questions/1135186/whats-wrong-with-xor-encryption) post which says that when a nullbyte is XORed with a key the result will be the key for example.

 ![](/assets/images/sector443/cipher.png)
 
As we can see that 0x41 is the hex value for A and 0x42 is the hex value for B when we XOR 0x41 with 0x42 the output is 0x3 and when we XOR a null byte ie 0x00 with 0x41 we get the output of 0x41 which was the key used now we need to find a pattern of null bytes to get the key for decryption

By looking at the hexdump of the file I noticed an unusual amount of the string toor.

  ![](/assets/images/sector443/hexedit.png)
  
As the NULL Bytes in the firmware file gets XORed it spits out the character of the key which was used for encryption.

Now we need to write a script that XORs each byte of the firmware file with each byte of the key.
```python
#!/usr/bin/python
import binascii
inputfile=open('stage2.bin', 'rb')
outputfile=open('decode_stage.bin','w+b')
key=[0x74,0x6f,0x6f,0x72]
 # key = toor
counter=0
byte=inputfile.read(1)
while byte !="":
	byte =ord(byte) 
	byte=byte ^ key[counter]
	counter += 1
	if counter > 3:
		counter=0
	outputfile.write('%c' % byte)
	byte= inputfile.read(1)
outputfile.close()
```

Now we have a decrypted file all we have to do now is to extract the firmware using binwalk and find the backdoor.

![](/assets/images/sector443/binwa.png)

And here is the flag.

![](/assets/images/sector443/bin_flag.png)


