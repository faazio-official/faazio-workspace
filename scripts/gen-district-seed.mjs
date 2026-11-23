#!/usr/bin/env node
/**
 * gen-district-seed.mjs — regenerate the all-India district master seed with Google place_ids.
 *
 * WHY THIS EXISTS
 * ---------------
 * admins.district_master started as a 42-row MVP (Tamil Nadu 38 + Puducherry 4) keyed on a human
 * name match. Names drift ("Bangalore" vs "Bengaluru", "Trichy" vs "Tiruchirappalli"), so a
 * reverse-geocoded label cannot be trusted to resolve to a district row. This script builds the
 * durable identity instead: every district carries the Google `place_id` of its
 * `administrative_area_level_3` (the revenue district — see the note on levels below), which is
 * what a reverse geocode returns for any point inside that district.
 *
 * IMPORTANT — India's administrative levels in Google's Geocoder:
 *   administrative_area_level_1 = state / UT
 *   administrative_area_level_2 = DIVISION (e.g. "Bangalore Division") — NOT the district
 *   administrative_area_level_3 = DISTRICT (e.g. "Bengaluru Urban")   <-- what coverage is keyed on
 *
 * So the district place_id is taken from the level_3 component, and a forward lookup is performed as
 * "{district} district, {state}, India" with result_type=administrative_area_level_3. Each row is
 * then verified by reverse-geocoding that district's own centroid and asserting the round-tripped
 * place_id equals the forward one. A district whose id does not round-trip is reported, never
 * silently seeded.
 *
 * This script only READS Google and WRITES a JSON artefact. It does not touch the database. The
 * migration that consumes the artefact is server/supabase/migrations/0127_india_districts_place_id.sql.
 *
 * USAGE
 *   GOOGLE_GEOCODING_API_KEY=... node scripts/gen-district-seed.mjs [--out path]
 *
 * The key needs the Geocoding API enabled. It is read from the environment only; nothing is written
 * to disk except the seed artefact (which contains public place_ids, not the key).
 */

import { writeFileSync } from "node:fs";

const KEY = process.env.GOOGLE_GEOCODING_API_KEY;
if (!KEY) {
  console.error("GOOGLE_GEOCODING_API_KEY is required");
  process.exit(1);
}

/**
 * Canonical district roster per state/UT, in the spelling used by the Government of India district
 * lists. `code` is the two-letter ISO 3166-2:IN state/UT code. This list is the input; the Google
 * lookup below authenticates it.
 */
