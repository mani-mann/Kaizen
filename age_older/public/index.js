const fileEl = document.getElementById('file');
const previewEl = document.getElementById('preview');
const goEl = document.getElementById('go');
const chooseEl = document.getElementById('choose');
const eraYearEl = document.getElementById('eraYear');
const countryEl = document.getElementById('country');
const countryDropdown = document.getElementById('countryDropdown');
const eraDropdown = document.getElementById('eraDropdown');

// Complete world countries data (195+ countries)
const countries = [
  { name: 'Afghanistan', code: 'AF', flag: '🇦🇫' },
  { name: 'Albania', code: 'AL', flag: '🇦🇱' },
  { name: 'Algeria', code: 'DZ', flag: '🇩🇿' },
  { name: 'Andorra', code: 'AD', flag: '🇦🇩' },
  { name: 'Angola', code: 'AO', flag: '🇦🇴' },
  { name: 'Antigua and Barbuda', code: 'AG', flag: '🇦🇬' },
  { name: 'Argentina', code: 'AR', flag: '🇦🇷' },
  { name: 'Armenia', code: 'AM', flag: '🇦🇲' },
  { name: 'Australia', code: 'AU', flag: '🇦🇺' },
  { name: 'Austria', code: 'AT', flag: '🇦🇹' },
  { name: 'Azerbaijan', code: 'AZ', flag: '🇦🇿' },
  { name: 'Bahamas', code: 'BS', flag: '🇧🇸' },
  { name: 'Bahrain', code: 'BH', flag: '🇧🇭' },
  { name: 'Bangladesh', code: 'BD', flag: '🇧🇩' },
  { name: 'Barbados', code: 'BB', flag: '🇧🇧' },
  { name: 'Belarus', code: 'BY', flag: '🇧🇾' },
  { name: 'Belgium', code: 'BE', flag: '🇧🇪' },
  { name: 'Belize', code: 'BZ', flag: '🇧🇿' },
  { name: 'Benin', code: 'BJ', flag: '🇧🇯' },
  { name: 'Bhutan', code: 'BT', flag: '🇧🇹' },
  { name: 'Bolivia', code: 'BO', flag: '🇧🇴' },
  { name: 'Bosnia and Herzegovina', code: 'BA', flag: '🇧🇦' },
  { name: 'Botswana', code: 'BW', flag: '🇧🇼' },
  { name: 'Brazil', code: 'BR', flag: '🇧🇷' },
  { name: 'Brunei', code: 'BN', flag: '🇧🇳' },
  { name: 'Bulgaria', code: 'BG', flag: '🇧🇬' },
  { name: 'Burkina Faso', code: 'BF', flag: '🇧🇫' },
  { name: 'Burundi', code: 'BI', flag: '🇧🇮' },
  { name: 'Cambodia', code: 'KH', flag: '🇰🇭' },
  { name: 'Cameroon', code: 'CM', flag: '🇨🇲' },
  { name: 'Canada', code: 'CA', flag: '🇨🇦' },
  { name: 'Cape Verde', code: 'CV', flag: '🇨🇻' },
  { name: 'Central African Republic', code: 'CF', flag: '🇨🇫' },
  { name: 'Chad', code: 'TD', flag: '🇹🇩' },
  { name: 'Chile', code: 'CL', flag: '🇨🇱' },
  { name: 'China', code: 'CN', flag: '🇨🇳' },
  { name: 'Colombia', code: 'CO', flag: '🇨🇴' },
  { name: 'Comoros', code: 'KM', flag: '🇰🇲' },
  { name: 'Congo', code: 'CG', flag: '🇨🇬' },
  { name: 'Costa Rica', code: 'CR', flag: '🇨🇷' },
  { name: 'Croatia', code: 'HR', flag: '🇭🇷' },
  { name: 'Cuba', code: 'CU', flag: '🇨🇺' },
  { name: 'Cyprus', code: 'CY', flag: '🇨🇾' },
  { name: 'Czech Republic', code: 'CZ', flag: '🇨🇿' },
  { name: 'Denmark', code: 'DK', flag: '🇩🇰' },
  { name: 'Djibouti', code: 'DJ', flag: '🇩🇯' },
  { name: 'Dominica', code: 'DM', flag: '🇩🇲' },
  { name: 'Dominican Republic', code: 'DO', flag: '🇩🇴' },
  { name: 'Ecuador', code: 'EC', flag: '🇪🇨' },
  { name: 'Egypt', code: 'EG', flag: '🇪🇬' },
  { name: 'El Salvador', code: 'SV', flag: '🇸🇻' },
  { name: 'Equatorial Guinea', code: 'GQ', flag: '🇬🇶' },
  { name: 'Eritrea', code: 'ER', flag: '🇪🇷' },
  { name: 'Estonia', code: 'EE', flag: '🇪🇪' },
  { name: 'Ethiopia', code: 'ET', flag: '🇪🇹' },
  { name: 'Fiji', code: 'FJ', flag: '🇫🇯' },
  { name: 'Finland', code: 'FI', flag: '🇫🇮' },
  { name: 'France', code: 'FR', flag: '🇫🇷' },
  { name: 'Gabon', code: 'GA', flag: '🇬🇦' },
  { name: 'Gambia', code: 'GM', flag: '🇬🇲' },
  { name: 'Georgia', code: 'GE', flag: '🇬🇪' },
  { name: 'Germany', code: 'DE', flag: '🇩🇪' },
  { name: 'Ghana', code: 'GH', flag: '🇬🇭' },
  { name: 'Greece', code: 'GR', flag: '🇬🇷' },
  { name: 'Grenada', code: 'GD', flag: '🇬🇩' },
  { name: 'Guatemala', code: 'GT', flag: '🇬🇹' },
  { name: 'Guinea', code: 'GN', flag: '🇬🇳' },
  { name: 'Guinea-Bissau', code: 'GW', flag: '🇬🇼' },
  { name: 'Guyana', code: 'GY', flag: '🇬🇾' },
  { name: 'Haiti', code: 'HT', flag: '🇭🇹' },
  { name: 'Honduras', code: 'HN', flag: '🇭🇳' },
  { name: 'Hungary', code: 'HU', flag: '🇭🇺' },
  { name: 'Iceland', code: 'IS', flag: '🇮🇸' },
  { name: 'India', code: 'IN', flag: '🇮🇳' },
  { name: 'Indonesia', code: 'ID', flag: '🇮🇩' },
  { name: 'Iran', code: 'IR', flag: '🇮🇷' },
  { name: 'Iraq', code: 'IQ', flag: '🇮🇶' },
  { name: 'Ireland', code: 'IE', flag: '🇮🇪' },
  { name: 'Israel', code: 'IL', flag: '🇮🇱' },
  { name: 'Italy', code: 'IT', flag: '🇮🇹' },
  { name: 'Jamaica', code: 'JM', flag: '🇯🇲' },
  { name: 'Japan', code: 'JP', flag: '🇯🇵' },
  { name: 'Jordan', code: 'JO', flag: '🇯🇴' },
  { name: 'Kazakhstan', code: 'KZ', flag: '🇰🇿' },
  { name: 'Kenya', code: 'KE', flag: '🇰🇪' },
  { name: 'Kiribati', code: 'KI', flag: '🇰🇮' },
  { name: 'Kuwait', code: 'KW', flag: '🇰🇼' },
  { name: 'Kyrgyzstan', code: 'KG', flag: '🇰🇬' },
  { name: 'Laos', code: 'LA', flag: '🇱🇦' },
  { name: 'Latvia', code: 'LV', flag: '🇱🇻' },
  { name: 'Lebanon', code: 'LB', flag: '🇱🇧' },
  { name: 'Lesotho', code: 'LS', flag: '🇱🇸' },
  { name: 'Liberia', code: 'LR', flag: '🇱🇷' },
  { name: 'Libya', code: 'LY', flag: '🇱🇾' },
  { name: 'Liechtenstein', code: 'LI', flag: '🇱🇮' },
  { name: 'Lithuania', code: 'LT', flag: '🇱🇹' },
  { name: 'Luxembourg', code: 'LU', flag: '🇱🇺' },
  { name: 'Madagascar', code: 'MG', flag: '🇲🇬' },
  { name: 'Malawi', code: 'MW', flag: '🇲🇼' },
  { name: 'Malaysia', code: 'MY', flag: '🇲🇾' },
  { name: 'Maldives', code: 'MV', flag: '🇲🇻' },
  { name: 'Mali', code: 'ML', flag: '🇲🇱' },
  { name: 'Malta', code: 'MT', flag: '🇲🇹' },
  { name: 'Marshall Islands', code: 'MH', flag: '🇲🇭' },
  { name: 'Mauritania', code: 'MR', flag: '🇲🇷' },
  { name: 'Mauritius', code: 'MU', flag: '🇲🇺' },
  { name: 'Mexico', code: 'MX', flag: '🇲🇽' },
  { name: 'Micronesia', code: 'FM', flag: '🇫🇲' },
  { name: 'Moldova', code: 'MD', flag: '🇲🇩' },
  { name: 'Monaco', code: 'MC', flag: '🇲🇨' },
  { name: 'Mongolia', code: 'MN', flag: '🇲🇳' },
  { name: 'Montenegro', code: 'ME', flag: '🇲🇪' },
  { name: 'Morocco', code: 'MA', flag: '🇲🇦' },
  { name: 'Mozambique', code: 'MZ', flag: '🇲🇿' },
  { name: 'Myanmar', code: 'MM', flag: '🇲🇲' },
  { name: 'Namibia', code: 'NA', flag: '🇳🇦' },
  { name: 'Nauru', code: 'NR', flag: '🇳🇷' },
  { name: 'Nepal', code: 'NP', flag: '🇳🇵' },
  { name: 'Netherlands', code: 'NL', flag: '🇳🇱' },
  { name: 'New Zealand', code: 'NZ', flag: '🇳🇿' },
  { name: 'Nicaragua', code: 'NI', flag: '🇳🇮' },
  { name: 'Niger', code: 'NE', flag: '🇳🇪' },
  { name: 'Nigeria', code: 'NG', flag: '🇳🇬' },
  { name: 'North Korea', code: 'KP', flag: '🇰🇵' },
  { name: 'North Macedonia', code: 'MK', flag: '🇲🇰' },
  { name: 'Norway', code: 'NO', flag: '🇳🇴' },
  { name: 'Oman', code: 'OM', flag: '🇴🇲' },
  { name: 'Pakistan', code: 'PK', flag: '🇵🇰' },
  { name: 'Palau', code: 'PW', flag: '🇵🇼' },
  { name: 'Palestine', code: 'PS', flag: '🇵🇸' },
  { name: 'Panama', code: 'PA', flag: '🇵🇦' },
  { name: 'Papua New Guinea', code: 'PG', flag: '🇵🇬' },
  { name: 'Paraguay', code: 'PY', flag: '🇵🇾' },
  { name: 'Peru', code: 'PE', flag: '🇵🇪' },
  { name: 'Philippines', code: 'PH', flag: '🇵🇭' },
  { name: 'Poland', code: 'PL', flag: '🇵🇱' },
  { name: 'Portugal', code: 'PT', flag: '🇵🇹' },
  { name: 'Qatar', code: 'QA', flag: '🇶🇦' },
  { name: 'Romania', code: 'RO', flag: '🇷🇴' },
  { name: 'Russia', code: 'RU', flag: '🇷🇺' },
  { name: 'Rwanda', code: 'RW', flag: '🇷🇼' },
  { name: 'Saint Kitts and Nevis', code: 'KN', flag: '🇰🇳' },
  { name: 'Saint Lucia', code: 'LC', flag: '🇱🇨' },
  { name: 'Saint Vincent and the Grenadines', code: 'VC', flag: '🇻🇨' },
  { name: 'Samoa', code: 'WS', flag: '🇼🇸' },
  { name: 'San Marino', code: 'SM', flag: '🇸🇲' },
  { name: 'Sao Tome and Principe', code: 'ST', flag: '🇸🇹' },
  { name: 'Saudi Arabia', code: 'SA', flag: '🇸🇦' },
  { name: 'Senegal', code: 'SN', flag: '🇸🇳' },
  { name: 'Serbia', code: 'RS', flag: '🇷🇸' },
  { name: 'Seychelles', code: 'SC', flag: '🇸🇨' },
  { name: 'Sierra Leone', code: 'SL', flag: '🇸🇱' },
  { name: 'Singapore', code: 'SG', flag: '🇸🇬' },
  { name: 'Slovakia', code: 'SK', flag: '🇸🇰' },
  { name: 'Slovenia', code: 'SI', flag: '🇸🇮' },
  { name: 'Solomon Islands', code: 'SB', flag: '🇸🇧' },
  { name: 'Somalia', code: 'SO', flag: '🇸🇴' },
  { name: 'South Africa', code: 'ZA', flag: '🇿🇦' },
  { name: 'South Korea', code: 'KR', flag: '🇰🇷' },
  { name: 'South Sudan', code: 'SS', flag: '🇸🇸' },
  { name: 'Spain', code: 'ES', flag: '🇪🇸' },
  { name: 'Sri Lanka', code: 'LK', flag: '🇱🇰' },
  { name: 'Sudan', code: 'SD', flag: '🇸🇩' },
  { name: 'Suriname', code: 'SR', flag: '🇸🇷' },
  { name: 'Sweden', code: 'SE', flag: '🇸🇪' },
  { name: 'Switzerland', code: 'CH', flag: '🇨🇭' },
  { name: 'Syria', code: 'SY', flag: '🇸🇾' },
  { name: 'Taiwan', code: 'TW', flag: '🇹🇼' },
  { name: 'Tajikistan', code: 'TJ', flag: '🇹🇯' },
  { name: 'Tanzania', code: 'TZ', flag: '🇹🇿' },
  { name: 'Thailand', code: 'TH', flag: '🇹🇭' },
  { name: 'Timor-Leste', code: 'TL', flag: '🇹🇱' },
  { name: 'Togo', code: 'TG', flag: '🇹🇬' },
  { name: 'Tonga', code: 'TO', flag: '🇹🇴' },
  { name: 'Trinidad and Tobago', code: 'TT', flag: '🇹🇹' },
  { name: 'Tunisia', code: 'TN', flag: '🇹🇳' },
  { name: 'Turkey', code: 'TR', flag: '🇹🇷' },
  { name: 'Turkmenistan', code: 'TM', flag: '🇹🇲' },
  { name: 'Tuvalu', code: 'TV', flag: '🇹🇻' },
  { name: 'Uganda', code: 'UG', flag: '🇺🇬' },
  { name: 'Ukraine', code: 'UA', flag: '🇺🇦' },
  { name: 'United Arab Emirates', code: 'AE', flag: '🇦🇪' },
  { name: 'United Kingdom', code: 'GB', flag: '🇬🇧' },
  { name: 'United States', code: 'US', flag: '🇺🇸' },
  { name: 'Uruguay', code: 'UY', flag: '🇺🇾' },
  { name: 'Uzbekistan', code: 'UZ', flag: '🇺🇿' },
  { name: 'Vanuatu', code: 'VU', flag: '🇻🇺' },
  { name: 'Vatican City', code: 'VA', flag: '🇻🇦' },
  { name: 'Venezuela', code: 'VE', flag: '🇻🇪' },
  { name: 'Vietnam', code: 'VN', flag: '🇻🇳' },
  { name: 'Yemen', code: 'YE', flag: '🇾🇪' },
  { name: 'Zambia', code: 'ZM', flag: '🇿🇲' },
  { name: 'Zimbabwe', code: 'ZW', flag: '🇿🇼' }
];

