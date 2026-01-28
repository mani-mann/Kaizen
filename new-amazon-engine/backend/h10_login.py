"""
Helium 10 Login Script
Logs in and saves session cookies for the Node.js server to use
"""

import json
import time
import os
from selenium import webdriver
from selenium.webdriver.common.by import By
from selenium.webdriver.support.ui import WebDriverWait
from selenium.webdriver.support import expected_conditions as EC
from selenium.webdriver.chrome.service import Service

try:
    from webdriver_manager.chrome import ChromeDriverManager
    USE_MANAGER = True
except ImportError:
    USE_MANAGER = False

# Configuration
H10_EMAIL = "careerinbox.piet@gmail.com"
H10_PASSWORD = "India@786"
SESSION_FILE = os.path.join(os.path.dirname(__file__), "h10_session.json")
TOKEN_FILE = os.path.join(os.path.dirname(__file__), "h10_tokens.json")

def login_to_helium10():
    print("[*] Starting Helium 10 login...")

    # Setup Chrome options
    options = webdriver.ChromeOptions()
    options.add_argument("--start-maximized")
    options.add_argument("--disable-blink-features=AutomationControlled")
    options.add_experimental_option("excludeSwitches", ["enable-automation"])
    options.add_experimental_option("useAutomationExtension", False)

    # Initialize driver with auto-managed chromedriver
    if USE_MANAGER:
        service = Service(ChromeDriverManager().install())
    else:
        service = Service()
    driver = webdriver.Chrome(service=service, options=options)

    try:
        # Navigate to Helium 10 login page (correct URL)
        print("[*] Navigating to Helium 10 login page...")
        driver.get("https://members.helium10.com/user/signin")

        wait = WebDriverWait(driver, 30)

        # Wait for page to load and find email input
        print("[*] Waiting for login form...")
        time.sleep(2)

        # Try multiple selectors for email field
        email_input = None
        email_selectors = [
            (By.ID, "loginform-email"),
            (By.NAME, "LoginForm[email]"),
            (By.CSS_SELECTOR, "input[type='email']"),
            (By.CSS_SELECTOR, "input[name*='email']"),
            (By.XPATH, "//input[@type='email' or contains(@name,'email')]")
        ]

        for by, selector in email_selectors:
            try:
                email_input = wait.until(EC.presence_of_element_located((by, selector)))
                print(f"[+] Found email input with: {selector}")
                break
            except:
                continue

        if not email_input:
            # Print page source for debugging
            print("[-] Could not find email input. Page title:", driver.title)
            raise Exception("Could not find email input field")

        # Enter email
        print("[*] Entering email...")
        email_input.clear()
        email_input.send_keys(H10_EMAIL)
        time.sleep(0.5)

        # Find and fill password
        print("[*] Entering password...")
        password_selectors = [
            (By.ID, "loginform-password"),
            (By.NAME, "LoginForm[password]"),
            (By.CSS_SELECTOR, "input[type='password']"),
            (By.XPATH, "//input[@type='password']")
        ]

        password_input = None
        for by, selector in password_selectors:
            try:
                password_input = driver.find_element(by, selector)
                print(f"[+] Found password input with: {selector}")
                break
            except:
                continue

        if not password_input:
            raise Exception("Could not find password input field")

        password_input.clear()
        password_input.send_keys(H10_PASSWORD)
        time.sleep(0.5)

        # Click login button
        print("[*] Clicking login button...")
        login_selectors = [
            (By.CSS_SELECTOR, "button[type='submit']"),
            (By.XPATH, "//button[@type='submit']"),
            (By.XPATH, "//button[contains(text(),'Sign') or contains(text(),'Log')]"),
            (By.CSS_SELECTOR, "input[type='submit']")
        ]

        login_button = None
        for by, selector in login_selectors:
            try:
                login_button = driver.find_element(by, selector)
                print(f"[+] Found login button with: {selector}")
                break
            except:
                continue

        if login_button:
            login_button.click()
        else:
            # Try submitting the form via JavaScript
            driver.execute_script("document.querySelector('form').submit();")

        # Wait for successful login
        print("[*] Waiting for login to complete...")
        time.sleep(5)

        # Check if we're logged in by looking for dashboard URL or specific elements
        max_wait = 30
        logged_in = False
        for i in range(max_wait):
            current_url = driver.current_url
            if "dashboard" in current_url or "accountId" in current_url or "tools" in current_url:
                logged_in = True
                break
            if "signin" not in current_url and "login" not in current_url:
                logged_in = True
                break
            time.sleep(1)

        if not logged_in:
            print(f"[-] Login may have failed. Current URL: {driver.current_url}")
            # Continue anyway to try to get cookies

        # Give extra time for cookies
        time.sleep(3)

        # Extract cookies
        print("[*] Extracting session cookies...")
        cookies = driver.get_cookies()

        print(f"[*] Found {len(cookies)} cookies total")

        # Find the required cookies
        session_cookies = {}
        for cookie in cookies:
            if cookie['name'] in ['sid', '_identity', '_csrf', 'h10_session']:
                session_cookies[cookie['name']] = cookie['value']
                print(f"[+] Found cookie: {cookie['name']}")

        # Also capture all helium10.com cookies as backup
        if len(session_cookies) < 2:
            print("[*] Required cookies not found with standard names, capturing all cookies...")
            for cookie in cookies:
                if 'helium10' in cookie.get('domain', ''):
                    session_cookies[cookie['name']] = cookie['value']
                    print(f"[+] Captured: {cookie['name']}")

        if not session_cookies:
            print("[-] No cookies captured. Available cookies:")
            for cookie in cookies:
                print(f"    - {cookie['name']} ({cookie.get('domain', 'no domain')})")
            raise Exception("Failed to capture session cookies")

        # Save session cookies
        with open(SESSION_FILE, 'w') as f:
            json.dump(session_cookies, f, indent=2)
        print(f"[+] Session cookies saved to {SESSION_FILE}")

        # Clear old tokens file if exists
        if os.path.exists(TOKEN_FILE):
            os.remove(TOKEN_FILE)
            print(f"[+] Cleared old tokens file")

        print("\n[+] SUCCESS! Helium 10 session cookies acquired.")
        print("[*] You can now restart your Node.js server to use the new session.")

        # Keep browser open for 5 seconds to verify
        time.sleep(5)
        return True

    except Exception as e:
        print(f"\n[-] ERROR: {str(e)}")
        print("[*] If login failed, please check:")
        print("    1. Email and password are correct")
        print("    2. No CAPTCHA or 2FA required")
        print("    3. Account is not locked")
        # Keep browser open for debugging
        time.sleep(10)
        return False

    finally:
        driver.quit()

if __name__ == "__main__":
    login_to_helium10()
