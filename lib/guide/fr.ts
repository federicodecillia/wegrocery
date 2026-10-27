// French member guide: the same cards as it.ts (slugs, topics, conditions
// and number of steps; lib/guide/guide.test.ts checks it).

import type { GuideContent } from "./types";

export const guideFr: GuideContent = {
  topics: [
    { id: "primi-passi", emoji: "👋", title: "Premiers pas", summary: "Se connecter, installer l'app sur le téléphone, s'y retrouver." },
    { id: "ordinare", emoji: "🧺", title: "Commander", summary: "Passer, modifier et annuler une commande, ce qui se passe à la clôture." },
    { id: "soldi", emoji: "💶", title: "Solde et paiements", summary: "Comment vous payez, recharges, remboursements et mouvements." },
    { id: "famiglia", emoji: "🏠", title: "Famille", summary: "Faire les courses ensemble avec un seul panier et un seul solde." },
    { id: "notifiche", emoji: "🔔", title: "Notifications", summary: "Les alertes de l'app et comment les recevoir aussi par email." },
    { id: "account", emoji: "👤", title: "Connexion et profil", summary: "Problèmes de connexion, nom et email, se déconnecter." },
  ],
  articles: [
    // Premiers pas
    {
      slug: "come-entrare",
      topic: "primi-passi",
      title: "Comment me connecter",
      steps: [
        "Sur la page de connexion, saisissez votre email et touchez **Envoyez-moi le lien**.",
        "Ouvrez l'email reçu : touchez le lien, puis **Se connecter**.",
        "Ou saisissez sur la page de connexion le code à 6 chiffres du même email.",
      ],
      notes: [
        "Le lien et le code durent 15 minutes et ne servent qu'une fois. Si l'email n'arrive pas, regardez dans les spams.",
        "Une fois connecté, vous le restez sur ce téléphone ou cet ordinateur jusqu'à ce que vous vous déconnectiez.",
      ],
      keywords: ["login", "connexion", "mot de passe", "code", "lien", "inscription"],
    },
    {
      slug: "installare-app",
      topic: "primi-passi",
      title: "Installer l'app sur votre téléphone",
      intro: "Vous pouvez ajouter l'app à l'écran d'accueil : elle s'ouvre comme n'importe quelle app, sans la barre du navigateur.",
      steps: [
        "Sur iPhone, ouvrez l'app dans Safari, touchez Partager (le carré avec la flèche) puis **Sur l'écran d'accueil**.",
        "Sur Android, ouvrez l'app dans Chrome et touchez **Installer**, ou choisissez **Ajouter à l'écran d'accueil** dans le menu ⋮.",
        "La première fois que vous vous connectez depuis l'app installée, utilisez le code à 6 chiffres qui arrive par email avec le lien.",
      ],
      notes: ["Depuis le téléphone, vous retrouvez aussi ces étapes dans votre **Profil**, sous **Installer l'app sur votre téléphone**."],
      keywords: ["téléphone", "mobile", "iphone", "android", "icône", "écran d'accueil", "télécharger"],
    },
    {
      slug: "com-e-fatta",
      topic: "primi-passi",
      title: "Comment l'app est organisée",
      steps: [
        "**Accueil** : votre solde, la commande ouverte avec le temps restant et vos derniers mouvements.",
        "**Commande** : le catalogue du cycle ouvert, où vous choisissez les produits et confirmez.",
        "**Historique** : vos commandes passées et chaque mouvement du solde.",
        "**Guide** : cette page, avec les nouveautés de l'app et les contacts.",
      ],
      notes: [
        "En haut, vous trouvez la cloche des notifications et le cercle avec vos initiales : il ouvre votre **Profil**, avec vos réglages. Seules les personnes qui gèrent le groupe voient **Admin**.",
      ],
      keywords: ["menu", "écrans", "onglets", "navigation"],
    },

    // Commander
    {
      slug: "fare-ordine",
      topic: "ordinare",
      title: "Passer une commande",
      steps: [
        "Sur l'Accueil, vérifiez qu'une commande est ouverte et jusqu'à quand.",
        "Touchez **Commande** et choisissez les produits avec les boutons + et −. En bas, vous voyez le total et votre solde après la commande.",
        "Touchez **Confirmer la commande**. Vous pouvez encore la modifier tant que le cycle est ouvert.",
      ],
      link: { href: "/ordine", label: "Ouvrir Commande" },
      keywords: ["commande", "acheter", "courses", "panier", "produits"],
      when: { mode: "wallet" },
    },
    {
      slug: "fare-ordine-carta",
      topic: "ordinare",
      title: "Passer une commande",
      steps: [
        "Sur l'Accueil, vérifiez qu'une commande est ouverte et jusqu'à quand.",
        "Touchez **Commande** et choisissez les produits avec les boutons + et −. Sous le total, vous voyez produits, livraison et frais de préparation de la commande.",
        "Touchez **Confirmer et payer** et payez par carte. La commande est confirmée dès que le paiement aboutit.",
      ],
      link: { href: "/ordine", label: "Ouvrir Commande" },
      keywords: ["commande", "acheter", "courses", "panier", "produits", "payer"],
      when: { mode: "per_order" },
    },
    {
      slug: "riproponi-ordine",
      topic: "ordinare",
      title: "Reprendre la commande de la dernière fois",
      steps: [
        "Dans **Commande**, touchez **Reprendre la dernière commande**.",
        "Les produits de votre dernière commande encore disponibles reviennent dans le panier.",
        "Modifiez ce que vous voulez et confirmez.",
      ],
      link: { href: "/ordine", label: "Ouvrir Commande" },
      keywords: ["reprendre", "même", "même commande", "recommander"],
    },
    {
      slug: "modificare-ordine",
      topic: "ordinare",
      title: "Modifier ou annuler votre commande",
      intro: "Vous pouvez le faire tant que le cycle est ouvert.",
      steps: [
        "Ouvrez **Commande** : vous voyez votre commande confirmée.",
        "Touchez **Modifier la commande**, changez les quantités et confirmez de nouveau.",
        "Pour la supprimer entièrement, touchez **Annuler la commande** : rien n'est prélevé à la clôture.",
      ],
      link: { href: "/ordine", label: "Ouvrir Commande" },
      keywords: ["changer", "annuler", "supprimer", "retirer", "corriger"],
      when: { mode: "wallet" },
    },
    {
      slug: "modificare-ordine-carta",
      topic: "ordinare",
      title: "Modifier ou annuler votre commande",
      intro: "Vous pouvez le faire tant que le cycle est ouvert.",
      steps: [
        "Ouvrez **Commande** et changez les quantités.",
        "Si le total augmente, vous ne payez que la différence ; s'il baisse, la différence revient sur votre carte quand le cycle est soldé.",
        "Pour la supprimer entièrement, touchez **Annuler la commande** : le remboursement part tout de suite et arrive en général sur votre carte en 5 à 10 jours.",
      ],
      link: { href: "/ordine", label: "Ouvrir Commande" },
      keywords: ["changer", "annuler", "supprimer", "retirer", "corriger", "remboursement"],
      when: { mode: "per_order" },
    },
    {
      slug: "modifiche-salvate",
      topic: "ordinare",
      title: "J'ai laissé ma commande à moitié",
      intro: "Ce que vous mettez dans le panier est enregistré au fur et à mesure : quand vous revenez, tout est encore là.",
      steps: [
        "Ouvrez **Commande** : en haut, vous voyez **Modifications pas encore confirmées**.",
        "Confirmez la commande pour les envoyer, ou touchez **Abandonner les modifications** pour revenir à votre commande confirmée.",
      ],
      notes: [
        "Tant que vous ne confirmez pas, les modifications ne font pas partie de votre commande. Si le cycle se clôture avant, elles sont perdues.",
      ],
      link: { href: "/ordine", label: "Ouvrir Commande" },
      keywords: ["brouillon", "enregistré", "perdu", "panier", "non confirmé"],
    },
    {
      slug: "quando-ordinare",
      topic: "ordinare",
      title: "Jusqu'à quand puis-je commander",
      intro:
        "L'Accueil indique quand la commande se clôture et combien de temps il reste. Après la clôture, la commande ne peut plus être modifiée : le groupe l'envoie aux fournisseurs.",
      notes: [
        "Quand plusieurs commandes sont ouvertes en même temps, dans **Commande** vous choisissez d'abord laquelle ouvrir.",
        "Les jours de retrait sont indiqués sur l'Accueil, sous la commande.",
      ],
      keywords: ["date limite", "clôture", "heure", "retrait", "livraison", "date"],
    },
    {
      slug: "dopo-chiusura",
      topic: "ordinare",
      title: "Ce qui se passe à la clôture de la commande",
      steps: [
        "Le coût de votre commande est prélevé sur votre solde : les produits, votre part de livraison s'il y en a une et, quand le cycle en prévoit, les frais de préparation de la commande.",
        "Vous recevez une notification avec le montant prélevé.",
        "Les jours de retrait indiqués sur l'Accueil, vous récupérez vos courses.",
      ],
      keywords: ["prélèvement", "clôture", "livraison", "retrait"],
      when: { mode: "wallet" },
    },
    {
      slug: "dopo-chiusura-carta",
      topic: "ordinare",
      title: "Ce qui se passe à la clôture de la commande",
      steps: [
        "Le groupe envoie la commande aux fournisseurs. Les jours de retrait indiqués sur l'Accueil, vous récupérez vos courses.",
        "Après le retrait, avec les coûts définitifs, le cycle est soldé : ce que vous avez payé en trop revient sur votre carte.",
        "Si les coûts ont été plus élevés que ce que vous avez payé, l'Accueil affiche **Montant dû**.",
      ],
      keywords: ["clôture", "soldé", "livraison", "retrait", "remboursement"],
      when: { mode: "per_order" },
    },
    {
      slug: "correzioni",
      topic: "ordinare",
      title: "J'ai reçu une autre quantité",
      intro:
        "Cela arrive avec les produits au poids : vous avez commandé 1 kg et 800 g arrivent. Les personnes qui gèrent le groupe saisissent la quantité réelle et la différence est régularisée.",
      notes: ["Vous le voyez dans **Historique** comme ajustement ou correction, et vous recevez une notification."],
      link: { href: "/storico", label: "Ouvrir Historique" },
      keywords: ["poids", "pesé", "grammes", "kg", "prix différent", "ajustement", "différence"],
    },

    // Solde et paiements
    {
      slug: "come-funziona-saldo",
      topic: "soldi",
      title: "Comment fonctionne le solde",
      intro:
        "Le solde est votre crédit auprès du groupe. Vous le rechargez à l'avance et, à la clôture de chaque commande, son coût y est prélevé.",
      notes: ["L'Accueil affiche le solde du jour et ce qui restera après la commande ouverte."],
      keywords: ["crédit", "compte", "argent", "porte-monnaie"],
      when: { mode: "wallet" },
    },
    {
      slug: "ricarica-bonifico",
      topic: "soldi",
      title: "Recharger par virement",
      steps: [
        "Sur l'Accueil, touchez **Recharger le solde**.",
        "Dans **Virement bancaire**, copiez le titulaire, l'IBAN et le libellé : pour payer une commande, utilisez le libellé de cette commande, déjà rempli.",
        "Faites le virement depuis votre banque.",
      ],
      notes: [
        "Le libellé de chaque commande se trouve aussi dans **Historique**, en ouvrant la commande. Si le groupe le demande, l'adresse pour le justificatif de virement y est aussi.",
        "Votre solde est mis à jour quand la trésorerie enregistre le virement : vous recevez une notification.",
      ],
      link: { href: "/ricarica", label: "Ouvrir Recharger" },
      keywords: ["virement", "iban", "banque", "argent", "crédit"],
      when: { mode: "wallet", bankTransfer: true },
    },
    {
      slug: "ricarica-online",
      topic: "soldi",
      title: "Recharger en ligne par carte",
      steps: [
        "Sur l'Accueil, touchez **Recharger le solde**.",
        "Dans **Payer en ligne**, choisissez un montant ou saisissez-le.",
        "Touchez **Payer** et terminez le paiement. Votre solde est mis à jour dès que le paiement est confirmé.",
      ],
      notes: ["Le minimum est de 0,50 €. Si le groupe a fixé un solde maximum, les recharges en ligne s'arrêtent là."],
      link: { href: "/ricarica", label: "Ouvrir Recharger" },
      keywords: ["carte", "carte bancaire", "carte de crédit", "payer", "en ligne", "argent"],
      when: { mode: "wallet", onlineTopup: true },
    },
    {
      slug: "ricarica-cassa",
      topic: "soldi",
      title: "Recharger votre solde",
      intro: "Demandez à la trésorerie comment payer : dès qu'elle l'enregistre, votre solde est mis à jour et vous recevez une notification.",
      keywords: ["paiement", "virement", "espèces", "argent", "crédit"],
      when: { mode: "wallet", topups: true, bankTransfer: false, onlineTopup: false },
    },
    {
      slug: "saldo-negativo",
      topic: "soldi",
      title: "Puis-je commander avec un solde bas ou négatif ?",
      intro:
        "Oui, pour que vous puissiez quand même faire vos courses : l'app vous prévient quand vous passez en négatif. Si le groupe a fixé une limite, au-delà la commande n'est pas enregistrée tant que vous ne rechargez pas.",
      notes: [
        "La limite compte aussi les commandes déjà confirmées et pas encore prélevées. Rechargez dès que possible : c'est avec cet argent que le groupe paie les fournisseurs.",
      ],
      link: { href: "/ricarica", label: "Ouvrir Recharger" },
      keywords: ["négatif", "dette", "insuffisant", "découvert", "limite"],
      when: { mode: "wallet", topups: true },
    },
    {
      slug: "spese-preparazione",
      topic: "soldi",
      title: "Que sont les frais de préparation de la commande",
      intro:
        "Quand le cycle en prévoit, c'est une petite part pour les frais bancaires et le fonctionnement du groupe : un pourcentage des produits ou un montant fixe. Vous les voyez dans le récapitulatif de la commande et ils sont prélevés à la clôture avec la commande.",
      keywords: ["frais", "coûts", "part", "commission", "frais de gestion"],
      when: { mode: "wallet" },
    },
    {
      slug: "come-si-paga",
      topic: "soldi",
      title: "Comment la commande est payée",
      intro:
        "Par carte, au moment de confirmer la commande. Vous payez produits, livraison et frais de préparation de la commande. Si vous modifiez ensuite la commande et que le total augmente, vous ne payez que la différence.",
      link: { href: "/ordine", label: "Ouvrir Commande" },
      keywords: ["carte", "payer", "carte bancaire", "en ligne"],
      when: { mode: "per_order" },
    },
    {
      slug: "spese-preparazione-carta",
      topic: "soldi",
      title: "Que sont les frais de préparation de la commande",
      intro:
        "Une part pour les frais bancaires et le fonctionnement du groupe, fixée pour chaque cycle : un pourcentage des produits ou un montant fixe. Vous les voyez avant de confirmer et ils restent au groupe.",
      keywords: ["frais", "coûts", "part", "commission", "frais de gestion"],
      when: { mode: "per_order" },
    },
    {
      slug: "rimborsi",
      topic: "soldi",
      title: "Quand arrivent les remboursements",
      intro:
        "Une fois le cycle soldé, sur la carte avec laquelle vous avez payé : en général en 5 à 10 jours. Si vous annulez la commande pendant que le cycle est ouvert, le remboursement part tout de suite.",
      keywords: ["remboursement", "rembourser", "retour", "carte"],
      when: { mode: "per_order" },
    },
    {
      slug: "da-saldare",
      topic: "soldi",
      title: "Que signifie « Montant dû »",
      intro:
        "Si les coûts définitifs d'un cycle dépassent ce que vous avez payé, la différence apparaît sur l'Accueil comme **Montant dû**. Vous la réglez avec **Payer maintenant**.",
      notes: [
        "Tant qu'un montant est dû, vous ne pouvez pas payer de nouvelles commandes, mais vous pouvez encore modifier ou annuler celles déjà passées.",
      ],
      link: { href: "/ricarica", label: "Ouvrir vos soldes" },
      keywords: ["dette", "payer", "différence", "reste à payer"],
      when: { mode: "per_order" },
    },
    {
      slug: "credito",
      topic: "soldi",
      title: "Je vois un crédit : que dois-je faire ?",
      intro: "Rien : c'est de l'argent que le groupe vous doit, et la trésorerie vous le rend.",
      keywords: ["crédit", "en faveur", "argent", "remboursement"],
      when: { mode: "per_order" },
    },
    {
      slug: "movimenti",
      topic: "soldi",
      title: "Où voir tous les mouvements",
      steps: [
        "Ouvrez **Historique** et choisissez **Mouvements**.",
        "Vous y trouvez recharges, prélèvements, remboursements et corrections, du plus récent au plus ancien.",
        "Touchez un mouvement pour voir sa date, son cycle et ses détails.",
      ],
      link: { href: "/storico", label: "Ouvrir Historique" },
      keywords: ["historique", "relevé", "prélèvements", "recharges", "liste"],
    },

    // Famille
    {
      slug: "cos-e-famiglia",
      topic: "famiglia",
      title: "Qu'est-ce qu'une famille",
      intro:
        "Les personnes qui font leurs courses ensemble peuvent partager un panier, un solde et l'historique des commandes. Chacun continue de se connecter avec son propre email et reçoit ses propres notifications.",
      notes: ["Une famille peut compter au maximum 6 personnes."],
      link: { href: "/famiglia", label: "Ouvrir Famille" },
      keywords: ["partager", "ensemble", "mari", "femme", "conjoint", "colocataire", "foyer"],
      when: { families: true },
    },
    {
      slug: "invitare-famiglia",
      topic: "famiglia",
      title: "Inviter quelqu'un dans votre famille",
      steps: [
        "Ouvrez votre **Profil** (le cercle avec vos initiales, en haut) et touchez **Famille**.",
        "Dans **Inviter quelqu'un**, saisissez l'email avec lequel l'autre personne se connecte et touchez **Envoyer l'invitation**.",
        "Elle reçoit une notification et un email, et a 7 jours pour accepter.",
      ],
      notes: ["La personne invitée doit s'être connectée à l'app au moins une fois."],
      link: { href: "/famiglia", label: "Ouvrir Famille" },
      keywords: ["invitation", "ajouter", "partager"],
      when: { families: true },
    },
    {
      slug: "accettare-famiglia",
      topic: "famiglia",
      title: "Accepter une invitation",
      steps: [
        "Ouvrez votre **Profil** (le cercle avec vos initiales, en haut) et touchez **Famille**.",
        "Dans **Invitations reçues**, touchez **Accepter**.",
        "À partir de là, panier, solde et historique sont partagés. Votre solde passe à la famille.",
      ],
      notes: ["Si vous et la famille avez chacun une commande sur le même cycle ouvert, annulez-en une avant d'accepter."],
      link: { href: "/famiglia", label: "Ouvrir Famille" },
      keywords: ["invitation", "rejoindre", "entrer"],
      when: { families: true },
    },
    {
      slug: "uscire-famiglia",
      topic: "famiglia",
      title: "Quitter la famille",
      intro:
        "Dans votre **Profil**, ouvrez **Famille** et touchez **Quitter la famille**. Vous revenez à votre propre compte avec un solde à zéro : solde, commandes et historique restent à la famille.",
      notes: ["La personne qui a créé la famille peut en faire sortir quelqu'un avec **Retirer**."],
      link: { href: "/famiglia", label: "Ouvrir Famille" },
      keywords: ["quitter", "retirer", "séparer", "sortir"],
      when: { families: true },
    },

    // Notifications
    {
      slug: "leggere-notifiche",
      topic: "notifiche",
      title: "Lire les notifications",
      intro:
        "Le point rouge sur la cloche en haut indique combien de notifications vous n'avez pas encore lues. Touchez-la pour les voir ; **Tout marquer comme lu** les marque comme lues.",
      notes: [
        "Nous vous prévenons par exemple quand une commande s'ouvre, quand elle est prélevée, quand une recharge arrive et quand votre commande est corrigée.",
      ],
      link: { href: "/notifiche", label: "Ouvrir Notifications" },
      keywords: ["cloche", "alertes", "point", "messages"],
    },
    {
      slug: "preferenze-notifiche",
      topic: "notifiche",
      title: "Recevoir aussi les notifications par email",
      steps: [
        "Ouvrez votre **Profil** (le cercle avec vos initiales, en haut) et touchez **Préférences de notification**.",
        "Vous y arrivez aussi depuis la cloche, avec la roue dentée en haut à droite.",
        "Pour chaque groupe de notifications, choisissez de les recevoir dans l'app, par email ou les deux.",
      ],
      notes: ["Au début, les notifications n'arrivent que dans l'app."],
      link: { href: "/profilo/notifiche", label: "Ouvrir Préférences de notification" },
      keywords: ["email", "mail", "alertes", "désactiver", "préférences", "réglages"],
    },

    // Connexion et profil
    {
      slug: "link-non-funziona",
      topic: "account",
      title: "Le lien ou le code ne fonctionne pas",
      steps: [
        "Le lien et le code durent 15 minutes et ne servent qu'une fois : si plus de temps s'est écoulé, demandez-en un nouveau.",
        "Seul le dernier code fonctionne : utilisez celui de l'email le plus récent.",
        "Si vous avez installé l'app sur votre téléphone, utilisez le code plutôt que le lien.",
      ],
      notes: [
        "Si l'app indique que votre email n'est pas celui d'un membre, essayez l'adresse avec laquelle vous avez rejoint le groupe. Si cela ne suffit pas, écrivez aux contacts en bas de cette page.",
      ],
      keywords: ["connexion", "login", "expiré", "erreur", "impossible de se connecter", "refusé"],
    },
    {
      slug: "cambiare-email",
      topic: "account",
      title: "J'ai changé d'email ou j'ai deux comptes",
      intro:
        "Écrivez aux personnes qui gèrent le groupe : elles peuvent changer votre adresse, ou fusionner les deux comptes avec solde et commandes.",
      notes: ["Les emails avec lesquels vous pouvez vous connecter sont dans votre **Profil**. En attendant, connectez-vous avec l'adresse qui fonctionne."],
      link: { href: "/profilo", label: "Ouvrir Profil" },
      keywords: ["adresse", "doublon", "fusionner", "nouvel email", "compte"],
    },
    {
      slug: "quale-email",
      topic: "account",
      title: "Avec quel email suis-je connecté ?",
      intro:
        "Touchez le cercle avec vos initiales, en haut : le **Profil** affiche votre nom, l'email avec lequel vous êtes connecté et les autres que vous pouvez utiliser.",
      link: { href: "/profilo", label: "Ouvrir Profil" },
      keywords: ["adresse", "compte", "qui suis-je", "profil"],
    },
    {
      slug: "cambiare-nome",
      topic: "account",
      title: "Changer votre nom",
      steps: [
        "Ouvrez votre **Profil** (le cercle avec vos initiales, en haut).",
        "À côté de **Nom**, touchez **Modifier**, saisissez le nom et enregistrez.",
      ],
      notes: ["C'est le nom que voient les personnes qui gèrent le groupe."],
      link: { href: "/profilo", label: "Ouvrir Profil" },
      keywords: ["nom", "prénom", "profil", "changer"],
    },
    {
      slug: "uscire",
      topic: "account",
      title: "Se déconnecter",
      intro: "Ouvrez votre **Profil**, touchez **Se déconnecter** en bas de la page et confirmez. Pour revenir, il vous faut un nouveau lien ou un nouveau code.",
      link: { href: "/profilo", label: "Ouvrir Profil" },
      keywords: ["logout", "déconnexion", "se déconnecter", "sortir"],
    },
  ],
  synonyms: [
    ["recharger", "recharge", "approvisionner", "virement", "dépôt"],
    ["solde", "crédit", "compte", "argent", "porte-monnaie"],
    ["carte", "carte bancaire", "paiement en ligne", "payer"],
    ["commande", "courses", "panier", "acheter"],
    ["annuler", "supprimer", "retirer", "effacer"],
    ["modifier", "changer", "corriger"],
    ["famille", "foyer", "mari", "femme", "conjoint", "colocataire"],
    ["notification", "notifications", "alerte", "alertes", "cloche"],
    ["connexion", "login", "se connecter", "accès", "mot de passe", "code"],
    ["installer", "téléphone", "mobile", "iphone", "android", "écran d'accueil"],
    ["remboursement", "remboursements", "rembourser"],
    ["retrait", "récupérer", "livraison"],
    ["poids", "pesé", "quantité", "grammes"],
    ["déconnexion", "logout", "se déconnecter"],
  ],
  stopwords: [
    "comment", "que", "quoi", "le", "la", "les", "un", "une", "de", "du", "des", "a", "au", "aux", "en",
    "dans", "sur", "pour", "avec", "et", "ou", "est", "sont", "je", "j", "puis", "peux", "mon", "ma", "mes",
    "me", "il", "elle", "où", "quand", "pourquoi", "dois", "suis", "l", "d", "qu", "ce",
  ],
};
