// Admin Anonymous Messages Handler
// Allows admins to send messages with their identity and mention all users

let adminMessagesChannel = null;
let adminPresenceChannel = null;
let dmChannel = null;
let lastAdminMessageCount = 0;
let adminMessageCheckInterval = null;
let currentAdmin = null;
let currentDmRecipient = null; // { id, username, is_admin }

// Initialize admin messaging
async function initAdminMessages() {
  try {
    currentAdmin = await getCurrentUser();
    
    if (!currentAdmin) {
      console.error('Not authenticated');
      return;
    }

    // Get admin profile
    const { data: profile, error: profileError } = await supabase
      .from('profiles')
      .select('*')
      .eq('id', currentAdmin.id)
      .single();

    if (profileError && profileError.code !== 'PGRST116') {
      console.error('Profile error:', profileError);
    }

    currentAdmin.profile = profile || {
      username: currentAdmin.email.split('@')[0],
      avatar_url: null
    };

    // Subscribe to anonymous messages (same table as regular users)
    subscribeToAdminMessages();
    
    // Load initial messages
    loadAdminMessages();
    
    // Check for new messages periodically
    adminMessageCheckInterval = setInterval(checkNewAdminMessages, 5000);
    
    // Update presence
    updateAdminPresence();
    setInterval(updateAdminPresence, 30000);
    
    // Subscribe to presence updates
    subscribeToPresence();
    
  } catch (error) {
    console.error('Error initializing admin messages:', error);
  }
}

// Subscribe to realtime updates
function subscribeToAdminMessages() {
  adminMessagesChannel = supabase
    .channel('admin-anonymous-messages')
    .on('postgres_changes', 
      { 
        event: 'INSERT', 
        schema: 'public', 
        table: 'anonymous_messages' 
      }, 
      (payload) => {
        addAdminMessageToUI(payload.new);
        lastAdminMessageCount++;
      }
    )
    .subscribe();
}

// Update admin presence
async function updateAdminPresence() {
  try {
    if (!currentAdmin) return;
    
    const { error } = await supabase
      .from('user_presence')
      .upsert({
        device_id: `admin_${currentAdmin.id}`,
        device_name: 'Admin Dashboard',
        browser: 'Admin',
        os: 'Admin',
        username: currentAdmin.profile?.username || 'Admin',
        current_page: 'Admin Dashboard',
        last_seen: new Date().toISOString(),
        is_admin: true
      }, {
        onConflict: 'device_id'
      });
    
    if (error) {
      console.error('Presence update error:', error.message, error.details);
    }
  } catch (error) {
    console.error('Presence update error:', error);
  }
}

// Load messages from database
async function loadAdminMessages() {
  try {
    const messagesContainer = document.getElementById('adminMessagesContainer');
    if (!messagesContainer) return;

    messagesContainer.innerHTML = '<div class="text-center py-3"><div class="spinner-border spinner-pink spinner-border-sm" role="status"></div></div>';

    const { data: messages, error } = await supabase
      .from('anonymous_messages')
      .select(`
        *,
        reply_to_message:reply_to(id, username, message, is_admin)
      `)
      .order('created_at', { ascending: true })
      .limit(100);

    if (error) throw error;

    messagesContainer.innerHTML = '';

    if (!messages || messages.length === 0) {
      messagesContainer.innerHTML = '<div class="text-center text-muted py-4"><i class="bi bi-chat-dots"></i><br>No messages yet. Start the conversation!</div>';
      return;
    }

    messages.forEach(msg => addAdminMessageToUI(msg));
    lastAdminMessageCount = messages.length;
    
    // Scroll to bottom
    setTimeout(() => {
      messagesContainer.scrollTop = messagesContainer.scrollHeight;
    }, 100);

  } catch (error) {
    console.error('Error loading messages:', error);
    const messagesContainer = document.getElementById('adminMessagesContainer');
    if (messagesContainer) {
      messagesContainer.innerHTML = '<div class="alert alert-danger alert-sm">Failed to load messages</div>';
    }
  }
}

// Check for new messages
async function checkNewAdminMessages() {
  try {
    const { data: messages, error } = await supabase
      .from('anonymous_messages')
      .select('id')
      .order('created_at', { ascending: false })
      .limit(1);

    if (error) throw error;

    const { count } = await supabase
      .from('anonymous_messages')
      .select('*', { count: 'exact', head: true });

    if (count > lastAdminMessageCount) {
      loadAdminMessages();
    }
  } catch (error) {
    console.error('Error checking messages:', error);
  }
}

