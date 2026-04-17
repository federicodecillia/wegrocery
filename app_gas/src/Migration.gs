/**
 * Migrazione dati dal foglio Excel "FRUTTA E VERDURA 2025-2026".
 * Importa soci, cicli, prodotti, ordini e saldi.
 * Eseguire dall'editor: migrateFromExcel()
 */
function migrateFromExcel() {
  Logger.log("═══ MIGRAZIONE DA EXCEL ═══");

  // ── 1. Soci ──
  var memberMap = {}; // name -> member_id
  var existingMembers = readSheetObjects_(APP.SHEETS.MEMBERS);
  var existingByName = {};
  existingMembers.forEach(function(m) { existingByName[m.full_name] = m; });

  var newMembers = [
    "Ballabio",
    "Cadelano L.",
    "Cucchiara A.",
    "Di Mauro",
    "Di Simine",
    "Eva",
    "Favalli",
    "Gianquinto",
    "Malacrinò",
    "Maria fois",
    "Miglierina",
    "Nazareno",
    "Porta Moneta",
    "Riva Cafora",
    "Rossin - Ravelli",
  ];

  var now = nowIso_();
  newMembers.forEach(function(name) {
    if (existingByName[name]) {
      memberMap[name] = existingByName[name].member_id;
      Logger.log("  Socio esistente: " + name + " → " + memberMap[name]);
    } else {
      var mid = generateId_("mem");
      existingMembers.push({
        member_id: mid, full_name: name, email: "",
        role: "member", active: true, created_at: now, updated_at: now
      });
      memberMap[name] = mid;
      Logger.log("  Nuovo socio: " + name + " → " + mid);
    }
  });
  overwriteSheetObjects_(APP.SHEETS.MEMBERS, APP.HEADERS.members, existingMembers);
  Logger.log("Soci: " + newMembers.length);

  // ── 2. Cicli, prodotti, ordini ──
  var allProducts = readSheetObjects_(APP.SHEETS.PRODUCTS);
  var allOrders = readSheetObjects_(APP.SHEETS.ORDERS);
  var allLedger = readSheetObjects_(APP.SHEETS.LEDGER_ENTRIES);
  var cycleObjects = readSheetObjects_(APP.SHEETS.ORDER_CYCLES);

  var cycles = [
    {
        "sheet": "5 nov",
        "pickup_date": "2025-11-05",
        "open_date": "2025-10-29",
        "products": [
            {
                "name": "aglio",
                "variant": "bianco",
                "format": "100 g",
                "unit_price": 1.5,
                "notes": ""
            },
            {
                "name": "barbabietola",
                "variant": "",
                "format": "500 g",
                "unit_price": 2.0,
                "notes": ""
            },
            {
                "name": "batata",
                "variant": "",
                "format": "500 g",
                "unit_price": 2.5,
                "notes": "az agr miglio francesco varallo pombia"
            },
            {
                "name": "cavolo",
                "variant": "pak choi",
                "format": "600 g",
                "unit_price": 3.0,
                "notes": "poca disponibilità"
            },
            {
                "name": "cavolo",
                "variant": "verza",
                "format": "600 g",
                "unit_price": 2.1,
                "notes": ""
            },
            {
                "name": "cicoria",
                "variant": "pan di zucchero",
                "format": "300 g",
                "unit_price": 1.05,
                "notes": ""
            },
            {
                "name": "cicoria",
                "variant": "triestina",
                "format": "mazzo",
                "unit_price": 1.0,
                "notes": ""
            },
            {
                "name": "cicoria",
                "variant": "da taglio variegata",
                "format": "mazzo",
                "unit_price": 1.0,
                "notes": ""
            },
            {
                "name": "cipolla",
                "variant": "dorata",
                "format": "500 g",
                "unit_price": 1.75,
                "notes": ""
            },
            {
                "name": "cipolla",
                "variant": "rossa tipo tropea",
                "format": "500 g",
                "unit_price": 2.5,
                "notes": ""
            },
            {
                "name": "mela",
                "variant": "gala",
                "format": "1 kg",
                "unit_price": 3.2,
                "notes": "poca disponibilità"
            },
            {
                "name": "patata",
                "variant": "pasta gialla buccia gialla",
                "format": "1 kg",
                "unit_price": 2.3,
                "notes": "az agr cascina dulcamara romentino"
            },
            {
                "name": "patata",
                "variant": "pasta gialla buccia rossa",
                "format": "1 kg",
                "unit_price": 2.3,
                "notes": "az agr miglio francesco varallo pombia"
            },
            {
                "name": "peperone",
                "variant": "capriglio",
                "format": "300 g",
                "unit_price": 1.8,
                "notes": "az agr miglio francesco varallo pombia"
            },
            {
                "name": "porro",
                "variant": "",
                "format": "500 g",
                "unit_price": 1.75,
                "notes": "poca disponibilità"
            },
            {
                "name": "radicchio",
                "variant": "tondo rosso",
                "format": "300 g",
                "unit_price": 1.5,
                "notes": ""
            },
            {
                "name": "radicchio",
                "variant": "variegato",
                "format": "400 g",
                "unit_price": 2.4,
                "notes": "poca disponibilità"
            },
            {
                "name": "ramolaccio",
                "variant": "nero",
                "format": "300 g",
                "unit_price": 1.2,
                "notes": "poca disponibilità"
            },
            {
                "name": "rapa",
                "variant": "milano",
                "format": "300 g",
                "unit_price": 1.2,
                "notes": ""
            },
            {
                "name": "scalogno",
                "variant": "",
                "format": "100 g",
                "unit_price": 1.5,
                "notes": ""
            },
            {
                "name": "scarola",
                "variant": "",
                "format": "300 g",
                "unit_price": 1.5,
                "notes": ""
            },
            {
                "name": "zucca",
                "variant": "delica",
                "format": "1 kg",
                "unit_price": 3.2,
                "notes": ""
            },
            {
                "name": "zucca",
                "variant": "hokkaido",
                "format": "1 kg",
                "unit_price": 3.2,
                "notes": ""
            },
            {
                "name": "zucca",
                "variant": "piacentina",
                "format": "1 kg",
                "unit_price": 3.2,
                "notes": ""
            },
            {
                "name": "vasetto di basilico viola",
                "variant": "",
                "format": "",
                "unit_price": 3.0,
                "notes": "da trapiantare"
            }
        ],
        "orders": {
            "Di Mauro": {
                "3": 1.0,
                "10": 1.0
            },
            "Malacrinò": {
                "2": 1.0,
                "8": 1.0,
                "19": 1.0,
                "21": 1.0
            },
            "Miglierina": {
                "3": 1.0,
                "4": 1.0,
                "9": 1.0,
                "10": 2.0,
                "12": 1.0,
                "16": 1.0,
                "20": 1.0
            },
            "Di Simine": {
                "1": 1.0,
                "2": 1.0,
                "3": 1.0,
                "7": 1.0,
                "9": 1.0,
                "16": 1.0,
                "17": 1.0,
                "18": 1.0,
                "20": 1.0,
                "23": 1.0
            },
            "Favalli": {
                "8": 1.0,
                "10": 1.0,
                "13": 1.0,
                "19": 1.0,
                "20": 1.0,
                "21": 1.0
            },
            "Riva Cafora": {
                "3": 1.0,
                "9": 1.0,
                "10": 1.0,
                "11": 2.0,
                "13": 1.0,
                "19": 1.0
            },
            "Eva": {
                "1": 1.0,
                "12": 1.0,
                "20": 1.0,
                "21": 1.0
            },
            "Rossin - Ravelli": {
                "6": 1.0,
                "11": 1.0,
                "14": 1.0
            }
        },
        "title": "Ordine 5 nov"
    },
    {
        "sheet": "12 nov",
        "pickup_date": "2025-11-12",
        "open_date": "2025-11-05",
        "products": [
            {
                "name": "aglio",
                "variant": "bianco",
                "format": "100 g",
                "unit_price": 1.5,
                "notes": ""
            },
            {
                "name": "barbabietola",
                "variant": "",
                "format": "500 g",
                "unit_price": 2.0,
                "notes": ""
            },
            {
                "name": "batata",
                "variant": "",
                "format": "500 g",
                "unit_price": 2.5,
                "notes": "az agr miglio francesco varallo pombia"
            },
            {
                "name": "bieta",
                "variant": "da taglio",
                "format": "400 g",
                "unit_price": 1.8,
                "notes": "poca disponibilità"
            },
            {
                "name": "cavolo",
                "variant": "pak choi",
                "format": "600 g",
                "unit_price": 3.0,
                "notes": "poca disponibilità"
            },
            {
                "name": "cavolo",
                "variant": "riccio",
                "format": "300 g",
                "unit_price": 1.2,
                "notes": ""
            },
            {
                "name": "cavolo",
                "variant": "verza",
                "format": "600 g",
                "unit_price": 2.1,
                "notes": ""
            },
            {
                "name": "cicoria",
                "variant": "pan di zucchero",
                "format": "300 g",
                "unit_price": 1.05,
                "notes": ""
            },
            {
                "name": "cicoria",
                "variant": "da taglio variegata",
                "format": "mazzo",
                "unit_price": 1.0,
                "notes": ""
            },
            {
                "name": "cipolla",
                "variant": "dorata",
                "format": "500 g",
                "unit_price": 1.75,
                "notes": ""
            },
            {
                "name": "cipolla",
                "variant": "rossa tipo tropea",
                "format": "500 g",
                "unit_price": 2.5,
                "notes": ""
            },
            {
                "name": "mela",
                "variant": "gala",
                "format": "1 kg",
                "unit_price": 3.2,
                "notes": "az agr cascina dulcamara romentino"
            },
            {
                "name": "patata",
                "variant": "pasta gialla buccia gialla",
                "format": "1 kg",
                "unit_price": 2.3,
                "notes": "az agr miglio francesco varallo pombia"
            },
            {
                "name": "patata",
                "variant": "pasta gialla buccia rossa",
                "format": "1 kg",
                "unit_price": 2.3,
                "notes": "az agr miglio francesco varallo pombia"
            },
            {
                "name": "peperone",
                "variant": "capriglio",
                "format": "300 g",
                "unit_price": 1.8,
                "notes": "poca disponibilità"
            },
            {
                "name": "porro",
                "variant": "",
                "format": "500 g",
                "unit_price": 1.75,
                "notes": ""
            },
            {
                "name": "radicchio",
                "variant": "lungo rosso",
                "format": "300 g",
                "unit_price": 1.8,
                "notes": "poca disponibilità"
            },
            {
                "name": "radicchio",
                "variant": "tondo rosso",
                "format": "300 g",
                "unit_price": 1.5,
                "notes": ""
            },
            {
                "name": "radicchio",
                "variant": "variegato",
                "format": "400 g",
                "unit_price": 2.4,
                "notes": "poca disponibilità"
            },
            {
                "name": "ramolaccio",
                "variant": "nero",
                "format": "300 g",
                "unit_price": 1.2,
                "notes": "poca disponibilità"
            },
            {
                "name": "scalogno",
                "variant": "",
                "format": "100 g",
                "unit_price": 1.5,
                "notes": "az agr cascina dulcamara romentino"
            },
            {
                "name": "zucca",
                "variant": "delica",
                "format": "1 kg",
                "unit_price": 3.2,
                "notes": ""
            },
            {
                "name": "zucca",
                "variant": "hokkaido",
                "format": "1 kg",
                "unit_price": 3.2,
                "notes": ""
            },
            {
                "name": "zucca",
                "variant": "piacentina",
                "format": "1 kg",
                "unit_price": 3.2,
                "notes": ""
            },
            {
                "name": "vasetto di basilico viola",
                "variant": "",
                "format": "",
                "unit_price": 3.0,
                "notes": "da trapiantare"
            }
        ],
        "orders": {
            "Malacrinò": {
                "11": 1.0,
                "15": 1.0,
                "21": 2.0
            },
            "Miglierina": {
                "6": 1.0,
                "13": 1.0,
                "15": 1.0,
                "16": 1.0,
                "19": 1.0
            },
            "Gianquinto": {
                "1": 1.0,
                "7": 1.0,
                "13": 1.0,
                "19": 1.0
            },
            "Di Simine": {
                "1": 1.0,
                "2": 1.0,
                "3": 1.0,
                "4": 1.0,
                "5": 1.0,
                "11": 1.0,
                "17": 1.0,
                "19": 1.0
            },
            "Riva Cafora": {
                "3": 1.0,
                "14": 1.0
            },
            "Nazareno": {
                "3": 1.0,
                "10": 1.0,
                "11": 1.0,
                "13": 1.0,
                "20": 1.0,
                "23": 1.0
            },
            "Maria fois": {
                "7": 1.0,
                "10": 1.0,
                "12": 1.0,
                "13": 1.0,
                "14": 2.0,
                "16": 1.0,
                "17": 1.0,
                "18": 1.0
            }
        },
        "title": "Ordine 12 nov"
    },
    {
        "sheet": "19 nov",
        "pickup_date": "2025-11-19",
        "open_date": "2025-11-12",
        "products": [
            {
                "name": "aglio",
                "variant": "bianco",
                "format": "100 g",
                "unit_price": 1.5,
                "notes": ""
            },
            {
                "name": "barbabietola",
                "variant": "",
                "format": "500 g",
                "unit_price": 2.0,
                "notes": ""
            },
            {
                "name": "batata",
                "variant": "",
                "format": "500 g",
                "unit_price": 2.5,
                "notes": "az agr miglio francesco varallo pombia"
            },
            {
                "name": "cavolo",
                "variant": "cappuccio bianco",
                "format": "1 kg",
                "unit_price": 3.5,
                "notes": ""
            },
            {
                "name": "cavolo",
                "variant": "cappuccio rosso",
                "format": "1 kg",
                "unit_price": 3.5,
                "notes": ""
            },
            {
                "name": "cavolo",
                "variant": "pak choi",
                "format": "600 g",
                "unit_price": 3.0,
                "notes": "poca disponibilità"
            },
            {
                "name": "cavolo",
                "variant": "riccio",
                "format": "300 g",
                "unit_price": 1.2,
                "notes": ""
            },
            {
                "name": "cavolo",
                "variant": "verza",
                "format": "1 kg",
                "unit_price": 3.5,
                "notes": ""
            },
            {
                "name": "cicoria",
                "variant": "pan di zucchero",
                "format": "500 g",
                "unit_price": 1.75,
                "notes": ""
            },
            {
                "name": "cicoria",
                "variant": "da taglio variegata",
                "format": "mazzo",
                "unit_price": 1.0,
                "notes": ""
            },
            {
                "name": "cipolla",
                "variant": "dorata",
                "format": "500 g",
                "unit_price": 1.75,
                "notes": ""
            },
            {
                "name": "cipolla",
                "variant": "rossa tipo tropea",
                "format": "500 g",
                "unit_price": 2.5,
                "notes": ""
            },
            {
                "name": "finocchio",
                "variant": "",
                "format": "500 g",
                "unit_price": 1.75,
                "notes": ""
            },
            {
                "name": "mela",
                "variant": "pinova",
                "format": "1 kg",
                "unit_price": 3.2,
                "notes": "az agr cascina dulcamara romentino"
            },
            {
                "name": "patata",
                "variant": "pasta gialla buccia gialla",
                "format": "1 kg",
                "unit_price": 2.3,
                "notes": "az agr miglio francesco varallo pombia"
            },
            {
                "name": "patata",
                "variant": "pasta gialla buccia rossa",
                "format": "1 kg",
                "unit_price": 2.3,
                "notes": "az agr miglio francesco varallo pombia"
            },
            {
                "name": "porro",
                "variant": "",
                "format": "500 g",
                "unit_price": 1.75,
                "notes": ""
            },
            {
                "name": "radicchio",
                "variant": "lungo rosso",
                "format": "300 g",
                "unit_price": 1.8,
                "notes": "poca disponibilità"
            },
            {
                "name": "radicchio",
                "variant": "tondo rosso",
                "format": "300 g",
                "unit_price": 1.5,
                "notes": ""
            },
            {
                "name": "radicchio",
                "variant": "variegato",
                "format": "400 g",
                "unit_price": 2.4,
                "notes": ""
            },
            {
                "name": "ramolaccio",
                "variant": "nero",
                "format": "300 g",
                "unit_price": 1.2,
                "notes": "poca disponibilità"
            },
            {
                "name": "scalogno",
                "variant": "",
                "format": "100 g",
                "unit_price": 1.5,
                "notes": "az agr cascina dulcamara romentino"
            },
            {
                "name": "zucca",
                "variant": "delica",
                "format": "1 kg",
                "unit_price": 3.2,
                "notes": ""
            },
            {
                "name": "zucca",
                "variant": "hokkaido",
                "format": "1 kg",
                "unit_price": 3.2,
                "notes": ""
            },
            {
                "name": "zucca",
                "variant": "piacentina",
                "format": "1 kg",
                "unit_price": 3.2,
                "notes": ""
            }
        ],
        "orders": {
            "Di Mauro": {
                "3": 1.0
            },
            "Malacrinò": {
                "2": 2.0,
                "12": 1.0,
                "22": 2.0
            },
            "Miglierina": {
                "4": 1.0,
                "5": 1.0,
                "7": 1.0,
                "12": 1.0,
                "13": 1.0,
                "24": 1.0
            },
            "Favalli": {
                "16": 1.0,
                "21": 1.0,
                "22": 1.0
            },
            "Rossin - Ravelli": {
                "8": 1.0,
                "11": 1.0,
                "13": 1.0
            }
        },
        "title": "Ordine 19 nov"
    },
    {
        "sheet": "26 nov",
        "pickup_date": "2025-11-26",
        "open_date": "2025-11-19",
        "products": [
            {
                "name": "aglio",
                "variant": "bianco",
                "format": "100 g",
                "unit_price": 1.5,
                "notes": ""
            },
            {
                "name": "barbabietola",
                "variant": "",
                "format": "500 g",
                "unit_price": 2.0,
                "notes": ""
            },
            {
                "name": "batata",
                "variant": "",
                "format": "500 g",
                "unit_price": 2.5,
                "notes": "az agr miglio francesco varallo pombia"
            },
            {
                "name": "cavolfiore",
                "variant": "",
                "format": "1 kg",
                "unit_price": 4.0,
                "notes": "poca disponibilità"
            },
            {
                "name": "cavolo",
                "variant": "cappuccio bianco",
                "format": "1 kg",
                "unit_price": 3.5,
                "notes": ""
            },
            {
                "name": "cavolo",
                "variant": "cappuccio rosso",
                "format": "1 kg",
                "unit_price": 3.5,
                "notes": ""
            },
            {
                "name": "cavolo",
                "variant": "verza",
                "format": "1 kg",
                "unit_price": 3.5,
                "notes": ""
            },
            {
                "name": "cicoria",
                "variant": "pan di zucchero",
                "format": "500 g",
                "unit_price": 1.75,
                "notes": ""
            },
            {
                "name": "cicoria",
                "variant": "da taglio variegata",
                "format": "mazzo",
                "unit_price": 1.0,
                "notes": ""
            },
            {
                "name": "cipolla",
                "variant": "dorata",
                "format": "500 g",
                "unit_price": 1.75,
                "notes": ""
            },
            {
                "name": "cipolla",
                "variant": "rossa tipo tropea",
                "format": "500 g",
                "unit_price": 2.5,
                "notes": ""
            },
            {
                "name": "finocchio",
                "variant": "",
                "format": "500 g",
                "unit_price": 1.75,
                "notes": ""
            },
            {
                "name": "kiwi",
                "variant": "",
                "format": "500 g",
                "unit_price": 2.5,
                "notes": ""
            },
            {
                "name": "mela",
                "variant": "pinova",
                "format": "1 kg",
                "unit_price": 3.2,
                "notes": "az agr cascina dulcamara romentino"
            },
            {
                "name": "patata",
                "variant": "pasta gialla buccia gialla",
                "format": "1 kg",
                "unit_price": 2.3,
                "notes": "az agr miglio francesco varallo pombia"
            },
            {
                "name": "patata",
                "variant": "pasta gialla buccia rossa",
                "format": "1 kg",
                "unit_price": 2.3,
                "notes": "az agr miglio francesco varallo pombia"
            },
            {
                "name": "porro",
                "variant": "",
                "format": "500 g",
                "unit_price": 1.75,
                "notes": ""
            },
            {
                "name": "radicchio",
                "variant": "tondo rosso",
                "format": "300 g",
                "unit_price": 1.5,
                "notes": ""
            },
            {
                "name": "radicchio",
                "variant": "variegato",
                "format": "400 g",
                "unit_price": 2.4,
                "notes": ""
            },
            {
                "name": "ramolaccio",
                "variant": "nero",
                "format": "300 g",
                "unit_price": 1.2,
                "notes": "poca disponibilità"
            },
            {
                "name": "scalogno",
                "variant": "",
                "format": "100 g",
                "unit_price": 1.5,
                "notes": "az agr cascina dulcamara romentino"
            },
            {
                "name": "scarola",
                "variant": "",
                "format": "250 g",
                "unit_price": 1.25,
                "notes": ""
            },
            {
                "name": "topinambur",
                "variant": "",
                "format": "250 g",
                "unit_price": 1.13,
                "notes": ""
            },
            {
                "name": "zucca",
                "variant": "delica",
                "format": "1 kg",
                "unit_price": 3.2,
                "notes": ""
            },
            {
                "name": "zucca",
                "variant": "hokkaido",
                "format": "1 kg",
                "unit_price": 3.2,
                "notes": ""
            },
            {
                "name": "zucca",
                "variant": "piacentina",
                "format": "1 kg",
                "unit_price": 3.2,
                "notes": ""
            }
        ],
        "orders": {
            "Miglierina": {
                "0": 1.0,
                "3": 1.0,
                "11": 1.0,
                "15": 1.0,
                "20": 1.0
            },
            "Di Simine": {
                "2": 1.0,
                "3": 1.0,
                "5": 1.0,
                "11": 1.0,
                "17": 1.0,
                "21": 1.0,
                "22": 1.0
            },
            "Favalli": {
                "0": 1.0,
                "3": 1.0,
                "6": 1.0,
                "9": 1.0,
                "11": 1.0,
                "12": 1.0,
                "15": 1.0,
                "21": 1.0
            },
            "Riva Cafora": {
                "3": 1.0,
                "5": 1.0,
                "11": 1.0,
                "17": 1.0,
                "21": 1.0
            },
            "Eva": {
                "6": 1.0,
                "11": 1.0
            },
            "Rossin - Ravelli": {
                "8": 1.0,
                "10": 2.0,
                "14": 1.0,
                "20": 1.0
            }
        },
        "title": "Ordine 26 nov"
    },
    {
        "sheet": "03 dic",
        "pickup_date": "2025-12-03",
        "open_date": "2025-11-26",
        "products": [
            {
                "name": "aglio",
                "variant": "bianco",
                "format": "100 g",
                "unit_price": 1.5,
                "notes": ""
            },
            {
                "name": "barbabietola",
                "variant": "",
                "format": "500 g",
                "unit_price": 2.0,
                "notes": ""
            },
            {
                "name": "batata",
                "variant": "",
                "format": "500 g",
                "unit_price": 2.5,
                "notes": "az agr miglio francesco varallo pombia"
            },
            {
                "name": "cavolfiore",
                "variant": "",
                "format": "1 kg",
                "unit_price": 4.0,
                "notes": "poca disponibilità"
            },
            {
                "name": "cavolo",
                "variant": "cappuccio bianco",
                "format": "1 kg",
                "unit_price": 3.5,
                "notes": ""
            },
            {
                "name": "cavolo",
                "variant": "cappuccio rosso",
                "format": "1 kg",
                "unit_price": 3.5,
                "notes": ""
            },
            {
                "name": "cavolo",
                "variant": "verza",
                "format": "1 kg",
                "unit_price": 3.5,
                "notes": ""
            },
            {
                "name": "cicoria",
                "variant": "pan di zucchero",
                "format": "500 g",
                "unit_price": 1.75,
                "notes": ""
            },
            {
                "name": "cicoria",
                "variant": "da taglio variegata",
                "format": "mazzo",
                "unit_price": 1.0,
                "notes": ""
            },
            {
                "name": "cipolla",
                "variant": "dorata",
                "format": "500 g",
                "unit_price": 1.75,
                "notes": ""
            },
            {
                "name": "cipolla",
                "variant": "rossa tipo tropea",
                "format": "500 g",
                "unit_price": 2.5,
                "notes": ""
            },
            {
                "name": "finocchio",
                "variant": "",
                "format": "500 g",
                "unit_price": 1.75,
                "notes": ""
            },
            {
                "name": "kiwi",
                "variant": "",
                "format": "500 g",
                "unit_price": 2.5,
                "notes": ""
            },
            {
                "name": "mela",
                "variant": "pinova",
                "format": "1 kg",
                "unit_price": 3.2,
                "notes": "az agr cascina dulcamara romentino"
            },
            {
                "name": "patata",
                "variant": "pasta gialla buccia gialla",
                "format": "1 kg",
                "unit_price": 2.3,
                "notes": "az agr miglio francesco varallo pombia"
            },
            {
                "name": "patata",
                "variant": "pasta gialla buccia rossa",
                "format": "1 kg",
                "unit_price": 2.3,
                "notes": "az agr miglio francesco varallo pombia"
            },
            {
                "name": "porro",
                "variant": "",
                "format": "500 g",
                "unit_price": 1.75,
                "notes": ""
            },
            {
                "name": "radicchio",
                "variant": "tondo rosso",
                "format": "300 g",
                "unit_price": 1.5,
                "notes": ""
            },
            {
                "name": "radicchio",
                "variant": "variegato",
                "format": "400 g",
                "unit_price": 2.4,
                "notes": ""
            },
            {
                "name": "ramolaccio",
                "variant": "nero",
                "format": "300 g",
                "unit_price": 1.2,
                "notes": "poca disponibilità"
            },
            {
                "name": "scalogno",
                "variant": "",
                "format": "100 g",
                "unit_price": 1.5,
                "notes": "az agr cascina dulcamara romentino"
            },
            {
                "name": "scarola",
                "variant": "",
                "format": "250 g",
                "unit_price": 1.25,
                "notes": ""
            },
            {
                "name": "topinambur",
                "variant": "",
                "format": "250 g",
                "unit_price": 1.13,
                "notes": ""
            },
            {
                "name": "zucca",
                "variant": "delica",
                "format": "1 kg",
                "unit_price": 3.2,
                "notes": ""
            },
            {
                "name": "zucca",
                "variant": "hokkaido",
                "format": "1 kg",
                "unit_price": 3.2,
                "notes": ""
            },
            {
                "name": "zucca",
                "variant": "piacentina",
                "format": "1 kg",
                "unit_price": 3.2,
                "notes": ""
            }
        ],
        "orders": {
            "Di Mauro": {
                "4": 1.0,
                "16": 2.0,
                "20": 1.0
            },
            "Malacrinò": {
                "0": 1.0,
                "9": 1.0,
                "10": 1.0,
                "12": 1.0,
                "15": 1.0,
                "23": 1.0
            },
            "Miglierina": {
                "1": 1.0,
                "4": 1.0,
                "11": 1.0,
                "13": 1.0,
                "17": 1.0
            },
            "Gianquinto": {
                "7": 1.0,
                "16": 1.0,
                "19": 1.0,
                "22": 1.0
            },
            "Di Simine": {
                "1": 1.0,
                "2": 1.0,
                "4": 1.0,
                "6": 1.0,
                "9": 1.0,
                "11": 1.0,
                "17": 1.0,
                "20": 1.0,
                "21": 1.0
            },
            "Favalli": {
                "9": 1.0,
                "10": 1.0,
                "12": 1.0
            },
            "Rossin - Ravelli": {
                "8": 1.0,
                "9": 1.0,
                "14": 2.0,
                "16": 1.0
            }
        },
        "title": "Ordine 03 dic"
    },
    {
        "sheet": "10 dic",
        "pickup_date": "2025-12-10",
        "open_date": "2025-12-03",
        "products": [
            {
                "name": "aglio",
                "variant": "bianco",
                "format": "100 g",
                "unit_price": 1.5,
                "notes": ""
            },
            {
                "name": "barbabietola",
                "variant": "",
                "format": "500 g",
                "unit_price": 2.0,
                "notes": ""
            },
            {
                "name": "batata",
                "variant": "",
                "format": "500 g",
                "unit_price": 2.5,
                "notes": "az agr miglio francesco varallo pombia"
            },
            {
                "name": "cavolo",
                "variant": "cappuccio bianco",
                "format": "1 kg",
                "unit_price": 3.5,
                "notes": ""
            },
            {
                "name": "cavolo",
                "variant": "cappuccio rosso",
                "format": "1 kg",
                "unit_price": 3.5,
                "notes": ""
            },
            {
                "name": "cavolo",
                "variant": "nero",
                "format": "250 g",
                "unit_price": 1.0,
                "notes": "poca disponibilità"
            },
            {
                "name": "cavolo",
                "variant": "verza",
                "format": "1 kg",
                "unit_price": 3.5,
                "notes": ""
            },
            {
                "name": "cicoria",
                "variant": "pan di zucchero",
                "format": "500 g",
                "unit_price": 1.75,
                "notes": ""
            },
            {
                "name": "cipolla",
                "variant": "dorata",
                "format": "500 g",
                "unit_price": 1.75,
                "notes": ""
            },
            {
                "name": "cipolla",
                "variant": "rossa tipo tropea",
                "format": "500 g",
                "unit_price": 2.5,
                "notes": ""
            },
            {
                "name": "finocchio",
                "variant": "",
                "format": "500 g",
                "unit_price": 1.75,
                "notes": ""
            },
            {
                "name": "kiwi",
                "variant": "",
                "format": "500 g",
                "unit_price": 2.5,
                "notes": ""
            },
            {
                "name": "mela",
                "variant": "pinova",
                "format": "1 kg",
                "unit_price": 3.2,
                "notes": "az agr cascina dulcamara romentino"
            },
            {
                "name": "mela",
                "variant": "topaz",
                "format": "1 kg",
                "unit_price": 3.2,
                "notes": "az agr cascina dulcamara romentino"
            },
            {
                "name": "patata",
                "variant": "pasta gialla buccia gialla",
                "format": "1 kg",
                "unit_price": 2.3,
                "notes": "az agr miglio francesco varallo pombia"
            },
            {
                "name": "patata",
                "variant": "pasta gialla buccia rossa",
                "format": "1 kg",
                "unit_price": 2.3,
                "notes": "az agr miglio francesco varallo pombia"
            },
            {
                "name": "porro",
                "variant": "",
                "format": "500 g",
                "unit_price": 1.75,
                "notes": ""
            },
            {
                "name": "radicchio",
                "variant": "tondo rosso",
                "format": "300 g",
                "unit_price": 1.5,
                "notes": ""
            },
            {
                "name": "radicchio",
                "variant": "variegato",
                "format": "400 g",
                "unit_price": 2.4,
                "notes": ""
            },
            {
                "name": "ramolaccio",
                "variant": "nero",
                "format": "300 g",
                "unit_price": 1.2,
                "notes": "poca disponibilità"
            },
            {
                "name": "scalogno",
                "variant": "",
                "format": "100 g",
                "unit_price": 1.5,
                "notes": "az agr cascina dulcamara romentino"
            },
            {
                "name": "scarola",
                "variant": "",
                "format": "250 g",
                "unit_price": 1.25,
                "notes": "poca disponibilità"
            },
            {
                "name": "topinambur",
                "variant": "",
                "format": "250 g",
                "unit_price": 1.13,
                "notes": ""
            },
            {
                "name": "zucca",
                "variant": "delica",
                "format": "1 kg",
                "unit_price": 3.2,
                "notes": ""
            },
            {
                "name": "zucca",
                "variant": "hokkaido",
                "format": "1 kg",
                "unit_price": 3.2,
                "notes": ""
            },
            {
                "name": "zucca",
                "variant": "piacentina",
                "format": "1 kg",
                "unit_price": 3.2,
                "notes": ""
            }
        ],
        "orders": {
            "Miglierina": {
                "4": 1.0,
                "6": 1.0,
                "9": 1.0,
                "10": 1.0,
                "12": 1.0,
                "16": 1.0,
                "20": 1.0,
                "22": 1.0
            },
            "Gianquinto": {
                "15": 1.0,
                "21": 1.0,
                "24": 1.0
            },
            "Di Simine": {
                "2": 1.0,
                "5": 1.0,
                "10": 1.0,
                "21": 1.0,
                "22": 1.0
            },
            "Favalli": {
                "5": 1.0,
                "8": 1.0,
                "14": 1.0,
                "23": 1.0
            },
            "Maria fois": {
                "2": 2.0,
                "10": 2.0,
                "17": 1.0,
                "18": 1.0,
                "22": 2.0
            },
            "Rossin - Ravelli": {
                "6": 1.0,
                "10": 1.0,
                "23": 1.0
            },
            "Porta Moneta": {
                "8": 1.0,
                "14": 7.0
            }
        },
        "title": "Ordine 10 dic"
    },
    {
        "sheet": "17 dic",
        "pickup_date": "2025-12-17",
        "open_date": "2025-12-10",
        "products": [
            {
                "name": "aglio",
                "variant": "bianco",
                "format": "100 g",
                "unit_price": 1.5,
                "notes": ""
            },
            {
                "name": "barbabietola",
                "variant": "",
                "format": "500 g",
                "unit_price": 2.0,
                "notes": ""
            },
            {
                "name": "batata",
                "variant": "",
                "format": "500 g",
                "unit_price": 2.5,
                "notes": "az agr miglio francesco varallo pombia"
            },
            {
                "name": "cavolfiore",
                "variant": "",
                "format": "500 g",
                "unit_price": 1.75,
                "notes": "poca disponibilità"
            },
            {
                "name": "cavolo",
                "variant": "cappuccio rosso",
                "format": "1 kg",
                "unit_price": 3.5,
                "notes": ""
            },
            {
                "name": "cavolo",
                "variant": "verza",
                "format": "1 kg",
                "unit_price": 3.5,
                "notes": ""
            },
            {
                "name": "cicoria",
                "variant": "pan di zucchero",
                "format": "500 g",
                "unit_price": 1.75,
                "notes": ""
            },
            {
                "name": "cipolla",
                "variant": "dorata",
                "format": "500 g",
                "unit_price": 1.75,
                "notes": ""
            },
            {
                "name": "cipolla",
                "variant": "rossa tipo tropea",
                "format": "500 g",
                "unit_price": 2.5,
                "notes": ""
            },
            {
                "name": "finocchio",
                "variant": "",
                "format": "500 g",
                "unit_price": 1.75,
                "notes": ""
            },
            {
                "name": "kiwi",
                "variant": "",
                "format": "500 g",
                "unit_price": 2.5,
                "notes": ""
            },
            {
                "name": "mela",
                "variant": "pinova",
                "format": "1 kg",
                "unit_price": 3.2,
                "notes": "az agr cascina dulcamara romentino"
            },
            {
                "name": "mela",
                "variant": "topaz",
                "format": "1 kg",
                "unit_price": 3.2,
                "notes": "az agr cascina dulcamara romentino"
            },
            {
                "name": "patata",
                "variant": "pasta bianca buccia gialla",
                "format": "1 kg",
                "unit_price": 2.3,
                "notes": "az agr miglio francesco varallo pombia"
            },
            {
                "name": "patata",
                "variant": "pasta gialla buccia gialla",
                "format": "1 kg",
                "unit_price": 2.3,
                "notes": "az agr miglio francesco varallo pombia"
            },
            {
                "name": "patata",
                "variant": "pasta gialla buccia rossa",
                "format": "1 kg",
                "unit_price": 2.3,
                "notes": "az agr miglio francesco varallo pombia"
            },
            {
                "name": "porro",
                "variant": "",
                "format": "500 g",
                "unit_price": 1.75,
                "notes": ""
            },
            {
                "name": "radicchio",
                "variant": "tondo rosso",
                "format": "300 g",
                "unit_price": 1.5,
                "notes": ""
            },
            {
                "name": "radicchio",
                "variant": "variegato",
                "format": "300 g",
                "unit_price": 1.8,
                "notes": ""
            },
            {
                "name": "scalogno",
                "variant": "",
                "format": "100 g",
                "unit_price": 1.5,
                "notes": "az agr cascina dulcamara romentino"
            },
            {
                "name": "scarola",
                "variant": "",
                "format": "400 g",
                "unit_price": 2.0,
                "notes": "poca disponibilità"
            },
            {
                "name": "topinambur",
                "variant": "",
                "format": "250 g",
                "unit_price": 1.13,
                "notes": ""
            },
            {
                "name": "zucca",
                "variant": "delica",
                "format": "1 kg",
                "unit_price": 3.2,
                "notes": ""
            },
            {
                "name": "zucca",
                "variant": "hokkaido",
                "format": "1 kg",
                "unit_price": 3.2,
                "notes": ""
            },
            {
                "name": "zucca",
                "variant": "piacentina",
                "format": "1 kg",
                "unit_price": 3.2,
                "notes": ""
            }
        ],
        "orders": {
            "Miglierina": {
                "14": 1.0,
                "20": 1.0
            },
            "Di Simine": {
                "2": 1.0,
                "6": 1.0,
                "9": 1.0,
                "12": 1.0,
                "17": 1.0,
                "19": 1.0,
                "20": 2.0,
                "21": 2.0,
                "22": 1.0
            },
            "Favalli": {
                "5": 1.0,
                "8": 1.0,
                "13": 1.0,
                "16": 1.0
            },
            "Eva": {
                "1": 1.0,
                "2": 1.0,
                "4": 1.0,
                "12": 1.0,
                "14": 1.0,
                "15": 1.0
            },
            "Maria fois": {
                "2": 1.0,
                "6": 2.0,
                "7": 1.0,
                "13": 1.0,
                "14": 1.0,
                "22": 1.0
            },
            "Rossin - Ravelli": {
                "0": 1.0,
                "8": 1.0,
                "14": 2.0,
                "23": 1.0
            }
        },
        "title": "Ordine 17 dic"
    },
    {
        "sheet": "22 dic",
        "pickup_date": "2025-12-22",
        "open_date": "2025-12-15",
        "products": [
            {
                "name": "aglio",
                "variant": "bianco",
                "format": "100 g",
                "unit_price": 1.5,
                "notes": ""
            },
            {
                "name": "barbabietola",
                "variant": "",
                "format": "500 g",
                "unit_price": 2.0,
                "notes": ""
            },
            {
                "name": "batata",
                "variant": "",
                "format": "500 g",
                "unit_price": 2.5,
                "notes": "az agr miglio francesco varallo pombia"
            },
            {
                "name": "cavolo",
                "variant": "cappuccio rosso",
                "format": "1 kg",
                "unit_price": 3.5,
                "notes": ""
            },
            {
                "name": "cavolo",
                "variant": "verza",
                "format": "1 kg",
                "unit_price": 3.5,
                "notes": ""
            },
            {
                "name": "cicoria",
                "variant": "pan di zucchero",
                "format": "500 g",
                "unit_price": 1.75,
                "notes": ""
            },
            {
                "name": "cipolla",
                "variant": "dorata",
                "format": "500 g",
                "unit_price": 1.75,
                "notes": ""
            },
            {
                "name": "cipolla",
                "variant": "rossa tipo tropea",
                "format": "500 g",
                "unit_price": 2.5,
                "notes": ""
            },
            {
                "name": "finocchio",
                "variant": "",
                "format": "500 g",
                "unit_price": 1.75,
                "notes": ""
            },
            {
                "name": "kiwi",
                "variant": "",
                "format": "500 g",
                "unit_price": 2.5,
                "notes": ""
            },
            {
                "name": "mela",
                "variant": "topaz",
                "format": "1 kg",
                "unit_price": 3.2,
                "notes": "az agr cascina dulcamara romentino"
            },
            {
                "name": "patata",
                "variant": "pasta bianca buccia gialla",
                "format": "1 kg",
                "unit_price": 2.3,
                "notes": "az agr miglio francesco varallo pombia"
            },
            {
                "name": "patata",
                "variant": "pasta gialla buccia gialla",
                "format": "1 kg",
                "unit_price": 2.3,
                "notes": "az agr miglio francesco varallo pombia"
            },
            {
                "name": "patata",
                "variant": "pasta gialla buccia rossa",
                "format": "1 kg",
                "unit_price": 2.3,
                "notes": "az agr miglio francesco varallo pombia"
            },
            {
                "name": "porro",
                "variant": "",
                "format": "500 g",
                "unit_price": 1.75,
                "notes": ""
            },
            {
                "name": "radicchio",
                "variant": "tondo rosso",
                "format": "300 g",
                "unit_price": 1.5,
                "notes": ""
            },
            {
                "name": "radicchio",
                "variant": "variegato",
                "format": "300 g",
                "unit_price": 1.8,
                "notes": "poca disponibilità"
            },
            {
                "name": "scalogno",
                "variant": "",
                "format": "100 g",
                "unit_price": 1.5,
                "notes": "az agr cascina dulcamara romentino"
            },
            {
                "name": "topinambur",
                "variant": "",
                "format": "250 g",
                "unit_price": 1.13,
                "notes": ""
            },
            {
                "name": "zucca",
                "variant": "delica",
                "format": "1 kg",
                "unit_price": 3.2,
                "notes": ""
            },
            {
                "name": "zucca",
                "variant": "piacentina",
                "format": "1 kg",
                "unit_price": 3.2,
                "notes": ""
            }
        ],
        "orders": {
            "Miglierina": {
                "0": 2.0,
                "3": 1.0,
                "5": 1.0,
                "7": 1.0,
                "8": 1.0,
                "13": 2.0,
                "14": 1.0,
                "15": 1.0,
                "16": 1.0,
                "17": 1.0,
                "19": 1.0
            },
            "Di Simine": {
                "2": 1.0,
                "8": 1.0,
                "10": 1.0,
                "12": 1.0,
                "13": 1.0
            },
            "Favalli": {
                "6": 1.0,
                "10": 1.0,
                "12": 1.0,
                "13": 1.0
            },
            "Maria fois": {
                "8": 2.0,
                "12": 2.0,
                "19": 1.0
            },
            "Rossin - Ravelli": {
                "4": 1.0,
                "6": 1.0,
                "8": 1.0,
                "12": 1.0,
                "14": 2.0
            }
        },
        "title": "Ordine 22 dic"
    },
    {
        "sheet": "29 dic",
        "pickup_date": "2025-12-29",
        "open_date": "2025-12-22",
        "products": [
            {
                "name": "aglio",
                "variant": "bianco",
                "format": "100 g",
                "unit_price": 1.5,
                "notes": ""
            },
            {
                "name": "barbabietola",
                "variant": "",
                "format": "500 g",
                "unit_price": 2.0,
                "notes": ""
            },
            {
                "name": "batata",
                "variant": "",
                "format": "500 g",
                "unit_price": 2.5,
                "notes": "az agr miglio francesco varallo pombia"
            },
            {
                "name": "cavolo",
                "variant": "cappuccio rosso",
                "format": "1 kg",
                "unit_price": 3.5,
                "notes": ""
            },
            {
                "name": "cavolo",
                "variant": "verza",
                "format": "1 kg",
                "unit_price": 3.5,
                "notes": ""
            },
            {
                "name": "cicoria",
                "variant": "pan di zucchero",
                "format": "500 g",
                "unit_price": 1.75,
                "notes": ""
            },
            {
                "name": "cipolla",
                "variant": "dorata",
                "format": "500 g",
                "unit_price": 1.75,
                "notes": ""
            },
            {
                "name": "cipolla",
                "variant": "rossa tipo tropea",
                "format": "500 g",
                "unit_price": 2.5,
                "notes": ""
            },
            {
                "name": "finocchio",
                "variant": "",
                "format": "500 g",
                "unit_price": 1.75,
                "notes": ""
            },
            {
                "name": "kiwi",
                "variant": "",
                "format": "500 g",
                "unit_price": 2.5,
                "notes": ""
            },
            {
                "name": "mela",
                "variant": "topaz",
                "format": "1 kg",
                "unit_price": 3.2,
                "notes": "az agr cascina dulcamara romentino"
            },
            {
                "name": "patata",
                "variant": "pasta bianca buccia gialla",
                "format": "1 kg",
                "unit_price": 2.3,
                "notes": "az agr miglio francesco varallo pombia"
            },
            {
                "name": "patata",
                "variant": "pasta gialla buccia gialla",
                "format": "1 kg",
                "unit_price": 2.3,
                "notes": "az agr miglio francesco varallo pombia"
            },
            {
                "name": "patata",
                "variant": "pasta gialla buccia rossa",
                "format": "1 kg",
                "unit_price": 2.3,
                "notes": "az agr miglio francesco varallo pombia"
            },
            {
                "name": "porro",
                "variant": "",
                "format": "500 g",
                "unit_price": 1.75,
                "notes": ""
            },
            {
                "name": "radicchio",
                "variant": "tondo rosso",
                "format": "300 g",
                "unit_price": 1.5,
                "notes": ""
            },
            {
                "name": "radicchio",
                "variant": "variegato",
                "format": "300 g",
                "unit_price": 1.8,
                "notes": "poca disponibilità"
            },
            {
                "name": "scalogno",
                "variant": "",
                "format": "100 g",
                "unit_price": 1.5,
                "notes": "az agr cascina dulcamara romentino"
            },
            {
                "name": "topinambur",
                "variant": "",
                "format": "250 g",
                "unit_price": 1.13,
                "notes": ""
            },
            {
                "name": "zucca",
                "variant": "delica",
                "format": "1 kg",
                "unit_price": 3.2,
                "notes": ""
            },
            {
                "name": "zucca",
                "variant": "piacentina",
                "format": "1 kg",
                "unit_price": 3.2,
                "notes": ""
            }
        ],
        "orders": {
            "Di Simine": {
                "2": 2.0,
                "12": 2.0,
                "18": 2.0
            },
            "Rossin - Ravelli": {
                "4": 1.0,
                "7": 1.0,
                "14": 1.0,
                "17": 1.0
            }
        },
        "title": "Ordine 29 dic"
    },
    {
        "sheet": "14 Gen",
        "pickup_date": "2026-01-14",
        "open_date": "2026-01-07",
        "products": [
            {
                "name": "aglio",
                "variant": "bianco",
                "format": "100 g",
                "unit_price": 1.5,
                "notes": ""
            },
            {
                "name": "barbabietola",
                "variant": "",
                "format": "500 g",
                "unit_price": 2.0,
                "notes": "poca disponibilità"
            },
            {
                "name": "batata",
                "variant": "",
                "format": "500 g",
                "unit_price": 2.5,
                "notes": "az agr miglio francesco varallo pombia"
            },
            {
                "name": "cavolo",
                "variant": "cappuccio rosso",
                "format": "1 kg",
                "unit_price": 3.5,
                "notes": ""
            },
            {
                "name": "cavolo",
                "variant": "verza",
                "format": "1 kg",
                "unit_price": 3.5,
                "notes": ""
            },
            {
                "name": "cicoria",
                "variant": "pan di zucchero",
                "format": "500 g",
                "unit_price": 1.75,
                "notes": ""
            },
            {
                "name": "cipolla",
                "variant": "dorata",
                "format": "500 g",
                "unit_price": 1.75,
                "notes": ""
            },
            {
                "name": "cipolla",
                "variant": "rossa tipo tropea",
                "format": "500 g",
                "unit_price": 2.5,
                "notes": ""
            },
            {
                "name": "finocchio",
                "variant": "",
                "format": "500 g",
                "unit_price": 1.75,
                "notes": ""
            },
            {
                "name": "kiwi",
                "variant": "",
                "format": "500 g",
                "unit_price": 2.5,
                "notes": ""
            },
            {
                "name": "mela",
                "variant": "topaz",
                "format": "1 kg",
                "unit_price": 3.2,
                "notes": "az agr cascina dulcamara romentino"
            },
            {
                "name": "patata",
                "variant": "pasta bianca buccia gialla",
                "format": "1 kg",
                "unit_price": 2.3,
                "notes": "az agr miglio francesco varallo pombia"
            },
            {
                "name": "patata",
                "variant": "pasta gialla buccia gialla",
                "format": "1 kg",
                "unit_price": 2.3,
                "notes": "az agr miglio francesco varallo pombia"
            },
            {
                "name": "patata",
                "variant": "pasta gialla buccia rossa",
                "format": "1 kg",
                "unit_price": 2.3,
                "notes": "az agr miglio francesco varallo pombia"
            },
            {
                "name": "porro",
                "variant": "",
                "format": "500 g",
                "unit_price": 1.75,
                "notes": "forse"
            },
            {
                "name": "radicchio",
                "variant": "tondo rosso",
                "format": "300 g",
                "unit_price": 1.5,
                "notes": ""
            },
            {
                "name": "radicchio",
                "variant": "variegato",
                "format": "300 g",
                "unit_price": 1.8,
                "notes": "poca disponibilità"
            },
            {
                "name": "scalogno",
                "variant": "",
                "format": "100 g",
                "unit_price": 1.5,
                "notes": "az agr cascina dulcamara romentino"
            },
            {
                "name": "topinambur",
                "variant": "",
                "format": "250 g",
                "unit_price": 1.13,
                "notes": "forse"
            },
            {
                "name": "zucca",
                "variant": "delica",
                "format": "1 kg",
                "unit_price": 3.2,
                "notes": ""
            },
            {
                "name": "zucca",
                "variant": "piacentina",
                "format": "1 kg",
                "unit_price": 3.2,
                "notes": ""
            }
        ],
        "orders": {
            "Di Mauro": {
                "3": 1.0,
                "9": 1.0,
                "10": 1.0
            },
            "Miglierina": {
                "3": 1.0,
                "4": 1.0,
                "7": 1.0,
                "8": 1.0,
                "9": 1.0,
                "10": 1.0,
                "13": 1.0,
                "17": 1.0
            },
            "Gianquinto": {
                "5": 1.0,
                "13": 1.0,
                "18": 1.0,
                "19": 1.0
            },
            "Di Simine": {
                "1": 1.0,
                "2": 1.0,
                "4": 1.0,
                "5": 1.0,
                "6": 1.0,
                "8": 1.0,
                "10": 1.0,
                "13": 1.0,
                "14": 1.0,
                "15": 1.0,
                "16": 1.0,
                "18": 1.0
            },
            "Favalli": {
                "0": 1.0,
                "6": 1.0,
                "10": 1.0,
                "12": 1.0,
                "13": 1.0,
                "14": 1.0,
                "19": 1.0
            },
            "Riva Cafora": {
                "3": 1.0,
                "8": 1.0,
                "12": 3.0
            },
            "Maria fois": {
                "1": 1.0,
                "3": 1.0,
                "5": 2.0,
                "15": 1.0
            },
            "Rossin - Ravelli": {
                "4": 1.0,
                "6": 1.0,
                "7": 2.0,
                "8": 1.0,
                "12": 2.0,
                "14": 2.0,
                "17": 1.0
            }
        },
        "title": "Ordine 14 Gen"
    },
    {
        "sheet": "21 Gen",
        "pickup_date": "2026-01-21",
        "open_date": "2026-01-14",
        "products": [
            {
                "name": "aglio",
                "variant": "bianco",
                "format": "100 g",
                "unit_price": 1.5,
                "notes": ""
            },
            {
                "name": "batata",
                "variant": "",
                "format": "500 g",
                "unit_price": 2.5,
                "notes": "az agr miglio francesco varallo pombia"
            },
            {
                "name": "carota",
                "variant": "",
                "format": "500 g",
                "unit_price": 1.75,
                "notes": "az agr miglio francesco varallo pombia"
            },
            {
                "name": "cavolo",
                "variant": "cappuccio rosso",
                "format": "1 kg",
                "unit_price": 3.5,
                "notes": ""
            },
            {
                "name": "cavolo",
                "variant": "verza",
                "format": "1 kg",
                "unit_price": 3.5,
                "notes": ""
            },
            {
                "name": "cicoria",
                "variant": "pan di zucchero",
                "format": "500 g",
                "unit_price": 1.75,
                "notes": ""
            },
            {
                "name": "cipolla",
                "variant": "dorata",
                "format": "500 g",
                "unit_price": 1.75,
                "notes": ""
            },
            {
                "name": "cipolla",
                "variant": "rossa tipo tropea",
                "format": "500 g",
                "unit_price": 2.5,
                "notes": ""
            },
            {
                "name": "finocchio",
                "variant": "",
                "format": "500 g",
                "unit_price": 1.75,
                "notes": ""
            },
            {
                "name": "mela",
                "variant": "goldrush",
                "format": "1 kg",
                "unit_price": 3.2,
                "notes": "az agr cascina dulcamara romentino"
            },
            {
                "name": "patata",
                "variant": "pasta gialla buccia gialla",
                "format": "1 kg",
                "unit_price": 2.3,
                "notes": "az agr miglio francesco varallo pombia"
            },
            {
                "name": "patata",
                "variant": "pasta gialla buccia rossa",
                "format": "1 kg",
                "unit_price": 2.3,
                "notes": "az agr miglio francesco varallo pombia"
            },
            {
                "name": "porro",
                "variant": "",
                "format": "500 g",
                "unit_price": 1.75,
                "notes": ""
            },
            {
                "name": "radicchio",
                "variant": "tondo rosso",
                "format": "300 g",
                "unit_price": 1.5,
                "notes": ""
            },
            {
                "name": "scalogno",
                "variant": "",
                "format": "100 g",
                "unit_price": 1.5,
                "notes": "az agr cascina dulcamara romentino"
            },
            {
                "name": "topinambur",
                "variant": "",
                "format": "250 g",
                "unit_price": 1.13,
                "notes": ""
            },
            {
                "name": "zucca",
                "variant": "delica",
                "format": "1 kg",
                "unit_price": 3.2,
                "notes": ""
            },
            {
                "name": "zucca",
                "variant": "piacentina",
                "format": "1 kg",
                "unit_price": 3.2,
                "notes": ""
            }
        ],
        "orders": {
            "Di Mauro": {
                "1": 1.0,
                "5": 2.0,
                "8": 2.0,
                "12": 1.0
            },
            "Miglierina": {
                "2": 1.0,
                "3": 1.0,
                "4": 1.0,
                "8": 1.0,
                "9": 1.0,
                "12": 1.0,
                "13": 1.0
            },
            "Di Simine": {
                "1": 1.0,
                "2": 1.0,
                "3": 1.0,
                "5": 1.0,
                "8": 1.0,
                "9": 1.0,
                "15": 1.0,
                "16": 1.0
            },
            "Riva Cafora": {
                "2": 1.0,
                "7": 1.0,
                "9": 1.0,
                "12": 1.0,
                "16": 1.0
            },
            "Nazareno": {
                "2": 2.0,
                "3": 1.0,
                "4": 2.0,
                "8": 1.0,
                "9": 1.0,
                "10": 1.0
            },
            "Maria fois": {
                "2": 2.0,
                "8": 1.0,
                "10": 2.0
            }
        },
        "title": "Ordine 21 Gen"
    },
    {
        "sheet": "28 Gen",
        "pickup_date": "2026-01-28",
        "open_date": "2026-01-21",
        "products": [
            {
                "name": "aglio",
                "variant": "bianco",
                "format": "100 g",
                "unit_price": 1.5,
                "notes": ""
            },
            {
                "name": "batata",
                "variant": "",
                "format": "500 g",
                "unit_price": 2.5,
                "notes": "az agr miglio francesco varallo pombia"
            },
            {
                "name": "carota",
                "variant": "",
                "format": "500 g",
                "unit_price": 1.75,
                "notes": "az agr miglio francesco varallo pombia"
            },
            {
                "name": "cavolo",
                "variant": "cappuccio rosso",
                "format": "1 kg",
                "unit_price": 3.5,
                "notes": ""
            },
            {
                "name": "cavolo",
                "variant": "verza",
                "format": "1 kg",
                "unit_price": 3.5,
                "notes": ""
            },
            {
                "name": "cicoria",
                "variant": "pan di zucchero",
                "format": "500 g",
                "unit_price": 1.75,
                "notes": ""
            },
            {
                "name": "cipolla",
                "variant": "dorata",
                "format": "500 g",
                "unit_price": 1.75,
                "notes": ""
            },
            {
                "name": "cipolla",
                "variant": "rossa tipo tropea",
                "format": "500 g",
                "unit_price": 2.5,
                "notes": ""
            },
            {
                "name": "finocchio",
                "variant": "",
                "format": "500 g",
                "unit_price": 1.75,
                "notes": ""
            },
            {
                "name": "mela",
                "variant": "goldrush",
                "format": "1 kg",
                "unit_price": 3.2,
                "notes": "az agr cascina dulcamara romentino"
            },
            {
                "name": "patata",
                "variant": "pasta gialla buccia gialla",
                "format": "1 kg",
                "unit_price": 2.3,
                "notes": "az agr miglio francesco varallo pombia"
            },
            {
                "name": "patata",
                "variant": "pasta gialla buccia rossa",
                "format": "1 kg",
                "unit_price": 2.3,
                "notes": "az agr miglio francesco varallo pombia"
            },
            {
                "name": "porro",
                "variant": "",
                "format": "500 g",
                "unit_price": 1.75,
                "notes": ""
            },
            {
                "name": "radicchio",
                "variant": "tondo rosso",
                "format": "300 g",
                "unit_price": 1.5,
                "notes": ""
            },
            {
                "name": "rapa",
                "variant": "colletto viola",
                "format": "500 g",
                "unit_price": 2.0,
                "notes": "poca disponibilità"
            },
            {
                "name": "scalogno",
                "variant": "",
                "format": "100 g",
                "unit_price": 1.5,
                "notes": "az agr cascina dulcamara romentino"
            },
            {
                "name": "spinacio",
                "variant": "",
                "format": "500 g",
                "unit_price": 3.0,
                "notes": "poca disponibilità"
            },
            {
                "name": "topinambur",
                "variant": "",
                "format": "250 g",
                "unit_price": 1.13,
                "notes": ""
            },
            {
                "name": "valeriana",
                "variant": "",
                "format": "100 g",
                "unit_price": 1.2,
                "notes": "poca disponibilità"
            },
            {
                "name": "zucca",
                "variant": "delica",
                "format": "1 kg",
                "unit_price": 3.2,
                "notes": ""
            },
            {
                "name": "zucca",
                "variant": "piacentina",
                "format": "1 kg",
                "unit_price": 3.2,
                "notes": ""
            }
        ],
        "orders": {
            "Malacrinò": {
                "0": 1.0,
                "2": 2.0,
                "5": 2.0,
                "8": 2.0,
                "19": 1.0,
                "20": 1.0
            },
            "Miglierina": {
                "3": 1.0,
                "6": 1.0,
                "8": 1.0,
                "9": 1.0,
                "10": 1.0,
                "11": 1.0,
                "13": 1.0,
                "15": 1.0,
                "20": 1.0
            },
            "Di Simine": {
                "1": 1.0,
                "2": 1.0,
                "10": 1.0,
                "14": 1.0,
                "16": 1.0,
                "17": 1.0,
                "18": 1.0,
                "20": 1.0
            },
            "Favalli": {
                "6": 1.0,
                "9": 1.0,
                "10": 1.0,
                "16": 1.0
            },
            "Riva Cafora": {
                "2": 1.0,
                "16": 1.0
            },
            "Eva": {
                "2": 1.0,
                "8": 1.0,
                "12": 1.0,
                "16": 1.0,
                "20": 1.0
            },
            "Nazareno": {
                "8": 2.0,
                "9": 1.0,
                "12": 2.0,
                "16": 1.0
            },
            "Maria fois": {
                "5": 1.0,
                "8": 1.0,
                "13": 1.0,
                "16": 1.0
            }
        },
        "title": "Ordine 28 Gen"
    },
    {
        "sheet": "04 Feb",
        "pickup_date": "2026-02-04",
        "open_date": "2026-01-28",
        "products": [
            {
                "name": "aglio",
                "variant": "bianco",
                "format": "100 g",
                "unit_price": 1.5,
                "notes": ""
            },
            {
                "name": "batata",
                "variant": "",
                "format": "500 g",
                "unit_price": 2.5,
                "notes": "az agr miglio francesco varallo pombia"
            },
            {
                "name": "carota",
                "variant": "",
                "format": "500 g",
                "unit_price": 1.75,
                "notes": "az agr miglio francesco varallo pombia"
            },
            {
                "name": "cavolo",
                "variant": "cappuccio rosso",
                "format": "1 kg",
                "unit_price": 3.5,
                "notes": ""
            },
            {
                "name": "cavolo",
                "variant": "verza",
                "format": "1 kg",
                "unit_price": 3.5,
                "notes": ""
            },
            {
                "name": "cicoria",
                "variant": "pan di zucchero",
                "format": "500 g",
                "unit_price": 1.75,
                "notes": ""
            },
            {
                "name": "cipolla",
                "variant": "dorata",
                "format": "500 g",
                "unit_price": 1.75,
                "notes": ""
            },
            {
                "name": "cipolla",
                "variant": "rossa tipo tropea",
                "format": "500 g",
                "unit_price": 2.5,
                "notes": ""
            },
            {
                "name": "finocchio",
                "variant": "",
                "format": "500 g",
                "unit_price": 1.75,
                "notes": ""
            },
            {
                "name": "mela",
                "variant": "goldrush",
                "format": "1 kg",
                "unit_price": 3.2,
                "notes": "az agr cascina dulcamara romentino"
            },
            {
                "name": "patata",
                "variant": "pasta gialla buccia gialla",
                "format": "1 kg",
                "unit_price": 2.3,
                "notes": "az agr miglio francesco varallo pombia"
            },
            {
                "name": "patata",
                "variant": "pasta gialla buccia rossa",
                "format": "1 kg",
                "unit_price": 2.3,
                "notes": "az agr miglio francesco varallo pombia"
            },
            {
                "name": "porro",
                "variant": "",
                "format": "500 g",
                "unit_price": 1.75,
                "notes": ""
            },
            {
                "name": "radicchio",
                "variant": "tondo rosso",
                "format": "300 g",
                "unit_price": 1.5,
                "notes": ""
            },
            {
                "name": "scalogno",
                "variant": "",
                "format": "100 g",
                "unit_price": 1.5,
                "notes": "az agr cascina dulcamara romentino"
            },
            {
                "name": "spinacio",
                "variant": "",
                "format": "500 g",
                "unit_price": 3.0,
                "notes": "poca disponibilità"
            },
            {
                "name": "topinambur",
                "variant": "",
                "format": "250 g",
                "unit_price": 1.13,
                "notes": ""
            },
            {
                "name": "valeriana",
                "variant": "",
                "format": "100 g",
                "unit_price": 1.2,
                "notes": "poca disponibilità"
            },
            {
                "name": "zucca",
                "variant": "delica",
                "format": "1 kg",
                "unit_price": 3.2,
                "notes": ""
            },
            {
                "name": "zucca",
                "variant": "piacentina",
                "format": "1 kg",
                "unit_price": 3.2,
                "notes": "poca disponibilità"
            }
        ],
        "orders": {
            "Di Mauro": {
                "0": 1.0,
                "3": 1.0,
                "10": 1.0
            },
            "Malacrinò": {
                "2": 3.0,
                "4": 1.0,
                "8": 1.0,
                "9": 1.0,
                "12": 1.0,
                "15": 1.0,
                "17": 1.0
            },
            "Miglierina": {
                "8": 1.0,
                "9": 1.0,
                "11": 1.0,
                "12": 1.0
            },
            "Di Simine": {
                "1": 1.0,
                "2": 1.0,
                "4": 1.0,
                "9": 1.0,
                "11": 1.0,
                "12": 1.0,
                "13": 1.0,
                "16": 1.0,
                "17": 1.0
            },
            "Ballabio": {
                "4": 1.0,
                "8": 1.0,
                "10": 1.0,
                "12": 1.0
            }
        },
        "title": "Ordine 04 Feb"
    },
    {
        "sheet": "11 Feb",
        "pickup_date": "2026-02-11",
        "open_date": "2026-02-04",
        "products": [
            {
                "name": "aglio",
                "variant": "bianco",
                "format": "100 g",
                "unit_price": 1.5,
                "notes": ""
            },
            {
                "name": "batata",
                "variant": "",
                "format": "500 g",
                "unit_price": 2.5,
                "notes": "poca disponibilità; az agr miglio francesco varallo pombia"
            },
            {
                "name": "carota",
                "variant": "",
                "format": "500 g",
                "unit_price": 1.75,
                "notes": "az agr miglio francesco varallo pombia"
            },
            {
                "name": "cavolo",
                "variant": "cappuccio rosso",
                "format": "1 kg",
                "unit_price": 3.5,
                "notes": ""
            },
            {
                "name": "cavolo",
                "variant": "verza",
                "format": "1 kg",
                "unit_price": 3.5,
                "notes": ""
            },
            {
                "name": "cicoria",
                "variant": "pan di zucchero",
                "format": "500 g",
                "unit_price": 1.75,
                "notes": ""
            },
            {
                "name": "cipolla",
                "variant": "dorata",
                "format": "500 g",
                "unit_price": 1.75,
                "notes": ""
            },
            {
                "name": "cipolla",
                "variant": "rossa tipo tropea",
                "format": "500 g",
                "unit_price": 2.5,
                "notes": ""
            },
            {
                "name": "finocchio",
                "variant": "",
                "format": "500 g",
                "unit_price": 1.75,
                "notes": ""
            },
            {
                "name": "mela",
                "variant": "goldrush",
                "format": "1 kg",
                "unit_price": 3.2,
                "notes": "az agr cascina dulcamara romentino"
            },
            {
                "name": "patata",
                "variant": "pasta gialla buccia gialla",
                "format": "1 kg",
                "unit_price": 2.3,
                "notes": "az agr miglio francesco varallo pombia"
            },
            {
                "name": "patata",
                "variant": "pasta gialla buccia rossa",
                "format": "1 kg",
                "unit_price": 2.3,
                "notes": "poca disponibilità; az agr miglio francesco varallo pombia"
            },
            {
                "name": "porro",
                "variant": "",
                "format": "500 g",
                "unit_price": 1.75,
                "notes": ""
            },
            {
                "name": "radicchio",
                "variant": "tondo rosso",
                "format": "300 g",
                "unit_price": 1.5,
                "notes": ""
            },
            {
                "name": "scalogno",
                "variant": "",
                "format": "100 g",
                "unit_price": 1.5,
                "notes": "az agr cascina dulcamara romentino"
            },
            {
                "name": "spinacio",
                "variant": "",
                "format": "500 g",
                "unit_price": 3.0,
                "notes": "poca disponibilità"
            },
            {
                "name": "topinambur",
                "variant": "",
                "format": "250 g",
                "unit_price": 1.13,
                "notes": ""
            },
            {
                "name": "zucca",
                "variant": "delica",
                "format": "1 kg",
                "unit_price": 3.2,
                "notes": ""
            }
        ],
        "orders": {
            "Di Mauro": {
                "8": 1.0,
                "15": 1.0
            },
            "Malacrinò": {
                "2": 1.0,
                "4": 1.0,
                "6": 1.0,
                "7": 1.0,
                "9": 1.0,
                "11": 1.0
            },
            "Miglierina": {
                "7": 1.0,
                "13": 1.0
            },
            "Eva": {
                "4": 1.0,
                "15": 1.0
            },
            "Maria fois": {
                "7": 1.0,
                "15": 1.0
            },
            "Rossin - Ravelli": {
                "2": 1.0,
                "4": 1.0,
                "8": 1.0,
                "10": 1.0,
                "12": 2.0,
                "15": 1.0
            }
        },
        "title": "Ordine 11 Feb"
    },
    {
        "sheet": "18 feb",
        "pickup_date": "2026-02-18",
        "open_date": "2026-02-11",
        "products": [
            {
                "name": "aglio",
                "variant": "bianco",
                "format": "100 g",
                "unit_price": 1.5,
                "notes": ""
            },
            {
                "name": "batata",
                "variant": "",
                "format": "500 g",
                "unit_price": 2.5,
                "notes": "poca disponibilità; az agr miglio francesco varallo pombia"
            },
            {
                "name": "carota",
                "variant": "",
                "format": "500 g",
                "unit_price": 1.75,
                "notes": "az agr miglio francesco varallo pombia"
            },
            {
                "name": "cavolo",
                "variant": "cappuccio rosso",
                "format": "1 kg",
                "unit_price": 3.5,
                "notes": ""
            },
            {
                "name": "cavolo",
                "variant": "verza",
                "format": "1 kg",
                "unit_price": 3.5,
                "notes": ""
            },
            {
                "name": "cicoria",
                "variant": "catalogna",
                "format": "500 g",
                "unit_price": 2.0,
                "notes": "poca disponibilità"
            },
            {
                "name": "cicoria",
                "variant": "pan di zucchero",
                "format": "500 g",
                "unit_price": 1.75,
                "notes": ""
            },
            {
                "name": "cipolla",
                "variant": "dorata",
                "format": "500 g",
                "unit_price": 1.75,
                "notes": ""
            },
            {
                "name": "cipolla",
                "variant": "rossa tipo tropea",
                "format": "500 g",
                "unit_price": 2.5,
                "notes": ""
            },
            {
                "name": "finocchio",
                "variant": "",
                "format": "500 g",
                "unit_price": 1.75,
                "notes": ""
            },
            {
                "name": "mela",
                "variant": "goldrush",
                "format": "1 kg",
                "unit_price": 3.2,
                "notes": "az agr cascina dulcamara romentino"
            },
            {
                "name": "patata",
                "variant": "pasta gialla buccia gialla",
                "format": "1 kg",
                "unit_price": 2.3,
                "notes": "az agr miglio francesco varallo pombia"
            },
            {
                "name": "porro",
                "variant": "",
                "format": "500 g",
                "unit_price": 1.75,
                "notes": ""
            },
            {
                "name": "radicchio",
                "variant": "tondo rosso",
                "format": "300 g",
                "unit_price": 1.5,
                "notes": ""
            },
            {
                "name": "scalogno",
                "variant": "",
                "format": "100 g",
                "unit_price": 1.5,
                "notes": "az agr cascina dulcamara romentino"
            },
            {
                "name": "spinacio",
                "variant": "",
                "format": "500 g",
                "unit_price": 3.0,
                "notes": "poca disponibilità"
            },
            {
                "name": "topinambur",
                "variant": "",
                "format": "250 g",
                "unit_price": 1.13,
                "notes": ""
            },
            {
                "name": "zucca",
                "variant": "delica",
                "format": "1 kg",
                "unit_price": 3.2,
                "notes": ""
            }
        ],
        "orders": {
            "Di Mauro": {
                "6": 1.0,
                "13": 1.0,
                "15": 2.0
            },
            "Miglierina": {
                "3": 1.0,
                "9": 1.0,
                "10": 1.0,
                "13": 1.0
            },
            "Di Simine": {
                "1": 1.0,
                "2": 1.0,
                "4": 1.0,
                "9": 1.0,
                "13": 1.0,
                "15": 1.0,
                "16": 1.0
            },
            "Riva Cafora": {
                "15": 1.0,
                "17": 1.0
            },
            "Nazareno": {
                "2": 1.0,
                "4": 1.0,
                "11": 1.0
            },
            "Maria fois": {
                "9": 2.0,
                "11": 2.0,
                "15": 2.0
            },
            "Rossin - Ravelli": {
                "5": 1.0,
                "8": 1.0,
                "14": 1.0,
                "15": 2.0
            }
        },
        "title": "Ordine 18 feb"
    },
    {
        "sheet": "25 feb",
        "pickup_date": "2026-02-25",
        "open_date": "2026-02-18",
        "products": [
            {
                "name": "aglio",
                "variant": "bianco",
                "format": "100 g",
                "unit_price": 1.5,
                "notes": ""
            },
            {
                "name": "batata",
                "variant": "",
                "format": "500 g",
                "unit_price": 2.5,
                "notes": "poca disponibilità; az agr miglio francesco varallo pombia"
            },
            {
                "name": "carota",
                "variant": "",
                "format": "500 g",
                "unit_price": 1.75,
                "notes": "az agr miglio francesco varallo pombia"
            },
            {
                "name": "cavolo",
                "variant": "cappuccio bianco",
                "format": "1 kg",
                "unit_price": 3.5,
                "notes": "az agr imbevuti grignasco"
            },
            {
                "name": "cavolo",
                "variant": "cappuccio rosso",
                "format": "1 kg",
                "unit_price": 3.5,
                "notes": ""
            },
            {
                "name": "cavolo",
                "variant": "cinese",
                "format": "1 kg",
                "unit_price": 3.5,
                "notes": "az agr imbevuti grignasco"
            },
            {
                "name": "cavolo",
                "variant": "navone",
                "format": "1 kg",
                "unit_price": 3.5,
                "notes": "az agr imbevuti grignasco"
            },
            {
                "name": "cavolo",
                "variant": "verza",
                "format": "1 kg",
                "unit_price": 3.5,
                "notes": ""
            },
            {
                "name": "cicoria",
                "variant": "catalogna",
                "format": "500 g",
                "unit_price": 2.0,
                "notes": "poca disponibilità"
            },
            {
                "name": "cicoria",
                "variant": "pan di zucchero",
                "format": "500 g",
                "unit_price": 1.75,
                "notes": ""
            },
            {
                "name": "cipolla",
                "variant": "dorata",
                "format": "500 g",
                "unit_price": 1.75,
                "notes": ""
            },
            {
                "name": "cipolla",
                "variant": "rossa tipo tropea",
                "format": "500 g",
                "unit_price": 2.5,
                "notes": "poca disponibilità"
            },
            {
                "name": "finocchio",
                "variant": "",
                "format": "500 g",
                "unit_price": 1.75,
                "notes": ""
            },
            {
                "name": "mela",
                "variant": "goldrush",
                "format": "1 kg",
                "unit_price": 3.2,
                "notes": "az agr cascina dulcamara romentino"
            },
            {
                "name": "patata",
                "variant": "pasta gialla buccia gialla",
                "format": "1 kg",
                "unit_price": 2.3,
                "notes": "az agr miglio francesco varallo pombia"
            },
            {
                "name": "patata",
                "variant": "pasta gialla buccia rossa",
                "format": "1 kg",
                "unit_price": 2.3,
                "notes": "az agr imbevuti grignasco"
            },
            {
                "name": "porro",
                "variant": "",
                "format": "500 g",
                "unit_price": 1.75,
                "notes": ""
            },
            {
                "name": "radicchio",
                "variant": "tondo rosso",
                "format": "300 g",
                "unit_price": 1.5,
                "notes": ""
            },
            {
                "name": "scalogno",
                "variant": "",
                "format": "100 g",
                "unit_price": 1.5,
                "notes": "az agr cascina dulcamara romentino"
            },
            {
                "name": "spinacio",
                "variant": "",
                "format": "500 g",
                "unit_price": 3.0,
                "notes": "poca disponibilità"
            },
            {
                "name": "topinambur",
                "variant": "",
                "format": "250 g",
                "unit_price": 1.13,
                "notes": ""
            },
            {
                "name": "zucca",
                "variant": "delica",
                "format": "1 kg",
                "unit_price": 3.2,
                "notes": ""
            }
        ],
        "orders": {
            "Miglierina": {
                "0": 1.0,
                "2": 1.0,
                "5": 1.0,
                "8": 1.0,
                "12": 1.0,
                "13": 1.0,
                "16": 1.0,
                "21": 1.0
            },
            "Gianquinto": {
                "5": 1.0,
                "15": 1.0,
                "20": 1.0
            },
            "Di Simine": {
                "16": 1.0,
                "17": 1.0,
                "21": 1.0
            },
            "Favalli": {
                "0": 1.0,
                "4": 1.0,
                "13": 1.0,
                "14": 1.0,
                "15": 1.0,
                "16": 1.0,
                "18": 1.0,
                "19": 1.0
            },
            "Riva Cafora": {
                "2": 1.0,
                "4": 1.0,
                "17": 1.0
            },
            "Nazareno": {
                "12": 1.0,
                "13": 1.0,
                "17": 1.0
            },
            "Maria fois": {
                "0": 1.0,
                "1": 1.0,
                "2": 1.0,
                "5": 1.0,
                "8": 1.0,
                "12": 1.0,
                "19": 1.0
            }
        },
        "title": "Ordine 25 feb"
    },
    {
        "sheet": "11 mar",
        "pickup_date": "2026-03-11",
        "open_date": "2026-03-04",
        "products": [
            {
                "name": "aglio",
                "variant": "bianco",
                "format": "100 g",
                "unit_price": 1.5,
                "notes": ""
            },
            {
                "name": "carota",
                "variant": "",
                "format": "500 g",
                "unit_price": 1.75,
                "notes": "az agr miglio francesco varallo pombia"
            },
            {
                "name": "cavolo",
                "variant": "broccolo (fiolaro o sarno o spigarello)",
                "format": "sacchetto",
                "unit_price": 2.0,
                "notes": "poca disponibilità"
            },
            {
                "name": "cavolo",
                "variant": "cappuccio bianco",
                "format": "1 kg",
                "unit_price": 3.5,
                "notes": "az agr imbevuti grignasco"
            },
            {
                "name": "cavolo",
                "variant": "cappuccio rosso",
                "format": "1 kg",
                "unit_price": 3.5,
                "notes": ""
            },
            {
                "name": "cavolo",
                "variant": "cinese",
                "format": "1 kg",
                "unit_price": 3.5,
                "notes": "az agr imbevuti grignasco"
            },
            {
                "name": "cavolo",
                "variant": "navone",
                "format": "1 kg",
                "unit_price": 3.5,
                "notes": "az agr imbevuti grignasco"
            },
            {
                "name": "cavolo",
                "variant": "nero",
                "format": "sacchetto",
                "unit_price": 2.0,
                "notes": "poca disponibilità"
            },
            {
                "name": "cavolo",
                "variant": "verza",
                "format": "1 kg",
                "unit_price": 3.5,
                "notes": ""
            },
            {
                "name": "cicoria",
                "variant": "catalogna",
                "format": "500 g",
                "unit_price": 2.0,
                "notes": "poca disponibilità"
            },
            {
                "name": "cicoria",
                "variant": "pan di zucchero",
                "format": "500 g",
                "unit_price": 1.75,
                "notes": ""
            },
            {
                "name": "cipolla",
                "variant": "dorata",
                "format": "500 g",
                "unit_price": 1.75,
                "notes": ""
            },
            {
                "name": "patata",
                "variant": "pasta gialla buccia gialla",
                "format": "1 kg",
                "unit_price": 2.3,
                "notes": "az agr miglio francesco varallo pombia"
            },
            {
                "name": "radicchio",
                "variant": "tondo rosso",
                "format": "300 g",
                "unit_price": 1.5,
                "notes": ""
            },
            {
                "name": "scalogno",
                "variant": "",
                "format": "100 g",
                "unit_price": 1.5,
                "notes": "poca disponibilità; az agr cascina dulcamara romentino"
            },
            {
                "name": "spinacio",
                "variant": "",
                "format": "500 g",
                "unit_price": 3.0,
                "notes": "poca disponibilità"
            },
            {
                "name": "topinambur",
                "variant": "",
                "format": "250 g",
                "unit_price": 1.13,
                "notes": ""
            }
        ],
        "orders": {
            "Di Mauro": {
                "2": 1.0,
                "5": 1.0,
                "15": 1.0
            },
            "Miglierina": {
                "2": 1.0,
                "3": 1.0,
                "11": 1.0,
                "12": 1.0,
                "13": 1.0,
                "14": 1.0
            },
            "Di Simine": {
                "1": 1.0,
                "2": 1.0,
                "4": 1.0,
                "7": 1.0
            },
            "Favalli": {
                "1": 1.0,
                "4": 1.0,
                "11": 1.0,
                "14": 1.0,
                "15": 1.0
            },
            "Riva Cafora": {
                "7": 1.0,
                "16": 1.0
            },
            "Eva": {
                "2": 1.0,
                "4": 1.0,
                "16": 1.0
            },
            "Maria fois": {
                "9": 1.0,
                "10": 1.0,
                "13": 1.0,
                "15": 1.0
            },
            "Rossin - Ravelli": {
                "0": 1.0,
                "2": 1.0,
                "9": 1.0,
                "10": 1.0,
                "11": 2.0,
                "12": 2.0,
                "15": 2.0
            }
        },
        "title": "Ordine 11 mar"
    },
    {
        "sheet": "25 mar",
        "pickup_date": "2026-03-25",
        "open_date": "2026-03-18",
        "products": [
            {
                "name": "aglio",
                "variant": "bianco",
                "format": "100 g",
                "unit_price": 1.5,
                "notes": ""
            },
            {
                "name": "carota",
                "variant": "",
                "format": "500 g",
                "unit_price": 1.75,
                "notes": "az agr miglio francesco varallo pombia"
            },
            {
                "name": "cavolo",
                "variant": "cappuccio rosso",
                "format": "1 kg",
                "unit_price": 3.5,
                "notes": ""
            },
            {
                "name": "cavolo",
                "variant": "cinese",
                "format": "1 kg",
                "unit_price": 3.5,
                "notes": "az agr imbevuti grignasco"
            },
            {
                "name": "cavolo",
                "variant": "verza",
                "format": "1 kg",
                "unit_price": 3.5,
                "notes": ""
            },
            {
                "name": "cicoria",
                "variant": "catalogna",
                "format": "500 g",
                "unit_price": 2.0,
                "notes": "poca disponibilità"
            },
            {
                "name": "cicoria",
                "variant": "pan di zucchero",
                "format": "500 g",
                "unit_price": 1.75,
                "notes": ""
            },
            {
                "name": "cima di rapa",
                "variant": "",
                "format": "500 g",
                "unit_price": 3.0,
                "notes": "az agr miglio francesco varallo pombia"
            },
            {
                "name": "cipolla",
                "variant": "dorata",
                "format": "500 g",
                "unit_price": 1.75,
                "notes": ""
            },
            {
                "name": "cipollotto",
                "variant": "",
                "format": "mazzo",
                "unit_price": 2.0,
                "notes": "az agr miglio francesco varallo pombia"
            },
            {
                "name": "patata",
                "variant": "pasta gialla buccia gialla",
                "format": "1 kg",
                "unit_price": 2.3,
                "notes": "az agr miglio francesco varallo pombia"
            },
            {
                "name": "radicchio",
                "variant": "tondo rosso",
                "format": "300 g",
                "unit_price": 1.5,
                "notes": ""
            },
            {
                "name": "scalogno",
                "variant": "",
                "format": "100 g",
                "unit_price": 1.5,
                "notes": "poca disponibilità; az agr cascina dulcamara romentino"
            },
            {
                "name": "spinacio",
                "variant": "",
                "format": "500 g",
                "unit_price": 3.0,
                "notes": "poca disponibilità"
            },
            {
                "name": "topinambur",
                "variant": "",
                "format": "250 g",
                "unit_price": 1.13,
                "notes": ""
            }
        ],
        "orders": {
            "Di Mauro": {
                "3": 1.0,
                "7": 1.0,
                "10": 1.0,
                "13": 1.0
            },
            "Miglierina": {
                "1": 1.0,
                "3": 1.0,
                "4": 1.0,
                "8": 1.0,
                "9": 1.0,
                "11": 1.0,
                "13": 1.0
            },
            "Gianquinto": {
                "3": 1.0,
                "7": 1.0,
                "13": 1.0,
                "14": 1.0
            },
            "Di Simine": {
                "1": 1.0,
                "2": 1.0,
                "3": 1.0,
                "7": 1.0,
                "9": 1.0,
                "11": 1.0,
                "13": 1.0,
                "14": 1.0
            },
            "Favalli": {
                "1": 1.0,
                "4": 1.0,
                "8": 1.0,
                "10": 1.0,
                "11": 1.0,
                "12": 1.0,
                "13": 1.0
            },
            "Riva Cafora": {
                "1": 1.0,
                "7": 1.0,
                "9": 1.0
            },
            "Nazareno": {
                "10": 1.0
            },
            "Maria fois": {
                "7": 1.0,
                "13": 2.0
            },
            "Rossin - Ravelli": {
                "0": 1.0,
                "6": 1.0,
                "7": 1.0,
                "8": 2.0,
                "10": 1.0,
                "13": 1.0
            }
        },
        "title": "Ordine 25 mar"
    },
    {
        "sheet": "8 apr",
        "pickup_date": "2026-04-08",
        "open_date": "2026-04-01",
        "products": [
            {
                "name": "aglio",
                "variant": "bianco",
                "format": "100 g",
                "unit_price": 1.5,
                "notes": "poca disponibilità"
            },
            {
                "name": "aglio",
                "variant": "bianco fresco",
                "format": "mazzo",
                "unit_price": 1.5,
                "notes": "poca disponibilità"
            },
            {
                "name": "aglio serpentino",
                "variant": "",
                "format": "mazzo",
                "unit_price": 1.0,
                "notes": "poca disponibilità"
            },
            {
                "name": "carota",
                "variant": "",
                "format": "500 g",
                "unit_price": 1.75,
                "notes": "az agr miglio francesco varallo pombia"
            },
            {
                "name": "cavolo",
                "variant": "cappuccio rosso",
                "format": "1 kg",
                "unit_price": 3.5,
                "notes": "poca disponibilità"
            },
            {
                "name": "cavolo",
                "variant": "verza",
                "format": "1 kg",
                "unit_price": 3.5,
                "notes": "poca disponibilità"
            },
            {
                "name": "cicoria",
                "variant": "catalogna",
                "format": "300 g",
                "unit_price": 1.35,
                "notes": "poca disponibilità"
            },
            {
                "name": "cicoria",
                "variant": "da taglio",
                "format": "mazzo",
                "unit_price": 1.0,
                "notes": ""
            },
            {
                "name": "cicoria",
                "variant": "pan di zucchero",
                "format": "500 g",
                "unit_price": 2.0,
                "notes": ""
            },
            {
                "name": "cipolla",
                "variant": "dorata",
                "format": "500 g",
                "unit_price": 1.75,
                "notes": ""
            },
            {
                "name": "cipollotto",
                "variant": "",
                "format": "mazzo",
                "unit_price": 2.0,
                "notes": "az agr miglio francesco varallo pombia"
            },
            {
                "name": "ortica",
                "variant": "",
                "format": "100 g",
                "unit_price": 3.0,
                "notes": ""
            },
            {
                "name": "patata",
                "variant": "pasta gialla buccia gialla",
                "format": "1 kg",
                "unit_price": 2.3,
                "notes": "az agr miglio francesco varallo pombia"
            },
            {
                "name": "radicchio",
                "variant": "tondo rosso",
                "format": "300 g",
                "unit_price": 1.5,
                "notes": ""
            },
            {
                "name": "scalogno",
                "variant": "",
                "format": "100 g",
                "unit_price": 1.5,
                "notes": "poca disponibilità; az agr cascina dulcamara romentino"
            },
            {
                "name": "spinacio",
                "variant": "",
                "format": "500 g",
                "unit_price": 3.0,
                "notes": "poca disponibilità"
            },
            {
                "name": "topinambur",
                "variant": "",
                "format": "250 g",
                "unit_price": 1.13,
                "notes": "poca disponibilità"
            }
        ],
        "orders": {
            "Di Mauro": {
                "4": 1.0,
                "7": 1.0,
                "15": 1.0
            },
            "Rossin - Ravelli": {
                "3": 1.0,
                "8": 1.0,
                "13": 1.0,
                "15": 2.0
            }
        },
        "title": "Ordine 8 apr"
    }
];

  cycles.forEach(function(c, ci) {
    var cycleId = generateId_("cyc");
    cycleObjects.push({
      cycle_id: cycleId,
      title: c.title,
      pickup_date: c.pickup_date,
      order_open_at: c.open_date + "T00:00:00.000Z",
      order_close_at: c.pickup_date + "T00:00:00.000Z",
      status: "closed",
      notes: "Importato da Excel",
      created_by: "migrazione",
      created_at: c.open_date + "T00:00:00.000Z",
      closed_at: c.pickup_date + "T00:00:00.000Z"
    });

    // Prodotti
    var prodIds = [];
    c.products.forEach(function(p, pi) {
      var pid = generateId_("prd");
      prodIds.push(pid);
      allProducts.push({
        product_id: pid, cycle_id: cycleId,
        name: p.name, variant: p.variant, format: p.format,
        unit_price: p.unit_price, supplier: "", notes: p.notes,
        sort_order: pi + 1, active: true
      });
    });

    // Ordini
    var orderCount = 0;
    Object.keys(c.orders).forEach(function(memberName) {
      var mid = memberMap[memberName];
      if (!mid) { Logger.log("  WARN: socio non trovato: " + memberName); return; }
      var items = c.orders[memberName];
      Object.keys(items).forEach(function(prodIdx) {
        var qty = items[prodIdx];
        var prod = c.products[parseInt(prodIdx)];
        var pid = prodIds[parseInt(prodIdx)];
        if (!prod || !pid) return;
        var lineTotal = Math.round(qty * prod.unit_price * 100) / 100;
        allOrders.push({
          order_line_id: generateId_("ord"),
          cycle_id: cycleId, member_id: mid, product_id: pid,
          quantity: qty, unit_price_snapshot: prod.unit_price,
          line_total: lineTotal, updated_at: c.pickup_date + "T00:00:00.000Z"
        });
        orderCount++;
      });
    });
    Logger.log("  " + c.title + ": " + c.products.length + " prodotti, " + orderCount + " righe ordine");
  });

  // ── 3. Bonifici ──
  var bonifici = [
    {
        "member": "Di Mauro",
        "type": "topup",
        "amount": 50.0,
        "note": "BONIFICO 1"
    },
    {
        "member": "Malacrinò",
        "type": "topup",
        "amount": 50.0,
        "note": "BONIFICO 1"
    },
    {
        "member": "Miglierina",
        "type": "topup",
        "amount": 50.0,
        "note": "BONIFICO 1"
    },
    {
        "member": "Gianquinto",
        "type": "topup",
        "amount": 50.0,
        "note": "BONIFICO 1"
    },
    {
        "member": "Di Simine",
        "type": "topup",
        "amount": 50.0,
        "note": "BONIFICO 1"
    },
    {
        "member": "Favalli",
        "type": "topup",
        "amount": 50.0,
        "note": "BONIFICO 1"
    },
    {
        "member": "Riva Cafora",
        "type": "topup",
        "amount": 50.0,
        "note": "BONIFICO 1"
    },
    {
        "member": "Eva",
        "type": "topup",
        "amount": 50.0,
        "note": "BONIFICO 1"
    },
    {
        "member": "Nazareno",
        "type": "topup",
        "amount": 50.0,
        "note": "BONIFICO 1"
    },
    {
        "member": "Maria fois",
        "type": "topup",
        "amount": 50.0,
        "note": "BONIFICO 1"
    },
    {
        "member": "Ballabio",
        "type": "topup",
        "amount": 9.3,
        "note": "BONIFICO 1"
    },
    {
        "member": "Rossin - Ravelli",
        "type": "topup",
        "amount": 50.0,
        "note": "BONIFICO 1"
    },
    {
        "member": "Malacrinò",
        "type": "topup",
        "amount": 50.0,
        "note": "BONIFICO 2"
    },
    {
        "member": "Miglierina",
        "type": "topup",
        "amount": 100.0,
        "note": "BONIFICO 2"
    },
    {
        "member": "Di Simine",
        "type": "topup",
        "amount": 100.0,
        "note": "BONIFICO 2"
    },
    {
        "member": "Favalli",
        "type": "topup",
        "amount": 100.0,
        "note": "BONIFICO 2"
    },
    {
        "member": "Riva Cafora",
        "type": "topup",
        "amount": 50.0,
        "note": "BONIFICO 2"
    },
    {
        "member": "Nazareno",
        "type": "topup",
        "amount": 30.0,
        "note": "BONIFICO 2"
    },
    {
        "member": "Maria fois",
        "type": "topup",
        "amount": 50.0,
        "note": "BONIFICO 2"
    },
    {
        "member": "Rossin - Ravelli",
        "type": "topup",
        "amount": 50.0,
        "note": "BONIFICO 2"
    },
    {
        "member": "Di Mauro",
        "type": "topup",
        "amount": 50.0,
        "note": "BONIFICO 3"
    },
    {
        "member": "Maria fois",
        "type": "topup",
        "amount": 50.0,
        "note": "BONIFICO 3"
    },
    {
        "member": "Rossin - Ravelli",
        "type": "topup",
        "amount": 100.0,
        "note": "BONIFICO 3"
    }
];

  bonifici.forEach(function(b) {
    var mid = memberMap[b.member];
    if (!mid) return;
    allLedger.push({
      entry_id: generateId_("led"),
      member_id: mid, entry_date: now,
      type: "topup", amount: b.amount,
      cycle_id: "", note: b.note + " (migrazione)",
      created_by: "migrazione", created_at: now
    });
  });
  Logger.log("Bonifici: " + bonifici.length);

  // ── 4. Addebiti ordini da CASSA ──
  // Calcola il totale ordini per socio e aggiungi addebiti aggregati
  var memberTotals = {}; // member_id -> total order amount
  allOrders.forEach(function(o) {
    if (!memberTotals[o.member_id]) memberTotals[o.member_id] = 0;
    memberTotals[o.member_id] += o.line_total;
  });

  // Aggiungi un singolo addebito aggregato per socio
  Object.keys(memberTotals).forEach(function(mid) {
    var total = Math.round(memberTotals[mid] * 100) / 100;
    if (total > 0) {
      allLedger.push({
        entry_id: generateId_("led"),
        member_id: mid, entry_date: now,
        type: "order_charge", amount: -total,
        cycle_id: "", note: "Addebiti ordini pregressi (migrazione)",
        created_by: "migrazione", created_at: now
      });
    }
  });

  // ── 5. Verifica e rettifica saldi ──
  var expectedBalances = {
    "Di Mauro": 6.9,
    "Malacrinò": -5.55,
    "Miglierina": -34.6,
    "Gianquinto": 6.5,
    "Di Simine": -11.4,
    "Favalli": -12.05,
    "Riva Cafora": 4.9,
    "Eva": -4.0,
    "Nazareno": 7.8,
    "Maria fois": -10.7,
    "Ballabio": 2.2,
    "Cucchiara A.": 0.0,
    "Cadelano L.": 0.0,
    "Rossin - Ravelli": 39.25,
    "Porta Moneta": -18.5
};

  // Calcola saldi dopo bonifici + addebiti
  var computedBalances = {};
  allLedger.forEach(function(e) {
    if (!computedBalances[e.member_id]) computedBalances[e.member_id] = 0;
    computedBalances[e.member_id] += e.amount;
  });

  // Rettifica per allineare ai saldi Excel
  Object.keys(expectedBalances).forEach(function(name) {
    var mid = memberMap[name];
    if (!mid) return;
    var expected = expectedBalances[name];
    var computed = Math.round((computedBalances[mid] || 0) * 100) / 100;
    var diff = Math.round((expected - computed) * 100) / 100;
    if (Math.abs(diff) > 0.01) {
      allLedger.push({
        entry_id: generateId_("led"),
        member_id: mid, entry_date: now,
        type: "adjustment", amount: diff,
        cycle_id: "", note: "Rettifica allineamento saldo Excel",
        created_by: "migrazione", created_at: now
      });
      Logger.log("  Rettifica " + name + ": " + diff + "€ (computed=" + computed + ", expected=" + expected + ")");
    }
  });

  // ── 6. Scrittura ──
  overwriteSheetObjects_(APP.SHEETS.ORDER_CYCLES, APP.HEADERS.order_cycles, cycleObjects);
  overwriteSheetObjects_(APP.SHEETS.PRODUCTS, APP.HEADERS.products, allProducts);
  overwriteSheetObjects_(APP.SHEETS.ORDERS, APP.HEADERS.orders, allOrders);
  overwriteSheetObjects_(APP.SHEETS.LEDGER_ENTRIES, APP.HEADERS.ledger_entries, allLedger);

  Logger.log("");
  Logger.log("═══ MIGRAZIONE COMPLETATA ═══");
  Logger.log("Cicli: " + cycles.length);
  Logger.log("Prodotti: " + allProducts.length);
  Logger.log("Righe ordine: " + allOrders.length);
  Logger.log("Movimenti contabili: " + allLedger.length);
}

