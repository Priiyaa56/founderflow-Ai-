import { useEffect, useMemo, useRef, useState } from 'react'
import {
  Activity, ArrowDownRight, ArrowUpRight, Bell, Bot, Check, CheckCheck,
  ChevronDown, CircleHelp, Clock3, Command, Flame, Leaf, Menu, Moon,
  MoreHorizontal, Plus, Send, Settings2, ShieldCheck, Sparkles, Sun,
  Target, TrendingUp, Users, WandSparkles, X, Zap, CalendarDays, Circle,
  PanelLeftClose, PanelLeftOpen, RefreshCw
} from 'lucide-react'

const API_BASE = (import.meta.env.VITE_API_URL || 'http://localhost:5000').replace(/\/$/, '')

const fallbackLeads = [
  { id:'lead-1', name:'Olivia Chen', company:'Northstar Studio', email:'olivia@northstar.example', role:'Founder', score:96, intent:'High', value:'$8,400', source:'Website inquiry', summary:'Looking for a new customer onboarding experience before their November launch.', recommended_action:'Send a tailored discovery call invite', status:'New', initials:'OC', color:'rose' },
  { id:'lead-2', name:'Marcus Reed', company:'Goodkind Supply', email:'marcus@goodkind.example', role:'Head of Growth', score:89, intent:'High', value:'$5,200', source:'Referral', summary:'Asked about a landing page refresh and conversion tracking.', recommended_action:'Share a short project approach', status:'New', initials:'MR', color:'sage' },
  { id:'lead-3', name:'Amara Patel', company:'Sunday Works', email:'amara@sunday.example', role:'Marketing Director', score:82, intent:'Medium', value:'$3,600', source:'Product demo', summary:'Interested in AI-assisted lead qualification; wants to see a practical example.', recommended_action:'Send a relevant demo and case study', status:'New', initials:'AP', color:'lavender' },
  { id:'lead-4', name:'Theo Martin', company:'Morrow Health', email:'theo@morrow.example', role:'Operations Lead', score:64, intent:'Medium', value:'$2,100', source:'Newsletter', summary:'Exploring ways to reduce repetitive follow-up work.', recommended_action:'Ask about current workflow', status:'Contacted', initials:'TM', color:'sand' }
]

const starterTasks = [
  { id:'task-1', title:'Review Northstar onboarding brief', due:'Today · 2:30 PM', done:false, priority:'High' },
  { id:'task-2', title:'Send Goodkind project approach', due:'Tomorrow · 10:00 AM', done:false, priority:'Medium' },
  { id:'task-3', title:'Prepare Sunday Works demo', due:'Tomorrow · 1:00 PM', done:true, priority:'Low' }
]

const starterActivity = [
  { id:1, type:'lead_analyzed', title:'Lead scores refreshed', detail:'4 leads reviewed · 3 need attention', time:'9 min ago' },
  { id:2, type:'draft_created', title:'Follow-up draft prepared', detail:'Northstar Studio · awaiting approval', time:'22 min ago' },
  { id:3, type:'task_created', title:'Task added to your day', detail:'Review onboarding brief', time:'1 hr ago' }
]

function timeGreeting() {
  const h = new Date().getHours()
  return h < 12 ? 'Good morning' : h < 17 ? 'Good afternoon' : 'Good evening'
}

function IconButton({ children, label, onClick, className='' }) {
  return <button className={`icon-button ${className}`} aria-label={label} title={label} onClick={onClick}>{children}</button>
}

function ScoreRing({ score }) {
  return <div className="score-ring" style={{'--score': `${score * 3.6}deg`}}><span>{score}</span></div>
}

