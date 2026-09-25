/**
 * ─────────────────────────────────────────────────────────────
 *  IRIA ASUNA · FIRST BIRTHDAY  ·  EDIT THIS FILE
 * ─────────────────────────────────────────────────────────────
 * Every guest-facing name, date, place, sentence, and image
 * lives here. Change a value, save, and the invitation updates.
 *
 * Images live in  /public/invitation/
 * Replace any file with the same name to swap artwork.
 * ─────────────────────────────────────────────────────────────
 */

export type GalleryItem = {
  src: string;
  full: string;
  alt: string;
};

export const event = {
  childFullName: "Iria Asuna D. Maramara",
  childFirstName: "Iria",
  childNickname: "Iria",
  sealLetter: "I",
  ageWord: "One",
  headline: "Turns One",
  themeName: "Butterfly Theme",
  pageTitle: "Iria Asuna D. Maramara Turns One",
  pageDescription:
    "You are invited to Iria Asuna’s first birthday — a fairy garden afternoon of tiny wonders, lanterns, and love.",

  /*
   * Event start. NOTE: `dateISO` drives the countdown timer, while `timeLabel` is
   * what guests actually read on the invitation — they were previously
   * inconsistent (15:00 vs "5:00 PM"), so the countdown was ticking to a time two
   * hours earlier than the one shown. `dateISO` now matches the displayed time;
   * keep the two in step if either is ever changed.
   *
   * CONFIRM THIS with the host — it is the one value derived from conflicting
   * sources rather than copied directly.
   */
  dateISO: "2026-11-03T17:00:00+08:00",
  dateLabel: "November 03, 2026",
  dayLabel: "Tuesday",
  timeLabel: "5:00 PM",

  venueName: "Bayfront Hotel",
  venueArea: "North Reclamation Area",
  venueHall: "Bantayan Hall",
  venueCity: "Cebu City",
  mapsLink: "https://www.google.com/maps/place/Bayfront+Hotel+Cebu+North+Reclamation/@10.3118471,123.9186312,17z/data=!3m1!4b1!4m9!3m8!1s0x33a99972f04ee017:0x239e29fd87e52e92!5m2!4m1!1i2!8m2!3d10.3118418!4d123.9212061!16s%2Fg%2F1pp2wygm7?entry=ttu&g_ep=EgoyMDI2MDkyMC4wIKXMDSoASAFQAw%3D%3D",

  mapsEmbed: "https://www.google.com/maps/embed/v1/place?key=YOUR_API_KEY&q=Bayfront+Hotel+Cebu+North+Reclamation,Cebu+City,Philippines",

  envelopeEyebrow: "You’re Invited",
  openingAssist: "A magical invitation is waiting.",
  tapHint: "Tap to Open",

  typingLine: "You’re invited to a fairy garden",
  heroIntro:
    "Flutter into a garden of tiny wonders, lantern light, and a whole first year of joy.",
  enterLabel: "Enter the Fairy Garden",

  detailsEyebrow: "The Garden Gates Open",
  detailsTitle: "Iria’s First Fairy Garden",
  detailsLead:
    "Follow the lanterns, listen for tiny wings, and spend a joyful afternoon in bloom.",

  whenLabel: "When",
  whereLabel: "Where",
  celebrationLabel: "The Celebration",
  celebrationLine: "Butterfly Theme",

  countdownEyebrow: "Until the Fairy Bells Ring",
  countdownTitle: "A Little Magic Is Growing",

  celebrantEyebrow: "Our Brightest Little Bloom",
  celebrantTitle: "One year of Iria",
  celebrantLead:
    "She arrived like morning light — soft, curious, and already full of wonder.",

  huntEyebrow: "A Tiny Garden Game",
  huntTitle: "Find Five Glowing Butterflies",
  huntLead: "Tap each hidden butterfly to collect its sparkle.",
  huntBadgeTitle: "You unlocked Iria’s Fairy Blessing",
  huntBadgeSub: "Keeper of Tiny Wonders",

  galleryEyebrow: "A Garden of Memories",
  galleryTitle: "Sweet Moments in Bloom",

  giftEyebrow: "A Note from the Garden",
  giftTitle: "A Little Gift Guide for Our Birthday Girl",
  giftBody:
    "Your presence is already the sweetest gift we could ask for as we celebrate our little butterfly turning ONE! 💕",
  giftIntro: "But if you'd like to bring something for her, here are a few ideas:",
  giftIdeas: [
    { emoji: "🧸", label: "Toys", note: "age-appropriate toys, books, blocks, or anything fun" },
    { emoji: "💰", label: "Money for Her Future", note: "a little something for her future dreams" },
    { emoji: "👗", label: "Dresses and shoes", note: "cute and comfy outfits" },
    { emoji: "🍼", label: "Millie Moon Diapers", note: "Medium" },
    { emoji: "🧺", label: "Tiny Buds", note: "baby laundry essentials" },
    { emoji: "🧻", label: "Wet Tissues/Wipes", note: "" },
  ],
  giftOutro:
    "And of course, feel free to choose anything you think she'll love! 🎀",
  giftClosing:
    "Most importantly, your presence, love, and sharing this special day with us are more than enough. 🥰🦋",

  venueEyebrow: "Follow the Garden Path",
  mapsButton: "Open in Map",

  dressEyebrow: "Garden Attire",
  dressTitle: "CASUAL / SEMI-FORMAL",
  dressLead: "Little outfits for a big celebration!",
  dressLooks: [
    { key: "girls", label: "Girls", note: "Pastel party dresses", image: "/invitation/dress-girl.jpg" },
    { key: "boys", label: "Boys", note: "Polo or button-down outfits", image: "/invitation/dress-boy.jpg" },
    { key: "women", label: "Women", note: "Garden-party dresses", image: "/invitation/dress-woman.jpg" },
    { key: "men", label: "Men", note: "Light smart-casual attire", image: "/invitation/dress-man.jpg" },
  ],

  /* Colour palette — exact hex values supplied by the host. */
  paletteEyebrow: "Our Palette",
  paletteTitle: "Butterfly Theme Colours",
  palette: [
    { name: "Blush Pink", hex: "#F7B6D2" },
    { name: "Baby Pink", hex: "#FAD7E8" },
    { name: "Lavender", hex: "#C8B6E8" },
    { name: "Lilac", hex: "#B69BCF" },
    { name: "Pearl White", hex: "#FFF9F5" },
    { name: "Dusty Rose", hex: "#D99AB8" },
    { name: "Sage Green", hex: "#B8C9B0" },
    { name: "Champagne Gold", hex: "#D8C19A" },
  ],

  /* Guest reminders — verbatim from the host. */
  remindersEyebrow: "With Love",
  remindersTitle: "Gentle Reminders",
  remindersLead: "A Few Gentle Reminders for Our Guests",
  reminders: [
    "🧴 Please sanitize your hands before interacting with or holding the birthday girl.",
    "🤧 Please avoid kissing the baby, especially on her face and hands.",
    "🦠 If you're feeling unwell, have a fever, cough, colds, or other contagious symptoms, please rest at home and celebrate with us from afar. 💕",
    "👶 Please be gentle when holding or playing with her. Always ask Mommy or Daddy first.",
    "🧸 Please keep small objects and choking hazards away from the baby.",
    "📸 Photos are welcome! Please be mindful of her comfort and let her enjoy her special day.",
    "🎀 Please let the birthday girl enjoy her cake and presents at her own pace. 😊",
    "💕 Most importantly, come ready to celebrate, laugh, and make beautiful memories with us!",
  ],

  /* Program flow — the host supplied the time range and the ordered list. */
  programEyebrow: "The Celebration",
  programTitle: "Program Flow",
  programTime: "5:00 PM – 9:00 PM",
  program: [
    "Guest Arrival & Free Play",
    "Opening Prayer",
    "Grand Entrance",
    "Welcome Message",
    "Fun & Games",
    "Birthday Wishes",
    "🎂 Cake Blowing & Pictorial",
    "Dinner",
    "🪄 Magic Show",
    "🫧 Bubble Show",
    "🪅 Piñata & Pabitin",
    "Wrap-Up Games",
    "Thank You & Closing",
  ],

  rsvpEyebrow: "Kindly Reply",
  rsvpTitle: "Will You Join Our Fairy Circle?",
  rsvpLead: "Please send your reply so the garden can prepare a place for you.",
  rsvpMessageLabel: "Message for Iria",
  rsvpSuccessTitle: "Thank you!",
  rsvpSuccessBody:
    "Your RSVP has fluttered safely into Iria’s fairy garden. We cannot wait to celebrate with you.",

  closingEyebrow: "With Love from Our Garden",
  closingTitle: "Thank You for Joining the Magic",
  closingLead:
    "Thank you for walking Iria through her first year of wonder. We cannot wait to make new memories with you.",

  images: {
    hero: "/invitation/hero.jpg",
    heroMobile: "/invitation/hero-mobile.jpg",
    venue: "/invitation/venue.jpg",
    closing: "/invitation/closing.jpg",
    wand: "/invitation/wand.png",
    swing: "/invitation/swing.jpg",
    portrait: "/invitation/gallery-swing.jpg",
  },

  gallery: [
    { src: "/invitation/gallery-swing.jpg", full: "/invitation/swing.jpg", alt: "Flower-draped garden swing" },
    { src: "/invitation/gallery-wisteria.jpg", full: "/invitation/hero-mobile.jpg", alt: "Wisteria garden path" },
    { src: "/invitation/gallery-arch.jpg", full: "/invitation/hero.jpg", alt: "Enchanted garden arch" },
  ] satisfies GalleryItem[],

  meadow: [
    { src: "/invitation/gallery-path.jpg", full: "/invitation/hero.jpg", alt: "Garden path in bloom" },
    { src: "/invitation/gallery-pond.jpg", full: "/invitation/venue.jpg", alt: "Grotto pond and lanterns" },
    { src: "/invitation/gallery-swing.jpg", full: "/invitation/swing.jpg", alt: "Wisteria swing" },
    { src: "/invitation/gallery-wisteria.jpg", full: "/invitation/hero-mobile.jpg", alt: "Lilac blossoms" },
    { src: "/invitation/gallery-lanterns.jpg", full: "/invitation/closing.jpg", alt: "Night lantern garden" },
    { src: "/invitation/gallery-arch.jpg", full: "/invitation/hero.jpg", alt: "Fairy garden arch" },
  ] satisfies GalleryItem[],
} as const;

export type EventConfig = typeof event;
