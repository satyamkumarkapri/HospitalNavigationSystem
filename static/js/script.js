let hospitalData = {};
let currentStart = "Entrance";
let currentEnd = "Pharmacy";
let crowdedPaths = new Set();
let activeFloorFilter = "all";
let isAnimating = false;
let lastPathResult = null;

// ─── Category colours ───────────────────────────────────────────────────────
const CATEGORY_COLORS = {
    "Emergency":     "#f43f5e",
    "Clinical":      "#38bdf8",
    "Diagnostics":   "#a78bfa",
    "Ward":          "#4ade80",
    "Access":        "#94a3b8",
    "Admin":         "#fb923c",
    "Amenity":       "#facc15",
    "Therapy":       "#34d399",
    "Consultation":  "#e879f9",
    "Accessibility": "#22d3ee",
};

const FLOOR_COLORS = {
    0: "rgba(56,189,248,0.06)",
    1: "rgba(74,222,128,0.06)",
    2: "rgba(167,139,250,0.06)",
    3: "rgba(232,121,249,0.06)",
};

// ─── Init ────────────────────────────────────────────────────────────────────
async function init() {
    const res = await fetch('/map-data');
    hospitalData = await res.json();

    const urlParams = new URLSearchParams(window.location.search);
    const targetParam = urlParams.get('target');
    const startParam  = urlParams.get('start');
    if (targetParam && hospitalData[targetParam]) currentEnd   = targetParam;
    if (startParam  && hospitalData[startParam])  currentStart = startParam;

    populateSelects();
    buildFloorFilters();
    buildFloorTabs();
    renderMap();
    selectNode(currentEnd, false);

    if (targetParam || startParam) {
        setTimeout(() => calculatePath(false), 400);
    }
}

// ─── Selects ─────────────────────────────────────────────────────────────────
function populateSingleSelect(sel, defaultValue) {
    sel.innerHTML = '';
    const floors = { 0: [], 1: [], 2: [], 3: [] };
    Object.entries(hospitalData).forEach(([n, d]) => floors[d.floor]?.push([n, d]));

    [0, 1, 2, 3].forEach(fl => {
        const grp = document.createElement('optgroup');
        grp.label = fl === 0 ? '🏥 Ground Floor' : fl === 1 ? '1️⃣ Level 1' : fl === 2 ? '2️⃣ Level 2' : '3️⃣ Level 3';
        (floors[fl] || []).forEach(([n, d]) => {
            const opt = new Option(`${d.icon || '📍'} ${n}`, n);
            grp.appendChild(opt);
        });
        sel.appendChild(grp);
    });

    if (hospitalData[defaultValue]) {
        sel.value = defaultValue;
    }
}

function updateNumPersons() {
    const numEl = document.getElementById('num-persons');
    if (!numEl) return;
    const num = parseInt(numEl.value, 10);
    const container = document.getElementById('sources-container');
    if (!container) return;
    
    container.innerHTML = '';
    const defaultsStart = ["Entrance", "Cafeteria", "ER", "Oncology", "Neurology", "Orthopedics", "Parking_Zone_A"];
    const defaultsEnd   = ["Pharmacy_1", "Surgery", "ICU", "Dr_Chen", "Dr_Wilson", "Dermatology", "Dr_Smith"];
    const personColors  = ['#38bdf8', '#4ade80', '#a78bfa', '#facc15', '#f43f5e', '#34d399'];

    const endNodeGroup = document.getElementById('end-node-group');

    if (num === 1) {
        if (endNodeGroup) {
            endNodeGroup.style.display = 'block';
            endNodeGroup.classList.remove('hidden');
        }
        
        const div = document.createElement('div');
        div.className = 'control-group source-input-group';
        div.id = 'group-start-0';
        
        const label = document.createElement('label');
        label.textContent = `📍 Start Location`;
        
        const select = document.createElement('select');
        select.id = `start-node-0`;
        select.className = 'start-node-select portal-input';
        select.style.padding = '0.8rem';
        select.style.width = '100%';
        select.onchange = () => {
            updateNodeClasses();
            calculatePath(false, false);
        };

        div.appendChild(label);
        div.appendChild(select);
        container.appendChild(div);

        let defStart = currentStart || "Entrance";
        populateSingleSelect(select, defStart);
    } else {
        if (endNodeGroup) {
            endNodeGroup.style.display = 'none';
            endNodeGroup.classList.add('hidden');
        }

        for (let i = 0; i < num; i++) {
            const card = document.createElement('div');
            card.className = 'person-card';
            card.id = `person-card-${i}`;

            const col = personColors[i % 6];
            const header = document.createElement('div');
            header.className = 'person-card-header';
            header.style.color = col;
            header.innerHTML = `👤 Person ${i + 1}`;
            card.appendChild(header);

            // Start Location
            const startGroup = document.createElement('div');
            startGroup.className = 'control-group source-input-group';
            
            const startLabel = document.createElement('label');
            startLabel.textContent = `📍 Start Location`;
            startLabel.style.fontSize = '0.75rem';
            
            const startSelect = document.createElement('select');
            startSelect.id = `start-node-${i}`;
            startSelect.className = 'start-node-select portal-input';
            startSelect.style.padding = '0.6rem';
            startSelect.style.width = '100%';
            startSelect.onchange = () => {
                updateNodeClasses();
                calculatePath(false, false);
            };

            startGroup.appendChild(startLabel);
            startGroup.appendChild(startSelect);
            card.appendChild(startGroup);

            // Target Destination
            const endGroup = document.createElement('div');
            endGroup.className = 'control-group source-input-group';
            endGroup.style.marginTop = '0.5rem';
            
            const endLabel = document.createElement('label');
            endLabel.textContent = `🎯 Target Destination`;
            endLabel.style.fontSize = '0.75rem';
            
            const endSelect = document.createElement('select');
            endSelect.id = `end-node-${i}`;
            endSelect.className = 'end-node-select portal-input';
            endSelect.style.padding = '0.6rem';
            endSelect.style.width = '100%';
            endSelect.onchange = () => {
                updateNodeClasses();
                calculatePath(false, false);
            };

            endGroup.appendChild(endLabel);
            endGroup.appendChild(endSelect);
            card.appendChild(endGroup);

            container.appendChild(card);

            // Pre-fill Start and Destination
            let defStart = defaultsStart[i] || "Entrance";
            if (i === 0 && currentStart) defStart = currentStart;
            populateSingleSelect(startSelect, defStart);

            let defEnd = defaultsEnd[i] || "Pharmacy_1";
            if (i === 0 && currentEnd) defEnd = currentEnd;
            populateSingleSelect(endSelect, defEnd);
        }
    }
}

function populateSelects() {
    const e = document.getElementById('end-node');
    populateSingleSelect(e, currentEnd);
    updateNumPersons();
}

// ─── Floor filter sidebar chips ───────────────────────────────────────────────
function buildFloorFilters() {
    const container = document.getElementById('floor-filters');
    ['All', 'Ground', 'Floor 1', 'Floor 2', 'Floor 3'].forEach((label, i) => {
        const btn = document.createElement('button');
        btn.textContent = label;
        btn.className = 'floor-chip' + (i === 0 ? ' active' : '');
        btn.dataset.floor = i === 0 ? 'all' : String(i - 1);
        btn.onclick = () => {
            document.querySelectorAll('.floor-chip').forEach(b => b.classList.remove('active'));
            btn.classList.add('active');
            activeFloorFilter = btn.dataset.floor;
            applyFloorFilter();
        };
        container.appendChild(btn);
    });
}

function buildFloorTabs() {
    document.querySelectorAll('.floor-tab').forEach(tab => {
        tab.onclick = () => {
            document.querySelectorAll('.floor-tab').forEach(t => t.classList.remove('active'));
            tab.classList.add('active');
            activeFloorFilter = tab.dataset.floor;
            const label = document.getElementById('floor-label');
            label.textContent = activeFloorFilter === 'all'
                ? 'Showing: All Floors'
                : `Showing: ${tab.textContent}`;
            applyFloorFilter();
            // sync chips
            document.querySelectorAll('.floor-chip').forEach(c => {
                c.classList.toggle('active', c.dataset.floor === activeFloorFilter);
            });
        };
    });
}

function applyFloorFilter() {
    document.querySelectorAll('.node').forEach(n => {
        const floor = n.dataset.floor;
        if (activeFloorFilter === 'all' || floor === activeFloorFilter) {
            n.style.opacity = '1';
            n.style.pointerEvents = 'auto';
        } else {
            n.style.opacity = '0.15';
            n.style.pointerEvents = 'none';
        }
    });
    document.querySelectorAll('.connection').forEach(c => {
        const f1 = c.dataset.floor1, f2 = c.dataset.floor2;
        if (activeFloorFilter === 'all' || f1 === activeFloorFilter || f2 === activeFloorFilter) {
            c.style.opacity = '';
        } else {
            c.style.opacity = '0.08';
        }
    });
}

