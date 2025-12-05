// Device-to-Device Messaging System with Security Features
// This module handles secure direct messaging between online devices

let activeDevices = [];
let currentConversation = null;
let directMessageChannel = null;
let unreadCounts = {};

// Get browser and OS information
function getBrowserInfo() {
  const ua = navigator.userAgent;
  let browser = 'Unknown';
  let os = 'Unknown';
  
  // Detect browser
  if (ua.includes('Firefox/')) browser = 'Firefox';
  else if (ua.includes('Chrome/') && !ua.includes('Edg/')) browser = 'Chrome';
  else if (ua.includes('Safari/') && !ua.includes('Chrome/')) browser = 'Safari';
  else if (ua.includes('Edg/')) browser = 'Edge';
  else if (ua.includes('Opera/') || ua.includes('OPR/')) browser = 'Opera';
  
  // Detect OS
  if (ua.includes('Windows')) os = 'Windows';
  else if (ua.includes('Mac')) os = 'macOS';
  else if (ua.includes('Linux')) os = 'Linux';
  else if (ua.includes('Android')) os = 'Android';
  else if (ua.includes('iOS') || ua.includes('iPhone') || ua.includes('iPad')) os = 'iOS';
  
  return { browser, os };
}

// Get device name based on browser and OS
function getDeviceName() {
  const { browser, os } = getBrowserInfo();
  return `${browser} on ${os}`;
}

// Enhanced presence tracking with device info
async function trackDevicePresence() {
  try {
    const devId = generateDeviceId();
    const { browser, os } = getBrowserInfo();
    const deviceName = getDeviceName();
    const username = getAnonymousUsername();
    
    // Get current page info
    let currentPage = 'Home';
    const path = window.location.pathname;
    const params = new URLSearchParams(window.location.search);
    
    if (path.includes('subject.html')) {
      currentPage = 'Subjects';
    } else if (path.includes('reviewer.html')) {
      const subjectId = params.get('subject');
      const reviewerId = params.get('id');
      if (reviewerId) {
        // Try to get reviewer title
        try {
          const { data } = await supabase
            .from('reviewers')
            .select('title')
            .eq('id', reviewerId)
            .single();
          currentPage = data?.title ? `📖 ${data.title}` : 'Reviewer';
        } catch {
          currentPage = 'Reviewer';
        }
      } else if (subjectId) {
        currentPage = 'Reviewers List';
      }
    } else if (path.includes('quiz.html')) {
      currentPage = 'Quiz';
    }
    
    const { error } = await supabase
      .from('user_presence')
      .upsert({
        device_id: devId,
        device_name: deviceName,
        browser: browser,
        os: os,
        username: username,
        current_page: currentPage,
        last_seen: new Date().toISOString()
      }, {
        onConflict: 'device_id'
      });
    
    if (error) throw error;
  } catch (error) {
    console.error('Error tracking device presence:', error);
  }
}

// Get list of active devices (online in last 15 seconds)
async function getActiveDevices() {
  try {
    const fifteenSecondsAgo = new Date(Date.now() - 15000).toISOString();
    const myDeviceId = generateDeviceId();
    
    // Get active devices excluding current device
    const { data, error } = await supabase
      .from('user_presence')
      .select('*')
      .gte('last_seen', fifteenSecondsAgo)
      .neq('device_id', myDeviceId)
      .order('last_seen', { ascending: false })
      .limit(50);
    
    if (error) throw error;
    
    activeDevices = data || [];
    
    return activeDevices;
  } catch (error) {
    console.error('Error getting active devices:', error);
    return [];
  }
}