let filteredCountries = [];
let selectedIndex = -1;

// Random activity generation based on era
function getRandomEraActivity(era) {
  const eraLower = String(era || '').toLowerCase();
  let activities = [];
  
  // Prehistoric/Dinosaur eras
  if (eraLower.includes('jurassic') || eraLower.includes('cretaceous') || eraLower.includes('triassic') || eraLower.includes('mesozoic') || eraLower.includes('dinosaur')) {
    activities = [
      'hunting dinosaurs', 'gathering food', 'cave painting', 'fire making', 
      'stone tool crafting', 'surviving in wilderness', 'taming creatures',
      'hunting with spears', 'cave dwelling', 'prehistoric cooking'
    ];
  }
  
  // Ancient civilizations
  else if (eraLower.includes('ancient') || eraLower.includes('egypt') || eraLower.includes('rome') || eraLower.includes('greece')) {
    activities = [
      'chariot racing', 'gladiator fighting', 'philosophy discussions', 'temple building',
      'oracle consulting', 'royal court duties', 'military training', 'trading goods',
      'ancient warfare', 'temple ceremonies', 'royal feasting'
    ];
  }
  
  // Medieval times
  else if (eraLower.includes('medieval') || eraLower.includes('knight') || eraLower.includes('castle')) {
    activities = [
      'jousting', 'sword fighting', 'archery practice', 'castle defense',
      'royal feasting', 'falconry', 'court dancing', 'alchemy',
      'knight training', 'castle siege', 'medieval tournaments'
    ];
  }
  
  // Renaissance
  else if (eraLower.includes('renaissance') || eraLower.includes('15th') || eraLower.includes('16th')) {
    activities = [
      'artistic painting', 'scientific discovery', 'court intrigue', 'musical performance',
      'literature writing', 'invention creating', 'diplomatic negotiations',
      'renaissance art', 'scientific experiments', 'court politics'
    ];
  }
  
  // 18th-19th Century
  else if (eraLower.includes('18th') || eraLower.includes('19th') || eraLower.includes('victorian') || eraLower.includes('edwardian')) {
    activities = [
      'horseback riding', 'ballroom dancing', 'tea ceremonies', 'dueling',
      'carriage driving', 'opera attending', 'letter writing', 'garden parties',
      'victorian etiquette', 'industrial work', 'royal court duties'
    ];
  }
  
  // 1920s-1940s
  else if (eraLower.includes('1920') || eraLower.includes('1930') || eraLower.includes('1940') || eraLower.includes('roaring')) {
    activities = [
      'jazz dancing', 'speakeasy visiting', 'flapper fashion', 'cocktail parties',
      'radio broadcasting', 'aviation', 'war efforts', 'gangster activities',
      'prohibition era', 'art deco lifestyle', 'great depression survival'
    ];
  }
  
  // 1950s-1970s
  else if (eraLower.includes('1950') || eraLower.includes('1960') || eraLower.includes('1970')) {
    activities = [
      'rock and roll', 'civil rights marching', 'space exploration', 'hippie gatherings',
      'protest organizing', 'disco dancing', 'television watching', 'cold war activities',
      'beatnik culture', 'space race', 'counterculture movements'
    ];
  }
  
  // 1980s-2000s
  else if (eraLower.includes('1980') || eraLower.includes('1990') || eraLower.includes('2000')) {
    activities = [
      'breakdancing', 'video gaming', 'computer programming', 'internet surfing',
      'mobile phone using', 'hip hop culture', 'rave parties', 'y2k preparation',
      'grunge lifestyle', 'dot com boom', 'millennium celebrations'
    ];
  }
  
  // Modern/Future
  else if (eraLower.includes('modern') || eraLower.includes('contemporary') || eraLower.includes('future') || eraLower.includes('digital')) {
    activities = [
      'social media posting', 'virtual reality', 'cryptocurrency trading', 'streaming content',
      'AI interaction', 'space travel', 'sustainable living', 'tech startup',
      'digital nomad', 'cyber security', 'metaverse exploration'
    ];
  }
  
  // Generic activities that work for any era
  else {
    activities = [
      'reading', 'writing', 'cooking', 'gardening', 'walking', 'thinking',
      'socializing', 'celebrating', 'working', 'resting', 'exploring', 'learning'
    ];
  }
  
  // Return a random activity from the era-appropriate list
  return activities[Math.floor(Math.random() * activities.length)];
}


