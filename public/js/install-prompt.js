// Add to Home Screen Notification System
// Shows prompt every 10 minutes if user hasn't installed the PWA

let installPromptEvent = null;
let installNotificationInterval = null;
let hasInstalledPWA = false;

// Check if app is already installed
function isAppInstalled() {
  // Check if running in standalone mode (installed PWA)
  if (window.matchMedia('(display-mode: standalone)').matches) {
    return true;
  }
  
  // Check if user has dismissed the prompt permanently
  const dismissed = localStorage.getItem('pwa-install-dismissed');
  if (dismissed === 'permanent') {
    return true;
  }
  
  return false;
}

// Show add to home screen notification
function showInstallNotification() {
  // Don't show if already installed or permanently dismissed
  if (isAppInstalled() || hasInstalledPWA) {
    return;
  }
  
  // Create notification element
  const notification = document.createElement('div');
  notification.className = 'install-notification';
  notification.innerHTML = `
    <div class="install-notification-content">
      <div class="install-notification-header">
        <div class="install-notification-icon">
          <i class="bi bi-phone"></i>
        </div>
        <div class="install-notification-text">
          <strong>Install Thinky App</strong>
          <p>Add to your home screen for quick access and offline use!</p>
        </div>
        <button class="install-notification-close" onclick="closeInstallNotification(this, false)">
          <i class="bi bi-x"></i>
        </button>
      </div>
      <div class="install-notification-actions">
        <button class="btn-install-primary" onclick="triggerInstall()">
          <i class="bi bi-download"></i> Install Now
        </button>
        <button class="btn-install-later" onclick="closeInstallNotification(this, false)">
          Later
        </button>
        <button class="btn-install-never" onclick="closeInstallNotification(this, true)">
          Don't Show Again
        </button>
      </div>
    </div>
  `;
  
  // Add to page
  document.body.appendChild(notification);
  
  // Animate in
  setTimeout(() => {
    notification.classList.add('show');
  }, 100);
}

// Close notification
window.closeInstallNotification = function(button, permanent) {
  const notification = button.closest('.install-notification');
  
  if (permanent) {
    localStorage.setItem('pwa-install-dismissed', 'permanent');
    // Clear interval
    if (installNotificationInterval) {
      clearInterval(installNotificationInterval);
      installNotificationInterval = null;
    }
  }
  
  if (notification) {
    notification.classList.add('fade-out');
    setTimeout(() => {
      notification.remove();
    }, 500);
  }
};

// Trigger PWA installation
window.triggerInstall = async function() {
  if (!installPromptEvent) {
    // Fallback: Show manual instructions
    showManualInstallInstructions();
    return;
  }
  
  try {
    // Show the install prompt
    installPromptEvent.prompt();
    
    // Wait for the user's response
    const { outcome } = await installPromptEvent.userChoice;
    
    if (outcome === 'accepted') {
      hasInstalledPWA = true;
      localStorage.setItem('pwa-install-dismissed', 'permanent');
      
      // Clear interval
      if (installNotificationInterval) {
        clearInterval(installNotificationInterval);
        installNotificationInterval = null;
      }
      
      // Close notification
      const notification = document.querySelector('.install-notification');
      if (notification) {
        notification.classList.add('fade-out');
        setTimeout(() => notification.remove(), 500);
      }
      
      // Show success message
      showInstallSuccess();
    }
    
    // Clear the prompt event
    installPromptEvent = null;
    
  } catch (error) {
    console.error('Install prompt error:', error);
    showManualInstallInstructions();
  }
};

