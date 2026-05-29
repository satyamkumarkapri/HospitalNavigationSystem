from flask import Flask, render_template, jsonify, request
import heapq
from collections import deque
import math

app = Flask(__name__)

# Hospital Graph — multi-floor, AI-powered navigation
# Each node: x, y (SVG coords), floor, connections {neighbor: weight},
# info, icon, wheelchair_accessible, category, status
HOSPITAL_MAP = {
    # ─── FLOOR 0 (Ground) ─────────────────────────────────────────
    "Parking_Zone_A": {
        "x": 150, "y": 1200, "floor": 0,
        "connections": {"Entrance": 5},
        "info": "Patient & Visitor Parking Zone A. Electric vehicle charging stations available.",
        "icon": "🅿️", "wheelchair_accessible": True, "category": "Access",
        "status": "open", "hours": "24/7"
    },
    "Entrance": {
        "x": 150, "y": 840, "floor": 0,
        "connections": {"Reception": 2, "Info_Desk": 3, "Ambulance_Bay": 4, "Gift_Shop": 5, "Parking_Zone_A": 5, "Pharmacy_1": 3},
        "info": "Main hospital entrance. Open 24/7. Automatic doors. Wheelchair ramp and drop-off zone available.",
        "icon": "🚪", "wheelchair_accessible": True, "category": "Access",
        "status": "open", "hours": "24/7"
    },
    "Ambulance_Bay": {
        "x": 150, "y": 1020, "floor": 0,
        "connections": {"Entrance": 4, "ER": 3},
        "info": "Ambulance drop-off zone. Emergency vehicles only. Direct corridor to ER.",
        "icon": "🚑", "wheelchair_accessible": True, "category": "Emergency",
        "status": "open", "hours": "24/7"
    },
    "Reception": {
        "x": 450, "y": 840, "floor": 0,
        "connections": {"Entrance": 2, "ER": 5, "Cafeteria": 8, "Outpatient": 5,
                        "Restroom_G": 3, "Dr_Smith": 5, "Lift_G": 4, "Stairwell_G": 3,
                        "Wheelchair_Bay": 2, "Info_Desk": 4, "Staff_Lift_G": 10, "Retail_Pharmacy": 3, "Pharmacy_1": 4},
        "info": "Patient registration and general inquiries. Open 24/7. Volunteer guides available.",
        "icon": "💁", "wheelchair_accessible": True, "category": "Admin",
        "status": "open", "hours": "24/7"
    },
    "Retail_Pharmacy": {
        "x": 600, "y": 660, "floor": 0,
        "connections": {"Reception": 3, "Outpatient": 4},
        "info": "Ground Floor Retail Pharmacy. OTC medications, health supplements, and personal care.",
        "icon": "💊", "wheelchair_accessible": True, "category": "Clinical",
        "status": "open", "hours": "8:00 AM – 11:00 PM"
    },
    "Info_Desk": {
        "x": 300, "y": 660, "floor": 0,
        "connections": {"Entrance": 3, "Reception": 4},
        "info": "Doctor Availability & Hospital Directory. Get maps and visitor passes here.",
        "icon": "ℹ️", "wheelchair_accessible": True, "category": "Admin",
        "status": "open", "hours": "8:00 AM – 8:00 PM"
    },
    "Wheelchair_Bay": {
        "x": 450, "y": 1020, "floor": 0,
        "connections": {"Reception": 2, "Restroom_G": 4, "Entrance": 5, "Pharmacy_1": 2},
        "info": "Wheelchair Storage & Rental Bay. Manual and electric wheelchairs available. Located near Reception — request at the desk. Free for patients.",
        "icon": "♿", "wheelchair_accessible": True, "category": "Accessibility",
        "status": "open", "hours": "24/7"
    },
    "Pharmacy_1": {
        "x": 300, "y": 1020, "floor": 0,
        "connections": {"Entrance": 3, "Reception": 4, "Wheelchair_Bay": 2},
        "info": "Community Pharmacy. Conveniently located near the entrance for prescription pick-up and health essentials.",
        "icon": "💊", "wheelchair_accessible": True, "category": "Clinical",
        "status": "open", "hours": "7:00 AM – 10:00 PM"
    },
    "Gift_Shop": {
        "x": 150, "y": 660, "floor": 0,
        "connections": {"Entrance": 5, "Cafeteria": 6},
        "info": "Hospital gift shop. Flowers, cards, snacks, and essentials available.",
        "icon": "🎁", "wheelchair_accessible": True, "category": "Amenity",
        "status": "open", "hours": "9:00 AM – 7:00 PM"
    },
    "ER": {
        "x": 750, "y": 1020, "floor": 0,
        "connections": {"Reception": 5, "Ambulance_Bay": 3, "ICU": 3, "Triage": 2, "Emergency_Exit_G": 2, "Waiting_Area": 3},
        "info": "Emergency Room. For critical and life-threatening conditions. Priority routing available.",
        "icon": "🚨", "wheelchair_accessible": True, "category": "Emergency",
        "status": "open", "hours": "24/7"
    },
    "Emergency_Exit_G": {
        "x": 900, "y": 1200, "floor": 0,
        "connections": {"ER": 2},
        "info": "Ground Floor Emergency Exit. Alarmed doors. Exit only.",
        "icon": "🚪", "wheelchair_accessible": True, "category": "Access",
        "status": "open", "hours": "24/7"
    },
    "Triage": {
        "x": 975, "y": 1020, "floor": 0,
        "connections": {"ER": 2, "ICU": 3, "Waiting_Area": 2},
        "info": "Triage Assessment Area. Patients assessed by urgency. Restricted to patients and staff.",
        "icon": "🩺", "wheelchair_accessible": True, "category": "Emergency",
        "status": "open", "hours": "24/7"
    },
    # ─── FLOOR 0 – Bottom-centre fill ──────────────────────────────────
    "Waiting_Area": {
        "x": 1125, "y": 1170, "floor": 0,
        "connections": {"ER": 3, "Triage": 2, "Family_Lounge": 3, "Patient_Helpdesk": 4},
        "info": "Central Patient & Visitor Waiting Lounge. Comfortable seating, TV, vending machines, and free Wi-Fi.",
        "icon": "🪑", "wheelchair_accessible": True, "category": "Amenity",
        "status": "open", "hours": "24/7"
    },
    "Family_Lounge": {
        "x": 1275, "y": 1020, "floor": 0,
        "connections": {"Waiting_Area": 3, "Lift_G2": 3, "Chapel": 3, "Patient_Helpdesk": 3},
        "info": "Family Lounge & Consultation Suite. Private rooms for family meetings with the care team. Counsellor on site.",
        "icon": "👨\u200d👩\u200d👦", "wheelchair_accessible": True, "category": "Amenity",
        "status": "open", "hours": "8:00 AM \u2013 10:00 PM"
    },
    "Chapel": {
        "x": 1425, "y": 1170, "floor": 0,
        "connections": {"Family_Lounge": 3, "Staff_Lift_G": 5},
        "info": "Multi-Faith Chapel & Spiritual Care. Open 24/7 to patients, families, and staff of all faiths. Chaplain available on request.",
        "icon": "\U0001f54a\ufe0f", "wheelchair_accessible": True, "category": "Amenity",
        "status": "open", "hours": "24/7"
    },
    "Patient_Helpdesk": {
        "x": 1125, "y": 840, "floor": 0,
        "connections": {"Waiting_Area": 4, "Family_Lounge": 3, "Lift_G2": 2, "Restroom_G": 4},
        "info": "Patient Services Helpdesk. Assistance with admissions, discharge queries, transport bookings, and complaints.",
        "icon": "\U0001f4cb", "wheelchair_accessible": True, "category": "Admin",
        "status": "open", "hours": "7:00 AM \u2013 9:00 PM"
    },
    "Outpatient": {
        "x": 450, "y": 510, "floor": 0,
        "connections": {"Reception": 5, "Radiology": 4, "Dr_Smith": 6, "Restroom_G": 5, "Retail_Pharmacy": 4},
        "info": "Outpatient Clinic. For non-admitted patients. Appointments required for most services.",
        "icon": "🩺", "wheelchair_accessible": True, "category": "Clinical",
        "status": "open", "hours": "8:00 AM – 6:00 PM"
    },
    "Cafeteria": {
        "x": 195, "y": 330, "floor": 0,
        "connections": {"Reception": 8, "Gift_Shop": 6, "Lift_G": 6, "Stairwell_G": 5},
        "info": "Hot meals and coffee. Open 6 AM – 10 PM. Staff discount available. Vegan and halal options.",
        "icon": "☕", "wheelchair_accessible": True, "category": "Amenity",
        "status": "open", "hours": "6:00 AM – 10:00 PM"
    },
    "Restroom_G": {
        "x": 675, "y": 840, "floor": 0,
        "connections": {"Reception": 3, "Outpatient": 5, "Wheelchair_Bay": 4},
        "info": "Ground Floor Restroom. Fully wheelchair accessible. Baby changing facilities available.",
        "icon": "🚻", "wheelchair_accessible": True, "category": "Amenity",
        "status": "open", "hours": "24/7"
    },
    "Dr_Smith": {
        "x": 450, "y": 1050, "floor": 0,
        "connections": {"Reception": 5, "Outpatient": 6},
        "info": "Dr. Smith Consultation Room (Cardiology). Mon–Fri 9AM–12PM. Please book in advance.",
        "icon": "👨‍⚕️", "wheelchair_accessible": True, "category": "Consultation",
        "status": "open", "hours": "Mon–Fri 9:00 AM – 12:00 PM"
    },
    "Lift_G": {
        "x": 750, "y": 660, "floor": 0,
        "connections": {"Reception": 4, "Cafeteria": 6, "Lift_1": 3, "Lift_2": 6, "Lift_3": 9},
        "info": "Main Lift Bank A. Serves all floors. Wheelchair accessible.",
        "icon": "🛗", "wheelchair_accessible": True, "category": "Access",
        "status": "open", "hours": "24/7"
    },
    "Lift_G2": {
        "x": 1050, "y": 840, "floor": 0,
        "connections": {"Restroom_G": 4, "Lift_1_2": 3, "Lift_2_2": 6, "Family_Lounge": 3, "Patient_Helpdesk": 2},
        "info": "Service Lift Bank B. Serves all floors. High capacity for stretchers.",
        "icon": "🛗", "wheelchair_accessible": True, "category": "Access",
        "status": "open", "hours": "24/7"
    },
    "Stairwell_G": {
        "x": 750, "y": 510, "floor": 0,
        "connections": {"Reception": 3, "Cafeteria": 5, "Stairwell_1": 2},
        "info": "East Stairwell. Fire-rated exit. NOT wheelchair accessible.",
        "icon": "🪜", "wheelchair_accessible": False, "category": "Access",
        "status": "open", "hours": "24/7"
    },
    "Stairwell_G2": {
        "x": 1500, "y": 660, "floor": 0,
        "connections": {"Staff_Lift_G": 4, "Stairwell_1_2": 2},
        "info": "West Stairwell. Secondary emergency exit.",
        "icon": "🪜", "wheelchair_accessible": False, "category": "Access",
        "status": "open", "hours": "24/7"
    },
    "Staff_Lift_G": {
        "x": 1650, "y": 840, "floor": 0,
        "connections": {"Reception": 10, "Staff_Lift_1": 3, "Staff_Lift_2": 6, "Stairwell_G2": 4, "Dermatology": 4, "Chapel": 5},
        "info": "Staff & Service Lift. Restricted use during emergencies. Connects to clinical floors.",
        "icon": "🛗", "wheelchair_accessible": True, "category": "Access",
        "status": "open", "hours": "24/7"
    },
    "Dermatology": {
        "x": 1800, "y": 660, "floor": 0,
        "connections": {"Staff_Lift_G": 4, "Dr_Ross": 3},
        "info": "Dermatology Clinic. Skin, hair, and nail health. Cosmetic and medical dermatology.",
        "icon": "🧴", "wheelchair_accessible": True, "category": "Clinical",
        "status": "open", "hours": "9:00 AM – 5:00 PM"
    },
    "Dr_Ross": {
        "x": 1800, "y": 450, "floor": 0,
        "connections": {"Dermatology": 3},
        "info": "Dr. Michael Ross (Dermatology). Expert in skin oncology and aesthetics.",
        "icon": "👨‍⚕️", "wheelchair_accessible": True, "category": "Consultation",
        "status": "open", "hours": "Mon-Fri 9:00 AM – 4:00 PM"
    },
    # ─── FLOOR 1 (First) ──────────────────────────────────────────
    "Lift_1": {
        "x": 750, "y": 660, "floor": 1,
        "connections": {"Lift_G": 3, "Lift_2": 3, "Lift_3": 6, "Radiology": 5, "Lab": 7, "Restroom_1": 4, "Cardiology_Lab": 5},
        "info": "Floor 1 Lift Landing. Connects to Radiology, Lab, and upper floors.",
        "icon": "🛗", "wheelchair_accessible": True, "category": "Access",
        "status": "open", "hours": "24/7"
    },
    "Lift_1_2": {
        "x": 1050, "y": 840, "floor": 1,
        "connections": {"Lift_G2": 3, "Lift_2_2": 3, "Blood_Bank": 4},
        "info": "Floor 1 Service Lift Bank B.",
        "icon": "🛗", "wheelchair_accessible": True, "category": "Access",
        "status": "open", "hours": "24/7"
    },
    "Stairwell_1": {
        "x": 750, "y": 510, "floor": 1,
        "connections": {"Stairwell_G": 2, "Stairwell_2": 2, "Radiology": 4},
        "info": "Floor 1 East Stairwell.",
        "icon": "🪜", "wheelchair_accessible": False, "category": "Access",
        "status": "open", "hours": "24/7"
    },
    "Stairwell_1_2": {
        "x": 1500, "y": 660, "floor": 1,
        "connections": {"Stairwell_G2": 2, "Stairwell_2_2": 2, "Physiotherapy": 4},
        "info": "Floor 1 West Stairwell.",
        "icon": "🪜", "wheelchair_accessible": False, "category": "Access",
        "status": "open", "hours": "24/7"
    },
    "Radiology": {
        "x": 975, "y": 510, "floor": 1,
        "connections": {"Lift_1": 5, "Stairwell_1": 4, "Lab": 4, "X_Ray": 2,
                        "MRI_Suite": 5, "Outpatient": 7},
        "info": "Radiology Department. X-Rays, MRI, CT Scans, and Ultrasound. Mon–Sat 8AM–8PM.",
        "icon": "☢️", "wheelchair_accessible": True, "category": "Diagnostics",
        "status": "open", "hours": "Mon–Sat 8:00 AM – 8:00 PM"
    },
    "X_Ray": {
        "x": 975, "y": 300, "floor": 1,
        "connections": {"Radiology": 2, "MRI_Suite": 4},
        "info": "Dedicated X-Ray Unit. Walk-in for emergencies; appointment preferred.",
        "icon": "🦴", "wheelchair_accessible": True, "category": "Diagnostics",
        "status": "open", "hours": "8:00 AM – 8:00 PM"
    },
    "MRI_Suite": {
        "x": 1200, "y": 300, "floor": 1,
        "connections": {"X_Ray": 4, "Radiology": 5},
        "info": "MRI Suite. Remove all metal objects. Claustrophobia support available. Booking required.",
        "icon": "🧲", "wheelchair_accessible": True, "category": "Diagnostics",
        "status": "open", "hours": "8:00 AM – 6:00 PM"
    },
    "Lab": {
        "x": 1200, "y": 660, "floor": 1,
        "connections": {"Radiology": 4, "Lift_1": 7, "Blood_Bank": 3, "Restroom_1": 4,
                        "Nursing_Station_1": 5},
        "info": "Clinical Laboratory. Blood tests, urinalysis, pathology. Fasting required for some tests.",
        "icon": "🔬", "wheelchair_accessible": True, "category": "Diagnostics",
        "status": "open", "hours": "7:00 AM – 9:00 PM"
    },
    "Blood_Bank": {
        "x": 1425, "y": 510, "floor": 1,
        "connections": {"Lab": 3, "Nursing_Station_1": 4, "Lift_1_2": 4},
        "info": "Blood Bank & Transfusion Services. Licensed donation centre. Restricted access.",
        "icon": "🩸", "wheelchair_accessible": True, "category": "Diagnostics",
        "status": "open", "hours": "24/7"
    },
    "Restroom_1": {
        "x": 975, "y": 840, "floor": 1,
        "connections": {"Lift_1": 4, "Lab": 4},
        "info": "Floor 1 Restroom. Wheelchair accessible.",
        "icon": "🚻", "wheelchair_accessible": True, "category": "Amenity",
        "status": "open", "hours": "24/7"
    },
    "Nursing_Station_1": {
        "x": 1425, "y": 750, "floor": 1,
        "connections": {"Lab": 5, "Blood_Bank": 4, "Physiotherapy": 5},
        "info": "Floor 1 Nursing Station. Nurse call, medication, patient assistance available.",
        "icon": "👩‍⚕️", "wheelchair_accessible": True, "category": "Clinical",
        "status": "open", "hours": "24/7"
    },
    "Physiotherapy": {
        "x": 1650, "y": 660, "floor": 1,
        "connections": {"Nursing_Station_1": 5, "Lift_1": 8, "Staff_Lift_1": 2, "Stairwell_1_2": 4},
        "info": "Physiotherapy & Rehabilitation Centre. Post-surgery recovery, sports injuries, stroke rehab.",
        "icon": "🏃", "wheelchair_accessible": True, "category": "Therapy",
        "status": "open", "hours": "Mon–Fri 8:00 AM – 6:00 PM"
    },
    "Staff_Lift_1": {
        "x": 1650, "y": 840, "floor": 1,
        "connections": {"Staff_Lift_G": 3, "Staff_Lift_2": 3, "Physiotherapy": 2, "Nursing_Station_1": 4, "Orthopedics": 4},
        "info": "Staff & Service Lift Floor 1.",
        "icon": "🛗", "wheelchair_accessible": True, "category": "Access",
        "status": "open", "hours": "24/7"
    },
    "Orthopedics": {
        "x": 1800, "y": 1020, "floor": 1,
        "connections": {"Staff_Lift_1": 4, "Dr_Blunt": 3, "Dr_Thorne": 4},
        "info": "Orthopedics & Joint Center. Specialized care for bones, joints, and ligaments.",
        "icon": "🦴", "wheelchair_accessible": True, "category": "Clinical",
        "status": "open", "hours": "8:30 AM – 6:30 PM"
    },
    "Dr_Blunt": {
        "x": 1800, "y": 1200, "floor": 1,
        "connections": {"Orthopedics": 3},
        "info": "Dr. Emily Blunt (Orthopedics). Specializing in sports medicine and joint replacement.",
        "icon": "👩‍⚕️", "wheelchair_accessible": True, "category": "Consultation",
        "status": "open", "hours": "Tue-Sat 10:00 AM – 6:00 PM"
    },
    # ─── FLOOR 2 (Second) ─────────────────────────────────────────
    "Lift_2": {
        "x": 750, "y": 660, "floor": 2,
        "connections": {"Lift_1": 3, "Lift_G": 6, "Lift_3": 3, "Ward_A": 5, "Ward_B": 7,
                        "Nursing_Station_2": 4, "Recovery_Room": 5, "Counseling_Room": 6},
        "info": "Floor 2 Lift Landing A. Wards, Surgery, and Maternity.",
        "icon": "🛗", "wheelchair_accessible": True, "category": "Access",
        "status": "open", "hours": "24/7"
    },
    "Lift_2_2": {
        "x": 1050, "y": 840, "floor": 2,
        "connections": {"Lift_1_2": 3, "Lift_G2": 6, "Ward_B": 4, "ICU": 5},
        "info": "Floor 2 Service Lift Bank B.",
        "icon": "🛗", "wheelchair_accessible": True, "category": "Access",
        "status": "open", "hours": "24/7"
    },
    "Stairwell_2": {
        "x": 750, "y": 510, "floor": 2,
        "connections": {"Stairwell_1": 2, "Ward_A": 6, "Pre_Op": 4},
        "info": "Floor 2 East Stairwell.",
        "icon": "🪜", "wheelchair_accessible": False, "category": "Access",
        "status": "open", "hours": "24/7"
    },
    "Stairwell_2_2": {
        "x": 1500, "y": 660, "floor": 2,
        "connections": {"Stairwell_1_2": 2, "Pharmacy": 3},
        "info": "Floor 2 West Stairwell.",
        "icon": "🪜", "wheelchair_accessible": False, "category": "Access",
        "status": "open", "hours": "24/7"
    },
    "Nursing_Station_2": {
        "x": 975, "y": 660, "floor": 2,
        "connections": {"Lift_2": 4, "Ward_A": 4, "Ward_B": 5, "Oxygen_Station": 3},
        "info": "Floor 2 Nursing Station. 24/7 patient monitoring. Visiting hour enforcement.",
        "icon": "👩‍⚕️", "wheelchair_accessible": True, "category": "Clinical",
        "status": "open", "hours": "24/7"
    },
    "Oxygen_Station": {
        "x": 975, "y": 450, "floor": 2,
        "connections": {"Nursing_Station_2": 3, "Ward_A": 4, "ICU": 5},
        "info": "Oxygen & Medical Gas Station. Authorised personnel only. No open flames.",
        "icon": "💨", "wheelchair_accessible": True, "category": "Clinical",
        "status": "open", "hours": "24/7"
    },
    "Ward_A": {
        "x": 1200, "y": 450, "floor": 2,
        "connections": {"Nursing_Station_2": 4, "Pharmacy": 5, "Maternity": 5,
                        "Surgery": 6, "Oxygen_Station": 4, "Stairwell_2": 6},
        "info": "General Medical Ward A. 40 beds. Visiting hours: 4 PM–8 PM. Silence requested.",
        "icon": "🛏️", "wheelchair_accessible": True, "category": "Ward",
        "status": "open", "hours": "Visiting: 4:00 PM – 8:00 PM"
    },
    "Ward_B": {
        "x": 1200, "y": 840, "floor": 2,
        "connections": {"Nursing_Station_2": 5, "Pharmacy": 5, "Surgery": 8, "Lift_2": 7, "Lift_2_2": 4},
        "info": "Surgical Ward B. Post-operative recovery. Visiting hours: 4 PM–8 PM.",
        "icon": "🛏️", "wheelchair_accessible": True, "category": "Ward",
        "status": "open", "hours": "Visiting: 4:00 PM – 8:00 PM"
    },
    "Pharmacy": {
        "x": 1500, "y": 600, "floor": 2,
        "connections": {"Ward_A": 5, "Ward_B": 5, "Surgery": 6, "Stairwell_2_2": 3, "Emergency_Exit_2": 4},
        "info": "Clinical Pharmacy. Prescription dispensing 24/7. Connects to Wards and Surgery.",
        "icon": "💊", "wheelchair_accessible": True, "category": "Clinical",
        "status": "open", "hours": "24/7"
    },
    "Emergency_Exit_2": {
        "x": 1650, "y": 600, "floor": 2,
        "connections": {"Pharmacy": 4, "Surgery": 3},
        "info": "Floor 2 Emergency Exit. Connects to external fire escape.",
        "icon": "🚪", "wheelchair_accessible": False, "category": "Access",
        "status": "open", "hours": "24/7"
    },
    "ICU": {
        "x": 1050, "y": 1020, "floor": 2,
        "connections": {"ER": 3, "Triage": 3, "Oxygen_Station": 5, "Nursing_Station_2": 6, "Lift_2_2": 5},
        "info": "Intensive Care Unit. Restricted access. Family visit by appointment only. Advanced life support.",
        "icon": "🫀", "wheelchair_accessible": True, "category": "Clinical",
        "status": "restricted", "hours": "24/7 — restricted entry"
    },
    "Maternity": {
        "x": 1425, "y": 300, "floor": 2,
        "connections": {"Ward_A": 5, "Dr_Jones": 4, "NICU": 3},
        "info": "Maternity Ward. Labour, delivery, and post-natal care. Partners allowed.",
        "icon": "👶", "wheelchair_accessible": True, "category": "Ward",
        "status": "open", "hours": "24/7"
    },
    "NICU": {
        "x": 1650, "y": 300, "floor": 2,
        "connections": {"Maternity": 3},
        "info": "Neonatal Intensive Care Unit. Premature and critically ill newborns. Restricted — parents only.",
        "icon": "🍼", "wheelchair_accessible": True, "category": "Clinical",
        "status": "restricted", "hours": "24/7 — restricted entry"
    },
    "Surgery": {
        "x": 1650, "y": 450, "floor": 2,
        "connections": {"Ward_A": 6, "Ward_B": 8, "Pharmacy": 6, "Staff_Lift_2": 3, "Pre_Op": 8},
        "info": "Surgery Centre. 6 operating theatres. Pre-op assessment required. Restricted access.",
        "icon": "🔪", "wheelchair_accessible": True, "category": "Clinical",
        "status": "restricted", "hours": "Operating hours vary — 24/7 emergency"
    },
    "Staff_Lift_2": {
        "x": 1650, "y": 840, "floor": 2,
        "connections": {"Staff_Lift_1": 3, "Staff_Lift_G": 6, "Surgery": 3, "Pharmacy": 5},
        "info": "Staff & Service Lift Floor 2. Direct access to Surgery.",
        "icon": "🛗", "wheelchair_accessible": True, "category": "Access",
        "status": "open", "hours": "24/7"
    },
    "Dr_Jones": {
        "x": 1650, "y": 180, "floor": 2,
        "connections": {"Maternity": 4},
        "info": "Dr. Jones Consultation Room (Paediatrics). Mon–Thu 10AM–4PM.",
        "icon": "👩‍⚕️", "wheelchair_accessible": True, "category": "Consultation",
        "status": "open", "hours": "Mon–Thu 10:00 AM – 4:00 PM"
    },
    # ─── FLOOR 3 (Third - New Clinical Floor) ───────────────────
    "Lift_3": {
        "x": 750, "y": 510, "floor": 3,
        "connections": {"Lift_2": 3, "Lift_1": 6, "Lift_G": 9, "Oncology": 5, "Neurology": 7},
        "info": "Floor 3 Lift Landing. Specialized Clinical Floor.",
        "icon": "🛗", "wheelchair_accessible": True, "category": "Access",
        "status": "open", "hours": "24/7"
    },
    "Oncology": {
        "x": 1050, "y": 300, "floor": 3,
        "connections": {"Lift_3": 5, "Dr_Chen": 3},
        "info": "Oncology Center. Comprehensive cancer care, chemotherapy, and support services.",
        "icon": "🎗️", "wheelchair_accessible": True, "category": "Clinical",
        "status": "open", "hours": "8:00 AM – 8:00 PM"
    },
    "Dr_Chen": {
        "x": 1275, "y": 150, "floor": 3,
        "connections": {"Oncology": 3},
        "info": "Dr. Sarah Chen (Oncology). Senior Oncologist specializing in precision medicine.",
        "icon": "👩‍⚕️", "wheelchair_accessible": True, "category": "Consultation",
        "status": "open", "hours": "Mon-Fri 9:00 AM – 5:00 PM"
    },
    "Neurology": {
        "x": 450, "y": 300, "floor": 3,
        "connections": {"Lift_3": 7, "Dr_Wilson": 3, "Dr_Vance": 4},
        "info": "Neurology Department. Brain, spine, and nervous system specialists.",
        "icon": "🧠", "wheelchair_accessible": True, "category": "Clinical",
        "status": "open", "hours": "9:00 AM – 6:00 PM"
    },
    "Dr_Wilson": {
        "x": 225, "y": 150, "floor": 3,
        "connections": {"Neurology": 3},
        "info": "Dr. James Wilson (Neurology). Specialist in neurodegenerative diseases.",
        "icon": "👨‍⚕️", "wheelchair_accessible": True, "category": "Consultation",
        "status": "open", "hours": "Mon-Wed 10:00 AM – 4:00 PM"
    },
    "Dr_Vance": {
        "x": 225, "y": 450, "floor": 3,
        "connections": {"Neurology": 4},
        "info": "Dr. Elena Vance (Neurology). Expert in neuro-imaging and epilepsy care.",
        "icon": "👩‍⚕️", "wheelchair_accessible": True, "category": "Consultation",
        "status": "open", "hours": "Tue-Fri 9:00 AM – 3:00 PM"
    },
    "Dr_Thorne": {
        "x": 1650, "y": 1200, "floor": 1,
        "connections": {"Orthopedics": 4},
        "info": "Dr. Marcus Thorne (Orthopedic Surgery). Senior Specialist.",
        "icon": "👨‍⚕️", "wheelchair_accessible": True, "category": "Consultation",
        "status": "open", "hours": "Mon-Thu 9:00 AM – 5:00 PM"
    },
}

