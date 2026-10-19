import { useEffect, useMemo, useRef, useState } from "react";
import {
  Activity, BarChart3, Bell, CalendarDays, Check, CheckCheck, ChevronLeft, ChevronRight,
  Download, Flame, Heart, LayoutDashboard, Plus, Smile, Target, Trash2, Upload,
  X, Sparkles
} from "lucide-react";
import {
  Area, AreaChart, CartesianGrid, ResponsiveContainer, Tooltip, XAxis, YAxis
} from "recharts";

import "./reminder-styles.css";
import { MOODS } from "./types.js";
import { exportData, importData, loadData, saveData } from "./storage.js";

const pad = (n) => String(n).padStart(2, "0");
const toKey = (date) => `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}`;
const todayKey = () => toKey(new Date());
const monthKey = (date) => `${date.getFullYear()}-${pad(date.getMonth() + 1)}`;
const formatMonth = (date) => date.toLocaleDateString(undefined, { month: "long", year: "numeric" });
const formatShort = (key) => new Date(`${key}T12:00:00`).toLocaleDateString(undefined, { month: "short", day: "numeric" });
const daysInMonth = (date) => new Date(date.getFullYear(), date.getMonth() + 1, 0).getDate();
const makeId = () => `${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;

function completionForDate(habits, date) {
  const eligible = habits.filter(h => h.createdAt <= date);
  if (!eligible.length) return 0;
  return Math.round(eligible.filter(h => h.completions.includes(date)).length / eligible.length * 100);
}

function habitStreak(habit, today) {
  const cursor = new Date(`${today}T12:00:00`);
  if (!habit.completions.includes(today)) cursor.setDate(cursor.getDate() - 1);
  let streak = 0;
  while (habit.completions.includes(toKey(cursor))) {
    streak++;
    cursor.setDate(cursor.getDate() - 1);
  }
  return streak;
}

function App() {
  const [data, setData] = useState(() => loadData());
  const [selectedDate, setSelectedDate] = useState(todayKey());
  const [visibleMonth, setVisibleMonth] = useState(() => {
    const now = new Date();
    return new Date(now.getFullYear(), now.getMonth(), 1);
  });
  const [page, setPage] = useState("overview");
  const [showAdd, setShowAdd] = useState(false);
  const [habitName, setHabitName] = useState("");
  const [habitEmoji, setHabitEmoji] = useState("✨");
  const [habitColor, setHabitColor] = useState("#7c83fd");
  const [moodNote, setMoodNote] = useState("");
  const [dailyReminderTime, setDailyReminderTime] = useState(() => localStorage.getItem("habitly-daily-reminder-time") || "");
  const [notificationPermission, setNotificationPermission] = useState(() =>
    typeof window !== "undefined" && "Notification" in window ? Notification.permission : "unsupported"
  );
  const importRef = useRef(null);

  useEffect(() => saveData(data), [data]);

  // Browser notifications are checked while Habitly is open. A sent-key prevents
  // the same reminder from firing repeatedly during the same minute/day.
  useEffect(() => {
    if (!("Notification" in window) || notificationPermission !== "granted") return undefined;

    const checkReminders = () => {
      const now = new Date();
      const today = todayKey();
      const currentTime = `${pad(now.getHours())}:${pad(now.getMinutes())}`;
      const sentKey = "habitly-reminders-sent";
      let sent = {};
      try { sent = JSON.parse(localStorage.getItem(sentKey) || "{}"); } catch { sent = {}; }

      const sendOnce = (key, title, body) => {
        if (sent[key]) return;
        try {
          const notification = new Notification(title, { body, icon: "/favicon.ico", tag: key });
          notification.onclick = () => { window.focus(); notification.close(); };
          sent[key] = true;
          localStorage.setItem(sentKey, JSON.stringify(sent));
        } catch (error) {
          console.error("Could not show Habitly notification:", error);
        }
      };

      data.habits.forEach(habit => {
        if (habit.reminderTime === currentTime && !habit.completions.includes(today)) {
          sendOnce(`habit:${habit.id}:${today}:${currentTime}`, `Time for ${habit.name}`, `A little progress goes a long way. Tap Habitly to check it off.`);
        }
      });

      if (dailyReminderTime && dailyReminderTime === currentTime) {
        const pending = data.habits.filter(habit => habit.createdAt <= today && !habit.completions.includes(today));
        if (pending.length) {
          const names = pending.slice(0, 3).map(habit => habit.name).join(", ");
          const more = pending.length > 3 ? ` and ${pending.length - 3} more` : "";
          sendOnce(`daily:${today}:${currentTime}`, "Your daily Habitly check-in", `Still to do: ${names}${more}. You’ve got this!`);
        } else {
          sendOnce(`daily:${today}:${currentTime}`, "Daily check-in", "All your habits are complete for today. Great work!");
        }
      }

      // Keep the send log small by dropping entries from earlier dates.
      const fresh = Object.fromEntries(Object.entries(sent).filter(([key]) => key.includes(today)));
      if (Object.keys(fresh).length !== Object.keys(sent).length) {
        localStorage.setItem(sentKey, JSON.stringify(fresh));
      }
    };

    checkReminders();
    const timer = window.setInterval(checkReminders, 15000);
    return () => window.clearInterval(timer);
  }, [data.habits, dailyReminderTime, notificationPermission]);

  const selectedDateObj = new Date(`${selectedDate}T12:00:00`);
  const today = todayKey();
  const monthDays = daysInMonth(visibleMonth);
  const firstWeekday = new Date(visibleMonth.getFullYear(), visibleMonth.getMonth(), 1).getDay();
  const selectedMood = data.moods.find(m => m.date === selectedDate);
  const activeHabits = data.habits.filter(h => h.createdAt <= selectedDate);
  const completedToday = activeHabits.filter(h => h.completions.includes(selectedDate)).length;
  const progress = activeHabits.length ? Math.round(completedToday / activeHabits.length * 100) : 0;

  const monthStats = useMemo(() => {
    const total = data.habits.reduce((sum, habit) => sum + habit.completions.filter(date => date.startsWith(monthKey(visibleMonth))).length, 0);
    const possible = data.habits.reduce((sum, habit) => {
      let count = 0;
      for (let day = 1; day <= monthDays; day++) {
        const date = toKey(new Date(visibleMonth.getFullYear(), visibleMonth.getMonth(), day));
        if (habit.createdAt <= date && date <= today) count++;
      }
      return sum + count;
    }, 0);
    return { total, rate: possible ? Math.round(total / possible * 100) : 0 };
  }, [data, visibleMonth, monthDays, today]);

  const chartData = useMemo(() => {
    const points = [];
    const now = new Date(`${selectedDate}T12:00:00`);
    for (let i = 13; i >= 0; i--) {
      const d = new Date(now);
      d.setDate(d.getDate() - i);
      const key = toKey(d);
      points.push({ day: d.toLocaleDateString(undefined, { weekday: "short" }), date: key, progress: completionForDate(data.habits, key), mood: data.moods.find(m => m.date === key)?.value ?? null });
    }
    return points;
  }, [data, selectedDate]);

  const bestHabit = useMemo(() => {
    if (!data.habits.length) return null;
    return [...data.habits].sort((a, b) => b.completions.filter(d => d <= today).length - a.completions.filter(d => d <= today).length)[0];
  }, [data.habits, today]);

  async function enableNotifications() {
    if (!("Notification" in window)) {
      window.alert("This browser does not support notifications. Try a recent version of Chrome, Edge, or Firefox.");
      setNotificationPermission("unsupported");
      return;
    }
    try {
      const permission = await Notification.requestPermission();
      setNotificationPermission(permission);
      if (permission === "granted") {
        new Notification("Habitly notifications enabled", { body: "Your habit reminders are ready." });
      }
    } catch {
      window.alert("Could not request notification permission in this browser.");
    }
  }

  function updateHabitReminder(habitId, reminderTime) {
    setData(current => ({
      ...current,
      habits: current.habits.map(habit =>
        habit.id === habitId
          ? { ...habit, reminderTime: reminderTime || "" }
          : habit
      )
    }));
  }

  function updateDailyReminder(time) {
    setDailyReminderTime(time);
    if (time) localStorage.setItem("habitly-daily-reminder-time", time);
    else localStorage.removeItem("habitly-daily-reminder-time");
  }

  function toggleHabit(habitId) {
    setData(current => ({
      ...current,
      habits: current.habits.map(h => h.id !== habitId ? h : {
        ...h,
        completions: h.completions.includes(selectedDate)
          ? h.completions.filter(d => d !== selectedDate)
          : [...h.completions, selectedDate].sort()
      })
    }));
  }

  function addHabit(e) {
    e.preventDefault();
    const name = habitName.trim();
    if (!name) return;
    const habit = { id: makeId(), name, emoji: habitEmoji, color: habitColor, createdAt: todayKey(), completions: [] };
    setData(current => ({ ...current, habits: [...current.habits, habit] }));
    setHabitName("");
    setHabitEmoji("✨");
    setShowAdd(false);
    setPage("habits");
  }

  function deleteHabit(id) {
    if (!window.confirm("Delete this habit and its completion history?")) return;
    setData(current => ({ ...current, habits: current.habits.filter(h => h.id !== id) }));
  }

  function setMood(value) {
    setData(current => {
      const previous = current.moods.find(m => m.date === selectedDate);
      const next = { date: selectedDate, value, note: previous?.note ?? moodNote };
      return { ...current, moods: [...current.moods.filter(m => m.date !== selectedDate), next].sort((a, b) => a.date.localeCompare(b.date)) };
    });
  }

  function updateMoodNote(note) {
    setMoodNote(note);
    setData(current => {
      const previous = current.moods.find(m => m.date === selectedDate);
      if (!previous) return current;
      return { ...current, moods: current.moods.map(m => m.date === selectedDate ? { ...m, note } : m) };
    });
  }

  function chooseDate(day) {
    const key = toKey(new Date(visibleMonth.getFullYear(), visibleMonth.getMonth(), day));
    setSelectedDate(key);
    setMoodNote(data.moods.find(m => m.date === key)?.note ?? "");
  }

  function shiftMonth(amount) {
    setVisibleMonth(current => new Date(current.getFullYear(), current.getMonth() + amount, 1));
  }

  const navItems = [
    { id: "overview", label: "Overview", icon: LayoutDashboard },
    { id: "habits", label: "My habits", icon: CheckCheck },
    { id: "insights", label: "Insights", icon: BarChart3 }
  ];

  return (
    <div className="app-shell">
      <aside className="sidebar">
        <div className="brand"><div className="brand-mark"><Sparkles size={21} /></div><span>habitly</span></div>
        <div className="workspace-label">WORKSPACE</div>
        <nav className="side-nav">
          {navItems.map(item => {
            const Icon = item.icon;
            return <button key={item.id} className={`nav-item ${page === item.id ? "active" : ""}`} onClick={() => setPage(item.id)}><Icon size={19} /><span>{item.label}</span></button>;
          })}
        </nav>
        <div className="sidebar-bottom">
          <div className="quote-card"><div className="quote-icon"><Heart size={17} /></div><p>Small steps every day lead to big changes.</p><span>KEEP GOING ✨</span></div>
          <button className="nav-item" onClick={() => exportData(data)}><Download size={18} /><span>Export backup</span></button>
          <button className="nav-item" onClick={() => importRef.current?.click()}><Upload size={18} /><span>Import backup</span></button>
          <input ref={importRef} type="file" accept="application/json,.json" hidden onChange={async e => {
            const file = e.target.files?.[0];
            if (!file) return;
            try { setData(await importData(file)); window.alert("Backup imported successfully."); }
            catch { window.alert("Could not import that file. Please select a valid Habitly JSON backup."); }
            e.target.value = "";
          }} />
          <div className="local-note"><span className="status-dot" /> Saved on this device</div>
        </div>
      </aside>

      <main className="main-content">
        <header className="topbar">
          <div className="mobile-brand"><div className="brand-mark"><Sparkles size={18} /></div><span>habitly</span></div>
          <div className="breadcrumb">Your space <span>/</span> <strong>{navItems.find(n => n.id === page)?.label}</strong></div>
          <div className="top-actions"><span className="today-label"><CalendarDays size={16} /> {new Date().toLocaleDateString(undefined, { weekday: "short", month: "short", day: "numeric" })}</span><div className="avatar">Y</div></div>
        </header>

        {page === "overview" && <>
          <section className="welcome-row">
            <div><div className="eyebrow"><span className="eyebrow-dot" /> YOUR PERSONAL GROWTH SPACE</div><h1>Make today <span>count.</span></h1><p className="subheading">A little progress each day adds up to remarkable results.</p></div>
            <button className="primary-button" onClick={() => setShowAdd(true)}><Plus size={18} /> New habit</button>
          </section>

          <section className="stats-grid">
            <StatCard icon={<Target size={19} />} label="Today's progress" value={`${progress}%`} detail={`${completedToday} of ${activeHabits.length} habits done`} color="purple" progress={progress} />
            <StatCard icon={<CheckCheck size={19} />} label="Completed today" value={`${completedToday}`} detail="Habits checked off" color="green" />
            <StatCard icon={<Flame size={19} />} label="Best streak" value={`${Math.max(0, ...data.habits.map(h => habitStreak(h, today)))} days`} detail="Keep the momentum" color="orange" />
            <StatCard icon={<Activity size={19} />} label="This month's rate" value={`${monthStats.rate}%`} detail={`${monthStats.total} total check-ins`} color="blue" />
          </section>

          <section className="content-grid">
            <div className="panel habits-panel">
              <div className="panel-heading"><div><h2>Daily habits</h2><p>{selectedDate === today ? "Your plan for today" : `Tracking ${formatShort(selectedDate)}`}</p></div><button className="text-button" onClick={() => setPage("habits")}>View all <ChevronRight size={16} /></button></div>
              <div className="date-strip"><button className="icon-button" aria-label="Previous day" onClick={() => { const d = new Date(`${selectedDate}T12:00:00`); d.setDate(d.getDate()-1); const k=toKey(d); setSelectedDate(k); setMoodNote(data.moods.find(m=>m.date===k)?.note ?? ""); setVisibleMonth(new Date(d.getFullYear(),d.getMonth(),1)); }}><ChevronLeft size={17}/></button><div><strong>{selectedDate === today ? "Today" : selectedDateObj.toLocaleDateString(undefined,{weekday:"long"})}</strong><span>{selectedDateObj.toLocaleDateString(undefined,{month:"long",day:"numeric"})}</span></div><button className="icon-button" aria-label="Next day" disabled={selectedDate >= today} onClick={() => { const d = new Date(`${selectedDate}T12:00:00`); d.setDate(d.getDate()+1); const k=toKey(d); setSelectedDate(k); setMoodNote(data.moods.find(m=>m.date===k)?.note ?? ""); setVisibleMonth(new Date(d.getFullYear(),d.getMonth(),1)); }}><ChevronRight size={17}/></button></div>
              <div className="habit-list">
                {activeHabits.length === 0 && <div className="empty-state"><span>🌱</span><strong>No habits yet</strong><p>Add your first habit to get started.</p></div>}
                {activeHabits.slice(0, 6).map(habit => {
                  const done = habit.completions.includes(selectedDate);
                  return <div className={`habit-row ${done ? "is-done" : ""}`} key={habit.id}>
                    <div className="habit-emoji" style={{ background: `${habit.color}20` }}>{habit.emoji}</div><div className="habit-info"><strong>{habit.name}</strong><span><Flame size={13} /> {habitStreak(habit, today)} day streak</span></div>
                    <button className={`check-button ${done ? "checked" : ""}`} onClick={() => toggleHabit(habit.id)} aria-label={`${done ? "Uncheck" : "Complete"} ${habit.name}`}>{done && <Check size={18} />}</button>
                  </div>;
                })}
              </div>
              {activeHabits.length > 6 && <button className="view-more" onClick={() => setPage("habits")}>View all {activeHabits.length} habits</button>}
              <div className="habit-footer"><div className="mini-progress"><div style={{ width: `${progress}%` }} /></div><span>{progress}% complete</span></div>
            </div>

            <div className="panel calendar-panel">
              <div className="panel-heading"><div><h2>Your calendar</h2><p>One day at a time</p></div><div className="calendar-arrows"><button className="icon-button" onClick={() => shiftMonth(-1)} aria-label="Previous month"><ChevronLeft size={16}/></button><button className="icon-button" onClick={() => shiftMonth(1)} aria-label="Next month" disabled={monthKey(visibleMonth) >= monthKey(new Date())}><ChevronRight size={16}/></button></div></div>
              <div className="calendar-month">{formatMonth(visibleMonth)}</div>
              <div className="calendar-grid weekdays">{["S","M","T","W","T","F","S"].map((d,i)=><span key={`${d}-${i}`}>{d}</span>)}</div>
              <div className="calendar-grid days">
                {Array.from({length:firstWeekday},(_,i)=><span key={`blank-${i}`} />)}
                {Array.from({length:monthDays},(_,i)=>{
                  const day=i+1; const key=toKey(new Date(visibleMonth.getFullYear(),visibleMonth.getMonth(),day));
                  const doneCount=data.habits.filter(h=>h.createdAt<=key&&h.completions.includes(key)).length;
                  const total=data.habits.filter(h=>h.createdAt<=key).length;
                  const isFuture=key>today;
                  return <button key={day} disabled={isFuture} onClick={()=>chooseDate(day)} className={`calendar-day ${key===selectedDate?"selected":""} ${key===today?"today":""} ${total>0&&doneCount===total&&key<=today?"all-done":""} ${doneCount>0&&doneCount<total?"some-done":""}`} title={`${key}: ${doneCount}/${total} habits`}><span>{day}</span>{key<=today&&total>0&&<i/>}</button>;
                })}
              </div>
              <div className="calendar-legend"><span><i className="legend-done"/> All done</span><span><i className="legend-some"/> In progress</span><span><i className="legend-none"/> No check-ins</span></div>
            </div>
          </section>

          <section className="content-grid lower-grid">
            <div className="panel chart-panel"><div className="panel-heading"><div><h2>Your consistency</h2><p>Daily completion over the last 14 days</p></div><span className="chart-pill"><Activity size={14}/> Activity</span></div><div className="chart-wrap"><ResponsiveContainer width="100%" height="100%"><AreaChart data={chartData} margin={{top:10,right:6,left:-22,bottom:0}}><defs><linearGradient id="progressFill" x1="0" y1="0" x2="0" y2="1"><stop offset="0%" stopColor="#7c83fd" stopOpacity={0.26}/><stop offset="100%" stopColor="#7c83fd" stopOpacity={0.02}/></linearGradient></defs><CartesianGrid strokeDasharray="3 5" vertical={false} stroke="#edf0f6"/><XAxis dataKey="day" axisLine={false} tickLine={false} tick={{fill:"#9ba3b5",fontSize:11}}/><YAxis domain={[0,100]} ticks={[0,25,50,75,100]} axisLine={false} tickLine={false} tick={{fill:"#9ba3b5",fontSize:11}} tickFormatter={v=>`${v}%`}/><Tooltip formatter={(v)=>[`${v}%`,"Completion"]} labelFormatter={(_,payload)=>payload?.[0]?.payload?.date ?? ""}/><Area type="monotone" dataKey="progress" stroke="#7c83fd" strokeWidth={2.5} fill="url(#progressFill)" activeDot={{r:5,strokeWidth:0}}/></AreaChart></ResponsiveContainer></div></div>
            <div className="panel mood-panel"><div className="panel-heading"><div><h2>Daily mood</h2><p>How are you feeling?</p></div><div className="mood-sparkle"><Smile size={19}/></div></div><div className="mood-options">{MOODS.map(m=><button key={m.value} title={m.label} className={`mood-option ${selectedMood?.value===m.value?"chosen":""}`} onClick={()=>setMood(m.value)}><span>{m.emoji}</span><small>{m.label}</small></button>)}</div><label className="note-label" htmlFor="mood-note">A note to yourself <span>optional</span></label><textarea id="mood-note" rows={2} placeholder="What made today feel this way?" value={moodNote} onChange={e=>updateMoodNote(e.target.value)} disabled={!selectedMood} /><p className="mood-footnote">{selectedMood ? `Mood saved for ${formatShort(selectedDate)}.` : "Choose a mood to start your daily check-in."}</p></div>
          </section>
        </>}

        {page === "habits" && <section className="page-section"><div className="page-title-row"><div><div className="eyebrow"><span className="eyebrow-dot"/> BUILD YOUR ROUTINE</div><h1>My <span>habits.</span></h1><p className="subheading">Make room for the things that make you feel good.</p></div><button className="primary-button" onClick={()=>setShowAdd(true)}><Plus size={18}/> New habit</button></div><div className="panel reminder-settings">
          <div className="reminder-settings-copy">
            <div className="reminder-bell"><BellIcon /></div>
            <div><h2>Reminder settings</h2><p>Choose a daily check-in time and allow browser notifications.</p></div>
          </div>
          <div className="daily-reminder-controls">
            <label className="reminder-label" htmlFor="daily-reminder-time">Daily reminder</label>
            <input id="daily-reminder-time" className="reminder-time-input" type="time" value={dailyReminderTime} onChange={e=>updateDailyReminder(e.target.value)} />
            <button className="secondary-button notification-permission-button" onClick={enableNotifications} type="button">
              <BellIcon /> {notificationPermission === "granted" ? "Notifications enabled" : notificationPermission === "denied" ? "Notifications blocked" : notificationPermission === "unsupported" ? "Unsupported browser" : "Enable notifications"}
            </button>
          </div>
          <p className="reminder-help">{notificationPermission === "denied" ? "Notifications are blocked in browser settings. Allow them for this site, then reload Habitly." : notificationPermission === "granted" ? "Enabled. Keep Habitly open in a browser tab for reminders to be checked." : "Set a time, then enable notifications when your browser asks for permission."}</p>
        </div>
        <div className="habit-manager-grid">{data.habits.map(h=>{const done=h.completions.includes(today);return <div className="habit-manager-card" key={h.id}><div className="manager-top"><div className="habit-emoji large" style={{background:`${h.color}20`}}>{h.emoji}</div><button className="delete-button" onClick={()=>deleteHabit(h.id)} aria-label={`Delete ${h.name}`}><Trash2 size={17}/></button></div><h3>{h.name}</h3><div className="manager-meta"><span><Flame size={14}/> {habitStreak(h,today)} day streak</span><span>{h.completions.length} check-ins</span></div><div className="habit-reminder-control"><label htmlFor={`reminder-${h.id}`}><BellIcon size={14}/> Reminder time</label><input id={`reminder-${h.id}`} className="reminder-time-input" type="time" value={h.reminderTime || ""} onChange={e=>updateHabitReminder(h.id,e.target.value)} aria-label={`Reminder time for ${h.name}`} /></div><button className={`manager-check ${done?"checked":""}`} onClick={()=>{setSelectedDate(today);toggleHabit(h.id)}}>{done?<><Check size={16}/> Completed today</>:<><Plus size={16}/> Mark complete today</>}</button></div>})}<button className="add-habit-card" onClick={()=>setShowAdd(true)}><span><Plus size={24}/></span><strong>Add a new habit</strong><small>Start with one small step</small></button></div></section>}

        {page === "insights" && <section className="page-section"><div className="page-title-row"><div><div className="eyebrow"><span className="eyebrow-dot"/> REFLECT & GROW</div><h1>Your <span>insights.</span></h1><p className="subheading">Notice your patterns and celebrate the progress you make.</p></div><button className="secondary-button" onClick={()=>exportData(data)}><Download size={17}/> Export data</button></div><section className="stats-grid insight-stats"><StatCard icon={<Activity size={19}/>} label="Monthly completion" value={`${monthStats.rate}%`} detail={formatMonth(visibleMonth)} color="purple" progress={monthStats.rate}/><StatCard icon={<CheckCheck size={19}/>} label="Total check-ins" value={`${data.habits.reduce((s,h)=>s+h.completions.length,0)}`} detail="Across all habits" color="green"/><StatCard icon={<Heart size={19}/>} label="Mood check-ins" value={`${data.moods.length}`} detail="Days reflected on" color="orange"/><StatCard icon={<Target size={19}/>} label="Habits created" value={`${data.habits.length}`} detail="Your personal routine" color="blue"/></section><div className="panel insight-chart"><div className="panel-heading"><div><h2>Consistency over time</h2><p>Daily completion for the 14 days leading up to the selected date</p></div></div><div className="chart-wrap tall"><ResponsiveContainer width="100%" height="100%"><AreaChart data={chartData} margin={{top:10,right:10,left:-18,bottom:0}}><defs><linearGradient id="insightFill" x1="0" y1="0" x2="0" y2="1"><stop offset="0%" stopColor="#7c83fd" stopOpacity={0.25}/><stop offset="100%" stopColor="#7c83fd" stopOpacity={0.02}/></linearGradient></defs><CartesianGrid strokeDasharray="3 5" vertical={false} stroke="#edf0f6"/><XAxis dataKey="date" tickFormatter={v=>v.slice(5)} axisLine={false} tickLine={false} tick={{fill:"#9ba3b5",fontSize:11}}/><YAxis domain={[0,100]} ticks={[0,25,50,75,100]} tickFormatter={v=>`${v}%`} axisLine={false} tickLine={false} tick={{fill:"#9ba3b5",fontSize:11}}/><Tooltip formatter={(v)=>[`${v}%`,"Completion"]}/><Area type="monotone" dataKey="progress" stroke="#7c83fd" strokeWidth={2.5} fill="url(#insightFill)"/></AreaChart></ResponsiveContainer></div></div><div className="panel best-panel"><div className="best-icon">🏆</div><div><h3>Your consistency champion</h3><p>{bestHabit ? `${bestHabit.emoji} ${bestHabit.name} has ${bestHabit.completions.length} check-ins so far. Keep building on it!` : "Add your first habit to start discovering your patterns."}</p></div></div><div className="panel mood-history"><div className="panel-heading"><div><h2>Mood history</h2><p>Your recent daily check-ins</p></div></div>{data.moods.length===0?<div className="empty-state"><span>🌤️</span><strong>Your mood story starts here</strong><p>Choose a mood on the overview page to begin tracking.</p></div>:<div className="mood-history-list">{[...data.moods].sort((a,b)=>b.date.localeCompare(a.date)).slice(0,10).map(m=>{const mood=MOODS.find(x=>x.value===m.value);return <div className="mood-history-row" key={m.date}><span className="mood-history-emoji">{mood.emoji}</span><div className="mood-history-info"><strong>{mood.label}</strong><span>{m.note||"No note added"}</span></div><time>{formatShort(m.date)}</time></div>})}</div>}</div></section>}

        <footer className="footer"><span>Made for your growth, one day at a time <Heart size={13}/></span><span>Habitly · Your data stays on this device</span></footer>
      </main>

      {showAdd && <div className="modal-backdrop" onMouseDown={e=>{if(e.target===e.currentTarget)setShowAdd(false)}}><form className="modal" onSubmit={addHabit}><div className="modal-heading"><div><div className="eyebrow"><span className="eyebrow-dot"/> A SMALL STEP FORWARD</div><h2>Create a habit</h2><p>Choose something you want to make part of your day.</p></div><button type="button" className="icon-button" onClick={()=>setShowAdd(false)} aria-label="Close"><X size={19}/></button></div><label className="form-label" htmlFor="habit-name">Habit name</label><input id="habit-name" autoFocus maxLength={70} placeholder="e.g. Stretch for 10 minutes" value={habitName} onChange={e=>setHabitName(e.target.value)} required/><label className="form-label">Pick an emoji</label><div className="emoji-picker">{["✨","💧","📚","🏃","🧘","🥗","🌱","✍️","💤","🎯","🎨","🚶"].map(e=><button type="button" className={habitEmoji===e?"picked":""} key={e} onClick={()=>setHabitEmoji(e)}>{e}</button>)}</div><label className="form-label">Accent color</label><div className="color-picker">{["#7c83fd","#68a9f5","#75b99b","#f2a46f","#e88bb0","#9b8af7"].map(c=><button type="button" key={c} aria-label={`Select ${c}`} className={habitColor===c?"picked":""} style={{background:c}} onClick={()=>setHabitColor(c)}/>)}</div><div className="modal-actions"><button type="button" className="secondary-button" onClick={()=>setShowAdd(false)}>Cancel</button><button className="primary-button" type="submit"><Plus size={17}/> Create habit</button></div></form></div>}
    </div>
  );
}

function BellIcon({ size = 16 }) {
  return <Bell size={size} />;
}

function StatCard({icon,label,value,detail,color,progress}) {
  return <div className="stat-card"><div className="stat-top"><div className={`stat-icon ${color}`}>{icon}</div>{progress!==undefined&&<span className="stat-trend">{progress}%</span>}</div><div className="stat-value">{value}</div><div className="stat-label">{label}</div><div className="stat-detail">{detail}</div>{progress!==undefined&&<div className="stat-progress"><div className={color} style={{width:`${progress}%`}}/></div>}</div>;
}

export default App;
