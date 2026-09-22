# Phase 1 — frontend ADD (add-only): live reload for HospitalDashboard.
# 1) expose the loader via a ref so handlers can trigger a refresh,
# 2) window CustomEvent listeners for the 3 backend-driven realtime events,
# 3) refresh the dashboard right after an accept/reject succeeds.
import io

p = r"frontend\src\pages\hospital\HospitalDashboard.tsx"
c = io.open(p, encoding="utf-8", newline="").read()
print("LEN", len(c))

# ── A) add loadRef next to the other refs ──
a_old = "  const seenCases = useRef(new Set());"
a_new = "  const seenCases = useRef(new Set());\n  const loadRef = useRef<() => void>(() => {});"
assert c.count(a_old) == 1, "A anchor count != 1"
c = c.replace(a_old, a_new)

# ── B) set loadRef.current inside the mount effect right after `load();` ──
b_old = "    load();\n    const iv = setInterval(load, 5000);"
b_new = "    load();\n    loadRef.current = load;\n    const iv = setInterval(load, 5000);"
assert c.count(b_old) == 1, "B anchor count != 1: %d" % c.count(b_old)
if c.count("loadRef.current = load;") == 0:
    c = c.replace(b_old, b_new)

# ── C) add window CustomEvent listeners right after the popup effect ──
c_old = """  const { popupCase, setPopupCase } = useSocket();"""
c_new = """  const { popupCase, setPopupCase } = useSocket();

  // ── ADD-ONLY (Phase 1 — realtime echo): the backend now emits
  //    case:assigned-to-us / case:closed-elsewhere / case:rejected-by-us to
  //    every hospital socket, and SocketContext forwards each as a window
  //    CustomEvent. When one of those lands WHILE this dashboard is open we
  //    re-pull the dashboard immediately (no manual refresh / no reliance on
  //    the 5s poll) so Incoming → Active moves are live.
  useEffect(() => {
    const refresh = () => loadRef.current();
    const onAssigned = () => {
      console.log("[Dashboard] 🏥 assigned-to-us → refresh");
      refresh();
    };
    const onClosed = () => {
      console.log("[Dashboard] ⏹ closed-elsewhere → refresh");
      refresh();
    };
    const onRejected = () => {
      console.log("[Dashboard] 🚫 rejected-by-us → refresh");
      refresh();
    };
    window.addEventListener("hospital:case:assigned-to-us", onAssigned);
    window.addEventListener("hospital:case:closed-elsewhere", onClosed);
    window.addEventListener("hospital:case:rejected-by-us", onRejected);
    return () => {
      window.removeEventListener("hospital:case:assigned-to-us", onAssigned);
      window.removeEventListener("hospital:case:closed-elsewhere", onClosed);
      window.removeEventListener("hospital:case:rejected-by-us", onRejected);
    };
  }, []);

  // ⚡ also refresh right after a successful accept/reject so OUR OWN list
  //    (Incoming → Active) updates instantly without waiting for the poll.
  //    (ADD-ONLY — original handlers otherwise untouched.)"""
assert c.count(c_old) == 1, "C anchor count != 1"
c = c.replace(c_old, c_new, 1)