// ─── Render Map ───────────────────────────────────────────────────────────────
function renderMap() {
    const nodesGroup = document.getElementById('nodes-group');
    const connsGroup  = document.getElementById('connections-group');
    const zonesGroup  = document.getElementById('floor-zones-group');
    nodesGroup.innerHTML = '';
    connsGroup.innerHTML  = '';
    zonesGroup.innerHTML  = '';

    let minX = Infinity, maxX = -Infinity, minY = Infinity, maxY = -Infinity;
    Object.values(hospitalData).forEach(d => {
        minX = Math.min(minX, d.x);
        maxX = Math.max(maxX, d.x);
        minY = Math.min(minY, d.y);
        maxY = Math.max(maxY, d.y);
    });

    const panel = document.getElementById('directions-panel');
    const isPanelVisible = panel && !panel.classList.contains('hidden') && panel.style.display !== 'none';
    
    const padding = 100;
    const topPadding = 60; // Enough room for floor labels
    const leftPadding = 20; 
    const rightPadding = isPanelVisible ? 450 : 100; 
    
    const svg = document.getElementById('hospital-map');
    svg.setAttribute("viewBox", `${minX - leftPadding} ${minY - topPadding} ${maxX - minX + leftPadding + rightPadding} ${maxY - minY + topPadding + padding}`);

    // Floor zone backgrounds
    const floorBounds = { 0: null, 1: null, 2: null, 3: null };
    Object.values(hospitalData).forEach(d => {
        const fl = d.floor;
        if (!floorBounds[fl]) floorBounds[fl] = { minX: d.x, maxX: d.x, minY: d.y, maxY: d.y };
        else {
            floorBounds[fl].minX = Math.min(floorBounds[fl].minX, d.x);
            floorBounds[fl].maxX = Math.max(floorBounds[fl].maxX, d.x);
            floorBounds[fl].minY = Math.min(floorBounds[fl].minY, d.y);
            floorBounds[fl].maxY = Math.max(floorBounds[fl].maxY, d.y);
        }
    });
    [0, 1, 2, 3].forEach(fl => {
        const b = floorBounds[fl];
        if (!b) return;
        const pad = 50;
        const rect = document.createElementNS("http://www.w3.org/2000/svg", "rect");
        rect.setAttribute("x", b.minX - pad);
        rect.setAttribute("y", b.minY - pad);
        rect.setAttribute("width", b.maxX - b.minX + pad * 2);
        rect.setAttribute("height", b.maxY - b.minY + pad * 2);
        rect.setAttribute("rx", "16");
        rect.setAttribute("fill", FLOOR_COLORS[fl] || "transparent");
        rect.setAttribute("stroke", fl === 0 ? "rgba(56,189,248,0.15)" : fl === 1 ? "rgba(74,222,128,0.15)" : fl === 2 ? "rgba(167,139,250,0.15)" : "rgba(232,121,249,0.15)");
        rect.setAttribute("stroke-width", "1.5");
        zonesGroup.appendChild(rect);

        // Floor label
        const txt = document.createElementNS("http://www.w3.org/2000/svg", "text");
        txt.setAttribute("x", b.minX - pad + 15);
        txt.setAttribute("y", b.minY - pad + 25);
        txt.setAttribute("fill", fl === 0 ? "#38bdf8" : fl === 1 ? "#4ade80" : fl === 2 ? "#a78bfa" : "#e879f9");
        txt.setAttribute("font-size", "18px"); // Larger font
        txt.setAttribute("font-weight", "900"); // Ultra bold
        txt.setAttribute("opacity", "0.9"); // More opaque
        txt.setAttribute("style", "text-transform: uppercase; letter-spacing: 1px;");
        txt.textContent = fl === 0 ? "Ground Floor" : fl === 1 ? "Level 1" : fl === 2 ? "Level 2" : "Level 3";
        zonesGroup.appendChild(txt);
    });

    // Connections
    const drawn = new Set();
    // Weight label group — rendered on top of lines but below nodes
    const weightGroup = document.createElementNS("http://www.w3.org/2000/svg", "g");
    weightGroup.setAttribute("id", "weight-labels-group");
    connsGroup.after ? connsGroup.after(weightGroup) : connsGroup.parentNode.insertBefore(weightGroup, connsGroup.nextSibling);

    Object.entries(hospitalData).forEach(([name, data]) => {
        Object.keys(data.connections).forEach(neighbor => {
            if (!hospitalData[neighbor]) return;
            const pair = [name, neighbor].sort().join('-');
            if (drawn.has(pair)) return;
            drawn.add(pair);
            const nd = hospitalData[neighbor];

            // ── Edge weight (get from whichever side stores it) ──────────────
            const weight = data.connections[neighbor] ?? nd.connections[name] ?? 0;

            const line = document.createElementNS("http://www.w3.org/2000/svg", "line");
            line.setAttribute("x1", data.x);
            line.setAttribute("y1", data.y);
            line.setAttribute("x2", nd.x);
            line.setAttribute("y2", nd.y);
            line.setAttribute("class", "connection");
            line.setAttribute("id", `conn-${pair}`);
            line.dataset.floor1 = String(data.floor);
            line.dataset.floor2 = String(nd.floor);
            line.dataset.weight = String(weight);

            // Cross-floor connections styled differently
            if (data.floor !== nd.floor) {
                line.classList.add('cross-floor');
            }

            line.onclick = () => toggleCrowded(pair);
            connsGroup.appendChild(line);

            // ── Weight label at midpoint ──────────────────────────────────────
            const mx = (data.x + nd.x) / 2;
            const my = (data.y + nd.y) / 2;

            // Colour-code the pill by weight magnitude
            // low (≤3): green  medium (4-6): cyan  high (7-9): orange  very high (≥10): red
            let pillColor, pillBorder, labelColor;
            if (weight <= 3) {
                pillColor = 'rgba(34,197,94,0.18)';  pillBorder = 'rgba(34,197,94,0.7)';  labelColor = '#4ade80';
            } else if (weight <= 6) {
                pillColor = 'rgba(56,189,248,0.18)';  pillBorder = 'rgba(56,189,248,0.7)'; labelColor = '#38bdf8';
            } else if (weight <= 9) {
                pillColor = 'rgba(251,146,60,0.18)';  pillBorder = 'rgba(251,146,60,0.7)'; labelColor = '#fb923c';
            } else {
                pillColor = 'rgba(244,63,94,0.18)';   pillBorder = 'rgba(244,63,94,0.7)';  labelColor = '#f43f5e';
            }

            // Shadow/glow behind pill for readability on any background
            const pillShadow = document.createElementNS("http://www.w3.org/2000/svg", "rect");
            pillShadow.setAttribute("x", mx - 22);
            pillShadow.setAttribute("y", my - 13);
            pillShadow.setAttribute("width", "44");
            pillShadow.setAttribute("height", "22");
            pillShadow.setAttribute("rx", "11");
            pillShadow.setAttribute("fill", "rgba(0,0,0,0.55)");
            pillShadow.setAttribute("class", "weight-shadow");
            pillShadow.style.pointerEvents = "none";

            // Pill background
            const pillRect = document.createElementNS("http://www.w3.org/2000/svg", "rect");
            pillRect.setAttribute("x", mx - 20);
            pillRect.setAttribute("y", my - 11);
            pillRect.setAttribute("width", "40");
            pillRect.setAttribute("height", "20");
            pillRect.setAttribute("rx", "10");
            pillRect.setAttribute("fill", pillColor);
            pillRect.setAttribute("stroke", pillBorder);
            pillRect.setAttribute("stroke-width", "1.5");
            pillRect.setAttribute("class", "weight-pill");
            pillRect.setAttribute("id", `wpill-${pair}`);
            pillRect.dataset.defaultFill   = pillColor;
            pillRect.dataset.defaultStroke = pillBorder;
            pillRect.style.pointerEvents = "none";

            // Weight number
            const wTxt = document.createElementNS("http://www.w3.org/2000/svg", "text");
            wTxt.setAttribute("x", mx);
            wTxt.setAttribute("y", my + 5);
            wTxt.setAttribute("text-anchor", "middle");
            wTxt.setAttribute("font-size", "13px");
            wTxt.setAttribute("font-weight", "800");
            wTxt.setAttribute("fill", labelColor);
            wTxt.setAttribute("class", "weight-label");
            wTxt.setAttribute("id", `wlbl-${pair}`);
            wTxt.dataset.defaultColor = labelColor;
            wTxt.style.pointerEvents = "none";
            wTxt.textContent = weight;

            weightGroup.appendChild(pillShadow);
            weightGroup.appendChild(pillRect);
            weightGroup.appendChild(wTxt);
        });
    });

    // Nodes
    Object.entries(hospitalData).forEach(([name, data]) => {
        const catColor = CATEGORY_COLORS[data.category] || "#94a3b8";
        const isWheelchair = data.wheelchair_accessible;
        const isRestricted = data.status === "restricted";

        const g = document.createElementNS("http://www.w3.org/2000/svg", "g");
        g.setAttribute("class", "node");
        g.setAttribute("id", `node-${name}`);
        g.dataset.floor = String(data.floor);

        // Outer glow ring (category colour)
        const ring = document.createElementNS("http://www.w3.org/2000/svg", "circle");
        ring.setAttribute("cx", data.x);
        ring.setAttribute("cy", data.y);
        ring.setAttribute("r", "30");
        ring.setAttribute("fill", "none");
        ring.setAttribute("stroke", catColor);
        ring.setAttribute("stroke-width", "2");
        ring.setAttribute("opacity", "0.4");
        ring.setAttribute("class", "node-ring");

        // Main circle
        const circle = document.createElementNS("http://www.w3.org/2000/svg", "circle");
        circle.setAttribute("cx", data.x);
        circle.setAttribute("cy", data.y);
        circle.setAttribute("r", "22");
        circle.setAttribute("stroke", catColor);
        circle.setAttribute("stroke-width", "2");

        // Icon
        const iconT = document.createElementNS("http://www.w3.org/2000/svg", "text");
        iconT.setAttribute("x", data.x);
        iconT.setAttribute("y", data.y + 6);
        iconT.setAttribute("text-anchor", "middle");
        iconT.setAttribute("font-size", "16px");
        iconT.textContent = data.icon || "📍";
        iconT.style.pointerEvents = "none";

        // Label
        const label = document.createElementNS("http://www.w3.org/2000/svg", "text");
        label.setAttribute("x", data.x);
        label.setAttribute("y", data.y + 40);
        label.setAttribute("text-anchor", "middle");
        label.setAttribute("font-size", "11px");
        label.setAttribute("font-weight", "600");
        label.textContent = name.replace(/_/g, ' ');
        label.style.pointerEvents = "none";

        // Wheelchair badge
        if (isWheelchair && data.category === "Accessibility") {
            const badge = document.createElementNS("http://www.w3.org/2000/svg", "circle");
            badge.setAttribute("cx", data.x + 18);
            badge.setAttribute("cy", data.y - 18);
            badge.setAttribute("r", "8");
            badge.setAttribute("fill", "#22d3ee");
            badge.setAttribute("stroke", "#0f172a");
            badge.setAttribute("stroke-width", "1.5");
            const badgeTxt = document.createElementNS("http://www.w3.org/2000/svg", "text");
            badgeTxt.setAttribute("x", data.x + 18);
            badgeTxt.setAttribute("y", data.y - 14);
            badgeTxt.setAttribute("text-anchor", "middle");
            badgeTxt.setAttribute("font-size", "9px");
            badgeTxt.textContent = "♿";
            g.appendChild(badge);
            g.appendChild(badgeTxt);
        }

        // Restricted badge
        if (isRestricted) {
            const rBadge = document.createElementNS("http://www.w3.org/2000/svg", "circle");
            rBadge.setAttribute("cx", data.x - 18);
            rBadge.setAttribute("cy", data.y - 18);
            rBadge.setAttribute("r", "7");
            rBadge.setAttribute("fill", "#f43f5e");
            rBadge.setAttribute("stroke", "#0f172a");
            rBadge.setAttribute("stroke-width", "1.5");
            const rTxt = document.createElementNS("http://www.w3.org/2000/svg", "text");
            rTxt.setAttribute("x", data.x - 18);
            rTxt.setAttribute("y", data.y - 14);
            rTxt.setAttribute("text-anchor", "middle");
            rTxt.setAttribute("font-size", "9px");
            rTxt.textContent = "🔒";
            g.appendChild(rBadge);
            g.appendChild(rTxt);
        }

        g.appendChild(ring);
        g.appendChild(circle);
        g.appendChild(iconT);
        g.appendChild(label);
        nodesGroup.appendChild(g);

        g.onclick = () => selectNode(name);
    });

    updateNodeClasses();
    applyFloorFilter();
    restoreActivePath();
}

function restoreActivePath() {
    if (!lastPathResult) return;
    
    if (lastPathResult.is_multi) {
        // Highlight meeting point
        const meetingNode = lastPathResult.meeting_point;
        document.getElementById(`node-${meetingNode}`)?.classList.add('meeting-point');
        
        lastPathResult.persons_data.forEach((pData, pIdx) => {
            pData.path_to_meet.forEach(node => {
                document.getElementById(`node-${node}`)?.classList.add('active');
            });
            pData.path_from_meet.forEach(node => {
                document.getElementById(`node-${node}`)?.classList.add('active');
            });
        });
        
        // Show all dynamic lines
        document.querySelectorAll('.dynamic-route-line').forEach(l => {
            l.style.opacity = '1';
            l.classList.remove('dimmed');
        });
        document.querySelectorAll('.route-marker-ring').forEach(r => r.classList.remove('dimmed'));
        document.querySelectorAll('.shared-segment-label-group').forEach(g => g.classList.remove('dimmed'));
    } else {
        // Single person path
        lastPathResult.path.forEach(node => {
            document.getElementById(`node-${node}`)?.classList.add('active');
        });
        for (let i = 1; i < lastPathResult.path.length; i++) {
            const pair = [lastPathResult.path[i-1], lastPathResult.path[i]].sort().join('-');
            const conn = document.getElementById(`conn-${pair}`);
            if (conn) {
                conn.classList.add('active');
                if (lastPathResult.path[lastPathResult.path.length - 1] === 'ER') {
                    conn.classList.add('emergency-path');
                }
            }
            const wpill = document.getElementById(`wpill-${pair}`);
            const wlbl  = document.getElementById(`wlbl-${pair}`);
            if (wpill) {
                wpill.setAttribute('fill', 'rgba(234,179,8,0.45)');
                wpill.setAttribute('stroke', '#facc15');
                wpill.setAttribute('stroke-width', '2.5');
            }
            if (wlbl) {
                wlbl.setAttribute('fill', '#fff');
                wlbl.setAttribute('font-size', '14px');
            }
        }
    }
}

