// Security Utilities
// Comprehensive security functions for input validation and sanitization

// Rate limiting utility
class RateLimiter {
  constructor(maxRequests = 10, timeWindow = 60000) {
    this.maxRequests = maxRequests;
    this.timeWindow = timeWindow;
    this.requests = new Map();
  }

  canMakeRequest(key) {
    const now = Date.now();
    const userRequests = this.requests.get(key) || [];
    
    // Filter out old requests outside the time window
    const recentRequests = userRequests.filter(time => now - time < this.timeWindow);
    
    if (recentRequests.length >= this.maxRequests) {
      return false;
    }
    
    recentRequests.push(now);
    this.requests.set(key, recentRequests);
    return true;
  }

  reset(key) {
    this.requests.delete(key);
  }
}

// Global rate limiters
const apiRateLimiter = new RateLimiter(30, 60000); // 30 requests per minute
const messageRateLimiter = new RateLimiter(10, 60000); // 10 messages per minute
const authRateLimiter = new RateLimiter(5, 300000); // 5 attempts per 5 minutes

// DOMPurify configuration (requires DOMPurify to be loaded)
const purifyConfig = {
  ALLOWED_TAGS: ['b', 'i', 'em', 'strong', 'u', 'br', 'p', 'span', 'div', 'a', 'ul', 'ol', 'li', 'h1', 'h2', 'h3', 'h4', 'h5', 'h6', 'table', 'thead', 'tbody', 'tr', 'th', 'td', 'code', 'pre', 'blockquote'],
  ALLOWED_ATTR: ['href', 'target', 'rel', 'class', 'style', 'colspan', 'rowspan'],
  ALLOWED_URI_REGEXP: /^(?:(?:https?|mailto):|[^a-z]|[a-z+.-]+(?:[^a-z+.\-:]|$))/i,
  KEEP_CONTENT: true,
  RETURN_TRUSTED_TYPE: false
};

// Sanitize HTML input using DOMPurify
function sanitizeHTML(dirty) {
  if (typeof DOMPurify === 'undefined') {
    console.warn('DOMPurify not loaded, falling back to text-only sanitization');
    return sanitizeText(dirty);
  }
  return DOMPurify.sanitize(dirty, purifyConfig);
}

// Sanitize text (strip all HTML)
function sanitizeText(text) {
  if (!text) return '';
  const div = document.createElement('div');
  div.textContent = text;
  return div.innerHTML;
}

// Validate email format
function isValidEmail(email) {
  const emailRegex = /^[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}$/;
  return emailRegex.test(email) && email.length <= 254;
}

// Validate URL
function isValidURL(url) {
  try {
    const urlObj = new URL(url);
    return ['http:', 'https:'].includes(urlObj.protocol);
  } catch {
    return false;
  }
}

// Validate username (alphanumeric, underscore, hyphen, 3-20 chars)
function isValidUsername(username) {
  const usernameRegex = /^[a-zA-Z0-9_-]{3,20}$/;
  return usernameRegex.test(username);
}

// Validate password strength
function isStrongPassword(password) {
  // At least 8 characters, 1 uppercase, 1 lowercase, 1 number
  const minLength = password.length >= 8;
  const hasUpperCase = /[A-Z]/.test(password);
  const hasLowerCase = /[a-z]/.test(password);
  const hasNumber = /[0-9]/.test(password);
  
  return minLength && hasUpperCase && hasLowerCase && hasNumber;
}

// Escape special characters for SQL LIKE queries
function escapeLikeQuery(str) {
  return str.replace(/[%_\\]/g, '\\$&');
}

// Generate secure random token
function generateSecureToken(length = 32) {
  const array = new Uint8Array(length);
  crypto.getRandomValues(array);
  return Array.from(array, byte => byte.toString(16).padStart(2, '0')).join('');
}