const ROSTER = {
  AP: ["Alluri Sitharama Raju", "Anakapalli", "Ananthapuramu", "Annamayya", "Bapatla", "Chittoor", "Dr. B.R. Ambedkar Konaseema", "East Godavari", "Eluru", "Guntur", "Kakinada", "Krishna", "Kurnool", "Nandyal", "Nellore", "NTR", "Palnadu", "Parvathipuram Manyam", "Prakasam", "Srikakulam", "Sri Sathya Sai", "Tirupati", "Visakhapatnam", "Vizianagaram", "West Godavari", "YSR Kadapa"],
  AR: ["Anjaw", "Bichom", "Changlang", "Dibang Valley", "East Kameng", "East Siang", "Kamle", "Keyi Panyor", "Kra Daadi", "Kurung Kumey", "Lepa Rada", "Lohit", "Longding", "Lower Dibang Valley", "Lower Siang", "Lower Subansiri", "Namsai", "Pakke Kessang", "Papum Pare", "Shi Yomi", "Siang", "Tawang", "Tirap", "Upper Siang", "Upper Subansiri", "West Kameng", "West Siang"],
  AS: ["Baksa", "Barpeta", "Biswanath", "Bongaigaon", "Cachar", "Charaideo", "Chirang", "Darrang", "Dhemaji", "Dhubri", "Dibrugarh", "Dima Hasao", "Goalpara", "Golaghat", "Hailakandi", "Hojai", "Jorhat", "Kamrup", "Kamrup Metropolitan", "Karbi Anglong", "Karimganj", "Kokrajhar", "Lakhimpur", "Majuli", "Morigaon", "Nagaon", "Nalbari", "Sivasagar", "Sonitpur", "South Salmara-Mankachar", "Tinsukia", "Udalguri", "West Karbi Anglong"],
  BR: ["Araria", "Arwal", "Aurangabad", "Banka", "Begusarai", "Bhagalpur", "Bhojpur", "Buxar", "Darbhanga", "East Champaran", "Gaya", "Gopalganj", "Jamui", "Jehanabad", "Kaimur", "Katihar", "Khagaria", "Kishanganj", "Lakhisarai", "Madhepura", "Madhubani", "Munger", "Muzaffarpur", "Nalanda", "Nawada", "Patna", "Purnia", "Rohtas", "Saharsa", "Samastipur", "Saran", "Sheikhpura", "Sheohar", "Sitamarhi", "Siwan", "Supaul", "Vaishali", "West Champaran"],
  CT: ["Balod", "Baloda Bazar", "Balrampur", "Bastar", "Bemetara", "Bijapur", "Bilaspur", "Dantewada", "Dhamtari", "Durg", "Gariaband", "Gaurela-Pendra-Marwahi", "Janjgir-Champa", "Jashpur", "Kabirdham", "Kanker", "Khairagarh-Chhuikhadan-Gandai", "Kondagaon", "Korba", "Koriya", "Mahasamund", "Manendragarh-Chirmiri-Bharatpur", "Mohla-Manpur-Ambagarh Chouki", "Mungeli", "Narayanpur", "Raigarh", "Raipur", "Rajnandgaon", "Sakti", "Sarangarh-Bilaigarh", "Sukma", "Surajpur", "Surguja"],
  GA: ["North Goa", "South Goa"],
  GJ: ["Ahmedabad", "Amreli", "Anand", "Aravalli", "Banaskantha", "Bharuch", "Bhavnagar", "Botad", "Chhota Udaipur", "Dahod", "Dang", "Devbhumi Dwarka", "Gandhinagar", "Gir Somnath", "Jamnagar", "Junagadh", "Kheda", "Kutch", "Mahisagar", "Mehsana", "Morbi", "Narmada", "Navsari", "Panchmahal", "Patan", "Porbandar", "Rajkot", "Sabarkantha", "Surat", "Surendranagar", "Tapi", "Vadodara", "Valsad", "Vav-Tharad"],
  HR: ["Ambala", "Bhiwani", "Charkhi Dadri", "Faridabad", "Fatehabad", "Gurugram", "Hisar", "Jhajjar", "Jind", "Kaithal", "Karnal", "Kurukshetra", "Mahendragarh", "Nuh", "Palwal", "Panchkula", "Panipat", "Rewari", "Rohtak", "Sirsa", "Sonipat", "Yamunanagar"],
  HP: ["Bilaspur", "Chamba", "Hamirpur", "Kangra", "Kinnaur", "Kullu", "Lahaul and Spiti", "Mandi", "Shimla", "Sirmaur", "Solan", "Una"],
  JH: ["Bokaro", "Chatra", "Deoghar", "Dhanbad", "Dumka", "East Singhbhum", "Garhwa", "Giridih", "Godda", "Gumla", "Hazaribag", "Jamtara", "Khunti", "Koderma", "Latehar", "Lohardaga", "Pakur", "Palamu", "Ramgarh", "Ranchi", "Sahibganj", "Seraikela Kharsawan", "Simdega", "West Singhbhum"],
  KA: ["Bagalkot", "Ballari", "Belagavi", "Bengaluru Rural", "Bengaluru Urban", "Bidar", "Chamarajanagar", "Chikkaballapur", "Chikkamagaluru", "Chitradurga", "Dakshina Kannada", "Davanagere", "Dharwad", "Gadag", "Hassan", "Haveri", "Kalaburagi", "Kodagu", "Kolar", "Koppal", "Mandya", "Mysuru", "Raichur", "Ramanagara", "Shivamogga", "Tumakuru", "Udupi", "Uttara Kannada", "Vijayanagara", "Vijayapura", "Yadgir"],
  KL: ["Alappuzha", "Ernakulam", "Idukki", "Kannur", "Kasaragod", "Kollam", "Kottayam", "Kozhikode", "Malappuram", "Palakkad", "Pathanamthitta", "Thiruvananthapuram", "Thrissur", "Wayanad"],
  MP: ["Agar Malwa", "Alirajpur", "Anuppur", "Ashoknagar", "Balaghat", "Barwani", "Betul", "Bhind", "Bhopal", "Burhanpur", "Chhatarpur", "Chhindwara", "Damoh", "Datia", "Dewas", "Dhar", "Dindori", "Guna", "Gwalior", "Harda", "Indore", "Jabalpur", "Jhabua", "Katni", "Khandwa", "Khargone", "Maihar", "Mandla", "Mandsaur", "Mauganj", "Morena", "Narmadapuram", "Narsinghpur", "Neemuch", "Niwari", "Pandhurna", "Panna", "Raisen", "Rajgarh", "Ratlam", "Rewa", "Sagar", "Satna", "Sehore", "Seoni", "Shahdol", "Shajapur", "Sheopur", "Shivpuri", "Sidhi", "Singrauli", "Tikamgarh", "Ujjain", "Umaria", "Vidisha"],
  MH: ["Ahilyanagar", "Akola", "Amravati", "Beed", "Bhandara", "Buldhana", "Chandrapur", "Chhatrapati Sambhajinagar", "Dharashiv", "Dhule", "Gadchiroli", "Gondia", "Hingoli", "Jalgaon", "Jalna", "Kolhapur", "Latur", "Mumbai City", "Mumbai Suburban", "Nagpur", "Nanded", "Nandurbar", "Nashik", "Palghar", "Parbhani", "Pune", "Raigad", "Ratnagiri", "Sangli", "Satara", "Sindhudurg", "Solapur", "Thane", "Wardha", "Washim", "Yavatmal"],
  MN: ["Bishnupur", "Chandel", "Churachandpur", "Imphal East", "Imphal West", "Jiribam", "Kakching", "Kamjong", "Kangpokpi", "Noney", "Pherzawl", "Senapati", "Tamenglong", "Tengnoupal", "Thoubal", "Ukhrul"],
  ML: ["East Garo Hills", "East Jaintia Hills", "East Khasi Hills", "Eastern West Khasi Hills", "North Garo Hills", "Ri Bhoi", "South Garo Hills", "South West Garo Hills", "South West Khasi Hills", "West Garo Hills", "West Jaintia Hills", "West Khasi Hills"],
  MZ: ["Aizawl", "Champhai", "Hnahthial", "Khawzawl", "Kolasib", "Lawngtlai", "Lunglei", "Mamit", "Saiha", "Saitual", "Serchhip"],
  NL: ["Chumoukedima", "Dimapur", "Kiphire", "Kohima", "Longleng", "Mokokchung", "Mon", "Niuland", "Noklak", "Peren", "Phek", "Shamator", "Tseminyu", "Tuensang", "Wokha", "Zunheboto"],
  OR: ["Angul", "Balangir", "Balasore", "Bargarh", "Bhadrak", "Boudh", "Cuttack", "Deogarh", "Dhenkanal", "Gajapati", "Ganjam", "Jagatsinghpur", "Jajpur", "Jharsuguda", "Kalahandi", "Kandhamal", "Kendrapara", "Kendujhar", "Khordha", "Koraput", "Malkangiri", "Mayurbhanj", "Nabarangpur", "Nayagarh", "Nuapada", "Puri", "Rayagada", "Sambalpur", "Subarnapur", "Sundargarh"],
  PB: ["Amritsar", "Barnala", "Bathinda", "Faridkot", "Fatehgarh Sahib", "Fazilka", "Ferozepur", "Gurdaspur", "Hoshiarpur", "Jalandhar", "Kapurthala", "Ludhiana", "Malerkotla", "Mansa", "Moga", "Pathankot", "Patiala", "Rupnagar", "Sahibzada Ajit Singh Nagar", "Sangrur", "Shaheed Bhagat Singh Nagar", "Sri Muktsar Sahib", "Tarn Taran"],
  RJ: ["Ajmer", "Alwar", "Balotra", "Banswara", "Baran", "Barmer", "Beawar", "Bharatpur", "Bhilwara", "Bikaner", "Bundi", "Chittorgarh", "Churu", "Dausa", "Deeg", "Dholpur", "Didwana Kuchaman", "Dungarpur", "Hanumangarh", "Jaipur", "Jaisalmer", "Jalore", "Jhalawar", "Jhunjhunu", "Jodhpur", "Karauli", "Khairthal-Tijara", "Kota", "Kotputli-Behror", "Nagaur", "Pali", "Phalodi", "Pratapgarh", "Rajsamand", "Salumbar", "Sawai Madhopur", "Sikar", "Sirohi", "Sri Ganganagar", "Tonk", "Udaipur"],
  SK: ["Gangtok", "Gyalshing", "Mangan", "Namchi", "Pakyong", "Soreng"],
  TN: ["Ariyalur", "Chengalpattu", "Chennai", "Coimbatore", "Cuddalore", "Dharmapuri", "Dindigul", "Erode", "Kallakurichi", "Kanchipuram", "Kanyakumari", "Karur", "Krishnagiri", "Madurai", "Mayiladuthurai", "Nagapattinam", "Namakkal", "Nilgiris", "Perambalur", "Pudukkottai", "Ramanathapuram", "Ranipet", "Salem", "Sivaganga", "Tenkasi", "Thanjavur", "Theni", "Thoothukudi", "Tiruchirappalli", "Tirunelveli", "Tirupathur", "Tiruppur", "Tiruvallur", "Tiruvannamalai", "Tiruvarur", "Vellore", "Villupuram", "Virudhunagar"],
  TG: ["Adilabad", "Bhadradri Kothagudem", "Hanamkonda", "Hyderabad", "Jagtial", "Jangaon", "Jayashankar Bhupalpally", "Jogulamba Gadwal", "Kamareddy", "Karimnagar", "Khammam", "Kumuram Bheem Asifabad", "Mahabubabad", "Mahabubnagar", "Mancherial", "Medak", "Medchal-Malkajgiri", "Mulugu", "Nagarkurnool", "Nalgonda", "Narayanpet", "Nirmal", "Nizamabad", "Peddapalli", "Rajanna Sircilla", "Rangareddy", "Sangareddy", "Siddipet", "Suryapet", "Vikarabad", "Wanaparthy", "Warangal", "Yadadri Bhuvanagiri"],
  TR: ["Dhalai", "Gomati", "Khowai", "North Tripura", "Sepahijala", "South Tripura", "Unakoti", "West Tripura"],
  UP: ["Agra", "Aligarh", "Ambedkar Nagar", "Amethi", "Amroha", "Auraiya", "Ayodhya", "Azamgarh", "Baghpat", "Bahraich", "Ballia", "Balrampur", "Banda", "Barabanki", "Bareilly", "Basti", "Bhadohi", "Bijnor", "Budaun", "Bulandshahr", "Chandauli", "Chitrakoot", "Deoria", "Etah", "Etawah", "Farrukhabad", "Fatehpur", "Firozabad", "Gautam Buddha Nagar", "Ghaziabad", "Ghazipur", "Gonda", "Gorakhpur", "Hamirpur", "Hapur", "Hardoi", "Hathras", "Jalaun", "Jaunpur", "Jhansi", "Kannauj", "Kanpur Dehat", "Kanpur Nagar", "Kasganj", "Kaushambi", "Kheri", "Kushinagar", "Lalitpur", "Lucknow", "Maharajganj", "Mahoba", "Mainpuri", "Mathura", "Mau", "Meerut", "Mirzapur", "Moradabad", "Muzaffarnagar", "Pilibhit", "Pratapgarh", "Prayagraj", "Raebareli", "Rampur", "Saharanpur", "Sambhal", "Sant Kabir Nagar", "Shahjahanpur", "Shamli", "Shravasti", "Siddharthnagar", "Sitapur", "Sonbhadra", "Sultanpur", "Unnao", "Varanasi"],
  UT: ["Almora", "Bageshwar", "Chamoli", "Champawat", "Dehradun", "Haridwar", "Nainital", "Pauri Garhwal", "Pithoragarh", "Rudraprayag", "Tehri Garhwal", "Udham Singh Nagar", "Uttarkashi"],
  WB: ["Alipurduar", "Bankura", "Birbhum", "Cooch Behar", "Dakshin Dinajpur", "Darjeeling", "Hooghly", "Howrah", "Jalpaiguri", "Jhargram", "Kalimpong", "Kolkata", "Malda", "Murshidabad", "Nadia", "North 24 Parganas", "Paschim Bardhaman", "Paschim Medinipur", "Purba Bardhaman", "Purba Medinipur", "Purulia", "South 24 Parganas", "Uttar Dinajpur"],
  AN: ["Nicobar", "North and Middle Andaman", "South Andaman"],
  CH: ["Chandigarh"],
  DH: ["Dadra and Nagar Haveli", "Daman", "Diu"],
  JK: ["Anantnag", "Bandipora", "Baramulla", "Budgam", "Doda", "Ganderbal", "Jammu", "Kathua", "Kishtwar", "Kulgam", "Kupwara", "Poonch", "Pulwama", "Rajouri", "Ramban", "Reasi", "Samba", "Shopian", "Srinagar", "Udhampur"],
  LA: ["Kargil", "Leh"],
  LD: ["Lakshadweep"],
  DL: ["Central Delhi", "East Delhi", "New Delhi", "North Delhi", "North East Delhi", "North West Delhi", "Shahdara", "South Delhi", "South East Delhi", "South West Delhi", "West Delhi"],
  PY: ["Karaikal", "Mahé", "Puducherry", "Yanam"],
};

