# Porta Moneta GAS — app_gas

Web app per il GAS Porta Moneta (gruppo di acquisto solidale). Gestione ordini settimanali, saldo soci, cicli e catalogo fornitori.

**Live:** gas.portamoneta.org → Vercel

## Stack

- **Next.js 15** App Router + React 19 + TypeScript strict
- **Postgres** (Neon serverless) + **Drizzle ORM**
- **Auth.js** (Google OAuth) con whitelist sulla tabella `members`
- **Tailwind CSS v4**
- **Vercel** (deploy automatico da `main`)

## Struttura

```
app_gas/
├── app/                   # App Router — pagine e API routes
│   ├── page.tsx           # Home: saldo hero, ciclo aperto, ultimi movimenti
│   ├── ordine/            # Form ordine con stepper per prodotto
│   ├── storico/           # Storico ordini + movimenti ledger
│   ├── notifiche/         # Lista notifiche con mark-as-read
│   ├── guida/             # Come funziona + FAQ
│   └── admin/             # Pannello admin: ciclo, prodotti, ordini, cassa, fornitori, soci
├── components/
│   ├── app-shell.tsx      # Layout wrapper con header (logo + campanella + logout) e bottom nav
│   ├── bottom-nav.tsx     # Navigazione a tab in basso (5 voci)
│   ├── notification-bell.tsx  # Campanella con badge non lette
│   ├── home/              # CycleCountdown
│   ├── admin/             # Componenti per ogni tab admin
│   └── ui/                # Button, Card, ConfirmDialog, Toast, FaqAccordion
├── lib/
│   ├── db/
│   │   ├── schema.ts      # Drizzle schema: members, order_cycles, products, orders, ledger_entries, notifications, audit_log, suppliers, supplier_products
│   │   ├── queries.ts     # Query di lettura
│   │   └── client.ts      # Connessione Neon
│   ├── actions/
│   │   ├── admin.ts       # Server Actions admin (cicli, ledger, soci, fornitori)
│   │   ├── admin-cycles.ts
│   │   ├── admin-products.ts
│   │   ├── notifications.ts  # markNotificationRead / markAllNotificationsRead
│   │   └── order.ts       # saveOrder
│   └── auth/session.ts    # requireUserSession(), requireAdmin(), getUserRole()
├── drizzle/               # Migrazioni SQL
├── middleware.ts           # Protezione route (redirect /login se non autenticato)
├── auth.ts                # Auth.js config (Google provider + callbacks)
└── public/logo.png        # Logo Porta Moneta
```

## Comandi

```bash
cd app_gas
npm install
npm run dev          # http://localhost:3000
npm run db:push      # Applica schema su Neon (usa DATABASE_URL da .env.local)
npm run db:studio    # Drizzle Studio (esplora il DB visualmente)
npm run build        # Build di produzione
```

## Variabili d'ambiente

Crea `app_gas/.env.local` da `.env.example`:

```
DATABASE_URL=           # Neon connection string
AUTH_GOOGLE_ID=         # Google OAuth Client ID
AUTH_GOOGLE_SECRET=     # Google OAuth Client Secret
AUTH_SECRET=            # Stringa random per JWT (openssl rand -base64 32)
NEXTAUTH_URL=           # URL base dell'app (es. http://localhost:3000 in dev)
```

In produzione le variabili sono su Vercel (Settings → Environment Variables).

## Deploy

- **Preview**: ogni push su branch crea un deployment di preview su Vercel
- **Produzione**: merge su `main` → deploy automatico → gas.portamoneta.org
- Root Directory su Vercel: `app_gas`

## Architettura

- **Server Components** di default; Client Components solo dove serve interattività
- **Server Actions** per ogni mutazione (nessuna API route per CRUD interno)
- **Auth check server-side**: ogni Server Action wrappata in `requireUserSession()` o `requireAdmin()`
- **Notifiche**: emesse da `admin.ts` su chiusura ciclo e topup; lette via campanella nell'header → pagina `/notifiche`

## Design system

Orange/teal su sfondo warm-white. Variabili CSS in `app/globals.css`:
`--pm-orange`, `--pm-teal`, `--pm-red`, `--pm-near-black`, `--pm-gray`, `--pm-warm-white`, `--pm-border`.