// Render active devices list in the UI
function renderActiveDevicesList() {
  const container = document.getElementById('activeDevicesList');
  if (!container) return;
  
  if (activeDevices.length === 0) {
    container.innerHTML = `
      <div class="text-center py-4 text-muted">
        <i class="bi bi-inbox fs-1"></i>
        <p class="mt-2 mb-0">No other devices online</p>
        <small>Waiting for users to join...</small>
      </div>
    `;
    return;
  }
  
  container.innerHTML = activeDevices.map(device => {
    const unreadCount = unreadCounts[device.device_id] || 0;
    const timeSinceLastSeen = Math.floor((Date.now() - new Date(device.last_seen)) / 1000);
    const statusClass = timeSinceLastSeen < 10 ? 'success' : 'warning';
    
    // Get device icon based on OS
    let deviceIcon = 'bi-laptop';
    if (device.os === 'Android' || device.os === 'iOS') deviceIcon = 'bi-phone';
    else if (device.os === 'Windows') deviceIcon = 'bi-windows';
    else if (device.os === 'macOS') deviceIcon = 'bi-apple';
    else if (device.os === 'Linux') deviceIcon = 'bi-ubuntu';
    
    // Escape HTML to prevent XSS
    const safeUsername = escapeHtml(device.username || 'Anonymous');
    const safeDeviceName = escapeHtml(device.device_name || 'Unknown Device');
    const safeCurrentPage = escapeHtml(device.current_page || 'Browsing');
    
    return `
      <div class="device-item" onclick="openDirectMessage('${device.device_id}', '${safeUsername}', '${safeDeviceName}')" style="cursor: pointer;">
        <div class="d-flex align-items-center gap-3">
          <div class="device-avatar">
            <i class="bi ${deviceIcon} fs-4"></i>
            <span class="device-status-badge bg-${statusClass}"></span>
          </div>
          <div class="flex-grow-1">
            <div class="d-flex justify-content-between align-items-center">
              <strong class="device-username">${safeUsername}</strong>
              ${unreadCount > 0 ? `<span class="badge bg-danger rounded-pill">${unreadCount > 99 ? '99+' : unreadCount}</span>` : ''}
            </div>
            <small class="text-muted d-block">
              <i class="bi bi-${deviceIcon === 'bi-laptop' ? 'laptop' : 'phone'}"></i> ${safeDeviceName}
            </small>
            <small class="text-muted d-block mt-1" style="font-size: 0.75rem;">
              <i class="bi bi-eye"></i> ${safeCurrentPage}
            </small>
          </div>
          <i class="bi bi-chat-dots text-muted"></i>
        </div>
      </div>
    `;
  }).join('');
}

// Open direct message conversation with a device
async function openDirectMessage(deviceId, username, deviceName) {
  // Input validation and sanitization
  if (!deviceId || typeof deviceId !== 'string' || deviceId.length > 256) {
    console.error('Invalid device ID');
    return;
  }
  
  // Create modal if it doesn't exist
  let modal = document.getElementById('directMessageModal');
  if (!modal) {
    createDirectMessageModal();
    modal = document.getElementById('directMessageModal');
  }
  
  // Set current conversation
  currentConversation = {
    deviceId: deviceId,
    username: escapeHtml(username),
    deviceName: escapeHtml(deviceName)
  };
  
  // Update modal header
  const modalTitle = document.getElementById('dmModalTitle');
  const modalSubtitle = document.getElementById('dmModalSubtitle');
  
  if (modalTitle) {
    modalTitle.innerHTML = `<i class="bi bi-chat-left-text-fill text-pink"></i> ${currentConversation.username}`;
  }
  if (modalSubtitle) {
    modalSubtitle.innerHTML = `<small class="text-muted"><i class="bi bi-laptop"></i> ${currentConversation.deviceName}</small>`;
  }
  
  // Load conversation
  await loadConversation(deviceId);
  
  // Mark messages as read
  await markMessagesAsRead(deviceId);
  
  // Show modal
  const bsModal = new bootstrap.Modal(modal);
  bsModal.show();
  
  // Add event listener for when modal closes
  modal.addEventListener('hidden.bs.modal', () => {
    // Unsubscribe when modal closes
    if (directMessageChannel) {
      directMessageChannel.unsubscribe();
      directMessageChannel = null;
    }
    currentConversation = null;
  }, { once: true });
  
  // Focus on input
  setTimeout(() => {
    const input = document.getElementById('dmInput');
    if (input) input.focus();
  }, 500);
  
  // Subscribe to realtime updates for this conversation
  subscribeToDirectMessages(deviceId);
}