// Add message to UI
function addAdminMessageToUI(message) {
  const messagesContainer = document.getElementById('adminMessagesContainer');
  if (!messagesContainer) return;

  // Remove "no messages" placeholder if exists
  const placeholder = messagesContainer.querySelector('.text-center.text-muted');
  if (placeholder) {
    placeholder.remove();
  }

  const messageDiv = document.createElement('div');
  messageDiv.className = 'message-item';
  messageDiv.dataset.messageId = message.id;

  const isAdmin = message.is_admin || false;
  const timestamp = new Date(message.created_at);
  const timeString = formatTimeAgo(timestamp);

  if (isAdmin) {
    // Admin message with profile
    const avatarHTML = message.avatar_url 
      ? `<img src="${message.avatar_url}" alt="Avatar" style="width: 36px; height: 36px; border-radius: 50%; object-fit: cover; box-shadow: 0 3px 12px rgba(255, 165, 0, 0.4); border: 2px solid #FFD700;">` 
      : `<i class="bi bi-person-fill"></i>`;

    // Highlight @everyone in message
    let formattedMessage = sanitizeHTML(message.message);
    const hasEveryoneMention = message.message.includes('@everyone');
    formattedMessage = formattedMessage.replace(/@everyone/g, '<span class="mention-everyone">@everyone</span>');

    // Check if this is a reply
    let replyHTML = '';
    if (message.reply_to_message) {
      const replyUsername = message.reply_to_message.username || 'User';
      const replyText = message.reply_to_message.message || '';
      replyHTML = `
        <div class="reply-preview" onclick="scrollToMessage(${message.reply_to})">
          <span class="reply-preview-author">${sanitizeHTML(replyUsername)}</span>
          <span class="reply-preview-text">${sanitizeHTML(replyText.substring(0, 50))}${replyText.length > 50 ? '...' : ''}</span>
        </div>
      `;
    }

    // Don't make admin username clickable in admin view (they can't DM themselves)
    messageDiv.innerHTML = `
      <div class="message-avatar admin-avatar">
        ${avatarHTML}
      </div>
      <div class="message-bubble">
        <div class="message-actions">
          <button class="message-actions-btn" onclick="window.toggleMessageActions(event, '${message.id}', true)">
            <i class="bi bi-three-dots-vertical"></i>
          </button>
        </div>
        <div class="message-header">
          <strong class="message-username admin-username">
            ${sanitizeHTML(message.username || 'Admin')}
          </strong>
        </div>
        ${replyHTML}
        <div class="message-content-wrapper admin-message-wrapper${hasEveryoneMention ? ' announcement-message' : ''}">
          <div class="message-content">${formattedMessage}</div>
        </div>
        ${message.reactions ? createReactionsHTML(message.reactions, message.id) : ''}
        <small class="message-time">${timeString}</small>
      </div>
    `;
  } else {
    // Anonymous user message - extract device_id for DM
    const deviceId = message.device_id || '';
    const username = message.username || 'Anonymous';
    
    messageDiv.innerHTML = `
      <div class="message-avatar">
        <i class="bi bi-person-fill"></i>
      </div>
      <div class="message-bubble">
        <div class="message-actions">
          <button class="message-actions-btn" onclick="window.toggleMessageActions(event, '${message.id}', false)">
            <i class="bi bi-three-dots-vertical"></i>
          </button>
        </div>
        <div class="message-header">
          <strong class="message-username" style="cursor: pointer;" onclick="openDirectMessage('${deviceId}', '${sanitizeHTML(username)}', false)" title="Click to send direct message">${sanitizeHTML(username)}</strong>
        </div>
        <div class="message-content-wrapper">
          <div class="message-content">${sanitizeHTML(message.message)}</div>
        </div>
        ${message.reactions ? createReactionsHTML(message.reactions, message.id) : ''}
        <small class="message-time">${timeString}</small>
      </div>
    `;
  }

  messagesContainer.appendChild(messageDiv);

  // Scroll to bottom
  messagesContainer.scrollTop = messagesContainer.scrollHeight;
}

// Send admin message
async function sendAdminMessage() {
  const input = document.getElementById('adminMessageInput');
  const sendBtn = document.getElementById('adminSendBtn');
  
  if (!input || !currentAdmin) return;

  let message = input.value.trim();

  if (!message) return;

  // Check message length
  if (message.length > 500) {
    showAdminAlert('Message too long (max 500 characters)', 'warning');
    return;
  }

  // Check if message contains @everyone
  const mentionAll = message.includes('@everyone');

  // Disable input during send
  input.disabled = true;
  sendBtn.disabled = true;
  sendBtn.innerHTML = '<span class="spinner-border spinner-border-sm"></span>';

  try {
    const messageData = {
      username: currentAdmin.profile.username,
      avatar_url: currentAdmin.profile.avatar_url,
      message: message,
      device_id: `admin_${currentAdmin.id}`,
      is_admin: true,
      mention_all: mentionAll
    };
    
    // Add reply information if replying
    if (replyingToMessageId) {
      messageData.reply_to = replyingToMessageId;
    }
    
    const { error } = await supabase
      .from('anonymous_messages')
      .insert([messageData]);

    if (error) throw error;

    // Clear input and reply state
    input.value = '';
    cancelReply();
    
    // Auto-resize textarea
    input.style.height = 'auto';

    // If message contains @everyone, send notification to all active users
    if (mentionAll) {
      await notifyAllUsers(message);
    }

  } catch (error) {
    console.error('Error sending message:', error);
    showAdminAlert('Failed to send message. Please try again.', 'danger');
  } finally {
    input.disabled = false;
    sendBtn.disabled = false;
    sendBtn.innerHTML = '<i class="bi bi-send-fill"></i>';
    input.focus();
  }
}

