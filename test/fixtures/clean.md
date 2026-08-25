---
title: Deploy Your First CAP Application
description: Learn to deploy a simple SAP CAP application to BTP Cloud Foundry.
time: 15
tags: [ tutorial>beginner, software-product>sap-btp ]
---

## Prerequisites

- Node.js 22 or later installed
- SAP BTP trial account available
- `@sap/cds-dk` installed globally

## Step 1 — Scaffold a new CAP project

Open a terminal and run:

```bash
cds init my-app
cd my-app
npm install
```

This creates a minimal CAP project with the standard directory layout.

## Step 2 — Start the local server

```bash
cds watch
```

Your service is now running at `http://localhost:4004`.

## Step 3 — Explore the OData endpoint

Open a browser and navigate to `http://localhost:4004`. You should see the CAP welcome page listing your services.

## Summary

You have successfully scaffolded and started a CAP application locally. In the next tutorial you will add an entity and deploy to BTP.
