# TransitMate: demo voiceover (2:10)

Timed to `docs/transitmate-demo.mp4`. It runs about 330 words at a relaxed pace. Lines in *italics* are optional if you're running long.

| Time | On screen | Voiceover |
|---|---|---|
| 0:00 | Home, "Leave as usual" | This is TransitMate, built for Rachel. She commutes Tampines to Raffles Place on the East-West Line every day, and she never opens a transit app on a normal day. So TransitMate's job is to stay quiet, and speak up only when today is different. |
| 0:06 | Crowd forecast strip | Right now it's all clear. Everything you see is live LTA data: her route, her arrival window, and LTA's thirty-minute crowd forecast for her platform. |
| 0:12 | Tap "Simulate EWL fault" | LTA's disruption feed is empty on a normal day, so we replay a real-format track fault, clearly labelled as a replay. |
| 0:20 | Verdict turns red | The moment it hits her line, the verdict flips. Not "EWL delays", but one instruction: take the Downtown Line today. And one reason: no service between Tanah Merah and Paya Lebar. |
| 0:25 | Staying vs switching | It even does the maths she'd do on the platform: staying costs sixty to ninety minutes, switching saves about twenty-six. |
| 0:31 | Route changed, map | Tap through and the map shows exactly what changed: her usual route dashed, the broken section in red, the new route solid. |
| 0:39 | Stay or switch? | Every option is a time range, not a fake-precise number, because trains and buses don't run to the second. |
| 0:45 | Steps | Walking legs are routed on OpenStreetMap footpaths, and bus legs use live LTA arrival times and bus load. *Fare and CO₂ are there too.* |
| 0:51 | Trip mode | When she commits, trip mode takes over: one step at a time, big text, one thumb. It keeps working underground with no signal. |
| 1:02 | Network map | The map is the whole rail network. Every station is coloured by LTA's live crowd level, and the disruption shows in red. |
| 1:09 | Station sheet | Tap a station for live crowding, the next three hours of forecast, and lift status. |
| 1:15 | Report "Platform packed" | And commuters can report what they see. Official alerts often lag the platform by minutes; this closes that gap. |
| 1:23 | Alerts | On Alerts: every line at a glance, and LTA's own mitigation read straight from the feed: free public buses and bridging buses. |
| 1:32 | Commuter report | That report I just made is already here, for everyone, in real time, through Firebase Firestore. |
| 1:38 | Planned works | Planned works come from LTA's live feed too, with dates. On the day, the planner routes around them automatically. |
| 1:44 | Switch to Mdm Lim | Same engine, different person. |
| 1:52 | Mdm Lim's verdict | Mdm Lim walks slowly and avoids transfers, so the same fault gives her a different answer: bus 155 to the Thomson line. *Large text is on for her by default.* |
| 2:03 | Closing card | TransitMate: LTA DataMall, OpenStreetMap, NEA weather and Firestore, designed with PaperDesign. It tells you before you leave, and it tells you what to do. |

## 20-second pitch (for slides)

Most transit apps tell everyone the same thing after it has already gone wrong. TransitMate knows your commute, stays silent until a disruption actually costs you time, then gives one action with the reason and the trade-off. It uses live LTA data, routes on OpenStreetMap, and adds commuters as sensors through Firestore.
