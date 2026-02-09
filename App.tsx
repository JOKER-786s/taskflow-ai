import React, { useState, useEffect, useRef } from 'react';
import { Status, Priority, Ticket, ChatMessage, ChatMode, AspectRatio, Note, Slide } from './types';
import { LayoutDashboard, CalendarIcon, Sparkles, Plus, Trash2, X, Moon, Sun, Clock, Send, Brain, MapPin, Image, Zap, Search, FileText, Presentation, Grid, Type, ChartLine, Play, Pause, CalendarPlus } from './components/Icons';
import { geminiService } from './services/geminiService';

// --- Local Storage Keys ---
const STORAGE_KEY_TICKETS = 'taskflow_tickets';
const STORAGE_KEY_THEME = 'taskflow_theme';
const STORAGE_KEY_NOTES = 'taskflow_notes';
const STORAGE_KEY_FONT = 'taskflow_font';

// --- Global Types for API Key Selection ---
interface AIStudioClient {
  hasSelectedApiKey: () => Promise<boolean>;
  openSelectKey: () => Promise<void>;
}

// --- Helper: Confetti Logic ---
const triggerConfetti = () => {
  const count = 200;
  // Simple particle generator (since we can't import canvas-confetti easily)
  const canvas = document.createElement('canvas');
  canvas.style.position = 'fixed';
  canvas.style.top = '0';
  canvas.style.left = '0';
  canvas.style.width = '100%';
  canvas.style.height = '100%';
  canvas.style.pointerEvents = 'none';
  canvas.style.zIndex = '9999';
  document.body.appendChild(canvas);
  
  const ctx = canvas.getContext('2d');
  if (!ctx) return;
  
  canvas.width = window.innerWidth;
  canvas.height = window.innerHeight;

  const particles: any[] = [];
  const colors = ['#6366f1', '#10b981', '#f59e0b', '#ec4899'];

  for (let i = 0; i < 100; i++) {
    particles.push({
      x: window.innerWidth / 2,
      y: window.innerHeight / 2,
      vx: (Math.random() - 0.5) * 20,
      vy: (Math.random() - 0.5) * 20,
      color: colors[Math.floor(Math.random() * colors.length)],
      alpha: 1
    });
  }

  const animate = () => {
    if (!ctx) return;
    ctx.clearRect(0, 0, canvas.width, canvas.height);
    let alive = false;
    particles.forEach(p => {
      p.x += p.vx;
      p.y += p.vy;
      p.vy += 0.5; // Gravity
      p.alpha -= 0.02;
      
      if (p.alpha > 0) {
        alive = true;
        ctx.globalAlpha = p.alpha;
        ctx.fillStyle = p.color;
        ctx.beginPath();
        ctx.arc(p.x, p.y, 5, 0, Math.PI * 2);
        ctx.fill();
      }
    });

    if (alive) {
      requestAnimationFrame(animate);
    } else {
      document.body.removeChild(canvas);
    }
  };
  animate();
};

// --- Helper: Markdown Renderer ---
const MarkdownRenderer: React.FC<{ content: string }> = ({ content }) => {
  const lines = content.split('\n');
  return (
    <div className="space-y-2 text-sm leading-relaxed">
      {lines.map((line, i) => {
        if (line.startsWith('```')) return null; 
        if (line.startsWith('### ')) return <h3 key={i} className="text-lg font-bold mt-4 text-indigo-600 dark:text-indigo-400">{line.replace('### ', '')}</h3>;
        if (line.startsWith('## ')) return <h2 key={i} className="text-xl font-bold mt-5 text-gray-800 dark:text-gray-100">{line.replace('## ', '')}</h2>;
        if (line.startsWith('# ')) return <h1 key={i} className="text-2xl font-bold mt-6 border-b pb-2">{line.replace('# ', '')}</h1>;
        if (line.trim().startsWith('- ') || line.trim().startsWith('* ')) {
          return (
            <div key={i} className="flex gap-2 ml-4">
              <span className="text-indigo-500">•</span>
              <span>{parseInline(line.replace(/^[-*]\s/, ''))}</span>
            </div>
          );
        }
        if (!line.trim()) return <div key={i} className="h-2" />;
        return <p key={i}>{parseInline(line)}</p>;
      })}
    </div>
  );
};

const parseInline = (text: string) => {
  const parts = text.split(/(\*\*.*?\*\*|`.*?`)/g);
  return parts.map((part, i) => {
    if (part.startsWith('**') && part.endsWith('**')) {
      return <strong key={i} className="font-bold text-indigo-700 dark:text-indigo-300">{part.slice(2, -2)}</strong>;
    }
    if (part.startsWith('`') && part.endsWith('`')) {
      return <code key={i} className="bg-gray-200 dark:bg-gray-700 px-1 rounded text-xs font-mono">{part.slice(1, -1)}</code>;
    }
    return part;
  });
};

// --- Components ---

// 1. Kanban Column Component
interface KanbanColumnProps {
  status: Status;
  tickets: Ticket[];
  onDrop: (ticketId: string, newStatus: Status) => void;
  onEdit: (ticket: Ticket) => void;
  onDelete: (id: string) => void;
  onToggleTimer: (id: string) => void;
  // Bulk Actions
  selectedIds: Set<string>;
  onToggleSelection: (id: string) => void;
}

