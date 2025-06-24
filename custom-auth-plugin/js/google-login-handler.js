window.onload = function () {
  // Only show One Tap if JWT is not already stored
  if (!localStorage.getItem("jwt_token")) {
    if (window.google && google.accounts && google.accounts.id) {
      google.accounts.id.initialize({
        client_id: GoogleLoginSettings.client_id,
        callback: handleCredentialResponse,
        auto_select: false,
        cancel_on_tap_outside: false,
      });

      google.accounts.id.prompt(); // Trigger One Tap
    }
  } else {
    // User is logged in (JWT token exists)
    console.log("JWT found. Skipping One Tap.");
  }
};

function handleCredentialResponse(response) {
  fetch("/wp-json/custom-auth/v1/google-login", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ credential: response.credential })
  })
  .then(res => res.json())
  .then(data => {
    if (data.token) {
      localStorage.setItem("jwt_token", data.token);
      const path = window.location.pathname.toLowerCase();
      const redirectPages = ["/user-login/", "/signup/","/signup","/user-login"];
      console.log(path, redirectPages);
      if (!redirectPages.includes(path)){
        window.location.reload();
        // console.log("User logged in successfully. updating navbar.");
        // updateNavbar()
        // console.log("User logged in successfully. Navbar updated.");
      }
      if (redirectPages.includes(path)) {
        console.log("Redirecting to home page after login.");
        const params = new URLSearchParams(window.location.search);
        const redirectUrl = params.get('redirect');
        console.log("Redirect URL:", redirectUrl);
        if (redirectUrl) {
          window.location.href = decodeURIComponent(redirectUrl);
          return;
        }
        window.location.href = "/";
      } 
    } else {
      console.error("Login failed:", data);
    }
  });
}
