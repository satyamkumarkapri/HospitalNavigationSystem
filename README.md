# HospNav AI Architecture

An intelligent, multi-floor hospital navigation and management web application powered by advanced Artificial Intelligence search algorithms. This repository demonstrates core AI concepts mapped to a practical, real-world domain: **Hospital Navigation and Resource Management**.

The project is structured to satisfy rigorous Artificial Intelligence syllabus requirements (CO1 – CO6).

---

## Detailed Breakdown of AI Concepts

### 1. Python Essentials, Data Structures & Empirical Profiling (CO1)
The application leverages robust Python features to ensure type-safe, efficient AI algorithms.
- **Advanced Python Constructs**: Built using modern `typing` (e.g., `Dict`, `List`, `Set`, `Optional`) and `dataclasses` to cleanly model graph nodes, edges, and state representations. 
- **Core Data Structures**: Utilizes Python's native `heapq` to implement $O(\log n)$ priority queues for algorithms like A* and UCS, alongside `collections.deque` for fast BFS operations.
- **Empirical Profiling**: Every pathfinding algorithm dynamically measures three critical metrics:
  - **Runtime ($ms$)**: Using high-precision `time.perf_counter()`.
  - **Space Complexity / Peak Memory ($KB$)**: By profiling the size of the frontier (priority queue) and the `explored` set dynamically during graph traversal.
  - **Nodes Expanded**: Tracks how many states were popped from the frontier, illustrating the strict difference in efficiency between Blind Search (exploring thousands of nodes) and Heuristic Search (exploring very few).

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
- **IDA* (Iterative Deepening A*)**: A memory-bounded variant of A*. Instead of storing the entire frontier in memory (which can cause memory leaks in massive graphs), IDA* uses standard DFS but cuts off branches where $f(n)$ exceeds a threshold. If it fails, the threshold is raised to the minimum excess cost observed, and the search restarts.

### 3. Constraint Satisfaction Problems (CSP) (CO3)
Located in the **Staff Portal**, the Auto-Scheduler treats hospital staffing as a formal CSP.
- **Variables**: Doctors / Staff members.
- **Domains**: Cartesian product of available Shifts (e.g., Morning, Night) and Rooms (e.g., Room A, Room B).
- **Constraints**: Hard constraints prevent assignments where multiple doctors are assigned to the exact same room on the exact same shift.
- **Backtracking Engine**: The core solver recursively assigns domain values to variables. If a constraint is violated, it backtracks and tries the next value.
- **MRV (Minimum Remaining Values)**: A variable-ordering heuristic. The solver first attempts to schedule the doctor who has the *fewest* valid shifts available. This fails fast and drastically prunes the search tree.
- **LCV (Least Constraining Value)**: A value-ordering heuristic. When assigning a shift to a doctor, the solver chooses the shift/room combo that rules out the *fewest* choices for the remaining unscheduled doctors.
- **Min-Conflicts Algorithm**: A local search solver that starts with a complete random assignment and iteratively reassigns conflicted variables to values that minimize the total number of constraint violations. This acts as a highly efficient alternative to standard backtracking.

### 4. Adversarial & Stochastic Search (CO4)
The hospital environment involves both multi-agent interactions and non-deterministic events.
- **Minimax Algorithm**: Used for Multi-Person Routing. When multiple people (up to 6) need to meet, the system treats it as an adversarial minimization problem. It finds a central meeting point that minimizes the maximum travel cost of any individual, ensuring fairness.
- **Alpha-Beta Pruning (Worst-Case Evacuation Simulator)**: Simulates a 2-player game where an "Adversary" (e.g. fire/hazard) introduces dynamic delays to maximize escape time. The algorithm efficiently prunes mathematically inferior paths to find the safest evacuation route.
- **Expectimax Algorithm**: When the `Expectimax` search option is enabled, the agent models the environment as a game against nature.
- **Tree Structure**: 
  - **Max Nodes**: The pathfinding agent choosing which corridor to take.
  - **Chance Nodes**: The environment dictating the travel delay based on a probability distribution.
- **Expected Utility**: Rather than calculating absolute distance, Expectimax calculates $V = \sum P(\text{outcome}) \times U(\text{outcome})$. For example, an elevator might have a 70% chance of being fast (delay=2) and 30% chance of being stuck (delay=20). Expectimax will dynamically weigh this expected cost ($7.4$) against the deterministic cost of taking the stairs ($10$), choosing the elevator despite the risk.

### 5. Probabilistic Reasoning & Hidden Markov Models (CO5 & CO6)
Located in the Navigation sidebar under **HMM Asset Tracker**. Used to track moving assets (like expensive medical equipment or patients) when GPS is unavailable indoors and we rely on noisy sensor reports.
- **Markov Property**: The assumption that the asset's next location depends *only* on its current location, independent of its historical path.
- **Transition Model ($P(X_t | X_{t-1})$)**: The probability matrix dictating how the asset moves. Modeled mathematically based on the exact edge connections of the `HOSPITAL_MAP` graph (e.g., an asset in a room with 4 doors has a 25% chance of moving through any given door).
- **Sensor/Emission Model ($P(e_t | X_t)$)**: The probability of receiving a specific noisy sensor reading (e.g., a nurse typing "I saw it near the Elevator") given the asset's true state.
- **Forward Algorithm (Filtering)**: The system dynamically tracks the *Belief State* (a probability distribution over all rooms). When evidence is provided, it calculates $P(X_t | e_{1:t}) = \alpha P(e_t | X_t) \sum P(X_t | X_{t-1}) P(X_{t-1} | e_{1:t-1})$ to output the top 5 most mathematically probable locations of the asset.

---

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
