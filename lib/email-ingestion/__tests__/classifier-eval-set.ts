import type { ClassificationInput, InboundEmailClass } from '../classifier';

export interface EvalCase extends ClassificationInput {
  readonly expected: InboundEmailClass;
  readonly note?: string;
}

function base(overrides: Partial<EvalCase>): EvalCase {
  return {
    body: '',
    expected: 'NOISE',
    from: 'someone@example.com',
    inReplyTo: null,
    receivedAt: new Date('2026-04-22T12:00:00Z'),
    subject: '',
    to: 'me@mydomain.com',
    uid: '1',
    ...overrides,
  };
}

export const CLASSIFIER_EVAL_SET: readonly EvalCase[] = [
  // INTERVIEW_INVITE (8)
  base({
    body:
      "Hi Steven, thanks for applying to the Senior Engineer role. " +
      "We'd like to schedule an interview next week. Are you free Tuesday " +
      'at 2pm PT? I can share a calendly.com/recruiter/30min link if that helps.',
    expected: 'INTERVIEW_INVITE',
    from: 'recruiter@fixtureco.com',
    subject: 'Interview with Fixture Co',
  }),
  base({
    body:
      'Hi Steven, are you available for a 30-minute zoom chat on Thursday ' +
      'at 11am? Looking forward to connecting.',
    expected: 'INTERVIEW_INVITE',
    from: 'hiring@fixtureco.com',
    subject: 'Quick chat?',
  }),
  base({
    body:
      'We would like to set up an interview. Please book a time here: ' +
      'https://calendly.com/fixture/interview',
    expected: 'INTERVIEW_INVITE',
    from: 'recruiter@fixtureco.com',
    subject: 'Interview invitation',
  }),
  base({
    body:
      "Can you do a 20-minute phone call on Friday? I'd love to walk through " +
      'your background.',
    expected: 'INTERVIEW_INVITE',
    from: 'emily@fixtureco.com',
    subject: 'Re: Your application',
  }),
  base({
    body:
      'Sharing my availability for a first-round interview: Monday 3pm, ' +
      "Tuesday 10am, or Wednesday 1pm. Please let me know what works.",
    expected: 'INTERVIEW_INVITE',
    from: 'recruiter@fixtureco.com',
    subject: 'Interview availability',
  }),
  base({
    body:
      "Hi, I'd like to set up an interview time. Does Thursday at 9am PT suit?",
    expected: 'INTERVIEW_INVITE',
    from: 'recruiter@fixtureco.com',
    subject: 'Follow up',
  }),
  base({
    body:
      'Please join the google meet at https://meet.google.com/abc-defg-hij ' +
      'on Friday 2pm for the interview.',
    expected: 'INTERVIEW_INVITE',
    from: 'hr@fixtureco.com',
    subject: 'Interview confirmation',
  }),
  base({
    body:
      "Great chatting earlier — let's set up a second-round interview. Are " +
      'you available next Wednesday afternoon?',
    expected: 'INTERVIEW_INVITE',
    from: 'hiring-manager@fixtureco.com',
    inReplyTo: '<abc@fixtureco.com>',
    subject: 'Re: next steps',
  }),

  // REJECTION (8)
  base({
    body:
      "Thank you for taking the time to apply. Unfortunately, we've decided " +
      "to move forward with other candidates for the Senior Engineer role. " +
      'We wish you the best in your search.',
    expected: 'REJECTION',
    from: 'recruiting@fixtureco.com',
    subject: 'Update on your application',
  }),
  base({
    body:
      "After careful review, we regret to inform you that we won't be " +
      'moving forward with your candidacy at this time.',
    expected: 'REJECTION',
    from: 'recruiting@fixtureco.com',
    subject: 'Application status',
  }),
  base({
    body:
      'Unfortunately, the position has been filled. Best of luck.',
    expected: 'REJECTION',
    from: 'no-reply@fixtureco.com',
    subject: 'Regarding your application',
  }),
  base({
    body:
      "Thanks for your interest. We've decided to pursue other candidates " +
      'whose experience more closely matches what we are looking for.',
    expected: 'REJECTION',
    from: 'recruiter@fixtureco.com',
    subject: 'Fixture Co update',
  }),
  base({
    body:
      'We are unable to move forward with your application at this time.',
    expected: 'REJECTION',
    from: 'no-reply@fixtureco.com',
    subject: 'Application update',
  }),
  base({
    body:
      "Unfortunately we will not be moving forward with your application. " +
      'Thank you for considering us.',
    expected: 'REJECTION',
    from: 'recruiting@fixtureco.com',
    subject: 'Update',
  }),
  base({
    body:
      'We filled the position already. Apologies for the delay in response.',
    expected: 'REJECTION',
    from: 'recruiter@fixtureco.com',
    subject: 'Re: your application',
  }),
  base({
    body:
      'This is an automated message. We regret to inform you that we are ' +
      "unable to move forward with your application for the Software " +
      'Engineer role.',
    expected: 'REJECTION',
    from: 'no-reply@fixtureco.com',
    subject: 'Application decision',
    note: 'Auto-response + rejection content = rejection wins',
  }),

  // AUTO_RESPONSE (6)
  base({
    body:
      'This mailbox is not monitored. Please do not reply to this message.',
    expected: 'AUTO_RESPONSE',
    from: 'no-reply@fixtureco.com',
    subject: 'Application received',
  }),
  base({
    body: 'Automated reply: your message has been received.',
    expected: 'AUTO_RESPONSE',
    from: 'bot@fixtureco.com',
    subject: 'Auto: Received',
  }),
  base({
    body: 'I am out of office until Monday. Please email my colleague.',
    expected: 'AUTO_RESPONSE',
    from: 'recruiter@fixtureco.com',
    subject: 'Out of office',
  }),
  base({
    body: "This is an auto-generated response. Do not reply.",
    expected: 'AUTO_RESPONSE',
    from: 'noreply@ats.com',
    subject: 'Acknowledgement',
  }),
  base({
    body:
      'Your email has been received. This mailbox is unmonitored; ' +
      'a team member will follow up separately.',
    expected: 'AUTO_RESPONSE',
    from: 'no-reply@fixtureco.com',
    subject: 'Re: application',
  }),
  base({
    body:
      "Thank you. Please do not respond to this message; this is an " +
      'automatic acknowledgement.',
    expected: 'AUTO_RESPONSE',
    from: 'bot@fixtureco.com',
    subject: 'Received',
  }),

  // REPLY (6)
  base({
    body:
      "Hey Steven, thanks for reaching out! I'd love to chat more about " +
      "the role. What's a good time for us to sync? " +
      '\n\nOn 2026-04-20 Steven wrote:\n> Hi, looking forward to hearing from you.',
    expected: 'REPLY',
    from: 'hiring-manager@fixtureco.com',
    inReplyTo: '<abc@mydomain.com>',
    subject: 'Re: interested in chatting',
  }),
  base({
    body:
      "Thanks for reaching out. Let me loop in my colleague who owns " +
      'that team.',
    expected: 'REPLY',
    from: 'contact@fixtureco.com',
    inReplyTo: '<def@mydomain.com>',
    subject: 'Re: quick intro',
  }),
  base({
    body:
      'Following up on the note I sent last week. Any thoughts?',
    expected: 'REPLY',
    from: 'recruiter@fixtureco.com',
    inReplyTo: '<ghi@mydomain.com>',
    subject: 'Re: ping',
  }),
  base({
    body:
      "Wanted to circle back on your application. Would love to learn more " +
      'about your background.',
    expected: 'REPLY',
    from: 'recruiter@fixtureco.com',
    subject: 'Following up',
  }),
  base({
    body:
      'Great to hear you, Steven. Let me check with the team and get back to you.',
    expected: 'REPLY',
    from: 'hiring-manager@fixtureco.com',
    inReplyTo: '<jkl@mydomain.com>',
    subject: 'Re: your note',
  }),
  base({
    body:
      "On 2026-04-21 Steven wrote:\n> Hi, any update on next steps?\n\n" +
      "Hey Steven, we should have an answer by Friday.",
    expected: 'REPLY',
    from: 'recruiter@fixtureco.com',
    subject: 'Re: next steps',
  }),

  // NOISE (6)
  base({
    body:
      "Your weekly roundup of industry news. Top stories this week: ... " +
      'Unsubscribe | Manage your preferences',
    expected: 'NOISE',
    from: 'newsletter@industry.com',
    subject: 'Weekly newsletter',
  }),
  base({
    body:
      'Join our upcoming webinar on Thursday. Click here to register.',
    expected: 'NOISE',
    from: 'events@vendor.com',
    subject: 'Webinar invite',
  }),
  base({
    body: '',
    expected: 'NOISE',
    from: 'notifications@someservice.com',
    subject: 'You have a new newsletter',
  }),
  base({
    body:
      'You received this because you signed up at someservice.com. ' +
      'Manage your preferences here.',
    expected: 'NOISE',
    from: 'notifications@someservice.com',
    subject: 'Product update',
  }),
  base({
    body:
      "New features this week: ... unsubscribe to stop receiving these.",
    expected: 'NOISE',
    from: 'product@someservice.com',
    subject: 'April digest',
  }),
  base({
    body:
      'Claim your free trial today. Unsubscribe anytime.',
    expected: 'NOISE',
    from: 'promo@vendor.com',
    subject: 'Special offer',
  }),
];