# ─── Evaluation Functions ───────────────────────────────────────────────────────
def heuristic(a, b):
    ax, ay = HOSPITAL_MAP[a]["x"], HOSPITAL_MAP[a]["y"]
    bx, by = HOSPITAL_MAP[b]["x"], HOSPITAL_MAP[b]["y"]
    floor_diff = abs(HOSPITAL_MAP[a]["floor"] - HOSPITAL_MAP[b]["floor"])
    return math.sqrt((ax - bx) ** 2 + (ay - by) ** 2) / 100 + floor_diff * 5

def get_turn_penalty(prev_node, curr_node, next_node):
    if not prev_node: return 0
    ax, ay = HOSPITAL_MAP[prev_node]["x"], HOSPITAL_MAP[prev_node]["y"]
    bx, by = HOSPITAL_MAP[curr_node]["x"], HOSPITAL_MAP[curr_node]["y"]
    cx, cy = HOSPITAL_MAP[next_node]["x"], HOSPITAL_MAP[next_node]["y"]
    
    # Vectors
    v1x, v1y = bx - ax, by - ay
    v2x, v2y = cx - bx, cy - by
    
    mag1 = math.sqrt(v1x**2 + v1y**2)
    mag2 = math.sqrt(v2x**2 + v2y**2)
    
    if mag1 == 0 or mag2 == 0: return 0
    
    # Dot product
    dot = (v1x * v2x + v1y * v2y) / (mag1 * mag2)
    # Clamp to avoid floating point errors
    dot = max(-1.0, min(1.0, dot))
    angle = math.acos(dot)
    
    # If angle > 45 degrees (pi/4 approx 0.785 rad), add penalty
    if angle > 0.785:
        return 10
    return 0

