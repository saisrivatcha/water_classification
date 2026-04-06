import React from "react";
import { useState, useEffect, useRef } from "react";

// Updated PARAMS based on backend columns
const PARAMS = ["pH", "conductivity", "dissolved_oxygen", "temperature"];

const PARAM_LABELS = {
  pH: "pH",
  conductivity: "Conductivity",
  dissolved_oxygen: "Dissolved Oxygen",
  temperature: "Temperature",
};

export default function AnomalyPage() {
  const [param,     setParam]     = useState("pH");
  const [threshold, setThreshold] = useState(2.5);
  const [topN,      setTopN]      = useState(50);
  const [banner,    setBanner]    = useState({ type:"success", text:"Ready. Configure settings and run detection." });
  const [result,    setResult]    = useState(null);
  const chartRef  = useRef(null);
  const chartInst = useRef(null);

  const runDetection = async () => {
    setBanner({ type:"loading", text:"Fetching anomalies from server..." });
    try {
      const res = await fetch("http://127.0.0.1:5000/api/anomaly_batch", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ parameter: param, threshold })
      });
      const data = await res.json();
      if (data.error) throw new Error(data.error);

      // Backend returns mu, sigma, scored (all items), anomalies (filtered)
      setBanner({ type:"success", text:`${data.scored.length} rows analysed — ${data.anomalies.length} anomalies found at ±${threshold}σ` });
      setResult({ ...data, param });
    } catch (err) {
      console.error(err);
      setBanner({ type:"error", text: err.message || "Failed to fetch anomalies" });
    }
  };

  useEffect(() => {
    if (!result || !chartRef.current) return;
    if (chartInst.current) { chartInst.current.destroy(); chartInst.current = null; }

    const { scored } = result;
    const step     = Math.ceil(scored.length / 300) || 1;
    const sampled  = scored.filter((_, i) => i % step === 0);
    const labels   = sampled.map(r => `Row ${r.rowNum}`);
    const zVals    = sampled.map(r => +r.z.toFixed(3));
    const colors   = sampled.map(r => Math.abs(r.z) > threshold ? "#E24B4A" : "rgba(55,138,221,0.35)");
    const upperT   = sampled.map(() =>  threshold);
    const lowerT   = sampled.map(() => -threshold);

    import("https://cdnjs.cloudflare.com/ajax/libs/Chart.js/4.4.1/chart.umd.js").then(() => {
      const Chart = window.Chart;
      chartInst.current = new Chart(chartRef.current, {
        type: "bar",
        data: {
          labels,
          datasets: [
            { label:"Z-score", data:zVals, backgroundColor:colors, borderColor:colors, borderWidth:1, borderRadius:2 },
            { label:"Upper threshold", data:upperT, type:"line", borderColor:"#E24B4A", borderWidth:1.5, borderDash:[6,4], pointRadius:0, fill:false, tension:0 },
            { label:"Lower threshold", data:lowerT, type:"line", borderColor:"#E24B4A", borderWidth:1.5, borderDash:[6,4], pointRadius:0, fill:false, tension:0 },
          ],
        },
        options: {
          responsive:true, maintainAspectRatio:false,
          plugins:{
            legend:{ display:false },
            tooltip:{ callbacks:{ label: ctx => {
              if (ctx.datasetIndex > 0) return null;
              return `Z = ${ctx.raw} ${Math.abs(ctx.raw) > threshold ? "⚠ ANOMALY" : ""}`;
            }}},
          },
          scales:{
            x:{ ticks:{ maxTicksLimit:14, font:{ size:10 }, autoSkip:true }, grid:{ display:false } },
            y:{ title:{ display:true, text:"Z-score", font:{ size:11 } }, ticks:{ font:{ size:10 } }, grid:{ color:"rgba(0,0,0,.04)" } },
          },
        },
      });
    });

    return () => { if (chartInst.current) { chartInst.current.destroy(); chartInst.current = null; } };
  }, [result]);

  return (
    <div style={{ display:"flex", flexDirection:"column", height:"100vh", padding:"20px 24px", gap:16, boxSizing:"border-box", overflow:"hidden" }}>

      {/* ── Header Row ── */}
      <div style={{ display:"flex", alignItems:"center", justifyContent:"space-between", flexShrink:0 }}>
        <div>
          <h1 style={{ fontSize:22, fontWeight:500, letterSpacing:"-.02em", margin:0 }}>Anomaly Detection</h1>
          <p style={{ fontSize:12, fontFamily:"'DM Mono',monospace", color:"var(--text2)", margin:"3px 0 0" }}>Z-score method · flags values deviating beyond threshold</p>
        </div>
        <div className={`banner banner-${banner.type}`} style={{ margin:0, padding:"8px 16px", fontSize:12 }}>
          {banner.type === "loading" && <span className="spinner-el"/>}
          <span>{banner.text}</span>
        </div>
      </div>

      {/* ── Main Two-Column Layout ── */}
      <div style={{ display:"grid", gridTemplateColumns:"300px 1fr", gap:16, flex:1, minHeight:0, overflow:"hidden" }}>

        {/* ── Left Panel ── */}
        <div style={{ display:"flex", flexDirection:"column", gap:12, overflow:"auto" }}>

          {/* Formula */}
          <div className="card card-pad" style={{ flexShrink:0 }}>
            <div style={{ fontSize:10, fontFamily:"'DM Mono',monospace", textTransform:"uppercase", letterSpacing:".07em", color:"var(--text3)", marginBottom:10 }}>Z-score formula</div>
            <div style={{ fontSize:20, fontFamily:"'DM Mono',monospace", fontWeight:500, background:"var(--surface2)", padding:"10px 16px", borderRadius:"var(--r-md)", borderLeft:"3px solid var(--red)", marginBottom:10 }}>
              Z = (X − μ) / σ
            </div>
            <div style={{ fontSize:12, fontFamily:"'DM Mono',monospace", color:"var(--text2)", lineHeight:1.9 }}>
              <span style={{ display:"block" }}><strong>X</strong> = observed value</span>
              <span style={{ display:"block" }}><strong>μ</strong> = mean of the parameter</span>
              <span style={{ display:"block" }}><strong>σ</strong> = standard deviation</span>
              <span style={{ display:"block" }}><strong>|Z| &gt; threshold</strong> = anomaly flagged</span>
            </div>
          </div>

          {/* Controls */}
          <div className="card card-pad" style={{ flexShrink:0 }}>
            <div style={{ fontSize:10, fontFamily:"'DM Mono',monospace", textTransform:"uppercase", letterSpacing:".07em", color:"var(--text3)", marginBottom:14 }}>Detection settings</div>
            <div style={{ display:"flex", flexDirection:"column", gap:12 }}>
              <div>
                <label style={{ display:"block", fontSize:10, fontFamily:"'DM Mono',monospace", color:"var(--text2)", textTransform:"uppercase", letterSpacing:".06em", marginBottom:5 }}>Parameter</label>
                <select value={param} onChange={e => setParam(e.target.value)}
                  style={{ width:"100%", padding:"9px 12px", background:"var(--surface2)", border:".5px solid var(--border2)", borderRadius:"var(--r-md)", fontFamily:"'DM Mono',monospace", fontSize:13, color:"var(--text)", outline:"none" }}>
                  {PARAMS.map(p => <option key={p} value={p}>{PARAM_LABELS[p]}</option>)}
                </select>
              </div>
              <div>
                <label style={{ display:"block", fontSize:10, fontFamily:"'DM Mono',monospace", color:"var(--text2)", textTransform:"uppercase", letterSpacing:".06em", marginBottom:5 }}>Z-score threshold</label>
                <input type="number" value={threshold} min={1} max={5} step={0.1}
                  onChange={e => setThreshold(parseFloat(e.target.value))}
                  style={{ width:"100%", padding:"9px 12px", background:"var(--surface2)", border:".5px solid var(--border2)", borderRadius:"var(--r-md)", fontFamily:"'DM Mono',monospace", fontSize:13, color:"var(--text)", outline:"none", boxSizing:"border-box" }}/>
              </div>
              <div>
                <label style={{ display:"block", fontSize:10, fontFamily:"'DM Mono',monospace", color:"var(--text2)", textTransform:"uppercase", letterSpacing:".06em", marginBottom:5 }}>Show top N anomalies</label>
                <input type="number" value={topN} min={5} max={500} step={5}
                  onChange={e => setTopN(parseInt(e.target.value))}
                  style={{ width:"100%", padding:"9px 12px", background:"var(--surface2)", border:".5px solid var(--border2)", borderRadius:"var(--r-md)", fontFamily:"'DM Mono',monospace", fontSize:13, color:"var(--text)", outline:"none", boxSizing:"border-box" }}/>
              </div>
              <button className="btn-red" onClick={runDetection} disabled={banner.type === "loading"} style={{ width:"100%", padding:"10px", opacity:banner.type==="loading"?0.7:1 }}>
                {banner.type === "loading" ? "Detecting..." : "Detect →"}
              </button>
            </div>
          </div>

          {/* Summary Cards — stacked 2×2 */}
          {result && (
            <div style={{ display:"grid", gridTemplateColumns:"1fr 1fr", gap:8, flexShrink:0 }}>
              {[
                { lbl:"Total Rows",    val:result.scored.length,                                                        sub:"records analysed" },
                { lbl:"Anomalies",     val:result.anomalies.length,                                                     sub:`≥ ±${threshold}σ`  },
                { lbl:"Anomaly Rate",  val:((result.anomalies.length/result.scored.length)*100).toFixed(1)+"%",         sub:"of dataset"        },
                { lbl:"Worst Z",       val:result.anomalies.length ? Math.abs(result.anomalies[0].z).toFixed(2) : "—", sub:"absolute value"    },
              ].map(c => (
                <div key={c.lbl} className="card" style={{ padding:"12px 14px" }}>
                  <div style={{ fontSize:9, fontFamily:"'DM Mono',monospace", color:"var(--text3)", textTransform:"uppercase", letterSpacing:".06em", marginBottom:5 }}>{c.lbl}</div>
                  <div style={{ fontSize:22, fontWeight:400, lineHeight:1 }}>{c.val}</div>
                  <div style={{ fontSize:10, fontFamily:"'DM Mono',monospace", color:"var(--text2)", marginTop:4 }}>{c.sub}</div>
                </div>
              ))}
            </div>
          )}

          {/* Insights */}
          {result && (
            <div className="card card-pad" style={{ flexShrink:0 }}>
              <div style={{ fontSize:10, fontFamily:"'DM Mono',monospace", color:"var(--text2)", textTransform:"uppercase", letterSpacing:".05em", marginBottom:12 }}>Insights</div>
              <div style={{ display:"flex", flexDirection:"column", gap:9 }}>
                {[
                  { c:"#1D9E75", t:`${result.scored.length} rows. Mean: ${result.mu.toFixed(3)} · σ: ${result.sigma.toFixed(3)} · ±${threshold}σ` },
                  { c:"#E24B4A", t:`${result.anomalies.length} anomalies (${((result.anomalies.length/result.scored.length)*100).toFixed(1)}%). ${result.anomalies.filter(r=>Math.abs(r.z)>4).length} extreme, ${result.anomalies.filter(r=>Math.abs(r.z)>3&&Math.abs(r.z)<=4).length} high.` },
                  { c:"#378ADD", t:`${result.anomalies.filter(r=>r.z>0).length} above mean, ${result.anomalies.filter(r=>r.z<0).length} below mean.` },
                  ...(result.anomalies.length ? [{ c:"#E24B4A", t:`Worst: Row ${result.anomalies[0].rowNum} — Z = ${result.anomalies[0].z.toFixed(3)}` }] : []),
                ].map((it, i) => (
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

          {/* Chart — grows to fill */}
          <div className="card card-pad" style={{ flex:result ? "0 0 45%" : 1, display:"flex", flexDirection:"column", minHeight:0 }}>
            <div style={{ display:"flex", justifyContent:"space-between", alignItems:"center", marginBottom:12, flexShrink:0 }}>
              <div style={{ fontSize:10, fontFamily:"'DM Mono',monospace", color:"var(--text2)", textTransform:"uppercase", letterSpacing:".05em" }}>
                {result ? `Z-score chart — ${PARAM_LABELS[result.param]} (${result.anomalies.length} anomalies)` : "Run detection to see chart"}
              </div>
              {result && (
                <span style={{ fontSize:11, fontFamily:"'DM Mono',monospace", padding:"3px 10px", borderRadius:20, background:"var(--red-l)", color:"#791F1F" }}>
                  threshold ±{threshold}
                </span>
              )}
            </div>
            <div style={{ flex:1, position:"relative", minHeight:0 }}>
              <canvas ref={chartRef} style={{ position:"absolute", inset:0, width:"100%", height:"100%" }}/>
            </div>
          </div>

          {/* Anomaly Table — scrollable, fills remainder */}
          {result && (
            <div className="card card-pad" style={{ flex:1, display:"flex", flexDirection:"column", minHeight:0, overflow:"hidden" }}>
              <div style={{ display:"flex", justifyContent:"space-between", alignItems:"center", marginBottom:12, flexShrink:0 }}>
                <div style={{ fontSize:10, fontFamily:"'DM Mono',monospace", color:"var(--text2)", textTransform:"uppercase", letterSpacing:".05em" }}>
                  Anomaly table — top {Math.min(topN, result.anomalies.length)} of {result.anomalies.length}
                </div>
              </div>
              <div style={{ flex:1, overflowY:"auto", overflowX:"auto" }}>
                {result.anomalies.length === 0 ? (
                  <p style={{ fontSize:13, fontFamily:"'DM Mono',monospace", color:"var(--text3)" }}>
                    No anomalies found. Try lowering the threshold.
                  </p>
                ) : (
                  <table style={{ width:"100%" }}>
                    <thead>
                      <tr><th>Row #</th><th>Value</th><th>Z-score</th><th>|Z|</th><th>Severity</th><th>Direction</th></tr>
                    </thead>
                    <tbody>
                      {result.anomalies.slice(0, topN).map((r, i) => {
                        const absZ = Math.abs(r.z);
                        let sevClass = "tag-warn", sevLabel = "Mild";
                        if (absZ > 4)      { sevClass = "tag-bad"; sevLabel = "Extreme"; }
                        else if (absZ > 3) { sevClass = "tag-bad"; sevLabel = "High"; }
                        return (
                          <tr key={i} style={{ background:"#FFF5F5" }}>
                            <td>{r.rowNum}</td>
                            <td><strong>{r.value.toFixed(4)}</strong></td>
                            <td style={{ color:absZ>3?"#E24B4A":absZ>2?"#EF9F27":"#3B6D11", fontWeight:500 }}>{r.z.toFixed(3)}</td>
                            <td>{absZ.toFixed(3)}</td>
                            <td><span className={`tag ${sevClass}`}>{sevLabel}</span></td>
                            <td style={{ color:r.z>0?"#E24B4A":"#378ADD" }}>{r.z > 0 ? "▲ Above mean" : "▼ Below mean"}</td>
                          </tr>
                        );
                      })}
                    </tbody>
                  </table>
                )}
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}