import React from "react";
import { useState, useRef } from "react";

const WATER_TYPES = [
  { label:"Clean Water",      color:"#58a6ff" },
  { label:"Muddy Water",      color:"#8b6914" },
  { label:"River Water",      color:"#1D9E75" },
  { label:"Polluted Water",   color:"#8b4513" },
  { label:"Industrial Waste", color:"#6e5494" },
  { label:"Fish Pond",        color:"#2d7d46" },
  { label:"Sea Water",        color:"#0077b6" },
  { label:"Lake Water",       color:"#457b9d" },
];

export default function ClassificationPage() {
  const [imgSrc,   setImgSrc]   = useState(null);
  const [filename, setFilename] = useState("");
  const [fileInfo, setFileInfo] = useState("");
  const [dragging, setDragging] = useState(false);
  const inputRef = useRef(null);

  const handleFile = (file) => {
    if (!file || !file.type.startsWith("image/")) return;
    const reader = new FileReader();
    reader.onload = e => {
      setImgSrc(e.target.result);
      setFilename(file.name);
      setFileInfo(`${(file.size / 1024).toFixed(1)} KB · ${file.type}`);
    };
    reader.readAsDataURL(file);
  };

  const clearImage = () => {
    setImgSrc(null);
    setFilename("");
    setFileInfo("");
    if (inputRef.current) inputRef.current.value = "";
  };

  return (
    <div style={{ display:"flex", height:"100vh", boxSizing:"border-box", overflow:"hidden" }}>

      {/* ── Left Panel — branding + info ── */}
      <div style={{ width:320, flexShrink:0, display:"flex", flexDirection:"column", padding:"36px 28px", borderRight:".5px solid var(--border)", overflow:"hidden", background:"var(--surface2)" }}>

        {/* Badge */}
        <div style={{ fontSize:10, fontFamily:"'DM Mono',monospace", textTransform:"uppercase", letterSpacing:".14em", color:"var(--teal)", marginBottom:20 }}>
          ML · Image Classification
        </div>

        {/* Title */}
        <h1 style={{ fontSize:28, fontWeight:300, letterSpacing:"-.02em", lineHeight:1.2, marginBottom:12, margin:"0 0 12px" }}>
          Identify your{" "}
          <em style={{ fontStyle:"italic", color:"var(--teal)" }}>water type</em>
        </h1>

        <p style={{ fontSize:12, fontFamily:"'DM Mono',monospace", color:"var(--text2)", lineHeight:1.8, margin:"0 0 28px" }}>
          Upload a water image — the model classifies it into one of 8 categories using a trained convolutional neural network.
        </p>

        {/* Divider */}
        <div style={{ height:".5px", background:"var(--border)", marginBottom:24 }}/>

        {/* Classes label */}
        <div style={{ fontSize:10, fontFamily:"'DM Mono',monospace", textTransform:"uppercase", letterSpacing:".08em", color:"var(--text3)", marginBottom:14 }}>
          Supported classes
        </div>

        {/* Water type list */}
        <div style={{ display:"flex", flexDirection:"column", gap:8 }}>
          {WATER_TYPES.map(t => (
            <div key={t.label}
              style={{ display:"flex", alignItems:"center", gap:10, padding:"9px 12px", borderRadius:"var(--r-md)", border:".5px solid var(--border)", background:"var(--surface)", fontSize:12, fontFamily:"'DM Mono',monospace", color:"var(--text2)" }}>
              <div style={{ width:9, height:9, borderRadius:"50%", background:t.color, flexShrink:0 }}/>
              {t.label}
            </div>
          ))}
        </div>

        <div style={{ marginTop:16, fontSize:11, fontFamily:"'DM Mono',monospace", color:"var(--text3)", lineHeight:1.7 }}>
          Supports JPG · PNG · WEBP · BMP
        </div>
      </div>

      {/* ── Right Panel — upload / preview ── */}
      <div style={{ flex:1, display:"flex", flexDirection:"column", overflow:"hidden" }}>

        {/* ── No image: centered drop zone ── */}
        {!imgSrc && (
          <div style={{ flex:1, display:"flex", alignItems:"center", justifyContent:"center", padding:40 }}>
            <div style={{ width:"100%", maxWidth:560 }}>
              <div
                onClick={() => inputRef.current?.click()}
                onDragOver={e => { e.preventDefault(); setDragging(true); }}
                onDragLeave={() => setDragging(false)}
                onDrop={e => { e.preventDefault(); setDragging(false); handleFile(e.dataTransfer.files[0]); }}
                style={{
                  border:`1.5px dashed ${dragging ? "var(--teal)" : "var(--border2)"}`,
                  borderRadius:"var(--r-xl)", padding:"5rem 2rem", textAlign:"center",
                  background: dragging ? "rgba(29,158,117,.04)" : "var(--surface)",
                  cursor:"pointer", transition:"border-color .2s, background .2s",
                }}
              >
                <div style={{ margin:"0 auto 20px", width:64, height:64, borderRadius:"50%", background:dragging?"var(--teal-l)":"var(--surface2)", border:`.5px solid ${dragging?"var(--teal)":"var(--border2)"}`, display:"flex", alignItems:"center", justifyContent:"center", transition:"all .2s" }}>
                  <svg width="26" height="26" viewBox="0 0 24 24" fill="none">
                    <path d="M12 16V8M8 12l4-4 4 4" stroke="#1D9E75" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"/>
                    <path d="M3 16v1a4 4 0 0 0 4 4h10a4 4 0 0 0 4-4v-1" stroke="#8b949e" strokeWidth="1.5" strokeLinecap="round"/>
                  </svg>
                </div>

                <div style={{ fontSize:20, fontWeight:300, color:"var(--text)", marginBottom:8 }}>Drop your water image here</div>
                <div style={{ fontSize:13, fontFamily:"'DM Mono',monospace", color:"var(--text2)", marginBottom:22 }}>or browse from your device</div>

                <button
                  onClick={e => { e.stopPropagation(); inputRef.current?.click(); }}
                  style={{ display:"inline-block", padding:"10px 28px", background:"var(--teal)", color:"#fff", borderRadius:"var(--r-md)", fontFamily:"'DM Mono',monospace", fontSize:13, border:"none", cursor:"pointer", transition:"background .15s" }}
                  onMouseOver={e => e.target.style.background = "var(--teal-d)"}
                  onMouseOut={e  => e.target.style.background = "var(--teal)"}
                >
                  Choose image
                </button>

                <input ref={inputRef} type="file" accept="image/*" style={{ display:"none" }}
                  onChange={e => handleFile(e.target.files[0])}/>
              </div>
            </div>
          </div>
        )}

        {/* ── Image loaded: full-height preview ── */}
        {imgSrc && (
          <div style={{ flex:1, display:"flex", flexDirection:"column", overflow:"hidden" }}>

            {/* Top bar */}
            <div style={{ display:"flex", alignItems:"center", justifyContent:"space-between", padding:"14px 24px", borderBottom:".5px solid var(--border)", flexShrink:0 }}>
              <div>
                <div style={{ fontSize:13, fontFamily:"'DM Mono',monospace", color:"var(--text)" }}>{filename}</div>
                <div style={{ fontSize:11, fontFamily:"'DM Mono',monospace", color:"var(--text3)" }}>{fileInfo}</div>
              </div>
              <div style={{ display:"flex", gap:10 }}>
                <button
                  onClick={() => inputRef.current?.click()}
                  style={{ padding:"6px 16px", background:"transparent", border:".5px solid var(--border2)", borderRadius:"var(--r-md)", fontFamily:"'DM Mono',monospace", fontSize:12, color:"var(--text2)", cursor:"pointer" }}
                >
                  Replace
                </button>
                <button
                  onClick={clearImage}
                  style={{ padding:"6px 16px", background:"transparent", border:".5px solid var(--border2)", borderRadius:"var(--r-md)", fontFamily:"'DM Mono',monospace", fontSize:12, color:"var(--text2)", cursor:"pointer", transition:"border-color .15s, color .15s" }}
                  onMouseOver={e => { e.currentTarget.style.borderColor="rgba(226,75,74,.6)"; e.currentTarget.style.color="#E24B4A"; }}
                  onMouseOut={e  => { e.currentTarget.style.borderColor="var(--border2)";      e.currentTarget.style.color="var(--text2)"; }}
                >
                  Remove
                </button>
              </div>
              <input ref={inputRef} type="file" accept="image/*" style={{ display:"none" }}
                onChange={e => handleFile(e.target.files[0])}/>
            </div>

            {/* Image — fills remaining height */}
            <div style={{ flex:1, display:"flex", alignItems:"center", justifyContent:"center", background:"var(--surface2)", overflow:"hidden" }}>
              <img
                src={imgSrc}
                alt="Preview"
                style={{ maxWidth:"100%", maxHeight:"100%", objectFit:"contain", display:"block" }}
              />
            </div>
          </div>
        )}
      </div>
    </div>
  );
}