// Create direct message modal
function createDirectMessageModal() {
  const modalHTML = `
    <div class="modal fade" id="directMessageModal" tabindex="-1" aria-hidden="true">
      <div class="modal-dialog modal-dialog-scrollable modal-dialog-centered">
        <div class="modal-content shadow-lg border-0">
          <div class="modal-header border-0 pb-2">
            <div class="flex-grow-1">
              <h5 class="modal-title mb-0" id="dmModalTitle">Direct Message</h5>
              <div id="dmModalSubtitle"></div>
            </div>
            <button type="button" class="btn-close" data-bs-dismiss="modal" aria-label="Close"></button>
          </div>
          <div class="modal-body px-0 py-0">
            <div id="dmContainer" class="messages-container" style="max-height: 400px; overflow-y: auto; padding: 15px;">
              <div class="text-center text-muted py-5">
                <div class="spinner-border spinner-pink" role="status">
                  <span class="visually-hidden">Loading...</span>
                </div>
                <p class="small mt-3 mb-0">Loading conversation...</p>
              </div>
            </div>
          </div>
          <div class="modal-footer border-0 pt-2">
            <div class="w-100">
              <div id="dmError" class="alert alert-danger alert-sm mb-2" style="display:none;"></div>
              <div class="input-group">
                <input type="text" class="form-control border-2" id="dmInput" placeholder="Type a message..." maxlength="1000">
                <button class="btn btn-pink text-light px-4" type="button" onclick="sendDirectMessage()">
                  <i class="bi bi-send-fill"></i>
                </button>
              </div>
              <div class="d-flex justify-content-between align-items-center mt-2">
                <small class="text-muted" id="dmCharCount">0/1000</small>
                <small class="text-muted"><i class="bi bi-shield-check"></i> Encrypted</small>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  `;
  document.body.insertAdjacentHTML('beforeend', modalHTML);
  
  // Add event listeners
  const input = document.getElementById('dmInput');
  if (input) {
    input.addEventListener('keypress', (e) => {
      if (e.key === 'Enter' && !e.shiftKey) {
        e.preventDefault();
        sendDirectMessage();
      }
    });
    
    input.addEventListener('input', (e) => {
      const charCount = document.getElementById('dmCharCount');
      if (charCount) {
        const count = e.target.value.length;
        charCount.textContent = `${count}/1000`;
        if (count > 900) {
          charCount.classList.add('text-warning');
        } else {
          charCount.classList.remove('text-warning');
        }
        if (count >= 1000) {
          charCount.classList.add('text-danger');
          charCount.classList.remove('text-warning');
        } else {
          charCount.classList.remove('text-danger');
        }
      }
    });
  }
}

// Load conversation between current device and target device
async function loadConversation(deviceId) {
  try {
    const container = document.getElementById('dmContainer');
    if (!container) return;
    
    const myDeviceId = generateDeviceId();
    
    // Use the secure RPC function
    const { data: messages, error } = await supabase
      .rpc('get_conversation', {
        p_device_id1: myDeviceId,
        p_device_id2: deviceId,
        p_limit: 50
      });
    
    if (error) throw error;
    
    if (!messages || messages.length === 0) {
      container.innerHTML = `
        <div class="text-center text-muted py-4">
          <i class="bi bi-chat-dots fs-1"></i>
          <p class="mt-2 mb-0">No messages yet</p>
          <small>Start the conversation!</small>
        </div>
      `;
      return;
    }
    
    // Reverse to show oldest first
    messages.reverse();
    
    container.innerHTML = messages.map(msg => {
      const isFromMe = msg.from_device_id === myDeviceId;
      const date = new Date(msg.created_at);
      const timeAgo = getTimeAgo(date);
      const sanitizedMessage = escapeHtml(msg.message);
      
      return `
        <div class="message-${isFromMe ? 'from-me' : 'from-them'}">
          <div class="message-content-dm">
            ${sanitizedMessage}
          </div>
          <small class="message-time-dm">${timeAgo}</small>
        </div>
      `;
    }).join('');
    
    // Scroll to bottom
    container.scrollTop = container.scrollHeight;
    
  } catch (error) {
    console.error('Error loading conversation:', error);
    const container = document.getElementById('dmContainer');
    if (container) {
      container.innerHTML = '<p class="text-danger text-center py-4">Failed to load conversation.</p>';
    }
  }
}

// Send direct message with validation and security
async function sendDirectMessage() {
  const input = document.getElementById('dmInput');
  const errorDiv = document.getElementById('dmError');
  
  if (!input || !currentConversation) return;
  
  const message = input.value.trim();
  
  // Clear previous errors
  if (errorDiv) {
    errorDiv.style.display = 'none';
    errorDiv.textContent = '';
  }
  
  // Validate message
  if (!message) {
    showDmError('Please enter a message.');
    return;
  }
  
  if (message.length > 1000) {
    showDmError('Message is too long. Maximum 1000 characters.');
    return;
  }
  
  // Check for hacking attempts (reuse from anonymous messages)
  if (typeof detectHackingAttempt === 'function' && detectHackingAttempt(message)) {
    showDmError('SECURITY ALERT: Hacking attempt detected! Attempting to inject scripts, HTML, SQL, or malicious code is prohibited and has been logged. Repeated attempts will result in a permanent ban.');
    input.value = '';
    
    // Log the security violation
    try {
      console.warn('Security violation detected in DM:', {
        deviceId: generateDeviceId().substring(0, 15) + '...',
        timestamp: new Date().toISOString(),
        attempt: 'Code injection'
      });
    } catch (e) {}
    return;
  }
  
  // Check for blocklisted words (reuse from anonymous messages)
  if (typeof containsBlocklistedWords === 'function' && containsBlocklistedWords(message)) {
    showDmError('Your message contains inappropriate content and cannot be sent.');
    return;
  }
  
  // Sanitize message (prevent XSS)
  const sanitizedMessage = sanitizeInput(message);
  
  try {
    // Use secure RPC function with rate limiting
    const { data, error } = await supabase.rpc('send_direct_message', {
      p_from_device_id: generateDeviceId(),
      p_to_device_id: currentConversation.deviceId,
      p_message: sanitizedMessage
    });
    
    if (error) {
      if (error.message.includes('Rate limit exceeded')) {
        showDmError('You are sending messages too fast. Please wait a moment.');
      } else if (error.message.includes('not online')) {
        showDmError('Recipient is no longer online.');
      } else {
        throw error;
      }
      return;
    }
    
    // Clear input
    input.value = '';
    const charCount = document.getElementById('dmCharCount');
    if (charCount) charCount.textContent = '0/1000';
    
    // Reload conversation to show new message
    await loadConversation(currentConversation.deviceId);
    
    // Show success feedback
    input.placeholder = 'Message sent! ✓';
    setTimeout(() => {
      input.placeholder = 'Type a message...';
    }, 2000);
    
  } catch (error) {
    console.error('Error sending message:', error);
    showDmError('Failed to send message. Please try again.');
  }
}

