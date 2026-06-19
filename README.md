# HospNav AI Architecture

An intelligent, multi-floor hospital navigation and management web application powered by advanced Artificial Intelligence search algorithms. This repository demonstrates core AI concepts mapped to a practical, real-world domain: **Hospital Navigation and Resource Management**.

The project is structured to satisfy rigorous Artificial Intelligence syllabus requirements (CO1 – CO6).

---

## Detailed Breakdown of AI Concepts

### 1. Python Essentials, Data Structures & Rule-Based Expert Systems (CO1)
The application leverages robust Python features to ensure type-safe, efficient AI algorithms.
- **Rule-Based Expert System (Triage)**: Implemented a forward-chaining `MedicalTriageSystem` that uses explicit IF-THEN rules and set intersections to automatically diagnose patient symptoms (e.g., "chest pain" -> ER) and route them to the correct department.
  - 🏥 **Hospital Use Case**: An automated triage chatbot at the front desk that instantly directs incoming patients to Neurology, Maternity, or the ER based on symptom keywords, saving critical nurse evaluation time.
- **Advanced Python Constructs**: Built using modern `typing` (e.g., `Dict`, `List`, `Set`, `Optional`) and `dataclasses` to cleanly model graph nodes, edges, and state representations. 
- **Core Data Structures**: Utilizes Python's native `heapq` to implement $O(\log n)$ priority queues for algorithms like A* and UCS, alongside `collections.deque` for fast BFS operations.
- **Empirical Profiling**: Every pathfinding algorithm dynamically measures three critical metrics:
  - **Runtime ($ms$)**: Using high-precision `time.perf_counter()`.
  - **Space Complexity / Peak Memory ($KB$)**: By profiling the size of the frontier (priority queue) and the `explored` set dynamically during graph traversal.
  - **Nodes Expanded**: Tracks how many states were popped from the frontier, illustrating the strict difference in efficiency between Blind Search and Heuristic Search.

### 2. Search Algorithms (Blind & Heuristic) (CO2)
The Navigation module acts as the core pathfinding agent. The environment is fully observable, deterministic, static, and discrete.

#### Uninformed (Blind) Search
These algorithms explore the hospital graph without any domain knowledge about where the goal is.
- **BFS (Breadth-First Search)**: Explores level-by-level. Useful for finding the path with the *absolute fewest edge transitions* (e.g., taking 3 long hallways instead of 6 short ones), regardless of total walking distance.
- **DFS (Depth-First Search)**: Plunges deep into the graph. Mostly experimental for demonstrating poor worst-case pathfinding behavior in graphs without depth limits.
- **UCS (Uniform Cost Search)**: Expands nodes based strictly on the path cost so far: $g(n)$. It guarantees the mathematically shortest distance path but expands uniformly in all directions.
  - **Tie-Breaking Strategy**: When two paths have identical $g(n)$ costs, Python's `heapq` will throw a `TypeError` if node objects are unorderable. We implemented a strict integer `tie` counter (e.g., `(cost, tie, node)`) to ensure deterministic FIFO tie-breaking behavior.

#### Informed (Heuristic) Search
These algorithms utilize an evaluation function $f(n) = g(n) + h(n)$ to guide the search towards the goal.
- **A* Search**: Guarantees the shortest path while exploring a fraction of the nodes compared to UCS. 
  - **Admissibility**: The heuristic $h(n)$ (Euclidean/Manhattan distance) never overestimates the true walking distance.
  - **Consistency**: The heuristic satisfies the triangle inequality $h(n) \le c(n, a, n') + h(n')$, ensuring the $f$-costs are monotonically non-decreasing along any path.