chooseEl.addEventListener('click', ()=> fileEl.click());
fileEl.addEventListener('change', ()=> handleFile(fileEl.files[0]));

function handleFile(f){
  if(!f || !f.type.startsWith('image/')) return;
  const reader = new FileReader();
  reader.onload = ()=>{
    previewEl.src = reader.result;
    // store immediately so user can click Generate later
    sessionStorage.setItem('pf_image', reader.result);
  };
  reader.readAsDataURL(f);
}

// Baseline eras shown when input is empty
const baseEras = [
  '1920s', '1940s', '1960s', '1980s', '2000s', '2010s', '2020s',
  '18th Century', '19th Century', '20th Century', '21st Century',
  'Victorian Era', 'Renaissance', 'Medieval Times', 'Industrial Revolution', 'Space Age', 'Digital Age'
];

let filteredEras = [];
let eraSelectedIndex = -1;

function toTitleCase(str){
  return String(str || '')
    .toLowerCase()
    .replace(/(^|\s|[-_/])(\p{L})/gu, (m, p1, p2) => p1 + p2.toUpperCase());
}

function buildCentury(year){
  const y = parseInt(year, 10);
  if (Number.isNaN(y)) return '';
  const century = Math.floor((y - 1) / 100) + 1;
  const suffix = century % 10 === 1 && century % 100 !== 11 ? 'st'
    : century % 10 === 2 && century % 100 !== 12 ? 'nd'
    : century % 10 === 3 && century % 100 !== 13 ? 'rd'
    : 'th';
  return `${century}${suffix} Century`;
}

