# Focus — To-do list

Une web app de to-do au design épuré blanc & bleu pour organiser :

- ☀️ **Aujourd'hui** — ce que je dois faire dans la journée
- 📅 **Cette semaine** — ce que je dois boucler dans la semaine
- 🎯 **Objectifs** — mes objectifs et les trucs importants

## Fonctionnalités

- Ajouter une tâche dans chaque liste (touche **Entrée** ou bouton **+**)
- Marquer une tâche comme **importante** (★) : elle remonte en haut et est mise en avant
- **Cocher** une tâche : elle s'anime puis disparaît de la liste
- Modifier une tâche par **double-clic**, la supprimer avec ✕
- Compteurs : tâches à faire, importantes, terminées aujourd'hui
- Sauvegarde automatique dans le navigateur (localStorage), aucun compte nécessaire
- Responsive : fonctionne sur ordinateur et mobile
- 🗓️ **Calendrier connecté à Google Agenda** : vue du mois, événements du jour, ajout et suppression d'événements directement dans votre agenda Google

## Connecter Google Agenda (une seule fois)

1. Ouvrez [Google Cloud Console](https://console.cloud.google.com/) et créez un projet.
2. **APIs & Services → Bibliothèque** : activez **Google Calendar API**.
3. **Écran de consentement OAuth** : type *Externe*, puis ajoutez votre adresse Gmail dans *Utilisateurs test*.
4. **Identifiants → Créer → ID client OAuth → Application Web**.
   Dans *Origines JavaScript autorisées*, ajoutez l'adresse où l'app tourne, par exemple :
   - `https://electis-wallonie.github.io` (GitHub Pages)
   - `http://localhost:8000` (en local)
5. Copiez l'ID client (`xxxx.apps.googleusercontent.com`) et :
   - soit collez-le dans `config.js` (`googleClientId`) — il n'est pas secret ;
   - soit cliquez sur ⚙ à côté de « Connecter Google Agenda » dans l'app.
6. Cliquez sur **Connecter Google Agenda** et autorisez l'accès.

> La connexion Google ne marche pas en ouvrant `index.html` en double-clic (`file://`) :
> l'app doit être en ligne (GitHub Pages) ou servie en local, par ex. `python3 -m http.server 8000`.
> La session Google dure environ 1 h ; ensuite il suffit de cliquer à nouveau sur « Connecter ».

## Lancer en local

Aucune installation : ouvrez `index.html` dans votre navigateur.
Pour Google Agenda, servez le dossier en local : `python3 -m http.server 8000` puis ouvrez http://localhost:8000.

## Stack

HTML, CSS et JavaScript natifs — aucune dépendance.