- **Greedy Best-First Search**: Highly aggressive, sorting the frontier strictly by $h(n)$. It dives straight toward the target room, completely ignoring the cost accumulated so far $g(n)$. Fast, but often yields sub-optimal paths.
- **IDA* (Iterative Deepening A*)**: A memory-bounded variant of A*. Uses standard DFS but cuts off branches where $f(n)$ exceeds a threshold.
- **Implicit State Space Search**: An implementation of an implicit puzzle solver (8-puzzle style logic) to demonstrate searching dynamic configurations where states are generated on the fly rather than stored entirely in memory.
  - 🏥 **Hospital Use Case**: Calculating the optimal sequence of moves to rearrange hospital beds or surgical equipment in a crowded ICU to extract a specific asset without colliding with life-support machines.

### 3. Constraint Satisfaction Problems (CSP) (CO3)
Located in the **Staff Portal**, the Auto-Scheduler treats hospital staffing as a formal CSP.
- **Variables**: Doctors / Staff members.
- **Domains**: Cartesian product of available Shifts (e.g., Morning, Night) and Rooms (e.g., Room A, Room B).
- **Constraints**: Hard constraints prevent assignments where multiple doctors are assigned to the exact same room on the exact same shift.
- **Backtracking Engine with Forward Checking**: The core solver recursively assigns domain values to variables. Crucially, it implements **Forward Checking** to dynamically prune the domains of unassigned doctors the moment a shift is claimed, allowing it to fail fast and exponentially speed up scheduling.
- **MRV (Minimum Remaining Values)**: A variable-ordering heuristic. The solver first attempts to schedule the doctor who has the *fewest* valid shifts available.
- **Explainability**: The CSP actively tracks constraint failures and generates human-readable reasoning strings (e.g., *"Cannot assign Dr. Smith to Room A because Dr. Jones is already booked there"*).
- **Min-Conflicts Algorithm**: A local search solver that starts with a complete random assignment and iteratively reassigns conflicted variables to values that minimize the total number of constraint violations.
  - 🏥 **Hospital Use Case**: The Automated Staff Portal generates 100% conflict-free weekly schedules for doctors, ensuring no two surgeons are booked for the exact same operating theater at the same time, while providing clear HR explanations if a schedule request is mathematically impossible.

### 4. Adversarial & Stochastic Search (CO4)
The hospital environment involves both multi-agent interactions and non-deterministic events.
- **Minimax Algorithm**: Used for Multi-Person Routing. When multiple people (up to 6) need to meet, the system treats it as an adversarial minimization problem. It finds a central meeting point that minimizes the maximum travel cost of any individual, ensuring fairness.
- **Alpha-Beta Pruning (Worst-Case Evacuation Simulator)**: Simulates a 2-player game where an "Adversary" (e.g. fire/hazard) introduces dynamic delays to maximize escape time. The algorithm efficiently prunes mathematically inferior paths to find the safest evacuation route.
- **Markov Decision Process (MDP) & Policy Selection**: Uses **Value Iteration** to generate an optimal mathematical Policy mapping every single room in the hospital to the best possible action, completely solving the environment under stochastic uncertainty (e.g., elevators randomly breaking).
- **Expectimax Algorithm**: When the `Expectimax` search option is enabled, the agent models the environment as a game against nature. Expectimax dynamically weighs the expected utility of probabilistic travel delays against deterministic costs.
  - 🏥 **Hospital Use Case (Stochastic Routing)**: Choosing whether a paramedic should take an elevator (which has a 20% chance of being broken/slow) versus taking the stairs (which is a guaranteed, but slower, deterministic cost).
  - 🏥 **Hospital Use Case (Minimax Evacuation)**: Coordinating a multi-ward emergency evacuation where 6 different patient groups must meet at a central triage point, ensuring nobody is left waiting significantly longer than anyone else.

### 5. Probabilistic Reasoning & Hybrid Architectures (CO5 & CO6)
The project combines multiple disparate AI subfields into a single integrated system.
- **Bayesian Networks & Inference**: Implemented an AI Diagnostic tool utilizing a Bayesian Network with Conditional Probability Tables (CPTs). Calculates exact posterior probabilities of specific diseases given explicit symptom evidence.
  - 🏥 **Hospital Use Case**: A clinical decision-support tool for doctors that calculates the exact percentage probability of a patient having COVID vs the Flu given symptoms like "loss of taste" and "fever".