// Notify all users (creates a notification record)
async function notifyAllUsers(message) {
  try {
    // Get all active users from presence table
    const fiveMinutesAgo = new Date(Date.now() - 5 * 60 * 1000).toISOString();
    
    const { data: activeUsers, error } = await supabase
      .from('user_presence')
      .select('device_id')
      .gte('last_seen', fiveMinutesAgo)
      .eq('is_admin', false);

    if (error) throw error;

    // Create notification records for active users
    if (activeUsers && activeUsers.length > 0) {
      const notifications = activeUsers.map(user => ({
        device_id: user.device_id,
        message: message,
        type: 'admin_announcement',
        created_at: new Date().toISOString()
      }));

      await supabase
        .from('user_notifications')
        .insert(notifications);
    }
  } catch (error) {
    console.error('Error notifying users:', error);
  }
}

// Show alert
function showAdminAlert(message, type = 'info') {
  const alertContainer = document.getElementById('adminAlertContainer');
  if (!alertContainer) return;

  const alert = document.createElement('div');
  alert.className = `alert alert-${type} alert-sm alert-dismissible fade show`;
  alert.innerHTML = `
    ${message}
    <button type="button" class="btn-close" data-bs-dismiss="alert"></button>
  `;

  alertContainer.appendChild(alert);

  setTimeout(() => {
    alert.remove();
  }, 5000);
}

// Create reactions HTML
function createReactionsHTML(reactions, messageId) {
  const adminDeviceId = currentAdmin ? `admin_${currentAdmin.id}` : '';
  
  let reactionsObj = {};
  try {
    reactionsObj = reactions ? (typeof reactions === 'string' ? JSON.parse(reactions) : reactions) : {};
  } catch (e) {
    reactionsObj = {};
  }

  const hasReactions = Object.keys(reactionsObj).length > 0;
  
  if (hasReactions) {
    let html = '<div class="message-reactions">';
    
    for (const [emoji, users] of Object.entries(reactionsObj)) {
      if (users && users.length > 0) {
        const hasReacted = users.includes(adminDeviceId);
        html += `
          <button class="reaction-btn ${hasReacted ? 'reacted' : ''}" onclick="toggleAdminReaction('${messageId}', '${emoji}')">
            ${emoji} <span class="reaction-count">${users.length}</span>
          </button>
        `;
      }
    }
    
    html += `<button class="add-reaction-btn" onclick="showAdminReactionPicker('${messageId}')">➕</button>`;
    html += '</div>';
    return html;
  } else {
    return `
      <div class="message-reactions">
        <button class="add-reaction-btn" onclick="showAdminReactionPicker('${messageId}')">➕ React</button>
      </div>
    `;
  }
}

// Toggle reaction (remove old duplicate, the new one is already defined above)
window.toggleAdminReaction = toggleAdminReaction;

// Old function below - will be removed
async function toggleAdminReaction_OLD(messageId, emoji) {
  if (!currentAdmin) return;

  try {
    const deviceId = `admin_${currentAdmin.id}`;

    // Get current message
    const { data: message, error: fetchError } = await supabase
      .from('anonymous_messages')
      .select('reactions')
      .eq('id', messageId)
      .single();

    if (fetchError) throw fetchError;

    let reactions = message.reactions || {};
    
    if (!reactions[emoji]) {
      reactions[emoji] = [];
    }

    // Toggle reaction
    if (reactions[emoji].includes(deviceId)) {
      reactions[emoji] = reactions[emoji].filter(id => id !== deviceId);
      if (reactions[emoji].length === 0) {
        delete reactions[emoji];
      }
    } else {
      reactions[emoji].push(deviceId);
    }

    // Update message
    const { error: updateError } = await supabase
      .from('anonymous_messages')
      .update({ reactions })
      .eq('id', messageId);

    if (updateError) throw updateError;

    // Reload messages to update UI
    loadAdminMessages();

  } catch (error) {
    console.error('Error toggling reaction:', error);
  }
}

// Format time ago
function formatTimeAgo(date) {
  const seconds = Math.floor((new Date() - date) / 1000);
  
  if (seconds < 60) return 'just now';
  if (seconds < 3600) return `${Math.floor(seconds / 60)}m ago`;
  if (seconds < 86400) return `${Math.floor(seconds / 3600)}h ago`;
  if (seconds < 604800) return `${Math.floor(seconds / 86400)}d ago`;
  
  return date.toLocaleDateString();
}