def get_advanced_weight(prev_node, node, neighbor, base_weight, crowded_paths, is_emergency):
    weight = base_weight
    
    # Emergency Override: Ignore crowds and wait times!
    if is_emergency:
        return weight
        
    # Crowded penalty
    pair = tuple(sorted([node, neighbor]))
    if pair in crowded_paths or (neighbor, node) in crowded_paths:
        weight += 20
        
    # Elevator wait penalty (entering a lift from a non-lift)
    if "Lift" not in node and "Lift" in neighbor:
        weight += 50
        
    # Turn penalty
    if prev_node:
        weight += get_turn_penalty(prev_node, node, neighbor)
        
    return weight


# ─── Algorithms ───────────────────────────────────────────────────────────────
def get_bfs_path(start, end, accessible_only=False):
    queue = deque([(start, [start])])
    visited = set()
    explored_order = []
    while queue:
        (node, path) = queue.popleft()
        if node not in visited:
            visited.add(node)
            explored_order.append(node)
            if node == end:
                return path, explored_order
            for neighbor in HOSPITAL_MAP[node]["connections"]:
                if neighbor in HOSPITAL_MAP:
                    if accessible_only and not HOSPITAL_MAP[neighbor].get("wheelchair_accessible", True):
                        continue
                    queue.append((neighbor, path + [neighbor]))
    return None, explored_order

