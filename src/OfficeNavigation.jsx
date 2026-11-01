import React, { useEffect, useState } from 'react'
import { ArrowLeft, ArrowUpRight, Box, FileText, Map, MapPin, Minimize2, Search, UsersRound } from 'lucide-react'
import './office-navigation.css'

export function OfficeToolbar({ departments, focus, onFocus, mode, onMode, onDirectory }) {
  const [fullscreen, setFullscreen] = useState(!!document.fullscreenElement)
  useEffect(()=>{
    const onChange=()=>setFullscreen(!!document.fullscreenElement)
    document.addEventListener('fullscreenchange',onChange)
    return ()=>document.removeEventListener('fullscreenchange',onChange)
  },[])
  return <div className="office-toolbar">
    <label className="room-picker"><MapPin size={16}/><span>GO TO</span>
      <select aria-label="Explore a room" value={focus} onChange={e => onFocus(e.target.value)}>
        <option value="overview">Entire floor</option>
        {focus.startsWith('agent-') && <option value={focus}>Agent {String(Number(focus.split('-')[1])+1).padStart(3,'0')}</option>}
        <optgroup label="Departments">{departments.map((name,i)=><option key={name} value={`department-${i}`}>{name} · workstations</option>)}</optgroup>
        <optgroup label="Idle rooms">{departments.map((name,i)=><option key={name} value={`idle-${i}`}>{name} · idle room</option>)}</optgroup>
        <optgroup label="Shared spaces"><option value="meeting">Meeting room · 8 seats</option><option value="reception">Reception & lounge</option><option value="reports">Reports & progress hub</option></optgroup>
      </select>
    </label>
    <div className="camera-modes" aria-label="Camera view">
      <button aria-pressed={mode==='3d'} onClick={()=>onMode('3d')}><Box size={14}/> 3D view</button>
      <button aria-pressed={mode==='plan'} onClick={()=>onMode('plan')}><Map size={14}/> Seat map</button>
    </div>
    <button className="find-agent-button" onClick={onDirectory}><Search size={14}/><span>Find agent</span></button>
    {fullscreen && <button className="icon-button" aria-label="Exit fullscreen" onClick={()=>document.exitFullscreen()}><Minimize2 size={15}/></button>}
  </div>
}

export function RoomDetails({ focus, departments, provider, activeIndices, assignmentCount, reportCount, onFocus, onDirectory, onProjects, onReports, onAgent }) {
  const [type, value] = focus.split('-'), index = Number(value)
  const department = departments[index]
  const isDepartment = type==='department' || type==='idle'
  const atDesks = activeIndices.filter(i=>Math.floor(i/50)===index).length
  const isAgent = type==='agent'
  const title = isAgent ? `${provider} ${String(index+1).padStart(3,'0')}` : isDepartment ? `${department}${type==='idle' ? ' · idle room' : ''}` : {overview:'Make yourself at home', meeting:'The meeting room', reception:'Reception & lounge', reports:'Reports & progress hub'}[focus]
  const description = isAgent ? `${departments[Math.floor(index/50)]} · ${activeIndices.includes(index) ? 'At assigned desk' : 'In the idle room'} · Manual status`
    : isDepartment ? `${atDesks} at desks · ${50-atDesks} in the idle room · 50 workstations`
    : {overview:'Choose a room above, or click a room label to move closer.', meeting:'Eight seats, a shared screen and space for your next big idea.', reception:'A place to arrive, meet the team and take a moment.', reports:`${assignmentCount} floor assignments · ${reportCount} saved reports · Manually tracked`}[focus]
  return <div className="room-details" aria-live="polite">
    <div className="room-details__copy"><span className="room-details__icon">{isAgent ? <UsersRound size={18}/> : <MapPin size={18}/>}</span><div><span className="room-details__eyebrow">{focus==='overview' ? 'EXPLORE YOUR FLOOR' : 'YOU ARE VIEWING'}</span><h3>{title}</h3><p>{description}</p></div></div>
    <div className="room-details__actions">
      {focus!=='overview' && <button className="room-back" onClick={()=>onFocus('overview')}><ArrowLeft size={13}/> Entire floor</button>}
      {isAgent ? <button className="room-primary" onClick={()=>onAgent(index)}>View agent <ArrowUpRight size={13}/></button>
        : isDepartment ? <><button onClick={()=>onFocus(`${type==='idle'?'department':'idle'}-${index}`)}>{type==='idle'?'Workstations':'Idle room'} <ArrowUpRight size={13}/></button><button className="room-primary" onClick={()=>onDirectory(department)}>View team <UsersRound size={13}/></button></>
        : focus==='reports' ? <><button onClick={onProjects}>Project progress <ArrowUpRight size={13}/></button><button className="room-primary" onClick={onReports}>Open file holder <FileText size={13}/></button></>
        : <><button onClick={()=>onFocus(focus==='meeting'?'reception':'meeting')}>{focus==='meeting'?'Reception':'Meeting room'} <ArrowUpRight size={13}/></button><button className="room-primary" onClick={onDirectory}>Meet the team <UsersRound size={13}/></button></>}
    </div>
  </div>
}