// ─── Node Selection ───────────────────────────────────────────────────────────
function selectNode(name, triggerPath = true) {
    const data = hospitalData[name];
    if (!data) return;

    const panel = document.getElementById('details-panel');
    panel.classList.remove('hidden');
    panel.style.display = 'block'; // Force display for Chrome on Windows

    const catColor = CATEGORY_COLORS[data.category] || "#94a3b8";
    document.getElementById('detail-badge').textContent = data.category || '';
    document.getElementById('detail-badge').style.background = catColor + '22';
    document.getElementById('detail-badge').style.color = catColor;
    document.getElementById('detail-badge').style.borderColor = catColor + '55';

    document.getElementById('detail-title').textContent = `${data.icon} ${name.replace(/_/g, ' ')}`;

    const imageMap = {
        "Entrance": "hospital_entrance.png",
        "Ambulance_Bay": "hospital_entrance.png",
        "Reception": "hospital_reception.png",
        "Info_Desk": "hospital_reception.png",
        "ER": "emergency_room.png",
        "Triage": "emergency_room.png",
        "ICU": "intensive_care.png",
        "Cafeteria": "cafeteria.png",
        "Pharmacy": "pharmacy.png",
        "Radiology": "radiology.png",
        "X_Ray": "radiology.png",
        "MRI_Suite": "radiology.png",
        "Lab": "medical_lab.png",
        "Blood_Bank": "medical_lab.png",
        "Ward_A": "hospital_ward.png",
        "Ward_B": "hospital_ward.png",
        "Wheelchair_Bay": "wheelchair_bay.png",
        "Gift_Shop": "hospital_gift_shop.png",
        "Outpatient": "outpatient_clinic.png",
        "Restroom_G": "hospital_restroom.png",
        "Restroom_1": "hospital_restroom.png",
        "Dr_Smith": "doctor_consultation.png",
        "Dr_Jones": "doctor_consultation.png",
        "Lift_G": "hospital_elevator.png",
        "Lift_1": "hospital_elevator.png",
        "Lift_2": "hospital_elevator.png",
        "Staff_Lift_G": "hospital_elevator.png",
        "Staff_Lift_1": "hospital_elevator.png",
        "Staff_Lift_2": "hospital_elevator.png",
        "Stairwell_G": "hospital_stairwell.png",
        "Stairwell_1": "hospital_stairwell.png",
        "Stairwell_2": "hospital_stairwell.png",
        "Nursing_Station_1": "nursing_station.png",
        "Nursing_Station_2": "nursing_station.png",
        "Physiotherapy": "physiotherapy.png",
        "Oxygen_Station": "oxygen_station.png",
        "Maternity": "maternity_ward.png",
        "NICU": "nicu.png",
        "Surgery": "surgery_room.png",
        "Oncology": "oncology_dept.png",
        "Neurology": "neurology_dept.png",
        "Orthopedics": "orthopedics_dept.png",
        "Dermatology": "dermatology_dept.png",
        "Dr_Chen": "dr_chen_oncology.png",
        "Dr_Wilson": "dr_wilson_neurology.png",
        "Dr_Blunt": "dr_blunt_orthopedics.png",
        "Dr_Ross": "dr_ross_dermatology.png"
    };
    const defaultImage = "better_hospital_bg.png";
    const imgName = imageMap[name] || defaultImage;
    const imgEl = document.getElementById('detail-image');
    if (imgEl) {
        imgEl.src = `/static/images/${imgName}`;
    }

    const meta = document.getElementById('detail-meta');
    if (meta) {
        meta.innerHTML = '';
        const floorPill = document.createElement('span');
        floorPill.className = 'meta-pill';
        floorPill.textContent = `Floor ${data.floor}`;
        meta.appendChild(floorPill);

        if (data.wheelchair_accessible) {
            const wcPill = document.createElement('span');
            wcPill.className = 'meta-pill wc';
            wcPill.textContent = '♿ Accessible';
            meta.appendChild(wcPill);
        }
        if (data.status === 'restricted') {
            const rPill = document.createElement('span');
            rPill.className = 'meta-pill restricted';
            rPill.textContent = '🔒 Restricted';
            meta.appendChild(rPill);
        }
    }

    const infoEl = document.getElementById('detail-info');
    if (infoEl) infoEl.textContent = data.info || 'No information available.';
    
    const hoursEl = document.getElementById('detail-hours');
    if (hoursEl) hoursEl.textContent = data.hours ? `🕐 ${data.hours}` : '';

    document.querySelectorAll('.node').forEach(n => n.classList.remove('active-select'));
    document.getElementById(`node-${name}`)?.classList.add('active-select');

    if (triggerPath) {
        document.getElementById('end-node').value = name;
        updateNodeClasses();
        calculatePath(false, false);
    }
}

// ─── Node Classes ─────────────────────────────────────────────────────────────
function updateNodeClasses() {
    const numEl = document.getElementById('num-persons');
    const num = numEl ? parseInt(numEl.value, 10) : 1;
    
    const startSelects = document.querySelectorAll('.start-node-select');
    const starts = Array.from(startSelects).map(s => s.value);
    
    let ends = [];
    if (num === 1) {
        const endNode = document.getElementById('end-node');
        if (endNode) ends.push(endNode.value);
    } else {
        const endSelects = document.querySelectorAll('.end-node-select');
        ends = Array.from(endSelects).map(s => s.value);
    }
    
    document.querySelectorAll('.node').forEach(n => {
        n.classList.remove('start', 'end', 'meeting-point');
        const nodeName = n.id.replace('node-', '');
        if (starts.includes(nodeName)) {
            n.classList.add('start');
        }
        if (ends.includes(nodeName)) {
            n.classList.add('end');
        }
    });
}

// ─── Toggle Crowded ───────────────────────────────────────────────────────────
function toggleCrowded(pair) {
    const el = document.getElementById(`conn-${pair}`);
    if (crowdedPaths.has(pair)) {
        crowdedPaths.delete(pair);
        el.classList.remove('crowded');
    } else {
        crowdedPaths.add(pair);
        el.classList.add('crowded');
    }
}

// ─── Calculate Path ────────────────────────────────────────────────────────────
async function calculatePath(isEmergency = false, forceShowDirections = false) {
    const numEl = document.getElementById('num-persons');
    const num = numEl ? parseInt(numEl.value, 10) : 1;
    const algo = document.getElementById('algo-select').value;
    const avoidCrowds = document.getElementById('avoid-crowds').checked;
    const wheelchair  = document.getElementById('wheelchair-access').checked;
    
    if (isAnimating) return; // Prevent overlap
    isAnimating = true;

    let persons = [];
    let endNode = "ER";
    
    if (num === 1) {
        if (isEmergency) {
            document.getElementById('end-node').value = "ER";
            document.body.classList.add('emergency-active');
        } else {
            document.body.classList.remove('emergency-active');
        }
        const startVal = document.getElementById('start-node-0')?.value || currentStart;
        const endVal = document.getElementById('end-node')?.value || currentEnd;
        endNode = endVal;
        persons.push({ start: startVal, end: endVal });
    } else {
        document.body.classList.remove('emergency-active');
        for (let i = 0; i < num; i++) {
            const startVal = document.getElementById(`start-node-${i}`)?.value;
            const endVal = document.getElementById(`end-node-${i}`)?.value;
            if (startVal && endVal) {
                persons.push({ start: startVal, end: endVal });
            }
        }
    }

    resetVisualization();

    const btn = document.getElementById('find-path-btn');
    const calcLabel = (typeof window.t === 'function') ? window.t('calculating') : '⏳ Calculating...';
    btn.textContent = calcLabel;
    btn.disabled = true;

    try {
        const res = await fetch('/find-path', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
                persons, algo,
                crowded: avoidCrowds && !isEmergency ? Array.from(crowdedPaths).map(p => p.split('-')) : [],
                wheelchair,
                isEmergency
            })
        });

        if (!res.ok) throw new Error(`HTTP error! status: ${res.status}`);

        const result = await res.json();
        if (result.error) {
            showToast('⚠️ ' + result.error, 'error');
            return;
        }

        lastPathResult = result;

        if (result.is_multi) {
            updateStats(null, result.explored.length, result.total_cost, algo, wheelchair, true, result);
            renderMultiDirections(result, forceShowDirections);
            await animateMultiPathfinding(result, isEmergency);
            selectNode(result.meeting_point, false);
            
        } else {
            renderDirections(result.directions, forceShowDirections, result.f_g_h_values);
            updateStats(result.path, result.explored.length, result.total_cost, algo, wheelchair, false, result);
            await animatePathfinding(result.explored, result.path, isEmergency);
            selectNode(endNode, false);
        }
    } catch (err) {
        console.error('Navigation Error Trace:', err);
        const errorMsg = (err && err.message) ? err.message : 'Unknown system error';
        showToast(`❌ Error: ${errorMsg}. Please refresh.`, 'error');
    } finally {
        const doneLabel = (typeof window.t === 'function') ? window.t('calc_path') : 'Calculate Best Path';
        btn.textContent = doneLabel;
        btn.disabled = false;
        isAnimating = false;
    }
}

// ─── Animation ────────────────────────────────────────────────────────────────
async function animatePathfinding(explored, path, isEmergency = false) {
    for (let i = 0; i < explored.length; i++) {
        const el = document.getElementById(`node-${explored[i]}`);
        if (el) el.classList.add('path-finding');
        await delay(30);
    }
    
    for (let i = 0; i < path.length; i++) {
        const el = document.getElementById(`node-${path[i]}`);
        if (el) { 
            el.classList.remove('path-finding'); 
            el.classList.add('active'); 
        }
        if (i > 0) {
            const pair = [path[i-1], path[i]].sort().join('-');
            const conn = document.getElementById(`conn-${pair}`);
            if (conn) {
                conn.classList.add('active');
                if (isEmergency) conn.classList.add('emergency-path');
            }
            const wpill = document.getElementById(`wpill-${pair}`);
            const wlbl  = document.getElementById(`wlbl-${pair}`);
            if (wpill) {
                wpill.setAttribute('fill', 'rgba(234,179,8,0.45)');
                wpill.setAttribute('stroke', '#facc15');
                wpill.setAttribute('stroke-width', '2.5');
            }
            if (wlbl) { wlbl.setAttribute('fill', '#fff'); wlbl.setAttribute('font-size', '14px'); }
        }
        await delay(100);
    }
}

