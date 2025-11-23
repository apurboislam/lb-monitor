document.getElementById('loginForm').addEventListener('submit', async (e) => {
    e.preventDefault();
    const token = document.getElementById('token').value;
    const btn = e.target.querySelector('button');

    btn.disabled = true;
    btn.textContent = 'Verifying...';

    try {
        const res = await fetch('/api/login', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ token })
        });

        const data = await res.json();

        if (data.success) {
            window.location.href = '/';
        } else {
            alert('Invalid Code');
            document.getElementById('token').value = '';
            btn.disabled = false;
            btn.textContent = 'Verify';
        }
    } catch (err) {
        console.error(err);
        alert('Error connecting to server');
        btn.disabled = false;
        btn.textContent = 'Verify';
    }
});
