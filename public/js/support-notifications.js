// Support the Developer Notification System
// Shows prompt every 10 minutes to support the developer

let supportNotificationInterval = null;
let lastSupportNotificationTime = 0;

// Check if user has dismissed support notifications
function hasDismissedSupport() {
  const dismissed = localStorage.getItem('support-dismissed');
  return dismissed === 'permanent';
}

// Show support notification
function showSupportNotification() {
  const now = Date.now();
  
  // Don't show if permanently dismissed or less than 10 minutes since last
  if (hasDismissedSupport() || (now - lastSupportNotificationTime < 10 * 60 * 1000)) {
    return;
  }
  
  lastSupportNotificationTime = now;
  
  // Create notification element
  const notification = document.createElement('div');
  notification.className = 'support-notification';
  notification.innerHTML = `
    <div class="support-notification-content">
      <div class="support-notification-header">
        <div class="support-notification-icon">
          <i class="bi bi-heart-fill"></i>
        </div>
        <div class="support-notification-text">
          <strong>Support Chael</strong>
          <p>This website is completely ad-free! If you find it helpful, consider supporting the developer.</p>
          <div style="display: flex; gap: 10px; margin-top: 8px; font-size: 0.9rem;">
            <a href="https://www.instagram.com/keliiiiiiii_/" target="_blank" style="color: white; text-decoration: none; opacity: 0.9; transition: opacity 0.2s;" onmouseover="this.style.opacity='1'" onmouseout="this.style.opacity='0.9'">
              <i class="bi bi-instagram"></i> Instagram
            </a>
            <span style="opacity: 0.5;">•</span>
            <a href="https://www.facebook.com/profile.php?id=61579285053347" target="_blank" style="color: white; text-decoration: none; opacity: 0.9; transition: opacity 0.2s;" onmouseover="this.style.opacity='1'" onmouseout="this.style.opacity='0.9'">
              <i class="bi bi-facebook"></i> Facebook
            </a>
          </div>
        </div>
        <button class="support-notification-close" onclick="closeSupportNotification(this, false)">
          <i class="bi bi-x"></i>
        </button>
      </div>
      <div class="support-notification-actions">
        <button class="btn-support-primary" onclick="showSupportQR()">
          <i class="bi bi-gift"></i> Support Now
        </button>
        <button class="btn-support-later" onclick="closeSupportNotification(this, false)">
          Maybe Later
        </button>
        <button class="btn-support-never" onclick="closeSupportNotification(this, true)">
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
  
  // Auto-remove after 20 seconds if not interacted with
  setTimeout(() => {
    if (notification.parentElement) {
      notification.classList.add('fade-out');
      setTimeout(() => {
        if (notification.parentElement) {
          notification.remove();
        }
      }, 500);
    }
  }, 20000);
}

// Close support notification
window.closeSupportNotification = function(button, permanent) {
  const notification = button.closest('.support-notification');
  
  if (permanent) {
    localStorage.setItem('support-dismissed', 'permanent');
    // Clear interval
    if (supportNotificationInterval) {
      clearInterval(supportNotificationInterval);
      supportNotificationInterval = null;
    }
  }
  
  if (notification) {
    notification.classList.add('fade-out');
    setTimeout(() => {
      notification.remove();
    }, 500);
  }
};

// Show QR code modal
window.showSupportQR = function() {
  // Close the notification first
  const notification = document.querySelector('.support-notification');
  if (notification) {
    notification.classList.add('fade-out');
    setTimeout(() => notification.remove(), 500);
  }
  
  // Create modal overlay
  const modal = document.createElement('div');
  modal.className = 'support-qr-modal';
  modal.innerHTML = `
    <div class="support-qr-overlay" onclick="closeSupportQR()"></div>
    <div class="support-qr-content">
      <button class="support-qr-close" onclick="closeSupportQR()">
        <i class="bi bi-x"></i>
      </button>
      <div class="support-qr-header">
        <i class="bi bi-heart-fill text-danger"></i>
        <h3>Thank You for Your Support!</h3>
        <p>Your support helps keep this website <strong>ad-free</strong> and freely accessible to everyone.</p>
      </div>
      <div class="support-qr-image">
        <img src="/images/support.jpg" alt="Support QR Code" />
        <p class="support-qr-caption">Scan this QR code to support the developer</p>
      </div>
      <div class="support-qr-footer">
        <p><i class="bi bi-info-circle"></i> Every contribution, no matter how small, is greatly appreciated!</p>
      </div>
    </div>
  `;
  
  // Add to page
  document.body.appendChild(modal);
  
  // Animate in
  setTimeout(() => {
    modal.classList.add('show');
  }, 100);
  
  // Prevent body scroll
  document.body.style.overflow = 'hidden';
};

// Close QR modal
window.closeSupportQR = function() {
  const modal = document.querySelector('.support-qr-modal');
  if (modal) {
    modal.classList.add('fade-out');
    setTimeout(() => {
      modal.remove();
      // Restore body scroll
      document.body.style.overflow = '';
    }, 300);
  }
};

// Initialize support notifications
function initSupportNotifications() {
  // Don't show if permanently dismissed
  if (hasDismissedSupport()) {
    return;
  }
  
  // Show first notification after 10 minutes
  setTimeout(() => {
    showSupportNotification();
    
    // Then show every 10 minutes
    supportNotificationInterval = setInterval(() => {
      if (!hasDismissedSupport()) {
        showSupportNotification();
      } else {
        clearInterval(supportNotificationInterval);
        supportNotificationInterval = null;
      }
    }, 10 * 60 * 1000); // 10 minutes 10 * 60 * 1000
  }, 10 * 60 * 1000); // 10 minutes
}

// Start on page load
if (document.readyState === 'loading') {
  document.addEventListener('DOMContentLoaded', initSupportNotifications);
} else {
  initSupportNotifications();
}

// Clean up on page unload
window.addEventListener('beforeunload', () => {
  if (supportNotificationInterval) {
    clearInterval(supportNotificationInterval);
  }
});

// Close modal on ESC key
document.addEventListener('keydown', (e) => {
  if (e.key === 'Escape') {
    closeSupportQR();
  }
});