def get_dfs_path(start, end, accessible_only=False):
    stack = [(start, [start])]
    visited = set()
    explored_order = []
    while stack:
        (node, path) = stack.pop()
        if node not in visited:
            visited.add(node)
            explored_order.append(node)
            if node == end:
                return path, explored_order
            for neighbor in HOSPITAL_MAP[node]["connections"]:
                if neighbor in HOSPITAL_MAP:
                    if accessible_only and not HOSPITAL_MAP[neighbor].get("wheelchair_accessible", True):
                        continue
                    stack.append((neighbor, path + [neighbor]))
    return None, explored_order

def get_ucs_path(start, end, crowded_paths=[], accessible_only=False, is_emergency=False):
    pq = [(0, start, [start])]
    visited = {}
    explored_order = []
    while pq:
        (cost, node, path) = heapq.heappop(pq)
        if node in visited and visited[node] <= cost:
            continue
        visited[node] = cost
        explored_order.append(node)
        if node == end:
            return path, explored_order
        for neighbor, weight in HOSPITAL_MAP[node]["connections"].items():
            if neighbor not in HOSPITAL_MAP:
                continue
            if accessible_only and not HOSPITAL_MAP[neighbor].get("wheelchair_accessible", True):
                continue
                
            prev_node = path[-2] if len(path) > 1 else None
            actual_weight = get_advanced_weight(prev_node, node, neighbor, weight, crowded_paths, is_emergency)
            
            heapq.heappush(pq, (cost + actual_weight, neighbor, path + [neighbor]))
    return None, explored_order

