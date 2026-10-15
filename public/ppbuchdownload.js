(function () {
  var A =
      "https://tinguvlwumswhznygirl.supabase.co/functions/v1/get-book-download",
    P = location.pathname,
    F = /e-book/.test(P) ? "e-book" : /h(o|oe)rbuch/.test(P) ? "hoerbuch" : 0;
  if (!F) return;
  function E(t, c, x) {
    var e = document.createElement(t);
    if (c) e.style.cssText = c;
    if (x) e.textContent = x;
    return e;
  }
  function S(b, t) {
    var o = b.parentNode.querySelector(".pp-msg");
    if (!o) {
      o = E("p", "margin-top:1rem");
      o.className = "pp-msg";
      b.after(o);
    }
    o.textContent = t + " Fragen gern an info@creativechangeworks.com.";
  }
  async function L() {
    var m = window.$memberstackDom,
      t = m && m.getMemberCookie();
    if (!t) {
      location.href = "/login";
      return;
    }
    var r = await fetch(A, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: "Bearer " + t,
        },
        body: JSON.stringify({ format: F }),
      }),
      d = await r.json().catch(() => ({}));
    if (r.status == 401) {
      location.href = "/login";
      return;
    }
    if (!r.ok) throw Error(d.error);
    return d.files || [];
  }
  function U(b, f) {
    var w = E(
      "div",
      "margin-top:1.5rem;display:grid;gap:1.25rem;text-align:left",
    );
    f.forEach((x) => {
      var r = E("div");
      if (x.type == "audio") {
        r.append(E("strong", "display:block", x.label));
        var a = E("audio", "width:100%");
        a.controls = 1;
        a.preload = "none";
        a.src = x.url;
        r.append(a);
      }
      var l = E("a", 0, x.label + " herunterladen");
      l.href = x.downloadUrl;
      r.append(l);
      w.append(r);
    });
    w.append(
      E(
        "p",
        "font-size:.875rem",
        "Download-Links gelten 10 Minuten, danach Seite neu laden.",
      ),
    );
    b.style.display = "none";
    b.after(w);
  }
  function I() {
    var b = document.querySelector("a.button.is-alternate");
    if (!b) return;
    b.removeAttribute("target");
    b.href = "#download";
    var k = 0;
    b.addEventListener("click", async (e) => {
      e.preventDefault();
      if (k) return;
      k = 1;
      b.style.opacity = ".6";
      try {
        var f = await L();
        if (!f) return;
        if (F == "e-book") {
          var p = f.find((x) => x.type == "pdf");
          if (!p) throw Error();
          location.href = p.downloadUrl;
        } else U(b, f);
      } catch (r) {
        S(
          b,
          r.message == "no_access"
            ? "Für dieses Format ist mit deinem Konto kein Kauf hinterlegt."
            : "Das hat nicht geklappt, bitte lade die Seite neu.",
        );
      } finally {
        k = 0;
        b.style.opacity = "";
      }
    });
  }
  document.readyState == "loading"
    ? document.addEventListener("DOMContentLoaded", I)
    : I();
})();
