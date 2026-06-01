# EchoRoom — Infrastructure as Code (Terraform)

Provisionnement de l'infrastructure EchoRoom via Terraform.

## Architecture

```
infra/terraform/
├── envs/
│   ├── dev/          # ⚙️ Environnement de développement
│   └── prod/         # 🚀 Environnement de production
├── modules/
│   ├── postgres/     # 🗄️ Aiven PostgreSQL managé
│   ├── redis/        # ⚡ Upstash Redis serverless
│   └── r2/           # 📦 Cloudflare R2 (stockage objets)
├── providers.tf      # Configuration des providers
├── variables.tf      # Variables globales (credentials)
├── versions.tf       # Contraintes de versions
└── README.md
```

## Services provisionnés

| Service       | Provider           | Usage                        | Environnement |
|---------------|--------------------|------------------------------|---------------|
| PostgreSQL    | Aiven              | Base de données principale   | dev + prod    |
| Redis         | Upstash            | Cache session, files d'attente | dev + prod  |
| R2 Bucket     | Cloudflare         | Stockage clips audio         | dev + prod    |

## Prérequis

- [Terraform](https://developer.hashicorp.com/terraform/downloads) >= 1.5
- Comptes actifs chez :
  - [Aiven](https://console.aiven.io/) — pour PostgreSQL managé
  - [Upstash](https://console.upstash.com/) — pour Redis serverless
  - [Cloudflare](https://dash.cloudflare.com/) — pour R2
- Tokens d'API pour chaque service (voir ci-dessous)

### Tokens requis

| Variable              | Source                                  | Où la trouver                        |
|-----------------------|-----------------------------------------|--------------------------------------|
| `AIVEN_API_TOKEN`     | Console Aiven → User → Authentication  | Profile → Tokens                     |
| `UPSTASH_EMAIL`       | Email du compte Upstash                 | Account Settings                     |
| `UPSTASH_API_KEY`     | Upstash Console → API Keys              | Dashboard → API Keys                 |
| `CLOUDFLARE_API_TOKEN`| Cloudflare Dashboard → API Tokens       | My Profile → API Tokens              |
| `CLOUDFLARE_ACCOUNT_ID` | Cloudflare Dashboard                  | Overview → Account ID (droite)       |

## Utilisation

### 1. Initialiser l'environnement

```bash
# Se placer dans l'environnement souhaité
cd infra/terraform/envs/dev

# Copier et éditer le fichier de variables
cp terraform.tfvars.example terraform.tfvars
# → Remplacer les valeurs par vos tokens et configurations

# Initialiser Terraform
terraform init
```

### 2. Vérifier le plan

```bash
terraform plan -var-file="terraform.tfvars"
```

### 3. Appliquer l'infrastructure

```bash
terraform apply -var-file="terraform.tfvars"
```

### 4. Détruire l'infrastructure (⚠️ irréversible)

```bash
terraform destroy -var-file="terraform.tfvars"
```

## Environnements

### Dev (`envs/dev/`)

- Plan PostgreSQL : `hobbyist` (gratuit / petit volume)
- Plan Redis : `free` (gratuit)
- Bucket R2 : `echoroom-recordings-dev`
- Backend : local (`terraform.tfstate.dev`)
- Base de données : `echoroom_dev`

### Production (`envs/prod/`)

- Plan PostgreSQL : `startup-8` (haute disponibilité)
- Plan Redis : `pay-as-you-go` (500 connexions max)
- Bucket R2 : `echoroom-recordings-prod`
- Backend : local par défaut — **configurer un backend distant avant le déploiement**
- Base de données : `echoroom_prod`

> **Note** : Pour la production, configurez un backend distant (S3, GCS, ou Terraform Cloud) pour partager l'état entre les membres de l'équipe. Décommentez le bloc `backend` dans `envs/prod/main.tf`.

## Sécurité

- Les mots de passe et tokens sont marqués `sensitive = true` dans les outputs
- Ne jamais committer `terraform.tfvars` (contient des secrets)
- Ajouter `*.tfstate` et `*.tfstate.*` au `.gitignore`
- Les connexions PostgreSQL utilisent SSL par défaut (`sslmode = require`)
- Le bucket R2 est configuré en juridiction `eu` (conformité RGPD)

## Variables sensibles

Toutes les variables marquées `sensitive = true` sont masquées dans les logs Terraform et les outputs :

- `aiven_api_token`
- `upstash_email` / `upstash_api_key`
- `cloudflare_api_token`
- Outputs : `database_password`, `connection_uri`, `rest_token`

## Migration depuis un environnement local

Pour migrer les services locaux vers les services managés :

1. Provisionner l'infrastructure avec `terraform apply`
2. Récupérer les outputs de connexion : `terraform output`
3. Mettre à jour le fichier `.env` de l'application avec les nouvelles valeurs
4. Exécuter `npx prisma migrate deploy` sur la nouvelle base Aiven
5. Vérifier la connexion Redis et R2

## Notes en français

### Commandes Terraform courantes

```bash
# Formater les fichiers .tf
terraform fmt

# Valider la syntaxe
terraform validate

# Voir les outputs après apply
terraform output

# Lister les ressources gérées
terraform state list
```

### Dépannage

- **Erreur "403 Forbidden"** : Vérifiez que vos tokens API sont valides et ont les bonnes permissions
- **Erreur "Quota exceeded"** : Le plan Aiven `hobbyist` est limité ; passez à `startup-4` si nécessaire
- **Le plan Aiven `hobbyist` n'est pas disponible** : Certains clouds/régions ne supportent pas le plan hobbyist. Utilisez `startup-4` comme alternative minimale.
- **Connexion Redis refusée** : Vérifiez que le TLS est activé et que vous utilisez le bon endpoint (REST ou Redis)
