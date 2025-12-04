const BLOCKLIST = [
  // Profanity & Slurs
  'fuck', 'shit', 'bitch', 'ass', 'damn', 'crap', 'bastard', 'dick', 'pussy', 'cock',
  'whore', 'slut', 'cunt', 'piss', 'fag', 'nigger', 'nigga', 'retard', 'gay', 'lesbian', 'nigg4', 'tangina', 'gago', 'tanga', 't4nga', 'pakyu', 'ulol', 'bobo',
  
  // Harassment & Bullying
  'kill yourself', 'kys', 'die', 'suicide', 'hang yourself', 'jump off', 'loser', 'idiot',
  'stupid', 'dumb', 'moron', 'ugly', 'fat', 'worthless', 'pathetic', 'trash', 'garbage',
  
  // Spam & Scam
  'free money', 'click here', 'buy now', 'limited offer', 'act now', 'prize', 'winner',
  'congratulations', 'claim now', 'discount', 'viagra', 'cialis', 'crypto', 'bitcoin',
  'forex', 'investment', 'mlm', 'cash app', 'venmo', 'paypal me',
  
  // Sexual Content
  'porn', 'sex', 'nude', 'naked', 'xxx', 'nsfw', 'hentai', 'onlyfans', 'camgirl',
  'escort', 'hookup', 'horny', 'sexy', 'boobs', 'tits', 'ass', 'penis', 'vagina',
  
  // Hate Speech & Discrimination
  'nazi', 'hitler', 'kkk', 'racist', 'terrorism', 'terrorist', 'radical', 'extremist',
  'supremacy', 'hate', 'discrimination', 'bigot', 'xenophobe',
  
  // Violence & Threats
  'kill', 'murder', 'rape', 'torture', 'bomb', 'gun', 'shoot', 'stab', 'attack',
  'assault', 'harm', 'hurt', 'beat up', 'fight', 'violence', 'threat',
  
  // Drug References
  'weed', 'cocaine', 'heroin', 'meth', 'drug dealer', 'drugs', 'high', 'stoned',
  'crack', 'marijuana', 'pot', 'dope', 'pills',
  
  // Personal Info Phishing
  'ssn', 'social security', 'credit card', 'bank account', 'password', 'login',
  'phone number', 'address', 'email me', 'dm me', 'private message',
  
  // Misinformation Keywords
  'fake news', 'hoax', 'conspiracy', 'scam', 'fraud', 'lie', 'misleading',
  
  // Self-Harm
  'cut myself', 'self harm', 'cutting', 'suicide methods', 'overdose', 'pills',
  
  // Doxxing & Privacy
  'dox', 'doxx', 'address', 'phone', 'leak', 'expose', 'personal info',
  
  // Bypassing Filters (common variations)
  'f*ck', 'sh!t', 'b!tch', 'a$$', 'd!ck', 'fuk', 'sht', 'biatch', 'azz',
  
  // Platform-Specific Spam
  'follow for follow', 'f4f', 'l4l', 'like for like', 'sub4sub', 'subscribe',
  'check my profile', 'link in bio', 'dm for more', 'add me on',
  
  // Other Inappropriate
  'illegal', 'download', 'torrent', 'pirate', 'hack', 'cheat', 'exploit',
  'bot', 'spam', 'scam', 'phishing', 'malware', 'virus'
];

// Animal + Color combinations for anonymous usernames
const ANIMALS = ['Tiger', 'Lion', 'Eagle', 'Wolf', 'Bear', 'Fox', 'Hawk', 'Puma', 'Panther', 'Falcon', 'Shark', 'Dragon', 'Phoenix', 'Raven', 'Cobra'];
const COLORS = ['Red', 'Blue', 'Gold', 'Silver', 'Green', 'Purple', 'Amber', 'Jade', 'Ruby', 'Steel', 'Bronze', 'Crimson', 'Azure', 'Onyx', 'Pearl'];

