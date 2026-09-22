# Phase 1 (frontend — realtime fix, ADD-ONLY): HospitalDashboard.tsx
# Adds (a) window CustomEvent listeners that trigger a live refresh on
# assign/closed/rejected, and (b) a reload immediately after a successful
# accept. Byte-exact anchors verified from the clean read of lines 12-131.
import io
p = r"frontend\src\pages\hospital\HospitalDashboard.tsx"
c = io.open(p, encoding="utf-8", newline="").read()
print("LEN", len(c))

# ── (A) mount-effect tail: 5s poll already present → ADD listeners right after ──
a_old = """    const iv = setInterval(load, 5000);
    return () => clearInterval(iv);
  }, []);"""
assert c.count(a_old) == 1, "A count " + str(c.count(a_old))
a_new = """    const iv = setInterval(load, 5000);
    return () => clearInterval(iv);
  }, []);

  // ── ADD-ONLY (Phase 1 — realtime fix): live-refresh on window CustomEvents
  //    forwarded by SocketContext for case:assigned-to-us / case:closed-elsewhere
  //    / case:rejected-by-us. Reloads the dashboard list the instant our own
  //    accept/reject (or another hospital's take) lands, instead of waiting
  //    for the next 5s poll.──
  useEffect(() => {
    const reload = () => {
      try {
        hospitalApi.pendingCases().then((res) => setCases(res.cases || [])).catch(() => {});
      } catch {}
    };
    const onAssigned = () => reload();
    const onClosed = () => reload();
    const onRejected = () => reload();
    window.addEventListener("hospital:case:assigned-to-us", onAssigned);
    window.addEventListener("hospital:case:closed-elsewhere", onClosed);
    window.addEventListener("hospital:case:rejected-by-us", onRejected);
    return () => {
      window.removeEventListener("hospital:case:assigned-to-us", onAssigned);
      window.removeEventListener("hospital:case:closed-elsewhere", onClosed);
      window.removeEventListener("hospital:case:rejected-by-us", onRejected);
    };
  }, []);"""
c = c.replace(a_old, a_new, 1)

# ── (B) accept → reload list right after success ──
b_old = """    try {
      await hospitalApi.acceptCase(caseId);
      setPopupCase(null);
    } catch (err) {
      alert("Failed to accept");
    }
  };"""
assert c.count(b_old) == 1, "B count " + str(c.count(b_old))
b_new = """    try {
      await hospitalApi.acceptCase(caseId);
      setPopupCase(null);
      // ── ADD (Phase 1): move the accepted case into Active immediately ──
      window.dispatchEvent(new CustomEvent("hospital:case:assigned-to-us", { detail: { caseId } }));
    } catch (err) {
      alert("Failed to accept");
    }
  };"""
c = c.replace(b_old, b_new, 1)

io.open(p, "w", encoding="utf-8", newline="").write(c)
print("✅ Phase 1 frontend ADD applied")
print("  window listeners present:", "hospital:case:assigned-to-us" in c)
print("  accept-triggered CustomEvent present:", "window.dispatchEvent(new CustomEvent(\"hospital:case:assigned-to-us\"" in c)
