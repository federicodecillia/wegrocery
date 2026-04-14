# Design System — Porta Moneta GAS

> Documento di riferimento per il redesign del frontend.
> Obiettivo: un'app mobile-first che sembra nativa, veloce, semplice, con un'identità visiva fresca e riconoscibile.

---

## 1. Principi di design

| Principio | Applicazione |
|-----------|-------------|
| **Mobile-first** | Progettata per il pollice. Touch target minimo 48px. Nessun hover-only. |
| **Contenuto prima** | Zero chrome inutile. Le informazioni importanti (saldo, ordine, deadline) sono immediate. |
| **Velocità percepita** | Skeleton loading, transizioni fluide, feedback tattile. L'app deve *sentirsi* veloce anche quando il server è lento. |
| **Progressive disclosure** | Mostra solo ciò che serve. Dettagli e azioni secondarie in sheet/accordion/overflow. |
| **Accessibilità** | Contrasto WCAG AA, font leggibili, aria-labels su tutti i controlli interattivi. |

---

## 2. Riferimenti visivi

### App di ispirazione

| App | Cosa prendere |
|-----|---------------|
| **Too Good To Go** | Card prodotto con foto placeholder, CTA chiara, palette green/white, bottom sheet per dettagli |
| **Satispay** | Saldo grande e centrale, transazioni come lista compatta, micro-animazioni su pagamento |
| **Splitwise** | Ledger entries con colori per tipo (verde=credito, rosso=debito), lista pulita |
| **Deliveroo / Glovo** | Stepper quantità inline, sticky footer con totale, skeleton loading sui prodotti |
| **Apple Wallet** | Card con depth e ombre soft, tipografia bold, gerarchia visiva netta |
| **Notion mobile** | Tab bar sottile, transizioni tra viste, empty state illustrati |

### Moodboard keywords
`organic`, `clean`, `warm green`, `soft shadows`, `rounded`, `friendly`, `trustworthy`

---

## 3. Palette colori

### Colori primari

```
--primary-50:   #ecfdf5    (sfondo attivo molto tenue)
--primary-100:  #d1fae5    (sfondo badge/pill)
--primary-200:  #a7f3d0    (bordi attivi)
--primary-500:  #10b981    (azioni principali, nav attiva)
--primary-600:  #059669    (hover/pressed)
--primary-700:  #047857    (testo su sfondo chiaro)
```

### Semantici

```
--success:      #10b981    (alias primary-500)
--danger:       #ef4444    (saldo negativo, errori, azioni distruttive)
--danger-light: #fef2f2
--warning:      #f59e0b    (avvisi, scadenze vicine)
--warning-light:#fffbeb
--info:         #3b82f6
```

### Neutri

```
--surface:      #ffffff
--surface-2:    #f9fafb    (sfondo pagina)
--surface-3:    #f3f4f6    (sfondo input, skeleton)
--border:       #e5e7eb
--border-strong:#d1d5db
--text:         #111827
--text-2:       #4b5563    (secondario)
--text-3:       #9ca3af    (muted/placeholder)
```

### Sfondo globale

Sfumatura sottile organica, mai piatto:
```css
background: linear-gradient(180deg, #f0fdf4 0%, #f9fafb 30%);
```

---

## 4. Tipografia

Font stack system con fallback ottimali per iOS e Android:

```css
--font-sans: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, 'Helvetica Neue', sans-serif;
--font-mono: 'SF Mono', 'Cascadia Code', 'Consolas', monospace;
```

### Scala tipografica

| Token | Size | Weight | Uso |
|-------|------|--------|-----|
| `--text-hero` | 2.5rem / 40px | 800 | Saldo grande nella Home |
| `--text-h1` | 1.5rem / 24px | 700 | Titoli sezione |
| `--text-h2` | 1.125rem / 18px | 600 | Sottotitoli, nomi card |
| `--text-body` | 1rem / 16px | 400 | Testo principale |
| `--text-sm` | 0.875rem / 14px | 400 | Meta info, label |
| `--text-xs` | 0.75rem / 12px | 500 | Badge, caption, tab label |

### Regole
- Line-height: 1.5 per body, 1.2 per headings
- Letter-spacing: -0.02em su hero e h1 (tighter per impatto)
- Mai tutto maiuscolo per testo lungo. Solo per badge e label corte.