async function animateMultiPathfinding(result, isEmergency) {
    drawMultiPersonRoutes(result);
    
    const legend = document.getElementById('multi-person-legend');
    if (legend) legend.style.display = 'flex';
    const legendDiv = document.getElementById('multi-person-legend-divider');
    if (legendDiv) legendDiv.style.display = 'block';

    const explored = result.explored || [];
    for (let i = 0; i < explored.length; i++) {
        const el = document.getElementById(`node-${explored[i]}`);
        if (el) el.classList.add('path-finding');
        await delay(15);
    }

    // Paths from start to meeting point
    const meetPaths = result.persons_data.map(p => p.path_to_meet);
    const maxMeetLength = Math.max(...meetPaths.map(p => p.length));

    for (let step = 0; step < maxMeetLength; step++) {
        for (let pIdx = 0; pIdx < meetPaths.length; pIdx++) {
            const path = meetPaths[pIdx];
            if (step < path.length) {
                const node = path[step];
                const el = document.getElementById(`node-${node}`);
                if (el) {
                    el.classList.remove('path-finding');
                    el.classList.add('active');
                }
                if (step > 0) {
                    const prevNode = path[step - 1];
                    const pair = [prevNode, node].sort().join('-');
                    const dynLine = document.getElementById(`dyn-route-${pIdx}-${pair}`);
                    if (dynLine) dynLine.style.opacity = '1';
                }
            }
        }
        await delay(100);
    }

    // Highlight meeting point
    const meetingNode = result.meeting_point;
    const mEl = document.getElementById(`node-${meetingNode}`);
    if (mEl) mEl.classList.add('meeting-point');
    await delay(300);

    // Paths from meeting point to individual destinations
    const destPaths = result.persons_data.map(p => p.path_from_meet);
    const maxDestLength = Math.max(...destPaths.map(p => p.length));

    for (let step = 0; step < maxDestLength; step++) {
        for (let pIdx = 0; pIdx < destPaths.length; pIdx++) {
            const path = destPaths[pIdx];
            if (step < path.length) {
                const node = path[step];
                const el = document.getElementById(`node-${node}`);
                if (el) {
                    el.classList.remove('path-finding');
                    el.classList.add('active');
                }
                if (step > 0) {
                    const prevNode = path[step - 1];
                    const pair = [prevNode, node].sort().join('-');
                    const dynLine = document.getElementById(`dyn-route-${pIdx}-${pair}`);
                    if (dynLine) dynLine.style.opacity = '1';
                }
            }
        }
        await delay(100);
    }
}

function drawMultiPersonRoutes(result) {
    const group = document.getElementById('active-routes-group');
    if (!group) return;
    group.innerHTML = '';
    
    // Map edge -> { pIdx, from, to }
    const edgeMap = {};
    
    result.persons_data.forEach((pData, pIdx) => {
        const fullPath = [...pData.path_to_meet];
        if (fullPath.length > 0 && pData.path_from_meet.length > 0) {
            if (fullPath[fullPath.length - 1] === pData.path_from_meet[0]) {
                fullPath.pop(); // Remove duplicate meeting point
            }
        }
        fullPath.push(...pData.path_from_meet);
        
        for (let i = 1; i < fullPath.length; i++) {
            const from = fullPath[i-1];
            const to = fullPath[i];
            const pair = [from, to].sort().join('-');
            if (!edgeMap[pair]) edgeMap[pair] = [];
            edgeMap[pair].push({ pIdx, from, to });
        }
        
        // Draw start and end rings
        const startNode = hospitalData[pData.start];
        if (startNode) {
            const ring = document.createElementNS("http://www.w3.org/2000/svg", "circle");
            ring.setAttribute("cx", startNode.x);
            ring.setAttribute("cy", startNode.y);
            ring.setAttribute("r", "35");
            ring.setAttribute("class", `route-marker-ring person-route-${pIdx % 6}`);
            ring.dataset.pidx = String(pIdx);
            group.appendChild(ring);
        }
        
        const endNode = hospitalData[pData.end];
        if (endNode) {
            const ring = document.createElementNS("http://www.w3.org/2000/svg", "circle");
            ring.setAttribute("cx", endNode.x);
            ring.setAttribute("cy", endNode.y);
            ring.setAttribute("r", "35");
            ring.setAttribute("class", `route-marker-ring person-route-${pIdx % 6}`);
            ring.dataset.pidx = String(pIdx);
            group.appendChild(ring);
        }
    });

    const GAP = 12; // pixels between parallel lines
    const personColors = ['#3b82f6', '#22c55e', '#a855f7', '#f97316', '#f43f5e', '#eab308'];
    
    Object.keys(edgeMap).forEach(pair => {
        const traversals = edgeMap[pair];
        const n1 = hospitalData[pair.split('-')[0]];
        const n2 = hospitalData[pair.split('-')[1]];
        if (!n1 || !n2) return;
        
        const x1 = n1.x, y1 = n1.y;
        const x2 = n2.x, y2 = n2.y;
        
        const dx = x2 - x1;
        const dy = y2 - y1;
        const len = Math.sqrt(dx*dx + dy*dy);
        const nx = -dy / len;
        const ny = dx / len;
        
        const count = traversals.length;
        
        traversals.forEach((trav, i) => {
            const offset = (i - (count - 1) / 2) * GAP;
            
            let startX = x1 + nx * offset;
            let startY = y1 + ny * offset;
            let endX = x2 + nx * offset;
            let endY = y2 + ny * offset;
            
            // Swap start/end if travel direction is opposite to line direction
            // so stroke-dashoffset animation flows correctly
            if (trav.from === pair.split('-')[1]) {
                const tempX = startX; const tempY = startY;
                startX = endX; startY = endY;
                endX = tempX; endY = tempY;
            }
            
            const line = document.createElementNS("http://www.w3.org/2000/svg", "line");
            line.setAttribute("x1", startX);
            line.setAttribute("y1", startY);
            line.setAttribute("x2", endX);
            line.setAttribute("y2", endY);
            line.setAttribute("class", `dynamic-route-line person-route-${trav.pIdx % 6}`);
            line.dataset.pidx = String(trav.pIdx);
            line.style.opacity = '0';
            line.id = `dyn-route-${trav.pIdx}-${pair}`;
            
            group.appendChild(line);
        });
        
        if (count > 1) {
            const mx = x1 + dx/2;
            const my = y1 + dy/2;
            
            const lblGroup = document.createElementNS("http://www.w3.org/2000/svg", "g");
            lblGroup.setAttribute("class", "shared-segment-label-group");
            lblGroup.dataset.pidxs = traversals.map(t => t.pIdx).join(',');
            
            traversals.forEach((trav, i) => {
                const ox = mx + (i - (count-1)/2) * 16;
                const oy = my - 15;
                
                const rect = document.createElementNS("http://www.w3.org/2000/svg", "rect");
                rect.setAttribute("x", ox - 7);
                rect.setAttribute("y", oy - 7);
                rect.setAttribute("width", 14);
                rect.setAttribute("height", 14);
                rect.setAttribute("class", "shared-segment-label-rect");
                rect.setAttribute("fill", personColors[trav.pIdx % 6]);
                
                const txt = document.createElementNS("http://www.w3.org/2000/svg", "text");
                txt.setAttribute("x", ox);
                txt.setAttribute("y", oy + 3);
                txt.setAttribute("class", "shared-segment-label-text");
                txt.textContent = `P${trav.pIdx + 1}`;
                
                lblGroup.appendChild(rect);
                lblGroup.appendChild(txt);
            });
            group.appendChild(lblGroup);
        }
    });
}

function delay(ms) { return new Promise(r => setTimeout(r, ms)); }

// ─── Reset ────────────────────────────────────────────────────────────────────
function resetVisualization() {
    lastPathResult = null;
    const group = document.getElementById('active-routes-group');
    if (group) group.innerHTML = '';
    
    const legend = document.getElementById('multi-person-legend');
    if (legend) legend.style.display = 'none';
    const legendDiv = document.getElementById('multi-person-legend-divider');
    if (legendDiv) legendDiv.style.display = 'none';

    document.querySelectorAll('.node').forEach(n => {
        n.classList.remove('active', 'path-finding', 'meeting-point');
    });
    document.querySelectorAll('.connection').forEach(c => {
        c.classList.remove(
            'active', 'emergency-path', 
            'person-0', 'person-1', 'person-2', 'person-3', 'person-4', 'person-5', 
            'meeting-to-dest',
            'person-0-to-dest', 'person-1-to-dest', 'person-2-to-dest', 'person-3-to-dest', 'person-4-to-dest', 'person-5-to-dest'
        );
        c.style.stroke = '';
        c.style.filter = '';
    });
    document.querySelectorAll('.weight-pill').forEach(p => {
        const df = p.dataset.defaultFill   || 'rgba(56,189,248,0.18)';
        const ds = p.dataset.defaultStroke || 'rgba(56,189,248,0.7)';
        p.setAttribute('fill',   df);
        p.setAttribute('stroke', ds);
        p.setAttribute('stroke-width', '1.5');
    });
    document.querySelectorAll('.weight-label').forEach(l => {
        l.setAttribute('fill', l.dataset.defaultColor || '#38bdf8');
        l.setAttribute('font-size', '13px');
    });
}

