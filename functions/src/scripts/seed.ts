/**
 * Loads realistic sample data so the apps work immediately. Every value here is editable from Admin.
 *   export GOOGLE_APPLICATION_CREDENTIALS=/path/to/service-account.json   (or FIRESTORE_EMULATOR_HOST=localhost:8080)
 *   npm run seed            → only writes if settings/public does not exist
 *   npm run seed -- --force → overwrites the sample festival
 *
 * Dates are SAMPLE dates for Navaratri 2026 — confirm with the temple panchangam and change them in Admin → Days.
 */
import { initializeApp } from 'firebase-admin/app';
import { getFirestore } from 'firebase-admin/firestore';
import type { TempleSettings } from '../shared/model';

const FESTIVAL_ID = 'navaratri-2026';
const START = '2026-10-11';

const dayForms: { ta: string; en: string; dta: string; den: string }[] = [
  { ta: 'ஸ்ரீ துர்கா – சைலபுத்ரி அலங்காரம்', en: 'Sri Durga – Shailaputri Alankaram', dta: 'வீரமும் தைரியமும் அருளும் துர்கை வழிபாடு.', den: 'Worship of Durga for courage and protection.' },
  { ta: 'ஸ்ரீ துர்கா – பிரம்மசாரிணி அலங்காரம்', en: 'Sri Durga – Brahmacharini Alankaram', dta: 'தவமும் பக்தியும் வளர வழிபாடு.', den: 'Worship for devotion and discipline.' },
  { ta: 'ஸ்ரீ துர்கா – சந்திரகண்டா அலங்காரம்', en: 'Sri Durga – Chandraghanta Alankaram', dta: 'அமைதியும் நலமும் வேண்டி வழிபாடு.', den: 'Worship for peace and well-being.' },
  { ta: 'ஸ்ரீ மகாலட்சுமி – கூஷ்மாண்டா அலங்காரம்', en: 'Sri Mahalakshmi – Kushmanda Alankaram', dta: 'செல்வமும் வளமும் அருளும் லட்சுமி வழிபாடு.', den: 'Worship of Lakshmi for prosperity.' },
  { ta: 'ஸ்ரீ மகாலட்சுமி – ஸ்கந்தமாதா அலங்காரம்', en: 'Sri Mahalakshmi – Skandamata Alankaram', dta: 'குடும்ப நலம் வேண்டி வழிபாடு.', den: 'Worship for family welfare.' },
  { ta: 'ஸ்ரீ மகாலட்சுமி – காத்யாயனி அலங்காரம்', en: 'Sri Mahalakshmi – Katyayani Alankaram', dta: 'சுப காரியங்கள் நிறைவேற வழிபாடு.', den: 'Worship for auspicious beginnings.' },
  { ta: 'ஸ்ரீ சரஸ்வதி – காளராத்ரி அலங்காரம்', en: 'Sri Saraswati – Kalaratri Alankaram', dta: 'கல்வியும் ஞானமும் அருளும் சரஸ்வதி வழிபாடு.', den: 'Worship of Saraswati for knowledge.' },
  { ta: 'ஸ்ரீ சரஸ்வதி – மகாகௌரி அலங்காரம் (துர்காஷ்டமி)', en: 'Sri Saraswati – Mahagauri Alankaram (Durgashtami)', dta: 'துர்காஷ்டமி சிறப்பு பூஜை.', den: 'Special Durgashtami puja.' },
  { ta: 'ஸ்ரீ சரஸ்வதி – சித்திதாத்ரி அலங்காரம் (சரஸ்வதி பூஜை)', en: 'Sri Saraswati – Siddhidatri Alankaram (Saraswati Puja)', dta: 'சரஸ்வதி பூஜை மற்றும் ஆயுத பூஜை.', den: 'Saraswati Puja and Ayudha Puja.' },
];

const ordinalTa = ['முதல்', 'இரண்டாம்', 'மூன்றாம்', 'நான்காம்', 'ஐந்தாம்', 'ஆறாம்', 'ஏழாம்', 'எட்டாம்', 'ஒன்பதாம்'];

