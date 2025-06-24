document.addEventListener('DOMContentLoaded', () => {
  document.querySelectorAll('.resource-link').forEach(link => {
    link.addEventListener('click', function (e) {
      e.preventDefault();

      // Clear old messages or spinners
      const oldStatus = this.parentElement.querySelector('.srm-status-msg');
      if (oldStatus) oldStatus.remove();

      const status = document.createElement('span');
      status.className = 'srm-status-msg';
      status.innerHTML = '✅ The resource will be sent to your email soon...';
      this.parentElement.appendChild(status);

      const token = localStorage.getItem('jwt_token');
      if (!token) {
        status.innerHTML = '⚠️ Please log in to access this resource.';
        const currentPath = encodeURIComponent(window.location.pathname + window.location.search + window.location.hash);
        console.log(`Redirecting to login page with current path: ${currentPath}`);
        window.location.href = `/user-login?redirect=${currentPath}`;
        return;
      }

      const resourceId = this.getAttribute('data-resource-id');

      fetch('/wp-json/custom-auth/v1/resource-click', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': 'Bearer ' + token
        },
        body: JSON.stringify({ resource_id: resourceId })
      })
        .then(res => res.json())
        .then(data => {
          if (data.status === 'success') {
            status.innerHTML = '✅ Resource link sent to your email!';
          } else {
            status.innerHTML = `❌ ${data.message || 'Something went wrong.'}`;
          }
        })
        .catch(() => {
          status.innerHTML = '🚫 Network error. Try again later.';
        });
    });
  });
});
