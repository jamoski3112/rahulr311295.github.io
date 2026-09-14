---
title: Breaking Pwn Adventure 3 - Part 2(Speed Hack, SuperJump and Pointers Offline Mode)
description: Creating Speed Hack and Super Jump on Pwn Adventure 3 using Cheat Engine
date: 2022-04-15
slug: Breaking-PWNAdventure3-Part2
teaser: /assets/images/pwnadventure/partII/cheattable.PNG
categories:
- capture the flag
- infosec
tags:
- reverse-engineering
- gamehacking
- cheatengine
---
In this part I will be explaining how to increase out player speed and our jump velocity  and finding pointers to these values to be persistant.

# Speed Hack & Super Jump
We can start by attaching our game to cheat engine and scaning for the health value of the player.
![](/assets/images/pwnadventure/partII/scan1.PNG)
We have our health address and now we can  find what instruction writes to this address when we get damaged by an enemy for that we need to right click on the address and select **Find out what writes to this address** or press **F6** a small window will be shown and it will be populated once we start getting damage.
![](/assets/images/pwnadventure/partII/writes2.PNG)
The instruction excecuted when getting damage is **sub [edi+30],eax** so the address in EDI is the base address of the player and offset 30 is the place where our player's health is stored. We can now click on that instruction to get more information and grab the address of EDI.
![](/assets/images/pwnadventure/partII/healthEDI.PNG)
In my case my EDI address is 0x4EC76D78 no we can use this address to view the structure related with the player for that we need to go to the disassembler and click the tools  and select Dissect Data Structure.
![](/assets/images/pwnadventure/partII/datastructure.PNG)
Normally in games the player or the enemy object's data such as health,position,names are stored in structures with an offset so each time the tries to access some for example the player's health all the game needs is the player's base address and incrementing these offsets will reach the player's health value.

>During Dissect Data Structure the base address should be used

Now we can add our players base address in the box labeled Group 1 and then click on structures and then Define a new structure.
![](/assets/images/pwnadventure/partII/datastructure1.PNG)
![](/assets/images/pwnadventure/partII/datastructure2.PNG)
We can verify this by going to offset 30 which contains our player's health value.Generally variables such as speed are defined in the program as a constant value.
Since this is the player structure the speed value has to be stored somewhere in this sturcture we can find it by moving down the structre and finding whole values such as 100 ,500.450 etc and changing it to a much higher value.

**This is not an efficent method as there are chances for our game to crash if we change a wrong structure value.**

At offset 190 there is a value of 200 we can add it to our address list and change it to a higher value and try moving in game.
<figure class="video_container">
  <video controls="true" allowfullscreen="true" >
    <source src="/assets/images/pwnadventure/partII/speed.mp4" type="video/mp4">
  </video>
</figure>
As we can see our player's movement speed increased and we are zooming across the map.

For superjump we use the same method to find the offset where our jump velocity is stored in this game its stored right next to the player's speed at offset 194 the default value is set to 420.Lets change it to a higher amount and try to jump.
![](/assets/images/pwnadventure/partII/jump.PNG)
<figure class="video_container">
  <video controls="true" allowfullscreen="true" >
    <source src="/assets/images/pwnadventure/partII/jump.mp4" type="video/mp4">
  </video>
</figure>
Changing it to a higher value has made our player to jump much higher but there is one issue unlike the Gode Mode hack that was made in previous part this is not persistant which means that if we close the game this memory address will become invalid due to [ASLR](https://www.techtarget.com/searchsecurity/definition/address-space-layout-randomization-ASLR) thats where pointers come in rescue.


# Pointers
Due to ASLR when a game restarts the previous addresses that were used will become invalid in order for the game to find the correct address pointers are used some games use single level pointers which means only one offset will be present.
Some games use multilevel pointers where there might be 5 or 6 levels of offsets.
[Guided hacking](https://guidedhacking.com/threads/understanding-pointers-how-to-find-pointers.14502/) and [LiveOverflow](https://www.youtube.com/watch?v=elI6vZR6HGE) has made an incredible set of videos that tells about pointers and why this is used in development.

We can now start by doing a pointer scan on the player's speed value by right clicking the value and selecting **pointer scan for this address** and continue which will give out a list of pointers that points to our player speed address normally we can use this method but for this game even though we get pointers that will be invalid when we restart the game since all the logic is tied to the GameLogic.dll file for that we need to find the starting and ending address of the DLL and restrict our pointer scan within that address space for that we can go to the dissassembler and click on view then Memory Regions which will give a list of addresses that the game uses scrolling down we need to find the address where our GameLogic.dll is being loaded to memory.
![](/assets/images/pwnadventure/partII/memory.PNG)
![](/assets/images/pwnadventure/partII/memory1.PNG)
We can see that the GameLogic.dll file is loaded at address 67E90000 so we can use this information to restrict our pointer scan.
![](/assets/images/pwnadventure/partII/pointer.PNG)
![](/assets/images/pwnadventure/partII/pointer1.PNG)
This will scan for pointers to our player's speed value within the DLL's address space.
![](/assets/images/pwnadventure/partII/pointer2.PNG)
The pointer scan result shows more that 5000 potential pointer paths to verify this we just have to restart the game and attach it to cheat engine.
![](/assets/images/pwnadventure/partII/pointer3.PNG)
Reattaching the game to cheat engine and checking the pointer scan result we can see that the values are all gone since the previous address is no longer available we can now rescan this pointer map for the value of 200 and see if we have some valid pointers.
![](/assets/images/pwnadventure/partII/pointer4.PNG)
Since we have restarted the game we need to find the player speed address again and copy the address and use that address to rescan for pointers by repeating this process we eventually end up in a pointer path that is valid.
![](/assets/images/pwnadventure/partII/cheattable.PNG)

>The cheat engine cheat table is available in my [github](https://github.com/rahulr311295/GameTrainers/blob/main/PwnAdventure3/CheatTable/PwnAdventure3.CT) if anyone wishes to try out.
