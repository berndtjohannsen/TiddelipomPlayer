document.addEventListener('DOMContentLoaded', () => {
  const rssInput = document.getElementById('rssInput');
  const addRssButton = document.getElementById('addRss');
  const feedList = document.getElementById('feedList');
  const feedStatus = document.getElementById('feedStatus');

  // Listen for configuration updates
  chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
    if (message.type === 'configUpdated') {
      // Clear existing feed list
      feedList.innerHTML = '';
      
      // Reload feeds from storage
      chrome.storage.local.get('feeds', (data) => {
        const feeds = data.feeds || [];
        feeds.forEach(addFeedToUI);
      });
    }
  });

  // Display the RSS feed in the UI
  function addFeedToUI(feedUrl) {
    const li = document.createElement('li');
    li.className = 'feed-item';
    
    const feedInfo = document.createElement('div');
    feedInfo.className = 'feed-info';

    // Initially show URL as title, will be updated when feed is loaded
    const titleDiv = document.createElement('div');
    titleDiv.className = 'feed-title';
    try {
      titleDiv.textContent = new URL(feedUrl).hostname;
    } catch (err) {
      titleDiv.textContent = feedUrl;
    }
    feedInfo.appendChild(titleDiv);

    // Add error message container
    const errorDiv = document.createElement('div');
    errorDiv.className = 'feed-error';
    feedInfo.appendChild(errorDiv);

    const detailsDiv = document.createElement('div');
    detailsDiv.className = 'feed-details';
    
    const urlSpan = document.createElement('span');
    urlSpan.className = 'feed-url';
    urlSpan.textContent = feedUrl;
    
    const episodesSpan = document.createElement('span');
    episodesSpan.className = 'feed-episodes';
    detailsDiv.appendChild(urlSpan);
    detailsDiv.appendChild(episodesSpan);
    
    feedInfo.appendChild(detailsDiv);
    li.appendChild(feedInfo);

    const controls = document.createElement('div');
    controls.className = 'feed-controls';

    const refreshBtn = document.createElement('button');
    refreshBtn.className = 'feed-control-btn refresh';
    refreshBtn.textContent = '↻';
    refreshBtn.title = 'Refresh feed';
    refreshBtn.addEventListener('click', () => {
      chrome.storage.local.get('feeds', (data) => {
        const feeds = data.feeds || [];
        parseFeeds(feeds);
      });
    });

    const removeBtn = document.createElement('button');
    removeBtn.className = 'feed-control-btn remove';
    removeBtn.textContent = '×';
    removeBtn.title = 'Remove feed';
    removeBtn.addEventListener('click', () => {
      chrome.storage.local.get('feeds', (data) => {
        const feeds = data.feeds || [];
        const index = feeds.indexOf(feedUrl);
        if (index > -1) {
          feeds.splice(index, 1);
          chrome.storage.local.set({ feeds }, () => {
            li.remove();
            showStatus('Feed removed successfully!', 'success');
            // Notify the player window that a feed was removed
            chrome.runtime.sendMessage({ type: 'feedRemoved' });
          });
        }
      });
    });

    controls.appendChild(refreshBtn);
    controls.appendChild(removeBtn);
    li.appendChild(controls);
    feedList.appendChild(li);

    // Fetch feed info immediately to update title and episode count
    chrome.runtime.sendMessage({ type: 'fetchFeed', url: feedUrl }, (response) => {
      if (response?.success) {
        try {
          const parser = new DOMParser();
          const xmlDoc = parser.parseFromString(response.xmlText, 'application/xml');
          
          // Check if parsing resulted in an error
          const parserError = xmlDoc.querySelector('parsererror');
          if (parserError) {
            errorDiv.textContent = 'Invalid RSS feed format';
            errorDiv.style.display = 'block';
            return;
          }
          
          // Update title
          const feedTitle = xmlDoc.querySelector('channel > title')?.textContent;
          if (feedTitle) {
            titleDiv.textContent = feedTitle;
          }
          
          // Update episode count
          const items = xmlDoc.querySelectorAll('item');
          const audioItems = Array.from(items).filter(item => 
            item.querySelector('enclosure')?.getAttribute('type') === 'audio/mpeg'
          );
          episodesSpan.textContent = `Episodes: ${audioItems.length}`;
          
          // Clear any previous errors
          errorDiv.style.display = 'none';
        } catch (err) {
          console.error('Error parsing feed for UI:', err);
          errorDiv.textContent = 'Error parsing feed';
          errorDiv.style.display = 'block';
        }
      } else {
        errorDiv.textContent = response?.error || 'Failed to fetch feed';
        errorDiv.style.display = 'block';
      }
    });
  }

  // Add new feed URL
  addRssButton.addEventListener('click', () => {
    const feedUrl = rssInput.value.trim();
    if (!feedUrl) return;

    // Validate URL format
    try {
      new URL(feedUrl);
    } catch (err) {
      showStatus('Invalid URL format. Please enter a valid URL starting with http:// or https://', 'error');
      return;
    }

    chrome.storage.local.get('feeds', (data) => {
      const feeds = data.feeds || [];
      if (!feeds.includes(feedUrl)) {
        feeds.push(feedUrl);
        chrome.storage.local.set({ feeds }, () => {
          addFeedToUI(feedUrl);
          showStatus('Feed added successfully!', 'success');
          rssInput.value = '';
        });
      } else {
        showStatus('This feed is already added.', 'error');
      }
    });
  });

  // Load existing feeds
  chrome.storage.local.get('feeds', (data) => {
    const feeds = data.feeds || [];
    feeds.forEach(addFeedToUI);
  });

  function showStatus(message, type) {
    feedStatus.textContent = message;
    feedStatus.className = `status ${type}`;
    feedStatus.style.display = 'block';
    
    // Hide the status after 3 seconds
    setTimeout(() => {
      feedStatus.style.display = 'none';
    }, 3000);
  }
}); 