import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

const universities = [
  {
    name: 'DePaul University', slug: 'depaul', city: 'Chicago', state: 'IL',
    issOfficeUrl: 'https://offices.depaul.edu/global-engagement/student-resources/international-student-scholar-services/Pages/default.aspx',
    issEmail: 'iss@depaul.edu', issPhone: '312-362-8376',
  },
  {
    name: 'University of Illinois Chicago', slug: 'uic', city: 'Chicago', state: 'IL',
    issOfficeUrl: 'https://ois.uic.edu/', issEmail: 'ois@uic.edu',
  },
  {
    name: 'Illinois Institute of Technology', slug: 'iit', city: 'Chicago', state: 'IL',
    issOfficeUrl: 'https://isss.iit.edu/', issEmail: 'global@illinoistech.edu', issPhone: '312-567-3680',
  },
  {
    name: 'Northwestern University', slug: 'northwestern', city: 'Evanston', state: 'IL',
    issOfficeUrl: 'https://www.northwestern.edu/international/', issEmail: 'oiss-students@northwestern.edu', issPhone: '847-491-5613',
  },
  {
    name: 'University of Illinois Urbana-Champaign', slug: 'uiuc', city: 'Champaign', state: 'IL',
    issOfficeUrl: 'https://isss.illinois.edu/', issEmail: 'isss@illinois.edu',
  },
  {
    name: 'Purdue University', slug: 'purdue', city: 'West Lafayette', state: 'IN',
    issOfficeUrl: 'https://www.purdue.edu/gpp/iss/', issEmail: 'iss@purdue.edu', issPhone: '765-494-5770',
  },
  {
    name: 'Arizona State University', slug: 'asu', city: 'Tempe', state: 'AZ',
    issOfficeUrl: 'https://issc.asu.edu/', issEmail: 'asu.issc@asu.edu', issPhone: '480-727-4776',
  },
  {
    name: 'New York University', slug: 'nyu', city: 'New York', state: 'NY',
    issOfficeUrl: 'https://www.nyu.edu/students/student-information-and-resources/student-visa-and-immigration.html',
    issEmail: 'ogs@nyu.edu', issPhone: '212-998-4720',
  },
  {
    name: 'Northeastern University', slug: 'northeastern', city: 'Boston', state: 'MA',
    issOfficeUrl: 'https://international.northeastern.edu/ogs/', issEmail: 'ogs@northeastern.edu',
  },
  {
    name: 'University of Texas at Dallas', slug: 'utd', city: 'Richardson', state: 'TX',
    issOfficeUrl: 'https://isso.utdallas.edu/', issEmail: 'ISSOProspective@utdallas.edu', issPhone: '972-883-4189',
  },
];

async function main() {
  for (const u of universities) {
    await prisma.university.upsert({ where: { slug: u.slug }, create: u, update: u });
  }
  console.log(`Seeded ${universities.length} universities`);
}

main().finally(() => prisma.$disconnect());
