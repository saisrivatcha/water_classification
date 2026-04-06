import React from "react";
import { useState, useEffect, useRef } from "react";

// Updated PARAMS based on backend columns
const PARAMS = ["pH", "conductivity", "dissolved_oxygen", "temperature"];

// Updated SAFE keys to match the new PARAMS
const SAFE = {
  pH:                [6.5, 8.5],
  conductivity:      [0, 1500],
  dissolved_oxygen:  [5, 14],
  temperature:       [0, 35],
};

const COLORS = {
  pH:                "#1D9E75",
  conductivity:      "#EF9F27",
  dissolved_oxygen:  "#6e5494",
  temperature:       "#E24B4A",
};

// Map backend params to nice strings
const PARAM_LABELS = {
  pH: "pH",
  conductivity: "Conductivity",
  dissolved_oxygen: "Dissolved Oxygen",
  temperature: "Temperature",
};

export default function ForecastPage() {
  const [banner,  setBanner]  = useState({ type:"success", text:"Ready. Select a parameter and run forecast." });
  const [param,   setParam]   = useState("pH");
  const [horizon, setHorizon] = useState("24h");
  const [result,  setResult]  = useState(null);
  const chartRef  = useRef(null);
  const chartInst = useRef(null);

  const runForecast = async () => {
    setBanner({ type:"loading", text:"Fetching forecast from server..." });
    try {
      const res = await fetch(`${import.meta.env.VITE_API_URL}/api/forecast`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ parameter: param, horizon })
      });
      const data = await res.json();
      
      if (data.error) throw new Error(data.error);

      // Backend returns: historical, predictions, r2, slope_per_unit, sigma
      const ys = data.historical || [];
      const fys = data.predictions || [];
      const sigma = data.sigma;
      const intercept = ys.length > 0 ? ys[ys.length-1] : 0; // naive intercept for rendering equation
      const reg = { r2: data.r2, slope: data.slope_per_unit, intercept };
      
      const steps = horizon === "24h" ? 24 : 7;
      const unit  = horizon === "24h" ? "Hour" : "Day";
      const color = COLORS[param] || "#1D9E75";
      
      setBanner({ type:"success", text:`Forecast complete — ${steps} ${unit.toLowerCase()}s predicted (R² = ${reg.r2})` });
      setResult({ ys, fys, sigma, reg, steps, unit, color, param });
    } catch (err) {
      console.error(err);
      setBanner({ type:"error", text: err.message || "Failed to connect to forecast server." });
    }
  };

  useEffect(() => {
    if (!result || !chartRef.current) return;
    if (chartInst.current) { chartInst.current.destroy(); chartInst.current = null; }

    const { ys, fys, sigma, color, steps, unit, param: p } = result;
    const step   = Math.ceil(ys.length / 150) || 1;
    const hy     = ys.filter((_, i) => i % step === 0);
    const labels = [...hy.map((_, i) => `${i * step}`), ...fys.map((_, i) => `${unit} ${i+1}`)];
    const histData = [...hy, ...Array(steps).fill(null)];
    const foreData = [...Array(hy.length - 1).fill(null), hy[hy.length - 1], ...fys];
    const upperCI  = [...Array(hy.length).fill(null), ...fys.map(v => +(v + sigma).toFixed(4))];
    const lowerCI  = [...Array(hy.length).fill(null), ...fys.map(v => +(v - sigma).toFixed(4))];

    import("https://cdnjs.cloudflare.com/ajax/libs/Chart.js/4.4.1/chart.umd.js").then(() => {
      const Chart = window.Chart;
      chartInst.current = new Chart(chartRef.current, {
        type: "line",
        data: {
          labels,
          datasets: [
            { label:"Historical", data:histData, borderColor:color, borderWidth:2, pointRadius:0, tension:.3, fill:false },
            { label:"Forecast",   data:foreData, borderColor:color, borderWidth:2.5, borderDash:[8,5], pointRadius:4, pointBackgroundColor:"#fff", pointBorderColor:color, pointBorderWidth:2, tension:.3, fill:false },
            { label:"Upper CI",   data:upperCI,  borderColor:color+"40", borderWidth:1, pointRadius:0, fill:"+1", backgroundColor:color+"18", tension:.3 },
            { label:"Lower CI",   data:lowerCI,  borderColor:color+"40", borderWidth:1, pointRadius:0, fill:false, tension:.3 },
          ],
        },
        options: {
          responsive:true, maintainAspectRatio:false,
          interaction:{ mode:"index", intersect:false },
          plugins:{
            legend:{ display:false },
            tooltip:{ callbacks:{ label: ctx => ctx.raw === null ? null : `${ctx.dataset.label}: ${Number(ctx.raw).toFixed(4)}` } },
          },
          scales:{
            x:{ ticks:{ maxTicksLimit:14, font:{ size:10 }, autoSkip:true }, grid:{ color:"rgba(0,0,0,.04)" } },
            y:{ title:{ display:true, text:PARAM_LABELS[p], font:{ size:11 } }, ticks:{ font:{ size:10 } }, grid:{ color:"rgba(0,0,0,.04)" } },
          },
        },
      });
    });

    return () => { if (chartInst.current) { chartInst.current.destroy(); chartInst.current = null; } };
  }, [result]);

  const safe = result ? (SAFE[result.param] || [null, null]) : [null, null];

  return (
    <div style={{ display:"flex", flexDirection:"column", height:"100vh", padding:"20px 24px", gap:16, boxSizing:"border-box", overflow:"hidden" }}>

      {/* ── Header Row ── */}
      <div style={{ display:"flex", alignItems:"center", justifyContent:"space-between", flexShrink:0 }}>
        <div>
          <h1 style={{ fontSize:22, fontWeight:500, letterSpacing:"-.02em", margin:0 }}>Water Quality Forecast</h1>
          <p style={{ fontSize:12, fontFamily:"'DM Mono',monospace", color:"var(--text2)", margin:"3px 0 0" }}>Linear regression over historical data · predict next 24 hours or 7 days</p>
        </div>
        <div className={`banner banner-${banner.type}`} style={{ margin:0, padding:"8px 16px", fontSize:12 }}>
          {banner.type === "loading" && <span className="spinner-el"/>}
          <span>{banner.text}</span>
        </div>
      </div>

      {/* ── Main Two-Column Layout ── */}
      <div style={{ display:"grid", gridTemplateColumns:"300px 1fr", gap:16, flex:1, minHeight:0, overflow:"hidden" }}>

        {/* ── Left Panel ── */}
        <div style={{ display:"flex", flexDirection:"column", gap:12, overflowY:"auto" }}>

          {/* Controls */}
          <div className="card card-pad" style={{ flexShrink:0 }}>
            <div style={{ fontSize:10, fontFamily:"'DM Mono',monospace", textTransform:"uppercase", letterSpacing:".07em", color:"var(--text3)", marginBottom:14 }}>Forecast settings</div>

            <div style={{ marginBottom:14 }}>
              <label style={{ display:"block", fontSize:10, fontFamily:"'DM Mono',monospace", color:"var(--text2)", textTransform:"uppercase", letterSpacing:".06em", marginBottom:6 }}>Parameter</label>
              <select value={param} onChange={e => setParam(e.target.value)}
                style={{ width:"100%", padding:"9px 12px", background:"var(--surface2)", border:".5px solid var(--border2)", borderRadius:"var(--r-md)", fontFamily:"'DM Mono',monospace", fontSize:13, color:"var(--text)", outline:"none", cursor:"pointer" }}>
                {PARAMS.map(p => <option key={p} value={p}>{PARAM_LABELS[p]}</option>)}
              </select>
            </div>

            <div style={{ marginBottom:14 }}>
              <label style={{ display:"block", fontSize:10, fontFamily:"'DM Mono',monospace", color:"var(--text2)", textTransform:"uppercase", letterSpacing:".06em", marginBottom:8 }}>Forecast horizon</label>
              <div style={{ display:"flex", gap:8 }}>
                {[
                  { id:"24h", title:"Next 24 Hours", sub:"hourly" },
                  { id:"7d",  title:"Next 7 Days",   sub:"daily"  },
                ].map(h => (
                  <button key={h.id} onClick={() => setHorizon(h.id)}
                    style={{ flex:1, padding:"10px 8px", border:`.5px solid ${horizon===h.id?"var(--teal)":"var(--border2)"}`, borderRadius:"var(--r-md)", background:horizon===h.id?"var(--teal)":"var(--surface2)", fontFamily:"'DM Mono',monospace", fontSize:12, color:horizon===h.id?"#fff":"var(--text2)", cursor:"pointer", textAlign:"center", transition:"all .15s" }}>
                    {h.title}
                    <span style={{ fontSize:10, opacity:.8, display:"block", marginTop:2 }}>{h.sub}</span>
                  </button>
                ))}
              </div>
            </div>

            <button className="btn-teal" onClick={runForecast} disabled={banner.type === "loading"} style={{ width:"100%", padding:"10px", opacity:banner.type==="loading"?0.7:1 }}>
              {banner.type === "loading" ? "Fetching..." : "Forecast →"}
            </button>
          </div>

          {/* Equation box */}
          {result && (
            <div className="card card-pad" style={{ flexShrink:0 }}>
              <div style={{ fontSize:10, fontFamily:"'DM Mono',monospace", textTransform:"uppercase", letterSpacing:".07em", color:"var(--text3)", marginBottom:10 }}>Fitted equation</div>
              <div style={{ fontFamily:"'DM Mono',monospace", fontSize:12, color:"var(--text2)", lineHeight:1.9, background:"var(--surface2)", padding:"10px 12px", borderRadius:"var(--r-md)", borderLeft:"3px solid var(--teal)" }}>
                <span style={{ color:"var(--text)" }}>{PARAM_LABELS[result.param]}</span> = {result.reg.slope.toFixed(6)} × t + {result.reg.intercept.toFixed(4)}<br/>
                Trend: {result.reg.slope >= 0 ? "▲ increasing" : "▼ decreasing"} {Math.abs(result.reg.slope).toFixed(6)}/step<br/>
                R² = {result.reg.r2}
              </div>
            </div>
          )}

          {/* Insights */}
          {result && (
            <div className="card card-pad" style={{ flexShrink:0 }}>
              <div style={{ fontSize:10, fontFamily:"'DM Mono',monospace", textTransform:"uppercase", letterSpacing:".05em", color:"var(--text3)", marginBottom:12 }}>Key insights</div>
              <div style={{ display:"flex", flexDirection:"column", gap:9 }}>
                {[
                  { c:"#1D9E75", t:`${result.ys.length} historical records loaded. R² = ${result.reg.r2}.` },
                  { c:"#378ADD", t:`${PARAM_LABELS[result.param]} ${result.reg.slope >= 0 ? "increases ▲" : "decreases ▼"} by ${Math.abs(result.reg.slope).toFixed(4)} per step.` },
                  {
                    c: result.fys.some(v => safe[0]!==null&&(v<safe[0]||v>safe[1])) ? "#E24B4A" : "#3B6D11",
                    t: safe[0]!==null
                      ? result.fys.some(v => v<safe[0]||v>safe[1])
                        ? `⚠ ${PARAM_LABELS[result.param]} forecast to breach safe range (${safe[0]} – ${safe[1]}).`
                        : `${PARAM_LABELS[result.param]} stays within safe range (${safe[0]} – ${safe[1]}).`
                      : `No safe range defined for ${PARAM_LABELS[result.param]}.`,
                  },
                  result.reg.r2 < 0.3
                    ? { c:"#EF9F27", t:`Low R² (${result.reg.r2}): linear trend is weak. Results are indicative only.` }
                    : null,
                ].filter(Boolean).map((it, i) => (
                  <div key={i} className="insight-row">
                    <div className="ins-dot" style={{ background:it.c }}/>
                    <div className="ins-text" style={{ fontSize:12 }}>{it.t}</div>
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>

        {/* ── Right Panel ── */}
        <div style={{ display:"flex", flexDirection:"column", gap:12, minHeight:0, overflow:"hidden" }}>

          {/* Chart */}
          <div className="card card-pad" style={{ flex: result ? "0 0 44%" : 1, display:"flex", flexDirection:"column", minHeight:0 }}>
            <div style={{ display:"flex", justifyContent:"space-between", alignItems:"center", marginBottom:10, flexShrink:0 }}>
              <div style={{ fontSize:10, fontFamily:"'DM Mono',monospace", color:"var(--text2)", textTransform:"uppercase", letterSpacing:".05em" }}>
                {result ? `${PARAM_LABELS[result.param]} forecast — ${result.steps} ${result.unit}s` : "Run forecast to see chart"}
              </div>
              {result && (
                <div style={{ display:"flex", alignItems:"center", gap:16 }}>
                  {[
                    { label:"Historical",          color:result.color,      type:"solid"  },
                    { label:"Forecast",            color:result.color,      type:"dashed" },
                    { label:"Confidence Interval", color:result.color+"30", type:"band"   },
                  ].map(l => (
                    <div key={l.label} style={{ display:"flex", alignItems:"center", gap:6, fontSize:11, fontFamily:"'DM Mono',monospace", color:"var(--text2)" }}>
                      <div style={{ width:18, height:l.type==="band"?8:2, borderRadius:2, background:l.type==="dashed"?"transparent":l.color, borderTop:l.type==="dashed"?`2px dashed ${l.color}`:"none" }}/>
                      {l.label}
                    </div>
                  ))}
                  <span style={{ fontSize:11, fontFamily:"'DM Mono',monospace", padding:"3px 10px", borderRadius:20, background:"var(--teal-l)", color:"var(--teal-d)" }}>R² {result.reg.r2}</span>
                </div>
              )}
            </div>
            <div style={{ flex:1, position:"relative", minHeight:0 }}>
              <canvas ref={chartRef} style={{ position:"absolute", inset:0, width:"100%", height:"100%" }}/>
            </div>
          </div>

          {/* Forecast Table */}
          {result && (
            <div className="card card-pad" style={{ flex:1, display:"flex", flexDirection:"column", minHeight:0, overflow:"hidden" }}>
              <div style={{ fontSize:10, fontFamily:"'DM Mono',monospace", color:"var(--text2)", textTransform:"uppercase", letterSpacing:".05em", marginBottom:12, flexShrink:0 }}>
                Forecast table
              </div>
              <div style={{ flex:1, overflowY:"auto", overflowX:"auto" }}>
                <table style={{ width:"100%" }}>
                  <thead>
                    <tr>
                      <th>{result.unit}</th>
                      <th>Predicted {PARAM_LABELS[result.param]}</th>
                      <th>Lower (−σ)</th>
                      <th>Upper (+σ)</th>
                      <th>Safe Range</th>
                      <th>Status</th>
                      <th>Change from {result.unit} 1</th>
                    </tr>
                  </thead>
                  <tbody>
                    {result.fys.map((v, i) => {
                      const lo = (v - result.sigma).toFixed(3);
                      const hi = (v + result.sigma).toFixed(3);
                      const safeStr = safe[0] !== null ? `${safe[0]} – ${safe[1]}` : "—";
                      const base = result.fys[0];
                      const chg = i === 0 ? null : +((v - base) / Math.abs(base + 1e-9) * 100).toFixed(2);
                      let tagClass = "tag-safe", tagLabel = "Safe";
                      if (safe[0] !== null) {
                         if (v < safe[0] || v > safe[1]) { tagClass="tag-bad";  tagLabel="Out of range"; }
                         else if (v < safe[0]+.08*(safe[1]-safe[0]) || v > safe[1]-.08*(safe[1]-safe[0])) { tagClass="tag-warn"; tagLabel="Borderline"; }
                      }
                      return (
                        <tr key={i}>
                          <td>{result.unit} {i+1}</td>
                          <td><strong>{v.toFixed(4)}</strong></td>
                          <td>{lo}</td><td>{hi}</td>
                          <td>{safeStr}</td>
                          <td><span className={`tag ${tagClass}`}>{tagLabel}</span></td>
                          <td style={{ color:chg===null?"var(--text3)":chg>=0?"#3B6D11":"#A32D2D" }}>
                            {chg === null ? "baseline" : `${chg >= 0 ? "+" : ""}${chg}%`}
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}