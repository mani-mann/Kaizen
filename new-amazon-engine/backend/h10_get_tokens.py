"""
Helium 10 Token Extractor
Opens Chrome with your H10 profile, goes to Cerebro, and captures the API tokens
Then pushes them to Cloud Run for 30-day validity
"""

import json
import time
import requests
from selenium import webdriver
from selenium.webdriver.common.by import By
from selenium.webdriver.support.ui import WebDriverWait
from selenium.webdriver.support import expected_conditions as EC
from selenium.webdriver.chrome.service import Service
from selenium.webdriver.common.desired_capabilities import DesiredCapabilities

# Configuration
CLOUD_RUN_URL = "https://amazon-analytics-565767837560.us-central1.run.app"
CHROME_USER_DATA = r"C:\Users\ashut\AppData\Local\Google\Chrome\User Data"
CHROMEDRIVER_PATH = r"C:\Users\ashut\Downloads\chromedriver-win64\chromedriver-win64\chromedriver.exe"

def get_h10_tokens():
    print("[*] Starting Helium 10 token extraction...")

    # Setup Chrome options with DevTools Protocol for network interception
    options = webdriver.ChromeOptions()
    options.add_argument(f"--user-data-dir={CHROME_USER_DATA}")
    options.add_argument("--profile-directory=Default")
    options.add_argument("--start-maximized")
    options.set_capability("goog:loggingPrefs", {"performance": "ALL"})

    # Initialize driver
    service = Service(executable_path=CHROMEDRIVER_PATH)
    driver = webdriver.Chrome(service=service, options=options)

    captured_tokens = {
        "authorization": None,
        "pacvueToken": None
    }

    try:
        # Navigate to Cerebro
        print("[*] Navigating to Helium 10 Cerebro...")
        driver.get("https://members.helium10.com/cerebro?accountId=1547402760")

        wait = WebDriverWait(driver, 30)
        time.sleep(5)  # Wait for page to load

        # Check if we need to login
        if "signin" in driver.current_url or "login" in driver.current_url:
            print("[!] Not logged in. Please login manually in the browser...")
            print("[*] Waiting for you to complete login...")

            # Wait until we're out of login page
            for _ in range(120):  # Wait up to 2 minutes
                if "signin" not in driver.current_url and "login" not in driver.current_url:
                    break
                time.sleep(1)

            time.sleep(3)
            driver.get("https://members.helium10.com/cerebro?accountId=1547402760")
            time.sleep(5)

        print("[+] On Cerebro page")
        print("[*] Looking for ASIN input field...")

        # Find ASIN input and search
        asin_input = None
        input_selectors = [
            (By.CSS_SELECTOR, "input[placeholder*='ASIN']"),
            (By.CSS_SELECTOR, "input[placeholder*='asin']"),
            (By.CSS_SELECTOR, "input.chakra-input"),
            (By.CSS_SELECTOR, "input[type='text']"),
            (By.XPATH, "//input[contains(@placeholder,'ASIN') or contains(@placeholder,'asin')]")
        ]

        for by, selector in input_selectors:
            try:
                asin_input = wait.until(EC.presence_of_element_located((by, selector)))
                print(f"[+] Found input with: {selector}")
                break
            except:
                continue

        if not asin_input:
            print("[-] Could not find ASIN input. Will try to capture tokens from any network activity...")
        else:
            # Enter a test ASIN
            print("[*] Entering test ASIN...")
            asin_input.clear()
            asin_input.send_keys("B0CQXJNQZ5")
            time.sleep(1)

            # Find and click search button
            search_btn = None
            btn_selectors = [
                (By.CSS_SELECTOR, "button[type='submit']"),
                (By.XPATH, "//button[contains(text(),'Get Keywords')]"),
                (By.XPATH, "//button[contains(text(),'Search')]"),
                (By.CSS_SELECTOR, "button.chakra-button")
            ]

            for by, selector in btn_selectors:
                try:
                    buttons = driver.find_elements(by, selector)
                    for btn in buttons:
                        if btn.is_displayed() and btn.is_enabled():
                            search_btn = btn
                            print(f"[+] Found button with: {selector}")
                            break
                    if search_btn:
                        break
                except:
                    continue

            if search_btn:
                print("[*] Clicking search button...")
                search_btn.click()
            else:
                # Try pressing Enter
                from selenium.webdriver.common.keys import Keys
                asin_input.send_keys(Keys.RETURN)

        # Wait for API requests
        print("[*] Waiting for API requests to capture tokens...")
        time.sleep(10)

        # Get performance logs
        logs = driver.get_log("performance")

        for log in logs:
            try:
                message = json.loads(log["message"])["message"]

                if message["method"] == "Network.requestWillBeSent":
                    request = message["params"]["request"]
                    url = request.get("url", "")
                    headers = request.get("headers", {})

                    # Look for Cerebro API calls
                    if "cerebro" in url.lower() or "pacvue" in url.lower() or "helium10" in url.lower():
                        # Check for authorization header
                        for key, value in headers.items():
                            if key.lower() == "authorization" and value.startswith("Bearer"):
                                captured_tokens["authorization"] = value
                                print(f"[+] Captured authorization token!")
                            if key.lower() == "x-pacvue-token" and value:
                                captured_tokens["pacvueToken"] = value
                                print(f"[+] Captured pacvue token!")

            except Exception as e:
                continue

        # If tokens not captured, try getting them from cookies/storage
        if not captured_tokens["authorization"] or not captured_tokens["pacvueToken"]:
            print("[*] Tokens not captured from network logs. Trying localStorage...")

            # Try to get tokens from localStorage
            try:
                local_storage = driver.execute_script("""
                    var tokens = {};
                    for (var i = 0; i < localStorage.length; i++) {
                        var key = localStorage.key(i);
                        if (key.toLowerCase().includes('token') || key.toLowerCase().includes('auth')) {
                            tokens[key] = localStorage.getItem(key);
                        }
                    }
                    return tokens;
                """)
                print(f"[*] localStorage tokens: {json.dumps(local_storage, indent=2)}")
            except:
                pass

        # If still no tokens, give manual instructions
        if not captured_tokens["authorization"] or not captured_tokens["pacvueToken"]:
            print("\n" + "="*60)
            print("[!] MANUAL TOKEN EXTRACTION REQUIRED")
            print("="*60)
            print("\nPlease follow these steps:")
            print("1. The browser should be open on Cerebro page")
            print("2. Press F12 to open DevTools")
            print("3. Go to Network tab")
            print("4. Search for any ASIN (e.g., B0CQXJNQZ5)")
            print("5. Look for a request containing 'cerebro' in the name")
            print("6. Click on it and go to Headers tab")
            print("7. Copy the 'authorization' header value")
            print("8. Copy the 'x-pacvue-token' header value")
            print("\nOnce you have the tokens, press Enter to continue...")
            input()

            auth = input("Paste authorization token (Bearer xxx...): ").strip()
            pacvue = input("Paste x-pacvue-token (Bearer eyJ...): ").strip()

            if auth and pacvue:
                captured_tokens["authorization"] = auth
                captured_tokens["pacvueToken"] = pacvue

        # Push tokens to Cloud Run
        if captured_tokens["authorization"] and captured_tokens["pacvueToken"]:
            print("\n[*] Pushing tokens to Cloud Run...")

            payload = {
                "authorization": captured_tokens["authorization"],
                "pacvueToken": captured_tokens["pacvueToken"],
                "expiresIn": 2592000  # 30 days
            }

            response = requests.post(
                f"{CLOUD_RUN_URL}/api/h10/tokens",
                json=payload,
                headers={"Content-Type": "application/json"}
            )

            if response.status_code == 200:
                result = response.json()
                print(f"[+] SUCCESS! Tokens pushed to Cloud Run")
                print(f"[+] Token expiry: {result.get('tokenExpiry')}")
            else:
                print(f"[-] Failed to push tokens: {response.text}")

            # Verify status
            print("\n[*] Verifying H10 status...")
            status = requests.get(f"{CLOUD_RUN_URL}/api/h10/status").json()
            print(f"[+] Status: {json.dumps(status, indent=2)}")
        else:
            print("[-] Could not capture tokens")
            return False

        return True

    except Exception as e:
        print(f"\n[-] ERROR: {str(e)}")
        import traceback
        traceback.print_exc()
        return False

    finally:
        print("\n[*] Closing browser in 5 seconds...")
        time.sleep(5)
        driver.quit()

if __name__ == "__main__":
    get_h10_tokens()
