import express from 'express'
import cors from 'cors'
import dotenv from 'dotenv'
import { randomUUID } from 'node:crypto'

dotenv.config()
const app = express()
app.use(express.json({ limit: '1mb' }))
app.use(cors({
  origin: (origin, callback) => {
    const allowed = (process.env.CLIENT_URL || 'http://localhost:5173').split(',').map(s => s.trim())
    if (!origin || allowed.includes('*') || allowed.includes(origin) || /\.vercel\.app$/.test(new URL(origin).hostname)) {
      return callback(null, true)
    }
    return callback(null, true) // demo starter: allow cross-origin deployment; restrict this for production
  }
}))

let leads = [
  { id:'lead-1', name:'Olivia Chen', company:'Northstar Studio', email:'olivia@northstar.example', role:'Founder', score:96, intent:'High', value:'$8,400', source:'Website inquiry', summary:'Looking for a new customer onboarding experience before their November launch.', recommended_action:'Send a tailored discovery call invite', status:'New', initials:'OC', color:'rose' },
  { id:'lead-2', name:'Marcus Reed', company:'Goodkind Supply', email:'marcus@goodkind.example', role:'Head of Growth', score:89, intent:'High', value:'$5,200', source:'Referral', summary:'Asked about a landing page refresh and conversion tracking.', recommended_action:'Share a short project approach', status:'New', initials:'MR', color:'sage' },
  { id:'lead-3', name:'Amara Patel', company:'Sunday Works', email:'amara@sunday.example', role:'Marketing Director', score:82, intent:'Medium', value:'$3,600', source:'Product demo', summary:'Interested in AI-assisted lead qualification; wants to see a practical example.', recommended_action:'Send a relevant demo and case study', status:'New', initials:'AP', color:'lavender' },
  { id:'lead-4', name:'Theo Martin', company:'Morrow Health', email:'theo@morrow.example', role:'Operations Lead', score:64, intent:'Medium', value:'$2,100', source:'Newsletter', summary:'Exploring ways to reduce repetitive follow-up work.', recommended_action:'Ask about current workflow', status:'Contacted', initials:'TM', color:'sand' }
]

let tasks = [
  { id:'task-1', title:'Review Northstar onboarding brief', due:'Today · 2:30 PM', done:false, priority:'High' },
  { id:'task-2', title:'Send Goodkind project approach', due:'Tomorrow · 10:00 AM', done:false, priority:'Medium' },
  { id:'task-3', title:'Prepare Sunday Works demo', due:'Tomorrow · 1:00 PM', done:true, priority:'Low' }
]
let activity = [
  { id:'activity-1', type:'lead_analyzed', title:'Lead scores refreshed', detail:'4 leads reviewed · 3 need attention', time:'9 min ago' },
  { id:'activity-2', type:'draft_created', title:'Follow-up draft prepared', detail:'Northstar Studio · awaiting approval', time:'22 min ago' },
  { id:'activity-3', type:'task_created', title:'Task added to your day', detail:'Review onboarding brief', time:'1 hr ago' }
]
let drafts = []

function addActivity(type, title, detail) {
  const item = { id: randomUUID(), type, title, detail, time:'Just now' }
  activity = [item, ...activity].slice(0, 30)
  return item
}

function findLeadFromMessage(message) {
  const lower = message.toLowerCase()
  return leads.find(lead => lower.includes(lead.name.toLowerCase()) || lower.includes(lead.company.toLowerCase())) ||
    leads.slice().sort((a,b)=>b.score-a.score)[0]
}

function demoDraft(lead) {
  const subject = `A quick idea for ${lead.company}`
  const body = `Hi ${lead.name.split(' ')[0]},\n\nThanks for sharing a little about what ${lead.company} is working on. Your upcoming priorities caught my attention, and I have a couple of ideas that could help make the next step feel simpler.\n\nWould you be open to a quick 15-minute conversation this week? I can come prepared with a few practical suggestions tailored to your goals.\n\nWarmly,\nPriya`
  return { id:randomUUID(), leadId:lead.id, leadName:lead.name, company:lead.company, subject, body, status:'pending' }
}

