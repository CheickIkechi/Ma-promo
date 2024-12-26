# Étape 1 : Construire l'application (si vous avez une partie front-end)
FROM node:20 AS build

# Définir le répertoire de travail
WORKDIR /app

# Copier les fichiers de package et installer les dépendances
COPY package.json package-lock.json ./
RUN npm install

# Copier le reste des fichiers de l'application
COPY . .

# Si vous avez une partie front-end à construire, décommentez les lignes suivantes
# RUN npm run build

# Étape 2 : Configurer le serveur Node.js
FROM node:20

# Définir le répertoire de travail
WORKDIR /app

# Copier les fichiers de package et installer les dépendances
COPY package.json package-lock.json ./
RUN npm install --only=production

# Copier le reste des fichiers de l'application
COPY . .

# Exposer le port sur lequel l'application écoute
EXPOSE 5000

# Définir la commande par défaut
CMD ["node", "server.js"]