// Sanitize HTML
function sanitizeHTML(text) {
  const div = document.createElement('div');
  div.textContent = text;
  return div.innerHTML;
}

// Handle Enter key to send
function handleAdminMessageKeyPress(event) {
  if (event.key === 'Enter' && !event.shiftKey) {
    event.preventDefault();
    sendAdminMessage();
  }
}

// Auto-resize textarea
function autoResizeAdminTextarea(textarea) {
  textarea.style.height = 'auto';
  textarea.style.height = textarea.scrollHeight + 'px';
}

// ============================================
// DIRECT MESSAGE FUNCTIONALITY
// ============================================

// Open DM modal with specific user
async function openDirectMessage(userId, username, isAdmin = false) {
  currentDmRecipient = { id: userId, username: username, is_admin: isAdmin };
  
  // Update modal title
  const dmModalLabel = document.getElementById('dmModalLabel');
  if (dmModalLabel) {
    dmModalLabel.innerHTML = `<i class="bi bi-chat-left-text-fill"></i> Message with ${sanitizeHTML(username)}`;
  }
  
  // Show modal with higher z-index
  const dmModalEl = document.getElementById('dmModal');
  const dmModal = new bootstrap.Modal(dmModalEl);
  
  // Ensure backdrop appears above the community messages modal
  dmModalEl.addEventListener('shown.bs.modal', function() {
    const backdrop = document.querySelector('.modal-backdrop');
    if (backdrop) {
      backdrop.style.zIndex = '1059';
    }
  }, { once: true });
  
  dmModal.show();
  
  // Load DM conversation
  await loadDirectMessages();
  
  // Subscribe to DM updates
  subscribeToDMs();
}

// Subscribe to DM realtime updates
function subscribeToDMs() {
  if (dmChannel) {
    supabase.removeChannel(dmChannel);
  }
  
  const myDeviceId = `admin_${currentAdmin.id}`;
  
  dmChannel = supabase
    .channel(`dm-admin-${Date.now()}`)
    .on('postgres_changes', 
      { 
        event: 'INSERT', 
        schema: 'public', 
        table: 'direct_messages'
      }, 
      (payload) => {
        const isIncoming = payload.new.to_device_id === myDeviceId && payload.new.from_device_id === currentDmRecipient.id;
        const isOutgoing = payload.new.from_device_id === myDeviceId && payload.new.to_device_id === currentDmRecipient.id;
        
        if (isIncoming || isOutgoing) {
          addDmToUI(payload.new);
          if (isIncoming) {
            markDmsAsRead([payload.new]);
          }
        }
      }
    )
    .subscribe();
}

// Load DM conversation
async function loadDirectMessages() {
  if (!currentAdmin || !currentDmRecipient) return;
  
  try {
    const dmContainer = document.getElementById('dmMessagesContainer');
    if (!dmContainer) return;
    
    dmContainer.innerHTML = '<div class="text-center py-3"><div class="spinner-border spinner-pink spinner-border-sm" role="status"></div></div>';
    
    const myDeviceId = `admin_${currentAdmin.id}`;
    const targetDeviceId = currentDmRecipient.id;
    
    const { data: messages, error } = await supabase
      .from('direct_messages')
      .select('*')
      .or(`and(from_device_id.eq."${myDeviceId}",to_device_id.eq."${targetDeviceId}"),and(from_device_id.eq."${targetDeviceId}",to_device_id.eq."${myDeviceId}")`)
      .order('created_at', { ascending: true })
      .limit(100);
    
    if (error) {
      console.error('Error loading DMs:', error.message, error.details);
      throw error;
    }
    
    dmContainer.innerHTML = '';
    
    if (!messages || messages.length === 0) {
      dmContainer.innerHTML = '<div class="text-center text-muted py-4"><i class="bi bi-chat-dots"></i><br>No messages yet. Start the conversation!</div>';
      return;
    }
    
    messages.forEach(msg => addDmToUI(msg));
    
    // Mark received messages as read
    markDmsAsRead(messages);
    
    // Scroll to bottom
    setTimeout(() => {
      dmContainer.scrollTop = dmContainer.scrollHeight;
    }, 100);
    
  } catch (error) {
    console.error('Error loading DMs:', error);
    const dmContainer = document.getElementById('dmMessagesContainer');
    if (dmContainer) {
      dmContainer.innerHTML = '<div class="alert alert-danger alert-sm">Failed to load messages</div>';
    }
  }
}