// Show error in DM modal
function showDmError(message) {
  const errorDiv = document.getElementById('dmError');
  if (errorDiv) {
    errorDiv.textContent = message;
    errorDiv.style.display = 'block';
    setTimeout(() => {
      errorDiv.style.display = 'none';
    }, 5000);
  }
}

// Mark messages as read
async function markMessagesAsRead(fromDeviceId) {
  try {
    const myDeviceId = generateDeviceId();
    await supabase.rpc('mark_messages_read', {
      p_device_id: myDeviceId,
      p_from_device_id: fromDeviceId
    });
    
    // Update unread counts
    delete unreadCounts[fromDeviceId];
    updateUnreadBadges();
  } catch (error) {
    console.error('Error marking messages as read:', error);
  }
}

// Get unread message counts
async function updateUnreadCounts() {
  try {
    const myDeviceId = generateDeviceId();
    
    const { data, error } = await supabase
      .from('direct_messages')
      .select('from_device_id')
      .eq('to_device_id', myDeviceId)
      .eq('is_read', false);
    
    if (error) throw error;
    
    // Count unread messages per sender
    unreadCounts = {};
    if (data) {
      data.forEach(msg => {
        unreadCounts[msg.from_device_id] = (unreadCounts[msg.from_device_id] || 0) + 1;
      });
    }
    
    updateUnreadBadges();
  } catch (error) {
    console.error('Error updating unread counts:', error);
  }
}

// Update unread badges in UI
function updateUnreadBadges() {
  const totalUnread = Object.values(unreadCounts).reduce((a, b) => a + b, 0);
  
  // Update floating button badge
  const floatingBadge = document.getElementById('messageBadge');
  if (floatingBadge && totalUnread > 0) {
    floatingBadge.textContent = totalUnread > 99 ? '99+' : totalUnread;
    floatingBadge.style.display = 'inline-block';
  } else if (floatingBadge) {
    floatingBadge.style.display = 'none';
  }
  
  // Re-render active devices list to show badges
  renderActiveDevicesList();
}

// Subscribe to realtime direct message updates
function subscribeToDirectMessages(targetDeviceId) {
  // Unsubscribe from previous channel
  if (directMessageChannel) {
    directMessageChannel.unsubscribe();
  }
  
  const myDeviceId = generateDeviceId();
  
  console.log('Setting up realtime subscription for conversation with:', targetDeviceId.substring(0, 15) + '...');
  
  // Subscribe to new messages in this conversation
  directMessageChannel = supabase
    .channel(`dm:${Date.now()}:${Math.random()}`) // Use unique channel name
    .on('postgres_changes', {
      event: 'INSERT',
      schema: 'public',
      table: 'direct_messages'
    }, (payload) => {
      console.log('Realtime message received:', {
        from: payload.new.from_device_id?.substring(0, 15) + '...',
        to: payload.new.to_device_id?.substring(0, 15) + '...',
        myId: myDeviceId.substring(0, 15) + '...',
        targetId: targetDeviceId.substring(0, 15) + '...'
      });
      
      // Check if message is for current conversation
      const isIncoming = payload.new.to_device_id === myDeviceId && payload.new.from_device_id === targetDeviceId;
      const isOutgoing = payload.new.from_device_id === myDeviceId && payload.new.to_device_id === targetDeviceId;
      
      if (isIncoming) {
        console.log('Incoming message - reloading conversation');
        loadConversation(targetDeviceId);
        markMessagesAsRead(targetDeviceId);
      } else if (isOutgoing) {
        console.log('Outgoing message confirmed - reloading conversation');
        loadConversation(targetDeviceId);
      } else {
        console.log('Message for different conversation - updating unread counts');
        // Show notification for messages from other devices
        if (payload.new.to_device_id === myDeviceId && typeof showMessageNotification === 'function') {
          const sender = activeDevices.find(d => d.device_id === payload.new.from_device_id);
          showMessageNotification({
            type: 'direct',
            username: sender?.username || 'Anonymous',
            message: payload.new.message || '',
            deviceName: sender?.device_name || 'Unknown Device',
            timestamp: payload.new.created_at || new Date().toISOString(),
            deviceId: payload.new.from_device_id
          });
        }
        updateUnreadCounts();
      }
    })
    .subscribe((status, err) => {
      console.log('Direct message subscription status:', status);
      if (err) console.error('Subscription error:', err);
      if (status === 'SUBSCRIBED') {
        console.log('Successfully subscribed to direct messages');
      }
    });
}

