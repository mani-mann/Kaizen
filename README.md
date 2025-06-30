
#  WordPress Custom Auth & Secure Resource Manager

This project is a custom WordPress plugin suite consisting of multiple components to handle user authentication, protected content access, and email-based resource delivery. Below is documentation for each major part of the system.

---

##  1. Sudoku Page Plugin

This plugin creates a form for users to submit their data to the `_ENROLLMENTS` table in your WordPress database.

###  Features:
- PHP backend handles form submission and inserts data into `_ENROLLMENTS`.
- Data can be viewed via:
  - `WP Dashboard → WP Data Access → Data Explorer → Search "_ENROLLMENTS"`

### 🛠 Updating the Plugin:
1. Edit the plugin code locally.
2. Create a folder with the updated code and zip it.
3. Upload the ZIP via:
   - `WP Dashboard → Plugins → Add New → Upload Plugin`

---

##  2. Login & Signup System

Custom login, signup, and profile pages are handled using WordPress Pages and a custom plugin named `custom-auth-plugin`.

###  Features:
- REST API endpoints for:
  - `Signup`
  - `Login`
  - `Get Profile`
  - `Send email request`
- On successful login, a **JWT token** is returned and stored in **Local Storage**.
- The **navigation bar** is dynamically updated:
  - Logged-out users see **Login**.
  - Logged-in users see **Profile**.
  - Menu item is labeled **Account** by default (set via Menu Editor in WP Dashboard).

---

##  3. Secure Resource Manager

A WordPress admin plugin to manage access to gated resources.

###  Features:
- Has a form that gives a div componet for the uploaded resource. this code can them be added to any page or blog.
- Injects JavaScript on all pages to:
  - Detect click events on resource components.
  - Send a JWT-authenticated request to a secure backend endpoint.
- The backend (in `custom-auth-plugin`) validates the JWT and sends the resource via email.

---

##  4. Email Server (Node.js)

A separate Node.js service responsible for sending emails via **Nodemailer**.

###  Features:
- Provides an endpoint to send emails.
- Consumed by the `custom-auth-plugin` when secure resources are requested.
- Hosted on **Render.com**

###  Repo Location:
- GitHub Account: `b3soIns3@gmaiI.com`

---

##  Summary of Plugins & Responsibilities

| Plugin / Service         | Purpose                                                                 |
|--------------------------|-------------------------------------------------------------------------|
| `sudoku`                 | Handles form submissions to `_ENROLLMENTS` table                        |
| `custom-auth-plugin`     | Login/Signup/Profile endpoints, navbar logic, JWT issuance              |
| `secure-resource-manager`| Adds clickable components & JS logic to handle resource requests        |
| `email-server (Node.js)` | Sends resource emails upon secure request validation                    |

---

