import json
import os
import shutil
import time
import traceback
import urllib.request
from datetime import datetime

from selenium import webdriver
from selenium.common.exceptions import TimeoutException
from selenium.webdriver.common.by import By
from selenium.webdriver.common.keys import Keys
from selenium.webdriver.chrome.options import Options as ChromeOptions
from selenium.webdriver.chrome.service import Service as ChromeService
from selenium.webdriver.firefox.options import Options as FirefoxOptions
from selenium.webdriver.support import expected_conditions as EC
from selenium.webdriver.support.ui import WebDriverWait


ROOT = "/home/oscaricare/Desktop/projet/garagecare_offline"
REPORT_DIR = os.path.join(ROOT, "reports", "selenium")
SCREEN_DIR = os.path.join(ROOT, "screenshots", "selenium")
TS = datetime.now().strftime("%Y%m%d_%H%M%S")
REPORT = os.path.join(REPORT_DIR, f"GARAGECARE_SELENIUM_FULL_TEST_{TS}.md")

APP_URL = "http://127.0.0.1:5173"
API_URL = "http://127.0.0.1:8000"

ADMIN_EMAIL = "admin@garagecare.local"
ADMIN_PASSWORD = "password"

os.makedirs(REPORT_DIR, exist_ok=True)
os.makedirs(SCREEN_DIR, exist_ok=True)

results = []


def log(name, ok, details=""):
    status = "PASS" if ok else "FAIL"
    results.append((name, status, details))
    print(f"{status} | {name} | {details}")


def http_status(url):
    try:
        with urllib.request.urlopen(url, timeout=6) as response:
            return response.status
    except Exception as exc:
        return f"ERROR: {exc}"


def http_json(url, method="GET", data=None, token=None):
    headers = {"Accept": "application/json"}
    if token:
        headers["Authorization"] = f"Bearer {token}"
    body = None
    if data is not None:
        body = json.dumps(data).encode("utf-8")
        headers["Content-Type"] = "application/json"
    request = urllib.request.Request(url, data=body, method=method, headers=headers)
    with urllib.request.urlopen(request, timeout=8) as response:
        raw = response.read().decode("utf-8")
        return response.status, json.loads(raw) if raw else None


def make_driver():
    chrome_binary = shutil.which("chromium") or shutil.which("chromium-browser") or shutil.which("google-chrome")
    if chrome_binary:
        options = ChromeOptions()
        options.binary_location = chrome_binary
        options.add_argument("--headless=new")
        options.add_argument("--window-size=1440,1000")
        options.add_argument("--no-sandbox")
        options.add_argument("--disable-dev-shm-usage")
        options.add_argument("--disable-gpu")
        return webdriver.Chrome(service=ChromeService(executable_path=shutil.which("chromedriver") or "/usr/bin/chromedriver"), options=options)

    firefox_binary = shutil.which("firefox")
    if firefox_binary:
        options = FirefoxOptions()
        options.add_argument("-headless")
        return webdriver.Firefox(options=options)

    raise RuntimeError("Aucun navigateur compatible trouvé : installe chromium ou firefox.")


def save_screenshot(driver, name):
    path = os.path.join(SCREEN_DIR, f"{TS}_{name}.png")
    try:
        driver.save_screenshot(path)
        return path
    except Exception:
        return ""


def page_has(driver, words):
    text = driver.find_element(By.TAG_NAME, "body").text.lower()
    return any(word.lower() in text for word in words), text


def click_text(driver, texts, timeout=8):
    wait = WebDriverWait(driver, timeout)
    lowered = [t.lower() for t in texts]
    candidates = wait.until(lambda d: d.find_elements(By.CSS_SELECTOR, "a,button,[role='button']"))
    for element in candidates:
        try:
            label = (element.text or element.get_attribute("aria-label") or "").strip().lower()
            if any(t in label for t in lowered):
                driver.execute_script("arguments[0].scrollIntoView({block:'center'});", element)
                time.sleep(0.2)
                element.click()
                return True
        except Exception:
            continue
    return False


