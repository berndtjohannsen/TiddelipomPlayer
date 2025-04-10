// Global variables
let currentlyPlayingUrl = null;
let playerEventsAdded = false;
let isSeekingManually = false;
let isRadioStream = false;

// Format time helper function
function formatTime(seconds) {
  if (!seconds || isNaN(seconds)) return '0:00';
  
  const hrs = Math.floor(seconds / 3600);
  const mins = Math.floor((seconds % 3600) / 60);
  const secs = Math.floor(seconds % 60);
  
  if (hrs > 0) {
    return `${hrs}:${mins.toString().padStart(2, '0')}:${secs.toString().padStart(2, '0')}`;
  }
  return `${mins}:${secs.toString().padStart(2, '0')}`;
}

// Wait for DOM to be ready before doing anything
if (document.readyState === 'loading') {
  document.addEventListener('DOMContentLoaded', initializePopup);
} else {
  initializePopup();
}

function initializePopup() {
  const player = document.getElementById('player');
  const nowPlaying = document.getElementById('nowPlaying');
  const playerContainer = document.querySelector('.player-container');

  // Make sure player is visible and has controls
  player.style.display = 'block';
  player.controls = true;
  player.defaultPlaybackRate = 1.0;  // Set default playback rate
  player.preservesPitch = true;      // Enable pitch preservation for all streams

  // Sync play/pause state with episode buttons
  player.addEventListener('play', () => {
    const currentUrl = player.src;
    const allPlayBtns = document.querySelectorAll('.audio-control:not(.mark-played)');
    allPlayBtns.forEach(btn => {
      if (btn.dataset.url === currentUrl) {
        btn.textContent = '⏸';
      } else {
        btn.textContent = '⏵';
      }
    });
  });

  player.addEventListener('pause', () => {
    const currentUrl = player.src;
    const allPlayBtns = document.querySelectorAll('.audio-control:not(.mark-played)');
    allPlayBtns.forEach(btn => {
      if (btn.dataset.url === currentUrl) {
        btn.textContent = '⏵';
      }
    });
  });

  // Handle content type detection
  player.addEventListener('loadstart', () => {
    // Check if URL contains common streaming indicators
    isRadioStream = player.src.includes('.m3u8') || 
                    player.src.includes('.m3u') ||
                    player.src.includes('stream') ||
                    player.src.includes('live');
    
    if (isRadioStream) {
      playerContainer.classList.add('radio');
      // Only append (LIVE) if it's not already there
      if (!nowPlaying.textContent.includes('(LIVE)')) {
        nowPlaying.textContent = nowPlaying.textContent + ' (LIVE)';
      }
    } else {
      playerContainer.classList.remove('radio');
    }
  });

  // Force enable playback rate functionality for all streams
  player.addEventListener('canplay', () => {
    // Ensure playback rate control is available
    if (player.playbackRate !== 1.0) {
      player.playbackRate = 1.0;  // Reset to default if needed
    }
    // Force the playback rate to be changeable
    Object.defineProperty(player, 'playbackRate', {
      writable: true,
      enumerable: true
    });
  });

  // Handle time updates for podcasts
  player.addEventListener('timeupdate', () => {
    if (!isRadioStream && player.duration) {
      // Update any episode progress if this is a podcast
      updateEpisodeProgress(player.currentTime, player.duration);
    }
  });

  // Initialize sections
  initializeSectionToggles();
  
  // Check if we're in extension mode
  const isExtension = typeof chrome !== 'undefined' && chrome.runtime && chrome.runtime.id;
  
  if (isExtension) {
    // Extension-specific initialization
    initializeExtensionFeatures();
  } else {
    // Standalone-specific initialization
    initializeStandaloneFeatures();
  }
  
  // Load live channels
  loadLiveChannels();
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
      
      const titleText = document.createElement('div');
      titleText.className = 'audio-title';  // Use same class as episode titles for consistent bold styling
      titleText.textContent = feed.title;
      
      const infoText = document.createElement('div');
      infoText.className = 'audio-date';  // Use same class as episode dates for consistent styling
      const dateStr = feed.episodes[0] ? feed.episodes[0].date : '';
      infoText.textContent = `${feed.episodes.length} episodes • ${dateStr}`;
      
      const titleContainer = document.createElement('div');
      titleContainer.className = 'audio-content';  // Use same container class as episodes
      titleContainer.appendChild(titleText);
      titleContainer.appendChild(infoText);
      
      // Create icons container
      const iconsContainer = document.createElement('div');
      iconsContainer.className = 'podcast-icons';
      iconsContainer.style.marginLeft = 'auto';  // Push icons to the right
      
      // Info icon
      const infoIcon = document.createElement('span');
      infoIcon.className = 'podcast-icon';
      infoIcon.textContent = 'ℹ';
      infoIcon.title = 'More information';
      infoIcon.addEventListener('click', (e) => {
        e.stopPropagation();  // Prevent toggle action
        
        // Get feed information from the XML
        const channelInfo = xmlDoc.querySelector('channel');
        const description = channelInfo.querySelector('description')?.textContent || '';
        const link = channelInfo.querySelector('link')?.textContent || '';
        const language = channelInfo.querySelector('language')?.textContent || '';
        const copyright = channelInfo.querySelector('copyright')?.textContent || '';
        const lastBuildDate = channelInfo.querySelector('lastBuildDate')?.textContent || '';
        
        // Remove any existing popup
        const existingPopup = document.querySelector('.feed-info-popup');
        if (existingPopup) {
          existingPopup.remove();
        }

        // Create popup content
        const infoContent = document.createElement('div');
        infoContent.className = 'feed-info-popup';
        
        // Add feed information (truncate description if too long)
        const truncatedDesc = description.length > 200 ? description.substring(0, 200) + '...' : description;
        
        infoContent.innerHTML = `
          <div class="feed-info-content">
            <h3>${feedTitle}</h3>
            <p>${truncatedDesc}</p>
            ${link ? `<p><strong>Website:</strong> <a href="${link}" target="_blank">${link}</a></p>` : ''}
            ${copyright ? `<p><strong>Copyright:</strong> ${copyright}</p>` : ''}
            ${lastBuildDate ? `<p><strong>Last updated:</strong> ${new Date(lastBuildDate).toLocaleDateString('en-US', {
              month: 'long',
              day: 'numeric',
              year: 'numeric'
            })}</p>` : ''}
          </div>
        `;
        
        // Add close button
        const closeButton = document.createElement('button');
        closeButton.className = 'feed-info-close';
        closeButton.textContent = '×';
        closeButton.addEventListener('click', (e) => {
          e.stopPropagation();
          infoContent.remove();
        });
        infoContent.insertBefore(closeButton, infoContent.firstChild);
        
        // Calculate position
        const iconRect = infoIcon.getBoundingClientRect();
        const scrollTop = window.scrollY || document.documentElement.scrollTop;
        
        // Position the popup below the icon
        infoContent.style.top = `${iconRect.bottom + 5}px`;  // 5px gap
        infoContent.style.left = '10px';  // Match margin from CSS
        
        // Add to body instead of feed container for fixed positioning
        document.body.appendChild(infoContent);
        
        // Adjust position if popup would go off screen
        const popupRect = infoContent.getBoundingClientRect();
        const viewportHeight = window.innerHeight;
        if (popupRect.bottom > viewportHeight) {
          // Position above the icon if it would go off screen below
          infoContent.style.top = `${iconRect.top - popupRect.height - 5}px`;
        }
        
        // Close popup when clicking outside
        document.addEventListener('click', function closePopup(e) {
          if (!infoContent.contains(e.target) && e.target !== infoIcon) {
            infoContent.remove();
            document.removeEventListener('click', closePopup);
          }
        });
      });
      
      // Refresh icon
      const refreshIcon = document.createElement('span');
      refreshIcon.className = 'podcast-icon';
      refreshIcon.textContent = '↻';
      refreshIcon.title = 'Refresh feed';
      refreshIcon.addEventListener('click', async (e) => {
        e.stopPropagation();  // Prevent toggle action
        
        // Show loading state
        refreshIcon.style.opacity = '0.5';
        refreshIcon.style.cursor = 'wait';
        
        try {
          // Re-fetch and parse this specific feed
          const result = await tryParseRss(feedUrl);
          if (result.success) {
            // Clear existing episodes
            episodesContainer.innerHTML = '';
            
            // Re-add the header row
            const header = document.createElement('div');
            header.className = 'episode-header';
            header.innerHTML = `
              <div class="header-play"></div>
              <div class="header-title">Episode</div>
              <div class="header-complete">Complete</div>
            `;
            episodesContainer.appendChild(header);
            
            // Get episodes limit
            const limit = await new Promise(resolve => {
              chrome.storage.local.get('audioLimit', (data) => {
                resolve(parseInt(data.audioLimit) || 3);
              });
            });
            
            // Get played episodes
            const playedData = await chrome.storage.local.get('playedEpisodes');
            const playedEpisodes = playedData.playedEpisodes || {};
            const playedForFeed = playedEpisodes[feedUrl] || [];
            
            // Process episodes
            const items = Array.from(result.xmlDoc.querySelectorAll('item'));
            const audioItems = items.filter(item => 
              item.querySelector('enclosure')?.getAttribute('type') === 'audio/mpeg'
            );
            
            // Update episode count and date in the header
            const episodeCount = audioItems.length;
            let feedLatestDate = null;
            audioItems.forEach(item => {
              const pubDate = item.querySelector('pubDate')?.textContent;
              if (pubDate) {
                const date = new Date(pubDate);
                if (!feedLatestDate || date > feedLatestDate) {
                  feedLatestDate = date;
                }
              }
            });
            
            // Update the info text
            const dateStr = feedLatestDate ? feedLatestDate.toLocaleDateString('en-US', { 
              month: 'short', 
              day: 'numeric', 
              year: 'numeric' 
            }) : '';
            infoText.textContent = `${episodeCount} episodes • ${dateStr}`;
            
            // Show episodes
            const playedInLimit = audioItems.slice(0, limit).filter(item => {
              const audioUrl = item.querySelector('enclosure')?.getAttribute('url');
              return audioUrl && playedForFeed.includes(audioUrl);
            }).length;
            
            const itemsToShow = audioItems.slice(0, limit + playedInLimit);
            
            for (const item of itemsToShow) {
              const title = item.querySelector('title')?.textContent || 'Untitled';
              const audioUrl = item.querySelector('enclosure')?.getAttribute('url');
              const pubDate = item.querySelector('pubDate')?.textContent;
              
              if (!audioUrl) continue;
              
              const div = document.createElement('div');
              div.className = 'audio-item';
              
              const contentDiv = document.createElement('div');
              contentDiv.className = 'audio-content';
              
              const titleSpan = document.createElement('div');
              titleSpan.className = 'audio-title';
              titleSpan.textContent = title;
              contentDiv.appendChild(titleSpan);
              
              if (pubDate) {
                const infoDiv = document.createElement('div');
                infoDiv.className = 'audio-info';
                
                const progressSpan = document.createElement('span');
                progressSpan.className = 'audio-progress';
                progressSpan.textContent = '0:00/--:--';  // Default before duration is known
                
                const dateSpan = document.createElement('span');
                dateSpan.className = 'audio-date';
                const date = new Date(pubDate);
                dateSpan.textContent = ' • Publication date: ' + date.toLocaleDateString('en-US', {
                  year: 'numeric',
                  month: 'long',
                  day: 'numeric'
                });
                
                infoDiv.appendChild(progressSpan);
                infoDiv.appendChild(dateSpan);
                contentDiv.appendChild(infoDiv);
              }
              
              // Format time helper function
              const formatTime = (seconds) => {
                const hrs = Math.floor(seconds / 3600);
                const mins = Math.floor((seconds % 3600) / 60);
                const secs = Math.floor(seconds % 60);
                if (hrs > 0) {
                  return `${hrs}:${mins.toString().padStart(2, '0')}:${secs.toString().padStart(2, '0')}`;
                }
                return `${mins}:${secs.toString().padStart(2, '0')}`;
              };

              // Create audio element for duration and progress tracking
              const audio = new Audio();
              audio.preload = 'metadata';  // Only load metadata to get duration
              audio.src = audioUrl;

              // Load duration when metadata is loaded
              audio.addEventListener('loadedmetadata', () => {
                const totalTime = formatTime(audio.duration);
                const currentTime = formatTime(audio.currentTime);
                const progressSpan = div.querySelector('.audio-progress');
                if (progressSpan) {
                  progressSpan.textContent = `${currentTime}/${totalTime}`;
                }
              });

              // Update time display during playback
              audio.addEventListener('timeupdate', () => {
                const totalTime = formatTime(audio.duration);
                const currentTime = formatTime(audio.currentTime);
                const progressSpan = div.querySelector('.audio-progress');
                if (progressSpan) {
                  progressSpan.textContent = `${currentTime}/${totalTime}`;
                }
              });

              // Store progress when playback stops
              audio.addEventListener('pause', async () => {
                const progress = {
                  currentTime: audio.currentTime,
                  duration: audio.duration,
                  lastPlayed: new Date().toISOString()
                };
                
                // Get existing progress data
                const progressData = await chrome.storage.local.get('episodeProgress') || {};
                const allProgress = progressData.episodeProgress || {};
                
                // Update progress for this episode
                allProgress[audioUrl] = progress;
                
                // Save back to storage
                await chrome.storage.local.set({ episodeProgress: allProgress });
              });

              // Load saved progress when creating episode
              chrome.storage.local.get('episodeProgress').then(data => {
                const progress = data.episodeProgress?.[audioUrl];
                if (progress) {
                  const currentTime = formatTime(progress.currentTime);
                  const totalTime = formatTime(progress.duration);
                  const progressSpan = div.querySelector('.audio-progress');
                  if (progressSpan) {
                    progressSpan.textContent = `${currentTime}/${totalTime}`;
                  }
                }
              });

              // Check if episode is marked as played
              const isPlayed = playedForFeed.includes(audioUrl);
              if (isPlayed) {
                div.classList.add('played');
              }

              // Add play button
              const playButton = createPlayButton(audioUrl, title);
              div.appendChild(playButton);

              // Add content div with title and info
              div.appendChild(contentDiv);

              // Add mark as played/unplayed button
              const markPlayedButton = createMarkPlayedButton(audioUrl, title, feedUrl, isPlayed);
              div.appendChild(markPlayedButton);

              episodesContainer.appendChild(div);
            }
          }
        } catch (error) {
          console.error('Error refreshing feed:', error);
        } finally {
          // Reset loading state
          refreshIcon.style.opacity = '1';
          refreshIcon.style.cursor = 'pointer';
        }
      });
      
      // Remove icon
      const removeIcon = document.createElement('span');
      removeIcon.className = 'podcast-icon';
      removeIcon.textContent = '×';
      removeIcon.title = 'Remove from player';
      removeIcon.addEventListener('click', async (e) => {
        e.stopPropagation();  // Prevent toggle action
        
        // Get current feeds
        const data = await new Promise(resolve => {
          chrome.storage.local.get('feeds', (data) => resolve(data));
        });
        
        // Remove this feed
        const feeds = data.feeds || [];
        const updatedFeeds = feeds.filter(f => f !== feedUrl);
        
        // Update storage
        await new Promise(resolve => {
          chrome.storage.local.set({ feeds: updatedFeeds }, resolve);
        });
        
        // Remove feed container from UI with animation
        feedContainer.style.transition = 'opacity 0.3s ease';
        feedContainer.style.opacity = '0';
        setTimeout(() => {
          feedContainer.remove();
        }, 300);
      });
      
      // Add icons to container
      iconsContainer.appendChild(infoIcon);
      iconsContainer.appendChild(refreshIcon);
      iconsContainer.appendChild(removeIcon);
      
      separator.appendChild(toggleIcon);
      separator.appendChild(titleContainer);
      separator.appendChild(iconsContainer);
      feedContainer.appendChild(separator);

      // Create episodes container
      const episodesContainer = document.createElement('div');
      episodesContainer.className = 'feed-episodes';

      // Remove header row code and directly start adding episodes
      feedContainer.appendChild(episodesContainer);

      // Add click handler for expand/collapse
      separator.addEventListener('click', () => {
        separator.classList.toggle('collapsed');
        episodesContainer.classList.toggle('collapsed');
        toggleIcon.textContent = separator.classList.contains('collapsed') ? '▶' : '▼';
      });

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

      // Reload live channels
      loadLiveChannels();
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

  // Function to create play button for both podcasts and radio
  function createPlayButton(url, title) {
    const playBtn = document.createElement('button');
    playBtn.className = 'audio-control';
    playBtn.textContent = '⏵';
    playBtn.title = 'Play';
    playBtn.dataset.url = url;

    playBtn.addEventListener('click', async (e) => {
      e.stopPropagation();
      
      // Stop other episodes and reset their buttons
      const allPlayBtns = document.querySelectorAll('.audio-control:not(.mark-played)');
      allPlayBtns.forEach(btn => {
        if (btn !== playBtn) {
          btn.textContent = '⏵';
        }
      });

      if (playBtn.textContent === '⏵') {
        try {
          // Save current progress before switching if we're playing something else
          if (player.src && player.src !== url && player.currentTime > 0) {
            await saveEpisodeProgress(player.src, player.currentTime, player.duration);
          }

          // Load saved progress before starting playback
          const progressData = await chrome.storage.local.get('episodeProgress');
          const savedProgress = progressData.episodeProgress?.[url];
          
          // Set source and position
          if (player.src !== url) {
            player.src = url;
            // Only set saved position if we have one and we're changing episodes
            if (savedProgress?.currentTime > 0) {
              player.currentTime = savedProgress.currentTime;
            } else {
              player.currentTime = 0;
            }
          }
          
          await player.play();
          playBtn.textContent = '⏸';
          currentlyPlayingUrl = url;
          nowPlaying.textContent = title;

          // Update seek slider if this is a podcast
          if (!isRadioStream) {
            const seekSlider = document.getElementById('seekSlider');
            const currentTimeSpan = document.getElementById('currentTime');
            const durationSpan = document.getElementById('duration');
            if (seekSlider && currentTimeSpan && durationSpan) {
              const percent = (player.currentTime / player.duration) * 100;
              seekSlider.value = percent;
              currentTimeSpan.textContent = formatTime(player.currentTime);
              durationSpan.textContent = formatTime(player.duration);
            }
          }
        } catch (err) {
          console.error('Playback failed:', err);
          playBtn.textContent = '⏵';
          currentlyPlayingUrl = null;
          handlePlaybackError(err, playBtn.closest('.audio-item'), playBtn);
        }
      } else {
        // Pausing playback - save current progress
        await saveEpisodeProgress(url, player.currentTime, player.duration);
        player.pause();
        playBtn.textContent = '⏵';
        currentlyPlayingUrl = null;
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

    button.addEventListener('click', async () => {
      // Clear any previous error messages
      const existingError = contentDiv.querySelector('.audio-error');
      if (existingError) {
        existingError.remove();
      }

      try {
        player.src = channel.url;
        player.play().catch(e => {
          handlePlaybackError(e.error || new Error('Playback failed'), contentDiv, playBtn);
        });
        playBtn.textContent = '⏸';
        nowPlaying.textContent = channel.name;
      } catch (err) {
        playBtn.textContent = '⏵';
        
        const errorDiv = document.createElement('div');
        errorDiv.className = 'audio-error';
        errorDiv.textContent = 'Cannot play audio - please check your internet connection';
        contentDiv.appendChild(errorDiv);
      }
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
    
    let totalEpisodes = 0;
    let latestDate = null;

    for (const feedUrl of feeds) {
      const result = await tryParseRss(feedUrl);
      if (!result.success) continue;

      const xmlDoc = result.xmlDoc;
      const items = Array.from(xmlDoc.querySelectorAll('item'));
      const audioItems = items.filter(item => 
        item.querySelector('enclosure')?.getAttribute('type') === 'audio/mpeg'
      );

      totalEpisodes += audioItems.length;

      // Update latest date
      audioItems.forEach(item => {
        const pubDate = item.querySelector('pubDate')?.textContent;
        if (pubDate) {
          const date = new Date(pubDate);
          if (!latestDate || date > latestDate) {
            latestDate = date;
          }
        }
      });

      // Get the feed title
      const feedTitle = xmlDoc.querySelector('channel > title')?.textContent || new URL(feedUrl).hostname;
      
      // Calculate episode count and latest date for this feed
      const episodeCount = audioItems.length;
      let feedLatestDate = null;
      audioItems.forEach(item => {
        const pubDate = item.querySelector('pubDate')?.textContent;
        if (pubDate) {
          const date = new Date(pubDate);
          if (!feedLatestDate || date > feedLatestDate) {
            feedLatestDate = date;
          }
        }
      });
      
      // Create feed container
      const feedContainer = document.createElement('div');
      feedContainer.className = 'feed-container';
      
      // Add feed title as separator with toggle
      const separator = document.createElement('div');
      separator.className = 'podcast-separator';
      
      const toggleIcon = document.createElement('span');
      toggleIcon.className = 'toggle-icon';
      toggleIcon.textContent = '▼';
      
      const titleText = document.createElement('div');
      titleText.className = 'audio-title';  // Use same class as episode titles for consistent bold styling
      titleText.textContent = feedTitle;
      
      const infoText = document.createElement('div');
      infoText.className = 'audio-date';  // Use same class as episode dates for consistent styling
      const dateStr = feedLatestDate ? feedLatestDate.toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' }) : '';
      infoText.textContent = `${episodeCount} episodes • ${dateStr}`;
      
      const titleContainer = document.createElement('div');
      titleContainer.className = 'audio-content';  // Use same container class as episodes
      titleContainer.appendChild(titleText);
      titleContainer.appendChild(infoText);
      
      // Create icons container
      const iconsContainer = document.createElement('div');
      iconsContainer.className = 'podcast-icons';
      iconsContainer.style.marginLeft = 'auto';  // Push icons to the right
      
      // Info icon
      const infoIcon = document.createElement('span');
      infoIcon.className = 'podcast-icon';
      infoIcon.textContent = 'ℹ';
      infoIcon.title = 'More information';
      infoIcon.addEventListener('click', (e) => {
        e.stopPropagation();  // Prevent toggle action
        
        // Get feed information from the XML
        const channelInfo = xmlDoc.querySelector('channel');
        const description = channelInfo.querySelector('description')?.textContent || '';
        const link = channelInfo.querySelector('link')?.textContent || '';
        const language = channelInfo.querySelector('language')?.textContent || '';
        const copyright = channelInfo.querySelector('copyright')?.textContent || '';
        const lastBuildDate = channelInfo.querySelector('lastBuildDate')?.textContent || '';
        
        // Remove any existing popup
        const existingPopup = document.querySelector('.feed-info-popup');
        if (existingPopup) {
          existingPopup.remove();
        }

        // Create popup content
        const infoContent = document.createElement('div');
        infoContent.className = 'feed-info-popup';
        
        // Add feed information (truncate description if too long)
        const truncatedDesc = description.length > 200 ? description.substring(0, 200) + '...' : description;
        
        infoContent.innerHTML = `
          <div class="feed-info-content">
            <h3>${feedTitle}</h3>
            <p>${truncatedDesc}</p>
            ${link ? `<p><strong>Website:</strong> <a href="${link}" target="_blank">${link}</a></p>` : ''}
            ${copyright ? `<p><strong>Copyright:</strong> ${copyright}</p>` : ''}
            ${lastBuildDate ? `<p><strong>Last updated:</strong> ${new Date(lastBuildDate).toLocaleDateString('en-US', {
              month: 'long',
              day: 'numeric',
              year: 'numeric'
            })}</p>` : ''}
          </div>
        `;
        
        // Add close button
        const closeButton = document.createElement('button');
        closeButton.className = 'feed-info-close';
        closeButton.textContent = '×';
        closeButton.addEventListener('click', (e) => {
          e.stopPropagation();
          infoContent.remove();
        });
        infoContent.insertBefore(closeButton, infoContent.firstChild);
        
        // Calculate position
        const iconRect = infoIcon.getBoundingClientRect();
        const scrollTop = window.scrollY || document.documentElement.scrollTop;
        
        // Position the popup below the icon
        infoContent.style.top = `${iconRect.bottom + 5}px`;  // 5px gap
        infoContent.style.left = '10px';  // Match margin from CSS
        
        // Add to body instead of feed container for fixed positioning
        document.body.appendChild(infoContent);
        
        // Adjust position if popup would go off screen
        const popupRect = infoContent.getBoundingClientRect();
        const viewportHeight = window.innerHeight;
        if (popupRect.bottom > viewportHeight) {
          // Position above the icon if it would go off screen below
          infoContent.style.top = `${iconRect.top - popupRect.height - 5}px`;
        }
        
        // Close popup when clicking outside
        document.addEventListener('click', function closePopup(e) {
          if (!infoContent.contains(e.target) && e.target !== infoIcon) {
            infoContent.remove();
            document.removeEventListener('click', closePopup);
          }
        });
      });
      
      // Refresh icon
      const refreshIcon = document.createElement('span');
      refreshIcon.className = 'podcast-icon';
      refreshIcon.textContent = '↻';
      refreshIcon.title = 'Refresh feed';
      refreshIcon.addEventListener('click', async (e) => {
        e.stopPropagation();  // Prevent toggle action
        
        // Show loading state
        refreshIcon.style.opacity = '0.5';
        refreshIcon.style.cursor = 'wait';
        
        try {
          // Re-fetch and parse this specific feed
          const result = await tryParseRss(feedUrl);
          if (result.success) {
            // Clear existing episodes
            episodesContainer.innerHTML = '';
            
            // Re-add the header row
            const header = document.createElement('div');
            header.className = 'episode-header';
            header.innerHTML = `
              <div class="header-play"></div>
              <div class="header-title">Episode</div>
              <div class="header-complete">Complete</div>
            `;
            episodesContainer.appendChild(header);
            
            // Get episodes limit
            const limit = await new Promise(resolve => {
              chrome.storage.local.get('audioLimit', (data) => {
                resolve(parseInt(data.audioLimit) || 3);
              });
            });
            
            // Get played episodes
            const playedData = await chrome.storage.local.get('playedEpisodes');
            const playedEpisodes = playedData.playedEpisodes || {};
            const playedForFeed = playedEpisodes[feedUrl] || [];
            
            // Process episodes
            const items = Array.from(result.xmlDoc.querySelectorAll('item'));
            const audioItems = items.filter(item => 
              item.querySelector('enclosure')?.getAttribute('type') === 'audio/mpeg'
            );
            
            // Update episode count and date in the header
            const episodeCount = audioItems.length;
            let feedLatestDate = null;
            audioItems.forEach(item => {
              const pubDate = item.querySelector('pubDate')?.textContent;
              if (pubDate) {
                const date = new Date(pubDate);
                if (!feedLatestDate || date > feedLatestDate) {
                  feedLatestDate = date;
                }
              }
            });
            
            // Update the info text
            const dateStr = feedLatestDate ? feedLatestDate.toLocaleDateString('en-US', { 
              month: 'short', 
              day: 'numeric', 
              year: 'numeric' 
            }) : '';
            infoText.textContent = `${episodeCount} episodes • ${dateStr}`;
            
            // Show episodes
            const playedInLimit = audioItems.slice(0, limit).filter(item => {
              const audioUrl = item.querySelector('enclosure')?.getAttribute('url');
              return audioUrl && playedForFeed.includes(audioUrl);
            }).length;
            
            const itemsToShow = audioItems.slice(0, limit + playedInLimit);
            
            for (const item of itemsToShow) {
              const title = item.querySelector('title')?.textContent || 'Untitled';
              const audioUrl = item.querySelector('enclosure')?.getAttribute('url');
              const pubDate = item.querySelector('pubDate')?.textContent;
              
              if (!audioUrl) continue;
              
              const div = document.createElement('div');
              div.className = 'audio-item';
              
              const contentDiv = document.createElement('div');
              contentDiv.className = 'audio-content';
              
              const titleSpan = document.createElement('div');
              titleSpan.className = 'audio-title';
              titleSpan.textContent = title;
              contentDiv.appendChild(titleSpan);
              
              if (pubDate) {
                const infoDiv = document.createElement('div');
                infoDiv.className = 'audio-info';
                
                const progressSpan = document.createElement('span');
                progressSpan.className = 'audio-progress';
                progressSpan.textContent = '0:00/--:--';  // Default before duration is known
                
                const dateSpan = document.createElement('span');
                dateSpan.className = 'audio-date';
                const date = new Date(pubDate);
                dateSpan.textContent = ' • Publication date: ' + date.toLocaleDateString('en-US', {
                  year: 'numeric',
                  month: 'long',
                  day: 'numeric'
                });
                
                infoDiv.appendChild(progressSpan);
                infoDiv.appendChild(dateSpan);
                contentDiv.appendChild(infoDiv);
              }
              
              // Format time helper function
              const formatTime = (seconds) => {
                const hrs = Math.floor(seconds / 3600);
                const mins = Math.floor((seconds % 3600) / 60);
                const secs = Math.floor(seconds % 60);
                if (hrs > 0) {
                  return `${hrs}:${mins.toString().padStart(2, '0')}:${secs.toString().padStart(2, '0')}`;
                }
                return `${mins}:${secs.toString().padStart(2, '0')}`;
              };

              // Create audio element for duration and progress tracking
              const audio = new Audio();
              audio.preload = 'metadata';  // Only load metadata to get duration
              audio.src = audioUrl;

              // Load duration when metadata is loaded
              audio.addEventListener('loadedmetadata', () => {
                const totalTime = formatTime(audio.duration);
                const currentTime = formatTime(audio.currentTime);
                const progressSpan = div.querySelector('.audio-progress');
                if (progressSpan) {
                  progressSpan.textContent = `${currentTime}/${totalTime}`;
                }
              });

              // Update time display during playback
              audio.addEventListener('timeupdate', () => {
                const totalTime = formatTime(audio.duration);
                const currentTime = formatTime(audio.currentTime);
                const progressSpan = div.querySelector('.audio-progress');
                if (progressSpan) {
                  progressSpan.textContent = `${currentTime}/${totalTime}`;
                }
              });

              // Store progress when playback stops
              audio.addEventListener('pause', async () => {
                const progress = {
                  currentTime: audio.currentTime,
                  duration: audio.duration,
                  lastPlayed: new Date().toISOString()
                };
                
                // Get existing progress data
                const progressData = await chrome.storage.local.get('episodeProgress') || {};
                const allProgress = progressData.episodeProgress || {};
                
                // Update progress for this episode
                allProgress[audioUrl] = progress;
                
                // Save back to storage
                await chrome.storage.local.set({ episodeProgress: allProgress });
              });

              // Load saved progress when creating episode
              chrome.storage.local.get('episodeProgress').then(data => {
                const progress = data.episodeProgress?.[audioUrl];
                if (progress) {
                  const currentTime = formatTime(progress.currentTime);
                  const totalTime = formatTime(progress.duration);
                  const progressSpan = div.querySelector('.audio-progress');
                  if (progressSpan) {
                    progressSpan.textContent = `${currentTime}/${totalTime}`;
                  }
                }
              });

              // Check if episode is marked as played
              const isPlayed = playedForFeed.includes(audioUrl);
              if (isPlayed) {
                div.classList.add('played');
              }

              // Add play button
              const playButton = createPlayButton(audioUrl, title);
              div.appendChild(playButton);

              // Add content div with title and info
              div.appendChild(contentDiv);

              // Add mark as played/unplayed button
              const markPlayedButton = createMarkPlayedButton(audioUrl, title, feedUrl, isPlayed);
              div.appendChild(markPlayedButton);

              episodesContainer.appendChild(div);
            }
          }
        } catch (error) {
          console.error('Error refreshing feed:', error);
        } finally {
          // Reset loading state
          refreshIcon.style.opacity = '1';
          refreshIcon.style.cursor = 'pointer';
        }
      });
      
      // Remove icon
      const removeIcon = document.createElement('span');
      removeIcon.className = 'podcast-icon';
      removeIcon.textContent = '×';
      removeIcon.title = 'Remove from player';
      removeIcon.addEventListener('click', async (e) => {
        e.stopPropagation();  // Prevent toggle action
        
        // Get current feeds
        const data = await new Promise(resolve => {
          chrome.storage.local.get('feeds', (data) => resolve(data));
        });
        
        // Remove this feed
        const feeds = data.feeds || [];
        const updatedFeeds = feeds.filter(f => f !== feedUrl);
        
        // Update storage
        await new Promise(resolve => {
          chrome.storage.local.set({ feeds: updatedFeeds }, resolve);
        });
        
        // Remove feed container from UI with animation
        feedContainer.style.transition = 'opacity 0.3s ease';
        feedContainer.style.opacity = '0';
        setTimeout(() => {
          feedContainer.remove();
        }, 300);
      });
      
      // Add icons to container
      iconsContainer.appendChild(infoIcon);
      iconsContainer.appendChild(refreshIcon);
      iconsContainer.appendChild(removeIcon);
      
      separator.appendChild(toggleIcon);
      separator.appendChild(titleContainer);
      separator.appendChild(iconsContainer);
      feedContainer.appendChild(separator);

      // Create episodes container
      const episodesContainer = document.createElement('div');
      episodesContainer.className = 'feed-episodes';

      // Remove header row code and directly start adding episodes
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
          const infoDiv = document.createElement('div');
          infoDiv.className = 'audio-info';
          
          const progressSpan = document.createElement('span');
          progressSpan.className = 'audio-progress';
          progressSpan.textContent = '0:00/--:--';  // Default before duration is known
          
          const dateSpan = document.createElement('span');
          dateSpan.className = 'audio-date';
          const date = new Date(pubDate);
          dateSpan.textContent = ' • Publication date: ' + date.toLocaleDateString('en-US', {
            year: 'numeric',
            month: 'long',
            day: 'numeric'
          });
          
          infoDiv.appendChild(progressSpan);
          infoDiv.appendChild(dateSpan);
          contentDiv.appendChild(infoDiv);
        }

        // Format time helper function
        const formatTime = (seconds) => {
          const hrs = Math.floor(seconds / 3600);
          const mins = Math.floor((seconds % 3600) / 60);
          const secs = Math.floor(seconds % 60);
          if (hrs > 0) {
            return `${hrs}:${mins.toString().padStart(2, '0')}:${secs.toString().padStart(2, '0')}`;
          }
          return `${mins}:${secs.toString().padStart(2, '0')}`;
        };

        // Create audio element for duration and progress tracking
        const audio = new Audio();
        audio.preload = 'metadata';  // Only load metadata to get duration
        audio.src = audioUrl;

        // Load duration when metadata is loaded
        audio.addEventListener('loadedmetadata', () => {
          const totalTime = formatTime(audio.duration);
          const currentTime = formatTime(audio.currentTime);
          const progressSpan = div.querySelector('.audio-progress');
          if (progressSpan) {
            progressSpan.textContent = `${currentTime}/${totalTime}`;
          }
        });

        // Update time display during playback
        audio.addEventListener('timeupdate', () => {
          const totalTime = formatTime(audio.duration);
          const currentTime = formatTime(audio.currentTime);
          const progressSpan = div.querySelector('.audio-progress');
          if (progressSpan) {
            progressSpan.textContent = `${currentTime}/${totalTime}`;
          }
        });

        // Store progress when playback stops
        audio.addEventListener('pause', async () => {
          const progress = {
            currentTime: audio.currentTime,
            duration: audio.duration,
            lastPlayed: new Date().toISOString()
          };
          
          // Get existing progress data
          const progressData = await chrome.storage.local.get('episodeProgress') || {};
          const allProgress = progressData.episodeProgress || {};
          
          // Update progress for this episode
          allProgress[audioUrl] = progress;
          
          // Save back to storage
          await chrome.storage.local.set({ episodeProgress: allProgress });
        });

        // Load saved progress when creating episode
        chrome.storage.local.get('episodeProgress').then(data => {
          const progress = data.episodeProgress?.[audioUrl];
          if (progress) {
            const currentTime = formatTime(progress.currentTime);
            const totalTime = formatTime(progress.duration);
            const progressSpan = div.querySelector('.audio-progress');
            if (progressSpan) {
              progressSpan.textContent = `${currentTime}/${totalTime}`;
            }
          }
        });

        // Check if episode is marked as played
        const isPlayed = playedForFeed.includes(audioUrl);
        if (isPlayed) {
          div.classList.add('played');
        }

        // Add play button
        const playButton = createPlayButton(audioUrl, title);
        div.appendChild(playButton);

        // Add content div with title and info
        div.appendChild(contentDiv);

        // Add mark as played/unplayed button
        const markPlayedButton = createMarkPlayedButton(audioUrl, title, feedUrl, isPlayed);
        div.appendChild(markPlayedButton);

        episodesContainer.appendChild(div);
      }
    }

    // Remove the main Pods header update since we're showing info per feed
    const podsHeader = document.querySelector('#audioList .section-header span:not(.toggle-icon)');
    if (podsHeader) {
      podsHeader.textContent = 'Pods';
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
  chrome.storage.local.get(['feeds', 'liveChannels'], (data) => {
    const feeds = data.feeds || [];
    const liveChannels = data.liveChannels || [];
    
    console.log('Initial storage check - feeds:', feeds, 'live channels:', liveChannels);
    
    if (feeds.length === 0 && liveChannels.length === 0) {
      // Try to load startup configuration
      console.log('Loading startup configuration...');
      fetch(chrome.runtime.getURL('startup-config.json'))
        .then(response => response.json())
        .then(config => {
          console.log('Loaded startup config:', config);
          if (config.feeds && config.feeds.length > 0) {
            // Separate RSS feeds and live channels
            const rssFeeds = config.feeds.filter(feed => feed.type === 'rss');
            const liveChannels = config.feeds.filter(feed => feed.type === 'live');

            console.log('Found RSS feeds:', rssFeeds);
            console.log('Found live channels:', liveChannels);

            // Store live channels
            chrome.storage.local.set({ liveChannels }, () => {
              console.log('Stored live channels');
              loadLiveChannels();  // Reload live channels after storing
            });

            // Process RSS feeds
            const validFeeds = rssFeeds.filter(feed => feed.url.trim() !== '');
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
      // Load existing data
      parseFeeds(feeds);
      if (liveChannels.length > 0) {
        console.log('Loading existing live channels:', liveChannels);
        loadLiveChannels();
      }
    }
  });

  // Handle configuration button click
  document.getElementById('configButton').addEventListener('click', () => {
    chrome.tabs.create({
      url: chrome.runtime.getURL('config.html')
    });
  });

  // Add these event listeners to the audio player
  player.addEventListener('playing', () => {
    // Clear ALL error messages when any playback starts
    document.querySelectorAll('.audio-error').forEach(error => error.remove());
  });

  player.addEventListener('loadstart', () => {
    // Clear ALL error messages when starting to load a new source
    document.querySelectorAll('.audio-error').forEach(error => error.remove());
  });
}

async function fetchFeed(url) {
  try {
    const response = await fetch(url);
    if (!response.ok) {
      throw new Error('Network response was not ok');
    }
    const text = await response.text();
    // ... rest of feed processing ...
  } catch (err) {
    // Show user-friendly error in the UI instead of console
    const feedError = document.createElement('div');
    feedError.className = 'feed-error';
    feedError.textContent = 'Could not load feed - please check your internet connection';
    feedContainer.appendChild(feedError);
    return null;
  }
}

function clearErrorMessages(contentDiv) {
  // Clear errors only for this specific channel's content div
  const existingError = contentDiv.querySelector('.audio-error');
  if (existingError) {
    existingError.remove();
  }
}

// Add event listener for when audio source actually starts playing
player.addEventListener('playing', () => {
  // Clear any error messages when playback successfully starts
  const allContentDivs = document.querySelectorAll('.channel-content');
  allContentDivs.forEach(div => clearErrorMessages(div));
});

function handlePlaybackError(err, contentDiv, playBtn) {
  if (!contentDiv) {
    console.warn('contentDiv not provided to error handler');
    return;  // Exit gracefully if contentDiv is not available
  }

  console.log('Playback error details:', {
    name: err.name,
    message: err.message,
    code: err.code,
    online: navigator.onLine
  });

  playBtn.textContent = '⏵';
  
  let errorMessage = 'Could not play this audio stream';
  
  if (err instanceof DOMException) {
    switch (err.name) {
      case 'AbortError':
        errorMessage = 'Playback was interrupted';
        break;
      case 'NetworkError':
        errorMessage = 'Network error - please check your connection';
        break;
      case 'NotAllowedError':
        errorMessage = 'Playback was blocked by your browser';
        break;
      case 'NotSupportedError':
        errorMessage = 'This audio format is not supported';
        break;
      case 'SecurityError':
        errorMessage = 'Access to the audio was blocked for security reasons';
        break;
      default:
        if (!navigator.onLine) {
          errorMessage = 'Cannot play audio - please check your internet connection';
        } else {
          errorMessage = `Playback error: ${err.message || err.name}`;
        }
    }
  }
  
  // Clear any existing error messages
  const existingError = contentDiv.querySelector('.audio-error');
  if (existingError) {
    existingError.remove();
  }
  
  const errorDiv = document.createElement('div');
  errorDiv.className = 'audio-error';
  errorDiv.textContent = errorMessage;
  contentDiv.appendChild(errorDiv);
}

// When setting up audio player event listeners
player.addEventListener('error', (e) => {
  const error = e.target.error || e.error;
  const channelContent = e.target.closest('.channel-content') || 
                        document.querySelector('.channel-content');
  const playBtn = channelContent?.querySelector('.audio-control');
  
  if (channelContent && playBtn) {
    handlePlaybackError(error || new Error('Unknown playback error'), channelContent, playBtn);
  } else {
    console.error('Playback error:', error);
  }
});

// Function to play live channel
function playLiveChannel(url, title) {
  // Stop any podcast playback
  const allPlayBtns = document.querySelectorAll('.audio-control:not(.mark-played)');
  allPlayBtns.forEach(btn => {
    btn.textContent = '⏵';
  });
  
  player.src = url;
  player.play().catch(err => {
    console.error('Failed to play live channel:', err);
  });
  currentlyPlayingUrl = url;
  nowPlaying.textContent = title;
}

// Update progress display for the current episode
function updateProgressDisplay(url) {
  if (!url) return;
  
  const progressSpan = document.querySelector(`[data-url="${url}"]`)
    ?.closest('.audio-item')
    ?.querySelector('.audio-progress');
    
  if (progressSpan) {
    const currentTime = formatTime(player.currentTime);
    const totalTime = formatTime(player.duration);
    progressSpan.textContent = `${currentTime}/${totalTime}`;
  }
}

// Add timeupdate listener to update progress
player.addEventListener('timeupdate', () => {
  if (currentlyPlayingUrl) {
    updateProgressDisplay(currentlyPlayingUrl);
  }
});

// Function to load and display live channels
function loadLiveChannels() {
  const channelList = document.getElementById('channelList');
  const channelContent = channelList.querySelector('.section-content');
  if (!channelContent) {
    return;
  }

  console.log('Loading live channels...');
  chrome.storage.local.get('liveChannels', (data) => {
    const channels = data.liveChannels || [];
    console.log('Found live channels:', channels);
    channelContent.innerHTML = '';

    // Create channels container
    const channelsContainer = document.createElement('div');
    channelsContainer.className = 'feed-container';

    // Add header row
    const header = document.createElement('div');
    header.className = 'episode-header';
    
    const playHeader = document.createElement('div');
    playHeader.className = 'header-play';
    
    const titleHeader = document.createElement('div');
    titleHeader.className = 'header-title';
    titleHeader.textContent = '';  // Remove 'Channel' text while keeping the structure

    const spacerHeader = document.createElement('div');
    spacerHeader.className = 'header-complete';
    spacerHeader.style.visibility = 'hidden';  // Hidden but maintains spacing
    
    header.appendChild(playHeader);
    header.appendChild(titleHeader);
    header.appendChild(spacerHeader);
    channelsContainer.appendChild(header);

    // Add each channel
    channels.forEach(channel => {
      console.log('Adding channel:', channel.name);
      const channelDiv = document.createElement('div');
      channelDiv.className = 'audio-item';

      // Create play button
      const playBtn = document.createElement('button');
      playBtn.className = 'audio-control';
      playBtn.textContent = '⏵';
      playBtn.title = 'Play';
      playBtn.dataset.url = channel.url;  // Add URL as data attribute

      // Create channel content
      const contentDiv = document.createElement('div');
      contentDiv.className = 'audio-content';
      
      const titleDiv = document.createElement('div');
      titleDiv.className = 'audio-title';
      titleDiv.textContent = channel.name;
      
      const descDiv = document.createElement('div');
      descDiv.className = 'audio-date';  // Using audio-date for consistent styling
      descDiv.textContent = channel.description;
      
      contentDiv.appendChild(titleDiv);
      contentDiv.appendChild(descDiv);

      // Add remove icon
      const removeDiv = document.createElement('div');
      removeDiv.className = 'channel-icons';
      const removeIcon = document.createElement('span');
      removeIcon.className = 'podcast-icon';
      removeIcon.textContent = '×';  // Using × for remove
      removeIcon.title = 'Remove channel';
      removeIcon.style.cursor = 'pointer';
      
      // Add click handler for remove icon
      removeIcon.addEventListener('click', async (e) => {
        e.stopPropagation();
        
        // Get current live channels
        const data = await chrome.storage.local.get('liveChannels');
        const channels = data.liveChannels || [];
        
        // Remove this channel
        const updatedChannels = channels.filter(ch => ch.url !== channel.url);
        
        // Update storage
        await chrome.storage.local.set({ liveChannels: updatedChannels });
        
        // Remove channel from UI with animation
        channelDiv.style.transition = 'opacity 0.3s ease';
        channelDiv.style.opacity = '0';
        setTimeout(() => {
          channelDiv.remove();
        }, 300);
      });
      
      removeDiv.appendChild(removeIcon);

      // Add click handler for play button
      playBtn.addEventListener('click', async (e) => {
        e.stopPropagation();
        
        const player = document.getElementById('player');
        const nowPlaying = document.getElementById('nowPlaying');
        
        if (player.src === channel.url) {
          // Same channel - just toggle play/pause
          if (player.paused) {
            player.play().catch(err => {
              handlePlaybackError(err, contentDiv, playBtn);
            });
            playBtn.textContent = '⏸';
          } else {
            player.pause();
            playBtn.textContent = '⏵';
          }
        } else {
          // Different channel - stop current and play new
          player.pause();
          
          // Reset all other play buttons
          document.querySelectorAll('.audio-control').forEach(btn => {
            btn.textContent = '⏵';
          });
          
          // Clear any previous error messages
          clearErrorMessages(contentDiv);

          // Play this channel
          try {
            // First check if we can reach the URL
            const checkResponse = await fetch(channel.url, { method: 'HEAD' });
            if (!checkResponse.ok) {
              throw new Error('NetworkError');
            }

            player.src = channel.url;
            await player.play();  // Wait for play to succeed before changing button
            playBtn.textContent = '⏸';
            nowPlaying.textContent = channel.name;
          } catch (err) {
            playBtn.textContent = '⏵';  // Ensure button shows play state on error
            handlePlaybackError(err, contentDiv, playBtn);
          }
        }
      });

      // Assemble channel item
      channelDiv.appendChild(playBtn);
      channelDiv.appendChild(contentDiv);
      channelDiv.appendChild(removeDiv);
      channelsContainer.appendChild(channelDiv);
    });

    channelContent.appendChild(channelsContainer);
  });
}

// Function to update episode progress in the list
function updateEpisodeProgress(currentTime, duration) {
  if (!currentTime || !duration) return;
  
  const currentEpisodeUrl = player.src;
  const episodeItems = document.querySelectorAll('.audio-item');
  
  episodeItems.forEach(async (item) => {
    const playBtn = item.querySelector('.audio-control');
    const progressEl = item.querySelector('.audio-progress');
    if (!playBtn || !progressEl) return;

    if (playBtn.dataset.url === currentEpisodeUrl) {
      // Update currently playing episode
      const currentTimeStr = formatTime(currentTime);
      const durationStr = formatTime(duration);
      progressEl.textContent = `${currentTimeStr} / ${durationStr}`;
    } else {
      // For non-playing episodes, load their saved progress
      try {
        const data = await chrome.storage.local.get('episodeProgress');
        const progress = data.episodeProgress?.[playBtn.dataset.url];
        if (progress?.duration) {  // Only update if we have valid duration
          const savedTimeStr = formatTime(progress.currentTime);
          const savedDurationStr = formatTime(progress.duration);
          progressEl.textContent = `${savedTimeStr} / ${savedDurationStr}`;
        }
      } catch (err) {
        console.error('Error loading progress:', err);
      }
    }
  });
}

// Function to save episode progress
async function saveEpisodeProgress(url, currentTime, duration) {
  if (!url || !duration) return;
  
  try {
    const data = await chrome.storage.local.get('episodeProgress');
    const allProgress = data.episodeProgress || {};
    allProgress[url] = {
      currentTime,
      duration,
      lastPlayed: new Date().toISOString()
    };
    await chrome.storage.local.set({ episodeProgress: allProgress });
  } catch (err) {
    console.error('Error saving progress:', err);
  }
}

// Add this to the initializePopup function after player initialization
function initializeSeekControl() {
  const seekControl = document.getElementById('seekControl');
  const seekSlider = document.getElementById('seekSlider');
  const currentTimeSpan = document.getElementById('currentTime');
  const durationSpan = document.getElementById('duration');
  const playerContainer = document.querySelector('.player-container');

  // Handle content type detection
  player.addEventListener('loadstart', () => {
    // Check if URL contains common streaming indicators
    isRadioStream = player.src.includes('.m3u8') || 
                    player.src.includes('.m3u') ||
                    player.src.includes('stream') ||
                    player.src.includes('live');
    
    if (isRadioStream) {
      playerContainer.classList.add('radio');
      seekControl.style.display = 'none';
      nowPlaying.textContent = nowPlaying.textContent + ' (LIVE)';
    } else {
      playerContainer.classList.remove('radio');
      seekControl.style.display = 'block';
    }
  });

  // Update seek slider and time display during playback
  player.addEventListener('timeupdate', () => {
    if (!isRadioStream) {
      const percent = (player.currentTime / player.duration) * 100;
      seekSlider.value = percent;
      currentTimeSpan.textContent = formatTime(player.currentTime);
      durationSpan.textContent = formatTime(player.duration);
    }
  });

  // Update duration when metadata is loaded
  player.addEventListener('loadedmetadata', () => {
    if (!isRadioStream) {
      durationSpan.textContent = formatTime(player.duration);
    }
  });

  // Handle manual seeking
  seekSlider.addEventListener('mousedown', () => {
    isSeekingManually = true;
  });

  seekSlider.addEventListener('input', () => {
    if (!isRadioStream) {
      const time = (seekSlider.value / 100) * player.duration;
      currentTimeSpan.textContent = formatTime(time);
    }
  });

  seekSlider.addEventListener('change', () => {
    if (!isRadioStream) {
      const time = (seekSlider.value / 100) * player.duration;
      player.currentTime = time;
      isSeekingManually = false;
    }
  });
}