async function geminiDraft(lead, userMessage) {
  const key = process.env.GEMINI_API_KEY
  if (!key) throw new Error('Gemini API key is missing. Add GEMINI_API_KEY to backend/.env and restart the backend.')
  const model = process.env.GEMINI_MODEL || 'gemini-2.5-flash'
  const prompt = `You are FounderFlow, a thoughtful business operations copilot. Write a concise, warm, genuinely personalized business follow-up email. Follow the founder's request closely, especially any specific details or constraints they mention. Use relevant concrete facts from the lead summary; do not replace them with vague generic wording. Do not invent facts, discounts, promises, or claim an email was sent. Return only valid JSON with keys "subject" and "body".\nLead details: ${JSON.stringify({name:lead.name, company:lead.company, role:lead.role, summary:lead.summary, recommended_action:lead.recommended_action})}\nFounder request: ${userMessage}`
  const response = await fetch(`https://generativelanguage.googleapis.com/v1beta/models/${encodeURIComponent(model)}:generateContent?key=${encodeURIComponent(key)}`, {
    method:'POST',
    headers:{'Content-Type':'application/json'},
    body:JSON.stringify({
      contents:[{parts:[{text:prompt}]}],
      generationConfig:{temperature:0.4, responseMimeType:'application/json'}
    }),
    signal:AbortSignal.timeout(20000)
  })
  const data = await response.json().catch(() => ({}))
  if (!response.ok) {
    const apiMessage = data?.error?.message || `HTTP ${response.status}`
    throw new Error(`Gemini API request failed (${response.status}): ${apiMessage}`)
  }
  const candidate = data.candidates?.[0]
  const raw = candidate?.content?.parts?.map(p => p.text || '').join('').trim() || ''
  if (!raw) {
    const reason = candidate?.finishReason || data.promptFeedback?.blockReason || 'empty response'
    throw new Error(`Gemini returned no draft (${reason}). Check the API key, model access, and prompt.`)
  }
  let parsed
  try {
    parsed = JSON.parse(raw.replace(/^```(?:json)?\s*/i,'').replace(/```\s*$/,'').trim())
  } catch {
    throw new Error('Gemini responded, but its draft was not valid JSON. Please try again.')
  }
  if (typeof parsed.subject !== 'string' || !parsed.subject.trim() || typeof parsed.body !== 'string' || !parsed.body.trim()) {
    throw new Error('Gemini response did not include both a subject and email body. Please try again.')
  }
  return {subject:parsed.subject.trim(), body:parsed.body.trim(), generatedBy:'gemini'}
}

app.get('/api/health', (_req, res) => {
  res.json({
    ok:true, service:'founderflow-api',
    mode: process.env.GEMINI_API_KEY ? 'gemini' : 'demo',
    aiConfigured: Boolean(process.env.GEMINI_API_KEY),
    leads, tasks, activity:activity.slice(0,8)
  })
})

app.get('/api/leads', (_req, res) => res.json({leads:leads.slice().sort((a,b)=>b.score-a.score)}))
app.post('/api/leads', (req, res) => {
  const name = String(req.body?.name || '').trim()
  const company = String(req.body?.company || '').trim()
  if (!name || !company) return res.status(400).json({error:'Lead name and company are required.'})
  const lead = {
    id: randomUUID(), name, company,
    email: String(req.body?.email || '').trim(), role: String(req.body?.role || '').trim(),
    value: String(req.body?.value || 'Not specified').trim(), source: String(req.body?.source || 'Website inquiry').trim(),
    summary: String(req.body?.summary || 'New lead — review their needs and follow up.').trim(),
    score: 50, intent: 'Medium', recommended_action: 'Review lead details and send a follow-up', status: 'New',
    initials: name.split(/\s+/).map(part => part[0]).join('').slice(0,2).toUpperCase(), color: ['rose','sage','lavender','sand'][leads.length % 4]
  }
  leads = [lead, ...leads]
  const item = addActivity('lead_added', 'New lead added', `${name} · ${company}`)
  res.status(201).json({lead, leads, activity:[item]})
})
app.delete('/api/leads/:id', (req, res) => {
  const before = leads.length
  leads = leads.filter(lead => lead.id !== req.params.id)
  if (leads.length === before) return res.status(404).json({error:'Lead not found.'})
  res.json({ok:true, leads})
})
app.get('/api/tasks', (_req, res) => res.json({tasks}))
app.get('/api/activity', (_req, res) => res.json({activity}))