// ─── Stats Panel ──────────────────────────────────────────────────────────────
function updateStats(path, exploredLen, totalCost, algo, wheelchair, isMulti = false, result = null) {
    const statsEl = document.getElementById('stats-panel');
    statsEl.classList.remove('hidden');
    statsEl.style.display = 'block';
    
    if (isMulti && result) {
        const meetingNodeName = result.meeting_point_info.name;
        const meetingNodeIcon = result.meeting_point_info.icon;
        
        document.getElementById('stat-steps').textContent = `${meetingNodeIcon} ${meetingNodeName}`;
        document.getElementById('stat-explored').textContent = exploredLen;
        document.getElementById('stat-dist').textContent = `${totalCost} units (Min-Max)`;
        document.getElementById('stat-algo').textContent = "MINIMAX Center";
        
        let maxEta = 0;
        result.persons_data.forEach(pData => {
            const meetLen = pData.path_to_meet.length;
            const destLen = pData.path_from_meet.length;
            let pEta = ((meetLen > 0 ? meetLen - 1 : 0) + (destLen > 0 ? destLen - 1 : 0)) * 2;
            if (wheelchair) pEta = Math.ceil(pEta * 1.5);
            maxEta = Math.max(maxEta, pEta);
        });
        
        document.getElementById('stat-eta').textContent = `~${maxEta} mins`;
        
        let breakdown = document.getElementById('stats-breakdown');
        if (!breakdown) {
            breakdown = document.createElement('div');
            breakdown.id = 'stats-breakdown';
            breakdown.style.marginTop = '1rem';
            breakdown.style.paddingTop = '1rem';
            breakdown.style.borderTop = '1px dashed var(--glass-border)';
            document.getElementById('stats-panel').appendChild(breakdown);
        }
        
        const personColors = ['#38bdf8', '#4ade80', '#a78bfa', '#facc15', '#f43f5e', '#34d399'];
        let breakdownHtml = `<h4 style="font-size:0.75rem;margin-bottom:0.5rem;color:var(--text-secondary);text-transform:uppercase;">👤 Individual Costs:</h4>`;
        breakdownHtml += `<div class="stat-sub-list">`;
        
        result.persons_data.forEach((pData, idx) => {
            const col = personColors[idx % 6];
            const nameStart = pData.start.replace(/_/g, ' ');
            const nameEnd = pData.end.replace(/_/g, ' ');
            breakdownHtml += `
                <div class="stat-sub-item" style="flex-direction:column; align-items:flex-start; gap:0.2rem; border-bottom:1.5px solid rgba(255,255,255,0.02); padding-bottom:0.4rem; margin-bottom:0.4rem;">
                    <div style="display:flex; justify-content:space-between; width:100%;">
                        <strong style="color:${col};">Person ${idx+1}:</strong>
                        <span style="font-weight:700;">${pData.total_cost} units</span>
                    </div>
                    <div style="font-size:0.72rem; color:var(--text-secondary); display:flex; justify-content:space-between; width:100%; padding-left:0.5rem;">
                        <span>${nameStart} ➔ Meet:</span>
                        <span>${pData.cost_to_meet}</span>
                    </div>
                    <div style="font-size:0.72rem; color:var(--text-secondary); display:flex; justify-content:space-between; width:100%; padding-left:0.5rem;">
                        <span>Meet ➔ ${nameEnd}:</span>
                        <span>${pData.cost_from_meet}</span>
                    </div>
                </div>`;
        });
        breakdownHtml += `</div>`;
        breakdown.innerHTML = breakdownHtml;
        
    } else {
        const breakdown = document.getElementById('stats-breakdown');
        if (breakdown) breakdown.remove();
        
        document.getElementById('stat-steps').textContent = path.length;
        document.getElementById('stat-explored').textContent = exploredLen;
        document.getElementById('stat-dist').textContent = `${totalCost} units`;
        document.getElementById('stat-algo').textContent = algo;
        if(result && result.metrics) {
            const memoryEl = document.getElementById('stat-memory');
            const runtimeEl = document.getElementById('stat-runtime');
            if(memoryEl) memoryEl.textContent = `${result.metrics.peak_memory_kb.toFixed(2)} KB`;
            if(runtimeEl) runtimeEl.textContent = `${result.metrics.runtime_ms} ms`;
        }
        let eta = (path.length - 1) * 2;
        if (wheelchair) eta = Math.ceil(eta * 1.5);
        if (eta < 1) eta = 1;
        document.getElementById('stat-eta').textContent = `~${eta} mins`;
    }

    setTimeout(() => {
        statsEl.scrollIntoView({ behavior: 'smooth', block: 'nearest' });
    }, 200);
}

// ─── Directions Panel (Right Overlay) ──────────────────────────────────────────
function renderDirections(directions, forceShow = false, fghValues = null) {
    if (!directions || !directions.length) return;
    
    // Hide tabs if active from a previous multi-person navigation
    const tabContainer = document.getElementById('directions-tabs');
    if (tabContainer) tabContainer.style.display = 'none';

    // Clear any path opacities/highlights
    document.querySelectorAll('.connection').forEach(c => {
        c.style.opacity = '';
        c.style.filter = '';
    });
    document.querySelectorAll('.node').forEach(n => {
        n.style.opacity = '';
    });

    const panel = document.getElementById('directions-panel');
    
    if (forceShow) {
        panel.classList.remove('hidden');
        panel.style.display = 'flex';
    }
    const list = document.getElementById('directions-list');
    list.innerHTML = '';

    directions.forEach((d, i) => {
        const li = document.createElement('li');
        let stepClass = 'dir-overlay-step';
        if (i === 0) stepClass += ' step-first';
        else if (i === directions.length - 1) stepClass += ' step-last';

        // ── Edge weight for this step ────────────────────────────────────────
        let edgeWeightHtml = '';
        if (i > 0) {
            const prevNode = directions[i - 1].node;
            const pair = [prevNode, d.node].sort().join('-');
            const connEl = document.getElementById(`conn-${pair}`);
            const w = connEl ? connEl.dataset.weight : null;
            if (w !== null && w !== undefined) {
                edgeWeightHtml = `<span style="
                    display:inline-flex; align-items:center; gap:3px;
                    font-size:0.72rem; font-weight:700; font-family:monospace;
                    background:rgba(234,179,8,0.15); color:#facc15;
                    border:1px solid rgba(234,179,8,0.4); border-radius:5px;
                    padding:1px 7px; margin-top:4px;
                ">⚖️ Edge cost: ${w}</span>`;
            }
        }

        // ── f/g/h values ─────────────────────────────────────────────────────
        let fghHtml = '';
        if (fghValues) {
            const fgh = fghValues.find(v => v.node === d.node);
            if (fgh) {
                fghHtml = `<div style="
                    display:grid; grid-template-columns:1fr 1fr 1fr;
                    gap:4px; font-size:0.73rem; font-family:monospace;
                    margin-top:0.5rem; padding:0.45rem;
                    background:rgba(167,139,250,0.08);
                    border-radius:6px; border:1px solid rgba(167,139,250,0.25);
                ">
                    <span style="text-align:center;">
                        <div style="color:#94a3b8;font-size:0.65rem;">g(n)</div>
                        <div style="color:#38bdf8;font-weight:700;">${fgh.g}</div>
                        <div style="color:#475569;font-size:0.6rem;">cost so far</div>
                    </span>
                    <span style="text-align:center;border-left:1px solid rgba(255,255,255,0.1);border-right:1px solid rgba(255,255,255,0.1);">
                        <div style="color:#94a3b8;font-size:0.65rem;">h(n)</div>
                        <div style="color:#a78bfa;font-weight:700;">${fgh.h}</div>
                        <div style="color:#475569;font-size:0.6rem;">heuristic</div>
                    </span>
                    <span style="text-align:center;">
                        <div style="color:#94a3b8;font-size:0.65rem;">f(n)</div>
                        <div style="color:#4ade80;font-weight:700;">${fgh.f}</div>
                        <div style="color:#475569;font-size:0.6rem;">g + h</div>
                    </span>
                </div>`;
            }
        }

        li.className = stepClass;
        li.style.cursor = 'pointer';
        li.innerHTML = `
            <div class="dir-step-badge">${d.step}</div>
            <div class="dir-step-body">
                <div class="dir-step-icon-text">
                    <span class="dir-step-emoji">${d.icon}</span>
                    <span class="dir-step-instruction">${d.instruction}</span>
                </div>
                <span class="dir-step-floor-tag">Floor ${d.floor}</span>
                ${edgeWeightHtml}
                ${fghHtml}
            </div>
        `;
        li.onclick = () => {
            selectNode(d.node, false);
            const nodeEl = document.getElementById(`node-${d.node}`);
            if (nodeEl) {
                nodeEl.scrollIntoView({ behavior: 'smooth', block: 'center', inline: 'center' });
                const circle = nodeEl.querySelector('circle');
                circle.style.transition = 'all 0.3s';
                circle.style.r = '35';
                setTimeout(() => circle.style.r = '22', 500);
            }
        };
        list.appendChild(li);
    });
}

function renderMultiDirections(result, forceShow = false) {
    const panel = document.getElementById('directions-panel');
    if (forceShow) {
        panel.classList.remove('hidden');
        panel.style.display = 'flex';
    }
    
    // Get or create tab container
    let tabContainer = document.getElementById('directions-tabs');
    if (!tabContainer) {
        tabContainer = document.createElement('div');
        tabContainer.id = 'directions-tabs';
        tabContainer.className = 'directions-tabs';
        tabContainer.style.cssText = 'display: flex; gap: 0.5rem; padding: 0.8rem 1.2rem; border-bottom: 1px solid var(--glass-border); overflow-x: auto; background: rgba(0,0,0,0.15); flex-shrink: 0;';
        const header = document.querySelector('.directions-overlay-header');
        if (header) {
            header.parentNode.insertBefore(tabContainer, header.nextSibling);
        }
    }
    tabContainer.style.display = 'flex';
    tabContainer.innerHTML = '';
    
    const personColors = ['#38bdf8', '#4ade80', '#a78bfa', '#facc15', '#f43f5e', '#34d399'];
    
    // Helper to draw the actual list items for a given list of directions
    function showDirectionsList(dirs) {
        const list = document.getElementById('directions-list');
        list.innerHTML = '';
        dirs.forEach((d, i) => {
            const li = document.createElement('li');
            let stepClass = 'dir-overlay-step';
            if (i === 0) stepClass += ' step-first';
            else if (i === dirs.length - 1) stepClass += ' step-last';
            
            let edgeWeightHtml = '';
            if (i > 0 && d.node && dirs[i - 1].node) {
                const pair = [dirs[i - 1].node, d.node].sort().join('-');
                const connEl = document.getElementById(`conn-${pair}`);
                const w = connEl ? connEl.dataset.weight : null;
                if (w !== null && w !== undefined) {
                    edgeWeightHtml = `<span style="
                        display:inline-flex; align-items:center; gap:3px;
                        font-size:0.72rem; font-weight:700; font-family:monospace;
                        background:rgba(234,179,8,0.15); color:#facc15;
                        border:1px solid rgba(234,179,8,0.4); border-radius:5px;
                        padding:1px 7px; margin-top:4px;
                    ">⚖️ Edge cost: ${w}</span>`;
                }
            }
            
            li.className = stepClass;
            li.style.cursor = 'pointer';
            li.innerHTML = `
                <div class="dir-step-badge">${d.step}</div>
                <div class="dir-step-body">
                    <div class="dir-step-icon-text">
                        <span class="dir-step-emoji">${d.icon}</span>
                        <span class="dir-step-instruction">${d.instruction}</span>
                    </div>
                    <span class="dir-step-floor-tag">Floor ${d.floor}</span>
                    ${edgeWeightHtml}
                </div>
            `;
            li.onclick = () => {
                selectNode(d.node, false);
                const nodeEl = document.getElementById(`node-${d.node}`);
                if (nodeEl) {
                    nodeEl.scrollIntoView({ behavior: 'smooth', block: 'center', inline: 'center' });
                    const circle = nodeEl.querySelector('circle');
                    circle.style.transition = 'all 0.3s';
                    circle.style.r = '35';
                    setTimeout(() => circle.style.r = '22', 500);
                }
            };
            list.appendChild(li);
        });
    }
    
    // Build directions for a single person
    function getPersonDirections(pData, idx) {
        let dirs = [];
        const col = personColors[idx % 6];
        
        dirs.push({
            step: "START",
            icon: "👤",
            floor: hospitalData[pData.start].floor,
            instruction: `<strong style="color:${col}; font-weight: 800;">Person ${idx+1} Journey</strong>`
        });
        
        pData.directions_to_meet.forEach(d => {
            dirs.push({ step: d.step, icon: d.icon, floor: d.floor, instruction: d.instruction, node: d.node });
        });
        
        dirs.push({
            step: "MEET",
            icon: "🤝",
            floor: result.meeting_point_info.floor,
            instruction: `<strong style="color:#fb923c; font-weight: 800;">Meeting Point</strong> (${result.meeting_point_info.name})`
        });
        
        pData.directions_from_meet.forEach(d => {
            dirs.push({ step: d.step, icon: d.icon, floor: d.floor, instruction: d.instruction, node: d.node });
        });
        
        return dirs;
    }
    
    // Build combined "All" directions
    function getAllDirections() {
        let allDirs = [];
        result.persons_data.forEach((pData, idx) => {
            const dirs = getPersonDirections(pData, idx);
            allDirs = allDirs.concat(dirs);
        });
        return allDirs;
    }
    
    // Render tab buttons
    // 1. All Button
    const btnAll = document.createElement('button');
    btnAll.textContent = 'All Routes';
    btnAll.className = 'tab-chip active';
    btnAll.onclick = () => {
        document.querySelectorAll('.tab-chip').forEach(b => b.classList.remove('active'));
        btnAll.classList.add('active');
        showDirectionsList(getAllDirections());
        highlightPathForPerson('all');
    };
    tabContainer.appendChild(btnAll);
    
    // 2. Individual Buttons
    result.persons_data.forEach((pData, idx) => {
        const btn = document.createElement('button');
        btn.textContent = `Person ${idx + 1}`;
        btn.className = 'tab-chip';
        btn.style.borderColor = personColors[idx % 6] + '55';
        btn.style.color = personColors[idx % 6];
        btn.onclick = () => {
            document.querySelectorAll('.tab-chip').forEach(b => b.classList.remove('active'));
            btn.classList.add('active');
            showDirectionsList(getPersonDirections(pData, idx));
            highlightPathForPerson(idx);
        };
        tabContainer.appendChild(btn);
    });
    
    // Initially show All
    showDirectionsList(getAllDirections());
    highlightPathForPerson('all');
}