// Add DM to UI
function addDmToUI(message) {
  const dmContainer = document.getElementById('dmMessagesContainer');
  if (!dmContainer) return;
  
  // Remove placeholder if exists
  const placeholder = dmContainer.querySelector('.text-center.text-muted');
  if (placeholder) {
    placeholder.remove();
  }
  
  const messageDiv = document.createElement('div');
  messageDiv.className = 'message-item';
  messageDiv.dataset.messageId = message.id;
  
  const myDeviceId = `admin_${currentAdmin.id}`;
  const isSentByMe = message.from_device_id === myDeviceId;
  const timestamp = new Date(message.created_at);
  const timeString = formatTimeAgo(timestamp);
  
  if (isSentByMe) {
    // My message (sent)
    messageDiv.innerHTML = `
      <div class="message-bubble ms-auto" style="max-width: 75%;">
        <div class="message-content-wrapper" style="background: linear-gradient(135deg, #E91E63 0%, #F06292 100%); color: white; border: 1px solid #E91E63;">
          <div class="message-content">${sanitizeHTML(message.message)}</div>
        </div>
        <small class="message-time text-end d-block">${timeString}</small>
      </div>
    `;
  } else {
    // Received message - use recipient username from currentDmRecipient
    const senderUsername = currentDmRecipient ? currentDmRecipient.username : 'User';
    messageDiv.innerHTML = `
      <div class="message-avatar">
        <i class="bi bi-person-fill"></i>
      </div>
      <div class="message-bubble">
        <div class="message-header">
          <strong class="message-username">${sanitizeHTML(senderUsername)}</strong>
        </div>
        <div class="message-content-wrapper">
          <div class="message-content">${sanitizeHTML(message.message)}</div>
        </div>
        <small class="message-time">${timeString}</small>
      </div>
    `;
  }
  
  dmContainer.appendChild(messageDiv);
  dmContainer.scrollTop = dmContainer.scrollHeight;
}

// Send direct message
async function sendDirectMessage() {
  if (!currentAdmin || !currentDmRecipient) return;
  
  const input = document.getElementById('dmMessageInput');
  const sendBtn = document.getElementById('dmSendBtn');
  
  if (!input) return;
  
  const message = input.value.trim();
  
  if (!message) return;
  
  if (message.length > 500) {
    showDmAlert('Message too long (max 500 characters)', 'warning');
    return;
  }
  
  input.disabled = true;
  sendBtn.disabled = true;
  sendBtn.innerHTML = '<span class="spinner-border spinner-border-sm"></span>';
  
  try {
    const myDeviceId = `admin_${currentAdmin.id}`;
    
    // Use RPC function for secure messaging
    const { data, error } = await supabase.rpc('send_direct_message', {
      p_from_device_id: myDeviceId,
      p_to_device_id: currentDmRecipient.id,
      p_message: message
    });
    
    if (error) {
      if (error.message && error.message.includes('function') && error.message.includes('does not exist')) {
        showDmAlert('Direct messaging requires database setup. Please contact the administrator.', 'warning');
      } else {
        throw error;
      }
      return;
    }
    
    input.value = '';
    input.style.height = 'auto';
    
    // Reload conversation
    await loadDirectMessages();
    
  } catch (error) {
    console.error('Error sending DM:', error);
    console.error('Error details:', error.message, error.details, error.hint);
    showDmAlert(`Failed to send message: ${error.message || 'Please try again.'}`, 'danger');
  } finally {
    input.disabled = false;
    sendBtn.disabled = false;
    sendBtn.innerHTML = '<i class="bi bi-send-fill"></i>';
    input.focus();
  }
}

// Mark DMs as read
async function markDmsAsRead(messages) {
  try {
    const myDeviceId = `admin_${currentAdmin.id}`;
    const unreadMessages = messages.filter(m => 
      m.to_device_id === myDeviceId && !m.is_read
    );
    
    if (unreadMessages.length === 0) return;
    
    const { error } = await supabase
      .from('direct_messages')
      .update({ is_read: true })
      .in('id', unreadMessages.map(m => m.id));
    
    if (error) throw error;
  } catch (error) {
    console.error('Error marking DMs as read:', error);
  }
}

// Show DM alert
function showDmAlert(message, type = 'info') {
  const alertContainer = document.getElementById('dmAlertContainer');
  if (!alertContainer) return;
  
  const alert = document.createElement('div');
  alert.className = `alert alert-${type} alert-sm alert-dismissible fade show`;
  alert.innerHTML = `
    ${message}
    <button type="button" class="btn-close" data-bs-dismiss="alert"></button>
  `;
  
  alertContainer.appendChild(alert);
  
  setTimeout(() => {
    alert.remove();
  }, 5000);
}

// Handle Enter key for DM
function handleDmKeyPress(event) {
  if (event.key === 'Enter' && !event.shiftKey) {
    event.preventDefault();
    sendDirectMessage();
  }
}

// Auto-resize textarea
function autoResizeTextarea(textarea) {
  textarea.style.height = 'auto';
  textarea.style.height = textarea.scrollHeight + 'px';
}

// ============================================
// TAB SWITCHING
// ============================================

