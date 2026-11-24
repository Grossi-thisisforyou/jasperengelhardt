"""Builds terms.html from the guest-facing terms.md. Usage: python3 booking/make_terms.py path/to/terms.md"""
import html, re, sys, pathlib
src = pathlib.Path(sys.argv[1]).read_text().split("\n---")[0]
def inline(t):
    t = html.escape(t.replace("\\[", "[").replace("\\]", "]").replace("\\_", "_"), quote=False)
    t = re.sub(r"\*\*(.+?)\*\*", r"<b>\1</b>", t)
    t = re.sub(r"(?<!\w)_(.+?)_(?!\w)", r"<i>\1</i>", t)
    return t.replace("[contact]", '<a id="mail" href="index.html#contact">Jasper\'s email</a>')
out, title = [], ""
for block in [b.strip() for b in src.split("\n\n") if b.strip()]:
    if block.startswith("# "): title = block[2:]; continue
    m = re.match(r"## (\d+)\. (.*)", block)
    if m: out.append(f'<h2 id="s{m[1]}"><span>{m[1]}</span>{inline(m[2])}</h2>'); continue
    out.append(f"<p>{inline(block)}</p>")
body = "\n".join(out)
page = f"""<!DOCTYPE html>
<html lang="en">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1, viewport-fit=cover">
<title>Infinite Jest · Terms of Participation</title>
<meta name="description" content="Terms of Participation for Infinite Jest by JRA Engelhardt.">
<meta name="theme-color" content="#ffffff">
<link rel="preconnect" href="https://fonts.googleapis.com">
<link rel="preconnect" href="https://fonts.gstatic.com" crossorigin>
<link href="https://fonts.googleapis.com/css2?family=Instrument+Sans:ital,wght@0,400..600;1,400&family=Instrument+Serif:ital@0;1&display=swap" rel="stylesheet">
<style>
:root{{--bg:#fff;--ink:#0c0c0c;--mute:#6b6b66;--line:#e6e6e2;--serif:"Instrument Serif","Times New Roman",serif;--sans:"Instrument Sans","Helvetica Neue",Helvetica,Arial,sans-serif;--pad:clamp(16px,4.2vw,64px)}}
*{{box-sizing:border-box}}
body{{margin:0;background:var(--bg);color:var(--ink);font-family:var(--sans);font-size:16px;line-height:1.65;-webkit-font-smoothing:antialiased}}
a{{color:inherit;text-decoration:none;border-bottom:1px solid currentColor}} a:hover{{opacity:.6}}
.head{{display:flex;justify-content:space-between;align-items:baseline;padding:18px var(--pad);border-bottom:1px solid var(--line)}}
.head .name{{font-family:var(--serif);font-size:23px;line-height:1;border:0}} .head nav a{{border:0;font-size:14px;margin-left:18px}}
main{{max-width:700px;margin:0 auto;padding:clamp(40px,8vh,90px) var(--pad) 80px}}
.label{{font-size:12px;letter-spacing:.09em;text-transform:uppercase;color:var(--mute)}}
h1{{font-family:var(--serif);font-weight:400;font-size:clamp(40px,6vw,68px);line-height:1;margin:8px 0 18px}}
h2{{font-family:var(--serif);font-weight:400;font-size:28px;line-height:1.15;margin:48px 0 10px;scroll-margin-top:20px}}
h2 span{{font-family:var(--sans);font-size:13px;color:var(--mute);margin-right:12px;letter-spacing:.09em}}
p{{margin:0 0 14px;text-wrap:pretty}} :target{{background:#f5f5f2}}
.cta{{margin-top:56px;padding:24px;border:1px solid var(--ink);border-radius:16px}}
.cta a.btn{{display:inline-block;margin-top:10px;background:var(--ink);color:var(--bg);border:0;border-radius:999px;padding:12px 26px;font-weight:500}}
</style>
</head>
<body>
<header class="head"><a class="name" href="index.html">JRA Engelhardt</a><nav><a href="visit.html">Book a visit</a><a href="index.html">Home</a></nav></header>
<main>
<div class="label">Infinite Jest</div>
<h1>Terms of Participation</h1>
{body}
<div class="cta"><p>Pick a time on the booking page. The one tick box is optional.</p><a class="btn" href="visit.html">Book a visit</a></div>
</main>
<script>(function(){{var a=document.getElementById("mail");if(a)a.href="mailto:"+"jasperengelhardt"+"@"+"protonmail.com";}})();</script>
</body>
</html>
"""
pathlib.Path(__file__).resolve().parent.parent.joinpath("terms.html").write_text(page)
print("wrote terms.html", len(page))