function buildDynamicEraOptions(query){
  const q = String(query || '').trim();
  if (!q) return baseEras.slice(0, 12);

  const out = new Set();
  const title = toTitleCase(q);

  // Always include what the user typed (beautified)
  out.add(title);

  // If the user didn't specify Era/Age, propose variants
  if (!/\b(era|age|times)\b/i.test(q)) {
    out.add(`${title} Era`);
    out.add(`${title} Age`);
  }

  // If numeric year, add decade and century
  if (/^\d{1,4}$/.test(q)) {
    const year = q.padStart(q.length, '0');
    out.add(String(parseInt(q,10)));
    if (q.length >= 3) out.add(`${q.slice(0, q.length-1)}0s`); // decade
    const c = buildCentury(q);
    if (c) out.add(c);
  }

  // If looks like a decade
  const decadeMatch = q.match(/^(\d{3})\ds$/);
  if (decadeMatch) {
    const c = buildCentury(`${decadeMatch[1]}0`);
    if (c) out.add(c);
  }

  // Soft include of baseline eras that contain the query
  baseEras.forEach(e => { if (e.toLowerCase().includes(q.toLowerCase())) out.add(e); });

  // Minimal themed mapper for common prehistoric queries without hardcoding everything
  const dinoLike = /(jurassic|cretaceous|triassic|mesozoic)/i;
  if (dinoLike.test(q)) {
    out.add('Jurassic Era');
    out.add('Cretaceous Period');
    out.add('Triassic Period');
    out.add('Mesozoic Era');
  }

  return Array.from(out).slice(0, 15);
}