window.switchAdminTab = function(tabName) {
  const messagesTab = document.getElementById('adminMessagesTab');
  const usersTab = document.getElementById('adminUsersTab');
  const tabs = document.querySelectorAll('.message-tab');
  const messageInputArea = document.getElementById('messageInputArea');
  
  tabs.forEach(tab => {
    if (tab.textContent.toLowerCase().includes(tabName)) {
      tab.classList.add('active');
    } else {
      tab.classList.remove('active');
    }
  });
  
  if (tabName === 'messages') {
    messagesTab.style.display = 'flex';
    messagesTab.classList.add('active');
    usersTab.style.display = 'none';
    usersTab.classList.remove('active');
    messageInputArea.style.display = 'block';
  } else if (tabName === 'users') {
    messagesTab.style.display = 'none';
    messagesTab.classList.remove('active');
    usersTab.style.display = 'flex';
    usersTab.classList.add('active');
    messageInputArea.style.display = 'none';
    loadOnlineUsers();
  }
}

// ============================================
// ONLINE USERS LIST
// ============================================

async function loadOnlineUsers() {
  const container = document.getElementById('onlineUsersContainer');
  if (!container) return;
  
  try {
    container.innerHTML = '<div class="text-center py-3"><div class="spinner-border spinner-pink spinner-border-sm"></div></div>';
    
    // Get users online in last 30 seconds
    const thirtySecondsAgo = new Date(Date.now() - 30000).toISOString();
    const myDeviceId = `admin_${currentAdmin.id}`;
    
    const { data: users, error } = await supabase
      .from('user_presence')
      .select('*')
      .gte('last_seen', thirtySecondsAgo)
      .neq('device_id', myDeviceId)
      .order('last_seen', { ascending: false });
    
    if (error) throw error;
    
    // Get unread message counts for each user
    const { data: unreadMessages, error: unreadError } = await supabase
      .from('direct_messages')
      .select('from_device_id')
      .eq('to_device_id', myDeviceId)
      .eq('is_read', false);
    
    container.innerHTML = '';
    
    if (!users || users.length === 0) {
      container.innerHTML = '<div class="text-center text-muted py-4"><i class="bi bi-people"></i><br>No users online</div>';
      document.getElementById('onlineUserCount').style.display = 'none';
      return;
    }
    
    // Update badge
    const badge = document.getElementById('onlineUserCount');
    badge.textContent = users.length;
    badge.style.display = 'inline-block';
    
    // Count unread messages per user
    const unreadCounts = {};
    if (unreadMessages) {
      unreadMessages.forEach(msg => {
        unreadCounts[msg.from_device_id] = (unreadCounts[msg.from_device_id] || 0) + 1;
      });
    }
    
    users.forEach(user => {
      const userDiv = document.createElement('div');
      userDiv.className = 'online-user-item';
      userDiv.onclick = () => openDirectMessage(user.device_id, user.username || 'User', user.is_admin || false);
      
      const isAdmin = user.is_admin;
      const avatarClass = isAdmin ? 'admin-avatar' : '';
      const unreadCount = unreadCounts[user.device_id] || 0;
      const unreadBadge = unreadCount > 0 ? `<span class="unread-badge">${unreadCount}</span>` : '';
      
      userDiv.innerHTML = `
        <div class="message-avatar ${avatarClass}">
          <i class="bi bi-person-fill"></i>
          ${unreadBadge}
        </div>
        <div class="user-info">
          <strong class="user-name ${isAdmin ? 'admin-username' : ''}">${sanitizeHTML(user.username || 'Anonymous')}</strong>
          <small class="user-status">
            <i class="bi bi-circle-fill text-success" style="font-size: 0.5rem;"></i> 
            ${user.current_page || 'Online'} • ${user.device_name || 'Unknown Device'}
          </small>
        </div>
        <button class="btn btn-sm btn-pink">
          <i class="bi bi-chat-fill"></i>
        </button>
      `;
      
      container.appendChild(userDiv);
    });
    
  } catch (error) {
    console.error('Error loading online users:', error);
    container.innerHTML = '<div class="alert alert-danger alert-sm">Failed to load users</div>';
  }
}

// Subscribe to presence changes for real-time updates
function subscribeToPresence() {
  const presenceChannel = supabase.channel('admin-presence-updates')
    .on('postgres_changes', {
      event: '*',
      schema: 'public',
      table: 'user_presence'
    }, () => {
      // Reload online users if we're on the users tab
      const usersTab = document.getElementById('adminUsersTab');
      if (usersTab && usersTab.classList.contains('active')) {
        loadOnlineUsers();
      }
    })
    .subscribe();
}

// Scroll to a specific message
function scrollToMessage(messageId) {
  const messageEl = document.querySelector(`[data-message-id="${messageId}"]`);
  if (messageEl) {
    messageEl.scrollIntoView({ behavior: 'smooth', block: 'center' });
    messageEl.style.animation = 'highlight 1s';
    setTimeout(() => {
      messageEl.style.animation = '';
    }, 1000);
  }
}

