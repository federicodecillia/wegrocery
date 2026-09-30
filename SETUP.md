# Setup ambiente locale

Guida per ricostruire da zero un ambiente di sviluppo della GAS app sul
proprio Mac. Tempo richiesto: 5 minuti se hai già accesso a Vercel e Neon.

## Prerequisiti

- Node.js >= 20.6 (`node --version`)
- Accesso al progetto Vercel `porta-moneta` (dashboard.vercel.com)
- Accesso al progetto Neon `porta_moneta` (console.neon.tech)

## 1. Clone e dipendenze

```bash
git clone https://github.com/federicodecillia/porta_moneta.git
cd porta_moneta
npm install
```

## 2. Variabili d'ambiente — `.env.local`

Le variabili sono divise in due gruppi: quelle che `vercel env pull` esporta
automaticamente, e quelle marcate "Sensitive" su Vercel che vanno aggiunte
a mano.

### 2a. Pull automatico delle variabili non-sensitive

```bash
npx vercel link                                     # solo la prima volta
npx vercel env pull .env.local --environment=production
```

Output atteso: file `.env.local` con `AUTH_GOOGLE_ID`, `AUTH_GOOGLE_SECRET`,
e altre. **Mancheranno `AUTH_SECRET` e `DATABASE_URL`** perché flagged
"Sensitive" su Vercel — non vengono esportate dal CLI per design.

### 2b. Aggiungi `DATABASE_URL`

Vai sul pannello Neon (console.neon.tech) → progetto porta_moneta →
"Connection Details" → copia la connection string Postgres
(`postgresql://...`).

Aggiungi una riga in fondo a `.env.local`:

```
DATABASE_URL="postgresql://..."
```

> Storicamente questo progetto ha anche una variabile `NEON_URL` con lo
> stesso valore. Il codice cerca `DATABASE_URL`. Se hai `NEON_URL` puoi
> creare l'altra come alias:
> ```bash
> echo "DATABASE_URL=$(grep '^NEON_URL=' .env.local | cut -d'=' -f2-)" >> .env.local
> ```

### 2c. Aggiungi `AUTH_SECRET`

Per il dev locale può (e dovrebbe) essere diverso da quello di prod.
Genera un valore nuovo:

```bash
echo "AUTH_SECRET=\"$(openssl rand -base64 32)\"" >> .env.local
```

> Avere `AUTH_SECRET` diverso tra locale e prod è la prassi consigliata:
> le sessioni dei due ambienti restano separate.

### 2c-bis. Variabili per l'invio mail al fornitore (opzionale)

L'azione "📧 Fornitore" nella tab Ciclo manda l'ordine al fornitore via
[Resend](https://resend.com). Se non configuri queste variabili il pulsante
risponde con un toast d'errore — il resto dell'app funziona normalmente.

```
RESEND_API_KEY="re_..."              # da resend.com → API keys
MAIL_FROM="GAS Porta Moneta <gas@portamoneta.org>"
```

Prerequisiti su Resend:

- Aggiungi `portamoneta.org` in **Domains** e segui i record DNS che ti
  indica (TXT/CNAME su Squarespace). La verifica può richiedere qualche
  minuto.
- L'indirizzo `MAIL_FROM` deve essere su un dominio verificato.

### 2d. Verifica

```bash
node -e "
require('@next/env').loadEnvConfig(process.cwd());
const need = ['AUTH_SECRET', 'AUTH_GOOGLE_ID', 'AUTH_GOOGLE_SECRET', 'DATABASE_URL'];
for (const k of need) {
  const v = process.env[k];
  console.log(k.padEnd(20), v ? 'OK' : '*** MISSING ***');
}
"
```

Devono risultare tutte OK.

## 3. Schema DB

Allinea lo schema Postgres con `lib/db/schema.ts`:

```bash
npm run db:push
```

> Lo script usa `node --env-file=.env.local node_modules/drizzle-kit/bin.cjs`
> perché drizzle-kit non legge `.env.local` di default. Se ricevi
> `Please provide required params for Postgres driver: url: ''`, controlla
> che `DATABASE_URL` sia in `.env.local` (non `NEON_URL`).

## 4. Dev server

```bash
npm run dev
```

Atteso: `Local: http://localhost:3000`. **Deve girare sulla 3000** perché
la callback OAuth Google registrata su Google Cloud Console è
`http://localhost:3000/api/auth/callback/google`. Se la 3000 è occupata da
un altro processo, killa quello vecchio invece di accettare la 3001:

```bash
lsof -i :3000 -sTCP:LISTEN -nP    # trova il PID
kill <pid>
```

## 5. Login utente di test

L'app accetta solo email presenti in `members.active = true`. Per testare:

1. Login con un Google account presente nella tabella `members` di Neon
2. Oppure aggiungi tu un member di test via SQL (su Neon SQL editor):
   ```sql
   INSERT INTO members (member_id, full_name, email, role, active, created_at, updated_at)
   VALUES (
     'mem_dev_' || substring(md5(random()::text), 1, 8),
     'Dev Test',
     'tua-email@gmail.com',
     'admin',
     true,
     now(),
     now()
   );
   ```

## Comandi utili

| Comando | Scopo |
|---|---|
| `npm run dev` | Dev server con hot reload |
| `npm run build` | Build di produzione (utile per type-check) |
| `npm run db:push` | Applica `schema.ts` → Neon |
| `npm run db:studio` | UI per ispezionare/editare il DB |

## Troubleshooting

### `db:push` dà `url: ''`
La variabile `DATABASE_URL` non è caricata. Verifica con il `node -e` del
punto 2d. Se manca, rifai 2b.

### `signin/google` → "There is a problem with the server configuration"
Manca `AUTH_SECRET`. Vedi 2c. **Riavvia il dev server** dopo averla
aggiunta: le variabili si leggono solo all'avvio.

### Login Google → "Accesso negato: la tua email non risulta tra i soci attivi"
La tua email non è in `members` o `active=false`. Vedi punto 5.

### Vercel env pull cancella .env.local
`vercel env pull` sovrascrive il file. Salva un backup prima:
```bash
cp .env.local .env.local.bak
npx vercel env pull .env.local --environment=production
# poi reincorpora a mano AUTH_SECRET e DATABASE_URL
```

## Demo mode

`DEMO_MODE=true` enables one-click "Socio"/"Admin" demo logins and disables
outbound email. It is meant ONLY for the public demo deployment (separate
Vercel project + separate Neon database). Never set it on the production
project. Seed/reset demo data with `npm run db:seed:demo` (reads
`.env.demo.local`).
