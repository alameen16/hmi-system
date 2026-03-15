import { useState, useEffect, useRef } from "react";

// ─── Initial circuit state ───────────────────────────────────────────────────
// This represents a simplified single-line electrical distribution circuit:
// Power Source → Main Breaker → Bus Bar → Three branch loads (Motor, Lighting, HVAC)
// Each component has an id, label, type, and state (energized, tripped, off)

const INITIAL_CIRCUIT = {
  source: { id: "source", label: "Grid Supply", voltage: "11kV", energized: true },
  transformer: { id: "transformer", label: "Step-Down Transformer", ratio: "11kV / 415V", energized: true },
  mainBreaker: { id: "mainBreaker", label: "Main Circuit Breaker", closed: true, tripped: false },
  busbar: { id: "busbar", label: "415V Bus Bar", energized: true },
  branches: [
    { id: "b1", label: "Motor Load", type: "Motor", breaker: true, tripped: false, load: "15kW", on: true },
    { id: "b2", label: "Lighting Panel", type: "Lighting", breaker: true, tripped: false, load: "8kW", on: true },
    { id: "b3", label: "HVAC Unit", type: "HVAC", breaker: true, tripped: false, load: "12kW", on: true },
  ],
};

// Fault types an operator might simulate on the panel
const FAULT_TYPES = ["Overload", "Short Circuit", "Earth Fault", "Under Voltage"];

// ─── Utility: compute total load ─────────────────────────────────────────────
function getTotalLoad(branches) {
  return branches
    .filter(b => b.on && !b.tripped)
    .reduce((sum, b) => sum + parseFloat(b.load), 0);
}

// ─── LED indicator component ──────────────────────────────────────────────────
// Mimics the physical LED indicator lamps found on real HMI panels
function LED({ on, color = "#10b981", label, pulse = false }) {
  return (
    <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
      <div style={{
        width: 12, height: 12, borderRadius: "50%",
        background: on ? color : "#1a2332",
        border: `1px solid ${on ? color : "#2a3a4a"}`,
        boxShadow: on ? `0 0 6px ${color}, 0 0 12px ${color}44` : "none",
        animation: pulse && on ? "ledPulse 1s ease-in-out infinite" : "none",
        flexShrink: 0,
      }} />
      {label && <span style={{ fontSize: 11, color: "rgba(255,255,255,0.45)", fontFamily: "monospace", letterSpacing: 0.5 }}>{label}</span>}
    </div>
  );
}

// ─── Breaker switch component ─────────────────────────────────────────────────
// Visual representation of a circuit breaker with ON / TRIPPED / OFF states
// In real panels, breakers are physical toggle switches with mechanical trip mechanisms
function BreakerSwitch({ closed, tripped, onToggle, disabled, size = "md" }) {
  const h = size === "sm" ? 32 : 44;
  const w = size === "sm" ? 56 : 72;
  const color = tripped ? "#ef4444" : closed ? "#10b981" : "#64748b";
  const label = tripped ? "TRIP" : closed ? "ON" : "OFF";
  return (
    <button
      onClick={onToggle}
      disabled={disabled || tripped}
      style={{
        width: w, height: h,
        background: `${color}22`,
        border: `1.5px solid ${color}`,
        borderRadius: 6,
        color: color,
        fontSize: size === "sm" ? 9 : 11,
        fontWeight: 700,
        fontFamily: "monospace",
        letterSpacing: 1,
        cursor: disabled || tripped ? "not-allowed" : "pointer",
        transition: "all 0.15s",
        opacity: disabled ? 0.5 : 1,
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        flexDirection: "column",
        gap: 2,
      }}
    >
      <div style={{ width: size === "sm" ? 16 : 20, height: 3, background: color, borderRadius: 2,
        transform: closed && !tripped ? "rotate(0deg)" : "rotate(30deg)", transition: "transform 0.2s" }} />
      <span>{label}</span>
    </button>
  );
}

