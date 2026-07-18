// Discrimination check — NOT the golden test. If a deliberately weak,
// generic, off-theme-ish speech scores nearly as high as the strong golden
// sample, the grader isn't discriminating and Haiku's leniency is a real
// problem, not a theoretical one.

import { gradeScript } from '../scriptGrader.js';

const WEAK_SPEECH = `
Today I want to talk about overcoming challenges. Challenges are hard but you can get through them if you try your best and never give up.

One time something bad happened to me and it was difficult. But I worked hard and eventually things got better. That is what overcoming challenges means to me.

Everyone faces challenges in life. Some people face bigger challenges than others. It is important to stay positive and keep trying no matter what happens.

In conclusion, overcoming challenges is important and everyone should try to do their best when things get hard. Thank you.
`.trim();

async function main() {
  const result = await gradeScript('Public Speaking', WEAK_SPEECH);
  console.log(JSON.stringify(result, null, 2));
  console.log(`\nSubtotal: ${result.subtotal} / ${result.ceiling}`);
}

main().catch(err => { console.error(err); process.exit(1); });
