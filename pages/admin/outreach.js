import { useEffect, useState } from 'react';
import Head from 'next/head';

const STATUS_COLORS = {
  pending: '#f3f4f6',
  contacted: '#dbeafe',
  waiting_yes: '#dbeafe',
  waiting_name: '#fef9c3',
  waiting_items: '#fef9c3',
  waiting_location: '#ffedd5',
  done: '#dcfce7',
  opted_out: '#f3f4f6',
  invalid: '#fee2e2',
};

export default function OutreachAdmin() {
  const [prospects, setProspects] = useState([]);
  const [loading, setLoading] = useState(true);
  const [selected, setSelected] = useState(null);
  const [sending, setSending] = useState(false);
  const [batchResult, setBatchResult] = useState(null);
  const [approvingId, setApprovingId] = useState(null);

  useEffect(() => { fetchProspects(); }, []);

  async function fetchProspects() {
    setLoading(true);
    const res = await fetch('/api/admin/prospects');
    if (res.ok) setProspects(await res.json());
    setLoading(false);
  }

  async function sendBatch() {
    setSending(true);
    setBatchResult(null);
    const secret = prompt('Enter admin secret:');
    const res = await fetch('/api/sms-outreach', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'x-admin-secret': secret },
      body: JSON.stringify({ limit: 10 }),
    });
    setBatchResult(await res.json());
    setSending(false);
    fetchProspects();
  }

  async function approveRestaurant(restaurantId, prospectId) {
    setApprovingId(prospectId);
    await fetch('/api/admin/approve-listing', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ restaurantId }),
    });
    setApprovingId(null);
    fetchProspects();
  }

  const stats = {
    total: prospects.length,
    pending: prospects.filter(p => p.status === 'pending').length,
    done: prospects.filter(p => p.status === 'done').length,
    optedOut: prospects.filter(p => p.status === 'opted_out').length,
  };

  return (
    <>
      <Head><title>559eats - SMS Outreach</title></Head>
      <div style={{minHeight:'100vh',background:'#f9fafb',fontFamily:'system-ui,sans-serif'}}>
        <div style={{background:'white',borderBottom:'1px solid #e5e7eb',padding:'16px 24px',display:'flex',justifyContent:'space-between',alignItems:'center'}}>
          <div>
            <h1 style={{margin:0,fontSize:'20px',fontWeight:600}}>SMS Outreach</h1>
            <p style={{margin:'4px 0 0',color:'#6b7280',fontSize:'14px'}}>Food truck prospect pipeline</p>
          </div>
          <div style={{display:'flex',gap:'16px',alignItems:'center'}}>
            <span style={{fontSize:'14px',color:'#6b7280'}}>{stats.total} total &middot; {stats.pending} pending &middot; {stats.done} done &middot; {stats.optedOut} opted out</span>
            <button onClick={sendBatch} disabled={sending} style={{background:'#f97316',color:'white',border:'none',padding:'8px 20px',borderRadius:'8px',cursor:'pointer',fontSize:'14px',opacity:sending?0.6:1}}>
              {sending ? 'Sending...' : 'Send Next Batch (10)'}
            </button>
          </div>
        </div>
        {batchResult && <div style={{background:'#f0fdf4',padding:'10px 24px',fontSize:'14px',color:'#166534'}}>Sent: {batchResult.sent} messages, {batchResult.errors} errors</div>}
        <div style={{display:'flex',height:'calc(100vh - 73px)'}}>
          <div style={{width:'320px',borderRight:'1px solid #e5e7eb',background:'white',overflowY:'auto'}}>
            {loading ? <div style={{padding:'20px',color:'#9ca3af'}}>Loading...</div> : prospects.length === 0 ? <div style={{padding:'20px',color:'#9ca3af'}}>No prospects yet. Run the scraper first.</div> : prospects.map(p => (
              <div key={p.id} onClick={() => setSelected(p)} style={{padding:'12px 16px',borderBottom:'1px solid #f3f4f6',cursor:'pointer',background:selected?.id===p.id?'#fff7ed':'white'}}>
                <div style={{display:'flex',justifyContent:'space-between',alignItems:'flex-start',gap:'8px'}}>
                  <span style={{fontWeight:500,fontSize:'14px',flex:1,overflow:'hidden',textOverflow:'ellipsis',whiteSpace:'nowrap'}}>{p.name || p.phone}</span>
                  <span style={{fontSize:'11px',padding:'2px 8px',borderRadius:'12px',background:STATUS_COLORS[p.status]||'#f3f4f6',whiteSpace:'nowrap'}}>{p.status}</span>
                </div>
                {p.name && <div style={{fontSize:'12px',color:'#9ca3af',marginTop:'2px'}}>{p.phone}</div>}
              </div>
            ))}
          </div>
          <div style={{flex:1,overflowY:'auto',padding:'24px'}}>
            {!selected ? (
              <div style={{display:'flex',alignItems:'center',justifyContent:'center',height:'200px',color:'#9ca3af',fontSize:'14px'}}>Select a prospect to view the conversation</div>
            ) : (
              <div style={{maxWidth:'600px'}}>
                <h2 style={{margin:'0 0 4px',fontSize:'18px'}}>{selected.name || 'Unknown business'}</h2>
                <p style={{color:'#6b7280',margin:'0 0 4px',fontSize:'14px'}}>{selected.phone}</p>
                {selected.address && <p style={{color:'#6b7280',margin:'0 0 16px',fontSize:'14px'}}>{selected.address}</p>}
                {selected.status === 'done' && selected.restaurant_id && (
                  <div style={{display:'flex',justifyContent:'space-between',alignItems:'center',padding:'12px',background:'#f0fdf4',border:'1px solid #bbf7d0',borderRadius:'8px',marginBottom:'16px'}}>
                    <span style={{fontSize:'14px',color:'#166534'}}>Completed - ready to approve</span>
                    <button onClick={() => approveRestaurant(selected.restaurant_id, selected.id)} disabled={approvingId===selected.id} style={{background:'#166534',color:'white',border:'none',padding:'6px 16px',borderRadius:'6px',cursor:'pointer',fontSize:'14px'}}>
                      {approvingId===selected.id ? 'Approving...' : 'Approve Listing'}
                    </button>
                  </div>
                )}
                <div style={{display:'flex',flexDirection:'column',gap:'12px',marginTop:'16px'}}>
                  {(selected.conversation||[]).map((msg,i) => (
                    <div key={i} style={{display:'flex',justifyContent:msg.role==='outbound'?'flex-start':'flex-end'}}>
                      <div style={{maxWidth:'75%',padding:'10px 14px',borderRadius:'12px',fontSize:'14px',background:msg.role==='outbound'?'#fff7ed':'#f3f4f6',color:msg.role==='outbound'?'#c2410c':'#374151'}}>
                        <p style={{margin:0}}>{msg.text}</p>
                        <p style={{margin:'4px 0 0',fontSize:'11px',opacity:0.6}}>{msg.role==='outbound'?'559eats':'Owner'} &middot; {msg.at?new Date(msg.at).toLocaleString():''}</p>
                      </div>
                    </div>
                  ))}
                  {(!selected.conversation||selected.conversation.length===0) && <p style={{color:'#9ca3af',fontSize:'14px'}}>No messages yet</p>}
                </div>
              </div>
            )}
          </div>
        </div>
      </div>
    </>
  );
}