// Era input with smart, fully dynamic suggestions
eraYearEl.addEventListener('input', (e) => {
  filteredEras = buildDynamicEraOptions(e.target.value);
  updateEraDropdown();
  addVisualFeedback(eraYearEl);
});

eraYearEl.addEventListener('focus', () => {
  if (filteredEras.length === 0) {
    filteredEras = buildDynamicEraOptions(eraYearEl.value);
    updateEraDropdown();
  }
});

eraYearEl.addEventListener('keydown', (e) => {
  if (!eraDropdown.classList.contains('show')) return;
  
  switch(e.key) {
    case 'ArrowDown':
      e.preventDefault();
      eraSelectedIndex = Math.min(eraSelectedIndex + 1, filteredEras.length - 1);
      updateEraHighlight();
      break;
    case 'ArrowUp':
      e.preventDefault();
      eraSelectedIndex = Math.max(eraSelectedIndex - 1, -1);
      updateEraHighlight();
      break;
    case 'Enter':
      e.preventDefault();
      if (eraSelectedIndex >= 0 && filteredEras[eraSelectedIndex]) {
        selectEra(filteredEras[eraSelectedIndex]);
      }
      break;
    case 'Escape':
      hideEraDropdown();
      break;
  }
});


// Country search functionality
countryEl.addEventListener('input', (e) => {
  const query = e.target.value.toLowerCase();
  filteredCountries = countries.filter(country => 
    country.name.toLowerCase().includes(query)
  );
  updateCountryDropdown();
});