let anonymousUsername = null;
let lastMessageCount = 0;
let messageCheckInterval = null;
let deviceId = null;
let violationCount = 0;
let isBanned = false;
let presenceChannel = null;
let presenceUpdateInterval = null;
let sessionId = null;

// Generate unique session ID (persists across pages)
function generateSessionId() {
  if (!sessionId) {
    // Try to get existing session ID from localStorage
    sessionId = localStorage.getItem('userSessionId');
    
    if (!sessionId) {
      // Create new session ID only if none exists
      sessionId = 'session_' + Date.now() + '_' + Math.random().toString(36).substr(2, 9);
      localStorage.setItem('userSessionId', sessionId);
    }
  }
  return sessionId;
}

// Generate device fingerprint (non-bypassable identifier)
function generateDeviceId() {
  if (!deviceId) {
    // Try to get existing device ID
    deviceId = localStorage.getItem('deviceId');
    
    if (!deviceId) {
      // Create fingerprint from multiple browser properties
      const canvas = document.createElement('canvas');
      const ctx = canvas.getContext('2d');
      ctx.textBaseline = 'top';
      ctx.font = '14px Arial';
      ctx.fillText('fingerprint', 2, 2);
      const canvasData = canvas.toDataURL();
      
      const fingerprint = [
        navigator.userAgent,
        navigator.language,
        screen.colorDepth,
        screen.width + 'x' + screen.height,
        new Date().getTimezoneOffset(),
        !!window.sessionStorage,
        !!window.localStorage,
        navigator.hardwareConcurrency || 'unknown',
        canvasData.substring(0, 100)
      ].join('|');
      
      // Create hash of fingerprint
      deviceId = btoa(fingerprint).substring(0, 64);
      
      // Store in multiple places to prevent easy bypass
      localStorage.setItem('deviceId', deviceId);
      sessionStorage.setItem('deviceId', deviceId);
      
      // Also create a backup in IndexedDB
      try {
        const request = indexedDB.open('UserTracking', 1);
        request.onupgradeneeded = (e) => {
          const db = e.target.result;
          if (!db.objectStoreNames.contains('device')) {
            db.createObjectStore('device');
          }
        };
        request.onsuccess = (e) => {
          const db = e.target.result;
          const tx = db.transaction('device', 'readwrite');
          const store = tx.objectStore('device');
          store.put(deviceId, 'id');
        };
      } catch (e) {
        console.error('IndexedDB not available');
      }
    }
  }
  return deviceId;
}

// Check if user is banned
async function checkBanStatus() {
  try {
    const devId = generateDeviceId();
    
    const { data, error } = await supabase
      .from('banned_users')
      .select('is_banned, violation_count')
      .eq('device_id', devId)
      .maybeSingle();
    
    if (error && error.code !== 'PGRST116') throw error;
    
    if (data) {
      isBanned = data.is_banned || false;
      violationCount = data.violation_count || 0;
      return isBanned;
    }
    
    return false;
  } catch (error) {
    console.error('Error checking ban status:', error);
    return false;
  }
}

// Get current violation count
async function getViolationCount() {
  try {
    const devId = generateDeviceId();
    
    const { data, error } = await supabase
      .from('banned_users')
      .select('violation_count')
      .eq('device_id', devId)
      .maybeSingle();
    
    if (error && error.code !== 'PGRST116') throw error;
    
    violationCount = data ? (data.violation_count || 0) : 0;
    return violationCount;
  } catch (error) {
    console.error('Error getting violation count:', error);
    return 0;
  }
}

// Log violation to database (increment counter)
async function logViolation() {
  try {
    const devId = generateDeviceId();
    const username = getAnonymousUsername();
    
    // Call database function to increment violation count
    const { data, error } = await supabase.rpc('increment_violation', {
      p_device_id: devId,
      p_username: username
    });
    
    if (error) throw error;
    
    if (data && data.length > 0) {
      const result = data[0];
      violationCount = result.new_count;
      isBanned = result.is_now_banned;
      return isBanned;
    }
    
    return false;
  } catch (error) {
    console.error('Error logging violation:', error);
    return false;
  }
}