// ─── Single-line circuit diagram (SVG) ───────────────────────────────────────
// This SVG represents a simplified single-line diagram — the standard schematic
// used by electrical engineers to show power flow in a distribution system.
// Wire color: green = energized, red = tripped/fault, gray = de-energized
function SingleLineDiagram({ circuit, onBranchClick, onMainClick }) {
  const { source, transformer, mainBreaker, busbar, branches } = circuit;
  const mainEnergized = mainBreaker.closed && !mainBreaker.tripped;
  const busEnergized = mainEnergized && transformer.energized;

  function wireColor(energized) {
    return energized ? "#10b981" : "#334155";
  }

  function branchEnergized(b) {
    return busEnergized && b.breaker && !b.tripped && b.on;
  }

  return (
    <svg width="100%" viewBox="0 0 560 320" style={{ display: "block" }}>
      {/* Grid supply symbol */}
      <circle cx="280" cy="28" r="18" fill="none" stroke={wireColor(true)} strokeWidth="1.5" />
      <text x="280" y="32" textAnchor="middle" fill="#10b981" fontSize="10" fontFamily="monospace">~</text>
      <text x="280" y="56" textAnchor="middle" fill="rgba(255,255,255,0.4)" fontSize="9" fontFamily="monospace">{source.voltage}</text>

      {/* Wire: source → transformer */}
      <line x1="280" y1="46" x2="280" y2="72" stroke={wireColor(true)} strokeWidth="2" />

      {/* Transformer symbol */}
      <circle cx="280" cy="82" r="10" fill="none" stroke={wireColor(transformer.energized)} strokeWidth="1.5" />
      <circle cx="280" cy="98" r="10" fill="none" stroke={wireColor(transformer.energized)} strokeWidth="1.5" />
      <text x="316" y="93" fill="rgba(255,255,255,0.35)" fontSize="8" fontFamily="monospace">{transformer.ratio}</text>

      {/* Wire: transformer → main breaker */}
      <line x1="280" y1="108" x2="280" y2="128" stroke={wireColor(transformer.energized)} strokeWidth="2" />

      {/* Main breaker symbol */}
      <rect x="258" y="128" width="44" height="26" rx="4"
        fill={mainBreaker.tripped ? "rgba(239,68,68,0.15)" : mainBreaker.closed ? "rgba(16,185,129,0.12)" : "rgba(100,116,139,0.12)"}
        stroke={mainBreaker.tripped ? "#ef4444" : mainBreaker.closed ? "#10b981" : "#475569"}
        strokeWidth="1.5"
        style={{ cursor: "pointer" }}
        onClick={onMainClick}
      />
      <text x="280" y="145" textAnchor="middle" fill={mainBreaker.tripped ? "#ef4444" : mainBreaker.closed ? "#10b981" : "#64748b"}
        fontSize="8" fontFamily="monospace" fontWeight="700" style={{ pointerEvents: "none" }}>
        {mainBreaker.tripped ? "TRIP" : mainBreaker.closed ? "CB-M" : "OPEN"}
      </text>

      {/* Wire: main breaker → busbar */}
      <line x1="280" y1="154" x2="280" y2="174" stroke={wireColor(mainEnergized)} strokeWidth="2" />

      {/* Bus bar (horizontal bar) */}
      <rect x="80" y="174" width="400" height="8" rx="3"
        fill={busEnergized ? "rgba(16,185,129,0.2)" : "rgba(51,65,85,0.4)"}
        stroke={wireColor(busEnergized)} strokeWidth="1.5" />
      <text x="500" y="170" textAnchor="end" fill="rgba(255,255,255,0.3)" fontSize="8" fontFamily="monospace">415V BUS</text>

      {/* Branch feeders */}
      {branches.map((b, i) => {
        const bx = 130 + i * 150;
        const energized = branchEnergized(b);
        const wc = wireColor(energized);
        return (
          <g key={b.id} style={{ cursor: "pointer" }} onClick={() => onBranchClick(b.id)}>
            {/* Vertical wire from busbar */}
            <line x1={bx} y1="182" x2={bx} y2="210" stroke={wc} strokeWidth="2" />

            {/* Branch breaker box */}
            <rect x={bx - 20} y="210" width="40" height="22" rx="3"
              fill={b.tripped ? "rgba(239,68,68,0.15)" : b.on ? "rgba(16,185,129,0.1)" : "rgba(51,65,85,0.2)"}
              stroke={b.tripped ? "#ef4444" : b.on && !b.tripped ? "#10b981" : "#475569"}
              strokeWidth="1.5" />
            <text x={bx} y="225" textAnchor="middle"
              fill={b.tripped ? "#ef4444" : b.on ? "#10b981" : "#64748b"}
              fontSize="7" fontFamily="monospace" fontWeight="700">
              {b.tripped ? "TRIP" : b.on ? "ON" : "OFF"}
            </text>

            {/* Wire breaker → load */}
            <line x1={bx} y1="232" x2={bx} y2="262" stroke={wc} strokeWidth="2" />

            {/* Load symbol */}
            {b.type === "Motor" && (
              <circle cx={bx} cy="275" r="14" fill="none" stroke={wc} strokeWidth="1.5" />
            )}
            {b.type === "Lighting" && (
              <polygon points={`${bx},261 ${bx + 12},289 ${bx - 12},289`} fill="none" stroke={wc} strokeWidth="1.5" />
            )}
            {b.type === "HVAC" && (
              <rect x={bx - 13} y="262" width="26" height="26" rx="3" fill="none" stroke={wc} strokeWidth="1.5" />
            )}

            {/* Load label */}
            <text x={bx} y="308" textAnchor="middle" fill="rgba(255,255,255,0.45)" fontSize="8" fontFamily="monospace">{b.label}</text>
            <text x={bx} y="318" textAnchor="middle" fill={energized ? "#10b981" : "rgba(255,255,255,0.2)"} fontSize="7" fontFamily="monospace">{b.load}</text>
          </g>
        );
      })}
    </svg>
  );
}