// Show manual installation instructions
function showManualInstallInstructions() {
  const notification = document.querySelector('.install-notification');
  if (!notification) return;
  
  const content = notification.querySelector('.install-notification-content');
  const userAgent = navigator.userAgent.toLowerCase();
  
  let instructions = '';
  
  if (userAgent.includes('android')) {
    if (userAgent.includes('chrome')) {
      instructions = `
        <div class="install-instructions">
          <h4>How to Install on Android (Chrome):</h4>
          <ol>
            <li>Tap the menu icon (⋮) in the top-right corner</li>
            <li>Select "Add to Home screen"</li>
            <li>Tap "Add" to confirm</li>
          </ol>
        </div>
      `;
    } else if (userAgent.includes('firefox')) {
      instructions = `
        <div class="install-instructions">
          <h4>How to Install on Android (Firefox):</h4>
          <ol>
            <li>Tap the menu icon (⋮) in the top-right corner</li>
            <li>Select "Install"</li>
            <li>Tap "Add" to confirm</li>
          </ol>
        </div>
      `;
    }
  } else if (userAgent.includes('iphone') || userAgent.includes('ipad')) {
    instructions = `
      <div class="install-instructions">
        <h4>How to Install on iOS (Safari):</h4>
        <ol>
          <li>Tap the Share button <i class="bi bi-box-arrow-up"></i></li>
          <li>Scroll down and tap "Add to Home Screen"</li>
          <li>Tap "Add" to confirm</li>
        </ol>
      </div>
    `;
  } else {
    instructions = `
      <div class="install-instructions">
        <h4>How to Install on Desktop:</h4>
        <ol>
          <li>Look for the install icon in your browser's address bar</li>
          <li>Click it and select "Install"</li>
          <li>Or check your browser menu for "Install app" option</li>
        </ol>
      </div>
    `;
  }
  
  content.innerHTML = `
    <div class="install-notification-header">
      <button class="install-notification-close" onclick="closeInstallNotification(this, false)">
        <i class="bi bi-x"></i>
      </button>
    </div>
    ${instructions}
    <div class="install-notification-actions">
      <button class="btn-install-later" onclick="closeInstallNotification(this, false)">
        Got it!
      </button>
    </div>
  `;
}

// Show success message
function showInstallSuccess() {
  const success = document.createElement('div');
  success.className = 'install-success-toast';
  success.innerHTML = `
    <i class="bi bi-check-circle-fill"></i>
    <span>App installed successfully! You can now access Thinky from your home screen.</span>
  `;
  
  document.body.appendChild(success);
  
  setTimeout(() => {
    success.classList.add('show');
  }, 100);
  
  setTimeout(() => {
    success.classList.add('fade-out');
    setTimeout(() => success.remove(), 500);
  }, 5000);
}

// Initialize install notifications
function initInstallNotifications() {
  // Don't show if already installed
  if (isAppInstalled()) {
    return;
  }
  
  // Show first notification after 10 minutes
  setTimeout(() => {
    showInstallNotification();
    
    // Then show every 10 minutes
    installNotificationInterval = setInterval(() => {
      if (!isAppInstalled() && !hasInstalledPWA) {
        showInstallNotification();
      } else {
        clearInterval(installNotificationInterval);
        installNotificationInterval = null;
      }
    }, 1000); // 10 minutes10 * 60 * 1000
  }, 1000); // 10 minutes
}

// Capture the beforeinstallprompt event
window.addEventListener('beforeinstallprompt', (e) => {
  // Prevent the default browser install prompt
  e.preventDefault();
  
  // Store the event for later use
  installPromptEvent = e;
});

// Detect when app is installed
window.addEventListener('appinstalled', () => {
  hasInstalledPWA = true;
  localStorage.setItem('pwa-install-dismissed', 'permanent');
  
  // Clear interval
  if (installNotificationInterval) {
    clearInterval(installNotificationInterval);
    installNotificationInterval = null;
  }
  
  showInstallSuccess();
});

// Start on page load
if (document.readyState === 'loading') {
  document.addEventListener('DOMContentLoaded', initInstallNotifications);
} else {
  initInstallNotifications();
}

// Clean up on page unload
window.addEventListener('beforeunload', () => {
  if (installNotificationInterval) {
    clearInterval(installNotificationInterval);
  }
});
