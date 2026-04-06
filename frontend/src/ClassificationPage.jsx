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
  const [result,   setResult]   = useState(null);
  const [loading,  setLoading]  = useState(false);
  const [cameraActive, setCameraActive] = useState(false);
  const inputRef  = useRef(null);
  const cameraRef = useRef(null);
  const videoRef = useRef(null);

  const startCamera = async () => {
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ video: { facingMode: "environment" } });
      setCameraActive(true);
      setTimeout(() => {
        if (videoRef.current) {
          videoRef.current.srcObject = stream;
          videoRef.current.play().catch(e => console.error(e));
        }
      }, 50);
    } catch (err) {
      console.error("Camera access error:", err);
      // Fallback
      cameraRef.current?.click();
    }
  };

  const stopCamera = () => {
    if (videoRef.current && videoRef.current.srcObject) {
      videoRef.current.srcObject.getTracks().forEach(t => t.stop());
    }
    setCameraActive(false);
  };

  const snapPhoto = () => {
    if (!videoRef.current) return;
    const canvas = document.createElement("canvas");
    canvas.width = videoRef.current.videoWidth;
    canvas.height = videoRef.current.videoHeight;
    const ctx = canvas.getContext("2d");
    ctx.drawImage(videoRef.current, 0, 0);
    canvas.toBlob((blob) => {
      if (blob) {
        const file = new File([blob], "camera_capture.png", { type: "image/png" });
        stopCamera();
        handleFile(file);
      }
    }, "image/png");
  };

  const handleFile = async (file) => {
    if (!file || !file.type.startsWith("image/")) return;
    const reader = new FileReader();
    reader.onload = e => {
      setImgSrc(e.target.result);
      setFilename(file.name);
      setFileInfo(`${(file.size / 1024).toFixed(1)} KB · ${file.type}`);
    };
    reader.readAsDataURL(file);

    setLoading(true);
    setResult(null);
    try {
      const formData = new FormData();
      formData.append("file", file);
      const res = await fetch("http://127.0.0.1:5000/predict", {
        method: "POST",
        body: formData
      });
      const data = await res.json();
      setResult(data);
    } catch (err) {
      console.error(err);
      setResult({ error: "Failed to connect to the prediction server." });
    } finally {
      setLoading(false);
    }
  };

  const clearImage = () => {
    setImgSrc(null);
    setFilename("");
    setFileInfo("");
    setResult(null);
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

        {/* ── Camera View ── */}
        {cameraActive && (
          <div style={{ flex:1, display:"flex", flexDirection:"column", alignItems:"center", justifyContent:"center", padding:40, background:"#111" }}>
            <div style={{ position:"relative", width:"100%", maxWidth:600, borderRadius:"var(--r-xl)", overflow:"hidden", background:"#000", border:"1px solid #333", boxShadow:"0 10px 40px rgba(0,0,0,0.5)" }}>
              <video ref={videoRef} style={{ width:"100%", display:"block" }} playsInline muted />
            </div>
            <div style={{ display:"flex", gap:16, marginTop:24 }}>
              <button
                onClick={stopCamera}
                style={{ padding:"12px 24px", background:"#333", color:"#fff", borderRadius:"var(--r-md)", fontFamily:"'DM Mono',monospace", fontSize:13, border:"1px solid #444", cursor:"pointer", transition:"background .15s" }}
              >
                Cancel
              </button>
              <button
                onClick={snapPhoto}
                style={{ padding:"12px 24px", background:"var(--teal)", color:"#fff", borderRadius:"var(--r-md)", fontFamily:"'DM Mono',monospace", fontSize:13, border:"none", cursor:"pointer", transition:"background .15s" }}
              >
                📸 Snap Photo
              </button>
            </div>
          </div>
        )}

        {/* ── No image: centered drop zone ── */}
        {!imgSrc && !cameraActive && (
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

                <div style={{ display:"flex", gap:12, justifyContent:"center" }}>
                  <button
                    onClick={e => { e.stopPropagation(); inputRef.current?.click(); }}
                    style={{ padding:"10px 24px", background:"var(--teal)", color:"#fff", borderRadius:"var(--r-md)", fontFamily:"'DM Mono',monospace", fontSize:13, border:"none", cursor:"pointer", transition:"background .15s" }}
                  >
                    Choose image
                  </button>

                  <button
                    onClick={e => { e.stopPropagation(); startCamera(); }}
                    style={{ padding:"10px 24px", background:"var(--teal)", color:"#fff", borderRadius:"var(--r-md)", fontFamily:"'DM Mono',monospace", fontSize:13, border:"none", cursor:"pointer", transition:"background .15s" }}
                  >
                    📷 Take photo
                  </button>
                </div>

                <input ref={inputRef} type="file" accept="image/*" style={{ display:"none" }}
                  onChange={e => handleFile(e.target.files[0])}/>
                <input ref={cameraRef} type="file" accept="image/*" capture="environment" style={{ display:"none" }}
                  onChange={e => handleFile(e.target.files[0])}/>
              </div>
            </div>
          </div>
        )}

        {/* ── Image loaded: full-height preview with results side-by-side ── */}
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
                  onClick={startCamera}
                  style={{ padding:"6px 16px", background:"transparent", border:".5px solid var(--border2)", borderRadius:"var(--r-md)", fontFamily:"'DM Mono',monospace", fontSize:12, color:"var(--teal)", cursor:"pointer" }}
                >
                  📷 Camera
                </button>
                <button
                  onClick={() => inputRef.current?.click()}
                  style={{ padding:"6px 16px", background:"transparent", border:".5px solid var(--border2)", borderRadius:"var(--r-md)", fontFamily:"'DM Mono',monospace", fontSize:12, color:"var(--text2)", cursor:"pointer" }}
                >
                  Replace
                </button>
                <button
                  onClick={clearImage}
                  style={{ padding:"6px 16px", background:"transparent", border:".5px solid var(--border2)", borderRadius:"var(--r-md)", fontFamily:"'DM Mono',monospace", fontSize:12, color:"var(--text2)", cursor:"pointer" }}
                >
                  Remove
                </button>
              </div>
              <input ref={inputRef} type="file" accept="image/*" style={{ display:"none" }}
                onChange={e => handleFile(e.target.files[0])}/>
              <input ref={cameraRef} type="file" accept="image/*" capture="environment" style={{ display:"none" }}
                onChange={e => handleFile(e.target.files[0])}/>
            </div>

            {/* Split view: Image & Results */}
            <div style={{ flex:1, display:"grid", gridTemplateColumns:"1fr 340px", minHeight:0 }}>
              <div style={{ flex:1, display:"flex", alignItems:"center", justifyContent:"center", background:"var(--surface2)", overflow:"hidden", padding:20 }}>
                <img
                  src={imgSrc}
                  alt="Preview"
                  style={{ maxWidth:"100%", maxHeight:"100%", objectFit:"contain", display:"block", borderRadius:8, boxShadow:"0 4px 20px rgba(0,0,0,0.05)" }}
                />
              </div>

              {/* Results sidebar */}
              <div style={{ borderLeft:".5px solid var(--border)", padding:24, overflowY:"auto", background:"var(--surface)" }}>
                <div style={{ fontSize:10, fontFamily:"'DM Mono',monospace", textTransform:"uppercase", letterSpacing:".08em", color:"var(--text3)", marginBottom:14 }}>
                  Analysis Status
                </div>
                
                {loading && (
                  <div style={{ display:"flex", alignItems:"center", gap:12, color:"var(--teal)", fontFamily:"'DM Mono',monospace", fontSize:13 }}>
                    <span className="spinner-el" style={{ borderTopColor:"var(--teal)" }}></span>
                    Classifying...
                  </div>
                )}

                {result?.error && (
                  <div style={{ background:"#FFF5F5", padding:14, borderRadius:"var(--r-md)", borderLeft:"3px solid var(--red)", fontSize:13, color:"--text", fontFamily:"'DM Mono',monospace" }}>
                    <div style={{ fontWeight:500, color:"#A32D2D", marginBottom:4 }}>Error</div>
                    {result.error}
                  </div>
                )}

                {result && !result.error && (
                  <div className="fade-up">
                    <div style={{ background:"rgba(29,158,117,.04)", padding:16, borderRadius:"var(--r-md)", border:"1px solid rgba(29,158,117,.15)", marginBottom:20 }}>
                      <div style={{ fontSize:10, fontFamily:"'DM Mono',monospace", textTransform:"uppercase", letterSpacing:".08em", color:"var(--teal)", marginBottom:6 }}>Predicted Class</div>
                      <div style={{ fontSize:22, fontWeight:500, color:"var(--text)" }}>
                        {result.result.split('(')[0].trim()}
                      </div>
                      <div style={{ fontSize:12, fontFamily:"'DM Mono',monospace", color:"var(--text2)", marginTop:4 }}>
                        Confidence: {result.result.match(/\((.*?)\)/)?.[1] || "N/A"}
                      </div>
                    </div>

                    <div style={{ fontSize:10, fontFamily:"'DM Mono',monospace", textTransform:"uppercase", letterSpacing:".08em", color:"var(--text3)", marginBottom:10 }}>
                      Top Probabilities
                    </div>
                    <div style={{ display:"flex", flexDirection:"column", gap:8 }}>
                      {result.top3?.map((t, idx) => (
                        <div key={idx} style={{ display:"flex", justifyContent:"space-between", background:"var(--surface2)", padding:"10px 14px", borderRadius:"var(--r-sm)", fontFamily:"'DM Mono',monospace", fontSize:12 }}>
                          <span>{t.class}</span>
                          <span style={{ fontWeight:500, color:"var(--teal)" }}>{t.confidence}</span>
                        </div>
                      ))}
                    </div>

                    <div style={{ marginTop:24, paddingTop:16, borderTop:".5px solid var(--border)", fontSize:11, fontFamily:"'DM Mono',monospace", color:"var(--text3)" }}>
                      Models used: {result.models_used}
                    </div>
                  </div>
                )}
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}