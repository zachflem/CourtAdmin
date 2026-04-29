import { createContext, useContext, useEffect, useState } from 'react';

const DEFAULT_AGE_GROUPS = ['U8', 'U10', 'U12', 'U14', 'U16', 'U18', 'Senior'];

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
  age_groups: DEFAULT_AGE_GROUPS,
};

function normaliseSettings(data) {
  const raw = data.age_groups;
  let age_groups = DEFAULT_AGE_GROUPS;
  if (Array.isArray(raw)) age_groups = raw;
  else if (typeof raw === 'string') {
    try { age_groups = JSON.parse(raw); } catch { /* use default */ }
  }
  return { ...data, age_groups };
}

const ClubContext = createContext({ settings: DEFAULT_SETTINGS, setSettings: () => {} });

const API_BASE = import.meta.env.VITE_API_URL || '';

export function ClubProvider({ children }) {
  const [settings, setSettings] = useState(DEFAULT_SETTINGS);

  useEffect(() => {
    fetch(`${API_BASE}/api/club-settings`)
      .then((r) => r.json())
      .then((data) => setSettings(normaliseSettings(data)))
      .catch(() => {});
  }, []);

  useEffect(() => {
    const root = document.documentElement;
    root.style.setProperty('--primary', settings.primary_color);
    root.style.setProperty('--secondary', settings.secondary_color);
    root.style.setProperty('--accent', settings.accent_color);
  }, [settings.primary_color, settings.secondary_color, settings.accent_color]);

  return (
    <ClubContext.Provider value={{ settings, setSettings }}>
      {children}
    </ClubContext.Provider>
  );
}

export function useClub() {
  return useContext(ClubContext);
}