const KanbanColumn: React.FC<KanbanColumnProps> = ({ status, tickets, onDrop, onEdit, onDelete, onToggleTimer, selectedIds, onToggleSelection }) => {
  const handleDragOver = (e: React.DragEvent) => {
    e.preventDefault();
  };

  const handleDrop = (e: React.DragEvent) => {
    const ticketId = e.dataTransfer.getData('ticketId');
    if (ticketId) {
      onDrop(ticketId, status);
    }
  };

  return (
    <div 
      className="flex flex-col flex-1 min-w-[320px] bg-white/40 dark:bg-gray-900/40 backdrop-blur-md rounded-2xl p-4 border border-white/60 dark:border-gray-700 shadow-xl transition-all animate-slide-up hover:shadow-2xl"
      onDragOver={handleDragOver}
      onDrop={handleDrop}
    >
      <div className="flex items-center justify-between mb-4">
        <h3 className="font-bold text-gray-800 dark:text-gray-100 tracking-wide uppercase text-xs flex items-center gap-2">
          {status}
        </h3>
        <span className="bg-white/70 dark:bg-gray-700 text-xs font-bold px-2.5 py-1 rounded-full shadow-inner">{tickets.length}</span>
      </div>
      <div className="flex flex-col gap-3 overflow-y-auto max-h-[calc(100vh-220px)] custom-scrollbar pr-1">
        {tickets.map(ticket => (
          <div 
            key={ticket.id}
            draggable
            onDragStart={(e) => e.dataTransfer.setData('ticketId', ticket.id)}
            className={`bg-white/80 dark:bg-gray-800/80 p-5 rounded-2xl shadow-sm border ${ticket.isTiming ? 'border-indigo-400 dark:border-indigo-500 ring-2 ring-indigo-200 dark:ring-indigo-900' : (selectedIds.has(ticket.id) ? 'border-indigo-500 ring-1 ring-indigo-500' : 'border-transparent')} hover:border-indigo-200 dark:hover:border-indigo-600 cursor-move hover:shadow-lg transition-all duration-300 group relative hover:-translate-y-1`}
          >
            <div className="flex justify-between items-start mb-3">
               <div className="flex items-center gap-2">
                 <input 
                   type="checkbox"
                   className="w-4 h-4 rounded text-indigo-600 focus:ring-indigo-500 cursor-pointer accent-indigo-500 transition-all transform hover:scale-110"
                   checked={selectedIds.has(ticket.id)}
                   onChange={(e) => { e.stopPropagation(); onToggleSelection(ticket.id); }}
                 />
                 <span className={`text-[10px] uppercase font-bold px-2 py-0.5 rounded-full ${
                  ticket.priority === Priority.High ? 'bg-rose-100 text-rose-600 dark:bg-rose-900/40 dark:text-rose-300' :
                  ticket.priority === Priority.Medium ? 'bg-amber-100 text-amber-600 dark:bg-amber-900/40 dark:text-amber-300' :
                  'bg-sky-100 text-sky-600 dark:bg-sky-900/40 dark:text-sky-300'
                }`}>
                  {ticket.priority}
                </span>
               </div>
              <button onClick={() => onDelete(ticket.id)} className="text-gray-400 hover:text-red-500 opacity-0 group-hover:opacity-100 transition-all duration-300 hover:scale-110">
                <Trash2 className="w-4 h-4" />
              </button>
            </div>
            
            <h4 className="font-bold text-gray-800 dark:text-white mb-2 leading-tight">{ticket.title}</h4>
            <p className="text-sm text-gray-500 dark:text-gray-400 line-clamp-2 mb-4 font-medium">{ticket.description}</p>
            
            {/* Timer & Meta Controls */}
            <div className="flex justify-between items-center text-xs pt-3 border-t border-gray-100 dark:border-gray-700">
              <div className="flex items-center gap-3">
                 <button 
                  onClick={() => onToggleTimer(ticket.id)}
                  className={`flex items-center gap-1.5 px-2 py-1 rounded-lg transition-all ${
                     ticket.isTiming 
                     ? 'bg-indigo-100 text-indigo-700 dark:bg-indigo-900/50 dark:text-indigo-300 animate-pulse' 
                     : 'bg-gray-100 text-gray-600 dark:bg-gray-700 dark:text-gray-300 hover:bg-indigo-50 dark:hover:bg-indigo-900/30'
                  }`}
                 >
                   {ticket.isTiming ? <Pause className="w-3 h-3" /> : <Play className="w-3 h-3" />}
                   <span className="font-mono font-bold">
                     {(ticket.timeSpent < 1 && ticket.timeSpent > 0) ? '< 1m' : `${Math.floor(ticket.timeSpent / 60)}h ${Math.floor(ticket.timeSpent % 60)}m`}
                   </span>
                 </button>
                 <div className="flex items-center gap-1 text-gray-400">
                    <Clock className="w-3 h-3" />
                    {new Date(ticket.dueDate).toLocaleDateString(undefined, { month: 'short', day: 'numeric' })}
                 </div>
              </div>
              
              <button onClick={() => onEdit(ticket)} className="text-indigo-500 hover:text-indigo-700 dark:hover:text-indigo-300 font-bold transition-colors">
                Edit
              </button>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
};

// 2. Calendar Component
const CalendarView: React.FC<{ tickets: Ticket[] }> = ({ tickets }) => {
  const today = new Date();
  const [currentMonth, setCurrentMonth] = useState(today.getMonth());
  const [currentYear, setCurrentYear] = useState(today.getFullYear());

  const daysInMonth = new Date(currentYear, currentMonth + 1, 0).getDate();
  const firstDay = new Date(currentYear, currentMonth, 1).getDay();

  const days = Array.from({ length: daysInMonth }, (_, i) => i + 1);
  const blanks = Array.from({ length: firstDay }, (_, i) => i);

  const getTicketsForDay = (day: number) => {
    return tickets.filter(t => {
      const d = new Date(t.dueDate);
      return d.getDate() === day && d.getMonth() === currentMonth && d.getFullYear() === currentYear;
    });
  };

  const monthNames = ["January", "February", "March", "April", "May", "June",
    "July", "August", "September", "October", "November", "December"
  ];

  return (
    <div className="p-6 bg-white/60 dark:bg-gray-800/60 backdrop-blur-xl rounded-2xl shadow-xl border border-white/50 dark:border-gray-700 animate-fade-in h-full overflow-y-auto">
      <div className="flex justify-between mb-6">
        <h2 className="text-2xl font-bold bg-clip-text text-transparent bg-gradient-to-r from-indigo-600 to-purple-600">{monthNames[currentMonth]} {currentYear}</h2>
        <div className="flex gap-2">
           <button onClick={() => setCurrentMonth(prev => prev === 0 ? 11 : prev - 1)} className="p-2 hover:bg-white dark:hover:bg-gray-700 rounded-full shadow-sm transition-all hover:scale-110">&lt;</button>
           <button onClick={() => setCurrentMonth(prev => prev === 11 ? 0 : prev + 1)} className="p-2 hover:bg-white dark:hover:bg-gray-700 rounded-full shadow-sm transition-all hover:scale-110">&gt;</button>
        </div>
      </div>
      <div className="grid grid-cols-7 gap-2 mb-2">
        {['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'].map(d => (
          <div key={d} className="text-center font-bold text-gray-500 text-xs uppercase tracking-wider">{d}</div>
        ))}
      </div>
      <div className="grid grid-cols-7 gap-2">
        {blanks.map(i => <div key={`blank-${i}`} className="h-28"></div>)}
        {days.map(day => {
          const daysTickets = getTicketsForDay(day);
          const isToday = day === today.getDate() && currentMonth === today.getMonth() && currentYear === today.getFullYear();
          return (
            <div key={day} className={`h-28 border border-transparent p-1 rounded-lg transition-all hover:bg-white/50 dark:hover:bg-gray-700/50 hover:shadow-md overflow-y-auto relative ${isToday ? 'bg-indigo-50/80 dark:bg-indigo-900/30 border-indigo-200' : 'bg-white/30 dark:bg-gray-800/30'}`}>
              <div className={`text-right text-xs mb-1 p-1 inline-block absolute top-1 right-1 rounded-full w-6 h-6 flex items-center justify-center ${isToday ? 'bg-indigo-600 text-white font-bold' : 'text-gray-500'}`}>{day}</div>
              <div className="mt-6 space-y-1">
                {daysTickets.map(t => (
                  <div key={t.id} className={`text-[10px] px-1.5 py-0.5 rounded truncate shadow-sm ${
                    t.priority === Priority.High ? 'bg-red-100 text-red-700 dark:bg-red-900/40 dark:text-red-200' : 
                    'bg-indigo-100 text-indigo-700 dark:bg-indigo-900/40 dark:text-indigo-200'
                  }`}>
                    {t.title}
                  </div>
                ))}
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
};

// 3. Analytics View Component (SVG Line Chart)
const AnalyticsView: React.FC<{ tickets: Ticket[] }> = ({ tickets }) => {
  // Mock Logic for simple analytics: Group total hours spent by creation day (approximate productivity)
  // In a real app, we'd use a separate work log history.
  // Here we show: Last 7 days, sum of timeSpent for tickets created or completed on that day.
  
  const last7Days = Array.from({ length: 7 }, (_, i) => {
    const d = new Date();
    d.setDate(d.getDate() - (6 - i));
    return d;
  });

  const data = last7Days.map(date => {
    const dateStr = date.toLocaleDateString();
    // Sum timeSpent for tickets created on this day (simplified metric)
    const minutes = tickets
      .filter(t => new Date(t.createdAt).toLocaleDateString() === dateStr)
      .reduce((sum, t) => sum + t.timeSpent, 0);
    return { date: dateStr, value: minutes / 60 }; // Hours
  });

  const maxVal = Math.max(...data.map(d => d.value), 1); // Avoid div by zero
  const height = 200;
  const width = 600;
  const padding = 40;
  
  // Calculate SVG points
  const points = data.map((d, i) => {
    const x = padding + (i * ((width - 2 * padding) / (data.length - 1)));
    const y = height - padding - ((d.value / maxVal) * (height - 2 * padding));
    return `${x},${y}`;
  }).join(' ');

  return (
    <div className="flex-1 flex flex-col p-8 items-center justify-center animate-fade-in">
       <div className="w-full max-w-4xl bg-white/60 dark:bg-gray-800/60 backdrop-blur-xl rounded-3xl p-8 shadow-2xl border border-white/50 dark:border-gray-700">
         <h2 className="text-3xl font-bold mb-2 bg-clip-text text-transparent bg-gradient-to-r from-pink-500 to-violet-500">Productivity Pulse</h2>
         <p className="text-gray-500 dark:text-gray-400 mb-8">Tracking hours logged on tasks created over the last 7 days.</p>
         
         <div className="relative w-full aspect-video bg-white/50 dark:bg-gray-900/50 rounded-2xl shadow-inner flex items-center justify-center p-4 border border-white/20 dark:border-gray-800">
           <svg viewBox={`0 0 ${width} ${height}`} className="w-full h-full overflow-visible">
              {/* Grid Lines */}
              {[0, 0.25, 0.5, 0.75, 1].map((p, i) => (
                <line 
                  key={i} 
                  x1={padding} 
                  y1={height - padding - (p * (height - 2 * padding))} 
                  x2={width - padding} 
                  y2={height - padding - (p * (height - 2 * padding))} 
                  stroke="currentColor" 
                  className="text-gray-200 dark:text-gray-700" 
                  strokeWidth="1"
                  strokeDasharray="4"
                />
              ))}

              {/* Line Path */}
              <polyline 
                 fill="none" 
                 stroke="url(#gradient)" 
                 strokeWidth="4" 
                 points={points}
                 strokeLinecap="round"
                 strokeLinejoin="round"
                 className="drop-shadow-lg"
              />
              <defs>
                <linearGradient id="gradient" x1="0" y1="0" x2="1" y2="0">
                  <stop offset="0%" stopColor="#ec4899" />
                  <stop offset="100%" stopColor="#6366f1" />
                </linearGradient>
              </defs>

              {/* Data Points */}
              {data.map((d, i) => {
                 const x = padding + (i * ((width - 2 * padding) / (data.length - 1)));
                 const y = height - padding - ((d.value / maxVal) * (height - 2 * padding));
                 return (
                   <g key={i} className="group">
                     <circle cx={x} cy={y} r="5" className="fill-white dark:fill-gray-900 stroke-pink-500 dark:stroke-indigo-400 stroke-2 transition-all group-hover:r-7 cursor-pointer" />
                     <text x={x} y={height - 10} textAnchor="middle" className="text-[10px] fill-gray-500 font-bold uppercase">{d.date.split('/')[1]}</text>
                     {/* Tooltip */}
                     <rect x={x - 25} y={y - 35} width="50" height="25" rx="4" className="fill-gray-800 dark:fill-white opacity-0 group-hover:opacity-100 transition-opacity pointer-events-none" />
                     <text x={x} y={y - 18} textAnchor="middle" className="fill-white dark:fill-gray-900 text-[10px] font-bold opacity-0 group-hover:opacity-100 pointer-events-none">{d.value.toFixed(1)}h</text>
                   </g>
                 )
              })}
           </svg>
         </div>

         <div className="grid grid-cols-3 gap-6 mt-8">
            <div className="bg-indigo-50 dark:bg-indigo-900/20 p-4 rounded-2xl border border-indigo-100 dark:border-indigo-800 text-center">
               <div className="text-2xl font-bold text-indigo-600 dark:text-indigo-400">{data.reduce((a, b) => a + b.value, 0).toFixed(1)}h</div>
               <div className="text-xs text-gray-500 uppercase tracking-wider font-bold">Total Focus</div>
            </div>
            <div className="bg-emerald-50 dark:bg-emerald-900/20 p-4 rounded-2xl border border-emerald-100 dark:border-emerald-800 text-center">
               <div className="text-2xl font-bold text-emerald-600 dark:text-emerald-400">{tickets.filter(t => t.status === Status.Completed).length}</div>
               <div className="text-xs text-gray-500 uppercase tracking-wider font-bold">Tasks Done</div>
            </div>
             <div className="bg-amber-50 dark:bg-amber-900/20 p-4 rounded-2xl border border-amber-100 dark:border-amber-800 text-center">
               <div className="text-2xl font-bold text-amber-600 dark:text-amber-400">{tickets.filter(t => t.status === Status.InProgress).length}</div>
               <div className="text-xs text-gray-500 uppercase tracking-wider font-bold">In Progress</div>
            </div>
         </div>
       </div>
    </div>
  );
};

// 4. Ticket Modal Form
const TicketModal: React.FC<{ 
  isOpen: boolean; 
  onClose: () => void; 
  onSave: (t: Omit<Ticket, 'id' | 'createdAt'>) => void;
  initialData?: Ticket | null;
  prefillData?: Partial<Ticket>; // NEW: For creating from note
}> = ({ isOpen, onClose, onSave, initialData, prefillData }) => {
  const [formData, setFormData] = useState({
    title: '',
    description: '',
    status: Status.Backlog,
    priority: Priority.Medium,
    dueDate: new Date().toISOString().split('T')[0],
    tags: '',
    timeSpent: 0,
    isTiming: false
  });

  useEffect(() => {
    if (initialData) {
      setFormData({
        title: initialData.title,
        description: initialData.description,
        status: initialData.status,
        priority: initialData.priority,
        dueDate: initialData.dueDate.split('T')[0],
        tags: initialData.tags.join(', '),
        timeSpent: initialData.timeSpent || 0,
        isTiming: initialData.isTiming || false
      });
    } else if (prefillData) {
        setFormData(prev => ({
            ...prev,
            title: prefillData.title || '',
            description: prefillData.description || '',
            status: Status.Backlog,
            priority: Priority.Medium,
            dueDate: new Date().toISOString().split('T')[0]
        }));
    } else {
       setFormData({
        title: '',
        description: '',
        status: Status.Backlog,
        priority: Priority.Medium,
        dueDate: new Date().toISOString().split('T')[0],
        tags: '',
        timeSpent: 0,
        isTiming: false
      });
    }
  }, [initialData, prefillData, isOpen]);

  if (!isOpen) return null;

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    onSave({
      ...formData,
      tags: formData.tags.split(',').map(s => s.trim()).filter(Boolean),
      dueDate: new Date(formData.dueDate).toISOString()
    });
    onClose();
  };

  return (
    <div className="fixed inset-0 bg-indigo-900/20 z-50 flex items-center justify-center backdrop-blur-sm animate-fade-in">
      <div className="bg-white/90 dark:bg-gray-800/95 rounded-2xl p-8 w-full max-w-md shadow-2xl border border-white/50 dark:border-gray-700 transform transition-all animate-slide-up">
        <div className="flex justify-between items-center mb-6">
          <h2 className="text-2xl font-bold bg-clip-text text-transparent bg-gradient-to-r from-indigo-600 to-purple-600">{initialData ? 'Edit Ticket' : 'New Ticket'}</h2>
          <button onClick={onClose} className="p-1 hover:bg-gray-100 dark:hover:bg-gray-700 rounded-full transition-colors"><X className="w-6 h-6 text-gray-500" /></button>
        </div>
        <form onSubmit={handleSubmit} className="space-y-5">
          <div>
            <label className="block text-sm font-bold text-gray-700 dark:text-gray-300 mb-1">Title</label>
            <input 
              required
              className="w-full p-3 rounded-lg border border-gray-200 dark:border-gray-600 bg-white dark:bg-gray-700/50 focus:ring-2 focus:ring-indigo-500 outline-none transition-all"
              value={formData.title}
              onChange={e => setFormData({...formData, title: e.target.value})}
              placeholder="What needs doing?"
            />
          </div>
          <div className="grid grid-cols-2 gap-4">
             <div>
              <label className="block text-sm font-bold text-gray-700 dark:text-gray-300 mb-1">Status</label>
              <select 
                className="w-full p-3 rounded-lg border border-gray-200 dark:border-gray-600 bg-white dark:bg-gray-700/50 outline-none"
                value={formData.status}
                onChange={e => setFormData({...formData, status: e.target.value as Status})}
              >
                {Object.values(Status).map(s => <option key={s} value={s}>{s}</option>)}
              </select>
            </div>
             <div>
              <label className="block text-sm font-bold text-gray-700 dark:text-gray-300 mb-1">Priority</label>
              <select 
                className="w-full p-3 rounded-lg border border-gray-200 dark:border-gray-600 bg-white dark:bg-gray-700/50 outline-none"
                value={formData.priority}
                onChange={e => setFormData({...formData, priority: e.target.value as Priority})}
              >
                {Object.values(Priority).map(p => <option key={p} value={p}>{p}</option>)}
              </select>
            </div>
          </div>
          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-bold text-gray-700 dark:text-gray-300 mb-1">Due Date</label>
              <input 
                type="date"
                required
                className="w-full p-3 rounded-lg border border-gray-200 dark:border-gray-600 bg-white dark:bg-gray-700/50 outline-none"
                value={formData.dueDate}
                onChange={e => setFormData({...formData, dueDate: e.target.value})}
              />
            </div>
            <div>
              <label className="block text-sm font-bold text-gray-700 dark:text-gray-300 mb-1">Time Spent (min)</label>
              <input 
                type="number"
                className="w-full p-3 rounded-lg border border-gray-200 dark:border-gray-600 bg-white dark:bg-gray-700/50 outline-none"
                value={formData.timeSpent}
                onChange={e => setFormData({...formData, timeSpent: parseInt(e.target.value) || 0})}
              />
            </div>
          </div>
          <div>
            <label className="block text-sm font-bold text-gray-700 dark:text-gray-300 mb-1">Description</label>
            <textarea 
              className="w-full p-3 rounded-lg border border-gray-200 dark:border-gray-600 bg-white dark:bg-gray-700/50 outline-none"
              rows={3}
              value={formData.description}
              onChange={e => setFormData({...formData, description: e.target.value})}
              placeholder="Add details..."
            />
          </div>
          <div>
            <label className="block text-sm font-bold text-gray-700 dark:text-gray-300 mb-1">Tags</label>
            <input 
              className="w-full p-3 rounded-lg border border-gray-200 dark:border-gray-600 bg-white dark:bg-gray-700/50 outline-none"
              placeholder="Design, Backend, Bug"
              value={formData.tags}
              onChange={e => setFormData({...formData, tags: e.target.value})}
            />
          </div>
          <div className="pt-4">
            <button type="submit" className="w-full bg-gradient-to-r from-indigo-500 to-purple-600 hover:from-indigo-600 hover:to-purple-700 text-white font-bold py-3 rounded-xl shadow-lg transform transition-all hover:scale-[1.02] active:scale-95">
              Save Ticket
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};

// 4. Notes & Slides Component
interface NotesViewProps {
  onCreateTask: (title: string, content: string) => void;
}

const NotesView: React.FC<NotesViewProps> = ({ onCreateTask }) => {
  const [notes, setNotes] = useState<Note[]>([]);
  const [activeNoteId, setActiveNoteId] = useState<string | null>(null);
  const [generatingSlides, setGeneratingSlides] = useState(false);

  useEffect(() => {
    const saved = localStorage.getItem(STORAGE_KEY_NOTES);
    if (saved) {
      const parsed = JSON.parse(saved);
      setNotes(parsed);
      if (parsed.length > 0 && !activeNoteId) setActiveNoteId(parsed[0].id);
    } else {
      // Default note
      const newNote: Note = {
        id: '1', title: 'Welcome Note', content: '# Welcome to TaskFlow Notes\nType here using **Markdown**.\n- List item 1\n- List item 2', isCanvasMode: false, lastModified: Date.now()
      };
      setNotes([newNote]);
      setActiveNoteId('1');
    }
  }, []);

  useEffect(() => {
    if (notes.length > 0) {
      localStorage.setItem(STORAGE_KEY_NOTES, JSON.stringify(notes));
    }
  }, [notes]);

  const activeNote = notes.find(n => n.id === activeNoteId);

  const createNote = () => {
    const newNote: Note = {
      id: crypto.randomUUID(),
      title: 'New Note',
      content: '',
      isCanvasMode: false,
      lastModified: Date.now()
    };
    setNotes([...notes, newNote]);
    setActiveNoteId(newNote.id);
  };

  const updateNote = (id: string, updates: Partial<Note>) => {
    setNotes(notes.map(n => n.id === id ? { ...n, ...updates, lastModified: Date.now() } : n));
  };

  const generateSlides = async () => {
    if (!activeNote || generatingSlides) return;
    setGeneratingSlides(true);
    const slides = await geminiService.generatePresentation(activeNote.content);
    updateNote(activeNote.id, { slides, isCanvasMode: true });
    setGeneratingSlides(false);
  };

  return (
    <div className="flex h-full bg-white/40 dark:bg-gray-900/40 backdrop-blur-sm rounded-2xl overflow-hidden shadow-inner border border-white/40 dark:border-gray-700">
      {/* Notes Sidebar */}
      <div className="w-64 border-r border-white/30 dark:border-gray-800 bg-white/60 dark:bg-gray-900/80 flex flex-col backdrop-blur-xl">
        <div className="p-4 border-b border-white/30 dark:border-gray-800 flex justify-between items-center">
           <h2 className="font-bold text-gray-700 dark:text-gray-200">My Notes</h2>
           <button onClick={createNote} className="p-1 hover:bg-white/50 dark:hover:bg-gray-800 rounded transition-colors"><Plus className="w-5 h-5" /></button>
        </div>
        <div className="flex-1 overflow-y-auto">
          {notes.map(note => (
            <button
              key={note.id}
              onClick={() => setActiveNoteId(note.id)}
              className={`w-full text-left p-3 border-b border-transparent hover:bg-white/50 dark:hover:bg-gray-800 transition-all ${activeNoteId === note.id ? 'bg-indigo-50/80 dark:bg-gray-800 border-l-4 border-indigo-500 shadow-sm' : ''}`}
            >
              <div className="font-medium truncate">{note.title}</div>
              <div className="text-xs text-gray-400 mt-1">{new Date(note.lastModified).toLocaleDateString()}</div>
            </button>
          ))}
        </div>
      </div>

      {/* Editor / Canvas */}
      <div className="flex-1 flex flex-col relative overflow-hidden bg-white/30 dark:bg-gray-900/50">
        {activeNote ? (
          <>
            <div className="h-16 border-b border-white/30 dark:border-gray-800 flex items-center justify-between px-6 bg-white/40 dark:bg-gray-900/60 backdrop-blur-md">
              <input 
                value={activeNote.title}
                onChange={(e) => updateNote(activeNote.id, { title: e.target.value })}
                className="bg-transparent font-bold text-2xl outline-none w-full text-gray-800 dark:text-gray-100"
              />
              <div className="flex items-center gap-2">
                 <button 
                  onClick={() => onCreateTask(activeNote.title, activeNote.content)}
                  className="flex items-center gap-2 px-3 py-1.5 bg-emerald-500 text-white rounded-lg text-sm font-bold hover:shadow-lg hover:scale-105 transition-all"
                  title="Add to Calendar / Board"
                 >
                   <CalendarPlus className="w-4 h-4" />
                   Add to Calendar
                 </button>
                 <button 
                  onClick={generateSlides}
                  className="flex items-center gap-2 px-3 py-1.5 bg-gradient-to-r from-purple-500 to-indigo-500 text-white rounded-lg text-sm font-bold hover:shadow-lg hover:scale-105 transition-all"
                 >
                   {generatingSlides ? <Sparkles className="w-4 h-4 animate-spin" /> : <Presentation className="w-4 h-4" />}
                   Magic Slide
                 </button>
                 <button 
                   onClick={() => updateNote(activeNote.id, { isCanvasMode: !activeNote.isCanvasMode })}
                   className={`p-2 rounded-lg transition-all ${activeNote.isCanvasMode ? 'bg-indigo-100 text-indigo-600 shadow-inner' : 'hover:bg-white/50 dark:hover:bg-gray-800'}`}
                 >
                   {activeNote.isCanvasMode ? <Grid className="w-5 h-5" /> : <FileText className="w-5 h-5" />}
                 </button>
              </div>
            </div>

            <div className="flex-1 overflow-y-auto p-8 relative">
              {activeNote.isCanvasMode && activeNote.slides ? (
                // --- SLIDE CANVAS MODE ---
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                  {activeNote.slides.map((slide) => (
                    <div key={slide.id} className="aspect-video bg-white dark:bg-gray-800 rounded-xl shadow-xl border border-gray-100 dark:border-gray-700 p-6 flex flex-col transition-all hover:scale-[1.03] cursor-move animate-fade-in hover:shadow-2xl">
                      <h3 className="text-xl font-bold mb-4 bg-clip-text text-transparent bg-gradient-to-r from-indigo-600 to-purple-600 border-b pb-2">{slide.title}</h3>
                      <ul className="list-disc list-inside space-y-2 text-sm text-gray-600 dark:text-gray-300 flex-1">
                        {slide.content.map((point, i) => (
                           <li key={i}>{point}</li>
                        ))}
                      </ul>
                      <div className="text-[10px] text-right text-gray-400 mt-2">Slide ID: {slide.id.slice(-4)}</div>
                    </div>
                  ))}
                </div>
              ) : (
                // --- LINEAR MARKDOWN MODE ---
                <textarea 
                  className="w-full h-full bg-transparent resize-none outline-none font-mono text-base leading-relaxed text-gray-800 dark:text-gray-200 p-4"
                  value={activeNote.content}
                  onChange={(e) => updateNote(activeNote.id, { content: e.target.value })}
                  placeholder="Start typing your notes..."
                />
              )}
            </div>
          </>
        ) : (
          <div className="flex-1 flex items-center justify-center text-gray-400 font-medium">Select a note to begin</div>
        )}
      </div>
    </div>
  );
};

// 5. Versatile Gemini Sidebar
const GeminiSidebar: React.FC<{ tickets: Ticket[]; isOpen: boolean; onClose: () => void }> = ({ tickets, isOpen, onClose }) => {
  const [messages, setMessages] = useState<ChatMessage[]>([
    { id: '0', role: 'model', text: 'Hey there! I am your AI assistant. I am ready to help you quickly!', timestamp: Date.now() }
  ]);
  const [input, setInput] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [mode, setMode] = useState<ChatMode>('blitz'); // Default to Blitz (Fast)
  const [aspectRatio, setAspectRatio] = useState<AspectRatio>('1:1');
  const [needsApiKey, setNeedsApiKey] = useState(false);
  const messagesEndRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages]);

  const handleSend = async () => {
    if (!input.trim() || isLoading) return;
    
    // Check API Key for Artist Mode
    const aistudio = (window as any).aistudio as AIStudioClient | undefined;
    if (mode === 'artist' && aistudio?.hasSelectedApiKey) {
       const hasKey = await aistudio.hasSelectedApiKey();
       if (!hasKey) {
         setNeedsApiKey(true);
         return;
       }
    }

    const userMsg: ChatMessage = { id: Date.now().toString(), role: 'user', text: input, timestamp: Date.now(), mode };
    setMessages(prev => [...prev, userMsg]);
    setInput('');
    setIsLoading(true);
    setNeedsApiKey(false);

    try {
      // Get location for Explorer Mode
      let location = undefined;
      if (mode === 'explorer') {
        try {
          const pos: GeolocationPosition = await new Promise((resolve, reject) => {
            navigator.geolocation.getCurrentPosition(resolve, reject);
          });
          location = { lat: pos.coords.latitude, lng: pos.coords.longitude };
        } catch (e) {
          console.warn("Could not get location", e);
        }
      }

      // STREAMING RESPONSE HANDLING
      const stream = geminiService.streamMessage(userMsg.text, mode, tickets, { aspectRatio, location });
      
      const responseId = (Date.now() + 1).toString();
      let isFirstChunk = true;

      for await (const chunk of stream) {
        setMessages(prev => {
          const newHistory = [...prev];
          if (isFirstChunk) {
             newHistory.push({
               id: responseId,
               role: 'model',
               text: chunk.text,
               image: chunk.image,
               grounding: chunk.grounding,
               timestamp: Date.now(),
               mode
             });
             isFirstChunk = false;
          } else {
             // Update last message
             const lastMsg = newHistory[newHistory.length - 1];
             if (lastMsg.id === responseId) {
               lastMsg.text = chunk.text;
               if (chunk.grounding) lastMsg.grounding = chunk.grounding;
             }
          }
          return newHistory;
        });
      }

    } catch (err: any) {
      if (err.message === "API_KEY_REQUIRED") {
        setNeedsApiKey(true);
      }
      setMessages(prev => [...prev, {
        id: (Date.now() + 1).toString(),
        role: 'model',
        text: err.message === "API_KEY_REQUIRED" ? "Please connect your billing account to generate high-quality images." : "Sorry, I encountered an error.",
        timestamp: Date.now(),
        isError: true,
        mode
      }]);
    } finally {
      setIsLoading(false);
    }
  };

  const handleConnectBilling = async () => {
    const aistudio = (window as any).aistudio as AIStudioClient | undefined;
    if (aistudio?.openSelectKey) {
      await aistudio.openSelectKey();
      setNeedsApiKey(false);
    }
  };

  // Render different message content
  const renderMessageContent = (msg: ChatMessage) => {
    return (
      <div className="flex flex-col gap-2">
        {msg.text && <MarkdownRenderer content={msg.text} />}
        {msg.image && (
          <div className="mt-2 rounded-lg overflow-hidden border dark:border-gray-600 shadow-md transition-transform hover:scale-105">
             <img src={`data:image/png;base64,${msg.image}`} alt="Generated by AI" className="w-full h-auto" />
          </div>
        )}
        {msg.grounding && (
           <div className="mt-2 text-xs flex flex-col gap-1">
             <span className="font-semibold opacity-70">Sources found:</span>
             {msg.grounding.map((chunk, i) => {
                if (chunk.maps) {
                  return (
                    <a key={i} href={chunk.maps.uri} target="_blank" rel="noreferrer" className="flex items-center gap-1 text-blue-500 hover:underline bg-blue-50 dark:bg-blue-900/20 p-1.5 rounded">
                      <MapPin className="w-3 h-3" />
                      {chunk.maps.title}
                    </a>
                  )
                }
                return null;
             })}
           </div>
        )}
      </div>
    );
  };

  return (
    <div className={`fixed inset-y-0 right-0 w-80 md:w-96 bg-white/90 dark:bg-gray-800/95 backdrop-blur-xl shadow-2xl transform transition-transform duration-500 z-40 border-l border-white/20 dark:border-gray-700 flex flex-col ${isOpen ? 'translate-x-0' : 'translate-x-full'}`}>
      
      {/* Header with Mode Switcher */}
      <div className="p-4 bg-gradient-to-r from-indigo-500 to-purple-600 text-white shadow-lg">
        <div className="flex justify-between items-center mb-4">
          <div className="flex items-center gap-2 font-bold text-lg animate-pulse-slow">
            <Sparkles className="w-5 h-5" />
            <span>AI Command Center</span>
          </div>
          <button onClick={onClose} className="hover:bg-white/20 p-1 rounded-full transition-colors"><X className="w-5 h-5" /></button>
        </div>
        
        {/* Mode Selector - Cleaned up to only show Fast (Blitz) */}
        <div className="flex gap-1 bg-black/20 p-1 rounded-lg">
           {[
             { id: 'blitz', icon: Zap, label: 'Fast Mode' }
           ].map((m) => (
             <button
               key={m.id}
               onClick={() => setMode(m.id as ChatMode)}
               className={`flex-1 flex flex-col items-center py-2 rounded-md text-[10px] uppercase tracking-wider font-semibold transition-all duration-300 ${mode === m.id ? 'bg-white text-indigo-600 shadow-md scale-105' : 'text-indigo-100 hover:bg-white/10'}`}
             >
               <m.icon className="w-4 h-4 mb-1" />
               {m.label}
             </button>
           ))}
        </div>
      </div>
      
      {/* Messages */}
      <div className="flex-1 overflow-y-auto p-4 space-y-4 bg-gray-50/50 dark:bg-gray-900/50">
        {messages.map(msg => (
          <div key={msg.id} className={`flex ${msg.role === 'user' ? 'justify-end' : 'justify-start'} animate-fade-in`}>
            <div className={`max-w-[85%] p-3 rounded-2xl shadow-sm text-sm ${
              msg.role === 'user' 
                ? 'bg-gradient-to-br from-indigo-500 to-purple-600 text-white rounded-tr-none shadow-md' 
                : 'bg-white dark:bg-gray-800 text-gray-800 dark:text-gray-100 rounded-tl-none border border-gray-100 dark:border-gray-700 shadow-sm'
            }`}>
              {renderMessageContent(msg)}
            </div>
          </div>
        ))}
        
        {/* API Key Warning */}
        {needsApiKey && (
           <div className="mx-4 p-3 bg-yellow-50 dark:bg-yellow-900/20 border border-yellow-200 dark:border-yellow-700 rounded-lg text-xs text-yellow-800 dark:text-yellow-200 animate-slide-up">
             <p className="mb-2">Generating high-quality images requires a billing account.</p>
             <button onClick={handleConnectBilling} className="w-full bg-yellow-600 text-white py-1.5 rounded hover:bg-yellow-700 transition">
               Connect Billing Account
             </button>
             <a href="https://ai.google.dev/gemini-api/docs/billing" target="_blank" rel="noreferrer" className="block text-center mt-2 underline opacity-70">
               Learn more about billing
             </a>
           </div>
        )}

        {isLoading && (
          <div className="flex justify-start">
            <div className="bg-white dark:bg-gray-800 p-3 rounded-2xl rounded-tl-none border dark:border-gray-700 flex gap-1 items-center shadow-sm">
              <span className="w-2 h-2 bg-indigo-400 rounded-full animate-bounce"></span>
              <span className="w-2 h-2 bg-indigo-400 rounded-full animate-bounce delay-100"></span>
              <span className="w-2 h-2 bg-indigo-400 rounded-full animate-bounce delay-200"></span>
            </div>
          </div>
        )}
        <div ref={messagesEndRef} />
      </div>

      {/* Input */}
      <div className="p-4 border-t border-gray-100 dark:border-gray-700 bg-white dark:bg-gray-800">
        <div className="flex gap-2 relative">
          <input 
            type="text" 
            className="flex-1 pl-4 pr-12 py-3 rounded-full border border-gray-200 dark:bg-gray-900 dark:border-gray-600 focus:outline-none focus:ring-2 focus:ring-indigo-500 shadow-inner transition-all"
            placeholder={mode === 'artist' ? "Describe an image..." : mode === 'explorer' ? "Find places nearby..." : "Type a message..."}
            value={input}
            onChange={(e) => setInput(e.target.value)}
            onKeyDown={(e) => e.key === 'Enter' && handleSend()}
          />
          <button 
            onClick={handleSend} 
            disabled={isLoading}
            className="absolute right-1.5 top-1.5 p-1.5 bg-indigo-600 text-white rounded-full hover:bg-indigo-700 disabled:opacity-50 transition-all hover:scale-110 active:scale-95 shadow-md"
          >
            <Send className="w-5 h-5" />
          </button>
        </div>
        <div className="text-[10px] text-center mt-2 text-gray-400">
          Powered by Gemini 3 Pro & 2.5 Flash
        </div>
      </div>
    </div>
  );
};

// --- Main App Component ---

const App: React.FC = () => {
  const [tickets, setTickets] = useState<Ticket[]>([]);
  const [darkMode, setDarkMode] = useState(false);
  const [view, setView] = useState<'board' | 'calendar' | 'notes' | 'analytics'>('board');
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [isChatOpen, setIsChatOpen] = useState(false);
  const [editingTicket, setEditingTicket] = useState<Ticket | null>(null);
  
  // NEW: Prefill Data for creating tickets from Notes
  const [prefillTicketData, setPrefillTicketData] = useState<Partial<Ticket> | undefined>(undefined);

  // NEW: Search State
  const [searchQuery, setSearchQuery] = useState('');
  
  // NEW: Font State - Default to 'font-animated' (Fredoka)
  const [currentFont, setCurrentFont] = useState('font-animated');

  // NEW: Bulk Selection State
  const [selectedTicketIds, setSelectedTicketIds] = useState<Set<string>>(new Set());

  // Load Initial State
  useEffect(() => {
    const savedTickets = localStorage.getItem(STORAGE_KEY_TICKETS);
    if (savedTickets) {
      setTickets(JSON.parse(savedTickets));
    }
    
    const savedTheme = localStorage.getItem(STORAGE_KEY_THEME);
    if (savedTheme === 'dark' || (!savedTheme && window.matchMedia('(prefers-color-scheme: dark)').matches)) {
      setDarkMode(true);
      document.documentElement.classList.add('dark');
    }
    
    const savedFont = localStorage.getItem(STORAGE_KEY_FONT);
    if (savedFont) {
        setCurrentFont(savedFont);
    }
  }, []);

  // Persistence
  useEffect(() => {
    localStorage.setItem(STORAGE_KEY_TICKETS, JSON.stringify(tickets));
  }, [tickets]);

  // Sync across tabs
  useEffect(() => {
    const handleStorageChange = (e: StorageEvent) => {
      if (e.key === STORAGE_KEY_TICKETS && e.newValue) {
        setTickets(JSON.parse(e.newValue));
      }
    };
    window.addEventListener('storage', handleStorageChange);
    return () => window.removeEventListener('storage', handleStorageChange);
  }, []);

  // TIMER LOGIC: Update active timers every minute
  useEffect(() => {
    const interval = setInterval(() => {
      setTickets(prev => prev.map(t => {
        if (t.isTiming && t.lastStartedAt) {
           const now = Date.now();
           const elapsedMinutes = (now - t.lastStartedAt) / 60000;
           // If a minute has passed, update timeSpent and reset lastStartedAt to avoid huge jumps if slept
           if (elapsedMinutes >= 1) {
             return {
               ...t,
               timeSpent: t.timeSpent + Math.floor(elapsedMinutes),
               lastStartedAt: now // Reset cursor
             };
           }
        }
        return t;
      }));
    }, 60000); // Check every minute
    return () => clearInterval(interval);
  }, []);

  const toggleTheme = () => {
    const newMode = !darkMode;
    setDarkMode(newMode);
    localStorage.setItem(STORAGE_KEY_THEME, newMode ? 'dark' : 'light');
    document.documentElement.classList.toggle('dark', newMode);
  };
  
  const cycleFont = () => {
      const fonts = ['font-animated', 'font-sans', 'font-hand', 'font-serif'];
      const currentIndex = fonts.indexOf(currentFont);
      const nextFont = fonts[(currentIndex + 1) % fonts.length];
      setCurrentFont(nextFont);
      localStorage.setItem(STORAGE_KEY_FONT, nextFont);
  }

  const handleCreateOrUpdate = (ticketData: Omit<Ticket, 'id' | 'createdAt'>) => {
    if (editingTicket) {
      setTickets(prev => prev.map(t => t.id === editingTicket.id ? { ...t, ...ticketData } : t));
      setEditingTicket(null);
    } else {
      const newTicket: Ticket = {
        ...ticketData,
        id: crypto.randomUUID(),
        createdAt: Date.now(),
        timeSpent: 0,
        isTiming: ticketData.status === Status.InProgress, // Auto-start timing if created as In Progress
        lastStartedAt: ticketData.status === Status.InProgress ? Date.now() : undefined
      };
      setTickets(prev => [...prev, newTicket]);
    }
    // Clear prefill data if used
    setPrefillTicketData(undefined);
  };

  const handleDelete = (id: string) => {
    if (confirm('Delete this ticket?')) {
      setTickets(prev => prev.filter(t => t.id !== id));
      setSelectedTicketIds(prev => {
        const next = new Set(prev);
        next.delete(id);
        return next;
      });
    }
  };

  // --- UPDATED HANDLE DROP: Auto Timer Logic ---
  const handleDrop = (ticketId: string, newStatus: Status) => {
    const isCompleting = newStatus === Status.Completed;
    const isInProgress = newStatus === Status.InProgress;
    
    if (isCompleting) triggerConfetti();

    setTickets(prev => prev.map(t => {
      if (t.id === ticketId) {
        const now = Date.now();
        let updates: Partial<Ticket> = { status: newStatus };
        
        // 1. Capture pending time if currently timing
        if (t.isTiming && t.lastStartedAt) {
           const elapsed = (now - t.lastStartedAt) / 60000;
           updates.timeSpent = (t.timeSpent || 0) + Math.floor(elapsed);
           updates.lastStartedAt = undefined;
           updates.isTiming = false;
        }

        // 2. Apply new state logic
        if (isCompleting) {
           updates.completedAt = now;
           updates.isTiming = false;
        } else if (isInProgress) {
           updates.isTiming = true;
           updates.lastStartedAt = now;
        } else {
           // Moving to Backlog or Review -> Pause
           updates.isTiming = false;
        }

        return { ...t, ...updates };
      }
      return t;
    }));
  };

  const toggleTimer = (id: string) => {
    setTickets(prev => prev.map(t => {
      if (t.id === id) {
        if (t.isTiming) {
           // Stopping: Calculate final chunk
           const now = Date.now();
           const elapsed = t.lastStartedAt ? (now - t.lastStartedAt) / 60000 : 0;
           return { ...t, isTiming: false, timeSpent: t.timeSpent + Math.floor(elapsed), lastStartedAt: undefined };
        } else {
           // Starting
           return { ...t, isTiming: true, lastStartedAt: Date.now() };
        }
      }
      return t;
    }));
  }

  const openEdit = (ticket: Ticket) => {
    setEditingTicket(ticket);
    setPrefillTicketData(undefined);
    setIsModalOpen(true);
  };

  const handleCreateFromNote = (title: string, content: string) => {
    setEditingTicket(null); // Ensure we are not editing
    setPrefillTicketData({ title, description: content });
    setIsModalOpen(true);
  }

  // --- Bulk Selection Logic ---
  const toggleSelection = (id: string) => {
    setSelectedTicketIds(prev => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  };

  const clearSelection = () => {
    setSelectedTicketIds(new Set());
  };

  const handleBulkStatusChange = (status: Status) => {
    if (!status) return;
    setTickets(prev => prev.map(t => {
      if (selectedTicketIds.has(t.id)) {
        // Re-use logic for timer updates
        const isCompleting = status === Status.Completed;
        const isInProgress = status === Status.InProgress;
        const now = Date.now();
        let updates: Partial<Ticket> = { status };

        if (t.isTiming && t.lastStartedAt) {
           const elapsed = (now - t.lastStartedAt) / 60000;
           updates.timeSpent = (t.timeSpent || 0) + Math.floor(elapsed);
           updates.lastStartedAt = undefined;
           updates.isTiming = false;
        }

        if (isCompleting) {
           updates.completedAt = now;
           updates.isTiming = false;
        } else if (isInProgress) {
           updates.isTiming = true;
           updates.lastStartedAt = now;
        } else {
           updates.isTiming = false;
        }
        return { ...t, ...updates };
      }
      return t;
    }));
    clearSelection();
    if (status === Status.Completed) triggerConfetti();
  };

  const handleBulkPriorityChange = (priority: Priority) => {
    if (!priority) return;
    setTickets(prev => prev.map(t => selectedTicketIds.has(t.id) ? { ...t, priority } : t));
    clearSelection();
  };

  const handleBulkDelete = () => {
    if (confirm(`Are you sure you want to delete ${selectedTicketIds.size} tickets?`)) {
      setTickets(prev => prev.filter(t => !selectedTicketIds.has(t.id)));
      clearSelection();
    }
  };

  const handleBulkDateChange = (date: string) => {
    if (!date) return;
    setTickets(prev => prev.map(t => selectedTicketIds.has(t.id) ? { ...t, dueDate: new Date(date).toISOString() } : t));
    clearSelection();
  }


  // Filter Logic
  const filteredTickets = tickets.filter(t => 
    t.title.toLowerCase().includes(searchQuery.toLowerCase()) || 
    t.description.toLowerCase().includes(searchQuery.toLowerCase()) ||
    t.tags.some(tag => tag.toLowerCase().includes(searchQuery.toLowerCase()))
  );

  return (
    <div className={`flex h-screen overflow-hidden text-gray-900 dark:text-gray-100 font-sans transition-colors duration-700 ${currentFont} ${darkMode ? 'bg-gray-900' : 'bg-gradient-to-br from-blue-100 via-purple-200 to-pink-100'}`}>
      
      {/* Sidebar Navigation */}
      <aside className="w-20 lg:w-64 flex flex-col border-r border-white/20 dark:border-gray-800 bg-white/60 dark:bg-gray-900/80 backdrop-blur-2xl z-10 transition-all duration-300">
        <div className="h-24 flex items-center justify-center lg:justify-start lg:px-6 border-b border-white/20 dark:border-gray-800">
          <div className="w-12 h-12 rounded-xl overflow-hidden shadow-lg transform transition-transform hover:rotate-12 hover:scale-105">
            <img src="https://i.im.ge/2026/02/06/e0S4ET.Screenshot-from-2026-02-06-12-40-27.png" alt="TaskFlow Logo" className="w-full h-full object-cover" />
          </div>
          <span className="ml-3 font-bold text-2xl hidden lg:block tracking-tight bg-clip-text text-transparent bg-gradient-to-r from-indigo-600 to-pink-500 dark:from-indigo-400 dark:to-pink-400">TaskFlow</span>
        </div>
        
        <nav className="flex-1 p-4 space-y-3 mt-4">
          <button 
            onClick={() => setView('board')}
            className={`w-full flex items-center gap-4 px-4 py-3 rounded-2xl transition-all duration-300 group ${view === 'board' ? 'bg-white/80 dark:bg-gray-800 text-indigo-600 dark:text-indigo-400 font-bold shadow-md translate-x-1' : 'hover:bg-white/40 dark:hover:bg-gray-800/50 text-gray-500 dark:text-gray-400 hover:translate-x-1'}`}
          >
            <LayoutDashboard className={`w-5 h-5 transition-transform ${view === 'board' ? 'scale-110' : 'group-hover:scale-110'}`} />
            <span className="hidden lg:block">Dashboard</span>
          </button>
          <button 
             onClick={() => setView('calendar')}
             className={`w-full flex items-center gap-4 px-4 py-3 rounded-2xl transition-all duration-300 group ${view === 'calendar' ? 'bg-white/80 dark:bg-gray-800 text-indigo-600 dark:text-indigo-400 font-bold shadow-md translate-x-1' : 'hover:bg-white/40 dark:hover:bg-gray-800/50 text-gray-500 dark:text-gray-400 hover:translate-x-1'}`}
          >
            <CalendarIcon className={`w-5 h-5 transition-transform ${view === 'calendar' ? 'scale-110' : 'group-hover:scale-110'}`} />
            <span className="hidden lg:block">Calendar</span>
          </button>
          <button 
             onClick={() => setView('notes')}
             className={`w-full flex items-center gap-4 px-4 py-3 rounded-2xl transition-all duration-300 group ${view === 'notes' ? 'bg-white/80 dark:bg-gray-800 text-indigo-600 dark:text-indigo-400 font-bold shadow-md translate-x-1' : 'hover:bg-white/40 dark:hover:bg-gray-800/50 text-gray-500 dark:text-gray-400 hover:translate-x-1'}`}
          >
            <FileText className={`w-5 h-5 transition-transform ${view === 'notes' ? 'scale-110' : 'group-hover:scale-110'}`} />
            <span className="hidden lg:block">Notes</span>
          </button>
           <button 
             onClick={() => setView('analytics')}
             className={`w-full flex items-center gap-4 px-4 py-3 rounded-2xl transition-all duration-300 group ${view === 'analytics' ? 'bg-white/80 dark:bg-gray-800 text-indigo-600 dark:text-indigo-400 font-bold shadow-md translate-x-1' : 'hover:bg-white/40 dark:hover:bg-gray-800/50 text-gray-500 dark:text-gray-400 hover:translate-x-1'}`}
          >
            <ChartLine className={`w-5 h-5 transition-transform ${view === 'analytics' ? 'scale-110' : 'group-hover:scale-110'}`} />
            <span className="hidden lg:block">Analytics</span>
          </button>
        </nav>

        <div className="p-4 border-t border-white/20 dark:border-gray-800">
          <button 
            onClick={() => setIsChatOpen(!isChatOpen)}
            className="w-full group flex items-center justify-center lg:justify-start gap-3 px-4 py-4 rounded-2xl text-white bg-gradient-to-r from-emerald-400 to-teal-500 shadow-xl shadow-emerald-500/20 hover:shadow-emerald-500/40 transition-all duration-300 transform hover:-translate-y-1 hover:scale-[1.02]"
          >
            <Sparkles className="w-5 h-5 animate-pulse" />
            <span className="hidden lg:block font-bold">Ask AI</span>
          </button>
        </div>
      </aside>

      {/* Main Content */}
      <main className="flex-1 flex flex-col h-full relative overflow-hidden">
        
        {/* Only show Header in Board/Calendar/Analytics Views */}
        {view !== 'notes' && (
          <header className="h-24 border-b border-white/20 dark:border-gray-800 bg-white/40 dark:bg-gray-900/60 backdrop-blur-md flex items-center justify-between px-8 transition-colors duration-300">
            <div className="flex items-center gap-4 flex-1">
              <h1 className="text-3xl font-bold bg-clip-text text-transparent bg-gradient-to-r from-gray-800 to-gray-600 dark:from-white dark:to-gray-300 capitalize tracking-tight">
                {view === 'board' ? 'Task Board' : view}
              </h1>
              <div className="hidden md:flex items-center bg-white/50 dark:bg-gray-800/50 rounded-full px-4 py-2 border border-white/30 dark:border-gray-700 focus-within:ring-2 focus-within:ring-indigo-400 transition-all w-full max-w-md ml-8 shadow-sm">
                <Search className="w-5 h-5 text-gray-400" />
                <input 
                  type="text" 
                  placeholder="Search tasks, tags..." 
                  className="bg-transparent border-none outline-none ml-2 text-sm w-full text-gray-700 dark:text-gray-200 placeholder-gray-400"
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                />
              </div>
            </div>

            <div className="flex items-center gap-4">
              <button 
                onClick={cycleFont} 
                className="p-2.5 bg-white/60 dark:bg-gray-800/60 rounded-xl hover:bg-white dark:hover:bg-gray-700 transition-all shadow-sm hover:shadow-md active:scale-95"
                title="Change Font"
              >
                <Type className="w-5 h-5 text-indigo-600 dark:text-indigo-400" />
              </button>

              <button 
                onClick={toggleTheme} 
                className="p-2.5 bg-white/60 dark:bg-gray-800/60 rounded-xl hover:bg-white dark:hover:bg-gray-700 transition-all shadow-sm hover:shadow-md active:scale-95 group"
              >
                {darkMode ? <Sun className="w-5 h-5 text-amber-400 group-hover:rotate-90 transition-transform" /> : <Moon className="w-5 h-5 text-indigo-600 group-hover:-rotate-12 transition-transform" />}
              </button>
              
              <button 
                onClick={() => { setEditingTicket(null); setPrefillTicketData(undefined); setIsModalOpen(true); }}
                className="hidden md:flex items-center gap-2 bg-gradient-to-r from-indigo-600 to-purple-600 hover:from-indigo-700 hover:to-purple-700 text-white px-5 py-2.5 rounded-xl font-bold shadow-lg hover:shadow-indigo-500/30 transition-all transform hover:scale-105 active:scale-95"
              >
                <Plus className="w-5 h-5" />
                <span>New Ticket</span>
              </button>
            </div>
          </header>
        )}

        <div className="flex-1 overflow-x-auto overflow-y-hidden p-6 relative">
            {view === 'board' && (
              <>
                {/* Bulk Actions Bar */}
                {selectedTicketIds.size > 0 && (
                  <div className="absolute bottom-6 left-1/2 -translate-x-1/2 z-30 bg-gray-900 text-white px-6 py-3 rounded-full shadow-2xl flex items-center gap-6 animate-slide-up">
                    <span className="font-bold text-sm">{selectedTicketIds.size} selected</span>
                    <div className="h-4 w-px bg-gray-700"></div>
                    <div className="flex gap-2">
                      <button onClick={() => handleBulkStatusChange(Status.Completed)} className="hover:text-emerald-400 transition-colors text-xs font-bold uppercase">Mark Done</button>
                      <button onClick={() => handleBulkStatusChange(Status.InProgress)} className="hover:text-amber-400 transition-colors text-xs font-bold uppercase">Start</button>
                    </div>
                     <div className="h-4 w-px bg-gray-700"></div>
                    <button onClick={handleBulkDelete} className="text-red-400 hover:text-red-300 transition-colors"><Trash2 className="w-4 h-4" /></button>
                    <button onClick={clearSelection} className="ml-2 hover:bg-gray-800 rounded-full p-1"><X className="w-4 h-4" /></button>
                  </div>
                )}

                <div className="flex h-full gap-6 pb-4">
                  {Object.values(Status).map(status => (
                    <KanbanColumn 
                      key={status} 
                      status={status} 
                      tickets={filteredTickets.filter(t => t.status === status)}
                      onDrop={handleDrop}
                      onEdit={openEdit}
                      onDelete={handleDelete}
                      onToggleTimer={toggleTimer}
                      selectedIds={selectedTicketIds}
                      onToggleSelection={toggleSelection}
                    />
                  ))}
                </div>
              </>
            )}

            {view === 'calendar' && <CalendarView tickets={tickets} />}
            
            {view === 'analytics' && <AnalyticsView tickets={tickets} />}
            
            {view === 'notes' && <NotesView onCreateTask={handleCreateFromNote} />}
        </div>

        {/* Floating Action Button for Mobile */}
        {view === 'board' && (
            <button 
              onClick={() => { setEditingTicket(null); setPrefillTicketData(undefined); setIsModalOpen(true); }}
              className="md:hidden absolute bottom-6 right-6 w-14 h-14 bg-gradient-to-r from-indigo-600 to-purple-600 text-white rounded-full shadow-xl flex items-center justify-center z-30 hover:scale-110 active:scale-95 transition-all"
            >
              <Plus className="w-8 h-8" />
            </button>
        )}

      </main>

      {/* Overlays */}
      <TicketModal 
          isOpen={isModalOpen} 
          onClose={() => setIsModalOpen(false)} 
          onSave={handleCreateOrUpdate}
          initialData={editingTicket}
          prefillData={prefillTicketData}
      />

      <GeminiSidebar 
          tickets={tickets} 
          isOpen={isChatOpen} 
          onClose={() => setIsChatOpen(false)} 
      />

    </div>
  );
};

export default App;