function LeadCard({ lead, onDraft, onMore }) {
  return (
    <article className="lead-card">
      <div className="lead-top">
        <div className={`avatar ${lead.color || 'sand'}`}>{lead.initials || lead.name.split(' ').map(x=>x[0]).join('')}</div>
        <div className="lead-person">
          <h3>{lead.name}</h3>
          <p>{lead.company}</p>
        </div>
        <button className="more-button" aria-label={`More options for ${lead.name}`} title="Lead options" onClick={() => onMore(lead)}><MoreHorizontal size={18}/></button>
      </div>
      <div className="lead-meta">
        <span className={`intent intent-${(lead.intent || 'medium').toLowerCase()}`}><span className="intent-dot"/>{lead.intent} intent</span>
        <span className="lead-value">{lead.value}</span>
      </div>
      <p className="lead-summary">{lead.summary}</p>
      <div className="lead-bottom">
        <div className="score-label"><span>Lead score</span><strong>{lead.score}<small>/100</small></strong></div>
        <div className="score-track"><span style={{width:`${lead.score}%`}}/></div>
      </div>
      <button className="text-action" onClick={() => onDraft(lead)}><WandSparkles size={15}/> Draft follow-up <ArrowUpRight size={14}/></button>
    </article>
  )
}

function App() {
  const [theme, setTheme] = useState(() => localStorage.getItem('founderflow-theme') || 'light')
  const [activeTab, setActiveTab] = useState('Overview')
  const [leads, setLeads] = useState(fallbackLeads)
  const [tasks, setTasks] = useState(starterTasks)
  const [activity, setActivity] = useState(starterActivity)
  const [messages, setMessages] = useState([
    { id:'welcome', role:'assistant', text:'Hey there! I’m your FounderFlow copilot. I can surface priority leads, draft thoughtful follow-ups, and turn your plans into tasks. What should we take off your plate today?' }
  ])
  const [input, setInput] = useState('')
  const [busy, setBusy] = useState(false)
  const [apiStatus, setApiStatus] = useState('checking')
  const [apiMode, setApiMode] = useState('demo')
  const [pendingDrafts, setPendingDrafts] = useState([])
  const [sidebarOpen, setSidebarOpen] = useState(true)
  const [showTaskForm, setShowTaskForm] = useState(false)
  const [showLeadForm, setShowLeadForm] = useState(false)
  const [newLead, setNewLead] = useState({name:'', company:'', email:'', role:'', value:'', source:'Website inquiry', summary:''})
  const [leadOptions, setLeadOptions] = useState(null)
  const [newTask, setNewTask] = useState('')
  const [toast, setToast] = useState('')
  const [selectedLead, setSelectedLead] = useState(null)
  const chatEndRef = useRef(null)
  const inputRef = useRef(null)

  useEffect(() => {
    document.documentElement.dataset.theme = theme
    localStorage.setItem('founderflow-theme', theme)
  }, [theme])

  useEffect(() => {
    fetch(`${API_BASE}/api/health`).then(r=>r.json()).then(data => {
      setApiStatus('online'); setApiMode(data.aiConfigured ? 'gemini' : 'demo')
      if (data.leads?.length) setLeads(data.leads)
      if (data.tasks) setTasks(data.tasks)
    }).catch(() => setApiStatus('offline'))
  }, [])

  useEffect(() => { chatEndRef.current?.scrollIntoView({behavior:'smooth'}) }, [messages, busy])

  const openTasks = tasks.filter(t => !t.done).length
  const hotLeads = leads.filter(l => l.intent?.toLowerCase() === 'high').length
  const completedTasks = tasks.filter(t => t.done).length

  function notify(text) {
    setToast(text)
    window.setTimeout(() => setToast(''), 2800)
  }

  async function sendMessage(raw = input) {
    const text = raw.trim()
    if (!text || busy) return
    setInput('')
    setMessages(prev => [...prev, {id:crypto.randomUUID(), role:'user', text}])
    setBusy(true)
    try {
      const res = await fetch(`${API_BASE}/api/assistant/run`, {
        method:'POST', headers:{'Content-Type':'application/json'},
        body:JSON.stringify({message:text})
      })
      const data = await res.json().catch(() => ({}))
      if (!res.ok) throw new Error(data.error || `Copilot request failed (${res.status}).`)
      if (data.leads) setLeads(data.leads)
      if (data.tasks) setTasks(data.tasks)
      if (data.activity) setActivity(prev => [...data.activity, ...prev].slice(0,8))
      if (data.drafts?.length) setPendingDrafts(prev => [...data.drafts, ...prev])
      if (data.mode) setApiMode(data.mode)
      setMessages(prev => [...prev, {id:crypto.randomUUID(), role:'assistant', text:data.reply || 'Done — I’ve updated your workspace.', cards:data.drafts || []}])
    } catch (error) {
      const message = error?.message === 'Failed to fetch'
        ? 'Could not reach the backend. Check that the backend terminal is running at http://localhost:5000, then try again.'
        : (error?.message || 'The Copilot request failed. Please try again.')
      setMessages(prev => [...prev, {id:crypto.randomUUID(), role:'assistant', text:message}])
      notify('Copilot request failed — see the message for details')
    } finally {
      setBusy(false)
    }
  }

  function localFallback(text) {
    const t = text.toLowerCase()
    if (t.includes('lead') || t.includes('follow')) return `I found ${leads.filter(l=>l.intent==='High').length} high-intent leads. Your strongest opportunities are ${leads.slice().sort((a,b)=>b.score-a.score).slice(0,3).map(l=>l.name).join(', ')}. Use the “Draft follow-up” action on a lead to prepare a message for review.`
    if (t.includes('task') || t.includes('tomorrow')) return `You have ${openTasks} open tasks. I’d start with “${tasks.find(t=>!t.done)?.title || 'review your priorities'}”. You can add a task from the task panel.`
    return 'I can help prioritize leads, draft follow-ups, and create tasks. Try “Find my three hottest leads and draft follow-ups” or “Create a task to review my pipeline tomorrow.”'
  }

  async function draftLead(lead) {
    setSelectedLead(lead)
    setInput(`Draft a personalized follow-up for ${lead.name} at ${lead.company}`)
    inputRef.current?.focus()
    await sendMessage(`Draft a personalized follow-up for ${lead.name} at ${lead.company}`)
  }

  async function actOnDraft(draftId, action) {
    try {
      const res = await fetch(`${API_BASE}/api/drafts/${draftId}/${action}`, {method:'POST'})
      if (!res.ok) throw new Error()
      const data = await res.json()
      if (data.tasks) setTasks(data.tasks)
      if (data.activity) setActivity(prev => [...data.activity, ...prev].slice(0,8))
    } catch {}
    setPendingDrafts(prev => prev.filter(d => d.id !== draftId))
    setMessages(prev => prev.map(m => ({...m, cards:m.cards?.filter(d=>d.id !== draftId)})))
    notify(action === 'approve' ? 'Draft approved and task added' : 'Draft dismissed')
  }

  async function addLead(e) {
    e.preventDefault()
    const form = {...newLead, name:newLead.name.trim(), company:newLead.company.trim(), email:newLead.email.trim(), role:newLead.role.trim(), value:newLead.value.trim() || 'Not specified', summary:newLead.summary.trim() || 'New lead — review their needs and follow up.'}
    if (!form.name || !form.company) { notify('Please enter the lead name and company'); return }
    const lead = {id:crypto.randomUUID(), ...form, score:50, intent:'Medium', recommended_action:'Review lead details and send a follow-up', status:'New', initials:form.name.split(/\s+/).map(x=>x[0]).join('').slice(0,2).toUpperCase(), color:['rose','sage','lavender','sand'][leads.length % 4]}
    try {
      const res = await fetch(`${API_BASE}/api/leads`, {method:'POST', headers:{'Content-Type':'application/json'}, body:JSON.stringify(form)})
      if (res.ok) { const data = await res.json(); setLeads(prev => [data.lead || lead, ...prev]) }
      else setLeads(prev => [lead, ...prev])
    } catch { setLeads(prev => [lead, ...prev]) }
    setNewLead({name:'', company:'', email:'', role:'', value:'', source:'Website inquiry', summary:''})
    setShowLeadForm(false)
    setActiveTab('Leads')
    notify('Lead added successfully')
  }

  async function removeLead(lead) {
    if (!lead) return
    setLeads(prev => prev.filter(item => item.id !== lead.id))
    setLeadOptions(null)
    try { await fetch(`${API_BASE}/api/leads/${encodeURIComponent(lead.id)}`, {method:'DELETE'}) } catch {}
    notify(`${lead.name} removed from your leads`)
  }

  async function addTask(e) {
    e.preventDefault()
    const title = newTask.trim()
    if (!title) return
    try {
      const res = await fetch(`${API_BASE}/api/tasks`, {method:'POST', headers:{'Content-Type':'application/json'}, body:JSON.stringify({title})})
      const data = await res.json()
      if (data.task) setTasks(prev => [data.task, ...prev])
      if (data.activity) setActivity(prev => [...data.activity, ...prev].slice(0,8))
    } catch {
      setTasks(prev => [{id:crypto.randomUUID(), title, due:'Tomorrow · 10:00 AM', done:false, priority:'Medium'}, ...prev])
    }
    setNewTask('')
    setShowTaskForm(false)
    notify('Task added to your plan')
  }

  async function toggleTask(task) {
    const done = !task.done
    setTasks(prev => prev.map(t=>t.id===task.id ? {...t,done}:t))
    try {
      await fetch(`${API_BASE}/api/tasks/${task.id}`, {method:'PATCH', headers:{'Content-Type':'application/json'}, body:JSON.stringify({done})})
    } catch {}
  }

  async function removeTask(task) {
    setTasks(prev => prev.filter(item => item.id !== task.id))
    try { await fetch(`${API_BASE}/api/tasks/${encodeURIComponent(task.id)}`, {method:'DELETE'}) } catch {}
    notify('Task removed')
  }

  const navItems = [
    {name:'Overview', icon:PanelLeftOpen},
    {name:'Leads', icon:Users, count:leads.length},
    {name:'Tasks', icon:CalendarDays, count:openTasks},
    {name:'Activity', icon:Activity}
  ]

  return (
    <div className={`app-shell ${sidebarOpen ? '' : 'sidebar-collapsed'}`}>
      <aside className="sidebar">
        <div className="brand-lockup">
          <div className="brand-mark"><Leaf size={20}/></div>
          {sidebarOpen && <div className="brand-name">founderflow<span>AI</span><small>YOUR BUSINESS COPILOT</small></div>}
          <button className="sidebar-collapse" aria-label="Toggle sidebar" onClick={()=>setSidebarOpen(!sidebarOpen)}>{sidebarOpen ? <PanelLeftClose size={17}/> : <PanelLeftOpen size={17}/>}</button>
        </div>
        <button className="workspace-switch workspace-switch-button" onClick={()=>notify("Priya’s personal workspace is active")} title="Workspace details">
          <div className="workspace-avatar">P</div>
          {sidebarOpen && <><div className="workspace-name"><strong>Priya’s workspace</strong><span>Personal workspace</span></div><ChevronDown size={15}/></>}
        </button>
        <div className="nav-caption">{sidebarOpen ? 'WORKSPACE' : 'MENU'}</div>
        <nav className="main-nav">
          {navItems.map(({name,icon:Icon,count})=><button key={name} className={`nav-item ${activeTab===name?'active':''}`} onClick={()=>setActiveTab(name)} title={name}><Icon size={18}/>{sidebarOpen && <><span>{name}</span>{count !== undefined && <em>{count}</em>}</>}</button>)}
        </nav>
        {sidebarOpen && <div className="sidebar-bottom">
          <div className="upgrade-card">
            <div className="upgrade-icon"><Sparkles size={17}/></div>
            <strong>A little more headspace.</strong>
            <p>Let your copilot handle the busywork while you focus on the big picture.</p>
            <span className="plan-pill">EARLY ACCESS · DEMO</span>
          </div>
          <button className="sidebar-user sidebar-user-button" onClick={()=>notify('Workspace profile · Priya H.')} title="Workspace profile"><div className="user-avatar">PH</div><div className="user-info"><strong>Priya H.</strong><span>Founder</span></div><MoreHorizontal size={18}/></button>
        </div>}
      </aside>

      <main className="main-area">
        <header className="topbar">
          <div className="breadcrumb"><span>Workspace</span><span className="crumb-slash">/</span><strong>{activeTab}</strong></div>
          <div className="top-actions">
            <div className={`connection-status ${apiStatus}`}><span className="status-dot"/>{apiStatus==='online' ? (apiMode==='gemini'?'AI connected':'Demo mode') : apiStatus==='offline'?'Local preview':'Connecting'}</div>
            <IconButton label={theme==='light'?'Switch to dark mode':'Switch to light mode'} onClick={()=>setTheme(theme==='light'?'dark':'light')}>{theme==='light'?<Moon size={18}/>:<Sun size={18}/>}</IconButton>
            <IconButton label="Notifications" onClick={()=>notify('You’re all caught up')}><Bell size={18}/></IconButton>
            <div className="top-avatar">PH</div>
          </div>
        </header>

        <div className="page-content">
          {activeTab === 'Overview' && <>
            <section className="welcome-row">
              <div>
                <div className="eyebrow"><span className="eyebrow-line"/> THURSDAY, YOUR WAY</div>
                <h1>{timeGreeting()}, Priya<span className="title-period">.</span></h1>
                <p className="welcome-subtitle">Let’s make room for the work that really matters.</p>
              </div>
              <div className="welcome-actions"><button className="secondary-button" onClick={()=>setShowLeadForm(true)}><Plus size={16}/> Add lead</button><button className="primary-button" onClick={()=>{document.getElementById('assistant-input')?.focus();document.getElementById('assistant-panel')?.scrollIntoView({behavior:'smooth',block:'center'})}}><Sparkles size={16}/> Ask your copilot</button></div>
            </section>

            <section className="metric-grid">
              <div className="metric-card"><div className="metric-top"><span>Pipeline value</span><span className="metric-icon clay"><TrendingUp size={17}/></span></div><div className="metric-number">$19,300</div><div className="metric-foot"><span className="trend-up"><ArrowUpRight size={14}/> 12.8%</span><span>vs. last month</span></div><div className="mini-bars"><i/><i/><i/><i/><i/><i/><i/><i/><i/><i/><i/><i/></div></div>
              <div className="metric-card"><div className="metric-top"><span>High-intent leads</span><span className="metric-icon green"><Target size={17}/></span></div><div className="metric-number">{hotLeads.toString().padStart(2,'0')}<small> / {leads.length}</small></div><div className="metric-foot"><span className="trend-up"><ArrowUpRight size={14}/> Ready to reach out</span></div><div className="metric-progress"><span style={{width:`${leads.length?hotLeads/leads.length*100:0}%`}}/></div></div>
              <div className="metric-card"><div className="metric-top"><span>Open tasks</span><span className="metric-icon lavender"><CalendarDays size={17}/></span></div><div className="metric-number">{openTasks.toString().padStart(2,'0')}</div><div className="metric-foot"><span>{completedTasks} completed</span><span>· keep your pace</span></div><div className="task-mini-progress"><span style={{width:`${tasks.length?completedTasks/tasks.length*100:0}%`}}/></div></div>
              <div className="metric-card"><div className="metric-top"><span>Time given back</span><span className="metric-icon sand"><Clock3 size={17}/></span></div><div className="metric-number">4.5<small> hrs</small></div><div className="metric-foot"><span>Estimated this week</span><span className="metric-sparkle"><Sparkles size={14}/></span></div><div className="time-dots"><i/><i/><i/><i/><i/><i/><i/><i/><i/><i/><i/><i/><i/><i/><i/><i/><i/><i/></div></div>
            </section>

            <section className="content-grid">
              <div className="left-column">
                <div className="section-heading">
                  <div><div className="section-kicker">YOUR NEXT BEST MOVES</div><h2>Leads worth a little love <span className="heading-count">{leads.length}</span></h2></div>
                  <div className="section-heading-actions"><button className="subtle-button" onClick={()=>setShowLeadForm(true)}><Plus size={14}/> Add lead</button><button className="subtle-button" onClick={()=>setActiveTab('Leads')}>View all <ArrowUpRight size={14}/></button></div>
                </div>
                <div className="lead-grid">{leads.slice().sort((a,b)=>b.score-a.score).slice(0,3).map(lead=><LeadCard key={lead.id} lead={lead} onDraft={draftLead} onMore={setLeadOptions}/>)}</div>
                <div className="section-heading task-heading">
                  <div><div className="section-kicker">A GENTLER TO-DO LIST</div><h2>On your plate <span className="heading-count">{openTasks}</span></h2></div>
                  <button className="subtle-button" onClick={()=>setShowTaskForm(v=>!v)}><Plus size={15}/> Add task</button>
                </div>
                {showTaskForm && <form className="new-task-form" onSubmit={addTask}><input autoFocus value={newTask} onChange={e=>setNewTask(e.target.value)} placeholder="What needs doing?" aria-label="New task title"/><button className="primary-button" type="submit">Add task</button><button className="icon-button" type="button" onClick={()=>setShowTaskForm(false)}><X size={16}/></button></form>}
                <div className="task-list">{tasks.slice(0,5).map(task=><div className={`task-row ${task.done?'task-done':''}`} key={task.id}><button className={`task-check ${task.done?'checked':''}`} onClick={()=>toggleTask(task)} aria-label={task.done?'Mark task incomplete':'Complete task'}>{task.done&&<Check size={13}/>}</button><div className="task-copy"><strong>{task.title}</strong><span><Clock3 size={12}/>{task.due}</span></div><span className={`priority priority-${task.priority.toLowerCase()}`}>{task.priority}</span><button className="more-button" aria-label={`Remove ${task.title}`} title="Remove task" onClick={()=>removeTask(task)}><X size={16}/></button></div>)}</div>
              </div>

              <aside className="right-column">
                <div className="assistant-panel" id="assistant-panel">
                  <div className="assistant-header"><div className="assistant-emblem"><Bot size={19}/><span/></div><div><h3>Your copilot</h3><p><span className="online-dot"/> Here for the busywork</p></div><button className="more-button" aria-label="Clear assistant chat" title="Clear chat" onClick={()=>{setMessages([{id:crypto.randomUUID(),role:'assistant',text:'Chat cleared. What would you like to work on?'}]);setPendingDrafts([]);notify('Copilot chat cleared')}}><RefreshCw size={16}/></button></div>
                  <div className="assistant-intro"><span className="sparkle-label"><Sparkles size={13}/> A LITTLE HELP, RIGHT ON TIME</span><h4>What can I take<br/>off your plate?</h4><p>Give me the messy to-do. We’ll make a plan together.</p></div>
                  <div className="suggestion-list">
                    <button onClick={()=>sendMessage('Find my three hottest leads and draft personalized follow-ups')}><span className="suggestion-icon coral"><Flame size={15}/></span><span><strong>Warm up my leads</strong><small>Find the best people to reach</small></span><ArrowUpRight size={15}/></button>
                    <button onClick={()=>sendMessage('Create a task to review my pipeline tomorrow')}><span className="suggestion-icon sage"><CalendarDays size={15}/></span><span><strong>Plan my next move</strong><small>Turn an idea into a task</small></span><ArrowUpRight size={15}/></button>
                    <button onClick={()=>sendMessage('Give me a quick business priority summary')}><span className="suggestion-icon lilac"><Zap size={15}/></span><span><strong>Find my focus</strong><small>What deserves attention today?</small></span><ArrowUpRight size={15}/></button>
                  </div>
                  <div className="chat-window">
                    {messages.slice(-5).map(msg=><div key={msg.id} className={`chat-message ${msg.role}`}><div className="chat-avatar">{msg.role==='assistant'?<Bot size={14}/>:<span>PH</span>}</div><div className="chat-bubble">{msg.text}{msg.cards?.map(d=><div className="draft-card" key={d.id}><div className="draft-top"><span className="draft-label"><Sparkles size={12}/> FOLLOW-UP DRAFT</span><span className="draft-status">Needs review</span></div><strong>To: {d.leadName}</strong><p>{d.subject}</p><div className="draft-body">{d.body}</div><div className="draft-actions"><button onClick={()=>actOnDraft(d.id,'approve')} className="approve-button"><Check size={13}/> Approve</button><button onClick={()=>actOnDraft(d.id,'reject')} className="reject-button">Dismiss</button></div></div>)}</div></div>)}
                    {busy&&<div className="chat-message assistant"><div className="chat-avatar"><Bot size={14}/></div><div className="chat-bubble typing"><i/><i/><i/></div></div>}
                    <div ref={chatEndRef}/>
                  </div>
                  <form className="chat-input-row" onSubmit={e=>{e.preventDefault();sendMessage()}}><input id="assistant-input" ref={inputRef} value={input} onChange={e=>setInput(e.target.value)} placeholder="Ask me anything…" aria-label="Message your copilot"/><button type="submit" disabled={!input.trim()||busy} aria-label="Send message"><Send size={16}/></button></form>
                  <div className="assistant-foot"><ShieldCheck size={12}/> You stay in control. Actions need your approval.</div>
                </div>
                <div className="activity-panel">
                  <div className="activity-heading"><div><div className="section-kicker">THE PAPER TRAIL</div><h3>Recent activity</h3></div><button className="more-button" aria-label="Refresh activity" title="Refresh activity" onClick={()=>notify('Activity list is up to date')}><RefreshCw size={16}/></button></div>
                  <div className="activity-list">{activity.slice(0,4).map(item=><div className="activity-row" key={item.id}><div className={`activity-icon ${item.type}`}><Activity size={15}/></div><div className="activity-copy"><strong>{item.title}</strong><span>{item.detail}</span><small>{item.time}</small></div></div>)}</div>
                  <button className="activity-link" onClick={()=>setActiveTab('Activity')}>See all activity <ArrowUpRight size={14}/></button>
                </div>
              </aside>
            </section>
          </>}

          {activeTab === 'Leads' && <section className="simple-page"><div className="welcome-row"><div><div className="eyebrow"><span className="eyebrow-line"/> YOUR RELATIONSHIPS</div><h1>Good things start <span className="title-period">here.</span></h1><p className="welcome-subtitle">A little context goes a long way. Here’s who’s on your radar.</p></div></div><div className="leads-page-actions"><button className="primary-button" onClick={()=>setShowLeadForm(true)}><Plus size={16}/> Add new lead</button></div><div className="lead-grid full-lead-grid">{leads.slice().sort((a,b)=>b.score-a.score).map(lead=><LeadCard key={lead.id} lead={lead} onDraft={draftLead} onMore={setLeadOptions}/>)}</div></section>}

          {activeTab === 'Tasks' && <section className="simple-page"><div className="welcome-row"><div><div className="eyebrow"><span className="eyebrow-line"/> MAKE SPACE FOR WHAT MATTERS</div><h1>One thing at a time<span className="title-period">.</span></h1><p className="welcome-subtitle">Progress is progress, even when it’s small.</p></div><button className="primary-button" onClick={()=>setShowTaskForm(v=>!v)}><Plus size={16}/> Add a task</button></div>{showTaskForm&&<form className="new-task-form" onSubmit={addTask}><input autoFocus value={newTask} onChange={e=>setNewTask(e.target.value)} placeholder="What needs doing?" aria-label="New task title"/><button className="primary-button" type="submit">Add task</button></form>}<div className="task-list task-list-large">{tasks.map(task=><div className={`task-row ${task.done?'task-done':''}`} key={task.id}><button className={`task-check ${task.done?'checked':''}`} onClick={()=>toggleTask(task)} aria-label="Toggle task">{task.done&&<Check size={13}/>}</button><div className="task-copy"><strong>{task.title}</strong><span><Clock3 size={12}/>{task.due}</span></div><span className={`priority priority-${task.priority.toLowerCase()}`}>{task.priority}</span><button className="more-button" aria-label={`Remove ${task.title}`} title="Remove task" onClick={()=>removeTask(task)}><X size={16}/></button></div>)}</div></section>}

          {activeTab === 'Activity' && <section className="simple-page"><div className="welcome-row"><div><div className="eyebrow"><span className="eyebrow-line"/> NOTHING UP OUR SLEEVE</div><h1>Every move, accounted for<span className="title-period">.</span></h1><p className="welcome-subtitle">A clear record of what your copilot has helped with.</p></div></div><div className="activity-panel activity-page-panel"><div className="activity-list">{activity.map(item=><div className="activity-row" key={item.id}><div className={`activity-icon ${item.type}`}><Activity size={15}/></div><div className="activity-copy"><strong>{item.title}</strong><span>{item.detail}</span><small>{item.time}</small></div></div>)}</div></div></section>}
        </div>
        {showLeadForm && <div className="modal-backdrop" role="presentation" onMouseDown={e=>{if(e.target===e.currentTarget)setShowLeadForm(false)}}><section className="modal-card" role="dialog" aria-modal="true" aria-labelledby="add-lead-title"><div className="modal-heading"><div><span className="section-kicker">GROW YOUR PIPELINE</span><h2 id="add-lead-title">Add a new lead</h2><p>Enter what you know. You can refine the details later.</p></div><button className="icon-button" type="button" aria-label="Close add lead form" onClick={()=>setShowLeadForm(false)}><X size={18}/></button></div><form className="lead-form" onSubmit={addLead}><label>Full name *<input required value={newLead.name} onChange={e=>setNewLead(v=>({...v,name:e.target.value}))} placeholder="e.g. Maya Sharma" /></label><label>Company *<input required value={newLead.company} onChange={e=>setNewLead(v=>({...v,company:e.target.value}))} placeholder="e.g. BrightPath Solutions" /></label><label>Email<input type="email" value={newLead.email} onChange={e=>setNewLead(v=>({...v,email:e.target.value}))} placeholder="maya@company.com" /></label><label>Role<input value={newLead.role} onChange={e=>setNewLead(v=>({...v,role:e.target.value}))} placeholder="e.g. Founder" /></label><label>Potential value<input value={newLead.value} onChange={e=>setNewLead(v=>({...v,value:e.target.value}))} placeholder="e.g. $2,000" /></label><label>Source<select value={newLead.source} onChange={e=>setNewLead(v=>({...v,source:e.target.value}))}><option>Website inquiry</option><option>Referral</option><option>Product demo</option><option>LinkedIn</option><option>Cold outreach</option><option>Other</option></select></label><label className="form-wide">What do they need?<textarea rows="3" value={newLead.summary} onChange={e=>setNewLead(v=>({...v,summary:e.target.value}))} placeholder="Describe their needs, timeline, budget, or message…" /></label><div className="modal-actions"><button type="button" className="secondary-button" onClick={()=>setShowLeadForm(false)}>Cancel</button><button type="submit" className="primary-button"><Plus size={16}/> Add lead</button></div></form></section></div>}
        {leadOptions && <div className="modal-backdrop" role="presentation" onMouseDown={e=>{if(e.target===e.currentTarget)setLeadOptions(null)}}><section className="modal-card compact-modal" role="dialog" aria-modal="true" aria-labelledby="lead-options-title"><div className="modal-heading"><div><span className="section-kicker">LEAD DETAILS</span><h2 id="lead-options-title">{leadOptions.name}</h2><p>{leadOptions.company} · {leadOptions.email || 'No email added'}</p></div><button className="icon-button" aria-label="Close lead details" onClick={()=>setLeadOptions(null)}><X size={18}/></button></div><div className="lead-detail-grid"><span>Lead score</span><strong>{leadOptions.score}/100</strong><span>Intent</span><strong>{leadOptions.intent}</strong><span>Potential value</span><strong>{leadOptions.value}</strong><span>Source</span><strong>{leadOptions.source || 'Not specified'}</strong></div><p className="lead-detail-summary">{leadOptions.summary}</p><div className="modal-actions"><button className="secondary-button" onClick={()=>{const lead=leadOptions;setLeadOptions(null);draftLead(lead)}}><WandSparkles size={15}/> Draft follow-up</button><button className="danger-button" onClick={()=>removeLead(leadOptions)}><X size={15}/> Remove lead</button></div></section></div>}
        <footer className="page-footer"><span>© 2026 FounderFlow AI</span><span><span className="footer-leaf"><Leaf size={12}/></span> Built for a little more breathing room</span><button onClick={()=>notify('FounderFlow demo · feedback can be added before submission')}><CircleHelp size={13}/> Help & feedback</button></footer>
      </main>
      {toast && <div className="toast"><CheckCheck size={16}/>{toast}</div>}
    </div>
  )
}

export default App
