import { useEffect, useState } from 'react';
import { useParams } from 'react-router-dom';
import { useClub } from '../contexts/ClubContext';

const API_BASE = import.meta.env.VITE_API_URL || '';

async function apiFetch(path) {
  const res = await fetch(`${API_BASE}${path}`, { credentials: 'include' });
  if (!res.ok) throw new Error(`Request failed (${res.status})`);
  return res.json();
}

function formatDob(iso) {
  if (!iso) return '';
  return new Date(iso).toLocaleDateString('en-AU', { day: 'numeric', month: 'short', year: 'numeric' });
}

export function GradingPrintPage() {
  const { id } = useParams();
  const { settings } = useClub();
  const [session, setSession] = useState(null);
  const [error, setError] = useState('');

  useEffect(() => {
    apiFetch(`/api/grading-sessions/${id}`)
      .then(setSession)
      .catch((err) => setError(err.message));
  }, [id]);

  if (error) {
    return (
      <div style={{ padding: '2rem', fontFamily: 'Arial, sans-serif' }}>
        <p style={{ color: '#dc2626' }}>Error: {error}</p>
      </div>
    );
  }

  if (!session) {
    return (
      <div style={{ padding: '2rem', fontFamily: 'Arial, sans-serif' }}>
        <p>Loading…</p>
      </div>
    );
  }

  const players = session.players || [];
  const sessionDate = session.conducted_at
    ? new Date(session.conducted_at).toLocaleDateString('en-AU', { day: 'numeric', month: 'long', year: 'numeric' })
    : '';

  return (
    <>
      <style>{`
        * { box-sizing: border-box; margin: 0; padding: 0; }
        body { font-family: Arial, sans-serif; font-size: 11px; background: #fff; color: #000; }
        .gp-header { display: flex; align-items: flex-start; justify-content: space-between; margin-bottom: 12px; padding-bottom: 8px; border-bottom: 2px solid #000; }
        .gp-header-left { display: flex; align-items: flex-start; gap: 12px; }
        .gp-logo { width: 56px; height: 56px; object-fit: contain; flex-shrink: 0; }
        .gp-header-text h1 { font-size: 15px; font-weight: bold; }
        .gp-header-text h2 { font-size: 12px; font-weight: normal; margin-top: 3px; color: #444; }
        .gp-header-text .gp-club { font-size: 13px; font-weight: bold; margin-bottom: 2px; }
        .gp-meta { font-size: 10px; color: #666; margin-top: 3px; }
        .gp-print-btn { padding: 6px 14px; background: #2563eb; color: #fff; border: none; border-radius: 4px; cursor: pointer; font-size: 12px; white-space: nowrap; }
        table { width: 100%; border-collapse: collapse; }
        thead th { background: #1f2937; color: #fff; padding: 5px 6px; text-align: left; font-size: 10px; font-weight: bold; }
        tbody td { padding: 5px 6px; border-bottom: 1px solid #d1d5db; vertical-align: top; font-size: 10.5px; }
        tbody tr:nth-child(even) td { background: #f9fafb; }
        .col-num { width: 28px; text-align: center; }
        .col-name { width: 150px; font-weight: bold; }
        .col-dob { width: 80px; }
        .col-prevteam { width: 140px; }
        .col-prevgrade { width: 56px; text-align: center; font-weight: bold; color: #6b7280; }
        .col-newgrade { width: 60px; }
        .col-division { width: 90px; }
        .col-notes { width: auto; min-width: 120px; }
        .box-cell { border: 1.5px solid #9ca3af !important; height: 28px; min-width: 50px; }
        .notes-cell { border-bottom: 1px dotted #9ca3af !important; height: 28px; }
        .gp-footer { margin-top: 12px; font-size: 9px; color: #aaa; text-align: right; }
        @media print {
          .gp-print-btn { display: none !important; }
          body { font-size: 10px; }
          @page { size: A4 landscape; margin: 12mm; }
        }
      `}</style>

      <div style={{ padding: '16px 20px', maxWidth: '100%' }}>
        <div className="gp-header">
          <div className="gp-header-left">
            {settings.logo_url && (
              <img src={settings.logo_url} alt="" className="gp-logo" />
            )}
            <div className="gp-header-text">
            <div className="gp-club">{settings.club_name || 'CourtAdmin'}</div>
            <h1>{session.name}</h1>
            <h2>
              {session.age_group}
              {session.gender !== 'Mixed' ? ` · ${session.gender}` : ''}
              {sessionDate ? ` · ${sessionDate}` : ''}
              {session.season_name ? ` · ${session.season_name}` : ''}
            </h2>
            <div className="gp-meta">{players.length} player{players.length !== 1 ? 's' : ''} listed</div>
            </div>
          </div>
          <button className="gp-print-btn" onClick={() => window.print()}>
            Print this page
          </button>
        </div>

        <table>
          <thead>
            <tr>
              <th className="col-num">#</th>
              <th className="col-name">Name</th>
              <th className="col-dob">DOB</th>
              <th className="col-prevteam">Previous Teams</th>
              <th className="col-prevgrade" style={{ textAlign: 'center' }}>Prev Grade</th>
              <th className="col-newgrade" style={{ textAlign: 'center' }}>New Grade</th>
              <th className="col-division">Division</th>
              <th className="col-notes">Notes</th>
            </tr>
          </thead>
          <tbody>
            {players.map((p, i) => {
              let prevTeams = '';
              try { prevTeams = (JSON.parse(p.snapshot_previous_teams || '[]')).join(', '); } catch { /* */ }

              const isCommitted = session.status === 'committed';

              return (
                <tr key={p.id}>
                  <td className="col-num">{i + 1}</td>
                  <td className="col-name">{p.snapshot_name}</td>
                  <td className="col-dob">{formatDob(p.snapshot_dob)}</td>
                  <td className="col-prevteam">{prevTeams || '—'}</td>
                  <td className="col-prevgrade">{p.snapshot_grading_level ?? '—'}</td>
                  <td className={isCommitted ? 'col-newgrade' : 'col-newgrade box-cell'}>
                    {isCommitted ? (p.new_grading_level ?? '') : ''}
                  </td>
                  <td className={isCommitted ? 'col-division' : 'col-division box-cell'}>
                    {isCommitted ? (p.division_recommendation ?? '') : ''}
                  </td>
                  <td className={isCommitted ? 'col-notes' : 'col-notes notes-cell'}>
                    {isCommitted ? (p.coach_notes ?? '') : ''}
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>

        <div className="gp-footer">
          Generated by CourtAdmin · {new Date().toLocaleDateString('en-AU')}
        </div>
      </div>
    </>
  );
}