def get_astar_path(start, end, crowded_paths=[], accessible_only=False, is_emergency=False):
    pq = [(heuristic(start, end), 0, start, [start])]
    visited = {}
    explored_order = []
    while pq:
        (f, g, node, path) = heapq.heappop(pq)
        if node in visited and visited[node] <= g:
            continue
        visited[node] = g
        explored_order.append(node)
        if node == end:
            return path, explored_order
        for neighbor, weight in HOSPITAL_MAP[node]["connections"].items():
            if neighbor not in HOSPITAL_MAP:
                continue
            if accessible_only and not HOSPITAL_MAP[neighbor].get("wheelchair_accessible", True):
                continue
                
            prev_node = path[-2] if len(path) > 1 else None
            actual_weight = get_advanced_weight(prev_node, node, neighbor, weight, crowded_paths, is_emergency)
            
            new_g = g + actual_weight
            new_f = new_g + heuristic(neighbor, end)
            heapq.heappush(pq, (new_f, new_g, neighbor, path + [neighbor]))
    return None, explored_order

def get_greedy_path(start, end, accessible_only=False):
    pq = [(heuristic(start, end), start, [start])]
    visited = set()
    explored_order = []
    while pq:
        (h, node, path) = heapq.heappop(pq)
        if node not in visited:
            visited.add(node)
            explored_order.append(node)
            if node == end:
                return path, explored_order
            for neighbor in HOSPITAL_MAP[node]["connections"]:
                if neighbor in HOSPITAL_MAP:
                    if accessible_only and not HOSPITAL_MAP[neighbor].get("wheelchair_accessible", True):
                        continue
                    heapq.heappush(pq, (heuristic(neighbor, end), neighbor, path + [neighbor]))
    return None, explored_order