function highlightPathForPerson(selectedIdx) {
    if (!lastPathResult || !lastPathResult.is_multi) return;
    
    if (selectedIdx === 'all') {
        // Restore all lines
        document.querySelectorAll('.dynamic-route-line').forEach(l => l.classList.remove('dimmed'));
        document.querySelectorAll('.route-marker-ring').forEach(r => r.classList.remove('dimmed'));
        document.querySelectorAll('.shared-segment-label-group').forEach(g => g.classList.remove('dimmed'));
        
        document.querySelectorAll('.node').forEach(n => {
            n.style.opacity = '1';
        });
        restoreActivePath();
        return;
    }
    
    const pData = lastPathResult.persons_data[selectedIdx];
    const pathNodes = new Set([...pData.path_to_meet, ...pData.path_from_meet]);
    
    // Dim other nodes
    document.querySelectorAll('.node').forEach(n => {
        const nodeName = n.id.replace('node-', '');
        if (pathNodes.has(nodeName) || nodeName === lastPathResult.meeting_point) {
            n.style.opacity = '1';
        } else {
            n.style.opacity = '0.15';
        }
    });
    
    // Dim other routes and markers
    document.querySelectorAll('.dynamic-route-line').forEach(l => {
        if (l.dataset.pidx === String(selectedIdx)) l.classList.remove('dimmed');
        else l.classList.add('dimmed');
    });
    
    document.querySelectorAll('.route-marker-ring').forEach(r => {
        if (r.dataset.pidx === String(selectedIdx)) r.classList.remove('dimmed');
        else r.classList.add('dimmed');
    });
    
    document.querySelectorAll('.shared-segment-label-group').forEach(g => {
        const pidxs = g.dataset.pidxs.split(',');
        if (pidxs.includes(String(selectedIdx))) g.classList.remove('dimmed');
        else g.classList.add('dimmed');
    });
}

// ─── Toast Notification ────────────────────────────────────────────────────────
function showToast(msg, type = 'info') {
    const t = document.createElement('div');
    t.className = `toast toast-${type}`;
    t.textContent = msg;
    document.body.appendChild(t);
    setTimeout(() => t.classList.add('show'), 10);
    setTimeout(() => { t.classList.remove('show'); setTimeout(() => t.remove(), 400); }, 3500);
}

// ─── Event Listeners ──────────────────────────────────────────────────────────
if (document.getElementById('hospital-map')) {
    document.getElementById('find-path-btn').onclick  = () => calculatePath(false, true);
    document.getElementById('emergency-btn').onclick  = () => calculatePath(true, true);
    
    const numPersonsEl = document.getElementById('num-persons');
    if (numPersonsEl) {
        numPersonsEl.onchange = () => {
            updateNumPersons();
            updateNodeClasses();
            calculatePath(false, false);
        };
    }
    
    document.getElementById('end-node').onchange      = () => { updateNodeClasses(); calculatePath(false, false); };
    document.getElementById('avoid-crowds').onchange  = () => calculatePath(false, false);
    document.getElementById('wheelchair-access').onchange = () => calculatePath(false, false);
    document.getElementById('algo-select').onchange   = () => calculatePath(false, false);
    document.getElementById('close-directions').onclick = () => {
        const panel = document.getElementById('directions-panel');
        panel.classList.add('hidden');
        panel.style.display = 'none';
        renderMap(); // Recalculate zoom
    };
    document.getElementById('show-directions-btn').onclick = () => {
        const panel = document.getElementById('directions-panel');
        panel.classList.remove('hidden');
        panel.style.display = 'flex';
        renderMap(); // Shift map left
    };

    // Quick Search Filter
    document.getElementById('nav-search').oninput = (e) => {
        const query = e.target.value.toLowerCase();
        const selects = [document.getElementById('start-node'), document.getElementById('end-node')];
        
        selects.forEach(sel => {
            const groups = sel.querySelectorAll('optgroup');
            groups.forEach(group => {
                let hasVisible = false;
                const options = group.querySelectorAll('option');
                options.forEach(opt => {
                    const match = opt.text.toLowerCase().includes(query);
                    opt.style.display = match ? '' : 'none';
                    if (match) hasVisible = true;
                });
                group.style.display = hasVisible ? '' : 'none';
            });
        });

        // Also highlight nodes on map that match
        document.querySelectorAll('.node').forEach(node => {
            const name = node.id.replace('node-', '').toLowerCase();
            if (query && name.includes(query)) {
                node.style.filter = 'brightness(1.5) drop-shadow(0 0 10px var(--accent-blue))';
                node.style.opacity = '1';
            } else if (query) {
                node.style.filter = '';
                node.style.opacity = '0.3';
            } else {
                node.style.filter = '';
                applyFloorFilter(); // Restore normal floor visibility
            }
        });
    };
    init();
}


// ─── Theme Toggle ─────────────────────────────────────────────────────────────
const themeBtn = document.getElementById('theme-toggle');
const body     = document.body;
const icon     = document.getElementById('theme-icon');

function setTheme(isLight) {
    if (isLight) {
        body.classList.add('light-theme');
        icon.innerHTML = '<path d="M21 12.79A9 9 0 1 1 11.21 3 7 7 0 0 0 21 12.79z"></path>';
        localStorage.setItem('theme', 'light');
    } else {
        body.classList.remove('light-theme');
        icon.innerHTML = '<circle cx="12" cy="12" r="5"></circle><line x1="12" y1="1" x2="12" y2="3"></line><line x1="12" y1="21" x2="12" y2="23"></line><line x1="4.22" y1="4.22" x2="5.64" y2="5.64"></line><line x1="18.36" y1="18.36" x2="19.78" y2="19.78"></line><line x1="1" y1="12" x2="3" y2="12"></line><line x1="21" y1="12" x2="23" y2="12"></line><line x1="4.22" y1="19.78" x2="5.64" y2="18.36"></line><line x1="18.36" y1="5.64" x2="19.78" y2="4.22"></line>';
        localStorage.setItem('theme', 'dark');
    }

    // Safari repaint fix for CSS Variables, Backdrop Filter, and Pseudo-elements
    const forceRepaint = () => {
        const origDisplay = body.style.display;
        body.style.display = 'none';
        void body.offsetHeight;
        body.style.display = origDisplay;

        const allEls = document.querySelectorAll('*');
        allEls.forEach(el => {
            const style = window.getComputedStyle(el);
            if (style.backdropFilter !== 'none' || style.webkitBackdropFilter !== 'none') {
                const elDisplay = style.display;
                el.style.display = 'none';
                void el.offsetHeight;
                el.style.display = elDisplay;
            }
        });
    };
    forceRepaint();
    setTimeout(forceRepaint, 50);
}

if (themeBtn) {
    themeBtn.addEventListener('click', () => setTheme(!body.classList.contains('light-theme')));
}
const savedTheme = localStorage.getItem('theme');
setTheme(savedTheme === 'light');

// ─── Scroll Reveal Logic ───────────────────────────────────────────────
function reveal() {
    var reveals = document.querySelectorAll(".reveal");
    for (var i = 0; i < reveals.length; i++) {
        var windowHeight = window.innerHeight;
        var elementTop = reveals[i].getBoundingClientRect().top;
        var elementVisible = 150;
        if (elementTop < windowHeight - elementVisible) {
            reveals[i].classList.add("active");
        }
    }
}
window.addEventListener("scroll", reveal);
// Run once on load
setTimeout(reveal, 100);


/* ==========================================================================
   PREMIUM UPGRADES CODE SUITE
   ========================================================================== */

// --- 1. SVG PATH NAVIGATION SIMULATOR BEACON ---
let simulationTimers = [];

function startPathSimulation(path, wheelchair, isEmergency) {
    const svg = document.getElementById('hospital-map');
    if (!svg || !path || path.length === 0) return;
    
    // Clear any active simulation timers
    simulationTimers.forEach(clearTimeout);
    simulationTimers = [];
    
    // Clear old beacon elements
    document.querySelectorAll('#path-navigator-beacon, #beacon-pulse-ring, .multi-beacon, .multi-ring').forEach(el => el.remove());
    
    // Create pulsing ring overlay
    const ring = document.createElementNS("http://www.w3.org/2000/svg", "circle");
    ring.setAttribute("id", "beacon-pulse-ring");
    ring.setAttribute("class", "beacon-pulse-ring");
    ring.setAttribute("fill", "none");
    ring.setAttribute("stroke", isEmergency ? "var(--accent-red)" : "var(--accent-blue)");
    ring.setAttribute("stroke-width", "3");
    ring.setAttribute("r", "16");
    
    // Create beacon representation group
    const beacon = document.createElementNS("http://www.w3.org/2000/svg", "g");
    beacon.setAttribute("id", "path-navigator-beacon");
    
    const bgCircle = document.createElementNS("http://www.w3.org/2000/svg", "circle");
    bgCircle.setAttribute("r", "15");
    bgCircle.setAttribute("fill", isEmergency ? "var(--accent-red)" : "var(--accent-blue)");
    bgCircle.setAttribute("stroke", "white");
    bgCircle.setAttribute("stroke-width", "2.5");
    bgCircle.setAttribute("style", "filter: drop-shadow(0 2px 5px rgba(0,0,0,0.4));");
    
    const iconTxt = document.createElementNS("http://www.w3.org/2000/svg", "text");
    iconTxt.setAttribute("text-anchor", "middle");
    iconTxt.setAttribute("y", "4");
    iconTxt.setAttribute("font-size", "13px");
    iconTxt.setAttribute("fill", "white");
    iconTxt.textContent = isEmergency ? "🚑" : (wheelchair ? "♿" : "🚶");
    
    beacon.appendChild(bgCircle);
    beacon.appendChild(iconTxt);
    
    const nodesGroup = document.getElementById('nodes-group');
    if (nodesGroup) {
        nodesGroup.parentNode.insertBefore(ring, nodesGroup);
        nodesGroup.parentNode.insertBefore(beacon, nodesGroup);
    }
    
    // Animate beacon along path
    animateStep(0);
    
    function animateStep(stepIdx) {
        if (stepIdx >= path.length) {
            showToast('🏁 Destination reached!', 'info');
            return;
        }
        
        const nodeName = path[stepIdx];
        const node = hospitalData[nodeName];
        if (!node) return;
        
        // Move elements smoothly to coordinates
        beacon.setAttribute("transform", `translate(${node.x}, ${node.y})`);
        ring.setAttribute("cx", node.x);
        ring.setAttribute("cy", node.y);
        
        // Scroll active instruction step in Directions overlay
        highlightDirectionStep(stepIdx);
        
        // Highlight active node on SVG
        document.querySelectorAll('.node').forEach(n => n.classList.remove('active-select'));
        document.getElementById(`node-${nodeName}`)?.classList.add('active-select');
        
        const t = setTimeout(() => animateStep(stepIdx + 1), 1000);
        simulationTimers.push(t);
    }
}

