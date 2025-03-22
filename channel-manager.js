document.addEventListener('DOMContentLoaded', () => {
  const channelName = document.getElementById('channelName');
  const channelUrl = document.getElementById('channelUrl');
  const channelDescription = document.getElementById('channelDescription');
  const addChannelButton = document.getElementById('addChannel');
  const channelList = document.getElementById('channelList');
  const channelStatus = document.getElementById('channelStatus');

  // Listen for configuration updates
  chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
    if (message.type === 'configUpdated') {
      // Clear existing channel list
      channelList.innerHTML = '';
      
      // Reload channels from storage
      chrome.storage.local.get('liveChannels', (data) => {
        const channels = data.liveChannels || [];
        channels.forEach(addChannelToUI);
      });
    }
  });

  // Display the channel in the UI
  function addChannelToUI(channel) {
    const li = document.createElement('li');
    li.className = 'feed-item';
    
    const channelInfo = document.createElement('div');
    channelInfo.className = 'feed-info';

    const titleDiv = document.createElement('div');
    titleDiv.className = 'feed-title';
    titleDiv.textContent = channel.name;
    channelInfo.appendChild(titleDiv);

    const detailsDiv = document.createElement('div');
    detailsDiv.className = 'feed-details';
    
    const urlSpan = document.createElement('span');
    urlSpan.className = 'feed-url';
    urlSpan.textContent = channel.url;
    
    const descSpan = document.createElement('span');
    descSpan.className = 'feed-description';
    descSpan.textContent = channel.description || '';
    
    detailsDiv.appendChild(urlSpan);
    detailsDiv.appendChild(descSpan);
    channelInfo.appendChild(detailsDiv);
    li.appendChild(channelInfo);

    const controls = document.createElement('div');
    controls.className = 'feed-controls';

    const removeBtn = document.createElement('button');
    removeBtn.className = 'feed-control-btn remove';
    removeBtn.textContent = '×';
    removeBtn.title = 'Remove channel';
    removeBtn.addEventListener('click', () => {
      chrome.storage.local.get('liveChannels', (data) => {
        const channels = data.liveChannels || [];
        const index = channels.findIndex(c => c.url === channel.url);
        if (index > -1) {
          channels.splice(index, 1);
          chrome.storage.local.set({ liveChannels: channels }, () => {
            li.remove();
            showStatus('Channel removed successfully!', 'success');
            // Notify the player window that a channel was removed
            chrome.runtime.sendMessage({ type: 'configImported' });
          });
        }
      });
    });

    controls.appendChild(removeBtn);
    li.appendChild(controls);
    channelList.appendChild(li);
  }

  // Add new channel
  addChannelButton.addEventListener('click', () => {
    const name = channelName.value.trim();
    const url = channelUrl.value.trim();
    const description = channelDescription.value.trim();

    if (!name || !url) {
      showStatus('Please enter both channel name and URL.', 'error');
      return;
    }

    // Validate URL format
    try {
      new URL(url);
    } catch (err) {
      showStatus('Invalid URL format. Please enter a valid URL starting with http:// or https://', 'error');
      return;
    }

    const newChannel = {
      name,
      url,
      description,
      type: 'live'
    };

    chrome.storage.local.get('liveChannels', (data) => {
      const channels = data.liveChannels || [];
      if (!channels.some(channel => channel.url === url)) {
        channels.push(newChannel);
        chrome.storage.local.set({ liveChannels: channels }, () => {
          addChannelToUI(newChannel);
          showStatus('Channel added successfully!', 'success');
          // Clear input fields
          channelName.value = '';
          channelUrl.value = '';
          channelDescription.value = '';
          // Notify the player window that a channel was added
          chrome.runtime.sendMessage({ type: 'configImported' });
        });
      } else {
        showStatus('This channel is already added.', 'error');
      }
    });
  });

  // Load existing channels
  chrome.storage.local.get('liveChannels', (data) => {
    const channels = data.liveChannels || [];
    channels.forEach(addChannelToUI);
  });

  function showStatus(message, type) {
    channelStatus.textContent = message;
    channelStatus.className = `status ${type}`;
    channelStatus.style.display = 'block';
    
    // Hide the status after 3 seconds
    setTimeout(() => {
      channelStatus.style.display = 'none';
    }, 3000);
  }
}); 