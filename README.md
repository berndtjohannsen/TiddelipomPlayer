# TiddelipomPlayer
This is a pod and "radio" player available as a Chrome extentsion. The approach is to make it simple and for example rely on an Internet connection. Pods are not downloaded.

(this is the continuation of the repository "SidebarRSS, which is no more maintained)

This is still work in progress.

After installing the extension, you can launch a "player" by clicking the icon. The player is a standard chrome window using the Chrome HTML player. The player can be configured by pressing a button in the gui.

Pods, channels and complete configurations can be added in the configuration window. There will be a number of configurations available in the GIT repository (or somehere else). The main purpose of these configurations is to be able to add live audio (radio) feeds which typically are not available as pods (RSS feeds).  You can also create you own configuration if you know the URL of a live feed.


To test: upload all files in Chrome (chrome://extensions)

Web APIs:
   This software uses standard Web APIs including:
   - Fetch API
   - Web Audio API
   - Web Storage API


Remaining work:
- better looks ..
- package as extension
- more channel configuration files
- a standalone player app for mobiles. This should work seamlessly (synch) with this chrome extension.
- maintain play positions when stopping a pod
- a way to import configuration files through HTTP (for example from git)