// Generate anonymous username
function generateAnonymousUsername() {
  if (!anonymousUsername) {
    const animal = ANIMALS[Math.floor(Math.random() * ANIMALS.length)];
    const color = COLORS[Math.floor(Math.random() * COLORS.length)];
    anonymousUsername = `${animal}-${color}`;
    localStorage.setItem('anonymousUsername', anonymousUsername);
  }
  return anonymousUsername;
}

// Get or create anonymous username
function getAnonymousUsername() {
  if (!anonymousUsername) {
    anonymousUsername = localStorage.getItem('anonymousUsername');
    if (!anonymousUsername) {
      anonymousUsername = generateAnonymousUsername();
    }
  }
  return anonymousUsername;
}

// Sanitize input to prevent XSS
function sanitizeInput(text) {
  const div = document.createElement('div');
  div.textContent = text;
  return div.innerHTML;
}

// Check for blocklisted words
function containsBlocklistedWords(text) {
  const lowerText = text.toLowerCase();
  for (const word of BLOCKLIST) {
    if (lowerText.includes(word.toLowerCase())) {
      return true;
    }
  }
  return false;
}

// Escape HTML entities
function escapeHtml(text) {
  const map = {
    '&': '&amp;',
    '<': '&lt;',
    '>': '&gt;',
    '"': '&quot;',
    "'": '&#039;',
    '/': '&#x2F;'
  };
  return text.replace(/[&<>"'/]/g, m => map[m]);
}

// Initialize floating message button
async function initFloatingMessages() {
  const existingBtn = document.getElementById('floatingMessageBtn');
  if (existingBtn) return; // Already initialized

  // Generate device ID immediately (non-bypassable)
  generateDeviceId();
  
  // Check ban status on load
  await checkBanStatus();
  await getViolationCount();

  // Create floating message button
  const btn = document.createElement('button');
  btn.id = 'floatingMessageBtn';
  btn.className = 'floating-message-btn';
  btn.innerHTML = '<i class="bi bi-chat-dots-fill"></i><span class="message-badge" id="messageBadge" style="display:none;">0</span>';
  btn.title = 'Anonymous Messages';
  btn.onclick = toggleMessageModal;
  document.body.appendChild(btn);

  // Create message modal
  createMessageModal();

  // Load messages and start polling
  loadMessages();
  startMessagePolling();
  
  // Start presence tracking globally (on all pages)
  startPresenceTracking();
  
  // Start presence tracking globally (on all pages)
  startPresenceTracking();

  // Generate username on first load
  getAnonymousUsername();
  
  // Disable input if banned
  if (isBanned) {
    const input = document.getElementById('messageInput');
    if (input) {
      input.disabled = true;
      input.placeholder = 'You are banned from sending messages';
    }
  }
}

// Create message modal
function createMessageModal() {
  const modalHTML = `
    <div class="modal fade" id="messageModal" tabindex="-1" aria-hidden="true">
      <div class="modal-dialog modal-dialog-scrollable modal-dialog-centered">
        <div class="modal-content shadow-lg border-0">
          <div class="modal-header border-0 pb-2">
            <div class="flex-grow-1">
              <div class="d-flex justify-content-between align-items-start">
                <div>
                  <h5 class="modal-title mb-1">
                    <i class="bi bi-chat-dots-fill text-pink"></i> Community
                  </h5>
                  <small class="text-muted d-block">
                    <i class="bi bi-incognito"></i> Posting as <strong class="text-pink" id="currentUsername"></strong>
                  </small>
                </div>
                <div class="online-users-indicator">
                  <i class="bi bi-circle-fill text-success online-pulse"></i>
                  <span id="onlineUsersCount" class="fw-bold">0</span> online
                </div>
              </div>
            </div>
            <button type="button" class="btn-close" data-bs-dismiss="modal" aria-label="Close"></button>
          </div>
          <div class="modal-body px-0 py-0">
            <div id="messagesContainer" class="messages-container">
              <div class="text-center text-muted py-5">
                <div class="spinner-border spinner-pink" role="status">
                  <span class="visually-hidden">Loading...</span>
                </div>
                <p class="small mt-3 mb-0">Loading messages...</p>
              </div>
            </div>
          </div>
          <div class="modal-footer border-0 pt-2">
            <div class="w-100">
              <div id="messageError" class="alert alert-danger alert-sm mb-2" style="display:none;"></div>
              <div class="input-group">
                <input type="text" class="form-control border-2" id="messageInput" placeholder="Share your thoughts..." maxlength="500">
                <button class="btn btn-pink text-light px-4" type="button" onclick="sendMessage()">
                  <i class="bi bi-send-fill"></i>
                </button>
              </div>
              <div class="d-flex justify-content-between align-items-center mt-2">
                <small class="text-muted" id="charCount">0/500</small>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  `;
  document.body.insertAdjacentHTML('beforeend', modalHTML);

  // Enable Enter key to send and character counter
  const input = document.getElementById('messageInput');
  const charCount = document.getElementById('charCount');
  if (input) {
    input.addEventListener('keypress', (e) => {
      if (e.key === 'Enter') {
        sendMessage();
      }
    });
    input.addEventListener('input', (e) => {
      if (charCount) {
        const count = e.target.value.length;
        charCount.textContent = `${count}/500`;
        if (count > 450) {
          charCount.classList.add('text-warning');
        } else {
          charCount.classList.remove('text-warning');
        }
        if (count >= 500) {
          charCount.classList.add('text-danger');
          charCount.classList.remove('text-warning');
        } else {
          charCount.classList.remove('text-danger');
        }
      }
    });
  }
}

// Toggle message modal
async function toggleMessageModal() {
  // Check ban status before opening
  await checkBanStatus();
  
  const modal = new bootstrap.Modal(document.getElementById('messageModal'));
  modal.show();
  
  const usernameEl = document.getElementById('currentUsername');
  if (usernameEl) {
    if (isBanned) {
      usernameEl.innerHTML = '<span class="text-danger">BANNED</span>';
    } else {
      const username = getAnonymousUsername();
      if (violationCount > 0) {
        usernameEl.innerHTML = `${username} <span class="text-warning">(⚠️ ${violationCount}/5)</span>`;
      } else {
        usernameEl.textContent = username;
      }
    }
  }
  
  loadMessages();
  resetMessageBadge();
  
  // Update online count immediately when modal opens
  updateOnlineUsersCount();
  
  // Disable input if banned
  if (isBanned) {
    const input = document.getElementById('messageInput');
    const errorDiv = document.getElementById('messageError');
    if (input) {
      input.disabled = true;
      input.placeholder = 'You are permanently banned';
    }
    if (errorDiv) {
      showError('You are permanently banned from sending messages due to multiple violations.', true);
    }
  }
}

// Load messages from database
async function loadMessages() {
  try {
    const container = document.getElementById('messagesContainer');
    if (!container) return;

    const { data: messages, error } = await supabase
      .from('anonymous_messages')
      .select('*')
      .order('created_at', { ascending: true })
      .limit(50);

    if (error) throw error;

    if (!messages || messages.length === 0) {
      container.innerHTML = '<p class="text-muted text-center py-4">No messages yet. Be the first to post!</p>';
      return;
    }

    container.innerHTML = messages.map(msg => {
      const date = new Date(msg.created_at);
      const timeAgo = getTimeAgo(date);
      const sanitizedMessage = escapeHtml(msg.message);
      
      return `
        <div class="message-item">
          <div class="d-flex align-items-start gap-2">
            <div class="message-avatar">
              <i class="bi bi-person-circle"></i>
            </div>
            <div class="flex-grow-1">
              <div class="d-flex justify-content-between align-items-center mb-1">
                <strong class="message-username">${escapeHtml(msg.username)}</strong>
                <small class="message-time">${timeAgo}</small>
              </div>
              <div class="message-content">${sanitizedMessage}</div>
            </div>
          </div>
        </div>
      `;
    }).join('');
    
    // Scroll to bottom to show newest messages
    container.scrollTop = container.scrollHeight;

    // Update last message count
    lastMessageCount = messages.length;

  } catch (error) {
    console.error('Error loading messages:', error);
    const container = document.getElementById('messagesContainer');
    if (container) {
      container.innerHTML = '<p class="text-danger text-center py-4">Failed to load messages. Please try again.</p>';
    }
  }
}

// Send message
async function sendMessage() {
  const input = document.getElementById('messageInput');
  const errorDiv = document.getElementById('messageError');
  
  if (!input) return;

  // Check if user is banned FIRST (non-bypassable)
  const banned = await checkBanStatus();
  if (banned || isBanned) {
    showError('You have been permanently banned from sending messages due to multiple violations of community guidelines.', true);
    input.disabled = true;
    input.placeholder = 'Account banned - cannot send messages';
    return;
  }

  const message = input.value.trim();

  // Clear previous errors
  if (errorDiv) {
    errorDiv.style.display = 'none';
    errorDiv.textContent = '';
  }

  // Validate message
  if (!message) {
    showError('Please enter a message.');
    return;
  }

  if (message.length > 500) {
    showError('Message is too long. Maximum 500 characters.');
    return;
  }

  // Check for blocklisted words
  if (containsBlocklistedWords(message)) {
    // Log violation (increments counter in database)
    const nowBanned = await logViolation();
    
    if (nowBanned) {
      showError('BANNED: You have been permanently banned after 5 violations. This ban cannot be bypassed.', true);
      input.disabled = true;
      input.placeholder = 'Account banned permanently';
      isBanned = true;
    } else {
      const remainingWarnings = 5 - violationCount;
      showError(`WARNING ${violationCount}/5: Your message contains inappropriate content and was rejected. ${remainingWarnings} warning(s) remaining before permanent ban.`, false);
    }
    return;
  }

  // Sanitize message
  const sanitizedMessage = sanitizeInput(message);

  try {
    // Insert message into database
    const { error } = await supabase
      .from('anonymous_messages')
      .insert([
        {
          username: getAnonymousUsername(),
          message: sanitizedMessage
        }
      ]);

    if (error) throw error;

    // Clear input
    input.value = '';
    const charCount = document.getElementById('charCount');
    if (charCount) charCount.textContent = '0/500';

    // Reload messages
    await loadMessages();

    // Show success feedback
    input.placeholder = 'Message sent! ✓';
    setTimeout(() => {
      input.placeholder = 'Share your thoughts...';
    }, 2000);

  } catch (error) {
    console.error('Error sending message:', error);
    showError('Failed to send message. Please try again.');
  }
}

// Show error message
function showError(message, isPermanent = false) {
  const errorDiv = document.getElementById('messageError');
  if (errorDiv) {
    errorDiv.textContent = message;
    errorDiv.style.display = 'block';
    
    // Change styling for ban messages
    if (isPermanent) {
      errorDiv.className = 'alert alert-danger alert-sm mb-2 fw-bold';
      errorDiv.style.borderLeft = '4px solid #dc3545';
      // Don't auto-hide permanent ban messages
    } else if (message.includes('WARNING')) {
      errorDiv.className = 'alert alert-warning alert-sm mb-2';
      errorDiv.style.borderLeft = '4px solid #ffc107';
      setTimeout(() => {
        errorDiv.style.display = 'none';
      }, 8000);
    } else {
      errorDiv.className = 'alert alert-danger alert-sm mb-2';
      setTimeout(() => {
        errorDiv.style.display = 'none';
      }, 5000);
    }
  }
}

// Get time ago string
function getTimeAgo(date) {
  const seconds = Math.floor((new Date() - date) / 1000);
  
  const intervals = {
    year: 31536000,
    month: 2592000,
    week: 604800,
    day: 86400,
    hour: 3600,
    minute: 60
  };

  for (const [unit, secondsInUnit] of Object.entries(intervals)) {
    const interval = Math.floor(seconds / secondsInUnit);
    if (interval >= 1) {
      return interval === 1 ? `1 ${unit} ago` : `${interval} ${unit}s ago`;
    }
  }

  return 'just now';
}

// Check for new messages
async function checkNewMessages() {
  try {
    const { count, error } = await supabase
      .from('anonymous_messages')
      .select('*', { count: 'exact', head: true });

    if (error) throw error;

    if (count > lastMessageCount) {
      updateMessageBadge(count - lastMessageCount);
    }

  } catch (error) {
    console.error('Error checking new messages:', error);
  }
}

// Update message badge
function updateMessageBadge(newCount) {
  const badge = document.getElementById('messageBadge');
  if (badge && newCount > 0) {
    badge.textContent = newCount > 99 ? '99+' : newCount;
    badge.style.display = 'inline-block';
  }
}

// Reset message badge
function resetMessageBadge() {
  const badge = document.getElementById('messageBadge');
  if (badge) {
    badge.style.display = 'none';
    badge.textContent = '0';
  }
}

// Start polling for new messages
function startMessagePolling() {
  if (messageCheckInterval) {
    clearInterval(messageCheckInterval);
  }
  // Check every 30 seconds
  messageCheckInterval = setInterval(checkNewMessages, 30000);
}

// Stop polling
function stopMessagePolling() {
  if (messageCheckInterval) {
    clearInterval(messageCheckInterval);
    messageCheckInterval = null;
  }
}

// Track user presence
async function trackPresence() {
  try {
    const sid = generateSessionId();
    const { error } = await supabase
      .from('user_presence')
      .upsert({
        session_id: sid,
        last_seen: new Date().toISOString()
      }, {
        onConflict: 'session_id'
      });
    
    if (error) throw error;
  } catch (error) {
    // Silent error handling
  }
}

// Get online users count
async function updateOnlineUsersCount() {
  try {
    // Consider users online if they were active in the last 60 seconds
    const oneMinuteAgo = new Date(Date.now() - 60000).toISOString();
    
    const { count, error } = await supabase
      .from('user_presence')
      .select('*', { count: 'exact', head: true })
      .gte('last_seen', oneMinuteAgo);
    
    if (error) throw error;
    
    const countEl = document.getElementById('onlineUsersCount');
    if (countEl) {
      countEl.textContent = count || 0;
    }
  } catch (error) {
    // Silent error handling
  }
}

// Start presence tracking
function startPresenceTracking() {
  // Track presence immediately
  trackPresence();
  updateOnlineUsersCount();
  
  // Update presence every 5 seconds
  if (presenceUpdateInterval) {
    clearInterval(presenceUpdateInterval);
  }
  presenceUpdateInterval = setInterval(() => {
    trackPresence();
    updateOnlineUsersCount();
  }, 5000);
}

// Stop presence tracking
function stopPresenceTracking() {
  if (presenceUpdateInterval) {
    clearInterval(presenceUpdateInterval);
    presenceUpdateInterval = null;
  }
}

// Cleanup presence on page unload
window.addEventListener('beforeunload', async () => {
  if (sessionId) {
    try {
      await supabase
        .from('user_presence')
        .delete()
        .eq('session_id', sessionId);
      
      // Remove session from localStorage
      localStorage.removeItem('userSessionId');
    } catch (error) {
      // Silent error handling
    }
  }
});

// Initialize on page load
if (document.readyState === 'loading') {
  document.addEventListener('DOMContentLoaded', initFloatingMessages);
} else {
  initFloatingMessages();
}

// Expose functions globally
window.sendMessage = sendMessage;
window.toggleMessageModal = toggleMessageModal;
