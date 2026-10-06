// English member guide: the same cards as it.ts (slugs, topics, conditions
// and number of steps; lib/guide/guide.test.ts checks it).

import type { GuideContent } from "./types";

export const guideEn: GuideContent = {
  topics: [
    { id: "primi-passi", emoji: "👋", title: "Getting started", summary: "Signing in, installing the app on your phone, finding your way." },
    { id: "ordinare", emoji: "🧺", title: "Ordering", summary: "Placing, editing and cancelling an order, what happens when it closes." },
    { id: "soldi", emoji: "💶", title: "Balance and payments", summary: "How you pay, top-ups, refunds and movements." },
    { id: "famiglia", emoji: "🏠", title: "Family", summary: "Shopping together with one cart and one balance." },
    { id: "notifiche", emoji: "🔔", title: "Notifications", summary: "The app's alerts and how to get them by email too." },
    { id: "account", emoji: "👤", title: "Sign-in and profile", summary: "Sign-in problems, name and email, signing out." },
  ],
  articles: [
    // Getting started
    {
      slug: "come-entrare",
      topic: "primi-passi",
      title: "How do I sign in",
      steps: [
        "On the sign-in page type your email and tap **Send me the link**.",
        "Open the email you receive: tap the link, then **Sign in**.",
        "Or type the 6-digit code from the same email on the sign-in page.",
      ],
      notes: [
        "The link and the code last 15 minutes and work once. If the email does not arrive, check your spam folder.",
        "Once in, you stay signed in on that phone or computer until you sign out.",
      ],
      keywords: ["login", "log in", "password", "code", "link", "register"],
    },
    {
      slug: "installare-app",
      topic: "primi-passi",
      title: "Installing the app on your phone",
      intro: "You can add the app to your Home screen: it opens like any other app, without the browser bar.",
      steps: [
        "On iPhone open the app in Safari, tap Share (the square with the arrow) and then **Add to Home Screen**.",
        "On Android open the app in Chrome and tap **Install**, or choose **Add to Home screen** from the ⋮ menu.",
        "The first time you sign in from the installed app, use the 6-digit code that comes by email with the link.",
      ],
      notes: ["From your phone you also find these steps in your **Profile**, under **Install the app on your phone**."],
      keywords: ["phone", "mobile", "iphone", "android", "icon", "home screen", "download"],
    },
    {
      slug: "com-e-fatta",
      topic: "primi-passi",
      title: "How the app is laid out",
      steps: [
        "**Home**: your balance, the open order with the time left, and your latest movements.",
        "**Order**: the open cycle's catalogue, where you pick products and confirm.",
        "**History**: your past orders and every balance movement.",
        "**Guide**: this page, with the app's news and the contacts.",
      ],
      notes: [
        "At the top you find the notification bell and the circle with your initials: it opens your **Profile**, with your settings. Only the people who run the group see **Admin**.",
      ],
      keywords: ["menu", "screens", "tabs", "navigation"],
    },

    // Ordering
    {
      slug: "fare-ordine",
      topic: "ordinare",
      title: "Placing an order",
      steps: [
        "On Home check that an order is open and until when.",
        "Tap **Order** and pick products with the + and − buttons. At the bottom you see the total and your balance after the order.",
        "Tap **Confirm order**. You can still change it while the cycle is open.",
      ],
      link: { href: "/ordine", label: "Open Order" },
      keywords: ["order", "buy", "shopping", "cart", "products"],
      when: { mode: "wallet" },
    },
    {
      slug: "fare-ordine-carta",
      topic: "ordinare",
      title: "Placing an order",
      steps: [
        "On Home check that an order is open and until when.",
        "Tap **Order** and pick products with the + and − buttons. Under the total you see products, shipping and the order preparation fee.",
        "Tap **Confirm and pay** and pay by card. The order is confirmed as soon as the payment goes through.",
      ],
      link: { href: "/ordine", label: "Open Order" },
      keywords: ["order", "buy", "shopping", "cart", "products", "pay"],
      when: { mode: "per_order" },
    },
    {
      slug: "riproponi-ordine",
      topic: "ordinare",
      title: "Repeating last time's order",
      steps: [
        "In **Order** tap **Repeat last order**.",
        "The products of your last order that are still available go back in the cart.",
        "Change what you like and confirm.",
      ],
      link: { href: "/ordine", label: "Open Order" },
      keywords: ["repeat", "same", "same order", "reorder"],
    },
    {
      slug: "modificare-ordine",
      topic: "ordinare",
      title: "Editing or cancelling your order",
      intro: "You can do it while the cycle is open.",
      steps: [
        "Open **Order**: you see your confirmed order.",
        "Tap **Edit order**, change the quantities and confirm again.",
        "To remove it entirely tap **Cancel order**: nothing is charged at closing.",
      ],
      link: { href: "/ordine", label: "Open Order" },
      keywords: ["change", "cancel", "delete", "remove", "fix"],
      when: { mode: "wallet" },
    },
    {
      slug: "modificare-ordine-carta",
      topic: "ordinare",
      title: "Editing or cancelling your order",
      intro: "You can do it while the cycle is open.",
      steps: [
        "Open **Order** and change the quantities.",
        "If the total goes up you only pay the difference; if it goes down, the difference comes back to your card once the cycle is settled.",
        "To remove it entirely tap **Cancel order**: the refund starts at once and usually reaches your card in 5-10 days.",
      ],
      link: { href: "/ordine", label: "Open Order" },
      keywords: ["change", "cancel", "delete", "remove", "fix", "refund"],
      when: { mode: "per_order" },
    },
    {
      slug: "modifiche-salvate",
      topic: "ordinare",
      title: "I left my order half done",
      intro: "What you put in the cart is saved as you go: when you come back, it is still there.",
      steps: [
        "Open **Order**: at the top you see **Changes not confirmed yet**.",
        "Confirm the order to send them, or tap **Discard changes** to go back to your confirmed order.",
      ],
      notes: [
        "Until you confirm, the changes are not part of your order. If the cycle closes first, they are lost.",
      ],
      link: { href: "/ordine", label: "Open Order" },
      keywords: ["draft", "saved", "lost", "cart", "unconfirmed"],
    },
    {
      slug: "quando-ordinare",
      topic: "ordinare",
      title: "Until when can I order",
      intro:
        "Home shows when the order closes and how much time is left. After closing the order cannot be changed: the group sends it to the suppliers.",
      notes: [
        "When several orders are open at once, in **Order** you first choose which one to open.",
        "The pickup days are shown on Home, under the order.",
      ],
      keywords: ["deadline", "closing", "time", "pickup", "delivery", "date"],
    },
    {
      slug: "dopo-chiusura",
      topic: "ordinare",
      title: "What happens when the order closes",
      steps: [
        "Your order's cost is taken from your balance: the products, your share of shipping if any and, when the cycle has one, the order preparation fee.",
        "You get a notification with the amount charged.",
        "On the pickup days shown on Home you collect your groceries.",
      ],
      keywords: ["charge", "closing", "shipping", "pickup"],
      when: { mode: "wallet" },
    },
    {
      slug: "dopo-chiusura-carta",
      topic: "ordinare",
      title: "What happens when the order closes",
      steps: [
        "The group sends the order to the suppliers. On the pickup days shown on Home you collect your groceries.",
        "After pickup, with the final costs, the cycle is settled: what you paid too much comes back to your card.",
        "If the costs were higher than what you paid, Home shows **Amount due**.",
      ],
      keywords: ["closing", "settled", "shipping", "pickup", "refund"],
      when: { mode: "per_order" },
    },
    {
      slug: "correzioni",
      topic: "ordinare",
      title: "I received a different quantity",
      intro:
        "It happens with products sold by weight: you ordered 1 kg and 800 g arrive. The people who run the group record the real quantity and the difference is settled.",
      notes: ["You see it in **History** as an adjustment or a correction, and you get a notification."],
      link: { href: "/storico", label: "Open History" },
      keywords: ["weight", "weighed", "grams", "kg", "different price", "adjustment", "difference"],
    },

    // Balance and payments
    {
      slug: "come-funziona-saldo",
      topic: "soldi",
      title: "How the balance works",
      intro:
        "The balance is your credit with the group. You top it up in advance and, when each order closes, its cost is taken from there.",
      notes: ["Home shows today's balance and what will be left after the open order."],
      keywords: ["credit", "account", "money", "wallet"],
      when: { mode: "wallet" },
    },
    {
      slug: "ricarica-bonifico",
      topic: "soldi",
      title: "Topping up by bank transfer",
      steps: [
        "On Home tap **Recharge balance**.",
        "In **Bank transfer** copy the holder, the IBAN and the reference.",
        "Make the transfer from your bank.",
      ],
      notes: ["Your balance is updated when the treasurer records the transfer: you get a notification."],
      link: { href: "/ricarica", label: "Open Top up" },
      keywords: ["transfer", "iban", "bank", "money", "credit"],
      when: { mode: "wallet", bankTransfer: true },
    },
    {
      slug: "ricarica-online",
      topic: "soldi",
      title: "Topping up online by card",
      steps: [
        "On Home tap **Recharge balance**.",
        "In **Pay online** pick an amount or type it.",
        "Tap **Pay** and complete the payment. Your balance is updated as soon as the payment is confirmed.",
      ],
      notes: ["The minimum is 0.50 €. If the group set a maximum balance, online top-ups stop there."],
      link: { href: "/ricarica", label: "Open Top up" },
      keywords: ["card", "credit card", "debit", "pay", "online", "money"],
      when: { mode: "wallet", onlineTopup: true },
    },
    {
      slug: "ricarica-cassa",
      topic: "soldi",
      title: "Topping up your balance",
      intro: "Ask the treasurer how to pay: once they record it, your balance is updated and you get a notification.",
      keywords: ["payment", "transfer", "cash", "money", "credit"],
      when: { mode: "wallet", bankTransfer: false, onlineTopup: false },
    },
    {
      slug: "saldo-negativo",
      topic: "soldi",
      title: "Can I order with a low or negative balance?",
      intro:
        "Yes, so you can still do your shopping: the app warns you when you go negative. If the group set a limit, beyond it the order is not saved until you top up.",
      notes: [
        "The limit also counts orders already confirmed and not charged yet. Top up as soon as you can: the group pays the suppliers with that money.",
      ],
      link: { href: "/ricarica", label: "Open Top up" },
      keywords: ["negative", "debt", "insufficient", "overdrawn", "limit"],
      when: { mode: "wallet" },
    },
    {
      slug: "spese-preparazione",
      topic: "soldi",
      title: "What is the order preparation fee",
      intro:
        "When the cycle has one, it is a small share for bank fees and the group's running costs: a percentage of the products or a fixed amount. You see it in the order summary and it is charged at closing with the order.",
      keywords: ["fees", "costs", "share", "fee", "running costs"],
      when: { mode: "wallet" },
    },
    {
      slug: "come-si-paga",
      topic: "soldi",
      title: "How the order is paid",
      intro:
        "By card, when you confirm the order. You pay products, shipping and the order preparation fee. If you then edit the order and the total goes up, you only pay the difference.",
      link: { href: "/ordine", label: "Open Order" },
      keywords: ["card", "pay", "debit", "online"],
      when: { mode: "per_order" },
    },
    {
      slug: "spese-preparazione-carta",
      topic: "soldi",
      title: "What is the order preparation fee",
      intro:
        "A share for bank fees and the group's running costs, set for each cycle: a percentage of the products or a fixed amount. You see it before confirming and it stays with the group.",
      keywords: ["fees", "costs", "share", "fee", "running costs"],
      when: { mode: "per_order" },
    },
    {
      slug: "rimborsi",
      topic: "soldi",
      title: "When refunds arrive",
      intro:
        "After the cycle is settled, on the card you paid with: usually in 5-10 days. If you cancel the order while the cycle is open, the refund starts at once.",
      keywords: ["refund", "money back", "return", "card"],
      when: { mode: "per_order" },
    },
    {
      slug: "da-saldare",
      topic: "soldi",
      title: "What is \"Amount due\"",
      intro:
        "If a cycle's final costs are higher than what you paid, the difference shows on Home as **Amount due**. You pay it with **Pay now**.",
      notes: [
        "While something is due you cannot pay new orders, but you can still edit or cancel the ones you placed.",
      ],
      link: { href: "/ricarica", label: "Open your balances" },
      keywords: ["debt", "pay", "difference", "balance due"],
      when: { mode: "per_order" },
    },
    {
      slug: "credito",
      topic: "soldi",
      title: "I see a credit: what should I do?",
      intro: "Nothing: it is money the group owes you, and the treasurer gives it back.",
      keywords: ["credit", "surplus", "money", "money back"],
      when: { mode: "per_order" },
    },
    {
      slug: "movimenti",
      topic: "soldi",
      title: "Where I see all movements",
      steps: [
        "Open **History** and choose **Movements**.",
        "You find top-ups, charges, refunds and corrections, newest first.",
        "Tap a movement to see its date, cycle and details.",
      ],
      link: { href: "/storico", label: "Open History" },
      keywords: ["history", "statement", "charges", "top-ups", "list"],
    },

    // Family
    {
      slug: "cos-e-famiglia",
      topic: "famiglia",
      title: "What a family is",
      intro:
        "People who shop together can share one cart, one balance and the order history. Everyone keeps signing in with their own email and gets their own notifications.",
      notes: ["A family can have at most 6 people."],
      link: { href: "/famiglia", label: "Open Family" },
      keywords: ["share", "together", "husband", "wife", "partner", "flatmate", "household"],
      when: { families: true },
    },
    {
      slug: "invitare-famiglia",
      topic: "famiglia",
      title: "Inviting someone into your family",
      steps: [
        "Open your **Profile** (the circle with your initials at the top) and tap **Family**.",
        "In **Invite someone** type the email the other person signs in with and tap **Send invitation**.",
        "They get a notification and an email, and have 7 days to accept.",
      ],
      notes: ["The person you invite must have signed in to the app at least once."],
      link: { href: "/famiglia", label: "Open Family" },
      keywords: ["invitation", "add", "share"],
      when: { families: true },
    },
    {
      slug: "accettare-famiglia",
      topic: "famiglia",
      title: "Accepting an invitation",
      steps: [
        "Open your **Profile** (the circle with your initials at the top) and tap **Family**.",
        "In **Invitations received** tap **Accept**.",
        "From then on cart, balance and history are shared. Your balance moves to the family.",
      ],
      notes: ["If you and the family both have an order on the same open cycle, cancel one before accepting."],
      link: { href: "/famiglia", label: "Open Family" },
      keywords: ["invitation", "join", "enter"],
      when: { families: true },
    },
    {
      slug: "uscire-famiglia",
      topic: "famiglia",
      title: "Leaving the family",
      intro:
        "In your **Profile** open **Family** and tap **Leave the family**. You go back to your own account with a zero balance: balance, orders and history stay with the family.",
      notes: ["Whoever created the family can take a person out with **Remove**."],
      link: { href: "/famiglia", label: "Open Family" },
      keywords: ["leave", "remove", "split", "take out"],
      when: { families: true },
    },

    // Notifications
    {
      slug: "leggere-notifiche",
      topic: "notifiche",
      title: "Reading notifications",
      intro:
        "The red dot on the bell at the top says how many notifications you have not read yet. Tap it to see them; **Mark all read ✓** marks them as read.",
      notes: [
        "We tell you for example when an order opens, when it is charged, when a top-up arrives and when your order is corrected.",
      ],
      link: { href: "/notifiche", label: "Open Notifications" },
      keywords: ["bell", "alerts", "dot", "messages"],
    },
    {
      slug: "preferenze-notifiche",
      topic: "notifiche",
      title: "Getting notifications by email too",
      steps: [
        "Open your **Profile** (the circle with your initials at the top) and tap **Notification preferences**.",
        "You also get there from the bell, with the gear at the top right.",
        "For each group of notifications choose whether to get them in the app, by email or both.",
      ],
      notes: ["At first notifications arrive in the app only."],
      link: { href: "/profilo/notifiche", label: "Open Notification preferences" },
      keywords: ["email", "mail", "alerts", "turn off", "preferences", "settings"],
    },

    // Sign-in and profile
    {
      slug: "link-non-funziona",
      topic: "account",
      title: "The link or the code does not work",
      steps: [
        "The link and the code last 15 minutes and work once: if more time has passed, ask for a new one.",
        "Only the latest code works: use the one in the most recent email.",
        "If you installed the app on your phone, use the code instead of the link.",
      ],
      notes: [
        "If the app says your email is not a member's, try the address you joined the group with. If that does not help, write to the contacts at the bottom of this page.",
      ],
      keywords: ["sign in", "login", "expired", "error", "cannot sign in", "denied"],
    },
    {
      slug: "cambiare-email",
      topic: "account",
      title: "I changed email or have two accounts",
      intro:
        "Write to the people who run the group: they can change your address, or merge the two accounts with balance and orders.",
      notes: ["The emails you can sign in with are in your **Profile**. Meanwhile sign in with the address that works."],
      link: { href: "/profilo", label: "Open Profile" },
      keywords: ["address", "duplicate", "merge", "new email", "account"],
    },
    {
      slug: "quale-email",
      topic: "account",
      title: "Which email am I signed in with?",
      intro:
        "Tap the circle with your initials at the top: the **Profile** shows your name, the email you signed in with and the others you can use.",
      link: { href: "/profilo", label: "Open Profile" },
      keywords: ["address", "account", "who am i", "profile"],
    },
    {
      slug: "cambiare-nome",
      topic: "account",
      title: "Changing your name",
      steps: [
        "Open your **Profile** (the circle with your initials at the top).",
        "Next to **Name** tap **Edit**, type the name and save.",
      ],
      notes: ["It is the name the people who run the group see."],
      link: { href: "/profilo", label: "Open Profile" },
      keywords: ["name", "surname", "profile", "change"],
    },
    {
      slug: "uscire",
      topic: "account",
      title: "Signing out",
      intro: "Open your **Profile**, tap **Sign out** at the bottom of the page and confirm. To come back you need a new link or code.",
      link: { href: "/profilo", label: "Open Profile" },
      keywords: ["logout", "log out", "sign out", "exit"],
    },
  ],
  synonyms: [
    ["top up", "topup", "recharge", "transfer", "deposit"],
    ["balance", "credit", "account", "money", "wallet"],
    ["card", "debit", "online payment", "pay"],
    ["order", "shopping", "cart", "buy"],
    ["cancel", "delete", "remove"],
    ["edit", "change", "modify", "fix"],
    ["family", "household", "husband", "wife", "partner", "flatmate"],
    ["notification", "notifications", "alert", "alerts", "bell"],
    ["sign in", "login", "log in", "access", "password", "code"],
    ["install", "phone", "mobile", "iphone", "android", "home screen"],
    ["refund", "refunds", "money back"],
    ["pickup", "collect", "delivery"],
    ["weight", "weighed", "quantity", "grams"],
    ["sign out", "logout", "log out"],
  ],
  stopwords: [
    "how", "what", "the", "a", "an", "of", "to", "in", "on", "for", "with", "and", "or", "is", "are",
    "do", "does", "can", "i", "my", "me", "it", "where", "when", "why", "should", "be", "from",
  ],
};