// ─── Event log entry ──────────────────────────────────────────────────────────
function EventRow({ event }) {
  const colors = { INFO: "#3b82f6", WARN: "#f59e0b", FAULT: "#ef4444", OK: "#10b981" };
  const c = colors[event.type] || "#64748b";
  return (
    <div style={{ display: "flex", gap: 10, padding: "6px 0", borderBottom: "1px solid rgba(255,255,255,0.04)", alignItems: "flex-start" }}>
      <span style={{ color: c, fontSize: 9, fontFamily: "monospace", fontWeight: 700, marginTop: 1, minWidth: 36 }}>{event.type}</span>
      <span style={{ color: "rgba(255,255,255,0.6)", fontSize: 11, flex: 1 }}>{event.message}</span>
      <span style={{ color: "rgba(255,255,255,0.25)", fontSize: 10, fontFamily: "monospace", minWidth: 60, textAlign: "right" }}>{event.time}</span>
    </div>
  );
}

// ─── Main HMI Component ───────────────────────────────────────────────────────
export default function HMIPanel() {
  const [circuit, setCircuit] = useState(INITIAL_CIRCUIT);
  const [events, setEvents] = useState([
    { type: "OK", message: "System initialised. All breakers nominal.", time: new Date().toLocaleTimeString() },
  ]);
  const [selectedBranch, setSelectedBranch] = useState(null);
  const [faultType, setFaultType] = useState(FAULT_TYPES[0]);
  const eventsRef = useRef(events);
  eventsRef.current = events;

  function log(type, message) {
    const entry = { type, message, time: new Date().toLocaleTimeString() };
    eventsRef.current = [entry, ...eventsRef.current].slice(0, 40);
    setEvents([...eventsRef.current]);
  }

  // Toggle main breaker
  function toggleMainBreaker() {
    setCircuit(prev => {
      if (prev.mainBreaker.tripped) return prev;
      const next = !prev.mainBreaker.closed;
      log(next ? "OK" : "WARN", `Main circuit breaker ${next ? "CLOSED — system energised" : "OPENED — system de-energised"}`);
      return { ...prev, mainBreaker: { ...prev.mainBreaker, closed: next } };
    });
  }

  // Reset tripped main breaker
  function resetMainBreaker() {
    setCircuit(prev => {
      log("OK", "Main breaker fault cleared and reset.");
      return { ...prev, mainBreaker: { ...prev.mainBreaker, tripped: false, closed: false } };
    });
  }

  // Toggle a branch breaker
  function toggleBranch(id) {
    setCircuit(prev => {
      const branches = prev.branches.map(b => {
        if (b.id !== id) return b;
        if (b.tripped) return b;
        const next = !b.on;
        log(next ? "INFO" : "WARN", `${b.label} breaker ${next ? "switched ON" : "switched OFF"}`);
        return { ...b, on: next };
      });
      return { ...prev, branches };
    });
  }

  // Reset a tripped branch breaker
  function resetBranch(id) {
    setCircuit(prev => {
      const branches = prev.branches.map(b => {
        if (b.id !== id || !b.tripped) return b;
        log("OK", `${b.label} fault cleared — breaker reset.`);
        return { ...b, tripped: false, on: false };
      });
      return { ...prev, branches };
    });
  }

  // Simulate a fault on selected branch
  function injectFault() {
    if (!selectedBranch) return;
    setCircuit(prev => {
      const branches = prev.branches.map(b => {
        if (b.id !== selectedBranch) return b;
        log("FAULT", `${faultType} detected on ${b.label} — breaker tripped automatically`);
        return { ...b, tripped: true, on: false };
      });
      return { ...prev, branches };
    });
  }

  // Simulate main bus fault
  function injectMainFault() {
    setCircuit(prev => {
      log("FAULT", `${faultType} on main feeder — main breaker tripped`);
      return { ...prev, mainBreaker: { ...prev.mainBreaker, tripped: true, closed: false } };
    });
  }

  const totalLoad = getTotalLoad(circuit.branches);
  const mainEnergized = circuit.mainBreaker.closed && !circuit.mainBreaker.tripped;
  const anyFault = circuit.mainBreaker.tripped || circuit.branches.some(b => b.tripped);
  const selectedB = circuit.branches.find(b => b.id === selectedBranch);

  return (
    <div style={{
      minHeight: "100vh",
      background: "#060d18",
      color: "#fff",
      fontFamily: "'IBM Plex Mono', 'Courier New', monospace",
      padding: "24px 28px",
    }}>
      {/* CSS animations */}
      <style>{`
        @keyframes ledPulse { 0%,100%{opacity:1} 50%{opacity:0.4} }
        @keyframes faultBlink { 0%,100%{opacity:1} 50%{opacity:0.3} }
        .fault-banner { animation: faultBlink 0.8s ease-in-out infinite; }
      `}</style>

      {/* Header */}
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", marginBottom: 20 }}>
        <div>
          <div style={{ fontSize: 10, color: "rgba(255,255,255,0.3)", letterSpacing: 3, marginBottom: 4 }}>
            SBSC · ELECTRICAL CONTROL SYSTEM
          </div>
          <h1 style={{ margin: 0, fontSize: 22, fontWeight: 700, letterSpacing: -0.5, color: "#e2e8f0" }}>
            HMI Distribution Panel
          </h1>
          <div style={{ fontSize: 11, color: "rgba(255,255,255,0.35)", marginTop: 3 }}>
            Unit: DIST-PANEL-01 · 415V Low Voltage Board
          </div>
        </div>
        <div style={{ display: "flex", flexDirection: "column", gap: 6, alignItems: "flex-end" }}>
          <LED on={mainEnergized} color="#10b981" label="SYSTEM LIVE" />
          <LED on={anyFault} color="#ef4444" label="FAULT ACTIVE" pulse />
          <LED on={!mainEnergized && !anyFault} color="#f59e0b" label="SYSTEM OFF" />
        </div>
      </div>

      {/* Fault banner */}
      {anyFault && (
        <div className="fault-banner" style={{
          background: "rgba(239,68,68,0.12)", border: "1px solid rgba(239,68,68,0.4)",
          borderRadius: 8, padding: "8px 16px", marginBottom: 16,
          fontSize: 12, color: "#ef4444", fontWeight: 700, letterSpacing: 1,
          display: "flex", justifyContent: "space-between", alignItems: "center",
        }}>
          <span>⚠ FAULT DETECTED — CHECK EVENT LOG AND RESET AFFECTED BREAKERS</span>
          <span style={{ fontSize: 10, opacity: 0.7 }}>{new Date().toLocaleTimeString()}</span>
        </div>
      )}

      {/* Main layout: diagram left, controls right */}
      <div style={{ display: "grid", gridTemplateColumns: "1fr 300px", gap: 16, marginBottom: 16 }}>

        {/* Single-line diagram */}
        <div style={{ background: "rgba(255,255,255,0.02)", border: "1px solid rgba(255,255,255,0.07)", borderRadius: 12, padding: "16px 20px" }}>
          <div style={{ fontSize: 10, color: "rgba(255,255,255,0.3)", letterSpacing: 2, marginBottom: 12 }}>
            SINGLE-LINE DIAGRAM · CLICK COMPONENTS TO SELECT
          </div>
          <SingleLineDiagram
            circuit={circuit}
            onBranchClick={(id) => setSelectedBranch(id === selectedBranch ? null : id)}
            onMainClick={toggleMainBreaker}
          />
          <div style={{ display: "flex", gap: 16, marginTop: 8 }}>
            <div style={{ display: "flex", alignItems: "center", gap: 5 }}>
              <div style={{ width: 20, height: 2, background: "#10b981" }} />
              <span style={{ fontSize: 9, color: "rgba(255,255,255,0.35)" }}>Energised</span>
            </div>
            <div style={{ display: "flex", alignItems: "center", gap: 5 }}>
              <div style={{ width: 20, height: 2, background: "#334155" }} />
              <span style={{ fontSize: 9, color: "rgba(255,255,255,0.35)" }}>De-energised</span>
            </div>
            <div style={{ display: "flex", alignItems: "center", gap: 5 }}>
              <div style={{ width: 20, height: 2, background: "#ef4444" }} />
              <span style={{ fontSize: 9, color: "rgba(255,255,255,0.35)" }}>Fault / Trip</span>
            </div>
          </div>
        </div>

        {/* Right panel: controls */}
        <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>

          {/* System metrics */}
          <div style={{ background: "rgba(255,255,255,0.02)", border: "1px solid rgba(255,255,255,0.07)", borderRadius: 12, padding: "14px 16px" }}>
            <div style={{ fontSize: 10, color: "rgba(255,255,255,0.3)", letterSpacing: 2, marginBottom: 10 }}>SYSTEM METRICS</div>
            <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 10 }}>
              {[
                { label: "Total Load", value: `${totalLoad} kW`, color: "#3b82f6" },
                { label: "Bus Voltage", value: mainEnergized ? "415 V" : "0 V", color: mainEnergized ? "#10b981" : "#64748b" },
                { label: "Breakers ON", value: `${circuit.branches.filter(b => b.on && !b.tripped).length} / 3`, color: "#f59e0b" },
                { label: "Status", value: anyFault ? "FAULT" : mainEnergized ? "NORMAL" : "OFF", color: anyFault ? "#ef4444" : mainEnergized ? "#10b981" : "#64748b" },
              ].map(m => (
                <div key={m.label} style={{ background: "rgba(255,255,255,0.03)", borderRadius: 8, padding: "8px 10px" }}>
                  <div style={{ fontSize: 9, color: "rgba(255,255,255,0.3)", marginBottom: 3 }}>{m.label}</div>
                  <div style={{ fontSize: 14, fontWeight: 700, color: m.color }}>{m.value}</div>
                </div>
              ))}
            </div>
          </div>

          {/* Main breaker control */}
          <div style={{ background: "rgba(255,255,255,0.02)", border: "1px solid rgba(255,255,255,0.07)", borderRadius: 12, padding: "14px 16px" }}>
            <div style={{ fontSize: 10, color: "rgba(255,255,255,0.3)", letterSpacing: 2, marginBottom: 10 }}>MAIN BREAKER</div>
            <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between" }}>
              <div>
                <div style={{ fontSize: 12, color: "rgba(255,255,255,0.7)" }}>CB-MAIN</div>
                <div style={{ fontSize: 10, color: "rgba(255,255,255,0.3)" }}>400A MCCB</div>
              </div>
              {circuit.mainBreaker.tripped ? (
                <button onClick={resetMainBreaker} style={{
                  background: "rgba(239,68,68,0.15)", border: "1px solid #ef4444",
                  color: "#ef4444", borderRadius: 6, padding: "6px 12px", cursor: "pointer",
                  fontSize: 10, fontFamily: "monospace", fontWeight: 700,
                }}>RESET TRIP</button>
              ) : (
                <BreakerSwitch closed={circuit.mainBreaker.closed} tripped={false} onToggle={toggleMainBreaker} />
              )}
            </div>
          </div>

          {/* Branch controls */}
          <div style={{ background: "rgba(255,255,255,0.02)", border: "1px solid rgba(255,255,255,0.07)", borderRadius: 12, padding: "14px 16px", flex: 1 }}>
            <div style={{ fontSize: 10, color: "rgba(255,255,255,0.3)", letterSpacing: 2, marginBottom: 10 }}>BRANCH BREAKERS</div>
            <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
              {circuit.branches.map(b => (
                <div key={b.id} style={{
                  display: "flex", alignItems: "center", justifyContent: "space-between",
                  padding: "8px 10px", borderRadius: 8,
                  background: selectedBranch === b.id ? "rgba(59,130,246,0.1)" : "rgba(255,255,255,0.02)",
                  border: `1px solid ${selectedBranch === b.id ? "rgba(59,130,246,0.3)" : "rgba(255,255,255,0.05)"}`,
                  cursor: "pointer",
                }} onClick={() => setSelectedBranch(b.id === selectedBranch ? null : b.id)}>
                  <div>
                    <div style={{ fontSize: 11, color: "rgba(255,255,255,0.75)" }}>{b.label}</div>
                    <div style={{ fontSize: 9, color: b.tripped ? "#ef4444" : "rgba(255,255,255,0.3)" }}>{b.tripped ? "TRIPPED" : b.load}</div>
                  </div>
                  {b.tripped ? (
                    <button onClick={(e) => { e.stopPropagation(); resetBranch(b.id); }} style={{
                      background: "rgba(239,68,68,0.15)", border: "1px solid #ef4444",
                      color: "#ef4444", borderRadius: 5, padding: "4px 8px", cursor: "pointer",
                      fontSize: 9, fontFamily: "monospace", fontWeight: 700,
                    }}>RESET</button>
                  ) : (
                    <BreakerSwitch size="sm" closed={b.on} tripped={b.tripped}
                      onToggle={(e) => { e?.stopPropagation?.(); toggleBranch(b.id); }}
                      disabled={!mainEnergized} />
                  )}
                </div>
              ))}
            </div>
          </div>
        </div>
      </div>

      {/* Fault injection + Event log */}
      <div style={{ display: "grid", gridTemplateColumns: "300px 1fr", gap: 16 }}>

        {/* Fault simulation panel */}
        <div style={{ background: "rgba(239,68,68,0.04)", border: "1px solid rgba(239,68,68,0.15)", borderRadius: 12, padding: "14px 16px" }}>
          <div style={{ fontSize: 10, color: "rgba(239,68,68,0.6)", letterSpacing: 2, marginBottom: 12 }}>FAULT SIMULATION</div>
          <div style={{ fontSize: 10, color: "rgba(255,255,255,0.3)", marginBottom: 6 }}>Fault type</div>
          <select value={faultType} onChange={e => setFaultType(e.target.value)} style={{
            width: "100%", background: "#0d1826", border: "1px solid rgba(255,255,255,0.1)",
            color: "#e2e8f0", borderRadius: 6, padding: "6px 10px", fontSize: 11,
            fontFamily: "monospace", marginBottom: 10,
          }}>
            {FAULT_TYPES.map(f => <option key={f}>{f}</option>)}
          </select>
          <div style={{ fontSize: 10, color: "rgba(255,255,255,0.3)", marginBottom: 6 }}>Target</div>
          <select value={selectedBranch || ""} onChange={e => setSelectedBranch(e.target.value || null)} style={{
            width: "100%", background: "#0d1826", border: "1px solid rgba(255,255,255,0.1)",
            color: "#e2e8f0", borderRadius: 6, padding: "6px 10px", fontSize: 11,
            fontFamily: "monospace", marginBottom: 12,
          }}>
            <option value="">Select branch...</option>
            {circuit.branches.map(b => <option key={b.id} value={b.id}>{b.label}</option>)}
          </select>
          <div style={{ display: "flex", gap: 8 }}>
            <button onClick={injectFault} disabled={!selectedBranch} style={{
              flex: 1, background: "rgba(239,68,68,0.15)", border: "1px solid rgba(239,68,68,0.4)",
              color: "#ef4444", borderRadius: 6, padding: "8px", cursor: selectedBranch ? "pointer" : "not-allowed",
              fontSize: 10, fontFamily: "monospace", fontWeight: 700, opacity: selectedBranch ? 1 : 0.4,
            }}>INJECT BRANCH FAULT</button>
            <button onClick={injectMainFault} style={{
              flex: 1, background: "rgba(239,68,68,0.15)", border: "1px solid rgba(239,68,68,0.4)",
              color: "#ef4444", borderRadius: 6, padding: "8px", cursor: "pointer",
              fontSize: 10, fontFamily: "monospace", fontWeight: 700,
            }}>INJECT MAIN FAULT</button>
          </div>
        </div>

        {/* Event log */}
        <div style={{ background: "rgba(255,255,255,0.02)", border: "1px solid rgba(255,255,255,0.07)", borderRadius: 12, padding: "14px 16px", maxHeight: 200, overflowY: "auto" }}>
          <div style={{ fontSize: 10, color: "rgba(255,255,255,0.3)", letterSpacing: 2, marginBottom: 10 }}>EVENT LOG</div>
          {events.map((e, i) => <EventRow key={i} event={e} />)}
        </div>
      </div>

      <div style={{ marginTop: 16, color: "rgba(255,255,255,0.15)", fontSize: 10, fontFamily: "monospace", textAlign: "center" }}>
        Akintola Al-Ameen · Bells University of Technology · EEE Internship Project 2
      </div>
    </div>
  );
}