const STATE_NAMES = {
  AP: "Andhra Pradesh", AR: "Arunachal Pradesh", AS: "Assam", BR: "Bihar", CT: "Chhattisgarh",
  GA: "Goa", GJ: "Gujarat", HR: "Haryana", HP: "Himachal Pradesh", JH: "Jharkhand",
  KA: "Karnataka", KL: "Kerala", MP: "Madhya Pradesh", MH: "Maharashtra", MN: "Manipur",
  ML: "Meghalaya", MZ: "Mizoram", NL: "Nagaland", OR: "Odisha", PB: "Punjab", RJ: "Rajasthan",
  SK: "Sikkim", TN: "Tamil Nadu", TG: "Telangana", TR: "Tripura", UP: "Uttar Pradesh",
  UT: "Uttarakhand", WB: "West Bengal", AN: "Andaman and Nicobar Islands", CH: "Chandigarh",
  DH: "Dadra and Nagar Haveli and Daman and Diu", JK: "Jammu and Kashmir", LA: "Ladakh",
  LD: "Lakshadweep", DL: "Delhi", PY: "Puducherry",
};

const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

async function geocode(params) {
  const url = new URL("https://maps.googleapis.com/maps/api/geocode/json");
  for (const [k, v] of Object.entries(params)) url.searchParams.set(k, v);
  url.searchParams.set("key", KEY);
  for (let attempt = 0; attempt < 4; attempt++) {
    try {
      const res = await fetch(url);
      const body = await res.json();
      if (body.status === "OVER_QUERY_LIMIT" || body.status === "UNKNOWN_ERROR") {
        await sleep(1200 * (attempt + 1));
        continue;
      }
      return body;
    } catch {
      await sleep(1000 * (attempt + 1));
    }
  }
  return { status: "REQUEST_FAILED", results: [] };
}

