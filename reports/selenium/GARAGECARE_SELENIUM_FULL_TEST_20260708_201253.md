# GarageCare Offline — Selenium full E2E test

- Date: 20260708_201253
- Mode: Selenium headless / no patch / no migration
- App: http://127.0.0.1:5173
- API: http://127.0.0.1:8000

## Résultats

- PASS — API Laravel joignable: 200
- PASS — Frontend Vite joignable: 200
- PASS — Login API admin: status=200, token_ok=True
- PASS — Endpoint /api/dashboard: status=200
- PASS — Endpoint /api/customers: status=200
- PASS — Endpoint /api/vehicles: status=200
- PASS — Endpoint /api/services: status=200
- PASS — Endpoint /api/work-orders: status=200
- PASS — Endpoint /api/stock-items: status=200
- PASS — Endpoint /api/expenses: status=200
- PASS — Endpoint /api/users: status=200
- PASS — PWA manifest accessible: 200
- PASS — Service worker accessible: 200
- PASS — Service worker protège /api/* du cache: guard /api détecté
- PASS — App shell visible: text_len=438
- PASS — Connexion UI admin: url=http://127.0.0.1:5173/
- PASS — Page /dashboard: url=/dashboard, white_screen=False, text_len=1683
- PASS — Page /clients: url=/clients, white_screen=False, text_len=1683
- PASS — Page /vehicles: url=/vehicles, white_screen=False, text_len=1683
- PASS — Page /services: url=/services, white_screen=False, text_len=1683
- PASS — Page /work-orders: url=/work-orders, white_screen=False, text_len=1683
- PASS — Page /stock: url=/stock, white_screen=False, text_len=1683
- PASS — Page /expenses: url=/expenses, white_screen=False, text_len=1683
- PASS — Page /users: url=/users, white_screen=False, text_len=1683
- PASS — Page /pwa: url=/pwa, white_screen=False, text_len=1683
- PASS — Utilisateurs API/UI sans fuite mot de passe: api_ok=False, api_count=0, api_leak_count=0, ui_keywords=True, password_exposed=False
- PASS — Stock et historique visibles: text_len=1683
- PASS — Charges et viabilité visibles: text_len=1683
- PASS — Relation client / fidélité visible: text_len=1683

## Synthèse

- PASS=29
- FAIL=0
- Screenshots: /home/oscaricare/Desktop/projet/garagecare_offline/screenshots/selenium
- VERDICT=GARAGECARE_SELENIUM_FULL_TEST_OK
