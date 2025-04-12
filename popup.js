// Global variables
let currentlyPlayingUrl = null;
let playerEventsAdded = false;
let isSeekingManually = false;
let isRadioStream = false;
let savePositionInterval = null;

// Import the audio player manager
import audioPlayer from './audio-player.js';

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

// Function to create episode element
function createEpisodeElement(item, feedUrl) {
  const episodeDiv = document.createElement('div');
  episodeDiv.className = 'audio-item';
  
  const playBtn = document.createElement('button');
  playBtn.className = 'audio-control';
  playBtn.textContent = '⏵';
  playBtn.dataset.url = item.url;
  playBtn.addEventListener('click', (e) => {
    e.stopPropagation();
    audioPlayer.playAudio(item.url, item.title);
  });
  
  const contentDiv = document.createElement('div');
  contentDiv.className = 'audio-content';
  
  const titleSpan = document.createElement('div');
  titleSpan.className = 'audio-title';
  titleSpan.textContent = item.title;
  contentDiv.appendChild(titleSpan);
  
  if (item.date) {
    const infoDiv = document.createElement('div');
    infoDiv.className = 'audio-info';
    
    const progressSpan = document.createElement('span');
    progressSpan.className = 'audio-progress';
    progressSpan.textContent = '0:00/--:--';
    
    const dateSpan = document.createElement('span');
    dateSpan.className = 'audio-date';
    const date = new Date(item.date);
    dateSpan.textContent = ' • Publication date: ' + date.toLocaleDateString('en-US', {
      year: 'numeric',
      month: 'long',
      day: 'numeric'
    });
    
    infoDiv.appendChild(progressSpan);
    infoDiv.appendChild(dateSpan);
    contentDiv.appendChild(infoDiv);
  }
  
  episodeDiv.appendChild(playBtn);
  episodeDiv.appendChild(contentDiv);
  episodeDiv.appendChild(createMarkPlayedButton(item.url, item.title, feedUrl));
  
  // Create audio element for duration and progress tracking
  const audio = new Audio();
  audio.preload = 'metadata';  // Only load metadata to get duration
  audio.src = item.url;

  // Load duration when metadata is loaded
  audio.addEventListener('loadedmetadata', () => {
    const totalTime = formatTime(audio.duration);
    const currentTime = formatTime(0);  // Start at 0
    const progressSpan = episodeDiv.querySelector('.audio-progress');
    if (progressSpan) {
      progressSpan.textContent = `${currentTime}/${totalTime}`;
    }
    
    // Save the duration for future use
    saveEpisodeProgress(item.url, 0, audio.duration);
  });

  // Load saved progress if available
  chrome.storage.local.get('episodeProgress', (data) => {
    const progress = data.episodeProgress?.[item.url];
    if (progress?.currentTime > 0) {  // Only update if we have a saved position
      const progressSpan = episodeDiv.querySelector('.audio-progress');
      if (progressSpan) {
        const currentTimeStr = formatTime(progress.currentTime);
        const durationStr = formatTime(progress.duration);
        progressSpan.textContent = `${currentTimeStr}/${durationStr}`;
      }
    }
  });
  
  return episodeDiv;
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
      refreshIcon.textContent = '⟳';
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
            // Process items
            const refreshedItems = Array.from(result.xmlDoc.querySelectorAll('item')).map(item => ({
              title: item.querySelector('title')?.textContent || 'Untitled',
              url: item.querySelector('enclosure')?.getAttribute('url') || '',
              date: item.querySelector('pubDate')?.textContent || ''
            })).filter(item => item.url);

            // Load episodes using our new function
            const { remaining, hasMore } = loadEpisodes(refreshedItems, feedUrl, episodesContainer);

            // Update load more button if needed
            const existingLoadMoreBtn = episodesContainer.querySelector('.load-more-button');
            if (hasMore) {
              if (!existingLoadMoreBtn) {
                const loadMoreBtn = document.createElement('button');
                loadMoreBtn.className = 'load-more-button';
                loadMoreBtn.textContent = 'Load 5 more episodes';
                
                loadMoreBtn.addEventListener('click', () => {
                  loadMoreBtn.remove();
                  const { remaining: newRemaining, hasMore: newHasMore } = loadEpisodes(
                    refreshedItems,
                    feedUrl,
                    episodesContainer,
                    refreshedItems.length - remaining.length
                  );
                  
                  if (newHasMore) {
                    episodesContainer.appendChild(loadMoreBtn);
                  }
                });
                
                episodesContainer.appendChild(loadMoreBtn);
              }
            } else if (existingLoadMoreBtn) {
              existingLoadMoreBtn.remove();
            }
          }
        } catch (error) {
          console.error('Error refreshing feed:', error);
        } finally {
          // Reset icon state
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
        
        // Remove this feed
        const feeds = await new Promise(resolve => {
          chrome.storage.local.get('feeds', (data) => {
            resolve(data.feeds || []);
          });
        });
        
        const updatedFeeds = feeds.filter(f => f.url !== feedUrl);
        await chrome.storage.local.set({ feeds: updatedFeeds });
        
        // Remove feed container from UI with animation
        feedContainer.style.opacity = '0';
        feedContainer.style.transform = 'translateX(-20px)';
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

      // Load initial episodes
      const { remaining, hasMore } = loadEpisodes(podcastItems, feedUrl, episodesContainer);

      // Add load more button if there are remaining episodes
      if (hasMore) {
        const loadMoreBtn = document.createElement('button');
        loadMoreBtn.className = 'load-more-button';
        loadMoreBtn.textContent = 'Load 5 more episodes';
        
        loadMoreBtn.addEventListener('click', () => {
          loadMoreBtn.remove();
          const { remaining: newRemaining, hasMore: newHasMore } = loadEpisodes(
            podcastItems,
            feedUrl,
            episodesContainer,
            podcastItems.length - remaining.length
          );
          
          if (newHasMore) {
            episodesContainer.appendChild(loadMoreBtn);
          }
        });
        
        episodesContainer.appendChild(loadMoreBtn);
      }

      // Add containers to feed
      separator.appendChild(toggleIcon);
      separator.appendChild(titleContainer);
      separator.appendChild(iconsContainer);
      feedContainer.appendChild(separator);
      feedContainer.appendChild(episodesContainer);
      podContent.appendChild(feedContainer);

      // Add click handler for expand/collapse
      separator.addEventListener('click', () => {
        separator.classList.toggle('collapsed');
        episodesContainer.classList.toggle('collapsed');
        toggleIcon.textContent = separator.classList.contains('collapsed') ? '▶' : '▼';
      });
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

// Function to create mark played button
function createMarkPlayedButton(audioUrl, title, feedUrl) {
  const button = document.createElement('button');
  button.className = 'audio-control mark-played';
  button.textContent = '☐';
  button.title = 'Mark as played';
  
  // Check if episode is already marked as played
  chrome.storage.local.get('playedEpisodes', (data) => {
    const playedEpisodes = data.playedEpisodes || {};
    const feedEpisodes = playedEpisodes[feedUrl] || [];
    if (feedEpisodes.includes(audioUrl)) {
      button.textContent = '☑';
      button.title = 'Mark as unplayed';
    }
  });

  button.addEventListener('click', async (e) => {
    e.stopPropagation();
    
    // Get current played episodes
    const data = await chrome.storage.local.get('playedEpisodes');
    const playedEpisodes = data.playedEpisodes || {};
    const feedEpisodes = playedEpisodes[feedUrl] || [];
    
    if (button.textContent === '☐') {
      // Mark as played
      button.textContent = '☑';
      button.title = 'Mark as unplayed';
      if (!feedEpisodes.includes(audioUrl)) {
        feedEpisodes.push(audioUrl);
      }
    } else {
      // Mark as unplayed
      button.textContent = '☐';
      button.title = 'Mark as played';
      const index = feedEpisodes.indexOf(audioUrl);
      if (index !== -1) {
        feedEpisodes.splice(index, 1);
      }
    }
    
    // Update storage
    playedEpisodes[feedUrl] = feedEpisodes;
    await chrome.storage.local.set({ playedEpisodes });
  });

  return button;
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
      try {
        chrome.storage.local.get('playbackPositions', (data) => {
          try {
            const positions = data.playbackPositions || {};
            positions[currentUrl] = player.currentTime;
            chrome.storage.local.set({ playbackPositions: positions });
          } catch (err) {
            console.warn('Error saving playback position:', err);
            // Clear the interval if we can't save
            clearInterval(savePositionInterval);
          }
        });
      } catch (err) {
        console.warn('Error accessing storage:', err);
        // Clear the interval if we can't access storage
        clearInterval(savePositionInterval);
      }
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

  // Modified playAudio function to properly handle position restoration
  function playAudio(url, title) {
    const player = document.getElementById('player');
    const nowPlaying = document.getElementById('nowPlaying');
    
    // If this is the same episode and it's already playing, pause it
    if (player.src === url && !player.paused) {
      player.pause();
      if (playBtn) {
        playBtn.textContent = '⏵';
      }
      return;
    }
    
    // Stop current playback
    player.pause();
    
    // Reset all play buttons
    document.querySelectorAll('.audio-control:not(.mark-played)').forEach(btn => {
      btn.textContent = '⏵';
    });
    
    // Check for saved position
    chrome.storage.local.get('episodeProgress', (data) => {
      const progress = data.episodeProgress?.[url];
      
      // Set new source and play
      player.src = url;
      
      // If we have a saved position, restore it
      if (progress?.currentTime > 0) {
        player.currentTime = progress.currentTime;
      }
      
      player.play().catch(err => {
        console.error('Playback failed:', err);
        const playBtn = document.querySelector(`.audio-control[data-url="${url}"]`);
        if (playBtn) {
          playBtn.textContent = '⏵';
        }
      });
    });
    
    // Update now playing text
    nowPlaying.textContent = title;
    
    // Update play button
    const playBtn = document.querySelector(`.audio-control[data-url="${url}"]`);
    if (playBtn) {
      playBtn.textContent = '⏸';
    }
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
            
            const feedTitle = xmlDoc.querySelector('channel > title')?.textContent || new URL(feedUrl).hostname;
            
            resolve({ success: true, xmlDoc, feedTitle });
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

  // Modified parseFeeds function to use createEpisodeElement
  async function parseFeeds(feeds) {
    const podContent = document.querySelector('#audioList .section-content');
    if (!podContent) return;

    // Clear existing content
    podContent.innerHTML = '';

    // Process each feed
    for (const feed of feeds) {
      try {
        const result = await tryParseRss(feed);
        if (!result) continue;

        const { xmlDoc, feedTitle } = result;
        const feedUrl = feed;  // Store the feed URL
        
        // Create feed container
        const feedContainer = document.createElement('div');
        feedContainer.className = 'feed-container';

        // Create feed header with toggle
        const separator = document.createElement('div');
        separator.className = 'podcast-separator';
        
        const toggleIcon = document.createElement('span');
        toggleIcon.className = 'toggle-icon';
        toggleIcon.textContent = '▼';
        
        const titleText = document.createElement('div');
        titleText.className = 'audio-title';
        titleText.textContent = feedTitle;
        
        // Get all items for count
        const allItems = Array.from(xmlDoc.querySelectorAll('item'));
        
        const infoText = document.createElement('div');
        infoText.className = 'audio-date';
        const firstItemDate = allItems[0]?.querySelector('pubDate')?.textContent || '';
        infoText.textContent = `${allItems.length} episodes • ${firstItemDate ? new Date(firstItemDate).toLocaleDateString('en-US', {
          year: 'numeric',
          month: 'long',
          day: 'numeric'
        }) : ''}`;
        
        const titleContainer = document.createElement('div');
        titleContainer.className = 'audio-content';
        titleContainer.appendChild(titleText);
        titleContainer.appendChild(infoText);
        
        // Create icons container
        const iconsContainer = document.createElement('div');
        iconsContainer.className = 'podcast-icons';
        
        // Info icon
        const infoIcon = document.createElement('span');
        infoIcon.className = 'podcast-icon';
        infoIcon.textContent = 'ℹ';
        infoIcon.title = 'More information';
        
        // Refresh icon
        const refreshIcon = document.createElement('span');
        refreshIcon.className = 'podcast-icon';
        refreshIcon.textContent = '⟳';
        refreshIcon.title = 'Refresh feed';
        
        // Remove icon
        const removeIcon = document.createElement('span');
        removeIcon.className = 'podcast-icon';
        removeIcon.textContent = '✕';
        removeIcon.title = 'Remove feed';
        
        iconsContainer.appendChild(infoIcon);
        iconsContainer.appendChild(refreshIcon);
        iconsContainer.appendChild(removeIcon);
        
        separator.appendChild(toggleIcon);
        separator.appendChild(titleContainer);
        separator.appendChild(iconsContainer);
        
        // Create episodes container
        const episodesContainer = document.createElement('div');
        episodesContainer.className = 'feed-episodes';

        // Add click handler for expand/collapse
        separator.addEventListener('click', () => {
          separator.classList.toggle('collapsed');
          episodesContainer.classList.toggle('collapsed');
          toggleIcon.textContent = separator.classList.contains('collapsed') ? '▶' : '▼';
        });

        // Process items and create episode elements
        const podcastItems = Array.from(xmlDoc.querySelectorAll('item')).map(item => ({
          title: item.querySelector('title')?.textContent || 'Untitled',
          url: item.querySelector('enclosure')?.getAttribute('url') || '',
          date: item.querySelector('pubDate')?.textContent || ''
        })).filter(item => item.url);

        // Load initial episodes
        const { remaining, hasMore } = loadEpisodes(podcastItems, feedUrl, episodesContainer);

        // Add load more button if there are remaining episodes
        if (hasMore) {
          const loadMoreBtn = document.createElement('button');
          loadMoreBtn.className = 'load-more-button';
          loadMoreBtn.textContent = 'Load 5 more episodes';
          
          loadMoreBtn.addEventListener('click', () => {
            loadMoreBtn.remove();
            const { remaining: newRemaining, hasMore: newHasMore } = loadEpisodes(
              podcastItems,
              feedUrl,
              episodesContainer,
              podcastItems.length - remaining.length
            );
            
            if (newHasMore) {
              episodesContainer.appendChild(loadMoreBtn);
            }
          });
          
          episodesContainer.appendChild(loadMoreBtn);
        }

        // Add feed container to podcasts container
        feedContainer.appendChild(separator);
        feedContainer.appendChild(episodesContainer);
        podContent.appendChild(feedContainer);

        // Add event listeners for icons
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

        refreshIcon.addEventListener('click', async (e) => {
          e.stopPropagation();  // Prevent toggle action
          
          // Show loading state
          refreshIcon.style.opacity = '0.5';
          refreshIcon.style.cursor = 'wait';
          
          try {
            // Re-fetch and parse this specific feed
            const result = await tryParseRss(feedUrl);
            if (result.success) {
              // Process items
              const refreshedItems = Array.from(result.xmlDoc.querySelectorAll('item')).map(item => ({
                title: item.querySelector('title')?.textContent || 'Untitled',
                url: item.querySelector('enclosure')?.getAttribute('url') || '',
                date: item.querySelector('pubDate')?.textContent || ''
              })).filter(item => item.url);

              // Load episodes using our new function
              const { remaining, hasMore } = loadEpisodes(refreshedItems, feedUrl, episodesContainer);

              // Update load more button if needed
              const existingLoadMoreBtn = episodesContainer.querySelector('.load-more-button');
              if (hasMore) {
                if (!existingLoadMoreBtn) {
                  const loadMoreBtn = document.createElement('button');
                  loadMoreBtn.className = 'load-more-button';
                  loadMoreBtn.textContent = 'Load 5 more episodes';
                  
                  loadMoreBtn.addEventListener('click', () => {
                    loadMoreBtn.remove();
                    const { remaining: newRemaining, hasMore: newHasMore } = loadEpisodes(
                      refreshedItems,
                      feedUrl,
                      episodesContainer,
                      refreshedItems.length - remaining.length
                    );
                    
                    if (newHasMore) {
                      episodesContainer.appendChild(loadMoreBtn);
                    }
                  });
                  
                  episodesContainer.appendChild(loadMoreBtn);
                }
              } else if (existingLoadMoreBtn) {
                existingLoadMoreBtn.remove();
              }
            }
          } catch (error) {
            console.error('Error refreshing feed:', error);
          } finally {
            // Reset icon state
            refreshIcon.style.opacity = '1';
            refreshIcon.style.cursor = 'pointer';
          }
        });

        removeIcon.addEventListener('click', async (e) => {
          e.stopPropagation();  // Prevent toggle action
          
          // Remove this feed
          const feeds = await new Promise(resolve => {
            chrome.storage.local.get('feeds', (data) => {
              resolve(data.feeds || []);
            });
          });
          
          const updatedFeeds = feeds.filter(f => f !== feedUrl);
          await chrome.storage.local.set({ feeds: updatedFeeds });
          
          // Remove feed container from UI with animation
          feedContainer.style.opacity = '0';
          feedContainer.style.transform = 'translateX(-20px)';
          setTimeout(() => {
            feedContainer.remove();
          }, 300);
        });

      } catch (err) {
        console.error('Error processing feed:', feed, err);
        continue;
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
  
  if (err instanceof MediaError) {
    switch (err.code) {
      case MediaError.MEDIA_ERR_ABORTED:
        errorMessage = 'Playback was interrupted';
        break;
      case MediaError.MEDIA_ERR_NETWORK:
        errorMessage = 'Network error - please check your connection';
        break;
      case MediaError.MEDIA_ERR_DECODE:
        errorMessage = 'Could not decode the audio file';
        break;
      case MediaError.MEDIA_ERR_SRC_NOT_SUPPORTED:
        errorMessage = 'This audio format is not supported';
        break;
      default:
        errorMessage = 'Could not play this audio stream';
    }
  } else if (err instanceof DOMException) {
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

// Enhanced updateEpisodeProgress function
function updateEpisodeProgress(currentTime, duration) {
  if (!currentTime || !duration) return;
  
  const currentEpisodeUrl = player.src;
  const episodeItems = document.querySelectorAll('.audio-item');
  
  episodeItems.forEach(item => {
    const playBtn = item.querySelector('.audio-control');
    const progressEl = item.querySelector('.audio-progress');
    if (!playBtn || !progressEl) return;

    if (playBtn.dataset.url === currentEpisodeUrl) {
      // Update currently playing episode
      const currentTimeStr = formatTime(currentTime);
      const durationStr = formatTime(duration);
      progressEl.textContent = `${currentTimeStr} / ${durationStr}`;

      // Save progress to storage
      saveEpisodeProgress(currentEpisodeUrl, currentTime, duration);
    }
  });
}

// Enhanced saveEpisodeProgress function
async function saveEpisodeProgress(url, currentTime, duration) {
  if (!url || !duration) return;
  
  try {
    const data = await chrome.storage.local.get('episodeProgress');
    const allProgress = data.episodeProgress || {};
    
    // Only update if the values have changed
    const currentProgress = allProgress[url];
    if (!currentProgress || 
        currentProgress.currentTime !== currentTime || 
        currentProgress.duration !== duration) {
      
      allProgress[url] = {
        currentTime,
        duration,
        lastPlayed: new Date().toISOString()
      };
      
      await chrome.storage.local.set({ episodeProgress: allProgress });
    }
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

// Add ended listener to handle episode completion
player.addEventListener('ended', () => {
  if (currentlyPlayingUrl) {
    // Save final position
    saveEpisodeProgress(currentlyPlayingUrl, player.duration, player.duration);
    
    // Reset play button
    const playBtn = document.querySelector(`.audio-control[data-url="${currentlyPlayingUrl}"]`);
    if (playBtn) {
      playBtn.textContent = '⏵';
    }
    currentlyPlayingUrl = null;
  }
});

/**
 * Loads episodes into a container with pagination
 * @param {Array} items - Array of episode items
 * @param {string} feedUrl - URL of the feed
 * @param {HTMLElement} episodesContainer - Container to add episodes to
 * @param {number} startIndex - Starting index for episodes
 * @param {number} batchSize - Number of episodes to load at once
 * @returns {Object} - Object containing remaining episodes and whether there are more
 */
function loadEpisodes(items, feedUrl, episodesContainer, startIndex = 0, batchSize = 5) {
  // Clear container if starting from beginning
  if (startIndex === 0) {
    episodesContainer.innerHTML = '';
  }

  // Get batch of episodes
  const batch = items.slice(startIndex, startIndex + batchSize);
  const remaining = items.slice(startIndex + batchSize);

  // Add episodes to container
  batch.forEach(item => {
    const episodeDiv = createEpisodeElement(item, feedUrl);
    episodesContainer.appendChild(episodeDiv);
  });

  // Return remaining episodes and whether there are more
  return {
    remaining,
    hasMore: remaining.length > 0
  };
}

// Function to play audio
function playAudio(url, title) {
  const player = document.getElementById('player');
  const nowPlaying = document.getElementById('nowPlaying');
  const playBtn = document.querySelector(`.audio-control[data-url="${url}"]`);
  
  // If this is the same episode and it's already playing, pause it
  if (player.src === url && !player.paused) {
    player.pause();
    if (playBtn) {
      playBtn.textContent = '⏵';
    }
    return;
  }
  
  // Stop current playback
  player.pause();
  
  // Reset all play buttons
  document.querySelectorAll('.audio-control:not(.mark-played)').forEach(btn => {
    btn.textContent = '⏵';
  });
  
  // Check for saved position
  chrome.storage.local.get('episodeProgress', (data) => {
    const progress = data.episodeProgress?.[url];
    
    // Set new source and play
    player.src = url;
    
    // If we have a saved position, restore it
    if (progress?.currentTime > 0) {
      player.currentTime = progress.currentTime;
    }
    
    player.play().catch(err => {
      console.error('Playback failed:', err);
      if (playBtn) {
        playBtn.textContent = '⏵';
      }
    });
  });
  
  // Update now playing text
  nowPlaying.textContent = title;
  
  // Update play button
  if (playBtn) {
    playBtn.textContent = '⏸';
  }
}
