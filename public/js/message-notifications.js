// Message Notification Previews - Facebook Style
// Shows popup notifications when new messages arrive

let notificationQueue = [];
let activeNotifications = new Set();
const MAX_VISIBLE_NOTIFICATIONS = 3;
const NOTIFICATION_DURATION = 5000; // 5 seconds

// Show a message notification
function showMessageNotification(data) {
  const { type, username, message, deviceName, timestamp, deviceId, conversationId } = data;
  
  // Don't show notification if message modal is open and viewing this conversation
  const messageModal = document.getElementById('messageModal');
  if (messageModal && messageModal.classList.contains('show')) {
    const currentTab = document.querySelector('.message-tab.active')?.dataset?.tab;
    // Don't show notification for community messages if community tab is active
    if (type === 'community' && currentTab === 'community') {
      return;
    }
    // Don't show notification for direct messages if viewing that conversation
    if (type === 'direct' && currentConversation?.deviceId === deviceId) {
      return;
    }
  }
  
  // Create unique notification ID
  const notificationId = `notif-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
  
  // Add to queue
  notificationQueue.push({
    id: notificationId,
    type,
    username,
    message,
    deviceName,
    timestamp,
    deviceId,
    conversationId
  });
  
  // Process queue
  processNotificationQueue();
}

// Process the notification queue
function processNotificationQueue() {
  // Only show up to MAX_VISIBLE_NOTIFICATIONS at once
  while (notificationQueue.length > 0 && activeNotifications.size < MAX_VISIBLE_NOTIFICATIONS) {
    const notification = notificationQueue.shift();
    displayNotification(notification);
  }
}

// Display a notification
function displayNotification(notification) {
  const container = document.getElementById('messageNotificationContainer');
  if (!container) return;
  
  const { id, type, username, message, deviceName, timestamp, deviceId } = notification;
  
  // Mark as active
  activeNotifications.add(id);
  
  // Get time ago
  const timeAgo = getTimeAgoLocal(new Date(timestamp));
  
  // Sanitize content
  const safeUsername = escapeHtmlLocal(username || 'Anonymous');
  const safeMessage = escapeHtmlLocal(message);
  const safeDeviceName = escapeHtmlLocal(deviceName || 'Unknown Device');
  
  // Get icon based on type
  const isCommunity = type === 'community';
  const icon = isCommunity ? 'bi-people-fill' : 'bi-person-fill';
  const typeLabel = isCommunity ? 'Community Message' : 'Direct Message';
  const avatarClass = isCommunity ? 'community' : '';
  
  // Create notification element
  const notificationEl = document.createElement('div');
  notificationEl.className = 'message-notification';
  notificationEl.id = id;
  notificationEl.innerHTML = `
    <div class="message-notification-avatar ${avatarClass}">
      <i class="bi ${icon}"></i>
      ${!isCommunity ? '<span class="status-dot"></span>' : ''}
    </div>
    <div class="message-notification-content">
      <div class="message-notification-header">
        <div class="message-notification-username">${safeUsername}</div>
        <div class="message-notification-time">${timeAgo}</div>
      </div>
      <div class="message-notification-type">
        <i class="bi ${icon}"></i>
        ${typeLabel}${!isCommunity ? ` • ${safeDeviceName}` : ''}
      </div>
      <p class="message-notification-text">${safeMessage}</p>
    </div>
    <button class="message-notification-close" onclick="dismissNotification('${id}')">
      <i class="bi bi-x"></i>
    </button>
  `;
  
  // Add click handler to open message
  notificationEl.addEventListener('click', (e) => {
    // Don't trigger if clicking close button
    if (e.target.closest('.message-notification-close')) return;
    
    // Open appropriate message view
    if (isCommunity) {
      openCommunityMessages();
    } else {
      openDirectMessage(deviceId, username, deviceName);
    }
    
    // Dismiss notification
    dismissNotification(id);
  });
  
  // Add to container
  container.appendChild(notificationEl);
  
  // Auto-dismiss after duration
  setTimeout(() => {
    dismissNotification(id);
  }, NOTIFICATION_DURATION);
}

// Dismiss a notification
function dismissNotification(notificationId) {
  const notificationEl = document.getElementById(notificationId);
  if (!notificationEl) return;
  
  // Add hiding animation
  notificationEl.classList.add('hiding');
  
  // Remove after animation
  setTimeout(() => {
    notificationEl.remove();
    activeNotifications.delete(notificationId);
    
    // Process queue for next notification
    processNotificationQueue();
  }, 300);
}

// Helper to open community messages
function openCommunityMessages() {
  const messageModal = document.getElementById('messageModal');
  if (!messageModal) return;
  
  // Show modal
  const bsModal = bootstrap.Modal.getInstance(messageModal) || new bootstrap.Modal(messageModal);
  bsModal.show();
  
  // Switch to community tab
  const communityTab = document.querySelector('[data-tab="community"]');
  if (communityTab && typeof switchMessageTab === 'function') {
    switchMessageTab('community');
  }
}

// Format time ago (use existing global function or create local version)
function getTimeAgoLocal(date) {
  const seconds = Math.floor((new Date() - date) / 1000);
  
  if (seconds < 10) return 'just now';
  if (seconds < 60) return `${seconds}s ago`;
  
  const minutes = Math.floor(seconds / 60);
  if (minutes < 60) return `${minutes}m ago`;
  
  const hours = Math.floor(minutes / 60);
  if (hours < 24) return `${hours}h ago`;
  
  const days = Math.floor(hours / 24);
  if (days < 7) return `${days}d ago`;
  
  return date.toLocaleDateString();
}

// Escape HTML to prevent XSS (use existing global function or create local version)
function escapeHtmlLocal(text) {
  const div = document.createElement('div');
  div.textContent = text;
  return div.innerHTML;
}

// Expose functions globally
window.showMessageNotification = showMessageNotification;
window.dismissNotification = dismissNotification;

console.log('Message notifications module loaded');
