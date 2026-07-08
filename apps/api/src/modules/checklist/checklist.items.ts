/** Static checklist content — only completion state lives in the DB (see ChecklistItem). */
export interface ChecklistItemDef {
  key: string;
  title: string;
  description: string;
  category: 'arrival' | 'documents' | 'finance' | 'health' | 'immigration' | 'academic' | 'waypoint';
  priority: number;
  link: string | null;
}

export const CHECKLIST_ITEMS: ChecklistItemDef[] = [
  {
    key: 'report_to_dso',
    title: 'Report to your DSO',
    description: 'Visit your International Student Office within 30 days of arrival',
    category: 'arrival',
    priority: 1,
    link: null,
  },
  {
    key: 'get_ssn',
    title: 'Apply for Social Security Number',
    description: 'Eligible after you have an on-campus job offer or work authorization. Bring your I-20, passport, I-94, and offer letter.',
    category: 'documents',
    priority: 2,
    link: 'https://www.ssa.gov/pubs/EN-05-10181.pdf',
  },
  {
    key: 'open_bank_account',
    title: 'Open a US bank account',
    description: 'Bring your passport, I-20, and university acceptance letter. Chase, Bank of America, and Wells Fargo all work for international students.',
    category: 'finance',
    priority: 3,
    link: null,
  },
  {
    key: 'get_drivers_license',
    title: "Apply for state ID or driver's license",
    description: 'In Illinois, visit the DMV with your passport, I-20, I-94, and proof of Illinois address. No SSN required for state ID.',
    category: 'documents',
    priority: 4,
    link: 'https://www.ilsos.gov/facilities/facilitylist.html',
  },
  {
    key: 'get_health_insurance',
    title: 'Confirm health insurance coverage',
    description: 'Most universities require health insurance. Confirm your university plan is active or enroll in one.',
    category: 'health',
    priority: 5,
    link: null,
  },
  {
    key: 'first_credit_card',
    title: 'Get your first US credit card',
    description: "Start building US credit history. Discover It Student and Deserve EDU don't require SSN or credit history. Capital One Secured is another option.",
    category: 'finance',
    priority: 6,
    link: null,
  },
  {
    key: 'setup_i94',
    title: 'Check your I-94 record',
    description: 'Verify your arrival record is correct at cbp.dhs.gov. This confirms your legal entry and status.',
    category: 'immigration',
    priority: 7,
    link: 'https://i94.cbp.dhs.gov',
  },
  {
    key: 'enroll_fulltime',
    title: 'Confirm full-time enrollment',
    description: 'F-1 students must maintain full-time enrollment each semester (usually 12+ credits for undergrad, 9+ for grad).',
    category: 'academic',
    priority: 8,
    link: null,
  },
  {
    key: 'upload_documents',
    title: 'Upload your key documents to Waypoint',
    description: "Store your I-20, passport, and visa stamp so they're always accessible.",
    category: 'waypoint',
    priority: 9,
    link: '/documents',
  },
  {
    key: 'understand_cpt_opt',
    title: 'Learn about CPT and OPT',
    description: 'Understand your work authorization options before you need them. Talk to your DSO in your first semester.',
    category: 'immigration',
    priority: 10,
    link: null,
  },
];