app.post('/api/assistant/run', async (req, res) => {
  const message = String(req.body?.message || '').trim()
  if (!message) return res.status(400).json({error:'Please provide a message.'})
  if (message.length > 1200) return res.status(400).json({error:'Message is too long.'})
  const lower = message.toLowerCase()
  const createdActivity = []
  let newDrafts = []
  let reply = ''
  const mode = process.env.GEMINI_API_KEY ? 'gemini' : 'demo'

  if (/(draft|follow.?up|email|message)/i.test(lower)) {
    let selected = leads.filter(l => l.intent === 'High').sort((a,b)=>b.score-a.score)
    const named = leads.find(l => lower.includes(l.name.toLowerCase()) || lower.includes(l.company.toLowerCase()))
    if (named) selected = [named]
    else if (!/(three|3|hottest|hot|all|each|every|multiple)/i.test(lower)) selected = [selected[0] || leads[0]]
    else selected = selected.slice(0,3)
    try {
      for (const lead of selected) {
        const ai = await geminiDraft(lead, message)
        newDrafts.push({ ...demoDraft(lead), ...ai })
      }
    } catch (error) {
      console.error('Copilot draft generation failed:', error.message)
      return res.status(502).json({
        error: `I couldn't generate a live Gemini draft, so I have not created a demo substitute. ${error.message}`,
        mode: 'gemini'
      })
    }
    drafts = [...newDrafts, ...drafts].slice(0,30)
    createdActivity.push(addActivity('draft_created', 'Follow-up draft prepared', `${newDrafts.length} draft${newDrafts.length===1?'':'s'} ready for review`))
    reply = `I’ve prepared ${newDrafts.length} follow-up draft${newDrafts.length===1?'':'s'} for review. Take a look, make any edits you need, then approve or dismiss each one. Nothing has been sent.`
  } else if (/(task|tomorrow|remind|todo|to-do|schedule)/i.test(lower)) {
    const title = message.replace(/^(please\s+)?(create|add|make|schedule|remind me to)\s+(a\s+)?(task|reminder|to-do)?\s*(to|for|:)?\s*/i,'').trim()
    const task = {id:randomUUID(), title: title && title.length > 3 ? title.charAt(0).toUpperCase()+title.slice(1) : 'Review business priorities', due:'Tomorrow · 10:00 AM', done:false, priority:'Medium'}
    tasks = [task, ...tasks]
    createdActivity.push(addActivity('task_created','Task added to your day',task.title))
    reply = `All set — I added “${task.title}” to your task list for tomorrow. You can mark it complete whenever you’re ready.`
  } else if (/(hot|lead|pipeline|priority|focus|summary|business)/i.test(lower)) {
    const sorted = leads.slice().sort((a,b)=>b.score-a.score)
    const top = sorted.slice(0,3)
    createdActivity.push(addActivity('lead_analyzed','Lead priorities reviewed',`${top.length} top-scoring leads surfaced`))
    reply = `Here are your top opportunities right now:\n\n${top.map((l,i)=>`${i+1}. ${l.name} at ${l.company} — score ${l.score}/100, ${l.intent.toLowerCase()} intent (${l.value}).`).join('\n')}\n\nI’d start with ${top[0].name}, then ${top[1].name}. Want me to draft personalized follow-ups for them?`
  } else {
    reply = `I can help you prioritize leads, draft follow-ups, and create tasks. Try “Find my three hottest leads and draft personalized follow-ups” or “Create a task to review my pipeline tomorrow.”`
  }

  res.json({reply, leads:leads.slice().sort((a,b)=>b.score-a.score), tasks, activity:createdActivity, drafts:newDrafts, mode})
})

app.post('/api/drafts/:id/approve', (req, res) => {
  const draft = drafts.find(d => d.id === req.params.id)
  if (!draft) return res.status(404).json({error:'Draft not found. It may have already been handled.'})
  draft.status = 'approved'
  const task = {id:randomUUID(), title:`Send approved follow-up to ${draft.leadName}`, due:'Today · Next available', done:false, priority:'Medium'}
  tasks = [task, ...tasks]
  const item = addActivity('task_created','Follow-up approved',`Task created for ${draft.leadName}; no email sent automatically`)
  drafts = drafts.filter(d=>d.id !== draft.id)
  res.json({ok:true, tasks, activity:[item], note:'Approved draft saved as a task. This demo does not send email.'})
})

app.post('/api/drafts/:id/reject', (req, res) => {
  const draft = drafts.find(d => d.id === req.params.id)
  if (!draft) return res.status(404).json({error:'Draft not found.'})
  drafts = drafts.filter(d=>d.id !== draft.id)
  const item = addActivity('draft_dismissed','Draft dismissed',`Follow-up for ${draft.leadName} dismissed`)
  res.json({ok:true, activity:[item]})
})

app.post('/api/tasks', (req, res) => {
  const title = String(req.body?.title || '').trim()
  if (!title) return res.status(400).json({error:'Task title is required.'})
  if (title.length > 180) return res.status(400).json({error:'Task title is too long.'})
  const task = {id:randomUUID(), title, due:'Tomorrow · 10:00 AM', done:false, priority:'Medium'}
  tasks = [task, ...tasks]
  const item = addActivity('task_created','Task added to your day',title)
  res.status(201).json({task, tasks, activity:[item]})
})

app.delete('/api/tasks/:id', (req, res) => {
  const before = tasks.length
  tasks = tasks.filter(task => task.id !== req.params.id)
  if (tasks.length === before) return res.status(404).json({error:'Task not found.'})
  res.json({ok:true, tasks})
})

app.patch('/api/tasks/:id', (req, res) => {
  const task = tasks.find(t=>t.id===req.params.id)
  if (!task) return res.status(404).json({error:'Task not found.'})
  task.done = Boolean(req.body?.done)
  res.json({task})
})

app.get('/', (_req, res) => res.json({name:'FounderFlow AI API', health:'/api/health'}))

const port = process.env.PORT || 5000
if (process.env.VERCEL !== '1') {
  app.listen(port, () => console.log(`FounderFlow API running on http://localhost:${port}`))
}
export default app
