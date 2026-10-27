// Spanish member guide: the same cards as it.ts (slugs, topics, conditions
// and number of steps; lib/guide/guide.test.ts checks it).

import type { GuideContent } from "./types";

export const guideEs: GuideContent = {
  topics: [
    { id: "primi-passi", emoji: "👋", title: "Primeros pasos", summary: "Entrar, instalar la app en el móvil, orientarte." },
    { id: "ordinare", emoji: "🧺", title: "Pedir", summary: "Hacer, cambiar y cancelar un pedido, qué pasa al cierre." },
    { id: "soldi", emoji: "💶", title: "Saldo y pagos", summary: "Cómo pagas, recargas, reembolsos y movimientos." },
    { id: "famiglia", emoji: "🏠", title: "Familia", summary: "Hacer la compra juntos con un solo carrito y un solo saldo." },
    { id: "notifiche", emoji: "🔔", title: "Avisos", summary: "Los avisos de la app y cómo recibirlos también por email." },
    { id: "account", emoji: "👤", title: "Acceso y perfil", summary: "Problemas para entrar, nombre y email, cerrar sesión." },
  ],
  articles: [
    // Primeros pasos
    {
      slug: "come-entrare",
      topic: "primi-passi",
      title: "Cómo entro",
      steps: [
        "En la página de acceso escribe tu email y toca **Envíame el enlace**.",
        "Abre el email que recibes: toca el enlace y luego **Entrar**.",
        "O escribe en la página de acceso el código de 6 cifras del mismo email.",
      ],
      notes: [
        "El enlace y el código duran 15 minutos y sirven una sola vez. Si el email no llega, mira en la carpeta de spam.",
        "Una vez dentro, sigues con la sesión abierta en ese móvil u ordenador hasta que la cierres.",
      ],
      keywords: ["login", "acceder", "contraseña", "código", "enlace", "registrarse"],
    },
    {
      slug: "installare-app",
      topic: "primi-passi",
      title: "Instalar la app en el móvil",
      intro: "Puedes añadir la app a la pantalla de inicio: se abre como cualquier otra app, sin la barra del navegador.",
      steps: [
        "En iPhone abre la app en Safari, toca Compartir (el cuadrado con la flecha) y luego **Añadir a pantalla de inicio**.",
        "En Android abre la app en Chrome y toca **Instalar**, o elige **Añadir a pantalla de inicio** en el menú ⋮.",
        "La primera vez que entres desde la app instalada, usa el código de 6 cifras que llega por email junto al enlace.",
      ],
      notes: ["Desde el móvil también encuentras estos pasos en tu **Perfil**, en **Instala la app en tu móvil**."],
      keywords: ["móvil", "teléfono", "iphone", "android", "icono", "pantalla de inicio", "descargar"],
    },
    {
      slug: "com-e-fatta",
      topic: "primi-passi",
      title: "Cómo está organizada la app",
      steps: [
        "**Inicio**: tu saldo, el pedido abierto con el tiempo que queda y tus últimos movimientos.",
        "**Pedido**: el catálogo del ciclo abierto, donde eliges los productos y confirmas.",
        "**Historial**: tus pedidos pasados y cada movimiento del saldo.",
        "**Guía**: esta página, con las novedades de la app y los contactos.",
      ],
      notes: [
        "Arriba encuentras la campana de los avisos y el círculo con tus iniciales: abre tu **Perfil**, con tus ajustes. Solo quien gestiona el grupo ve **Admin**.",
      ],
      keywords: ["menú", "pantallas", "pestañas", "navegación"],
    },

    // Pedir
    {
      slug: "fare-ordine",
      topic: "ordinare",
      title: "Hacer un pedido",
      steps: [
        "En Inicio comprueba que hay un pedido abierto y hasta cuándo.",
        "Toca **Pedido** y elige los productos con los botones + y −. Abajo ves el total y tu saldo después del pedido.",
        "Toca **Confirmar pedido**. Puedes cambiarlo mientras el ciclo siga abierto.",
      ],
      link: { href: "/ordine", label: "Abrir Pedido" },
      keywords: ["pedido", "comprar", "compra", "carrito", "productos"],
      when: { mode: "wallet" },
    },
    {
      slug: "fare-ordine-carta",
      topic: "ordinare",
      title: "Hacer un pedido",
      steps: [
        "En Inicio comprueba que hay un pedido abierto y hasta cuándo.",
        "Toca **Pedido** y elige los productos con los botones + y −. Bajo el total ves productos, envío y cuota de preparación del pedido.",
        "Toca **Confirmar y pagar** y paga con tarjeta. El pedido queda confirmado en cuanto el pago se completa.",
      ],
      link: { href: "/ordine", label: "Abrir Pedido" },
      keywords: ["pedido", "comprar", "compra", "carrito", "productos", "pagar"],
      when: { mode: "per_order" },
    },
    {
      slug: "riproponi-ordine",
      topic: "ordinare",
      title: "Repetir el pedido de la última vez",
      steps: [
        "En **Pedido** toca **Repetir el último pedido**.",
        "Los productos de tu último pedido que siguen disponibles vuelven al carrito.",
        "Cambia lo que quieras y confirma.",
      ],
      link: { href: "/ordine", label: "Abrir Pedido" },
      keywords: ["repetir", "mismo", "mismo pedido", "otra vez"],
    },
    {
      slug: "modificare-ordine",
      topic: "ordinare",
      title: "Cambiar o cancelar tu pedido",
      intro: "Puedes hacerlo mientras el ciclo esté abierto.",
      steps: [
        "Abre **Pedido**: ves tu pedido confirmado.",
        "Toca **Editar pedido**, cambia las cantidades y vuelve a confirmar.",
        "Para quitarlo del todo toca **Cancelar pedido**: al cierre no se cobra nada.",
      ],
      link: { href: "/ordine", label: "Abrir Pedido" },
      keywords: ["cambiar", "cancelar", "borrar", "quitar", "corregir"],
      when: { mode: "wallet" },
    },
    {
      slug: "modificare-ordine-carta",
      topic: "ordinare",
      title: "Cambiar o cancelar tu pedido",
      intro: "Puedes hacerlo mientras el ciclo esté abierto.",
      steps: [
        "Abre **Pedido** y cambia las cantidades.",
        "Si el total sube solo pagas la diferencia; si baja, la diferencia vuelve a tu tarjeta cuando se liquide el ciclo.",
        "Para quitarlo del todo toca **Cancelar pedido**: el reembolso sale enseguida y suele llegar a tu tarjeta en 5-10 días.",
      ],
      link: { href: "/ordine", label: "Abrir Pedido" },
      keywords: ["cambiar", "cancelar", "borrar", "quitar", "corregir", "reembolso"],
      when: { mode: "per_order" },
    },
    {
      slug: "modifiche-salvate",
      topic: "ordinare",
      title: "Dejé el pedido a medias",
      intro: "Lo que pones en el carrito se guarda sobre la marcha: cuando vuelves, sigue ahí.",
      steps: [
        "Abre **Pedido**: arriba ves **Cambios aún sin confirmar**.",
        "Confirma el pedido para enviarlos, o toca **Descartar cambios** para volver a tu pedido confirmado.",
      ],
      notes: [
        "Hasta que confirmas, los cambios no forman parte de tu pedido. Si el ciclo se cierra antes, se pierden.",
      ],
      link: { href: "/ordine", label: "Abrir Pedido" },
      keywords: ["borrador", "guardado", "perdido", "carrito", "sin confirmar"],
    },
    {
      slug: "quando-ordinare",
      topic: "ordinare",
      title: "Hasta cuándo puedo pedir",
      intro:
        "En Inicio ves cuándo se cierra el pedido y cuánto tiempo queda. Tras el cierre el pedido ya no se puede cambiar: el grupo lo envía a los proveedores.",
      notes: [
        "Cuando hay varios pedidos abiertos a la vez, en **Pedido** eliges primero cuál abrir.",
        "Los días de recogida aparecen en Inicio, bajo el pedido.",
      ],
      keywords: ["fecha límite", "cierre", "hora", "recogida", "entrega", "fecha"],
    },
    {
      slug: "dopo-chiusura",
      topic: "ordinare",
      title: "Qué pasa cuando se cierra el pedido",
      steps: [
        "El coste de tu pedido se descuenta de tu saldo: los productos, tu parte del envío si la hay y, cuando el ciclo la tiene, la cuota de preparación del pedido.",
        "Recibes un aviso con el importe cobrado.",
        "Los días de recogida indicados en Inicio recoges tu compra.",
      ],
      keywords: ["cargo", "cierre", "envío", "recogida"],
      when: { mode: "wallet" },
    },
    {
      slug: "dopo-chiusura-carta",
      topic: "ordinare",
      title: "Qué pasa cuando se cierra el pedido",
      steps: [
        "El grupo envía el pedido a los proveedores. Los días de recogida indicados en Inicio recoges tu compra.",
        "Tras la recogida, con los costes definitivos, se liquida el ciclo: lo que pagaste de más vuelve a tu tarjeta.",
        "Si los costes fueron mayores de lo que pagaste, en Inicio aparece **Importe pendiente**.",
      ],
      keywords: ["cierre", "liquidado", "envío", "recogida", "reembolso"],
      when: { mode: "per_order" },
    },
    {
      slug: "correzioni",
      topic: "ordinare",
      title: "He recibido otra cantidad",
      intro:
        "Pasa con los productos a peso: pediste 1 kg y llegan 800 g. Quien gestiona el grupo registra la cantidad real y la diferencia se ajusta.",
      notes: ["Lo ves en **Historial** como ajuste o corrección, y recibes un aviso."],
      link: { href: "/storico", label: "Abrir Historial" },
      keywords: ["peso", "pesado", "gramos", "kg", "precio distinto", "ajuste", "diferencia"],
    },

    // Saldo y pagos
    {
      slug: "come-funziona-saldo",
      topic: "soldi",
      title: "Cómo funciona el saldo",
      intro:
        "El saldo es tu crédito con el grupo. Lo recargas por adelantado y, cuando se cierra cada pedido, su coste se descuenta de ahí.",
      notes: ["En Inicio ves el saldo de hoy y lo que quedará tras el pedido abierto."],
      keywords: ["crédito", "cuenta", "dinero", "monedero"],
      when: { mode: "wallet" },
    },
    {
      slug: "ricarica-bonifico",
      topic: "soldi",
      title: "Recargar por transferencia",
      steps: [
        "En Inicio toca **Recargar saldo**.",
        "En **Transferencia bancaria** copia el titular, el IBAN y el concepto: si pagas un pedido, usa el concepto de ese pedido, ya rellenado.",
        "Haz la transferencia desde tu banco.",
      ],
      notes: [
        "El concepto de cada pedido también está en **Historial**, al abrir el pedido. Si el grupo lo pide, ahí está también la dirección a la que enviar el justificante.",
        "Tu saldo se actualiza cuando tesorería registra la transferencia: recibes un aviso.",
      ],
      link: { href: "/ricarica", label: "Abrir Recarga" },
      keywords: ["transferencia", "iban", "banco", "dinero", "crédito"],
      when: { mode: "wallet", bankTransfer: true },
    },
    {
      slug: "ricarica-online",
      topic: "soldi",
      title: "Recargar online con tarjeta",
      steps: [
        "En Inicio toca **Recargar saldo**.",
        "En **Pagar online** elige un importe o escríbelo.",
        "Toca **Pagar** y completa el pago. Tu saldo se actualiza en cuanto se confirma el pago.",
      ],
      notes: ["El mínimo es 0,50 €. Si el grupo ha fijado un saldo máximo, las recargas online se detienen ahí."],
      link: { href: "/ricarica", label: "Abrir Recarga" },
      keywords: ["tarjeta", "tarjeta de crédito", "débito", "pagar", "online", "dinero"],
      when: { mode: "wallet", onlineTopup: true },
    },
    {
      slug: "ricarica-cassa",
      topic: "soldi",
      title: "Recargar el saldo",
      intro: "Pregunta a tesorería cómo pagar: en cuanto lo registra, tu saldo se actualiza y recibes un aviso.",
      keywords: ["pago", "transferencia", "efectivo", "dinero", "crédito"],
      when: { mode: "wallet", topups: true, bankTransfer: false, onlineTopup: false },
    },
    {
      slug: "saldo-negativo",
      topic: "soldi",
      title: "¿Puedo pedir con el saldo bajo o negativo?",
      intro:
        "Sí, para que puedas hacer la compra igualmente: la app te avisa cuando quedas en negativo. Si el grupo ha fijado un límite, por encima de él el pedido no se guarda hasta que recargues.",
      notes: [
        "El límite cuenta también los pedidos ya confirmados y aún no cobrados. Recarga en cuanto puedas: con ese dinero el grupo paga a los proveedores.",
      ],
      link: { href: "/ricarica", label: "Abrir Recarga" },
      keywords: ["negativo", "deuda", "insuficiente", "descubierto", "límite"],
      when: { mode: "wallet", topups: true },
    },
    {
      slug: "spese-preparazione",
      topic: "soldi",
      title: "Qué es la cuota de preparación del pedido",
      intro:
        "Cuando el ciclo la tiene, es una pequeña parte para las comisiones bancarias y los gastos del grupo: un porcentaje de los productos o un importe fijo. La ves en el resumen del pedido y se cobra al cierre junto al pedido.",
      keywords: ["cuota", "gastos", "parte", "comisión", "gastos de gestión"],
      when: { mode: "wallet" },
    },
    {
      slug: "come-si-paga",
      topic: "soldi",
      title: "Cómo se paga el pedido",
      intro:
        "Con tarjeta, al confirmar el pedido. Pagas productos, envío y cuota de preparación del pedido. Si luego cambias el pedido y el total sube, solo pagas la diferencia.",
      link: { href: "/ordine", label: "Abrir Pedido" },
      keywords: ["tarjeta", "pagar", "débito", "online"],
      when: { mode: "per_order" },
    },
    {
      slug: "spese-preparazione-carta",
      topic: "soldi",
      title: "Qué es la cuota de preparación del pedido",
      intro:
        "Una parte para las comisiones bancarias y los gastos del grupo, fijada en cada ciclo: un porcentaje de los productos o un importe fijo. La ves antes de confirmar y se queda en el grupo.",
      keywords: ["cuota", "gastos", "parte", "comisión", "gastos de gestión"],
      when: { mode: "per_order" },
    },
    {
      slug: "rimborsi",
      topic: "soldi",
      title: "Cuándo llegan los reembolsos",
      intro:
        "Cuando se liquida el ciclo, en la tarjeta con la que pagaste: suele tardar 5-10 días. Si cancelas el pedido con el ciclo abierto, el reembolso sale enseguida.",
      keywords: ["reembolso", "devolución", "devolver", "tarjeta"],
      when: { mode: "per_order" },
    },
    {
      slug: "da-saldare",
      topic: "soldi",
      title: "Qué es \"Importe pendiente\"",
      intro:
        "Si los costes definitivos de un ciclo superan lo que pagaste, la diferencia aparece en Inicio como **Importe pendiente**. La pagas con **Pagar ahora**.",
      notes: [
        "Mientras haya algo pendiente no puedes pagar pedidos nuevos, pero sí cambiar o cancelar los que ya hiciste.",
      ],
      link: { href: "/ricarica", label: "Abrir tus saldos" },
      keywords: ["deuda", "pagar", "diferencia", "pendiente"],
      when: { mode: "per_order" },
    },
    {
      slug: "credito",
      topic: "soldi",
      title: "Veo un crédito: ¿qué tengo que hacer?",
      intro: "Nada: es dinero que el grupo te debe, y tesorería te lo devuelve.",
      keywords: ["crédito", "a favor", "dinero", "devolución"],
      when: { mode: "per_order" },
    },
    {
      slug: "movimenti",
      topic: "soldi",
      title: "Dónde veo todos los movimientos",
      steps: [
        "Abre **Historial** y elige **Movimientos**.",
        "Encuentras recargas, cargos, reembolsos y correcciones, los más recientes primero.",
        "Toca un movimiento para ver la fecha, el ciclo y los detalles.",
      ],
      link: { href: "/storico", label: "Abrir Historial" },
      keywords: ["historial", "extracto", "cargos", "recargas", "lista"],
    },

    // Familia
    {
      slug: "cos-e-famiglia",
      topic: "famiglia",
      title: "Qué es una familia",
      intro:
        "Quien hace la compra junto puede compartir un carrito, un saldo y el historial de pedidos. Cada uno sigue entrando con su propio email y recibe sus propios avisos.",
      notes: ["Una familia puede tener como máximo 6 personas."],
      link: { href: "/famiglia", label: "Abrir Familia" },
      keywords: ["compartir", "juntos", "marido", "mujer", "pareja", "compañero de piso", "hogar"],
      when: { families: true },
    },
    {
      slug: "invitare-famiglia",
      topic: "famiglia",
      title: "Invitar a alguien a tu familia",
      steps: [
        "Abre tu **Perfil** (el círculo con tus iniciales, arriba) y toca **Familia**.",
        "En **Invita a alguien** escribe el email con el que entra la otra persona y toca **Enviar invitación**.",
        "Recibe un aviso y un email, y tiene 7 días para aceptar.",
      ],
      notes: ["La persona que invitas tiene que haber entrado en la app al menos una vez."],
      link: { href: "/famiglia", label: "Abrir Familia" },
      keywords: ["invitación", "añadir", "compartir"],
      when: { families: true },
    },
    {
      slug: "accettare-famiglia",
      topic: "famiglia",
      title: "Aceptar una invitación",
      steps: [
        "Abre tu **Perfil** (el círculo con tus iniciales, arriba) y toca **Familia**.",
        "En **Invitaciones recibidas** toca **Aceptar**.",
        "A partir de ahí carrito, saldo e historial son compartidos. Tu saldo pasa a la familia.",
      ],
      notes: ["Si tú y la familia tenéis un pedido en el mismo ciclo abierto, cancela uno antes de aceptar."],
      link: { href: "/famiglia", label: "Abrir Familia" },
      keywords: ["invitación", "unirse", "entrar"],
      when: { families: true },
    },
    {
      slug: "uscire-famiglia",
      topic: "famiglia",
      title: "Salir de la familia",
      intro:
        "En tu **Perfil** abre **Familia** y toca **Salir de la familia**. Vuelves a tu propia cuenta con saldo cero: saldo, pedidos e historial se quedan en la familia.",
      notes: ["Quien creó la familia puede sacar a una persona con **Quitar**."],
      link: { href: "/famiglia", label: "Abrir Familia" },
      keywords: ["salir", "quitar", "separar", "sacar"],
      when: { families: true },
    },

    // Avisos
    {
      slug: "leggere-notifiche",
      topic: "notifiche",
      title: "Leer los avisos",
      intro:
        "El punto rojo en la campana de arriba indica cuántos avisos aún no has leído. Tócala para verlos; **Marcar todo como leído** los marca como leídos.",
      notes: [
        "Te avisamos por ejemplo cuando se abre un pedido, cuando se cobra, cuando llega una recarga y cuando se corrige tu pedido.",
      ],
      link: { href: "/notifiche", label: "Abrir Avisos" },
      keywords: ["campana", "avisos", "punto", "mensajes", "notificaciones"],
    },
    {
      slug: "preferenze-notifiche",
      topic: "notifiche",
      title: "Recibir los avisos también por email",
      steps: [
        "Abre tu **Perfil** (el círculo con tus iniciales, arriba) y toca **Preferencias de avisos**.",
        "También llegas desde la campana, con el engranaje de arriba a la derecha.",
        "Para cada grupo de avisos elige si recibirlos en la app, por email o de las dos formas.",
      ],
      notes: ["Al principio los avisos llegan solo a la app."],
      link: { href: "/profilo/notifiche", label: "Abrir Preferencias de avisos" },
      keywords: ["email", "correo", "avisos", "desactivar", "preferencias", "ajustes"],
    },

    // Acceso y perfil
    {
      slug: "link-non-funziona",
      topic: "account",
      title: "El enlace o el código no funciona",
      steps: [
        "El enlace y el código duran 15 minutos y sirven una sola vez: si ha pasado más tiempo, pide uno nuevo.",
        "Solo funciona el último código: usa el del email más reciente.",
        "Si instalaste la app en el móvil, usa el código en lugar del enlace.",
      ],
      notes: [
        "Si la app dice que tu email no es de un socio, prueba con la dirección con la que te uniste al grupo. Si no sirve, escribe a los contactos del final de esta página.",
      ],
      keywords: ["entrar", "login", "caducado", "error", "no puedo entrar", "denegado"],
    },
    {
      slug: "cambiare-email",
      topic: "account",
      title: "He cambiado de email o tengo dos cuentas",
      intro:
        "Escribe a quien gestiona el grupo: puede cambiar tu dirección, o unir las dos cuentas con saldo y pedidos.",
      notes: ["Los emails con los que puedes entrar están en tu **Perfil**. Mientras tanto entra con la dirección que funciona."],
      link: { href: "/profilo", label: "Abrir Perfil" },
      keywords: ["dirección", "duplicado", "unir", "email nuevo", "cuenta"],
    },
    {
      slug: "quale-email",
      topic: "account",
      title: "¿Con qué email he entrado?",
      intro:
        "Toca el círculo con tus iniciales, arriba: el **Perfil** muestra tu nombre, el email con el que has entrado y los demás que puedes usar.",
      link: { href: "/profilo", label: "Abrir Perfil" },
      keywords: ["dirección", "cuenta", "quién soy", "perfil"],
    },
    {
      slug: "cambiare-nome",
      topic: "account",
      title: "Cambiar tu nombre",
      steps: [
        "Abre tu **Perfil** (el círculo con tus iniciales, arriba).",
        "Junto a **Nombre** toca **Editar**, escribe el nombre y guarda.",
      ],
      notes: ["Es el nombre que ve quien gestiona el grupo."],
      link: { href: "/profilo", label: "Abrir Perfil" },
      keywords: ["nombre", "apellido", "perfil", "cambiar"],
    },
    {
      slug: "uscire",
      topic: "account",
      title: "Cerrar sesión",
      intro: "Abre tu **Perfil**, toca **Cerrar sesión** al final de la página y confirma. Para volver necesitas un enlace o un código nuevo.",
      link: { href: "/profilo", label: "Abrir Perfil" },
      keywords: ["logout", "salir", "cerrar sesión", "desconectar"],
    },
  ],
  synonyms: [
    ["recargar", "recarga", "ingresar", "transferencia", "depósito"],
    ["saldo", "crédito", "cuenta", "dinero", "monedero"],
    ["tarjeta", "débito", "pago online", "pagar"],
    ["pedido", "compra", "carrito", "comprar"],
    ["cancelar", "borrar", "quitar", "anular"],
    ["editar", "cambiar", "modificar", "corregir"],
    ["familia", "hogar", "marido", "mujer", "pareja", "compañero de piso"],
    ["aviso", "avisos", "notificación", "notificaciones", "campana"],
    ["entrar", "login", "acceder", "acceso", "contraseña", "código"],
    ["instalar", "móvil", "teléfono", "iphone", "android", "pantalla de inicio"],
    ["reembolso", "reembolsos", "devolución"],
    ["recogida", "recoger", "entrega"],
    ["peso", "pesado", "cantidad", "gramos"],
    ["cerrar sesión", "logout", "salir"],
  ],
  stopwords: [
    "como", "cómo", "que", "qué", "el", "la", "los", "las", "un", "una", "de", "del", "a", "al", "en", "por",
    "para", "con", "y", "o", "es", "son", "puedo", "mi", "mis", "me", "lo", "donde", "dónde", "cuando",
    "cuándo", "porque", "se", "tengo", "hay",
  ],
};
