---
title: Hackthebox GamePWN CubeMadness1
description: This is the walkthrough for the newly introduced challenge category GamePWN on HackTheBox
date: 2022-04-04
slug: HackTheBox-GamePWN
teaser: /assets/images/gamepwn-cubemadness/teaser.png
categories:
- capture the flag
- infosec
tags:
- hackthebox
- gamehacking
- cheatengine
---
While searching through hackthebox I came across a new challenge category called GamePWN which was related to game hacking so I thought why don't I give it a try on something new.
So I downloaded the zip file and extracted it which contained the game binary which was developed in Unity Engine.

![](/assets/images/gamepwn-cubemadness/files.png)

Most unity games are developed with C# which can be de-compiled directly using [dnSpy](https://github.com/dnSpy/dnSpy) by dropping the executable or the GameAssembly.dll file,But in this case the game assembly was actually build with [il2cpp](https://docs.unity3d.com/Manual/IL2CPP.html) which converts C# code to C++ which is actually used by developers to stop reverse engineering and leaking their game's source code.

![](/assets/images/gamepwn-cubemadness/dnspy.png)

There are tools such as [Il2CppInspector](https://github.com/djkaty/Il2CppInspector) and [Il2CppDumper](https://github.com/Perfare/Il2CppDumper) that can be used to convert the DLL to a somewhat readable form.
But this challenge wont require such drastic measures all we need is good old [CheatEngine](https://www.cheatengine.org/) which is an OP tool used by game hackers or reverse engineers to edit game memory on the fly.
Our end goal of this challenge is to collect 20 cubes inorder to win but the game only has 6 cubes 

![](/assets/images/gamepwn-cubemadness/teaser.png)

So we need to change the current value of our collected cubes to 20 inorder to read the flag for that we need to start the game and then attach the game's process to CheatEngine.

![](/assets/images/gamepwn-cubemadness/cheatengine.png)

Now we have attached our game's process to CheatEngine, Now we need to find the memory address where the current score is stored.

![](/assets/images/gamepwn-cubemadness/cheatengine1.png)

Usually in the development phase of a game values such as Health,Ammo,XP,Score are stored in 4 byte integer values so we can start our initial scan by setting the Scan Type to Exact Values and the Value Type as 4 Bytes and search for the value 0 which is our current score.

![](/assets/images/gamepwn-cubemadness/cheatengine2.png)

As we can see in the above image we have a huge list of addresses where our initial value is zero we can now narrow it down by collecting a single cube in the game and then changing the Scan Type to Increased By and setting the value as 1 since we collected a cube and clicking the Next Scan button.

![](/assets/images/gamepwn-cubemadness/cheatengine3.png)

Now our address values have dropped down to around 37 thousand we can use the same method to further filter the memory addresses.

![](/assets/images/gamepwn-cubemadness/cheatengine4.png)

Now our address values have dropped even more to just 3 thousand occurances.

![](/assets/images/gamepwn-cubemadness/cheatengine5.png)

Generally in a game there are certain memory locations that keeps changing every tick(seconds) we can filter that out by changing the Scan Type to Unchanged Values.

![](/assets/images/gamepwn-cubemadness/cheatengine6.png)

By following the same method by collecting a couple of cubes and then using that value to do an increased by value scan we will end up with 3 or 4 memory addresses.

![](/assets/images/gamepwn-cubemadness/cheatengine7.png)

We can now double click on those memory addresses which will be added to our address list below.

![](/assets/images/gamepwn-cubemadness/cheatengine8.png)

Now we can select the memory addresses one by one and change the value to check weather it is the correct memory address.

![](/assets/images/gamepwn-cubemadness/cheatengine.gif)

We can see that we have found the memory address where the score is being stored now we can read the flag by changing the score to 20 or above.

![](/assets/images/gamepwn-cubemadness/win.png)


**Also I will be posting more on GameHacking in this website most of them will be offline hacks and some online hacks such as ESP and AimBots.**
