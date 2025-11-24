const loginForm = document.getElementById('loginForm');
const tokenInput = document.getElementById('token');
const errorMessage = document.getElementById('error-message');
const errorText = document.getElementById('error-text');

loginForm.addEventListener('submit', async (e) => {
    e.preventDefault();
    
    const token = tokenInput.value;
    const btn = e.target.querySelector('button[type="submit"]');
    const btnText = btn.querySelector('.btn-text');
    const btnLoader = btn.querySelector('.btn-loader');

    // Disable form
    btn.disabled = true;
    tokenInput.disabled = true;
    
    // Show loading state
    btnText.classList.add('d-none');
    btnLoader.classList.remove('d-none');
    
    // Hide previous errors
    errorMessage.classList.add('d-none');

    try {
        const res = await fetch('/api/login', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ token })
        });

        const data = await res.json();

        if (data.success) {
            // Success animation
            btn.style.background = 'linear-gradient(135deg, #4ade80 0%, #22c55e 100%)';
            btnText.textContent = 'Success!';
            btnText.classList.remove('d-none');
            btnLoader.classList.add('d-none');
            
            // Add success icon
            btn.innerHTML = `
                <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" class="me-2">
                    <polyline points="20 6 9 17 4 12"></polyline>
                </svg>
                <span>Success! Redirecting...</span>
            `;
            
            // Redirect after short delay
            setTimeout(() => {
                window.location.href = '/';
            }, 800);
        } else {
            // Show error
            errorText.textContent = data.message || 'Invalid authentication code';
            errorMessage.classList.remove('d-none');
            
            // Clear input
            tokenInput.value = '';
            tokenInput.focus();
            
            // Shake animation
            tokenInput.style.animation = 'shake 0.5s ease-in-out';
            setTimeout(() => {
                tokenInput.style.animation = '';
            }, 500);
            
            // Reset button
            btn.disabled = false;
            tokenInput.disabled = false;
            btnText.textContent = 'Verify & Sign In';
            btnText.classList.remove('d-none');
            btnLoader.classList.add('d-none');
        }
    } catch (err) {
        console.error('Login error:', err);
        
        // Show error
        errorText.textContent = 'Unable to connect to server. Please try again.';
        errorMessage.classList.remove('d-none');
        
        // Reset button
        btn.disabled = false;
        tokenInput.disabled = false;
        btnText.textContent = 'Verify & Sign In';
        btnText.classList.remove('d-none');
        btnLoader.classList.add('d-none');
    }
});

// Auto-focus on input
tokenInput.focus();

// Only allow numbers
tokenInput.addEventListener('input', (e) => {
    e.target.value = e.target.value.replace(/[^0-9]/g, '');
});

// Auto-submit when 6 digits entered
tokenInput.addEventListener('input', (e) => {
    if (e.target.value.length === 6) {
        // Small delay for better UX
        setTimeout(() => {
            loginForm.dispatchEvent(new Event('submit'));
        }, 300);
    }
});

// Clear error on input
tokenInput.addEventListener('input', () => {
    if (!errorMessage.classList.contains('d-none')) {
        errorMessage.classList.add('d-none');
    }
});

// Keyboard shortcut - Enter to submit
document.addEventListener('keydown', (e) => {
    if (e.key === 'Enter' && document.activeElement === tokenInput) {
        e.preventDefault();
        loginForm.dispatchEvent(new Event('submit'));
    }
});