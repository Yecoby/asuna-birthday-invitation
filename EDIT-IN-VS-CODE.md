# Iria Asuna · Fairy Garden Invitation

Edit this invitation in VS Code. You do **not** need to touch the animation code.

## 1. Event details (names, date, venue, copy)

Open:

```
src/lib/event.ts
```

Change any field and save. The invitation updates immediately.

Typical edits:

| Want to change | Field |
| --- | --- |
| Child’s name | `childFullName`, `childFirstName`, `childNickname` |
| Wax-seal letter | `sealLetter` |
| Date & time | `dateISO`, `dateLabel`, `dayLabel`, `timeLabel` |
| Venue | `venueName`, `venueCity`, `mapsLink`, `mapsEmbed` |
| Sentences | `heroIntro`, `detailsLead`, `giftBody`, `closingLead`, … |

`dateISO` must be a real timestamp so the countdown works, e.g.

```
2026-10-17T15:00:00+08:00
```

## 2. Photos

Replace files in `public/invitation/` **keeping the same filename**, or update the paths in `event.ts`.

Hero, venue, closing, dress looks, and gallery images are all listed in that config.

Tip: use your own portraits of Iria for the gallery and celebrant scene. The included artwork is original garden illustration so the template is ready to send before photos are added.

## 3. RSVPs

Guest replies save in the visitor’s browser. Open **Host desk** from the invitation footer (`/host`) to read them, download JSON, or clear the inbox.

## 4. Music

Garden music is generated in the browser (no mp3). It starts when a guest opens the envelope, and can be muted with the round button.

## 5. Share

Send guests the live invitation link. They tap the envelope to open it.
