document.getElementById('loginForm').addEventListener('submit', async (e) => {
  e.preventDefault();
  
  const errorDiv = document.getElementById('errorMessage');
  errorDiv.style.display = 'none';
  
  const email = document.getElementById('email').value;
  const password = document.getElementById('password').value;
  
  try {
    const response = await fetch('/api/admin/login', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({ email, password }),
    });
    
    const data = await response.json();
    
    if (response.ok && data.success) {
      window.location.href = '/admin/dashboard.html';
    } else {
      errorDiv.textContent = data.error || 'Invalid email or password';
      errorDiv.style.display = 'block';
    }
  } catch (error) {
    console.error('Login error:', error);
    errorDiv.textContent = 'An error occurred. Please try again.';
    errorDiv.style.display = 'block';
  }
});
