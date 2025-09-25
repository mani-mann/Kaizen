import React, { useEffect, useMemo, useRef, useState } from 'react';
import { addMonths, endOfMonth, endOfWeek, format, isAfter, isBefore, isSameDay, isSameMonth, parseISO, startOfMonth, startOfWeek } from 'date-fns';

function toDate(val) { return typeof val === 'string' ? parseISO(val) : val; }
function toISO(d) { return d ? new Date(d.getTime() - d.getTimezoneOffset()*60000).toISOString().slice(0,10) : ''; }

export function DateRangePicker({ start, end, onChange }) {
  const [open, setOpen] = useState(false);
  const [cursor, setCursor] = useState(() => start ? toDate(start) : new Date());
  const [draftStart, setDraftStart] = useState(() => start ? toDate(start) : null);
  const [draftEnd, setDraftEnd] = useState(() => end ? toDate(end) : null);
  const ref = useRef(null);

  useEffect(() => {
    function onDoc(e){ if (ref.current && !ref.current.contains(e.target)) setOpen(false); }
    document.addEventListener('click', onDoc); return () => document.removeEventListener('click', onDoc);
  }, []);

  useEffect(() => { if (open) { setDraftStart(start ? toDate(start) : null); setDraftEnd(end ? toDate(end) : null); setCursor(start ? toDate(start) : new Date()); } }, [open, start, end]);

  const weeks = useMemo(() => {
    const monthStart = startOfMonth(cursor);
    const monthEnd = endOfMonth(cursor);
    const gridStart = startOfWeek(monthStart, { weekStartsOn: 0 });
    const gridEnd = endOfWeek(monthEnd, { weekStartsOn: 0 });
    const days = [];
    for (let d = gridStart; d <= gridEnd; d = new Date(d.getFullYear(), d.getMonth(), d.getDate()+1)) {
      days.push(new Date(d));
    }
    const w = [];
    for (let i=0; i<days.length; i+=7) w.push(days.slice(i,i+7));
    return w;
  }, [cursor]);

  function onDayClick(day) {
    if (!draftStart || (draftStart && draftEnd)) { setDraftStart(day); setDraftEnd(null); }
    else if (isBefore(day, draftStart)) { setDraftEnd(draftStart); setDraftStart(day); }
    else { setDraftEnd(day); }
  }

  function inRange(day) {
    if (draftStart && draftEnd) return (isAfter(day, draftStart) && isBefore(day, draftEnd)) || isSameDay(day, draftStart) || isSameDay(day, draftEnd);
    if (draftStart && !draftEnd) return isSameDay(day, draftStart);
    return false;
  }

  function apply() {
    if (draftStart && draftEnd) {
      onChange({ start: new Date(draftStart).toISOString(), end: new Date(draftEnd).toISOString() });
      setOpen(false);
    }
  }

  const label = draftStart && draftEnd ? `${toISO(draftStart)} → ${toISO(draftEnd)}` : (start && end ? `${toISO(toDate(start))} → ${toISO(toDate(end))}` : 'Select date range');

  return (
    <div className="relative" ref={ref}>
      <button type="button" className="w-full border rounded px-3 py-2 text-left hover:bg-gray-50" onClick={()=>setOpen(o=>!o)}>
        <span className={start && end ? '' : 'text-gray-500'}>{label}</span>
      </button>
      {open && (
        <div className="absolute z-30 mt-2 w-80 bg-white border border-gray-200 rounded-2xl shadow-xl p-3">
          <div className="flex items-center justify-between px-1 py-2">
            <button className="h-8 w-8 rounded-full hover:bg-gray-100" onClick={()=>setCursor(addMonths(cursor,-1))}>‹</button>
            <div className="font-semibold">{format(cursor, 'MMMM yyyy')}</div>
            <button className="h-8 w-8 rounded-full hover:bg-gray-100" onClick={()=>setCursor(addMonths(cursor,1))}>›</button>
          </div>
          <div className="grid grid-cols-7 gap-2 text-center text-xs text-gray-500 px-1">
            {['Sun','Mon','Tue','Wed','Thu','Fri','Sat'].map(d=> <div key={d}>{d}</div>)}
          </div>
          <div className="mt-2 grid grid-cols-7 gap-2 px-1">
            {weeks.flat().map((day,i)=>{
              const muted = !isSameMonth(day, cursor);
              const selected = inRange(day);
              const isEdge = (draftStart && isSameDay(day, draftStart)) || (draftEnd && isSameDay(day, draftEnd));
              return (
                <button key={i} onClick={()=>onDayClick(day)} className={`h-10 rounded-lg text-sm border ${muted? 'text-gray-300':'text-gray-800'} ${selected? 'bg-accent/30 border-accent':'border-gray-200 hover:bg-gray-50'} ${isEdge? 'bg-primary text-white hover:bg-primary': ''}`}>
                  {format(day,'d')}
                </button>
              );
            })}
          </div>
          <div className="flex items-center justify-between mt-3 text-xs text-gray-500 px-1">
            <div>Select date range</div>
            <button className="bg-primary text-white rounded-full px-4 py-2 disabled:opacity-50" onClick={apply} disabled={!draftStart || !draftEnd}>Apply Range</button>
          </div>
        </div>
      )}
    </div>
  );
}