function startMultiPathSimulation(result) {
    const svg = document.getElementById('hospital-map');
    if (!svg || !result || !result.persons_data) return;
    
    simulationTimers.forEach(clearTimeout);
    simulationTimers = [];
    
    // Clear old beacons
    document.querySelectorAll('#path-navigator-beacon, #beacon-pulse-ring, .multi-beacon, .multi-ring').forEach(el => el.remove());
    
    const avatars = ["👤", "👥", "👨‍👩‍👦", "👩‍⚕️", "👨‍⚕️", "🩺"];
    
    // Spawn a beacon and ring for each person
    const beacons = result.persons_data.map((pData, idx) => {
        const ring = document.createElementNS("http://www.w3.org/2000/svg", "circle");
        ring.setAttribute("class", "multi-ring beacon-pulse-ring");
        ring.setAttribute("fill", "none");
        ring.setAttribute("stroke", "var(--accent-blue)");
        ring.setAttribute("stroke-width", "2.5");
        ring.setAttribute("r", "14");
        
        const beacon = document.createElementNS("http://www.w3.org/2000/svg", "g");
        beacon.setAttribute("class", "multi-beacon");
        
        const bgCircle = document.createElementNS("http://www.w3.org/2000/svg", "circle");
        bgCircle.setAttribute("r", "13");
        bgCircle.setAttribute("fill", "#6366f1");
        bgCircle.setAttribute("stroke", "white");
        bgCircle.setAttribute("stroke-width", "2");
        
        const iconTxt = document.createElementNS("http://www.w3.org/2000/svg", "text");
        iconTxt.setAttribute("text-anchor", "middle");
        iconTxt.setAttribute("y", "4");
        iconTxt.setAttribute("font-size", "12px");
        iconTxt.setAttribute("fill", "white");
        iconTxt.textContent = avatars[idx % avatars.length];
        
        beacon.appendChild(bgCircle);
        beacon.appendChild(iconTxt);
        
        const nodesGroup = document.getElementById('nodes-group');
        if (nodesGroup) {
            nodesGroup.parentNode.insertBefore(ring, nodesGroup);
            nodesGroup.parentNode.insertBefore(beacon, nodesGroup);
        }
        
        return { beacon, ring, path1: pData.path_to_meet, path2: pData.path_from_meet };
    });
    
    // Animate stage 1: travel to meeting point
    const maxMeetLen = Math.max(...beacons.map(b => b.path1.length));
    animateMeetStep(0);
    
    function animateMeetStep(stepIdx) {
        if (stepIdx >= maxMeetLen) {
            showToast('🤝 All persons reached the meeting point!', 'info');
            // Wait 1.5 seconds at meeting point and then go to destinations
            const t = setTimeout(() => animateDestStep(0), 1500);
            simulationTimers.push(t);
            return;
        }
        
        beacons.forEach(b => {
            const pathIdx = Math.min(stepIdx, b.path1.length - 1);
            const nodeName = b.path1[pathIdx];
            const node = hospitalData[nodeName];
            if (node) {
                b.beacon.setAttribute("transform", `translate(${node.x}, ${node.y})`);
                b.ring.setAttribute("cx", node.x);
                b.ring.setAttribute("cy", node.y);
            }
        });
        
        const t = setTimeout(() => animateMeetStep(stepIdx + 1), 1000);
        simulationTimers.push(t);
    }
    
    function animateDestStep(stepIdx) {
        const maxDestLen = Math.max(...beacons.map(b => b.path2.length));
        if (stepIdx >= maxDestLen) {
            showToast('🏁 All persons arrived at their final destinations!', 'info');
            return;
        }
        
        beacons.forEach(b => {
            const pathIdx = Math.min(stepIdx, b.path2.length - 1);
            const nodeName = b.path2[pathIdx];
            const node = hospitalData[nodeName];
            if (node) {
                b.beacon.setAttribute("transform", `translate(${node.x}, ${node.y})`);
                b.ring.setAttribute("cx", node.x);
                b.ring.setAttribute("cy", node.y);
            }
        });
        
        const t = setTimeout(() => animateDestStep(stepIdx + 1), 1000);
        simulationTimers.push(t);
    }
}

// --- 2. DIRECTIONS OVERLAY ACCESSIBILITY ANNOUNCER ---
function highlightDirectionStep(idx) {
    const items = document.querySelectorAll('.directions-overlay-list li');
    items.forEach(li => li.classList.remove('speaking-highlight'));
    const activeLi = document.getElementById(`step-li-${idx}`);
    if (activeLi) {
        activeLi.classList.add('speaking-highlight');
        activeLi.scrollIntoView({ behavior: 'smooth', block: 'nearest' });
    }
}

function speakCurrentRoute() {
    if (!lastPathResult) {
        showToast('⚠️ No active route calculated.', 'error');
        return;
    }
    
    // Clear speaking first
    window.speechSynthesis.cancel();
    
    let phrase = "";
    if (lastPathResult.is_multi) {
        phrase = `Minimax meeting point coordinate locked at ${lastPathResult.meeting_point_info.name}. `;
        lastPathResult.persons_data.forEach((pData, idx) => {
            phrase += `Person ${idx + 1} starting from ${pData.start.replace(/_/g, ' ')}. `;
            pData.directions_to_meet.forEach(step => {
                phrase += step.instruction.replace(/👤 Person \d+ \(.*?\): /g, '').replace(/🚪|📍|🛗|➡️/g, '') + ". ";
            });
        });
    } else {
        phrase = "Starting route announcement. ";
        lastPathResult.directions.forEach(step => {
            phrase += step.instruction.replace(/🚪|📍|🛗|➡️/g, '') + ". ";
        });
    }
    
    const utterance = new SpeechSynthesisUtterance(phrase);
    
    // Find beautiful voice
    const voices = window.speechSynthesis.getVoices();
    const voice = voices.find(v => v.lang.startsWith('en') && v.name.includes('Google'));
    if (voice) utterance.voice = voice;
    
    utterance.rate = 0.95;
    window.speechSynthesis.speak(utterance);
    showToast('🔊 Route directions audio active.', 'info');
}

// --- 3. DYNAMIC CAPACITY TRACKER CONTROLLER ---
function updateLiveWaitTimes() {
    const erWait = document.getElementById('wait-er');
    const radWait = document.getElementById('wait-rad');
    const pharmWait = document.getElementById('wait-pharm');
    
    const erLoad = document.getElementById('load-er');
    const radLoad = document.getElementById('load-rad');
    const pharmLoad = document.getElementById('load-pharm');
    
    const erBar = document.getElementById('bar-er');
    const radBar = document.getElementById('bar-rad');
    const pharmBar = document.getElementById('bar-pharm');
    
    if (erWait) {
        const erVal = Math.floor(6 + Math.random() * 14);
        const radVal = Math.floor(12 + Math.random() * 26);
        const pharmVal = Math.floor(2 + Math.random() * 8);
        
        erWait.textContent = `${erVal}m wait`;
        radWait.textContent = `${radVal}m wait`;
        pharmWait.textContent = `${pharmVal}m wait`;
        
        updateBadgeColor(erWait, erVal, 10, 18);
        updateBadgeColor(radWait, radVal, 15, 25);
        updateBadgeColor(pharmWait, pharmVal, 5, 10);
        
        const erCap = Math.floor(76 + Math.random() * 18);
        const radCap = Math.floor(52 + Math.random() * 24);
        const pharmCap = Math.floor(28 + Math.random() * 28);
        
        erLoad.textContent = `${erCap}% Capacity`;
        radLoad.textContent = `${radCap}% Capacity`;
        pharmLoad.textContent = `${pharmCap}% Capacity`;
        
        erBar.style.width = `${erCap}%`;
        radBar.style.width = `${radCap}%`;
        pharmBar.style.width = `${pharmCap}%`;
        
        const cardEr = erWait.closest('.capacity-card');
        if (cardEr) {
            if (erCap > 85) cardEr.classList.add('congested');
            else cardEr.classList.remove('congested');
        }
    }
}

function updateBadgeColor(el, val, med, high) {
    el.className = 'capacity-wait-badge';
    if (val < med) el.classList.add('wait-low');
    else if (val < high) el.classList.add('wait-med');
    else el.classList.add('wait-high');
}

// --- 4. FLOATING HOSPNAV AI HELPDEK CHATBOT ---
let chatMessages = [];
const STORAGE_CHAT_KEY = 'hospnav_chat_history';
let voiceFeedbackEnabled = false;

function initChatHistory() {
    const chatBody = document.getElementById('ai-chat-body');
    if (!chatBody) return;
    
    const saved = localStorage.getItem(STORAGE_CHAT_KEY);
    if (saved) {
        chatMessages = JSON.parse(saved);
        renderChatHistory();
    } else {
        chatMessages = [
            { sender: 'assistant', text: "Hello! I am your <strong>HospNav AI Assistant</strong>. 🏥 I can help you find departments, navigate to consult rooms, or book appointments. How can I guide you today?" }
        ];
        localStorage.setItem(STORAGE_CHAT_KEY, JSON.stringify(chatMessages));
    }
    
    // Launcher badge indicators
    const badge = document.getElementById('ai-chat-badge');
    const win = document.getElementById('ai-chat-window');
    if (badge && (!win || !win.classList.contains('open'))) {
        badge.style.display = 'flex';
        badge.textContent = '1';
    }
}

function renderChatHistory() {
    const chatBody = document.getElementById('ai-chat-body');
    if (!chatBody) return;
    
    chatBody.innerHTML = chatMessages.map(msg => `
        <div class="chat-bubble ${msg.sender}">
            ${msg.text}
        </div>
    `).join('');
    
    chatBody.scrollTop = chatBody.scrollHeight;
}

function toggleAIChat() {
    const win = document.getElementById('ai-chat-window');
    const badge = document.getElementById('ai-chat-badge');
    if (win) {
        win.classList.toggle('open');
        if (win.classList.contains('open')) {
            if (badge) badge.style.display = 'none';
            setTimeout(() => document.getElementById('chat-text-input')?.focus(), 150);
        }
    }
}

function handleSuggestion(text) {
    const input = document.getElementById('chat-text-input');
    if (input) {
        input.value = text;
        sendChatMessage();
    }
}

function sendChatMessage() {
    const input = document.getElementById('chat-text-input');
    if (!input || !input.value.trim()) return;
    
    const query = input.value.trim();
    input.value = '';
    
    // Add user bubble
    chatMessages.push({ sender: 'user', text: query });
    renderChatHistory();
    
    // Assistant reply delay
    setTimeout(() => {
        const reply = parseChatResponse(query);
        chatMessages.push({ sender: 'assistant', text: reply.text });
        localStorage.setItem(STORAGE_CHAT_KEY, JSON.stringify(chatMessages));
        renderChatHistory();
        
        // Speak response if toggled
        if (voiceFeedbackEnabled) {
            speakText(reply.speechText || stripHTML(reply.text));
        }
        
        // Trigger action triggers (like auto navigation)
        if (reply.action) reply.action();
    }, 600);
}

