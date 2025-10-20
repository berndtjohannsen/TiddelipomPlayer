#!/bin/bash

# Extension ID
EXTENSION_ID="hlhhaafemblfiflppdigjopkpgjdolpg"

# Kill any existing Chrome processes (optional, remove if you don't want this)
# pkill -f chrome

# Start Chrome with the extension
echo %cd%
C://"Program Files"/Google/Chrome/Application/chrome.exe --load extension=%cd%
# Open the extensions page
#chrome "chrome://extensions/?id=$EXTENSION_ID" & 