def get_ida_star_path(start, end, crowded_paths=[], accessible_only=False, is_emergency=False):
    bound = heuristic(start, end)
    path = [start]
    explored_order = []
    
    def search(path, g, bound):
        node = path[-1]
        explored_order.append(node)
        f = g + heuristic(node, end)
        if f > bound:
            return f, None
        if node == end:
            return -1, path
            
        min_bound = float('inf')
        for neighbor, weight in HOSPITAL_MAP[node]["connections"].items():
            if neighbor not in HOSPITAL_MAP:
                continue
            if accessible_only and not HOSPITAL_MAP[neighbor].get("wheelchair_accessible", True):
                continue
                
            prev_node = path[-2] if len(path) > 1 else None
            actual_weight = get_advanced_weight(prev_node, node, neighbor, weight, crowded_paths, is_emergency)
                
            if neighbor not in path:
                path.append(neighbor)
                t, found_path = search(path, g + actual_weight, bound)
                if t == -1:
                    return -1, found_path
                if t < min_bound:
                    min_bound = t
                path.pop()
        return min_bound, None

    while True:
        t, found_path = search(path, 0, bound)
        if t == -1:
            return found_path, explored_order
        if t == float('inf'):
            return None, explored_order
        bound = t


def get_shortest_path_cost(start, end, crowded_paths=[], accessible_only=False, is_emergency=False):
    pq = [(0, start, [start])]
    visited = {}
    while pq:
        (cost, node, path) = heapq.heappop(pq)
        if node in visited and visited[node] <= cost:
            continue
        visited[node] = cost
        if node == end:
            return cost, path
        for neighbor, weight in HOSPITAL_MAP[node]["connections"].items():
            if neighbor not in HOSPITAL_MAP:
                continue
            if accessible_only and not HOSPITAL_MAP[neighbor].get("wheelchair_accessible", True):
                continue
                
            prev_node = path[-2] if len(path) > 1 else None
            actual_weight = get_advanced_weight(prev_node, node, neighbor, weight, crowded_paths, is_emergency)
            
            heapq.heappush(pq, (cost + actual_weight, neighbor, path + [neighbor]))
    return float('inf'), []

