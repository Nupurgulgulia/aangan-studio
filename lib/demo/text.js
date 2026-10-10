// Words for the demo data: call transcripts, summaries and Chayya's project updates.
import { firstName, spokenDigits } from './util.js';

const GREETING = "Namaste, you've reached Aangan Studio. This is Chayya. How can I help you today?";
const CLOSING = 'Thank you for calling and sharing the information.';

// What the caller actually says about who decides.
function decisionSpeech(decision, hinglish, rng) {
  if (decision.startsWith('owner, spouse')) return hinglish ? 'Main decide karta hoon, mere spouse bhi agree hain aur consultation mein honge.' : rng.pick(['I decide, and my spouse is fine with it. We will both be on the call.', 'It is my decision, and my spouse agrees. They will join as well.']);
  if (decision.startsWith('husband and wife')) return hinglish ? 'Hum dono milkar decide karte hain, dono consultation mein honge.' : 'My husband and I decide together, and we will both attend.';
  if (decision.startsWith('owner decides')) return hinglish ? 'Main decide karunga, par ghar ke log bhi consultation mein baithenge.' : 'I decide, but the family will sit in on the consultation.';
  return hinglish ? 'Main parents ke liye initial kaam dekh raha hoon. Consultation mein woh aayenge aur woh hi decide karenge.' : 'I am doing the initial work for my parents. They will attend and make the decision.';
}

export const timelineText = (weeks) => (weeks <= 8 ? `wants to start within ${weeks} weeks` : weeks <= 14 ? `wants to start in about ${Math.round(weeks / 4.3)} months` : `planning ahead, start in about ${Math.round(weeks / 4.3)} months`);

// A booked call, written the way the agent's prompt runs it. lead: { name, phone, area, type, size, weeks, referral, source, decision }
export function bookedTranscript(lead, designer, when, style, rng) {
  const hinglish = style === 'hinglish';
  const first = firstName(lead.name);
  const wants = hinglish
    ? rng.pick([`Hello, mujhe apna ${lead.type} design karwana hai, poora design aur execution.`, `Hi, humne naya flat liya hai, ${lead.type}. Full interior karwana hai.`])
    : rng.pick([`Hello, I'd like to get my ${lead.type} designed, design and execution both.`, `Hi, we have a ${lead.type} and want full interiors done by a proper studio.`, `Good morning. I'm looking for a designer for my ${lead.type}, complete work.`]);
  const where = hinglish ? `${lead.area} mein hai.` : rng.pick([`It's in ${lead.area}.`, `${lead.area}.`, `The flat is in ${lead.area}.`]);
  const size = hinglish
    ? `Lagbhag ${lead.size} square feet, ${rng.pick(['abhi possession mila hai', 'purana flat hai, hum rehte hain', 'abhi khaali hai'])}.`
    : `About ${lead.size} square feet. ${rng.pick(["It's a new flat, still empty.", "We're living in it right now.", 'Possession was recently handed over.'])}`;
  const start = hinglish
    ? `Hum ${lead.weeks <= 12 ? 'jaldi' : `${Math.round(lead.weeks / 4.3)} mahine mein`} shuru karna chahte hain.`
    : `We'd like to start ${lead.weeks <= 8 ? 'as soon as possible' : `in about ${Math.round(lead.weeks / 4.3)} months`}.`;
  const deciders = decisionSpeech(lead.decision, hinglish, rng);
  const heard = lead.referral ? `A friend recommended you. ${lead.source.replace('referral: ', '')}.` : lead.source === 'Instagram' ? 'I saw your work on Instagram.' : lead.source === 'hoarding' ? 'I saw your hoarding near the main road.' : 'I found you on Google.';
  const lines = [
    ['Agent', GREETING],
    ['Caller', wants],
    ['Agent', 'Happy to help. Where is the property?'],
    ['Caller', where],
    ['Agent', 'Thank you. Roughly how big is it, and is it new, lived-in or rented?'],
    ['Caller', size],
    ['Agent', 'When would you like to start the work?'],
    ['Caller', start],
    ['Agent', 'And who will decide on the design? Will they be on the consultation?'],
    ['Caller', deciders],
    ['Agent', 'How did you hear about the studio?'],
    ['Caller', heard],
    ['Agent', 'Lovely. May I have your name and the best number to call?'],
    ['Caller', `${lead.name}. ${hinglish ? 'Number hai' : 'My number is'} ${spokenDigits(lead.phone)}.`],
    ['Agent', `Let me confirm: ${first}, ${lead.type}, about ${lead.size} square feet in ${lead.area}, number ${spokenDigits(lead.phone)}. Is that right?`],
    ['Caller', hinglish ? 'Haan, bilkul sahi.' : rng.pick(['Yes, that is right.', 'Yes, correct.'])],
    ['Agent', `${designer} will call you ${when}. They will go through your project with you. ${CLOSING}`],
  ];
  return lines.map(([who, text]) => `${who}: ${text}`).join('\n');
}

