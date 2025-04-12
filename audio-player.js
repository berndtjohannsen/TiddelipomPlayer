class AudioPlayerManager {
  constructor() {
    this.player = document.getElementById('player');
    this.nowPlaying = document.getElementById('nowPlaying');
    this.currentlyPlayingUrl = null;
    this.savePositionInterval = null;
    
    // Initialize event listeners
    this.initializeEventListeners();
  }

  initializeEventListeners() {
    // Handle play/pause events
    this.player.addEventListener('play', () => {
      this.startPositionSaving();
    });

    this.player.addEventListener('pause', () => {
      this.stopPositionSaving();
      this.saveCurrentPosition();
    });

    this.player.addEventListener('ended', () => {
      this.stopPositionSaving();
      this.handlePlaybackEnded();
    });

    // Handle time updates
    this.player.addEventListener('timeupdate', () => {
      this.updateProgressDisplay();
    });
  }

  async playAudio(url, title) {
    const playBtn = document.querySelector(`.audio-control[data-url="${url}"]`);
    
    // If this is the same episode and it's already playing, pause it
    if (this.player.src === url && !this.player.paused) {
      this.player.pause();
      if (playBtn) {
        playBtn.textContent = '⏵';
      }
      return;
    }
    
    // Stop current playback
    this.player.pause();
    
    // Reset all play buttons
    document.querySelectorAll('.audio-control:not(.mark-played)').forEach(btn => {
      btn.textContent = '⏵';
    });
    
    try {
      // Check for saved position
      const data = await chrome.storage.local.get('episodeProgress');
      const progress = data.episodeProgress?.[url];
      
      // Set new source and play
      this.player.src = url;
      this.currentlyPlayingUrl = url;
      
      // If we have a saved position, restore it
      if (progress?.currentTime > 0) {
        this.player.currentTime = progress.currentTime;
      }
      
      await this.player.play();
      
      // Update UI
      this.nowPlaying.textContent = title;
      if (playBtn) {
        playBtn.textContent = '⏸';
      }
    } catch (err) {
      console.error('Playback failed:', err);
      if (playBtn) {
        playBtn.textContent = '⏵';
      }
    }
  }

  startPositionSaving() {
    // Save position every 5 seconds during playback
    this.savePositionInterval = setInterval(() => this.saveCurrentPosition(), 5000);
  }

  stopPositionSaving() {
    if (this.savePositionInterval) {
      clearInterval(this.savePositionInterval);
      this.savePositionInterval = null;
    }
  }

  saveCurrentPosition() {
    const currentUrl = this.player.src;
    if (currentUrl && this.player.currentTime > 0) {
      try {
        chrome.storage.local.get('episodeProgress', (data) => {
          try {
            const progress = data.episodeProgress || {};
            progress[currentUrl] = {
              currentTime: this.player.currentTime,
              duration: this.player.duration
            };
            chrome.storage.local.set({ episodeProgress: progress });
          } catch (err) {
            console.warn('Error saving playback position:', err);
            this.stopPositionSaving();
          }
        });
      } catch (err) {
        console.warn('Error accessing storage:', err);
        this.stopPositionSaving();
      }
    }
  }

  updateProgressDisplay() {
    const currentUrl = this.player.src;
    if (currentUrl) {
      const progress = {
        currentTime: this.player.currentTime,
        duration: this.player.duration
      };
      
      // Update progress in storage
      chrome.storage.local.get('episodeProgress', (data) => {
        const allProgress = data.episodeProgress || {};
        allProgress[currentUrl] = progress;
        chrome.storage.local.set({ episodeProgress: allProgress });
      });
      
      // Update progress bar if it exists
      const progressBar = document.querySelector(`.episode-progress[data-url="${currentUrl}"]`);
      if (progressBar) {
        const percentage = (progress.currentTime / progress.duration) * 100;
        progressBar.style.width = `${percentage}%`;
      }
    }
  }

  handlePlaybackEnded() {
    const currentUrl = this.player.src;
    if (currentUrl) {
      // Reset play buttons
      document.querySelectorAll('.audio-control:not(.mark-played)').forEach(btn => {
        btn.textContent = '⏵';
      });
      
      // Clear now playing
      this.nowPlaying.textContent = '';
      this.currentlyPlayingUrl = null;
      
      // Save final position
      this.saveCurrentPosition();
    }
  }
}

// Create and export a single instance
const audioPlayer = new AudioPlayerManager();
export default audioPlayer; 