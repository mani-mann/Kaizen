document.addEventListener("DOMContentLoaded", updateNavbar);
function updateNavbar() {
  const placeholder = document.querySelector(".menu-login-profile");
  console.log("Updating navbar...");
  if (!placeholder) return;
  console.log("Placeholder found, updating...");
  placeholder.innerHTML = "";

  const jwt = localStorage.getItem("jwt_token");
  console.log("JWT Token:", jwt);
  const link = document.createElement("a");
  link.href = jwt ? "/profile" : "/user-login"; // Change URLs if needed
  link.textContent = jwt ? "Profile" : "Login";
  link.className = "menu-link";
  placeholder.appendChild(link);
}