def find_minimax_meeting_point(starts, destination, crowded_paths=[], accessible_only=False):
    best_meeting_point = None
    min_max_cost = float('inf')
    best_paths_from_starts = {}
    best_path_to_dest = []
    
    for candidate in HOSPITAL_MAP.keys():
        if accessible_only and not HOSPITAL_MAP[candidate].get("wheelchair_accessible", True):
            continue
            
        cost_to_dest, path_to_dest = get_shortest_path_cost(candidate, destination, crowded_paths, accessible_only)
        if cost_to_dest == float('inf'):
            continue
            
        max_cost_for_candidate = 0
        candidate_paths_from_starts = {}
        possible = True
        
        for start in starts:
            cost_from_start, path_from_start = get_shortest_path_cost(start, candidate, crowded_paths, accessible_only)
            if cost_from_start == float('inf'):
                possible = False
                break
            total_cost_for_start = cost_from_start + cost_to_dest
            if total_cost_for_start > max_cost_for_candidate:
                max_cost_for_candidate = total_cost_for_start
            candidate_paths_from_starts[start] = {
                "path": path_from_start,
                "cost": cost_from_start
            }
            
        if possible and max_cost_for_candidate < min_max_cost:
            min_max_cost = max_cost_for_candidate
            best_meeting_point = candidate
            best_paths_from_starts = candidate_paths_from_starts
            best_path_to_dest = path_to_dest
            
    return best_meeting_point, min_max_cost, best_paths_from_starts, best_path_to_dest

def find_minimax_meeting_point_individual_dests(persons, crowded_paths=[], accessible_only=False):
    best_meeting_point = None
    min_max_cost = float('inf')
    best_paths_to_meet = []
    best_paths_from_meet = []
    
    for candidate in HOSPITAL_MAP.keys():
        if accessible_only and not HOSPITAL_MAP[candidate].get("wheelchair_accessible", True):
            continue
            
        max_cost_for_candidate = 0
        candidate_paths_to_meet = []
        candidate_paths_from_meet = []
        possible = True
        
        for person in persons:
            start = person["start"]
            dest = person["end"]
            
            cost_from_start, path_from_start = get_shortest_path_cost(start, candidate, crowded_paths, accessible_only)
            if cost_from_start == float('inf'):
                possible = False
                break
                
            cost_to_dest, path_to_dest = get_shortest_path_cost(candidate, dest, crowded_paths, accessible_only)
            if cost_to_dest == float('inf'):
                possible = False
                break
                
            total_cost_for_person = cost_from_start + cost_to_dest
            if total_cost_for_person > max_cost_for_candidate:
                max_cost_for_candidate = total_cost_for_person
                
            candidate_paths_to_meet.append({
                "path": path_from_start,
                "cost": cost_from_start
            })
            candidate_paths_from_meet.append({
                "path": path_to_dest,
                "cost": cost_to_dest
            })
            
        if possible and max_cost_for_candidate < min_max_cost:
            min_max_cost = max_cost_for_candidate
            best_meeting_point = candidate
            best_paths_to_meet = candidate_paths_to_meet
            best_paths_from_meet = candidate_paths_from_meet
            
    return best_meeting_point, min_max_cost, best_paths_to_meet, best_paths_from_meet


def build_directions_for_path(path, prefix=""):
    directions = []
    if not path:
        return directions
    for i, node in enumerate(path):
        floor = HOSPITAL_MAP[node]["floor"]
        icon = HOSPITAL_MAP[node].get("icon", "📍")
        step = {"step": i + 1, "node": node, "icon": icon, "floor": floor}
        node_name_clean = node.replace('_', ' ')
        if i == 0:
            step["instruction"] = f"{prefix}🚪 Start at {node_name_clean} (Floor {floor})"
        elif i == len(path) - 1:
            step["instruction"] = f"{prefix}📍 Arrive at {node_name_clean} (Floor {floor})"
        else:
            prev_floor = HOSPITAL_MAP[path[i-1]]["floor"]
            curr_floor = floor
            if curr_floor > prev_floor:
                step["instruction"] = f"{prefix}🛗 Take LIFT UP to Floor {curr_floor} towards {node_name_clean}"
            elif curr_floor < prev_floor:
                step["instruction"] = f"{prefix}🛗 Take LIFT DOWN to Floor {curr_floor} towards {node_name_clean}"
            else:
                step["instruction"] = f"{prefix}➡️ Head towards {node_name_clean}"
        directions.append(step)
    return directions

