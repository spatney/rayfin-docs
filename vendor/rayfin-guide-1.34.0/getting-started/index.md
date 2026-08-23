---
sidebar_position: 3
title: Getting Started
---

## Overview

Rayfin supports two development paths.
Choose the one that matches how you want to get started.

### Local development

Run the full Rayfin stack on your machine using Docker.
This path is ideal for building and testing your application before deploying.

1. Install prerequisites.
1. Scaffold a project with `npm create @microsoft/rayfin@latest` or [add Rayfin to an existing app](../cli/quickstart.md#add-rayfin-to-an-existing-project).
1. Start backend services with `npx rayfin up`.
1. Run your frontend with `npm run dev`.

**Start here:** [Build your first Rayfin app](./create-app-with-cli.md)

### Microsoft Fabric

Create a Fabric data app in the Fabric portal and deploy your application to the cloud.
This path requires a Microsoft account with Fabric access and tenant admin settings enabled.

1. Enable Fabric data app in your tenant admin settings.
1. Create a Fabric data app in a Fabric workspace.
1. Connect your local project and deploy with `npx rayfin up`.

**Start here:** [Create a Fabric data app in Fabric](./create-rayfin-item.md)

## Prerequisites

Install these tools before you begin with either path.
Rayfin requires Node.js 20 or later, Docker Desktop (or Docker Engine on Linux), and the GitHub CLI.

### Windows

- Install the latest LTS Node.js:

```powershell
winget install -e --id OpenJS.NodeJS.LTS
```

- Install Docker Desktop:

```powershell
winget install --id Docker.DockerDesktop -e
```

- Add Docker to PATH and start Docker Desktop:

```powershell
# Docker Desktop typically adds itself to PATH, verify with:
where docker
# If not found, add Docker to PATH:
$env:PATH += ";C:\Program Files\Docker\Docker\resources\bin"; [Environment]::SetEnvironmentVariable("PATH", $env:PATH, "User")
# Start Docker Desktop (required before using docker commands)
Start-Process "C:\Program Files\Docker\Docker\Docker Desktop.exe"
```

- Install the GitHub CLI:

```powershell
winget install --id GitHub.cli -e
```

- Add GitHub CLI to PATH (if it does not exist):

```powershell
# To check if your terminal knows about gh CLI
where gh
# If there are no results, add github CLI to your PATH by running:
$env:PATH += ";C:\Program Files\GitHub CLI"; [Environment]::SetEnvironmentVariable("PATH", $env:PATH, "User")
```

- Sign in and verify versions:

```powershell
gh auth login
node --version
docker --version
gh --version
```

Note: if prompted, authorize GitHub to access Microsoft.

### macOS

- Install latest LTS Node.js via Homebrew:

```bash
brew install node@lts
```

- Install Docker Desktop:

```bash
brew install --cask docker
```

- Start Docker Desktop and verify docker is in PATH:

```bash
which docker
open -a Docker
```

- Install the GitHub CLI:

```bash
brew install gh
```

- Verify GitHub CLI is in PATH:

```bash
which gh
```

- Sign in and verify versions:

```bash
gh auth login
node --version
docker --version
gh --version
```

Note: if prompted, authorize GitHub to access Microsoft.

### Linux (Ubuntu or Debian)

- Install the latest LTS Node.js using the [official Node.js download instructions](https://nodejs.org/en/download)

- Install Docker Engine and enable non-root access:

```bash
sudo apt install -y docker.io docker-compose-plugin
sudo systemctl enable --now docker
sudo usermod -aG docker "$USER"
newgrp docker
```

- Verify docker is in PATH:

```bash
which docker
sudo systemctl status docker
```

- Install the GitHub CLI:

```bash
type -p curl >/dev/null || sudo apt install -y curl
curl -fsSL https://cli.github.com/packages/githubcli-archive-keyring.gpg | sudo dd of=/usr/share/keyrings/githubcli-archive-keyring.gpg
sudo chmod go+r /usr/share/keyrings/githubcli-archive-keyring.gpg
echo "deb [arch=$(dpkg --print-architecture) signed-by=/usr/share/keyrings/githubcli-archive-keyring.gpg] https://cli.github.com/packages stable main" | sudo tee /etc/apt/sources.list.d/github-cli.list > /dev/null
sudo apt update
sudo apt install -y gh
```

- Verify GitHub CLI is in PATH:

```bash
which gh
```

- Sign in and verify versions:

```bash
gh auth login
node --version
docker --version
gh --version
```

## Making Changes

- **Apply the database schema generated from `rayfin/data` entities**

```bash
npx rayfin up db apply [--force]
```

- Repeat this command whenever you change decorated entity classes under `rayfin/data`.
- If running `npx rayfin up db apply` errors because there might be a loss of data, include the `--force` option to confirm that the potential data loss is okay.
- Run this in a terminal from the same project directory.
- You should see `✔ Configuration applied successfully!`.

## Troubleshooting

- **Docker is not running**: Start Docker Desktop or `sudo systemctl start docker`, then rerun `npx rayfin up`.
- **Database apply fails**: Wait for services to be healthy and retry `npx rayfin up db apply`.

## Next Steps

- Continue with [Create app with CLI](./create-app-with-cli.md).
- Review [Project structure](./project-structure.md) to understand the `rayfin/` folder and schema files.