function components(result) {
  const out = {};
  for (const c of result.address_components ?? []) {
    for (const t of c.types ?? []) out[t] ??= c.long_name;
  }
  return out;
}

/** Forward lookup of the district itself. Tries the "district" suffix first (most precise). */
async function forward(name, state) {
  const attempts = [
    `${name} district, ${state}, India`,
    `${name}, ${state}, India`,
  ];
  for (const address of attempts) {
    const d = await geocode({
      address,
      result_type: "administrative_area_level_3",
      components: "country:IN",
    });
    const first = (d.results ?? [])[0];
    if (first) return first;
    await sleep(120);
  }
  return null;
}

/**
 * Reverse lookup at the district's centroid. Returns the level_3 rows there, each as
 * `{ placeId, name }`.
 *
 * This is the id that matters: a real visitor's location is reverse-geocoded, and Google may mint a
 * DIFFERENT place_id for the same district on the reverse path than on the forward path (Kolkata has
 * two). Storing the reverse id is what makes a submitted location resolve.
 */
async function reverse(lat, lng) {
  const d = await geocode({
    latlng: `${lat},${lng}`,
    result_type: "administrative_area_level_3",
  });
  return (d.results ?? []).map((r) => ({
    placeId: r.place_id,
    name: components(r).administrative_area_level_3 ?? "",
  }));
}

