"""Draws the swimlane components map (docs/class-materials/Components_Map_Aangan.svg)."""
import sys
W=1450;lane_top=60;LH=78
lanes=[(["CALLER"],""),(["VOICE AGENT"],"(Vaani)"),(["STUDIO","RULES"],"(3 files)"),(["LLM"],"(the AI brain)"),(["CALENDARS"],"(one per designer)"),(["TELEGRAM"],"(message)"),(["DESIGNER"],"(1 of 14)"),(["DASHBOARD"],"(front desk, designers)"),(["FRONT DESK"],""),(["HUBSPOT"],"(records, founder view)")]
H=lane_top+LH*len(lanes)+40
cx={"T":230,"I":440,"C":660,"P":890,"O1":1110,"O2":1310}
BW=170;BH=52
boxes={}
def box(id,lane,col,lines): boxes[id]=(cx[col],lane_top+lane*LH+LH/2,lines)
box("A1",0,"T",["Calls the studio","at any time"])
box("A2",0,"I",["Tells us about the","project: place, size,","timing, who decides"])
box("A3",0,"O1",["Hears who will call,","when, and a thank you"])
box("V1",1,"T",["Answers right away,","any time of day"])
box("V2",1,"I",["Asks the questions;","never asks about budget"])
box("V3",1,"C",["Checks the studio's","rules and urgency"])
box("V4",1,"P",["Complaint? Good fit?","How urgent?"])
box("V5",1,"O1",["Books a time and","tells the caller who"])
box("K1",2,"C",["What we do, who we","take on, and the","no-pricing rule"])
box("L1",3,"P",["Helps with calls","that are not clear"])
box("L2",3,"O2",["Writes a short note","for the designer"])
box("C1",4,"P",["Picks the next","designer in turn;","skips if busy"])
box("C2",4,"O1",["Call goes into the","designer's calendar"])
box("T1",5,"O2",["Sends the designer","the lead, how urgent,","and call-by time"])
box("D1",6,"O2",["Calls the customer;","updates the status"])
box("DP",7,"P",["Logs every call:","status, summary;","recordings in Vaani"])
box("DO",7,"O2",["Front desk and","designers see it"])
box("F1",8,"P",["Handles complaints;","checks declined calls"])
box("H1",9,"T",["Starts a record","with the call text"])
box("H2",9,"P",["Keeps the record","up to date; adds up","costs and sales"])
box("H3",9,"O2",["Founder's view:","sales and costs"])
L=lambda i:boxes[i][0]-BW/2
R=lambda i:boxes[i][0]+BW/2
T=lambda i:boxes[i][1]-BH/2
B=lambda i:boxes[i][1]+BH/2
X=lambda i:boxes[i][0]
Y=lambda i:boxes[i][1]
arrows=[
 [(X("A1"),B("A1")),(X("V1"),T("V1"))],
 ("both",[(X("A2"),B("A2")),(X("V2"),T("V2"))]),
 [(R("V1"),Y("V1")),(L("V2"),Y("V2"))],
 [(R("V2"),Y("V2")),(L("V3"),Y("V3"))],
 [(R("V3"),Y("V3")),(L("V4"),Y("V4"))],
 [(X("K1"),T("K1")),(X("V3"),B("V3"))],
 [(X("V4"),B("V4")),(X("L1"),T("L1"))],
 [(X("L1"),B("L1")),(X("C1"),T("C1"))],
 [(R("C1"),Y("C1")),(L("C2"),Y("C2"))],
 [(X("C2"),T("C2")),(X("V5"),B("V5"))],
 [(X("V5"),T("V5")),(X("A3"),B("A3"))],
 [(R("L1"),Y("L1")),(L("L2"),Y("L2"))],
 [(X("L2"),B("L2")),(X("T1"),T("T1"))],
 [(X("T1"),B("T1")),(X("D1"),T("D1"))],
 [(X("D1"),B("D1")),(X("DO"),T("DO"))],
 [(R("DP"),Y("DP")),(L("DO"),Y("DO"))],
 [(L("V4"),Y("V4")+12),(775,Y("V4")+12),(775,Y("DP")),(L("DP"),Y("DP"))],
 [(L("V4"),Y("V4")+22),(790,Y("V4")+22),(790,Y("F1")),(L("F1"),Y("F1"))],
 [(L("D1"),Y("D1")),(995,Y("D1")),(995,Y("H2")+14),(R("H2"),Y("H2")+14)],
 [(X("F1"),B("F1")),(X("H2"),T("H2"))],
 [(X("V1"),B("V1")),(X("H1"),T("H1"))],
 [(R("H1"),Y("H1")),(L("H2"),Y("H2"))],
 [(R("H2"),Y("H2")),(L("H3"),Y("H3"))],
]
o=[f'<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 {W} {H}" width="{W}" height="{H}" font-family="Helvetica, Arial, sans-serif"><rect width="{W}" height="{H}" fill="#fff"/>',
'<defs><marker id="a" viewBox="0 0 10 10" refX="9" refY="5" markerWidth="6" markerHeight="6" orient="auto-start-reverse"><path d="M0 1L10 5L0 9z" fill="#222"/></marker></defs>']
heads=[("TRIGGER",230),("INPUT",440),("CONTEXT",660),("PROCESSING",890),("OUTPUT",1210)]
bounds=[330,550,770,1010]
o.append('<line x1="130" y1="30" x2="1410" y2="30" stroke="#444" stroke-width="0.8" stroke-dasharray="2 3"/>')
for t,x in heads:
    w=len(t)*8+16
    o.append(f'<rect x="{x-w/2}" y="20" width="{w}" height="20" fill="#fff"/><text x="{x}" y="30" font-size="12" font-weight="bold" fill="#111" text-anchor="middle" dominant-baseline="central">{t}</text>')
