/* sample-reviews.js — demo reviews for the class project's store, by bundle name.
   The server only takes reviews from customers who rented and returned a bundle, so these sample
   reviews are shown alongside the real ones to make the demo store look lived in.
   To remove them, delete this file and its <script> tag in index.html. */

const SAMPLE_REVIEWS = (() => {
  const r = (userName, rating, dateEntered, content) => ({ userName, rating, dateEntered, content, sample: true });
  return {
    "Weekend Camping for Two": [
      r("maya_r", 5, "2026-09-14", "Everything fit in our hatchback and the tent went up in ten minutes. The two-burner stove made breakfast easy."),
      r("jordan.k", 4, "2026-10-03", "Sleeping bags were warm enough for a 38°F night. The lantern ran low on day two, so bring a charger."),
      r("the_okafors", 5, "2026-08-22", "Perfect first camping trip for us. Staff showed us how to pitch the tent before we left.")
    ],
    "Day Hike Starter": [
      r("priya.hikes", 5, "2026-07-19", "The trekking poles saved my knees on the way down. Great value for a day out."),
      r("ben_t", 4, "2026-09-28", "Daypack is comfy and the water filter worked great at the creek. The headlamp was a nice extra.")
    ],
    "Backpacking Overnight": [
      r("sam_wanders", 5, "2026-08-09", "The ultralight tent and 65 L pack made my first overnighter so much easier than I expected."),
      r("lena.m", 4, "2026-09-06", "Solid kit. The canister stove boiled water fast; the pack's hip belt took a bit of adjusting."),
      r("chris_p", 3, "2026-10-18", "Gear was in good shape but my sleeping pad had a slow leak. They swapped it without fuss when I got back.")
    ],
    "Kayak Day Trip": [
      r("danielle_w", 5, "2026-07-04", "Stable, tracks straight, and the dry bag kept my phone dry. Already planning another lake day."),
      r("marcus.l", 4, "2026-08-16", "Great kayak. Bring a roof rack or ask for the foam blocks, it's 12 feet long!")
    ],
    "Ski Day": [
      r("hannah.ski", 5, "2026-02-08", "The boots were actually comfortable, which never happens with rentals. Skis were freshly tuned."),
      r("tomasz_k", 4, "2026-03-01", "Cheaper than the resort rental shop and no line in the morning."),
      r("avery_j", 5, "2026-01-24", "Helmet and poles included. Picked everything up the night before and was first on the lift.")
    ],
    "Bouldering Starter": [
      r("nina.climbs", 5, "2026-06-27", "The crash pad is thick and folds up nicely for the walk in. Shoes fit true to size."),
      r("jake_b", 4, "2026-09-12", "Great intro kit. The chalk bag was only half full, so I topped it up myself.")
    ],
    "Snowboard Day": [
      r("kai.rides", 5, "2026-02-15", "Board was waxed and the bindings were already set up for my stance when I picked it up."),
      r("olivia_s", 4, "2026-03-08", "Goggles fogged a little on a warm afternoon, otherwise great. The boots were comfy.")
    ],
    "Paddleboard Day": [
      r("grace_t", 5, "2026-07-26", "Inflates in about ten minutes with the pump. Super stable, even for a first-timer."),
      r("dev.patel", 4, "2026-08-30", "Fun afternoon on the lake. The leash and life jacket made me feel safe."),
      r("emma_l", 5, "2026-09-07", "Took my teenager out on it and we both stood up on the first try.")
    ],
    "Family Car Camping": [
      r("the_nguyens", 5, "2026-08-02", "Everything for a family of four in one pickup. You can stand up inside the cabin tent!"),
      r("rachel.b", 5, "2026-07-12", "The chairs and cooler made it feel like a real campsite. The kids loved the lanterns."),
      r("mike_d", 4, "2026-09-20", "Great setup. Not cheap for a long weekend, but far cheaper than buying it all.")
    ],
    "Snowshoe Trek": [
      r("liz_outdoors", 5, "2026-02-01", "Snowshoes were easy to strap on and the crampons gripped well on icy patches."),
      r("aaron.h", 4, "2026-01-18", "The gaiters kept the snow out of my boots. A great way to try snowshoeing.")
    ],
    "Mountain Bike Day": [
      r("tyler_mtb", 5, "2026-06-20", "The full-suspension bike was dialed in. Tires and brakes felt brand new."),
      r("sofia.r", 4, "2026-08-23", "Fun day on the trails. The hydration pack fit a snack and a light jacket too.")
    ],
    "Sport Climbing Kit": [
      r("leo.climbs", 5, "2026-07-11", "Rope looked new and every quickdraw was in great shape. Everything you need for a day at the crag."),
      r("maria_g", 4, "2026-09-27", "The harness was comfortable. Would love a local guidebook added to the kit.")
    ],
    "Canoe Weekend": [
      r("the_harpers", 5, "2026-08-15", "Two paddles, two life jackets and a dry bag. We paddled across the lake and camped on the far side."),
      r("ian.w", 4, "2026-07-30", "The canoe is heavy to carry alone but very steady on the water.")
    ],
    "Lake Fishing Day": [
      r("grandpa_joe", 5, "2026-06-14", "Took my grandkids out. Two rods, a tackle box, and we caught three bluegill!"),
      r("hector.f", 4, "2026-08-08", "Good starter setup. Bring your own bait; the tackle box only has lures.")
    ],
    "Beach Day": [
      r("alyssa.m", 5, "2026-07-05", "The wagon made hauling the cooler and chairs across the sand painless."),
      r("ryan_c", 4, "2026-08-17", "The umbrella held up in a decent breeze thanks to the sand anchor.")
    ],
    "Cross-Country Ski Day": [
      r("nora.xc", 5, "2026-01-31", "Waxless skis were perfect for the groomed trails, and the boots were warm."),
      r("pete.s", 4, "2026-02-21", "Easy to learn on. The poles were a touch long for me but still fine.")
    ],
    "Winter Camping for Two": [
      r("jess_and_tom", 5, "2026-02-07", "Stayed warm at 5°F in the down bags. The 4-season tent shrugged off the wind."),
      r("wes.k", 4, "2026-01-10", "Serious gear for a serious trip. Bring extra fuel canisters for melting snow.")
    ],
    "Hammock Camping": [
      r("zoe.hangs", 5, "2026-08-12", "Best night's sleep I've had outdoors. The underquilt makes a huge difference."),
      r("matt_r", 4, "2026-09-19", "Took a couple of tries to hang it right, but the straps are tree-friendly and easy once you get it.")
    ],
    "Stargazing Night": [
      r("astro_amy", 5, "2026-08-11", "Saw Saturn's rings through the telescope! The phone mount let us take photos too."),
      r("the_parks", 5, "2026-09-25", "Blankets and chairs made it a cozy night with the kids. Great idea for a bundle."),
      r("daniel.o", 4, "2026-10-09", "The telescope takes a little practice to aim, but the store gave us a quick tutorial.")
    ],
    "Mountaineering Intro": [
      r("alpine_kate", 5, "2026-07-18", "Crampons fit my boots perfectly and the ice axe was the right length for me."),
      r("raj.m", 4, "2026-08-27", "The boots are stiff, as they should be. Do a short hike first to get used to them.")
    ],
    "Bird Watching Walk": [
      r("birder_beth", 5, "2026-09-03", "The 8x42 binoculars are bright and sharp. Spotted a pileated woodpecker!"),
      r("walt.g", 4, "2026-10-11", "The field guide is handy and fits in the daypack pocket. A great slow morning.")
    ],
    "Gravel Bike Tour": [
      r("sarah.rides", 5, "2026-09-13", "Did a two-day loop with the bikepacking bags. The bike was smooth on gravel and pavement."),
      r("noah_b", 4, "2026-10-05", "Comfortable bike. The frame bag is a bit snug for a big water bottle.")
    ],
    "Surf Starter": [
      r("luna.surfs", 5, "2026-07-21", "The soft-top is forgiving and the wetsuit was warm in chilly water. Stood up on my third wave."),
      r("carlos_m", 4, "2026-08-24", "Great beginner board. The leash's velcro is a bit worn but held fine.")
    ]
  };
})();