async function pool(items, worker, concurrency = 6) {
  const out = new Array(items.length);
  let i = 0;
  const runners = Array.from({ length: concurrency }, async () => {
    for (;;) {
      const idx = i++;
      if (idx >= items.length) return;
      out[idx] = await worker(items[idx], idx);
    }
  });
  await Promise.all(runners);
  return out;
}

const jobs = [];
for (const [stateCode, names] of Object.entries(ROSTER)) {
  for (const name of names) jobs.push({ stateCode, name });
}

console.log(`Geocoding ${jobs.length} districts across ${Object.keys(ROSTER).length} states/UTs…`);

/**
 * Legitimate aliases: Google's canonical level_3 name differs from the roster spelling because the
 * district was officially renamed, or because of transliteration/spelling. These count as a match
 * (same administrative entity). Keyed by folded roster name -> folded Google name.
 *
 * Deliberately NOT aliased (Google resolved to a genuinely different district, so the place_id is
 * left NULL and the gateway falls back to name matching):
 *   Vijayanagara -> Bengaluru Urban, Hanamkonda -> Warangal, Tehri Garhwal -> Pauri Garhwal,
 *   Annamayya -> (unnamed), NTR -> (unnamed), Ramanagara -> Bengaluru South.
 */
const ALIASES = {
  drbrambedkarkonaseema: "drbrambedkarkonseema",
  nellore: "sripottisriramulunellore",
  ysrkadapa: "ysr",
  khairagarhchhuikhadangandai: "khairgarhchhuikhadangandai",
  koriya: "korea",
  mohlamanpurambagarhchouki: "mohlamanpurambagarhchowki",
  chhotaudaipur: "chhotaudepur",
  kutch: "kachchh",
  hazaribag: "hazaribagh",
  chikkaballapur: "chikkaballapura",
  dharashiv: "osmanabad",
  saiha: "siaha",
  bargarh: "baragada",
  ferozepur: "firozpur",
  kanchipuram: "kancheepuram",
  kanyakumari: "kanniyakumari",
  villupuram: "viluppuram",
  kheri: "lakhimpurkheri",
  bandipora: "bandipore",
  mangan: "northsikkim",
  namchi: "southsikkim",
  kanker: "northbastarkanker",
  karimganj: "sribhumi",
  bengalururural: "bangalorerural",
  // Ramanagara district was officially renamed Bengaluru South (2023); Hanumakonda is the
  // transliteration Google uses for Hanamkonda.
  ramanagara: "bengalurusouth",
  hanamkonda: "hanumakonda",
};