countryEl.addEventListener('focus', () => {
  if (filteredCountries.length === 0) {
    filteredCountries = countries;
    updateCountryDropdown();
  }
});

countryEl.addEventListener('keydown', (e) => {
  if (!countryDropdown.classList.contains('show')) return;
  
  switch(e.key) {
    case 'ArrowDown':
      e.preventDefault();
      selectedIndex = Math.min(selectedIndex + 1, filteredCountries.length - 1);
      updateCountryHighlight();
      break;
    case 'ArrowUp':
      e.preventDefault();
      selectedIndex = Math.max(selectedIndex - 1, -1);
      updateCountryHighlight();
      break;
    case 'Enter':
      e.preventDefault();
      if (selectedIndex >= 0 && filteredCountries[selectedIndex]) {
        selectCountry(filteredCountries[selectedIndex]);
      }
      break;
    case 'Escape':
      hideCountryDropdown();
      break;
  }
});

function updateEraDropdown() {
  eraDropdown.innerHTML = '';
  eraSelectedIndex = -1;
  
  if (filteredEras.length === 0) {
    eraDropdown.innerHTML = '<div class="search-dropdown-item">No eras found</div>';
  } else {
    filteredEras.forEach((era, index) => {
      const item = document.createElement('div');
      item.className = 'search-dropdown-item';
      
      // Add different icons for different types of eras
      let icon = '🕰️';
      if (/^\d+$/.test(era)) {
        icon = '📅'; // Calendar for specific years
      } else if (era.includes('Century')) {
        icon = '🏛️'; // Building for centuries
      } else if (era.includes('Era') || era.includes('Age')) {
        icon = '⚔️'; // Sword for historical periods
      } else if (era.includes('Modern') || era.includes('Contemporary')) {
        icon = '🚀'; // Rocket for modern times
      }
      
      item.innerHTML = `${icon} ${era}`;
      item.addEventListener('click', () => selectEra(era));
      eraDropdown.appendChild(item);
    });
  }
  
  eraDropdown.classList.add('show');
}