---

## 5. Spaziatura e griglia

### Scala 4px

```
--space-1:  4px
--space-2:  8px
--space-3:  12px
--space-4:  16px
--space-5:  20px
--space-6:  24px
--space-8:  32px
--space-10: 40px
--space-12: 48px
```

### Container

```css
.container {
  max-width: 480px;        /* Ottimizzato per mobile, non troppo largo su tablet */
  margin: 0 auto;
  padding: 0 var(--space-4);
}
```

### Spaziatura verticale tra sezioni

```css
.section-gap { margin-bottom: var(--space-5); }
```

---

## 6. Componenti

### 6.1 Bottom Navigation

Ispirazione: iOS tab bar / Material 3 navigation bar.

```
┌──────┬──────┬──────┬──────┬──────┐
│  🏠  │  🛒  │  📊  │  ❓  │  ⚙️  │
│ Home │Ordine│Storico│Guida │Admin │
└──────┴──────┴──────┴──────┴──────┘
```

**Specifiche:**
- Altezza: 56px + safe-area-inset-bottom
- Icone: SVG inline 24x24 (non emoji Unicode — più puliti e consistenti)
- Label: 11px, weight 500
- Attivo: colore primary-500, icona filled
- Inattivo: colore text-3, icona outline
- Badge ordine aperto: dot 8px primary-500 con pulse animation
- Transizione: color 200ms ease
- `backdrop-filter: blur(12px)` con sfondo semi-trasparente per effetto glass

### 6.2 Card

Due varianti:

**Card base:**
```css
.card {
  background: var(--surface);
  border-radius: 16px;
  padding: 20px;
  box-shadow: 0 1px 3px rgba(0,0,0,.06), 0 1px 2px rgba(0,0,0,.04);
  border: 1px solid var(--border);
}
```

**Card elevata (saldo, ciclo attivo):**
```css
.card-elevated {
  box-shadow: 0 4px 16px rgba(0,0,0,.08), 0 1px 3px rgba(0,0,0,.04);
  border: none;
}
```

### 6.3 Saldo (Hero Card)

Il saldo è l'informazione più importante. Deve dominare la Home.

```
┌─────────────────────────┐
│   Il tuo saldo          │
│                         │
│     € 42,50             │  ← 40px, weight 800, colore semantico
│                         │
│   ● Ultimo bonifico:    │  ← text-sm, muted
│     +€50 il 3 apr       │
└─────────────────────────┘
```

- Saldo positivo: testo `--primary-700`, sfondo gradient `--primary-50 → surface`
- Saldo negativo: testo `--danger`, sfondo gradient `--danger-light → surface`
- Animazione: counter-up al caricamento (da 0 al valore reale, 400ms)

### 6.4 Ciclo attivo (Home)

```
┌─────────────────────────┐
│ 🟢 Ordine aperto        │
│                         │
│ Settimana 14 aprile     │  ← h2, bold
│ Chiude: mer 16 apr 12:00│  ← text-sm, muted
│ Ritiro: ven 18 apr      │
│                         │
│ [━━━━━━━━━░░░] 62%      │  ← progress bar tempo rimanente
│                         │
│ Il tuo ordine: €12,50   │  ← solo se ha già ordinato
│                         │
│ ┌─────────────────────┐ │
│ │   Vai all'ordine →  │ │  ← CTA full-width
│ └─────────────────────┘ │
└─────────────────────────┘
```

- Progress bar: mostra quanto manca alla chiusura (verde → giallo → rosso)
- Se chiusura < 12h: badge "Chiude presto!" con warning color

### 6.5 Product Card (Ordine)

Ispirazione: Deliveroo/Glovo product listing.

```
┌─────────────────────────────────────┐
│ Carote                              │
│ 1 kg · Az. Miglio        € 1,90    │
│                                     │
│  [ − ]    2    [ + ]       € 3,80   │
└─────────────────────────────────────┘
```

**Stati:**
- **Quantità 0**: opacity 0.5, border-left trasparente
- **Quantità > 0**: opacity 1, border-left 3px solid primary-500, sfondo primary-50
- **Animazione cambio qty**: scale bounce 50ms sul numero, flash sul subtotale

