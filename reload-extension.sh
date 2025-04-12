#!/bin/bash

# Extension ID
EXTENSION_ID="hlhhaafemblfiflppdigjopkpgjdolpg"

# Kill any existing Chrome processes (optional, remove if you don't want this)
pkill -f chrome

# Start Chrome with the extension
chrome --load-extension="$PWD" &

# Open the extensions page
chrome "chrome://extensions/?id=$EXTENSION_ID" & 