function updateEraHighlight() {
  const items = eraDropdown.querySelectorAll('.search-dropdown-item');
  items.forEach((item, index) => {
    item.classList.toggle('highlighted', index === eraSelectedIndex);
  });
}

function selectEra(era) {
  eraYearEl.value = era;
  hideEraDropdown();
  addVisualFeedback(eraYearEl);
}

function hideEraDropdown() {
  eraDropdown.classList.remove('show');
  eraSelectedIndex = -1;
}


function updateCountryDropdown() {
  countryDropdown.innerHTML = '';
  selectedIndex = -1;
  
  if (filteredCountries.length === 0) {
    countryDropdown.innerHTML = '<div class="search-dropdown-item">No countries found</div>';
  } else {
    filteredCountries.forEach((country, index) => {
      const item = document.createElement('div');
      item.className = 'search-dropdown-item';
      item.innerHTML = `${country.flag} ${country.name}`;
      item.addEventListener('click', () => selectCountry(country));
      countryDropdown.appendChild(item);
    });
  }
  
  countryDropdown.classList.add('show');
}

function updateCountryHighlight() {
  const items = countryDropdown.querySelectorAll('.search-dropdown-item');
  items.forEach((item, index) => {
    item.classList.toggle('highlighted', index === selectedIndex);
  });
}

function selectCountry(country) {
  countryEl.value = country.name;
  hideCountryDropdown();
  addVisualFeedback(countryEl);
}

function hideCountryDropdown() {
  countryDropdown.classList.remove('show');
  selectedIndex = -1;
}

// Hide dropdowns when clicking outside
document.addEventListener('click', (e) => {
  if (!e.target.closest('.search-container')) {
    hideCountryDropdown();
    hideEraDropdown();
  }
});

// Enhanced Generate button with form validation
goEl.addEventListener('click', ()=>{
  const img = sessionStorage.getItem('pf_image') || previewEl.src;
  if (!img) { 
    fileEl.click(); 
    return; 
  }
  
  // Get form values
  const eraYear = eraYearEl.value.trim();
  const country = countryEl.value.trim();
  
  // Basic validation
  if (!eraYear) {
    eraYearEl.focus();
    eraYearEl.style.borderColor = '#ef4444';
    setTimeout(() => {
      eraYearEl.style.borderColor = 'rgba(255, 255, 255, 0.1)';
    }, 2000);
    return;
  }
  
  if (!country) {
    countryEl.focus();
    countryEl.style.borderColor = '#ef4444';
    setTimeout(() => {
      countryEl.style.borderColor = 'rgba(255, 255, 255, 0.1)';
    }, 2000);
    return;
  }
  
  // Automatically generate a random activity based on the era
  const randomActivity = getRandomEraActivity(eraYear);
  
  // Store all data for result page
  sessionStorage.setItem('pf_image', img);
  sessionStorage.setItem('pf_eraYear', eraYear);
  sessionStorage.setItem('pf_country', country);
  sessionStorage.setItem('pf_activity', randomActivity);
  
  // Navigate to result page
  location.href = '/result.html';
});

// Add visual feedback for form interactions
function addVisualFeedback(element) {
  element.style.borderColor = '#ffd24a';
  setTimeout(() => {
    element.style.borderColor = 'rgba(255, 255, 255, 0.1)';
  }, 1000);
}

// Remove the old era input listener since we now have the new one above

// Set default values
eraYearEl.value = '1920s';
countryEl.value = 'United States';

// Add placeholder text to show users they can enter any year
eraYearEl.placeholder = 'Enter any year (e.g., 1935, 1920s, Victorian Era...)';