// Check for SQL injection patterns
function containsSQLInjection(input) {
  const sqlPatterns = [
    /(\bSELECT\b|\bINSERT\b|\bUPDATE\b|\bDELETE\b|\bDROP\b|\bCREATE\b|\bALTER\b)/i,
    /(\bUNION\b|\bJOIN\b|\bWHERE\b)/i,
    /(--|\#|\/\*|\*\/)/,
    /(\bOR\b\s+\d+\s*=\s*\d+|\bAND\b\s+\d+\s*=\s*\d+)/i,
    /(['";])/
  ];
  
  return sqlPatterns.some(pattern => pattern.test(input));
}

// Check for XSS patterns
function containsXSS(input) {
  const xssPatterns = [
    /<script\b[^<]*(?:(?!<\/script>)<[^<]*)*<\/script>/gi,
    /<iframe\b/gi,
    /javascript:/gi,
    /on\w+\s*=/gi,
    /<img[^>]+src[^>]*>/gi,
    /eval\(/gi,
    /expression\(/gi,
    /vbscript:/gi
  ];
  
  return xssPatterns.some(pattern => pattern.test(input));
}

// Validate and sanitize message input
function sanitizeMessage(message, maxLength = 500) {
  if (!message || typeof message !== 'string') {
    return { valid: false, error: 'Message is required' };
  }
  
  // Trim whitespace
  message = message.trim();
  
  // Check length
  if (message.length === 0) {
    return { valid: false, error: 'Message cannot be empty' };
  }
  
  if (message.length > maxLength) {
    return { valid: false, error: `Message too long (max ${maxLength} characters)` };
  }
  
  // Check for malicious patterns
  if (containsSQLInjection(message)) {
    return { valid: false, error: 'Message contains prohibited patterns' };
  }
  
  if (containsXSS(message)) {
    return { valid: false, error: 'Message contains prohibited content' };
  }
  
  // Sanitize HTML
  const sanitized = sanitizeHTML(message);
  
  return { valid: true, message: sanitized };
}

// Validate file uploads
function validateFile(file, allowedTypes = [], maxSizeBytes = 10485760) {
  if (!file) {
    return { valid: false, error: 'No file provided' };
  }
  
  // Check file size (default 10MB)
  if (file.size > maxSizeBytes) {
    const maxSizeMB = maxSizeBytes / 1048576;
    return { valid: false, error: `File too large (max ${maxSizeMB}MB)` };
  }
  
  // Check file type
  if (allowedTypes.length > 0 && !allowedTypes.includes(file.type)) {
    return { valid: false, error: 'File type not allowed' };
  }
  
  // Check for double extensions (file.pdf.exe)
  const fileName = file.name;
  const extensionCount = (fileName.match(/\./g) || []).length;
  if (extensionCount > 1) {
    return { valid: false, error: 'Invalid file name' };
  }
  
  return { valid: true };
}

// Protect against timing attacks (constant-time string comparison)
function secureCompare(a, b) {
  if (a.length !== b.length) {
    return false;
  }
  
  let result = 0;
  for (let i = 0; i < a.length; i++) {
    result |= a.charCodeAt(i) ^ b.charCodeAt(i);
  }
  
  return result === 0;
}

// Debounce function to prevent rapid-fire requests
function debounce(func, wait) {
  let timeout;
  return function executedFunction(...args) {
    const later = () => {
      clearTimeout(timeout);
      func(...args);
    };
    clearTimeout(timeout);
    timeout = setTimeout(later, wait);
  };
}

// Throttle function to limit execution rate
function throttle(func, limit) {
  let inThrottle;
  return function(...args) {
    if (!inThrottle) {
      func.apply(this, args);
      inThrottle = true;
      setTimeout(() => inThrottle = false, limit);
    }
  };
}

// Check if device is banned (with rate limiting)
async function checkDeviceBan(deviceId) {
  if (!apiRateLimiter.canMakeRequest('ban-check-' + deviceId)) {
    return { allowed: false, error: 'Too many requests' };
  }
  
  try {
    const { data, error } = await supabase
      .from('user_bans')
      .select('*')
      .eq('device_id', deviceId)
      .single();
    
    if (error && error.code !== 'PGRST116') { // PGRST116 = not found
      console.error('Ban check error:', error);
      return { allowed: true }; // Fail open if error
    }
    
    const isBanned = data && (!data.expires_at || new Date(data.expires_at) > new Date());
    return { allowed: !isBanned, banned: isBanned, reason: data?.reason };
  } catch (error) {
    console.error('Ban check error:', error);
    return { allowed: true }; // Fail open if error
  }
}

// Log security event (implement server-side logging in production)
function logSecurityEvent(eventType, details) {
  console.warn('[SECURITY]', eventType, details);
  
  // In production, send to server-side logging service
  // Example: send to Supabase edge function or external service
  if (typeof supabase !== 'undefined') {
    supabase.from('security_logs').insert({
      event_type: eventType,
      details: JSON.stringify(details),
      timestamp: new Date().toISOString(),
      user_agent: navigator.userAgent
    }).then(() => {}).catch(() => {}); // Silent fail
  }
}

// Prevent clickjacking
if (window.top !== window.self) {
  logSecurityEvent('clickjacking_attempt', { referrer: document.referrer });
  window.top.location = window.self.location;
}

// Export functions for use in other scripts
if (typeof window !== 'undefined') {
  window.SecurityUtils = {
    sanitizeHTML,
    sanitizeText,
    sanitizeMessage,
    isValidEmail,
    isValidURL,
    isValidUsername,
    isStrongPassword,
    validateFile,
    containsSQLInjection,
    containsXSS,
    generateSecureToken,
    secureCompare,
    debounce,
    throttle,
    checkDeviceBan,
    logSecurityEvent,
    rateLimiters: {
      api: apiRateLimiter,
      message: messageRateLimiter,
      auth: authRateLimiter
    }
  };
}