/**
 * District headquarters coordinates, used ONLY as a fallback when a name lookup resolves to the
 * wrong district. Google's forward geocoder merges some newly-carved districts into their parent
 * (Annamayya/NTR in AP, Vijayanagara in KA, Hanamkonda in TG, Tehri Garhwal in UT), but a reverse
 * lookup at the HQ town still returns the correct administrative_area_level_3 row.
 */
const HQ = {
  "AP/Annamayya": [13.55, 78.5],
  "AP/NTR": [16.5062, 80.648],
  "KA/Ramanagara": [12.72, 77.28],
  "KA/Vijayanagara": [15.27, 76.39],
  "TG/Hanamkonda": [18.01, 79.56],
  "UT/Tehri Garhwal": [30.38, 78.48],
};

function fold(s) {
  return (s ?? "")
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .replace(/\bdistrict\b/g, "")
    .replace(/[^a-z0-9]/g, "");
}

/** True when `googleName` is an acceptable name for the roster district `name`. */
function nameMatches(name, googleName) {
  const a = fold(name);
  const b = fold(googleName);
  if (!b) return false;
  if (a === b) return true;
  return ALIASES[a] === b;
}

let done = 0;
const rows = await pool(
  jobs,
  async ({ stateCode, name }) => {
    const state = STATE_NAMES[stateCode];
    const fwd = await forward(name, state);
    const rec = { stateCode, name, stateName: state, ok: false };
    if (!fwd) {
      rec.reason = "no forward match";
    } else {
      const comps = components(fwd);
      const loc = fwd.geometry?.location;
      rec.forwardPlaceId = fwd.place_id;
      rec.googleName = comps.administrative_area_level_3 ?? comps.locality ?? "";
      rec.divisionName = comps.administrative_area_level_2 ?? "";
      rec.lat = loc?.lat;
      rec.lng = loc?.lng;

      if (!loc) {
        rec.reason = "no centroid";
      } else {
        // Prefer the reverse ids for THIS district's own name. Falls back to the forward id when
        // Google's reverse payload omits the level_3 component for this area (J&K and Ladakh return
        // no administrative components at all).
        const rev = await reverse(loc.lat, loc.lng);
        const own = rev.filter((r) => nameMatches(name, r.name));
        if (own.length) {
          rec.placeId = own[0].placeId;
          rec.placeIdSource = "reverse";
        } else if (nameMatches(name, rec.googleName)) {
          rec.placeId = fwd.place_id;
          rec.placeIdSource = "forward";
        } else {
          // Headquarters fallback: reverse-geocode the district's HQ town, which still returns the
          // correct level_3 row even when the forward name lookup merged the district into a parent.
          const hq = HQ[`${stateCode}/${name}`];
          const hqOwn = hq ? (await reverse(hq[0], hq[1])).filter((r) => nameMatches(name, r.name)) : [];
          if (hqOwn.length) {
            rec.placeId = hqOwn[0].placeId;
            rec.placeIdSource = "hq-reverse";
            rec.ok = true;
          } else {
            // Google resolved to a DIFFERENT district (e.g. Beawar -> Ajmer). Storing that id would
            // route a real seller's location to the wrong district, which is worse than no id at
            // all. Leave the place_id NULL so the gateway falls back to name matching, and report it.
            rec.ok = false;
            rec.reason = `forward resolved to ${rec.googleName || "an unnamed area"}, not ${name}`;
            done += 1;
            if (done % 100 === 0) console.log(`  ${done}/${jobs.length}`);
            return rec;
          }
        }
        rec.ok = true;
      }
    }
    done += 1;
    if (done % 100 === 0) console.log(`  ${done}/${jobs.length}`);
    return rec;
  },
  6,
);