function addDays(ymd: string, n: number): string {
  const d = new Date(`${ymd}T00:00:00Z`);
  d.setUTCDate(d.getUTCDate() + n);
  return d.toISOString().slice(0, 10);
}

const settings: TempleSettings = {
  templeName: { ta: 'ஸ்ரீ கொன்னை அம்மன் ஆலயம்', en: 'Sri Konnai Amman Temple' },
  location: { ta: 'கார்காத்தி', en: 'Karkathi' },
  address: { ta: 'ஸ்ரீ கொன்னை அம்மன் ஆலயம், கார்காத்தி', en: 'Sri Konnai Amman Temple, Karkathi' },
  about: {
    ta: 'கார்காத்தி கிராம மக்களின் குலதெய்வமாக விளங்கும் ஸ்ரீ கொன்னை அம்மன், நவராத்திரி ஒன்பது நாட்களும் சிறப்பு அலங்காரத்தில் அருள்பாலிக்கிறாள். பக்தர்கள் தங்கள் குடும்பம் அல்லது குழுவின் சார்பில் உபயம் செய்து அம்மனின் அருளைப் பெறலாம்.',
    en: 'Sri Konnai Amman, the guardian deity of Karkathi, blesses devotees in a special alankaram on each of the nine nights of Navaratri. Devotees may sponsor an ubayam on behalf of their family or group.',
  },
  phone: '+91 90000 00000',
  whatsapp: '919000000000',
  logoUrl: '',
  heroImageUrl: '',
  upiId: 'templename@upi',
  upiPayeeName: 'Sri Konnai Amman Temple',
  upiQrUrl: '',
  upiInstructions: {
    ta: '1. QR குறியீட்டை GPay / PhonePe / Paytm மூலம் ஸ்கேன் செய்யவும்.\n2. சரியான தொகையைச் செலுத்தவும்.\n3. பணம் செலுத்திய பின் வரும் UTR / பரிவர்த்தனை எண்ணை இங்கே உள்ளிடவும்.',
    en: '1. Scan the QR with GPay / PhonePe / Paytm.\n2. Pay the exact amount.\n3. Enter the UTR / transaction ID shown after payment.',
  },
  currentFestivalId: FESTIVAL_ID,
  bookingOpen: true,
  bookingPrefix: 'KA',
  holdMinutes: 30,
  capacityMode: 'bookings',
  maxMembersPerBooking: 25,
  limitedThresholdPct: 25,
  timezone: 'Asia/Kolkata',
  faq: [
    { q: { ta: 'உபயம் என்றால் என்ன?', en: 'What is an ubayam?' }, a: { ta: 'ஒரு குறிப்பிட்ட பூஜை அல்லது சேவையை ஒரு குடும்பம் அல்லது குழு ஏற்று நடத்துவது உபயம் ஆகும்.', en: 'An ubayam is sponsoring a specific puja or service on behalf of a family or group.' } },
    { q: { ta: 'பதிவு எப்போது உறுதியாகும்?', en: 'When is my booking confirmed?' }, a: { ta: 'நீங்கள் சமர்ப்பித்த பரிவர்த்தனை எண்ணை கோவில் நிர்வாகம் சரிபார்த்த பின் உறுதி செய்யப்படும்.', en: 'After the temple verifies the transaction ID you submitted.' } },
    { q: { ta: 'UTR எண் எங்கே கிடைக்கும்?', en: 'Where do I find the UTR?' }, a: { ta: 'GPay: பரிவர்த்தனையைத் திறந்து “UPI transaction ID”. PhonePe: “UTR” அல்லது “Transaction ID”.', en: 'GPay: open the payment → “UPI transaction ID”. PhonePe: “UTR” or “Transaction ID”.' } },
    { q: { ta: 'பதிவை ரத்து செய்ய முடியுமா?', en: 'Can I cancel my booking?' }, a: { ta: 'கோவிலை வாட்ஸ்அப் அல்லது தொலைபேசியில் தொடர்பு கொள்ளவும்.', en: 'Please contact the temple on WhatsApp or phone.' } },
  ],
};