yb=lane_top+LH*len(lanes)
for b in bounds:
    o.append(f'<circle cx="{b}" cy="30" r="2.5" fill="#4a7c6f"/><line x1="{b}" y1="30" x2="{b}" y2="{yb}" stroke="#bbb" stroke-width="0.8"/>')
o.append(f'<line x1="130" y1="{lane_top}" x2="130" y2="{yb}" stroke="#222"/><line x1="1410" y1="{lane_top}" x2="1410" y2="{yb}" stroke="#222"/><line x1="20" y1="{lane_top}" x2="20" y2="{yb}" stroke="#222"/><line x1="20" y1="{yb}" x2="1410" y2="{yb}" stroke="#222"/>')
for i,(names,sub) in enumerate(lanes):
    y=lane_top+i*LH;c=y+LH/2
    o.append(f'<line x1="20" y1="{y}" x2="1410" y2="{y}" stroke="#222" stroke-width="1"/>')
    rows=[(n,True) for n in names]+([(sub,False)] if sub else [])
    for k,(t,bold) in enumerate(rows):
        ty=c+(k-(len(rows)-1)/2)*15
        o.append(f'<text x="75" y="{ty}" font-size="{11.5 if bold else 10.5}" font-weight="{"bold" if bold else "normal"}" fill="{"#111" if bold else "#333"}" text-anchor="middle" dominant-baseline="central">{t}</text>')
for a in arrows:
    both=False
    if a[0]=="both": both=True;a=a[1]
    pts=' '.join(f'{x},{y}' for x,y in a)
    ms=' marker-start="url(#a)"' if both else ''
    o.append(f'<polyline points="{pts}" fill="none" stroke="#222" stroke-width="1" stroke-dasharray="2 3"{ms} marker-end="url(#a)"/>')
for id,(x,y,lines) in boxes.items():
    fill="#FBEFEA" if id=="F1" else "#fff"
    o.append(f'<rect x="{x-BW/2}" y="{y-BH/2}" width="{BW}" height="{BH}" fill="{fill}" stroke="#222"/>')
    n=len(lines)
    for k,t in enumerate(lines):
        o.append(f'<text x="{x}" y="{y+(k-(n-1)/2)*13.5}" font-size="11.5" fill="#111" text-anchor="middle" dominant-baseline="central">{t}</text>')
o.append(f'<text x="20" y="{yb+24}" font-size="11.5" fill="#333">Four outputs: Telegram message and calendar booking (to the designer), the dashboard (front desk and designers), HubSpot (founder).</text>')
o.append('</svg>')
out=sys.argv[1] if len(sys.argv)>1 else 'Components_Map_Aangan.svg'
open(out,'w').write('\n'.join(o))
print(out,W,H)