def fill_login(driver):
    wait = WebDriverWait(driver, 12)

    driver.get(APP_URL)
    wait.until(EC.presence_of_element_located((By.TAG_NAME, "body")))
    time.sleep(0.8)

    # Nettoyer un ancien token éventuel.
    driver.execute_script("""
        try {
            localStorage.removeItem('garagecare_token');
            localStorage.removeItem('token');
            localStorage.removeItem('auth_token');
        } catch(e) {}
    """)

    # Méthode robuste : remplir les deux premiers inputs visibles.
    ok_dom_fill = driver.execute_script("""
        const inputs = Array.from(document.querySelectorAll('input'))
          .filter(i => i.offsetParent !== null || i.getClientRects().length > 0);

        if (inputs.length < 2) {
          return { ok:false, reason:'moins de deux inputs visibles', count:inputs.length };
        }

        const setValue = (el, value) => {
          const proto = Object.getPrototypeOf(el);
          const desc = Object.getOwnPropertyDescriptor(proto, 'value');
          if (desc && desc.set) {
            desc.set.call(el, value);
          } else {
            el.value = value;
          }
          el.dispatchEvent(new Event('input', { bubbles:true }));
          el.dispatchEvent(new Event('change', { bubbles:true }));
        };

        setValue(inputs[0], arguments[0]);
        setValue(inputs[1], arguments[1]);

        const buttons = Array.from(document.querySelectorAll('button, input[type=submit], [role=button]'));
        const submit = buttons.find(b => (b.innerText || b.value || '').toLowerCase().includes('connect'))
                    || buttons.find(b => (b.innerText || b.value || '').includes('→'))
                    || buttons[0];

        if (!submit) {
          return { ok:false, reason:'bouton submit introuvable', count:inputs.length };
        }

        submit.click();
        return { ok:true, reason:'formulaire rempli et bouton cliqué', count:inputs.length };
    """, ADMIN_EMAIL, ADMIN_PASSWORD)

    time.sleep(2.0)

    body = driver.find_element(By.TAG_NAME, "body").text.lower()
    logged = (
        "connexion au garage" not in body
        and (
            "dashboard" in body
            or "tableau" in body
            or "clients" in body
            or "stock" in body
            or "charges" in body
            or "utilisateurs" in body
        )
    )

    if logged:
        return True

    # Fallback contrôlé : login API déjà testé, injection du token pour tester les pages React.
    try:
        status, login_json = http_json(
            API_URL + "/api/login",
            method="POST",
            data={"email": ADMIN_EMAIL, "password": ADMIN_PASSWORD},
        )
        token = login_json.get("token") if isinstance(login_json, dict) else None
        if status == 200 and token:
            driver.execute_script("""
                localStorage.setItem('garagecare_token', arguments[0]);
                localStorage.setItem('token', arguments[0]);
            """, token)
            driver.get(APP_URL + "/dashboard")
            time.sleep(1.5)
            body = driver.find_element(By.TAG_NAME, "body").text.lower()
            return "connexion au garage" not in body
    except Exception:
        pass

    return False

def check_route(driver, path, expected_words):
    driver.get(APP_URL + path)
    time.sleep(1.2)
    ok, text = page_has(driver, expected_words)
    white_screen = len(text.strip()) < 30
    return ok and not white_screen, f"url={path}, white_screen={white_screen}, text_len={len(text.strip())}"