export function leadSummary(lead) {
  const parts = [
    `${lead.type}, about ${lead.size} sq ft, in ${lead.area}.`,
    `${lead.weeks <= 8 ? 'Wants to start within ' + lead.weeks + ' weeks' : 'Wants to start in about ' + Math.round(lead.weeks / 4.3) + ' months'}.`,
    `Decision-maker: ${lead.decision}`,
    `Source: ${lead.source}.`,
  ];
  if (lead.notes) parts.push(lead.notes);
  return parts.join(' ');
}

const DECLINES = {
  outside_area: (c) => ({
    reason: `outside service area: caller said ${c.area} (read back and confirmed)`,
    summary: `${c.type} in ${c.area}. Outside Pune and PCMC, so politely declined after read-back.`,
    lines: [['Caller', `Hi, I want my ${c.type} designed.`], ['Agent', 'Happy to help. Where is the property?'], ['Caller', `It's in ${c.area}.`],
      ['Agent', `Just to confirm, the property is in ${c.area}?`], ['Caller', `Yes, ${c.area}.`],
      ['Agent', "We only work in Pune and the Pimpri Chinchwad area at the moment, because our execution depends on our own contractors being on site. I'm sorry we can't help."],
      ['Caller', 'Okay, no problem. Thanks.']],
  }),
  advice_only: (c) => ({
    reason: 'advice only: wants colour and furniture ideas, no execution',
    summary: `Wants colour and furniture arrangement ideas for a ${c.type}. Not a design-and-execution project.`,
    lines: [['Caller', "Hello, I just need some ideas for colours and how to arrange furniture in my living room. I'll get the work done myself."],
      ['Agent', 'Thank you for asking. Just to be sure, you are looking for ideas only, and not for the studio to do the design and execution?'], ['Caller', "Yes, only ideas, I have my own carpenter."],
      ['Agent', "We're a full-service studio, so our projects include design and execution together. If you plan a full project, we'd be a great fit, and you're very welcome to call back."], ['Caller', 'Okay, maybe later then.']],
  }),
  timeline: (c) => ({
    reason: 'timeline: wants living room and kitchen done before Diwali, three weeks away; later start offered',
    summary: `${c.type}, needs it complete in three weeks for Diwali. The studio cannot start execution inside six weeks. A later start was offered.`,
    lines: [['Caller', "We have Diwali in three weeks and want the living room and kitchen redone completely before that."], ['Agent', 'I see. Where is the property?'], ['Caller', "It's in Pune."],
      ['Agent', 'Just to confirm, you need the full work finished in about three weeks?'], ['Caller', 'Yes, three weeks.'],
      ['Agent', "I'm sorry, a full design and execution needs more lead time than that. If a later start works, for example after the festival, we would be happy to help."], ['Caller', 'Let me think about November then.']],
  }),
  restaurant: (c) => ({
    reason: 'outside what the studio does: restaurant interiors',
    summary: `Wants restaurant interiors in ${c.area}. The studio does homes and small offices, so declined.`,
    lines: [['Caller', 'Hi, we are opening a restaurant in Koregaon Park and need the full interiors.'], ['Agent', 'Thank you for calling. Just to confirm, this is a restaurant?'], ['Caller', 'Yes, a 40-seater restaurant.'],
      ['Agent', "I'm sorry, we design homes and small offices, and restaurants are outside what we do. A hospitality specialist would serve you better."], ['Caller', 'Alright, thanks.']],
  }),
};