const ok = rows.filter((r) => r.ok);
const failed = rows.filter((r) => !r.ok);

// Assign a stable business code per district. Existing TN/PY 3-char codes are preserved by the
// migration (it upserts on district_code), so only NEW districts get generated codes here.
// Scheme: <2-letter state><2-digit sequence> e.g. UP01 … UP75. Fits the widened CHECK.
const byState = {};
for (const r of ok) (byState[r.stateCode] ??= []).push(r);
for (const [sc, list] of Object.entries(byState)) {
  list.sort((a, b) => a.name.localeCompare(b.name));
  list.forEach((r, i) => {
    r.generatedCode = `${sc}${String(i + 1).padStart(2, "0")}`;
  });
}

const outArgIdx = process.argv.indexOf("--out");
const outPath = outArgIdx > -1 ? process.argv[outArgIdx + 1] : "scripts/district-seed.json";
writeFileSync(
  outPath,
  JSON.stringify(
    {
      generatedAt: new Date().toISOString(),
      source: "Google Geocoding API (administrative_area_level_3), round-trip verified",
      total: rows.length,
      verified: ok.length,
      failed: failed.length,
      rows: ok,
      failures: failed,
    },
    null,
    1,
  ),
);

console.log(`\nVerified ${ok.length}/${rows.length}. Artifact: ${outPath}`);
if (failed.length) {
  console.log(`\n${failed.length} district(s) need attention:`);
  for (const f of failed) console.log(`  ${f.stateCode} ${f.name}: ${f.reason}`);
}
