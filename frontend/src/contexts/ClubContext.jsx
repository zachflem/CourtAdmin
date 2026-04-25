import { createContext, useContext, useEffect, useState } from 'react';

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
};

const ClubContext = createContext({ settings: DEFAULT_SETTINGS, setSettings: () => {} });

const API_BASE = import.meta.env.VITE_API_URL || '';

export function ClubProvider({ children }) {
  const [settings, setSettings] = useState(DEFAULT_SETTINGS);

  useEffect(() => {
    fetch(`${API_BASE}/api/club-settings`)
      .then((r) => r.json())
      .then((data) => setSettings(data))
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
