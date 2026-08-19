/**
 * Blog posts "database."
 * Add new posts here. content is HTML.
 * Images live in /public/blog/ (self-hosted).
 *
 * @typedef {Object} BlogPost
 * @property {string} id - URL slug, e.g. "decorators-vs-digital-locksmiths"
 * @property {string} title
 * @property {string} date - ISO date YYYY-MM-DD
 * @property {string} excerpt - 1–2 sentences for the card
 * @property {string} category - short label, e.g. "Conversion"
 * @property {string} [imageUrl] - optional card thumbnail (falls back to text-only layout)
 * @property {string} content - HTML body (p, h2, h3, ul, img, strong, a, etc.)
 */

/** @type {BlogPost[]} */
export const posts = [
  {
    id: "starter-tier-outperforms-agencies",
    title: "The $299 Website That's Outperforming $10,000 Agency Sites",
    date: "2026-07-20",
    excerpt:
      "Discover why high-priced agency websites often fail to convert and how a $299 performance-focused site can drive more revenue for solo-pros and artisans.",
    category: "Growth",
    imageUrl: "/blog/starter-tier-1.webp",
    content: `
      <img src="/blog/starter-tier-1.webp" alt="Alexander Schottky balancing a massive $10,000 invoice against a glowing $299 revenue engine" />
      <p>Most business owners are being robbed in broad daylight.</p>
      <p>They write a check for $10,000, $20,000, or even $50,000 to a "high-end" creative agency. They wait six months for a "discovery phase" and a "branding workshop."</p>
      <p>Then, they get a website that looks like a masterpiece but converts like a screen door on a submarine. It’s pretty. It’s artistic. And it’s completely useless for growing a business.</p>
      <p>I’ve spent 15 years in the trenches of UX design, and I’m here to tell you the truth: you don’t need a digital brochure. You need a revenue engine. And surprisingly, you can get one for exactly $299.</p>

      <h2>The Big Agency Scam: Paying for "Pretty"</h2>
      <p>The agency model is broken. They charge you for their high-rise office, their fancy espresso machine, and their "creative director" who hasn't looked at a conversion heat map in a decade.</p>
      <p>They focus on aesthetics because aesthetics are easy to sell. But aesthetics don’t pay the bills. I see sites every day that cost five figures but have no clear call to action, confusing navigation, and load times that make dial-up look fast.</p>
      <p>These agencies build websites "from the inside out": describing your company as you see yourself, rather than how your customers see you. They give you a "brand showpiece" when you actually need a lead generation system.</p>
      <img src="/blog/starter-tier-2.webp" alt="Alexander Schottky inspecting a website made of fragile balloons" />

      <h2>Where Your Revenue Is Actually Leaking</h2>
      <p>When I perform a <strong>Free Expert Review</strong>, I find the same three leaks over and over.</p>
      <ul>
        <li><strong>The "What Do You Actually Do?" Problem:</strong> Most $10k sites use vague, flowery jargon. If a visitor can't tell what you do and who you help in 3 seconds, they’re gone.</li>
        <li><strong>The Invisible Call to Action:</strong> Agencies love to hide "Contact Us" buttons. If you want someone to call you, you have to tell them clearly and repeatedly.</li>
        <li><strong>The Speed Trap:</strong> High-end sites are often bloated with heavy scripts. Every second your site takes to load, you're lighting money on fire.</li>
      </ul>

      <h2>Introducing "The Starter": The $299 Revenue Engine</h2>
      <p>At ToolCrate, we decided to do things differently. We created <strong>The Starter</strong> tier for solo entrepreneurs and artisans who need performance without the agency fluff.</p>
      <p>For a $299 setup and $29/mo, you get a 3-page site designed specifically to convert visitors into leads. This isn't a "budget" site. It's a high-performance site that has been stripped of everything that doesn't make you money.</p>
      <p>It’s built on my 15+ years of real-world conversion experience. Every layout is hand-vetted by me. We don't do "discovery calls." We do work that works.</p>
      <img src="/blog/starter-tier-3.webp" alt="Alexander high-fiving a solo professional beside a high-performance website" />

      <h2>Expert-Led Strategy vs. Generic Templates</h2>
      <p>The difference at ToolCrate is the <strong>Human Element.</strong> We aren't a bot-factory. When we build a site—even at the $299 level—it follows an expert-led methodology. We look for the specific locks on your revenue and we fix them.</p>
      <p>We use high-EQ conversion strategy to guide your visitors through a journey: Problem → Trust → Offer → Action. Most agencies build for design awards. I build for your bank account.</p>

      <h2>Stop Guessing. Start Converting.</h2>
      <p>You don't need a $10,000 band-aid. You need a conversion-focused architecture that treats every visitor as a potential customer.</p>
      <p>I've solved these conversion problems many times over. I know what works, and more importantly, I know what’s just expensive noise.</p>
      <p>I offer a <strong>Free Expert Preview</strong>: a functional redesign of a key section of your site, created by me. I’ll show you the immediate conversion leaks and the missed revenue opportunities. No cost. No commitment. Just expert analysis.</p>
      <p><strong><a href="/try/">Get your Free Expert Review here and stop the leaks today.</a></strong></p>
    `,
  },
  {
    id: "expensive-free-website-myth",
    title: 'Why Your "Free" Website is Actually Your Most Expensive Expense.',
    date: "2026-07-16",
    excerpt:
      "Discover why $0 website builders are actually a 'stupidity tax' on your business, costing you thousands in lost revenue and mobile friction.",
    category: "Growth",
    imageUrl: "/blog/expensive-free-1.webp",
    content: `
      <img src="/blog/expensive-free-1.webp" alt="Alexander Schottky looking horrified as a Free Website machine spits out dollar bills into a trash can" />
      <p><strong>You aren't saving money. You’re paying a "stupidity tax" you didn't sign up for.</strong></p>
      <p>"Free" is the most expensive word in the English language.</p>
      <p>In the world of business, it’s a siren song that leads straight into a graveyard of abandoned carts and "contact us" forms that never chime.</p>
      <p>I’m Alexander Schottky. I’ve spent over 15 years auditing sites that should be printing money, but instead, they’re just burning it.</p>
      <p>I see it every single day: a growth-minded owner tries to "save" a few thousand dollars by using a drag-and-drop builder or a generic AI generator. They get a site that looks... fine. Maybe even "pretty."</p>
      <p>And then they wonder why their calendar is empty while they’re spending $5k a month on Google Ads.</p>
      <p><strong>Here is the blunt truth: If your website was free (or $20/month), you aren't the customer. You're the casualty.</strong></p>

      <h2>The Hidden Tax: Why Your $0 Site is Leaking Thousands</h2>
      <img src="/blog/expensive-free-2.webp" alt="Alexander Schottky frantically bailing water out of a cardboard boat in a sea of gold coins" />
      <p>Think of your website as a boat. You’re trying to sail across a sea of gold coins (your market) to reach the island of Revenue.</p>
      <p>A "free" website builder gives you a boat made of wet cardboard. It looks like a boat. It floats for about five minutes. But the moment you actually put weight on it—the moment you send real traffic to it—it starts to sink.</p>
      <p>You spend your whole day bailing out water (troubleshooting glitches) instead of steering toward the goal.</p>

      <h3>1. The Speed Trap (The 4-Second Death Sentence)</h3>
      <p>In 2026, the data is unforgiving. If your site takes longer than three seconds to load, 53% of mobile users are gone. They didn’t even see your headline.</p>
      <p>A pro site converts at ~3%. A slow, free-builder site often converts below 1%. If you have 1,000 visitors a month, that "free" site just cost you 20 customers. If your average lead is worth $500, that’s $10,000 in lost revenue <em>this month</em>.</p>

      <h3>2. The Mobile Friction Gap</h3>
      <p>I’ve pulled apart plenty of these "AI-powered" builders. They promise a "mobile-responsive" design. What they actually give you is a desktop site that’s been shoved through a meat grinder to fit a phone screen.</p>
      <p>If your mobile site feels like a chore to navigate—tiny buttons, microscopic text, overlapping images—you are effectively telling 70% of your potential revenue to go buy from your competitor.</p>

      <h2>The Blindfold Effect: Looking Through "Free" Glasses</h2>
      <img src="/blog/expensive-free-3.webp" alt="Alexander Schottky wearing glasses that are actually black blindfolds while looking at a computer error" />
      <p>Building a website without a conversion expert is like driving a car while wearing blindfolds. Free builders give you templates designed by "artists" who care about aesthetics, not psychology.</p>
      <p>An AI generator can't look at your business and say, "Hey, your headline is confusing, and your CTA is buried." It just spits out generic copy like "We provide high-quality solutions for your needs." <strong>Nobody buys "solutions." They buy a fix for a problem they have right now.</strong></p>

      <h2>The Expert Difference: Why Human-Led Vetting Wins</h2>
      <p>At <a href="https://usetoolcrate.com">ToolCrate</a>, we don't believe in "pretty" brochures. We believe in performance. Every site we build is hand-vetted by me using 15+ years of UX experience.</p>
      <ul>
        <li><strong>Zero Fluff:</strong> No 3-month discovery phases. We find the leaks and fix them.</li>
        <li><strong>Elite Speed:</strong> Our sites are built for performance from the code up.</li>
        <li><strong>No Technical Headaches:</strong> You handle the leads. We handle the complexity.</li>
      </ul>

      <h2>Stop Flushing Your Marketing Budget</h2>
      <p>If you are spending money on ads to drive traffic to a "free" or cheap website, you are effectively burning cash. You are paying for the privilege of losing customers.</p>
      <p><strong>I’ve cracked open a lot of small business sites. The money hides in the same few places every time.</strong></p>
      <p>I offer a <strong>Free Expert Preview</strong>. Give me your URL, and I will personally create a functional redesign preview of your existing website. I’ll show you the conversion leaks, the missed revenue opportunities, and exactly how we would fix the locks on your revenue vault.</p>
      <p>No cost. No commitment. Just expert-led analysis that shows you what’s really happening with your traffic.</p>
      <p><strong><a href="/try/">Click here to get your Free Expert Preview and stop the leaks today.</a></strong></p>
    `,
  },
  {
    id: "website-revenue-leaks-audit",
    title:
      "Why Small Business Websites Leak Revenue — The Same Three Failures, Over and Over",
    date: "2026-07-14",
    excerpt:
      "Most small business sites fail the same three tests. Here are the leaks costing you calls — and how to fix them.",
    category: "UX",
    imageUrl: "/blog/website-revenue-leaks-1.webp",
    content: `
      <img src="/blog/website-revenue-leaks-1.webp" alt="Alexander Schottky looking through a giant magnifying glass at a tiny pixelated website" />
      <p>You are flushing money down the toilet.</p>
      <p>Every month, you write checks for Google Ads, Facebook campaigns, and SEO "experts." You work tirelessly to get people to your site, and for a fleeting second, you have their attention.</p>
      <p>Then, they see your website. And they leave.</p>
      <p>In the last 12 months, I have personally audited over 200 small business websites. I’ve looked under the hood of local service providers, e-commerce giants, and high-ticket consultants.</p>
      <p>The reality is grim: nearly all of them fail the exact same tests.</p>
      <p>They weren't "bad" looking. Most were actually quite "pretty." But a pretty website that doesn’t convert is just an expensive digital business card.</p>
      <p>I’m Alexander Schottky. I’ve spent 15 years in the trenches of UX and conversion design. I’m not here to talk about "vibes" or color palettes.</p>
      <p>I’m here to tell you why your website is leaking revenue and how to plug the holes.</p>

      <h2>Design Opinion vs. Conversion Fact</h2>
      <img src="/blog/website-revenue-leaks-2.webp" alt="Alexander Schottky chasing a sentient gold coin with a butterfly net" />
      <p>Most web designers are decorators. They want to show you "delightful" animations and trendy gradients. I don't care about "delight." I care about the "Buy Now" button.</p>
      <p>When I review a site, I’m not giving you my aesthetic opinion. I’m applying 15 years of watching real users click, hesitate, and abandon carts.</p>
      <p>The data for 2026 is clear: the average conversion rate for a small business website is hovering around 2.35%. That means for every 100 people you pay to send to your site, 97 of them are leaving without doing a single thing.</p>

      <h2>Test 1: The 3-Second Clarity Rule</h2>
      <p>You have exactly three seconds. That is the total window of time a visitor gives you before their brain decides if you can solve their problem or if they should hit the "back" button.</p>
      <p>If your site takes longer than three seconds to load, 53% of mobile users are already gone. They didn't even see your logo.</p>
      <p>In three seconds, a visitor must be able to answer: What do you actually do? Who do you do it for? and What is the one thing I should do next? Clarity beats cleverness every single time.</p>

      <h2>Test 2: The Mobile Performance Gap</h2>
      <img src="/blog/website-revenue-leaks-3.webp" alt="Alexander Schottky trying to hammer a massive desktop computer into a tiny smartphone case" />
      <p>Stop looking at your website on your desktop. Your customers aren't. In 2026, roughly 65-70% of your traffic is coming from a mobile device.</p>
      <p>The data shows that mobile conversion rates are currently 42% lower than desktop rates. This isn't because people don't buy on phones: it's because business owners make it physically impossible for them to do so.</p>
      <p>If your mobile site feels like a chore to navigate—tiny buttons, microscopic text, overlapping images—you are effectively telling 70% of your potential revenue to go away.</p>

      <h2>Test 3: The Singular Action (Kill the Distracted)</h2>
      <img src="/blog/website-revenue-leaks-4.webp" alt="Alexander Schottky standing confused in front of a wall of dozens of Push buttons" />
      <p>The biggest mistake I see is "The Paradox of Choice." Business owners are so afraid of missing a lead that they offer ten different paths: blog, Instagram, newsletter, history, gallery. When you give a visitor too many choices, they choose to do nothing.</p>
      <p>Your website should have one primary goal. One "North Star" action that leads directly to revenue. Every other link is a potential exit ramp away from your goal.</p>

      <h2>Identifying and Plugging the Leaks</h2>
      <img src="/blog/website-revenue-leaks-5.webp" alt="Alexander Schottky fixing a leaking digital pipe with a high-tech wrench" />
      <p>Think of your website as a pipe. You’re pumping expensive traffic (water) into one end. If the pipe is full of holes, very little water makes it to the other end (revenue).</p>
      <p>At <a href="https://usetoolcrate.com">ToolCrate</a>, we’ve eliminated the "black box" of web design. Every site we build is hand-vetted by me: an expert reviewer with 15 years of real-world experience.</p>

      <h2>See Where Your Revenue Is Leaking</h2>
      <p>I offer a <strong>Free Expert Preview</strong>. Give me your URL, and I will personally create a functional redesign preview of your existing website. I’ll show you the conversion leaks, the missed revenue opportunities, and exactly how we would fix the locks on your revenue vault.</p>
      <p>No cost. No commitment. Just expert-led analysis that shows you what’s really happening with your traffic.</p>
      <p><strong><a href="/try/">Click here to get your Free Expert Preview and stop the leaks today.</a></strong></p>
    `,
  },
  {
    id: "decorators-vs-digital-locksmiths",
    title:
      "Most Web Designers Are Decorators. I'm a Digital Locksmith. Here's the Difference.",
    date: "2026-07-13",
    excerpt:
      "Stop hiring web decorators who build 'pretty' brochures. Learn how a Digital Locksmith finds revenue leaks and fixes conversion funnels using expert-led UX strategies.",
    category: "Conversion",
    imageUrl: "/blog/decorators-1.webp",
    content: `
      <img src="/blog/decorators-1.webp" alt="Digital Locksmith Alexander Schottky fixing a digital vault" />
      <p>You are being robbed in broad daylight.</p>
      <p>It’s not a guy in a ski mask. It’s not a hacker in a basement.</p>
      <p>It’s your "pretty" website.</p>
      <p>Most business owners hire a web designer and expect a revenue-generating machine.</p>
      <p>Instead, they get a digital paperweight. A "pretty" brochure that looks great on a 27-inch iMac but does absolutely nothing for the bottom line.</p>
      <p>I don’t build digital paperweights. I’m Alexander Schottky, and I’m a Digital Locksmith.</p>
      <p>While the "decorators" are arguing over which shade of teal looks best for your footer, I’m in the basement of your site’s code, finding the cracks where your revenue is leaking out.</p>

      <h2>The "Decorator" Delusion: Why Your Pretty Site Is Failing</h2>
      <img src="/blog/decorators-2.webp" alt="Comparison between a decorator painting glass and a digital locksmith building a fortress" />
      <p>Most web designers are artists. They care about symmetry, white space, and "vibes."</p>
      <p>They want to win a design award. They want to put your project in their portfolio so they can show other designers how creative they are.</p>
      <p><strong>But they don't care about your bank account.</strong></p>
      <p>The "Decorator" approach is fundamentally broken because it focuses on how a site <em>looks</em> rather than how it <em>works</em>.</p>
      <p>They build you a fragile glass house: beautiful to look at, but impossible to live in and totally unsecured.</p>
      <p>If your site looks like a million bucks but generates zero leads, it’s not a business asset. It’s an expensive hobby.</p>

      <h2>The Agitation: Where the Revenue Is Leaking</h2>
      <p>You’re spending money on marketing. You’re running ads, posting on social, and grinding out content.</p>
      <p>You send that traffic to your site, and then… nothing. Silence.</p>
      <p>Nearly every visitor walks right back out the door without leaving a name, an email, or a cent.</p>
      <p><strong>That’s not a traffic problem. That’s a broken lock.</strong></p>
      <img src="/blog/decorators-3.webp" alt="Digital Locksmith plugging a massive revenue leak in a digital pipe" />
      <p>Here is where the "Decorators" fumbled the bag and left your vault wide open:</p>
      <ul>
        <li><strong>The Snail-Pace Load Time:</strong> If your site takes more than 3 seconds to load, you’ve already lost 40% of your audience. The decorators bloated your site with "cool" high-res videos that kill your speed.</li>
        <li><strong>The Friction-Filled Forms:</strong> You have 12 fields in your contact form. Why? Are you the IRS? Every extra field is a barrier between you and a lead.</li>
        <li><strong>The "Stranger Danger" Vibe:</strong> You have no reviews, no trust signals, and no human faces. To a visitor, you’re just another faceless entity they can’t trust with their credit card.</li>
        <li><strong>The Buried CTA:</strong> Your "Book a Call" button is hidden at the bottom of a 2,000-word block of text. No one is looking for it.</li>
        <li><strong>Mobile Chaos:</strong> Your site looks "okay" on a desktop, but it’s a dumpster fire on a phone. Since 60%+ of your traffic is mobile, you’re essentially ignoring more than half of your potential revenue.</li>
      </ul>

      <h2>The Digital Locksmith Methodology</h2>
      <p>I don’t do "pretty." I do performance.</p>
      <p>When I look at a website, I don’t see colors or fonts. I see a series of locks that are either secured or broken.</p>
      <p>My job is to find the leaks and fix the locks so that the traffic you work so hard to get actually converts into cash.</p>
      <p><strong>Expert-Led, Not Bot-Built.</strong></p>
      <p>We live in an age of AI shortcuts. There are a thousand tools that claim they can "generate" a website in 30 seconds.</p>
      <p>Those sites are garbage. They are generic, cookie-cutter templates that have no soul and zero conversion strategy.</p>
      <p>At <a href="https://usetoolcrate.com">ToolCrate</a>, we use a high-authority, expert-reviewed methodology.</p>
      <p>Every design I create is hand-vetted for performance based on 15+ years of real-world UX experience.</p>
      <p>I don't let a bot decide where your primary CTA goes. I decide, based on a decade and a half of seeing what actually makes people click.</p>
      <img src="/blog/decorators-4.webp" alt="Alexander hand-vetting performance on a digital circuit board" />

      <h2>How We Secure Your Revenue</h2>
      <p>We don't just "fix" websites. We overhaul your digital presence to ensure every pixel is pulling its weight.</p>
      <h3>1. The Free Expert Preview</h3>
      <p>I don't expect you to take my word for it. I want to show you exactly where your site is failing.</p>
      <p>You give me your current URL, and I’ll provide a <a href="/try/">Free Expert Preview</a> of a functional redesign.</p>
      <p>I’ll show you the immediate conversion leaks and the missed revenue opportunities you’re currently ignoring. No cost. No commitment. Just a pro showing you how the locks are broken.</p>
      <h3>2. The Core Conversion Site</h3>
      <p>This is our bread and butter. We build you a high-performing lead generation machine (up to 10 pages).</p>
      <p>It’s built for one purpose: conversions.</p>
      <p>It includes elite speed, mobile responsiveness, and ongoing maintenance. We handle the technical headaches so you can focus on the leads we’re generating for you.</p>
      <h3>3. Conversion OS</h3>
      <p>For established brands that are ready to stop playing games, we offer <a href="https://usetoolcrate.com">Conversion OS</a>.</p>
      <p>This is a strategic partnership. You get direct access to me for personalized support, unlimited monthly design iterations, and deep site architecture overhauls.</p>
      <p>It’s like having a master locksmith on permanent retainer, making sure no one and no revenue ever slips through the cracks again.</p>

      <h2>Stop the Bleeding Today</h2>
      <img src="/blog/decorators-5.webp" alt="The Digital Locksmith standing in a secured command center" />
      <p>Every day you wait is another day of lost revenue.</p>
      <p>Every visitor who leaves your site without converting is a dollar you’ll never see again.</p>
      <p>You can keep working with "Decorators" who make things look nice while your business plateaus.</p>
      <p>Or, you can hire a Digital Locksmith to secure your funnel and start capturing the leads you deserve.</p>
      <p><strong>I’ve cracked open a lot of websites. I know exactly where the money is hiding.</strong></p>
      <p>Are you ready to see the truth about your site?</p>
      <p><a href="/try/">Get your Free Expert Preview now.</a></p>
    `,
  },
];

/** @param {string} id */
export function getPostById(id) {
  return posts.find((post) => post.id === id) ?? null;
}

/** Newest first */
export function getPostsSorted() {
  return [...posts].sort((a, b) => (a.date < b.date ? 1 : -1));
}