async function main() {
  initializeApp();
  const db = getFirestore();
  const force = process.argv.includes('--force');
  if (!force && (await db.doc('settings/public').get()).exists) {
    console.log('settings/public already exists — nothing written. Use --force to overwrite the sample festival.');
    return;
  }
  const batch = db.batch();
  batch.set(db.doc('settings/public'), settings, { merge: true });
  batch.set(db.doc(`festivals/${FESTIVAL_ID}`), {
    name: { ta: 'நவராத்திரி பெருவிழா 2026', en: 'Navaratri Festival 2026' },
    description: {
      ta: 'ஒன்பது இரவுகள் அம்பாளுக்கு சிறப்பு அலங்காரம், அபிஷேகம், அன்னதானம். பக்தர்கள் உபயம் செய்து அருள் பெறலாம்.',
      en: 'Nine nights of special alankaram, abhishekam and annadhanam for the Goddess. Devotees can sponsor an ubayam.',
    },
    startDate: START,
    endDate: addDays(START, 8),
    active: true,
  });

  const ubayams = [
    { id: 'abhishekam', ta: 'அபிஷேக உபயம்', en: 'Abhishekam Ubayam', dta: 'அம்மனுக்கு பால், தயிர், இளநீர் அபிஷேகம்.', den: 'Sacred bath of the Goddess with milk, curd and tender coconut.', price: 501, group: false },
    { id: 'alankaram', ta: 'அலங்கார உபயம்', en: 'Alankaram Ubayam', dta: 'அன்றைய சிறப்பு அலங்காரத்திற்கான உபயம்.', den: 'Sponsor the special decoration of the day.', price: 1001, group: false },
    { id: 'annadhanam', ta: 'அன்னதான உபயம்', en: 'Annadhanam Ubayam', dta: 'பக்தர்களுக்கு அன்னதானம் வழங்குதல்.', den: 'Offer a meal to devotees.', price: 2501, group: true },
    { id: 'full-day', ta: 'முழு நாள் உபயம்', en: 'Full Day Ubayam', dta: 'அன்றைய அனைத்து பூஜைகளுக்குமான உபயம்.', den: 'Sponsor all pujas of the day.', price: 5001, group: true },
  ];
  ubayams.forEach((u, i) =>
    batch.set(db.doc(`ubayamTypes/${u.id}`), {
      festivalId: FESTIVAL_ID, name: { ta: u.ta, en: u.en }, description: { ta: u.dta, en: u.den },
      price: u.price, dayIds: [], allowFamily: true, allowGroup: u.group, active: true, sortOrder: i + 1,
    }),
  );

  const slots = [
    { time: '06:00', cap: 20, ta: 'காலை பூஜை', en: 'Morning Puja' },
    { time: '10:00', cap: 20, ta: 'உச்சிகால பூஜை', en: 'Noon Puja' },
    { time: '18:30', cap: 30, ta: 'மாலை அலங்கார பூஜை', en: 'Evening Alankara Puja' },
  ];
  // Never reset bookedCount of slots that already exist (safe to --force on a live project).
  const existingSlots = new Set(
    (await db.collection('timeSlots').where('festivalId', '==', FESTIVAL_ID).select().get()).docs.map((d) => d.id),
  );
  dayForms.forEach((f, i) => {
    const dayId = `${FESTIVAL_ID}-d${i + 1}`;
    const date = addDays(START, i);
    batch.set(db.doc(`festivalDays/${dayId}`), {
      festivalId: FESTIVAL_ID, dayNumber: i + 1, date,
      dayName: { ta: `${ordinalTa[i]} நாள்`, en: `Day ${i + 1}` },
      title: { ta: f.ta, en: f.en }, description: { ta: f.dta, en: f.den }, active: true,
    });
    slots.forEach((s, j) => {
      const id = `${dayId}-s${j + 1}`;
      batch.set(db.doc(`timeSlots/${id}`), {
        festivalId: FESTIVAL_ID, dayId, date, time: s.time, label: { ta: s.ta, en: s.en },
        capacity: s.cap, active: true, ...(existingSlots.has(id) ? {} : { bookedCount: 0 }),
      }, { merge: true });
    });
  });
  await batch.commit();
  console.log(`Seeded ${FESTIVAL_ID}: 9 days, ${9 * slots.length} slots, ${ubayams.length} ubayam types.`);
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