**Stepper:**
- Bottoni circolari 44x44, bordo primary, icona centrata
- Pulsante + ha sfondo primary quando qty=0 (invita all'azione)
- Touch ripple effect su press
- Qty: font-size 1.5rem, weight 800, min-width 48px centered

### 6.6 Sticky Order Footer

```
┌─────────────────────────────────────┐
│  Totale: € 23,40    [Salva ordine] │
│  Saldo dopo: € 19,10               │
└─────────────────────────────────────┘
```

- `position: fixed`, bottom = nav-height
- `backdrop-filter: blur(16px)`, sfondo rgba(255,255,255,0.85)
- Border-top: 1px solid border con shadow leggera verso l'alto
- Transizione slide-up quando si entra nella vista ordine

### 6.7 History Item

Ispirazione: Satispay transaction list.

```
┌─────────────────────────────────────┐
│ Settimana 7 aprile           €12,50 │
│ 8 apr · Chiuso                   ▸  │
│─────────────────────────────────────│  ← expand on tap
│ Carote ×2              €3,80       │
│ Mele Fuji ×1           €3,20       │
│ Patate ×1              €2,30       │
│ Pane integrale ×1      €4,20       │
└─────────────────────────────────────┘
```

- Expand/collapse con animazione max-height
- Chevron ruota 90° su expand
- Dettaglio caricato lazy (solo al primo tap)

### 6.8 Ledger Entry

```
  + € 50,00      Bonifico
  3 apr           Bonifico marzo
  
  − € 12,50      Ordine
  8 apr           Addebito ordine
```

- Importo positivo: primary-600, peso bold
- Importo negativo: danger, peso bold
- Divider sottile tra entries
- Icona tipo: ↑ per bonifico (verde), ↓ per ordine (rosso), ↔ per rettifica

### 6.9 Admin Tabs

Material 3 style con indicator animato:

```
  ━━━━━━
  Ciclo  Prodotti  Ordini  Bonifici  Soci
```

- Scrollabile orizzontalmente su mobile
- Indicatore bottom 3px che scivola tra i tab (CSS transition)
- Testo attivo: primary-500, weight 600
- Testo inattivo: text-3

### 6.10 Toast

```
┌──────────────────────────┐
│  ✓  Ordine salvato       │
└──────────────────────────┘
```

- Slide in dall'alto con spring animation
- Auto-dismiss 3s
- Varianti: success (verde), error (rosso), info (blu)
- Bordo radius 12px, shadow forte per emergere

### 6.11 Empty State

Ogni vista deve avere un empty state curato:

```
        🧺
  Nessun ordine aperto
  
  Torna quando l'admin
  aprirà il prossimo ordine.
```

- Emoji grande (48px) come illustrazione leggera
- Testo primario: h2, centered
- Testo secondario: text-sm, muted
- Azione opzionale se pertinente

### 6.12 Skeleton Loading

Al posto dello spinner, usare skeleton placeholder:

```
┌─────────────────────────┐
│ ░░░░░░░░░░              │
│ ░░░░░░░░░░░░░░░░        │
│                         │
│ ░░░░░░░░░░░░            │
│ ░░░░░░░░                │
└─────────────────────────┘
```

```css
.skeleton {
  background: linear-gradient(90deg, var(--surface-3) 25%, #e5e7eb 50%, var(--surface-3) 75%);
  background-size: 200% 100%;
  animation: shimmer 1.5s ease-in-out infinite;
  border-radius: 8px;
}
@keyframes shimmer {
  0% { background-position: 200% 0; }
  100% { background-position: -200% 0; }
}
```

### 6.13 Confirm Dialog (Modal)

```
┌─────────────────────────┐
│                         │
│    Chiudi ciclo?        │
│                         │
│  Verranno generati gli  │
│  addebiti per tutti i   │
│  soci che hanno         │
│  ordinato.              │
│                         │
│  [Annulla]  [Conferma]  │
│                         │
└─────────────────────────┘
```

- Overlay: backdrop-filter blur(4px) + rgba nero 40%
- Card centrata: radius 20px, padding 28px
- Animazione apertura: scale(0.95) + fade → scale(1)
- Bottoni: full-width stacked su mobile, side-by-side se spazio

### 6.14 Form Inputs

```css
.input {
  height: 48px;
  padding: 0 16px;
  border: 1.5px solid var(--border-strong);
  border-radius: 12px;
  font-size: 16px;        /* Previene zoom su iOS */
  transition: border-color 200ms, box-shadow 200ms;
}

.input:focus {
  border-color: var(--primary-500);
  box-shadow: 0 0 0 3px var(--primary-100);
}
```

- Label sopra l'input, 13px weight 600
- Helper text sotto, 12px muted
- Error state: border danger, helper text in rosso

---

## 7. Micro-interazioni e animazioni

| Interazione | Animazione | Durata |
|-------------|-----------|--------|
| Navigazione tra viste | Fade + slide leggero (8px) | 200ms ease-out |
| Card tap (history) | Background flash → expand content | 250ms |
| Stepper +/- | Scale bounce sul numero (1.0 → 1.2 → 1.0) | 150ms |
| Toast appear | Slide down + fade | 300ms spring |
| Modal open | Overlay fade + card scale(0.95→1) | 200ms ease-out |
| Badge pulse | Scale 1.0 → 1.3 → 1.0 con opacity | 2s infinite |
| Skeleton shimmer | Gradient slide orizzontale | 1.5s infinite |
| Saldo counter | Conteggio numerico da 0 a valore | 400ms ease-out |
| Button press | Scale(0.97) | 100ms |
| Tab indicator slide | Transform translateX | 250ms ease |

### Regole generali
- `prefers-reduced-motion: reduce` → disabilita tutte le animazioni
- Mai animazioni > 400ms (sensazione di lentezza)
- Usare `transform` e `opacity` (GPU accelerated), mai `width`/`height`/`top`

---

## 8. Icone

SVG inline, 24×24, stroke-width 2, round line-cap/join.

| Vista | Icona outline (inattiva) | Icona filled (attiva) |
|-------|--------------------------|----------------------|
| Home | `<path d="M3 12l9-9 9 9M5 10v10a1..."/>` | Stessa con fill |
| Ordine | Carrello outline | Carrello filled |
| Storico | Orologio outline | Orologio filled |
| Guida | Cerchio con ? outline | Cerchio con ? filled |
| Admin | Ingranaggio outline | Ingranaggio filled |

Creare un set di 5 icone inline SVG, evitando emoji Unicode (resa inconsistente tra browser/OS).

---

## 9. Responsive breakpoints

| Breakpoint | Layout |
|-----------|--------|
| < 480px | Mobile (default). Container full-width, card stacked |
| 480-768px | Small tablet. Container 480px centered |
| > 768px | Tablet/desktop. Container 600px, admin layout 2 colonne |

### Regole mobile
- Touch target: minimo 44×44px (Apple HIG) / 48×48dp (Material)
- Font-size input: minimo 16px (previene zoom iOS)
- Padding bottom body: nav-height + safe-area
- Scroll: `-webkit-overflow-scrolling: touch` sui container scrollabili

---

## 10. Struttura viste

### 10.1 Home (socio)

```
┌─ Container ─────────────────────┐
│                                 │
│  Ciao, Maria 👋                 │
│                                 │
│  ┌─ Saldo Card (elevated) ───┐  │
│  │     € 42,50               │  │
│  │  Ultimo mov: +€50 3 apr   │  │
│  └────────────────────────────┘  │
│                                 │
│  ┌─ Ciclo Card ──────────────┐  │
│  │  🟢 Ordine aperto         │  │
│  │  Settimana 14 aprile      │  │
│  │  ━━━━━━━░░░ 62%           │  │
│  │  [Vai all'ordine →]       │  │
│  └────────────────────────────┘  │
│                                 │
│  Ultimi movimenti               │
│  ┌────────────────────────────┐  │
│  │ + €50,00    Bonifico      │  │
│  │ − €12,50    Ordine        │  │
│  │ − €9,30     Ordine        │  │
│  └────────────────────────────┘  │
│                                 │
└─────────────────────────────────┘
```

### 10.2 Ordine

```
┌─ Container ─────────────────────┐
│                                 │
│  Settimana 14 aprile            │
│  Chiude: mer 16 apr 12:00       │
│                                 │
│  ┌─ Prodotto ────────────────┐  │
│  │ Arance Tarocco            │  │
│  │ 1 kg · €2,80              │  │
│  │ [−]  0  [+]               │  │
│  └────────────────────────────┘  │
│  ┌─ Prodotto (selezionato) ──┐  │
│  │▌Mele Fuji                 │  │
│  │ 1 kg · €3,20              │  │
│  │ [−]  2  [+]      €6,40   │  │
│  └────────────────────────────┘  │
│  ...                            │
│                                 │
│  ┌─ Sticky footer ──────────┐   │
│  │ Totale: €23,40  [Salva]  │   │
│  │ Saldo dopo: €19,10       │   │
│  └───────────────────────────┘   │
│                                 │
│  ┌─ Bottom nav ─────────────┐   │
└─────────────────────────────────┘
```

### 10.3 Storico

```
┌─ Container ─────────────────────┐
│                                 │
│  Storico                        │
│  [Ordini]  [Movimenti]          │  ← segmented control
│                                 │
│  Tab Ordini:                    │
│  ┌────────────────────────────┐  │
│  │ Sett. 7 aprile     €12,50 │  │
│  │ 8 apr · Chiuso        ▸   │  │
│  └────────────────────────────┘  │
│  ┌────────────────────────────┐  │
│  │ Sett. 31 marzo      €9,30 │  │
│  │ 1 apr · Chiuso        ▸   │  │
│  └────────────────────────────┘  │
│                                 │
│  Tab Movimenti:                 │
│  (ledger list come sezione 6.8) │
│                                 │
└─────────────────────────────────┘
```

---

## 11. Stato attuale vs. target

| Aspetto | Attuale | Target |
|---------|---------|--------|
| Icone nav | Emoji Unicode (resa diversa per OS) | SVG inline consistenti |
| Loading | Spinner + testo | Skeleton shimmer |
| Saldo | Testo grande senza contesto | Hero card con ultimo movimento e colore semantico |
| Prodotti ordine | Card semplice con opacity | Card con border accent, sfondo tinted, bounce qty |
| Error state | Testo + bottone basico | Emoji + messaggio + CTA styled |
| Transizioni | Nessuna (display:none/block) | Fade + slide 200ms |
| Colori | Verde piatto #1f8a4b | Scala emerald con sfumature |
| Admin tabs | Bordo bottom statico | Indicator animato sliding |
| Confirm dialog | Card centrata basica | Backdrop blur + scale animation |
| Nav bar | Sfondo bianco solido | Glass effect con blur |

---

## 12. Performance CSS

- Zero framework CSS. Tutto custom in `<style>`.
- CSS custom properties per tutto (temi futuri facili).
- `will-change` solo su elementi effettivamente animati.
- `contain: content` su card per ottimizzare paint.
- `content-visibility: auto` su sezioni fuori viewport.
- Font: solo system stack (zero download).
- Nessuna immagine esterna — tutto SVG inline o emoji.

---

## 13. Checklist implementazione

### Fase 1 — Foundation
- [ ] Nuova palette CSS con custom properties
- [ ] Nuova scala tipografica
- [ ] Scala spaziatura 4px
- [ ] Set icone SVG inline per la nav
- [ ] Skeleton loading component

### Fase 2 — Componenti core
- [ ] Bottom nav con glass effect e icone SVG
- [ ] Hero saldo card con colore semantico
- [ ] Ciclo card con progress bar
- [ ] Product card con stepper migliorato
- [ ] Sticky footer con glass effect
- [ ] Toast animato
- [ ] Modal con backdrop blur

### Fase 3 — Viste
- [ ] Home socio (saldo + ciclo + ultimi movimenti)
- [ ] Ordine con skeleton + animazioni stepper
- [ ] Storico con segmented control ed expand animato
- [ ] Admin tabs con indicator sliding
- [ ] Guida con layout migliorato
- [ ] Empty state per tutte le viste

### Fase 4 — Polish
- [ ] Transizioni tra viste (fade + slide)
- [ ] Counter-up animazione saldo
- [ ] prefers-reduced-motion support
- [ ] Test su iOS Safari, Chrome Android, desktop
- [ ] Verifica touch target >= 44px su tutti i controlli
