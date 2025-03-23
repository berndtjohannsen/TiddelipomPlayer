document.addEventListener('DOMContentLoaded', () => {
  const exportButton = document.getElementById('exportConfig');
  const importButton = document.getElementById('importConfig');
  const exportStatus = document.getElementById('exportStatus');
  const importStatus = document.getElementById('importStatus');
  const audioLimit = document.getElementById('audioLimit');
  const limitStatus = document.getElementById('limitStatus');

  // Load current max episodes setting
  chrome.storage.local.get('audioLimit', (data) => {
    if (data.audioLimit) {
      audioLimit.value = data.audioLimit;
    }
  });

  // Handle max episodes changes
  audioLimit.addEventListener('change', async () => {
    const limit = parseInt(audioLimit.value);
    if (limit >= 1) {
      await chrome.storage.local.set({ audioLimit: limit });
      showStatus(limitStatus, 'Maximum episodes setting saved!', 'success');
      
      // Notify the popup to refresh
      chrome.runtime.sendMessage({ type: 'configImported' });
    } else {
      showStatus(limitStatus, 'Please enter a number greater than 0', 'error');
    }
  });

  // Handle configuration export
  exportButton.addEventListener('click', async () => {
    try {
      const data = await chrome.storage.local.get(['feeds', 'audioLimit', 'liveChannels']);
      
      // Create config object with current timestamp
      const config = {
        version: '1.0',
        timestamp: new Date().toISOString(),
        feeds: []
      };

      // Process RSS feeds
      for (const feed of (data.feeds || [])) {
        // Get feed-specific data
        const feedData = await chrome.storage.local.get([`playedEpisodes_${feed}`, `playbackPositions_${feed}`]);
        
        config.feeds.push({
          type: 'rss',
          url: feed,
          maxEpisodes: data.audioLimit || 3,
          playedEpisodes: feedData[`playedEpisodes_${feed}`] || [],
          playbackPositions: feedData[`playbackPositions_${feed}`] || {}
        });
      }

      // Add live channels
      const liveChannels = data.liveChannels || [];
      for (const channel of liveChannels) {
        config.feeds.push({
          type: 'live',
          name: channel.name,
          url: channel.url,
          description: channel.description
        });
      }

      // Create and trigger download
      const blob = new Blob([JSON.stringify(config, null, 2)], { type: 'application/json' });
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `tiddelipom-config-${new Date().toISOString().split('T')[0]}.json`;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      URL.revokeObjectURL(url);

      showStatus(exportStatus, 'Configuration exported successfully!', 'success');
    } catch (err) {
      console.error('Error exporting configuration:', err);
      showStatus(exportStatus, 'Failed to export configuration. Please try again.', 'error');
    }
  });

  // Handle configuration import
  importButton.addEventListener('click', () => {
    const input = document.createElement('input');
    input.type = 'file';
    input.accept = '.json';
    
    input.onchange = async (e) => {
      try {
        const file = e.target.files[0];
        if (!file) return;

        const text = await file.text();
        const config = JSON.parse(text);

        // Validate config version and structure
        if (!config.version || !config.feeds) {
          throw new Error('Invalid configuration file format');
        }

        // Get current configuration
        const currentConfig = await chrome.storage.local.get(['feeds', 'liveChannels', 'audioLimit']);
        const currentFeeds = currentConfig.feeds || [];
        const currentChannels = currentConfig.liveChannels || [];

        // Process new feeds and channels
        for (const feed of config.feeds) {
          if (feed.type === 'live') {
            // Add live channel if it doesn't exist (checking by URL)
            if (!currentChannels.some(ch => ch.url === feed.url)) {
              currentChannels.push({
                name: feed.name,
                url: feed.url,
                description: feed.description
              });
            }
          } else if (feed.type === 'rss') {
            // Add RSS feed if it doesn't exist
            if (!currentFeeds.includes(feed.url)) {
              currentFeeds.push(feed.url);
            }
            // We skip playedEpisodes and playbackPositions as requested
          }
        }

        // Store updated configuration
        await chrome.storage.local.set({
          feeds: currentFeeds,
          liveChannels: currentChannels,
          // Keep existing audioLimit or use new one if none exists
          audioLimit: currentConfig.audioLimit || config.feeds.find(f => f.type === 'rss')?.maxEpisodes || 3
        });

        showStatus(importStatus, 'Configuration merged successfully!', 'success');
        
        // Notify the popup to refresh
        chrome.runtime.sendMessage({ type: 'configImported' });
      } catch (err) {
        console.error('Error importing configuration:', err);
        showStatus(importStatus, 'Failed to import configuration. Please ensure the file is valid.', 'error');
      }
    };

    input.click();
  });
});

function showStatus(element, message, type) {
  element.textContent = message;
  element.className = `status ${type}`;
  element.style.display = 'block';
  
  // Hide the status after 3 seconds
  setTimeout(() => {
    element.style.display = 'none';
  }, 3000);
} 