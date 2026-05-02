import { createContext, useContext, useEffect, useState } from 'react';

const DEFAULT_AGE_GROUPS = ['U8', 'U10', 'U12', 'U14', 'U16', 'U18', 'Senior'];
const DEFAULT_DIVISIONS = ['Div 1', 'Div 2', 'Div 3'];
const DEFAULT_ENQUIRY_TYPES = [
  { label: 'General Enquiry', forward_to: '' },
  { label: 'Membership / Registration', forward_to: '' },
  { label: 'Coaching / Volunteering', forward_to: '' },
];

const DEFAULT_SETTINGS = {
  club_name: 'Our Club',
  mission_statement: 'Excellence in sport, community, and development.',
  about_text: 'Founded with a passion for sport and community development.',
  contact_phone: null,
  contact_email: null,
  contact_address: null,
  primary_color: '#1e40af',
  secondary_color: '#3b82f6',
  accent_color: '#f59e0b',
  logo_url: null,
  hero_image_url: null,
  about_image_url: null,
  social_facebook: null,
  social_instagram: null,
  social_twitter: null,
  social_tiktok: null,
  age_groups: DEFAULT_AGE_GROUPS,
  divisions: DEFAULT_DIVISIONS,
  contact_enquiry_types: DEFAULT_ENQUIRY_TYPES,
};

function normaliseSettings(data) {
  const rawAg = data.age_groups;
  let age_groups = DEFAULT_AGE_GROUPS;
  if (Array.isArray(rawAg)) age_groups = rawAg;
  else if (typeof rawAg === 'string') {
    try { age_groups = JSON.parse(rawAg); } catch { /* use default */ }
  }

  const rawEt = data.contact_enquiry_types;
  let contact_enquiry_types = DEFAULT_ENQUIRY_TYPES;
  if (Array.isArray(rawEt)) contact_enquiry_types = rawEt;
  else if (typeof rawEt === 'string') {
    try { contact_enquiry_types = JSON.parse(rawEt); } catch { /* use default */ }
  }

  const rawDiv = data.divisions;
  let divisions = DEFAULT_DIVISIONS;
  if (Array.isArray(rawDiv)) divisions = rawDiv;
  else if (typeof rawDiv === 'string') {
    try { divisions = JSON.parse(rawDiv); } catch { /* use default */ }
  }

  return { ...data, age_groups, divisions, contact_enquiry_types };
}

const ClubContext = createContext({ settings: DEFAULT_SETTINGS, setSettings: () => {} });

const API_BASE = import.meta.env.VITE_API_URL || '';

function getInitialSettings() {
  try {
    const t = JSON.parse(localStorage.getItem('ca_theme') || 'null');
    if (t) return { ...DEFAULT_SETTINGS, primary_color: t.p, secondary_color: t.s, accent_color: t.a };
  } catch (e) {}
  return DEFAULT_SETTINGS;
}

export function ClubProvider({ children }) {
  const [settings, setSettings] = useState(getInitialSettings);

  useEffect(() => {
    fetch(`${API_BASE}/api/club-settings`)
      .then((r) => r.json())
      .then((data) => setSettings(normaliseSettings(data)))
      .catch(() => {});
  }, []);

  useEffect(() => {
    const root = document.documentElement;
    root.style.setProperty('--primary', settings.primary_color);
    root.style.setProperty('--color-primary', settings.primary_color);
    root.style.setProperty('--secondary', settings.secondary_color);
    root.style.setProperty('--color-secondary', settings.secondary_color);
    root.style.setProperty('--accent', settings.accent_color);
    root.style.setProperty('--color-accent', settings.accent_color);
    const metaTheme = document.querySelector('meta[name="theme-color"]');
    if (metaTheme) metaTheme.setAttribute('content', settings.primary_color);
    try {
      localStorage.setItem('ca_theme', JSON.stringify({
        p: settings.primary_color,
        s: settings.secondary_color,
        a: settings.accent_color,
      }));
    } catch (e) {}
  }, [settings.primary_color, settings.secondary_color, settings.accent_color]);

  useEffect(() => {
    document.title = settings.club_name || 'CourtAdmin';
  }, [settings.club_name]);

  return (
    <ClubContext.Provider value={{ settings, setSettings }}>
      {children}
    </ClubContext.Provider>
  );
}

export function useClub() {
  return useContext(ClubContext);
}
