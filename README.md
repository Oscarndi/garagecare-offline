# GarageCare Offline

GarageCare Offline est une application web full-stack React + Laravel pour la gestion locale et offline-first d’un garage.

## Technologies

- React + Vite
- Laravel API
- SQLite
- PWA / offline-first
- GitHub

## Modules principaux

- Authentification
- Dashboard économique
- Clients
- Véhicules
- Services
- Devis et interventions
- Planning
- Stock
- Charges
- Comptes utilisateurs
- PWA installable

## Structure du projet

- garagecare-api : backend Laravel / API
- garagecare-web : frontend React / Vite
- README.md : présentation du projet
- .gitignore : exclusions Git

## Lancement API Laravel

cd garagecare-api
composer install
cp .env.example .env
php artisan key:generate
php artisan migrate --seed
php artisan serve --host=127.0.0.1 --port=8000

## Lancement frontend React

cd garagecare-web
npm install
npm run dev -- --host 127.0.0.1 --port 5173

## Compte de démonstration

Email : admin@garagecare.local
Mot de passe : password

## Sécurité

- Les fichiers .env ne sont pas versionnés.
- Les mots de passe ne sont pas retournés par l’API.
- Les comptes inactifs ne peuvent pas se connecter.
- Le dernier administrateur actif est protégé.
- Le service worker ne met pas en cache les routes /api/*.

## Auteur

Projet réalisé dans le cadre du cours Développement Web — Niveau Approfondi.