// ============================================
// MESSAGE ACTIONS MENU
// ============================================

window.toggleMessageActions = function(event, messageId, isAdminMessage = true) {
  event.stopPropagation();
  event.preventDefault();
  
  console.log('Toggle actions for message:', messageId, 'isAdmin:', isAdminMessage);
  
  // Close any open dropdowns
  document.querySelectorAll('.message-actions-dropdown').forEach(d => d.remove());
  
  const btn = event.currentTarget;
  const dropdown = document.createElement('div');
  dropdown.className = 'message-actions-dropdown';
  
  // Show different options based on message type
  if (isAdminMessage) {
    dropdown.innerHTML = `
      <button class="message-action-item" onclick="event.stopPropagation(); window.reactToMessage('${messageId}'); return false;">
        <i class="bi bi-emoji-smile"></i> React
      </button>
      <button class="message-action-item" onclick="event.stopPropagation(); window.replyToMessage('${messageId}'); return false;">
        <i class="bi bi-reply"></i> Reply
      </button>
      <button class="message-action-item delete-action" onclick="event.stopPropagation(); window.deleteAdminMessage('${messageId}'); return false;">
        <i class="bi bi-trash"></i> Delete
      </button>
    `;
  } else {
    dropdown.innerHTML = `
      <button class="message-action-item" onclick="event.stopPropagation(); window.reactToMessage('${messageId}'); return false;">
        <i class="bi bi-emoji-smile"></i> React
      </button>
      <button class="message-action-item" onclick="event.stopPropagation(); window.replyToMessage('${messageId}'); return false;">
        <i class="bi bi-reply"></i> Reply
      </button>
      <button class="message-action-item delete-action" onclick="event.stopPropagation(); window.deleteAdminMessage('${messageId}'); return false;">
        <i class="bi bi-trash"></i> Delete
      </button>
    `;
  }
  
  btn.parentElement.appendChild(dropdown);
  console.log('Dropdown appended:', dropdown);
  
  // Close dropdown when clicking outside
  setTimeout(() => {
    document.addEventListener('click', function closeDropdown(e) {
      if (!dropdown.contains(e.target) && e.target !== btn) {
        dropdown.remove();
        document.removeEventListener('click', closeDropdown);
      }
    });
  }, 0);
}

window.deleteAdminMessage = async function(messageId) {
  if (!confirm('Are you sure you want to delete this message?')) return;
  
  try {
    // Verify user is authenticated as admin
    const { data: { user }, error: authError } = await supabase.auth.getUser();
    
    if (authError || !user) {
      alert('You must be logged in as admin to delete messages');
      return;
    }
    
    // Check if user is admin
    const { data: profile, error: profileError } = await supabase
      .from('profiles')
      .select('is_admin')
      .eq('id', user.id)
      .single();
    
    if (profileError || !profile || !profile.is_admin) {
      alert('Only admins can delete messages');
      return;
    }
    
    // Now delete the message - RLS policy should allow it
    const { error } = await supabase
      .from('anonymous_messages')
      .delete()
      .eq('id', messageId);
    
    if (error) throw error;
    
    // Remove dropdown
    document.querySelectorAll('.message-actions-dropdown').forEach(d => d.remove());
    
    // Remove the message from UI immediately
    const messageEl = document.querySelector(`[data-message-id="${messageId}"]`);
    if (messageEl) {
      messageEl.style.transition = 'opacity 0.3s';
      messageEl.style.opacity = '0';
      setTimeout(() => {
        messageEl.remove();
        // Check if no messages left
        const container = document.getElementById('adminMessagesContainer');
        if (container && container.children.length === 0) {
          container.innerHTML = '<div class="text-center text-muted py-4"><i class="bi bi-chat-dots"></i><br>No messages yet. Start the conversation!</div>';
        }
      }, 300);
    }
    
    showAdminAlert('Message deleted successfully', 'success');
    
  } catch (error) {
    console.error('Error deleting message:', error);
    alert('Failed to delete message: ' + (error.message || 'Unknown error'));
  }
}

window.reactToMessage = async function(messageId) {
  console.log('React to message:', messageId);
  // Close dropdown
  document.querySelectorAll('.message-actions-dropdown').forEach(d => d.remove());
  
  // Show emoji picker
  showAdminReactionPicker(messageId);
}

