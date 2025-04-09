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
      // Send message to trigger feed parsing
      chrome.runtime.sendMessage({ type: 'configImported' });
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
          
          const channel = xmlDoc.querySelector('channel');
          
          // Update title
          const feedTitle = channel.querySelector('title')?.textContent;
          if (feedTitle) {
            titleDiv.textContent = feedTitle;
          }

          // Get feed description
          const description = channel.querySelector('description')?.textContent;
          if (description) {
            const descDiv = document.createElement('div');
            descDiv.className = 'feed-description';
            
            // Create a temporary div to safely parse HTML
            const tempDiv = document.createElement('div');
            tempDiv.innerHTML = description;
            
            // Remove any script tags for security
            tempDiv.querySelectorAll('script').forEach(script => script.remove());
            
            // Clean the HTML and set it
            descDiv.innerHTML = tempDiv.innerHTML;
            
            feedInfo.insertBefore(descDiv, detailsDiv);
          }
          
          // Update episode count and last update
          const items = xmlDoc.querySelectorAll('item');
          const audioItems = Array.from(items).filter(item => 
            item.querySelector('enclosure')?.getAttribute('type') === 'audio/mpeg'
          );
          
          // Get latest episode date
          let latestDate = null;
          audioItems.forEach(item => {
            const pubDate = new Date(item.querySelector('pubDate')?.textContent);
            if (!latestDate || pubDate > latestDate) {
              latestDate = pubDate;
            }
          });

          const infoSpan = document.createElement('span');
          infoSpan.className = 'feed-info-text';
          infoSpan.textContent = `${audioItems.length} episodes`;
          if (latestDate) {
            infoSpan.textContent += ` • Updated: ${latestDate.toLocaleDateString()}`;
          }
          detailsDiv.appendChild(infoSpan);
          
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
  addRssButton.addEventListener('click', async () => {
    const input = rssInput.value.trim();
    
    // Try parsing as URL first
    try {
      new URL(input);
      // It's a valid URL, proceed with existing RSS feed addition logic
      addRSSFeed(input);
    } catch {
      // Not a URL, treat as podcast name search
      try {
        const response = await fetch(`https://itunes.apple.com/search?term=${encodeURIComponent(input)}&entity=podcast`);
        const data = await response.json();
        
        if (data.results.length === 0) {
          showStatus('No podcasts found with that name', 'error');
          return;
        }
        
        // Show results in a dropdown or modal
        showSearchResults(data.results);
      } catch (err) {
        showStatus('Error searching for podcast', 'error');
      }
    }
  });

  function showSearchResults(results) {
    // Remove any existing results
    const existingResults = document.querySelector('.search-results');
    if (existingResults) {
      existingResults.remove();
    }

    const resultsDiv = document.createElement('div');
    resultsDiv.className = 'search-results';
    
    // Add close button at the top
    const closeButton = document.createElement('button');
    closeButton.className = 'close-results';
    closeButton.innerHTML = '×';
    closeButton.title = 'Close';
    closeButton.onclick = () => resultsDiv.remove();
    resultsDiv.appendChild(closeButton);
    
    results.forEach(podcast => {
      const resultItem = document.createElement('div');
      resultItem.className = 'search-result-item';

      // Format episode count
      const episodeCount = podcast.trackCount ? `${podcast.trackCount} episodes` : '';
      
      resultItem.innerHTML = `
        <div class="podcast-title">${podcast.collectionName}</div>
        <div class="podcast-info">
          ${episodeCount}
          ${podcast.releaseDate ? ` • Updated: ${new Date(podcast.releaseDate).toLocaleDateString()}` : ''}
        </div>
      `;
      
      resultItem.addEventListener('click', () => {
        if (podcast.feedUrl) {
          addRSSFeed(podcast.feedUrl);
          resultsDiv.remove();
          rssInput.value = '';
        } else {
          showStatus('No RSS feed available for this podcast', 'error');
        }
      });
      
      resultsDiv.appendChild(resultItem);
    });

    // Add click outside handler
    document.addEventListener('click', (e) => {
      if (!resultsDiv.contains(e.target) && !rssInput.contains(e.target)) {
        resultsDiv.remove();
      }
    });

    // Close on input blur (with slight delay to allow for result clicking)
    rssInput.addEventListener('blur', () => {
      setTimeout(() => {
        if (!resultsDiv.matches(':hover')) {
          resultsDiv.remove();
        }
      }, 200);
    });

    rssInput.parentElement.appendChild(resultsDiv);
  }

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

  function addRSSFeed(feedUrl) {
    // Validate URL format
    try {
      new URL(feedUrl);
    } catch (err) {
      showStatus('Invalid URL format', 'error');
      return;
    }

    // Add to storage
    chrome.storage.local.get('feeds', (data) => {
      const feeds = data.feeds || [];
      if (!feeds.includes(feedUrl)) {
        feeds.push(feedUrl);
        chrome.storage.local.set({ feeds }, () => {
          addFeedToUI(feedUrl);
          showStatus('Feed added successfully!', 'success');
          // Clear input
          rssInput.value = '';
          // Notify that config was updated to trigger feed parsing
          chrome.runtime.sendMessage({ type: 'configImported' });
        });
      } else {
        showStatus('This feed is already added', 'error');
      }
    });
  }
}); 