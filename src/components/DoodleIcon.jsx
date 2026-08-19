export default function DoodleIcon({ name, className = '' }) {
  return (
    <svg className={`doodle-icon ${className}`} viewBox="0 0 64 64" fill="none" aria-hidden="true">
      {name === 'mascot' ? (
        <g>
          <path d="M18 45c-7-1-10-6-8-12 1-4 4-6 8-6-1-8 5-14 13-13 5-5 14-2 14 5 7 0 11 5 10 11 5 2 7 7 4 12-3 5-10 6-17 4-5 5-14 5-19 1Z" fill="#fff" />
          <path d="M18 45c-7-1-10-6-8-12 1-4 4-6 8-6-1-8 5-14 13-13 5-5 14-2 14 5 7 0 11 5 10 11 5 2 7 7 4 12-3 5-10 6-17 4-5 5-14 5-19 1Z" />
          <circle cx="26" cy="33" r="1.8" fill="currentColor" stroke="none" />
          <circle cx="42" cy="33" r="1.8" fill="currentColor" stroke="none" />
          <path d="M29 39c3 3 7 3 10 0M29 22c2 4 7 5 10 1" />
          <path d="M16 35l-3 1m34-1 3 1" stroke="#ff806d" />
        </g>
      ) : null}
      {name === 'plane' ? (
        <g>
          <path d="m8 29 46-17-15 40-9-14-10 7 3-12-15-4Z" fill="#edf7ff" />
          <path d="m8 29 46-17-15 40-9-14-10 7 3-12-15-4Zm15 4 31-21-24 26" />
        </g>
      ) : null}
      {name === 'note' ? (
        <g>
          <path d="M14 9h34v46H14z" fill="#fff8dc" />
          <path d="M14 9h34v46H14zM20 19h20M20 27h16M20 35h20M20 43h13" />
          <path d="M11 14h6m-6 8h6m-6 8h6m-6 8h6m-6 8h6" />
          <path d="m48 43 8-18 4 2-8 18-5 4 1-6Z" fill="#edf7ff" />
        </g>
      ) : null}
      {name === 'clock' ? (
        <g>
          <circle cx="32" cy="32" r="23" fill="#edf7ff" />
          <path d="M32 19v14l10 6" />
        </g>
      ) : null}
      {name === 'calendar' ? (
        <g>
          <path d="M11 16h42v38H11z" fill="#e8f8f2" />
          <path d="M11 16h42v38H11zM11 27h42M20 10v12M44 10v12" />
          <path d="M20 35h5m7 0h5m7 0h2m-26 9h5m7 0h5m7 0h2" />
        </g>
      ) : null}
      {name === 'leaf' ? (
        <g>
          <path d="M15 53c5-20 15-31 35-40-2 20-13 35-35 40Z" fill="#e8f8f2" />
          <path d="M15 53c5-20 15-31 35-40-2 20-13 35-35 40ZM19 48c8-8 16-15 26-24" />
        </g>
      ) : null}
    </svg>
  )
}
