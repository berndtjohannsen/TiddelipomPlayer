// Wait for DOM to be ready before doing anything
if (document.readyState === 'loading') {
  document.addEventListener('DOMContentLoaded', initializePopup);
} else {
  initializePopup();
}

function initializePopup() {
  // Initialize UI elements
  const channelList = document.getElementById('channelList');
  const audioList = document.getElementById('audioList');
  const player = document.getElementById('player');
  const nowPlaying = document.getElementById('nowPlaying');

  // Check if we're in extension mode
  const isExtension = typeof chrome !== 'undefined' && chrome.runtime && chrome.runtime.id;

  if (!isExtension) {
    // Only try to resize window in standalone mode
    try {
      // Set initial size
      window.resizeTo(450, 600);
      
      // Force minimum width
      if (window.outerWidth < 450) {
        window.resizeTo(450, window.outerHeight);
      }

      // Prevent resizing below minimum width
      let resizeTimeout;
      window.addEventListener('resize', () => {
        clearTimeout(resizeTimeout);
        resizeTimeout = setTimeout(() => {
          if (window.outerWidth < 450) {
            window.resizeTo(450, window.outerHeight);
          }
        }, 100);
      });
    } catch (e) {
      console.log('Window resize not supported');
    }
  }

  // Initialize section toggle behavior
  function initializeSectionToggles() {
    const sections = document.querySelectorAll('.section');
    sections.forEach(section => {
      const header = section.querySelector('.section-header');
      const content = section.querySelector('.section-content');
      const toggleIcon = header.querySelector('.toggle-icon');

      header.addEventListener('click', () => {
        content.style.display = content.style.display === 'none' ? 'block' : 'none';
        toggleIcon.textContent = content.style.display === 'none' ? '▶' : '▼';
        toggleIcon.style.transform = content.style.display === 'none' ? 'rotate(-90deg)' : 'rotate(0)';
      });
    });
  }

  // Initialize sections
  initializeSectionToggles();

  if (isExtension) {
    // Extension-specific code
    initializeExtensionFeatures();
  } else {
    // Standalone-specific code
    initializeStandaloneFeatures();
  }
}