- **Hidden Markov Models (HMM Tracker)**: Used to track moving assets when GPS is unavailable. Utilizes a discrete **Transition Model** ($P(X_t | X_{t-1})$) and **Sensor Model** to calculate the *Belief State* via the Forward Algorithm (Filtering).
  - 🏥 **Hospital Use Case**: Tracking a stolen or lost $50,000 portable defibrillator using only noisy, unconfirmed reports from staff ("I think I heard it near the East Wing").
- **True Hybrid Architecture**: The system natively connects its probabilistic and search layers. The core A* Pathfinding agent constantly queries the HMM Tracker; if an asset is mathematically highly probable to be blocking a corridor, the pathfinding agent dynamically increases edge weights to automatically route around the probabilistic obstacle.
  - 🏥 **Hospital Use Case**: A smart wheelchair automatically re-routing a patient down a longer hallway because the HMM engine predicts an 80% chance that a janitor's cart is currently blocking the primary route.
- **Explainable Reasoning Traces**: The pathfinding algorithms actively log their internal mathematical decisions (e.g., node expansions, pruned paths, heuristic evaluations), passing this "thought process" back to the frontend for transparent AI reasoning.
- **Ethics & Limitations (Bias & Miscalibration)**: The system inherently explores technical limitations. A poorly designed heuristic (e.g., ignoring wheelchair accessible restrictions) introduces algorithmic bias against physically disabled patients. Furthermore, if the HMM Sensor Model is overconfident (uncertainty miscalibration), the system might falsely lock down a hallway assuming a hazard is present when it isn't, demonstrating the critical need for safe, calibrated AI in healthcare.

## Setup & Installation

1. **Create a virtual environment (optional but recommended)**:
   ```bash
   python3 -m venv venv
   source venv/bin/activate
   ```

2. **Install dependencies**:
   ```bash
   pip install -r requirements.txt
   ```

3. **Run the Application**:
   ```bash
   python3 app.py
   ```
   The application will be served at: `http://localhost:5998`

4. **Run AI Unit Tests**:
   To verify the CSP scheduling and HMM tracking logic independently of the web framework, run the unit test suite:
   ```bash
   python3 -m unittest test_algorithms.py
   ```

## API Endpoint Documentation

The AI features are exposed through a series of RESTful JSON APIs available in `app.py`:

- **`POST /api/triage`**: Rule-Based Expert System endpoint. Provide an array of `symptoms` and it uses forward-chaining rules to recommend a department.
- **`POST /api/diagnose`**: Bayesian Inference endpoint. Given symptom `evidence`, calculates the exact posterior probability distribution of diseases using Conditional Probability Tables.
- **`POST /api/solve_puzzle`**: Implicit state-space puzzle solver utilizing recursive logic to find minimum-move sequences dynamically.
- **`POST /api/get_policy`**: Runs the Value Iteration algorithm (MDP) to calculate an optimal directional policy across every hospital node for a given destination.
- **`POST /api/track`**: Hidden Markov Model filtering endpoint. Accepts a sensor reading `evidence` string and updates the belief state distribution of a moving asset.
- **`GET /api/schedule`**: Solves the Doctor Scheduling Constraint Satisfaction Problem. Accepts an `algo` parameter (e.g. `minconflicts` or `backtracking`). Returns the conflict-free schedule and explainable reasoning traces.
- **`POST /api/route`**: The core Pathfinding API. Takes start/end nodes, algorithm selection, and dynamic constraints (wheelchair access, crowds). Returns the optimal path, computational metrics (Runtime, Peak Memory, Nodes Expanded), and exact reasoning trace logs.