// Refresh device list manually
async function refreshDeviceList() {
  await trackDevicePresence();
  await getActiveDevices();
  await updateUnreadCounts();
  renderActiveDevicesList();
}

// Initialize device messaging system
async function initDeviceMessaging() {
  // Ensure dependencies are loaded
  if (typeof generateDeviceId !== 'function' || typeof supabase === 'undefined') {
    console.log('Waiting for dependencies...');
    setTimeout(initDeviceMessaging, 500);
    return;
  }
  
  console.log('Device messaging initializing...');
  
  // Track presence with device info
  await trackDevicePresence();
  
  // Load active devices
  await getActiveDevices();
  renderActiveDevicesList();
  
  // Update unread counts
  await updateUnreadCounts();
  
  // Refresh active devices and unread counts periodically
  setInterval(async () => {
    await trackDevicePresence();
    await getActiveDevices();
    await updateUnreadCounts();
    renderActiveDevicesList();
  }, 5000);
  
  // Subscribe to presence changes with realtime
  const presenceChannel = supabase.channel('online-devices', {
    config: {
      broadcast: { self: false }
    }
  })
    .on('postgres_changes', {
      event: '*',
      schema: 'public',
      table: 'user_presence'
    }, async () => {
      // Refresh active devices when presence changes
      await getActiveDevices();
      renderActiveDevicesList();
    })
    .subscribe((status) => {
      console.log('Presence channel status:', status);
    });
  
  // Subscribe to all incoming direct messages for notifications
  const myDeviceId = generateDeviceId();
  const globalDmChannel = supabase
    .channel('global-direct-messages')
    .on('postgres_changes', {
      event: 'INSERT',
      schema: 'public',
      table: 'direct_messages'
    }, (payload) => {
      console.log('Global DM notification received:', {
        to: payload.new.to_device_id?.substring(0, 15) + '...',
        myId: myDeviceId.substring(0, 15) + '...',
        isForMe: payload.new.to_device_id === myDeviceId
      });
      
      // Only process if message is for me
      if (payload.new.to_device_id === myDeviceId) {
        const fromDeviceId = payload.new.from_device_id;
        
        // Show notification if not in current conversation
        if (typeof showMessageNotification === 'function') {
          // Don't show if currently viewing this conversation
          if (!currentConversation || currentConversation.deviceId !== fromDeviceId) {
            const sender = activeDevices.find(d => d.device_id === fromDeviceId);
            showMessageNotification({
              type: 'direct',
              username: sender?.username || 'Anonymous',
              message: payload.new.message || '',
              deviceName: sender?.device_name || 'Unknown Device',
              timestamp: payload.new.created_at || new Date().toISOString(),
              deviceId: fromDeviceId
            });
          }
        }
        
        // Update unread counts
        updateUnreadCounts();
      }
    })
    .subscribe((status) => {
      console.log('Global DM channel status:', status);
    });
  
  console.log('Device messaging initialized');
}

// Expose functions globally
window.openDirectMessage = openDirectMessage;
window.sendDirectMessage = sendDirectMessage;
window.initDeviceMessaging = initDeviceMessaging;
window.refreshDeviceList = refreshDeviceList;

// Auto-initialize on page load (after other scripts)
if (document.readyState === 'loading') {
  document.addEventListener('DOMContentLoaded', () => {
    setTimeout(initDeviceMessaging, 1000);
  });
} else {
  setTimeout(initDeviceMessaging, 1000);
}
