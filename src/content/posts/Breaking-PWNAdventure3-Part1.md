---
title: Breaking Pwn Adventure 3 - Part 1(God Mode + One Hit Kills Offline Mode)
description: Creating God Mode and One Hit Kills on Pwn Adventure 3 using Cheat Engine
date: 2022-04-09
slug: Breaking-PWNAdventure3-Part1
teaser: /assets/images/pwnadventure/logo.png
categories:
- capture the flag
- infosec
tags:
- reverse-engineering
- gamehacking
- cheatengine
---
# Prologue
![](/assets/images/pwnadventure/logo.png)

> Readers can ignore this if required

Ever since the awesome [LiveOverflow](https://twitter.com/LiveOverflow) released his game hacking [playlist](https://www.youtube.com/playlist?list=PLhixgUqwRTjzzBeFSHXrw9DnQtssdAwgG). I always wanted to try it out myself figuring out how things worked eventhough I have zero skill in reading assembly, reverse engineering or even writing code.

Game Hacking is no easy job it requires time , many hours of trial and error , crashing and I have to admire the efforts put by LiveOverflow in creating his Game Hacking series. I had my fare share of Game Hacking in my teen years which was the first time I used [Cheat Engine](https://www.cheatengine.org/) to change the current amount of in game money that I had in GTA Vice City. I've only used it once without knowing the potential that tool had

Since  I consider this as a learning experience I thought of posting my journey here as a journal.

# God Mode and One Hit Kills
To start our hacks we need to attach the game process by opening Cheat Engine and attaching the game.
![](/assets/images/pwnadventure/partI/processattach.PNG)

Next we need to confirm what value we need to find in this case Im going after the Health Value.For that lets start a scan by setting the Scan Type to **Exact Value** and the Value Type as **4 Bytes** since the Health value is an interger and start a new scan.
>Note : Some games also use float value type for Health , Ammo etc

![](/assets/images/pwnadventure/partI/scan1.PNG)

We have around 10K value we can futher refine by getting some damage from the enemies.

![](/assets/images/pwnadventure/partI/damage1.PNG)

Now our health has been reduced to 92 we can use that value to do the next scan.
![](/assets/images/pwnadventure/partI/scan1.PNG)
We have now 43 potential memory addresses that has our health value all 43 of the address will change we can isolate the correct address by add all 43 of the memory addresses to our address list and freezing a couple of the address and taking damage.
![](/assets/images/pwnadventure/partI/freeze.gif)
We can see that our health keeps going back to 100 everytime we get damage we can further verify this by changing the value to something high.
![](/assets/images/pwnadventure/partI/freeze.PNG)
By selecting 3 of the address and changing the value to 1337 the first and the last value changed so one of these address is the address that stores our health.We can  now isolate those 2 memory address and change the value one by one until we find the right address.

To implement God Mode we need to find what instruction writes to this address when we get damaged by an enemy for that we need to right click on the address and select **Find out what writes to this address** or press **F6** a small window will be shown and it will be populated once we start getting damage.

![](/assets/images/pwnadventure/partI/writestoaddress.PNG)

We can now take damage from an enemy and our empty box gets filled with an instruction **sub [edi+30],eax**
![](/assets/images/pwnadventure/partI/writestoaddress1.PNG)
We can now investigate what are the values stored in the register by clicking on it and looking in the bottom window.
![](/assets/images/pwnadventure/partI/writestoaddress2.PNG)

So the register EAX containes the value 8 which is the damage done by the Giant Rats on a single hit which is then subtracted from value stored in EDI + 30 where EDI is the base address and 30 is an offset.
Since our goal is to acheive God Mode we could just NOP out this instruction so that when ever we get hit our health wont be subtracted.
We can do that by click the **Show disassembler** button which will show a disassembler similar to OllyDBG or Immunity Debugger.

We can now right click on the sub instruction and click on **Replace with code that does nothing** which will replace the SUB instruction with NOPs.
![](/assets/images/pwnadventure/partI/nop.PNG)

![](/assets/images/pwnadventure/partI/nop1.PNG)

Now we have nopped the instrustion we can check it by getting some damage from an enemy.
![](/assets/images/pwnadventure/partI/nop2.gif)
Our health is not changing but there is one issue if we shoot an enemy with our fireball the enemy doesnot take damage as well.
![](/assets/images/pwnadventure/partI/nop3.gif)
This is due to some thing called [**Shared OP Codes**](https://guidedhacking.com/threads/cheat-engine-shared-opcode-tutorial-gh203.18815/) which means that the instruction  **sub [edi+30],eax** is shared with our player and enemies so if we change these OP Codes it will reflect on both the player and the enemy, So we need to find a value or an offset that can be used to create a comparison between our player and the enemies.
>Dont forget to restore the nopped instruction 

Fo that we need to right click on the **sub [edi+30],eax** from what writes to this address box and click on **Find out what addresses this code accesses** which will bing a second window.
![](/assets/images/pwnadventure/partI/pVeaccess.PNG)
![](/assets/images/pwnadventure/partI/pVeaccess1.PNG)
Now we need to take a hit from an enemy and give a hit to a couple of the enemies as well.
![](/assets/images/pwnadventure/partI/pVeaccess2.gif)
We can see that we have some entries when we get hit and give out damage we can select a couple of these values and right click and select **Open disect data with selected addesses**.
![](/assets/images/pwnadventure/partI/pVedisect.PNG)

Which brings another window with our addresses we need to create a group for our enemies for comparison
<figure class="video_container">
  <video controls="true" allowfullscreen="true" >
    <source src="/assets/images/pwnadventure/partI/pVesturct.mp4" type="video/mp4">
  </video>
</figure>
In this sturcture we can check for a certain value that differs the player from other characters that wont be changed during the entire game the items in orange shows entries that are different in both groups in this case the offset 14 contains the name of the Actor.
![](/assets/images/pwnadventure/partI/pVesturct.PNG)

We can  use this offset to create a comparrison much like an if statement so that our cheat only affects on the enemie's health.
Lets begin our cheat development by going back to the disassembler and selecting the SUB instruction and clicking on the Tools menu and then selecting the Auto Assemble option. 
There are multiple ways we can inject custom code to a game's process I've used code injection method for creating this cheat.
![](/assets/images/pwnadventure/partI/inject.PNG)
A new editable window will be displayed where we can select the method of injection from the templates menu.
![](/assets/images/pwnadventure/partI/inject1.PNG)
All our custom code should be kept inside the newmem section. Now we can start by doing a comparison for our God Mode.

```
[ENABLE]
//code from here to '[DISABLE]' will be used to enable the cheat
alloc(newmem,2048)
label(returnhere)
label(originalcode)
label(exit)

newmem: //this is allocated memory, you have read,write,execute access

cmp  dword ptr [edi+14],'Player' // Compares if the value in EDI+14 is the string player since EDI is our player's base address.

jne originalcode //if its not player move to original code

sub [edi+30],0 //If offset value is equal to player subtract 0 from health

push [edi+30] 

jmp exit // Above operations done exiting from this execution flow This should be done else our code starts going into original code and sets our health to 0 as well if we get hit from an enemy

originalcode:
mov [edi+30],0 // Move 0 to Total Health (Only affects Enemies)
push [edi+30]

exit:
jmp returnhere

"GameLogic.dll"+20C5:
jmp newmem
nop
returnhere:

 
[DISABLE]
//code from here till the end of the code will be used to disable the cheat
dealloc(newmem)
"GameLogic.dll"+20C5:
sub [edi+30],eax
push [edi+30]
//Alt: db 29 47 30 FF 77 30
```
Lets now assign this cheat to our cheat table by going to File and selecting the assign to cheat table.
![](/assets/images/pwnadventure/partI/cheat.PNG)
Now we can test our cheat see weather we are taking in damage and killing enemies in one hit.
<figure class="video_container">
  <video controls="true" allowfullscreen="true" >
    <source src="/assets/images/pwnadventure/partI/godmode.mp4" type="video/mp4">
  </video>
</figure>
Lets try it out on a Boss and see if this cheat works or not for that lets go to Magmarok and try killing him in one hit.
<figure class="video_container">
  <video controls="true" allowfullscreen="true" >
    <source src="/assets/images/pwnadventure/partI/boss.mp4" type="video/mp4">
  </video>
</figure>