# ─── Routes ───────────────────────────────────────────────────────────────────
@app.route('/')
def index():
    return render_template('home.html')

@app.route('/navigation')
def navigation():
    return render_template('navigation.html')

@app.route('/departments')
def departments():
    return render_template('departments.html')

@app.route('/patients')
def patients():
    return render_template('patients.html')

@app.route('/contact')
def contact():
    return render_template('contact.html')

@app.route('/appointments')
def appointments():
    return render_template('appointments.html')

@app.route('/portal')
def portal():
    return render_template('portal.html')

@app.route('/careers')
def careers():
    return render_template('careers.html')

@app.route('/volunteer')
def volunteer():
    return render_template('volunteer.html')

@app.route('/staff')
def staff():
    return render_template('staff.html')

@app.route('/research')
def research():
    return render_template('research.html')

@app.route('/billing')
def billing():
    return render_template('billing.html')

@app.route('/privacy')
def privacy():
    return render_template('privacy.html')

@app.route('/terms')
def terms():
    return render_template('terms.html')

@app.route('/accessibility')
def accessibility():
    return render_template('accessibility.html')

@app.route('/map-data')
def map_data():
    return jsonify(HOSPITAL_MAP)

@app.route('/find-path', methods=['POST'])
def find_path():
    data = request.json
    persons = data.get('persons')
    
    if not persons:
        starts = data.get('starts')
        if not starts:
            start = data.get('start')
            starts = [start] if start else []
        end = data.get('end')
        
        persons = [{"start": s, "end": end} for s in starts if s and end]
        
    algo = data.get('algo', 'ASTAR')
    crowded = [tuple(sorted(c)) for c in data.get('crowded', [])]
    accessible_only = data.get('wheelchair', False)
    is_emergency = data.get('isEmergency', False)
    
    if not persons or any(p.get("start") not in HOSPITAL_MAP or p.get("end") not in HOSPITAL_MAP for p in persons):
        return jsonify({"error": "Invalid nodes"}), 400
        
    # If only 1 person, use the standard single-person algorithms and return f_g_h_values
    if len(persons) == 1:
        start = persons[0]["start"]
        end = persons[0]["end"]
        if algo == 'BFS':
            path, explored = get_bfs_path(start, end, accessible_only)
        elif algo == 'DFS':
            path, explored = get_dfs_path(start, end, accessible_only)
        elif algo == 'UCS':
            path, explored = get_ucs_path(start, end, crowded, accessible_only, is_emergency)
        elif algo == 'GREEDY':
            path, explored = get_greedy_path(start, end, accessible_only)
        elif algo == 'IDASTAR':
            path, explored = get_ida_star_path(start, end, crowded, accessible_only, is_emergency)
        else:  # Default: A*
            path, explored = get_astar_path(start, end, crowded, accessible_only, is_emergency)

        if path is None:
            return jsonify({"error": "No path found. Try disabling wheelchair filter or check if nodes are connected."}), 404

        # Compute total cost and f, g, h values
        total_cost = 0
        f_g_h_values = []
        if path:
            current_g = 0
            for i in range(len(path)):
                node = path[i]
                if i > 0:
                    prev = path[i-1]
                    prev_prev = path[i-2] if i > 1 else None
                    base_w = HOSPITAL_MAP[prev]["connections"].get(node, 0)
                    w = get_advanced_weight(prev_prev, prev, node, base_w, crowded, is_emergency)
                    current_g += w
                    total_cost += w
                
                h_val = heuristic(node, end)
                f_val = current_g + h_val
                f_g_h_values.append({
                    "node": node,
                    "g": round(current_g, 2),
                    "h": round(h_val, 2),
                    "f": round(f_val, 2)
                })

        directions = build_directions_for_path(path)

        return jsonify({
            "is_multi": False,
            "path": path,
            "explored": explored,
            "total_cost": total_cost,
            "directions": directions,
            "f_g_h_values": f_g_h_values
        })

    # For multiple persons, calculate independent paths for each person
    persons_data = []
    explored_all = set()
    max_cost = 0

    for idx, person in enumerate(persons):
        start = person["start"]
        end = person["end"]
        
        if algo == 'BFS':
            path, explored = get_bfs_path(start, end, accessible_only)
        elif algo == 'DFS':
            path, explored = get_dfs_path(start, end, accessible_only)
        elif algo == 'UCS':
            path, explored = get_ucs_path(start, end, crowded, accessible_only, is_emergency)
        elif algo == 'GREEDY':
            path, explored = get_greedy_path(start, end, accessible_only)
        elif algo == 'IDASTAR':
            path, explored = get_ida_star_path(start, end, crowded, accessible_only, is_emergency)
        else:
            path, explored = get_astar_path(start, end, crowded, accessible_only, is_emergency)
            
        if path is None:
            return jsonify({"error": f"No path found for Person {idx+1}. Please check constraints."}), 404

        # Compute cost
        cost = 0
        if path:
            for i in range(1, len(path)):
                prev, node = path[i-1], path[i]
                prev_prev = path[i-2] if i > 1 else None
                base_w = HOSPITAL_MAP[prev]["connections"].get(node, 0)
                w = get_advanced_weight(prev_prev, prev, node, base_w, crowded, is_emergency)
                cost += w

        if cost > max_cost:
            max_cost = cost
            
        directions = build_directions_for_path(path, prefix=f"👤 Person {idx+1}: ")
        
        persons_data.append({
            "person_index": idx,
            "start": start,
            "end": end,
            "path_to_meet": path,
            "path_from_meet": [],
            "cost_to_meet": cost,
            "cost_from_meet": 0,
            "total_cost": cost,
            "directions_to_meet": directions,
            "directions_from_meet": []
        })
        
        explored_all.update(explored)

    return jsonify({
        "is_multi": True,
        "meeting_point": "",
        "meeting_point_info": { "name": "", "icon": "", "floor": 0 },
        "persons_data": persons_data,
        "total_cost": max_cost,
        "explored": list(explored_all)
    })

if __name__ == "__main__":
    app.run(host="0.0.0.0", port=5998, debug=True)