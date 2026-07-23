// One-line, plain-English descriptions of what each of the 30 official FBLA
// presentation events actually asks a competitor to do — shown on the
// Workbot base tab once a student picks an event, so they can get their
// bearings on the format before choosing script/file/audio and grading.
// Grounded in each event's real participants/deliverable shape from
// data/presentation_rubrics.json (the 15 build-ready events) — kept
// deliberately more generic for the 15 not-yet-gradable ones, whose exact
// team-size/deliverable fields aren't tracked anywhere in this codebase yet.
export const PRESENTATION_EVENT_DESCRIPTIONS = {
  'Business Plan': 'A team of 1-3 develops a full business plan for a new venture — market analysis, operations, financials — submitted as a written report and delivered live with judge Q&A.',
  'Financial Planning': 'A team of 1-3 builds and presents a financial plan covering budgeting, saving, investing, and risk management, live to judges.',
  'Financial Statement Analysis': "A team of 1-3 analyzes a company's financial statements, assesses its financial health, and presents recommendations live to judges.",
  'Event Planning': 'A team of 1-3 plans a real event from concept to execution — budget, logistics, marketing — and presents the plan live to judges.',
  'Data Analysis': 'A team of 1-3 analyzes a real dataset to surface business insights and presents data-driven recommendations live to judges.',
  'Supply Chain Management': 'A team of 1-3 develops a plan addressing a supply chain challenge or opportunity and presents it live to judges.',
  'Future Business Educator': 'An individual event for aspiring business teachers: submit a short lesson plan, then teach/present it live to judges.',
  'Social Media Strategies': 'A team of 1-3 develops a social media marketing strategy for a business and presents it live to judges.',
  'Business Ethics': 'A team of 1-3 takes an objective test on ethics, submits a short executive summary analyzing an ethical dilemma, and presents their analysis live.',
  'Career Portfolio': 'An individual builds a professional portfolio (resume, cover letter, goals) and presents it live as if applying for a real job.',
  'Job Interview': 'An individual submits a cover letter and resume, then goes through a live mock job interview with judges.',
  'Public Speaking': 'An individual delivers a prepared speech on a business-related topic, then takes judge Q&A.',
  'Introduction to Public Speaking': 'The entry-level version of Public Speaking for grades 9-10 — same prepared-speech-plus-Q&A format.',
  'Introduction to Business Presentation': 'A team of 1-3 (grades 9-10) researches a business topic and delivers a prepared slide presentation.',
  'Sales Presentation': 'A team of 1-3 delivers an interactive sales pitch for a product or service to a simulated customer.',

  'Broadcast Journalism': 'A team produces a short broadcast-news-style video segment covering a business or FBLA-related topic.',
  'Digital Video Production': 'A team produces an original short video on a business-related theme, judged on production quality and storytelling.',
  'Public Service Announcement': 'A team produces a short video PSA promoting a business, community, or FBLA-related cause.',
  'Digital Animation': 'An individual or team creates an original animated piece demonstrating animation and storytelling skills.',
  'Graphic Design': 'An individual designs a piece of business graphic design — branding or marketing material — to a given prompt.',
  'Visual Design': "An individual creates a visual design solution — layout, UX — for a given business scenario.",
  'Coding & Programming': 'An individual or team solves a programming challenge and presents the working solution.',
  'Computer Game & Simulation Programming': 'A team designs and builds an original computer game or simulation.',
  'Mobile Application Development': 'A team designs and builds a mobile app prototype solving a real-world problem.',
  'Website Coding & Development': 'A team builds a functioning website from a given prompt, judged on code and functionality.',
  'Website Design': "A team designs a website's visual layout and user experience for a given prompt.",
  'Introduction to Programming': 'An entry-level coding event — solve a basic programming challenge and explain the solution.',
  'Impromptu Speaking': 'An individual draws a topic on the spot and delivers a short, unprepared speech.',
  'Future Business Leader': 'An individual event testing broad business knowledge and leadership readiness through an on-the-spot presentation.',
  'Introduction to Social Media Strategy': 'An entry-level event — propose a basic social media plan for a given business scenario.',
};
