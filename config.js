document.addEventListener('DOMContentLoaded', () => {
  const exportButton = document.getElementById('exportConfig');
  const importButton = document.getElementById('importConfig');
  const exportStatus = document.getElementById('exportStatus');
  const importStatus = document.getElementById('importStatus');

  // Handle configuration export
  exportButton.addEventListener('click', async () => {
    try {
      const data = await chrome.storage.local.get(['feeds', 'playbackPositions', 'playedEpisodes']);
      
      const config = {
        version: '1.0',
        timestamp: new Date().toISOString(),
        feeds: data.feeds?.map(url => ({
          type: 'rss',
          url: url
        })) || [],
        playedEpisodes: data.playedEpisodes || {},
        playbackPositions: data.playbackPositions || {}
      };

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

        // Extract and save feeds
        const feeds = config.feeds.map(feed => feed.url);
        await chrome.storage.local.set({
          feeds,
          playedEpisodes: config.playedEpisodes || {},
          playbackPositions: config.playbackPositions || {}
        });

        showStatus(importStatus, 'Configuration imported successfully!', 'success');
        
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