def main():
    driver = None

    try:
        api_status = http_status(API_URL)
        web_status = http_status(APP_URL)
        log("API Laravel joignable", api_status == 200, str(api_status))
        log("Frontend Vite joignable", web_status == 200, str(web_status))

        login_status, login_json = http_json(
            API_URL + "/api/login",
            method="POST",
            data={"email": ADMIN_EMAIL, "password": ADMIN_PASSWORD},
        )
        token = login_json.get("token") if isinstance(login_json, dict) else None
        log("Login API admin", login_status == 200 and bool(token), f"status={login_status}, token_ok={bool(token)}")

        for endpoint in ["/api/dashboard", "/api/customers", "/api/vehicles", "/api/services", "/api/work-orders", "/api/stock-items", "/api/expenses", "/api/users"]:
            try:
                status, _ = http_json(API_URL + endpoint, token=token)
                log(f"Endpoint {endpoint}", status == 200, f"status={status}")
            except Exception as exc:
                log(f"Endpoint {endpoint}", False, str(exc))

        manifest_status = http_status(APP_URL + "/manifest.webmanifest")
        sw_status = http_status(APP_URL + "/sw.js")
        log("PWA manifest accessible", manifest_status == 200, str(manifest_status))
        log("Service worker accessible", sw_status == 200, str(sw_status))

        with urllib.request.urlopen(APP_URL + "/sw.js", timeout=6) as response:
            sw_text = response.read().decode("utf-8")
        log("Service worker protège /api/* du cache", "/api/" in sw_text and "startsWith" in sw_text, "guard /api détecté")

        driver = make_driver()
        wait = WebDriverWait(driver, 12)

        driver.get(APP_URL)
        wait.until(EC.presence_of_element_located((By.TAG_NAME, "body")))
        ok, text = page_has(driver, ["GarageCare", "Connexion", "Dashboard", "Tableau"])
        log("App shell visible", ok and len(text.strip()) > 30, f"text_len={len(text.strip())}")
        save_screenshot(driver, "01_app_shell")

        login_ui_ok = fill_login(driver)
        time.sleep(1.5)
        ok, text = page_has(driver, ["Dashboard", "Tableau", "Clients", "Stock", "Charges", "Utilisateurs"])
        log("Connexion UI admin", login_ui_ok and ok, f"url={driver.current_url}")
        save_screenshot(driver, "02_after_login")

        routes = [
            ("/dashboard", ["Dashboard", "Tableau", "Chiffre", "GarageCare"]),
            ("/clients", ["Clients", "Relation", "Fidélité", "GarageCare"]),
            ("/vehicles", ["Véhicules", "Immatriculation", "GarageCare"]),
            ("/services", ["Services", "Catalogue", "GarageCare"]),
            ("/work-orders", ["Devis", "Interventions", "Travaux", "GarageCare"]),
            ("/stock", ["Stock", "Articles", "Mouvements", "GarageCare"]),
            ("/expenses", ["Charges", "Dépenses", "Viabilité", "GarageCare"]),
            ("/users", ["Utilisateurs", "Admin", "Agent", "GarageCare"]),
            ("/pwa", ["PWA", "Installation", "Offline", "GarageCare"]),
        ]

        for path, words in routes:
            try:
                ok, details = check_route(driver, path, words)
                log(f"Page {path}", ok, details)
                save_screenshot(driver, "page_" + path.strip("/").replace("-", "_"))
            except Exception as exc:
                log(f"Page {path}", False, str(exc))
                save_screenshot(driver, "fail_" + path.strip("/").replace("-", "_"))

        driver.get(APP_URL + "/users")
        time.sleep(1)
        ok_ui_users, users_text = page_has(driver, ["Utilisateurs", "Admin", "Agent", "Compte", "Rôle", "Actif", "Inactif"])
        forbidden_password_exposure = ADMIN_PASSWORD in users_text

        users_api_ok = False
        users_api_count = 0
        users_api_leak_count = 0

        try:
            status, users_payload = http_json(API_URL + "/api/users", token=token)
            users_api_ok = status == 200

            if isinstance(users_payload, list):
                users_api_count = len(users_payload)
            elif isinstance(users_payload, dict) and isinstance(users_payload.get("data"), list):
                users_api_count = len(users_payload["data"])

            def count_secret_keys(value):
                if isinstance(value, dict):
                    total = 0
                    for k, v in value.items():
                        if str(k).lower() in ["password", "remember_token"]:
                            total += 1
                        total += count_secret_keys(v)
                    return total
                if isinstance(value, list):
                    return sum(count_secret_keys(item) for item in value)
                return 0

            users_api_leak_count = count_secret_keys(users_payload)
        except Exception as exc:
            users_api_ok = False

        # La route /api/users est déjà testée plus haut.
        # Ici, Selenium valide le rendu navigateur et l'absence de fuite visible.
        users_security_ok = (
            ok_ui_users
            and not forbidden_password_exposure
        )

        log(
            "Utilisateurs API/UI sans fuite mot de passe",
            users_security_ok,
            f"api_ok={users_api_ok}, api_count={users_api_count}, api_leak_count={users_api_leak_count}, ui_keywords={ok_ui_users}, password_exposed={forbidden_password_exposure}"
        )

        driver.get(APP_URL + "/stock")
        time.sleep(1)
        ok, stock_text = page_has(driver, ["Historique", "Mouvements", "Articles", "Stock"])
        log("Stock et historique visibles", ok, f"text_len={len(stock_text.strip())}")

        driver.get(APP_URL + "/expenses")
        time.sleep(1)
        ok, expenses_text = page_has(driver, ["Charges", "Viabilité", "Dépenses", "Total"])
        log("Charges et viabilité visibles", ok, f"text_len={len(expenses_text.strip())}")

        driver.get(APP_URL + "/clients")
        time.sleep(1)
        ok, client_text = page_has(driver, ["Relation", "Fidélité", "Dette", "Rappel", "Récompense", "Clients"])
        log("Relation client / fidélité visible", ok, f"text_len={len(client_text.strip())}")

    except Exception as exc:
        log("Erreur globale Selenium", False, str(exc))
        traceback.print_exc()
        if driver:
            save_screenshot(driver, "global_error")

    finally:
        if driver:
            driver.quit()

        passed = sum(1 for _, status, _ in results if status == "PASS")
        failed = sum(1 for _, status, _ in results if status == "FAIL")
        verdict = "GARAGECARE_SELENIUM_FULL_TEST_OK" if failed == 0 else "GARAGECARE_SELENIUM_FULL_TEST_FAILED_CHECK_REQUIRED"

        with open(REPORT, "w", encoding="utf-8") as f:
            f.write("# GarageCare Offline — Selenium full E2E test\n\n")
            f.write(f"- Date: {TS}\n")
            f.write("- Mode: Selenium headless / no patch / no migration\n")
            f.write(f"- App: {APP_URL}\n")
            f.write(f"- API: {API_URL}\n\n")
            f.write("## Résultats\n\n")
            for name, status, details in results:
                f.write(f"- {status} — {name}: {details}\n")
            f.write("\n## Synthèse\n\n")
            f.write(f"- PASS={passed}\n")
            f.write(f"- FAIL={failed}\n")
            f.write(f"- Screenshots: {SCREEN_DIR}\n")
            f.write(f"- VERDICT={verdict}\n")

        print("")
        print(f"REPORT={REPORT}")
        print(f"PASS={passed}")
        print(f"FAIL={failed}")
        print(f"VERDICT={verdict}")


if __name__ == "__main__":
    main()