const ESCALATIONS = {
  silent_designer: (c) => ({
    summary: `Existing client, ${c.type} in ${c.area}. Designer has not replied for five days. Wants Nikhil or a senior person to call back.`,
    lines: [['Caller', 'I am an existing client and my designer has not replied to me for five days. I want to speak to someone senior, or Nikhil.'],
      ['Agent', "I'm very sorry about that. Let me take your details so this reaches the right person. May I have your name, your designer's name and your number?"],
      ['Caller', `${c.name}. My designer is Aryan. The project is in ${c.area}.`],
      ['Agent', "I'm passing this to our senior team right now. Would you like a callback within 15 minutes from someone senior?"], ['Caller', 'Yes please, that would help.']],
  }),
  delay_complaint: (c) => ({
    summary: `Existing client, ${c.type} in ${c.area}. Upset about carpentry delay of two weeks. Wants a senior callback.`,
    lines: [['Caller', 'The carpentry work at my flat is two weeks late and nobody gives me a straight answer.'],
      ['Agent', "I'm sorry, that is not the experience we want you to have. May I take your name and project details?"], ['Caller', `${c.name}, ${c.type}, ${c.area}.`],
      ['Agent', "I'm passing this to our senior team right now. Would you like a callback within 15 minutes from someone senior?"], ['Caller', 'Yes, please do.']],
  }),
};

const INFO = {
  vendor: (c) => ({ summary: `${c.name} offering tiles and surface samples. Left a message for the designers.`, lines: [['Caller', "Hello, I supply premium tiles and would like to send samples to your designers."], ['Agent', 'Thank you. May I take your name, number and a short message for the team?'], ['Caller', "Rakesh, I'll leave my number. Please ask someone to call."]] }),
  job_seeker: (c) => ({ summary: `${c.name} asking about a junior designer opening. Left a message for the studio.`, lines: [['Caller', 'Hi, I am a recent interior design graduate. Are you hiring junior designers?'], ['Agent', 'Thank you for asking. I will pass your name and number to the team, who handle hiring.'], ['Caller', 'Great, thank you. My name is Mansi.']] }),
};

const asText = (lines) => lines.map(([who, text]) => `${who}: ${text}`).join('\n');

export function otherCall(c) {
  if (c.outcome === 'declined') {
    const d = DECLINES[c.kind](c);
    return { reason: d.reason, summary: d.summary, transcript: asText([['Agent', GREETING], ...d.lines, ['Agent', CLOSING]]) };
  }
  if (c.outcome === 'escalated') {
    const e = ESCALATIONS[c.kind](c);
    return { summary: e.summary, transcript: asText([['Agent', GREETING], ...e.lines, ['Agent', CLOSING]]) };
  }
  if (c.outcome === 'info_only') {
    const i = INFO[c.kind](c);
    return { summary: i.summary, transcript: asText([['Agent', GREETING], ...i.lines, ['Agent', CLOSING]]) };
  }
  return { summary: 'Call dropped after the greeting. No details taken.', transcript: asText([['Agent', GREETING], ['Caller', '(line went quiet, call ended)']]) };
}

// Chayya's updates to a customer while the project runs.
export function projectUpdate(project, designer, stage, when) {
  const first = firstName(project.customer_name);
  const msg = {
    design: `Namaste ${first}, Chayya from Aangan Studio. ${designer} has shared the latest version of your layout. Please have a look and send your thoughts. ${designer} will walk you through it on ${when}.`,
    approvals: `Namaste ${first}, Chayya here. Your layout and material choices are ready for sign-off. ${designer} will meet you ${when} to go through them and finalise.`,
    execution: `Namaste ${first}, Chayya from Aangan Studio. A quick update on your home: work is progressing on schedule. ${designer} will be at the site ${when}, and I will send you photos after the visit.`,
    finishing: `Namaste ${first}, Chayya here. The finishing work at your home is almost complete. ${designer} will do a final walk-through ${when} to note anything that needs a touch-up.`,
    handover: `Namaste ${first}, Chayya from Aangan Studio. Your home is nearly ready. The handover is planned for ${when}. ${designer} will go through every room with you, and we will also give you the warranty and care notes.`,
  };
  return msg[stage] || msg.execution;
}