window.showAdminReactionPicker = function(messageId) {
  const reactions = ['❤️', '👍', '😂', '😮', '😢', '🙏', '🔥', '🎉'];
  const picker = document.createElement('div');
  picker.className = 'reaction-picker';
  picker.style.cssText = 'position: fixed; top: 50%; left: 50%; transform: translate(-50%, -50%); background: white; padding: 20px; border-radius: 16px; box-shadow: 0 10px 40px rgba(0,0,0,0.2); z-index: 10001; display: flex; gap: 10px; flex-wrap: wrap; max-width: 300px;';
  
  reactions.forEach(emoji => {
    const btn = document.createElement('button');
    btn.textContent = emoji;
    btn.style.cssText = 'font-size: 32px; background: none; border: none; cursor: pointer; padding: 8px; border-radius: 8px; transition: transform 0.2s;';
    btn.onmouseover = () => btn.style.transform = 'scale(1.3)';
    btn.onmouseout = () => btn.style.transform = 'scale(1)';
    btn.onclick = () => {
      toggleAdminReaction(messageId, emoji);
      document.body.removeChild(picker);
      document.body.removeChild(overlay);
    };
    picker.appendChild(btn);
  });
  
  const overlay = document.createElement('div');
  overlay.style.cssText = 'position: fixed; top: 0; left: 0; right: 0; bottom: 0; background: rgba(0,0,0,0.5); z-index: 10000;';
  overlay.onclick = () => {
    document.body.removeChild(picker);
    document.body.removeChild(overlay);
  };
  
  document.body.appendChild(overlay);
  document.body.appendChild(picker);
}

async function toggleAdminReaction(messageId, emoji) {
  try {
    const adminDeviceId = `admin_${currentAdmin.id}`;
    
    // Get current message
    const { data: msg, error: fetchError } = await supabase
      .from('anonymous_messages')
      .select('reactions')
      .eq('id', messageId)
      .single();
    
    if (fetchError) throw fetchError;
    
    let reactions = {};
    try {
      reactions = msg.reactions ? (typeof msg.reactions === 'string' ? JSON.parse(msg.reactions) : msg.reactions) : {};
    } catch (e) {
      reactions = {};
    }
    
    // Toggle reaction
    if (!reactions[emoji]) {
      reactions[emoji] = [];
    }
    
    const userIndex = reactions[emoji].indexOf(adminDeviceId);
    if (userIndex > -1) {
      // Remove reaction
      reactions[emoji].splice(userIndex, 1);
      if (reactions[emoji].length === 0) {
        delete reactions[emoji];
      }
    } else {
      // Add reaction
      reactions[emoji].push(adminDeviceId);
    }
    
    const { error: updateError } = await supabase
      .from('anonymous_messages')
      .update({ reactions })
      .eq('id', messageId);
    
    if (updateError) throw updateError;
    
    // Reload messages
    await loadAdminMessages();
    
  } catch (error) {
    console.error('Error toggling reaction:', error);
    alert('Failed to toggle reaction');
  }
}

let replyingToMessageId = null;
let replyingToUsername = null;
let replyingToText = null;

window.replyToMessage = function(messageId) {
  console.log('Reply to message:', messageId);
  // Close dropdown
  document.querySelectorAll('.message-actions-dropdown').forEach(d => d.remove());
  
  // Find message in DOM
  const messageEl = document.querySelector(`[data-message-id="${messageId}"]`);
  if (!messageEl) return;
  
  const username = messageEl.querySelector('.message-username')?.textContent || 'User';
  const text = messageEl.querySelector('.message-content')?.textContent || '';
  
  replyingToMessageId = messageId;
  replyingToUsername = username;
  replyingToText = text;
  
  showReplyBar();
}

window.showReplyBar = function() {
  let replyBar = document.getElementById('replyingToBar');
  
  if (!replyBar) {
    replyBar = document.createElement('div');
    replyBar.id = 'replyingToBar';
    replyBar.className = 'replying-to-bar';
    
    const messageInputArea = document.getElementById('messageInputArea');
    messageInputArea.insertBefore(replyBar, messageInputArea.firstChild);
  }
  
  replyBar.innerHTML = `
    <div>
      <i class="bi bi-reply"></i> Replying to <strong>${sanitizeHTML(replyingToUsername)}</strong>
      <br><small class="text-muted">${sanitizeHTML(replyingToText.substring(0, 50))}${replyingToText.length > 50 ? '...' : ''}</small>
    </div>
    <button class="cancel-reply" onclick="cancelReply()">
      <i class="bi bi-x-lg"></i>
    </button>
  `;
  
  replyBar.style.display = 'flex';
  document.getElementById('adminMessageInput').focus();
}

window.cancelReply = function() {
  replyingToMessageId = null;
  replyingToUsername = null;
  replyingToText = null;
  
  const replyBar = document.getElementById('replyingToBar');
  if (replyBar) {
    replyBar.style.display = 'none';
  }
}

// Cleanup on page unload
window.addEventListener('beforeunload', () => {
  if (adminMessageCheckInterval) {
    clearInterval(adminMessageCheckInterval);
  }
  if (adminMessagesChannel) {
    supabase.removeChannel(adminMessagesChannel);
  }
  if (adminPresenceChannel) {
    supabase.removeChannel(adminPresenceChannel);
  }
  if (dmChannel) {
    supabase.removeChannel(dmChannel);
  }
});