function initializeStandaloneFeatures() {
  // Add dummy content that matches extension structure
  const podContent = document.querySelector('#audioList .section-content');
  if (podContent) {
    // Create dummy feeds
    const dummyFeeds = [
      {
        title: 'History Podcast',
        episodes: [
          {
            title: 'The Roman Empire',
            date: 'March 15, 2024',
            url: '#'
          },
          {
            title: 'Ancient Egypt',
            date: 'March 10, 2024',
            url: '#'
          },
          {
            title: 'Medieval Europe',
            date: 'March 5, 2024',
            url: '#'
          }
        ]
      },
      {
        title: 'Science Today',
        episodes: [
          {
            title: 'Black Holes Explained',
            date: 'March 14, 2024',
            url: '#'
          },
          {
            title: 'The Future of AI',
            date: 'March 9, 2024',
            url: '#'
          }
        ]
      }
    ];

    // Clear existing content
    podContent.innerHTML = '';

    // Create feed sections
    dummyFeeds.forEach(feed => {
      const feedContainer = document.createElement('div');
      feedContainer.className = 'feed-container';

      // Create feed header with toggle
      const separator = document.createElement('div');
      separator.className = 'podcast-separator';
      
      const toggleIcon = document.createElement('span');
      toggleIcon.className = 'toggle-icon';
      toggleIcon.textContent = '▼';
      
      const titleText = document.createElement('span');
      titleText.textContent = feed.title;
      
      separator.appendChild(toggleIcon);
      separator.appendChild(titleText);
      feedContainer.appendChild(separator);

      // Create episodes container
      const episodesContainer = document.createElement('div');
      episodesContainer.className = 'feed-episodes';

      // Add header row
      const header = document.createElement('div');
      header.className = 'episode-header';
      
      const playHeader = document.createElement('div');
      playHeader.className = 'header-play';
      
      const titleHeader = document.createElement('div');
      titleHeader.className = 'header-title';
      titleHeader.textContent = 'Episode';
      
      const completeHeader = document.createElement('div');
      completeHeader.className = 'header-complete';
      completeHeader.textContent = 'Complete';
      
      header.appendChild(playHeader);
      header.appendChild(titleHeader);
      header.appendChild(completeHeader);
      episodesContainer.appendChild(header);

      // Add episodes
      feed.episodes.forEach(episode => {
        const episodeDiv = document.createElement('div');
        episodeDiv.className = 'audio-item';
        
        // Create play button
        const playBtn = document.createElement('button');
        playBtn.className = 'audio-control';
        playBtn.textContent = '⏵';
        playBtn.title = 'Play';

        // Create episode content
        const contentDiv = document.createElement('div');
        contentDiv.className = 'audio-content';
        
        const titleDiv = document.createElement('div');
        titleDiv.className = 'audio-title';
        titleDiv.textContent = episode.title;
        
        const dateDiv = document.createElement('div');
        dateDiv.className = 'audio-date';
        dateDiv.textContent = 'Publication date: ' + episode.date;
        
        contentDiv.appendChild(titleDiv);
        contentDiv.appendChild(dateDiv);

        // Create mark played button
        const markPlayedBtn = document.createElement('button');
        markPlayedBtn.className = 'audio-control mark-played';
        markPlayedBtn.textContent = '☐';
        markPlayedBtn.title = 'Mark as played';

        // Assemble episode
        episodeDiv.appendChild(playBtn);
        episodeDiv.appendChild(contentDiv);
        episodeDiv.appendChild(markPlayedBtn);
        episodesContainer.appendChild(episodeDiv);

        // Add click handlers
        playBtn.addEventListener('click', (e) => {
          e.stopPropagation();
          const allPlayBtns = document.querySelectorAll('.audio-control:not(.mark-played)');
          allPlayBtns.forEach(btn => {
            if (btn !== playBtn) btn.textContent = '⏵';
          });
          playBtn.textContent = playBtn.textContent === '⏵' ? '⏸' : '⏵';
        });

        markPlayedBtn.addEventListener('click', (e) => {
          e.stopPropagation();
          const isPlayed = markPlayedBtn.textContent === '☑';
          markPlayedBtn.textContent = isPlayed ? '☐' : '☑';
          markPlayedBtn.title = isPlayed ? 'Mark as played' : 'Mark as unplayed';
          episodeDiv.classList.toggle('played');
        });
      });

      // Add toggle behavior
      separator.addEventListener('click', () => {
        separator.classList.toggle('collapsed');
        episodesContainer.classList.toggle('collapsed');
        toggleIcon.textContent = separator.classList.contains('collapsed') ? '▶' : '▼';
      });

      // Assemble feed section
      feedContainer.appendChild(episodesContainer);
      podContent.appendChild(feedContainer);
    });
  }

  // Add dummy click handler for config button in standalone mode
  const configButton = document.getElementById('configButton');
  if (configButton) {
    configButton.addEventListener('click', () => {
      // Just for visual feedback in standalone mode
      configButton.classList.add('clicked');
      setTimeout(() => configButton.classList.remove('clicked'), 200);
    });
  }

  // Basic audio player functionality
  const player = document.getElementById('player');
  const nowPlaying = document.getElementById('nowPlaying');

  player.addEventListener('play', () => {
    // Basic play handling
  });

  player.addEventListener('pause', () => {
    // Basic pause handling
  });
}