function stripHTML(html) {
    const doc = new DOMParser().parseFromString(html, 'text/html');
    return doc.body.textContent || "";
}

function toggleVoiceSpeech() {
    const btn = document.getElementById('chat-voice-toggle-btn');
    voiceFeedbackEnabled = !voiceFeedbackEnabled;
    if (btn) {
        btn.classList.toggle('active', voiceFeedbackEnabled);
        btn.style.color = voiceFeedbackEnabled ? 'var(--accent-blue)' : 'var(--text-secondary)';
    }
    showToast(voiceFeedbackEnabled ? '🔊 Chat speaker feedback enabled' : '🔇 Chat speaker feedback disabled', 'info');
}

function speakText(text) {
    window.speechSynthesis.cancel();
    const utterance = new SpeechSynthesisUtterance(text);
    const voices = window.speechSynthesis.getVoices();
    const voice = voices.find(v => v.lang.startsWith('en') && v.name.includes('Google'));
    if (voice) utterance.voice = voice;
    utterance.rate = 1.0;
    window.speechSynthesis.speak(utterance);
}

function parseChatResponse(query) {
    const lower = query.toLowerCase();
    
    // Emergency ER
    if (lower.includes('emergency') || lower.includes('er ') || lower.endsWith('er') || lower.includes('accident') || lower.includes('bleeding') || lower.includes('heart attack')) {
        return {
            text: "🚨 <strong>EMERGENCY BAY REDIRECT!</strong><br><br>The Triage and Emergency Rooms are open 24/7. I've automatically configured a direct ambulance corridor route to the ER from the Entrance.",
            speechText: "Emergency detected. Setting a direct routing to the Emergency Room for you. Please proceed immediately.",
            action: () => {
                if (!window.location.pathname.includes('/navigation')) {
                    window.location.href = '/navigation?start=Entrance&target=ER';
                } else {
                    document.getElementById('start-node').value = "Entrance";
                    document.getElementById('end-node').value = "ER";
                    updateNodeClasses();
                    calculatePath(true, true);
                }
            }
        };
    }
    
    // Cardiology / Dr Smith
    if (lower.includes('cardiology') || lower.includes('smith') || lower.includes('heart')) {
        return {
            text: "🫀 <strong>Cardiology Consultation Room:</strong> Located on the <strong>Ground Floor (Room 300)</strong>, led by Chief <strong>Dr. Alexander Smith</strong>.<br><br><a href='/navigation?start=Entrance&target=Dr_Smith' class='hero-cta-secondary' style='display:inline-block; margin-top:0.5rem; text-decoration:none; font-size:0.75rem; padding:0.4rem 0.8rem;'>🗺️ Auto-Route to Dr. Smith</a>",
            speechText: "The Cardiology room is located on the Ground Floor in Room 300, led by Dr. Alexander Smith. You can auto route there using the link in the chat."
        };
    }
    
    // Radiology / MRI
    if (lower.includes('radiology') || lower.includes('mri') || lower.includes('scan') || lower.includes('x-ray') || lower.includes('xray')) {
        return {
            text: "☢️ <strong>MRI & Radiology Department:</strong> Located on <strong>Floor 1</strong>. Serves all scanners and diagnostic diagnostics. Remember to remove metal items before entering.<br><br><a href='/navigation?start=Entrance&target=MRI_Suite' class='hero-cta-secondary' style='display:inline-block; margin-top:0.5rem; text-decoration:none; font-size:0.75rem; padding:0.4rem 0.8rem;'>🗺️ Auto-Route to MRI Suite</a>",
            speechText: "The Radiology Department is located on Floor 1. Please ensure all metal objects are removed before enters."
        };
    }
    
    // Appointment booking
    if (lower.includes('appointment') || lower.includes('book') || lower.includes('schedule') || lower.includes('consult')) {
        return {
            text: "📅 <strong>Consultation Booking:</strong> <br><br>1. Head to the <a href='/appointments' style='color:var(--accent-blue); font-weight:700;'>Appointments Tab</a>.<br>2. Select specialty field filters.<br>3. Pick date, preferred slot, and describe concerns.<br>4. Submit and verification records will link to your patient panel.",
            speechText: "Go to the Book Appointment tab to schedule a date and slot with our specialists."
        };
    }
    
    // Portal / Medical history
    if (lower.includes('portal') || lower.includes('id') || lower.includes('records') || lower.includes('prescription') || lower.includes('rx')) {
        return {
            text: "🔒 <strong>Patient Health Portal:</strong> Secure database vault. <br><br>Log in at the <a href='/portal' style='color:var(--accent-blue); font-weight:700;'>Patient Portal</a> using email to sync vital readings, upcoming session timings, and print Rx prescriptions.",
            speechText: "Check schedules and print prescriptions securely in the Patient Portal."
        };
    }

    // Minimax meeting point
    if (lower.includes('meeting') || lower.includes('meet') || lower.includes('minimax') || lower.includes('multi')) {
        return {
            text: "👥 <strong>Minimax Meeting Point Finder:</strong> Calculating central meetups. <br><br>In the <a href='/navigation' style='color:var(--accent-blue); font-weight:700;'>HospNav Map</a>, select the number of persons (2-6), configure starting locations and targets, and our minimax algorithms will plot a central point minimizing everyone's travel cost!",
            speechText: "The minimax algorithms will plot a perfect central meetup node to minimize overall travel cost for up to 6 persons."
        };
    }

    // Staff Terminal
    if (lower.includes('staff') || lower.includes('admin') || lower.includes('doctor panel')) {
        return {
            text: "🔑 <strong>Staff Panel Terminal:</strong> Clinic occupancy controls, workload chart gauges, and schedule tools are available on the <a href='/staff' style='color:var(--accent-blue); font-weight:700;'>Staff Login</a> page using clearance code <code>123456</code>.",
            speechText: "Doctor workloads and clinical controls are accessible on the Staff Login page."
        };
    }
    
    // Hours
    if (lower.includes('hours') || lower.includes('open') || lower.includes('times')) {
        return {
            text: "🕐 <strong>Facility Times:</strong> Hospital main gates, ER triage centers, and online portals are open <strong>24/7</strong>. Consult desk rooms operate Mon-Fri 9:00 AM - 5:00 PM.",
            speechText: "Main doors and ER rooms are open 24 7. Consult clinics are open Monday through Friday."
        };
    }

    // Wheelchair
    if (lower.includes('wheelchair') || lower.includes('access') || lower.includes('elevator') || lower.includes('lift')) {
        return {
            text: "♿ <strong>Accessibility Services:</strong> All sectors are accessible via elevator shafts (Lifts A and B). Toggling the **Wheelchair Access** switch filter on the sidebar will force pathfinders to avoid stairs and route via ramps.",
            speechText: "Toggling wheelchair mode on the navigation page enforces routes that avoid stairs and take elevators."
        };
    }

    // Oncology / Chen
    if (lower.includes('oncology') || lower.includes('cancer') || lower.includes('chen')) {
        return {
            text: "🎗️ <strong>Oncology Department:</strong> Floor 3, Room 850 led by senior specialist <strong>Dr. Sarah Chen</strong>.<br><br><a href='/navigation?start=Entrance&target=Dr_Chen' class='hero-cta-secondary' style='display:inline-block; margin-top:0.5rem; text-decoration:none; font-size:0.75rem; padding:0.4rem 0.8rem;'>🗺️ Auto-Route to Dr. Chen</a>"
        };
    }

    // Neurology
    if (lower.includes('neurology') || lower.includes('brain') || lower.includes('wilson') || lower.includes('vance')) {
        return {
            text: "🧠 <strong>Neurology Suite:</strong> Floor 3, clinical consulting desks led by specialist <strong>Dr. Elena Vance</strong> and <strong>Dr. James Wilson</strong>.<br><br><a href='/navigation?start=Entrance&target=Neurology' class='hero-cta-secondary' style='display:inline-block; margin-top:0.5rem; text-decoration:none; font-size:0.75rem; padding:0.4rem 0.8rem;'>🗺️ Auto-Route to Neurology</a>"
        };
    }

    // Orthopedics
    if (lower.includes('orthopedics') || lower.includes('bone') || lower.includes('thorne') || lower.includes('joint')) {
        return {
            text: "🦴 <strong>Orthopedics Department:</strong> Floor 1, Room 210 led by senior surgeon <strong>Dr. Marcus Thorne</strong>.<br><br><a href='/navigation?start=Entrance&target=Orthopedics' class='hero-cta-secondary' style='display:inline-block; margin-top:0.5rem; text-decoration:none; font-size:0.75rem; padding:0.4rem 0.8rem;'>🗺️ Auto-Route to Orthopedics</a>"
        };
    }

    // Cafeteria
    if (lower.includes('food') || lower.includes('cafe') || lower.includes('coffee') || lower.includes('lunch')) {
        return {
            text: "☕ <strong>Hospital Cafeteria:</strong> Located on the <strong>Ground Floor</strong>. Serves fresh meals, desserts, and premium hot coffee from 6:00 AM to 10:00 PM.<br><br><a href='/navigation?start=Entrance&target=Cafeteria' class='hero-cta-secondary' style='display:inline-block; margin-top:0.5rem; text-decoration:none; font-size:0.75rem; padding:0.4rem 0.8rem;'>🗺️ Auto-Route to Cafeteria</a>"
        };
    }
    
    return {
        text: "💡 I want to guide you correctly! You can query about specific clinical departments (like *Cardiology*, *Neurology*, *Radiology*, *Oncology*, *Orthopedics*, *Dermatology*, *Cafeteria*, *Pharmacy*), or services like *Bookings*, *Patient Portal*, *Staff Login*, *Emergency ER*, or *Accessibility*. What can I look up for you?",
        speechText: "I want to help you correctly. Please ask about cardiology, radiology, bookings, or emergencies."
    };
}

// --- 5. INITIALIZATIONS & BINDINGS ---
document.addEventListener('DOMContentLoaded', () => {
    // 1. Initial chatbot loader
    initChatHistory();
    
    // 2. Navigation controls bindings
    const speakBtn = document.getElementById('speak-directions-btn');
    if (speakBtn) {
        speakBtn.addEventListener('click', speakCurrentRoute);
    }
    
    const simulateBtn = document.getElementById('simulate-path-btn');
    if (simulateBtn) {
        simulateBtn.addEventListener('click', () => {
            if (lastPathResult && !lastPathResult.is_multi) {
                const wheelchair = document.getElementById('wheelchair-access')?.checked || false;
                const isEmergency = document.body.classList.contains('emergency-active') || false;
                startPathSimulation(lastPathResult.path, wheelchair, isEmergency);
            } else if (lastPathResult && lastPathResult.is_multi) {
                startMultiPathSimulation(lastPathResult);
            } else {
                showToast('⚠️ Compute a route first before starting simulation!', 'error');
            }
        });
    }
    
    // 3. Live wait-time loop on Home Page
    if (document.getElementById('wait-er')) {
        setInterval(updateLiveWaitTimes, 15000);
        updateLiveWaitTimes();
    }
});
