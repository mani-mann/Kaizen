import React, { useEffect, useMemo, useRef, useState } from 'react';

export function MultiSelect({ options, value = [], onChange, placeholder = 'Select', labelKey = 'name', valueKey = 'id' }) {
  const [open, setOpen] = useState(false);
  const ref = useRef(null);

  useEffect(() => {
    function onDoc(e) {
      if (ref.current && !ref.current.contains(e.target)) setOpen(false);
    }
    document.addEventListener('click', onDoc);
    return () => document.removeEventListener('click', onDoc);
  }, []);

  const selected = useMemo(() => options.filter(o => value.includes(o[valueKey])), [options, value, valueKey]);
  const pillText = selected.length ? selected.map(s => s[labelKey]).join(', ') : placeholder;

  function toggle(id) {
    if (value.includes(id)) onChange(value.filter(v => v !== id));
    else onChange([...value, id]);
  }

  function selectAll() {
    onChange(options.map(o => o[valueKey]));
  }
  function clearAll() { onChange([]); }

  return (
    <div className="relative" ref={ref}>
      <button type="button" className="w-full border rounded px-3 py-2 text-left hover:bg-gray-50" onClick={() => setOpen(o => !o)}>
        <span className={selected.length ? '' : 'text-gray-500'}>{pillText}</span>
      </button>
      {open && (
        <div className="absolute z-20 mt-1 w-full bg-white border border-gray-200 rounded shadow-lg">
          <div className="flex items-center justify-between px-3 py-2 text-xs text-gray-600 border-b">
            <button className="underline" onClick={selectAll}>Select all</button>
            <button className="underline" onClick={clearAll}>Clear</button>
          </div>
          <div className="max-h-56 overflow-auto py-1">
            {options.map((o) => (
              <label key={o[valueKey]} className="flex items-center gap-2 px-3 py-2 hover:bg-gray-50 cursor-pointer">
                <input
                  type="checkbox"
                  checked={value.includes(o[valueKey])}
                  onChange={() => toggle(o[valueKey])}
                />
                <span className="text-sm">{o[labelKey]}</span>
              </label>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}