## User Interface Highlights
- **Interactive SVG Map**: Full pan, zoom, and tilt (3D) capable SVG map with detailed node information and real-time path drawing.
- **Multi-Person Routing (Minimax-inspired)**: Calculate independent, conflict-free paths for up to 6 people simultaneously to a common meeting point, minimizing the maximum travel time of any single individual.
- **Safety Protocols**: Option to strictly route through wheelchair-accessible nodes and bypass congested corridors using infinite-weight heuristic penalties.
- **Emergency Mode**: Instant, one-click routing to the ER using the fastest algorithmic heuristics.

## Project Structure & File Usage

This section explains the exact purpose of the primary files and directories in this repository.

### Backend & Core AI Logic
- **`app.py`**: The heart of the application. This is the Flask web server that handles API requests, serves the HTML templates, and contains the entire `HOSPITAL_MAP` graph dataset. Crucially, it houses **all of the AI algorithms** including:
  - Blind/Heuristic pathfinding functions (`UCS`, `A*`, `Greedy`, `IDA*`, etc.)
  - Constraint Satisfaction Engine (`BacktrackingCSP` class)
  - Stochastic Search Router (`get_expectimax_path`)
  - Probabilistic Filtering Engine (`HMMTracker` class)
- **`test_algorithms.py`**: The automated unit testing suite (`unittest`). Contains programmatic tests to independently verify the logical correctness of the CSP scheduler and HMM asset tracker without needing to spin up the web server.
- **`requirements.txt`**: Lists all Python dependencies required to run the backend (e.g., `Flask`).

### Deployment & Patch Utilities
- **`patch_app.py`**: A deployment utility script used to dynamically inject the AI constraints, Expectimax, and HMM tracking logic directly into the backend `app.py` architecture.
- **`patch_frontend.py`**: A deployment utility script used to inject the frontend UI elements (Tracking widgets, Schedule tabs, profiling metric Javascript) into the HTML templates and static scripts.

### Frontend Templates (`/templates`)
These are the HTML files rendered by Flask using Jinja2 templating.
- **`base.html`**: The foundational HTML boilerplate. Contains the global navigation bar, standard CSS imports, and the footer. All other pages `{% extend %}` this file.
- **`index.html`**: A simple redirect file to automatically send users to the main application URL.
- **`home.html`**: The main landing page of the hospital website ("Compassionate Care, Guided by AI").
- **`navigation.html`**: The primary user interface for the AI routing. Contains the interactive 3D SVG hospital map, algorithm selection dropdowns, safety constraints toggles, and the HMM asset tracking widget.
- **`staff.html`**: The secure portal for hospital employees. Houses the UI for the **AI Staff Scheduler** (the CSP implementation) used to assign doctors to conflict-free shifts.
- **`appointments.html`, `departments.html`, `patients.html`, etc.**: Various informative pages providing context and UI structure for the hospital's web presence.

### Static Assets (`/static`)
- **`static/js/script.js`**: The core frontend JavaScript. Responsible for rendering the interactive SVG graph, dynamically animating the pathfinding routes (drawing lines between nodes), rendering multi-person simultaneous paths, and parsing the metric data (Runtime/Memory) returned by `app.py`.
- **`static/css/style.css`**: Contains all visual styling, utilizing CSS variables, glassmorphism design, custom animations, and responsive layouts to ensure the application feels exceptionally premium.

---

## Connect with Me

- **GitHub**: [satyamkumarkapri](https://github.com/satyamkumarkapri)
- **LinkedIn**: [satyamkumarkapri](https://www.linkedin.com/in/satyamkumarkapri)
- **Twitter**: [@satyam_kapri](https://twitter.com/satyam_kapri)
- **Instagram**: [btw_its._satyam](https://www.instagram.com/btw_its._satyam?igsh=c2VmYmN2MHBnemVq)
- **Facebook**: [Satyam Kumar Kapri](https://www.facebook.com/share/1DWHFm4rNs/)