function initializeExtensionFeatures() {
  // All the existing extension-specific code
  chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
    if (message.type === 'configImported') {
      // Clear existing UI
      const podContent = audioList.querySelector('.section-content');
      if (podContent) {
        podContent.innerHTML = '';
      }
      
      // Reload feeds from storage
      chrome.storage.local.get('feeds', (data) => {
        const feeds = data.feeds || [];
        if (feeds.length > 0) parseFeeds(feeds);
        
        // Notify config page to update its feed list
        chrome.runtime.sendMessage({ type: 'configUpdated' });
      });
    } else if (message.type === 'feedRemoved' || message.type === 'feedAdded') {
      // Reload feeds from storage after removal or addition
      chrome.storage.local.get('feeds', (data) => {
        const feeds = data.feeds || [];
        parseFeeds(feeds);
      });
    }
  });

  // Save position periodically and on pause/stop
  function savePosition() {
    const currentUrl = player.src;
    if (currentUrl && player.currentTime > 0) {
      chrome.storage.local.get('playbackPositions', (data) => {
        const positions = data.playbackPositions || {};
        positions[currentUrl] = player.currentTime;
        chrome.storage.local.set({ playbackPositions: positions });
      });
    }
  }

  // Start periodic saving when playing
  player.addEventListener('play', () => {
    // Save position every 5 seconds during playback
    savePositionInterval = setInterval(savePosition, 5000);
  });

  // Save position and clear interval when paused
  player.addEventListener('pause', () => {
    clearInterval(savePositionInterval);
    savePosition();
  });

  // Save position when switching audio or closing
  window.addEventListener('beforeunload', savePosition);

  // Function to create play button (simplified without resume indicator)
  function createPlayButton(url, title) {
    const playBtn = document.createElement('button');
    playBtn.className = 'audio-control';
    playBtn.textContent = '⏵';  // Unicode play triangle
    playBtn.title = 'Play';

    // Update this button's state when playback state changes
    player.addEventListener('play', () => {
      if (player.src === url) {
        playBtn.textContent = '⏸';  // Unicode pause symbol
        playBtn.title = 'Pause';
      } else {
        playBtn.textContent = '⏵';  // Reset other buttons
        playBtn.title = 'Play';
      }
    });

    player.addEventListener('pause', () => {
      if (player.src === url) {
        playBtn.textContent = '⏵';  // Unicode play triangle
        playBtn.title = 'Play';
      }
    });

    playBtn.addEventListener('click', (e) => {
      e.stopPropagation();

      if (player.src === url) {
        if (player.paused) {
          player.play().catch(err => {
            console.log('Play failed:', err);
          });
        } else {
          player.pause();
        }
      } else {
        playAudio(url, title);
      }
    });

    return playBtn;
  }

  // Modified playAudio function to restore position
  function playAudio(url, title) {
    // Stop current playback before loading new audio
    player.pause();
    
    // Load and play the new audio, restoring position if available
    chrome.storage.local.get(['playbackPositions', 'playedEpisodes'], (data) => {
      const positions = data.playbackPositions || {};
      const playedEpisodes = data.playedEpisodes || {};
      const savedPosition = positions[url] || 0;
      
      // Don't restore position if episode is marked as played
      const isPlayed = Object.values(playedEpisodes).some(urls => urls.includes(url));
      
      player.src = url;
      if (savedPosition > 0 && !isPlayed) {
        player.currentTime = savedPosition;
      } else {
        player.currentTime = 0;
      }
      
      player.play().catch(err => {
        console.log('Play failed:', err);
        if (err.name === 'AbortError') {
          nowPlaying.textContent = '';
        }
      });
      
      nowPlaying.textContent = title;
    });
  }

  // Function to mark episode as played/unplayed (simplified)
  function createMarkPlayedButton(audioUrl, title, feedUrl, isPlayed) {
    const button = document.createElement('button');
    button.textContent = isPlayed ? '☑' : '☐';  // Use checkbox icons
    button.className = 'audio-control mark-played';
    button.title = isPlayed ? 'Mark as unplayed' : 'Mark as played';

    button.addEventListener('click', () => {
      chrome.storage.local.get('playedEpisodes', (data) => {
        const playedEpisodes = data.playedEpisodes || {};
        
        if (!playedEpisodes[feedUrl]) {
          playedEpisodes[feedUrl] = [];
        }

        const audioItem = button.closest('.audio-item');
        
        if (isPlayed) {
          // Mark as unplayed
          playedEpisodes[feedUrl] = playedEpisodes[feedUrl].filter(url => url !== audioUrl);
          button.textContent = '☐';
          button.title = 'Mark as played';
          audioItem.classList.remove('played');
          isPlayed = false;
        } else {
          // Mark as played
          playedEpisodes[feedUrl].push(audioUrl);
          button.textContent = '☑';
          button.title = 'Mark as unplayed';
          audioItem.classList.add('played');
          isPlayed = true;
          
          // If this episode is currently playing, stop it
          if (player.src === audioUrl) {
            player.pause();
            player.currentTime = 0;
            nowPlaying.textContent = '';
          }
        }

        // Save played episodes without re-rendering the entire feed
        chrome.storage.local.set({ playedEpisodes });
      });
    });

    return button;
  }

  // Try to parse RSS feed
  async function tryParseRss(feedUrl) {
    return new Promise((resolve) => {
      chrome.runtime.sendMessage({ type: 'fetchFeed', url: feedUrl }, (response) => {
        if (chrome.runtime.lastError) {
          console.error('Error fetching feed:', chrome.runtime.lastError.message);
          resolve({ success: false, error: chrome.runtime.lastError.message });
          return;
        }
        if (!response) {
          console.error('No response from background script');
          resolve({ success: false, error: 'No response from server' });
          return;
        }
        if (response.success) {
          try {
            console.log('Received XML response:', response.xmlText.substring(0, 200) + '...');
            const xmlText = response.xmlText;
            const parser = new DOMParser();
            const xmlDoc = parser.parseFromString(xmlText, 'application/xml');
            
            // Check if parsing resulted in an error
            const parserError = xmlDoc.querySelector('parsererror');
            if (parserError) {
              resolve({ success: false, error: 'Invalid RSS feed format' });
              return;
            }
            
            resolve({ success: true, xmlDoc });
          } catch (err) {
            console.error('Error parsing feed:', err);
            resolve({ success: false, error: err.message });
          }
        } else {
          console.error('Error in feed response:', response.error);
          resolve({ success: false, error: response.error });
        }
      });
    });
  }

  // Fetch and parse feeds
  async function parseFeeds(feeds) {
    const podContent = audioList.querySelector('.section-content');
    if (!podContent) {
      console.error('Could not find pod section content');
      return;
    }
    podContent.innerHTML = '';
    
    for (const feedUrl of feeds) {
      const result = await tryParseRss(feedUrl);
      if (!result.success) continue;

      const xmlDoc = result.xmlDoc;
      const items = Array.from(xmlDoc.querySelectorAll('item'));
      const audioItems = items.filter(item => 
        item.querySelector('enclosure')?.getAttribute('type') === 'audio/mpeg'
      );

      // Get the feed title
      const feedTitle = xmlDoc.querySelector('channel > title')?.textContent || new URL(feedUrl).hostname;
      
      // Create feed container
      const feedContainer = document.createElement('div');
      feedContainer.className = 'feed-container';
      
      // Add feed title as separator with toggle
      const separator = document.createElement('div');
      separator.className = 'podcast-separator';
      
      const toggleIcon = document.createElement('span');
      toggleIcon.className = 'toggle-icon';
      toggleIcon.textContent = '▼';
      
      const titleText = document.createElement('span');
      titleText.textContent = feedTitle;
      
      separator.appendChild(toggleIcon);
      separator.appendChild(titleText);
      feedContainer.appendChild(separator);

      // Create episodes container
      const episodesContainer = document.createElement('div');
      episodesContainer.className = 'feed-episodes';

      // Add header row
      const header = document.createElement('div');
      header.className = 'episode-header';
      
      const playHeader = document.createElement('div');
      playHeader.className = 'header-play';
      
      const titleHeader = document.createElement('div');
      titleHeader.className = 'header-title';
      titleHeader.textContent = 'Episode';
      
      const completeHeader = document.createElement('div');
      completeHeader.className = 'header-complete';
      completeHeader.textContent = 'Complete';
      
      header.appendChild(playHeader);
      header.appendChild(titleHeader);
      header.appendChild(completeHeader);
      episodesContainer.appendChild(header);

      feedContainer.appendChild(episodesContainer);

      // Add click handler for expand/collapse
      separator.addEventListener('click', () => {
        separator.classList.toggle('collapsed');
        episodesContainer.classList.toggle('collapsed');
        toggleIcon.textContent = separator.classList.contains('collapsed') ? '▶' : '▼';
      });

      podContent.appendChild(feedContainer);

      // Get the number of episodes to show
      const limit = await new Promise(resolve => {
        chrome.storage.local.get('audioLimit', (data) => {
          resolve(parseInt(data.audioLimit) || 3);
        });
      });
      
      // Get played episodes for this feed
      const playedData = await chrome.storage.local.get('playedEpisodes');
      const playedEpisodes = playedData.playedEpisodes || {};
      const playedForFeed = playedEpisodes[feedUrl] || [];

      // Count how many of the first 'limit' items are played
      const playedInLimit = audioItems.slice(0, limit).filter(item => {
        const audioUrl = item.querySelector('enclosure')?.getAttribute('url');
        return audioUrl && playedForFeed.includes(audioUrl);
      }).length;

      // Show additional items equal to the number of played items
      const itemsToShow = audioItems.slice(0, limit + playedInLimit);

      // Show all items
      for (const item of itemsToShow) {
        const title = item.querySelector('title')?.textContent || 'Untitled';
        const audioUrl = item.querySelector('enclosure')?.getAttribute('url');
        const pubDate = item.querySelector('pubDate')?.textContent;
        
        if (!audioUrl) continue;

        const div = document.createElement('div');
        div.className = 'audio-item';

        // Create container for title and date
        const contentDiv = document.createElement('div');
        contentDiv.className = 'audio-content';

        // Add title
        const titleSpan = document.createElement('div');
        titleSpan.className = 'audio-title';
        titleSpan.textContent = title;
        contentDiv.appendChild(titleSpan);

        // Add date if available
        if (pubDate) {
          const dateDiv = document.createElement('div');
          dateDiv.className = 'audio-date';
          const date = new Date(pubDate);
          dateDiv.textContent = 'Publication date: ' + date.toLocaleDateString('en-US', {
            year: 'numeric',
            month: 'long',
            day: 'numeric'
          });
          contentDiv.appendChild(dateDiv);
        }

        // Check if episode is marked as played
        const isPlayed = playedForFeed.includes(audioUrl);
        if (isPlayed) {
          div.classList.add('played');
        }

        // Add play button (without resume indicator)
        const playButton = createPlayButton(audioUrl, title);
        div.appendChild(playButton);

        // Add content div with title and date
        div.appendChild(contentDiv);

        // Add mark as played/unplayed button
        const markPlayedButton = createMarkPlayedButton(audioUrl, title, feedUrl, isPlayed);
        div.appendChild(markPlayedButton);

        episodesContainer.appendChild(div);
      }
    }
  }

  // Handle audio limit changes
  chrome.storage.onChanged.addListener((changes, namespace) => {
    if (namespace === 'local' && changes.audioLimit) {
      chrome.storage.local.get('feeds', (data) => {
        const feeds = data.feeds || [];
        if (feeds.length > 0) {
          parseFeeds(feeds);
        }
      });
    }
  });

  // Load saved feeds
  chrome.storage.local.get(['feeds'], (data) => {
    const feeds = data.feeds || [];
    if (feeds.length === 0) {
      // Try to load startup configuration
      fetch(chrome.runtime.getURL('startup-config.json'))
        .then(response => response.json())
        .then(config => {
          if (config.feeds && config.feeds.length > 0) {
            const validFeeds = config.feeds.filter(feed => feed.url.trim() !== '');
            if (validFeeds.length > 0) {
              const feedUrls = validFeeds.map(feed => feed.url);
              chrome.storage.local.set({
                feeds: feedUrls,
                playedEpisodes: config.playedEpisodes || {},
                playbackPositions: config.playbackPositions || {}
              }, () => {
                if (validFeeds[0]?.maxEpisodes) {
                  // Setting audioLimit will trigger the storage change listener,
                  // which will call parseFeeds
                  chrome.storage.local.set({ audioLimit: validFeeds[0].maxEpisodes });
                } else {
                  // If no maxEpisodes, we need to call parseFeeds directly
                  parseFeeds(feedUrls);
                }
              });
            }
          }
        })
        .catch(err => console.warn('Failed to load startup configuration:', err));
    } else {
      parseFeeds(feeds);
    }
  });

  // Handle configuration button click
  document.getElementById('configButton').addEventListener('click', () => {
    chrome.tabs.create({
      url: chrome.runtime.getURL('config.html')
    });
  });
}
