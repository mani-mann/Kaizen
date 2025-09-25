import React from 'react';

export function FuelPumpIcon({ className = 'h-7 w-7 text-primary' }) {
  return (
    <svg
      xmlns="http://www.w3.org/2000/svg"
      viewBox="0 0 24 24"
      className={className}
      fill="none"
      stroke="currentColor"
      strokeWidth="1.6"
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
    >
      {/* Pump body */}
      <rect x="4" y="3" width="10" height="18" rx="2"/>
      <rect x="6.5" y="6.5" width="5" height="4" rx="1"/>
      {/* Nozzle + hose */}
      <path d="M14 6.5h2.5l2 2M18.5 8.5c.9.9 1.5 1.6 1.5 3V16a3 3 0 0 1-6 0v-2.5"/>
      {/* Drop */}
      <path d="M20.2 18.2c-.6.7-1.2 1.5-1.2 2.2a1.8 1.8 0 0 0 3.6 0c0-.7-.6-1.5-1.2-2.2"/>
    </svg>
  );
}


